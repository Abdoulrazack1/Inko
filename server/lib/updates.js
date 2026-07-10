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
const { createNotification } = require('./notify');

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

function fullScanCooldown(uid) {
    const last = lastFullScan.get(uid) || 0;
    const left = last + FULL_SCAN_COOLDOWN_MS - Date.now();
    return left > 0 ? left : 0;
}
function markFullScan(uid) { lastFullScan.set(uid, Date.now()); }

/**
 * Scanne les séries suivies d'un utilisateur.
 * @param {number} uid
 * @param {object} opts
 *   scope   'active' (défaut : ignore Terminé/Abandonné) | 'all'
 *   mangaId vérifie UNE seule série (ignore scope/cooldown)
 *   lang    langues de chapitres ('fr,en' par défaut)
 * @returns {{updates: Array, failures: Array, scanned: number, skipped: number}}
 */
async function scanUserUpdates(uid, { scope = 'active', mangaId = null, lang = 'fr,en' } = {}) {
    const params = [uid];
    let where = 'f.user_id = ?';
    if (mangaId) { where += ' AND f.manga_id = ?'; params.push(mangaId); }
    const [favs] = await pool.query(
        `SELECT f.manga_id, f.source, f.title, f.cover, f.last_chapter, l.status
         FROM favorites f
         LEFT JOIN library l ON l.user_id = f.user_id AND l.manga_id = f.manga_id
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
    const readByManga = {};
    readRows.forEach(r => {
        (readByManga[r.manga_id] = readByManga[r.manga_id] || new Set()).add(r.chapter_number);
    });

    const failures = [];
    const results = await mapLimit(targets, 4, async (f) => {
        const src = extensions.get(f.source || 'mangadex') || extensions.defaultSource();
        if (!src || typeof src.getChapters !== 'function') {
            failures.push({ mangaId: f.manga_id, title: f.title || f.manga_id, cover: f.cover || null, error: `Source « ${f.source} » indisponible` });
            return null;
        }
        let chaps = [];
        try {
            const data = await src.getChapters(f.manga_id, { lang });
            chaps = data.results || [];
        } catch (e) {
            // §15.2 : l'échec est remonté, plus jamais avalé en silence
            failures.push({ mangaId: f.manga_id, title: f.title || f.manga_id, cover: f.cover || null, source: f.source, error: String(e.message || e).slice(0, 200) });
            return null;
        }
        if (!chaps.length) return null;

        const readSet = readByManga[f.manga_id] || new Set();
        const latest  = chaps[0];   // trié desc par les extensions
        const unread  = chaps.filter(c => !readSet.has(c.chapter));

        if (latest?.chapter != null && latest.chapter !== f.last_chapter) {
            pool.query('UPDATE favorites SET last_chapter = ? WHERE user_id = ? AND manga_id = ?',
                [latest.chapter, uid, f.manga_id]).catch(() => {});
        }

        return {
            mangaId:    f.manga_id,
            source:     f.source || 'mangadex',
            title:      f.title || f.manga_id,
            cover:      f.cover || null,
            latest:     latest ? { id: latest.id, chapter: latest.chapter, title: latest.title, publishedAt: latest.publishedAt } : null,
            unreadCount: unread.length,
            hasNew:     latest && f.last_chapter != null && latest.chapter > f.last_chapter,
        };
    });

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
        const [users] = await pool.query(
            'SELECT DISTINCT user_id FROM favorites'
        );
        for (const u of users) {
            try {
                const { updates } = await scanUserUpdates(u.user_id, { scope: 'active' });
                const fresh = updates.filter(x => x.hasNew && x.latest);
                for (const f of fresh.slice(0, 5)) {   // au plus 5 notifs par cycle
                    const link = `/chapitre.html?manga=${encodeURIComponent(f.mangaId)}&chapter=${encodeURIComponent(f.latest.id)}&source=${encodeURIComponent(f.source)}`;
                    // Garde anti-doublon : même chapitre déjà notifié → on passe
                    try {
                        const [[dup]] = await pool.query(
                            'SELECT id FROM notifications WHERE user_id = ? AND type = ? AND link = ? LIMIT 1',
                            [u.user_id, 'new_chapter', link]
                        );
                        if (dup) continue;
                    } catch (e) { /* table absente : createNotification l'ignorera aussi */ }
                    await createNotification(u.user_id, {
                        type: 'new_chapter',
                        title: 'Nouveau chapitre',
                        body: `${f.title} · Chap. ${f.latest.chapter}`,
                        link,
                    });
                }
            } catch (e) { /* utilisateur suivant */ }
        }
    } catch (e) { /* table absente ou DB down : prochain cycle */ }
    finally { scanRunning = false; }
}

module.exports = { scanUserUpdates, fullScanCooldown, markFullScan, backgroundScan };
