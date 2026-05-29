# Dev.to — Article technique

**Titre :** Building a Manga Reader in Vanilla JS: Modular Architecture, PWA, and Capacitor Mobile Build
**Tags :** `javascript`, `webdev`, `pwa`, `mobile`
**Canonical URL :** https://github.com/Abdoulrazack1/Inko

---

## Plan

### 1. Le contexte
- Pourquoi un nouveau reader (les existants sont natifs only, ou hébergés ailleurs)
- Le choix vanilla JS (challenge personnel + démo de modularité sans framework)

### 2. La séparation logique/vue sans framework
- Chaque page = 1 fichier `{page}.js`
- Logique partagée dans `api.js` (fetch + cache + auth), `storage.js` (préférences locales), `global.js` (header/footer/search)
- Pattern IIFE pour exposer un objet global propre (pas de namespace pollution)
- Avantages : 0 build, debuggable directement dans DevTools
- Inconvénients : refacto cross-file plus manuel qu'avec un IDE TS

### 3. Le service worker
- 3 stratégies utilisées :
  - **Network-first** pour `/api/*` (jamais de cache stale)
  - **Cache-first** pour les covers (bande passante)
  - **Stale-while-revalidate** pour les assets statiques
- Lifecycle (install → activate → fetch) avec skipWaiting
- Update strategy : prompt user au lieu d'auto-reload (UX)

### 4. La PWA installable
- `manifest.webmanifest` (icons, theme color, display: standalone)
- Pourquoi `display: standalone` plutôt que `fullscreen`
- Tester sur iOS Safari (le moins permissif)
- "Add to home screen" sur Android Chrome

### 5. Le proxy MangaDex
- Architecture client → backend → MangaDex
- Pourquoi proxy plutôt que client direct (CORS, cache, rate limit)
- Cache intelligent : LRU sur les métadonnées, never sur les pages (images restent sur MangaDex@Home)

### 6. Build mobile via Capacitor
- Pourquoi Capacitor (vs Cordova, vs React Native, vs Flutter)
- Le `capacitor.config.json`
- Étapes Android : `cap add android` → `cap sync` → ouvrir Android Studio → Build APK
- Étapes iOS : nécessite Mac + Xcode
- Limitations : pas d'accès aux APIs natives sans plugin

### 7. Auth solide
- JWT en cookie httpOnly (pas localStorage)
- Refresh token rotation
- Reset password par email (avec rate limit)
- Bcrypt 12 rounds

### 8. Légalité
- Modèle "client personnel" comme Tachiyomi / Paperback
- Aucune image stockée
- Strictly personal use

### 9. Stats et roadmap
- ~15 pages HTML
- Backend < 1k LOC
- Roadmap : EPUB/CBZ local, multi-user, Docker compose

### 10. Liens
- Repo : https://github.com/Abdoulrazack1/Inko

---

## Notes

- Cible : devs full-stack curieux du "vanilla JS modulaire" et du build mobile
- 4-5 visuels (architecture, screenshot reader, install PWA, Android Studio build)
- 1500-2000 mots
