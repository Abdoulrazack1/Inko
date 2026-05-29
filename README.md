# 📖 Inko — Lecteur de Mangas en ligne

> **Lis tes mangas dans une PWA installable, avec reprise de lecture, collections et favoris synchronisés.**
> Frontend Vanilla JS modulaire (séparation logique/vue), backend Node/Express/MySQL, données MangaDex, build mobile Capacitor.

[![Node](https://img.shields.io/badge/node-%E2%89%A518-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![MySQL](https://img.shields.io/badge/MySQL-4479A1?logo=mysql&logoColor=white)](https://www.mysql.com/)
[![PWA](https://img.shields.io/badge/PWA-Installable-5A0FC8?logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps/)
[![Capacitor](https://img.shields.io/badge/Capacitor-119EFF?logo=capacitor&logoColor=white)](https://capacitorjs.com/)
[![MangaDex](https://img.shields.io/badge/Data-MangaDex-FF6740)](https://mangadex.org/)

## 🌐 Démo en direct (UI sans backend)

**→ [https://abdoulrazack1.github.io/Inko/accueil.html](https://abdoulrazack1.github.io/Inko/accueil.html)**

[![Inko — MangaHub home](assets/screenshots/home.png)](https://abdoulrazack1.github.io/Inko/accueil.html)

> ⚠️ La version live sur GitHub Pages charge le layout complet (header, navigation, dark mode, footer) mais **les données mangas restent vides** — le backend Node/Express/MySQL et le proxy MangaDex ne sont pas déployés. Pour la version complète avec catalogue de 83k+ mangas, suis l'installation ci-dessous.

---

## 💡 À quoi ça sert

| Fonctionnalité | Pour quoi |
|---|---|
| **Reprise de lecture** | Reviens exactement où tu t'es arrêté, sur n'importe quel device |
| **Collections personnalisées** | Organise tes mangas : « Lecture en cours », « À lire », tags custom |
| **Favoris synchronisés** | Étoile un manga, retrouve-le sur tous tes écrans |
| **PWA installable** | Marche hors-ligne, s'installe comme une app native (iOS + Android + desktop) |
| **Build mobile Capacitor** | Génère un APK Android / app iOS depuis la même base de code |

---

## 🎯 Fonctionnalités

### Frontend
- **Navigation fluide** chapitre par chapitre, page par page
- **Reprise automatique** de la lecture (`/me/progress`)
- **Listes personnalisées** avec ajout/retrait drag-and-drop
- **Favoris** + **commentaires** par manga
- **Recherche live** avec autocomplete via MangaDex
- **Dark mode** par défaut (les mangas se lisent mieux en sombre)

### Backend
- **Proxy MangaDex** avec cache intelligent (pas de re-fetch inutile)
- **JWT cookie httpOnly** + bcrypt (auth solide)
- **Reset password** par email
- **Stats utilisateur** : chapitres lus, mangas commencés, événements
- **API REST** clean — voir section API plus bas

### Architecture
- **JS Vanilla modulaire** — chaque page = 1 module, séparation `api.js` / `storage.js` / `global.js` / `{page}.js`
- **PWA** avec service worker (network-first API, cache-first covers, stale-while-revalidate assets)
- **Capacitor** — même codebase pour le web et le mobile natif

---

## 📦 Quick Start

### Prérequis
- Node.js ≥ 18
- MySQL 5.7+ (Laragon est nickel sur Windows)

### Installation (4 commandes)

```bash
git clone https://github.com/Abdoulrazack1/Inko.git
cd Inko/server
npm install
npm run init-db   # crée la base + compte démo
npm start         # démarre sur :8088
```

Ouvre `http://localhost:8088/accueil.html`.

### Compte démo

| Email | Mot de passe |
|---|---|
| `demo@mangahub.app` | `demo1234` |

---

## 🏗️ Architecture

```
inko/
├── *.html                  # pages (modules indépendants)
├── assets/
│   ├── css/                # styles par page
│   ├── js/
│   │   ├── api.js          # client API + cache token
│   │   ├── storage.js      # préférences UI locales
│   │   ├── global.js       # header/footer/search/toast
│   │   ├── pwa.js          # service worker register
│   │   ├── password-strength.js
│   │   └── {page}.js       # logique de chaque page (vue)
│   └── img/icon.svg        # logo PWA
├── manifest.webmanifest    # PWA manifest
├── service-worker.js       # cache stratégies
├── capacitor.config.json   # config Android/iOS
└── server/
    ├── server.js           # entrée Express
    ├── config/db.js        # pool MySQL
    ├── routes/             # routes API
    ├── controllers/        # logique métier
    ├── middleware/         # JWT, error handler
    ├── services/
    │   └── mangadex.js     # client MangaDex avec cache
    └── db/
        ├── schema.sql      # tables
        └── init.js         # bootstrap DB
```

**Séparation logique/vue** : chaque page a son `{page}.js` qui ne fait QUE de la vue (DOM, événements UI). Toute la logique métier (fetch, cache, état) est dans `api.js` + `storage.js` + le backend.

---

## 🔌 API

Base : `/api`

### Auth (public)
- `POST /auth/register` — `{ username, email, password }`
- `POST /auth/login`    — `{ email, password }`
- `POST /auth/logout`
- `GET  /auth/me`       — auth requise
- `POST /auth/forgot`   — `{ email }`
- `POST /auth/reset`    — `{ email, token, newPassword }`

### Mangas (public, proxy MangaDex)
- `GET /mangas/search?q=...&limit=...`
- `GET /mangas/popular`
- `GET /mangas/latest`
- `GET /mangas/tags`
- `GET /mangas/:id`
- `GET /mangas/:id/chapters?lang=fr,en`
- `GET /chapters/:id/pages`

### User data (auth requise)
- `GET/POST/DELETE /me/favorites`
- `GET/PUT          /me/library/:mangaId`
- `GET/PUT          /me/progress/:mangaId`
- `GET/POST         /me/read-chapters`
- `GET/POST/PUT/DELETE /me/lists`
- `POST/DELETE      /me/lists/:id/items/:mangaId`
- `GET/POST         /comments/:mangaId`
- `GET              /me/events`
- `GET              /me/stats`

---

## 📱 Build mobile (Capacitor)

```bash
# Premier setup
npm install -g @capacitor/cli
npm install @capacitor/core @capacitor/android @capacitor/ios

# Génération Android
npx cap add android
npx cap sync android
npx cap open android   # ouvre Android Studio
```

Puis dans Android Studio : **Build → Generate Signed Bundle / APK**.

Pour iOS : `npx cap add ios` + Xcode.

---

## ⚡ PWA

Le service worker gère :
- **Network-first** pour `/api/*` (jamais de cache stale)
- **Cache-first** pour les couvertures MangaDex (économie bande passante)
- **Stale-while-revalidate** pour les assets statiques

L'app est installable depuis Chrome/Edge desktop, et iOS Safari (« Ajouter à l'écran d'accueil »).

---

## ⚖️ Légalité

Le backend agit comme un **client personnel** vers l'API publique MangaDex
(équivalent serveur de Tachiyomi/Paperback). Les images de pages ne sont
**jamais stockées** côté serveur, elles transitent via les URLs
MangaDex@Home. Réservé à un usage strictement personnel.

---

## 🆚 Pourquoi pas un autre lecteur ?

| Solution | Vanilla JS | Self-host | Build mobile | PWA |
|---|---|---|---|---|
| **Inko** | ✅ Modulaire | ✅ Node/MySQL | ✅ Capacitor | ✅ |
| Tachiyomi | ❌ Kotlin | ❌ Local | ✅ Android only | ❌ |
| Paperback | ❌ Swift | ❌ Local | ✅ iOS only | ❌ |
| Mangadex Web | ❌ React | ❌ SaaS | ❌ | ⚠️ |

Inko vise l'**auto-hébergement multi-plateforme** sans framework lourd, pour les devs qui veulent comprendre/forker la base.

---

## 🤝 Contribuer

Issues et PRs bienvenues — nouvelles sources de données, amélioration du cache, support EPUB/CBZ, traductions.

## 📜 Licence

MIT — usage strictement personnel pour la partie MangaDex.

## 🔗 Auteur

[@Abdoulrazack1](https://github.com/Abdoulrazack1) — projet DWWM
