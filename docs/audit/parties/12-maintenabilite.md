## 13. Maintenabilité et architecture

> L'application est écrite **sans système de modules ni étape de build** : des IIFE partageant `window.MH`. C'est un choix défendable (zéro outillage, lisible, déployable en copiant des fichiers) qui a **tenu jusqu'à 115 000 lignes de JS**. Il atteint maintenant sa limite : les fichiers grossissent, l'ordre de chargement est implicite, et rien n'empêche de casser un module en en touchant un autre.

### Les chiffres

| | Valeur |
|---|---|
| Fichiers de l'application (hors dépendances, copies de build, sondes) | 26 pages HTML · 64 JS · 26 CSS |
| JavaScript applicatif | **{{mesure:perf-statique.js_applicatif_ko}} Ko** |
| CSS | 436 Ko, 2 791 règles |
| Fichiers JS > 900 lignes | `global.js` **3 790** · `chapitre.js` **2 912** · `serie.js` 1 920 · `bibliotheque.js` 1 816 · `profil.js` 1 576 · `catalogue.js` 1 397 · `api.js` 1 250 · `parametres.js` 1 180 · `lecture.js` 1 091 · serveur : `user.controller.js` **1 831** · `migrate.js` 1 049 |
| Fonctions de plus de 140 lignes | 15 — la plus longue : `auditerMode()` 284 (test), `fin()` 260 (`serie.js:980`), `titreDeSecours()` 233 (`global.js:2253`), `set()` 194 (`profil.js:1029`), `repondre()` 180 (`hub.js:171`) |
| Fonctions exposées sur `MH` | 94 dont 6 jamais appelées ailleurs |

### ARC-01 🟠 `global.js` (3 790 lignes) est un module-dieu · effort XL

Il contient, sans lien entre eux : le formatage (`chiffre`, `date`, `relTime`), la gestion d'erreurs (`err`, `messageErreur`, `toastErreur`, `poserEtatErreur`), le **mode incognito**, les **types de sources** (`isNovelSource`, `readerHref`), l'**interface de retour** (`toast`, `bandeau`, `confirm`, `annuler`, `piegerFocus`, `squelette`, `poserEtatVide`), le **NSFW**, les **favoris** (`getFavSet`, `setFavButtonState`), **deux fonctions de mises à jour** (`checkUpdates` : chapitres ; `appUpdates` : l'application), les **notifications** (`notifItemHTML`, `enablePush`), les **raccourcis** et la palette de commandes, la **visite guidée**, et `initPage`.

Il est chargé **par les 26 pages** (≈ 170 Ko avant compression). Toute page paie le coût du mode incognito, de la palette de commandes et de la visite guidée, même quand elle n'en a pas l'usage.

**Découpe proposée** (par ordre de rentabilité) :

| Nouveau module | Contenu | Chargé par |
|---|---|---|
| `core/format.js` | `chiffre`, `classeChiffre`, `date`, `relTime`, `fullDate`, `chapNum`, `locale` | toutes |
| `core/erreurs.js` | `err`, `messageErreur`, `champErreur`, `toastErreur`, `poserEtatErreur`, `serverIsDown` | toutes |
| `ui/retour.js` | `toast`, `bandeau`, `confirm`, `annuler`, `piegerFocus`, `announce` | toutes |
| `ui/etats.js` | `squelette`, `etatVide`, `poserEtatVide`, `contenuPret` | pages à contenu |
| `lib/sources.js` | `loadSourceTypes`, `isNovelSource`, `unitLabel`, `readerHref`, sources désactivées | toutes |
| `lib/favoris.js` | `getFavSet`, `setFavButtonState`, `markFavorites`, `heartIcon` | catalogue, recherche, bibliothèque, série |
| `lib/incognito.js` | `isIncognito`, `toggleSeriePrivee`, bandeau | **à la demande** |
| `lib/maj.js` | `checkUpdates` (chapitres) — **renommé** `verifierChapitres` | bibliothèque, accueil |
| `app/mise-a-jour.js` | `appUpdates`, `_maybeShowUpdateBar` | **desktop seulement** |
| `app/notifications.js` | `notifItemHTML`, `enablePush` | notifications, paramètres |
| `app/clavier.js` | raccourcis, palette de commandes, `reserverTouches` | **à la demande** (première touche) |
| `app/visite.js` | `startTour` | **à la demande** (première visite) |

L'ordre de chargement devient explicite : chaque module déclare ce qu'il fournit et ce dont il dépend (`MH.definir('ui/retour', ['core/format'], fn)`), un test vérifie le graphe. **Sans changer de paradigme** — la migration vers des modules ES natifs est possible ensuite, module par module, **après** PER-01 (le bundler absorbe le coût).

### ARC-02 🟠 `chapitre.js` (2 912 lignes) : le lecteur · effort XL

Modes page/défilement/double, zoom, gestes, clavier, curseur, préchargement, reprise, commentaires, téléchargement, traduction… **Découpe** : `lecteur/rendu.js`, `lecteur/modes.js`, `lecteur/entrees.js` (clavier + gestes + souris), `lecteur/prechargement.js`, `lecteur/reprise.js`, `lecteur/annexes.js` (commentaires, notes). Le lecteur est **le cœur du produit** : c'est le module qui doit avoir les tests de comportement les plus fournis (TST-01).

### ARC-03 🟡 Les gros contrôleurs et le schéma · effort L

`user.controller.js` (1 831 lignes, **47 écritures SQL**, **27 requêtes dans des boucles** au total côté serveur) → un fichier par domaine (`favoris`, `progression`, `listes`, `notes`, `evenements`, `import-export`, `commentaires`) ; `migrate.js` (1 049) → `migrations/NNNN-*.js` (DAT-12). La couche d'accès aux données (`INSERT … ON DUPLICATE KEY`) se répète : un dépôt `favorisDepot.js` testable seul.

### ARC-04 🟡 Un dossier public explicite · effort M

Le dépôt est **à la fois** le code source et le site servi (`FRONTEND_DIR` = racine). C'est la cause de SEC-02. **Cible** : `public/` (pages, `assets/`, manifest, service worker) ; la racine ne garde que la configuration. Le build web (PER-01) produit `dist/` ; les builds Android et Tauri consomment `dist/` plutôt que de copier des arbres différents (`mobile/www`, `desktop-tauri/src-tauri/resources/frontend`, `android/.../public` : **trois copies** du même front, aujourd'hui régénérées par des scripts distincts).

### ARC-05 🟡 Pas de typage · effort L

Aucun TypeScript, aucun JSDoc de types. Les contrats les plus fragiles — la **forme des réponses des extensions** (« trois formes selon l'endroit : tableau nu, `{ results }`, `{ chapters }` »), le **modèle d'un favori**, l'**objet `job` de scan** — vivent dans la tête. **Correctif à coût minimal** : `// @ts-check` + JSDoc `@typedef` sur `api.js`, `extensions/loader.js`, `bac-a-sable.js`, `updates.js`, et `tsc --noEmit` en CI (sans réécrire).

### ARC-06 🟡 État global implicite sur `window` · effort M

`window.MH`, `window.API`, `window.Storage`, `window.UserData`, `window.Theme`, `window.Downloads`, `window.Music`… Une page qui dépend d'un global **non encore défini** échoue en silence (`window.MH?.err?.(…)` partout). Le garde `MH.err` est bien pensé mais **masque** des erreurs d'ordre de chargement. **Correctif** : ARC-01 (dépendances déclarées) + ESLint `no-undef` strict + un test qui charge chaque page en jsdom et **échoue si un global manque**.

### ARC-07 🔵 Code mort · effort S

6 fonctions `MH.*` jamais appelées (`statusBadge`, `mesuresContenu`, `finSquelette`, `reserverTouches`, `canInstall`, `pwaInstall`) ; ≈ 370 classes CSS jamais référencées (PER-06) ; `server/db/init.js` ; 8 fichiers résiduels à la racine (`pivot-ltr.png`, `pivot-rtl.png`, `signet-biblio.png`, `RELEASE_TITLE.txt`, `RELEASE_NOTES.md`, `audit.md`, `reponse-lilian.md`, `test-results/`) ; **3 documents d'audit empilés** (`AUDIT-INKO-2026-07-28.md`, `AUDIT-QA-2026-08-12.md`, `audit.md`) alors que celui-ci devient la référence. **À faire** : archiver les anciens dans `docs/audit/archives/`, ignorer `test-results/`.

### ARC-08 🔵 Blocs de code répétés · effort S

La sonde trouve peu de duplication dans le code applicatif (la discipline de factorisation est bonne) ; les doublons sont **dans les tests** (5 fichiers répétant le même bloc d'initialisation : `double-auto-format.test.js`, `echap.spec.js`). Extraire dans `test/helpers`.

### ARC-09 🔵 Les commentaires : un atout qui devient un coût · effort S

Le code est **abondamment commenté, souvent magnifiquement** : chaque correctif raconte son incident (« Le 9 novembre, le serveur a répondu 200 avec zéro favori… »). C'est rare et précieux. Mais ces récits **pèsent** dans les fichiers servis (≈ 25–30 % d'octets de commentaires), et **vieillissent** (« Audit B3 », « BUG-13 » renvoient à des documents archivés). **Correctif** : conserver les récits dans le source, **retirer les commentaires au build** (esbuild le fait) ; relier chaque référence d'audit à `docs/audit/archives/` ou, mieux, au numéro d'issue.

### ARC-10 🟡 Une page interne (« Système de style ») est proposée à tous les utilisateurs · effort S

`systeme.html` — le catalogue des **jetons et composants de design**, outil de développement — est **lié dans le pied de page de toutes les pages** (`global.js:2385`), **précaché** par le service worker et embarqué dans l'APK et l'installeur. Pour un utilisateur c'est un écran incompréhensible (« aplats », « .sy-aplat ») ; pour l'audit c'est la page qui concentre **15 échecs de contraste**, 27 chaînes sans traduction anglaise et 850 nœuds DOM, **sans servir à personne**. **Correctif** : ne la lier et ne la livrer qu'en développement (`?dev` ou `NODE_ENV !== 'production'`), la sortir du précache et des builds mobile/bureau ; ou la déplacer sous `outils/`. Elle reste utile : c'est la référence pour A11Y-01 (tester le contraste de chaque jeton).

### Ce qui est bien et à conserver

Pas de dépendance front (hors vendors ciblés) · discipline de factorisation (peu de doublons) · échelles de design testées · garde-fous de build · **chaque correctif documenté avec son incident** · convention de noms cohérente (français, verbes d'action) · découpage serveur par domaine (`controllers/`, `lib/`, `middleware/`).
