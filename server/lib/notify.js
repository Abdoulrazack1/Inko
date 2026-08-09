// ============================================================
// lib/notify.js — Création de notifications in-app + parsing @mentions
// ============================================================
const { pool } = require('../config/db');
const { sendPush } = require('./push');

// Crée une notification (silencieux si la table n'existe pas encore) + push navigateur.
//
// Audit AMEL-53 : avec `groupKey`, une notification NON LUE portant la même clé
// est mise à jour au lieu d'en empiler une nouvelle. La cloche montre alors
// l'état courant d'une série (« 3 nouveaux chapitres ») et non l'historique de
// chaque parution — 30 lignes pour une seule œuvre avant ce changement.
// Une notification DÉJÀ LUE n'est jamais réécrite : la rouvrir en la modifiant
// ferait disparaître ce que l'utilisateur a consciemment traité.
async function createNotification(userId, { type, title, body, link, actor, image, groupKey } = {}) {
    if (!userId || !type) return;
    let count = 1;
    try {
        if (groupKey) {
            const [[existant]] = await pool.query(
                `SELECT id, group_count FROM notifications
                 WHERE user_id = ? AND type = ? AND group_key = ? AND is_read = 0
                 ORDER BY created_at DESC LIMIT 1`,
                [userId, type, groupKey]
            );
            if (existant) {
                count = (existant.group_count || 1) + 1;
                await pool.query(
                    `UPDATE notifications
                     SET title = ?, body = ?, link = ?, image = COALESCE(?, image),
                         group_count = ?, created_at = CURRENT_TIMESTAMP
                     WHERE id = ?`,
                    [title || null, body || null, link || null, image || null, count, existant.id]
                );
                sendPush(userId, { title: title || 'Inko', body: body || '', link: link || '/', type, groupKey }).catch(() => {});
                return;
            }
        }
        await pool.query(
            'INSERT INTO notifications (user_id, type, title, body, link, actor, image, group_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [userId, type, title || null, body || null, link || null, actor || null, image || null, groupKey || null]
        );
    } catch (e) { /* migration pas encore passée : on ignore */ }
    // Push navigateur — fire-and-forget, n'impacte jamais l'action métier
    sendPush(userId, { title: title || 'Inko', body: body || '', link: link || '/', type, groupKey }).catch(() => {});
}

// Audit AMEL-56 : la table n'avait aucune rétention. 110 lignes pour un compte
// personnel après quelques mois, sans plafond ni ménage — et chaque ouverture
// de la cloche en compte le total. On ne purge que ce qui est LU : une
// notification non lue reste, quel que soit son âge.
const RETENTION_JOURS = 30;
async function purgerNotificationsLues(jours = RETENTION_JOURS) {
    try {
        const [r] = await pool.query(
            'DELETE FROM notifications WHERE is_read = 1 AND created_at < (NOW() - INTERVAL ? DAY)',
            [jours]
        );
        return r.affectedRows || 0;
    } catch (e) { return 0; }
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

module.exports = { createNotification, parseMentions, notifyMentions, purgerNotificationsLues, RETENTION_JOURS };
