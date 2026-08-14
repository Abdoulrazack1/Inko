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
//     tiers réellement utilisés (Google GSI, embeds YouTube, AniList).
//   - crossOriginResourcePolicy = cross-origin : le proxy d'images sert des
//     couvertures consommées par des <img> (parfois cross-origin en mobile).
// ============================================================
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');

const IS_PROD = process.env.NODE_ENV === 'production';
// Mode desktop (app Tauri installée) : le sidecar Node tourne en http local
// sans NODE_ENV=production, mais le compte propriétaire y a de facto les droits
// admin — la CSP doit donc s'y appliquer aussi (audit S-6). On la déclenche
// dès que l'app tourne en desktop (APP_VERSION posé par le lanceur Tauri) OU
// en production.
const IS_DESKTOP = !!process.env.APP_VERSION;
const CSP_ON = (IS_PROD || IS_DESKTOP) && process.env.DISABLE_CSP !== '1';

// Audit S-1 : en production exposée, un CORS permissif combiné à
// credentials:true laisse n'importe quel site lire les données de la victime.
// On refuse donc le mode permissif par défaut en prod, sauf opt-in explicite.
const CORS_ALLOW_ANY = process.env.CORS_ALLOW_ANY === '1';
if (IS_PROD && !CORS_ALLOW_ANY && !(process.env.CORS_ORIGINS || '').trim()) {
    console.warn('[cors] ⚠ NODE_ENV=production sans CORS_ORIGINS : mode permissif REFUSÉ.');
    console.warn('       Définis CORS_ORIGINS="https://ton-domaine" (liste blanche recommandée),');
    console.warn('       ou CORS_ALLOW_ANY=1 pour autoriser explicitement toutes les origines (déconseillé).');
}

// CSP compatible avec le front vanilla (inline autorisé) mais restreignant les
// origines externes aux seuls tiers réellement utilisés par l'app.
const cspDirectives = {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'",
        'https://accounts.google.com', 'https://apis.google.com', 'https://www.youtube.com', 'https://s.ytimg.com'],
    // Gestionnaires en ATTRIBUT (`onclick=`, `onerror=`…). Sans cette ligne,
    // helmet applique son défaut `script-src-attr 'none'` : la CSP autorisait
    // le script en ligne tout en interdisant, EN SILENCE, les gestionnaires
    // écrits en attribut — dont le code en pose une cinquantaine.
    //
    // La CSP n'étant active qu'en desktop et en production, la panne était
    // invisible en développement. Mesuré sur l'app installée 2.5.7, chapitre de
    // One Piece : planche téléchargée (`naturalWidth > 0`), classe `loaded`
    // jamais posée, opacité 0, violation « script-src-attr | inline ». Le
    // chapitre s'affichait entièrement blanc, et les zones de changement de
    // page ne répondaient pas.
    //
    // On aligne donc la directive sur `scriptSrc`, qui accepte déjà
    // `'unsafe-inline'` : aucune classe de risque nouvelle.
    //
    // ⚠️ C'est une mesure TRANSITOIRE. Le lecteur (chapitre.js) n'en dépend
    // plus — il écoute `load`/`error` en capture et délègue ses clics. Les 38
    // gestionnaires restants (repli de couverture `onerror`, rechargements)
    // doivent suivre le même chemin, après quoi cette ligne pourra tomber.
    scriptSrcAttr: ["'unsafe-inline'"],
    styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],  // Google Fonts CSS
    imgSrc: ["'self'", 'data:', 'blob:', 'https:'],   // couvertures proxifiées + externes
    connectSrc: ["'self'", 'https:'],                 // fetch API + AniList/Google
    frameSrc: [ 'https://www.youtube.com',
        'https://youtube.com', 'https://accounts.google.com'],
    fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],   // fichiers Google Fonts
    mediaSrc: ["'self'", 'data:', 'blob:', 'https:'],
    objectSrc: ["'none'"],
    baseUri: ["'self'"],
    frameAncestors: ["'self'"],
};

// En-têtes de sécurité sûrs (noSniff, frameguard, referrerPolicy, etc.)
const securityHeaders = helmet({
    contentSecurityPolicy: CSP_ON
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
// Origines de la webview Tauri, selon la plateforme et la version de WebView2.
// Ce ne sont pas des origines « externes » : c'est l'app qui parle a son propre
// serveur embarque.
const ORIGINES_WEBVIEW = new Set([
    'tauri://localhost',        // macOS, iOS
    'http://tauri.localhost',   // Windows (WebView2)
    'https://tauri.localhost',  // Windows (WebView2 recent)
]);

function corsOptions() {
    const allow = (process.env.CORS_ORIGINS || '')
        .split(',').map(s => s.trim()).filter(Boolean);
    // En prod sans liste blanche : permissif UNIQUEMENT si CORS_ALLOW_ANY=1
    // (audit S-1). Sinon on n'autorise que les requêtes sans Origin (apps
    // natives, curl, same-origin) et on bloque tout site tiers.
    // Audit SEC-09 : IS_DESKTOP manquait ici. Le sidecar desktop tourne sans
    // NODE_ENV=production — c'est précisément pour ça que IS_DESKTOP existe
    // deux dizaines de lignes plus haut, pour la CSP. Sans lui, n'importe quelle
    // page web visitée pouvait interroger http://127.0.0.1:8088 et lister les
    // sources installées (le cookie SameSite=Lax protégeait les endpoints
    // authentifiés, pas les publics).
    const permissiveOk = !(IS_PROD || IS_DESKTOP) || CORS_ALLOW_ANY;
    return {
        credentials: true,
        origin(origin, cb) {
            if (!origin) return cb(null, true);          // apps natives / curl / same-origin
            // L'APPLICATION ELLE-MEME. Son écran de démarrage est servi par la
            // webview, donc depuis `tauri://localhost` : vis-à-vis du serveur
            // c'est une origine tierce. En fermant le permissif côté desktop,
            // SEC-09 a ferme cette porte-la aussi — et l'app affichait
            // « Impossible de démarrer / Serveur interne ne répond pas » après
            // 150 s d'attente pendant que le serveur répondait 200. Les 303
            // sondes étaient dans le journal du serveur : la requête arrivait,
            // c'est la REPONSE que la webview jetait, faute d'en-tête
            // Access-Control-Allow-Origin.
            //
            // La liste est fermée et connue : elle n'ouvre rien à un site web,
            // qui ne peut pas se donner une de ces origines. La protection de
            // SEC-09 reste donc entière.
            if (IS_DESKTOP && ORIGINES_WEBVIEW.has(origin)) return cb(null, true);
            if (allow.length) return cb(null, allow.includes(origin));   // liste blanche stricte
            return cb(null, permissiveOk);               // permissif seulement hors prod ou opt-in
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

// Audit S14 : /api/search-all et /api/img n'avaient aucun rate-limit —
// surface d'abus (déni de service par ricochet vers les sites scrapés,
// vol de bande passante via le proxy d'images). Fenêtres larges pour ne
// pas gêner l'usage normal (une page catalogue charge ~24 couvertures).
const searchLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: parseInt(process.env.SEARCH_RATE_MAX || '30', 10),   // 30 recherches multi-sources / min / IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Trop de recherches. Patiente quelques secondes.' },
});
const imgLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: parseInt(process.env.IMG_RATE_MAX || '300', 10),     // 300 images / min / IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Trop de requêtes images.' },
});

// Audit SEC-10 : /search-all et /img étaient limités, mais PAS les 18 autres
// routes de relais (mangas/search, popular, latest, tags, :id, chapters, pages,
// text, artwork, anilist/similar + leurs équivalents scopés /sources/:id/...).
// Chacune déclenche pourtant un appel sortant vers un site tiers : sur une
// instance exposée, c'était un amplificateur de déni de service PAR RICOCHET
// vers les sites scrapés — exactement le risque que searchLimiter couvrait
// déjà pour la recherche multi-sources. Fenêtre large : une page catalogue
// légitime enchaîne facilement 30 appels.
const relayLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: parseInt(process.env.RELAY_RATE_MAX || '180', 10),   // 180 relais / min / IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Trop de requêtes vers les sources. Patiente quelques secondes.' },
});

module.exports = { securityHeaders, corsOptions, authLimiter, writeLimiter, searchLimiter, imgLimiter, relayLimiter };
