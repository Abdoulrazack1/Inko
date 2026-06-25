// middleware/admin.js — exige un compte admin (à chaîner APRÈS authRequired)
function adminRequired(req, res, next) {
    if (!req.user || req.user.role !== 'admin')
        return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
    next();
}

module.exports = { adminRequired };
