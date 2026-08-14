// ============================================================
// lib/secret.js — Secret JWT centralisé (audit S12 ; durci S-1 v2 ; SEC-02)
// ------------------------------------------------------------
// Évite le 'change-me' codé en dur dispersé dans le code. Trois cas :
//
//   1. `JWT_SECRET` fourni et solide  → on l'utilise. Un déploiement serveur
//      garde toujours la main.
//   2. Absent, mais on tourne en desktop → un secret est TIRÉ AU SORT au
//      premier démarrage et conservé dans le profil de l'utilisateur.
//   3. Absent en développement → secret de repli, avec un avertissement.
//
// En PRODUCTION sans secret : refus de démarrer. Un serveur public avec un
// secret devinable, c'est la forge de jetons en une ligne.
//
// ── SEC-02, pourquoi le cas 2 existe ────────────────────────
// Le repli littéral `inko-dev-secret-change-me` s'appliquait à TOUTES les
// installations desktop : le sidecar ne tourne pas avec `NODE_ENV=production`,
// donc le garde-fou de production ne se déclenchait jamais. Le secret étant le
// même partout et lisible dans le code source, n'importe qui pouvait forger un
// jeton valide pour n'importe quelle installation — **hors ligne, sans jamais
// toucher au serveur**. Combiné à SEC-01 (`/auth/local` ouvert au réseau), la
// porte était ouverte deux fois.
//
// Le modèle du secret par installation existe déjà pour le mot de passe de la
// base embarquée (`embedded-db.js`, audit S12) : même dossier, mêmes droits.
// ============================================================
const secretsLocaux = require('./secrets-locaux');

const FOURNI = process.env.JWT_SECRET;
const IS_PROD = process.env.NODE_ENV === 'production';
// `APP_VERSION` est posé par le lanceur Tauri : c'est le marqueur du desktop,
// déjà utilisé par `middleware/security.js` pour la CSP et le CORS.
const IS_DESKTOP = !!process.env.APP_VERSION;

// Audit S-1 : l'ancien test comparait à l'égalité stricte 'change-me', mais
// docker-compose.yml fournit par défaut 'change-me-in-prod' — qui passait donc
// silencieusement. On rejette désormais TOUT secret qui contient « change-me »
// (n'importe quelle variante de placeholder), et tout secret trop court.
function isWeak(s) {
    if (!s) return true;
    if (/change-me/i.test(s)) return true;
    if (s.length < 16) return true;   // openssl rand -hex 32 fait 64 caractères
    return false;
}

function resoudre() {
    if (!isWeak(FOURNI)) return FOURNI;

    if (IS_PROD) {
        console.error('[secret] FATAL : JWT_SECRET absent, trop court ou laissé au placeholder ("change-me…") en production.');
        console.error('         Définis un secret fort : export JWT_SECRET="$(openssl rand -hex 32)"');
        process.exit(1);
    }

    if (IS_DESKTOP) {
        const propre = secretsLocaux.obtenir('jwt-secret', 48);
        if (propre) return propre;
        // Le disque refuse d'écrire. On NE fabrique PAS un secret volatil :
        // il changerait à chaque démarrage et déconnecterait l'utilisateur
        // sans explication. On retombe sur le repli, en le disant.
        console.warn('[secret] ⚠ impossible d’écrire un secret propre à cette installation.');
        console.warn('         Secret de repli utilisé — définis JWT_SECRET pour t’en passer.');
        return 'inko-dev-secret-change-me';
    }

    console.warn('[secret] ⚠ JWT_SECRET faible ou non défini — secret de développement utilisé.');
    console.warn('         Ne JAMAIS exposer en ligne sans définir un JWT_SECRET fort.');
    return 'inko-dev-secret-change-me';
}

module.exports = resoudre();
