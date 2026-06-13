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
    if (process.env.NODE_ENV !== 'production') {
        console.error('[err]', err);
    }
    res.status(status).json({
        error: err.message || 'Erreur interne',
        code:  err.code,
    });
}

module.exports = { notFound, errorHandler };
