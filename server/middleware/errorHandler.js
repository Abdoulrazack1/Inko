// middleware/errorHandler.js
function notFound(_req, res) {
    res.status(404).json({ error: 'Endpoint introuvable' });
}

function errorHandler(err, _req, res, _next) {
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
