// app.js — Inko backend (chargé par server.js APRÈS ensureDatabase :
// le pool MySQL de config/db lit process.env au moment du require)
const path         = require('path');
const express      = require('express');
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
app.use(express.static(FRONTEND_DIR, { extensions: ['html'], index: 'accueil.html' }));

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
        try { await require('./db/migrate').ensureSchema(); }
        catch (e) { console.warn('[migrate] non appliquée :', e.message); }
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

    app.listen(PORT, () => {
        console.log(`Inko backend → http://localhost:${PORT}`);
        console.log(`   API base  → http://localhost:${PORT}/api`);
        console.log(`   Frontend  → http://localhost:${PORT}/accueil.html`);
    });
})();
