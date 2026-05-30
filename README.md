<div align="center">

<img src="assets/img/icon.svg" width="96" alt="Inko">

# Inko

### Ta bibliothèque manga, partout. Lis. Suis. Reprends. Sans pub.

**Un lecteur de mangas moderne — web, PWA installable, app desktop et mobile —
construit sur un système d'extensions ouvert façon Mihon/Tachiyomi.**

[![Node](https://img.shields.io/badge/Node-≥18-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![MySQL](https://img.shields.io/badge/MySQL-8-4479A1?logo=mysql&logoColor=white)](https://www.mysql.com/)
[![PWA](https://img.shields.io/badge/PWA-installable-5A0FC8?logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps/)
[![Electron](https://img.shields.io/badge/Desktop-Electron-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![Capacitor](https://img.shields.io/badge/Mobile-Capacitor-119EFF?logo=capacitor&logoColor=white)](https://capacitorjs.com/)
[![License](https://img.shields.io/badge/License-Apache_2.0-D22128?logo=apache&logoColor=white)](LICENSE)

[**🚀 Démarrer**](#-installation-en-2-minutes) · [**✨ Fonctionnalités**](#-ce-qui-rend-inko-différent) · [**🧩 Extensions**](#-extensions--le-cœur-dinko) · [**🖥 App Desktop**](#-app-desktop-windows--macos--linux)

</div>

---

<div align="center">

### 🖼 Aperçu

<img src="assets/screenshots/home.png" width="80%" alt="Accueil Inko">

<table>
<tr>
<td width="50%"><img src="assets/screenshots/catalogue.png" alt="Catalogue"></td>
<td width="50%"><img src="assets/screenshots/serie.png" alt="Page série"></td>
</tr>
</table>

</div>

---

## 🎯 Pourquoi Inko ?

> Les bons lecteurs de manga sont enfermés dans un OS : **Tachiyomi** = Android,
> **Paperback** = iOS, **Komga** = serveur lourd. **Inko casse les silos** :
> une seule base de code → web, PWA, desktop et mobile, avec un catalogue de
> **80 000+ titres** et un système d'extensions que tu peux étendre toi-même.

| | Inko | Tachiyomi | Paperback | MangaDex Web |
|---|:---:|:---:|:---:|:---:|
| **Multi-plateforme** | ✅ Web · PWA · Desktop · Mobile | Android | iOS | Web |
| **Extensions ouvertes** | ✅ | ✅ | ✅ | ❌ |
| **Self-hosted** | ✅ Node/MySQL | ❌ | ❌ | ❌ |
| **Sync compte** (favoris, progression) | ✅ | ⚠️ | ⚠️ | ✅ |
| **Installable comme app native** | ✅ partout | ✅ | ✅ | ❌ |
| **Sans framework lourd** (forkable) | ✅ Vanilla JS | ❌ Kotlin | ❌ Swift | ❌ React |

---

## ✨ Ce qui rend Inko différent

<table>
<tr>
<td width="33%" valign="top">

### 📖 Lecture
- 3 modes : page, double, **webtoon**
- Sens **RTL / LTR** au choix
- **Reprise exacte** où tu t'es arrêté
- Préchargement & qualité éco
- Plein écran + raccourcis clavier

</td>
<td width="33%" valign="top">

### 📚 Bibliothèque
- **Favoris** synchronisés
- Statuts : en cours, à lire, terminé
- **Listes** personnalisées
- **Notes & avis** (1-5 ★)
- Historique + heatmap d'activité

</td>
<td width="33%" valign="top">

### ⚙️ Confort
- **Thème clair / sombre / auto**
- Recherche live (autocomplete)
- **PWA hors-ligne**
- Export de tes données (JSON)
- Compte sécurisé (JWT + bcrypt)

</td>
</tr>
</table>

---

## ⚡ Installation en 2 minutes

> **Prérequis** : Node.js ≥ 18 · MySQL 8 (Laragon, MAMP, Docker…)

```bash
git clone https://github.com/Abdoulrazack1/Inko.git
cd Inko/server
npm install
npm run init-db        # crée la base + un compte démo
npm start              # → http://localhost:8088
```

Active une source (MangaDex) :

```bash
cp -r ../extensions-community/mangadex extensions/   # depuis Inko/server
```

Ouvre **http://localhost:8088** → 80 000+ titres à portée de clic.

| Compte démo | |
|---|---|
| 📧 Email | `demo@mangahub.app` |
| 🔑 Mot de passe | `demo1234` |

---

## 🧩 Extensions — le cœur d'Inko

Inko ne contient **aucune source par défaut** (modèle Mihon strict) :
le framework est neutre, tu choisis ce que tu installes.

```js
// server/extensions/ma-source/index.js
module.exports = {
  id: 'ma-source', name: 'Ma Source', lang: 'fr', version: '1.0.0',
  capabilities: ['popular', 'search', 'manga', 'chapters', 'pages'],
  async popular({ limit, offset })          { /* … */ },
  async search ({ q, limit, offset })       { /* … */ },
  async getManga(id)                        { /* … */ },
  async getChapters(mangaId, { lang })      { /* … */ },
  async getPages(chapterId)                 { /* … */ },
};
```

Pose un dossier dans `server/extensions/`, redémarre → la source apparaît
dans la page **Sources** de l'app. Deux extensions de référence fournies :
**MangaDex** (80 000+ titres) et **SushiScan** (fr, expérimental).

---

## 🖥 App Desktop (Windows · macOS · Linux)

Inko se compile en **application native** via Electron :

```bash
cd desktop
npm install
npm run dist          # → dist/Inko-Setup-1.0.0.exe  (Windows NSIS)
# npm run dist:mac    → .dmg     |    npm run dist:linux → AppImage + .deb
```

Le backend est embarqué : un double-clic suffit, aucune console à lancer.

## 📱 App Mobile (Android · iOS)

```bash
npm install -g @capacitor/cli
npx cap add android && npx cap sync android && npx cap open android
```

---

## 🏗 Architecture

```
inko/
├── *.html                    # pages (modules indépendants)
├── assets/js/
│   ├── api.js                # client REST + cache token
│   ├── theme.js · nsfw.js    # thème · espace +18
│   ├── storage.js            # préférences locales
│   └── {page}.js             # logique de chaque page (vue pure)
├── service-worker.js         # PWA : cache covers, offline
├── desktop/                  # app Electron
├── extensions-community/     # sources de référence (non auto-chargées)
└── server/
    ├── routes · controllers · middleware
    ├── extensions/loader.js  # chargement dynamique des sources
    └── db/schema.sql         # 12 tables MySQL
```

**Principe** : séparation stricte logique/vue. Chaque page ne fait QUE du
DOM ; toute la logique vit dans `api.js` + le backend. Vanilla JS, zéro
framework — lisible, forkable, sans build.

---

## 🔌 API REST

Base `/api` · [détail complet des routes](server/routes/index.js)

```
Auth      POST /auth/register · /auth/login · PUT /auth/password · POST /auth/delete
Sources   GET  /sources · /sources/:id/mangas/*
Mangas    GET  /mangas/{search,popular,latest,:id,:id/chapters} · /chapters/:id/pages
Compte    GET/PUT /me/{favorites,library,progress,lists,settings,ratings} · /me/export
Social    GET/POST /comments/:id · /ratings/:id · /me/stats
```

---

## ⚖️ Légalité & confidentialité

Inko est un **framework de lecture neutre**. Le projet ne distribue aucun
contenu : les extensions tierces agissent comme un client personnel (à la
Tachiyomi/Paperback) et sont **sous la responsabilité de l'utilisateur**.
Aucune image n'est stockée côté serveur, **aucune télémétrie**.
Réservé à un **usage strictement personnel**. Voir [`NOTICE.md`](NOTICE.md).

---

## 🤝 Contribuer

Les contributions sont bienvenues — nouvelles extensions, support EPUB/CBZ,
téléchargement hors-ligne, traductions. Ouvre une issue ou une PR.

<div align="center">

**Apache 2.0** · Fait avec passion pour les lecteurs de mangas

[⭐ Star le repo](https://github.com/Abdoulrazack1/Inko) si Inko te plaît

</div>
