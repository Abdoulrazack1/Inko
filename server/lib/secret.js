// ============================================================
// lib/secret.js — Secret JWT centralisé (audit S12)
// ------------------------------------------------------------
// Évite le 'change-me' codé en dur dispersé dans le code. En PRODUCTION,
// refuse de démarrer si le secret est absent/faible (un serveur public avec
// un secret devinable = forge de tokens triviale). En dev/desktop, garde un
// secret de repli mais avertit bruyamment.
// ============================================================
const SECRET = process.env.JWT_SECRET;

if (!SECRET || SECRET === 'change-me') {
    if (process.env.NODE_ENV === 'production') {
        console.error('[secret] FATAL : JWT_SECRET non défini (ou = "change-me") en production.');
        console.error('         Définis un secret fort : export JWT_SECRET="$(openssl rand -hex 32)"');
        process.exit(1);
    }
    console.warn('[secret] ⚠ JWT_SECRET non défini — secret de développement utilisé.');
    console.warn('         Ne JAMAIS exposer en ligne sans définir JWT_SECRET.');
}

module.exports = SECRET || 'inko-dev-secret-change-me';
