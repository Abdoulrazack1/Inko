// controllers/notif.controller.js — notifications in-app + abonnements Web Push
const { pool } = require('../config/db');
const { publicKey } = require('../lib/push');

// Clé publique VAPID (nécessaire au navigateur pour s'abonner)
function vapid(_req, res) {
    res.json({ publicKey: publicKey() });
}

async function list(req, res, next) {
    try {
        const limit = Math.min(parseInt(req.query.limit || '30', 10), 100);
        const [rows] = await pool.query(
            `SELECT id, type, title, body, link, actor, image, is_read, created_at
             FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
            [req.user.id, limit]
        );
        const [[c]] = await pool.query(
            'SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND is_read = 0', [req.user.id]
        );
        res.json({
            unread: c.n,
            items: rows.map(r => ({
                id: r.id, type: r.type, title: r.title, body: r.body,
                link: r.link, actor: r.actor, image: r.image, read: !!r.is_read, at: r.created_at,
            })),
        });
    } catch (e) { next(e); }
}

async function unreadCount(req, res, next) {
    try {
        const [[c]] = await pool.query(
            'SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND is_read = 0', [req.user.id]
        );
        res.json({ unread: c.n });
    } catch (e) { next(e); }
}

async function markRead(req, res, next) {
    try {
        await pool.query('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND id = ?',
            [req.user.id, parseInt(req.params.id, 10)]);
        res.json({ ok: true });
    } catch (e) { next(e); }
}

async function markAllRead(req, res, next) {
    try {
        await pool.query('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0', [req.user.id]);
        res.json({ ok: true });
    } catch (e) { next(e); }
}

// Enregistre un abonnement Web Push (service worker)
async function subscribe(req, res, next) {
    try {
        const { endpoint, keys } = req.body || {};
        if (!endpoint) return res.status(400).json({ error: 'endpoint requis' });
        await pool.query(
            `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), p256dh = VALUES(p256dh), auth = VALUES(auth)`,
            [req.user.id, endpoint, keys?.p256dh || null, keys?.auth || null]
        );
        res.json({ ok: true });
    } catch (e) { next(e); }
}

module.exports = { list, unreadCount, markRead, markAllRead, subscribe, vapid };
