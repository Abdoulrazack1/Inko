// ============================================================
// lib/formes-extensions.js — ce qu'une extension a le droit de rendre
// ------------------------------------------------------------
// Une extension est un fichier JavaScript que l'on peut installer soi-meme :
// le hub l'execute et relaie ce qu'elle rend. Jusqu'ici, il le relayait SANS
// RIEN VERIFIER.
//
// Le cout est deja inscrit dans l'historique de ce depot : « six pages
// cassees par une forme de reponse » — le moteur embarque rendait un objet la
// ou le hub rend un tableau, et le catalogue levait une exception pendant que
// les romans s'ouvraient dans le lecteur d'images.
//
// Ce qui manque alors n'est pas un correctif, c'est une PHRASE. Une exception
// « Cannot read properties of undefined » au fond d'un controleur ne dit ni
// quelle source, ni ce qu'elle a rendu, ni qu'elle est en cause. Un message
// qui nomme les trois transforme une enquete en lecture.
//
// ── Ce que ce module ne fait PAS ──
//
// Il ne corrige pas les formes, il les refuse. Normaliser en silence
// rendrait une extension cassee indistinguable d'une extension correcte, et
// c'est exactement la situation qu'on veut quitter.
//
// Il reste aussi deliberement TOLERANT la ou le code appelant l'est deja :
// les chapitres sont lus tantot comme `{ chapters }`, tantot comme un tableau
// nu. Resserrer ici casserait des sources qui fonctionnent, pour une purete
// dont personne ne beneficie.
// ============================================================
'use strict';

/** Decrit brievement ce qui a ete recu, pour le message d'erreur. */
function decrire(v) {
    if (v === null) return 'null';
    if (v === undefined) return 'undefined';
    if (Array.isArray(v)) return `un tableau de ${v.length} element(s)`;
    if (typeof v !== 'object') return `un ${typeof v}`;
    const cles = Object.keys(v);
    if (!cles.length) return 'un objet vide';
    return `un objet { ${cles.slice(0, 6).join(', ')}${cles.length > 6 ? ', …' : ''} }`;
}

const FORMES = {
    // search / popular / latest — ce que `appliquerExclusions` et les pages
    // de catalogue attendent : `Array.isArray(resultat.results)`.
    liste: (v) => (v && typeof v === 'object' && Array.isArray(v.results))
        ? null : 'un objet { results: [...] }',

    // getPages — le lecteur fait `d.pages || []`, mais un objet sans `pages`
    // donne un chapitre vide sans rien dire.
    pages: (v) => (v && typeof v === 'object' && Array.isArray(v.pages))
        ? null : 'un objet { pages: [...] }',

    // getChapters — les deux formes circulent reellement dans le code
    // appelant. On accepte les deux, et on refuse le reste.
    chapitres: (v) => (Array.isArray(v) || (v && typeof v === 'object'
        && (Array.isArray(v.chapters) || Array.isArray(v.results))))
        ? null : 'un tableau, ou un objet { chapters: [...] }',

    // getOne — une fiche doit au moins porter de quoi l'identifier.
    fiche: (v) => (v && typeof v === 'object' && !Array.isArray(v) && (v.id || v.title))
        ? null : 'un objet portant au moins `id` ou `title`',

    // getText — lecteur de romans.
    texte: (v) => (v && typeof v === 'object' && typeof v.content === 'string')
        ? null : 'un objet { content: "…" }',
};

/**
 * Verifie la forme, ou leve une erreur qui NOMME la source et ce qu'elle a
 * rendu. L'erreur porte `upstream` : `source-health` la compte alors au
 * debit de la source, et non du hub.
 *
 * Une forme inconnue laisse passer : ce module ne doit jamais devenir un
 * obstacle a l'ajout d'une capacite.
 */
function valider(forme, sourceId, valeur) {
    const regle = FORMES[forme];
    if (!regle) return valeur;
    const attendu = regle(valeur);
    if (!attendu) return valeur;
    const e = new Error(
        `la source « ${sourceId} » a rendu une forme inattendue pour ${forme} : `
        + `${decrire(valeur)} au lieu de ${attendu}`);
    e.status = 502;
    e.upstream = sourceId || true;
    throw e;
}

module.exports = { valider, FORMES, decrire };
