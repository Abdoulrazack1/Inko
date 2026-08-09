// controllers/notif.controller.js — notifications in-app + abonnements Web Push
const { pool } = require('../config/db');
const { publicKey } = require('../lib/push');
const { RETENTION_JOURS } = require('../lib/notify');

// Clé publique VAPID (nécessaire au navigateur pour s'abonner)
function vapid(_req, res) {
    res.json({ publicKey: publicKey() });
}

async function list(req, res, next) {
    try {
        const limit  = Math.min(parseInt(req.query.limit || '30', 10), 100);
        // Pagination (audit N3) : offset + total pour un « charger plus » —
        // avant, tout au-delà des 100 plus récentes était inaccessible.
        const offset = Math.max(0, parseInt(req.query.offset || '0', 10));
        const [rows] = await pool.query(
            `SELECT id, type, title, body, link, actor, image, is_read, created_at, group_count
             FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
            [req.user.id, limit, offset]
        );
        const [[c]] = await pool.query(
            'SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND is_read = 0', [req.user.id]
        );
        const [[tot]] = await pool.query(
            'SELECT COUNT(*) AS n FROM notifications WHERE user_id = ?', [req.user.id]
        );
        res.json({
            unread: c.n,
            total:  tot.n,
            items: rows.map(r => ({
                id: r.id, type: r.type, title: r.title, body: r.body,
                link: r.link, actor: r.actor, image: r.image, read: !!r.is_read, at: r.created_at,
                // Audit AMEL-53 : le nombre de parutions regroupées sous cette
                // ligne — l'UI en fait une pastille plutôt qu'une ligne de plus.
                count: r.group_count || 1,
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

// ── Réglages de notification (audit AMEL-54) ────────────────
// Le scan était global : toutes les séries suivies, toutes les 4 h, pour tout
// le monde. Une série qu'on suit sans vouloir en être averti n'existait pas,
// et il n'y avait aucun moyen d'espacer ou de couper les alertes sans se
// désabonner du push (ce qui laissait la cloche in-app continuer).
const FREQUENCES = [0, 4, 12, 24, 72];

async function getPrefs(req, res, next) {
    try {
        const [[u]] = await pool.query(
            'SELECT notif_every_hours, last_notif_scan FROM users WHERE id = ?', [req.user.id]);
        const [[c]] = await pool.query(
            'SELECT COUNT(*) AS suivies, COALESCE(SUM(notify), 0) AS surveillees FROM favorites WHERE user_id = ?',
            [req.user.id]);
        res.json({
            everyHours: u?.notif_every_hours ?? 4,
            lastScan: u?.last_notif_scan || null,
            choices: FREQUENCES,
            watched: Number(c.surveillees) || 0,
            followed: Number(c.suivies) || 0,
            retentionDays: RETENTION_JOURS,
        });
    } catch (e) { next(e); }
}

async function setPrefs(req, res, next) {
    try {
        const h = parseInt(req.body?.everyHours, 10);
        if (!FREQUENCES.includes(h))
            return res.status(400).json({ error: 'Fréquence invalide (0, 4, 12, 24 ou 72 heures)' });
        await pool.query('UPDATE users SET notif_every_hours = ? WHERE id = ?', [h, req.user.id]);
        res.json({ ok: true, everyHours: h });
    } catch (e) { next(e); }
}

// Surveiller / ne plus surveiller UNE série. Ne touche pas au favori : ne plus
// vouloir d'alerte n'est pas cesser de suivre.
async function setWatch(req, res, next) {
    try {
        const on = req.body?.notify !== false && req.body?.notify !== 0;
        const [r] = await pool.query(
            'UPDATE favorites SET notify = ? WHERE user_id = ? AND manga_id = ?',
            [on ? 1 : 0, req.user.id, req.params.mangaId]);
        if (!r.affectedRows) return res.status(404).json({ error: 'Série absente de ta bibliothèque' });
        res.json({ ok: true, notify: on });
    } catch (e) { next(e); }
}

module.exports = { list, unreadCount, markRead, markAllRead, subscribe, vapid, getPrefs, setPrefs, setWatch };
