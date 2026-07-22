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

<br>

<a href="https://github.com/Abdoulrazack1/Inko/releases/latest/download/Inko-Setup.exe">
  <img src="https://img.shields.io/badge/%E2%AC%87%EF%B8%8F_T%C3%A9l%C3%A9charger_pour_Windows-Inko--Setup.exe-c1531b?style=for-the-badge" alt="Télécharger Inko pour Windows">
</a>

*Un téléchargement, un double-clic, c'est installé — aucune dépendance, aucune configuration.*

<sub>Windows peut afficher « éditeur inconnu » au premier lancement (l'installeur n'est pas
signé — c'est le cas de la plupart des apps open source) : clique
« Informations complémentaires » puis « Exécuter quand même ».</sub>

<br>

[App Windows](#application-windows-tauri) · [Démarrer en dev](#démarrer-en-développement) · [Fonctionnalités](#fonctionnalités) · [Design](#design--lédition-washi) · [Extensions](#extensions) · [API](#api-rest) · [Journal des versions](CHANGELOG.md)

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
Le seul compte externe est **optionnel** : AniList, pour synchroniser ta
progression, tes statuts et tes notes (voir [Comptes liés](#comptes-liés-optionnels)).
L'interface est disponible en **français et en anglais** (sélecteur au pied de page).

|  | **Inko** | Mihon | Suwayomi | Komga/Kavita |
|---|---|---|---|---|
| Mangas **et** romans **et** livres | ✅ | ❌ (mangas) | ❌ (mangas) | ✅ (fichiers) |
| Sans compte, local d'abord | ✅ | ✅ | ✅ | ❌ (comptes) |
| Journal de lecture privé | ✅ | ❌ | ❌ | ❌ |
| Notifications push nouveaux chapitres | ✅ (app fermée incluse) | ✅ (mobile) | ❌ | ❌ |
| App Windows native premium (WebView2, fenêtre sans bordure) + web + PWA | ✅ | ❌ (Android) | ✅ (web) | ✅ (web) |
| Interface bilingue FR / EN | ✅ | ✅ | ❌ | partiel |
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
# → src-tauri/target/release/bundle/nsis/Inko_<version>_x64-setup.exe
```

> La fenêtre est **sans bordure système** : la barre de titre (déplacer,
> réduire, agrandir, fermer) est dessinée par l'app pour un rendu cohérent avec
> le thème. Sur le web/PWA, cette barre n'apparaît pas (le navigateur gère la
> fenêtre).

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
- **App de bureau premium** : fenêtre sans bordure système, barre de titre
  intégrée dans le thème (Tauri, WebView2 natif)
- **Interface bilingue FR / EN** (sélecteur au pied de page), traduction au vol
  sans jamais toucher aux titres d'œuvres ni au contenu des chapitres
- **Filtre de contenu adulte** : œuvres +18 floutées par défaut avec confirmation
  d'ouverture, réglable dans les paramètres
- **Téléchargements hors-ligne** avec pause / reprise / annulation et relance des
  chapitres incomplets
- PWA installable, thèmes Washi/Sumi/AMOLED, accent personnalisable, palette de
  commandes `Ctrl+K`, lecteur de musique ambiant, icônes 100 % SVG
- Export/import complet de tes données, suppression totale, **aucune télémétrie**

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
journalisé. Les mises à jour sont récupérées depuis une **release figée** du
dépôt et **vérifiées par empreinte SHA-256** avant écriture sur disque.

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
— 9 sources fournies : MangaDex, Weeb Central, SushiScan, Royal Road, NovelFull,
NovelBin, Chireads, Project Gutenberg (EN) et Livres en français (Gutenberg FR).

> ⚠️ **Sécurité des extensions** : une extension est du JavaScript exécuté avec
> les pleins droits du serveur (disque, réseau) — le modèle « façon Mihon »
> n'est pas sandboxé. Le canal officiel est protégé (tag de release figé +
> vérification SHA-256 fail-closed), mais une extension **installée à la main**
> revient à faire tourner du code tiers de confiance : n'installe que du code
> que tu as lu ou dont tu connais l'auteur. Le serveur signale au démarrage
> toute extension hors canal officiel.

---

## Mobile & multi-appareils

Il n'y a pas (encore) d'app mobile native. Sur téléphone, Inko s'utilise en
**PWA** : ouvre l'instance dans le navigateur (ton hub à la maison — voir plus
bas) et « Ajouter à l'écran d'accueil ». La PWA parle au hub comme n'importe quel
client : même bibliothèque, même progression, notifications incluses.

### Ce qui synchronise entre appareils (mode hub)

Tout ce qui transite par le compte suit d'un appareil à l'autre :

- ✅ favoris, bibliothèque, progression de lecture (mangas ET romans en ligne) ;
- ✅ notes de journal, avis, réglages du compte, historique ;
- ✅ état activé/désactivé de chaque source ;
- ✅ position de lecture des **fichiers importés** (EPUB/CBZ/PDF) — le fichier
  vit sur le hub, la reprise « page où j'en étais » suit le compte ;
- ✅ les actions faites **hors-ligne** (marquer lu, progression) sont mises en
  file et rejouées automatiquement au retour du réseau.

Ce qui reste volontairement **par appareil** :

- 📱 les téléchargements hors-ligne (cache local pour l'avion/le métro) —
  « téléchargé » sur un appareil ne veut pas dire « disponible hors-ligne »
  sur les autres ;
- 🖥️ en mode desktop pur (sans hub), chaque installation a sa propre base :
  la continuité entre deux PC passe par Exporter/Importer (Paramètres).

## Comptes liés (optionnels)

- **AniList** — carte de connexion (Paramètres/Profil) : crée un client sur
  `anilist.co/settings/developer` (Redirect URL : `http://127.0.0.1:8088/anilist.html`),
  colle l'ID client, « Connecter ». La synchro respecte la limite de l'API
  (~30 req/min) : elle s'espace et reprend seule en cas de 429.

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

### Le mode « hub à la maison » (toujours allumé)

Inko a deux profils d'usage, tous deux légitimes :

| | App de bureau | Hub à la maison |
|---|---|---|
| **Où ça tourne** | Ton PC, le temps d'une session | NAS, Raspberry Pi, mini-PC, VPS — 24h/24 |
| **Comment** | Installeur Windows (Tauri) | `docker compose up -d` |
| **Notifications** | Seulement quand l'app est ouverte | **Fiables** : le scan de nouveautés (toutes les 4 h) et le Web Push tournent en continu |
| **Multi-appareils** | Non | Oui : n'importe quel navigateur/PWA du réseau voit la même bibliothèque, la même progression |

Le hub ne demande **aucun changement de code** : c'est le même `docker-compose.yml`
(qui fixe déjà `NODE_ENV=production`). Une sauvegarde JSON de tous les comptes est
écrite chaque nuit dans `server/backups/` (rotation 14 jours, `DISABLE_BACKUPS=1`
pour couper, `BACKUP_DIR` pour déplacer).

**Accès hors de la maison (sans ouvrir de port)** — deux pistes éprouvées :

- **Tailscale** (le plus simple) : installe Tailscale sur la machine du hub et sur
  ton téléphone → le hub est joignable via son IP Tailscale (`http://100.x.y.z:8088`)
  de partout, chiffré de bout en bout, zéro configuration réseau.
- **Cloudflare Tunnel** : expose le hub sur un sous-domaine à toi sans IP publique.
  Un sidecar Docker optionnel est prêt en commentaire dans `docker-compose.yml`
  (renseigne `TUNNEL_TOKEN` dans `.env` et décommente-le).

La PWA s'installe ensuite depuis le navigateur du téléphone (« Ajouter à l'écran
d'accueil ») et parle au hub comme n'importe quel client.

---

## API REST

Base `/api`. Voir le [détail des routes](server/routes/index.js).

```
Local     POST /auth/local          (session automatique du propriétaire — mode local)
Sources   GET  /sources    /sources/:id/mangas/*    GET /extensions/updates
          POST /extensions/update (admin, MAJ vérifiées SHA-256)   GET /extensions/:id/test
          GET  /extensions/health (admin)
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
tests unitaires, **lint frontend (ESLint)**, build Docker, plus un contrôle
hebdomadaire de l'état des sources de scraping.

Historique complet des versions : [`CHANGELOG.md`](CHANGELOG.md).

**Licence** : [Apache 2.0](LICENSE) · © Abdoulrazack Abdillahi
