<div align="center">

<img src="assets/img/icon.svg" width="92" alt="Inko">

# Inko

**Tes mangas, light novels et livres — dans une vraie app, sans compte, sans pub.**

Un lecteur de **mangas, romans et livres** personnel et local, dans l'esprit de
Mihon / Tachiyomi : tu installes l'app, tu lis. Pas d'inscription, pas de mot de
passe — ta bibliothèque, ta progression et ton journal de lecture vivent chez
toi. Construit sur un système d'extensions ouvert (mangas en images, light/web
novels traduits, classiques du domaine public via Project Gutenberg) avec
notifications de nouveaux chapitres, journal privé et import de tes propres
fichiers EPUB/CBZ/PDF.

[![Tauri](https://img.shields.io/badge/Desktop-Tauri_2-24C8DB?logo=tauri&logoColor=white)](https://tauri.app/)
[![Node](https://img.shields.io/badge/Node-%E2%89%A518-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![MySQL](https://img.shields.io/badge/MySQL-8-4479A1?logo=mysql&logoColor=white)](https://www.mysql.com/)
[![PWA](https://img.shields.io/badge/PWA-installable-5A0FC8?logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps/)
[![License](https://img.shields.io/badge/License-Apache_2.0-D22128?logo=apache&logoColor=white)](LICENSE)

[App Windows](#application-windows-tauri) · [Démarrer en dev](#démarrer-en-développement) · [Fonctionnalités](#fonctionnalités) · [Design](#design--lédition-washi) · [Extensions](#extensions) · [API](#api-rest)

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

## Philosophie : local d'abord, zéro compte

Comme Mihon/Tachiyomi, **Inko n'a pas d'écran de connexion**. Chaque
installation est personnelle : au premier lancement, l'app crée (ou adopte) ton
profil local et tout t'appartient — bibliothèque, progression, notes, signets.
Les seuls comptes externes sont **optionnels** : AniList (synchronisation de
suivi) et Spotify (musique pendant la lecture).

|  | **Inko** | Mihon | Suwayomi | Komga/Kavita |
|---|---|---|---|---|
| Mangas **et** romans **et** livres | ✅ | ❌ (mangas) | ❌ (mangas) | ✅ (fichiers) |
| Sans compte, local d'abord | ✅ | ✅ | ✅ | ❌ (comptes) |
| Journal de lecture privé | ✅ | ❌ | ❌ | ❌ |
| Notifications push nouveaux chapitres | ✅ (app fermée incluse) | ✅ (mobile) | ❌ | ❌ |
| App Windows native (WebView2) + web + PWA | ✅ | ❌ (Android) | ✅ (web) | ✅ (web) |
| Import local EPUB/CBZ/PDF | ✅ | ✅ | ❌ | ✅ |
| Sans pub, sans télémétrie | ✅ | ✅ | ✅ | ✅ |

---

## Application Windows (Tauri)

L'app de bureau est construite avec **Tauri 2** : elle utilise le WebView2
natif de Windows — **pas de Chromium embarqué**, un binaire d'environ 10 Mo,
un installeur d'environ 30 Mo, un démarrage rapide.

```bash
cd desktop-tauri
npm install
npm run build      # prep (ressources + sidecar node) + tauri build
# → src-tauri/target/release/bundle/nsis/Inko_2.0.0_x64-setup.exe
```

Architecture : le backend Node (Express + extensions) est embarqué en
**sidecar** ; au lancement, un écran de démarrage attend `/api/health` puis
bascule sur l'app. Seul prérequis externe : **MySQL** sur `127.0.0.1:3306`
(Laragon, MAMP, Docker…).

## Démarrer en développement

Prérequis : Node.js 18+, MySQL 8.

```bash
git clone https://github.com/Abdoulrazack1/Inko.git
cd Inko/server
npm install
npm run init-db        # crée la base
npm start              # http://localhost:8088 — c'est tout, pas de compte à créer
```

Configuration fine (SMTP, CORS, rate limiting…) dans `server/.env`
([`server/.env.example`](server/.env.example)). `LOCAL_MODE=0` ré-expose une
instance multi-comptes classique si tu veux héberger pour plusieurs personnes.

---

## Fonctionnalités

### Lecture
- **Lecteur manga** : page/page, défilement (webtoon), double-page, sens RTL/LTR,
  zoom, plein écran, mode immersif, défilement automatique, gestes tactiles
  (swipe, double-tap zoom), navigation clavier complète, préchargement,
  partage de chapitre, téléchargement hors-ligne
- **Lecteur de romans** : typographie réglable, synthèse vocale (TTS) avec
  surlignage du paragraphe lu, progression fine
- **Import local** : EPUB (TTS + reprise), CBZ (décompression parallèle),
  PDF (pdf.js) — progression sauvegardée partout
- Le lecteur reste **toujours sombre**, quel que soit le thème de l'app

### Journal de lecture
- **Notes privées pendant la lecture** (touche `J`) : contexte capturé
  automatiquement (série · chapitre · page), humeurs en étiquettes, édition
- **Page « Journal »** : timeline par série, recherche plein texte, statistiques
- **« Mon avis »** par œuvre sur la fiche série, en plus de la note en étoiles

### Bibliothèque & suivi
- Étagère unifiée : « Reprendre où j'en étais », corne de page pliée sur les
  couvertures avec signet/reprise, vue grille/liste, sélection multiple,
  filtres, recherche instantanée, export/import JSON
- **« Mettre à jour » intelligent** : ignore Terminé/Abandonné par défaut,
  échecs de vérification visibles, vérification par série, garde-fou serveur
- **Notifications de nouveaux chapitres** : tâche de fond + Web Push
- Compteur de non-lus **sans plafond** (séries de 1 000+ chapitres : ok)

### Découverte
- Catalogue par source **ou « Toutes les sources » à la fois** (fusion + dédup
  par titre, badge de provenance)
- Recherche globale live multi-sources, dédupliquée, badge « Déjà dans ma
  bibliothèque », suggestions personnalisées
- « Tu aimeras aussi » : recommandations AniList vérifiées sur tes sources
- Hero d'accueil en **3D temps réel** (three.js, local)

### Confort
- PWA installable, hors-ligne (téléchargements), thèmes Washi/Sumi/AMOLED,
  accent personnalisable, palette de commandes `Ctrl+K`, lecteur musique
  (stations, Spotify, YouTube), profil avec badges et heatmap — **iconographie
  100 % SVG**, zéro emoji
- Export complet de tes données, suppression totale, aucune télémétrie

---

## Design — l'édition « Washi »

- **Le mode clair est la référence** (« Washi », papier `#eeece6`) ; le sombre
  (« Sumi », `#111113`) en est la seconde édition
- **Deux accents fonctionnels** : Kakishibu `#c1531b` code le manga, Ai
  `#3d5170` le roman ; Hanko `#a83232` est réservé aux signaux forts
- **Signature** : la corne de page pliée (screentone dans le pli)
- Typographie à 3 rôles : Archivo Narrow (display), IBM Plex Sans (interface),
  Bitter (lecture longue)
- Surfaces flottantes en **liquid glass** (verre translucide, arête spéculaire) ;
  les zones toujours sombres (hero, lecteur, en-tête du profil) forcent leur
  encre claire quel que soit le thème

---

## Extensions

Les sources de contenu sont des **modules indépendants**
(`server/extensions/<id>/index.js`), installables et mises à jour **en un
clic** depuis la page Sources (rechargement à chaud). Chaque source peut être
testée (« Tester la connexion »), désactivée, et son état de santé est
journalisé. On peut aussi **installer une extension tierce par URL directe**
(avec avertissement de sécurité).

```js
module.exports = {
  id: 'masource', name: 'Ma Source', lang: 'fr', version: '1.0.0',
  baseUrl: 'https://…', nsfw: false,
  type: 'manga',          // 'manga' (images) | 'novel' | 'book' (texte)
  unit: 'chapter',        // 'chapter' | 'volume'  → affichage « Chap. » / « Tome »
  capabilities: ['popular', 'latest', 'search', 'manga', 'chapters', 'pages'],

  async popular({ limit, offset })                    { /* → MangasPage  */ },
  async latest({ limit, offset })                     { /* → MangasPage  */ },
  async search({ q, limit, offset, filters })         { /* → MangasPage  */ },
  async getManga(id)                                  { /* → Manga       */ },
  async getChapters(mangaId, { lang, limit })         { /* → ChaptersPage — liste COMPLÈTE si pas de limit */ },
  async getPages(chapterId)                           { /* → PagesPayload (manga) */ },
  async getText(chapterId)                            { /* → TextPayload  (novel/book) */ },
};
```

Contrat complet : [`server/lib/source-interface.js`](server/lib/source-interface.js).
Catalogue communautaire versionné : [`extensions-community/`](extensions-community/)
— sources fournies : MangaDex, Weeb Central, SushiScan, Royal Road, NovelFull,
NovelBin, Chireads, Project Gutenberg.

---

## Application mobile

```bash
npm install -g @capacitor/cli
npx cap add android && npx cap sync android && npx cap open android
```

## Comptes liés (optionnels)

- **AniList** — carte de connexion (Paramètres/Profil) : crée un client sur
  `anilist.co/settings/developer` (Redirect URL : `http://127.0.0.1:8088/anilist.html`),
  colle l'ID client, « Connecter ». La synchro respecte la limite de l'API
  (~30 req/min) : elle s'espace et reprend seule en cas de 429.
- **Spotify** — `server/.env` (`SPOTIFY_CLIENT_ID` + `SPOTIFY_CLIENT_SECRET`),
  Redirect URI `http://127.0.0.1:8088/api/spotify/callback` — détails dans
  [`SPOTIFY_SETUP.md`](SPOTIFY_SETUP.md). Sans config, stations/YouTube restent dispos.

---

## Architecture

```
Inko/
├── *.html                  # Pages (vanilla JS, zéro framework, zéro build)
├── assets/
│   ├── css/                # global.css (design system Washi/Sumi) + 1 CSS/page
│   ├── js/                 # api.js, global.js, 1 module/page, notes-ui, hero3d…
│   └── vendor/             # jszip, pdf.js, three.js (tout en local, CSP stricte)
├── server/                 # Express + MySQL (backend embarqué dans l'app desktop)
│   ├── controllers/        # auth (mode local), manga, user, notes, extensions…
│   ├── extensions/         # sources chargées à chaud (contrat Mihon-like)
│   ├── lib/                # mailer, push, notify, updates, source-health…
│   ├── middleware/         # sécurité (CSP/HSTS prod, rate limit)
│   └── db/                 # schema.sql + migrations idempotentes
├── extensions-community/   # catalogue de sources versionné (versions.json)
└── desktop-tauri/          # app Windows (Tauri 2, WebView2, sidecar Node)
```

> L'administration (modération, rôles, statut des sources multi-utilisateurs)
> vivra dans une application dédiée **Inko Admin** — l'app de lecture reste
> centrée sur la lecture.

### Déploiement en ligne (Docker)

```bash
docker compose up -d       # backend Node 22 + MySQL 8, HEALTHCHECK inclus
```

En production multi-comptes : `LOCAL_MODE=0`, `NODE_ENV=production` (active
CSP/HSTS), `JWT_SECRET`, `CORS_ORIGINS`, et un SMTP pour « mot de passe oublié ».

---

## API REST

Base `/api`. Voir le [détail des routes](server/routes/index.js).

```
Local     POST /auth/local          (session automatique du propriétaire — mode local)
Sources   GET  /sources    /sources/:id/mangas/*    GET /extensions/updates
          POST /extensions/update (admin)   GET /extensions/:id/test
          GET  /extensions/health (admin)   POST /extensions/install-url (admin)
Mangas    GET  /mangas/{search,popular,latest,tags,:id,:id/chapters}    GET /search-all
Lecture   GET  /chapters/:id/pages  (manga)    /chapters/:id/text  (roman / livre)
Images    GET  /img?u=<url>         (proxy + cache des couvertures, anti-SSRF)
Compte    GET/PUT /me/{favorites,library,progress,lists,settings,ratings}   /me/export, /me/import
Updates   GET  /me/updates?scope=active|all&manga=<id>   (échecs remontés, cooldown serveur)
Journal   GET/POST /me/notes   GET /me/notes/stats   PUT/DELETE /me/notes/:id
Read      POST /me/read-chapters   /me/read-chapters/bulk   PUT /me/favorites/:id/category
Stats     GET  /me/stats   /me/events   /ratings/:id
Notifs    GET  /me/notifications{,/unread}   POST /me/notifications/{read-all,:id/read}
          GET  /push/vapid   POST /me/push/subscribe   (Web Push)
Local fs  POST /library/import/local   GET /library/local{,/:id/file}   DELETE /library/local/:id
Artwork   GET  /artwork?title=...   (illustrations officielles AniList)
Spotify   GET  /spotify/{login,callback,status,playlists,recent,top,saved,now-playing}
AniList   GET  /anilist/{config,similar}    PUT /anilist/config
```

---

## Légalité et confidentialité

Inko **n'héberge aucun contenu** : les extensions lisent des sources publiques
tierces, et les fichiers importés restent sur **ta** machine. Les notes du
journal sont privées. Aucune télémétrie, aucune publicité, aucune revente de
données. Voir [`confidentialite.html`](confidentialite.html).

## Contribuer

Les PR sont bienvenues — en particulier de nouvelles extensions
(voir [`extensions-community/README.md`](extensions-community/README.md)).
CI : audit de sécurité npm, vérification de syntaxe, chargement des modules,
tests unitaires, build Docker.

**Licence** : [Apache 2.0](LICENSE) · © Abdoulrazack Abdillahi
