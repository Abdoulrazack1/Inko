// controllers/admin.controller.js — administration & modération (role='admin')
const { pool } = require('../config/db');

// ── Utilisateurs ───────────────────────────────────────────────
async function listUsers(req, res, next) {
    try {
        const q = (req.query.q || '').trim();
        const params = [];
        let where = '';
        if (q) { where = 'WHERE username LIKE ? OR email LIKE ?'; params.push(`%${q}%`, `%${q}%`); }
        const [rows] = await pool.query(
            `SELECT id, username, email, role, banned, created_at,
                    (SELECT COUNT(*) FROM read_chapters rc WHERE rc.user_id = users.id) AS chapters_read,
                    (SELECT COUNT(*) FROM comments cm WHERE cm.user_id = users.id) AS comments
             FROM users ${where} ORDER BY created_at DESC LIMIT 100`,
            params
        );
        res.json(rows.map(u => ({
            id: u.id, username: u.username, email: u.email, role: u.role,
            banned: !!u.banned, createdAt: u.created_at,
            chaptersRead: u.chapters_read, comments: u.comments,
        })));
    } catch (e) { next(e); }
}

async function setUserRole(req, res, next) {
    try {
        const { role } = req.body || {};
        if (!['user', 'admin'].includes(role)) return res.status(400).json({ error: 'Rôle invalide' });
        const id = parseInt(req.params.id, 10);
        if (id === req.user.id && role !== 'admin')
            return res.status(400).json({ error: 'Tu ne peux pas retirer ton propre rôle admin' });
        await pool.query('UPDATE users SET role = ? WHERE id = ?', [role, id]);
        res.json({ ok: true, role });
    } catch (e) { next(e); }
}

async function setUserBan(req, res, next) {
    try {
        const banned = req.body && req.body.banned ? 1 : 0;
        const id = parseInt(req.params.id, 10);
        if (id === req.user.id) return res.status(400).json({ error: 'Tu ne peux pas te bannir toi-même' });
        await pool.query('UPDATE users SET banned = ? WHERE id = ?', [banned, id]);
        res.json({ ok: true, banned: !!banned });
    } catch (e) { next(e); }
}

// ── Modération des commentaires signalés ───────────────────────
async function listReports(req, res, next) {
    try {
        const status = ['open', 'resolved', 'dismissed'].includes(req.query.status) ? req.query.status : 'open';
        const [rows] = await pool.query(
            `SELECT r.id, r.reason, r.status, r.created_at, r.manga_id,
                    c.id AS comment_id, c.text AS comment_text,
                    au.username AS author, ru.username AS reporter,
                    (SELECT COUNT(*) FROM reports r2 WHERE r2.comment_id = r.comment_id AND r2.status='open') AS report_count
             FROM reports r
             LEFT JOIN comments c ON c.id = r.comment_id
             LEFT JOIN users au ON au.id = c.user_id
             LEFT JOIN users ru ON ru.id = r.reporter_id
             WHERE r.status = ? ORDER BY r.created_at DESC LIMIT 100`,
            [status]
        );
        res.json(rows.map(r => ({
            id: r.id, reason: r.reason, status: r.status, createdAt: r.created_at,
            mangaId: r.manga_id, commentId: r.comment_id, commentText: r.comment_text,
            author: r.author, reporter: r.reporter, reportCount: r.report_count,
        })));
    } catch (e) { next(e); }
}

// action: 'delete' (supprime le commentaire) | 'dismiss' (ignore le signalement)
async function resolveReport(req, res, next) {
    try {
        const id = parseInt(req.params.id, 10);
        const action = req.body && req.body.action;
        const [[rep]] = await pool.query('SELECT id, comment_id FROM reports WHERE id = ?', [id]);
        if (!rep) return res.status(404).json({ error: 'Signalement introuvable' });

        if (action === 'delete' && rep.comment_id) {
            // Cascade FK : supprime aussi les réponses et les reports liés
            await pool.query('DELETE FROM comments WHERE id = ?', [rep.comment_id]);
            return res.json({ ok: true, deleted: true });
        }
        await pool.query('UPDATE reports SET status = ? WHERE id = ?',
            [action === 'delete' ? 'resolved' : 'dismissed', id]);
        res.json({ ok: true, status: action === 'delete' ? 'resolved' : 'dismissed' });
    } catch (e) { next(e); }
}

// ── Monitoring global ──────────────────────────────────────────
async function stats(_req, res, next) {
    try {
        const [[s]] = await pool.query(
            `SELECT (SELECT COUNT(*) FROM users) AS users,
                    (SELECT COUNT(*) FROM users WHERE created_at > NOW() - INTERVAL 7 DAY) AS users_week,
                    (SELECT COUNT(*) FROM users WHERE banned = 1) AS banned,
                    (SELECT COUNT(*) FROM comments) AS comments,
                    (SELECT COUNT(*) FROM read_chapters) AS reads_total,
                    (SELECT COUNT(*) FROM favorites) AS favorites,
                    (SELECT COUNT(*) FROM reports WHERE status = 'open') AS open_reports`
        );
        // Inscriptions par jour (14 derniers jours)
        const [signups] = await pool.query(
            `SELECT DATE(created_at) AS day, COUNT(*) AS n FROM users
             WHERE created_at > NOW() - INTERVAL 14 DAY GROUP BY DATE(created_at) ORDER BY day`
        );
        res.json({
            totals: s,
            signups: signups.map(r => ({ day: r.day.toISOString().slice(0, 10), n: r.n })),
        });
    } catch (e) { next(e); }
}

module.exports = { listUsers, setUserRole, setUserBan, listReports, resolveReport, stats };
