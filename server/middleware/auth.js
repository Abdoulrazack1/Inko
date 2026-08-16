// middleware/auth.js — vérifie le JWT (cookie ou Authorization: Bearer)
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { pool } = require('../config/db');

const SECRET = require('../lib/secret');   // secret centralisé (audit S12)
const sessions = require('../lib/sessions');  // échéance et purge (audit DB-01)

// Audit SEC-11 : cookie préfixé `inko_token` (les cookies ne sont pas isolés
// par port — un projet voisin sur localhost écrasait un cookie nommé `token`).
// L'ancien nom reste accepté en lecture pour ne pas déconnecter les sessions
// en cours lors de la mise à jour.
function readToken(req) {
    if (req.cookies?.inko_token) return req.cookies.inko_token;
    if (req.cookies?.token) return req.cookies.token;
    const h = req.headers.authorization;
    if (h && h.startsWith('Bearer ')) return h.slice(7);
    return null;
}

async function authRequired(req, res, next) {
    const token = readToken(req);
    if (!token) return res.status(401).json({ error: 'Non authentifié' });
    try {
        const payload = jwt.verify(token, SECRET);
        const [[user]] = await pool.query(
            'SELECT id, username, email, avatar, role, banned, token_version, created_at FROM users WHERE id = ?',
            [payload.uid]
        );
        if (!user) return res.status(401).json({ error: 'Utilisateur inexistant' });
        if (user.banned) return res.status(403).json({ error: 'Compte suspendu', code: 'BANNED' });
        // Audit SEC-05 : les JWT vivent 30 jours et n'étaient JAMAIS révocables.
        // Changer ou réinitialiser son mot de passe ne chassait donc pas
        // l'intrus — exactement ce qu'un « mot de passe oublié » doit faire.
        // token_version est incrémentée à chaque changement de secret : tout
        // jeton émis avant devient invalide.
        const tv = user.token_version || 0;
        if ((payload.tv || 0) !== tv) {
            return res.status(401).json({ error: 'Session expirée — reconnecte-toi', code: 'TOKEN_REVOKED' });
        }
        // Audit AMEL-69 : revocation session par session. Un jeton sans `jti`
        // vient d'AVANT cette migration — on le laisse passer plutot que de
        // deconnecter tout le monde a la mise a jour, il sera remplace a la
        // prochaine connexion. Un jeton AVEC `jti` doit avoir sa ligne :
        // absente = session fermee, donc refus.
        if (payload.jti) {
            // DB-01 : la ligne ne suffit plus. Depuis la migration 18 une
            // session peut être révoquée SANS être supprimée (`revoked_at`,
            // nécessaire pour révoquer un appareil perdu depuis un autre), et
            // porte une échéance. Ne regarder que l'existence de la ligne
            // laisserait donc passer une session explicitement fermée.
            // L'appareil est joint : un téléphone révoqué ne doit pas pouvoir
            // continuer parce qu'une session lui aurait survécu. `revoquer`
            // ferme bien les deux, mais faire dépendre la sécurité d'un seul
            // chemin d'écriture, c'est attendre le jour où un autre chemin
            // apparaît.
            const [[sess]] = await pool.query(
                `SELECT s.id, s.device_id FROM sessions s
                  LEFT JOIN devices d ON d.id = s.device_id
                  WHERE s.id = ? AND s.user_id = ?
                    AND s.revoked_at IS NULL
                    AND (s.expires_at IS NULL OR s.expires_at > NOW())
                    AND (s.device_id IS NULL OR d.revoked_at IS NULL)`,
                [payload.jti, user.id]);
            if (!sess) {
                return res.status(401).json({ error: 'Session fermee — reconnecte-toi', code: 'SESSION_REVOKED' });
            }
            // « Vu la derniere fois » : ecrit au plus une fois par minute.
            // A chaque requete, ce serait une ecriture par appel d'API pour une
            // information qui ne se lit qu'a la minute pres.
            const t = Date.now();
            if (t - (dernierTouch.get(payload.jti) || 0) > 60000) {
                dernierTouch.set(payload.jti, t);
                pool.query('UPDATE sessions SET last_seen_at = NOW() WHERE id = ?', [payload.jti]).catch(() => {});
            }
            req.sessionId = payload.jti;

            // ── VIII.5.1 : un appareil appairé n'est JAMAIS admin ──
            // `localAuth` promeut son propriétaire en admin, et cette
            // promotion suivait le compte jusque dans le jeton du téléphone :
            // vérifié de bout en bout, l'appareil appairé recevait `role:
            // admin`. Passer `role: 'user'` à `sign()` ne changeait rien — le
            // rôle est lu ICI, dans la base, pas dans le jeton.
            //
            // Un téléphone perdu dans la rue ne doit pas donner les écrans
            // d'administration du hub. Il lit et écrit SA bibliothèque, rien
            // de plus.
            if (sess.device_id) {
                req.deviceId = sess.device_id;
                user.role = 'user';
            }
        }
        req.user = user;
        next();
    } catch (e) {
        return res.status(401).json({ error: 'Token invalide ou expiré' });
    }
}

function authOptional(req, _res, next) {
    const token = readToken(req);
    if (!token) return next();
    try {
        const payload = jwt.verify(token, SECRET);
        req.userId = payload.uid;
    } catch (e) { /* ignore */ }
    next();
}

// Cache d'anti-martelage pour `last_seen_at` (audit AMEL-69).
const dernierTouch = new Map();

// `req` optionnel : fourni, la session est enregistree et devient revocable
// individuellement. Omis, on retombe sur l'ancien comportement (jeton sans
// `jti`) — utile pour les jetons de service et la retro-compatibilite.
// `opts.deviceId` : appairage mobile (audit VIII.5.1). Le jeton porte alors
// l'appareil, et la session le référence — révoquer l'appareil ferme la
// session IMMÉDIATEMENT, ce qui est tout l'objet du geste « j'ai perdu mon
// téléphone ». Sans ce lien, la révocation attendrait l'expiration du jeton,
// soit 30 jours.
async function sign(user, req, opts = {}) {
    const payload = {
        // `tv` = token_version : comparée à la valeur en base par authRequired
        // pour permettre la révocation en masse (audit SEC-05).
        uid: user.id, email: user.email, tv: user.token_version || 0,
    };
    if (opts.deviceId) payload.dev = opts.deviceId;
    if (req) {
        payload.jti = crypto.randomUUID();
        // ATTENDU, pas fire-and-forget : une session qui n'est pas encore
        // ecrite n'apparait pas dans la liste, donc ne peut pas etre revoquee.
        // Or le moment ou l'on veut fermer les autres sessions est justement
        // celui qui suit une connexion. Un echec d'ecriture ne doit pas
        // empecher de se connecter : on retombe alors sur un jeton sans `jti`,
        // valide mais non revocable a l'unite — degradation, pas blocage.
        try {
            // DB-01 : `expires_at` accompagne la ligne depuis la migration 18.
            // Sans elle, la session survivait à son propre jeton et rien ne
            // pouvait la purger — la table ne faisait que croître.
            await pool.query(
                'INSERT INTO sessions (id, user_id, user_agent, ip, expires_at, device_id) VALUES (?, ?, ?, ?, ?, ?)',
                [payload.jti, user.id,
                    String(req.headers?.['user-agent'] || '').slice(0, 255) || null,
                    String(req.ip || req.socket?.remoteAddress || '').slice(0, 45) || null,
                    sessions.echeance(),
                    opts.deviceId || null]
            );
        } catch (e) { delete payload.jti; }
    }
    return jwt.sign(payload, SECRET, { expiresIn: process.env.JWT_EXPIRES || '30d' });
}

// Invalide TOUS les jetons émis pour ce compte (changement/réinitialisation de
// mot de passe, suppression de compte). Retourne la nouvelle version.
async function revokeTokens(userId) {
    // Les lignes de session deviennent caduques avec le changement de version :
    // les garder afficherait des sessions mortes dans la liste.
    await pool.query('DELETE FROM sessions WHERE user_id = ?', [userId]).catch(() => {});
    await pool.query('UPDATE users SET token_version = token_version + 1 WHERE id = ?', [userId]);
    const [[row]] = await pool.query('SELECT token_version FROM users WHERE id = ?', [userId]);
    return row ? row.token_version : 0;
}

// ── SEC-01 : le mode local ne sort pas de la machine ─────────
//
// `POST /api/auth/local` résout le compte propriétaire, LE PROMEUT ADMIN, signe
// un jeton et pose le cookie — sans authentification, sans limitation de débit,
// sans aucun filtre. Or le serveur écoute sur toutes les interfaces.
//
// Vérifié pendant l'audit, depuis l'adresse réseau de la machine et non la
// boucle locale :
//
//   $ curl -X POST http://192.168.1.34:8088/api/auth/local -d '{}'
//   {"user":{"username":"Kaito","role":"admin",…},"token":"eyJhbGciOi…"}
//
// Toute personne sur le même Wi-Fi devenait donc administrateur de la
// bibliothèque. Le mode « façon Mihon, sans écran de connexion » est un choix
// produit légitime ; ce qui manquait est le garde qui le rend sûr.
//
// Ce filtre le pose : la connexion automatique n'est possible que depuis la
// machine elle-même. Un appareil du réseau devra passer par un appairage
// explicite (à venir) ou par l'écran de connexion, qui existe toujours.
//
// `INKO_LOCAL_ANY_HOST=1` rouvre le comportement précédent — pour un hub
// volontairement partagé, en connaissance de cause. Ce n'est plus le défaut.
// La définition de « local » vit dans `lib/reseau.js` : le limiteur de relais
// (BUG-13) s'appuie sur la MÊME, et deux copies auraient fini par diverger.
const { estLocale } = require('../lib/reseau');

function localOnly(req, res, next) {
    if (process.env.INKO_LOCAL_ANY_HOST === '1') return next();
    if (estLocale(req)) return next();
    return res.status(403).json({
        error: 'La connexion automatique n’est possible que depuis cet ordinateur.',
        code: 'LOCAL_ONLY',
    });
}

module.exports = { authRequired, authOptional, sign, revokeTokens, localOnly };
