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
const health     = require('../lib/source-health');

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

// GET /api/extensions/health — instantané santé (admin, §7.3 rec 3)
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

// POST /api/extensions/install-url { url } — installe une extension tierce
// depuis une URL directe (admin). Façon Keiyoushi « dépôt externe » : sort de
// la dépendance au catalogue officiel, avec garde-fous :
//   · https uniquement, taille bornée, doit exporter une source VALIDE
//   · id contraint par la même regex anti path-traversal
//   · chargée d'abord dans un fichier temporaire avant d'être adoptée
async function installFromUrl(req, res, next) {
    try {
        const url = String(req.body?.url || '').trim();
        if (!/^https:\/\//i.test(url)) return res.status(400).json({ error: 'URL https requise' });
        let code;
        try {
            const r = await axios.get(url, { timeout: 20000, maxContentLength: 512 * 1024, responseType: 'text' });
            code = String(r.data || '');
        } catch (e) { return res.status(400).json({ error: 'Téléchargement impossible : ' + e.message }); }
        if (!/module\.exports/.test(code)) return res.status(400).json({ error: 'Fichier invalide (pas un module d’extension)' });

        // Chargement d'essai dans un fichier temporaire
        const os = require('os');
        const tmp = path.join(os.tmpdir(), `inko-ext-${Date.now()}-${Math.random().toString(36).slice(2)}.js`);
        fs.writeFileSync(tmp, code);
        let src, v;
        try {
            src = require(tmp);
            const { validateSource } = require('../lib/source-interface');
            v = validateSource(src);
        } catch (e) {
            fs.unlink(tmp, () => {});
            return res.status(400).json({ error: 'Extension invalide : ' + e.message });
        }
        delete require.cache[require.resolve(tmp)];
        fs.unlink(tmp, () => {});
        if (!v.ok) return res.status(400).json({ error: 'Contrat non respecté : ' + v.errors.join(', ') });
        if (!VALID_ID.test(src.id)) return res.status(400).json({ error: 'Identifiant de source invalide' });

        const dir = path.join(RUNTIME_DIR, src.id);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'index.js'), code);
        extensions.reload();
        res.json({ ok: true, id: src.id, name: src.name, version: src.version });
    } catch (e) { next(e); }
}

module.exports = { checkUpdates, applyUpdates, testSource, healthStatus, installFromUrl };
