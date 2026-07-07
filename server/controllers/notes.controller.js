// ============================================================
// notes.controller.js — Journal de lecture : notes personnelles
// ------------------------------------------------------------
// Notes privées prises pendant la lecture, rattachées au contexte
// (série / chapitre / page). Synchronisées côté serveur comme les
// favoris et la progression.
// ============================================================
const { pool } = require('../config/db');

const MOODS = ['love', 'wow', 'laugh', 'cry', 'angry', 'think', 'fear', 'meh'];

function mapNote(r) {
    return {
        id: r.id,
        mangaId: r.manga_id,
        source: r.source || null,
        mangaTitle: r.manga_title || null,
        cover: r.cover || null,
        chapterId: r.chapter_id || null,
        chapterNum: r.chapter_num != null ? Number(r.chapter_num) : null,
        page: r.page != null ? r.page : null,
        body: r.body,
        mood: r.mood || null,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
    };
}

// GET /api/me/notes?manga=&q=&limit=  — journal (tout) ou notes d'une série
async function listNotes(req, res, next) {
    try {
        const uid = req.user.id;
        const manga = req.query.manga;
        const q = (req.query.q || '').trim();
        const limit = Math.min(parseInt(req.query.limit || '500', 10), 1000);
        const where = ['user_id = ?'];
        const params = [uid];
        if (manga) { where.push('manga_id = ?'); params.push(manga); }
        if (q) { where.push('(body LIKE ? OR manga_title LIKE ?)'); params.push('%' + q + '%', '%' + q + '%'); }
        const [rows] = await pool.query(
            `SELECT * FROM reading_notes WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT ${limit}`,
            params
        );
        res.json({ notes: rows.map(mapNote) });
    } catch (e) { next(e); }
}

// GET /api/me/notes/stats — compteurs pour le journal (total, séries, humeurs)
async function notesStats(req, res, next) {
    try {
        const uid = req.user.id;
        const [[c]] = await pool.query(
            'SELECT COUNT(*) AS total, COUNT(DISTINCT manga_id) AS series FROM reading_notes WHERE user_id = ?',
            [uid]
        );
        const [moods] = await pool.query(
            'SELECT mood, COUNT(*) AS n FROM reading_notes WHERE user_id = ? AND mood IS NOT NULL GROUP BY mood',
            [uid]
        );
        res.json({ total: c.total || 0, series: c.series || 0, moods: Object.fromEntries(moods.map(m => [m.mood, m.n])) });
    } catch (e) { next(e); }
}

// POST /api/me/notes — crée une note
async function createNote(req, res, next) {
    try {
        const b = req.body || {};
        if (!b.mangaId) return res.status(400).json({ error: 'mangaId requis' });
        const body = String(b.body || '').trim();
        if (!body) return res.status(400).json({ error: 'La note est vide' });
        if (body.length > 5000) return res.status(400).json({ error: 'Note trop longue (5000 caractères max)' });
        const mood = MOODS.includes(b.mood) ? b.mood : null;
        const [r] = await pool.query(
            `INSERT INTO reading_notes
                (user_id, manga_id, source, manga_title, cover, chapter_id, chapter_num, page, body, mood)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [req.user.id, b.mangaId, b.source || null, b.mangaTitle || null, b.cover || null,
             b.chapterId || null, b.chapterNum != null ? b.chapterNum : null,
             b.page != null ? parseInt(b.page, 10) : null, body, mood]
        );
        const [[row]] = await pool.query('SELECT * FROM reading_notes WHERE id = ?', [r.insertId]);
        res.json({ ok: true, note: mapNote(row) });
    } catch (e) { next(e); }
}

// PUT /api/me/notes/:id — édite le texte / l'humeur (propriétaire uniquement)
async function updateNote(req, res, next) {
    try {
        const b = req.body || {};
        const body = String(b.body || '').trim();
        if (!body) return res.status(400).json({ error: 'La note est vide' });
        if (body.length > 5000) return res.status(400).json({ error: 'Note trop longue (5000 caractères max)' });
        const mood = MOODS.includes(b.mood) ? b.mood : (b.mood === null ? null : undefined);
        const [r] = await pool.query(
            'UPDATE reading_notes SET body = ?, mood = COALESCE(?, mood) WHERE id = ? AND user_id = ?',
            [body, mood === undefined ? null : mood, req.params.id, req.user.id]
        );
        if (!r.affectedRows) return res.status(404).json({ error: 'Note introuvable' });
        const [[row]] = await pool.query('SELECT * FROM reading_notes WHERE id = ?', [req.params.id]);
        res.json({ ok: true, note: mapNote(row) });
    } catch (e) { next(e); }
}

// DELETE /api/me/notes/:id
async function deleteNote(req, res, next) {
    try {
        const [r] = await pool.query(
            'DELETE FROM reading_notes WHERE id = ? AND user_id = ?',
            [req.params.id, req.user.id]
        );
        if (!r.affectedRows) return res.status(404).json({ error: 'Note introuvable' });
        res.json({ ok: true });
    } catch (e) { next(e); }
}

module.exports = { listNotes, notesStats, createNote, updateNote, deleteNote };
