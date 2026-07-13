// routes/index.js — assemble toutes les routes
const router  = require('express').Router();
const auth    = require('../middleware/auth');
const { adminRequired } = require('../middleware/admin');
const { authLimiter, writeLimiter } = require('../middleware/security');
const Auth    = require('../controllers/auth.controller');
const Update  = require('../controllers/update.controller');
const Manga   = require('../controllers/manga.controller');
const User    = require('../controllers/user.controller');
const Artwork = require('../controllers/artwork.controller');
const AniList = require('../controllers/anilist.controller');
const Image   = require('../controllers/image.controller');
const Ext     = require('../controllers/extensions.controller');
const Admin   = require('../controllers/admin.controller');
const Notif   = require('../controllers/notif.controller');
const Notes   = require('../controllers/notes.controller');
const Profile = require('../controllers/profile.controller');
const Local   = require('../controllers/local.controller');

// ── Healthcheck ─────────────────────────────────
router.get('/health', (_req, res) => res.json({
    ok: true, time: Date.now(),
    ...(process.env.APP_VERSION ? { version: process.env.APP_VERSION } : {}),
    ...(process.env.INKO_DB_FALLBACK === '1' ? { dbFallback: true } : {}),
}));
router.post('/app/update', Update.runUpdate);   // MAJ intégrée (app desktop)

// ── Auth ─────────────────────────────────────────
router.get ('/auth/providers',      Auth.providers);
router.post('/auth/google',         Auth.googleAuth);
router.get ('/auth/google-config',  auth.authRequired, Auth.getGoogleConfig);
router.put ('/auth/google-config',  auth.authRequired, Auth.setGoogleConfig);
router.post('/auth/local',          Auth.localAuth);   // mode local sans écran de connexion
router.post('/auth/register',       authLimiter, Auth.register);
router.post('/auth/login',          authLimiter, Auth.login);
router.post('/auth/logout',         Auth.logout);
router.get ('/auth/me', auth.authRequired, Auth.me);
router.post('/auth/forgot',         authLimiter, Auth.requestReset);
router.post('/auth/reset',          authLimiter, Auth.resetPassword);
router.put ('/auth/password', auth.authRequired, Auth.changePassword);
router.put ('/auth/profile',  auth.authRequired, Auth.updateProfile);
router.post('/auth/delete',   auth.authRequired, Auth.deleteAccount);

// ── Sources (extensions installées) ───────────────
router.get('/sources',              Manga.listSources);

// ── Extensions : mises à jour (modèle Mihon) ──────
router.get ('/extensions/updates',  Ext.checkUpdates);
router.get ('/extensions/health',   auth.authRequired, adminRequired, Ext.healthStatus);
router.get ('/extensions/:id/test', auth.authRequired, Ext.testSource);
// applyUpdates écrit des fichiers .js exécutés côté serveur pour toute l'instance :
// exige un rôle admin, pas seulement une session valide (audit §7.3).
router.post('/extensions/update',   auth.authRequired, adminRequired, Ext.applyUpdates);
router.post('/extensions/:id/uninstall', auth.authRequired, Ext.uninstall);
router.post('/extensions/:id/reinstall', auth.authRequired, Ext.reinstall);
router.get ('/extensions/uninstalled', (_q, res) => res.json(require('../extensions/loader').uninstalledList()));

// ── Proxy de couvertures (cache + anti-hotlink) ───
router.get('/img',                  Image.proxy);

// ── Artwork officiel (AniList) pour le hero ───────
router.get('/artwork',              Artwork.artwork);

// ── AniList (suivi : config OAuth implicite) ──────
router.get('/anilist/config',       AniList.config);
router.put('/anilist/config',       auth.authRequired, AniList.setConfig);
router.get('/anilist/similar',      AniList.similar);

// ── Mangas (relais vers source active, ?source=<id> pour cibler) ──
router.get('/mangas/search',        Manga.search);
router.get('/search-all',           Manga.searchAll);   // recherche multi-sources
router.get('/mangas/popular',       Manga.popular);
router.get('/mangas/latest',        Manga.latest);
router.get('/mangas/tags',          Manga.tags);
router.get('/mangas/:id',           Manga.getOne);
router.get('/mangas/:id/chapters',  Manga.chapters);
router.get('/chapters/:id/pages',   Manga.pages);
router.get('/chapters/:id/text',    Manga.text);     // sources de romans (novel)

// ── Routes scoping par source : /sources/:sourceId/mangas/* ──
router.get('/sources/:sourceId/mangas/search',       Manga.search);
router.get('/sources/:sourceId/mangas/popular',      Manga.popular);
router.get('/sources/:sourceId/mangas/latest',       Manga.latest);
router.get('/sources/:sourceId/mangas/tags',         Manga.tags);
router.get('/sources/:sourceId/mangas/:id',          Manga.getOne);
router.get('/sources/:sourceId/mangas/:id/chapters', Manga.chapters);
router.get('/sources/:sourceId/chapters/:id/pages',  Manga.pages);
router.get('/sources/:sourceId/chapters/:id/text',   Manga.text);

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

router.get   ('/comments-recent',                   User.getRecentComments);
router.get   ('/comments/:mangaId',       auth.authOptional, User.getComments);
router.post  ('/comments/:mangaId',       auth.authRequired, writeLimiter, User.addComment);
router.post  ('/comments/:commentId/report', auth.authRequired, writeLimiter, User.reportComment);
router.delete('/comments/:commentId',     auth.authRequired, User.deleteComment);

// ── Import local (EPUB / CBZ / CBR) ─────────────
router.post  ('/library/import/local',    auth.authRequired, Local.importLocal);
router.get   ('/library/local',           auth.authRequired, Local.listLocal);
router.get   ('/library/local/:id/file',  auth.authRequired, Local.getLocalFile);
router.delete('/library/local/:id',       auth.authRequired, Local.deleteLocal);

// ── Profils publics ─────────────────────────────
router.get   ('/users/profile/:username', auth.authOptional, Profile.publicProfile);

// ── Notifications in-app + Web Push ─────────────
router.get   ('/me/notifications',            auth.authRequired, Notif.list);
router.get   ('/me/notifications/unread',     auth.authRequired, Notif.unreadCount);
router.post  ('/me/notifications/read-all',   auth.authRequired, Notif.markAllRead);
router.post  ('/me/notifications/:id/read',   auth.authRequired, Notif.markRead);
router.get   ('/push/vapid',                   Notif.vapid);
router.post  ('/me/push/subscribe',           auth.authRequired, Notif.subscribe);

// ── Administration & modération (role=admin) ────
router.get   ('/admin/stats',                 auth.authRequired, adminRequired, Admin.stats);
router.get   ('/admin/users',                 auth.authRequired, adminRequired, Admin.listUsers);
router.put   ('/admin/users/:id/role',        auth.authRequired, adminRequired, Admin.setUserRole);
router.put   ('/admin/users/:id/ban',         auth.authRequired, adminRequired, Admin.setUserBan);
router.get   ('/admin/reports',               auth.authRequired, adminRequired, Admin.listReports);
router.post  ('/admin/reports/:id/resolve',   auth.authRequired, adminRequired, Admin.resolveReport);

// ── Ratings ─────────────────────────────────────
router.get   ('/ratings/:mangaId',        auth.authOptional, User.getMangaRating);
router.put   ('/ratings/:mangaId',        auth.authRequired, User.setMangaRating);
router.delete('/ratings/:mangaId',        auth.authRequired, User.deleteMangaRating);
// ── Journal de lecture : notes personnelles ──
router.get   ('/me/notes',                auth.authRequired, Notes.listNotes);
router.get   ('/me/notes/stats',          auth.authRequired, Notes.notesStats);
router.post  ('/me/notes',                auth.authRequired, Notes.createNote);
router.put   ('/me/notes/:id',            auth.authRequired, Notes.updateNote);
router.delete('/me/notes/:id',            auth.authRequired, Notes.deleteNote);

router.get   ('/me/ratings',              auth.authRequired, User.getMyRatings);

// ── Settings synchronisés ───────────────────────
router.get   ('/me/settings',             auth.authRequired, User.getSettings);
router.put   ('/me/settings',             auth.authRequired, User.setSettings);

// ── Données ─────────────────────────────────────
router.get   ('/me/export',               auth.authRequired, User.exportData);
router.post  ('/me/import',               auth.authRequired, User.importData);
router.post  ('/me/clear-history',        auth.authRequired, User.clearHistory);

router.get   ('/me/events',               auth.authRequired, User.getEvents);
router.get   ('/me/stats',                auth.authRequired, User.getStats);
router.get   ('/me/updates',              auth.authRequired, User.checkUpdates);


module.exports = router;
