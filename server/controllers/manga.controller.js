// ============================================================
// manga.controller.js — Relais vers les extensions
// ============================================================
// En modèle Mihon : le core ne sait RIEN d'une source en particulier.
// Le controller délègue à la source identifiée par `?source=<id>`
// (ou à la source par défaut si pas précisée — rétro-compat).
// ============================================================
const extensions = require('../extensions/loader');
const health     = require('../lib/source-health');
const BoundedCache = require('../lib/bounded-cache');

// ── Cache de relais (audit AMEL-64 / PERF-03) ────────────────
// getOne() et getChapters() étaient de purs relais : chaque appel déclenchait
// un scrape du site distant. Une seule ouverture de /profil.html provoquait
// ainsi 201 requêtes sortantes vers weebcentral.com — lenteur, et surtout
// risque réel de bannissement d'IP. Les fiches d'œuvres changent lentement :
// un TTL court suffit à écraser les rafales sans jamais servir de contenu
// vraiment périmé. Bornes ajustables par variables d'environnement.
const META_TTL  = parseInt(process.env.SOURCE_META_TTL_MS  || String(15 * 60 * 1000), 10);  // fiches : 15 min
const CHAP_TTL  = parseInt(process.env.SOURCE_CHAP_TTL_MS  || String(5  * 60 * 1000), 10);  // chapitres : 5 min
const metaCache = new BoundedCache({ max: 800, ttl: META_TTL });
const chapCache = new BoundedCache({ max: 400, ttl: CHAP_TTL });

// Déduplication des requêtes simultanées : 24 onglets qui demandent la même
// fiche en même temps ne doivent produire qu'UN scrape (même principe que le
// proxy d'images).
const inflight = new Map();
async function cached(cache, key, produce) {
    const hit = cache.get(key);
    if (hit !== undefined) return hit;
    if (inflight.has(key)) return inflight.get(key);
    const p = (async () => {
        try {
            const v = await produce();
            cache.set(key, v);
            return v;
        } finally { inflight.delete(key); }
    })();
    inflight.set(key, p);
    return p;
}

function resolveSource(req) {
    const sid = req.query.source || req.params.sourceId;
    const src = sid ? extensions.get(sid) : extensions.defaultSource();
    if (!src) {
        const err = new Error(sid
            ? `Source inconnue : ${sid}`
            : 'Aucune extension installée. Va dans Sources pour en installer une.');
        err.status = 404;
        throw err;
    }
    return src;
}

function supports(src, capability) {
    if (!src.capabilities) return true; // pas déclaré → on tente
    return src.capabilities.includes(capability);
}

function notSupported(res, src, what) {
    res.status(501).json({ error: `Source "${src.name}" ne supporte pas ${what}` });
}

// ── List sources ──
async function listSources(_req, res) {
    res.json(extensions.manifest());
}

// ── Mangas ──
async function popular(req, res, next) {
    try {
        const src = resolveSource(req);
        if (!supports(src, 'popular')) return notSupported(res, src, 'popular');
        res.json(await health.track(src.id, () => src.popular(req.query)));
    } catch (e) { next(e); }
}

async function latest(req, res, next) {
    try {
        const src = resolveSource(req);
        if (!supports(src, 'latest')) return notSupported(res, src, 'latest');
        res.json(await health.track(src.id, () => src.latest(req.query)));
    } catch (e) { next(e); }
}

async function search(req, res, next) {
    try {
        const src = resolveSource(req);
        if (!supports(src, 'search')) return notSupported(res, src, 'search');
        const { q, limit, offset, ...rest } = req.query;
        res.json(await health.track(src.id, () => src.search({ q, limit, offset, filters: rest })));
    } catch (e) { next(e); }
}

// Recherche agrégée sur TOUTES les sources installées (façon Mihon)
async function searchAll(req, res, next) {
    try {
        const { q } = req.query;
        // Plafond paramétrable (audit N38) : 12 par défaut (aperçu header),
        // jusqu'à 50 pour la page de recherche dédiée.
        const limit = Math.min(Math.max(parseInt(req.query.limit || '12', 10) || 12, 1), 50);
        if (!q || !q.trim()) return res.json({ query: '', groups: [] });
        const sources = extensions.getAll().filter(s => supports(s, 'search'));
        const groups = await Promise.all(sources.map(async s => {
            const base = { source: s.id, sourceName: s.name, lang: s.lang || '' };
            let timer = null;   // nettoyé quoi qu'il arrive (audit B5 : timer qui traînait 15 s)
            try {
                const r = await Promise.race([
                    s.search({ q: q.trim(), limit: +limit }),
                    new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('délai dépassé')), 15000); }),
                ]);
                health.recordOk(s.id);
                return { ...base, items: (r.results || []).slice(0, +limit), total: r.total };
            } catch (e) {
                health.recordFail(s.id, e);
                return { ...base, items: [], error: e.message };
            } finally {
                clearTimeout(timer);
            }
        }));
        res.json({ query: q.trim(), groups });
    } catch (e) { next(e); }
}

async function getOne(req, res, next) {
    try {
        const src = resolveSource(req);
        if (!supports(src, 'manga')) return notSupported(res, src, 'manga');
        const out = await cached(metaCache, `m:${src.id}:${req.params.id}`,
            () => health.track(src.id, () => src.getManga(req.params.id)));
        res.json(out);
    } catch (e) { next(e); }
}

async function chapters(req, res, next) {
    try {
        const src = resolveSource(req);
        if (!supports(src, 'chapters')) return notSupported(res, src, 'chapters');
        // La langue et la pagination font partie de la clé : deux vues
        // différentes du même manga ne doivent pas se servir mutuellement.
        const k = `c:${src.id}:${req.params.id}:${req.query.lang || ''}:${req.query.limit || ''}:${req.query.offset || ''}`;
        const out = await cached(chapCache, k,
            () => health.track(src.id, () => src.getChapters(req.params.id, req.query)));
        res.json(out);
    } catch (e) { next(e); }
}

async function pages(req, res, next) {
    try {
        const src = resolveSource(req);
        if (!supports(src, 'pages')) return notSupported(res, src, 'pages');
        res.json(await health.track(src.id, () => src.getPages(req.params.id)));
    } catch (e) { next(e); }
}

// Contenu texte d'un chapitre (sources de romans, type 'novel')
async function text(req, res, next) {
    try {
        const src = resolveSource(req);
        if (!supports(src, 'text') || typeof src.getText !== 'function')
            return notSupported(res, src, 'text');
        res.json(await health.track(src.id, () => src.getText(req.params.id)));
    } catch (e) { next(e); }
}

async function tags(req, res, next) {
    try {
        const src = resolveSource(req);
        if (typeof src.getTags !== 'function') return res.json([]);
        res.json(await src.getTags());
    } catch (e) { next(e); }
}

module.exports = { listSources, popular, latest, search, searchAll, getOne, chapters, pages, text, tags };
