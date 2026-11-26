## 2. Sécurité

> **Posture générale : bonne, avec un trou précis.** Le travail d'audit antérieur (S1…S14, SEC-01…SEC-11) se voit : isolation par `estLocale` à double adresse, SSRF fermé, mots de passe à politique, sessions révocables, jetons hachés, secret JWT par installation en mode desktop. Les sondes confirment : **112/112** routes protégées refusent l'anonyme, **0** fuite de pile ou de SQL, `npm audit` à **0**.
> Ce qui reste est concentré sur **ce que le serveur sert et à qui il répond hors production**.

### SEC-01 🔴 Un site web quelconque peut lire votre jeton de session (serveur lancé hors production) · effort S

**Preuve (démontrée en direct, `api-acces`)**

```
POST /api/auth/local        Origin: https://evil.example
→ 200   Access-Control-Allow-Origin: https://evil.example   (+ Access-Control-Allow-Credentials: true)
        corps : { user, token: "<jeton admin>", localMode: true }
```

`corsOptions()` (`server/middleware/security.js:124-160`) ne ferme CORS qu'en production ou desktop (`permissiveOk = !(IS_PROD || IS_DESKTOP) || CORS_ALLOW_ANY`). Hors de ces deux cas — **tout lancement `node server/server.js`, `npm start`, ou l'aperçu de développement** — il *réfléchit* n'importe quelle origine **avec `credentials: true`**. Or `/auth/local` (`localOnly`) ne vérifie que **l'adresse de la machine**, pas l'origine de la page : une page ouverte **dans votre navigateur** vient bien de la boucle locale.

**Scénario** : le serveur de développement tourne ; vous ouvrez un lien, un forum, un onglet publicitaire. Sa page fait `fetch('http://localhost:8088/api/auth/local', {method:'POST', credentials:'include'})` — requête « simple », **sans préalable CORS** — et **lit le jeton admin dans la réponse**. Avec lui : lecture et suppression de toute la bibliothèque (voir DAT-01 : 300 suppressions en 0,7 s), export complet, désactivation d'extensions.

**Ce qui protège déjà** : l'application installée (Tauri, `IS_DESKTOP`) et Docker (`NODE_ENV=production`) sont **fermés** — SEC-09 les a traités. Le trou est le **mode développement / auto-hébergement sans `NODE_ENV`**, c'est-à-dire la machine sur laquelle l'application est construite.

**Correctif**
1. **Fermé par défaut partout** : n'autoriser que `http://localhost:<PORT>`, `http://127.0.0.1:<PORT>`, les origines webview connues, et `CORS_ORIGINS`. `CORS_ALLOW_ANY=1` reste l'unique échappatoire, **explicite**.
2. **Défense en profondeur sur `/auth/local`** : exiger un en-tête personnalisé (`X-Inko-Client: web|desktop|mobile`) — un en-tête non standard **force le préalable CORS**, que (1) refuse — **et** refuser si `Origin` est présent et différent de l'hôte (`Sec-Fetch-Site: cross-site` → 403).
3. Test de non-régression : la sonde `api-acces` doit afficher `cors_origine_etrangere: refusée`.

**Critère d'acceptation** : `ACCES-CORS-OUVERT` et `ACCES-CORS-PREFLIGHT` ne remontent plus ; `POST /auth/local` avec `Origin: https://evil.example` → 403.

---

### SEC-02 🟠 Le serveur publie la racine du dépôt · effort S

**Preuve (`api-acces`)** — servis en `200` : `/package.json`, `/Dockerfile`, `/scripts-ci/gen-openapi.js`, `/test/unit/api.test.js`, `/AUDIT-INKO-2026-07-28.md`, `/docs/audit/sondes.json`.

`BLOCKED_DIRS` (`server/app.js:60`) est une **liste noire** : `server|node_modules|desktop|desktop-tauri|tools|promo|.git|.github`. Tout ce qui n'y figure pas est servi — **dont les documents d'audit de sécurité** (`AUDIT-*.md`, `audit.md`, `docs/`), les **tests**, les **scripts**, et **tout futur dossier ajouté**. Les fichiers vraiment secrets (`.env`, `server/config/*.json`, `server/backups`) sont bien refusés : les chemins secrets testés (`.env`, `server/config/*.json`, `server/backups/`, `.git/`, traversées `..%2f`, casse, antislash) ne sortent pas — la liste noire marche *aujourd'hui*, mais elle repose sur le fait de n'oublier aucun dossier.

**Correctif** : **liste blanche** — `*.html` de la racine, `assets/`, `manifest.webmanifest`, `service-worker.js`, icônes. Tout le reste → 404. Idéalement, un dossier `public/` dédié (voir ARC-04).

**Critère d'acceptation** : `ACCES-FICHIER-EXPOSE` et `ACCES-DEPOT-SERVI` disparaissent.

---

### SEC-03 🟠 La CSP est absente en développement et affaiblie en production · effort L

**Preuves**
- **Aucun en-tête `Content-Security-Policy` en développement** (`CSP_ON = (IS_PROD || IS_DESKTOP) && …`, `security.js:26`) : ce qui est testé n'est **pas** ce qui sera livré. Des erreurs de CSP n'apparaissent qu'en production — c'est exactement l'histoire de `DESK-01` (« la CSP de l'app installée bloque les gestionnaires en ligne »).
- **`'unsafe-inline'` présent 5 fois** dans `security.js`, et dans la CSP Tauri (`script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'`). Il annule l'essentiel de la protection contre un XSS.
- La CSP Tauri autorise **`img-src https:`** et **`connect-src https:`** : un script injecté pourrait **exfiltrer vers n'importe quel site**. L'app n'a besoin que de `http://127.0.0.1:8088`.
- **`Permissions-Policy` absent** (caméra, micro, géolocalisation non explicitement refusés).

**Correctif** : (1) activer la même CSP en développement, en mode `Content-Security-Policy-Report-Only` d'abord ; (2) **sortir les `<script>` inline des 26 pages** (la chaîne de build Android les transpile déjà : elle sait les extraire) vers `assets/js/pages/*.js` ; (3) supprimer `'unsafe-inline'` pour les scripts, puis pour les styles (attributs `style=` → classes) ; (4) `connect-src 'self'` côté Tauri ; (5) `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`.

**Critère d'acceptation** : `PLT-CSP-UNSAFE-INLINE` et `PLT-TAURI-*` à zéro ; zéro violation CSP au parcours de la sonde `pages` en production.

---

### SEC-04 🟠 Une URL `javascript:` est acceptée comme couverture · effort S

**Preuve (`flux-ecriture`)** : `POST /me/favorites {cover: "javascript:alert(1)"}` → **200, et l'URL est conservée en base**. `couverture.brute()` ne filtre pas le schéma.

Aujourd'hui l'URL ne s'exécute pas (elle va dans un `<img src>`), mais elle **voyagera** : export JSON, partage de listes publiques (`liste.html`), futures utilisations en `href`, CSS `url()`. Une donnée dangereuse stockée est une faille en attente d'un nouvel usage.

**Correctif** : liste blanche de schémas (`http`, `https`, ou chemin relatif `/api/img?…`) dans `couverture.brute()` **et** dans tout champ d'URL (`avatar`, `website`, `list.cover`, imports). Les mêmes règles à l'import.

---

### SEC-05 🟠 Les erreurs d'extension remontent la ligne de commande `curl` entière · effort S

`extensions.controller.js:221,237` renvoient `e.message` tel quel ; pour une source qui échoue via `curl`, le message est `curl : Command failed: curl -s -f -L --compressed -m 30 -A Mozilla/5.0 … https://…` (vu dans le journal du serveur). Pas de secret, mais **la mécanique interne et l'URL complète** partent au client. Idem `update.controller.js:251`, `migration.controller.js:174`, `local.controller.js:83`.

**Correctif** : une fonction `messagePublic(e)` (codes stables : `SOURCE_INDISPONIBLE`, `SOURCE_LENTE`, `REPONSE_INVALIDE`) ; le détail va au journal avec un identifiant de corrélation que l'interface affiche (« référence 7F3A »).

---

### SEC-06 🟡 Plus de la moitié des routes d'écriture sans limiteur de débit dédié · effort M

`writeLimiter` n'est posé que sur **5 routes** (`routes/index.js`) ; {{mesure:routes.routes_ecriture_sans_limiteur}} routes d'écriture n'ont aucun plafond propre. **Mesuré** : 300 `DELETE` en 0,7 s sont acceptés. Même hors du cas de la corbeille (DAT-01), une boucle fautive (client, extension, test) peut saturer la base et le journal d'événements.

**Correctif** : un limiteur **par compte** (clé = `req.user.id`, pas l'IP : en local, tout est `127.0.0.1`) monté sur tout `POST/PUT/DELETE /me/*` : 120 écritures/min, avec exemption en rafale pour les imports. Les routes sensibles gardent leur limiteur strict.

---

### SEC-07 🟡 Les réponses authentifiées ne sont pas marquées `no-store` · effort S

**Preuve (`api-contrat`)** : `/me/favorites` (192 Ko), `/me/export` (982 Ko, **toute la bibliothèque**), `/auth/sessions`, `/me/events` — aucun `Cache-Control`. Derrière Caddy/un proxy ou sur un poste partagé, ces réponses peuvent être conservées.

**Correctif** : `Cache-Control: no-store` (ou `private, no-cache`) sur toute réponse `/api/me/*` et `/api/auth/*` ; ETag faible + `private` pour les listes volumineuses (gain de bande passante **et** de confidentialité).

---

### SEC-08 🔵 Les sauvegardes d’un serveur ne sont pas chiffrées par défaut · effort S

Le dossier `server/backups/` conserve les fichiers JSON des dernières semaines. L'application **installée** les chiffre par défaut (SEC-04 : phrase tirée au sort au premier démarrage) ; un **serveur** ou un poste de développement ne chiffre que si `BACKUP_PASSPHRASE` est définie. Un dump de sauvegarde, c'est l'intégralité des données de tous les comptes. Le dossier est exclu du serveur web (OK) et de git (OK), mais pas du **cloud de synchronisation** éventuel du profil Windows.

**Correctif** : chiffrer **par défaut** avec une clé par installation (même mécanisme que le secret JWT, `secrets-locaux.js`) ; la phrase secrète utilisateur reste un renfort. Restreindre les droits du dossier (`icacls`).

---

### SEC-09 🟡 Secret JWT de repli connu en développement · effort S

`server/lib/secret.js:63,68` retombe sur la chaîne littérale `inko-dev-secret-change-me` hors production et hors desktop. Le code l'avertit ; mais un serveur exposé sans `NODE_ENV` signerait avec un secret **public** (lisible dans le dépôt) → forge de jeton hors ligne. **Correctif** : générer un secret aléatoire par installation dans **tous** les modes (le cas desktop le fait déjà) ; refuser de démarrer si `HOST` ≠ boucle locale et secret faible.

---

### SEC-10 🟡 Les paramètres de chemin ne sont pas validés au bord · effort M

{{mesure:routes.params_sans_validation_visible}} usages de `req.params.*` sans validation visible (`parseInt`, motif…). Les requêtes sont paramétrées (pas d'injection SQL : 0 interpolation de *valeur*, les alertes `SEC-SQL-INTERPOLE` sont des **faux positifs** de fragments structurels — voir encadré), mais un `:mangaId` de 10 000 caractères atteint la base et les journaux.

**Correctif** : un middleware `valider({ mangaId: idOeuvre, id: entier })` par route ; `idOeuvreValide` existe déjà (`addFavorite`) — l'appliquer partout.

> **Triage des alertes SQL de la sonde** — 6 « interpolations » signalées : `admin.controller.js:11` (sous-requête statique), `user.controller.js:840` (`IN (?)` + `WITH RECURSIVE`), `embedded-db.js:102,104` (mot de passe échappé par `mysql.escape`), `migration-sources.js:286` et `restore-backup.js:100` (listes `?` générées, nom de table issu d'une liste fixe). **Aucune ne reçoit de donnée utilisateur.** À conserver, avec un commentaire `// sql-ok: structure` que la sonde reconnaîtrait.

---

### SEC-11 🟡 Du HTML est construit par concaténation partout dans le front · effort L

342 affectations `innerHTML` ; {{mesure:securite.innerHTML_interpolations_a_verifier}} contiennent une interpolation sans `MH.esc` visible. **Neuf ont été relues à la main (`u.js:71`, `profil.js:570`, `systeme.js:250`, `onboarding.js:289`, `global.js:291`, `parametres.js:188`, `stats.js:625`, `import.js:78`, `chapitre.js:1170`) : aucune n'est exploitable** — constantes de code, booléens, nombres, ou valeurs validées côté serveur (`status` est liste blanche). Le niveau d'hygiène est bon.

Le risque est **ailleurs** : il dépend de la discipline de chaque développeur à chaque ligne. Une seule omission — un titre de source, un nom de liste — suffit. Et les titres viennent de **sites tiers**.

**Correctif (méthode, pas 103 retouches)** : (1) un gabarit étiqueté `MH.html\`…${x}…\`` qui **échappe par défaut** et n'accepte du HTML brut que via `MH.brut(x)` ; (2) une règle ESLint (`no-unsanitized/property` ou règle maison) qui interdit `innerHTML = \`…${}\`` hors gabarit ; (3) la CSP du SEC-03 comme filet. La sonde `securite` sert de garde en attendant.

---

### SEC-12 🔵 Chaîne d'approvisionnement · effort S

Quatre actions GitHub tierces non épinglées par SHA (`reactivecircus/android-emulator-runner@v2`, `android-actions/setup-android@v4` ×2, `softprops/action-gh-release@v3`) ; `dependabot` ne surveille ni `gradle` ni `docker` ; image Docker de base à tag flottant ; **aucun job d'audit de dépendances ni CodeQL en CI**. Détails au §12.

### SEC-13 🟡 Le navigateur appelle directement des tiers, avec l'adresse IP de l'utilisateur · effort M

**Preuve (peigne fin : le navigateur de la sonde a été bloqué et ses tentatives comptées)** sur 26 pages : **`s4.anilist.co` ×372** (couvertures AniList chargées **sans passer par le proxy** `/api/img`), **`graphql.anilist.co` ×49**, **`www.youtube.com` ×363** (API IFrame du lecteur musique, relancée à chaque page tant que la lecture YouTube est reprise), `github.com` ×6 (vérification de version), `anilist.co` ×1, `stream.nightride.fm` ×1 (radio).

La page Confidentialité **déclare** AniList, YouTube, GitHub et nightride : la transparence existe. Reste que chaque couverture AniList affichée **révèle l'adresse IP et la série consultée** à un tiers, alors que le reste de l'application a justement un proxy pour l'éviter. **Correctif** : (1) toutes les images passent par `/api/img` (après COV-01, le repli de couvertures interrogera AniList **côté serveur** : l'utilisateur n'est plus exposé) ; (2) appels GraphQL AniList via le hub ; (3) l'API YouTube **seulement** après un clic explicite, jamais en reprise automatique ; (4) CSP `img-src`/`connect-src` limitées à ces hôtes (SEC-03).

### Ce qui est bien et à conserver

`estLocale` (double adresse, intersection socket + `req.ip`) · cookie `httpOnly; sameSite=lax; secure` en production · `authLimiter` efficace (28/40 limitées) · politique de mots de passe · sessions révocables · protection anti-SSRF du proxy d'images (`file:`, boucle locale, métadonnées cloud, DNS-rebinding) · hashes d'extensions vérifiés (SEC-03 ancien) · `adminRequired` sur les opérations qui touchent le disque · suppression du compte complète (RGPD art. 17).
