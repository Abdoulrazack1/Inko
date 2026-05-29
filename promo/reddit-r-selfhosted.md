# Reddit — r/selfhosted

**Subreddit cible :** r/selfhosted (probablement meilleur fit que r/manga)
**Best time :** dimanche soir / lundi matin

---

## Titre

> Inko — self-hosted manga reader with PWA, Capacitor mobile build, MangaDex backend (open source, Node/MySQL)

---

## Body

Hi r/selfhosted,

I built and open-sourced a manga reader you can self-host. Sharing here since this sub gets it.

### Why

Existing readers (Tachiyomi, Paperback) are great but native-only. Web-based services force you onto their server, with their account, their ads. I wanted something **I host, that works in a browser, installs as a PWA, and can be packaged as a mobile app from the same codebase**.

### Inko

- **Frontend** : vanilla JS, modular (separation logic/view per page module)
- **Backend** : Node.js + Express + MySQL (small footprint, mysql2 driver)
- **Auth** : JWT in httpOnly cookie + bcrypt
- **Data source** : MangaDex public API (proxied with intelligent caching)
- **PWA** : service worker with network-first API, cache-first covers, SWR for assets
- **Mobile** : Capacitor (Android + iOS from same codebase)

### Self-host

```bash
git clone https://github.com/Abdoulrazack1/Inko.git
cd Inko/server
npm install
npm run init-db   # creates schema + demo user
npm start         # :8088
```

Demo account : `demo@mangahub.app` / `demo1234`

### Features

- Resume reading (cross-device)
- Personal lists with drag-drop
- Favorites + comments
- Stats (chapters read, manga started)
- Live search

### Legality

Acts as **personal client** to MangaDex public API (same model as Tachiyomi/Paperback). Page images never stored server-side. Strictly personal use.

### Roadmap

- EPUB / CBZ local file support (for owned content)
- Multi-user with admin role
- Docker compose for one-line deploy

### Code

https://github.com/Abdoulrazack1/Inko

MIT. Issues / PRs welcome.

---

## Notes

- r/selfhosted apprécie **les sub-100 MB footprints + Docker** → idéalement ajouter un Dockerfile avant de poster
- Mentionner explicitement "no telemetry, no ads, no cloud"
- Anticiper : "comment ça se compare à Komga / Kavita ?" — réponse : différent (Komga/Kavita = collection locale CBZ/EPUB, Inko = stream MangaDex)
