// ============================================================
// lib/reseau.js — « cette requête vient-elle de la machine ? »
// ------------------------------------------------------------
// Deux décisions dépendent de cette question, et elles doivent y répondre
// PAREIL :
//
//   · SEC-01 — `POST /api/auth/local` rend un jeton admin sans mot de passe.
//     Il ne doit pas franchir la machine.
//   · BUG-13 — les limiteurs de relais protègent contre un hub exposé qui
//     servirait d'amplificateur vers les sites scrapés. Ce risque suppose un
//     client DISTANT ; l'application installée mérite un plafond plus haut.
//
// Deux définitions dans deux fichiers auraient fini par diverger — et la
// divergence se serait vue du mauvais côté : un `estLocale` plus permissif
// dans `auth.js` ouvre une porte, un plus strict dans `security.js` bride
// l'app. D'où ce point unique.
'use strict';

const IP_LOCALES = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1', 'localhost']);

/**
 * Les DEUX adresses doivent être locales. Chacune seule laisse un trou :
 *
 *   · `req.ip` seul — avec `TRUST_PROXY` posé, express fait confiance à
 *     `X-Forwarded-For`, que l'appelant écrit lui-même. `XFF: 127.0.0.1`
 *     depuis n'importe où et le filtre s'ouvre.
 *   · la socket seule — derrière un reverse proxy tournant sur la même
 *     machine, `remoteAddress` vaut TOUJOURS 127.0.0.1, quel que soit le
 *     client réel. Le filtre ne filtre alors plus rien.
 *
 * L'intersection ferme les deux : un client distant échoue sur la socket
 * (attaque directe) ou sur `req.ip` (derrière un proxy), et une connexion
 * vraiment locale satisfait les deux.
 */
function estLocale(req) {
    const socket = (req && req.socket && req.socket.remoteAddress) || '';
    if (estRelayee(req)) return false;
    return IP_LOCALES.has(socket) && IP_LOCALES.has(req && req.ip);
}

/**
 * SEC-30 — un relais INSTALLÉ SUR LA MACHINE (Caddy, nginx, tunnel) se connecte
 * depuis la boucle locale. Sans `TRUST_PROXY`, `req.ip` vaut alors 127.0.0.1
 * lui aussi : les deux adresses étaient locales, et la connexion automatique
 * rendait un jeton administrateur à n'importe quel client du relais. Rejoué :
 * 403 en direct, 200 + rôle admin à travers un relais local.
 *
 * Un relais s'annonce par ses en-têtes. Sans `TRUST_PROXY` pour dire qui croire,
 * une requête qui en porte n'est pas locale. Avec `TRUST_PROXY`, `req.ip` est
 * déjà l'adresse du client réel, et c'est elle qui décide.
 */
function estRelayee(req) {
    if (process.env.TRUST_PROXY) return false;
    const h = (req && req.headers) || {};
    return !!(h['x-forwarded-for'] || h.forwarded || h['x-real-ip'] || h['x-forwarded-host']);
}

/**
 * SEC-31 — le nom d'hôte demandé. Une page d'un autre site dont le domaine est
 * redirigé vers 127.0.0.1 (« DNS rebinding ») devient la même origine que le
 * serveur ; il répondait à n'importe quel nom. Seuls sont admis : une adresse
 * IP écrite telle quelle, `localhost` et ses sous-domaines, le nom de la
 * machine (et sa forme `.local`), et ce qui est déclaré dans `INKO_HOTES`,
 * `CORS_ORIGINS` ou `APP_URL`.
 */
function hoteAdmis(hote) {
    const nom = String(hote || '').toLowerCase().replace(/:\d+$/, '').replace(/^\[|\]$/g, '');
    if (!nom) return true;                                   // HTTP/1.0 sans Host : rien à usurper
    if (require('net').isIP(nom)) return true;
    if (nom === 'localhost' || nom.endsWith('.localhost')) return true;
    const machine = require('os').hostname().toLowerCase();
    if (nom === machine || nom === machine + '.local') return true;
    const declares = [process.env.INKO_HOTES, process.env.CORS_ORIGINS, process.env.APP_URL]
        .join(',').split(',').map(s => s.trim()).filter(Boolean)
        .map(s => { try { return new URL(/^[a-z]+:\/\//i.test(s) ? s : 'http://' + s).hostname.toLowerCase(); } catch (e) { return ''; } });
    return declares.includes(nom);
}

module.exports = { estLocale, estRelayee, hoteAdmis, IP_LOCALES };
