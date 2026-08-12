# Dette technique — état mesuré et plan d'attaque

*Relevé du 10 août 2026, sur la 2.5.7. Tous les chiffres viennent du dépôt,
pas d'une impression.*

---

## 1. Ce qui va bien — et qu'il ne faut pas « améliorer »

| Signal | Valeur |
|---|---|
| Vulnérabilités npm (racine + serveur, prod) | **0** |
| `TODO` / `FIXME` / `HACK` hors vendor | **0** |
| Erreurs ESLint | **0** dans le dépôt (1 dans `tools/`, gitignoré) |
| Avertissements ESLint | 8, tous `no-unused-vars` |
| Dépendances serveur en production | 15, toutes utilisées |
| CI | 5 jobs verts, contrôles dérivés (API, précache, empreintes) |

**La dette d'Inko n'est pas de la pourriture, c'est de la structure.** Le code
est propre, commenté, sans rustines déclarées. Ce qui coûte, c'est *où* le code
est rangé. Cette distinction change la méthode : il n'y a rien à nettoyer, il y
a des responsabilités à séparer.

---

## 2. La dette réelle, classée par coût

Le classement suit **(nombre de modifications sur 6 mois × taille)**, pas
l'esthétique. Un fichier laid qu'on ne touche jamais ne coûte rien ; un fichier
correct qu'on modifie chaque semaine coûte à chaque fois.

### A. `assets/js/global.js` — 1 998 lignes, 73 modifications

Le point chaud n°1, et de loin (score 146 000, le double du suivant). Il est
chargé par **toutes les pages** et contient au moins huit sujets sans rapport :

unité d'affichage (chapitre/tome) · sources désactivées · contenu adulte ·
vérification des nouveaux chapitres · ajout à une liste depuis une carte ·
reprise de lecture récente · barre de titre de l'app desktop · gestion des
favoris.

Conséquence concrète : toucher au filtre adulte fait rejouer, sur les 20 pages
du site, du code qui gère aussi la barre de titre desktop. Le risque de
régression n'est pas proportionnel au changement.

### B. `server/controllers/user.controller.js` — 1 530 lignes, 34 modifications

Même schéma côté serveur : progression, historique, listes intelligentes,
favoris, réglages, notifications dans un seul contrôleur.

### C. Les pages monolithiques — 5 fichiers de 1 100 à 1 660 lignes

`serie.js` (1 658, 44 modifs) · `chapitre.js` (1 611, 34) · `profil.js` (1 188,
29) · `catalogue.js` (1 111, 28) · `bibliotheque.js` (1 106, 33).

Un IIFE par page, qui fait tout : requêtes, rendu, état, URL, raccourcis
clavier. C'est tenable tant qu'on n'y touche pas beaucoup — or on y touche
beaucoup.

### D. Infrastructure recopiée dans les extensions — 378 lignes, 12 %

Douze fonctions portent le même nom dans 3 à 6 extensions : `fetchHtml`,
`curlGet`, `curlGetOnce`, `isTransient`, `friendlyHttpError`, `getC`/`setC`,
`requireCheerio`, `sanitizeChapterHtml`, `parseChapterDate`…

Ce n'est pas théorique : **EXT-04 (absence de réessai) a dû être corrigé source
par source**, et l'audit note que 7 sources sur 9 étaient concernées. Le
prochain correctif d'infrastructure coûtera le même prix.

⚠️ **Contrainte à traiter en premier** : le contrôle d'intégrité SEC-08 compare
l'empreinte SHA-256 de chaque `index.js`, le chargeur amorce
`server/extensions/` en copiant des `index.js` autonomes, et le bundle desktop
embarque `extensions-community/`. Un socle partagé doit s'insérer dans ces trois
mécanismes — c'est le vrai travail, pas l'extraction elle-même.

### E. Couverture de tests inégale

- **Serveur** : 20 modules sur 29 apparaissent dans les tests. Les 9 absents :
  `admin`, `anilist`, `artwork`, `extensions`, **`image`**, `local`, `manga`,
  `update`, `lib/source-health`.
  `image.controller` est le proxy — celui qui décide quels hôtes sont
  autorisés. C'est le module non testé le plus sensible, et il vient d'être en
  cause deux fois (PERF-08, puis le CDN WeebCentral en 2.5.6).
- **Front** : 10 fichiers sur 36 sont touchés par un test unitaire.

### F. Pas d'assemblage — 10 à 12 `<script>` par page

Choix assumé (aucun build à installer pour contribuer), mais c'est **la cause
racine de A** : sans modules, tout ce qui est partagé finit dans `global.js`,
et l'ordre des balises devient un contrat implicite.

---

## 3. Méthode proposée

Trois règles, à tenir sur tous les lots :

1. **Ne pas refactorer ce qui ne bouge pas.** Le classement ci-dessus est le
   seul ordre défendable. Un « grand nettoyage » uniforme dépenserait le plus
   d'effort là où il rapporte le moins.
2. **Le filet avant la découpe.** Aucune extraction sans un test qui échoue si
   le comportement observable change. Sans ça, on ne refactore pas : on déplace
   des bugs, et on les découvre chez l'utilisateur. Cette session en a donné
   quatre exemples en une nuit.
3. **Par lots livrables.** Chaque lot passe la CI, se release seul, et laisse
   l'app fonctionnelle. Jamais de branche de refonte longue.

### Séquence

| # | Lot | Pourquoi ici | Fini quand |
|---|---|---|---|
| 0 | **Tests de caractérisation** sur `global.js` et `user.controller.js` | Sans filet, les lots 1 et 3 sont des paris | Le comportement observable des 8 sujets de `global.js` est figé par des tests |
| 1 | **Découper `global.js`** en 8 modules, `window.MH` conservé comme façade | Point chaud n°1 ; aucune page à modifier | `global.js` < 400 lignes, aucun changement dans les HTML |
| 2 | **Couvrir `image.controller`** et les 8 autres modules serveur | Le moins testé × le plus sensible ; indépendant, donc parallélisable | Les 29 modules serveur ont au moins un test de comportement |
| 3 | **Socle d'extensions** `_lib/` + adaptation de SEC-08 / chargeur / bundle | 378 lignes × 6 sources ; mais dépend d'une décision d'architecture | Un correctif d'infrastructure se fait en un seul endroit |
| 4 | **Éclater `user.controller.js`** en 4–5 contrôleurs par domaine | Point chaud n°2, une fois le filet posé | Aucun contrôleur > 500 lignes |
| 5 | **Pages monolithiques**, une à la fois, en commençant par `serie.js` | Le plus gros volume, le moins urgent | Seulement si on continue d'y toucher |

### Ce qu'on ne fait pas

- **Introduire un bundler.** Ça réglerait F, mais au prix du « pas de build »
  qui rend le projet contribuable. À rediscuter *après* le lot 1 : si la façade
  `MH` tient, le besoin disparaît.
- **Toucher aux 8 `no-unused-vars`.** Bruit, pas dette.
- **Refactorer les extensions individuellement.** Le gain est dans le socle
  commun (lot 3), pas dans le nettoyage source par source.

---

## 4. Question ouverte avant de commencer

Le lot 3 (socle d'extensions) est le seul qui demande une **décision
d'architecture** plutôt qu'un travail mécanique : faut-il

- **(a)** un `_lib/` chargé par le loader et exclu du contrôle d'empreintes,
- **(b)** un socle injecté dans chaque extension à l'amorçage (les `index.js`
  restent autonomes, SEC-08 inchangé),
- **(c)** garder la duplication et se contenter d'un test qui vérifie que les
  copies restent identiques ?

(c) est le moins ambitieux et le plus honnête si l'on veut préserver le modèle
« une extension = un fichier ». À trancher avant d'écrire une ligne du lot 3.

---

# Feuille de route — prochaine version (2.6.0)

*Chaque ligne est soit **vérifiée** (reproduite ici, avec la mesure), soit
**signalée** (rapportée mais pas encore reproduite), soit **reportée** de
l'audit du 28 juillet. La distinction est maintenue : une liste où tout se
vaut ne se priorise pas.*

## A. Corrections — défauts vérifiés

| # | Défaut | Preuve | Effort |
|---|---|---|---|
| C1 | **`novelbin` est hors service** : 0 résultat | `check-sources` : « balisage ou URL du site probablement changés ». **L'alarme hebdomadaire est rouge depuis le 20 juillet — 4 fois de suite** | M |
| C2 | **`gutenberg-fr` ne rend aucun titre populaire** (la recherche, elle, répond) | `popular?limit=3` → 0 résultat | M |
| C3 | **`chireads` : des titres, aucun chapitre** | 3 titres, `chapters` du premier → 0 | M |
| C4 | **`weebcentral` ignore `limit`** | `popular?limit=3` → **32** résultats. Toute pagination bâtie dessus est fausse | S |
| C5 | **Lecteur page par page** : la 1re flèche droite reste sans effet, `data-idx` n'est pas mis à jour au changement de planche | Mesuré sur MangaDex, 32 pages | S |
| C6 | **`gen-precache` salit `service-worker.js`** à chaque exécution sous Windows (LF réécrit sur du CRLF) | `git status` non vide après un `npm run gen-precache` sans changement | S |
| C7 | **`CACHE_VERSION` ne dépend que du numéro de version**, pas du contenu des assets : deux builds d'une même version servent le même cache | Empreinte `ce7c71` inchangée de 2.5.0 à 2.5.7 malgré des assets modifiés | S |

## B. Sécurité — à traiter en premier

| # | Défaut | Pourquoi ça compte | Effort |
|---|---|---|---|
| **S1** | **Toute installation desktop partage le même secret JWT littéral** `inko-dev-secret-change-me` (`server/lib/secret.js`) | Le repli est prévu pour le développement, mais le desktop n'est pas du développement : en **mode hub** (AMEL-93) le serveur répond à d'autres appareils du foyer. Qui atteint le port forge un jeton pour n'importe quel compte. **Correctif : générer un secret aléatoire par installation au premier démarrage**, à côté de `db-credentials.json` qui fait déjà exactement ça | S |
| S2 | **Sauvegardes en clair par défaut** : email + bibliothèque de tous les comptes | `BACKUP_PASSPHRASE` vide = dumps lisibles. Le chiffrement AES-256-GCM existe déjà, il n'est simplement pas activé. Même correctif que S1 : passphrase générée à l'installation | S |
| S3 | AMEL-67 — **bac à sable des extensions** | Une extension = du JS avec les pleins pouvoirs de Node. SEC-08 vérifie l'*intégrité*, pas les *droits* | L |

## C. Améliorations

| # | Sujet | État | Effort |
|---|---|---|---|
| A1 | **Interface d'administration** | **Jamais traitée** : exclue de bout en bout de la remédiation de l'audit | L |
| A2 | Recherche : `sololeveling` collé ne trouve rien | Ni le moteur du site ni l'index de secours ne rapprochent la forme sans espace | S |
| A3 | AMEL-85 / 87 — catalogue de clés i18n, puis ES et DE | La clé est le texte français exact : toute reformulation casse la traduction en silence | L |
| A4 | AMEL-84 — mode « une main » sur mobile | 781 cibles sous 44 px | M |
| A5 | AMEL-92 / 117 — builds macOS et Linux, image Docker arm64 | Volontairement gelés (« Windows seulement pour l'instant ») | L |

## D. Nouvelles fonctionnalités — reportées de l'audit

| # | Sujet | Effort |
|---|---|---|
| F1 | AMEL-76 — import depuis Mihon / Tachiyomi / MangaDex | L |
| F2 | AMEL-72 — synchronisation AniList bidirectionnelle | L |
| F3 | AMEL-71 — 2FA TOTP | L |

## E. À instruire — signalé, pas reproduit

**« Les pages des chapitres ne se chargent pas. »** Quatre parcours testés
(MangaDex, WeebCentral, SushiScan, lecteurs de romans) affichent leurs pages.
C5 en est peut-être la cause — en mode page par page, une planche figée se
décrit exactement ainsi. À confirmer avec la source et le titre concernés avant
d'écrire quoi que ce soit.

---

## Découpe proposée pour la 2.6.0

**Dans la version :** S1, S2 (sécurité, effort faible, gain immédiat) · C1 à C7
(défauts vérifiés, tous ≤ M) · lots 0 et 1 du plan de dette (filet, puis
découpe de `global.js`).

**Après :** A1 (l'admin est un chantier à elle seule) · S3, A3, A5, F1–F3
(chacun est une version en soi).

**Deux remarques de méthode.**

L'alarme `sources-health` **sonne dans le vide depuis quatre semaines**. Un
signal qu'on n'écoute pas est pire qu'une absence de signal : il donne
l'impression d'une surveillance. Avant d'en ajouter, il faut soit agir sur
celui-là, soit l'éteindre.

C1, C2 et C3 sont trois sources cassées par des changements **côté site**. Ce
n'est pas un défaut d'Inko, c'est la nature d'un lecteur qui scrape — et cela
se reproduira. La bonne réponse à moyen terme n'est pas de les réparer une par
une, c'est de rendre la panne **visible dans l'app** (une source muette doit se
dire muette) plutôt que de la laisser ressembler à un catalogue vide.
