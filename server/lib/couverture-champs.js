// ============================================================
// lib/couverture-champs.js — distinguer « la source ne fournit pas » de
// « l'extension ne le fait pas »
// ------------------------------------------------------------
// Un champ absent se presente toujours pareil : vide a l'ecran, `undefined`
// dans les donnees. Rien ne dit si c'est la SOURCE qui ne publie pas
// l'information, ou l'EXTENSION qui ne l'a pas lue.
//
// Ce n'est pas une distinction theorique. Elle a deja coute : l'extension
// WeebCentral ecrivait `publishedAt: null` EN DUR, alors que la page portait
// 1 192 balises `<time datetime>`. Pendant tout ce temps, les dates de sortie
// n'apparaissaient nulle part, et rien dans l'application ne permettait de
// deviner que c'etait un oubli d'implementation plutot qu'un site avare.
//
// ── Mesurer plutot que declarer ──
//
// On aurait pu demander aux extensions de declarer ce qu'elles ne fournissent
// pas. Une declaration que personne ne remplit ne vaut rien, et celle qui ment
// est pire : c'est exactement ce que faisait le `publishedAt: null` en dur.
//
// On OBSERVE donc ce qui passe. Chaque reponse validee est echantillonnee :
// pour chaque champ connu, combien de fois il etait reellement rempli. Un
// champ jamais rempli sur deux cents resultats est un fait, pas une opinion.
//
// ── Memoire bornee par construction ──
//
// Les cles ne viennent PAS des donnees : ni l'identifiant de source ni le nom
// de champ ne peuvent faire grossir la table au-dela des sources installees
// multipliees par les champs listes ici. C'est deliberе — une table indexee
// par ce qu'une extension rend serait une fuite de memoire offerte.
// ============================================================
'use strict';

// Les champs qu'on surveille, par forme de reponse. Volontairement courts :
// ce sont ceux dont l'absence se VOIT dans l'interface.
const CHAMPS = {
    liste:     ['cover', 'tags', 'status', 'description'],
    fiche:     ['cover', 'tags', 'status', 'description', 'author', 'year'],
    chapitres: ['title', 'publishedAt', 'lang'],
};

// Ou lire les elements a echantillonner selon la forme.
function elementsDe(forme, valeur) {
    if (!valeur) return [];
    if (forme === 'liste') return Array.isArray(valeur.results) ? valeur.results : [];
    if (forme === 'fiche') return [valeur];
    if (forme === 'chapitres') {
        if (Array.isArray(valeur)) return valeur;
        return valeur.chapters || valeur.results || [];
    }
    return [];
}

// sourceId -> forme -> { total, champs: { nom: vus } }
const table = new Map();

/** Un champ compte comme fourni s'il porte une valeur utile. */
function rempli(v) {
    if (v === null || v === undefined || v === '') return false;
    if (Array.isArray(v)) return v.length > 0;
    return true;
}

/**
 * Echantillonne une reponse deja validee. Ne leve jamais : une statistique
 * ne doit pas pouvoir casser une lecture.
 */
function noter(sourceId, forme, valeur) {
    try {
        const champs = CHAMPS[forme];
        if (!champs || !sourceId) return;
        const elements = elementsDe(forme, valeur);
        if (!elements.length) return;
        if (!table.has(sourceId)) table.set(sourceId, {});
        const parForme = table.get(sourceId);
        if (!parForme[forme]) parForme[forme] = { total: 0, champs: {} };
        const e = parForme[forme];
        // On plafonne l'echantillon : au-dela, la proportion ne bouge plus et
        // continuer a compter ne sert qu'a faire grandir des nombres.
        if (e.total > 5000) return;
        for (const el of elements) {
            if (!el || typeof el !== 'object') continue;
            e.total++;
            for (const c of champs) if (rempli(el[c])) e.champs[c] = (e.champs[c] || 0) + 1;
        }
    } catch (err) { /* une statistique ne casse jamais une lecture */ }
}

/**
 * Ce qu'une source n'a JAMAIS fourni, et sur combien d'elements.
 * Rend `null` tant qu'on n'a pas vu assez de choses pour que ce soit un fait :
 * « jamais fourni sur 1 resultat » n'apprend rien.
 */
function rapport(sourceId) {
    const parForme = table.get(sourceId);
    if (!parForme) return null;
    const out = {};
    for (const [forme, e] of Object.entries(parForme)) {
        if (e.total < 10) continue;                       // trop peu pour conclure
        const jamais = CHAMPS[forme].filter(c => !e.champs[c]);
        const parfois = CHAMPS[forme]
            .filter(c => e.champs[c] && e.champs[c] < e.total)
            .map(c => ({ champ: c, sur: e.total, vus: e.champs[c] }));
        if (jamais.length || parfois.length) out[forme] = { vus: e.total, jamais, parfois };
    }
    return Object.keys(out).length ? out : null;
}

function oublier() { table.clear(); }   // tests

module.exports = { noter, rapport, oublier, CHAMPS };
