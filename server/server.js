// server.js — Inko backend
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const path         = require('path');
const express      = require('express');
const cookieParser = require('cookie-parser');
const cors         = require('cors');
const { ping }     = require('./config/db');
const routes       = require('./routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app  = express();
const PORT = parseInt(process.env.PORT || '8080', 10);

app.use(cors({
    origin: (origin, cb) => cb(null, true),
    credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
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

// Static frontend (sert tout sauf /api/*)
app.use(express.static(path.join(__dirname, '..'), { extensions: ['html'], index: 'accueil.html' }));

// Fallback : si la requête n'est pas /api/* et que le fichier n'existe pas → accueil
app.get(/^(?!\/api).*$/, (req, res, next) => {
    if (req.path.includes('.')) return next(); // laisse passer les 404 sur fichiers
    res.sendFile(path.join(__dirname, '..', 'accueil.html'));
});

// 404 + erreur globale (pour /api/*)
app.use('/api', notFound);
app.use(errorHandler);

(async () => {
    try {
        await ping();
        console.log('✅ MySQL OK');
    } catch (e) {
        console.error('❌ MySQL inaccessible — vérifiez Laragon et lancez `npm run init-db`');
        console.error('   ' + e.message);
    }
    app.listen(PORT, () => {
        console.log(`🚀 Inko backend → http://localhost:${PORT}`);
        console.log(`   API base  → http://localhost:${PORT}/api`);
        console.log(`   Frontend  → http://localhost:${PORT}/accueil.html`);
    });
})();
