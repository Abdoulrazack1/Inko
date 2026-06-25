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
            return res.json({ ...base, hidden: true, stats: null, badges: [] });
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

        res.json({
            ...base,
            stats:  { chapters: t.chapters, series: t.series, favorites: t.favorites, ratings: t.ratings, streak },
            badges: computeBadges(t, streak),
        });
    } catch (e) { next(e); }
}

module.exports = { publicProfile };
