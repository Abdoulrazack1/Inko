// routes/index.js — assemble toutes les routes
const router  = require('express').Router();
const auth    = require('../middleware/auth');
const Auth    = require('../controllers/auth.controller');
const Manga   = require('../controllers/manga.controller');
const User    = require('../controllers/user.controller');
const Spotify = require('../controllers/spotify.controller');
const Artwork = require('../controllers/artwork.controller');

// ── Healthcheck ─────────────────────────────────
router.get('/health', (_req, res) => res.json({ ok: true, time: Date.now() }));

// ── Auth ─────────────────────────────────────────
router.post('/auth/register',       Auth.register);
router.post('/auth/login',          Auth.login);
router.post('/auth/logout',         Auth.logout);
router.get ('/auth/me', auth.authRequired, Auth.me);
router.post('/auth/forgot',         Auth.requestReset);
router.post('/auth/reset',          Auth.resetPassword);
router.put ('/auth/password', auth.authRequired, Auth.changePassword);
router.put ('/auth/profile',  auth.authRequired, Auth.updateProfile);
router.post('/auth/delete',   auth.authRequired, Auth.deleteAccount);

// ── Sources (extensions installées) ───────────────
router.get('/sources',              Manga.listSources);

// ── Artwork officiel (AniList) pour le hero ───────
router.get('/artwork',              Artwork.artwork);

// ── Mangas (relais vers source active, ?source=<id> pour cibler) ──
router.get('/mangas/search',        Manga.search);
router.get('/mangas/popular',       Manga.popular);
router.get('/mangas/latest',        Manga.latest);
router.get('/mangas/tags',          Manga.tags);
router.get('/mangas/:id',           Manga.getOne);
router.get('/mangas/:id/chapters',  Manga.chapters);
router.get('/chapters/:id/pages',   Manga.pages);

// ── Routes scoping par source : /sources/:sourceId/mangas/* ──
router.get('/sources/:sourceId/mangas/search',       Manga.search);
router.get('/sources/:sourceId/mangas/popular',      Manga.popular);
router.get('/sources/:sourceId/mangas/latest',       Manga.latest);
router.get('/sources/:sourceId/mangas/tags',         Manga.tags);
router.get('/sources/:sourceId/mangas/:id',          Manga.getOne);
router.get('/sources/:sourceId/mangas/:id/chapters', Manga.chapters);
router.get('/sources/:sourceId/chapters/:id/pages',  Manga.pages);

// ── User data (auth required) ───────────────────
router.get   ('/me/favorites',            auth.authRequired, User.getFavorites);
router.post  ('/me/favorites',            auth.authRequired, User.addFavorite);
router.delete('/me/favorites/:mangaId',   auth.authRequired, User.removeFavorite);
router.put   ('/me/favorites/:mangaId/category', auth.authRequired, User.setFavoriteCategory);

router.get   ('/me/library',              auth.authRequired, User.getLibrary);
router.put   ('/me/library/:mangaId',     auth.authRequired, User.setLibraryStatus);

router.get   ('/me/progress',             auth.authRequired, User.getAllProgress);
router.put   ('/me/progress/:mangaId',    auth.authRequired, User.setProgress);
router.delete('/me/progress/:mangaId',    auth.authRequired, User.deleteProgress);

router.get   ('/me/read-chapters',        auth.authRequired, User.getReadChapters);
router.post  ('/me/read-chapters',        auth.authRequired, User.markChapter);
router.post  ('/me/read-chapters/bulk',   auth.authRequired, User.markChaptersBulk);

router.get   ('/me/lists',                auth.authRequired, User.getLists);
router.post  ('/me/lists',                auth.authRequired, User.createList);
router.put   ('/me/lists/:id',            auth.authRequired, User.updateList);
router.delete('/me/lists/:id',            auth.authRequired, User.deleteList);
router.post  ('/me/lists/:id/items',                auth.authRequired, User.addToList);
router.delete('/me/lists/:id/items/:mangaId',       auth.authRequired, User.removeFromList);

router.get   ('/comments/:mangaId',                 User.getComments);
router.post  ('/comments/:mangaId',       auth.authRequired, User.addComment);

// ── Ratings ─────────────────────────────────────
router.get   ('/ratings/:mangaId',        auth.authOptional, User.getMangaRating);
router.put   ('/ratings/:mangaId',        auth.authRequired, User.setMangaRating);
router.delete('/ratings/:mangaId',        auth.authRequired, User.deleteMangaRating);
router.get   ('/me/ratings',              auth.authRequired, User.getMyRatings);

// ── Settings synchronisés ───────────────────────
router.get   ('/me/settings',             auth.authRequired, User.getSettings);
router.put   ('/me/settings',             auth.authRequired, User.setSettings);

// ── Données ─────────────────────────────────────
router.get   ('/me/export',               auth.authRequired, User.exportData);
router.post  ('/me/clear-history',        auth.authRequired, User.clearHistory);

router.get   ('/me/events',               auth.authRequired, User.getEvents);
router.get   ('/me/stats',                auth.authRequired, User.getStats);
router.get   ('/me/updates',              auth.authRequired, User.checkUpdates);

// ── Spotify (linking de compte OAuth) ───────────
router.get   ('/spotify/login',           auth.authOptional, Spotify.login);     // ?token=<jwt>
router.get   ('/spotify/callback',        Spotify.callback);                     // public (redir Spotify)
router.get   ('/spotify/status',          auth.authRequired, Spotify.status);
router.get   ('/spotify/playlists',       auth.authRequired, Spotify.playlists);
router.post  ('/spotify/disconnect',      auth.authRequired, Spotify.disconnect);

module.exports = router;
