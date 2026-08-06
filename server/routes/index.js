// routes/index.js — assemble toutes les routes
const router  = require('express').Router();
const auth    = require('../middleware/auth');
const { adminRequired } = require('../middleware/admin');
const { authLimiter, writeLimiter, searchLimiter, imgLimiter, relayLimiter } = require('../middleware/security');
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
// Audit BUG-03 : cette route renvoyait `ok:true` en dur. Elle est la sonde du
// HEALTHCHECK Docker : un conteneur dont MySQL est mort restait « sain » et
// n'était donc JAMAIS redémarré. On teste désormais réellement la base.
// Le ping est borné (2 s) pour ne pas faire traîner la sonde, et son résultat
// est mis en cache 5 s : un healthcheck toutes les 30 s ne doit pas ouvrir une
// connexion à chaque appel de page.
let _healthCache = { at: 0, dbOk: false };
async function dbHealthy() {
    if (Date.now() - _healthCache.at < 5000) return _healthCache.dbOk;
    let ok = false;
    try {
        await Promise.race([
            require('../config/db').ping(),
            new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 2000)),
        ]);
        ok = true;
    } catch (e) { ok = false; }
    _healthCache = { at: Date.now(), dbOk: ok };
    return ok;
}
router.get('/health', async (_req, res) => {
    const dbOk = await dbHealthy();
    res.status(dbOk ? 200 : 503).json({
        ok: dbOk,
        db: dbOk ? 'up' : 'down',
        time: Date.now(),
        ...(dbOk ? {} : { error: 'Base de données injoignable' }),
        ...(process.env.APP_VERSION ? { version: process.env.APP_VERSION } : {}),
        ...(process.env.INKO_DB_FALLBACK === '1' ? { dbFallback: true } : {}),
    });
});
// MAJ intégrée (app desktop). authRequired (audit S2) : sans lui, n'importe
// quelle page web ouverte pendant que l'app tourne pouvait POST ici (CSRF
// simple request) et déclencher fermeture + réinstallation silencieuse.
router.post('/app/update', auth.authRequired, Update.runUpdate);

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
// Audit SRC1 : updates/uninstalled exigent désormais au moins une session.
router.get ('/extensions/updates',  auth.authRequired, Ext.checkUpdates);
router.get ('/extensions/health',   auth.authRequired, adminRequired, Ext.healthStatus);
router.get ('/extensions/:id/test', auth.authRequired, Ext.testSource);
// applyUpdates écrit des fichiers .js exécutés côté serveur pour toute l'instance :
// exige un rôle admin, pas seulement une session valide (audit §7.3).
router.post('/extensions/update',   auth.authRequired, adminRequired, Ext.applyUpdates);
// Audit S9 : uninstall/reinstall désactivent une source pour TOUTE l'instance
// (même impact qu'applyUpdates) — adminRequired, pas seulement une session.
// Sans conséquence en mode local (compte unique = admin de facto).
router.post('/extensions/:id/uninstall', auth.authRequired, adminRequired, Ext.uninstall);
router.post('/extensions/:id/reinstall', auth.authRequired, adminRequired, Ext.reinstall);
router.get ('/extensions/uninstalled', auth.authRequired, (_q, res) => res.json(require('../extensions/loader').uninstalledList()));

// ── Proxy de couvertures (cache + anti-hotlink) ───
router.get('/img',                  imgLimiter, Image.proxy);   // rate-limit (audit S14)

// ── Artwork officiel (AniList) pour le hero ───────
router.get('/artwork',              relayLimiter, Artwork.artwork);

// ── AniList (suivi : config OAuth implicite) ──────
router.get('/anilist/config',       AniList.config);
router.put('/anilist/config',       auth.authRequired, AniList.setConfig);
router.get('/anilist/similar',      relayLimiter, AniList.similar);

// ── Mangas (relais vers source active, ?source=<id> pour cibler) ──
router.get('/mangas/search',        relayLimiter, Manga.search);
router.get('/search-all',           searchLimiter, Manga.searchAll);   // recherche multi-sources (rate-limit audit S14)
router.get('/mangas/popular',       relayLimiter, Manga.popular);
router.get('/mangas/latest',        relayLimiter, Manga.latest);
router.get('/mangas/tags',          relayLimiter, Manga.tags);
router.get('/mangas/:id',           relayLimiter, Manga.getOne);
router.get('/mangas/:id/chapters',  relayLimiter, Manga.chapters);
router.get('/chapters/:id/pages',   relayLimiter, Manga.pages);
router.get('/chapters/:id/text',    relayLimiter, Manga.text);     // sources de romans (novel)

// ── Routes scoping par source : /sources/:sourceId/mangas/* ──
router.get('/sources/:sourceId/mangas/search',       relayLimiter, Manga.search);
router.get('/sources/:sourceId/mangas/popular',      relayLimiter, Manga.popular);
router.get('/sources/:sourceId/mangas/latest',       relayLimiter, Manga.latest);
router.get('/sources/:sourceId/mangas/tags',         relayLimiter, Manga.tags);
router.get('/sources/:sourceId/mangas/:id',          relayLimiter, Manga.getOne);
router.get('/sources/:sourceId/mangas/:id/chapters', relayLimiter, Manga.chapters);
router.get('/sources/:sourceId/chapters/:id/pages',  relayLimiter, Manga.pages);
router.get('/sources/:sourceId/chapters/:id/text',   relayLimiter, Manga.text);

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
// Audit AMEL-28 : positions precedentes, pour recuperer une place ecrasee par
// une ouverture accidentelle.
router.get   ('/me/progress/:mangaId/history', auth.authRequired, User.getProgressHistory);

router.get   ('/me/read-chapters',        auth.authRequired, User.getReadChapters);
router.post  ('/me/read-chapters',        auth.authRequired, User.markChapter);
router.post  ('/me/read-chapters/bulk',   auth.authRequired, User.markChaptersBulk);
// Audit AMEL-40 : annulation d'un marquage en masse.
router.post  ('/me/read-chapters/unmark-bulk', auth.authRequired, User.unmarkChaptersBulk);

router.get   ('/me/lists',                auth.authRequired, User.getLists);
router.post  ('/me/lists',                auth.authRequired, User.createList);
router.put   ('/me/lists/:id',            auth.authRequired, User.updateList);
router.delete('/me/lists/:id',            auth.authRequired, User.deleteList);
router.post  ('/me/lists/:id/items',                auth.authRequired, User.addToList);
router.delete('/me/lists/:id/items/:mangaId',       auth.authRequired, User.removeFromList);
// Audit AMEL-37 : `list_items.position` servait deja au tri mais n'etait
// ecrite nulle part — l'ordre affiche etait donc l'ordre d'ajout.
router.put   ('/me/lists/:id/order',                auth.authRequired, User.reorderList);

// Audit AMEL-41 : les signets sortent du blob de reglages, qui etait recharge
// a chaque page et reecrit en entier au moindre ajout.
router.get   ('/me/bookmarks',            auth.authRequired, User.getBookmarks);
router.post  ('/me/bookmarks',            auth.authRequired, User.addBookmark);
router.delete('/me/bookmarks/:mangaId/:chapterId', auth.authRequired, User.removeBookmark);

// Audit SEC-04 : cette route était la SEULE du groupe sans middleware d'auth.
// Un visiteur anonyme obtenait un flux en direct de « qui lit quoi » — texte du
// commentaire, pseudo, avatar, titre et source de l'œuvre, horodatage — alors
// que l'interface promet « ton avis reste privé pour l'instant ».
// Elle exige désormais une session, comme le reste de /me/*.
router.get   ('/comments-recent',  auth.authRequired, User.getRecentComments);
router.get   ('/comments/:mangaId',       auth.authOptional, User.getComments);
router.post  ('/comments/:mangaId',       auth.authRequired, writeLimiter, User.addComment);
router.post  ('/comments/:commentId/report', auth.authRequired, writeLimiter, User.reportComment);
router.delete('/comments/:commentId',     auth.authRequired, User.deleteComment);

// ── Import local (EPUB / PDF / CBZ) ─────────────
// Audit BUG-17 : ce commentaire annonçait « CBR » — un format que le
// contrôleur REFUSE explicitement (le lecteur ne sait pas lire le RAR) — et
// omettait le PDF, qui lui est réellement accepté. Voir ALLOWED dans
// local.controller.js, seule source de vérité.
router.post  ('/library/import/local',    auth.authRequired, Local.importLocal);
router.get   ('/library/local',           auth.authRequired, Local.listLocal);
router.get   ('/library/local/:id/file',  auth.authRequired, Local.getLocalFile);
router.delete('/library/local/:id',       auth.authRequired, Local.deleteLocal);

// ── Profils publics ─────────────────────────────
router.get   ('/users/profile/:username', auth.authOptional, Profile.publicProfile);
// Audit BUG-09 : `lists.is_public` était un drapeau mort — aucune route ne
// l'exposait, donc marquer une liste « publique » ne la rendait publique nulle
// part. Lecture seule, sans session (c'est le sens du mot), et une liste privée
// répond 404 plutôt que 403 pour ne pas révéler son existence.
router.get   ('/lists/:id',               Profile.publicList);

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
// Audit PERF-09 : le cache titre → id AniList vivait dans user_settings.data,
// rechargé À CHAQUE PAGE (7 348 des 8 188 octets du blob, sans éviction).
// Table dédiée, chargée seulement par anilist.js.
router.get   ('/me/anilist-links',        auth.authRequired, User.getAnilistLinks);
router.put   ('/me/anilist-links',        auth.authRequired, User.setAnilistLinks);

// ── Données ─────────────────────────────────────
router.get   ('/me/export',               auth.authRequired, User.exportData);
router.post  ('/me/import',               auth.authRequired, User.importData);
router.post  ('/me/clear-history',        auth.authRequired, User.clearHistory);

router.get   ('/me/events',               auth.authRequired, User.getEvents);
router.get   ('/me/stats',                auth.authRequired, User.getStats);
router.get   ('/me/updates',              auth.authRequired, User.checkUpdates);


module.exports = router;
