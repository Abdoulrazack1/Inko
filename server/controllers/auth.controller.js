// controllers/auth.controller.js
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const axios  = require('axios');
const fs     = require('fs');
const path   = require('path');
const { pool } = require('../config/db');
const { sign } = require('../middleware/auth');
const mailer   = require('../lib/mailer');

// Client ID Google : priorité à la variable d'environnement, sinon fichier de
// config modifiable depuis l'app (Paramètres → Connexion Google) — pas besoin
// de redémarrer le serveur ni d'éditer un fichier à la main.
const GOOGLE_CFG_PATH = path.join(__dirname, '..', 'config', 'google.json');
function getGoogleClientId() {
    if (process.env.GOOGLE_CLIENT_ID) return process.env.GOOGLE_CLIENT_ID.trim();
    try {
        const j = JSON.parse(fs.readFileSync(GOOGLE_CFG_PATH, 'utf8'));
        return (j.clientId || '').trim();
    } catch (e) { return ''; }
}
function setGoogleClientIdFile(clientId) {
    fs.mkdirSync(path.dirname(GOOGLE_CFG_PATH), { recursive: true });
    fs.writeFileSync(GOOGLE_CFG_PATH, JSON.stringify({ clientId: (clientId || '').trim() }, null, 2));
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// App locale / self-hostée : pas de HTTPS public → cookie non-Secure
// (sinon le cookie n'est jamais posé sur http://localhost en prod).
// L'auth repose de toute façon aussi sur le token Bearer (localStorage).
const COOKIE_OPTS = {
    httpOnly: true,
    sameSite: 'lax',
    secure:   false,
    maxAge:   30 * 24 * 3600 * 1000,
    path:     '/',
};

function publicUser(u) {
    return { id: u.id, username: u.username, email: u.email, avatar: u.avatar || u.username[0].toUpperCase(), role: u.role || 'user', createdAt: u.created_at };
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

// Indique au front quels fournisseurs SSO sont configurés
function providers(_req, res) {
    const id = getGoogleClientId();
    res.json({ google: !!id, googleClientId: id || null });
}

// Configuration du Client ID Google depuis l'app (Paramètres). Authentifié.
function getGoogleConfig(_req, res) {
    const id = getGoogleClientId();
    res.json({
        clientId: id || '',
        configured: !!id,
        viaEnv: !!process.env.GOOGLE_CLIENT_ID,
        origin: `http://127.0.0.1:${process.env.PORT || 8088}`,
    });
}
function setGoogleConfig(req, res, next) {
    try {
        if (process.env.GOOGLE_CLIENT_ID)
            return res.status(409).json({ error: 'Client ID défini par variable d’environnement (GOOGLE_CLIENT_ID) — modifie le .env.' });
        const { clientId } = req.body || {};
        const v = (clientId || '').trim();
        if (v && !/\.apps\.googleusercontent\.com$/.test(v))
            return res.status(400).json({ error: 'Client ID invalide (doit finir par .apps.googleusercontent.com)' });
        setGoogleClientIdFile(v);
        res.json({ ok: true, configured: !!v });
    } catch (e) { next(e); }
}

// Connexion / inscription via Google (Google Identity Services).
// Le front envoie le « credential » (ID token) ; on le vérifie côté Google.
async function googleAuth(req, res, next) {
    try {
        const GOOGLE_CLIENT_ID = getGoogleClientId();
        if (!GOOGLE_CLIENT_ID)
            return res.status(503).json({ error: 'Connexion Google non configurée (ajoute ton Client ID dans Paramètres → Connexion Google).' });
        const { credential } = req.body || {};
        if (!credential) return res.status(400).json({ error: 'Jeton Google manquant' });

        // Vérification du token auprès de Google
        let info;
        try {
            const r = await axios.get('https://oauth2.googleapis.com/tokeninfo', { params: { id_token: credential }, timeout: 10000 });
            info = r.data;
        } catch (e) {
            return res.status(401).json({ error: 'Jeton Google invalide' });
        }
        if (info.aud !== GOOGLE_CLIENT_ID)
            return res.status(401).json({ error: 'Jeton Google destiné à une autre application' });
        const email = (info.email || '').toLowerCase();
        if (!email || (info.email_verified !== 'true' && info.email_verified !== true))
            return res.status(401).json({ error: 'Email Google non vérifié' });

        // Trouve ou crée le compte
        let [[user]] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
        if (!user) {
            const username = (info.name || info.given_name || email.split('@')[0]).trim().slice(0, 50);
            // Mot de passe inutilisable (compte SSO) : hash d'une valeur aléatoire
            const randomHash = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10);
            const avatar = (info.name || username)[0].toUpperCase();
            const [r] = await pool.query(
                'INSERT INTO users (username, email, password_hash, avatar) VALUES (?, ?, ?, ?)',
                [username || 'Lecteur', email, randomHash, avatar]
            );
            [[user]] = await pool.query('SELECT * FROM users WHERE id = ?', [r.insertId]);
        }
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

        // Audit S1 — le token ne doit jamais fuiter au client en prod.
        // Si un SMTP est configuré : on envoie le lien par email (le seul vrai
        // flux prod). Sinon on retombe sur le mode dev/desktop qui renvoie le
        // token directement pour permettre le reset sans serveur mail.
        if (mailer.isConfigured()) {
            try {
                await mailer.sendPasswordReset(email.toLowerCase(), token, req);
            } catch (e) {
                // Échec d'envoi : ne pas révéler l'existence du compte ni bloquer,
                // mais tracer côté serveur pour diagnostic.
                console.error('[mailer] échec envoi reset:', e.message);
            }
            return res.json({ ok: true });
        }
        if (process.env.NODE_ENV === 'production') return res.json({ ok: true });
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

// ── Changer le mot de passe (connecté) ──
async function changePassword(req, res, next) {
    try {
        const { currentPassword, newPassword } = req.body || {};
        if (!currentPassword || !newPassword)
            return res.status(400).json({ error: 'Champs requis' });
        if (newPassword.length < 6)
            return res.status(400).json({ error: 'Nouveau mot de passe trop court (6 caractères min)' });

        const [[user]] = await pool.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
        if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

        const ok = await bcrypt.compare(currentPassword, user.password_hash);
        if (!ok) return res.status(401).json({ error: 'Mot de passe actuel incorrect' });

        const hash = await bcrypt.hash(newPassword, 10);
        await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user.id]);
        res.json({ ok: true });
    } catch (e) { next(e); }
}

// ── Mettre à jour le profil (username / avatar) ──
async function updateProfile(req, res, next) {
    try {
        const { username, avatar } = req.body || {};
        const sets = [], vals = [];
        if (username !== undefined) {
            if (!username || username.trim().length < 2)
                return res.status(400).json({ error: "Nom d'utilisateur trop court" });
            sets.push('username = ?'); vals.push(username.trim());
        }
        if (avatar !== undefined) {
            // Avatar : emoji OU 1–2 lettres. On préserve tel quel (colonne VARCHAR(10)).
            const a = String(avatar).trim().slice(0, 10);
            sets.push('avatar = ?'); vals.push(a || null);
        }
        if (sets.length) {
            vals.push(req.user.id);
            await pool.query(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, vals);
        }
        const [[user]] = await pool.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
        res.json({ user: publicUser(user) });
    } catch (e) { next(e); }
}

// ── Supprimer le compte ──
async function deleteAccount(req, res, next) {
    try {
        const { password } = req.body || {};
        const [[user]] = await pool.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
        if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

        // Le compte démo ne peut pas être supprimé
        if (user.email === 'demo@inko.app' || user.email === 'demo@mangahub.app')
            return res.status(403).json({ error: 'Le compte démo ne peut pas être supprimé' });

        if (!password) return res.status(400).json({ error: 'Mot de passe requis pour confirmer' });
        const ok = await bcrypt.compare(password, user.password_hash);
        if (!ok) return res.status(401).json({ error: 'Mot de passe incorrect' });

        // Purge complète (RGPD art. 17, audit P2) : la cascade FK nettoie les
        // tables liées, mais pas les resets (clé email) ni les fichiers disque.
        await pool.query('DELETE FROM users WHERE id = ?', [req.user.id]); // CASCADE nettoie le reste
        await pool.query('DELETE FROM password_resets WHERE email = ?', [user.email]).catch(() => {});
        try {
            const fs = require('fs'), path = require('path');
            fs.rmSync(path.join(__dirname, '..', 'uploads', String(req.user.id)), { recursive: true, force: true });
        } catch (e) { /* pas d'uploads */ }
        res.clearCookie('token', { path: '/' });
        res.json({ ok: true });
    } catch (e) { next(e); }
}

module.exports = {
    register, login, me, logout, requestReset, resetPassword,
    changePassword, updateProfile, deleteAccount,
    providers, googleAuth, getGoogleConfig, setGoogleConfig,
};
