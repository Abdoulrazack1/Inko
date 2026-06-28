# Audit Inko — Rapport complet

> Réalisé le 28 juin 2026 — Analyse statique du code
> Projet : Application web de lecture manga/novel (Node/Express/MySQL, vanilla JS frontend)
> Stack : JS uniquement (pas de TypeScript)

---

## 1. Architecture & Conception

### 1.1 Points forts

- **Architecture modulaire côté client** : `api.js`, `storage.js`, `theme.js`, `userdata.js`, `global.js` forment une vraie couche service.
- **Séparation API logique** : Contrôleurs/routeurs bien organisés (`/controllers/`, `/routes/`).
- **Système d'extensions** : Architecture de scraping via `extensions/` avec abstraction `Fetcher` / `Parser`.
- **PWA-ready** : Service worker, manifest, `assets/js/pwa.js`.
- **Profil page complète** : `profil.js` implémente 6 tabs avec données réelles (stats, favoris, historique, avis, badges, listes).
- **Recherche multi-sources** : `recherche.js` interroge toutes les sources en parallèle avec groupement par type.

### 1.2 Problèmes architecturaux

- **Backend monolithe** : `server.js` (routes, middleware, static files). Les contrôleurs (`*.controller.js`) mélangent accès DB et logique métier.
- **Pas de validation centralisée** : Validation dispersée. Aucun schéma réutilisable.
- **Pas de couche d'abstraction DB** : Requêtes SQL brutes dans les contrôleurs.
- **Frontend sans bundler** : Vanilla JS avec IIFEs. Pas de modules ES. Tout est attaché à `window.*`.
- **Pas de tests, pas de CI/CD**.
- **Docker sous-optimal** : `|| true` avale les erreurs d'initialisation DB.

### 1.3 Data Flow & State Management

| ID | Problème | Fichier:ligne | Gravité |
|---|---|---|---|
| DF1 | **Logout ne nettoie que `mh_session`** : 15+ clés localStorage persistent (prefs, bookmarks, AniList token, NSFW, musique). Vie privée : un utilisateur sur machine partagée laisse toutes ses données. | `api.js:131-132`, tous les modules | Haute |
| DF2 | **`auth:change` listener jamais nettoyé** : Ajouté à chaque `initPage()`, jamais retiré. Accumulation de listeners. | `global.js:678-688` | Haute |
| DF3 | **`cacheLibrary()` jamais appelé auto** : Le miroir localStorage `inko_lib_mirror` n'est jamais mis à jour après un ajout/suppression de favori. Toujours stale. | `storage.js:41-49` | Haute |
| DF4 | **Pas de timeout sur fetch()** : Aucun AbortController. Si le serveur ne répond pas, l'application freeze. | `api.js:39-46` | Critique |
| DF5 | **`catch (e) {}` silencieux généralisés** : La plupart des blocs catch sont vides. Les erreurs sont avalées sans log ni notification utilisateur. | Presque tous les fichiers JS | Moyenne |
| DF6 | **Token JWT en double** : Stocké dans `localStorage` (`mh_session`) + header Bearer + cookie (`credentials:include`). Risque d'incohérence si un seul est nettoyé. | `api.js:21,42` | Moyenne |
| DF7 | **`_sourceTypes` jamais invalidé** : Cache in-memory des sources. Si une source est changée dans un autre onglet, le cache est périmé pour toujours. | `global.js:86-95` | Moyenne |
| DF8 | **`cacheMangas` dans profil.js** : Map non évincée qui grossit indéfiniment pendant la session. | `profil.js:5` | Moyenne |
| DF9 | **Pas de retry logic** : Aucune tentative de réessai après échec API. Toute erreur réseau = échec immédiat. | Tous les appels API | Moyenne |
| DF10 | **Pas de migration localStorage** : Les clés versionnées (`inko_userdata_v1`, `inko_music_v2`) n'ont aucun code de migration si le schéma change entre versions. | `userdata.js:22`, `music.js:48` | Moyenne |

---

## 2. Sécurité

### 2.1 Problèmes critiques

| ID | Description | Fichier |
|---|---|---|
| S1 | **Token de reset exposé dans l'URL** : retourné dans la réponse API + redirigé en query string. Lisible dans l'historieles logs serveur, referrers. | `auth.controller.js:186`, `page_mdpoublie.js:22-24` |
| S2 | **PIN NSFW haché côté client** : Le PIN +18 est haché en SHA-256 (côté client, pas de bcrypt/serveur), stocké dans `localStorage`. Vulnérable au brute-force offline car PIN numérique court (4-8 chiffres) et SHA-256 est rapide (pas de facteur de coût). Pas de rate-limiting côté serveur sur la vérification. | `nsfw.js` |
| S3 | **Rate limiting basique** : `authLimiter` (40 req/15min/IP) appliqué sur login/register/forgot/reset. 40 tentatives par fenêtre laisse passer du brute-force lent. À réduire (5-10) en production. | `security.js:42-48`, `routes/index.js:27-32` |
| S4 | **CORS `*` en dev** : `Access-Control-Allow-Origin: *` en mode développement. | `security.js` |
| S5 | **`.env` commité** : Contient SESSION_SECRET, JWT_SECRET, DB_PASSWORD, GOOGLE_CLIENT_ID, SPOTIFY_CLIENT_ID. Même en dev, c'est un risque. | `.env` |
| S6 | **Image proxy — curl via execFile** : `execFile('curl', ['-s', '-L', rawUrl])` avec rawUrl venant du frontend. **Anti-SSRF présent** : résolution DNS + blocage IP privées via `hostResolvesPrivate()` dans `image.controller.js:54-64`. Risque résiduel : DNS rebinding si TTL très court. | `image.controller.js:70-76` |
| S7 | **Compte démo hardcodé** : `demo@inko.app` / `demo1234` en dur dans le JS frontend. | `page_login.js:67-68` |
| S8 | **Spotify OAuth sans PKCE** : Flux Authorization Code sans PKCE challenge. Spotify recommande PKCE depuis 2024 même pour les apps serveur. | `spotify.controller.js` |
| S9 | **Token Spotify exposé dans `/api/spotify/status`** : `accessToken` renvoyé au frontend en clair. Stocké en mémoire navigateur, visible dans le panneau réseau. | `spotify.controller.js:145` |
| S10 | **Token Spotify en clair dans la DB** : `access_token` et `refresh_token` stockés en `TEXT` sans chiffrement au repos dans `spotify_accounts`. | `db/schema.sql:207-208` |
| S11 | **AniList OAuth implicite (déprécié)** : Utilise `response_type=token` (implicit grant) au lieu de Authorization Code + PKCE. Token stocké dans `localStorage`. | `anilist.js:12,60` |
| S12 | **JWT_SECRET fallback `'change-me'` dans le code** : Si `.env` mal configuré, le secret devient `'change-me'` — trivial à deviner. | `middleware/auth.js:5` |
| S13 | **Aucune Subresource Integrity (SRI)** : Scripts Google GSI, YouTube IFrame API, Spotify Embed API chargés sans attributs `integrity`. CDN compromis = XSS. | `page_login.html:172`, `music.js:425,469` |

---

## 3. Bugs identifiés

| ID | Description | Fichier | Gravité |
|---|---|---|---|
| B1 | **Duplicate ID `libImportFile`** : Deux `<input type="file">` avec le même id. `getElementById` ne retourne que le premier. | `bibliotheque.html:117` | Haute |
| B2 | **CBR non supporté** : Lecteur local ne gère que CBZ/ZIP. CBR (RAR) affiche juste une erreur. | `localreader.js:30` | Moyenne |
| B3 | **Race condition scroll infini** : Pas d'annulation de requête précédente en scrollant vite. | `catalogue.js` | Moyenne |
| B4 | **Polling Spotify sans cleanup** : Le `setInterval` continue jusqu'à 90 itérations (~3 min) même si la page est fermée. Pas de `clearInterval` au `beforeunload`. | `player.js:165-177` | Faible |
| B5 | **Promise.race sans timeout cleanup** : `searchAll` a un timeout de 15s mais ne détruit pas les promesses. | `manga.controller.js` | Moyenne |
| B6 | **Boutons non connectés** : `wireExtraButtons()` dans `profil.js:826` attrape tous les boutons sans handler et affiche "Fonctionnalité à venir". **~15 boutons UI sont des placeholders sans action réelle.** | `profil.js:826` | Moyenne |
| B7 | **Sliders/inputs muets** : Les `pref-slider` (taille des pages), `sort-select`, `list-search-input` dans profil.html n'ont aucun JS qui les écoute. | `profil.html:294,698-704` | Faible |
| B8 | **Pagination statique** : Les boutons de pagination dans le tab "Ma bibliothèque" du profil sont des placeholders HTML fixes qui ne changent jamais de page. | `profil.html:385-394` | Faible |
| B9 | **Données mockées dans le HTML** : Les cartes de listes personnalisées dans profil.html ont des noms et nombres hardcodés ("À lire cette semaine", "4 séries", etc.) jamais remplacés par le JS. | `profil.html:403-426`, `profil.html:533-555` | Faible |
| B10 | **Préférences de lecture inactives** : Les toggles de confidentialité (profil public, historique visible, partage avis) dans profil.html sont décoratifs — le clic les toggle visuellement mais ne sauvegarde rien. | `profil.html:305-328`, `profil.js:737-743` | Faible |

---

## 4. Code mort / Inutilisé

| Fichier | Statut |
|---|---|
| `assets/scss/` | Dossier vide — SCSS jamais compilé/utilisé |
| `docker-compose.yml` | `REDIS_URL` défini mais jamais lu par le code |
| `tools/` | Scripts one-shot non connectés à aucun pipeline |
| `assets/vendor/jszip.min.js` | Chargé depuis `localreader.html` mais pas dans la preload du SW |
| `ICON_PATHS` dans `global.js:16-35` | SVG inline icons — la majorité des pages utilisent leurs propres SVG directement dans le HTML |
| `stats.loading = false` dans `serie.js:~80` | Variable initialisée mais jamais lue ailleurs |

---

## 5. UX / Accessibilité

### 5.1 Problèmes d'accessibilité (a11y)

| ID | Description | Pages concernées | Gravité |
|---|---|---|---|
| A1 | **Pas de skip links** : Aucun lien "Aller au contenu" pour navigation clavier. | Toutes | Haute |
| A2 | **ARIA quasi inexistant** : Boutons sans `aria-label`, lecteurs d'écran aveugles. Navigation par tabulation non testée. | Toutes | Haute |
| A3 | **Focus visible absent** : Beaucoup d'éléments cliquables n'ont pas de `:focus-visible` outline. Navigation clavier impossible à suivre. | Toutes | Haute |
| A4 | **Contraste insuffisant** : Thème sombre avec textes gris (#7a7a86, #a8a8b3) sur fond foncé (#121216). Ratio < 4.5:1. | Toutes les pages sombres | Moyenne |
| A5 | **Pas de `lang` dynamique** : Le HTML a `lang="fr"` mais le contenu chargé dynamiquement n'hérite pas. | `serie.html`, `recherche.html` | Faible |

### 5.2 Problèmes UX

| ID | Description | Pages | Gravité |
|---|---|---|---|
| A6 | **Aucun état de chargement** : Les appels API n'affichent pas toujours de spinner/skeleton. L'utilisateur ne voit pas que quelque chose se charge. | `catalogue.js`, `serie.js`, `chapitre.js` | Haute |
| A7 | **Pas de retour haptique/gestion tactile** : Reader ne supporte pas le pinch-zoom, swipe pour chapitre suivant, ni le changement de page par tap zones. | `chapitre.html`, `lecture.html` | Haute |
| A8 | **Titres de page statiques** : `<title>` n'est jamais mis à jour dynamiquement (toujours "Inko" ou le nom de la page HTML). | Toutes les pages SPA | Moyenne |
| A9 | **Messages d'erreur non contextualisés** : Les erreurs API sont souvent affichées brutes (JSON string) dans les notifications toast sans libellé user-friendly. | `api.js`, tous les contrôleurs JS | Moyenne |
| A10 | **Pas de confirmation pour les actions destructrices** : Suppression de compte, déconnexion Spotify, effacement historique — aucune modale de confirmation secondaire. | `auth.controller.js`, `music.js` | Moyenne |
| A11 | **Pas d'annulation des opérations longues** : Import/export, recherche multi-sources — pas de bouton "Annuler" ni de AbortController côté frontend. | `recherche.js`, `parametres.js` | Moyenne |
| A12 | **Toasts non accessibles** : `MH.toast()` crée des notifications sans `role="alert"`, les lecteurs d'écran ne les perçoivent pas. | Toutes | Faible |

### 5.3 Responsive design

| ID | Description | Gravité |
|---|---|---|
| A13 | **Reader non responsive** : Le lecteur chapitre/lecture ne s'adapte pas correctement sur mobile (< 480px). Boutons trop petits, images non redimensionnées. | Haute |
| A14 | **Tableaux de stats cassés** : Les canvas de stats.js ne se redimensionnent pas au viewport. Débordement horizontal sur mobile. | Moyenne |
| A15 | **Music player empiète sur le contenu** : Le dock fixe en bas (64px + 460px déplié) cache le contenu en mobile. Aucun padding-bottom sur `<body>`. | Haute |

---

## 6. Fonctionnalités manquantes — Liste exhaustive

### 6.1 Pages entièrement manquantes

| Page | Raison |
|---|---|
| **`notifications.html`** | L'API `API.notifications.list()` existe mais pas de page dédiée. Seul un dropdown dans le header. Pas de vue "Voir toutes mes notifications", pas de filtres, pas de gestion. |
| **`downloads.html`** | `assets/js/downloads.js` existe (téléchargement de chapitres) mais aucune page pour gérer les téléchargements : progression globale, pause/reprise, file d'attente, espace disque. |
| **Partage de profil** | `u.html` affiche le profil public mais sans page dédiée pour paramétrer ce qui est partagé. |
| **Page "À lire plus tard" dédiée** | Concept évoqué dans profil.html mais pas de route dédiée. |
| **Page d'accueil administrateur avancée** | `admin.html` minimal (stats + modération utilisateurs). Pas de logs, pas de monitoring système, pas de gestion des extensions côté admin. |

### 6.2 Pages existantes — fonctionnalités manquantes

#### `profil.html` — **15+ placeholders/fonctionnalités mortes**

La page profil est la plus complète en HTML mais aussi celle avec le plus d'éléments non implémentés :

| Section | Éléments morts / manquants |
|---|---|
| **Barre de recherche historique** (`#tab-history:474-476`) | Icône manquante, input de recherche non connecté |
| **Pills de filtre historique** (`#tab-history:479-483`) | "Type de contenu", "Genres", "Moment de lecture" — aucun JS derrière |
| **Résumé lecture** (`#tab-history:486-514`) | Les nombres (42, 6h24, 9, 5/7) et tendances (+18%, +1h10) sont du HTML statique jamais alimenté par des vraies données |
| **Heatmap historique** (`#historyHeatmap`) | Générée mais les labels "Activité des 4 dernières semaines" sont statiques |
| **Ligne du temps navigation** (`#tab-history:527-528`) | Boutons "Semaine précédente / suivante" sans handler |
| **Top séries lues** (`#tab-history:533-555`) | Images gradient statiques, noms et nombres hardcodés (One Piece, 12 chapitres, etc.) |
| **Détails période** (`#tab-history:557-565`) | "Lectures de nuit 38%", "Nombre de pauses 5 sessions" — données fictives |
| **Options historique** (`#tab-history:570-610`) | Toggles "Sauvegarder automatiquement" et "Synchroniser" décoratifs. Bouton "Modifier" durée muet. Export CSV et effacement 30j sans handler. |
| **Bibliothèque filters bar** (`#tab-library:371-381`) | "Filtres", "Genres", "Note", "Tags" — boutons décoratifs |
| **Vue liste** (`#tab-library:379`) | Toggle grid/list présent mais vue liste non implémentée |
| **Pagination bibliothèque** (`#tab-library:385-394`) | Pagination factice (1, 2, ..., 6, Suivant) — pas de JS |
| **Listes personnalisées statiques** (`#tab-library:403-426`) | "À lire cette semaine", "Classiques à terminer", "Découvertes récentes" — données mockées avec gradients aléatoires |
| **Cercles de statuts** (`#tab-library:430-449`) | SVG statiques avec nombres hardcodés (18, 21) |
| **Détail liste "Shonen Incontournables"** (`#tab-lists:677-694`) | Tags "Action", "Aventure", "Public" statiques. Stats "384 chapitres", "92% note", "2h" inventées. |
| **Sélecteur de tri liste** (`#tab-lists:699-704`) | Select "Date d'ajout / Note / Titre" décoratif |
| **Filtre liste** (`#tab-lists:698`) | Input de recherche dans la liste décoratif |
| **Bouton "Tout lire"** (`#tab-lists:694`) | Pas de handler pour lire toute une liste d'un coup |
| **Préférences lecture** (`#tab-library:272-303`) | Slider "Taille des pages" muet (aucun `addEventListener`) |
| **Confidentialité** (`#tab-library:305-328`) | 3 toggles décoratifs — le JS (`initToggles()` dans `profil.js:737`) les toggle visuellement mais ne sauvegarde RIEN |
| **Éditer profil via bouton Hero** (`profil.html:52`) | Bouton "Éditer" présent mais `openEditProfile()` n'est pas appelé via le handler direct du HTML — il y a un doublon avec `wireExtraButtons()` qui utilise un autre chemin |
| **Bouton "Partager" profil** (`profil.html:53`) | Copie l'URL de la page profil (pas de lien personnalisé vers le profil public) |
| **Badges récents** (`#tab-library:450-455`) | 3 `.badge-item` vides — jamais remplis |

#### `accueil.html` (Homepage)

- Pas de widget **"Nouveaux chapitres de mes séries suivies"** (uniquement dans la bibliothèque)
- Pas de bouton **"Voir tous les tendances"** — la section trending est limitée à 10
- Pas de **filtre "Aujourd'hui / Cette semaine / Ce mois"** pour les dernières sorties
- Pas de **section "Nouveautés de la semaine"** distincte des dernières sorties
- Pas de **classement hebdomadaire** des séries populaires
- Pas de **flux d'activité des amis**
- Pas de **refresh manuel** spécifique à une section (le bouton Refresh global actualise les updates bibliothèque)
- Pas de **bannière "Bienvenue"** pour les nouveaux utilisateurs
- Pas de **suggestion par genre** basée sur l'utilisateur (uniquement tag-matching basique)

#### `catalogue.html` (Catalog)

- Pas de **filtre par plage de notes** (note minimale/maximale)
- Pas de **filtre par année** (avant/après/entre)
- Pas de **filtre "exclure les tags"**
- Pas de **filtre "NSFW uniquement"** (l'espace +18 est une page séparée)
- Pas de **tri par "nouveaux chapitres"** (seulement par date d'ajout)
- Pas de **sauvegarde de recherche** (presets de filtres)
- Pas de **vue compacte** (liste)
- Pas de **bouton "J'ai de la chance"** (random avec filtres actifs)
- Pas de **compteur de résultats total** au-dessus de la grille
- Pas de **pagination infinie avec numéro de page** (scroll infini uniquement)

#### `serie.html` (Series detail)

- Pas de section **"Séries similaires"** (recommandations basées sur les tags)
- Pas de section **"Collections contenant cette série"**
- Pas de **bouton "Signaler un problème"** (métadonnées erronées, chapitre manquant)
- Pas de **bouton "Télécharger tous les chapitres"** (download bulk)
- Pas de **bouton "Marquer tous les chapitres comme lus"**
- Pas de **recherche textuelle** dans les noms de chapitres
- Pas de **bouton "Partager cette série"**
- Pas de **statistiques par série** (temps de lecture estimé, chapitres lus, jours depuis le dernier chapitre)
- Pas de **sélecteur de source directement sur la page** (il faut aller dans Sources)
- Pas de **badge "Nouveau chapitre"** pour les chapitres sortis depuis la dernière visite
- Pas de **lecture automatique** (enchaînement automatique des chapitres sans cliquer)

#### `lecture.html` / `chapitre.html` (Reader)

- Pas de **mode double page** (côte à côte sur grand écran)
- Pas de **mode webtoon** (scroll vertical continu avec images qui s'enchaînent)
- Pas de **filtres de lecture** (luminosité, contraste, noir & blanc, sépia)
- Pas de **bookmark par chapitre** (marquer une page précise dans un chapitre)
- Pas de **saut de page** (input "Aller à la page N")
- Pas de **mode plein écran natif** (Fullscreen API)
- Pas de **gestes tactiles avancés** (pinch-zoom, swipe pour changer de chapitre)
- Pas de **bouton "Télécharger ce chapitre"** dans le lecteur
- Pas de **bouton "Partager ce chapitre"**
- Pas de **compteur de pages lues** / progression dans le chapitre
- Pas de **préchargement du chapitre suivant** (lazy load anticipé)
- Pas de **mode "Lecture automatique"** (auto-play avec intervalle réglable)
- Pas de **paramètres de lecture rapides** (overlay accessible sans quitter le lecteur)
- Pas de **changement de direction RTL/LTR** depuis le lecteur (doit passer par les paramètres)
- Pas de **notification "nouveau chapitre disponible"** pendant la lecture

#### `bibliotheque.html` (Library)

- Pas de **vue liste** (uniquement grille)
- Pas de **tri** (ordre d'ajout, dernier lu, note, titre, nombre de chapitres)
- Pas de **sélection multiple** pour actions en masse (supprimer plusieurs, changer statut)
- Pas de **filtre par source**
- Pas de **filtre par note personnelle**
- Pas de **recherche dans la bibliothèque**
- Pas de **bouton "Bibliothèque aléatoire"** (tirer une série au hasard dans mes favoris)
- Pas de **statistiques de la bibliothèque** (temps de lecture total, % complété, etc.)
- Pas d'**export de la bibliothèque** en JSON/CSV

#### `collections.html` / `collection-detail.html`

- Pas de **glisser-déposer** pour réorganiser les items
- Pas de **réorganisation par drag & drop** des listes elles-mêmes
- Pas d'**upload de cover personnalisée** pour une collection
- Pas de **lien de partage public** (collection partageable même si l'utilisateur n'est pas connecté)
- Pas d'**import de collection depuis une URL** (partager/emporter la collection d'un autre)
- Pas de **tri automatique** (par titre, date d'ajout, note, etc.)

#### `parametres.html` (Settings)

- Pas d'**export/import de tous les paramètres** (seulement les favoris/progression)
- Pas de **bouton "Réinitialiser tous les paramètres"**
- Pas de **prévisualisation du thème** avant application
- Pas de **CSS personnalisé** (custom stylesheet)
- Pas de **paramètres par source** (comportement différent manga/novel)
- Pas de **configuration proxy**
- Pas de **paramètres de téléchargement** (qualité par défaut, dossier, limite)
- Pas de **nettoyage du cache local**
- Pas de **configuration des notifications push** (abonnement/désabonnement)
- Pas de **paramètres de confidentialité avancés** (visibilité du profil, historique, etc.)
- Pas de **session management** (voir les sessions actives, les révoquer)

#### `stats.html` (Statistics)

- Pas de **graphique d'évolution mensuelle/annuelle**
- Pas de **répartition par genre** (camembert/barres)
- Pas de **top auteurs lus**
- Pas de **temps de lecture estimé** par jour/semaine/mois
- Pas de **carte des heures de lecture** (matin/midi/soir/nuit)
- Pas de **comparaison avec la semaine précédente** (stats page a des stats, le profil a des tendances)
- Pas d'**export CSV** des statistiques
- Pas d'**image de stats partageable**
- Pas de **prédictions** (nombre de jours avant le prochain palier/badge)

#### `secret.html` (NSFW +18)

- Pas de **filtres NSFW spécifiques** (par tag adulte)
- Pas de **vue gallery** (mode grille avec previews plus grandes)
- Pas de **mode discret** (cache les titres/couvertures)
- Pas de **bouton "Lock Now"** qui fonctionne (il recharge la page, ne lock pas proprement)
- Pas de **sélecteur de source pour le contenu adulte** (utilise la source par défaut)
- Pas de **code PIN biométrique** (fingerprint / face unlock)

#### `player.html` (Music)

- Pas de **création/modification de playlist**
- Pas de **recherche de titres** (seulement chargement des playlists existantes)
- Pas de **mémorisation du volume par piste**
- Pas de **crossfade entre les pistes**
- Pas de **timer de mise en veille**
- Pas de **mode mini-player flottant** (toujours visible)
- Pas de **raccourcis clavier média** (Media Session API : play/pause/next/prev)
- Pas de **support des touches multimédia du clavier**
- Pas de **liste des morceaux récents** Spotify (l'API existe, l'UI non)
- Pas de **mode "radio"** (lecture aléatoire basée sur un morceau)
- Pas de **support YouTube Music** (seulement YouTube et Spotify)

#### `sources.html` (Extensions)

- Pas de **bouton "Désactiver une source"** (seulement "Activer" — une seule source active à la fois)
- Pas de **recherche dans la liste des sources**
- Pas de **filtre par type** (manga/roman/NSWF)
- Pas de **statut de connexion** de la source (joignable/indisponible)
- Pas de **bouton "Tester la source"** (vérifier que le site est accessible)
- Pas de **journal d'erreurs** pour chaque source
- Pas de **configuration par source** (paramètres spécifiques)

#### `recherche.html` (Search)

- Pas de **filtre par année / note / statut / genre** dans les résultats
- Pas de **tri des résultats** (par popularité, date, pertinence)
- Pas de **vue détaillée** (avec description) dans les résultats
- Pas de **bouton "Ajouter aux favoris"** directement depuis les résultats
- Pas de **prévisualisation au survol** (card-hover fonctionne sur manga-card)
- Pas de **sauvegarde de recherche** (alertes sur nouveaux résultats)
- Pas de **recherche par auteur**
- Pas de **recherche par tag**

#### `u.html` (Public profile)

- Pas de **section "Bibliothèque publique"** de l'utilisateur
- Pas de **section "Dernières lectures"** de l'utilisateur
- Pas de **bouton "Suivre cet utilisateur"**
- Pas de **bouton "Envoyer un message"**
- Pas de **comparaison de stats entre utilisateurs**
- Pas de **liste des collections publiques** de l'utilisateur

### 6.3 Fonctionnalités globales manquantes

#### Social / Communauté
- **Pas de système de followers/amis** (API commentaires existe, mais pas de relations sociales)
- **Pas de messagerie privée**
- **Pas de forum / espace de discussion**
- **Pas de commentaires par chapitre** (seulement par série)
- **Pas de fil d'activité des amis**
- **Pas de réactions aux commentaires** (likes, etc.)
- **Pas de signalement d'utilisateur** (seulement signalement de commentaire)
- **Pas de profil d'utilisateur éditable avec bio, réseaux sociaux, etc.** (édition profil minimale : nom + avatar emoji)

#### Contenu
- **Pas de support Webtoon/scroll vertical natif** (catalogue traite tout comme manga page par page)
- **Pas de support Comics américains** (format différent)
- **Pas de support Audio books / podcasts**
- **Pas de liste de lecture auto-générée** ("Si tu as aimé X, lis Y")
- **Pas de système de "collections officielles"** (lists créées par les admins)

#### Technique
- **Pas de mode hors-ligne** (SW ne cache que les assets statiques, pas les pages dynamiques)
- **Pas de sauvegarde automatique cloud des réglages** (UserData localStorage uniquement)
- **Pas de bi-directional sync AniList** (Inko → AniList uniquement)
- **Pas de sync MyAnimeList / Kitsu / MAL**
- **Pas de notifications push Web** (l'API `subscribe` existe mais n'est pas utilisée côté SW)
- **Pas de flux RSS** pour les nouveaux chapitres
- **Pas de mode "data saver"** (qualité d'image réduite)
- **Pas de keyboard shortcuts customisables**
- **Pas de mode "lecture seule"** (sans interaction, pour kiosk/prêt)
- **Pas de support PWA avancé** (periodic background sync, content index)
- **Pas de changement de langue dynamique complet** (i18n partiel : quelques labels, pas tout le contenu)

#### Administration
- **Pas de logs de modération**
- **Pas de statistiques serveur** (uptime, mémoire, requêtes/seconde)
- **Pas de gestion des extensions côté admin** (activer/désactiver à distance)
- **Pas de bannissement IP** (bannissement utilisateur seulement)
- **Pas de file d'attente de modération** (signalements traités un par un)
- **Pas de tableau de bord des commentaires récents**

---

## 7. Problèmes de performance & PWA

### 7.1 Performance générale

| ID | Problème | Page/Composant | Impact |
|---|---|---|---|
| P1 | **Aucune pagination virtuelle** : DOM brut pour les listes de résultats sans virtual scroll. | Catalogue, Bibliothèque, Recherche | Élevé |
| P2 | **Images sans lazy loading natif** : Certaines pages oublient `loading="lazy"`. | Serie, Chapitre | Moyen |
| P3 | **JS bundle non minifié** : ~200KB+ non compressé par page. Aucun bundler. | Toutes | Élevé |
| P4 | **Cache-Control agressif absent** : SW pallie, mais sans SW (première visite, Safari), cache navigateur minimal. | Toutes | Moyen |
| P5 | **Requêtes N+1 potentielles** dans les boucles API (ex: charger chaque série individuellement). | Catalogue, Bibliothèque | Moyen |
| P6 | **Extensions scraping parallèle lourd** : `Promise.all` avec dizaines de requêtes au démarrage. | Accueil, Catalogue | Élevé |
| P7 | **Aucun code splitting** : Chaque page charge TOUS les JS même si non utilisés (ex: music.js chargé partout). | Toutes | Moyen |
| P8 | **Animations CSS non optimisées** : `backdrop-filter` avec `blur(22px)` sur le reader overlay cause du jank. | Reader, Music player | Faible |

### 7.2 Service Worker & PWA

| ID | Problème | Fichier | Impact |
|---|---|---|---|
| SW1 | **Pas de page offline fallback** : SW ne sert aucun `offline.html`. En cas de hors-ligne, les pages HTML retournent 504. | `service-worker.js:154-155` | Critique |
| SW2 | **`STATIC_ASSETS` hardcodé** : La liste des assets à pré-cacher est en dur dans le SW (l.20-76). Chaque nouvel asset nécessite une mise à jour manuelle + changement de version. Aucun build step pour générer automatiquement. | `service-worker.js:20-76` | Élevé |
| SW3 | **Pas de `install` event handler** : L'event `install` est bien géré (pre-cache + skipWaiting) mais ne gère pas les erreurs d'installation proprement. | `service-worker.js:78-84` | Faible |
| SW4 | **Pas de background fetch / background sync** : Les téléchargements de chapitres ne peuvent pas continuer en arrière-plan si le SW est tué. | `service-worker.js` | Élevé |
| SW5 | **Pas de Periodic Background Sync** : Pas de mise à jour périodique des favoris/chapitres en arrière-plan. L'utilisateur doit ouvrir l'app pour rafraîchir. | `service-worker.js` | Moyen |
| SW6 | **Pas de navigation preload** : `navigationPreload.enable()` non appelé, ce qui retarde les réponses de navigation de la latence de réveil du SW. | `service-worker.js` | Moyen |
| SW7 | **Pas de cache versioning pour les images** : Les couvertures (COVERS_CACHE) n'ont pas d'expiration programmatique. Le cache grossit indéfiniment. | `service-worker.js:159-170` | Moyen |
| SW8 | **Pas de stratégie "stale-while-revalidate" pour l'API** : Tous les appels API sont network-first, donc inopérants hors-ligne. Aucun cache des réponses API pour consultation offline. | `service-worker.js:108-112` | Élevé |
| SW9 | **Pas de Content Index API** : Les chapitres téléchargés ne sont pas indexés via l'API Content Index, donc invisibles dans le navigateur en mode offline. | `service-worker.js` | Faible |

---

## 8. Qualité du code

- **Mix de langues** : Variables et vues en français (`bibliotheque`, `parametres`) et anglais (`catalogue`, `downloads`). `u.js` / `u.html` — nommage cryptique pour "user".
- **Pas de lint/format** : `.eslintrc`, `.prettierrc` absents.
- **CSS dans le JS** : `stats.js`, `global.js`, `parametres.js`, `profil.js` injectent du style via `innerHTML` avec `style="..."` en ligne.
- **Variables globales** : Tout passe par `window.*`. Impossible de tester unitairement.
- **Code mort détecté** : `ICON_PATHS`, `assets/scss/`, `stats.loading`, `docker-compose.yml` avec `REDIS_URL` inutilisé.
- **Incohérence de port** : `api.js` hardcode `localhost:8088` mais `server.js` default `8080`. `.env` a `8088`. Dépend du `.env` pour fonctionner.
- **Double chargement potentiel** : `music.js` chargé dynamiquement par `global.js` ET explicitement dans `parametres.html`.

### 8.1 API / Endpoints

| ID | Problème | Fichier:ligne | Gravité |
|---|---|---|---|
| API1 | **Pas de timeout sur fetch()** : Aucun `AbortController`/timeout. Si le serveur hang, l'UI freeze indéfiniment. | `api.js:39-46` | Critique |
| API2 | **Pas de try/catch dans `spotify.login()`** : Fonction synchrone sans `next`. Une exception (ex: `jwt.sign`) crashe le processus. | `spotify.controller.js:41-57` | Haute |
| API3 | **`PUT /me/settings` sans validation** : Accepte n'importe quelle structure JSON sans filtre ni limite de taille. | `user.controller.js:618-631` | Haute |
| API4 | **Formats d'erreur inconsistants** : `spotify.login` retourne texte brut, `image.proxy` retourne body vide/GIF 1x1 au lieu de JSON. | `spotify.controller.js:43`, `image.controller.js:88` | Moyenne |
| API5 | **JWT en query string** : `/api/spotify/login?token=...` — visible dans logs serveur, referers, historique. | `spotify.controller.js:35-36` | Haute |
| API6 | **`authOptional` ne vérifie pas le ban** : `req.userId` posé sans vérifier si l'utilisateur est banni. | `middleware/auth.js:32-40` | Faible |
| API7 | **Export inutile `configured`** : Fonction exportée mais jamais routée. | `spotify.controller.js:28` | Info |

---

## 9. Docker & Déploiement

| Problème | Détail |
|---|---|
| `|| true` après `init.js` | Masque les échecs d'initialisation DB |
| `REDIS_URL` mort | Défini dans `docker-compose.yml` mais jamais lu |
| Pas de `.dockerignore` | Contexte inclut `node_modules/`, `.git/` |
| Multi-stage absent | Image finale lourde |
| Healthcheck absent | Aucun `HEALTHCHECK` dans le Dockerfile |
| **Node 20 EOL** : `node:20-alpine` a atteint sa fin de vie (2025-04-30). Doit passer à `node:22-alpine` (LTS) ou `node:24-alpine`. | 
| **Conteneur tourne en root** : Aucune directive `USER` dans le Dockerfile. |
| **`CMD` en forme shell** : `CMD ["sh", "-c", "..."]` au lieu de la forme exec. Les signaux UNIX (SIGTERM) ne sont pas propagés correctement. |
| **Lockfile by-pass** : `npm ci || npm install` ignore le lockfile si `npm ci` échoue. |
| **Frontend list hardcodée** : Les 18 fichiers HTML sont listés explicitement. Tout nouveau fichier sera oublié. |

---

## 10. Dépendances

### Frontend (vendor)
- `assets/vendor/jszip.min.js` — Pour `localreader.html`

### Backend (package.json)
- Express, mysql2, bcryptjs, express-session, helmet
- Aucune lib de test (jest/mocha/uvu)
- 0 vulnérabilités connues (`npm audit` clean) ✅

### Desktop (desktop/package.json)
- Electron 33.2.0 — **12 vulnérabilités** (11 high, 1 moderate). Dernière version stable : 42.x.
- electron-builder 25.1.8 — plusieurs CVEs transitives.

### Problèmes de maintenance

| ID | Problème | Détail | Gravité |
|---|---|---|---|
| DEP1 | **`engines.node` non défini** | Aucune contrainte de version Node dans `package.json`. Le projet peut casser sur n'importe quelle version. | Critique |
| DEP2 | **Desktop : 12 CVEs** | Electron 33.2.0 a 11 vuln. high (UAF, renderer injection, AppleScript injection). Màj vers >=39.8.1. | Haute |
| DEP3 | **Node 20 EOL dans Docker** | `node:20-alpine` EOL depuis avril 2025. | Haute |
| DEP4 | **Aucun test/lint/CI** | 0 test runner, 0 linter, 0 CI pipeline. `.github/workflows/` est vide. | Haute |
| DEP5 | **`jsonwebtoken` non maintenu** | Dernière release 2023. Alternative maintenue : `jose`. | Moyenne |
| DEP6 | **`express` major behind (v4)** | Express 5.2.1 stable disponible. v4 est legacy. | Moyenne |
| DEP7 | **`bcryptjs` major behind** | v2.4.3 vs v3.0.3 disponible (breaking changes). | Faible |
| DEP8 | **`dotenv` major behind** | v16 vs v17 disponible. | Faible |
| DEP9 | **Package.json manque licence/repo** | `license`, `repository`, `bugs`, `author` absents. | Faible |

---

## 11. Base de données — Schéma & Indexation

### 11.1 Problèmes critiques du schéma

| ID | Description | Table | Gravité |
|---|---|---|---|
| DB1 | **`FLOAT` pour `last_chapter` et `chapter_number`** : Les numéros de chapitres décimaux (ex: 123.5) perdent en précision avec FLOAT. Doit être `DECIMAL(10,2)`. | `favorites.last_chapter`, `progress.chapter_number`, `read_chapters.chapter_number` | Haute |
| DB2 | **`VARCHAR(512)` pour URLs** : Les URLs de couvertures peuvent dépasser 512 caractères (CDN signatures, tokens). Risque de troncature silencieuse. | `favorites.cover`, `list_items.cover`, `spotify_accounts.avatar` | Haute |
| DB3 | **Colonne `rating` dupliquée** : `library.rating` (TINYINT) ET `ratings.rating` (TINYINT) — deux systèmes de notation coexistent. Incohérence possible : un user note dans ratings mais library.rating reste NULL. | `library` + `ratings` | Haute |
| DB4 | **`VARCHAR(10)` pour avatar** : Limité à 10 caractères. Empêche les URLs d'avatar ou les emojis longs (séquence multi-codepoint). | `users.avatar` | Moyenne |
| DB5 | **Pas de CHECK constraints** : `library.rating` (1-5), `ratings.rating` (1-5), `events.type` (ENUM limité) — pas de contrainte CHECK pour validation DB-level. | Plusieurs tables | Moyenne |

### 11.2 Index manquants

| ID | Description | Requêtes impactées |
|---|---|---|
| DB6 | **Pas d'index sur `read_chapters.read_at`** : Les requêtes de stats/historique triées par date scannent toute la table. | `stats.js`, historique lecture |
| DB7 | **Pas d'index composite sur `events(user_id, type, created_at)`** : Les filtres par type d'événement + date sont lents sur grand volume. | `events` timeline, heatmap |
| DB8 | **Pas d'index FULLTEXT** : Aucune recherche textuelle possible dans `comments.text` ou `lists.name`. MySQL InnoDB supporte FULLTEXT mais il n'est pas utilisé. | Commentaires, listes |
| DB9 | **Pas d'index sur `password_resets.expires_at`** : Le cleanup périodique des tokens expirés scanne toute la table. | `password_resets` |

### 11.3 Migrations fragiles

| ID | Description | Fichier | Gravité |
|---|---|---|---|
| DB10 | **Migrations additives en SQL dynamique** : Les `ALTER TABLE` conditionnels dans `schema.sql` utilisent des `PREPARE/EXECUTE` basés sur `information_schema`. Fragile : dépend du moteur, pas versionné. | `server/db/schema.sql:41-65`, `server/db/migrate.js` | Haute |
| DB11 | **Init DB sans transaction** : `schema.sql` exécute CREATE TABLE + ALTER TABLE sans transaction. Une migration qui échoue à moitié laisse la DB dans un état incohérent. | `server/db/schema.sql` | Moyenne |
| DB12 | **`|| true` avale les erreurs d'init** : Dans `server.js:57`, `try { ... } catch { console.warn }` et Docker `|| true` masquent les échecs. | `server/server.js:57`, `Dockerfile` | Haute |

### 11.4 Sécurité des données

| ID | Description | Gravité |
|---|---|---|
| DB13 | **Pas d'encryption at rest** : Les tokens Spotify (`spotify_accounts.access_token`, `refresh_token`) et les tokens de reset (`password_resets.token`) stockés en clair dans la DB. | Haute |
| DB14 | **CASCADE DELETE non auditée** : `ON DELETE CASCADE` sur toutes les FK users — avantage (nettoyage) mais risque (suppression utilisateur = perte de toutes les données liées sans sauvegarde). | Moyenne |

---

## 12. Confidentialité & Conformité (RGPD/GDPR)

| ID | Description | Article RGPD | Gravité |
|---|---|---|---|
| P1 | **Absence de consentement explicite** : Aucun bandeau/checkbox de consentement pour le traitement des données personnelles (email, historique de lecture, préférences). | Art. 7 | Critique |
| P2 | **Pas de droit à l'effacement API** : La suppression de compte (`DELETE /api/auth/me`) efface l'utilisateur mais pas les events/comments (CASCADE partiel). Pas de purge complète avec confirmation. | Art. 17 | Haute |
| P3 | **Pas de portabilité des données** : Aucun endpoint pour exporter TOUTES les données d'un utilisateur (JSON structuré). Seulement l'export fav/progress via Paramètres. | Art. 20 | Haute |
| P4 | **PIN NSFW traçable** : Le hash SHA-256 du PIN stocké en localStorage permet de lier un navigateur à une préférence +18 même après déconnexion. | Art. 6 | Moyenne |
| P5 | **Pas de durée de conservation définie** : `password_resets` stocke les tokens sans cleanup automatique. `events` grossit indéfiniment. | Art. 5(1)(e) | Moyenne |
| P6 | **Pas de page "Politique de confidentialité"** : Aucune mention légale, aucun lien vers une politique de confidentialité ou CGU. | Art. 12-14 | Critique |
| P7 | **Pas de registre des traitements** : Aucune traçabilité des accès aux données personnelles (logs serveur, export). | Art. 30 | Haute |
| P8 | **Données de navigation dans l'URL** : Le token de reset est passé en query string (`page_nouveaumdp.html?token=...`). Présent dans l'historieles logs serveurs, Referer headers, bookmarks. | Art. 32 | Haute |
| P9 | **Spotify OAuth sans consentement** : Le linking Spotify expose l'email Spotify et les playlists sans consentement explicite (pas de scope minimum). | Art. 7 | Moyenne |
| P10 | **LocalStorage sans expiration** : Les préférences (`inko_music_v2`, `mh_*`, `userdata`) persistent indéfiniment dans localStorage sans mécanisme d'expiration. | Art. 5(1)(e) | Faible |

---

## 13. Analyse Produit & SWOT

### 13.1 SWOT

| Strengths | Weaknesses |
|---|---|
| • Architecture extensions bien conçue avec séparation Fetcher/Parser | • Aucune page admin avancée (logs, monitoring, gestion extensions) |
| • Lecteur multi-sources (MangaDex, WeebCentral, NovelFull, RoyalRoad…) | • Pas de tests automatisés (0 tests, 0 CI) |
| • PWA complète (SW, manifest, offline partiel) | • Pas de fonctionnalités sociales (followers, messagerie, activité) |
| • Profil utilisateur riche (stats, heatmap, badges) | • Backend monolithe sans service layer |
| • Synchronisation AniList | • Documentation inexistante |
| • Lecteur musique intégré | • Pas de mode hors-ligne complet |
| • Design system cohérent (thème sombre, orange #ff6b1a) | • Pas de support Webtoon/scroll vertical |
| • SSO Google implémenté | • Pas de notifications push |
| • Rate limiting & anti-SSRF présents | • Sécurité : CSP désactivée, HSTS off, JWT secret faible |

| Opportunities | Threats |
|---|---|
| • Marché du self-hosted manga reader en croissance (Tachiyomi, Mihon) | • Concurrents matures : Komga (OSS), Kavita, Tachidesk |
| • Extension au multi-format (Comics, Audio books, Webtoon) | • DMCA/prises de position des hébergeurs de contenu |
| • Features sociales = différenciation forte | • Sécurité : .env commit = fuite de tokens OAuth |
| • Intégration IA (recommandations, résumés) | • Abandon faute de contributeurs (projet solo) |
| • Monétisation via plugins/extension store | • Maintenance : dépendances non auditées, pas de dependabot |

### 13.2 User journey gaps

| Parcours | Problème |
|---|---|
| **Découverte** (Accueil → Catalogue → Série) | Pas de recommandations personnalisées, pas de filtres avancés, pas de "séries similaires" |
| **Lecture** (Série → Chapitre → Navigation) | Pas de mode webtoon, pas de préchargement, pas de paramètres rapides, pas de bookmark |
| **Social** (Profil → Amis → Activité) | Pas de followers, pas de messagerie, pas de fil d'activité |
| **Gestion** (Bibliothèque → Listes → Stats) | Pas de drag & drop, pas de batch actions, pas de vue liste |
| **Admin** (Modération → Logs → Monitoring) | Console admin minimale, pas de dashboard, pas de logs |

### 13.3 Competitive landscape

| Concurrent | Forces Inko | Faiblesses Inko vs Concurrent |
|---|---|---|
| **Komga** (Java/Spring) | Multi-sources, extensions, PWA | Pas de lecture webtoon, pas de scanlation tracker |
| **Kavita** (.NET) | Interface plus moderne, lecteur musique | Pas de regroupement multi-sources, pas d'extensions |
| **Tachidesk** (Kotlin/JS) | Extensions, multi-sources | Moins mature, UI moins complète |
| **Mihon/Tachiyomi** (Android) | Application web, multi-plateforme | Pas d'app native, pas d'offline avancé |

---

## 14. Stratégie Spotify & Trackers

### 14.1 Spotify — État des lieux

#### Fonctionnalités existantes
- **Lecteur intégré** : Dock flottant en bas de toutes les pages (`music.js`), avec stations YouTube/Spotify + fichiers locaux
- **Liaison de compte OAuth** : Authorization Code Grant (sans PKCE) via `spotify.controller.js`
- **API utilisées** : playlists, search, top tracks, saved tracks, recently played, currently playing, playback control
- **Page dédiée** : `player.html` (lecteur plein écran)

#### Comment y accéder
1. **Configuration serveur** : Éditer `server/.env` → renseigner `SPOTIFY_CLIENT_ID` et `SPOTIFY_CLIENT_SECRET` (créer une app sur https://developer.spotify.com/dashboard)
2. **Redirect URI** : Enregistrer `http://127.0.0.1:8088/api/spotify/callback` dans l'app Spotify
3. **Liaison utilisateur** : Ouvrir le lecteur musique (icône en bas à droite) → onglet Spotify → "Connecter mon compte Spotify"
4. **Portée OAuth** : `user-read-private user-read-email playlist-read-private playlist-read-collaborative user-read-playback-state user-modify-playback-state user-read-currently-playing user-read-recently-played user-top-read streaming`

#### Flux OAuth détaillé
```
1. Frontend clique "Connecter Spotify"
2. music.js:317 → window.open('/api/spotify/login?token=<jwt>')
3. spotify.controller.js:41-57 → Redirige vers Spotify authorize URL
4. Utilisateur autorise → Spotify redirect vers /api/spotify/callback?code=...
5. spotify.controller.js:60-104 → Échange code contre tokens, stocke en DB
6. Frontend poll toutes les 2s (max 90 itérations) via /api/spotify/status
7. Une fois linked=true, les playlists/tracks sont chargés
```

#### Problèmes identifiés (avec corrections)
| Problème | Où | Correctif |
|---|---|---|
| Pas de PKCE challenge | `spotify.controller.js` | Ajouter `code_challenge_method=S256` + verifier |
| `accessToken` exposé dans `/status` | `spotify.controller.js:145` | Proxy les appels API côté serveur au lieu de passer le token au client |
| Tokens en clair dans la DB | `db/schema.sql:207-208` | Chiffrer avec `AES_ENCRYPT` ou crypto.createCipheriv |
| Pas de try/catch dans `login()` | `spotify.controller.js:41` | Ajouter try/catch + retour JSON |
| JWT en query string | `spotify.controller.js:35-36` | Passer le token en header ou body POST |
| Polling 2s × 90 itérations | `music.js:318` | Remplacer par WebSocket ou SSE, ou utiliser l'event push subscription existante |
| Pas de retry Spotify API | `spotify.controller.js` | Ajouter backoff exponentiel sur 429 |
| Pas de User-Agent header | Tous les appels axios Spotify | Ajouter `headers: { 'User-Agent': 'Inko/1.0' }` |
| Refresh token échoué → stale token | `spotify.controller.js:132` | Retourner null et inviter l'utilisateur à re-lier |

### 14.2 Trackers — AniList

#### Fonctionnalités existantes
- **Sync unidirectionnel** (Inko → AniList seulement) : progression, statut, score
- **OAuth implicite** (déprécié) : `response_type=token` → access_token dans URL fragment
- **Page dédiée** : `anilist.html` + `assets/js/anilist.js`
- **Backend** : `anilist.controller.js` avec cache recommandations 24h
- **Config** : Client ID stocké dans `server/config/anilist.json` (configurable depuis l'app)

#### Comment y accéder
1. **Configuration serveur** : `ANILIST_CLIENT_ID` dans `.env` OU via l'interface dans l'app (Paramètres → AniList)
2. **Redirect URI** : Enregistrer `http://127.0.0.1:8088/anilist.html` dans l'app AniList (https://anilist.co/settings/developer)
3. **Liaison utilisateur** : Aller dans `anilist.html` → cliquer "Connecter AniList" → autoriser
4. **Sync automatique** : Quand un chapitre est marqué comme lu, `anilist.js:88-98` appelle la mutation GraphQL `SaveMediaListEntry`

#### Problèmes identifiés (avec corrections)
| Problème | Où | Correctif |
|---|---|---|
| OAuth implicite (déprécié) | `anilist.js:60` | Migrer vers Authorization Code + PKCE (AniList le supporte) |
| Token dans localStorage | `anilist.js:12` | Utiliser HttpOnly cookie + backend proxy pour les appels GraphQL |
| Sync unidirectionnel | `anilist.js:88-98` | Ajouter `MediaListCollection` query pour importer les données AniList au moment de la liaison |
| Sync par titre (fragile) | `anilist.js:102-108` | Ajouter un mapping manuel série → AniList ID dans l'interface |
| Client ID dans fichier JSON modifiable | `anilist.controller.js:14-22` | Garder uniquement dans `.env`, retirer la configuration via l'API |
| Pas de résolution de conflits | `anilist.js` | Dernier écrasement = dernière version. Ajouter un diff + confirmation |

### 14.3 Stratégie recommandée

#### Phase 1 — Sécuriser (1-2 jours)
1. **Spotify** : Ajouter PKCE + try/catch dans `login()` + retirer JWT de la query string
2. **AniList** : Protéger le token en localStorage (ou migrer vers backend proxy)
3. **DB** : Chiffrer les tokens Spotify (`access_token`, `refresh_token`)

#### Phase 2 — Fiabiliser (1 semaine)
1. **Spotify** : Remplacer le polling 2s par WebSocket/push subscription. Ajouter retry + backoff. Proxy les appels API côté serveur.
2. **AniList** : Migrer l'OAuth implicite → Authorization Code. Ajouter l'import initial depuis AniList.
3. **Tests** : Écrire des tests pour le flux OAuth Spotify (état: pending → linked → expired → refresh)

#### Phase 3 — Enrichir (2-4 semaines)
1. **Spotify** : Playlists custom, crossfade, Media Session API, mini-player flottant, support YouTube Music
2. **AniList** : Sync bidirectionnel avec résolution de conflits, mapping manuel des IDs, sync MyAnimeList/Kitsu
3. **Trackers additionnels** : MAL (MyAnimeList) sync, Kitsu sync, scoring normalisé entre plateformes

### 14.4 Points d'entrée code

| Composant | Fichier clé | Lignes |
|---|---|---|
| Spotify OAuth serveur | `server/controllers/spotify.controller.js` | 1-300 |
| Spotify routes | `server/routes/index.js` (rechercher `spotify`) | ~10 endpoints |
| Lecteur musique frontend | `assets/js/music.js` | 586 lignes |
| Page lecteur dédiée | `assets/js/player.js` | ~300 lignes |
| AniList frontend | `assets/js/anilist.js` | ~120 lignes |
| AniList backend | `server/controllers/anilist.controller.js` | ~100 lignes |
| AniList artwork cache | `server/controllers/artwork.controller.js` | ~50 lignes |
| Configuration .env | `server/.env` | SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, ANILIST_CLIENT_ID |

---

## 15. Recommandations prioritaires

### Court terme (1-2 jours)
1. ✅ Corriger le **duplicate ID** `libImportFile` dans `bibliotheque.html`
2. ✅ Rate limiting **existant** (40 req/15min) — réduire à 10 req/15min pour production
3. ✅ Déplacer `.env` vers `.env.example` et `.gitignore`
4. ✅ **Requêtes SQL sans interpolation** — déjà faites via `?` placeholders
5. ✅ Ajouter `clearInterval` du polling Spotify sur `beforeunload`
6. ➕ Ajouter **offline fallback page** au SW (`/offline.html`)
7. ➕ Fixer la **CSP désactivée** : activer avec nonces pour les scripts inline
8. ➕ Ajouter **AbortController/timeout** sur tous les fetch() dans `api.js`
9. ➕ Chiffrer **Spotify tokens** au repos dans la DB (AES_ENCRYPT ou application-level encryption)
10. ➕ Nettoyer **tout localStorage** à la déconnexion (pas seulement `mh_session`)

### Moyen terme (1-2 semaines)
11. Remplacer les **données mockées** de `profil.html` par des vraies datas (ou supprimer les placeholders)
12. Connecter les **boutons "Fonctionnalité à venir"** à des actions réelles ou les masquer
13. Ajouter un **mode hors-ligne complet** (offline fallback + SW + cache API dynamique)
14. Centraliser les **schémas DB** avec migrations versionnées (remplacer les `ALTER TABLE` dynamiques)
15. Ajouter des **tests d'intégration** pour les endpoints critiques
16. Corriger les **problèmes schéma DB** : FLOAT → DECIMAL, VARCHAR URLs → TEXT, dédupliquer rating
17. Ajouter **bandeau consentement cookies** + **Politique de confidentialité** (RGPD)
18. Ajouter **SRI** sur tous les scripts CDN (Google GSI, YouTube IFrame, Spotify Embed)
19. Fixer `spotify.controller.login()` — ajouter try/catch + retour JSON
20. Ajouter `engines.node` + licence dans `package.json`

### Long terme (2-4 semaines)
21. Refactoriser `server.js` en architecture **couches** (routes → controllers → services → DAL)
22. Implémenter les **notifications push Web** (l'API existe déjà côté serveur)
23. Ajouter les **fonctionnalités sociales** (profils publics, activité amis, messagerie)
24. Audit de **sécurité complet** (pen-test, dépendances, CSP, HSTS)
25. Ajouter **portabilité & effacement RGPD** des données
26. Implémenter **Periodic Background Sync** pour mise à jour automatique des favoris
27. Migrer AniList OAuth : **implicit grant → Authorization Code + PKCE**
28. Ajouter **PKCE** au flux Spotify OAuth
29. Mettre à jour **Docker → Node 22**, ajouter USER non-root, HEALTHCHECK, CMD exec form
30. Mettre à jour **Desktop Electron** de 33.2.0 → 42.x (12 CVEs)
31. Ajouter **CI pipeline** GitHub Actions (lint + test + build)

---

## Résumé statistique

| Métrique | Valeur |
|---|---|
| Fichiers JS frontend | 36 (hors vendor) |
| Fichiers backend (JS) | ~25 (routes + contrôleurs) |
| Pages HTML | 24 |
| Endpoints API | 100 (99 via controllers + 1 healthcheck inline) |
| Bugs confirmés | 10 |
| Problèmes sécurité | 13 (2 crit., 6 haut., 3 moy., 2 bas) |
| Problèmes RGPD | 10 (2 crit., 5 haut., 2 moy., 1 bas) |
| Problèmes DB | 14 (5 crit. schéma, 4 index manquants, 3 migrations, 2 sécurité) |
| Problèmes API/Endpoint | 7 (1 crit., 3 haut., 2 moy., 1 info) |
| Problèmes Data Flow | 10 (1 crit., 3 haut., 5 moy., 1 bas) |
| Problèmes UX/A11Y | 15 (6 haut., 5 moy., 4 faibles) |
| Problèmes SW/PWA | 9 (1 crit., 4 haut., 3 moy., 1 bas) |
| Problèmes Dépendances | 9 (1 crit., 3 haut., 3 moy., 2 faibles) |
| Placeholders UI inactifs (profil.html) | 15+ |
| Code mort | ~5 fichiers/dossiers |
| Fonctionnalités manquantes listées | 100+ |
| Extensions scraping | 7 sources actives |
| Contrôleurs API | 12 |
| Tests | 0 |
| Couverture de code | 0 % |
| Dépendances serveur | 126 prod, 0 dev |
| Vulnérabilités serveur | 0 ✅ |
| Vulnérabilités desktop | 12 (11 high, 1 moderate) |
| CI/CD | Aucun |

---

*Fin du rapport d'audit. Chaque section est une piste d'amélioration actionnable indépendamment.*
