// routes/index.js — assemble toutes les routes
const router  = require('express').Router();
const auth    = require('../middleware/auth');
const Auth    = require('../controllers/auth.controller');
const Manga   = require('../controllers/manga.controller');
const User    = require('../controllers/user.controller');

// ── Healthcheck ─────────────────────────────────
router.get('/health', (_req, res) => res.json({ ok: true, time: Date.now() }));

// ── Auth ─────────────────────────────────────────
router.post('/auth/register',       Auth.register);
router.post('/auth/login',          Auth.login);
router.post('/auth/logout',         Auth.logout);
router.get ('/auth/me', auth.authRequired, Auth.me);
router.post('/auth/forgot',         Auth.requestReset);
router.post('/auth/reset',          Auth.resetPassword);

// ── Mangas (MangaDex proxy, public) ─────────────
router.get('/mangas/search',        Manga.search);
router.get('/mangas/popular',       Manga.popular);
router.get('/mangas/latest',        Manga.latest);
router.get('/mangas/tags',          Manga.tags);
router.get('/mangas/:id',           Manga.getOne);
router.get('/mangas/:id/chapters',  Manga.chapters);
router.get('/chapters/:id/pages',   Manga.pages);

// ── User data (auth required) ───────────────────
router.get   ('/me/favorites',            auth.authRequired, User.getFavorites);
router.post  ('/me/favorites',            auth.authRequired, User.addFavorite);
router.delete('/me/favorites/:mangaId',   auth.authRequired, User.removeFavorite);

router.get   ('/me/library',              auth.authRequired, User.getLibrary);
router.put   ('/me/library/:mangaId',     auth.authRequired, User.setLibraryStatus);

router.get   ('/me/progress',             auth.authRequired, User.getAllProgress);
router.put   ('/me/progress/:mangaId',    auth.authRequired, User.setProgress);

router.get   ('/me/read-chapters',        auth.authRequired, User.getReadChapters);
router.post  ('/me/read-chapters',        auth.authRequired, User.markChapter);

router.get   ('/me/lists',                auth.authRequired, User.getLists);
router.post  ('/me/lists',                auth.authRequired, User.createList);
router.put   ('/me/lists/:id',            auth.authRequired, User.updateList);
router.delete('/me/lists/:id',            auth.authRequired, User.deleteList);
router.post  ('/me/lists/:id/items',                auth.authRequired, User.addToList);
router.delete('/me/lists/:id/items/:mangaId',       auth.authRequired, User.removeFromList);

router.get   ('/comments/:mangaId',                 User.getComments);
router.post  ('/comments/:mangaId',       auth.authRequired, User.addComment);

router.get   ('/me/events',               auth.authRequired, User.getEvents);
router.get   ('/me/stats',                auth.authRequired, User.getStats);

module.exports = router;
