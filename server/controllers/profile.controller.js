// controllers/profile.controller.js — profil public /u/:username
const { pool } = require('../config/db');

function computeBadges(t, streak) {
    const b = [];
    if (t.chapters >= 1)    b.push({ id: 'first',      name: 'Première page',      icon: '📖' });
    if (t.chapters >= 100)  b.push({ id: 'reader100',  name: '100 chapitres',      icon: '📚' });
    if (t.chapters >= 1000) b.push({ id: 'reader1000', name: '1000 chapitres',     icon: '🏆' });
    if (t.series >= 10)     b.push({ id: 'explorer',   name: 'Exploration',        icon: '🧭' });
    if (t.favorites >= 20)  b.push({ id: 'collector',  name: 'Collectionneur',     icon: '⭐' });
    if (t.ratings >= 10)    b.push({ id: 'critic',     name: 'Critique',           icon: '✍️' });
    if (streak >= 7)        b.push({ id: 'streak7',    name: "7 jours d'affilée",  icon: '🔥' });
    if (streak >= 30)       b.push({ id: 'streak30',   name: "30 jours d'affilée", icon: '🌋' });
    return b;
}

async function publicProfile(req, res, next) {
    try {
        const [[u]] = await pool.query(
            'SELECT id, username, avatar, bio, created_at FROM users WHERE username = ?',
            [req.params.username]
        );
        if (!u) return res.status(404).json({ error: 'Profil introuvable' });

        // Confidentialité : réglage user_settings.privacy.privateProfile
        const [[srow]] = await pool.query('SELECT data FROM user_settings WHERE user_id = ?', [u.id]);
        const settings = srow ? (typeof srow.data === 'string' ? JSON.parse(srow.data) : srow.data) : {};
        const isPrivate = !!(settings && settings.privacy && settings.privacy.privateProfile);
        const viewerId = req.user?.id || req.userId;
        const isOwner  = viewerId === u.id;

        const base = {
            username:    u.username,
            avatar:      u.avatar || u.username[0].toUpperCase(),
            bio:         u.bio || null,
            memberSince: u.created_at,
            private:     isPrivate,
            isOwner,
        };
        if (isPrivate && !isOwner) {
            // Audit B2 : « profil privé » doit masquer TOUT le profil, pas
            // seulement stats et badges — avant, avatar, bio et date
            // d'inscription fuyaient malgré le réglage. Seul le username
            // (déjà connu du visiteur : il est dans l'URL) est renvoyé.
            return res.json({
                username: u.username,
                avatar:   null,
                bio:      null,
                memberSince: null,
                private:  true,
                isOwner:  false,
                hidden:   true,
                stats:    null,
                badges:   [],
            });
        }

        const [[t]] = await pool.query(
            `SELECT (SELECT COUNT(*) FROM read_chapters WHERE user_id = ?)            AS chapters,
                    (SELECT COUNT(DISTINCT manga_id) FROM read_chapters WHERE user_id = ?) AS series,
                    (SELECT COUNT(*) FROM favorites WHERE user_id = ?)               AS favorites,
                    (SELECT COUNT(*) FROM ratings WHERE user_id = ?)                 AS ratings`,
            [u.id, u.id, u.id, u.id]
        );
        // Streak de jours d'affilée
        const [days] = await pool.query(
            'SELECT DATE(read_at) AS day FROM read_chapters WHERE user_id = ? GROUP BY DATE(read_at)', [u.id]
        );
        const set = new Set(days.map(d => d.day.toISOString().slice(0, 10)));
        const iso = d => d.toISOString().slice(0, 10);
        let streak = 0; const cur = new Date();
        if (!set.has(iso(cur))) cur.setDate(cur.getDate() - 1);
        while (set.has(iso(cur))) { streak++; cur.setDate(cur.getDate() - 1); }

        // Audit BUG-09 : `lists.is_public` existait, le bouton « publique » de
        // l'interface le positionnait bien en base… et AUCUNE route ne l'exposait
        // (/api/lists/public → 404, le profil public ne renvoyait pas les listes).
        // L'utilisateur pouvait marquer une liste publique sans que rien ne la
        // rende publique. Elles apparaissent désormais sur le profil.
        const [lists] = await pool.query(
            `SELECT l.id, l.name, l.description, l.created_at,
                    (SELECT COUNT(*) FROM list_items li WHERE li.list_id = l.id) AS items
             FROM lists l WHERE l.user_id = ? AND l.is_public = 1
             ORDER BY l.created_at DESC LIMIT 50`, [u.id]);

        res.json({
            ...base,
            stats:  { chapters: t.chapters, series: t.series, favorites: t.favorites, ratings: t.ratings, streak },
            badges: computeBadges(t, streak),
            lists:  lists.map(l => ({
                id: l.id, name: l.name, description: l.description,
                items: l.items, createdAt: l.created_at,
            })),
        });
    } catch (e) { next(e); }
}

// GET /api/lists/:id — contenu d'une liste PUBLIQUE (audit BUG-09).
// Sans authentification : c'est précisément ce que « publique » veut dire.
// Une liste privée renvoie 404 — pas 403, pour ne pas révéler son existence.
async function publicList(req, res, next) {
    try {
        const id = parseInt(req.params.id, 10);
        if (!Number.isFinite(id)) return res.status(404).json({ error: 'Liste introuvable' });

        const [[l]] = await pool.query(
            `SELECT l.id, l.name, l.description, l.created_at, u.username AS owner
             FROM lists l JOIN users u ON u.id = l.user_id
             WHERE l.id = ? AND l.is_public = 1`, [id]);
        if (!l) return res.status(404).json({ error: 'Liste introuvable' });

        // Respecte le réglage « profil privé » du propriétaire : rendre une
        // liste publique ne doit pas contourner la confidentialité du compte.
        const [[srow]] = await pool.query(
            `SELECT s.data FROM user_settings s JOIN lists l2 ON l2.user_id = s.user_id
             WHERE l2.id = ?`, [id]);
        if (srow) {
            const st = typeof srow.data === 'string' ? JSON.parse(srow.data) : srow.data;
            if (st?.privacy?.privateProfile) return res.status(404).json({ error: 'Liste introuvable' });
        }

        const [items] = await pool.query(
            `SELECT manga_id, source, title, cover, position
             FROM list_items WHERE list_id = ? ORDER BY position, added_at`, [id]);

        res.json({
            id: l.id, name: l.name, description: l.description,
            owner: l.owner, createdAt: l.created_at,
            items: items.map(i => ({ id: i.manga_id, source: i.source, title: i.title, cover: i.cover })),
        });
    } catch (e) { next(e); }
}

module.exports = { publicProfile, publicList };
