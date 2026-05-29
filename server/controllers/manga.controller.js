// ============================================================
// manga.controller.js — Relais vers les extensions
// ============================================================
// En modèle Mihon : le core ne sait RIEN d'une source en particulier.
// Le controller délègue à la source identifiée par `?source=<id>`
// (ou à la source par défaut si pas précisée — rétro-compat).
// ============================================================
const extensions = require('../extensions/loader');

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
        res.json(await src.popular(req.query));
    } catch (e) { next(e); }
}

async function latest(req, res, next) {
    try {
        const src = resolveSource(req);
        if (!supports(src, 'latest')) return notSupported(res, src, 'latest');
        res.json(await src.latest(req.query));
    } catch (e) { next(e); }
}

async function search(req, res, next) {
    try {
        const src = resolveSource(req);
        if (!supports(src, 'search')) return notSupported(res, src, 'search');
        const { q, limit, offset, ...rest } = req.query;
        res.json(await src.search({ q, limit, offset, filters: rest }));
    } catch (e) { next(e); }
}

async function getOne(req, res, next) {
    try {
        const src = resolveSource(req);
        if (!supports(src, 'manga')) return notSupported(res, src, 'manga');
        res.json(await src.getManga(req.params.id));
    } catch (e) { next(e); }
}

async function chapters(req, res, next) {
    try {
        const src = resolveSource(req);
        if (!supports(src, 'chapters')) return notSupported(res, src, 'chapters');
        res.json(await src.getChapters(req.params.id, req.query));
    } catch (e) { next(e); }
}

async function pages(req, res, next) {
    try {
        const src = resolveSource(req);
        if (!supports(src, 'pages')) return notSupported(res, src, 'pages');
        res.json(await src.getPages(req.params.id));
    } catch (e) { next(e); }
}

async function tags(req, res, next) {
    try {
        const src = resolveSource(req);
        if (typeof src.getTags !== 'function') return res.json([]);
        res.json(await src.getTags());
    } catch (e) { next(e); }
}

module.exports = { listSources, popular, latest, search, getOne, chapters, pages, tags };
