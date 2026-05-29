// middleware/auth.js — vérifie le JWT (cookie ou Authorization: Bearer)
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');

const SECRET = process.env.JWT_SECRET || 'change-me';

function readToken(req) {
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
            'SELECT id, username, email, avatar, role, created_at FROM users WHERE id = ?',
            [payload.uid]
        );
        if (!user) return res.status(401).json({ error: 'Utilisateur inexistant' });
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
        { uid: user.id, email: user.email },
        SECRET,
        { expiresIn: process.env.JWT_EXPIRES || '30d' }
    );
}

module.exports = { authRequired, authOptional, sign };
