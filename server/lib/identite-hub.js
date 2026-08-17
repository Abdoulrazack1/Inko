// ============================================================
// identite-hub.js — le hub a une identité, pas seulement une adresse
// ------------------------------------------------------------
// Audit VIII.44 / P2.8.
//
// Le PC reçoit son adresse en DHCP. Au redémarrage de la box, `192.168.1.34`
// devient `192.168.1.52`, et tout appareil qui a mémorisé une IP perd le hub.
// L'appareil ne peut pas non plus vérifier qu'il parle bien AU SIEN : une autre
// machine qui répond sur l'ancienne adresse est indistinguable.
//
// Ce module donne au hub un identifiant stable, tiré une seule fois et rangé
// dans `app_settings`. L'adresse devient ce qu'elle aurait toujours dû être :
// un indice de dernière position connue.
//
// ── Pourquoi c'est un préalable, et pas un complément ───────
//
// L'audit est explicite : « Sans le point 1, le point 2 est dangereux ». Le
// point 2, c'est la découverte automatique par mDNS. Se connecter au premier
// hub trouvé sur le réseau reviendrait à faire confiance à n'importe quelle
// machine qui annonce le bon service — sur un Wi-Fi partagé, ça suffit à
// intercepter une bibliothèque entière et un jeton d'appareil.
//
// L'identité doit donc exister AVANT toute découverte. Elle est ici, la
// découverte viendra ensuite.
//
// ── Ce que cet identifiant n'est pas ────────────────────────
//
// Ce n'est pas un secret. Il circule dans `/api/health`, qui est public, et
// dans le QR d'appairage. Il ne prouve rien à lui seul — il permet seulement à
// un appareil déjà appairé de RECONNAÎTRE le hub auquel il s'est lié, et de
// refuser d'en servir un autre. L'authentification, elle, reste le jeton.
'use strict';

const crypto = require('crypto');
const { pool } = require('../config/db');

const CLE = 'hub_id';

// Mémorisé après la première lecture : cette valeur est demandée à chaque
// appel de `/api/health`, c'est-à-dire au démarrage de chaque appareil et à
// chaque vérification de présence du hub. Elle ne change jamais de la vie de
// l'installation.
let _cache = null;

/**
 * Renvoie l'identifiant du hub, en le créant au premier appel.
 * @returns {Promise<string|null>} null si la base est injoignable — l'absence
 *   d'identité ne doit jamais empêcher le serveur de répondre.
 */
async function hubId() {
    if (_cache) return _cache;
    try {
        const [[row]] = await pool.query('SELECT v FROM app_settings WHERE k = ?', [CLE]);
        if (row && row.v) { _cache = row.v; return _cache; }

        // 16 octets d'aléa cryptographique. Un compteur ou un horodatage
        // seraient devinables, et deux installations faites la même seconde
        // pourraient collider — or deux hubs qui partagent une identité, c'est
        // exactement ce que cette identité doit rendre impossible.
        const neuf = crypto.randomBytes(16).toString('hex');

        // `INSERT IGNORE` puis relecture, et non `INSERT` seul : deux requêtes
        // simultanées au tout premier démarrage écriraient deux identifiants
        // différents, et le second écraserait le premier — après que des
        // appareils aient pu mémoriser celui-ci. On laisse donc le premier
        // écrivain gagner, et on relit ce qui est réellement en base.
        await pool.query('INSERT IGNORE INTO app_settings (k, v) VALUES (?, ?)', [CLE, neuf]);
        const [[apres]] = await pool.query('SELECT v FROM app_settings WHERE k = ?', [CLE]);
        _cache = (apres && apres.v) || null;
        return _cache;
    } catch (e) {
        // Base injoignable : `/api/health` doit précisément pouvoir le DIRE.
        return null;
    }
}

// Pour les tests : l'identité est mémorisée pour la vie du processus.
function _viderCache() { _cache = null; }

module.exports = { hubId, _viderCache, CLE };
