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
        kind: r.kind || 'note',
        pinned: !!r.pinned,
    };
}

// Types d'entrée du journal (migration 23). « note » reste le défaut : les
// notes prises dans le lecteur n'ont rien à préciser.
const KINDS = ['note', 'citation', 'reflexion'];

// GET /api/me/notes?manga=&q=&limit=  — journal (tout) ou notes d'une série
async function listNotes(req, res, next) {
    try {
        const uid = req.user.id;
        const manga = req.query.manga;
        const q = (req.query.q || '').trim();
        const limit  = Math.min(parseInt(req.query.limit || '500', 10), 1000);
        // Audit J2/J3 : offset + total — au-delà de la limite, les notes les
        // plus anciennes disparaissaient silencieusement du Journal (et de sa
        // recherche), sans indicateur ni « charger plus ».
        const offset = Math.max(0, parseInt(req.query.offset || '0', 10));
        const where = ['user_id = ?'];
        const params = [uid];
        if (manga) { where.push('manga_id = ?'); params.push(manga); }
        if (q) { where.push('(body LIKE ? OR manga_title LIKE ?)'); params.push('%' + q + '%', '%' + q + '%'); }
        const [rows] = await pool.query(
            `SELECT * FROM reading_notes WHERE ${where.join(' AND ')} ORDER BY pinned DESC, created_at DESC LIMIT ${limit} OFFSET ${offset}`,
            params
        );
        const [[tot]] = await pool.query(
            `SELECT COUNT(*) AS n FROM reading_notes WHERE ${where.join(' AND ')}`, params
        );
        res.json({ notes: rows.map(mapNote), total: tot.n });
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
        const kind = KINDS.includes(b.kind) ? b.kind : 'note';
        const [r] = await pool.query(
            `INSERT INTO reading_notes
                (user_id, manga_id, source, manga_title, cover, chapter_id, chapter_num, page, body, mood, kind)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [req.user.id, b.mangaId, b.source || null, b.mangaTitle || null, b.cover || null,
             b.chapterId || null, b.chapterNum != null && b.chapterNum !== '' ? b.chapterNum : null,
             b.page != null ? parseInt(b.page, 10) : null, body, mood, kind]
        );
        const [[row]] = await pool.query('SELECT * FROM reading_notes WHERE id = ?', [r.insertId]);
        res.json({ ok: true, note: mapNote(row) });
    } catch (e) { next(e); }
}

// PUT /api/me/notes/:id — édite le texte / l'humeur (propriétaire uniquement)
async function updateNote(req, res, next) {
    try {
        const b = req.body || {};
        // Épingler/désépingler seul : pas besoin de renvoyer le texte.
        if (b.body === undefined && typeof b.pinned === 'boolean') {
            const [r0] = await pool.query('UPDATE reading_notes SET pinned = ? WHERE id = ? AND user_id = ?',
                [b.pinned ? 1 : 0, req.params.id, req.user.id]);
            if (!r0.affectedRows) return res.status(404).json({ error: 'Note introuvable' });
            const [[row0]] = await pool.query('SELECT * FROM reading_notes WHERE id = ?', [req.params.id]);
            return res.json({ ok: true, note: mapNote(row0) });
        }
        const body = String(b.body || '').trim();
        if (!body) return res.status(400).json({ error: 'La note est vide' });
        if (body.length > 5000) return res.status(400).json({ error: 'Note trop longue (5000 caractères max)' });
        // Audit B1 : COALESCE(?, mood) rendait l'humeur ineffaçable — un
        // mood:null explicite (décocher l'humeur) était ignoré par MySQL.
        // Trois cas distincts : humeur valide → SET, null explicite → efface,
        // absent du payload → inchangée.
        const sets = ['body = ?'];
        const vals = [body];
        if (KINDS.includes(b.kind)) { sets.push('kind = ?'); vals.push(b.kind); }
        if (typeof b.pinned === 'boolean') { sets.push('pinned = ?'); vals.push(b.pinned ? 1 : 0); }
        if (MOODS.includes(b.mood)) { sets.push('mood = ?'); vals.push(b.mood); }
        else if (b.mood === null)   { sets.push('mood = NULL'); }
        vals.push(req.params.id, req.user.id);
        const [r] = await pool.query(
            `UPDATE reading_notes SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`,
            vals
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

// GET /api/me/journal/activite?jours=60
// Ce qu'on a LU, jour par jour : le carnet se remplit tout seul, même sans
// écrire une ligne. Deux traces se complètent : les chapitres marqués lus et
// l'historique de progression (beaucoup lisent sans rien marquer).
async function activite(req, res, next) {
    try {
        const uid = req.user.id;
        const jours = Math.min(Math.max(parseInt(req.query.jours || '60', 10) || 60, 1), 365);
        const TZ = process.env.STATS_TZ || 'Europe/Paris';
        const jourDe = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(d));
        const [lus] = await pool.query(
            `SELECT manga_id, chapter_number AS ch, read_at AS at FROM read_chapters
             WHERE user_id = ? AND read_at >= NOW() - INTERVAL ? DAY`, [uid, jours]);
        let prog = [];
        try {
            [prog] = await pool.query(
                `SELECT manga_id, chapter_number AS ch, recorded_at AS at, source FROM progress_history
                 WHERE user_id = ? AND recorded_at >= NOW() - INTERVAL ? DAY`, [uid, jours]);
        } catch (e) { /* table absente : les chapitres lus suffisent */ }
        const [favs] = await pool.query('SELECT manga_id, title, cover, source FROM favorites WHERE user_id = ?', [uid]);
        const infos = new Map(favs.map(f => [f.manga_id, f]));
        // jour -> manga -> Set(chapitres)
        const parJour = new Map();
        const sourceDe = new Map();
        prog.forEach(r => { if (r.source && !sourceDe.has(r.manga_id)) sourceDe.set(r.manga_id, r.source); });
        try {
            const [ps] = await pool.query('SELECT manga_id, source FROM progress WHERE user_id = ? AND source IS NOT NULL', [uid]);
            ps.forEach(r => { if (!sourceDe.has(r.manga_id)) sourceDe.set(r.manga_id, r.source); });
        } catch (e) { /* sans importance : la série restera sans titre */ }
        for (const r of [...lus, ...prog]) {
            const j = jourDe(r.at);
            if (!parJour.has(j)) parJour.set(j, new Map());
            const m = parJour.get(j);
            if (!m.has(r.manga_id)) m.set(r.manga_id, new Set());
            if (r.ch != null) m.get(r.manga_id).add(Number(r.ch));
        }
        const out = [...parJour.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([jour, m]) => ({
            jour,
            series: [...m.entries()].map(([id, set]) => {
                const f = infos.get(id) || {};
                const chs = [...set].sort((a, b) => a - b);
                return { mangaId: id, titre: f.title || null, cover: f.cover || null, source: f.source || sourceDe.get(id) || null,
                    chapitres: chs.length, de: chs[0] ?? null, a: chs[chs.length - 1] ?? null };
            }).sort((a, b) => b.chapitres - a.chapitres),
        }));
        res.json({ jours: out });
    } catch (e) { next(e); }
}

module.exports = { listNotes, notesStats, createNote, updateNote, deleteNote, activite };
