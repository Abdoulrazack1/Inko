// middleware/auth.js — vérifie le JWT (cookie ou Authorization: Bearer)
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');

const SECRET = require('../lib/secret');   // secret centralisé (audit S12)

// Audit SEC-11 : cookie préfixé `inko_token` (les cookies ne sont pas isolés
// par port — un projet voisin sur localhost écrasait un cookie nommé `token`).
// L'ancien nom reste accepté en lecture pour ne pas déconnecter les sessions
// en cours lors de la mise à jour.
function readToken(req) {
    if (req.cookies?.inko_token) return req.cookies.inko_token;
    if (req.cookies?.token) return req.cookies.token;
    const h = req.headers.authorization;
    if (h && h.startsWith('Bearer ')) return h.slice(7);
    return null;
}

async function authRequired(req, res, next) {
    const token = readToken(req);
    if (!token) return res.status(401).json({ error: 'Non authentifié' });
    try {
        const payload = jwt.verify(token, SECRET);
        const [[user]] = await pool.query(
            'SELECT id, username, email, avatar, role, banned, token_version, created_at FROM users WHERE id = ?',
            [payload.uid]
        );
        if (!user) return res.status(401).json({ error: 'Utilisateur inexistant' });
        if (user.banned) return res.status(403).json({ error: 'Compte suspendu', code: 'BANNED' });
        // Audit SEC-05 : les JWT vivent 30 jours et n'étaient JAMAIS révocables.
        // Changer ou réinitialiser son mot de passe ne chassait donc pas
        // l'intrus — exactement ce qu'un « mot de passe oublié » doit faire.
        // token_version est incrémentée à chaque changement de secret : tout
        // jeton émis avant devient invalide.
        const tv = user.token_version || 0;
        if ((payload.tv || 0) !== tv) {
            return res.status(401).json({ error: 'Session expirée — reconnecte-toi', code: 'TOKEN_REVOKED' });
        }
        req.user = user;
        next();
    } catch (e) {
        return res.status(401).json({ error: 'Token invalide ou expiré' });
    }
}

function authOptional(req, _res, next) {
    const token = readToken(req);
    if (!token) return next();
    try {
        const payload = jwt.verify(token, SECRET);
        req.userId = payload.uid;
    } catch (e) { /* ignore */ }
    next();
}

function sign(user) {
    return jwt.sign(
        // `tv` = token_version : comparée à la valeur en base par authRequired
        // pour permettre la révocation en masse (audit SEC-05).
        { uid: user.id, email: user.email, tv: user.token_version || 0 },
        SECRET,
        { expiresIn: process.env.JWT_EXPIRES || '30d' }
    );
}

// Invalide TOUS les jetons émis pour ce compte (changement/réinitialisation de
// mot de passe, suppression de compte). Retourne la nouvelle version.
async function revokeTokens(userId) {
    await pool.query('UPDATE users SET token_version = token_version + 1 WHERE id = ?', [userId]);
    const [[row]] = await pool.query('SELECT token_version FROM users WHERE id = ?', [userId]);
    return row ? row.token_version : 0;
}

module.exports = { authRequired, authOptional, sign, revokeTokens };
