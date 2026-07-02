// ============================================================
// lib/notify.js — Création de notifications in-app + parsing @mentions
// ============================================================
const { pool } = require('../config/db');
const { sendPush } = require('./push');

// Crée une notification (silencieux si la table n'existe pas encore) + push navigateur
async function createNotification(userId, { type, title, body, link, actor } = {}) {
    if (!userId || !type) return;
    try {
        await pool.query(
            'INSERT INTO notifications (user_id, type, title, body, link, actor) VALUES (?, ?, ?, ?, ?, ?)',
            [userId, type, title || null, body || null, link || null, actor || null]
        );
    } catch (e) { /* migration pas encore passée : on ignore */ }
    // Push navigateur — fire-and-forget, n'impacte jamais l'action métier
    sendPush(userId, { title: title || 'Inko', body: body || '', link: link || '/', type }).catch(() => {});
}

// Extrait les @mentions d'un texte → liste de usernames uniques
function parseMentions(text) {
    const set = new Set();
    const re = /@([A-Za-z0-9_]{2,50})/g;
    let m;
    while ((m = re.exec(text || ''))) set.add(m[1]);
    return [...set];
}

// Notifie chaque utilisateur mentionné (sauf l'auteur lui-même)
async function notifyMentions(text, { actor, link } = {}) {
    const names = parseMentions(text).filter(n => n !== actor);
    if (!names.length) return;
    try {
        const [rows] = await pool.query('SELECT id, username FROM users WHERE username IN (?)', [names]);
        for (const u of rows) {
            await createNotification(u.id, {
                type:  'mention',
                title: `@${actor} t'a mentionné`,
                body:  (text || '').slice(0, 140),
                link, actor,
            });
        }
    } catch (e) { /* ignore */ }
}

module.exports = { createNotification, parseMentions, notifyMentions };
