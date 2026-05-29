# Inko Extensions

Ce dossier contient les **extensions de sources** au format Inko.

Chaque sous-dossier = une extension indépendante avec un `index.js`
exportant un objet `Source` (cf [`../lib/source-interface.js`](../lib/source-interface.js)
pour le contrat complet).

## Modèle de référence

```js
// extensions/ma-source/index.js
module.exports = {
    id:          'ma-source',
    name:        'Ma Source',
    lang:        'fr',
    baseUrl:     'https://example.com',
    nsfw:        false,
    version:     '1.0.0',
    description: 'Description courte',
    capabilities: ['popular','search','manga','chapters','pages'],

    async popular({ limit = 20, offset = 0 } = {}) {
        // → { total, results: [Manga, ...] }
    },
    async latest({ limit = 20, offset = 0 } = {}) { /* ... */ },
    async search({ q, limit = 20, offset = 0, filters } = {}) { /* ... */ },
    async getManga(id) { /* ... → Manga */ },
    async getChapters(mangaId, { lang, limit = 100, offset = 0 } = {}) { /* ... */ },
    async getPages(chapterId) { /* ... → { baseUrl, hash, pages: [...] } */ },
};
```

## ⚠️ Légalité

Inko ne fournit **aucune source par défaut**. Chaque extension que tu installes
est **sous ta responsabilité**. Les extensions tierces peuvent accéder à des sites
qui hébergent du contenu sous copyright ; leur usage doit rester strictement
personnel et conforme à la loi de ton pays.

Si tu publies une extension, indique-le clairement dans le README de ton repo.

## Chargement

Au démarrage du serveur, `loader.js` scanne ce dossier et charge tous les
sous-dossiers contenant un `index.js`. Les extensions chargées sont exposées
via `GET /api/sources`.

## Activation utilisateur

Côté client, chaque utilisateur peut activer/désactiver les sources via la
page **Sources** (préférence stockée localement). Les API user-data
(favoris, progression, etc.) restent agnostiques de la source.
