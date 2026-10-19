// ============================================================
// extensions/exemples.js — le contrat, sous forme de valeurs
// ------------------------------------------------------------
// Le contrat d'une extension etait decrit en prose dans
// `lib/source-interface.js`. De la prose ne peut pas etre executee : elle
// derive du code au premier changement, et personne ne s'en apercoit avant
// qu'une extension tierce casse six pages — ce qui est deja arrive.
//
// Ce fichier donne le MEME contrat sous forme de valeurs, et la suite de
// tests les fait passer par le validateur reel (`lib/formes-extensions.js`).
// Si le contrat change, ces exemples echouent : la documentation ne peut plus
// mentir.
//
// Pour qui ecrit une extension : copie l'exemple de la capacite voulue, c'est
// exactement la forme attendue. Les contre-exemples disent ce qui sera refuse,
// et pourquoi.
// ============================================================
'use strict';

/** Une oeuvre, telle qu'elle apparait dans une liste. */
const UNE_OEUVRE = {
    id: 'mon-manga-42',          // identifiant PROPRE a la source
    title: 'Un titre',
    cover: 'https://exemple.test/couverture.jpg',
    // Facultatifs, mais remplis quand la source les fournit : l'application
    // s'en sert pour filtrer et classer.
    tags: ['action', 'aventure'],
    status: 'ongoing',
    description: 'Deux phrases suffisent.',
};

/** Ce que chaque capacite doit rendre. */
const EXEMPLES = {
    // popular / latest / search — « MangasPage »
    liste: {
        results: [UNE_OEUVRE],
        // `total` sert a la pagination. Absent, l'application suppose qu'il
        // n'y a pas de page suivante.
        total: 1,
    },

    // getManga — « Manga »
    fiche: {
        ...UNE_OEUVRE,
        author: 'Quelqu’un',
        year: 2024,
    },

    // getChapters — « ChaptersPage ». Les deux formes ci-dessous sont
    // acceptees ; la premiere est preferable, elle laisse place a `total`.
    chapitres: {
        chapters: [{
            id: 'mon-manga-42-ch-1',
            chapter: 1,              // numero, pas une chaine, quand c'est possible
            title: null,             // null plutot qu'une chaine vide : « pas de titre »
            lang: 'fr',
            publishedAt: '2024-09-07T17:04:15.717Z',   // ISO 8601, ou null
        }],
        total: 1,
    },
    chapitresFormeTableau: [{ id: 'mon-manga-42-ch-1', chapter: 1, lang: 'fr' }],

    // getPages — « PagesPayload », sources de type 'manga'
    pages: {
        pages: [
            { url: 'https://exemple.test/01.png' },
            { url: 'https://exemple.test/02.png', urlSaver: 'https://exemple.test/01-leger.png' },
        ],
    },

    // getText — « TextPayload », sources de type 'novel'
    texte: {
        title: 'Chapitre premier',
        content: '<p>Du HTML assaini, jamais de script.</p>',
    },
};

/**
 * Ce qui sera REFUSE, et la raison. Chaque entree est un piege reellement
 * rencontre, pas une invention : la premiere est celle qui a casse six pages.
 */
const CONTRE_EXEMPLES = [
    {
        forme: 'liste',
        valeur: [UNE_OEUVRE],
        pourquoi: 'un tableau nu — le hub attend { results: [...] }. '
            + 'C’est la divergence qui a cassé le catalogue et envoyé les romans '
            + 'dans le lecteur d’images.',
    },
    {
        forme: 'liste',
        valeur: { items: [UNE_OEUVRE] },
        pourquoi: '« items » au lieu de « results » : proche, et donc d’autant '
            + 'plus facile à écrire sans s’en rendre compte.',
    },
    {
        forme: 'pages',
        valeur: { pages: 'https://exemple.test/01.png' },
        pourquoi: 'une chaîne au lieu d’un tableau : le lecteur afficherait '
            + 'un chapitre vide sans rien dire.',
    },
    {
        forme: 'fiche',
        valeur: { cover: 'https://exemple.test/c.jpg' },
        pourquoi: 'ni « id » ni « title » : une fiche qu’on ne peut ni nommer '
            + 'ni rouvrir.',
    },
    {
        forme: 'texte',
        valeur: { content: null },
        pourquoi: 'un roman sans texte. `null` passe les tests de présence '
            + 'mais pas celui du type.',
    },
];

module.exports = { EXEMPLES, CONTRE_EXEMPLES, UNE_OEUVRE };
