// controllers/user.controller.js — user data : favoris, library, progress, lists, comments, events
const { pool } = require('../config/db');
const extensions = require('../extensions/loader');

// Limiteur de concurrence simple (pour les checks de MAJ multi-mangas)
async function mapLimit(arr, limit, fn) {
    const out = [];
    let i = 0;
    const workers = Array.from({ length: Math.min(limit, arr.length) }, async () => {
        while (i < arr.length) {
            const idx = i++;
            try { out[idx] = await fn(arr[idx], idx); }
            catch (e) { out[idx] = null; }
        }
    });
    await Promise.all(workers);
    return out;
}

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
            `SELECT f.manga_id, f.source, f.title, f.cover, f.last_chapter, f.category, f.added_at, l.status
             FROM favorites f
             LEFT JOIN library l ON l.user_id = f.user_id AND l.manga_id = f.manga_id
             WHERE f.user_id = ? ORDER BY f.added_at DESC`,
            [req.user.id]
        );
        res.json(rows.map(r => ({
            mangaId: r.manga_id, source: r.source || 'mangadex',
            title: r.title, cover: r.cover, lastChapter: r.last_chapter,
            category: r.category || null, status: r.status || null,
            addedAt: r.added_at,
        })));
    } catch (e) { next(e); }
}

async function addFavorite(req, res, next) {
    try {
        const { mangaId, source, title, cover } = req.body;
        if (!mangaId) return res.status(400).json({ error: 'mangaId requis' });
        await pool.query(
            `INSERT INTO favorites (user_id, manga_id, source, title, cover)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE source = VALUES(source),
                title = COALESCE(VALUES(title), title),
                cover = COALESCE(VALUES(cover), cover)`,
            [req.user.id, mangaId, source || 'mangadex', title || null, cover || null]
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

// Assigne une catégorie à un favori (crée le favori s'il n'existe pas)
async function setFavoriteCategory(req, res, next) {
    try {
        const { category, title, cover, source } = req.body;
        await pool.query(
            `INSERT INTO favorites (user_id, manga_id, category, title, cover, source)
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE category = VALUES(category),
                title = COALESCE(title, VALUES(title)), cover = COALESCE(cover, VALUES(cover))`,
            [req.user.id, req.params.mangaId, category || null, title || null, cover || null, source || 'mangadex']
        );
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

// Retire une œuvre de "reprendre la lecture" (efface sa progression)
async function deleteProgress(req, res, next) {
    try {
        await pool.query('DELETE FROM progress WHERE user_id = ? AND manga_id = ?',
            [req.user.id, req.params.mangaId]);
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
            const [r] = await pool.query(
                `INSERT IGNORE INTO read_chapters (user_id, manga_id, chapter_id, chapter_number)
                 VALUES (?, ?, ?, ?)`,
                [req.user.id, mangaId, chapterId, chapter || null]
            );
            if (r.affectedRows) await pushEvent(req.user.id, 'read', { mangaId, chapterId, chapter });
        } else {
            await pool.query(
                'DELETE FROM read_chapters WHERE user_id = ? AND chapter_id = ?',
                [req.user.id, chapterId]
            );
        }
        res.json({ ok: true });
    } catch (e) { next(e); }
}

// Marque plusieurs chapitres lus en un seul appel (ex. "marquer jusqu'ici")
async function markChaptersBulk(req, res, next) {
    try {
        const { mangaId, chapters } = req.body;
        if (!mangaId || !Array.isArray(chapters) || !chapters.length)
            return res.status(400).json({ error: 'mangaId et chapters[] requis' });
        const values = chapters
            .filter(c => c && c.chapterId)
            .map(c => [req.user.id, mangaId, c.chapterId, (c.chapter ?? null)]);
        if (!values.length) return res.json({ ok: true, count: 0 });
        await pool.query(
            'INSERT IGNORE INTO read_chapters (user_id, manga_id, chapter_id, chapter_number) VALUES ?',
            [values]
        );
        res.json({ ok: true, count: values.length });
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
            'SELECT list_id, manga_id, source, title, cover, position FROM list_items WHERE list_id IN (?) ORDER BY position, added_at',
            [ids]
        );
        const byList = {};
        items.forEach(it => {
            byList[it.list_id] = byList[it.list_id] || [];
            byList[it.list_id].push({ id: it.manga_id, source: it.source, title: it.title, cover: it.cover });
        });
        res.json(lists.map(l => ({
            id: l.id, name: l.name, description: l.description,
            isPublic: !!l.is_public, createdAt: l.created_at,
            items: byList[l.id] || [],
            mangaIds: (byList[l.id] || []).map(it => it.id),
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
        const { mangaId, source, title, cover } = req.body;
        if (!mangaId) return res.status(400).json({ error: 'mangaId requis' });
        // Check ownership
        const [[list]] = await pool.query('SELECT id FROM lists WHERE id = ? AND user_id = ?',
            [req.params.id, req.user.id]);
        if (!list) return res.status(404).json({ error: 'Liste introuvable' });
        await pool.query(
            `INSERT INTO list_items (list_id, manga_id, source, title, cover) VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE source=VALUES(source), title=VALUES(title), cover=VALUES(cover)`,
            [req.params.id, mangaId, source || null, title || null, cover || null]
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

// Derniers commentaires toutes séries confondues (vitrine catalogue)
async function getRecentComments(req, res, next) {
    try {
        const limit = Math.min(parseInt(req.query.limit || '6', 10), 20);
        const [rows] = await pool.query(
            `SELECT c.id, c.text, c.manga_id, c.created_at,
                    u.username, u.avatar,
                    rt.rating,
                    (SELECT f.title  FROM favorites f WHERE f.manga_id = c.manga_id AND f.title IS NOT NULL LIMIT 1) AS manga_title,
                    (SELECT f.source FROM favorites f WHERE f.manga_id = c.manga_id AND f.source IS NOT NULL LIMIT 1) AS manga_source
             FROM comments c
             JOIN users u ON u.id = c.user_id
             LEFT JOIN ratings rt ON rt.user_id = c.user_id AND rt.manga_id = c.manga_id
             ORDER BY c.created_at DESC
             LIMIT ?`,
            [limit]
        );
        res.json(rows.map(r => ({
            id: r.id, text: r.text, mangaId: r.manga_id,
            mangaTitle: r.manga_title || null, mangaSource: r.manga_source || null,
            rating: r.rating || null,
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
        const uid = req.user.id;
        const [[totals]] = await pool.query(
            `SELECT
                (SELECT COUNT(*) FROM favorites WHERE user_id = ?) AS favorites,
                (SELECT COUNT(*) FROM library WHERE user_id = ?) AS library,
                (SELECT COUNT(*) FROM read_chapters WHERE user_id = ?) AS chapters_read,
                (SELECT COUNT(*) FROM read_chapters WHERE user_id = ? AND read_at > NOW() - INTERVAL 30 DAY) AS chapters_this_month,
                (SELECT COUNT(DISTINCT manga_id) FROM read_chapters WHERE user_id = ?) AS series_read,
                (SELECT COUNT(*) FROM ratings WHERE user_id = ?) AS ratings`,
            [uid, uid, uid, uid, uid, uid]
        );

        const [days] = await pool.query(
            `SELECT DATE(read_at) AS day, COUNT(*) AS c
             FROM read_chapters WHERE user_id = ? AND read_at > NOW() - INTERVAL 365 DAY
             GROUP BY DATE(read_at)`,
            [uid]
        );
        const heatmap = {};
        days.forEach(d => { heatmap[d.day.toISOString().slice(0, 10)] = d.c; });

        // Séries de lecture (streak)
        const set = new Set(Object.keys(heatmap));
        const iso = d => d.toISOString().slice(0, 10);
        let current = 0; const cur = new Date();
        if (!set.has(iso(cur))) cur.setDate(cur.getDate() - 1);
        while (set.has(iso(cur))) { current++; cur.setDate(cur.getDate() - 1); }
        const sorted = [...set].sort();
        let longest = 0, run = 0, prev = null;
        sorted.forEach(d => {
            if (prev && (new Date(d) - new Date(prev)) / 86400000 === 1) run++; else run = 1;
            longest = Math.max(longest, run); prev = d;
        });

        res.json({ totals, heatmap, streak: { current, longest } });
    } catch (e) { next(e); }
}

// ──────────────────────────────────────────────────────────────
// RATINGS (note + review)
// ──────────────────────────────────────────────────────────────
async function getMangaRating(req, res, next) {
    try {
        const mangaId = req.params.mangaId;
        // Moyenne + nombre + note de l'user courant
        const [[agg]] = await pool.query(
            'SELECT AVG(rating) AS avg, COUNT(*) AS count FROM ratings WHERE manga_id = ?',
            [mangaId]
        );
        let mine = null;
        const uid = req.user?.id || req.userId;
        if (uid) {
            const [[r]] = await pool.query(
                'SELECT rating, review FROM ratings WHERE user_id = ? AND manga_id = ?',
                [uid, mangaId]
            );
            if (r) mine = { rating: r.rating, review: r.review };
        }
        res.json({
            average: agg.avg ? Math.round(agg.avg * 10) / 10 : null,
            count:   agg.count || 0,
            mine,
        });
    } catch (e) { next(e); }
}

async function setMangaRating(req, res, next) {
    try {
        const mangaId = req.params.mangaId;
        const { rating, review } = req.body || {};
        const r = parseInt(rating, 10);
        if (!r || r < 1 || r > 5)
            return res.status(400).json({ error: 'Note entre 1 et 5 requise' });
        await pool.query(
            `INSERT INTO ratings (user_id, manga_id, rating, review)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE rating = VALUES(rating), review = VALUES(review)`,
            [req.user.id, mangaId, r, review || null]
        );
        await pushEvent(req.user.id, 'rating', { mangaId, metadata: { rating: r } });
        res.json({ ok: true });
    } catch (e) { next(e); }
}

async function deleteMangaRating(req, res, next) {
    try {
        await pool.query('DELETE FROM ratings WHERE user_id = ? AND manga_id = ?',
            [req.user.id, req.params.mangaId]);
        res.json({ ok: true });
    } catch (e) { next(e); }
}

// Mes notes (pour profil)
async function getMyRatings(req, res, next) {
    try {
        const [rows] = await pool.query(
            'SELECT manga_id, rating, review, updated_at FROM ratings WHERE user_id = ? ORDER BY updated_at DESC',
            [req.user.id]
        );
        res.json(rows.map(r => ({ mangaId: r.manga_id, rating: r.rating, review: r.review, updatedAt: r.updated_at })));
    } catch (e) { next(e); }
}

// ──────────────────────────────────────────────────────────────
// SETTINGS (préférences synchronisées)
// ──────────────────────────────────────────────────────────────
async function getSettings(req, res, next) {
    try {
        const [[row]] = await pool.query('SELECT data FROM user_settings WHERE user_id = ?', [req.user.id]);
        const data = row ? (typeof row.data === 'string' ? JSON.parse(row.data) : row.data) : {};
        res.json(data || {});
    } catch (e) { next(e); }
}

async function setSettings(req, res, next) {
    try {
        const incoming = req.body || {};
        const [[row]] = await pool.query('SELECT data FROM user_settings WHERE user_id = ?', [req.user.id]);
        const current = row ? (typeof row.data === 'string' ? JSON.parse(row.data) : row.data) : {};
        const merged = { ...current, ...incoming };
        await pool.query(
            `INSERT INTO user_settings (user_id, data) VALUES (?, ?)
             ON DUPLICATE KEY UPDATE data = VALUES(data)`,
            [req.user.id, JSON.stringify(merged)]
        );
        res.json(merged);
    } catch (e) { next(e); }
}

// ──────────────────────────────────────────────────────────────
// EXPORT / RESET data
// ──────────────────────────────────────────────────────────────
async function exportData(req, res, next) {
    try {
        const uid = req.user.id;
        const [favorites]    = await pool.query('SELECT manga_id, added_at FROM favorites WHERE user_id = ?', [uid]);
        const [library]      = await pool.query('SELECT manga_id, status, rating FROM library WHERE user_id = ?', [uid]);
        const [progress]     = await pool.query('SELECT manga_id, chapter_id, chapter_number, page FROM progress WHERE user_id = ?', [uid]);
        const [readChapters] = await pool.query('SELECT manga_id, chapter_id, chapter_number FROM read_chapters WHERE user_id = ?', [uid]);
        const [ratings]      = await pool.query('SELECT manga_id, rating, review FROM ratings WHERE user_id = ?', [uid]);
        res.json({
            exportedAt: new Date().toISOString(),
            user: { username: req.user.username, email: req.user.email },
            favorites, library, progress, readChapters, ratings,
        });
    } catch (e) { next(e); }
}

async function clearHistory(req, res, next) {
    try {
        const uid = req.user.id;
        await pool.query('DELETE FROM events WHERE user_id = ?', [uid]);
        await pool.query('DELETE FROM progress WHERE user_id = ?', [uid]);
        await pool.query('DELETE FROM read_chapters WHERE user_id = ?', [uid]);
        res.json({ ok: true });
    } catch (e) { next(e); }
}

// ──────────────────────────────────────────────────────────────
// UPDATES — nouveaux chapitres des mangas suivis (façon Mihon)
// ──────────────────────────────────────────────────────────────
async function checkUpdates(req, res, next) {
    try {
        const uid = req.user.id;
        const [favs] = await pool.query(
            'SELECT manga_id, source, title, cover, last_chapter FROM favorites WHERE user_id = ?',
            [uid]
        );
        if (!favs.length) return res.json({ updates: [], checkedAt: Date.now() });

        // Chapitres déjà lus (par manga)
        const [readRows] = await pool.query(
            'SELECT manga_id, chapter_number FROM read_chapters WHERE user_id = ?', [uid]
        );
        const readByManga = {};
        readRows.forEach(r => {
            (readByManga[r.manga_id] = readByManga[r.manga_id] || new Set()).add(r.chapter_number);
        });

        const lang = (req.query.lang || 'fr,en');

        const results = await mapLimit(favs, 4, async (f) => {
            const src = extensions.get(f.source || 'mangadex') || extensions.defaultSource();
            if (!src || typeof src.getChapters !== 'function') return null;
            let chaps = [];
            try {
                const data = await src.getChapters(f.manga_id, { lang, limit: 200 });
                chaps = data.results || [];
            } catch (e) { return null; }
            if (!chaps.length) return null;

            const readSet = readByManga[f.manga_id] || new Set();
            const latest  = chaps[0]; // déjà trié desc par les extensions
            const unread  = chaps.filter(c => !readSet.has(c.chapter));

            // Mémorise le dernier chapitre connu
            if (latest?.chapter != null && latest.chapter !== f.last_chapter) {
                pool.query('UPDATE favorites SET last_chapter = ? WHERE user_id = ? AND manga_id = ?',
                    [latest.chapter, uid, f.manga_id]).catch(() => {});
            }

            return {
                mangaId:    f.manga_id,
                source:     f.source || 'mangadex',
                title:      f.title || f.manga_id,
                cover:      f.cover || null,
                latest:     latest ? { id: latest.id, chapter: latest.chapter, title: latest.title, publishedAt: latest.publishedAt } : null,
                unreadCount: unread.length,
                hasNew:     latest && f.last_chapter != null && latest.chapter > f.last_chapter,
            };
        });

        // Trie : nouveautés d'abord, puis par nb de non-lus
        const updates = results.filter(Boolean)
            .sort((a, b) => (b.hasNew - a.hasNew) || (b.unreadCount - a.unreadCount));

        res.json({ updates, checkedAt: Date.now() });
    } catch (e) { next(e); }
}

module.exports = {
    getFavorites, addFavorite, removeFavorite, setFavoriteCategory,
    getLibrary, setLibraryStatus,
    getAllProgress, setProgress, deleteProgress,
    getReadChapters, markChapter, markChaptersBulk,
    getLists, createList, updateList, deleteList, addToList, removeFromList,
    getComments, addComment, getRecentComments,
    getEvents, getStats,
    getMangaRating, setMangaRating, deleteMangaRating, getMyRatings,
    getSettings, setSettings,
    exportData, clearHistory,
    checkUpdates,
};
