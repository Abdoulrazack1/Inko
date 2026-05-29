# Reddit — r/manga

**Subreddit cible :** r/manga
**Best time :** weekend matin

⚠️ **Important** : r/manga interdit la promo de readers tiers à MangaDex / officials. Lire la sidebar avant de poster. Préférer r/MangaCollectors ou des communautés de lecteurs alternatives.

---

## Titre

> Built a free, open-source self-hosted manga reader (PWA, MangaDex backed) — Inko

---

## Body

Hey r/manga,

I built **Inko**, a self-hosted manga reader that's open source and free. Wanted to share in case it's useful for anyone who wants more control over their reading experience.

### What it is

A PWA-installable manga reader you self-host (Node.js + MySQL). Front-end vanilla JS, backend acts as a personal MangaDex proxy.

### What it does

- **Resume reading** — picks up exactly where you left off, syncs across devices
- **Personal lists** — "Currently reading", "To read", custom tags
- **Favorites** + comments per manga
- **Live search** with autocomplete (MangaDex backed)
- **Dark mode by default** (mangas read better in dark)
- **PWA installable** on iOS, Android, desktop
- **Mobile build** via Capacitor (generate APK / iOS app from same codebase)

### Stack

- Vanilla JS frontend, modular architecture (separation logic/view)
- Node.js + Express + MySQL backend
- JWT (httpOnly cookie) + bcrypt for auth
- Service Worker (network-first API, cache-first covers)
- Capacitor for mobile builds

### Legal

Backend acts as a **personal client** to the public MangaDex API (like Tachiyomi or Paperback). Page images are **never stored server-side**, they pass through MangaDex@Home URLs. Strictly personal use.

### Code

https://github.com/Abdoulrazack1/Inko

MIT. Contributions welcome — new data sources, EPUB/CBZ support, translations.

---

## Notes

- **Vérifier la sidebar de r/manga** avant submit (le sub interdit beaucoup de promo)
- Si refusé, alternative : r/MangaCollectors, r/selfhosted (probable meilleure cible)
- Insister sur "personal use", "MangaDex client", pas "competitor to X"
