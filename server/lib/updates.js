// ============================================================
// lib/updates.js — Détection des nouveaux chapitres (audit §15)
// ------------------------------------------------------------
// Cœur partagé entre :
//   · GET /api/me/updates (bouton « Mettre à jour » de la bibliothèque)
//   · la tâche de fond qui pousse une notification quand un nouveau
//     chapitre sort sur une série suivie (§15.3 — les deux briques,
//     détection + Web Push, existaient déjà mais n'étaient pas reliées).
//
// Améliorations §15 :
//   · filtre par statut (par défaut on ne re-scanne pas Terminé/Abandonné)
//   · les échecs de vérification sont REMONTÉS (plus de catch silencieux)
//   · vérification possible d'une seule série (fiche série)
//   · cooldown serveur sur les scans complets (15 min / utilisateur)
// ============================================================
const { pool } = require('../config/db');
const extensions = require('../extensions/loader');
const { planifier } = require('./ordonnanceur');
const { createNotification, purgerNotificationsLues, RETENTION_JOURS } = require('./notify');

// Concurrence bornée (reprend le mapLimit du controller, ici partagé)
async function mapLimit(items, limit, fn) {
    const out = new Array(items.length);
    let idx = 0;
    const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (idx < items.length) {
            const i = idx++;
            out[i] = await fn(items[i], i);
        }
    });
    await Promise.all(workers);
    return out;
}

// Cooldown en mémoire : uid → timestamp du dernier scan complet.
// (Un redémarrage remet à zéro — acceptable pour un garde-fou.)
const lastFullScan = new Map();
const FULL_SCAN_COOLDOWN_MS = 15 * 60 * 1000;

// ── BUG-13 : « déjà vérifié » n'est pas une erreur ──────────
// Le garde de 15 minutes ne retenait QUE l'horodatage. Pendant la fenêtre, le
// serveur n'avait donc rien à rendre et répondait 429 — un code d'ERREUR pour
// un état parfaitement normal. Relevé pendant l'audit sur 12 pages sur 20 :
// l'app se bridait elle-même, et chaque page affichait un échec en console
// alors que rien n'allait mal.
//
// On garde donc le DERNIER RÉSULTAT à côté de l'horodatage. Pendant la
// fenêtre, on le rend tel quel en 200, marqué comme non frais. C'est vrai —
// la donnée est réelle, seulement datée — et le garde reste entier : aucun
// scan sortant n'est déclenché.
//
// Cache borné : le résultat porte une entrée par série suivie (365 chez
// l'utilisateur de l'audit). Une Map sans limite ferait de ce garde-fou une
// fuite de mémoire sur un hub à plusieurs comptes.
const BoundedCache = require('./bounded-cache');
const derniersScans = new BoundedCache({ max: 50, ttl: FULL_SCAN_COOLDOWN_MS * 2 });

function fullScanCooldown(uid) {
    const last = lastFullScan.get(uid) || 0;
    const left = last + FULL_SCAN_COOLDOWN_MS - Date.now();
    return left > 0 ? left : 0;
}
function markFullScan(uid, resultat) {
    lastFullScan.set(uid, Date.now());
    if (resultat) derniersScans.set(`u:${uid}`, { ...resultat, checkedAt: Date.now() });
}

/** Dernier résultat connu, ou null si le cache l'a évincé. */
function dernierScan(uid) {
    return derniersScans.get(`u:${uid}`) || null;
}

/**
 * Scanne les séries suivies d'un utilisateur.
 * @param {number} uid
 * @param {object} opts
 *   scope   'active' (défaut : ignore Terminé/Abandonné) | 'all'
 *   mangaId vérifie UNE seule série (ignore scope/cooldown)
 *   lang    langues de chapitres ('fr,en' par défaut)
 *   notifyOnly  n'examine que les séries dont les notifications sont actives
 * @returns {{updates: Array, failures: Array, scanned: number, skipped: number}}
 */
// ── Mémo par série ──────────────────────────────────────────
// Une série vérifiée il y a moins de 20 minutes n'est pas redemandée au site :
// relancer « Mettre à jour » juste après un premier passage, ou l'enchaîner
// avec le scan de fond, ne coûte plus rien aux sources. Seule la forme
// compacte des chapitres est gardée (id + numéro), pas les listes complètes.
const MEMO_TTL = parseInt(process.env.UPDATES_MEMO_MS || String(20 * 60 * 1000), 10);
const memoSeries = new BoundedCache({ max: 5000, ttl: MEMO_TTL });
const MEMO_FORCE_MS = 3 * 60 * 1000;

async function chapitresDe(src, mangaId, lang, { force = false, prio = 'normale' } = {}) {
    const cle = `${src.id}:${mangaId}:${lang}`;
    // Un clic manuel (force) revérifie, sauf ce qui vient de l'être : deux
    // clics rapprochés ne doivent pas doubler la charge sur les sites.
    const m = memoSeries.get(cle);
    if (m && (!force || Date.now() - m.at < MEMO_FORCE_MS)) return m.chaps;
    // Le délai ne court qu'une fois la requête PARTIE : l'attente dans la file
    // de la source (quand elle ralentit après un 429) n'est pas une panne.
    const data = await planifier(src.id, prio, () => withTimeout(src.getChapters(mangaId, { lang }), PER_SERIES_MS),
        { patient: prio !== 'haute' });
    const chaps = (data && data.results || []).map(c => ({
        id: c.id, chapter: c.chapter, title: c.title, publishedAt: c.publishedAt,
    }));
    memoSeries.set(cle, { chaps, at: Date.now() });
    return chaps;
}

// Timeout par série (robustesse) : une source lente/bloquée (Cloudflare,
// site HS) ne doit pas figer tout le scan.
const PER_SERIES_MS = 20000;
const withTimeout = (p, ms) => {
    let t;
    return Promise.race([
        p,
        new Promise((_, rej) => { t = setTimeout(() => rej(new Error('délai dépassé (source lente)')), ms); }),
    ]).finally(() => clearTimeout(t));
};

async function scanUserUpdates(uid, { scope = 'active', mangaId = null, lang = 'fr,en', notifyOnly = false, force = false, onProgress = null } = {}) {
    const params = [uid];
    let where = 'f.user_id = ?';
    if (mangaId) { where += ' AND f.manga_id = ?'; params.push(mangaId); }
    // Audit AMEL-54 : `notifyOnly` ne concerne QUE la tâche de fond. Le bouton
    // « Mettre à jour » de la bibliothèque doit continuer à tout vérifier —
    // couper les notifications d'une série n'est pas cesser de la suivre.
    if (notifyOnly) where += ' AND f.notify = 1';
    const [favs] = await pool.query(
        // Audit DB-02 : le statut est une colonne de `favorites` depuis la
        // migration 7 — plus de LEFT JOIN sur cette requête, qui tourne pour
        // chaque compte à chaque scan de mises à jour.
        `SELECT f.manga_id, f.source, f.title, f.cover, f.last_chapter, f.status
         FROM favorites f
         WHERE ${where}`,
        params
    );
    if (!favs.length) return { updates: [], failures: [], scanned: 0, skipped: 0 };

    // §15.2 : ne pas re-scanner les séries Terminé/Abandonné par défaut
    const SKIP_STATUS = new Set(['completed', 'dropped']);
    const targets = (mangaId || scope === 'all')
        ? favs
        : favs.filter(f => !SKIP_STATUS.has(f.status));
    const skipped = favs.length - targets.length;

    const [readRows] = await pool.query(
        'SELECT manga_id, chapter_number FROM read_chapters WHERE user_id = ?', [uid]
    );
    const progressByManga = {};
    try {
        const [progRows] = await pool.query('SELECT manga_id, chapter_number FROM progress WHERE user_id = ?', [uid]);
        progRows.forEach(r => { progressByManga[r.manga_id] = r.chapter_number; });
    } catch (e) { /* table absente : on s'en tient aux chapitres marqués lus */ }
    const readByManga = {};
    readRows.forEach(r => {
        (readByManga[r.manga_id] = readByManga[r.manga_id] || new Set()).add(r.chapter_number);
    });

    const failures = [];
    let faits = 0;
    const signaler = () => { if (onProgress) try { onProgress({ faits, total: targets.length }); } catch (e) { /* observateur fautif */ } };
    // Une file par source : une source lente ou freinée (429) n'immobilise
    // plus les séries des autres sources derrière elle.
    const parSource = new Map();
    targets.forEach(f => {
        const k = f.source || 'mangadex';
        if (!parSource.has(k)) parSource.set(k, []);
        parSource.get(k).push(f);
    });
    const results = (await Promise.all([...parSource.values()].map(groupe =>
        mapLimit(groupe, 4, async (f) => {
            try { return await examinerSerie(f); }
            finally { faits++; signaler(); }
        })
    ))).flat();

    async function examinerSerie(f) {
        const src = extensions.get(f.source || 'mangadex') || extensions.defaultSource();
        if (!src || typeof src.getChapters !== 'function') {
            failures.push({ mangaId: f.manga_id, title: f.title || f.manga_id, cover: f.cover || null, error: `Source « ${f.source} » indisponible` });
            return null;
        }
        let chaps = [];
        try {
            chaps = await chapitresDe(src, f.manga_id, lang, { force: force || !!mangaId, prio: mangaId ? 'haute' : 'normale' });
        } catch (e) {
            // §15.2 : l'échec est remonté, plus jamais avalé en silence
            failures.push({ mangaId: f.manga_id, title: f.title || f.manga_id, cover: f.cover || null, source: f.source, error: String(e.message || e).slice(0, 200) });
            return null;
        }
        if (!chaps.length) return null;

        const readSet = readByManga[f.manga_id] || new Set();
        const latest  = chaps[0];   // trié desc par les extensions
        // « Non lu » = APRÈS l'endroit où l'on en est. Beaucoup de lecteurs
        // reprennent une série au chapitre 1192 sans avoir marqué les 1191
        // précédents : les compter comme non lus annonçait « 1192 nouveaux »
        // sur One Piece, lu à jour. Le plafond est le plus loin des deux :
        // le chapitre de la PROGRESSION (où l'on est). Pas le plus haut chapitre
        // marqué lu : lire le 10 et le 12 en sautant le 11 doit laisser le 11
        // à lire.
        let plafond = -Infinity;
        const pc = Number(progressByManga[f.manga_id]);
        if (Number.isFinite(pc) && pc > plafond) plafond = pc;
        const unread  = chaps.filter(c => !readSet.has(c.chapter) && !(Number(c.chapter) <= plafond));
        // Audit AMEL-55 : « Lire maintenant » doit ouvrir le PREMIER non lu,
        // pas le dernier paru. Sur trois chapitres en retard, envoyer au plus
        // récent fait sauter les deux du milieu.
        const premierNonLu = unread.length
            ? unread.reduce((a, b) => (Number(a.chapter) <= Number(b.chapter) ? a : b))
            : null;

        // Le vrai nombre de non-lus, gardé en base : la bibliothèque l'affiche
        // ensuite sans rien estimer, même après un redémarrage.
        const parution = latest?.publishedAt ? new Date(latest.publishedAt) : null;
        pool.query(
            `UPDATE favorites SET last_chapter = COALESCE(?, last_chapter), unread_count = ?,
                latest_at = COALESCE(?, latest_at), checked_at = NOW()
             WHERE user_id = ? AND manga_id = ?`,
            [latest?.chapter ?? null, unread.length,
             parution && !Number.isNaN(parution.getTime()) ? parution : null, uid, f.manga_id]
        ).catch(() => { /* colonne absente (migration 22 pas encore passée) : sans gravité */ });

        return {
            mangaId:    f.manga_id,
            source:     f.source || 'mangadex',
            title:      f.title || f.manga_id,
            cover:      f.cover || null,
            latest:     latest ? { id: latest.id, chapter: latest.chapter, title: latest.title, publishedAt: latest.publishedAt } : null,
            resume:     premierNonLu ? { id: premierNonLu.id, chapter: premierNonLu.chapter } : null,
            unreadCount: unread.length,
            hasNew:     latest && f.last_chapter != null && latest.chapter > f.last_chapter,
        };
    }

    const updates = results.filter(Boolean)
        .sort((a, b) => (b.hasNew - a.hasNew) || (b.unreadCount - a.unreadCount));
    return { updates, failures, scanned: targets.length, skipped };
}

// ── §15.3/15.4-6/7 : tâche de fond → notification « nouveau chapitre » ──
// Pour chaque utilisateur ayant une bibliothèque, scanne ses séries et
// notifie celles avec du nouveau. createNotification() enregistre la notif
// in-app (cloche du header) ET tente le Web Push si un abonnement existe.
// (Avant : seuls les abonnés push étaient scannés — dans l'app desktop
// personne ne s'abonne au push, donc la cloche restait vide à jamais.)
let scanRunning = false;
async function backgroundScan() {
    if (scanRunning) return;   // jamais deux scans en parallèle
    scanRunning = true;
    try {
        // Audit AMEL-56 : une purge par cycle suffit, et elle doit passer même
        // si aucun utilisateur n'est éligible au scan.
        const purgees = await purgerNotificationsLues();
        if (purgees) console.log(`[notif] ${purgees} notification(s) lues de plus de ${RETENTION_JOURS} j purgées`);

        // Audit AMEL-54 : la fréquence est propre au compte. Le planificateur
        // continue de battre toutes les 4 h — c'est le pas le plus fin — mais
        // chaque utilisateur n'est scanné que si SON intervalle est écoulé.
        // `notif_every_hours = 0` coupe les notifications sans toucher au
        // suivi des séries.
        const [users] = await pool.query(
            `SELECT DISTINCT f.user_id, u.notif_every_hours, u.last_notif_scan
             FROM favorites f JOIN users u ON u.id = f.user_id
             WHERE f.notify = 1 AND u.notif_every_hours > 0`
        );
        for (const u of users) {
            try {
                const dernier = u.last_notif_scan ? new Date(u.last_notif_scan).getTime() : 0;
                if (Date.now() - dernier < u.notif_every_hours * 3600 * 1000) continue;
                await pool.query('UPDATE users SET last_notif_scan = NOW() WHERE id = ?', [u.user_id]);
                const { updates } = await scanUserUpdates(u.user_id, { scope: 'active', notifyOnly: true });
                const fresh = updates.filter(x => x.hasNew && x.latest);
                // Audit N46 : l'ancien `fresh.slice(0, 5)` budgétisait AVANT le
                // garde anti-doublon — des séries déjà notifiées consommaient le
                // quota, et tout ce qui dépassait la 5e place était abandonné
                // (jamais reporté). Désormais : on écarte d'abord les doublons,
                // on notifie jusqu'à 5 NOUVELLES séries, et le surplus reste
                // non-notifié → il sera repris au cycle suivant (le chapitre
                // reste « nouveau » tant qu'il n'est pas lu).
                let sent = 0;
                for (const f of fresh) {
                    if (sent >= 5) break;   // au plus 5 notifs par cycle, le reste au cycle suivant
                    // Audit AMEL-55 : on ouvre le premier chapitre NON LU, pas
                    // le dernier paru — sinon trois chapitres de retard font
                    // sauter les deux du milieu.
                    const cible = f.resume || f.latest;
                    const link = `/chapitre.html?manga=${encodeURIComponent(f.mangaId)}&chapter=${encodeURIComponent(cible.id)}&source=${encodeURIComponent(f.source)}`;
                    // Garde anti-doublon : même chapitre déjà notifié → on passe
                    try {
                        const [[dup]] = await pool.query(
                            'SELECT id FROM notifications WHERE user_id = ? AND type = ? AND link = ? LIMIT 1',
                            [u.user_id, 'new_chapter', link]
                        );
                        if (dup) continue;
                    } catch (e) { /* table absente : createNotification l'ignorera aussi */ }
                    // Audit AMEL-53 : le compte de chapitres en retard est la
                    // seule information utile quand on en a plusieurs — « Chap.
                    // 14 » ne dit pas qu'il en reste trois à lire avant.
                    const corps = f.unreadCount > 1
                        ? `${f.title} · ${f.unreadCount} chapitres à lire (reprends au ${cible.chapter})`
                        : `${f.title} · Chap. ${cible.chapter}`;
                    await createNotification(u.user_id, {
                        type: 'new_chapter',
                        title: f.unreadCount > 1 ? `${f.unreadCount} nouveaux chapitres` : 'Nouveau chapitre',
                        body: corps,
                        link,
                        image: f.cover || null,
                        groupKey: f.mangaId,
                    });
                    sent++;
                }
            } catch (e) { /* utilisateur suivant */ }
        }
    } catch (e) { /* table absente ou DB down : prochain cycle */ }
    finally { scanRunning = false; }
}

// ── Scan en tâche de fond, suivi par le client ─────────────
// Avant : une seule requête HTTP qui durait tant que TOUTE la bibliothèque
// n'était pas vérifiée — plusieurs minutes pour 400 séries, au-delà du délai
// du client (« serveur trop long »), sans aucune progression visible.
// Désormais le scan tourne ici ; le client relit l'état toutes les secondes
// et affiche « 142 / 491 ». Un second clic rejoint le scan en cours.
const jobs = new Map();   // uid -> job

function vueJob(j) {
    if (!j) return null;
    return {
        id: j.id, etat: j.etat, faits: j.faits, total: j.total,
        startedAt: j.startedAt, finishedAt: j.finishedAt || null,
        ...(j.etat === 'fini' ? { ...j.resultat, frais: true, checkedAt: j.finishedAt } : {}),
        ...(j.erreur ? { erreur: j.erreur } : {}),
    };
}

function lancerScan(uid, opts = {}) {
    const courant = jobs.get(uid);
    if (courant && courant.etat === 'en_cours') return vueJob(courant);
    const j = { id: Date.now().toString(36), etat: 'en_cours', faits: 0, total: 0, startedAt: Date.now() };
    jobs.set(uid, j);
    scanUserUpdates(uid, { ...opts, onProgress: ({ faits, total }) => { j.faits = faits; j.total = total; } })
        .then(r => { j.resultat = r; j.total = r.scanned; j.faits = r.scanned; markFullScan(uid, r); })
        .catch(e => { j.erreur = String(e && e.message || e).slice(0, 200); })
        .finally(() => { j.etat = 'fini'; j.finishedAt = Date.now(); });
    return vueJob(j);
}

function etatScan(uid) { return vueJob(jobs.get(uid)); }

module.exports = { scanUserUpdates, fullScanCooldown, markFullScan, dernierScan, backgroundScan, lancerScan, etatScan };
