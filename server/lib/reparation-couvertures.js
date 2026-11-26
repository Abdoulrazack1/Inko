// ============================================================
// lib/reparation-couvertures.js — une couverture morte se remplace (COV-01/02)
// ------------------------------------------------------------
// Relevé du 24 novembre : 117 favoris sur 521 avaient une couverture qui ne
// s'affichait plus, presque tous parce qu'un site avait changé — le certificat
// de sushiscan.fr était expiré, le serveur d'images de MangaDex refusait. Le
// dessin de remplacement rendait l'échec propre ; il ne le réparait pas.
//
// L'ordre, du plus fidèle au plus large :
//
//   1. l'adresse enregistrée fonctionne finalement (panne passagère) : on la garde ;
//   2. la SOURCE du favori, redemandée : un site qui a déménagé ou changé ses
//      chemins donne la nouvelle adresse ;
//   3. AniList, par le titre — et seulement si le titre trouvé ressemble
//      vraiment : une couverture d'une AUTRE œuvre serait pire que pas de
//      couverture (le défaut BUG-01 de la bibliothèque, déjà vécu).
//
// Toute adresse retenue a d'abord été téléchargée et reconnue comme image, puis
// elle est ENREGISTRÉE : la recherche n'a lieu qu'une fois par œuvre.
// ============================================================
'use strict';

const BoundedCache = require('./bounded-cache');
const couverture = require('./couverture');

const LOT_MAX = 20;
const SIMULTANES = 3;
const DELAI_SOURCE_MS = Number(process.env.COVER_SOURCE_TIMEOUT_MS || 8000);
// une œuvre introuvable ne sera pas redemandée avant six heures
const sansResultat = new BoundedCache({ max: 4000, ttl: 6 * 3600 * 1000 });

/** Titre réduit à ce qui l'identifie : sans accents, ponctuation ni casse. */
function normaliser(t) {
    return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
        .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ').replace(/[^a-z0-9぀-ヿ一-鿿가-힯]+/g, ' ').trim();
}
/** Le titre trouvé désigne-t-il bien l'œuvre demandée ? Volontairement sévère. */
function titresProches(demande, candidats) {
    const a = normaliser(demande);
    if (a.length < 2) return false;
    return (candidats || []).some((c) => {
        const b = normaliser(c);
        if (!b) return false;
        if (a === b || a.replace(/ /g, '') === b.replace(/ /g, '')) return true;
        // l'un contient l'autre, et presque entièrement (« Akane banashi » / « Akane-banashi VF »)
        const [court, long] = a.length <= b.length ? [a, b] : [b, a];
        return (' ' + long + ' ').includes(' ' + court + ' ') && court.length >= long.length * 0.8;
    });
}

const avecDelai = (p, ms) => {
    let t;
    return Promise.race([p, new Promise((_, rej) => { t = setTimeout(() => rej(new Error('délai dépassé')), ms); })]).finally(() => clearTimeout(t));
};

async function chercherAniList(titre) {
    const axios = require('axios');
    const r = await axios.post('https://graphql.anilist.co', {
        query: 'query ($s: String) { Page(perPage: 5) { media(search: $s, type: MANGA, sort: SEARCH_MATCH) { title { romaji english native } synonyms coverImage { extraLarge large } } } }',
        variables: { s: titre },
    }, { headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, timeout: 8000 });
    return (r.data && r.data.data && r.data.data.Page && r.data.data.Page.media) || [];
}

// Une œuvre MangaDex dit elle-même à quelle fiche AniList ou MyAnimeList elle
// correspond : identification EXACTE, aucun titre à comparer. Le serveur
// d'images de MangaDex peut refuser pendant que son API répond.
async function liensMangaDex(mangaId) {
    if (!/^[0-9a-f-]{36}$/i.test(String(mangaId))) return null;
    const axios = require('axios');
    const r = await axios.get(`https://api.mangadex.org/manga/${mangaId}`, {
        timeout: 8000, headers: { 'User-Agent': 'Inko (+https://github.com/Abdoulrazack1/Inko)' },
    });
    return (r.data && r.data.data && r.data.data.attributes && r.data.data.attributes.links) || null;
}
async function aniListParId({ id, idMal }) {
    const axios = require('axios');
    const r = await axios.post('https://graphql.anilist.co', {
        query: 'query ($id: Int, $idMal: Int) { Media(id: $id, idMal: $idMal, type: MANGA) { coverImage { extraLarge large } } }',
        variables: id ? { id } : { idMal },
    }, { headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, timeout: 8000 });
    return (r.data && r.data.data && r.data.data.Media) || null;
}

/**
 * Cherche une couverture qui fonctionne pour UN favori.
 * @returns {Promise<{url: string, via: 'actuelle'|'source'|'identifiant'|'anilist'}|null>}
 */
async function trouver(favori, { source, verifierImage, aniList = chercherAniList, liens = liensMangaDex, aniListId = aniListParId }) {
    const actuelle = favori.cover || null;
    if (actuelle && await verifierImage(actuelle)) return { url: actuelle, via: 'actuelle' };

    const src = source(favori.source);
    if (src && typeof src.getManga === 'function') {
        try {
            const m = await avecDelai(Promise.resolve(src.getManga(favori.manga_id)), DELAI_SOURCE_MS);
            for (const u of [...new Set([m && m.cover, m && m.coverThumb])]) {
                const sure = couverture.brute(u);
                if (sure && sure !== actuelle && sure.length <= 512 && await verifierImage(sure)) return { url: sure, via: 'source' };
            }
        } catch (e) { /* source muette : on passe au suivant */ }
    }
    if (favori.source === 'mangadex') {
        try {
            const l = await avecDelai(liens(favori.manga_id), DELAI_SOURCE_MS);
            const id = Number(l && l.al), idMal = Number(l && l.mal);
            if (id || idMal) {
                const media = await aniListId(id ? { id } : { idMal });
                const u = couverture.brute((media && media.coverImage && (media.coverImage.extraLarge || media.coverImage.large)) || null);
                if (u && u.length <= 512 && await verifierImage(u)) return { url: u, via: 'identifiant' };
            }
        } catch (e) { /* API MangaDex ou AniList indisponible */ }
    }
    if (favori.title) {
        try {
            for (const media of await aniList(favori.title)) {
                const noms = [media.title && media.title.romaji, media.title && media.title.english, media.title && media.title.native, ...(media.synonyms || [])];
                if (!titresProches(favori.title, noms)) continue;
                const u = couverture.brute((media.coverImage && (media.coverImage.extraLarge || media.coverImage.large)) || null);
                if (u && u.length <= 512 && await verifierImage(u)) return { url: u, via: 'anilist' };
            }
        } catch (e) { /* AniList indisponible */ }
    }
    return null;
}

/**
 * Répare les couvertures de quelques favoris d'un compte.
 * @returns {Promise<{couvertures: Object<string,string>, introuvables: string[]}>}
 */
async function reparer(pool, userId, mangaIds, deps) {
    const ids = [...new Set((mangaIds || []).map(String))].slice(0, LOT_MAX)
        .filter(id => !sansResultat.get(userId + '|' + id));
    if (!ids.length) return { couvertures: {}, introuvables: [] };
    const [lignes] = await pool.query('SELECT manga_id, source, title, cover FROM favorites WHERE user_id = ? AND manga_id IN (?)', [userId, ids]);
    const couvertures = {}, introuvables = [];
    const file = lignes.slice();
    const travailler = async () => {
        while (file.length) {
            const f = file.shift();
            const r = await trouver(f, deps).catch(() => null);
            if (!r) { introuvables.push(f.manga_id); sansResultat.set(userId + '|' + f.manga_id, true); continue; }
            if (r.url !== f.cover) {
                await pool.query('UPDATE favorites SET cover = ? WHERE user_id = ? AND manga_id = ?', [r.url, userId, f.manga_id]);
                couvertures[f.manga_id] = r.url;
            }
        }
    };
    await Promise.all(Array.from({ length: SIMULTANES }, travailler));
    return { couvertures, introuvables };
}

module.exports = { reparer, trouver, titresProches, normaliser, LOT_MAX, _oublier: () => sansResultat.clear && sansResultat.clear() };
