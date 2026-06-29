// ============================================================
// lib/crypto.js — Chiffrement applicatif au repos (audit S10/DB13)
// ------------------------------------------------------------
// AES-256-GCM, clé dérivée du secret JWT. Utilisé pour les tokens Spotify
// stockés en base. decrypt() tolère le texte clair hérité (migration douce :
// les anciens tokens non chiffrés restent lisibles, réécrits chiffrés au
// prochain refresh).
// ============================================================
const crypto = require('crypto');
const SECRET = require('./secret');

const KEY    = crypto.createHash('sha256').update(String(SECRET)).digest(); // 32 octets
const PREFIX = 'enc:v1:';

function encrypt(plain) {
    if (plain == null) return null;
    const iv  = crypto.randomBytes(12);
    const c   = crypto.createCipheriv('aes-256-gcm', KEY, iv);
    const enc = Buffer.concat([c.update(String(plain), 'utf8'), c.final()]);
    const tag = c.getAuthTag();
    return PREFIX + Buffer.concat([iv, tag, enc]).toString('base64');
}

function decrypt(value) {
    if (value == null) return null;
    if (typeof value !== 'string' || !value.startsWith(PREFIX)) return value; // hérité : texte clair
    try {
        const raw = Buffer.from(value.slice(PREFIX.length), 'base64');
        const iv  = raw.subarray(0, 12);
        const tag = raw.subarray(12, 28);
        const enc = raw.subarray(28);
        const d   = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
        d.setAuthTag(tag);
        return Buffer.concat([d.update(enc), d.final()]).toString('utf8');
    } catch (e) {
        return null; // clé changée → token illisible, l'utilisateur reliera son compte
    }
}

module.exports = { encrypt, decrypt };
