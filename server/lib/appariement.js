// ============================================================
// lib/appariement.js — rapprocher une œuvre d'une autre source
// ------------------------------------------------------------
// Trois sources d'Inko ne répondent plus ou plus complètement, et 13 séries en
// dépendent : chireads (9), novelfull (3), novelbin (1). Leur progression,
// leurs notes et leurs signets existent toujours en base — mais l'œuvre est
// devenue inatteignable. Sans migration, une source qui casse est une perte
// sèche ; avec, c'est un déménagement.
//
// Ce module ne fait QUE du calcul : pas de base, pas de réseau, aucune
// dépendance. C'est délibéré — l'appariement est la partie qu'on veut pouvoir
// tester exhaustivement et vérifier à la lecture, parce qu'une erreur ici
// déplace la progression d'un lecteur sur la mauvaise œuvre.
//
// ── Le principe directeur ───────────────────────────────────
// On PROPOSE, on n'applique jamais. Le score est affiché à l'utilisateur, qui
// choisit. Une migration silencieuse vers la mauvaise œuvre serait pire que
// l'absence de migration : elle détruirait la progression sans que personne
// ne comprenne pourquoi.
'use strict';

// ── Titres ──────────────────────────────────────────────────

/** Minuscules, sans accents ni ponctuation ni espaces : « one-piece » = « One Piece ». */
function normaliserTitre(t) {
    return String(t || '')
        .toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '');
}

/** Même normalisation, mais en gardant les mots séparés. */
function mots(t) {
    return String(t || '')
        .toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

/**
 * Proximité d'un titre avec celui recherché. PLUS BAS = MEILLEUR (0 = exact).
 *
 * Reprend l'échelle écrite pour le classement de recherche en 2.5.7, où elle
 * répondait au même besoin : sans elle, l'ordre ne tenait qu'au nombre de
 * sources, et « Solo Apocalypse » passait devant « Solo Leveling ».
 */
function scoreTitre(titre, recherche) {
    const t = mots(titre), q = mots(recherche);
    if (!q) return 9;
    if (t === q) return 0;
    if (normaliserTitre(titre) === normaliserTitre(recherche)) return 1;
    if (t.startsWith(q + ' ')) return 2;
    if (t.startsWith(q)) return 3;
    if (t.includes(' ' + q + ' ') || t.endsWith(' ' + q)) return 4;
    if (t.includes(q)) return 5;
    const termes = q.split(' ').filter(Boolean);
    if (termes.length > 1 && termes.every(x => t.includes(x))) return 6;
    return 7;
}

// ── Numéros de chapitre ─────────────────────────────────────

/**
 * Ramène un numéro de chapitre à un nombre comparable entre deux sources.
 *
 * Les sources ne notent pas pareil : « Chapitre 143 », « 143v2 » (une version
 * rééditée), « 143.5 » (un hors-série), « Ch. 143 - Le duel ». C'est le point
 * délicat de toute migration : reporter par IDENTIFIANT est impossible — les
 * identifiants n'ont aucun rapport d'une source à l'autre — donc on reporte
 * par numéro, et le numéro doit d'abord vouloir dire la même chose des deux
 * côtés.
 *
 * `143v2` devient 143 : une réédition reste le même chapitre. `143.5` reste
 * 143.5 : un hors-série n'est pas le chapitre 143.
 *
 * @returns {number|null} null si aucun numéro n'est lisible — auquel cas le
 *   chapitre ne sera PAS apparié, plutôt que rattaché au hasard.
 */
function normaliserNumero(brut) {
    if (brut == null) return null;
    if (typeof brut === 'number') return Number.isFinite(brut) ? brut : null;
    const s = String(brut);
    // On cherche le premier nombre, décimal éventuel. Le suffixe de version
    // (`v2`, `V3`) est ignoré : il ne fait pas un chapitre différent.
    const m = /(\d+(?:[.,]\d+)?)/.exec(s.replace(/[vV]\d+\b/g, ' '));
    if (!m) return null;
    const n = parseFloat(m[1].replace(',', '.'));
    return Number.isFinite(n) ? n : null;
}

/**
 * Apparie les chapitres LUS d'une source avec ceux d'une autre, par numéro.
 *
 * @param {Array} lus       chapitres lus côté origine : { chapterId, chapter }
 * @param {Array} cibles    chapitres de la source d'arrivée : { id, number|chapter }
 * @returns {{reportes: Array, absents: Array}}
 *   `reportes` : { numero, ancienId, nouvelId }
 *   `absents`  : numéros que la source d'arrivée ne propose pas.
 *
 * Rien n'est inventé : un numéro sans équivalent en face est SIGNALÉ, pas
 * rattaché au chapitre le plus proche. Approcher, ici, c'est se tromper.
 */
function apparierChapitres(lus, cibles) {
    const parNumero = new Map();
    for (const c of cibles || []) {
        const n = normaliserNumero(c.number != null ? c.number : c.chapter);
        if (n == null) continue;
        // Premier arrivé gardé : les sources listent du plus récent au plus
        // ancien, et un doublon de numéro est presque toujours une réédition.
        if (!parNumero.has(n)) parNumero.set(n, c.id != null ? c.id : c.chapterId);
    }

    const reportes = [], absents = [];
    const vus = new Set();
    for (const l of lus || []) {
        const n = normaliserNumero(l.chapter != null ? l.chapter : l.chapterNumber);
        if (n == null) continue;
        if (vus.has(n)) continue;
        vus.add(n);
        if (parNumero.has(n)) {
            reportes.push({ numero: n, ancienId: l.chapterId, nouvelId: parNumero.get(n) });
        } else {
            absents.push(n);
        }
    }
    return { reportes, absents: absents.sort((a, b) => a - b) };
}

// ── Score d'un candidat ─────────────────────────────────────

/**
 * Note un candidat de 0 à 100 — PLUS HAUT = MEILLEUR, à l'inverse de
 * `scoreTitre`. Cette valeur est AFFICHÉE à l'utilisateur, jamais appliquée :
 * elle sert à trier la liste et à signaler les rapprochements douteux.
 *
 * Trois signaux, par ordre de fiabilité décroissante :
 *   · le titre — le seul qui identifie réellement l'œuvre ;
 *   · le nombre de chapitres — une différence énorme trahit une autre série
 *     (ou une source très en retard, ce que l'utilisateur doit voir) ;
 *   · l'année — départage deux adaptations homonymes.
 *
 * Un signal absent ne PÉNALISE pas : beaucoup de sources ne publient ni année
 * ni compte de chapitres, et les punir ferait remonter les sources bavardes
 * plutôt que les bonnes.
 */
function scoreCandidat(candidat, reference) {
    const st = scoreTitre(candidat.titre, reference.titre);
    // 0 → 60 points, 7 → 0. Le titre pèse plus que tout le reste réuni.
    let note = Math.max(0, Math.round((7 - st) / 7 * 60));

    const refCh = Number(reference.chapitres);
    const canCh = Number(candidat.chapitres);
    if (Number.isFinite(refCh) && refCh > 0 && Number.isFinite(canCh) && canCh > 0) {
        // Écart relatif : 0 % → 25 points, 50 % ou plus → 0.
        const ecart = Math.abs(canCh - refCh) / Math.max(refCh, canCh);
        note += Math.round(Math.max(0, 1 - ecart * 2) * 25);
    } else {
        note += 12;   // inconnu : ni bonus ni punition, on reste au milieu
    }

    const refAn = Number(reference.annee), canAn = Number(candidat.annee);
    if (Number.isFinite(refAn) && Number.isFinite(canAn) && refAn > 1900 && canAn > 1900) {
        const d = Math.abs(canAn - refAn);
        note += d === 0 ? 15 : d === 1 ? 10 : d <= 3 ? 5 : 0;
    } else {
        note += 7;
    }

    return Math.max(0, Math.min(100, note));
}

/** Trie des candidats du meilleur au moins bon, score calculé au passage. */
function classer(candidats, reference) {
    return (candidats || [])
        .map(c => ({ ...c, score: scoreCandidat(c, reference) }))
        .sort((a, b) => b.score - a.score || scoreTitre(a.titre, reference.titre) - scoreTitre(b.titre, reference.titre));
}

/**
 * Décompose un titre composite en variantes cherchables.
 *
 * Les sources francophones et chinoises publient couramment le titre sous
 * plusieurs langues à la fois, séparées par une barre :
 *   « Crazy Detective｜狂探 »
 *   « Laissez-moi Jouer en Paix｜Let me game in peace｜我只想安静地打游戏 »
 *
 * Relevé sur les 13 séries orphelines d'Inko : 8 ont un titre de cette forme.
 * Chercher la chaîne ENTIÈRE ne peut rien donner — aucune autre source ne
 * nomme l'œuvre ainsi. C'est exactement le cas qu'il fallait couvrir, puisque
 * ce sont précisément ces séries que la migration existe pour sauver.
 *
 * La variante complète reste en tête : quand le titre n'est PAS composite,
 * c'est la seule, et le comportement ne change pas.
 *
 * @returns {string[]} variantes distinctes, de la plus fidèle à la plus courte
 */
function variantesDeTitre(titre) {
    const brut = String(titre || '').trim();
    if (!brut) return [];
    const morceaux = brut.split(/[|｜/／]/).map(x => x.trim()).filter(x => x.length >= 2);
    const vues = new Set();
    const sortie = [];
    for (const v of [brut, ...morceaux]) {
        // Dédoublonnage sur la chaîne BRUTE, pas sur sa forme normalisée :
        // `normaliserTitre` retire les caractères non latins, donc
        // « Crazy Detective｜狂探 » et « Crazy Detective » y deviennent
        // identiques — alors que ce sont deux requêtes très différentes pour
        // une source. Normaliser ici reviendrait à ne jamais découper le cas
        // le plus fréquent.
        const cle = v.toLowerCase();
        if (vues.has(cle)) continue;
        vues.add(cle);
        sortie.push(v);
    }
    // Les variantes en alphabet latin passent devant. L'appelant plafonne le
    // nombre de requêtes ; sans ce tri, le plafond coupait justement la
    // variante utile. Cas mesuré : « Laissez-moi Jouer en Paix｜Let me game in
    // peace｜我只想安静地打游戏 » — c'est « Let me game in peace » que les
    // sources connaissent, et elle arrivait en troisième position.
    // Le composite complet reste en tête : quand le titre n'est pas composite,
    // rien ne change.
    const latin = (t) => /[a-zA-ZÀ-ÿ]/.test(t);
    return sortie
        .map((v, i) => ({ v, i }))
        .sort((a, b) => (a.i === 0 || b.i === 0 ? a.i - b.i : (latin(b.v) - latin(a.v)) || (a.i - b.i)))
        .map(x => x.v);
}

module.exports = {
    variantesDeTitre,
    normaliserTitre, mots, scoreTitre,
    normaliserNumero, apparierChapitres,
    scoreCandidat, classer,
};
