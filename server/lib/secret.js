// ============================================================
// lib/secret.js — Secret JWT centralisé (audit S12 ; durci audit S-1 v2)
// ------------------------------------------------------------
// Évite le 'change-me' codé en dur dispersé dans le code. En PRODUCTION,
// refuse de démarrer si le secret est absent/faible (un serveur public avec
// un secret devinable = forge de tokens triviale). En dev/desktop, garde un
// secret de repli mais avertit bruyamment.
// ============================================================
const SECRET = process.env.JWT_SECRET;

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

if (isWeak(SECRET)) {
    if (process.env.NODE_ENV === 'production') {
        console.error('[secret] FATAL : JWT_SECRET absent, trop court ou laissé au placeholder ("change-me…") en production.');
        console.error('         Définis un secret fort : export JWT_SECRET="$(openssl rand -hex 32)"');
        process.exit(1);
    }
    console.warn('[secret] ⚠ JWT_SECRET faible ou non défini — secret de développement utilisé.');
    console.warn('         Ne JAMAIS exposer en ligne sans définir un JWT_SECRET fort.');
}

module.exports = SECRET && !isWeak(SECRET) ? SECRET : 'inko-dev-secret-change-me';
