// middleware/errorHandler.js
function notFound(_req, res) {
    res.status(404).json({ error: 'Endpoint introuvable' });
}

// Codes d'erreur MySQL signalant que la base est injoignable
const DB_DOWN = new Set(['ECONNREFUSED', 'PROTOCOL_CONNECTION_LOST', 'ER_CON_COUNT_ERROR', 'ETIMEDOUT', 'ENOTFOUND']);

function errorHandler(err, _req, res, _next) {
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
    res.status(status).json({
        error: err.message || 'Erreur interne',
        code:  err.code,
    });
}

module.exports = { notFound, errorHandler };
