// controllers/user.controller.js — user data : favoris, library, progress, lists, comments, events
const { pool } = require('../config/db');

// ── helper events ───────────────────────────────────────────────
async function pushEvent(userId, type, payload = {}) {
    const { mangaId, chapterId, metadata } = payload;
    await pool.query(
        'INSERT INTO events (user_id, type, manga_id, chapter_id, metadata) VALUES (?, ?, ?, ?, ?)',
        [userId, type, mangaId || null, chapterId || null, metadata ? JSON.stringify(metadata) : null]
    );
}

// ──────────────────────────────────────────────────────────────
// FAVORITES
// ──────────────────────────────────────────────────────────────
async function getFavorites(req, res, next) {
    try {
        const [rows] = await pool.query(
            'SELECT manga_id, added_at FROM favorites WHERE user_id = ? ORDER BY added_at DESC',
            [req.user.id]
        );
        res.json(rows.map(r => ({ mangaId: r.manga_id, addedAt: r.added_at })));
    } catch (e) { next(e); }
}

async function addFavorite(req, res, next) {
    try {
        const { mangaId } = req.body;
        if (!mangaId) return res.status(400).json({ error: 'mangaId requis' });
        await pool.query(
            'INSERT IGNORE INTO favorites (user_id, manga_id) VALUES (?, ?)',
            [req.user.id, mangaId]
        );
        await pushEvent(req.user.id, 'favorite', { mangaId });
        res.json({ ok: true });
    } catch (e) { next(e); }
}

async function removeFavorite(req, res, next) {
    try {
        await pool.query(
            'DELETE FROM favorites WHERE user_id = ? AND manga_id = ?',
            [req.user.id, req.params.mangaId]
        );
        await pushEvent(req.user.id, 'unfavorite', { mangaId: req.params.mangaId });
        res.json({ ok: true });
    } catch (e) { next(e); }
}

// ──────────────────────────────────────────────────────────────
// LIBRARY (status par manga)
// ──────────────────────────────────────────────────────────────
async function getLibrary(req, res, next) {
    try {
        const [rows] = await pool.query(
            'SELECT manga_id, status, rating, added_at, updated_at FROM library WHERE user_id = ? ORDER BY updated_at DESC',
            [req.user.id]
        );
        res.json(rows.map(r => ({
            mangaId: r.manga_id, status: r.status, rating: r.rating,
            addedAt: r.added_at, updatedAt: r.updated_at,
        })));
    } catch (e) { next(e); }
}

async function setLibraryStatus(req, res, next) {
    try {
        const { status, rating } = req.body;
        const valid = ['reading', 'completed', 'planned', 'paused', 'dropped'];
        if (status && !valid.includes(status))
            return res.status(400).json({ error: 'Statut invalide' });

        if (!status) {
            await pool.query('DELETE FROM library WHERE user_id = ? AND manga_id = ?',
                [req.user.id, req.params.mangaId]);
            return res.json({ ok: true, removed: true });
        }

        await pool.query(
            `INSERT INTO library (user_id, manga_id, status, rating)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE status = VALUES(status), rating = COALESCE(VALUES(rating), rating)`,
            [req.user.id, req.params.mangaId, status, rating || null]
        );
        await pushEvent(req.user.id, 'status_change',
            { mangaId: req.params.mangaId, metadata: { status, rating } });
        res.json({ ok: true });
    } catch (e) { next(e); }
}

// ──────────────────────────────────────────────────────────────
// PROGRESS
// ──────────────────────────────────────────────────────────────
async function getAllProgress(req, res, next) {
    try {
        const [rows] = await pool.query(
            'SELECT manga_id, chapter_id, chapter_number, page, updated_at FROM progress WHERE user_id = ? ORDER BY updated_at DESC',
            [req.user.id]
        );
        const map = {};
        rows.forEach(r => {
            map[r.manga_id] = {
                chapterId: r.chapter_id,
                chapter:   r.chapter_number,
                page:      r.page,
                updatedAt: r.updated_at,
            };
        });
        res.json(map);
    } catch (e) { next(e); }
}

async function setProgress(req, res, next) {
    try {
        const { chapterId, chapter, page } = req.body;
        const mangaId = req.params.mangaId;
        await pool.query(
            `INSERT INTO progress (user_id, manga_id, chapter_id, chapter_number, page)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                chapter_id     = VALUES(chapter_id),
                chapter_number = VALUES(chapter_number),
                page           = VALUES(page)`,
            [req.user.id, mangaId, chapterId || null, chapter || null, page || 1]
        );
        await pushEvent(req.user.id, 'read',
            { mangaId, chapterId, metadata: { chapter, page } });
        res.json({ ok: true });
    } catch (e) { next(e); }
}

// ──────────────────────────────────────────────────────────────
// READ CHAPTERS
// ──────────────────────────────────────────────────────────────
async function getReadChapters(req, res, next) {
    try {
        const [rows] = await pool.query(
            'SELECT manga_id, chapter_id, chapter_number, read_at FROM read_chapters WHERE user_id = ? ORDER BY read_at DESC',
            [req.user.id]
        );
        const byManga = {};
        rows.forEach(r => {
            byManga[r.manga_id] = byManga[r.manga_id] || [];
            byManga[r.manga_id].push({ chapterId: r.chapter_id, chapter: r.chapter_number, readAt: r.read_at });
        });
        res.json(byManga);
    } catch (e) { next(e); }
}

async function markChapter(req, res, next) {
    try {
        const { mangaId, chapterId, chapter, read = true } = req.body;
        if (!mangaId || !chapterId) return res.status(400).json({ error: 'mangaId et chapterId requis' });
        if (read) {
            await pool.query(
                `INSERT IGNORE INTO read_chapters (user_id, manga_id, chapter_id, chapter_number)
                 VALUES (?, ?, ?, ?)`,
                [req.user.id, mangaId, chapterId, chapter || null]
            );
        } else {
            await pool.query(
                'DELETE FROM read_chapters WHERE user_id = ? AND chapter_id = ?',
                [req.user.id, chapterId]
            );
        }
        res.json({ ok: true });
    } catch (e) { next(e); }
}

// ──────────────────────────────────────────────────────────────
// LISTS
// ──────────────────────────────────────────────────────────────
async function getLists(req, res, next) {
    try {
        const [lists] = await pool.query(
            'SELECT id, name, description, is_public, created_at FROM lists WHERE user_id = ? ORDER BY created_at DESC',
            [req.user.id]
        );
        if (!lists.length) return res.json([]);
        const ids = lists.map(l => l.id);
        const [items] = await pool.query(
            'SELECT list_id, manga_id, position FROM list_items WHERE list_id IN (?) ORDER BY position',
            [ids]
        );
        const byList = {};
        items.forEach(it => {
            byList[it.list_id] = byList[it.list_id] || [];
            byList[it.list_id].push(it.manga_id);
        });
        res.json(lists.map(l => ({
            id: l.id, name: l.name, description: l.description,
            isPublic: !!l.is_public, createdAt: l.created_at,
            mangaIds: byList[l.id] || [],
        })));
    } catch (e) { next(e); }
}

async function createList(req, res, next) {
    try {
        const { name, description, isPublic } = req.body;
        if (!name || name.trim().length < 1)
            return res.status(400).json({ error: 'Nom requis' });
        const [r] = await pool.query(
            'INSERT INTO lists (user_id, name, description, is_public) VALUES (?, ?, ?, ?)',
            [req.user.id, name.trim(), description || null, !!isPublic]
        );
        res.json({ id: r.insertId, name: name.trim(), mangaIds: [] });
    } catch (e) { next(e); }
}

async function updateList(req, res, next) {
    try {
        const { name, description, isPublic } = req.body;
        const fields = [];
        const params = [];
        if (name)        { fields.push('name = ?');        params.push(name.trim()); }
        if (description !== undefined) { fields.push('description = ?'); params.push(description); }
        if (isPublic !== undefined) { fields.push('is_public = ?'); params.push(!!isPublic); }
        if (!fields.length) return res.json({ ok: true });
        params.push(req.params.id, req.user.id);
        await pool.query(`UPDATE lists SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`, params);
        res.json({ ok: true });
    } catch (e) { next(e); }
}

async function deleteList(req, res, next) {
    try {
        await pool.query('DELETE FROM lists WHERE id = ? AND user_id = ?',
            [req.params.id, req.user.id]);
        res.json({ ok: true });
    } catch (e) { next(e); }
}

async function addToList(req, res, next) {
    try {
        const { mangaId } = req.body;
        if (!mangaId) return res.status(400).json({ error: 'mangaId requis' });
        // Check ownership
        const [[list]] = await pool.query('SELECT id FROM lists WHERE id = ? AND user_id = ?',
            [req.params.id, req.user.id]);
        if (!list) return res.status(404).json({ error: 'Liste introuvable' });
        await pool.query(
            'INSERT IGNORE INTO list_items (list_id, manga_id) VALUES (?, ?)',
            [req.params.id, mangaId]
        );
        res.json({ ok: true });
    } catch (e) { next(e); }
}

async function removeFromList(req, res, next) {
    try {
        const [[list]] = await pool.query('SELECT id FROM lists WHERE id = ? AND user_id = ?',
            [req.params.id, req.user.id]);
        if (!list) return res.status(404).json({ error: 'Liste introuvable' });
        await pool.query(
            'DELETE FROM list_items WHERE list_id = ? AND manga_id = ?',
            [req.params.id, req.params.mangaId]
        );
        res.json({ ok: true });
    } catch (e) { next(e); }
}

// ──────────────────────────────────────────────────────────────
// COMMENTS
// ──────────────────────────────────────────────────────────────
async function getComments(req, res, next) {
    try {
        const [rows] = await pool.query(
            `SELECT c.id, c.text, c.chapter_id, c.created_at,
                    u.username, u.avatar
             FROM comments c
             JOIN users u ON u.id = c.user_id
             WHERE c.manga_id = ?
             ORDER BY c.created_at DESC
             LIMIT 50`,
            [req.params.mangaId]
        );
        res.json(rows.map(r => ({
            id: r.id, text: r.text, chapterId: r.chapter_id,
            user: r.username, avatar: r.avatar || r.username[0].toUpperCase(),
            createdAt: r.created_at,
        })));
    } catch (e) { next(e); }
}

async function addComment(req, res, next) {
    try {
        const { text, chapterId } = req.body;
        if (!text || text.trim().length < 1)
            return res.status(400).json({ error: 'Commentaire vide' });
        if (text.length > 1000)
            return res.status(400).json({ error: 'Commentaire trop long (1000 caractères max)' });
        const [r] = await pool.query(
            'INSERT INTO comments (user_id, manga_id, chapter_id, text) VALUES (?, ?, ?, ?)',
            [req.user.id, req.params.mangaId, chapterId || null, text.trim()]
        );
        await pushEvent(req.user.id, 'comment',
            { mangaId: req.params.mangaId, chapterId });
        res.json({ id: r.insertId, ok: true });
    } catch (e) { next(e); }
}

// ──────────────────────────────────────────────────────────────
// EVENTS / ACTIVITY
// ──────────────────────────────────────────────────────────────
async function getEvents(req, res, next) {
    try {
        const limit = Math.min(parseInt(req.query.limit || '200', 10), 500);
        const [rows] = await pool.query(
            `SELECT id, type, manga_id, chapter_id, metadata, created_at
             FROM events WHERE user_id = ?
             ORDER BY created_at DESC LIMIT ?`,
            [req.user.id, limit]
        );
        res.json(rows.map(r => ({
            id: r.id, type: r.type,
            mangaId: r.manga_id, chapterId: r.chapter_id,
            metadata: r.metadata ? (typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata) : null,
            at: r.created_at,
        })));
    } catch (e) { next(e); }
}

async function getStats(req, res, next) {
    try {
        const [[totals]] = await pool.query(
            `SELECT
                (SELECT COUNT(*) FROM favorites    WHERE user_id = ?) AS favorites,
                (SELECT COUNT(*) FROM library      WHERE user_id = ?) AS library,
                (SELECT COUNT(*) FROM read_chapters WHERE user_id = ?) AS chapters_read,
                (SELECT COUNT(*) FROM events       WHERE user_id = ? AND type='read' AND created_at > NOW() - INTERVAL 30 DAY) AS chapters_this_month`,
            [req.user.id, req.user.id, req.user.id, req.user.id]
        );

        const [days] = await pool.query(
            `SELECT DATE(created_at) AS day, COUNT(*) AS c
             FROM events WHERE user_id = ? AND type = 'read'
             AND created_at > NOW() - INTERVAL 365 DAY
             GROUP BY DATE(created_at)`,
            [req.user.id]
        );
        const heatmap = {};
        days.forEach(d => { heatmap[d.day.toISOString().slice(0,10)] = d.c; });

        res.json({ totals, heatmap });
    } catch (e) { next(e); }
}

module.exports = {
    getFavorites, addFavorite, removeFavorite,
    getLibrary, setLibraryStatus,
    getAllProgress, setProgress,
    getReadChapters, markChapter,
    getLists, createList, updateList, deleteList, addToList, removeFromList,
    getComments, addComment,
    getEvents, getStats,
};
