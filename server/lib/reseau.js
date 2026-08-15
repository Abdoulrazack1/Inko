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
    return IP_LOCALES.has(socket) && IP_LOCALES.has(req && req.ip);
}

module.exports = { estLocale, IP_LOCALES };
