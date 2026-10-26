# Extensions communautaires

Ce dossier contient des **extensions de référence** pour Inko.

> ⚠️ **AUCUNE extension de ce dossier n'est chargée automatiquement
> par Inko.** Le loader (`server/extensions/loader.js`) ne scanne QUE
> `server/extensions/`. Pour activer une extension présente ici, tu dois
> la **copier manuellement** vers `server/extensions/<id>/`.

## Pourquoi cette séparation ?

Inko adopte le modèle **Mihon strict** : le framework de base est neutre
et ne distribue aucun accès à du contenu tiers. Les extensions communautaires
sont fournies à titre d'**exemple de syntaxe** uniquement.

Tu en es seul·e responsable :

- Vérifie la **légalité** dans ton pays avant utilisation.
- Vérifie les **CGU** du site source — beaucoup interdisent le scraping.
- Les sites tiers peuvent **changer** ou se faire **fermer** à tout
  moment — l'extension cassera silencieusement.
- Beaucoup de sites utilisent **Cloudflare** ou autres protections
  anti-bot ; l'extension peut être bloquée.

## Installation

```bash
# Exemple : installer l'extension MangaDex
cp -r extensions-community/mangadex server/extensions/

# Puis redémarrer le backend
cd server && npm start
```

L'extension apparaît alors dans `GET /api/sources` et dans la page
**Sources** de l'app.

Pour la désactiver : supprime le dossier `server/extensions/<id>/`.

## Extensions disponibles

| ID | Site | Langue | Status | Note |
|---|---|---|---|---|
| `mangadex` | mangadex.org (API) | multi | ✅ Stable | API officielle, scanlations communautaires |
| `sushiscan` | sushiscan.fr | fr | ⚠️ Expérimental | Scraping HTML, peut casser à tout moment |
| `weebcentral` | weebcentral.com | en | ✅ Stable | Grand catalogue anglais (HTMX) |

## Développer ta propre extension

Voir [`../server/lib/source-interface.js`](../server/lib/source-interface.js)
pour le contrat complet, et [`../server/extensions/README.md`](../server/extensions/README.md)
pour un modèle.

**Les formes de réponse attendues sont données en exemples exécutables** dans
[`../server/extensions/exemples.js`](../server/extensions/exemples.js) : copie
celui de la capacité que tu implémentes, c'est exactement ce que le hub
attend. Le fichier porte aussi des contre-exemples — ce qui sera refusé, et
pourquoi.

Ces exemples ne sont pas de la prose : la suite de tests les fait passer par
le validateur réel (`server/lib/formes-extensions.js`). Si le contrat change,
ils échouent. La documentation ne peut donc pas dériver du code.

## Dépendances optionnelles

Certaines extensions (ex : sushiscan) ont besoin de modules npm
supplémentaires comme `cheerio` ou `node-fetch`. Installe-les dans `server/`
si tu utilises ces extensions :

```bash
cd server
npm install cheerio
```

## Publier une nouvelle version

1. Monte `version` dans l'`index.js` de l'extension.
2. Ajoute dans `changelog.json` une entrée `{ "version", "date", "notes": [...] }`
   qui dit, en phrases simples, ce qui change pour le lecteur. La page Sources
   l'affiche **avant** l'installation ; la CI échoue si elle manque
   (`scripts-ci/verifier-changelog-extensions.js`).
3. Regénère les empreintes : `npm run gen-ext-hashes`. Sans empreinte publiée,
   l'installation est refusée (et le bouton est désactivé dans la page Sources).
