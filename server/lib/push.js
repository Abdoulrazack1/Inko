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

// Envoie une notification push à tous les appareils d'un utilisateur.
//
// DEUX transports, un seul point d'appel. Le navigateur (Web Push/VAPID) et
// les téléphones appairés (FCM) sont deux canaux techniques différents pour la
// même notification. Les brancher séparément dans `createNotification`
// signifierait deux endroits à tenir à jour — et le jour où l'un des deux est
// oublié, c'est un canal entier qui se tait sans que rien ne le signale.
async function sendPush(userId, payload) {
    if (!userId) return;
    // Fire-and-forget, comme le web push : une notification qui n'arrive pas
    // ne doit jamais faire échouer l'action qui l'a déclenchée.
    envoyerAuxTelephones(userId, payload).catch(() => {});
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

/**
 * P2.5 — la même notification, vers les téléphones appairés.
 *
 * Sans configuration Firebase, `envoyer()` rend `{ok:false}` et se tait : le
 * hub domestique qui n'a pas de projet Firebase n'a rien à savoir de tout ça.
 */
async function envoyerAuxTelephones(userId, payload) {
    const fcm = require('./push-fcm');
    if (!fcm.configure()) return;

    let jetons;
    try {
        [jetons] = await pool.query(
            'SELECT id, token FROM device_push_tokens WHERE user_id = ?', [userId]);
    } catch (e) { return; }   // migration 21 pas encore passée
    if (!jetons || !jetons.length) return;

    await Promise.all(jetons.map(async (j) => {
        const r = await fcm.envoyer(j.token, {
            titre: (payload && payload.title) || 'Inko',
            corps: (payload && payload.body) || '',
            // Le lien voyage en donnée : c'est lui qui permet d'ouvrir le
            // chapitre concerné plutôt que la page d'accueil, quand on touche
            // la notification.
            donnees: {
                link: (payload && payload.link) || '/',
                type: (payload && payload.type) || 'info',
                groupKey: (payload && payload.groupKey) || '',
            },
        });
        // Un jeton que Google ne reconnaît plus doit être SUPPRIMÉ. Sans ce
        // ménage, la table grossit d'un jeton mort à chaque réinstallation, et
        // chaque notification part vers des adresses qui n'existent plus —
        // exactement ce que fait déjà le web push sur un 404/410.
        if (r && r.invalide) {
            pool.query('DELETE FROM device_push_tokens WHERE id = ?', [j.id]).catch(() => {});
        }
    }));
}

module.exports = { publicKey, sendPush, loadKeys, envoyerAuxTelephones };
