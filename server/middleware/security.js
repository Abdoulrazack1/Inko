// ============================================================
// security.js — Durcissement HTTP (helmet, CORS, rate limiting)
// ------------------------------------------------------------
// Regroupe les protections transverses pour garder server.js lisible.
// Choix volontaires pour ne PAS casser le frontend vanilla d'Inko :
//   - CSP/HSTS : activées UNIQUEMENT en production (audit court terme). En
//     local (Laragon) et desktop on tourne en http avec des handlers inline,
//     donc elles restent off pour ne rien casser. Échappatoires : DISABLE_CSP=1
//     / DISABLE_HSTS=1 si un déploiement pose problème.
//   - La CSP garde 'unsafe-inline' (le front vanilla a des handlers inline) mais
//     verrouille object-src, base-uri, frame-ancestors et l'allowlist des SDK
//     tiers réellement utilisés (Google GSI, embeds YouTube/Spotify, AniList).
//   - crossOriginResourcePolicy = cross-origin : le proxy d'images sert des
//     couvertures consommées par des <img> (parfois cross-origin en mobile).
// ============================================================
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');

const IS_PROD = process.env.NODE_ENV === 'production';

// CSP compatible avec le front vanilla (inline autorisé) mais restreignant les
// origines externes aux seuls tiers réellement utilisés par l'app.
const cspDirectives = {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'",
        'https://accounts.google.com', 'https://apis.google.com',
        'https://open.spotify.com', 'https://www.youtube.com', 'https://s.ytimg.com'],
    styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],  // Google Fonts CSS
    imgSrc: ["'self'", 'data:', 'blob:', 'https:'],   // couvertures proxifiées + externes
    connectSrc: ["'self'", 'https:'],                 // fetch API + AniList/Google
    frameSrc: ['https://open.spotify.com', 'https://www.youtube.com',
        'https://youtube.com', 'https://accounts.google.com'],
    fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],   // fichiers Google Fonts
    mediaSrc: ["'self'", 'data:', 'blob:', 'https:'],
    objectSrc: ["'none'"],
    baseUri: ["'self'"],
    frameAncestors: ["'self'"],
};

// En-têtes de sécurité sûrs (noSniff, frameguard, referrerPolicy, etc.)
const securityHeaders = helmet({
    contentSecurityPolicy: (IS_PROD && process.env.DISABLE_CSP !== '1')
        ? { directives: cspDirectives }
        : false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    hsts: (IS_PROD && process.env.DISABLE_HSTS !== '1')
        ? { maxAge: 15552000, includeSubDomains: true }   // 180 jours
        : false,
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
// Plus strict par défaut (audit S3) ; ajustable via AUTH_RATE_MAX.
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: parseInt(process.env.AUTH_RATE_MAX || '12', 10),   // 12 tentatives / 15 min / IP
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,            // ne compte que les échecs (login raté)
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
