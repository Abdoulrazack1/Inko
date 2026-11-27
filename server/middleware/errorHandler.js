// middleware/errorHandler.js
function notFound(_req, res) {
    res.status(404).json({ error: 'Endpoint introuvable' });
}

// Codes d'erreur MySQL signalant que la base est injoignable
const DB_DOWN = new Set(['ECONNREFUSED', 'PROTOCOL_CONNECTION_LOST', 'ER_CON_COUNT_ERROR', 'ETIMEDOUT', 'ENOTFOUND']);

// API-14 : erreurs de la base qui disent « la DONNÉE reçue est invalide »
// (mauvais type, trop longue, nombre hors bornes, JSON mal formé). C'est une
// saisie à refuser, pas une panne : 400, sans recopier le message SQL.
const DONNEE_INVALIDE = new Set([
    'ER_TRUNCATED_WRONG_VALUE', 'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD', 'ER_WRONG_VALUE_COUNT_ON_ROW',
    'ER_DATA_TOO_LONG', 'ER_WARN_DATA_OUT_OF_RANGE', 'ER_BAD_FIELD_ERROR', 'ER_SP_UNDECLARED_VAR',
    'ER_INVALID_JSON_TEXT', 'ER_INVALID_JSON_TEXT_IN_PARAM', 'ER_WRONG_VALUE', 'ER_DATA_OUT_OF_RANGE',
    'ER_PARSE_ERROR', 'ER_BAD_NULL_ERROR', 'WARN_DATA_TRUNCATED', 'ER_WRONG_ARGUMENTS',
]);

function errorHandler(err, _req, res, _next) {
    if (err && DONNEE_INVALIDE.has(err.code)) {
        console.warn('[saisie] refusée :', err.code);
        return res.status(400).json({ error: 'Saisie invalide', code: 'SAISIE_INVALIDE' });
    }
    // Corps JSON illisible ou trop gros (body-parser) : 400 / 413, pas 500.
    if (err && (err.type === 'entity.parse.failed' || err.type === 'entity.too.large')) {
        return res.status(err.type === 'entity.too.large' ? 413 : 400)
            .json({ error: err.type === 'entity.too.large' ? 'Requête trop volumineuse' : 'JSON illisible', code: err.type });
    }
    // Base de données injoignable → 503 clair (pas un 500 cryptique)
    if (DB_DOWN.has(err.code)) {
        console.error('[db] base injoignable :', err.code);
        return res.status(503).json({
            error: 'Base de données indisponible. Vérifie que MySQL (Laragon) est démarré.',
            code:  'DB_UNAVAILABLE',
        });
    }
    const status = err.status || 500;
    // Audit B-9 : on logue TOUJOURS les 5xx côté serveur — c'est en production
    // qu'on a le plus besoin d'observabilité (un Docker qui plante en silence
    // était indiagnosticable). En prod on logue une trace compacte (message +
    // stack), en dev l'objet complet. Le client, lui, ne reçoit jamais la stack.
    if (status >= 500) {
        if (process.env.NODE_ENV === 'production') {
            console.error('[err]', status, err.code || '', err.message || err, err.stack ? '\n' + err.stack : '');
        } else {
            console.error('[err]', err);
        }
    }
    // Audit S11 : ne jamais renvoyer err.message brut sur un 5xx en prod —
    // fuite potentielle de détails internes (chemins, SQL, libs). Les 4xx
    // attendus (validation, 404…) gardent leur message utile au client.
    //
    // Exception : les défaillances AMONT (err.upstream, posé par
    // lib/source-health) portent un message écrit pour l'utilisateur
    // (« Source momentanément limitée… ») et ne décrivent rien de notre
    // infrastructure. Le masquer laisserait « Erreur interne du serveur » là où
    // le problème vient d'un site tiers — exactement le contresens que le
    // passage en 502/504 cherche à corriger.
    const exposeMessage = status < 500 || err.upstream || process.env.NODE_ENV !== 'production';
    res.status(status).json({
        error: exposeMessage ? (err.message || 'Erreur interne') : 'Erreur interne du serveur',
        code:  err.code,
    });
}

module.exports = { notFound, errorHandler };
