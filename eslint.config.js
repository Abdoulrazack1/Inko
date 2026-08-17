// eslint.config.js — Lint du frontend vanilla (audit B-3, durci audit QUAL-04)
// Objectif d'origine : empêcher que de nouveaux catch muets réapparaissent
// (no-empty avec allowEmptyCatch:false attrape les `catch (e) {}`).
//
// Audit QUAL-04 : `no-undef` et `no-unused-vars` étaient désactivés — « trop de
// faux positifs sur le style IIFE/globals ». C'était vrai tant qu'aucune globale
// n'était déclarée, mais c'est précisément `no-undef` qui attrape la faute de
// frappe sur `MH`/`API` — l'erreur la plus fréquente dans ce style. Le code en
// portait d'ailleurs la trace : `reads7` au lieu de `reads7ev` (profil.js),
// ReferenceError avalée par un catch silencieux, panneau « Top séries » qui ne
// s'affichait jamais. Un `no-undef` actif l'aurait signalée à l'écriture.
//
// On déclare donc explicitement les globales du projet et on réactive la règle.
'use strict';

// Globales navigateur réellement utilisées. Liste explicite plutôt qu'un
// préréglage : elle documente ce sur quoi le front s'appuie.
const browser = {
    window: 'readonly', document: 'readonly', navigator: 'readonly', location: 'readonly',
    localStorage: 'readonly', sessionStorage: 'readonly', console: 'readonly',
    fetch: 'readonly', Request: 'readonly', Response: 'readonly', Headers: 'readonly',
    EventSource: 'readonly',   // flux SSE de la telecommande (P3.1)
    URL: 'readonly', URLSearchParams: 'readonly', Blob: 'readonly', File: 'readonly',
    FileReader: 'readonly', FormData: 'readonly', AbortController: 'readonly',
    setTimeout: 'readonly', clearTimeout: 'readonly', setInterval: 'readonly', clearInterval: 'readonly',
    requestAnimationFrame: 'readonly', cancelAnimationFrame: 'readonly',
    IntersectionObserver: 'readonly', MutationObserver: 'readonly', ResizeObserver: 'readonly',
    CustomEvent: 'readonly', Event: 'readonly', KeyboardEvent: 'readonly', MouseEvent: 'readonly',
    Image: 'readonly', Audio: 'readonly', DOMParser: 'readonly', NodeFilter: 'readonly',
    Node: 'readonly', Element: 'readonly', HTMLElement: 'readonly',
    getComputedStyle: 'readonly', matchMedia: 'readonly', alert: 'readonly',
    confirm: 'readonly', prompt: 'readonly', caches: 'readonly', performance: 'readonly',
    speechSynthesis: 'readonly', SpeechSynthesisUtterance: 'readonly',
    history: 'readonly', screen: 'readonly', atob: 'readonly', btoa: 'readonly',
    structuredClone: 'readonly', queueMicrotask: 'readonly', Notification: 'readonly',
    getSelection: 'readonly', scrollTo: 'readonly', open: 'readonly',
    XMLHttpRequest: 'readonly', indexedDB: 'readonly', IDBKeyRange: 'readonly',
};

// Globales posées par l'app elle-même, dans l'ordre de chargement des <script>.
const inko = {
    MH: 'writable',        // global.js (fusionné par i18n.js)
    API: 'writable',       // api.js
    Storage: 'writable',   // storage.js
    UserData: 'writable',  // userdata.js
    Theme: 'writable',     // theme.js
    Downloads: 'writable', // downloads.js
    InkoTour: 'writable',  // onboarding.js
    AniList: 'writable',   // anilist.js
    CSS: 'readonly',       // CSS.escape()
    // Bibliothèques vendorisées, chargées par <script> sur certaines pages
    THREE: 'readonly', gsap: 'readonly', ScrollTrigger: 'readonly',
    JSZip: 'readonly', pdfjsLib: 'readonly', YT: 'readonly',
};

module.exports = [
    {
        files: ['assets/js/**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'script',
            globals: { ...browser, ...inko },
        },
        rules: {
            // Garde-fou d'origine : plus jamais de catch muet.
            'no-empty': ['error', { allowEmptyCatch: false }],

            // Audit QUAL-04 : réactivé maintenant que les globales sont déclarées.
            'no-undef': 'error',

            // Les variables inutilisées sont signalées, mais pas les arguments :
            // le style du projet garde souvent `(e)` dans un catch ou un
            // paramètre de callback pour la lisibilité de la signature.
            'no-unused-vars': ['warn', {
                args: 'none',
                caughtErrors: 'none',
                varsIgnorePattern: '^_',
            }],

            // Pièges classiques, sans bruit
            'no-dupe-keys': 'error',
            'no-dupe-else-if': 'error',
            'no-duplicate-case': 'error',
            'no-unreachable': 'error',
            'no-self-assign': 'error',
            'no-constant-condition': ['error', { checkLoops: false }],
            'valid-typeof': 'error',
            'no-fallthrough': 'error',
        },
    },
    {
        // Le service worker a ses propres globales (ni window ni document).
        files: ['service-worker.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'script',
            globals: {
                self: 'readonly', caches: 'readonly', fetch: 'readonly', clients: 'readonly',
                Response: 'readonly', Request: 'readonly', URL: 'readonly', console: 'readonly',
                setTimeout: 'readonly',
            },
        },
        rules: {
            'no-empty': ['error', { allowEmptyCatch: false }],
            'no-undef': 'error',
        },
    },
];
