// ============================================================
// lib/couverture.js — une couverture stockée pointe la SOURCE
// ------------------------------------------------------------
// Le proxy `/api/img` s'applique à l'AFFICHAGE, jamais au stockage.
//
// Pourquoi ce module existe : `global.js` enregistrait la couverture d'un
// favori en lisant le `src` de l'image affichée — donc déjà proxifiée, et
// résolue en ABSOLU par le navigateur. La base contenait des valeurs du type
// `http://127.0.0.1:8088/api/img?u=<source>`.
//
// Relevé avant correction : 83 favoris et 3 notifications dans ce cas, dont 67
// en absolu. Deux conséquences :
//   · les couvertures cassent si le port du hub change ;
//   · depuis un autre appareil, `127.0.0.1` désigne CET appareil et non le
//     hub — un téléphone n'afficherait aucune couverture.
//
// Le client est corrigé. Ce module est le filet : il s'applique à l'écriture,
// pour qu'aucun client — ancien, mobile ou tiers — ne puisse réintroduire le
// défaut. Deux appelants : `addFavorite` et `notify`.
'use strict';

const RE_PROXY = /\/api\/img\?u=([^&]+)/;

/**
 * Rend l'URL de la source à partir d'une URL éventuellement proxifiée.
 * Toute autre valeur est rendue telle quelle : ce module normalise, il ne
 * valide pas.
 */
function brute(url) {
    if (!url || typeof url !== 'string') return null;
    const m = RE_PROXY.exec(url);
    if (!m) return url;
    try { return decodeURIComponent(m[1]); } catch (e) { return url; }
}

module.exports = { brute };
