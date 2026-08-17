<div align="center">

<img src="assets/img/icon.svg" width="92" alt="Inko">

# Inko

**Tes mangas, light novels et livres — dans une vraie app, sans compte, sans pub.**

Un lecteur de **mangas, romans et livres** personnel et local, dans l'esprit de
Mihon / Tachiyomi : tu installes l'app, tu lis. Pas d'inscription, pas de mot de
passe — ta bibliothèque, ta progression et ton journal de lecture vivent chez
toi. Sur **Windows**, sur **Android**, et dans le navigateur — la même
bibliothèque, le PC servant de hub au téléphone. Construit sur un système d'extensions ouvert (mangas en images, light/web
novels traduits, classiques du domaine public via Project Gutenberg) avec
notifications de nouveaux chapitres, journal privé et import de tes propres
fichiers EPUB/CBZ/PDF.

[![Tauri](https://img.shields.io/badge/Desktop-Tauri_2-24C8DB?logo=tauri&logoColor=white)](https://tauri.app/)
[![Node](https://img.shields.io/badge/Node-%E2%89%A518-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![MySQL](https://img.shields.io/badge/MySQL-8-4479A1?logo=mysql&logoColor=white)](https://www.mysql.com/)
[![Android](https://img.shields.io/badge/Android-APK-3DDC84?logo=android&logoColor=white)](../../actions/workflows/android.yml)
[![PWA](https://img.shields.io/badge/PWA-installable-5A0FC8?logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps/)
[![License](https://img.shields.io/badge/License-Apache_2.0-D22128?logo=apache&logoColor=white)](LICENSE)

<br>

<a href="https://github.com/Abdoulrazack1/Inko/releases/latest/download/Inko-Setup.exe">
  <img src="https://img.shields.io/badge/%E2%AC%87%EF%B8%8F_Windows-Inko--Setup.exe-c1531b?style=for-the-badge" alt="Télécharger Inko pour Windows">
</a>
&nbsp;
<a href="https://github.com/Abdoulrazack1/Inko/releases/download/apk-latest/inko.apk">
  <img src="https://img.shields.io/badge/%E2%AC%87%EF%B8%8F_Android-inko.apk-3DDC84?style=for-the-badge&logo=android&logoColor=white" alt="Télécharger l'APK Android">
</a>

*Windows : un téléchargement, un double-clic, c'est installé.*
*Android : ouvre le `.apk` sur le téléphone et autorise les « sources inconnues ».*

<sub>L'APK est reconstruit à chaque changement — le lien pointe toujours sur le
dernier build de <code>main</code>. Il faut ensuite
<a href="#connecter-le-téléphone-au-hub">le connecter à ton hub</a> : le
téléphone lit la bibliothèque servie par l'ordinateur.</sub>

<sub>Windows peut afficher « éditeur inconnu » au premier lancement (l'installeur n'est pas
signé — c'est le cas de la plupart des apps open source) : clique
« Informations complémentaires » puis « Exécuter quand même ».</sub>

<br>

[App Windows](#application-windows-tauri) · [App Android](#application-android) · [Démarrer en dev](#démarrer-en-développement) · [Fonctionnalités](#fonctionnalités) · [Extensions](#extensions) · [Architecture](#architecture) · [API](#api-rest) · [Journal des versions](CHANGELOG.md)

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

> **Node 22 ou plus** est requis depuis le passage à Capacitor 8 et jsdom 30.
> `npm install` s'arrête net en le disant si la version est trop ancienne —
> sans ce garde-fou, l'échec arrivait bien plus tard sous la forme
> `webidl.util.markAsUncloneable is not a function`, où rien n'indique que la
> cause est la version de Node.
> Avec nvm : `nvm use 22` (ou plus récent).

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

### Sur téléphone
- **Gestes** : appui long, balayages annulables, tirer pour actualiser, mode une
  main, touches de volume dans le lecteur — voir [Pensée pour le pouce](#pensée-pour-le-pouce)
- **Hors-ligne réel** : hub éteint, les chapitres téléchargés se lisent, et la
  progression remonte seule au retour
- **Le hub se retrouve tout seul** quand la box lui change son adresse
- **Notifications sans compte Google** (repli `WorkManager`)
- Curseur de page avec **vignette de prévisualisation**, verrouillage
  d'orientation, double page automatique en paysage

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

## Quand une source meurt

Un site change de structure, ferme, ou passe derrière un anti-bot : la source
cesse de répondre et les séries qui en dépendent deviennent inatteignables.
Leur progression, leurs notes et leurs signets sont toujours là — mais l'œuvre
ne s'ouvre plus.

**Changer de source ne perd rien.** Sur une série suivie : « ⇄ Changer de
source ». Inko la cherche sur toutes les autres sources installées, classe les
candidats, et affiche un score — jamais appliqué automatiquement :

```
Migrer « Solo Leveling »
Depuis : novelbin  (ne répond plus)

Trouvé sur :
  SushiScan     Solo Leveling            200 ch.   79
  MangaDex      Solo Leveling            179 ch.   62
  WeebCentral   Na Honjaman Level-Up     201 ch.   19

À conserver :  ☑ Progression  ☑ Favori  ☑ Notes  ☑ Notation  ☑ Chapitres lus
```

Deux règles gouvernent le report :

- **Rien n'est deviné.** Les chapitres lus sont reportés par **numéro**, pas
  par identifiant — deux sources n'ont aucun identifiant en commun. Un numéro
  sans équivalent en face est **signalé**, jamais rapproché du chapitre le plus
  proche : faire croire qu'on a lu un chapitre qu'on n'a pas lu est une erreur
  qu'on ne peut ni voir ni corriger.
- **Tout est réversible 7 jours.** L'état complet est photographié avant la
  moindre écriture, et l'annulation est proposée dans le message de succès —
  c'est dans les secondes qui suivent qu'on s'aperçoit d'une erreur.

L'état de chaque source est visible en permanence dans **Sources**, y compris
la panne silencieuse : une source qui répond mais ne renvoie plus rien affiche
« Répond, mais ne renvoie rien » plutôt que de passer pour opérationnelle.

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

## Application Android

**[⬇ Télécharger inko.apk](https://github.com/Abdoulrazack1/Inko/releases/download/apk-latest/inko.apk)**
— l'adresse ne change jamais, le fichier suit toujours `main`. Ouvre le `.apk`
sur le téléphone et autorise l'installation depuis « sources inconnues ».

<sub>L'empreinte est publiée à côté
([SHA256SUMS-apk.txt](https://github.com/Abdoulrazack1/Inko/releases/download/apk-latest/SHA256SUMS-apk.txt))
— sans elle, rien ne permet de vérifier ce qu'on vient de télécharger.
L'APK reste aussi en pièce jointe de chaque run du workflow
[**APK Android**](../../actions/workflows/android.yml), si tu en veux un
précis.</sub>

Chaque build est vérifié avant d'être publié : contenu embarqué complet, ordre
de chargement des scripts, aucune syntaxe que le WebView d'Android 8 ne sache
lire, et **démarrage réel sur un émulateur Android 8** — pas seulement une
compilation qui réussit.

> L'APK de debug est signé avec la clé de debug d'Android. Une chaîne de
> **publication signée** existe ([`android-release.yml`](.github/workflows/android-release.yml)) :
> déclenchée sur un tag, elle vérifie que l'APK est signé et complet, publie
> `SHA256SUMS-android.txt`, et rattache le tout à la release. Elle attend une
> clé — voir [docs/android-signature.md](docs/android-signature.md). Générer
> cette clé engage : Android identifie une app par sa signature, et la perdre
> interdit toute mise à jour des installations existantes.

### Connecter le téléphone au hub

L'app **ne scrape rien elle-même** : elle lit ta bibliothèque depuis l'Inko qui
tourne sur ton ordinateur (voir [Pourquoi un hub](#pourquoi-le-téléphone-ne-scrape-pas)).

1. **Sur le PC** — Paramètres → Appareils → « Afficher le code ». Un QR
   apparaît, valable 2 minutes, à usage unique.
2. **Sur le téléphone** — « Scanner le QR code », ou saisis le code à la main.
   Ou encore : **« Rechercher mon hub sur le réseau »**, qui le trouve tout seul.

Le téléphone et l'ordinateur doivent être sur le même réseau Wi-Fi.

Chaque appareil appairé apparaît dans Paramètres → Appareils et se déconnecte
d'un geste — **immédiatement**, sans attendre l'expiration d'un jeton. C'est le
geste « j'ai perdu mon téléphone » : la session tombe, les notifications
s'arrêtent, tout dans la même seconde.

<sub>Un appareil appairé n'est jamais administrateur, même si le compte l'est
sur le PC : il lit et écrit sa bibliothèque, rien de plus.</sub>

### Le hub a une identité, pas seulement une adresse

Ton PC reçoit son adresse en DHCP. Au redémarrage de la box, `192.168.1.34`
devient `192.168.1.52` — et un téléphone qui a mémorisé une adresse a mémorisé
une place de parking, pas une personne.

Le hub tire donc une **identité** au premier démarrage, que le téléphone retient
lors de l'appairage. Deux conséquences :

- **Il retrouve son hub tout seul.** Au démarrage ou en changeant de Wi-Fi, si
  l'adresse ne répond plus, l'app cherche le service `_inko._tcp` sur le réseau
  et corrige l'adresse **sans rien demander**.
- **Il refuse un inconnu.** Un hub dont l'identité ne correspond pas n'est jamais
  adopté, même s'il est seul sur le réseau — sur un Wi-Fi partagé, se connecter
  au premier venu reviendrait à lui confier sa bibliothèque.

<sub>mDNS est filtré sur beaucoup de réseaux (Wi-Fi invité, entreprise). La
recherche échoue alors proprement et le dit ; la saisie manuelle de l'adresse
reste le chemin garanti. `INKO_MDNS=0` coupe l'annonce côté hub.</sub>

### Lire sans réseau

Le hors-ligne est **réel**, pas annoncé : l'interface est embarquée dans l'APK,
seules les données viennent du hub. Hub éteint, avec des chapitres téléchargés,
la lecture continue — planches affichées, pages qui tournent.

Et la progression lue hors ligne **remonte toute seule** quand le hub revient.

Deux détails qui font la différence entre « ça marche » et « ça marche
vraiment » :

- Le stockage d'un WebView est effaçable par Android sous pression mémoire.
  L'app demande le mode **persistant**, et le dit honnêtement quand il est
  refusé. Dans ce cas seulement, elle double les planches dans le stockage privé
  de l'application — que le système n'évince jamais.
- Hub injoignable **avec** des chapitres en réserve : bandeau et lecture
  possible. Hub injoignable **sans** rien à lire : écran de configuration. On ne
  bloque que s'il n'y a rien à faire.

### Pensée pour le pouce

| | |
|---|---|
| **Appui long** sur une carte | menu : favori, liste, télécharger, marquer lu |
| **Balayage droite / gauche** | marquer la série lue · télécharger le prochain chapitre — **annulables 5 s** |
| **Tirer vers le bas** | actualiser la liste |
| **Balayage depuis le bord bas** | mode une main : la page descend à portée du pouce |
| **Touches de volume** | tourner les pages, sans regarder l'écran |
| **Appui long sur l'icône** | Bibliothèque · Rechercher · Téléchargements |
| **Partager un titre** | depuis n'importe quelle app → la recherche s'ouvre dessus |

Grille à trois colonnes, couvertures au rapport 2:3, titres sur deux lignes,
feuilles montantes à la place des barres latérales, et le **bouton retour
d'Android** qui ferme les panneaux au lieu de quitter l'écran.

### Notifications — sans compte Google

Deux transports, essayés dans cet ordre :

| | Délai | Ce qu'il faut |
|---|---|---|
| **Firebase (FCM)** | quelques secondes | un projet Google, deux fichiers de clés |
| **Veille locale** | 15 minutes au plus | **rien** |

La veille est le repli automatique : le téléphone interroge lui-même ton hub via
`WorkManager`, l'ordonnanceur d'Android. Aucun service tiers, aucune clé — et
pour un lecteur auto-hébergé dont le hub est le PC du salon, passer par les
serveurs de Google pour apprendre qu'un chapitre est arrivé à trois mètres est
une dépendance qu'on peut refuser. Voir
[docs/notifications-push.md](docs/notifications-push.md).

### Pourquoi le téléphone ne scrape pas

Les extensions d'Inko utilisent `cheerio` pour analyser du HTML, un repli `curl`
parce que l'empreinte TLS de Node est bloquée par Cloudflare, et des en-têtes
`Referer` / `User-Agent` qu'un navigateur **interdit** de définir. Un WebView ne
peut structurellement pas les exécuter — ce n'est pas une question d'effort,
c'est la politique d'origine croisée et l'anti-bot des sites sources.

Le téléphone est donc un **client du hub** : ton PC, ton NAS ou ton VPS fait le
travail, le téléphone affiche.

---

## Multi-appareils

### Ce qui suit d'un appareil à l'autre

Tout ce qui transite par le compte :

- favoris, bibliothèque, progression de lecture (mangas **et** romans) ;
- notes de journal, avis, réglages du compte, historique ;
- état activé/désactivé de chaque source ;
- position de lecture des **fichiers importés** (EPUB/CBZ/PDF) — le fichier
  vit sur le hub, la reprise « page où j'en étais » suit le compte ;
- les actions faites **hors-ligne** (marquer lu, progression) sont mises en
  file et rejouées au retour du réseau.

### Ce qui reste par appareil, volontairement

- les téléchargements hors-ligne : « téléchargé » sur un appareil ne veut pas
  dire « disponible hors-ligne » sur les autres ;
- en mode desktop pur (sans hub), chaque installation a sa propre base — la
  continuité entre deux PC passe par Exporter/Importer.

### Sur navigateur, sans installer l'app

Inko reste une **PWA installable** : ouvre l'instance dans le navigateur du
téléphone et « Ajouter à l'écran d'accueil ». Même bibliothèque, mêmes
notifications. L'app Android ajoute l'appairage par QR, le stockage natif et,
à terme, le téléchargement en arrière-plan.

## Comptes liés (optionnels)

- **AniList** — carte de connexion (Paramètres/Profil) : crée un client sur
  `anilist.co/settings/developer` (Redirect URL : `http://127.0.0.1:8088/anilist.html`),
  colle l'ID client, « Connecter ». La synchro respecte la limite de l'API
  (~30 req/min) : elle s'espace et reprend seule en cas de 429.

---

## Architecture

### Une base de code, trois coques

C'est la question qu'on se pose en ouvrant le dépôt : pourquoi l'app Windows,
l'app Android et le site vivent-ils au même endroit ? Parce que ce n'est **pas**
trois applications.

```
84 fichiers de frontend PARTAGÉS   45 scripts · 15 feuilles · 24 pages
 2 fichiers propres au mobile      hub.js (à quel serveur parler) · natif.js (la couche Android)
   + la coque android/  (Capacitor)  et  desktop-tauri/  (Tauri)
```

L'APK ne contient pas une autre application : il contient **ces mêmes fichiers**,
transpilés pour le WebView d'Android 8, avec deux scripts injectés à la
construction. Séparer les dépôts obligerait à dupliquer 84 fichiers — et on
perdrait ce qui fait la valeur du montage : une correction profite aux trois
d'un coup.

Le risque de ce choix — un ajout mobile qui abîme le bureau — est réel. Il est
tenu par des tests : les modules tactiles doivent s'effacer avant de poser le
moindre écouteur, `hub.js` et `natif.js` ne doivent être référencés par aucune
page du dépôt, et les règles pensées pour le doigt doivent rester enfermées dans
`hover: none`.

```
Inko/
├── *.html                  # Pages (vanilla JS, zéro framework, zéro build)
├── assets/
│   ├── css/                # global.css (design system Washi/Sumi) + 1 CSS/page
│   ├── js/                 # api.js, global.js, 1 module/page, gestes tactiles…
│   └── vendor/             # jszip, pdf.js, three.js (tout en local, CSP stricte)
├── server/                 # Express + MySQL (backend embarqué dans l'app desktop)
│   ├── controllers/        # auth (mode local), manga, user, notes, devices…
│   ├── extensions/         # sources chargées à chaud (contrat Mihon-like)
│   ├── lib/                # push, notify, updates, identite-hub, annonce-mdns…
│   ├── middleware/         # sécurité (CSP/HSTS prod, rate limit)
│   └── db/                 # schema.sql + migrations versionnées
├── extensions-community/   # catalogue de sources versionné (versions.json)
├── android/                # coque Capacitor + 5 greffons maison (Java)
├── desktop-tauri/          # app Windows (Tauri 2, WebView2, sidecar Node)
└── scripts-ci/             # build mobile, vérificateurs, générateurs
```

> L'administration (modération, rôles, statut des sources multi-utilisateurs)
> vivra dans une application dédiée **Inko Admin** — l'app de lecture reste
> centrée sur la lecture.

### Ce que la CI vérifie

Les défauts les plus coûteux de ce projet ont tous eu le même profil : du code
valide, des tests verts, et un résultat faux à l'écran. Les contrôles visent
donc l'ARTEFACT, pas le dossier qui a servi à le produire.

| Contrôle | Ce qu'il empêche |
|---|---|
| `gen-precache --check` | une page qui s'ouvre hors-ligne en coquille vide |
| `check-i18n --check` | un libellé reformulé qui casse sa traduction en silence |
| `gen-openapi --check` | une référence d'API qui diverge du routeur |
| `gen-repli-aspect-ratio --check` | des couvertures à 0 px de haut sur Android 8 |
| `verifier-java-android` | une erreur de signature Java, sans installer le SDK |
| `verifier-apk` | un APK sans `inset` abaissé, ni syntaxe illisible par Chrome 61 |
| démarrage sur émulateur | un APK qui compile mais ne s'ouvre pas |
| e2e Playwright + axe-core | un parcours cassé, une régression d'accessibilité |

<sub>Le WebView d'Android 8 ignore silencieusement `inset` (Chrome 87),
`aspect-ratio` (88), `env()` (69) et `color-mix()` (111). Chacune a produit un
contrôle vert sur un produit cassé — un voile de modale à 0 × 0, des couvertures
à 0 px, un bandeau collé en haut de l'écran, des surfaces sans fond. Les quatre
sont désormais tenues par des tests.</sub>

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
