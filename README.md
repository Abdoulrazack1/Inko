<div align="center">

<img src="assets/img/icon.svg" width="92" alt="Inko">

# Inko

**Tes mangas et light novels, partout. Lis, suis tes séries, reprends où tu t'es arrêté.**

Un lecteur de **mangas et de romans** moderne — web, PWA installable, application
desktop (Electron) et mobile (Capacitor) — construit sur un système d'extensions
ouvert, dans l'esprit de Mihon / Tachiyomi. Lis des mangas en images **et** des
light/web novels en texte, y compris des œuvres japonaises et chinoises traduites.

[![Node](https://img.shields.io/badge/Node-%E2%89%A518-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![MySQL](https://img.shields.io/badge/MySQL-8-4479A1?logo=mysql&logoColor=white)](https://www.mysql.com/)
[![PWA](https://img.shields.io/badge/PWA-installable-5A0FC8?logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps/)
[![Electron](https://img.shields.io/badge/Desktop-Electron-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![License](https://img.shields.io/badge/License-Apache_2.0-D22128?logo=apache&logoColor=white)](LICENSE)

[Démarrer](#installation-en-2-minutes) · [Fonctionnalités](#fonctionnalités) · [Comparatif](#pourquoi-inko--comparatif) · [Extensions](#extensions) · [Desktop](#application-desktop) · [API](#api-rest)

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

## Pourquoi Inko — comparatif

Les bons lecteurs sont souvent enfermés dans un seul OS (Mihon/Tachiyomi sur
Android, Paperback sur iOS) ou demandent un serveur lourd (Komga/Kavita). Inko
réunit tout dans **une seule base de code** — web, PWA, desktop, mobile — avec un
système d'extensions que tu peux étendre toi-même, et reste **centré sur la
lecture** (pas de réseau social).

| | **Inko** | Mihon / Tachiyomi | Paperback | Komga / Kavita | MangaDex Web |
|---|:---:|:---:|:---:|:---:|:---:|
| Plateformes | Web · PWA · Desktop · Mobile | Android | iOS | Serveur + web | Web |
| Mangas **et** romans (texte) | ✅ | Manga | Manga | Les deux | Manga |
| Œuvres JP/CN traduites | ✅ (EN + FR) | Selon ext. | Selon ext. | Selon import | Multi |
| Extensions ouvertes | ✅ | ✅ | ✅ | ❌ | ❌ |
| Auto-hébergeable | ✅ (Node/MySQL) | ❌ | ❌ | ✅ (lourd) | ❌ |
| Sync compte (favoris, progression) | ✅ | Partiel | Partiel | ✅ | ✅ |
| Tracking AniList | ✅ (auto + manuel) | ✅ | ✅ | Partiel | — |
| Lecture hors-ligne (images **+** texte) | ✅ | ✅ | ✅ | ✅ | ❌ |
| Bibliothèque visible hors connexion | ✅ (miroir local) | ✅ | ✅ | ❌ | ❌ |
| Mode incognito (lecture privée) | ✅ | ✅ | ❌ | ❌ | ❌ |
| Filtres chapitres (lus / non lus) | ✅ | ✅ | ✅ | ✅ | Partiel |
| Thèmes (clair / sombre / **AMOLED**) + accent | ✅ | ✅ | Partiel | ✅ | Partiel |
| Palette de commandes (Ctrl/Cmd+K) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Objectifs, défis & badges de lecture | ✅ | ❌ | ❌ | Partiel | ❌ |
| Connexion Google (SSO) | ✅ | ❌ | ❌ | Selon | ✅ |
| Musique pendant la lecture | ✅ (Spotify/YouTube/local) | ❌ | ❌ | ❌ | ❌ |
| Sans framework lourd (forkable) | ✅ (Vanilla JS) | Kotlin | Swift | Kotlin/Angular | React |

---

## Fonctionnalités

### Lecteur d'images (manga)
- **Modes** : page, **double planche collée** (vraie spread, sens manga respecté),
  webtoon (défilement vertical) — mémorisés **par série**
- **Défilement retravaillé** : molette et flèches défilent *dans* une page trop
  grande, puis **tournent la page** aux extrémités (les deux sens)
- **Vrai plein écran** (OS) + **mode immersif** (interface masquée, touche `I`)
- **Confort des yeux** : filtre lumière chaude (type f.lux), luminosité, fond
  (sombre / noir / gris / sépia / clair), ajustement (original / largeur / hauteur)
- **Garde l'écran allumé** pendant la lecture (Wake Lock)
- **Minuteur de lecture** (pause auto après 15/30/45/60 min)
- Défilement automatique (webtoon) à vitesse réglable, sens **RTL / LTR**
- Reprise exacte à la page, préchargement du chapitre suivant, miniatures, scrubber
- Sauts **Début / Fin**, **chapitre au hasard**, transition de fin de chapitre
- Marquer **lu / non lu en un clic**, les précédents, ou tout le manga ; **signets** de page
- **Temps de lecture restant estimé**

### Lecteur de romans (light/web novels)
- Lecteur texte dédié : taille, interligne, largeur de colonne, police, thèmes
- Téléchargement hors-ligne du texte, reprise au % de défilement
- Sources JP / CN / KR traduites (EN + FR)

### Bibliothèque
- Favoris **synchronisés** sur ton compte, **et visibles hors connexion** (miroir local)
- Statuts (en cours, terminé, à lire, en pause, abandonné) et catégories
- **Épingler** des séries · **barre de progression** par carte · résumé en-tête
- Filtres : statut / catégorie / type / **source** / **non-lus** · densité compact/confort
- Tris : récents, **récemment lus**, titre, non-lus, progression
- **Notes personnelles** privées · **temps de lecture estimé** par série
- **Au hasard dans ma bibliothèque**, bouton **Continuer** (reprise instantanée)
- Onglet **Signets**, onglet **Mises à jour** (nouveaux chapitres + notifications navigateur)
- **Export / Import JSON** (sauvegarde & restauration complète)

### Objectifs, stats & gamification
- **Objectif hebdomadaire** + **défi annuel** (façon Goodreads) avec progression
- **Badges / accomplissements** (chapitres lus, séries, streak, sources, romans…)
- Streak de jours d'affilée, répartition de la bibliothèque par statut,
  heatmap d'activité, activité récente

### Découverte
- Hero d'accueil : carrousel des **dernières sorties** (lecture directe du dernier
  chapitre), illustrations officielles AniList, **fond toujours rempli** (dégradé de repli)
- Recommandations d'après tes genres, recherche **multi-sources** avec filtre par
  type, **historique** et **suggestions populaires**
- Lecture aléatoire, aperçu riche au survol, couvertures proxifiées & mises en cache

### Suivi & comptes
- Inscription / connexion **email** ou **Google (Gmail)** en un clic
- **AniList** : synchronisation automatique de progression & statuts pendant la
  lecture (+ synchro manuelle de toute la bibliothèque)
- **Configuration dans l'app, sans redémarrage** : colle ton Client ID Google /
  AniList depuis les Paramètres (ou la carte de connexion) — pris en compte immédiatement
- **Spotify** (OAuth) : playlists dans le lecteur de musique intégré

### Confort, design & vie privée
- Thèmes **clair / sombre / AMOLED / auto** + **couleur d'accent** personnalisable
- **Palette de commandes** (`Ctrl/Cmd+K`) : recherche + navigation rapide
- **Raccourcis clavier globaux** (`/` recherche, `r` aléatoire, `c` continuer, `b`
  bibliothèque, `?` aide) · bouton flottant **Retour en haut**
- **Mode incognito** : lecture privée, ne sauve ni progression ni historique
- Icônes **SVG** (interface nette, sans dépendance), avatar **emoji** au choix
- Espace adulte masqué (code), compte sécurisé (JWT + bcrypt), **aucune télémétrie**

---

## Installation en 2 minutes

Prérequis : Node.js 18+, MySQL 8 (Laragon, MAMP, Docker…).

```bash
git clone https://github.com/Abdoulrazack1/Inko.git
cd Inko/server
npm install
npm run init-db        # crée la base + un compte démo
npm start              # http://localhost:8088
```

Ouvre http://127.0.0.1:8088. Les sources de référence (mangas : WeebCentral,
MangaDex, SushiScan ; romans : Royal Road, NovelFull, Chireads) sont incluses et
chargées au démarrage.

> Astuce : certaines sources (NovelFull, proxy de couvertures) passent par `curl`,
> présent nativement sur Windows 10+, macOS et Linux.

| Compte démo | |
|---|---|
| Email | `demo@inko.app` |
| Mot de passe | `demo1234` |

---

## Extensions

Inko repose sur un framework d'extensions neutre : chaque source est un module
indépendant que tu peux étendre.

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
(qui renvoie `{ title, content }`, HTML assaini) **au lieu** de `getPages`. Ses
chapitres s'ouvrent automatiquement dans le lecteur de texte.

Dépose un dossier dans `server/extensions/`, redémarre, et la source apparaît dans
la page Sources.

| Source | Langue | Type | Notes |
|---|---|---|---|
| WeebCentral | EN | Manga | Source par défaut, filtres genres/statut/tri natifs |
| MangaDex | Multi | Manga | Très grand catalogue, métadonnées riches |
| SushiScan | FR | Manga | Catalogue complet via index sitemap (~2100 séries) |
| Royal Road | EN | **Roman** | Web novels originaux EN (LitRPG, fantasy) |
| NovelFull | EN | **Roman** | Light novels JP / CN / KR traduits (xianxia, isekai…) |
| Chireads | FR | **Roman** | Novels chinois traduits en français (fantrad) |

---

## Application desktop

Application native via Electron, backend embarqué — un double-clic suffit.

```bash
cd desktop
npm install
npm run dist          # Windows : dist/Inko-Setup-1.0.0.exe (NSIS) + mise à jour
                      # automatique de l'app installée (déploiement local)
# npm run build:win   -> build seul, sans déployer
# npm run dist:mac    -> .dmg        npm run dist:linux -> AppImage + .deb
```

> `npm run dist` reconstruit **et** met à jour l'app installée localement (copie
> directe par-dessus `%LOCALAPPDATA%\Programs\Inko`) — fini les « retours à
> l'ancienne version » après un build.

## Application mobile

```bash
npm install -g @capacitor/cli
npx cap add android && npx cap sync android && npx cap open android
```

## Connexion Google & comptes liés

Tout se configure **dans l'app, sans redémarrage** (ou via `server/.env`) :

- **Google (Gmail)** — Paramètres → *Connexion Google* : colle un *OAuth Client ID*
  « Application Web » créé sur `console.cloud.google.com/apis/credentials` (origines
  JS autorisées : `http://127.0.0.1:8088` et `http://localhost:8088`). Vide = bouton
  Google masqué proprement, l'email reste pleinement fonctionnel.
- **AniList** — carte de connexion (Paramètres/Profil) : crée un client sur
  `anilist.co/settings/developer` (Redirect URL : `http://127.0.0.1:8088/anilist.html`),
  colle l'**ID client**, puis « Connecter ». Implicit grant, le secret n'est pas requis.
- **Spotify** — `server/.env` (`SPOTIFY_CLIENT_ID` + `SPOTIFY_CLIENT_SECRET`),
  Redirect URI `http://127.0.0.1:8088/api/spotify/callback`. Détails dans
  [`SPOTIFY_SETUP.md`](SPOTIFY_SETUP.md). Sans config, stations/YouTube restent dispos.

Les identifiants collés dans l'app sont stockés localement
(`server/config/*.json`, gitignorés ; ou `inko-config.json` côté desktop).

---

## Architecture

```
inko/
  *.html                        pages (modules indépendants)
  chapitre.html / lecture.html  lecteur d'images / lecteur de texte (romans)
  assets/js/
    api.js          client REST, cache du token, proxy des couvertures
    global.js       header/nav, recherche, palette de commandes, comptes liés,
                    icônes SVG (MH.icon), incognito, routage lecteur (MH.readerHref)
    theme.js        thème clair/sombre/AMOLED + couleur d'accent
    storage.js      préférences locales + miroir bibliothèque (hors-ligne)
    userdata.js     notes, signets, épingles, objectifs (sync /me/settings + local)
    nsfw.js, card-hover.js, music.js, downloads.js, anilist.js
    {page}.js       logique de chaque page (vue pure)
  service-worker.js PWA : network-first (code), cache des couvertures & chapitres
  desktop/          application Electron (+ scripts/deploy-local.ps1)
  extensions-community/  sources de référence (mangas + romans)
  server/
    routes, controllers, middleware
    controllers/image.controller.js   proxy + cache des couvertures (curl)
    extensions/loader.js              chargement dynamique (type manga|novel)
    config/                           clés Google/AniList collées dans l'app (gitignoré)
    db/schema.sql                     tables MySQL (migrations douces)
```

Principe : séparation stricte logique / vue. Chaque page ne fait que du DOM ; la
logique vit dans `api.js` et le backend. Vanilla JS, **sans étape de build**,
lisible et facile à forker.

---

## API REST

Base `/api`. Voir le [détail des routes](server/routes/index.js).

```
Auth      POST /auth/register, /auth/login   PUT /auth/password, /auth/profile   POST /auth/delete
Google    GET  /auth/providers   POST /auth/google   GET/PUT /auth/google-config
Sources   GET  /sources    /sources/:id/mangas/*
Mangas    GET  /mangas/{search,popular,latest,tags,:id,:id/chapters}    GET /search-all
Lecture   GET  /chapters/:id/pages  (manga)    /chapters/:id/text  (roman)
Images    GET  /img?u=<url>         (proxy + cache des couvertures)
Compte    GET/PUT /me/{favorites,library,progress,lists,settings,ratings,updates}   /me/export, /me/import
          (notes, signets, épingles, objectifs : stockés dans /me/settings)
Read      POST /me/read-chapters   /me/read-chapters/bulk   PUT /me/favorites/:id/category
Stats     GET  /me/stats   /me/events   /ratings/:id
Artwork   GET  /artwork?title=...   (illustrations officielles AniList)
Spotify   GET  /spotify/{login,callback,status,playlists,recent,top,saved,now-playing}   POST /spotify/disconnect
AniList   GET  /anilist/{config,similar}    PUT /anilist/config
```

---

## Légalité et confidentialité

Inko est un framework de lecture neutre. Le projet ne distribue aucun contenu :
les extensions agissent comme un client personnel, à la manière de Mihon ou
Paperback, sous la responsabilité de l'utilisateur. Aucune image n'est stockée
côté serveur, **aucune télémétrie**. Usage strictement personnel. Voir
[`NOTICE.md`](NOTICE.md).

---

## Contribuer

Contributions bienvenues : nouvelles extensions (mangas ou romans), support
EPUB/CBZ, traductions, thèmes, trackers supplémentaires (MAL, Kitsu). Ouvre une
issue ou une pull request.

Distribué sous licence **Apache 2.0**.
