// app.js — Inko backend (chargé par server.js APRÈS ensureDatabase :
// le pool MySQL de config/db lit process.env au moment du require)
const path         = require('path');
const express      = require('express');
const compression  = require('compression');
const cookieParser = require('cookie-parser');
const cors         = require('cors');
const { ping }     = require('./config/db');
const routes       = require('./routes');
const extensions   = require('./extensions/loader');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { securityHeaders, corsOptions } = require('./middleware/security');

const app  = express();
// Défaut aligné sur le frontend (api.js suppose 8088 hors même-origine) — audit §8
const PORT = parseInt(process.env.PORT || '8088', 10);

// Derrière un reverse-proxy (déploiement en ligne), TRUST_PROXY=1 rend
// req.ip fiable pour le rate limiting. Inactif en local par défaut.
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1);

// Compression gzip (optimisation) : les gros modules JS (global.js ~88 Ko,
// chapitre/serie ~64 Ko) tombent à ~1/4 sur le réseau. Gain direct au 1er
// chargement et sur mobile/hub distant.
app.use(compression());
app.use(securityHeaders);
app.use(cors(corsOptions()));
app.use(express.json({ limit: '12mb' }));   // import de sauvegarde possible
app.use(cookieParser());

// Logger minimal
app.use((req, _res, next) => {
    if (req.path.startsWith('/api/')) {
        console.log(`${new Date().toISOString().slice(11, 19)} ${req.method} ${req.path}`);
    }
    next();
});

// API
app.use('/api', routes);

// Static frontend (sert tout sauf /api/*).
// FRONTEND_DIR est défini par Electron en prod (resources/frontend/).
// Sinon fallback dev : dossier parent du server (inko/).
const FRONTEND_DIR = process.env.FRONTEND_DIR || path.join(__dirname, '..');

// Audit S1 : quand FRONTEND_DIR retombe sur la racine du dépôt (quick-start
// `cd Inko/server && npm start` sans variable d'env), express.static servirait
// TOUT le dépôt — y compris server/backups/*.json (dump de tous les comptes)
// et server/config/vapid.json (clé privée Web Push). On refuse explicitement
// les dossiers qui n'ont rien à faire côté client, quel que soit le mode.
const BLOCKED_DIRS = /^\/(server|node_modules|desktop|desktop-tauri|tools|promo|\.git|\.github)([\\/]|$)/i;
app.use((req, res, next) => {
    if (BLOCKED_DIRS.test(req.path)) return res.status(404).json({ error: 'Not found' });
    next();
});
app.use(express.static(FRONTEND_DIR, {
    extensions: ['html'],
    index: 'accueil.html',
    etag: true,
    // Cache différencié (optimisation) : les assets immuables (polices, images,
    // libs vendorisées, icônes) sont mis en cache 30 jours — ils ne changent
    // pas entre deux versions. Le HTML/JS/CSS applicatif reste en revalidation
    // (ETag, max-age=0) pour que les mises à jour soient prises immédiatement,
    // sans risque de servir du code périmé (le Service Worker gère l'offline).
    setHeaders(res, filePath) {
        const isVendorDir = /[\\/]assets[\\/](vendor|img|fonts)[\\/]/i.test(filePath);
        const isAssetExt  = /\.(woff2?|ttf|otf|png|jpe?g|gif|webp|svg|ico)$/i.test(filePath);
        if (isVendorDir || isAssetExt) {
            res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');   // 30 j
        } else {
            res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
        }
    },
}));

// Fallback : si la requête n'est pas /api/* et que le fichier n'existe pas → accueil
app.get(/^(?!\/api).*$/, (req, res, next) => {
    if (req.path.includes('.')) return next(); // laisse passer les 404 sur fichiers
    res.sendFile(path.join(FRONTEND_DIR, 'accueil.html'));
});

// 404 + erreur globale (pour /api/*)
app.use('/api', notFound);
app.use(errorHandler);

(async () => {
    try {
        await ping();
        console.log('MySQL OK');
        // Migrations additives idempotentes (threads, reports, notifications…)
        // Audit DB-05 : on ne bloque pas le démarrage — une base en retard vaut
        // mieux qu'une app qui refuse de s'ouvrir — mais l'échec doit être
        // IMPOSSIBLE À MANQUER, pas un warning noyé dans les logs.
        try { await require('./db/migrate').ensureSchema(); }
        catch (e) {
            console.error('════════════════════════════════════════════════════');
            console.error('[migrate] ✖ LE SCHÉMA N\'EST PAS À JOUR :', e.message);
            console.error('          L\'app démarre, mais certaines fonctions peuvent échouer.');
            console.error('          Corrige la base, puis redémarre. En dépannage :');
            console.error('          MIGRATE_TOLERANT=1 pour ignorer les erreurs de migration.');
            console.error('════════════════════════════════════════════════════');
        }
    } catch (e) {
        console.error('MySQL inaccessible — vérifiez Laragon et lancez `npm run init-db`');
        console.error('   ' + e.message);
    }

    // Chargement des extensions de sources
    extensions.loadAll();
    const count = extensions.getAll().length;
    if (count === 0) {
        console.warn(' Aucune extension chargée. Place une source dans server/extensions/<id>/index.js');
    } else {
        console.log(`${count} extension(s) chargée(s)`);
    }

    // Pré-chauffage des extensions qui exposent warmup() (ex. SushiScan, qui
    // construit un gros index de catalogue) — en arrière-plan, non bloquant,
    // pour que la 1re recherche de l'utilisateur soit rapide.
    for (const s of extensions.getAll()) {
        if (typeof s.warmup === 'function') {
            Promise.resolve().then(() => s.warmup()).catch(() => {});
        }
    }

    // Ménage quotidien (RGPD art. 5(1)(e), audit P5) : purge les tokens de
    // reset expirés et borne l'historique d'events (la heatmap couvre 365 j).
    const { pool } = require('./config/db');
    async function housekeeping() {
        try {
            await pool.query('DELETE FROM password_resets WHERE expires_at < NOW() - INTERVAL 1 DAY');
            await pool.query('DELETE FROM events WHERE created_at < NOW() - INTERVAL 400 DAY');
        } catch (e) { /* DB down : réessaiera au prochain cycle */ }
    }
    housekeeping();
    setInterval(housekeeping, 24 * 3600 * 1000).unref();

    // Tâche de fond §15.3/15.7 : scanne les bibliothèques et notifie les
    // nouveaux chapitres (cloche in-app + Web Push si abonné). Toutes les
    // 4h ; premier passage 90 s après le démarrage — l'app desktop vit le
    // temps d'une session de lecture, 5 min ratait souvent le coche.
    const { backgroundScan } = require('./lib/updates');
    setTimeout(backgroundScan, 90 * 1000).unref();
    setInterval(backgroundScan, 4 * 3600 * 1000).unref();

    // Sauvegarde automatique quotidienne (audit N35) : dump JSON de tous les
    // comptes dans server/backups/ avec rotation — désactivable via
    // DISABLE_BACKUPS=1, dossier configurable via BACKUP_DIR.
    require('./lib/backup').scheduleBackups();

    app.listen(PORT, () => {
        console.log(`Inko backend → http://localhost:${PORT}`);
        console.log(`   API base  → http://localhost:${PORT}/api`);
        console.log(`   Frontend  → http://localhost:${PORT}/accueil.html`);
    });
})();
