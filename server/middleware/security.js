// ============================================================
// security.js — Durcissement HTTP (helmet, CORS, rate limiting)
// ------------------------------------------------------------
// Regroupe les protections transverses pour garder server.js lisible.
// Choix volontaires pour ne PAS casser le frontend vanilla d'Inko :
//   - CSP désactivée : les pages utilisent du JS/CSS et des handlers inline ;
//     une CSP stricte les bloquerait. À réactiver le jour où le front passe
//     à des scripts externes + nonces.
//   - crossOriginResourcePolicy = cross-origin : le proxy d'images sert des
//     couvertures consommées par des <img> (parfois cross-origin en mobile).
//   - HSTS off : en local (Laragon) et desktop, on tourne en http.
// ============================================================
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');

// En-têtes de sécurité sûrs (noSniff, frameguard, referrerPolicy, etc.)
const securityHeaders = helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    hsts: false,
});

// CORS : par défaut on reflète l'origine (compat desktop/PWA/mobile Capacitor,
// dont les origines varient : capacitor://, http://localhost, file://…).
// En PRODUCTION, définir CORS_ORIGINS="https://app.exemple.com,https://…"
// pour passer en liste blanche stricte (recommandé dès qu'on expose Inko en ligne).
function corsOptions() {
    const allow = (process.env.CORS_ORIGINS || '')
        .split(',').map(s => s.trim()).filter(Boolean);
    return {
        credentials: true,
        origin(origin, cb) {
            if (!origin) return cb(null, true);          // apps natives / curl / same-origin
            if (!allow.length) return cb(null, true);    // mode permissif (défaut, dev/local)
            return cb(null, allow.includes(origin));     // mode strict (prod)
        },
    };
}

// Anti brute-force sur l'authentification (login/register/reset).
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 40,                                 // 40 tentatives / 15 min / IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Trop de tentatives. Réessaie dans quelques minutes.' },
});

// Anti-spam sur les écritures publiques (commentaires).
const writeLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,                                 // 20 écritures / min / IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Trop de requêtes. Ralentis un peu.' },
});

module.exports = { securityHeaders, corsOptions, authLimiter, writeLimiter };
