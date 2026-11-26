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
 * Une adresse qu'on accepte de CONSERVER (audit SEC-04) : web (`http`,
 * `https`, ou relative), image embarquée (`data:image/…`, `blob:`). Tout autre
 * schéma — `javascript:`, `vbscript:`, `data:text/html` — est refusé : la
 * valeur voyage (export, listes partagées) et finira un jour dans un `href`.
 * Les caractères de contrôle sont retirés avant le test, comme le fait un
 * navigateur : `java\tscript:` en est un.
 */
function adresseSure(url) {
    const v = String(url).replace(/[\u0000- ]+/g, '');
    const schema = /^([a-z][a-z0-9+.-]*):/i.exec(v);
    if (!schema) return true;                                   // relative
    const s = schema[1].toLowerCase();
    return s === 'http' || s === 'https' || s === 'blob' || /^data:image\//i.test(v);
}

/**
 * Rend l'URL de la source à partir d'une URL éventuellement proxifiée, ou
 * `null` si l'adresse ne doit pas être conservée.
 */
function brute(url) {
    if (!url || typeof url !== 'string') return null;
    const m = RE_PROXY.exec(url);
    let source = url;
    if (m) { try { source = decodeURIComponent(m[1]); } catch (e) { source = url; } }
    return adresseSure(source) ? source : null;
}

module.exports = { brute, adresseSure };
