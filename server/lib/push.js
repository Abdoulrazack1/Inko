// ============================================================
// lib/push.js — Notifications Web Push (VAPID)
// ------------------------------------------------------------
// Clés VAPID : depuis l'env (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY) sinon
// générées et persistées dans config/vapid.json (gitignoré). sendPush()
// envoie à tous les abonnements de l'utilisateur et purge les abos morts
// (404/410). Non bloquant : un échec push ne casse jamais l'action métier.
// ============================================================
const fs   = require('fs');
const path = require('path');
const webpush = require('web-push');
const { pool } = require('../config/db');

let keys = null;
function loadKeys() {
    if (keys) return keys;
    if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
        keys = { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
    } else {
        const file = path.join(__dirname, '..', 'config', 'vapid.json');
        try { if (fs.existsSync(file)) keys = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) {}
        if (!keys || !keys.publicKey) {
            keys = webpush.generateVAPIDKeys();
            try { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(keys), { mode: 0o600 }); }
            catch (e) { /* clés en mémoire seulement */ }
        }
    }
    try { webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@inko.app', keys.publicKey, keys.privateKey); }
    catch (e) {}
    return keys;
}

function publicKey() { return loadKeys().publicKey; }

// Envoie une notification push à tous les appareils d'un utilisateur
async function sendPush(userId, payload) {
    if (!userId) return;
    loadKeys();
    let subs;
    try { [subs] = await pool.query('SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?', [userId]); }
    catch (e) { return; }   // table pas encore migrée
    if (!subs || !subs.length) return;
    const body = JSON.stringify(payload || {});
    await Promise.all(subs.map(async s => {
        try {
            await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body);
        } catch (e) {
            if (e.statusCode === 404 || e.statusCode === 410) {
                pool.query('DELETE FROM push_subscriptions WHERE id = ?', [s.id]).catch(() => {});
            }
        }
    }));
}

module.exports = { publicKey, sendPush, loadKeys };
