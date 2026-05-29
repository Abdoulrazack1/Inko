// controllers/manga.controller.js
const mangadex = require('../services/mangadex');

async function search(req, res, next) {
    try { res.json(await mangadex.search(req.query)); }
    catch (e) { next(e); }
}
async function getOne(req, res, next) {
    try { res.json(await mangadex.getManga(req.params.id)); }
    catch (e) { next(e); }
}
async function chapters(req, res, next) {
    try { res.json(await mangadex.getMangaChapters(req.params.id, req.query)); }
    catch (e) { next(e); }
}
async function pages(req, res, next) {
    try { res.json(await mangadex.getChapterPages(req.params.id)); }
    catch (e) { next(e); }
}
async function popular(req, res, next) {
    try { res.json(await mangadex.getPopular(req.query)); }
    catch (e) { next(e); }
}
async function latest(req, res, next) {
    try { res.json(await mangadex.getLatest(req.query)); }
    catch (e) { next(e); }
}
async function tags(_req, res, next) {
    try { res.json(await mangadex.getTags()); }
    catch (e) { next(e); }
}

module.exports = { search, getOne, chapters, pages, popular, latest, tags };
