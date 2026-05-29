// controllers/auth.controller.js
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { pool } = require('../config/db');
const { sign } = require('../middleware/auth');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const COOKIE_OPTS = {
    httpOnly: true,
    sameSite: 'lax',
    secure:   process.env.NODE_ENV === 'production',
    maxAge:   30 * 24 * 3600 * 1000,
    path:     '/',
};

function publicUser(u) {
    return { id: u.id, username: u.username, email: u.email, avatar: u.avatar || u.username[0].toUpperCase(), createdAt: u.created_at };
}

async function register(req, res, next) {
    try {
        const { username, email, password } = req.body || {};
        if (!username || username.trim().length < 2)
            return res.status(400).json({ error: "Nom d'utilisateur trop court (2 caractères min)" });
        if (!EMAIL_RE.test(email || ''))
            return res.status(400).json({ error: 'Email invalide' });
        if (!password || password.length < 6)
            return res.status(400).json({ error: 'Mot de passe trop court (6 caractères min)' });

        const [[exists]] = await pool.query('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
        if (exists) return res.status(409).json({ error: 'Un compte existe déjà avec cet email' });

        const hash = await bcrypt.hash(password, 10);
        const [result] = await pool.query(
            'INSERT INTO users (username, email, password_hash, avatar) VALUES (?, ?, ?, ?)',
            [username.trim(), email.toLowerCase(), hash, username.trim()[0].toUpperCase()]
        );
        const [[user]] = await pool.query('SELECT * FROM users WHERE id = ?', [result.insertId]);

        const token = sign(user);
        res.cookie('token', token, COOKIE_OPTS);
        res.json({ user: publicUser(user), token });
    } catch (e) { next(e); }
}

async function login(req, res, next) {
    try {
        const { email, password } = req.body || {};
        if (!EMAIL_RE.test(email || ''))
            return res.status(400).json({ error: 'Email invalide' });
        if (!password) return res.status(400).json({ error: 'Mot de passe requis' });

        const [[user]] = await pool.query('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
        if (!user) return res.status(401).json({ error: 'Identifiants incorrects' });

        const ok = await bcrypt.compare(password, user.password_hash);
        if (!ok) return res.status(401).json({ error: 'Identifiants incorrects' });

        const token = sign(user);
        res.cookie('token', token, COOKIE_OPTS);
        res.json({ user: publicUser(user), token });
    } catch (e) { next(e); }
}

async function me(req, res) {
    res.json({ user: publicUser(req.user) });
}

async function logout(_req, res) {
    res.clearCookie('token', { path: '/' });
    res.json({ ok: true });
}

async function requestReset(req, res, next) {
    try {
        const { email } = req.body || {};
        if (!EMAIL_RE.test(email || ''))
            return res.status(400).json({ error: 'Email invalide' });

        const [[user]] = await pool.query('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
        // On retourne toujours OK pour ne pas révéler l'existence d'un compte
        if (!user) return res.json({ ok: true });

        const token = crypto.randomBytes(32).toString('hex');
        const expires = new Date(Date.now() + 60 * 60 * 1000); // 1h
        await pool.query(
            'INSERT INTO password_resets (email, token, expires_at) VALUES (?, ?, ?)',
            [email.toLowerCase(), token, expires]
        );

        // En prod : envoyer un email. Ici : retour direct du token pour démo
        res.json({ ok: true, token });
    } catch (e) { next(e); }
}

async function resetPassword(req, res, next) {
    try {
        const { email, token, newPassword } = req.body || {};
        if (!EMAIL_RE.test(email || '')) return res.status(400).json({ error: 'Email invalide' });
        if (!token) return res.status(400).json({ error: 'Token manquant' });
        if (!newPassword || newPassword.length < 6)
            return res.status(400).json({ error: 'Mot de passe trop court (6 caractères min)' });

        const [[reset]] = await pool.query(
            'SELECT * FROM password_resets WHERE email = ? AND token = ? AND used = 0 AND expires_at > NOW()',
            [email.toLowerCase(), token]
        );
        if (!reset) return res.status(400).json({ error: 'Lien expiré ou invalide' });

        const hash = await bcrypt.hash(newPassword, 10);
        await pool.query('UPDATE users SET password_hash = ? WHERE email = ?', [hash, email.toLowerCase()]);
        await pool.query('UPDATE password_resets SET used = 1 WHERE email = ? AND token = ?', [email.toLowerCase(), token]);

        res.json({ ok: true });
    } catch (e) { next(e); }
}

module.exports = { register, login, me, logout, requestReset, resetPassword };
