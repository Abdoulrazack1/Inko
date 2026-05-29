# Inko — Lecteur de mangas

Front HTML/CSS/JS, backend Node/Express/MySQL et données MangaDex.

## Stack

- **Frontend** : Vanilla HTML/CSS/JS + PWA installable
- **Backend** : Node.js + Express + MySQL (mysql2)
- **Auth** : JWT (cookie httpOnly) + bcrypt
- **Données mangas** : API MangaDex (catalogue + chapitres + pages)
- **Mobile** : Capacitor (Android/iOS)

## Démarrage rapide

### Prérequis
- Node.js ≥ 18
- MySQL 5.7+ (Laragon est nickel sur Windows)

### Installation

```bash
cd server
npm install
npm run init-db   # crée la base + un compte démo
npm start         # démarre sur :8088
```

Ouvre `http://localhost:8088/accueil.html`.

### Compte démo

- email : `demo@mangahub.app`
- mot de passe : `demo1234`

## Architecture

```
inko/
├── *.html                  # pages
├── assets/
│   ├── css/                # styles par page
│   ├── js/
│   │   ├── api.js          # client API + cache token
│   │   ├── storage.js      # préférences UI locales
│   │   ├── global.js       # header/footer/search/toast
│   │   ├── pwa.js          # service worker register
│   │   ├── password-strength.js
│   │   └── {page}.js       # logique de chaque page
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

## API

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

## Build mobile (Capacitor)

```bash
# Premier setup
npm install -g @capacitor/cli
npm install @capacitor/core @capacitor/android @capacitor/ios

# Génération Android
npx cap add android
npx cap sync android
npx cap open android   # ouvre Android Studio
```

Puis dans Android Studio : Build → Generate Signed Bundle / APK.

Pour iOS : `npx cap add ios` + Xcode.

## PWA

Le service worker gère :
- **Network-first** pour `/api/*` (jamais de cache stale)
- **Cache-first** pour les couvertures MangaDex (économie bande passante)
- **Stale-while-revalidate** pour les assets statiques

L'app est installable depuis Chrome/Edge desktop, et iOS Safari (« Ajouter à l'écran d'accueil »).

## Légalité

Le backend agit comme un **client personnel** vers l'API publique MangaDex
(équivalent serveur de Tachiyomi/Paperback). Les images de pages ne sont
**jamais stockées** côté serveur, elles transitent via les URLs
MangaDex@Home. Réservé à un usage strictement personnel.
