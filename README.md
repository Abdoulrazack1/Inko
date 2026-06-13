<div align="center">

<img src="assets/img/icon.svg" width="92" alt="Inko">

# Inko

**Tes mangas et light novels, partout. Lis, suis tes séries, reprends où tu t'es arrêté.**

Un lecteur de **mangas et de romans** moderne — web, PWA installable, application
desktop et mobile — construit sur un système d'extensions ouvert, dans l'esprit de
Mihon / Tachiyomi. Lis des mangas en images **et** des light/web novels en texte
(y compris des œuvres japonaises et chinoises traduites).

[![Node](https://img.shields.io/badge/Node-%E2%89%A518-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![MySQL](https://img.shields.io/badge/MySQL-8-4479A1?logo=mysql&logoColor=white)](https://www.mysql.com/)
[![PWA](https://img.shields.io/badge/PWA-installable-5A0FC8?logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps/)
[![Electron](https://img.shields.io/badge/Desktop-Electron-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![License](https://img.shields.io/badge/License-Apache_2.0-D22128?logo=apache&logoColor=white)](LICENSE)

[Démarrer](#installation-en-2-minutes) · [Fonctionnalités](#fonctionnalités) · [Extensions](#extensions) · [Desktop](#application-desktop) · [API](#api-rest)

</div>

---

## Aperçu

<img src="assets/screenshots/home.png" width="100%" alt="Accueil Inko">

<table>
<tr>
<td width="50%"><img src="assets/screenshots/reader.png" alt="Lecteur"></td>
<td width="50%"><img src="assets/screenshots/music.png" alt="Lecteur de musique"></td>
</tr>
<tr>
<td width="50%"><img src="assets/screenshots/catalogue.png" alt="Catalogue et aperçu au survol"></td>
<td width="50%"><img src="assets/screenshots/serie.png" alt="Page série"></td>
</tr>
</table>

---

## Pourquoi Inko

Les bons lecteurs de manga sont souvent enfermés dans un seul OS : Tachiyomi sur
Android, Paperback sur iOS, Komga sur un serveur lourd. Inko réunit tout dans une
seule base de code : web, PWA, desktop et mobile, avec un système d'extensions que
tu peux étendre toi-même.

| | Inko | Tachiyomi | Paperback | MangaDex Web |
|---|:---:|:---:|:---:|:---:|
| Multi-plateforme | Web, PWA, Desktop, Mobile | Android | iOS | Web |
| Mangas **et** romans (texte) | Oui | Manga | Manga | Manga |
| Œuvres JP/CN traduites | Oui (EN + FR) | Selon extension | Selon extension | Multi |
| Extensions ouvertes | Oui | Oui | Oui | Non |
| Auto-hébergeable | Oui (Node/MySQL) | Non | Non | Non |
| Sync compte (favoris, progression) | Oui | Partiel | Partiel | Oui |
| Musique pendant la lecture | Oui (Spotify, YouTube, local) | Non | Non | Non |
| Sans framework lourd (forkable) | Oui (Vanilla JS) | Non (Kotlin) | Non (Swift) | Non (React) |

---

## Fonctionnalités

**Lecteur**
- Trois modes : page, double page et webtoon (défilement vertical), mémorisés par série
- Transition de fin de chapitre avec enchaînement en un clic, scrubber de pages
- Lecteur de **light novels** dédié (taille, interligne, largeur, police, thèmes)
- Panneau de réglages : fond (sombre / noir / gris / sépia / clair), ajustement
  (original / largeur / hauteur), sens RTL ou LTR, luminosité, écart entre pages
- Reprise exacte à la page où tu t'es arrêté, préchargement du chapitre suivant
- Raccourcis clavier (pages, chapitre suivant/précédent, plein écran, réglages)
- Marquer un chapitre, les précédents, ou tout le manga comme lus

**Mangas & romans, séparés**
- Sources rangées en deux familles : **Mangas** (images) et **Romans** (texte)
- Bibliothèque, recherche et catalogue filtrables par type (badge ROMAN partout)
- L'app route automatiquement vers le bon lecteur selon le type de la source

**Bibliothèque**
- Favoris synchronisés sur ton compte
- Statuts de lecture (en cours, terminé, à lire, en pause, abandonné) et catégories
- Filtres par statut / catégorie / type, tri et recherche
- Vérification des nouveaux chapitres au lancement **et à la demande** (bouton
  Actualiser dans la barre du haut), badge de nouveautés sur la Bibliothèque
- Historique de lecture, notes et avis

**Hors-ligne**
- Téléchargement des chapitres (images **et** texte des romans) pour lire sans connexion
- Onglet dédié : liste par série, taille utilisée, lecture/suppression
- PWA installable, coquille de l'app utilisable hors-ligne

**Découverte**
- Hero d'accueil : carrousel des **dernières sorties** avec bouton « Lire le
  dernier chapitre » qui ouvre directement le chapitre, illustrations officielles
  (AniList), rail de vignettes, navigation clavier / tactile
- Recommandations personnalisées d'après tes favoris, recherche multi-sources
  (mangas + romans), aperçu riche au survol d'une carte
- Couvertures proxifiées et mises en cache côté serveur (chargement rapide,
  contournement de l'anti-hotlink)

**Musique intégrée**
- Lecteur en dock en bas de page (pas de fenêtre séparée), persistant entre les pages
- Stations un-clic pour lire : Lofi, Anime, Chillhop, Jazz, Synthwave, Pluie, Focus, Piano
- Fichiers audio locaux, YouTube (vrai contrôle via l'IFrame API), et Spotify
- Liaison de compte Spotify (OAuth) pour retrouver tes playlists

**Comptes liés & suivi**
- Composant unifié (profil + paramètres) pour lier/délier **Spotify** et **AniList**
- AniList : synchronisation automatique de ta progression et de tes statuts pendant
  que tu lis, + synchro manuelle de toute la bibliothèque

**Confort et compte**
- Thème clair, sombre ou automatique
- Export de tes données au format JSON
- Espace adulte masqué, protégé par un code
- Compte sécurisé (JWT + bcrypt), aucune télémétrie

---

## Installation en 2 minutes

Prérequis : Node.js 18 ou plus, MySQL 8 (Laragon, MAMP, Docker, etc.).

```bash
git clone https://github.com/Abdoulrazack1/Inko.git
cd Inko/server
npm install
npm run init-db        # crée la base et un compte démo
npm start              # http://localhost:8088
```

Ouvre http://127.0.0.1:8088. Les sources de référence (mangas : WeebCentral,
MangaDex, SushiScan ; romans : Royal Road, NovelFull, Chireads) sont incluses et
chargées automatiquement au démarrage.

> Astuce : certaines sources (NovelFull, proxy de couvertures) passent par `curl`,
> présent nativement sur Windows 10+, macOS et Linux.

| Compte démo | |
|---|---|
| Email | `demo@inko.app` |
| Mot de passe | `demo1234` |

---

## Extensions

Inko repose sur un framework d'extensions neutre : chaque source est un module
indépendant, et tu peux ajouter les tiennes. Une extension expose un contrat simple.

```js
// server/extensions/ma-source/index.js — source MANGA (images)
module.exports = {
  id: 'ma-source', name: 'Ma Source', lang: 'fr', version: '1.0.0',
  type: 'manga',   // 'manga' (défaut) ou 'novel'
  capabilities: ['popular', 'latest', 'search', 'manga', 'chapters', 'pages'],
  async popular({ limit, offset })      { /* ... */ },
  async latest ({ limit, offset })      { /* ... */ },
  async search ({ q, limit, offset, filters }) { /* ... */ },
  async getManga(id)                    { /* ... */ },
  async getChapters(mangaId, { lang })  { /* ... */ },
  async getPages(chapterId)             { /* ... */ },   // → { pages: [{ url }] }
};
```

Une source de **romans** déclare `type: 'novel'` et implémente `getText(chapterId)`
(qui renvoie `{ title, content }`, du HTML assaini) **au lieu** de `getPages`. Ses
chapitres s'ouvrent dans le lecteur de texte.

Dépose un dossier dans `server/extensions/`, redémarre, et la source apparaît
dans la page Sources de l'application.

Sources de référence fournies :

| Source | Langue | Type | Notes |
|---|---|---|---|
| WeebCentral | EN | Manga | Source par défaut, filtres genres/statut/tri natifs |
| MangaDex | Multi | Manga | Très grand catalogue, métadonnées riches, tri complet |
| SushiScan | FR | Manga | Expérimental, scraping HTML |
| Royal Road | EN | **Roman** | Web novels originaux EN (LitRPG, fantasy) |
| NovelFull | EN | **Roman** | Light novels **JP / CN / KR** traduits en anglais (xianxia, wuxia, isekai) |
| Chireads | FR | **Roman** | Novels **chinois** traduits en **français** (fantrad) |

Les sources de type **roman** (`type: 'novel'`) exposent `getText(chapterId)` au
lieu de `getPages()` : leurs chapitres s'ouvrent dans le lecteur texte
(`lecture.html`) avec réglages typographiques complets. Tu peux ainsi lire des
œuvres japonaises et chinoises traduites, pas seulement des originaux anglais.

---

## Application desktop

Inko se compile en application native via Electron. Le backend est embarqué :
un double-clic suffit, aucune console à lancer.

```bash
cd desktop
npm install
npm run dist          # Windows : dist/Inko-Setup-1.0.0.exe (NSIS)
# npm run dist:mac    -> .dmg        npm run dist:linux -> AppImage + .deb
```

## Application mobile

```bash
npm install -g @capacitor/cli
npx cap add android && npx cap sync android && npx cap open android
```

## Comptes liés (Spotify, AniList)

- **Spotify** (playlists dans le lecteur) : OAuth officiel, nécessite une app
  développeur gratuite. Étapes dans [`SPOTIFY_SETUP.md`](SPOTIFY_SETUP.md). Sans
  configuration, le lecteur reste utilisable via les stations, YouTube et les
  playlists publiques.
- **AniList** (suivi de lecture) : crée un client sur
  `anilist.co/settings/developer` avec l'URL de redirection
  `http://127.0.0.1:8088/anilist.html`, puis renseigne le Client ID
  (`ANILIST_CLIENT_ID` dans `server/.env`, ou via le menu Aide de l'app desktop).

---

## Architecture

```
inko/
  *.html                     pages (modules indépendants)
  chapitre.html / lecture.html  lecteur d'images / lecteur de texte (romans)
  assets/js/
    api.js                   client REST, cache du token, proxy des couvertures
    global.js                header/nav, recherche, comptes liés, MAJ chapitres,
                             routage lecteur (MH.readerHref) selon le type de source
    theme.js, nsfw.js        thème, espace +18
    storage.js               préférences locales
    card-hover.js            aperçu au survol
    music.js                 lecteur de musique intégré (dock)
    downloads.js             hors-ligne : images (Cache API) + texte (IndexedDB)
    anilist.js               suivi AniList (OAuth implicite + sync)
    {page}.js                logique de chaque page (vue pure)
  service-worker.js          PWA : cache des couvertures (/api/img) et des chapitres
  desktop/                   application Electron
  extensions-community/      sources de référence (mangas + romans)
  server/
    routes, controllers, middleware
    controllers/image.controller.js   proxy + cache des couvertures
    extensions/loader.js     chargement dynamique des sources (type manga|novel)
    lib/source-interface.js  contrat des extensions
    db/schema.sql            tables MySQL
```

Principe : séparation stricte entre logique et vue. Chaque page ne fait que du
DOM ; la logique vit dans `api.js` et le backend. Vanilla JS, sans étape de build,
lisible et facile à forker.

---

## API REST

Base `/api`. Voir le [détail des routes](server/routes/index.js).

```
Auth      POST /auth/register, /auth/login    PUT /auth/password,/auth/profile    POST /auth/delete
Sources   GET  /sources    /sources/:id/mangas/*
Mangas    GET  /mangas/{search,popular,latest,tags,:id,:id/chapters}
Lecture   GET  /chapters/:id/pages  (manga)    /chapters/:id/text  (roman)
Images    GET  /img?u=<url>         (proxy + cache des couvertures)
Compte    GET/PUT /me/{favorites,library,progress,lists,settings,ratings,updates}    /me/export
Read      POST /me/read-chapters    /me/read-chapters/bulk    PUT /me/favorites/:id/category
Artwork   GET  /artwork?title=...   (illustrations officielles AniList)
Spotify   GET  /spotify/{login,callback,status,playlists,recent,top,saved,now-playing}    POST /spotify/disconnect
AniList   GET  /anilist/{config,similar}
Social    GET/POST /comments/:id    GET /comments-recent    /ratings/:id    GET /me/stats
```

---

## Légalité et confidentialité

Inko est un framework de lecture neutre. Le projet ne distribue aucun contenu :
les extensions agissent comme un client personnel, à la manière de Tachiyomi ou
Paperback, et restent sous la responsabilité de l'utilisateur. Aucune image n'est
stockée côté serveur et il n'y a aucune télémétrie. Usage strictement personnel.
Voir [`NOTICE.md`](NOTICE.md).

---

## Contribuer

Les contributions sont bienvenues : nouvelles extensions (mangas ou romans),
support EPUB/CBZ, traductions, thèmes. Ouvre une issue ou une pull request.

Distribué sous licence Apache 2.0.
