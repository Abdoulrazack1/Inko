// ============================================================
// extensions.controller.js — Mises à jour des extensions Inko
// ------------------------------------------------------------
// Source de vérité des dernières versions : extensions-community/
// (versions.json + <id>/index.js). En dev, on lit le dossier local ;
// en prod/desktop (où ce dossier n'est pas packagé), on récupère
// depuis le dépôt GitHub officiel (raw), épinglé — pas d'URL arbitraire.
// ============================================================
const fs    = require('fs');
const path  = require('path');
const axios = require('axios');
const extensions = require('../extensions/loader');

const REPO_RAW       = 'https://raw.githubusercontent.com/Abdoulrazack1/Inko/main';
const COMMUNITY_DIR  = path.join(__dirname, '..', '..', 'extensions-community');
const RUNTIME_DIR    = path.join(__dirname, '..', 'extensions');

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
        const r = await axios.get(`${REPO_RAW}/extensions-community/versions.json`, { timeout: 10000 });
        return typeof r.data === 'object' ? r.data : JSON.parse(r.data);
    } catch (e) { return {}; }
}

async function getLatestSource(id) {
    const local = path.join(COMMUNITY_DIR, id, 'index.js');
    if (fs.existsSync(local)) return fs.readFileSync(local, 'utf8');
    const r = await axios.get(`${REPO_RAW}/extensions-community/${encodeURIComponent(id)}/index.js`, { timeout: 20000 });
    return r.data;
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
                const src = await getLatestSource(id);
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

module.exports = { checkUpdates, applyUpdates };
