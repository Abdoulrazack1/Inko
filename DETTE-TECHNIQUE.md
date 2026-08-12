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

# Feuille de route 2.6.0 — issue d'une campagne QA

*Campagne du 10 août 2026 sur la 2.5.7 : 20 pages balayées (erreurs console,
requêtes en échec, a11y, poids), 10 pages testées à 375 px, sondage de sécurité
de l'API, thèmes, i18n, hors-ligne, navigation au clavier, performance des
assets, santé des 9 sources.*

**Notation** : 🔴 bloquant · 🟠 sérieux · 🟡 à traiter · ⚪ confort.
Chaque ligne porte sa **preuve**. Ce qui n'a pas été reproduit est marqué comme
tel.

---

## 🔒 Casquette sécurité

### 🔴 SEC-1 — `POST /api/auth/local` donne un compte **admin** à qui atteint le port

**Vérifié.** Le serveur écoute sur `::` (toutes interfaces). Depuis l'adresse
réseau de la machine — pas la boucle locale — un `POST` sans le moindre
identifiant renvoie :

    {"user":{"id":26,"username":"Kaito","role":"admin",…},"token":"eyJhbGciOi…","localMode":true}

La route (`server/routes/index.js:74`) n'a **aucun intergiciel** : ni
authentification, ni filtre d'adresse, ni limitation de débit — alors que
`/auth/login` et `/auth/register` en ont une. `localAuth` promeut au passage le
propriétaire en `admin`.

Ce n'est pas un bug d'implémentation, c'est le mode « façon Mihon, sans écran de
connexion », volontaire et légitime. Ce qui manque, c'est le garde qui le rend
sûr : **restreindre à la boucle locale**, et exiger un appairage explicite pour
tout le reste. Le mode hub (AMEL-93) sert justement d'autres appareils du foyer
— toute personne sur le même Wi-Fi devient administrateur de la bibliothèque.

### 🔴 SEC-2 — Toutes les installations desktop partagent le même secret JWT

`server/lib/secret.js` : hors production, le repli est la chaîne littérale
`inko-dev-secret-change-me`. Le desktop n'est pas de la production au sens de
`NODE_ENV`, mais ce n'est pas non plus du développement. Conséquence : les
jetons sont forgeables hors ligne, sans même toucher au serveur. Combiné à
SEC-1, la porte est ouverte deux fois.

**Correctif** : générer un secret aléatoire par installation au premier
démarrage. Le modèle existe déjà — `db-credentials.json` fait exactement cela
pour le mot de passe de la base.

### 🟠 SEC-3 — Sauvegardes en clair par défaut

Le dump quotidien contient l'email et la bibliothèque de **tous** les comptes.
`BACKUP_PASSPHRASE` vide = lisible. Le chiffrement AES-256-GCM est déjà écrit
(`lib/backup.js`), il n'est simplement pas activé. Même correctif que SEC-2.

### 🟠 SEC-4 — La posture de sécurité dépend d'une variable qu'il faut penser à poser

Sans `NODE_ENV=production` : pas de CSP, CORS qui **reflète n'importe quelle
origine** (vérifié : `https://site-tiers.test` renvoyé tel quel), secret de
développement. C'est cohérent et documenté (S-6, S-1) — mais un auto-hébergeur
qui lance `node server/server.js` sur un VPS obtient tout cela sans qu'aucun
message ne l'en avertisse.

**Correctif** : une bannière au démarrage qui énonce la posture réelle
(« CSP désactivée · CORS permissif · secret de développement ») dès que le
serveur écoute ailleurs que sur la boucle locale.

### 🟡 SEC-5 — AMEL-67, bac à sable des extensions

Une extension = du JS avec les pleins pouvoirs de Node. SEC-08 vérifie son
*intégrité*, jamais ses *droits*.

### ✅ Ce qui a résisté aux sondes — à ne pas « améliorer »

| Test | Résultat |
|---|---|
| SSRF sur le proxy d'images (7 charges : `127.0.0.1`, `169.254.169.254`, `[::1]`, `10.x`, `192.168.x`, `localhost:3306`, `file://`) | **7/7 bloquées** (403, et 400 pour `file://`) |
| `/api/me/*` et `/api/admin/*` sans jeton | **401** partout |
| En-têtes | `nosniff` · `frame-ancestors` · `no-referrer` · `X-Powered-By` masqué |
| Limitation de débit sur `/auth/login` | **429 après 12 essais** |
| Fuite de pile dans les erreurs | aucune (`{"error":"Endpoint introuvable"}`) |

---

## 🐞 Casquette QA fonctionnelle

| # | Défaut | Preuve | Gravité |
|---|---|---|---|
| QA-1 | **`novelbin` hors service** | `check-sources` : 0 résultat. Alarme hebdomadaire **rouge depuis le 20 juillet, 4 lundis** | 🟠 |
| QA-2 | **`gutenberg-fr` : aucun titre populaire** (la recherche répond) | `popular?limit=3` → 0 | 🟠 |
| QA-3 | **`chireads` : des titres, aucun chapitre** | 3 titres, `chapters` du 1er → 0 | 🟠 |
| QA-4 | **`weebcentral` ignore `limit`** | `popular?limit=3` → **32** résultats. Toute pagination bâtie dessus est fausse | 🟠 |
| QA-5 | **`profil.html` déclenche des 504 en rafale** sur WeebCentral | 3 × `504 Gateway Timeout` sur `/api/sources/weebcentral/mangas/<id>` en un seul chargement : la page interroge une source scrapée série par série | 🟠 |
| QA-6 | **Lecteur page par page** : la 1re flèche droite reste sans effet, `data-idx` fige à `0` au changement de planche | Mesuré sur MangaDex, 32 pages | 🟡 |
| QA-7 | **Identifiant invalide → `200` avec une fiche vide** au lieu de `404` | `/api/sources/mangadex/mangas/%00%01` → `{"title":"","author":"",…}` | 🟡 |
| QA-8 | **`gen-precache` salit `service-worker.js`** à chaque exécution sous Windows (LF réécrit sur du CRLF) | `git status` non vide après un run sans changement | ⚪ |
| QA-9 | **`CACHE_VERSION` ne dépend que du numéro de version**, pas du contenu | empreinte `ce7c71` identique de 2.5.0 à 2.5.7 malgré des assets modifiés | ⚪ |
| QA-10 | Recherche : `sololeveling` collé ne trouve rien | Ni le moteur du site ni l'index de secours ne rapprochent la forme sans espace | ⚪ |

---

## ♿ Casquette accessibilité

| # | Défaut | Preuve | Gravité |
|---|---|---|---|
| A11Y-1 | **4 pages sans `<h1>`** | `liste.html`, `localreader.html`, `recherche.html`, `u.html` | 🟡 |
| A11Y-2 | **3 pages sans `<main>`** | `anilist.html`, `localreader.html`, `offline.html` | 🟡 |
| A11Y-3 | **8 champs sans étiquette accessible** | biblio 2 · profil 2 · stats 2 · import 1 · localreader 1 · parametres 1 · recherche 1 | 🟡 |

**✅ Solide** : 0 image sans `alt` sur 20 pages · 0 bouton sans nom accessible ·
indicateur de focus présent sur les 12 premiers arrêts de tabulation · ordre de
tabulation cohérent (évitement → navigation → recherche → actions) · les 4
thèmes déclarés s'appliquent · axe-core vert en critical/serious et thème
contraste AAA.

---

## 📱 Casquette mobile — le point le plus dégradé

| # | Défaut | Preuve | Gravité |
|---|---|---|---|
| MOB-1 | **Débordement horizontal sur 6 pages sur 10** à 375 px | `sources` **+488 px** · `profil` +145 · `parametres` +111 · `notifications` +80 · `accueil` +78 · `bibliotheque` +52 | 🔴 |
| MOB-2 | **Cibles tactiles sous 32 px** | `bibliotheque` **770** · `catalogue` 132 · `accueil` 61 · les 7 autres pages entre 19 et 39. C'est AMEL-84, jamais traité | 🟠 |

Une page qui déborde de 488 px sur un écran de 375 px ne se « règle » pas au
zoom : elle est inutilisable. À traiter avant tout ajout de fonctionnalité
mobile.

---

## ⚡ Casquette performance

| # | Sujet | Mesure | Gravité |
|---|---|---|---|
| PERF-1 | **`notifications.html` transfère 1,9 Mo** | ~28 couvertures **pleine taille** (42 à 155 Ko chacune) pour une liste de notifications. Les vignettes existent, elles ne sont pas utilisées | 🟠 |
| PERF-2 | **`bibliotheque.html` : 109 requêtes** au chargement | contre 22 à 37 pour les pages calmes | 🟡 |
| PERF-3 | `pdf.min.js` pèse 313 Ko | chargé sur des pages qui n'en ont pas toujours besoin | ⚪ |

**✅ Solide** : gzip actif · `immutable` 30 jours sur les vendors ·
`must-revalidate` sur le code de l'app (cohérent avec le service worker
network-first) · pages entre 153 et 358 Ko hors notifications.

---

## 🔌 Casquette fiabilité des sources

| # | Sujet | Gravité |
|---|---|---|
| SRC-1 | **L'alarme `sources-health` sonne dans le vide depuis 4 semaines.** Elle fonctionne, elle dit vrai, personne ne l'écoute. Un signal ignoré est pire qu'une absence de signal : il donne l'illusion d'une surveillance | 🟠 |
| SRC-2 | **Une source en panne ressemble à un catalogue vide** dans l'app. Trois sources cassées par des changements côté site — cela se reproduira : la réponse durable est de rendre la panne **visible**, pas de réparer une par une | 🟠 |
| SRC-3 | **Aucun test de contrat d'extension** : rien ne vérifie qu'une source honore `limit`, rend les champs annoncés, ou respecte ses propres `capabilities`. QA-4 serait tombé tout seul | 🟡 |

---

## 🌍 Casquette internationalisation

| # | Sujet | Mesure | Gravité |
|---|---|---|---|
| I18N-1 | Restes de français après bascule EN | `Fermer` (paramètres), `Chapitre` (profil) — le reste bascule | ⚪ |
| I18N-2 | **410 textes visibles en dur dans le HTML, 0 attribut `data-i18n`** | `profil.html` 120 · `parametres.html` 94 · `confidentialite.html` 31 | 🟡 |
| I18N-3 | AMEL-85 : la clé **est** le texte français exact | toute reformulation casse la traduction en silence | 🟡 |

**✅ Bien meilleur que l'audit ne le laissait croire** : 861 chaînes + 55 motifs
traduits, `MH.setLang('en')` bascule réellement les pages testées.

---

## 🛠️ Casquette exploitation / auto-hébergeur

| # | Sujet | Gravité |
|---|---|---|
| OPS-1 | Bannière de démarrage énonçant la posture réelle (cf. SEC-4) | 🟠 |
| OPS-2 | Aucune vue « santé » dans l'app : sources, base, espace disque, dernière sauvegarde | 🟡 |
| OPS-3 | `AMEL-117` — image Docker arm64, alors que le README vise Raspberry Pi et NAS | 🟡 |
| OPS-4 | `AMEL-92` — builds macOS et Linux (gelés volontairement) | ⚪ |

---

## 👩‍💻 Casquette contributeur

| # | Sujet | Gravité |
|---|---|---|
| DX-1 | **9 modules serveur sans test**, dont `image.controller` — le proxy, en cause deux fois (PERF-08, puis le CDN WeebCentral) | 🟠 |
| DX-2 | **10 fichiers front sur 36** couverts par un test unitaire | 🟡 |
| DX-3 | Les 5 lots de dette structurelle (première partie de ce document) | 🟡 |

---

## ✨ Casquette produit — fonctionnalités

| # | Sujet | Effort |
|---|---|---|
| F-1 | **Interface d'administration** : exclue de bout en bout de la remédiation d'audit, jamais traitée | L |
| F-2 | `AMEL-76` — import depuis Mihon / Tachiyomi / MangaDex : enlève la barrière d'entrée pour qui migre | L |
| F-3 | `AMEL-72` — synchronisation AniList bidirectionnelle | L |
| F-4 | `AMEL-71` — 2FA TOTP | L |
| F-5 | `AMEL-84` — mode « une main » sur mobile (lié à MOB-2) | M |
| F-6 | `AMEL-87` — espagnol et allemand, une fois I18N-2/3 traités | M |

---

## 🎯 Découpe proposée

**2.6.0 — « on ferme les portes »**
SEC-1 · SEC-2 · SEC-3 · SEC-4 · QA-1 à QA-9 · MOB-1 · SRC-1 et SRC-2.

Rien de spectaculaire, mais c'est la version qui rend l'app **sûre à
auto-héberger** et **utilisable sur téléphone** — deux choses qu'elle promet
aujourd'hui sans les tenir.

**2.7.0 — « on consolide »**
A11Y-1/2/3 · PERF-1/2 · SRC-3 · DX-1/2 · lots 0 à 2 de la dette structurelle.

**Ensuite, une version par sujet** : F-1 (admin), SEC-5 (bac à sable),
I18N-2/3 puis F-6, F-2, F-3, F-4.

---

## ⚠️ Ce que cette campagne n'a **pas** couvert

La valeur du rapport tient à ce qu'il exclut :

- **Parcours authentifiés multi-comptes** : commentaires, notes, listes
  partagées, profils publics. Tout a été testé sous le compte propriétaire.
- **Le signalement « les pages des chapitres ne se chargent pas »**, toujours
  pas reproduit. QA-6 en est peut-être la cause.
- **L'app desktop empaquetée** : tout a été mesuré sur le serveur de
  développement. Le comportement diffère (CSP active, CORS fermé).
- **Charge et volumétrie** : aucune mesure au-delà d'une bibliothèque
  personnelle.
- **Navigateurs autres que Chromium**, et lecteurs d'écran réels — axe-core ne
  détecte que 30 à 50 % des défauts d'accessibilité.
