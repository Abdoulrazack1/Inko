// ============================================================
// extensions.controller.js — Mises à jour des extensions Inko
// ------------------------------------------------------------
// Source de vérité des dernières versions : extensions-community/
// (versions.json + <id>/index.js). En dev, on lit le dossier local ;
// en prod/desktop (où ce dossier n'est pas packagé), on récupère
// depuis le dépôt GitHub officiel (raw), épinglé — pas d'URL arbitraire.
// ============================================================
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const axios  = require('axios');
const extensions = require('../extensions/loader');
const health     = require('../lib/source-health');

// Audit S-2 : on ne tire plus depuis la branche mutable `main` (un commit
// poussé par erreur ou un compte compromis se propageait instantanément à
// toutes les instances). On récupère depuis un TAG DE RELEASE immuable —
// la dernière release publiée, résolue via l'API GitHub — avec un repli figé.
const REPO           = 'Abdoulrazack1/Inko';
const DEFAULT_EXT_REF = 'v2.3.2';    // repli si l'API GitHub est injoignable (bumpé par release)
const rawUrl = (ref, p) => `https://raw.githubusercontent.com/${REPO}/${ref}/${p}`;
const COMMUNITY_DIR  = path.join(__dirname, '..', '..', 'extensions-community');
const RUNTIME_DIR    = path.join(__dirname, '..', 'extensions');

let _refCache = null;   // { ref, at }
async function resolveRef() {
    if (process.env.EXT_UPDATE_REF) return process.env.EXT_UPDATE_REF;   // épinglage manuel
    if (_refCache && Date.now() - _refCache.at < 3600_000) return _refCache.ref;
    let ref = DEFAULT_EXT_REF;
    try {
        const r = await axios.get(`https://api.github.com/repos/${REPO}/releases/latest`,
            { timeout: 10000, headers: { 'User-Agent': 'Inko' } });
        if (r.data && r.data.tag_name) ref = r.data.tag_name;   // tag immuable
    } catch (e) { /* API injoignable : on garde le repli figé */ }
    _refCache = { ref, at: Date.now() };
    return ref;
}
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

// Un id d'extension ne peut être qu'un slug simple : empêche le path-traversal
// (ex. "../../server" écrirait du code hors du dossier extensions = RCE).
const VALID_ID = /^[a-z0-9][a-z0-9_-]{0,63}$/i;

// Compare deux versions "x.y.z[-tag]" : >0 si a plus récente que b
function cmpVer(a, b) {
    const pa = String(a || '0').split(/[.\-]/);
    const pb = String(b || '0').split(/[.\-]/);
    const n = Math.max(pa.length, pb.length);
    for (let i = 0; i < n; i++) {
        const na = parseInt(pa[i], 10) || 0;
        const nb = parseInt(pb[i], 10) || 0;
        if (na !== nb) return na - nb;
    }
    return 0;
}

async function getLatestManifest() {
    const local = path.join(COMMUNITY_DIR, 'versions.json');
    if (fs.existsSync(local)) {
        try { return JSON.parse(fs.readFileSync(local, 'utf8')); } catch (e) {}
    }
    try {
        const ref = await resolveRef();
        const r = await axios.get(rawUrl(ref, 'extensions-community/versions.json'), { timeout: 10000 });
        return typeof r.data === 'object' ? r.data : JSON.parse(r.data);
    } catch (e) { return {}; }
}

// Empreintes SHA-256 attendues (audit S-2), depuis le même tag que les sources.
async function getExpectedHashes() {
    const local = path.join(COMMUNITY_DIR, 'hashes.json');
    if (fs.existsSync(local)) {
        try { return JSON.parse(fs.readFileSync(local, 'utf8')); } catch (e) {}
    }
    try {
        const ref = await resolveRef();
        const r = await axios.get(rawUrl(ref, 'extensions-community/hashes.json'), { timeout: 10000 });
        return typeof r.data === 'object' ? r.data : JSON.parse(r.data);
    } catch (e) { return {}; }
}

// Audit SEC-07 : la vérification était annoncée « fail-closed » mais ne l'était
// qu'à moitié. getExpectedHashes() renvoie {} quand le réseau échoue, et la
// vérification ne se déclenchait que `if (expectedHash)` — donc un hash absent
// ou injoignable faisait installer du JS EXÉCUTÉ PAR LE SERVEUR sans aucun
// contrôle. Désormais : pas de hash attendu = refus, sauf opt-in explicite.
const ALLOW_UNVERIFIED = process.env.ALLOW_UNVERIFIED_EXTENSIONS === '1';

// Récupère la source d'une extension et VÉRIFIE son empreinte.
async function getLatestSource(id, expectedHash) {
    const local = path.join(COMMUNITY_DIR, id, 'index.js');
    let src;
    if (fs.existsSync(local)) {
        src = fs.readFileSync(local, 'utf8');
    } else {
        const ref = await resolveRef();
        const r = await axios.get(rawUrl(ref, `extensions-community/${encodeURIComponent(id)}/index.js`),
            { timeout: 20000, responseType: 'text', transformResponse: [(d) => d] });
        src = typeof r.data === 'string' ? r.data : String(r.data);
    }
    if (!expectedHash) {
        if (!ALLOW_UNVERIFIED) {
            throw new Error(
                'aucune empreinte SHA-256 connue pour cette extension — installation refusée. ' +
                'Vérifie que extensions-community/hashes.json est accessible, ' +
                'ou définis ALLOW_UNVERIFIED_EXTENSIONS=1 pour passer outre en connaissance de cause.');
        }
        console.warn(`[ext] ⚠ "${id}" installée SANS vérification d'empreinte (ALLOW_UNVERIFIED_EXTENSIONS=1)`);
        return src;
    }
    const got = sha256(Buffer.from(src, 'utf8'));
    if (got !== expectedHash) throw new Error('empreinte SHA-256 invalide (source rejetée)');
    return src;
}

// GET /api/extensions/updates — état des MAJ disponibles
async function checkUpdates(_req, res, next) {
    try {
        const latest = await getLatestManifest();
        const installed = extensions.manifest();
        const installedIds = new Set(installed.map(s => s.id));
        const list = installed.map(s => ({
            id: s.id, name: s.name, type: s.type || 'manga',
            current: s.version, latest: latest[s.id] || s.version,
            hasUpdate: latest[s.id] ? cmpVer(latest[s.id], s.version) > 0 : false,
        }));
        // Nouvelles sources publiées mais pas encore installées
        const available = Object.keys(latest)
            .filter(id => !installedIds.has(id))
            .map(id => ({ id, latest: latest[id], isNew: true }));
        const count = list.filter(x => x.hasUpdate).length + available.length;
        res.json({ installed: list, available, count, source: fs.existsSync(path.join(COMMUNITY_DIR, 'versions.json')) ? 'local' : 'github' });
    } catch (e) { next(e); }
}

// POST /api/extensions/update { ids?: [] } — installe les MAJ (et nouvelles sources)
async function applyUpdates(req, res, next) {
    try {
        const reqIds = Array.isArray(req.body && req.body.ids) ? req.body.ids : null;
        const latest = await getLatestManifest();
        const hashes = await getExpectedHashes();
        const installed = extensions.manifest();
        const byId = Object.fromEntries(installed.map(s => [s.id, s]));
        // Cibles : celles demandées, sinon toutes celles avec MAJ ou nouvelles
        const candidates = reqIds || Object.keys(latest);
        const targets = candidates.filter(id => {
            const cur = byId[id];
            return !cur || (latest[id] && cmpVer(latest[id], cur.version) > 0);
        });
        const updated = [], failed = [];
        for (const id of targets) {
            try {
                if (!VALID_ID.test(id)) throw new Error('identifiant invalide');
                const src = await getLatestSource(id, hashes[id]);   // vérifie le SHA-256 si connu
                if (!src || !/module\.exports/.test(src)) throw new Error('source invalide');
                const dir = path.join(RUNTIME_DIR, id);
                fs.mkdirSync(dir, { recursive: true });
                fs.writeFileSync(path.join(dir, 'index.js'), src);
                updated.push(id);
            } catch (e) { failed.push({ id, error: e.message }); }
        }
        extensions.reload();
        res.json({ ok: true, updated, failed });
    } catch (e) { next(e); }
}

// GET /api/extensions/:id/test — test de connectivité léger (audit §7.3 rec 2)
async function testSource(req, res, next) {
    try {
        const src = extensions.get(req.params.id);
        if (!src) return res.status(404).json({ ok: false, error: 'Source inconnue' });
        try {
            const r = await health.test(src);
            res.json({ ok: true, method: r.method, count: r.count });
        } catch (e) {
            // Échec attendu (source cassée) : 200 avec ok:false + message brut,
            // pas une 5xx — le front affiche l'erreur telle quelle.
            res.json({ ok: false, error: e.message });
        }
    } catch (e) { next(e); }
}

// GET /api/extensions/health — instantané santé
//
// Audit AMEL-65 : cet endpoint était réservé à l'admin alors que la donnée
// qu'il porte répond à une question d'UTILISATEUR — « pourquoi cette source ne
// renvoie rien ? ». En mode local il n'y a d'ailleurs qu'un compte, donc la
// restriction ne protégeait personne tout en privant tout le monde. Rien ici
// n'est confidentiel : ce sont des compteurs de disponibilité de sites publics.
async function healthStatus(_req, res, next) {
    try {
        const byId = Object.fromEntries(extensions.manifest().map(s => [s.id, s]));
        const rows = health.snapshot().map(h => ({ ...h, name: byId[h.id]?.name || h.id }));
        // Inclut aussi les sources jamais appelées (aucune donnée de santé encore)
        for (const s of extensions.manifest()) {
            if (!rows.find(r => r.id === s.id))
                rows.push({ id: s.id, name: s.name, okAt: null, failAt: null, error: null, oks: 0, fails: 0, streak: 0 });
        }
        res.json(rows);
    } catch (e) { next(e); }
}

// GET /api/extensions/:id/log — journal des derniers appels (audit AMEL-68)
// Les compteurs agrégés ne gardent que le DERNIER message d'erreur, écrasé au
// prochain échec : impossible de voir si une source est lente, limitée par
// intermittence, ou franchement cassée. Le journal montre la suite des appels.
async function sourceLog(req, res, next) {
    try {
        const id = req.params.id;
        if (!extensions.get(id) && !extensions.isUninstalled(id))
            return res.status(404).json({ error: 'Source inconnue' });
        const limite = Math.min(Math.max(parseInt(req.query.limit || '20', 10) || 20, 1), health.JOURNAL_MAX);
        const lignes = health.journalDe(id, limite);
        const reussis = lignes.filter(l => l.ok);
        res.json({
            id,
            entries: lignes,
            // Mediane et non moyenne : un seul appel a 30 s (site qui a fini
            // par repondre) ferait passer une source saine pour lente.
            medianMs: reussis.length ? mediane(reussis.map(l => l.ms)) : null,
            okRate: lignes.length ? Math.round((reussis.length / lignes.length) * 100) : null,
            kept: health.JOURNAL_MAX,
        });
    } catch (e) { next(e); }
}
function mediane(a) {
    const t = [...a].sort((x, y) => x - y);
    const m = Math.floor(t.length / 2);
    return t.length % 2 ? t[m] : Math.round((t[m - 1] + t[m]) / 2);
}

// L'installation d'extensions par URL a été retirée : les extensions ne
// sont publiées que par l'admin, via les nouvelles versions de l'app.

// Désinstalle / réinstalle une extension (issue #2). Persistant (survit aux
// mises à jour), le loader ignore les extensions désinstallées.
function uninstall(req, res, next) {
    try {
        const id = String(req.params.id || '');
        if (!extensions.get(id)) return res.status(404).json({ error: 'Extension introuvable ou déjà désinstallée' });
        extensions.uninstall(id);
        res.json({ ok: true, uninstalled: extensions.uninstalledList() });
    } catch (e) { next(e); }
}
function reinstall(req, res, next) {
    try {
        extensions.reinstall(String(req.params.id || ''));
        res.json({ ok: true, uninstalled: extensions.uninstalledList() });
    } catch (e) { next(e); }
}

module.exports = {
    sourceLog, checkUpdates, applyUpdates, testSource, healthStatus, uninstall, reinstall };
