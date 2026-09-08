# Audit de l’application mobile

Relevé du 2026-08-18, sur le paquet `mobile/www` tel qu’il part dans l’APK,
dans un Chromium piloté à **375×812**, tactile, EULA écartée.

> ⚠ Les appels aux sources échouent dans ce contexte : sans `CapacitorHttp`,
> CORS les bloque. **Un conteneur vide ici ne prouve pas qu’il l’est sur
> l’appareil.** Les constats de mise en page, eux, valent partout.

## Vue d’ensemble

| Page | Débordements | Cibles < 44 px | Chevauchements | Conteneurs vides | Images cassées |
|---|---|---|---|---|---|
| Accueil | 1 | 10 | 10 | 4 | 0 |
| Catalogue | 0 | 11 | 3 | 0 | 0 |
| Recherche | 0 | 10 | 10 | 0 | 0 |
| Bibliothèque | 0 | 10 | 3 | 0 | 0 |
| Fiche de série | 0 | 10 | 6 | 0 | 0 |
| Lecteur | 0 | 10 | 1 | 0 | 0 |
| Lecteur de roman | 0 | 10 | 1 | 0 | 0 |
| Collections | 0 | 10 | 4 | 1 | 0 |
| Détail d’une collection | 0 | 10 | 7 | 1 | 0 |
| Journal de lecture | 0 | 11 | 5 | 0 | 0 |
| Notifications | 0 | 11 | 4 | 0 | 0 |
| Téléchargements | 0 | 10 | 5 | 0 | 0 |
| Fichiers importés | 0 | 10 | 3 | 0 | 0 |
| Lecteur de fichier | 0 | 0 | 0 | 0 | 0 |
| Paramètres | 0 | 10 | 10 | 0 | 0 |
| Profil | 16 | 10 | 3 | 1 | 0 |
| Statistiques | 0 | 10 | 3 | 0 | 0 |
| Sources | 0 | 10 | 3 | 0 | 0 |
| Liste | 0 | 10 | 10 | 0 | 0 |
| Profil public | 0 | 10 | 8 | 0 | 0 |
| Retour AniList | 0 | 2 | 0 | 0 | 0 |
| Confidentialité | 0 | 2 | 0 | 0 | 0 |
| Hors ligne | 1 | 0 | 0 | 0 | 0 |

**Totaux** — débordements : 18 · cibles trop petites : 197 · chevauchements : 99 · conteneurs vides : 7

---

## Le détail, page par page

### Accueil — `accueil.html`

`Inko — Accueil` · 70 contrôles · 0 `h1` · 1 `main`

**Débordements horizontaux (1)** — la page mesure 375 px pour 375 disponibles :

- `div#heroBg` dépasse de **12 px** (largeur 399 px)

**Cibles tactiles sous 44 px (10)** :

- 59×17 — « Catalogue » (`a`)
- 70×17 — « Nouveautés » (`a`)
- 21×17 — « Top » (`a`)
- 110×17 — « Importer un fichier » (`a`)
- 100×17 — « Téléchargements » (`a`)
- 72×17 — « Code source » (`a`)
- 90×17 — « Signaler un bug » (`a`)
- 50×17 — « Versions » (`a`)
- 85×17 — « Confidentialité » (`a`)
- 44×17 — « Licence » (`a`)

**Contrôles qui se recouvrent (10)** — l’un des deux est inatteignable :

- `a.skip-link` × `a.header-logo` sur 61×21 px
- `button#btnMore` × `button#inkoConsentOk` sur 100×34 px
- `button#btnMore` × `a.mnav-item` sur 49×34 px
- `button#btnMore` × `a.mnav-item` sur 63×34 px
- `button#btnMore` × `a.mnav-item` sur 63×34 px
- `button#btnMore` × `a.mnav-item` sur 63×34 px
- `button#btnMore` × `a.mnav-item` sur 63×34 px
- `button#btnMore` × `button#mnavMore` sur 49×34 px
- `button#inkoConsentOk` × `a.mnav-item` sur 34×34 px
- `button#inkoConsentOk` × `a.mnav-item` sur 63×34 px

**Conteneurs de contenu vides (4)** :

- `div#heroBg`
- `div.hero-scrim`
- `div#heroContent`
- `div#heroRail`


### Catalogue — `catalogue.html`

`Inko — Catalogue` · 86 contrôles · 1 `h1` · 1 `main`

**Cibles tactiles sous 44 px (11)** :

- 109×32 — « Trier le catalogue » (`select#sortSelect`)
- 59×17 — « Catalogue » (`a`)
- 70×17 — « Nouveautés » (`a`)
- 21×17 — « Top » (`a`)
- 110×17 — « Importer un fichier » (`a`)
- 100×17 — « Téléchargements » (`a`)
- 72×17 — « Code source » (`a`)
- 90×17 — « Signaler un bug » (`a`)
- 50×17 — « Versions » (`a`)
- 85×17 — « Confidentialité » (`a`)
- 44×17 — « Licence » (`a`)

**Contrôles qui se recouvrent (3)** — l’un des deux est inatteignable :

- `a.skip-link` × `a.header-logo` sur 61×21 px
- `button#inkoConsentOk` × `a.mnav-item` sur 34×34 px
- `button#inkoConsentOk` × `a.mnav-item` sur 63×34 px

**Erreurs de console** :

- `Access to fetch at 'https://api.mangadex.org/manga/tag' from origin 'http://127.0.0.1:8611' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' he`
- `Failed to load resource: net::ERR_FAILED`
- `Access to fetch at 'https://api.mangadex.org/manga?limit=3&offset=0&includes%5B%5D=cover_art&includes%5B%5D=author&includes%5B%5D=artist&order%5BfollowedCount%5`
- `Access to fetch at 'https://api.mangadex.org/manga?limit=24&offset=0&includes%5B%5D=cover_art&includes%5B%5D=author&includes%5B%5D=artist&contentRating%5B%5D=sa`
- `Access to fetch at 'https://api.mangadex.org/manga?limit=10&offset=0&includes%5B%5D=cover_art&includes%5B%5D=author&includes%5B%5D=artist&order%5BfollowedCount%`


### Recherche — `recherche.html`

`Inko — Recherche` · 61 contrôles · 1 `h1` · 1 `main`

**Cibles tactiles sous 44 px (10)** :

- 59×17 — « Catalogue » (`a`)
- 70×17 — « Nouveautés » (`a`)
- 21×17 — « Top » (`a`)
- 110×17 — « Importer un fichier » (`a`)
- 100×17 — « Téléchargements » (`a`)
- 72×17 — « Code source » (`a`)
- 90×17 — « Signaler un bug » (`a`)
- 50×17 — « Versions » (`a`)
- 85×17 — « Confidentialité » (`a`)
- 44×17 — « Licence » (`a`)

**Contrôles qui se recouvrent (10)** — l’un des deux est inatteignable :

- `a.skip-link` × `a.header-logo` sur 61×21 px
- `a` × `button#inkoConsentOk` sur 57×12 px
- `a` × `a.mnav-item` sur 49×12 px
- `a` × `a.mnav-item` sur 24×12 px
- `a` × `button#inkoConsentOk` sur 75×11 px
- `a` × `a.mnav-item` sur 49×17 px
- `a` × `a.mnav-item` sur 42×17 px
- `a` × `a.mnav-item` sur 49×9 px
- `button#inkoConsentOk` × `a.mnav-item` sur 34×34 px
- `button#inkoConsentOk` × `a.mnav-item` sur 63×34 px

**Erreurs de console** :

- `Access to fetch at 'https://api.mangadex.org/manga?limit=18&offset=0&includes%5B%5D=cover_art&includes%5B%5D=author&includes%5B%5D=artist&order%5BfollowedCount%`
- `Failed to load resource: net::ERR_FAILED`
- `Failed to load resource: the server responded with a status of 404 (Not Found)`


### Bibliothèque — `bibliotheque.html`

`Inko — Bibliothèque` · 70 contrôles · 1 `h1` · 1 `main`

**Cibles tactiles sous 44 px (10)** :

- 59×17 — « Catalogue » (`a`)
- 70×17 — « Nouveautés » (`a`)
- 21×17 — « Top » (`a`)
- 110×17 — « Importer un fichier » (`a`)
- 100×17 — « Téléchargements » (`a`)
- 72×17 — « Code source » (`a`)
- 90×17 — « Signaler un bug » (`a`)
- 50×17 — « Versions » (`a`)
- 85×17 — « Confidentialité » (`a`)
- 44×17 — « Licence » (`a`)

**Contrôles qui se recouvrent (3)** — l’un des deux est inatteignable :

- `a.skip-link` × `a.header-logo` sur 61×21 px
- `button#inkoConsentOk` × `a.mnav-item` sur 34×34 px
- `button#inkoConsentOk` × `a.mnav-item` sur 63×34 px

**Erreurs de console** :

- `Failed to load resource: the server responded with a status of 404 (Not Found)`


### Fiche de série — `serie.html`

`Inko — Série` · 59 contrôles · 0 `h1` · 1 `main`

**Cibles tactiles sous 44 px (10)** :

- 59×17 — « Catalogue » (`a`)
- 70×17 — « Nouveautés » (`a`)
- 21×17 — « Top » (`a`)
- 110×17 — « Importer un fichier » (`a`)
- 100×17 — « Téléchargements » (`a`)
- 72×17 — « Code source » (`a`)
- 90×17 — « Signaler un bug » (`a`)
- 50×17 — « Versions » (`a`)
- 85×17 — « Confidentialité » (`a`)
- 44×17 — « Licence » (`a`)

**Contrôles qui se recouvrent (6)** — l’un des deux est inatteignable :

- `a.skip-link` × `a.header-logo` sur 61×21 px
- `a` × `a` sur 57×17 px
- `a` × `button#inkoConsentOk` sur 35×17 px
- `a` × `a.mnav-item` sur 49×17 px
- `button#inkoConsentOk` × `a.mnav-item` sur 34×34 px
- `button#inkoConsentOk` × `a.mnav-item` sur 63×34 px


### Lecteur — `chapitre.html`

`Inko — Lecture` · 55 contrôles · 1 `h1` · 1 `main`

**Cibles tactiles sous 44 px (10)** :

- 59×17 — « Catalogue » (`a`)
- 70×17 — « Nouveautés » (`a`)
- 21×17 — « Top » (`a`)
- 110×17 — « Importer un fichier » (`a`)
- 100×17 — « Téléchargements » (`a`)
- 72×17 — « Code source » (`a`)
- 90×17 — « Signaler un bug » (`a`)
- 50×17 — « Versions » (`a`)
- 85×17 — « Confidentialité » (`a`)
- 44×17 — « Licence » (`a`)

**Contrôles qui se recouvrent (1)** — l’un des deux est inatteignable :

- `a.skip-link` × `a.header-logo` sur 61×21 px

**Erreurs de console** :

- `Failed to load resource: the server responded with a status of 404 (Not Found)`


### Lecteur de roman — `lecture.html`

`Inko — Lecture` · 54 contrôles · 0 `h1` · 1 `main`

**Cibles tactiles sous 44 px (10)** :

- 59×17 — « Catalogue » (`a`)
- 70×17 — « Nouveautés » (`a`)
- 21×17 — « Top » (`a`)
- 110×17 — « Importer un fichier » (`a`)
- 100×17 — « Téléchargements » (`a`)
- 72×17 — « Code source » (`a`)
- 90×17 — « Signaler un bug » (`a`)
- 50×17 — « Versions » (`a`)
- 85×17 — « Confidentialité » (`a`)
- 44×17 — « Licence » (`a`)

**Contrôles qui se recouvrent (1)** — l’un des deux est inatteignable :

- `a.skip-link` × `a.header-logo` sur 61×21 px

**Erreurs de console** :

- `Failed to load resource: the server responded with a status of 404 (Not Found)`


### Collections — `collections.html`

`Inko — Mes listes` · 74 contrôles · 1 `h1` · 1 `main`

**Cibles tactiles sous 44 px (10)** :

- 59×17 — « Catalogue » (`a`)
- 70×17 — « Nouveautés » (`a`)
- 21×17 — « Top » (`a`)
- 110×17 — « Importer un fichier » (`a`)
- 100×17 — « Téléchargements » (`a`)
- 72×17 — « Code source » (`a`)
- 90×17 — « Signaler un bug » (`a`)
- 50×17 — « Versions » (`a`)
- 85×17 — « Confidentialité » (`a`)
- 44×17 — « Licence » (`a`)

**Contrôles qui se recouvrent (4)** — l’un des deux est inatteignable :

- `a.skip-link` × `a.header-logo` sur 61×21 px
- `button#btnNewList` × `button.itr-skip` sur 96×27 px
- `button#inkoConsentOk` × `a.mnav-item` sur 34×34 px
- `button#inkoConsentOk` × `a.mnav-item` sur 63×34 px

**Conteneurs de contenu vides (1)** :

- `div#listsGrid`

**Erreurs de console** :

- `Failed to load resource: the server responded with a status of 404 (Not Found)`


### Détail d’une collection — `collection-detail.html`

`Inko — Collection` · 60 contrôles · 0 `h1` · 1 `main`

**Cibles tactiles sous 44 px (10)** :

- 59×17 — « Catalogue » (`a`)
- 70×17 — « Nouveautés » (`a`)
- 21×17 — « Top » (`a`)
- 110×17 — « Importer un fichier » (`a`)
- 100×17 — « Téléchargements » (`a`)
- 72×17 — « Code source » (`a`)
- 90×17 — « Signaler un bug » (`a`)
- 50×17 — « Versions » (`a`)
- 85×17 — « Confidentialité » (`a`)
- 44×17 — « Licence » (`a`)

**Contrôles qui se recouvrent (7)** — l’un des deux est inatteignable :

- `a.skip-link` × `a.header-logo` sur 61×21 px
- `a` × `a` sur 95×9 px
- `a` × `a` sur 85×16 px
- `a` × `a.mnav-item` sur 49×15 px
- `a` × `a.mnav-item` sur 24×15 px
- `button#inkoConsentOk` × `a.mnav-item` sur 34×34 px
- `button#inkoConsentOk` × `a.mnav-item` sur 63×34 px

**Conteneurs de contenu vides (1)** :

- `div#cdHero`

**Erreurs de console** :

- `Failed to load resource: the server responded with a status of 404 (Not Found)`


### Journal de lecture — `notes.html`

`Inko — Journal de lecture` · 63 contrôles · 1 `h1` · 1 `main`

**Cibles tactiles sous 44 px (11)** :

- 233×39 — « Rechercher dans mes notes » (`input#jrSearch`)
- 59×17 — « Catalogue » (`a`)
- 70×17 — « Nouveautés » (`a`)
- 21×17 — « Top » (`a`)
- 110×17 — « Importer un fichier » (`a`)
- 100×17 — « Téléchargements » (`a`)
- 72×17 — « Code source » (`a`)
- 90×17 — « Signaler un bug » (`a`)
- 50×17 — « Versions » (`a`)
- 85×17 — « Confidentialité » (`a`)
- 44×17 — « Licence » (`a`)

**Contrôles qui se recouvrent (5)** — l’un des deux est inatteignable :

- `a.skip-link` × `a.header-logo` sur 61×21 px
- `button#jrRecit` × `button.itr-later` sur 64×12 px
- `button.btn` × `button.itr-btn` sur 126×22 px
- `button#inkoConsentOk` × `a.mnav-item` sur 34×34 px
- `button#inkoConsentOk` × `a.mnav-item` sur 63×34 px

**Erreurs de console** :

- `Failed to load resource: the server responded with a status of 404 (Not Found)`


### Notifications — `notifications.html`

`Inko — Notifications` · 69 contrôles · 1 `h1` · 1 `main`

**Cibles tactiles sous 44 px (11)** :

- 147×30 — « Fréquence de vérification des nouveaux c » (`select#ntFreq`)
- 59×17 — « Catalogue » (`a`)
- 70×17 — « Nouveautés » (`a`)
- 21×17 — « Top » (`a`)
- 110×17 — « Importer un fichier » (`a`)
- 100×17 — « Téléchargements » (`a`)
- 72×17 — « Code source » (`a`)
- 90×17 — « Signaler un bug » (`a`)
- 50×17 — « Versions » (`a`)
- 85×17 — « Confidentialité » (`a`)
- 44×17 — « Licence » (`a`)

**Contrôles qui se recouvrent (4)** — l’un des deux est inatteignable :

- `a.skip-link` × `a.header-logo` sur 61×21 px
- `button.btn` × `button.itr-btn` sur 126×26 px
- `button#inkoConsentOk` × `a.mnav-item` sur 34×34 px
- `button#inkoConsentOk` × `a.mnav-item` sur 63×34 px

**Erreurs de console** :

- `Failed to load resource: the server responded with a status of 404 (Not Found)`


### Téléchargements — `downloads.html`

`Inko — Téléchargements` · 60 contrôles · 1 `h1` · 1 `main`

**Cibles tactiles sous 44 px (10)** :

- 59×17 — « Catalogue » (`a`)
- 70×17 — « Nouveautés » (`a`)
- 21×17 — « Top » (`a`)
- 110×17 — « Importer un fichier » (`a`)
- 100×17 — « Téléchargements » (`a`)
- 72×17 — « Code source » (`a`)
- 90×17 — « Signaler un bug » (`a`)
- 50×17 — « Versions » (`a`)
- 85×17 — « Confidentialité » (`a`)
- 44×17 — « Licence » (`a`)

**Contrôles qui se recouvrent (5)** — l’un des deux est inatteignable :

- `a.skip-link` × `a.header-logo` sur 61×21 px
- `a` × `a.mnav-item` sur 49×17 px
- `a` × `a.mnav-item` sur 10×17 px
- `button#inkoConsentOk` × `a.mnav-item` sur 34×34 px
- `button#inkoConsentOk` × `a.mnav-item` sur 63×34 px

**Erreurs de console** :

- `Failed to load resource: the server responded with a status of 404 (Not Found)`


### Fichiers importés — `import.html`

`Inko — Importer un fichier` · 60 contrôles · 1 `h1` · 1 `main`

**Cibles tactiles sous 44 px (10)** :

- 59×17 — « Catalogue » (`a`)
- 70×17 — « Nouveautés » (`a`)
- 21×17 — « Top » (`a`)
- 110×17 — « Importer un fichier » (`a`)
- 100×17 — « Téléchargements » (`a`)
- 72×17 — « Code source » (`a`)
- 90×17 — « Signaler un bug » (`a`)
- 50×17 — « Versions » (`a`)
- 85×17 — « Confidentialité » (`a`)
- 44×17 — « Licence » (`a`)

**Contrôles qui se recouvrent (3)** — l’un des deux est inatteignable :

- `a.skip-link` × `a.header-logo` sur 61×21 px
- `button#inkoConsentOk` × `a.mnav-item` sur 34×34 px
- `button#inkoConsentOk` × `a.mnav-item` sur 63×34 px

**Erreurs de console** :

- `Failed to load resource: the server responded with a status of 404 (Not Found)`


### Lecteur de fichier — `localreader.html`

`Inko — Lecture` · 4 contrôles · 1 `h1` · 1 `main`

**Erreurs de console** :

- `Failed to load resource: the server responded with a status of 404 (Not Found)`


### Paramètres — `parametres.html`

`Inko — Paramètres` · 106 contrôles · 1 `h1` · 1 `main`

**Cibles tactiles sous 44 px (10)** :

- 59×17 — « Catalogue » (`a`)
- 70×17 — « Nouveautés » (`a`)
- 21×17 — « Top » (`a`)
- 110×17 — « Importer un fichier » (`a`)
- 100×17 — « Téléchargements » (`a`)
- 72×17 — « Code source » (`a`)
- 90×17 — « Signaler un bug » (`a`)
- 50×17 — « Versions » (`a`)
- 85×17 — « Confidentialité » (`a`)
- 44×17 — « Licence » (`a`)

**Contrôles qui se recouvrent (10)** — l’un des deux est inatteignable :

- `a.skip-link` × `a.header-logo` sur 61×21 px
- `button.btn` × `button#inkoConsentOk` sur 84×17 px
- `button.btn` × `a.mnav-item` sur 18×17 px
- `button.btn` × `a.mnav-item` sur 63×17 px
- `button.btn` × `a.mnav-item` sur 63×17 px
- `button.btn` × `a.mnav-item` sur 63×17 px
- `button.btn` × `a.mnav-item` sur 63×17 px
- `button.btn` × `button#mnavMore` sur 18×17 px
- `button#inkoConsentOk` × `a.mnav-item` sur 34×34 px
- `button#inkoConsentOk` × `a.mnav-item` sur 63×34 px

**Erreurs de console** :

- `Failed to load resource: the server responded with a status of 404 (Not Found)`


### Profil — `profil.html`

`Inko — Profil` · 70 contrôles · 1 `h1` · 1 `main`

**Débordements horizontaux (16)** — la page mesure 375 px pour 375 disponibles :

- `div.sidebar-section` dépasse de **185 px** (largeur 536 px)
- `nav.sidebar-nav` dépasse de **185 px** (largeur 536 px)
- `a.sidebar-nav-item` dépasse de **40 px** (largeur 106 px)
- `a.sidebar-nav-item` dépasse de **185 px** (largeur 141 px)
- `span.sidebar-nav-icon` dépasse de **70 px** (largeur 16 px)
- `div.sidebar-section` dépasse de **288 px** (largeur 95 px)
- `nav.sidebar-nav` dépasse de **288 px** (largeur 95 px)
- `a.sidebar-nav-item` dépasse de **288 px** (largeur 95 px)
- `span.sidebar-nav-icon` dépasse de **219 px** (largeur 16 px)
- `div.sidebar-section` dépasse de **562 px** (largeur 267 px)
- `nav.sidebar-nav` dépasse de **562 px** (largeur 267 px)
- `a.sidebar-nav-item` dépasse de **384 px** (largeur 88 px)
- … et 4 autres

**Cibles tactiles sous 44 px (10)** :

- 59×17 — « Catalogue » (`a`)
- 70×17 — « Nouveautés » (`a`)
- 21×17 — « Top » (`a`)
- 110×17 — « Importer un fichier » (`a`)
- 100×17 — « Téléchargements » (`a`)
- 72×17 — « Code source » (`a`)
- 90×17 — « Signaler un bug » (`a`)
- 50×17 — « Versions » (`a`)
- 85×17 — « Confidentialité » (`a`)
- 44×17 — « Licence » (`a`)

**Contrôles qui se recouvrent (3)** — l’un des deux est inatteignable :

- `a.skip-link` × `a.header-logo` sur 61×21 px
- `button#inkoConsentOk` × `a.mnav-item` sur 34×34 px
- `button#inkoConsentOk` × `a.mnav-item` sur 63×34 px

**Conteneurs de contenu vides (1)** :

- `div.profil-hero-bg`

**Erreurs de console** :

- `Failed to load resource: the server responded with a status of 404 (Not Found)`


### Statistiques — `stats.html`

`Inko — Statistiques` · 60 contrôles · 1 `h1` · 1 `main`

**Cibles tactiles sous 44 px (10)** :

- 59×17 — « Catalogue » (`a`)
- 70×17 — « Nouveautés » (`a`)
- 21×17 — « Top » (`a`)
- 110×17 — « Importer un fichier » (`a`)
- 100×17 — « Téléchargements » (`a`)
- 72×17 — « Code source » (`a`)
- 90×17 — « Signaler un bug » (`a`)
- 50×17 — « Versions » (`a`)
- 85×17 — « Confidentialité » (`a`)
- 44×17 — « Licence » (`a`)

**Contrôles qui se recouvrent (3)** — l’un des deux est inatteignable :

- `a.skip-link` × `a.header-logo` sur 61×21 px
- `button#inkoConsentOk` × `a.mnav-item` sur 34×34 px
- `button#inkoConsentOk` × `a.mnav-item` sur 63×34 px

**Erreurs de console** :

- `Failed to load resource: the server responded with a status of 404 (Not Found)`


### Sources — `sources.html`

`Inko — Sources` · 61 contrôles · 1 `h1` · 1 `main`

**Cibles tactiles sous 44 px (10)** :

- 59×17 — « Catalogue » (`a`)
- 70×17 — « Nouveautés » (`a`)
- 21×17 — « Top » (`a`)
- 110×17 — « Importer un fichier » (`a`)
- 100×17 — « Téléchargements » (`a`)
- 72×17 — « Code source » (`a`)
- 90×17 — « Signaler un bug » (`a`)
- 50×17 — « Versions » (`a`)
- 85×17 — « Confidentialité » (`a`)
- 44×17 — « Licence » (`a`)

**Contrôles qui se recouvrent (3)** — l’un des deux est inatteignable :

- `a.skip-link` × `a.header-logo` sur 61×21 px
- `button#inkoConsentOk` × `a.mnav-item` sur 34×34 px
- `button#inkoConsentOk` × `a.mnav-item` sur 63×34 px

**Erreurs de console** :

- `Failed to load resource: the server responded with a status of 404 (Not Found)`


### Liste — `liste.html`

`Inko — Liste partagée` · 60 contrôles · 0 `h1` · 1 `main`

**Cibles tactiles sous 44 px (10)** :

- 59×17 — « Catalogue » (`a`)
- 70×17 — « Nouveautés » (`a`)
- 21×17 — « Top » (`a`)
- 110×17 — « Importer un fichier » (`a`)
- 100×17 — « Téléchargements » (`a`)
- 72×17 — « Code source » (`a`)
- 90×17 — « Signaler un bug » (`a`)
- 50×17 — « Versions » (`a`)
- 85×17 — « Confidentialité » (`a`)
- 44×17 — « Licence » (`a`)

**Contrôles qui se recouvrent (10)** — l’un des deux est inatteignable :

- `a.skip-link` × `a.header-logo` sur 61×21 px
- `a.btn` × `button.itr-skip` sur 6×11 px
- `a` × `a` sur 6×17 px
- `a` × `button#inkoConsentOk` sur 95×9 px
- `a` × `a.mnav-item` sur 49×9 px
- `a` × `a.mnav-item` sur 61×9 px
- `a` × `button#inkoConsentOk` sur 85×13 px
- `a` × `a.mnav-item` sur 49×17 px
- `a` × `a.mnav-item` sur 52×17 px
- `button#inkoConsentOk` × `a.mnav-item` sur 34×34 px

**Erreurs de console** :

- `Failed to load resource: the server responded with a status of 404 (Not Found)`


### Profil public — `u.html`

`Inko — Profil` · 59 contrôles · 1 `h1` · 1 `main`

**Cibles tactiles sous 44 px (10)** :

- 59×17 — « Catalogue » (`a`)
- 70×17 — « Nouveautés » (`a`)
- 21×17 — « Top » (`a`)
- 110×17 — « Importer un fichier » (`a`)
- 100×17 — « Téléchargements » (`a`)
- 72×17 — « Code source » (`a`)
- 90×17 — « Signaler un bug » (`a`)
- 50×17 — « Versions » (`a`)
- 85×17 — « Confidentialité » (`a`)
- 44×17 — « Licence » (`a`)

**Contrôles qui se recouvrent (8)** — l’un des deux est inatteignable :

- `a.skip-link` × `a.header-logo` sur 61×21 px
- `a` × `a` sur 6×11 px
- `a` × `a` sur 95×14 px
- `a` × `button#inkoConsentOk` sur 85×17 px
- `a` × `a.mnav-item` sur 49×17 px
- `a` × `a.mnav-item` sur 52×17 px
- `button#inkoConsentOk` × `a.mnav-item` sur 34×34 px
- `button#inkoConsentOk` × `a.mnav-item` sur 63×34 px

**Erreurs de console** :

- `Failed to load resource: the server responded with a status of 404 (Not Found)`


### Retour AniList — `anilist.html`

`Inko — Connexion AniList` · 2 contrôles · 1 `h1` · 1 `main`

**Cibles tactiles sous 44 px (2)** :

- 169×38 — « Retour aux paramètres » (`a.primary`)
- 76×38 — « Accueil » (`a`)


### Confidentialité — `confidentialite.html`

`Inko — Confidentialité` · 26 contrôles · 1 `h1` · 1 `main`

**Cibles tactiles sous 44 px (2)** :

- 75×19 — « Paramètres » (`a`)
- 100×19 — « dépôt du projet » (`a`)

**Erreurs de console** :

- `Failed to load resource: the server responded with a status of 404 (Not Found)`


### Hors ligne — `offline.html`

`` · 0 contrôles · 0 `h1` · 0 `main`

**Débordements horizontaux (1)** — la page mesure 981 px pour 375 disponibles :

- `pre` dépasse de **597 px** (largeur 964 px)

**Erreurs de console** :

- `Failed to load resource: the server responded with a status of 404 (Not Found)`

