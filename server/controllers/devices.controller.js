// ============================================================
// devices.controller.js — appairer un téléphone au hub (audit VIII.5.1)
// ------------------------------------------------------------
// Le parcours, en cinq temps :
//
//   1. Sur le PC : « Connecter un appareil » → un code à usage unique, valable
//      2 minutes, affiché en QR.
//   2. Le téléphone scanne, ou saisit le code.
//   3. `POST /api/devices/pair { code, nom, plateforme }` — SANS authentification :
//      c'est le code QUI FAIT foi.
//   4. Le hub vérifie, enregistre l'appareil, et rend un jeton PORTANT UN
//      IDENTIFIANT D'APPAREIL.
//   5. Le PC liste ses appareils, chacun révocable d'un geste.
//
// ── Trois règles, et pourquoi ───────────────────────────────
//
// LE CODE DÉSIGNE UN COMPTE. Treize comptes ont une bibliothèque dans cette
// base. Supposer le propriétaire ferait lire à l'un la bibliothèque de
// l'autre — c'est la correction XVI.1 de l'audit. Le code est donc émis PAR
// un utilisateur authentifié, et porte son identifiant.
//
// LE JETON D'APPAREIL N'EST PAS ADMIN. `localAuth` promeut son propriétaire
// en admin ; cette promotion ne doit pas voyager jusqu'à un téléphone. Un
// appareil appairé lit et écrit SA bibliothèque, rien de plus.
//
// LE CODE EST À USAGE UNIQUE ET COURT. Deux minutes, une seule utilisation,
// et `used_at` plutôt qu'une suppression : un code rejoué doit être
// distinguable d'un code inconnu, sinon on ne peut ni le dire à l'utilisateur
// ni le repérer dans les journaux.
'use strict';

const crypto = require('crypto');
const os = require('os');
const { pool } = require('../config/db');
const { sign } = require('../middleware/auth');

const VALIDITE_MS = 2 * 60 * 1000;
const PLATEFORMES = new Set(['android', 'ios', 'desktop', 'web']);

// Alphabet sans les caractères qu'on confond en lisant un écran : ni O/0, ni
// I/1, ni L. Un code d'appairage se recopie parfois à la main, quand la caméra
// ne veut pas coopérer.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function tirerCode() {
    const octets = crypto.randomBytes(8);
    let s = '';
    for (let i = 0; i < 8; i++) s += ALPHABET[octets[i] % ALPHABET.length];
    return s.slice(0, 4) + '-' + s.slice(4);   // 7F3A-92B1
}

/** Adresses IPv4 du hub sur le réseau local, pour que le QR porte la bonne. */
function adressesLocales() {
    const out = [];
    for (const liste of Object.values(os.networkInterfaces() || {})) {
        for (const i of liste || []) {
            if (i.family === 'IPv4' && !i.internal) out.push(i.address);
        }
    }
    return out;
}

/**
 * POST /api/devices/pair-code
 * Émet un code d'appairage pour le compte connecté.
 */
async function emettreCode(req, res, next) {
    try {
        // Un seul code vivant à la fois par compte : en émettre un nouveau
        // périme le précédent. Sinon un code affiché puis abandonné resterait
        // valable deux minutes de plus que ce que l'utilisateur croit.
        await pool.query(
            'DELETE FROM pair_codes WHERE user_id = ? OR expires_at < NOW()', [req.user.id]);

        const code = tirerCode();
        const expire = new Date(Date.now() + VALIDITE_MS);
        await pool.query(
            'INSERT INTO pair_codes (code, user_id, expires_at) VALUES (?, ?, ?)',
            [code, req.user.id, expire]);

        // Le port réel, pas une constante : le hub peut tourner ailleurs que
        // sur 8088 (PORT, Docker, reverse proxy).
        const port = req.socket?.localPort || process.env.PORT || 8088;
        const adresses = adressesLocales();

        res.json({
            code,
            expiresAt: expire.toISOString(),
            validiteSecondes: Math.round(VALIDITE_MS / 1000),
            // Ce que le QR encode. `hub` est l'adresse que le TÉLÉPHONE devra
            // joindre : jamais 127.0.0.1, qui désignerait le téléphone lui-même.
            qr: JSON.stringify({
                v: 1,
                hub: adresses.length ? `http://${adresses[0]}:${port}` : null,
                code,
            }),
            adresses: adresses.map(a => `http://${a}:${port}`),
        });
    } catch (e) { next(e); }
}

/**
 * POST /api/devices/pair — SANS authentification : le code fait foi.
 * { code, nom, plateforme, appVersion?, empreinte? }
 */
async function appairer(req, res, next) {
    try {
        const brut = String(req.body?.code || '').trim().toUpperCase();
        const code = brut.includes('-') ? brut : (brut.length === 8 ? brut.slice(0, 4) + '-' + brut.slice(4) : brut);
        const nom = String(req.body?.nom || '').trim().slice(0, 64) || 'Appareil sans nom';
        const plateforme = PLATEFORMES.has(req.body?.plateforme) ? req.body.plateforme : 'android';
        if (!code) return res.status(400).json({ error: 'Code d’appairage requis', code: 'CODE_MANQUANT' });

        const [[ligne]] = await pool.query('SELECT * FROM pair_codes WHERE code = ?', [code]);
        if (!ligne) {
            return res.status(404).json({ error: 'Code inconnu — vérifie la saisie, ou demande un nouveau code.', code: 'CODE_INCONNU' });
        }
        if (ligne.used_at) {
            // Distinguer « déjà utilisé » de « inconnu » : le premier se
            // corrige en demandant un nouveau code, le second en retapant.
            return res.status(409).json({ error: 'Ce code a déjà servi. Demande un nouveau code sur l’ordinateur.', code: 'CODE_DEJA_UTILISE' });
        }
        if (new Date(ligne.expires_at).getTime() < Date.now()) {
            return res.status(410).json({ error: 'Ce code a expiré. Demande un nouveau code sur l’ordinateur.', code: 'CODE_EXPIRE' });
        }

        const [[user]] = await pool.query(
            'SELECT id, username, email, avatar, role, token_version FROM users WHERE id = ?', [ligne.user_id]);
        if (!user) return res.status(404).json({ error: 'Le compte associé à ce code n’existe plus.', code: 'COMPTE_ABSENT' });

        const deviceId = crypto.randomUUID();
        const empreinte = String(req.body?.empreinte || crypto.randomBytes(32).toString('hex')).slice(0, 64);

        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();
            // Le code est consommé DANS la transaction : deux téléphones qui
            // scannent le même QR à la seconde près ne doivent pas s'appairer
            // tous les deux.
            const [maj] = await conn.query(
                'UPDATE pair_codes SET used_at = NOW() WHERE code = ? AND used_at IS NULL', [code]);
            if (!maj.affectedRows) {
                await conn.rollback();
                return res.status(409).json({ error: 'Ce code vient d’être utilisé par un autre appareil.', code: 'CODE_DEJA_UTILISE' });
            }
            await conn.query(
                `INSERT INTO devices (id, user_id, nom, plateforme, app_version, empreinte)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [deviceId, user.id, nom, plateforme, String(req.body?.appVersion || '').slice(0, 16) || null, empreinte]);
            await conn.commit();
        } catch (e) {
            try { await conn.rollback(); } catch (e2) { /* connexion perdue */ }
            throw e;
        } finally { conn.release(); }

        // Le jeton porte l'appareil : révoquer l'appareil ferme la session.
        // Et il n'est PAS admin — voir l'en-tête de ce fichier.
        const token = await sign({ ...user, role: 'user' }, req, { deviceId });

        res.status(201).json({
            appaire: true,
            token,
            deviceId,
            user: { id: user.id, username: user.username, avatar: user.avatar },
        });
    } catch (e) { next(e); }
}

/** GET /api/devices — les appareils appairés du compte. */
async function lister(req, res, next) {
    try {
        const [rows] = await pool.query(
            `SELECT d.id, d.nom, d.plateforme, d.app_version, d.created_at, d.last_seen_at, d.revoked_at,
                    (SELECT COUNT(*) FROM sessions s
                      WHERE s.device_id = d.id AND s.revoked_at IS NULL
                        AND (s.expires_at IS NULL OR s.expires_at > NOW())) AS sessionsActives
               FROM devices d
              WHERE d.user_id = ?
              ORDER BY d.revoked_at IS NOT NULL, d.last_seen_at DESC`,
            [req.user.id]);
        res.json(rows);
    } catch (e) { next(e); }
}

/**
 * DELETE /api/devices/:id — révoque un appareil ET ses sessions.
 * C'est le geste « j'ai perdu mon téléphone » : il doit couper l'accès
 * IMMÉDIATEMENT, pas à l'expiration du jeton dans 30 jours.
 */
async function revoquer(req, res, next) {
    try {
        const [[d]] = await pool.query(
            'SELECT id FROM devices WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
        if (!d) return res.status(404).json({ error: 'Appareil introuvable' });

        await pool.query('UPDATE devices SET revoked_at = NOW() WHERE id = ?', [d.id]);
        // `revoked_at` sur la session plutôt qu'une suppression : la liste des
        // sessions doit pouvoir montrer qu'elle a été fermée, et par quoi.
        const [r] = await pool.query(
            'UPDATE sessions SET revoked_at = NOW() WHERE device_id = ? AND revoked_at IS NULL', [d.id]);

        res.json({ revoque: true, sessionsFermees: r.affectedRows || 0 });
    } catch (e) { next(e); }
}

module.exports = { emettreCode, appairer, lister, revoquer };
