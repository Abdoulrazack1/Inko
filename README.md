<div align="center">

<img src="assets/img/icon.svg" width="92" alt="Inko">

# Inko

**Ta bibliothèque manga, partout. Lis, suis tes séries, reprends où tu t'es arrêté.**

Un lecteur de mangas moderne — web, PWA installable, application desktop et mobile —
construit sur un système d'extensions ouvert, dans l'esprit de Mihon / Tachiyomi.

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
| Extensions ouvertes | Oui | Oui | Oui | Non |
| Auto-hébergeable | Oui (Node/MySQL) | Non | Non | Non |
| Sync compte (favoris, progression) | Oui | Partiel | Partiel | Oui |
| Musique pendant la lecture | Oui (Spotify, YouTube, local) | Non | Non | Non |
| Sans framework lourd (forkable) | Oui (Vanilla JS) | Non (Kotlin) | Non (Swift) | Non (React) |

---

## Fonctionnalités

**Lecture**
- Trois modes : page, double page et webtoon (défilement vertical)
- Sens de lecture RTL ou LTR au choix
- Reprise exacte à la page où tu t'es arrêté
- Zoom, plein écran, préchargement et mode économie de données

**Bibliothèque**
- Favoris synchronisés sur ton compte
- Détection automatique des nouveaux chapitres des séries suivies
- Listes personnelles, statuts de lecture, notes et avis
- Historique de lecture

**Découverte**
- Recherche instantanée avec autocomplétion
- Aperçu riche au survol d'une carte : couverture, statut, genres, résumé
- Plusieurs sources interchangeables (voir Extensions)

**Musique pendant la lecture**
- Lecteur en fenêtre détachée qui reste actif pendant la navigation
- Fichiers audio locaux, embeds YouTube et Spotify
- Liaison de compte Spotify (OAuth) pour retrouver tes playlists, plus une
  écoute immédiate via des playlists publiques sans connexion

**Confort et compte**
- Thème clair, sombre ou automatique
- PWA installable et utilisable hors-ligne
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

Ouvre http://127.0.0.1:8088. Les sources de référence (WeebCentral, MangaDex,
SushiScan) sont incluses et chargées automatiquement au démarrage.

| Compte démo | |
|---|---|
| Email | `demo@inko.app` |
| Mot de passe | `demo1234` |

---

## Extensions

Inko repose sur un framework d'extensions neutre : chaque source est un module
indépendant, et tu peux ajouter les tiennes. Une extension expose un contrat simple.

```js
// server/extensions/ma-source/index.js
module.exports = {
  id: 'ma-source', name: 'Ma Source', lang: 'fr', version: '1.0.0',
  capabilities: ['popular', 'latest', 'search', 'manga', 'chapters', 'pages'],
  async popular({ limit, offset })      { /* ... */ },
  async latest ({ limit, offset })      { /* ... */ },
  async search ({ q, limit, offset })   { /* ... */ },
  async getManga(id)                    { /* ... */ },
  async getChapters(mangaId, { lang })  { /* ... */ },
  async getPages(chapterId)             { /* ... */ },
};
```

Dépose un dossier dans `server/extensions/`, redémarre, et la source apparaît
dans la page Sources de l'application.

Sources de référence fournies :

| Source | Langue | Notes |
|---|---|---|
| WeebCentral | EN | Source par défaut, héberge les pages des titres populaires |
| MangaDex | Multi | Très grand catalogue et métadonnées riches |
| SushiScan | FR | Expérimental, scraping HTML |

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

## Lier un compte Spotify

La liaison de compte utilise l'OAuth officiel de Spotify et nécessite une
application développeur (gratuite). Les étapes détaillées sont dans
[`SPOTIFY_SETUP.md`](SPOTIFY_SETUP.md). Sans configuration, le lecteur reste
utilisable via les playlists publiques et YouTube.

---

## Architecture

```
inko/
  *.html                     pages (modules indépendants)
  assets/js/
    api.js                   client REST + cache du token
    theme.js, nsfw.js        thème, espace +18
    storage.js               préférences locales
    card-hover.js            aperçu au survol
    player.js                lecteur de musique
    {page}.js                logique de chaque page (vue pure)
  service-worker.js          PWA : cache des couvertures, hors-ligne
  desktop/                   application Electron
  extensions-community/      sources de référence
  server/
    routes, controllers, middleware
    extensions/loader.js     chargement dynamique des sources
    db/schema.sql            tables MySQL
```

Principe : séparation stricte entre logique et vue. Chaque page ne fait que du
DOM ; la logique vit dans `api.js` et le backend. Vanilla JS, sans étape de build,
lisible et facile à forker.

---

## API REST

Base `/api`. Voir le [détail des routes](server/routes/index.js).

```
Auth      POST /auth/register, /auth/login    PUT /auth/password    POST /auth/delete
Sources   GET  /sources    /sources/:id/mangas/*
Mangas    GET  /mangas/{search,popular,latest,:id,:id/chapters}    /chapters/:id/pages
Compte    GET/PUT /me/{favorites,library,progress,lists,settings,ratings,updates}    /me/export
Spotify   GET /spotify/{login,callback,status,playlists}    POST /spotify/disconnect
Social    GET/POST /comments/:id    /ratings/:id    GET /me/stats
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

Les contributions sont bienvenues : nouvelles extensions, support EPUB/CBZ,
téléchargement hors-ligne, traductions. Ouvre une issue ou une pull request.

Distribué sous licence Apache 2.0.
