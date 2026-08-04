# Contribuer à Inko

Merci de vouloir aider. Ce document dit comment le projet fonctionne — pas des
règles pour le plaisir, juste ce qu'il faut savoir pour que ta contribution
passe sans aller-retours inutiles.

## Démarrer

```bash
git clone https://github.com/Abdoulrazack1/Inko.git
cd Inko/server && npm install && npm run init-db
cp .env.example .env        # renseigne au moins DB_* et JWT_SECRET
npm start                   # http://localhost:8088
```

Il te faut **MySQL 8** (ou MariaDB) et **Node 18+**. `curl` doit être dans le
PATH : plusieurs extensions et le proxy d'images s'en servent pour contourner
les empreintes TLS anti-bot. Le serveur te prévient au démarrage s'il manque.

## Avant d'ouvrir une PR

```bash
npm run lint                # frontend + service worker
cd server && npm test       # 32 tests ; les tests d'intégration ont besoin de MySQL
```

La CI lance en plus : `npm audit`, un contrôle de syntaxe sur tous les modules
serveur, la vérification que le précache du service worker et les empreintes
d'extensions sont à jour, et un build Docker.

Si tu touches à un asset chargé par une page :

```bash
npm run gen-precache        # met à jour la liste du service worker
```

Si tu ajoutes une page : `npm run gen-meta` (métadonnées de partage).
Si tu modifies une extension : `npm run gen-ext-hashes` — **sans ça, la mise à
jour de cette extension sera rejetée** (vérification d'empreinte fail-closed).

## Ce que le projet attend du code

**Vanilla assumé.** Pas de framework, pas de bundler côté front. Chaque module
est une IIFE qui pose ce qu'il expose sur `window.MH` / `window.API`. Ce n'est
pas une dette à rembourser : c'est un choix, pour qu'un fichier ouvert dans un
éditeur soit lisible sans chaîne d'outils.

**L'échappement passe par `MH.esc`.** Jamais de copie locale : le projet en a eu
quatre, dont trois n'échappaient pas le guillemet double — ce qui a produit une
XSS stockée exploitable. Pour une image, `MH.cover(...)` — il échappe *et* route
par le proxy.

**Pas de catch muet.** `no-empty` est une erreur de lint. Si tu avales
volontairement une exception, dis pourquoi en commentaire — le projet a perdu
des heures sur des `ReferenceError` invisibles avalées par des `catch (e) {}`.

**Les commentaires expliquent le POURQUOI.** Le code dit déjà ce qu'il fait. Les
commentaires utiles ici sont ceux qui expliquent une contrainte non évidente :
pourquoi un timeout à 20 s, pourquoi ce repli, quel bug a motivé ce garde-fou.

**Migrations : on ajoute, on ne modifie jamais.** `server/db/migrate.js` est
versionné. Une migration livrée est figée ; toute évolution est une entrée de
plus. Elles doivent être rejouables sans effet de bord.

## Structure

```
assets/js/       modules front, un par page + global.js partagé
assets/css/      styles, variables de thème dans global.css
server/
  controllers/   logique par domaine
  middleware/    auth, sécurité, erreurs
  lib/           utilitaires (cache borné, mailer, sauvegardes…)
  db/            schéma + migrations versionnées
  extensions/    sources chargées au runtime (gitignorées)
extensions-community/   sources de référence, versionnées + hashes.json
scripts-ci/      outils : précache, empreintes, métadonnées, polices, nettoyage
desktop-tauri/   application desktop (Rust + sidecar Node)
```

## Écrire une extension de source

Le contrat est dans `server/lib/source-interface.js` : un objet avec `id`,
`name`, `version`, `type` (`manga` | `novel` | `book`) et les méthodes
`popular`, `latest`, `search`, `getManga`, `getChapters`, plus `getPages`
(images) ou `getText` (texte).

Regarde `extensions-community/mangadex/` (API propre) ou `weebcentral/`
(scraping cheerio) comme modèles. Prévois un **timeout** et un **réessai** : un
site lent ne doit pas figer un scan de bibliothèque entier.

## Signaler un bug

Dis ce que tu attendais, ce qui s'est passé, et comment le reproduire. Précise
le mode d'exécution (navigateur, desktop, Docker) et la version.

Pour une **faille de sécurité**, n'ouvre pas d'issue publique : voir
[SECURITY.md](SECURITY.md).

## Licence

En contribuant, tu acceptes que ton code soit publié sous [Apache-2.0](LICENSE).
