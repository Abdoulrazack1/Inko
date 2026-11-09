'use strict';
// ============================================================
// server/lib/type-image.js — le type d'une image se lit dans ses OCTETS
// ------------------------------------------------------------
// Le proxy `/api/img` décidait du `Content-Type` sur la seule extension de
// l'URL distante, et `curl -s -L` ne regarde pas le code HTTP. Une source
// qui répond « 404 » par une PAGE HTML — c'est le cas de MangaDex —
// donnait donc une réponse 200 étiquetée `image/jpeg` dont le corps
// commence par `<!doctype html>`. Mesuré sur une URL de couverture
// invalide : 200, `image/jpeg`, 160 premiers octets = du HTML.
//
// Deux conséquences, et la seconde est la pire : l'image est cassée chez
// le lecteur, et la page d'erreur est ÉCRITE DANS LE CACHE DISQUE pour la
// durée du TTL. La couverture reste donc cassée longtemps après que la
// source est revenue.
//
// Le raisonnement existait déjà dans ce dépôt — `sniffType` dans
// `local.controller.js`, posé par l'audit SEC-14 : « le type était décidé
// sur la SEULE extension du nom de fichier ». Même erreur, autre porte.
//
// SVG à part : c'est du texte, donc aucun nombre magique ne le distingue
// d'une page d'erreur par ses quatre premiers octets. On exige la balise
// racine, et rien d'autre ne passe.

/** Les signatures, lues sur les premiers octets. */
function typeImage(buf) {
    if (!buf || buf.length < 12) return null;
    const b = buf;

    // JPEG : FF D8 FF
    if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return 'image/jpeg';
    // PNG : 89 'P' 'N' 'G' 0D 0A 1A 0A
    if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47
        && b[4] === 0x0D && b[5] === 0x0A && b[6] === 0x1A && b[7] === 0x0A) return 'image/png';
    // GIF : 'GIF87a' ou 'GIF89a'
    if (b.slice(0, 6).toString('ascii') === 'GIF87a'
        || b.slice(0, 6).toString('ascii') === 'GIF89a') return 'image/gif';
    // WEBP : 'RIFF' ???? 'WEBP' — le conteneur RIFF sert aussi au son, d'où
    // les deux contrôles.
    if (b.slice(0, 4).toString('ascii') === 'RIFF'
        && b.slice(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
    // BMP : 'BM'
    if (b[0] === 0x42 && b[1] === 0x4D) return 'image/bmp';
    // AVIF / HEIC : boîte ISO-BMFF, 'ftyp' en position 4, marque en 8.
    if (b.slice(4, 8).toString('ascii') === 'ftyp') {
        const marque = b.slice(8, 12).toString('ascii');
        if (marque === 'avif' || marque === 'avis') return 'image/avif';
        if (marque.startsWith('hei') || marque.startsWith('mif')) return 'image/heic';
    }
    // SVG : du texte. On accepte la déclaration XML ou la balise racine, et
    // on exige de VOIR `<svg` — une page d'erreur commence par `<!doctype
    // html>` ou `<html`, jamais par ça.
    const tete = b.slice(0, 1024).toString('utf8').replace(/^﻿/, '').trimStart();
    if ((tete.startsWith('<?xml') || tete.startsWith('<!--') || tete.startsWith('<svg'))
        && /<svg[\s>]/i.test(tete)) return 'image/svg+xml';

    return null;
}

/** Un aperçu lisible, pour dire dans un message ce qui est arrivé. */
function apercu(buf) {
    if (!buf || !buf.length) return 'réponse vide';
    const t = buf.slice(0, 48).toString('utf8').replace(/\s+/g, ' ').trim();
    // Imprimable ? Alors c'est probablement une page d'erreur, et la citer
    // vaut mieux que d'annoncer « non-image » sans rien dire.
    // eslint-disable-next-line no-control-regex
    if (/^[\x20-\x7E -￿]+$/.test(t)) return t.slice(0, 40);
    return buf.length + ' octets, binaire inconnu';
}

module.exports = { typeImage, apercu };
