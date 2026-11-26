## 7. Performance et fluidité (navigateur, desktop, mobile)

> **Le serveur est rapide ; c'est le navigateur qui attend.** Sous 6 clients simultanés, `/api/health` répond en p95 27 ms, `/api/me/favorites` (192 Ko) en 69 ms, les pages statiques en 15–22 ms. Les lenteurs perçues viennent de **ce qui est téléchargé, de l'ordre dans lequel c'est exécuté, et de la place qu'on ne réserve pas**.

### Relevé par page (bureau, serveur réel, base de 521 favoris)

| Page | Scripts | JS (Ko) | CSS (Ko) | Requêtes | Nœuds DOM | CLS | Tâches longues |
|---|---:|---:|---:|---:|---:|---:|---:|
| `chapitre.html` | 18 | 615 | 192 | 41 | 168 | 0,02 | 0 |
| `serie.html` | 15 | 581 | 159 | 42 | 198 | 0,10 | 72 ms |
| `bibliotheque.html` | 17 | 580 | 153 | **141** | **6 817** | **0,69** | 272–956 ms |
| `catalogue.html` | 14 | 514 | 148 | 70 | 794 | **0,81** | 0–111 ms |
| `accueil.html` | 16 | 480 | 143 | 64 | 616 | **0,49** | 0–1 128 ms |
| `profil.html` | 11 | 479 | 166 | 75 | 1 467 | 0,05 | 0 |
| `sources.html` | 8 | 364 | 133 | 39 | 473 | **0,43** | 0 |
| `stats.html` | 9 | 385 | 130 | 44 | 1 033 | **0,40** | 50 ms |
| `recherche.html` | 10 | 387 | 134 | 41 | 335 | **0,40** | 50 ms |
| `notifications.html` | 9 | 355 | 129 | 72 | 415 | **0,30** | 0 |
| `systeme.html` | 7 | 344 | 129 | **104** | 850 | 0,05 | 119 ms |

*(CLS cible < 0,1 ; au-delà de 0,25 le décalage est franchement visible. Les relevés mobile montrent un CLS de 0 sur la plupart des pages : le défaut est propre à la mise en page large.)*

**Totaux** : {{mesure:perf-statique.js_applicatif_ko}} Ko de JavaScript applicatif **servi tel quel**, 436 Ko de CSS, 27 fichiers de police, 8,8 Mo de captures d'écran dans `assets/`.

### PER-01 🟠 Aucune minification ni regroupement · effort M

**Preuve** : `PERF-PAS-MINIFIE` — 1 808 Ko de JS non minifié. Chaque page charge **6 à 18 fichiers `<script>` séparés** (`chapitre.html` : 18) ; chaque fichier est une requête, une analyse, une compilation. Le build **Android** transpile déjà vers Chrome 61 avec `esbuild` (`build-mobile-www.js`) et sait traiter les blocs inline : **la chaîne existe, elle n'est simplement pas utilisée pour le web et le bureau.**

**Correctif** : un `npm run build:web` qui produit `dist/` : par page, un bundle `core.min.js` (global, api, storage, i18n, theme) + un bundle de page, `--minify --sourcemap`, noms à empreinte pour un cache immuable. Le serveur et Tauri servent `dist/` ; le mode développement continue de servir les sources.

**Gain attendu (à mesurer)** : −45 % d'octets compressés, −50 % de temps d'analyse JS, 18 → 2–3 requêtes de script. **Critère** : `PERF-PAS-MINIFIE` disparaît ; LCP et TBT de la page bibliothèque mesurés avant/après.

### PER-02 🟠 Tous les scripts bloquent l'affichage · effort S

**Preuve** : 23 pages ont **plus de 3 scripts sans `defer`** ; `chapitre.html`, `serie.html`, `bibliotheque.html`, `accueil.html` en ont 14 à 18. Le navigateur **s'arrête** sur chacun jusqu'à son téléchargement et son exécution avant de construire la page.

**Correctif** : `defer` partout (l'ordre d'exécution est conservé ; tous les modules s'attachent déjà à `DOMContentLoaded`). Précharger la police du corps (`<link rel="preload" as="font" crossorigin>`), `font-display: swap` vérifié, **CSS critique** en ligne (≈ 6 Ko) + le reste en `media="print" onload`.

### PER-03 🟠 Décalages de mise en page très élevés en affichage large · effort M

**Preuve (`pages`)** : CLS **0,81** (catalogue), **0,69** (bibliothèque), **0,49** (accueil), 0,43 (sources), 0,40 (stats, recherche), 0,30 (notifications). Pour mémoire, la capture du scénario « Mettre à jour » (§3.3) montre un décalage de **208 px du bouton et 30 px de la grille** causé par une ligne de statut.

**Causes probables, à confirmer par trace Performance** : (a) grilles de cartes injectées sans hauteur réservée (squelette plus court que le contenu) ; (b) bandeaux insérés **au-dessus** du contenu après coup (bandeau invité, statut de mise à jour, bandeau « miroir local », annonces) ; (c) images sans `aspect-ratio` ; (d) bascule de police (3 familles, 27 fichiers) sans `size-adjust`.

**Correctif** : `aspect-ratio: 2/3` sur toute carte de couverture ; `min-height` sur les conteneurs de liste = hauteur du squelette ; **les bandeaux se superposent ou réservent leur place** (jamais d'insertion au-dessus) ; `font-display: optional` ou `size-adjust` ; `content-visibility: auto` + `contain-intrinsic-size` sur les sections sous le pli.

**Critère** : CLS < 0,1 sur les 26 pages en bureau (sonde `pages`, `PAGE-CLS` à zéro).

### PER-04 🟠 La bibliothèque rend 521 cartes d'un coup (6 817 nœuds DOM) · effort L

**Preuve** : `PAGE-DOM-LOURD` — 6 817 nœuds sur `bibliotheque.html`, **141 requêtes**, 272 à 956 ms de tâches longues. Le défilement et le filtrage rendent tout le DOM à chaque `render()` (appelé « à tout bout de champ », `bibliotheque.js:150`).

**Correctif** : **fenêtrage** (virtualisation) de la grille — ne monter que les cartes visibles ± 2 écrans ; hauteur de ligne connue (`aspect-ratio`), un `IntersectionObserver` sentinelle ; en première étape, `content-visibility: auto; contain-intrinsic-size: 0 260px` sur chaque carte (gain immédiat, 10 lignes de CSS). Limiter `render()` par rafale (`requestAnimationFrame` + drapeau « sale »).

**Mesure stable** (relevé toutes les secondes sur la base réelle) : 2 791 nœuds à 1 s, 6 630 à 2 s, **6 817 à partir de 3 s** (495 cartes, 509 images) — la grille se monte par lots, de sorte qu'un échantillon pris à 2,5 s sur une machine chargée peut n'en voir que 1 200 ; la sonde `pages` attend désormais que le DOM se stabilise.

**Critère** : nœuds < 1 200 pour 521 favoris ; tâches longues < 50 ms ; défilement à 60 images/s sur le PC et sur l'émulateur Android 8.

### PER-05 🟠 141 requêtes pour afficher la bibliothèque · effort M

La page demande **≈ 100 couvertures** via `/api/img` (une par carte), **plus jusqu'à 40 fiches de séries** auprès des sources externes (§3.3) ; l'accueil fait 64 requêtes, la page Système 104. Sur HTTP/1.1 local le navigateur plafonne à 6 connexions parallèles par hôte : le reste fait la queue.

**Correctif** : (1) **couverture dans la réponse de la liste** (déjà fait pour les favoris avec URL) ; (2) `loading="lazy"` + `fetchpriority="low"` pour tout ce qui est sous le pli — **vérifier** qu'aucune des 521 images n'est demandée d'emblée ; (3) enrichissement des 40 séries **en arrière-plan et persisté** (UPD-01/02, COV-02) ; (4) HTTP/2 via Caddy en auto-hébergement ; (5) `Cache-Control: public, max-age=604800, immutable` est **déjà** posé sur `/api/img` (mesuré) — conserver et ajouter un `ETag`.

### PER-06 🟡 `global.css` : 118 Ko bloquants, ≈ 370 classes jamais référencées · effort M

Feuille chargée par **toutes** les pages ; 177 couleurs littérales, 18 `!important`. La sonde `css` recense des classes mortes : `collections.css` 50, `profil.css` 67, `collection-detail.css` 40, `chapitre.css` 33, `global.css` 31, `serie.css` 30, `catalogue.css` 18 — **candidates** (certaines peuvent être construites par concaténation).

**Correctif** : minification (PER-01) ; purge assistée (`purgecss` avec liste de sécurité `safelist: [/^is-/, /^status-/]`) ; scinder `global.css` en `noyau.css` (≈ 25 Ko, critique) et composants chargés par page.

### PER-07 🟡 Travail au démarrage : tâches longues de 270 à 1 130 ms · effort M

`accueil.html` (jusqu'à **1 128 ms** sur le premier relevé) et `bibliotheque.html` (956 ms) bloquent le fil principal : reconstruction du DOM (`innerHTML` de grandes chaînes), calcul de statistiques côté client, doublons. **Correctif** : découper en tranches (`scheduler.postTask` / `requestIdleCallback`) ; déporter le calcul de `doublons.signaler` et des rythmes (`mesurerRythme`) dans un Worker ; mettre en cache le résultat par empreinte de la liste.

### PER-08 🟡 Les polices : 27 fichiers pour 3 familles · effort S

Archivo Narrow, Bitter, IBM Plex Sans × graisses × sous-ensembles (latin, latin-ext…). **Correctif** : ne garder que les graisses réellement utilisées (`grep font-weight`) ; **polices variables** (1 fichier par famille) ; `unicode-range` déjà utile.

### PER-09 🟡 Pas de préchargement de la page suivante · effort S

Sur le PC, la navigation bibliothèque → série → chapitre recharge tout. **Correctif** : *Speculation Rules* (`<script type="speculationrules">` : prefetch au survol des liens internes) ; `<link rel="prefetch">` du bundle de page suivante ; service worker en *stale-while-revalidate* pour les pages (la coquille HTML est quasi statique).

### PER-10 🔵 Images du dépôt trop lourdes · effort S

31 fichiers de 340–650 Ko (`.taste-skill/*` — ignorés par git, donc sans effet sur les installeurs) ; `assets/screenshots/*.jpg` 8,8 Mo au total **dans le dépôt** (ajoutés pour le README). **Correctif** : captures en WebP ≤ 150 Ko ; `assets/screenshots/` hors des installeurs (déjà exclus ? à vérifier dans `gen-precache`) ; le dépôt pèse **104 Mo** compressé : `git filter-repo` pour purger l'ancien binaire si l'on veut un clone léger.

### PER-11 🔵 `three.min.js` (608 Ko), `gsap`, `pdf.worker` (1,1 Mo) · effort S

`three.min.js` n'est **plus** chargé en dur (PERF-06) : `hero3d.js` le charge à la demande si WebGL et mouvement non réduit. Bien. À surveiller : `pdf.worker.min.js` (1,1 Mo) ne doit se charger **que** dans `localreader.html` ; vérifier qu'il n'entre pas dans le précache.

### PER-12 🟡 Mesurer le WebView Android 8 en continu · effort M

Aucune mesure de fluidité n'est faite sur la cible la plus contrainte. `android-emulateur.yml` et `mesure-demarrage.js` existent : **ajouter** la mesure de TBT/LCP de `bibliotheque.html` et `chapitre.html` sur l'émulateur API 26 avec un budget (LCP < 4 s, TBT < 600 ms) et un **échec de CI en cas de dépassement**.

### Ce qui est bien et à conserver

Compression Brotli active (`global.js` : 66 Ko transférés) · `Cache-Control: immutable` sur polices, images et vendors ; `no-cache + ETag` sur le code applicatif · `/api/img` avec **disjoncteur par hôte** et cache disque · scan de mises à jour **à attente croissante** (1 → 5 s) au lieu de marteler · `MH.contenuPret` (mesure du « contenu utile ») · garde-fou `verifier-android8` en CI · polices **locales** (pas de Google Fonts : vie privée et hors ligne).
