// middleware/admin.js — exige un compte admin (à chaîner APRÈS authRequired)
function adminRequired(req, res, next) {
    if (!req.user || req.user.role !== 'admin')
        return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
    next();
}

// SEC-27 — un téléphone appairé lit et écrit SA bibliothèque, rien de plus.
// Il obtenait pourtant des codes d'appairage (un téléphone volé pouvait en
// appairer d'autres avant d'être révoqué) et la liste des sauvegardes du hub.
// Ces gestes restent à l'ordinateur. À chaîner APRÈS authRequired, qui pose
// `req.deviceId` pour une session d'appareil.
function pasDepuisUnAppareil(req, res, next) {
    if (req.deviceId) return res.status(403).json({ error: 'À faire depuis l’ordinateur qui héberge Inko.', code: 'DEPUIS_LE_HUB' });
    next();
}

module.exports = { adminRequired, pasDepuisUnAppareil };
