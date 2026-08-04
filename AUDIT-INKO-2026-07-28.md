# Audit Inko — rapport unique et exhaustif

**Version auditée** : `main` @ `89e2b4a` — v2.3.4 · arbre propre · 192 commits
**Date** : 28 juillet 2026
**Base de données** : instance réelle — 26 comptes, 358 favoris, 52 notifications, 9 extensions

Ce document remplace et fusionne les quatre volets d'audit produits séparément
(statique, live, complément, fonctionnel). Il est **complémentaire** de
`audit.md` (audit de juillet 2026, dont les plans d'action ont été appliqués —
voir CHANGELOG 2.3.x) : il ne re-signale pas ce qui a été traité.

## Méthode

| Volet | Ce qui a été fait |
|---|---|
| **Statique** | Lecture du code : 14 contrôleurs, 11 libs, 4 middlewares, 34 modules front, 9 extensions, schéma SQL, CI, Docker, Tauri |
| **Exécution** | `node server/server.js` sur la base réelle ; 22 pages parcourues et instrumentées (`performance`, DOM, `caches`, `navigator.storage`, contraste WCAG calculé) |
| **Fonctionnel** | Chaque contrôle **actionné** : clics, saisies, raccourcis clavier, écritures, puis vérification de l'effet côté serveur et en base |
| **Vérification** | `npx eslint`, `node --test`, requêtes SQL directes, appels API authentifiés **et anonymes** |

> Toutes les données de test ont été nettoyées et le retour à l'état initial
> vérifié : 18 chapitres marqués puis dépilés, commentaire de test supprimé,
> liste de test supprimée, progression effacée, thème restauré.

---

# PARTIE I — SYNTHÈSE

## I.1 Verdict

Inko est **nettement plus sain que la moyenne** pour un projet solo : lint
propre, 32 tests verts, 3 workflows CI, Dependabot sur 4 écosystèmes, migrations
versionnées, headers de sécurité, rate-limiting différencié, anti-SSRF sérieux,
**aucune injection SQL**, service worker soigné, README et CHANGELOG réels,
**zéro TODO/FIXME** dans le code applicatif.

Les problèmes se concentrent sur cinq axes.

| Axe | Gravité | Résumé |
|---|---|---|
| Échappement HTML → RCE desktop | 🔴 Critique | `esc()` n'échappe pas `"`. Exploit exécuté. Dans l'app Tauri, la chaîne va jusqu'à l'exécution de code arbitraire. |
| Mise à jour non vérifiée | 🔴 Critique | L'installeur `.exe` est lancé après une seule vérification : « fait plus d'1 Mo ». |
| Fuite de confidentialité | 🔴 Critique | `/api/comments-recent` expose sans auth pseudo + lectures, pendant que l'UI promet « ton avis reste privé ». |
| Pseudos non uniques | 🔴 Critique | Prouvé en base (`Kaito`×2, `Otaku`×9). Le profil public affiche un autre compte **et contourne le réglage « profil privé »**. |
| Mode incognito troué | 🔴 Critique | Annonce « lecture non enregistrée » et écrit pourtant **16 chapitres en base** au marquage. |
| N+1 vers les sites scrapés | 🟠 Élevée | Ouvrir son profil = **201 scrapes** de weebcentral.com, 80 s de réseau cumulé. |

Plus un problème d'empreinte disque traité à part (**III.11**) : **3,97 Go**
d'arbre de travail pour ~3 Mo de code utile, dont **3,56 Go récupérables** —
781 Mo d'Electron entièrement orphelin, 404 Mo d'installeurs de versions
obsolètes, 1,64 Go de cache Rust jamais élagué et 738 Mo d'outillage vidéo
sans rapport avec le projet.

## I.2 Décompte des constats

| Domaine | 🔴 | 🟠 | 🟡 | 🟢 | Total |
|---|---|---|---|---|---|
| Sécurité | 4 | 5 | 5 | 1 | **15** |
| Bugs fonctionnels | 3 | 8 | 8 | 3 | **22** |
| Base de données | 1 | 1 | 4 | 0 | **6** |
| Performance | 0 | 5 | 5 | 0 | **10** |
| Accessibilité & mobile | 0 | 5 | 6 | 0 | **11** |
| i18n | 0 | 2 | 3 | 0 | **5** |
| Desktop | 2 | 0 | 3 | 0 | **5** |
| Extensions | 0 | 1 | 2 | 1 | **4** |
| Qualité / CI | 0 | 1 | 6 | 1 | **8** |
| Hygiène & découvrabilité | 0 | 1 | 7 | 2 | **10** |
| Empreinte disque (III.11) | 0 | 2 | 2 | 0 | **4** |
| | **10** | **31** | **51** | **8** | **100** |

**Couverture vérifiée mécaniquement** : les 100 constats sont tous rattachés à au
moins une action (Partie V) ou une amélioration (Partie VI). Seul `A11Y-11` n'a
pas d'action — c'est un constat positif.

## I.3 Corrections de mes propres erreurs

Cinq constats de mes volets intermédiaires se sont révélés **faux** au test réel.
Ils venaient de sélecteurs CSS erronés, de références DOM périmées ou de
`.focus()` programmatique. Ils sont retirés du décompte ci-dessus.

| Constat retiré | Réalité vérifiée |
|---|---|
| « 0/22 pages ont un skip-link » | `global.js:1006` en injecte un partout |
| « 114/120 éléments sans indicateur de focus » | `.focus()` ne déclenche pas `:focus-visible`. Au vrai `Tab` : `outline solid 2.4px`. Système correct. |
| « La recherche de chapitres ne filtre pas » | `17`→1, `volume`→18, `Tome 17`→0 + message. Correct. |
| « Marquer + précédents ne fait rien » | 18/18 chapitres marqués. Je comptais les séries. |
| « La grille bibliothèque se vide » | Artefact : les cartes sont `.lib2-card`, pas `.manga-card`. |

---

# PARTIE II — INVENTAIRE DE L'EXISTANT

## II.1 Périmètre physique

| Zone | Contenu | Versionné |
|---|---|---|
| Racine | 22 pages HTML, `service-worker.js`, manifeste, Docker, ESLint | oui |
| `assets/` | 34 modules JS (7 900 l.), 31 CSS, 6 libs vendor (2,2 Mo), i18n fr/en, 7 captures | 70 f. |
| `server/` | Express 5 + MySQL : 14 contrôleurs, 11 libs, 4 middlewares, 1 routeur, 4 fichiers de tests | 46 f. |
| `extensions-community/` | 9 extensions + `hashes.json` + `versions.json` | 12 f. |
| `server/extensions/` | copie runtime (identique — vérifié par hash) | ignoré |
| `desktop-tauri/` | Tauri 2 (Rust) + `prep.js` + icônes | 30 f. |
| `desktop/` | **782 Mo de `dist/` + `node_modules/` Electron, aucun source** | ignoré |
| `tools/` | ffmpeg, frames, polices JP + 2 scripts utilisés par la CI | ignoré (sauf 2) |
| `promo/` | 3 brouillons d'articles | oui |
| `.github/` | `ci.yml`, `release.yml`, `sources-health.yml`, `dependabot.yml` | oui |

## II.2 Surface fonctionnelle

**96 routes REST** sous `/api`. Domaines : auth (local + Google + mode sans
compte), sources/extensions, catalogue, lecture manga & roman, bibliothèque,
progression, collections, commentaires + threads + signalements, notes de
lecture, ratings, stats/heatmap, notifications in-app + Web Push, import
EPUB/CBZ/PDF, export/import de données, admin/modération, profils publics.

**18 tables** (`schema.sql` + `migrate.js`), migrations versionnées via
`schema_migrations` (v1 socle, v2 `progress.total_pages`).

**Distribution** : Docker Compose (app + MySQL), installeur Windows NSIS via
Tauri publié sur tag `v*`, PWA installable.

## II.3 Santé mesurée

```
npx eslint assets/js      → 0 erreur, 0 warning
cd server && node --test  → 32 tests, 32 pass, 0 fail
git status                → clean · 206 fichiers versionnés
arbre de travail          → 3 972 Mo
```

---

# PARTIE III — CONSTATS PAR DOMAINE

## III.1 Sécurité

### SEC-01 🔴 XSS stocké — exploit exécuté dans l'app en fonctionnement

`assets/js/global.js:11` :

```js
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
//                                            ↑ le guillemet double n'est PAS échappé
```

Utilisé **à l'intérieur d'attributs** : `global.js:692, 908, 910, 921, 923`.

Test lancé dans `/notifications.html` en session réelle :

```js
MH.esc('x" onerror="alert(1)')      // → 'x" onerror="alert(1)'  (inchangé)
MH.notifItemHTML({ image: 'x" onerror="alert(1)', … })
```

HTML réellement produit :

```html
<img class="nt-cover" src="x" onerror="alert(1)" alt="" loading="lazy" …>
```

L'attribut se referme après `src="x"` et `onerror=` devient un attribut à part
entière. `src="x"` échouant toujours, le handler part immédiatement.

**Chaîne d'alimentation vérifiée** : extension → `favorites.cover`
(`user.controller.js:37-45`, aucune validation) → `lib/updates.js:177` →
`notifications.image` → `MH.notifItemHTML`. La cloche est présente sur les
22 pages.

Il existe **quatre implémentations concurrentes** de l'échappement :

| Fichier | Échappe | Manque |
|---|---|---|
| `global.js:11` | `& < >` | **`"`** |
| `music.js:401` | `& < >` | **`"`** |
| `card-hover.js:135` | `& < >` | **`"`** |
| `notes-ui.js:26` | `& < > "` | — |
| `localreader.js:445` | via `textContent` | — |

**Correctif** : un seul `MH.esc` échappant `& < > " '`. Une ligne.

### SEC-02 🔴 XSS → exécution de code arbitraire dans l'app desktop

`desktop-tauri/src-tauri/tauri.conf.json` :
```json
"withGlobalTauri": true,          // expose window.__TAURI__ à la page
"security": { "csp": null }       // aucune CSP webview
```

`capabilities/default.json` :
```json
"remote": { "urls": ["http://127.0.0.1:8088/*", "http://localhost:8088/*"] },
"permissions": [{ "identifier": "shell:allow-execute",
  "allow": [{ "name": "binaries/node", "sidecar": true, "args": true }] }]
```

L'origine `127.0.0.1:8088` — **l'application elle-même** — peut exécuter le
binaire `node` embarqué **avec des arguments arbitraires**. Or `node -e "<code>"`
exécute n'importe quoi.

La CSP serveur s'applique bien en desktop (`security.js:25`, `IS_DESKTOP`) mais
conserve `'unsafe-inline'` : elle **n'arrête pas** un `onerror=` injecté.

`SEC-01` + ceci = **compromission de la machine**, pas seulement vol de session.

**Correctifs** : `"args": false` ou allowlist stricte (le sidecar ne reçoit que
`server.js`, passé par `main.rs:47`) · retirer `withGlobalTauri` · retirer
`localhost:8088` de `remote.urls` · poser une CSP au lieu de `null`.

### SEC-03 🔴 La mise à jour installe un exécutable non vérifié

`server/controllers/update.controller.js` :

```js
const { url } = await resolveInstallerUrl();   // API GitHub, ou URL de repli
await download(url, dest);
if (!fs.existsSync(dest) || fs.statSync(dest).size < 1_000_000)   // ← SEULE vérification
    return res.status(502)…;
spawn(dest, ['/S'], { detached: true });        // installation silencieuse
```

Aucune signature Authenticode, aucun SHA-256, aucun pinning. `resolveInstallerUrl()`
accepte `stable || setup || exes[0]` — **n'importe quel `.exe`** de la release.

Contraste : le canal des **extensions** vérifie un SHA-256
(`extensions.controller.js:97-100`) ; l'installeur de l'application entière ne
vérifie rien.

**Primitive d'injection** (lignes 45-47, repli si curl échoue) :
```js
`Invoke-WebRequest -Uri '${url}' -OutFile '${dest}' -UseBasicParsing`
```
`url` vient de la réponse GitHub. Un guillemet simple ferme la chaîne PowerShell.

### SEC-04 🔴 Commentaires annoncés « privés », publiquement lisibles sans auth

L'UI affiche : « Qu'as-tu pensé de cette œuvre ? **(ton avis reste privé pour
l'instant)** ».

Test : commentaire posté (id 14), relu **sans aucune session** (`credentials:'omit'`) :

```
GET /api/comments-recent  →  200 OK, commentaire présent
```
```json
{ "text":"…", "user":"Kaito", "avatar":"K",
  "mangaTitle":"Fullmetal Alchemist – Perfect Edition",
  "mangaSource":"sushiscan", "createdAt":"2026-07-30T16:27:54.000Z" }
```

`routes/index.js:121` n'a **aucun middleware d'auth**, contrairement à
`/comments/:mangaId` juste en dessous (`authOptional`, qui renvoie bien 0 en
anonyme). Sur un hub exposé : flux en direct de qui lit quoi, avec pseudo.

### SEC-05 🟠 Aucune invalidation de session

JWT signé **30 jours** (`middleware/auth.js:46`), vérifié par signature +
existence de l'utilisateur. Ni liste de révocation, ni `token_version`, ni `jti`.

- `changePassword` (`auth.controller.js:307-325`) met à jour `password_hash` et **rien d'autre**
- `resetPassword` (`:284-304`) : idem — un « mot de passe oublié » ne chasse pas l'intrus
- `logout` ne vide que le cookie côté client

**Correctif** : `users.token_version INT DEFAULT 0`, incrémentée aux trois
endroits, mise dans le payload et comparée dans `authRequired`. ~15 lignes.

### SEC-06 🟠 Le jeton vit aussi dans `localStorage`

`api.js:27-41` persiste `{user, token}` sous `mh_session`, en plus du cookie
`httpOnly` — ce qui annule la protection du cookie. Avec SEC-01, tout XSS devient
un vol de session de 30 jours irrévocable (SEC-05).

### SEC-07 🟠 Vérification d'intégrité des extensions : fail-open

`extensions.controller.js:71-100`. Le commentaire annonce « fail-closed » :

```js
async function getExpectedHashes() { … catch (e) { return {}; } }   // réseau HS → aucun hash
const src = await getLatestSource(id, hashes[id]);                   // undefined → aucune vérif
if (expectedHash) { … }                                              // conditionnelle
```

Hash absent ou injoignable → le JS téléchargé est écrit sur disque et **exécuté
par le serveur** sans contrôle.

### SEC-08 🟠 `loadAll()` ne vérifie aucun hash

`extensions/loader.js:40-79` charge tout `extensions/*/index.js` présent. Le
commentaire ligne 66-71 affirme que le canal officiel est vérifié — c'est vrai à
l'installation, **pas au chargement**. Un fichier modifié après coup est exécuté.

### SEC-09 🟠 CORS permissif en mode desktop

`security.js:78` : `const permissiveOk = !IS_PROD || CORS_ALLOW_ANY;`

Le sidecar desktop tourne sans `NODE_ENV=production` — c'est précisément la
raison d'être de `IS_DESKTOP` deux lignes plus haut pour la CSP. `corsOptions()`
n'applique pas le même raisonnement. Impact limité par `sameSite:'lax'` (les
endpoints authentifiés restent protégés), mais toute page web peut détecter
qu'Inko tourne et lister les sources installées.

**Correctif** : `!(IS_PROD || IS_DESKTOP) || CORS_ALLOW_ANY`.

### SEC-10 🟡 18 routes de relais sans rate-limit

`searchLimiter` couvre `/search-all`, `imgLimiter` couvre `/img`. Mais ces routes,
qui déclenchent toutes un appel sortant vers un site tiers, n'ont aucune limite
(`routes/index.js:77-95`) : `/mangas/search`, `/popular`, `/latest`, `/tags`,
`/mangas/:id`, `/:id/chapters`, `/chapters/:id/pages`, `/text`, `/artwork`,
`/anilist/similar` + les 8 équivalents scopés.

Sur une instance exposée : amplificateur de déni de service **par ricochet vers
les sites scrapés**.

### SEC-11 🟡 Cookie nommé `token` — collision entre projets localhost

`document.cookie` lu depuis Inko révèle `kinka_token`, `kinka_cookies_accepted`…
Les cookies ne sont pas isolés par port : tous les projets Laragon partagent le
jar. Inko pose `token` avec `path=/`. Kinka a fait le bon choix (`kinka_token`).

### SEC-12 🟡 Jetons de reset concurrents

`requestReset` (`auth.controller.js:259-264`) fait un `INSERT` sans invalider les
précédents : N tentatives = N jetons valides simultanément pendant 1 h.

### SEC-13 🟡 Base embarquée : mot de passe en clair, repli sans mot de passe

`embedded-db.js:71-74` écrit `{password: …}` en JSON non chiffré. Et lignes 96-98,
si le durcissement échoue, la base démarre **sans mot de passe root**, protégée
par le seul bind `127.0.0.1`. Choix assumé (éviter l'écran noir) mais tout
processus local y accède.

### SEC-14 🟡 Pas de validation par signature de fichier à l'upload

`local.controller.js:33-38` décide du type sur la seule extension. Impact faible
(servi en `application/octet-stream`, au seul propriétaire).

### SEC-15 🟢 Sauvegardes en clair

`server/backups/` — 6 dumps JSON contenant l'email et toute la bibliothèque des
26 comptes. Correctement exclus de git et bloqués en HTTP (`app.js:52`), mais non
chiffrés — et inutilisables (voir BUG-13).

### ✅ Points de sécurité solides, vérifiés

- **Aucune injection SQL.** Toutes les interpolations trouvées
  (`notes.controller.js:45`, `auth.controller.js:347`, `user.controller.js:286`,
  `admin.controller.js:15`) portent sur des entiers `parseInt`-clampés ou des noms
  de colonnes littéraux.
- **Aucune injection de commande.** Tous les appels `curl` utilisent
  `execFile('curl', [args])` avec tableau d'arguments, jamais de shell.
- **Proxy d'images** (`image.controller.js`) : anti-SSRF sérieux — plages privées
  IPv4 **et** IPv6, CGNAT RFC 6598, IPv4 mappée, multicast ; liste blanche de
  domaines ; cache borné en octets ; déduplication des requêtes en vol.
- **Imports locaux** : propriété vérifiée à chaque accès, quota cumulé, rollback
  fichier si l'INSERT échoue, jamais servis statiquement.
- **Suppression de compte** : purge FK + `password_resets` + `fs.rmSync` des
  uploads. RGPD art. 17 correctement implémenté (mais voir BUG-18).
- **Secret JWT** : `lib/secret.js` refuse de démarrer en production sur un secret
  faible, détecte toute variante de `change-me`. Vérifié au boot en live.
- **`BLOCKED_DIRS`** (`app.js:52`) empêche de servir `server/`, `.git`, etc.

## III.2 Bugs fonctionnels

### BUG-01 🔴 Le profil public affiche un autre compte — et contourne « profil privé »

En base :
```
Kaito × 2   (id 1 : demo@mangahub.app, mai 2026 · id 26 : demo@inko.app, juin 2026 ← actif)
Otaku × 9
```

Même session, deux endpoints :

| | `/api/me/stats` (compte connecté, id 26) | `/api/users/profile/Kaito` |
|---|---|---|
| Favoris | **358** | **4** |
| Chapitres | **27** | **2** |
| Notes | 0 | 1 |

Sur `/u.html?u=Kaito` : l'en-tête montre le compte connecté, le corps montre
celui de mai 2026. Deux identités sur le même écran.

**Aggravation** : les réglages du compte actif contiennent
`"privacy": { "privateProfile": true }`. L'utilisateur a rendu son profil privé —
et un profil public portant son pseudo reste visible, parce qu'il résout vers
l'autre compte. **Le réglage de confidentialité est inopérant.**

Cause : `db/schema.sql:11-22` — `INDEX idx_username`, pas `UNIQUE` ; aucun
contrôle à l'inscription (`auth.controller.js:105-133`) ni au changement
(`:328+`) ; `profile.controller.js:19-22` résout `WHERE username = ?`.

### BUG-02 🟠 `/profil.html` : 201 scrapes externes par affichage

```
Appels /api total ............................. 225
dont /api/sources/weebcentral/mangas/:id ...... 201   (moy. 374 ms, max 1 231 ms)
Temps réseau cumulé ........................... 79 706 ms
```

`profil.js:75-78` :
```js
async function loadMangas(ids) {
  const results = await Promise.all(ids.map(id => loadManga(id)));  // 1 requête/id, concurrence illimitée
}
```
Appelée par la grille de favoris (`:800`, 60 ids), l'historique (`:583`),
les genres (`:320`, 60), les avis (`:283`, 30).

`manga.controller.js:94-100` (`getOne`) est un relais **sans aucun cache** : chaque
appel scrape weebcentral.com.

**La donnée existe déjà** : `favorites` stocke `title` et `cover`, et
`/api/me/favorites` les renvoie **pour les 358 séries en un appel**
(`user.controller.js:20`). La page jette cette donnée et la re-télécharge une par une.

### BUG-03 🟠 `/api/health` répond `ok:true` avec la base morte

Découvert par accident (MySQL s'est arrêté en cours d'audit) :

```
[db] base injoignable : ECONNREFUSED
23:54:00 GET /api/health        ← répond 200 {ok:true}
```

`routes/index.js:21-25` ne fait aucun ping — il renvoie une constante. Le
`HEALTHCHECK` du Dockerfile (`curl /api/health`) considère donc sain un conteneur
totalement HS : Docker ne le redémarre jamais. `config/db.js` exporte pourtant
déjà `ping()`, utilisé uniquement au boot.

### BUG-04 🟠 Message trompeur quand la base tombe

Pendant la même panne, `/stats.html` affichait : « **Connexion requise** — Ta
session a expiré ou tu n'es pas connecté. Recharge la page. » La session était
valide ; `POST /api/auth/local` renvoyait **503**. L'utilisateur se reconnecte en
boucle pour un problème sans rapport. Le front assimile tout échec d'auth à
« session expirée ».

### BUG-05 🟠 Project Gutenberg classé dans « Mangas — Lecture en images »

Confirmé dans le DOM rendu. Le groupe **« Mangas · Lecture en images · 5 »**
contient MangaDex, SushiScan, Weeb Central **et les 2 sources Gutenberg**, qui
sont du texte pur. Le badge `ROMAN` ne s'affiche pas non plus pour elles.

L'API distingue **trois** types :
```json
{ "novel":["chireads","novelbin","novelfull","royalroad"],
  "book":["gutenberg","gutenberg-fr"],
  "manga":["mangadex","sushiscan","weebcentral"] }
```

`sources.js:143-144` n'en connaît que deux :
```js
const mangas = sources.filter(s => (s.type || 'manga') !== 'novel');  // 'book' atterrit ici
const novels = sources.filter(s => s.type === 'novel');               // 'book' exclu
```

**Le correctif existe déjà** — `global.js:152-154` :
```js
window.MH.isNovelSource = id => t === 'novel' || t === 'book';
```
Seule la page Sources n'utilise pas ce point de vérité. Le routage du lecteur est correct.

### BUG-06 🟠 Le tri « Note » ne trie rien (source par défaut)

```
GET …/search?sort=popularity  →  One Piece, Blue Lock, Hunter x Hunter, …
GET …/search?sort=rating      →  One Piece, Blue Lock, Hunter x Hunter, …   (identique)
```
WeebCentral ignore `sort=rating` sans le signaler. `sort=latest` et `sort=alpha`
changent bien le résultat : le paramètre est transmis, c'est la source qui ne gère pas.

### BUG-07 🟠 Le tri « A → Z » est inversé

`sort=alpha` sur WeebCentral renvoie :
```
μ & i, élDLIVE, Éclair, your name. Another Side, your name., xxxHOLiC Rei, xxxHOLIC, vs. LOVE
```
C'est un tri **Z → A**. MangaDex trie correctement (`---`, `-50kg Cinderella`…).
Sur la source par défaut, **2 options de tri sur 5 sont fausses**.

### BUG-08 🟠 Le filtre « Chapitres » des notifications est toujours vide

52 notifications, **toutes** de type `new_chapter`. Le filtre renvoie 0.

```
pastille « Chapitres » → data-f = "chapter"
types réels en base    → { "new_chapter": 52 }
```

`lib/updates.js:173` écrit `new_chapter` ; `notifications.js:109` filtre sur
`chapter`. Le projet **connaît** les deux orthographes — `global.js:899-902` mappe
les deux pour l'icône — mais le filtre n'en gère qu'une.

### BUG-09 🟠 `lists.is_public` : drapeau mort

Le renommage en liste publique fonctionne (`PUT /api/me/lists/:id` → `isPublic:true`
persisté). Mais **aucune route n'expose les listes publiques** :

```
/api/lists/public       → 404
/api/lists/6            → 404
/api/users/Kaito/lists  → 404
/api/users/profile/Kaito → 200, clés : username, avatar, bio, memberSince,
                            private, isOwner, stats, badges  (pas de lists)
```

L'utilisateur peut marquer une liste « publique » — rien ne la rend publique.

### BUG-10 🟠 Le mode hors-ligne promet ce qu'il ne tient pas

`/offline.html` : **0 lien**, 1 bouton (`location.reload()`). Texte affiché :
« Ta bibliothèque et les chapitres déjà téléchargés **restent accessibles**. »

Et même avec un lien, `bibliotheque.js` / `bibliotheque.css` **ne sont pas
précachés** (`bibliotheque.html` l'est) : coquille vide non stylée.

### BUG-11 🟠 Précache du service worker incohérent — 15 fichiers manquants

Écart mesuré entre les fichiers réellement utilisés et `STATIC_ASSETS` :

**JS (10)** : `bibliotheque.js`, `parametres.js`, `sources.js`, `notes.js`,
`notes-ui.js`, `card-hover.js`, `eula.js`, `hero3d.js`, `onboarding.js`, `pwa.js`
**CSS (4)** : `bibliotheque.css`, `notes.css`, `recherche.css`, `music.css`
**HTML (1)** : `notes.html`

Bon point : **0 entrée morte** (les 4 404 de l'audit précédent ont bien été retirées).
Caches réellement actifs : `inko-v21-static`, `-covers`, `-runtime`, `inko-offline`.

### BUG-12 🟠 Les sauvegardes automatiques sont irrécupérables

`lib/backup.js:44-51` écrit :
```json
{ "inkoBackup":1, "createdAt":"…", "accounts":[ { "user":…, "favorites":[…] } ] }
```
`user.controller.js:710` (`importData`) lit `d.favorites`, `d.library`… soit la
forme de l'**export par compte**. Donner un dump nocturne à `/me/import`
n'importe **rien**. Aucun autre chemin : `server/scripts/` ne contient que
`reset-password.js`. Une sauvegarde non restaurable n'en est pas une.

### BUG-13 🟠 L'administration est entièrement codée et injoignable

| Couche | État |
|---|---|
| Serveur | ✅ `admin.controller.js` (107 l.) — stats, users, setRole, setBan, reports, resolveReport |
| Routes | ✅ `routes/index.js:145-150`, protégées par `adminRequired` |
| Client | ✅ `api.js:485-493` — 6 méthodes câblées |
| Traduction | ✅ `fr.json` : `"common.admin": "Administration"` |
| **Interface** | ❌ **inexistante** |

`global.js:703-705` : `// L'administration vivra dans une app dédiée … const adminBtn = '';`

**Conséquence** : `serie.js` permet de **signaler** un commentaire
(`User.reportComment` → table `reports`) et **rien** ne permet de consulter ni
résoudre un signalement. Même chose pour bannir (`users.banned` existe et est
respecté par `authRequired`, aucune UI ne le positionne).

### BUG-14 🟡 Images à `src` vide sur `/profil.html`

3 images cassées, `src` résolu à `http://localhost:8088/profil.html` — signature
de `<img src="">`, que le navigateur résout en URL courante (et re-télécharge la
page comme image). Source : `profil.js:291` et `:601` —
`<img src="${m?.coverThumb || m?.cover || ''}">`.

### BUG-15 🟡 `/anilist.html` est un cul-de-sac

Sans paramètres OAuth : **15 nœuds DOM, 0 bouton, 0 lien**, texte « Connexion
échouée — Autorisation annulée ». Pas d'en-tête, pas de retour. À comparer avec
`/localreader.html` sans paramètres, qui affiche « ← Bibliothèque ».

### BUG-16 🟡 Compteurs incohérents entre pages

- `/profil.html` : « **5** SÉRIES » → `totals.library` (5)
- `/stats.html` : « **13** Séries lues » → `totals.series_read` (13)

Deux métriques distinctes portant le même mot, sans distinction visible.

- `/recherche.html?q=naruto` : « Tout · **119** » mais « Mangas · 45 » + « Romans · 75 » = **120**.

### BUG-17 🟡 CBR annoncé par le backend, refusé par le frontend ; PDF non documenté

- `import.html` : `accept=".epub,.pdf,.cbz,.zip"` + « Le format CBR n'est pas encore lisible »
- `routes/index.js:127` : « Import local (EPUB / CBZ / **CBR**) »
- `migrate.js:197` : `type VARCHAR(16) -- cbz | cbr | epub`

Le schéma décrit une capacité inexistante et omet le PDF, réellement accepté.

### BUG-18 🟡 Le propriétaire local ne peut pas supprimer son compte

`auth.controller.js:362-363` bloque `demo@inko.app` — or c'est **le compte
propriétaire actif** (id 26, admin, 358 favoris) que `LOCAL_MODE` résout. Le
commentaire juste au-dessus invoque le droit à l'effacement (RGPD art. 17).

### BUG-19 🟡 `fr.json` n'est jamais chargé

`i18n.js:124-137` ne fetch `/assets/i18n/<lang>.json` **que si `lang !== 'fr'`**.
`fr.json` (18 clés) est livré, précaché (`service-worker.js:67`)… et jamais lu.

### BUG-20 🟢 Clé de test dans les réglages de production

`{ "theme":"dark", "accent":"#ff6b1a", "testpref": 1, … }`

### BUG-22 🔴 Le mode incognito n'empêche pas le marquage « lu »

`global.js:89-105` promet : « lecture privée : **ni progression, ni historique** »,
et le toast affiche « Mode incognito activé — **lecture non enregistrée** ».

Test réel, incognito actif (`sessionStorage.inko_incognito = '1'`, classe
`incognito-on` posée) :

| Action | Écriture en base | Verdict |
|---|---|---|
| Tourner les pages | page 10 → 10, `updatedAt` inchangé | ✅ **respecté** |
| Bouton « Marquer ce chapitre (et les précédents) » | **0 → 16 chapitres écrits** | ❌ **ignoré** |

Contrôle : hors incognito, la progression passe bien de la page 2 à la page 10 —
le chemin de progression vérifie donc `MH.isIncognito()`, le chemin de marquage
non.

Une fonctionnalité de confidentialité qui écrit 16 lignes en base alors qu'elle
annonce le contraire. Le geste est de surcroît **irréversible** sans dépilage
manuel chapitre par chapitre.

**Correctif** : ajouter le garde `MH.isIncognito()` dans le handler de marquage
(et auditer les autres écritures : favoris, notes, événements).

### BUG-21 🟢 Le bouton favori du catalogue ne dit rien aux lecteurs d'écran

Écriture serveur confirmée (358 → 359 → 358). Mais :

| | avant | après ajout |
|---|---|---|
| classe | `card-fav-btn` | `card-fav-btn is-fav` ✅ |
| `<svg fill>` | `none` | `currentColor` ✅ |
| **`title`** | « Ajouter aux favoris » | **inchangé** ❌ |
| **`aria-pressed`** | absent | **absent** ❌ |

Le projet sait faire : sur la fiche série, « Non lu → Lu » et « Ajouter un signet
→ Retirer le signet » se mettent correctement à jour. Le catalogue est l'exception.

## III.3 Base de données

| Réf | Constat |
|---|---|
| **DB-01** 🔴 | `users.username` sans `UNIQUE` → BUG-01 |
| **DB-02** 🟠 | `favorites` **et** `library` : une ligne par (user, manga) chacune ; toutes les requêtes doivent faire un `LEFT JOIN` (`updates.js:60-63`) |
| **DB-03** 🟡 | `library.rating` : colonne jamais écrite (la table `ratings` a pris le relais) |
| **DB-04** 🟡 | Aucune contrainte `CHECK` sur `ratings.rating` / `library.rating` (1..5) — validation purement applicative |
| **DB-05** 🟡 | `migrate.js` : la v1 (`legacySchema`, l. 89-204) englobe tout l'historique — 7 tables, 6 colonnes, 3 index, 6 changements de type. Idempotente mais illisible. `run()` (l. 18-25) avale les erreurs inconnues en `console.warn` : une migration réellement en échec laisse démarrer sur un schéma incohérent. |
| **DB-06** 🟡 | `password_resets` : pas d'invalidation des jetons précédents (SEC-12) |

## III.4 Performance

| Réf | Constat | Mesure |
|---|---|---|
| **PERF-01** 🟠 | N+1 sur `/profil.html` | 225 appels, 201 scrapes, 79,7 s cumulés |
| **PERF-02** 🟠 | Fan-out sur `/accueil.html` | 39 appels API, 66 requêtes |
| **PERF-03** 🟠 | `getOne` sans cache serveur | relais direct, 374 ms de moyenne |
| **PERF-04** 🟠 | Lecteur de **texte** : livre entier en DOM | Moby Dick → **19 222 nœuds**, 1 seul « chapitre » |
| **PERF-05** 🟠 | Bibliothèque non paginée | 358 séries → 4 810 nœuds, 784 boutons, 367 images |
| **PERF-06** 🟡 | Aucun bundler ni minification | 12 `<script>` sériels sur l'accueil ; vendor 2,2 Mo (`pdf.worker` 1,06 Mo, `three` 607 Ko) |
| **PERF-07** 🟡 | `@import` Google Fonts (`global.css:9`) | requêtes sérialisées sur le chemin critique + fuite vie privée + casse hors-ligne. `assets/font/` **existe et est vide** |
| **PERF-08** 🟡 | Proxy d'images contourné | bibliothèque : 100 via `/api/img`, **326 en direct** ; lecteur : **0 via le proxy** |
| **PERF-09** 🟡 | Blob de réglages à chaque page | 8 188 o dont **7 348 o de `anilistLinks`** (~160 entrées, aucune éviction) |
| **PERF-10** 🟢 | Mode défilement double les nœuds image | page 329 → **défilement 654** → double 330 (chargements bornés à 8, impact faible) |

**✅ Bon point majeur** : la virtualisation du lecteur d'images livrée en 2.3.4
**fonctionne** — volume de 326 pages, `loading=lazy` sur 326/329, **5 requêtes
images déclenchées**.

## III.5 Accessibilité & mobile

| Réf | Constat | Mesure |
|---|---|---|
| **A11Y-01** 🟠 | `<main>` absent | **21 / 22 pages** (seul `profil.html` en a un) |
| **A11Y-02** 🟠 | Contraste WCAG AA | **34 échecs** en sombre, **58 en clair** sur 173 éléments. Pire : liens de pied de page en clair à **1,73:1** ; badges `TERMINÉ` à **1,90:1** dans les deux thèmes |
| **A11Y-03** 🟠 | Aucun `aria-pressed` / `aria-selected` | onglets bibliothèque, filtres type/statut, pastilles notifications, modes du lecteur, segments de paramètres, sidebar profil (`<a href="#">` sans `role="tab"`) |
| **A11Y-04** 🟠 | Débordement horizontal mobile | 375 px de viewport, **`scrollWidth` = 426** ; 61 éléments débordent, dont `.site-header` (426 px) |
| **A11Y-05** 🟠 | Cibles tactiles | **781 / 1 156** sous 44 px (boutons d'en-tête à 30×30) |
| **A11Y-06** 🟡 | `aria-live` | **0 sur 22 pages** — aucune mise à jour asynchrone annoncée |
| **A11Y-07** 🟡 | Skip-link à cible heuristique | `href="#"` + `header.nextElementSibling` : sur l'accueil, dépose sur le carrousel |
| **A11Y-08** 🟡 | `title` du bouton favori jamais mis à jour | BUG-21 |
| **A11Y-09** 🟡 | Labels manquants | `#inpUsername`, `input[type=file]` d'import |
| **A11Y-10** 🟡 | `collections.css:121` | `.sort-dropdown-mini:focus { outline:none }` **sans remplacement** (les 7 autres `outline:none` compensent par `border-color`) |
| **A11Y-11** ✅ | Nav mobile | présente et fonctionnelle — *constat positif, aucune action* |

**✅ Corrigé de mon erreur** : le système de focus est **sain**
(`global.css:137-143` : `:focus{outline:none}` puis `:focus-visible{…}`) — vérifié
au vrai `Tab`, contour `solid 2.4px`. Les `alt` sont présents (0 manquant), un
seul `onclick` inline (`offline.html`), `lang` sur 22/22.

## III.6 Internationalisation

| Réf | Constat |
|---|---|
| **I18N-01** 🟠 | Deux schémas incompatibles : `fr.json` = clés sémantiques (`nav.home`, 18 entrées, **jamais chargé**) ; `en.json` = `{keys, strings, patterns}` avec **666 chaînes FR→EN** + 55 motifs. **0 clé en commun.** |
| **I18N-02** 🟠 | Couverture EN mesurée : **274 / 318 chaînes du HTML (86 %)**. Les trous sont `confidentialite.html` — « 1. Données traitées », « 2. Finalités », « 3. Stockage local »… **La politique de confidentialité n'est pas traduite.** |
| **I18N-03** 🟡 | Clé = **texte source français exact** → changer un mot casse la traduction **en silence**. Aucun contrôle au build, aucun rapport de clés manquantes. |
| **I18N-04** 🟡 | `MutationObserver` permanent sur `document.documentElement` (`childList + subtree + characterData + attributes`) toute la session en mode EN — y compris sur la bibliothèque (4 810 nœuds). |
| **I18N-05** 🟡 | Retour au français = **rechargement complet** (`i18n.js:148`, assumé). |

## III.7 Application desktop

| Réf | Constat |
|---|---|
| **DESK-01** 🔴 | XSS → RCE (= SEC-02) |
| **DESK-02** 🔴 | Mise à jour non vérifiée (= SEC-03) |
| **DESK-03** 🟡 | **Windows uniquement** : `bundle.targets:["nsis"]`, `main.rs` importe `std::os::windows::process::CommandExt`, `runUpdate` refuse `platform !== 'win32'` — malgré le positionnement multiplateforme du README |
| **DESK-04** 🟡 | Arrêt de MariaDB via `powershell -Command "Get-Process mariadbd …"` (`main.rs:96-102`), échec silencieux (`let _ =`) |
| **DESK-05** 🟡 | Installeur NSIS en **français seulement** alors que l'app expose une UI EN |

## III.8 Extensions de sources

| Réf | Constat |
|---|---|
| **EXT-01** 🟠 | `cheerio` est en `optionalDependencies` alors que **6 sources sur 9** en dépendent. `npm ci` n'échoue pas si elle ne s'installe pas → 6 sources tombent avec un simple `console.warn` (`loader.js:73-75`) |
| **EXT-02** 🟡 | `curl` est une **dépendance runtime non déclarée** (gutenberg ×2, novelbin, novelfull, sushiscan, `image.controller`). Le Dockerfile l'installe, Windows 10+ le fournit, rien ne le vérifie |
| **EXT-03** 🟡 | `sushiscan` **v0.7.2** — seule source < 1.0, la plus grosse (523 l.), 11 `catch` : la plus fragile |
| **EXT-04** 🟢 | Réessai présent seulement sur mangadex et gutenberg ×2 (7/9 sans) |

État vérifié : 9/9 chargées au boot, contrat validé par `source-interface.js`
(qui distingue correctement `novel` **et** `book`), bouton « Tester » fonctionnel
(« ✓ répond (79 038 résultats) » en 6 s).

## III.9 Qualité, tests, CI

| Réf | Constat |
|---|---|
| **QUAL-01** 🟠 | **Les tests d'intégration ne s'exécutent jamais en CI.** `integration.db.test.js` se saute proprement si MySQL est injoignable (l. 34-40) et `ci.yml` **ne déclare aucun service MySQL**. Les 4 suites (auth/user/notes/profile) sont vertes par abstention. |
| **QUAL-02** 🟡 | **Zéro test frontend** — 7 900 lignes de JS |
| **QUAL-03** 🟡 | **Zéro test e2e** — aurait attrapé BUG-01, 05, 06, 07, 08, 09, 14, 15 |
| **QUAL-04** 🟡 | Lint volontairement minimal : `no-unused-vars` et `no-undef` désactivés |
| **QUAL-05** 🟡 | Aucun contrôle a11y automatisé, aucun lint CSS, aucun budget de perf |
| **QUAL-06** 🟡 | `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, templates issue/PR **absents** — problématique vu le modèle d'extensions tierces |
| **QUAL-07** 🟡 | `server/package.json` bloqué à **1.0.0** (tout le reste est en 2.3.4) |
| **QUAL-08** 🟢 | `CACHE_VERSION` (`inko-v21`) est un compteur manuel désynchronisé de la version — un oubli produit l'« écran noir après mise à jour » qui a motivé le bouton « Vider le cache » de 2.3.4 |

**✅ Ce qui tourne** : `npm audit --audit-level=high`, `node --check` sur tous les
modules, smoke `require()`, `npm test`, lint frontend, build Docker ;
`release.yml` (Tauri + NSIS sur tag) ; `sources-health.yml` (hebdomadaire sur les
9 extensions) ; Dependabot npm ×2 + cargo + github-actions. Au-dessus de la moyenne.

## III.10 Hygiène & découvrabilité

| Réf | Constat |
|---|---|
| **HYG-01** 🟠 | Empreinte disque : **3 972 Mo dont 3 561 récupérables** — Electron orphelin, installeurs obsolètes, cache Rust, outillage vidéo. **Traité en détail en III.11** |
| **HYG-02** 🟡 | `assets/screenshots/hover.png` = doublon binaire exact de `catalogue.png` (SHA `82E914CFE4D3`, 1,27 Mo) |
| **HYG-03** 🟡 | `assets/font/` et `assets/image/` : **répertoires vides** (auto-hébergement des polices jamais fait ; doublon de nommage avec `assets/img/`) |
| **HYG-04** 🟡 | `tools/` est gitignoré, mais `sources-health.yml` lance `node tools/check-sources.js` — ne marche que parce que 2 fichiers ont été committés avant la règle |
| **HYG-05** 🟡 | Aucune cible `npm run clean` ni purge automatique de `bundle/` : les artefacts s'accumulent build après build (III.11 § Prévention) |
| **UX-01** 🟡 | **0/22 pages** ont `meta description` ou Open Graph — alors que l'app expose des **profils publics** et des collections destinées au partage |
| **UX-02** 🟡 | Pas d'`index.html` : `/` ne marche que grâce à `index:'accueil.html'` (`app.js:59`) |
| **UX-03** 🟢 | Liens morts du pied de page global (22 pages) : `Forum`, `Discord`, `Contact` → `href="#"` |
| **UX-04** 🟢 | « Conditions » pointe vers `confidentialite.html` — pas de CGU distinctes, alors que `eula.js` existe |
| **UX-05** 🟡 | `screenshots` absent du manifeste PWA malgré 6 captures présentes (7,2 Mo) |

## III.11 Empreinte disque locale — Electron & Tauri

Traité à part : **77 % du poste de travail est occupé par des artefacts de build
desktop**, dont une partie est purement morte.

### Répartition mesurée

```
desktop-tauri\src-tauri\target        2 185 Mo   (6 741 fichiers)
tools                                   738 Mo   (4 723 fichiers)
desktop\dist                            500 Mo   (3 116 fichiers)
desktop\node_modules                    281 Mo   (6 369 fichiers)
.git                                     58 Mo
desktop-tauri\src-tauri\resources        57 Mo   (3 050 fichiers)
desktop-tauri\.cache                     28 Mo
server\node_modules                      18 Mo
desktop-tauri\node_modules               15 Mo
assets                                   10 Mo
node_modules                              9 Mo
─────────────────────────────────────────────
TOTAL                                 3 972 Mo   (30 765 fichiers)
```

Le code source réel d'Inko (hors dépendances et builds) pèse **~3 Mo**.

### DISK-01 🟠 `desktop/` — 781 Mo d'Electron entièrement orphelin

```
desktop\dist          500 Mo
desktop\node_modules  281 Mo
```

Ce dossier ne contient **que** `dist/` et `node_modules/`. **Aucun fichier
source** — ni `main.js`, ni `package.json`, ni `preload.js`. Vérifié :

```
git status --porcelain --ignored desktop   →  !! desktop/   (intégralement ignoré)
Get-ChildItem desktop -Recurse -File -Exclude dist,node_modules  →  (vide)
```

C'est le résidu de l'application Electron **remplacée par Tauri**. Le `dist/`
contient encore un Chromium embarqué complet et une copie **périmée** du frontend
(`global.js` y fait 1 140 lignes contre 1 522 à la racine).

**Rien ne peut le reconstruire et rien n'en dépend : suppression sèche.**

### DISK-02 🟠 `target/release` — 2 185 Mo, dont 404 Mo d'installeurs obsolètes

```
deps          1 021 Mo    dépendances Rust compilées
build           617 Mo    scripts de build
bundle          404 Mo    ← 12 installeurs NSIS de versions passées
resources        56 Mo    copie frontend+server régénérée par prep.js
.fingerprint      3 Mo
```

Contenu de `bundle/nsis/` :

```
Inko_2.0.0_x64-setup.exe   28,9 Mo      Inko_2.2.4_x64-setup.exe   35,2 Mo
Inko_2.1.0_x64-setup.exe   28,9 Mo      Inko_2.2.6_x64-setup.exe   35,3 Mo
Inko_2.2.0_x64-setup.exe   28,9 Mo      Inko_2.3.0_x64-setup.exe   35,3 Mo
Inko_2.2.1_x64-setup.exe   35,2 Mo      Inko_2.3.1_x64-setup.exe   35,3 Mo
Inko_2.2.2_x64-setup.exe   35,2 Mo      Inko_2.3.2_x64-setup.exe   35,4 Mo
Inko_2.2.3_x64-setup.exe   35,2 Mo      Inko_2.3.3_x64-setup.exe   35,5 Mo
```

**La version courante est 2.3.4 — elle n'est pas dans la liste.** Ces 12
installeurs correspondent tous à des versions que plus personne n'installera :
les utilisateurs passent par les releases GitHub (`release.yml`). Cargo ne purge
jamais ce dossier ; il s'accumule à chaque `npm run build`.

`deps` + `build` (1 638 Mo) sont un cache de compilation légitime, mais jamais
élagué : il contient les artefacts de **toutes** les versions de dépendances
compilées depuis le début du projet.

### DISK-03 🟡 `tools/` — 738 Mo sans rapport avec Inko

```
ffmpeg-master-latest-win64-gpl   597 Mo
node_modules                      49 Mo
jpfonts                           20 Mo
frames                             6 Mo
```

C'est la chaîne de production vidéo (ffmpeg complet avec sa documentation, deux
`.mp4` de 57 Mo, polices japonaises) — rien à voir avec un lecteur de mangas.

**Et pourtant** `tools/` est gitignoré alors que `.github/workflows/sources-health.yml`
lance `node tools/check-sources.js` : deux scripts de 5 Ko, essentiels à la CI,
noyés dans 738 Mo d'outillage vidéo (voir HYG-04).

### DISK-04 🟡 Doublons régénérables

| Dossier | Poids | Régénéré par |
|---|---|---|
| `desktop-tauri\src-tauri\resources` | 57 Mo | `prep.js` à chaque build (copie de `assets/` + `server/`) |
| `desktop-tauri\.cache` | 28 Mo | téléchargement de MariaDB, retéléchargeable |

Ces 85 Mo sont recréés automatiquement — les garder n'apporte que du temps de
build économisé.

### Plan de remédiation

**Étape 1 — suppression sèche, 781 Mo, aucun risque**

```bash
rm -rf desktop/
```

Aucune source, aucune référence : ni `package.json` racine, ni CI, ni
`docker-compose.yml`, ni `release.yml` n'y font appel. `release.yml` builde
exclusivement `desktop-tauri`.

**Étape 2 — installeurs obsolètes, 404 Mo, aucun risque**

```bash
rm -rf desktop-tauri/src-tauri/target/release/bundle/
```

Les installeurs distribués vivent sur les releases GitHub. Ce dossier est
recréé au prochain `npm run build`.

**Étape 3 — cache de compilation Rust, 1 638 Mo, coût = un rebuild complet**

```bash
cd desktop-tauri/src-tauri && cargo clean
```

À faire si la place manque. Le prochain build sera long (~10 min) ; ensuite
l'incrémental reprend. Alternative moins radicale : `cargo install cargo-sweep`
puis `cargo sweep --time 30` (ne supprime que les artefacts de plus de 30 jours).

**Étape 4 — sortir `tools/` du projet, 738 Mo**

Déplacer la chaîne vidéo hors de `C:\laragon\www\Inko\`, et **remonter les deux
scripts de CI** dans un dossier versionné :

```bash
mkdir -p scripts-ci
git mv tools/check-sources.js tools/gen-ext-hashes.js scripts-ci/
# puis mettre à jour package.json et sources-health.yml
```

Cela règle du même coup HYG-04 (scripts essentiels dans un dossier gitignoré).

**Bilan** : **3 561 Mo récupérés sur 3 972**, soit un projet ramené à **~411 Mo**
dont 58 Mo de `.git` et ~45 Mo de `node_modules` légitimes.

### Prévention

| Mesure | Détail |
|---|---|
| Purger `bundle/` après publication | Une ligne à la fin de `desktop-tauri/package.json` → `"postbuild": "node -e \"require('fs').rmSync('src-tauri/target/release/bundle',{recursive:true,force:true})\""` — après que `release.yml` a téléversé l'asset |
| `cargo sweep` planifié | Tâche mensuelle, supprime les artefacts > 30 j sans casser l'incrémental |
| Script `npm run clean` | Cible unique et documentée pour repartir propre |
| Sortir les outils lourds du dossier projet | Un dossier `www/Inko` doit contenir Inko |
| Vérifier `.gitignore` ≠ « invisible » | `tools/` étant ignoré, ses 738 Mo n'étaient signalés par aucun outil git |

---

# PARTIE IV — ÉTAT PAGE PAR PAGE

| Page | État | API | DOM | `<main>` | Fonctionnalités actionnées |
|---|---|---|---|---|---|
| `accueil.html` | ✅ | 39 | 819 | ❌ | Hero, reprise, sections. 12 `<script>` sériels dont `three.min.js` |
| `catalogue.html` | ⚠️ | 17 | 928 | ❌ | Tri (5) **2 faux**, 32 genres ✅, 4 statuts **cumulatifs** ✅, reset ✅, pagination `offset=24` ✅, 18 sources ✅, vue grille/liste ✅, favori ✅ (a11y ❌) |
| `recherche.html` | ✅ | 6 | 1 140 | ❌ | 119 résultats / 4 sources, dédoublonnage cross-source ✅ ; sous-totaux faux (BUG-16) |
| `serie.html` | ✅ | 20 | 494 | ❌ | Onglets 5→18 ✅, recherche chapitres ✅, statut persisté ✅, marquer lu ✅, signet ✅ |
| `chapitre.html` | ✅ **Très bon** | 12 | 1 353 | ❌ | 326 pages → **5 requêtes** ✅, 3 modes ✅, zoom ✅, clavier RTL ✅, `J` notes ✅, **téléchargement 0→26 entrées** ✅, marquer+précédents **18/18** ✅, progression `totalPages:326` ✅ |
| `lecture.html` | ⚠️ | — | **19 222** | ❌ | Rend le texte, mais livre entier (PERF-04) |
| `bibliotheque.html` | ⚠️ | 15 | 4 810 | ❌ | 4 onglets ✅, filtres type (364/350/13) ✅, statuts (3/1/1/1) ✅ conformes aux badges |
| `collections.html` | ⚠️ | 11 | 309 | ❌ | Créer ✅, ajouter ✅, renommer+public ✅, supprimer ✅ — mais « public » est mort (BUG-09) |
| `collection-detail.html` | ✅ | — | — | ❌ | — |
| `profil.html` | 🔴 | **225** | 1 331 | ✅ | 5 panneaux ✅ (overview, historique, listes, avis, badges) ; N+1 (BUG-02), 3 images cassées (BUG-14) |
| `u.html` | 🔴 | 10 | 336 | ❌ | Affiche le **mauvais compte** (BUG-01) |
| `stats.html` | ✅ | 12 | 955 | ❌ | Objectifs, heatmap 12 j, 5/9 accomplissements ; message trompeur si base morte (BUG-04) |
| `notes.html` | ✅ | 12 | 323 | ❌ | État vide soigné ; absent du précache SW |
| `notifications.html` | ⚠️ | 11 | 633 | ❌ | 52 notifs ✅, « Toutes » ✅, « Réponses »/« Mentions » 0 (légitime), **« Chapitres » 0 (BUG-08)** ; vecteur XSS (SEC-01) |
| `downloads.html` | ✅ | 9 | 317 | ❌ | Quota réel (6 Mo / 2,82 Go), 4 caches SW actifs ✅ |
| `import.html` | ⚠️ | 10 | 327 | ❌ | `accept=".epub,.pdf,.cbz,.zip"` ; incohérence CBR/PDF (BUG-17) ; `input[type=file]` sans label |
| `localreader.html` | ✅ | — | 24 | ❌ | Erreur propre + lien retour |
| `sources.html` | ⚠️ | 5 | 506 | ❌ | 9 cartes, bouton « Tester » ✅ (6 s) ; **Gutenberg mal classé (BUG-05)** |
| `parametres.html` | ✅ | 10 | 477 | ❌ | Thème `dark→light→dark` **persisté en base** ✅, tous les segments ✅ |
| `anilist.html` | ⚠️ | — | **15** | ❌ | Cul-de-sac (BUG-15) |
| `confidentialite.html` | ⚠️ | — | — | ❌ | Non traduite en EN (I18N-02) |
| `offline.html` | ⚠️ | — | 16 | ❌ | Promesse non tenue, 0 lien (BUG-10) |

---

# PARTIE V — BACKLOG EXHAUSTIF

## Lot 1 — Critique, ~2 h

| # | Action | Réf |
|---|---|---|
| 1 | Échapper `"` et `'` dans `esc()`, helper unique `MH.esc` | SEC-01 |
| 2 | `"args": false` sur le sidecar Tauri + retirer `withGlobalTauri` | SEC-02, DESK-01 |
| 3 | Auth sur `/api/comments-recent` (ou aligner le texte de l'UI) | SEC-04 |
| 4 | `await ping()` dans `/api/health` + 503 | BUG-03 |
| 5 | `MH.isNovelSource` dans `sources.js` *(1 ligne)* | BUG-05 |
| 6 | Supprimer les `src=""` (`profil.js:291,601`) | BUG-14 |
| 7 | Renommer le cookie en `inko_token` | SEC-11 |

## Lot 2 — Élevé, ~1 journée

| # | Action | Réf |
|---|---|---|
| 8 | Migration v3 : dédoublonner + `UNIQUE` sur `users.username` + 409 | BUG-01 / DB-01 |
| 9 | `profil.js` : consommer `title`/`cover` de `/me/favorites` + cache TTL sur `getOne` | BUG-02, PERF-01, PERF-03 |
| 10 | SHA-256 + signature Authenticode de l'installeur ; args PowerShell non interpolés | SEC-03, DESK-02 |
| 11 | `users.token_version` → invalidation aux 3 endroits | SEC-05 |
| 12 | Vérification d'intégrité des extensions **fail-closed** | SEC-07 |
| 13 | Service `mysql:8` dans `ci.yml` | QUAL-01 |
| 14 | Filtre notifications : `chapter` ↔ `new_chapter` | BUG-08 |
| 15 | Distinction 401 / 5xx dans les messages front | BUG-04 |
| 16 | Rate-limit générique sur les 18 routes de relais | SEC-10 |
| 17 | `<main>` sur les 21 pages + cible réelle du skip-link | A11Y-01, A11Y-07 |
| 18 | **Récupérer 3,5 Go** : `rm -rf desktop/` (781 Mo) + `bundle/` (404 Mo) + `cargo clean` (1 638 Mo) + sortir `tools/` (738 Mo) — voir III.11 | DISK-01, DISK-02, DISK-03, DISK-04, HYG-01 |
| 18b | Remonter `check-sources.js` et `gen-ext-hashes.js` dans un dossier versionné | DISK-03 / HYG-04 |
| 18c | `hover.png` (doublon binaire) et dossiers vides `assets/font`, `assets/image` | HYG-02, HYG-03 |

## Lot 3 — Moyen, ~1 semaine

| # | Action | Réf |
|---|---|---|
| 19 | Corriger les contrastes — thème clair en priorité (58 échecs) | A11Y-02 |
| 20 | `aria-pressed` / `aria-selected` sur tous les contrôles à bascule | A11Y-03 |
| 21 | Corriger le débordement horizontal mobile (426 → 375) | A11Y-04 |
| 22 | Cibles tactiles à 44 px | A11Y-05 |
| 23 | Compléter le précache (15 fichiers) + liens dans `offline.html` | BUG-10, BUG-11 |
| 24 | Virtualiser le lecteur de **texte** | PERF-04 |
| 25 | Pagination/virtualisation de la bibliothèque | PERF-05 |
| 26 | Router toutes les images par `/api/img` | PERF-08 |
| 27 | Auto-héberger les polices, supprimer l'`@import` Google | PERF-07 |
| 28 | Sortir `anilistLinks` des réglages synchronisés | PERF-09 |
| 29 | `scripts/restore-backup.js` (ou aligner les formats) | BUG-12 |
| 30 | **Interface d'administration** + file de modération (ou retrait du code mort) | BUG-13 |
| 31 | Exposer les listes publiques, ou retirer le drapeau | BUG-09 |
| 32 | Traduire `confidentialite.html` | I18N-02 |
| 33 | Supprimer `fr.json` ou unifier les schémas | I18N-01 / BUG-19 |
| 34 | WeebCentral : implémenter `sort=rating`, inverser `sort=alpha` | BUG-06, BUG-07 |
| 35 | Signaler qu'un tri n'est pas supporté par la source active | BUG-06 |
| 36 | `cheerio` en dépendance normale ; vérifier `curl` au boot | EXT-01, EXT-02 |
| 37 | Navigation sur `anilist.html` | BUG-15 |
| 38 | `SECURITY.md` + templates GitHub | QUAL-06 |
| 39 | `meta description` + Open Graph + `index.html` | UX-01, UX-02 |
| 40 | `screenshots` dans le manifeste PWA | UX-05 |
| 41 | `CACHE_VERSION` dérivé de la version applicative | QUAL-08 |
| 42 | Génération automatique du précache + garde-fou CI | BUG-11 |
| 43 | Retirer le jeton du `localStorage` | SEC-06 |
| 44 | CORS non permissif en desktop | SEC-09 |
| 45 | Aligner CBR/PDF (code ↔ routes ↔ schéma) | BUG-17 |
| 46 | Cohérence des compteurs séries et des sous-totaux de recherche | BUG-16 |
| 47 | Lever l'exception `demo@inko.app` en mode local | BUG-18 |
| 48 | Purger `testpref` ; `title` du bouton favori | BUG-20, BUG-21, A11Y-08 |
| 49 | Cibles réelles Forum/Discord/Contact ; CGU distinctes | UX-03, UX-04 |
| 50 | Indicateur de focus sur `.sort-dropdown-mini` ; labels manquants | A11Y-09, A11Y-10 |
| 50b | **Garde `MH.isIncognito()` sur le marquage « lu »** + audit des autres écritures | BUG-22 |
| 50c | `aria-live` sur les zones qui se rafraîchissent (0 sur 22 pages) | A11Y-06 |
| 50d | Réduire le fan-out de l'accueil (39 appels API au chargement) | PERF-02 |
| 50e | Réessai + back-off sur les 7 sources qui n'en ont pas | EXT-04 |
| 50f | Fiabiliser SushiScan (v0.7.2, 523 l., 11 `catch` — la source la plus fragile) | EXT-03 |
| 50g | Arrêt de MariaDB sans PowerShell + remonter l'échec au lieu de `let _ =` | DESK-04 |
| 50h | Localiser l'installeur NSIS (EN en plus du FR) | DESK-05 |

## Lot 4 — Fond

| # | Action | Réf |
|---|---|---|
| 51 | Tests unitaires frontend (`esc`, `timeAgo`, `notifItemHTML`, parsing) | QUAL-02 |
| 52 | Tests e2e sur les parcours vérifiés ici | QUAL-03 |
| 53 | Contrôle a11y automatisé (axe / Lighthouse CI) | QUAL-05 |
| 54 | Vérification d'intégrité des extensions **au chargement** | SEC-08 |
| 55 | Chargement conditionnel de `three.js` / `pdf.js` | PERF-06 |
| 56 | Extraction des chaînes FR → socle i18n multilingue + contrôle CI | I18N-03 |
| 57 | Résolution de conflit horodatée (synchro multi-appareils) | — |
| 58 | Builds macOS et Linux | DESK-03 |
| 59 | Migration v3 : colonne morte `library.rating` ; `CHECK` sur les notes | DB-03, DB-04 |
| 60 | Chiffrer les sauvegardes ; invalider les jetons de reset concurrents | SEC-15, SEC-12, DB-06 |
| 61 | Recherche dans la bibliothèque hors-ligne ; export des notes en Markdown | — |
| 62 | Bumper `server/package.json` (bloqué à 1.0.0) | QUAL-07 |
| 62b | **Prévention disque** : `postbuild` qui purge `bundle/`, `cargo sweep` planifié, cible `npm run clean` | HYG-05, III.11 § Prévention |
| 63 | Validation par signature de fichier à l'upload | SEC-14 |
| 64 | Libérer les nœuds du mode page en mode défilement | PERF-10 |
| 65 | **Fusionner `favorites` et `library`** en une table unique (ou assumer la dénormalisation et documenter) | DB-02 |
| 66 | Découper la migration v1 monolithique ; faire échouer `run()` sur erreur inconnue au lieu d'un `console.warn` | DB-05 |
| 67 | Stocker le mot de passe de la base embarquée hors fichier clair ; alerter visiblement sur le repli « mot de passe vide » | SEC-13 |
| 68 | Réactiver `no-unused-vars` / `no-undef` avec un bloc `globals` déclaré (`MH`, `API`) | QUAL-04 |
| 69 | Restreindre la portée du `MutationObserver` i18n (conteneurs ciblés au lieu de `documentElement`) | I18N-04 |

---

# PARTIE VI — AMÉLIORATION DE CHAQUE FONCTIONNALITÉ

Cette partie ne traite **pas** les défauts (Parties III et V) mais l'évolution de
chaque fonctionnalité **telle qu'elle a été observée en fonctionnement**. Chaque
proposition est ancrée dans une mesure réelle de cet audit.

Codage : `AMEL-nn` · Effort **S** (< 2 h) · **M** (½ à 2 j) · **L** (> 2 j)

---

## VI.1 Découverte

### 1. Accueil
**Observé** : hero carrousel, « Reprendre où j'en étais », sections populaires /
récents, 39 appels API, 12 `<script>` sériels.

| # | Amélioration | Pourquoi | Effort |
|---|---|---|---|
| AMEL-01 | Rendre la reprise **prioritaire** : la placer au-dessus du hero quand une lecture est en cours | Sur 358 séries et 27 chapitres lus, l'utilisateur revient pour reprendre, pas pour découvrir | S |
| AMEL-02 | Section « Parce que tu as lu X » basée sur les tags des favoris | Les tags sont déjà récupérés pour la section Genres du profil ; la donnée existe | M |
| AMEL-03 | Rendre le hero interruptible (pause au survol, flèches clavier) | Un carrousel qui défile pendant qu'on lit le résumé est un anti-pattern connu | S |
| AMEL-04 | Charger `three.js` (607 Ko) uniquement si `prefers-reduced-motion` est absent **et** le hero 3D visible | 607 Ko pour un effet décoratif, sur le chemin critique de la page d'entrée | S |

### 2. Catalogue
**Observé** : 32 genres, 4 statuts (cumulatifs ✅), 5 tris, 18 sources,
pagination `offset`, 2 vues, 24 cartes/page.

| # | Amélioration | Pourquoi | Effort |
|---|---|---|---|
| AMEL-05 | **Exclusion** de genres (clic droit ou 2ᵉ clic = « sans ce genre ») | 32 genres inclusifs seulement ; l'exclusion est le besoin réel quand on filtre du contenu | M |
| AMEL-06 | Persister les filtres dans l'URL | Aujourd'hui un filtrage ne se partage ni ne se met en favori ; l'`offset` est déjà dans la requête API | S |
| AMEL-07 | Afficher les capacités de tri **réellement supportées** par la source active | Deux tris sur cinq ne font rien sur WeebCentral (BUG-06, BUG-07) ; `capabilities` existe déjà dans le manifeste d'extension | M |
| AMEL-08 | Indiquer sur la carte ce qui est déjà en bibliothèque | 358 séries suivies : l'utilisateur retombe forcément sur des titres qu'il possède | S |
| AMEL-09 | Défilement infini optionnel en complément de la pagination | 24 par page pour parcourir un catalogue de 79 038 titres (mesuré sur Gutenberg) | M |

### 3. Recherche multi-sources
**Observé** : « naruto » → 119 résultats, 4 sources, groupement cross-source
fonctionnel, 6 appels, historique de 12 recherches.

| # | Amélioration | Pourquoi | Effort |
|---|---|---|---|
| AMEL-10 | Résultats **en flux** au fur et à mesure que chaque source répond | `searchAll` fait un `Promise.all` : on attend la source la plus lente (timeout 15 s) pour tout afficher | M |
| AMEL-11 | Afficher les sources en échec dans les résultats | `searchAll` renvoie déjà `{error}` par groupe — l'UI l'ignore, la recherche paraît juste incomplète | S |
| AMEL-12 | Recherche **locale** dans la bibliothèque, instantanée et hors-ligne | Aujourd'hui tout passe par le réseau ; les 358 titres sont déjà en cache client | M |
| AMEL-13 | Filtres dans les résultats (langue, type, statut) | 119 résultats sur 4 sources sans moyen d'affiner | M |

### 4. Fiche série
**Observé** : 2 onglets (Aperçu / Chapitres 18), 3 boutons de lecture, statut
bibliothèque persisté, catégorie, liste, lien AniList, recherche de chapitres
fonctionnelle, points « lu », signets par chapitre, notation 5 étoiles,
commentaires, 20 appels API en 810 ms.

| # | Amélioration | Pourquoi | Effort |
|---|---|---|---|
| AMEL-98 | **Filtre « masquer les chapitres lus » et tri asc/desc persistés** | One Piece est en bibliothèque avec 1 183 chapitres : la liste brute est inexploitable | S |
| AMEL-99 | Téléchargement d'une plage de chapitres depuis la fiche | Le bouton n'existe que dans le lecteur, chapitre par chapitre (voir AMEL-77) | M |
| AMEL-100 | Bloc « où reprendre » explicite plutôt que trois boutons concurrents | « Lire depuis le début » / « Reprendre Ch.1 » / « 1er non-lu » se ressemblent sans hiérarchie visuelle | S |
| AMEL-101 | Séries liées : même auteur, mêmes tags, autres sources du même titre | La recherche sait déjà grouper un titre entre 4 sources ; l'info est perdue sur la fiche | M |
| AMEL-102 | Afficher la disponibilité sur les **autres** sources installées | Quand une source casse, l'utilisateur ne sait pas que le titre existe ailleurs | M |

## VI.2 Lecture

### 5. Lecteur d'images
**Observé** : 18 contrôles, 3 modes, zoom 10 %, clavier RTL, `J`/`B`/`A`,
virtualisation confirmée (326 pages → 5 requêtes).

| # | Amélioration | Pourquoi | Effort |
|---|---|---|---|
| AMEL-14 | **Préchargement adaptatif** selon la vitesse mesurée | Fenêtre fixe aujourd'hui ; `navigator.connection` + la durée réelle des images permettent d'ajuster | M |
| AMEL-15 | Passage automatique au chapitre suivant en fin de chapitre | Actuellement il faut revenir au sélecteur ; c'est le geste le plus fréquent d'une session | S |
| AMEL-16 | Mémoriser le mode d'affichage **par série** | Un webtoon veut le défilement, un manga la double page — le réglage est global | S |
| AMEL-17 | Recadrage automatique des marges blanches (option) | Les scans ont des bordures qui réduisent la surface utile sur mobile | L |
| AMEL-18 | Zoom au double-clic / pincement avec point d'ancrage | Le zoom est global (±10 %) et ne cible pas la zone regardée | M |
| AMEL-19 | Barre de progression cliquable pour sauter à une page | 326 pages, navigation uniquement séquentielle ou par saisie | S |

### 6. Lecteur de texte (romans & livres)
**Observé** : rend le contenu, mais **19 222 nœuds** pour Moby Dick, un seul
« chapitre » (`2701:full`), contrôle `Aa`.

| # | Amélioration | Pourquoi | Effort |
|---|---|---|---|
| AMEL-20 | **Découpage en chapitres** à partir des titres du texte | Gutenberg renvoie le livre entier ; le sommaire est pourtant présent dans le contenu | M |
| AMEL-21 | Pagination façon liseuse (colonnes, position mémorisée) | Un défilement de 19 000 nœuds n'est pas une expérience de lecture longue | L |
| AMEL-22 | Réglages typographiques : police, interlignage, largeur de colonne, thème sépia | Seule la taille (`Aa`) est réglable ; c'est le minimum pour de la lecture longue | M |
| AMEL-23 | Estimation du temps de lecture restant | Le lecteur d'images l'affiche (« ~43 min »), pas le lecteur de texte | S |
| AMEL-24 | Synthèse vocale (Web Speech API) | Fonctionnalité naturelle sur du texte, coût quasi nul, gros gain d'accessibilité | M |

### 7. Lecteur local (CBZ / EPUB / PDF)
**Observé** : import jusqu'à 300 Mo, quota 2 Go, décompression à la demande avec
`revokeObjectURL` (correctif 2.3.4).

| # | Amélioration | Pourquoi | Effort |
|---|---|---|---|
| AMEL-25 | Extraire couverture et métadonnées de l'EPUB/CBZ à l'import | La bibliothèque locale n'affiche qu'un titre dérivé du nom de fichier | M |
| AMEL-26 | Support CBR via un décodeur WASM, ou conversion assistée | Refusé partout (BUG-17) alors que le format est courant | L |
| AMEL-27 | Signets et notes dans les fichiers importés | Les imports locaux n'ont ni signet ni journal, contrairement aux sources | M |

### 8. Import de fichiers
**Observé** : glisser-déposer, `accept=".epub,.pdf,.cbz,.zip"`, 300 Mo par
fichier, quota cumulé 2 Go, rollback si l'INSERT échoue, propriété vérifiée.

| # | Amélioration | Pourquoi | Effort |
|---|---|---|---|
| AMEL-103 | **Import de dossier / multi-fichiers avec file d'attente et progression** | `multiple` est activé mais l'UI ne montre pas d'avancement par fichier | M |
| AMEL-104 | Détection automatique de série : regrouper `Tome 01..18` en une œuvre | Chaque fichier devient une entrée isolée dans la bibliothèque locale | M |
| AMEL-105 | Jauge de quota visible avant l'import (2 Go, actuellement découvert au refus) | Le refus arrive après le téléversement complet d'un fichier de 300 Mo | S |

### 9. Progression & reprise
**Observé** : `{chapterId, chapter, page, totalPages: 326, source, updatedAt}`,
% exact, `keepalive` à la fermeture.

| # | Amélioration | Pourquoi | Effort |
|---|---|---|---|
| AMEL-28 | **Historique de progression** plutôt qu'une seule ligne par série | Une reprise erronée écrase définitivement la position | M |
| AMEL-29 | Résolution de conflit horodatée multi-appareils | `ON DUPLICATE KEY UPDATE` partout : le dernier écrivain gagne, sans comparaison de dates | M |
| AMEL-30 | Reprise proposée sur **plusieurs** séries récentes | Le bouton d'en-tête ne reprend que la dernière | S |

## VI.3 Organisation

### 10. Bibliothèque
**Observé** : 358 séries, 4 onglets, filtres type/statut conformes, export CSV,
sélection multiple, 4 810 nœuds.

| # | Amélioration | Pourquoi | Effort |
|---|---|---|---|
| AMEL-31 | **Catégories personnalisées** (la colonne `favorites.category` existe déjà et n'est pas exploitée dans l'UI) | Le schéma est prêt ; 358 séries sans regroupement utilisateur | M |
| AMEL-32 | Vue « à rattraper » : séries avec chapitres non lus, triées par volume de retard | 55 578 chapitres non lus affichés comme un seul nombre | M |
| AMEL-33 | Actions groupées sur la sélection (statut, catégorie, suppression) | « Sélectionner » existe mais n'ouvre que peu d'actions | M |
| AMEL-34 | Import CSV symétrique de l'export | L'export existe, l'import correspondant non | M |
| AMEL-35 | Tri par « dernière activité de la source » | On ne peut pas voir facilement quelles séries bougent encore | S |

### 11. Collections / listes
**Observé** : CRUD complet vérifié, 1 liste de 5 titres, drapeau `is_public`
sans consommateur.

| # | Amélioration | Pourquoi | Effort |
|---|---|---|---|
| AMEL-36 | **Rendre les listes publiques réellement publiques** : route + page partageable | Le drapeau existe et ne fait rien (BUG-09) ; c'est la promesse implicite du bouton | M |
| AMEL-37 | Réordonnancement par glisser-déposer | `list_items.position` existe en base, aucune UI ne le modifie | M |
| AMEL-38 | Listes intelligentes (règles : genre + statut + note) | Les filtres de la bibliothèque font déjà ce calcul, il suffirait de le figer | L |
| AMEL-39 | Ajouter à une liste depuis la carte du catalogue | Aujourd'hui uniquement depuis la fiche série | S |

### 12. Chapitres lus & signets
**Observé** : bascule par point, « marquer + précédents » (18/18 ✅), signets
persistés dans le blob de réglages.

| # | Amélioration | Pourquoi | Effort |
|---|---|---|---|
| AMEL-40 | « Marquer tout comme lu jusqu'ici » **avec annulation** | L'action touche 18 chapitres d'un coup, sans retour arrière | S |
| AMEL-41 | Sortir les signets du blob `user_settings` vers une vraie table | Ils grossissent un objet JSON rechargé à chaque page (PERF-09) | M |
| AMEL-42 | Filtre « masquer les chapitres lus » sur la fiche série | Sur une série de 1 183 chapitres (One Piece est en bibliothèque), la liste est inexploitable | S |

## VI.4 Social & suivi

### 13. Notes de lecture (journal)
**Observé** : table dédiée `reading_notes` (contexte série/chapitre/page +
humeur), raccourci `J`, pagination, recherche.

| # | Amélioration | Pourquoi | Effort |
|---|---|---|---|
| AMEL-43 | **Export Markdown / Obsidian** | `/me/export` couvre tout sauf un format exploitable pour les notes ; c'est leur usage naturel | S |
| AMEL-44 | Citation de passage : sélectionner du texte dans le lecteur de romans → note pré-remplie | Le champ `page` existe déjà pour l'ancrage | M |
| AMEL-45 | Vue chronologique par série (relecture du journal comme un récit) | Les notes sont aujourd'hui une liste plate | M |
| AMEL-46 | Statistiques d'humeur dans le temps | Le champ `mood` est collecté et jamais restitué | S |

### 14. Notations & avis
**Observé** : 5 étoiles + `review`, 0 avis sur le compte, agrégation `/ratings/:id`.

| # | Amélioration | Pourquoi | Effort |
|---|---|---|---|
| AMEL-47 | Demi-étoiles ou échelle /10 | `TINYINT` 1-5 est grossier pour classer 358 séries | S |
| AMEL-48 | Rappel de notation en fin de série terminée | 0 avis pour 27 chapitres lus : la notation n'est jamais sollicitée | S |
| AMEL-49 | Comparaison de sa note avec AniList | Les liens AniList sont déjà résolus (~160 en cache) | M |

### 15. Commentaires & modération
**Observé** : threads (`parent_id`), signalements, suppression, flux public non
authentifié (SEC-04).

| # | Amélioration | Pourquoi | Effort |
|---|---|---|---|
| AMEL-50 | **Choix explicite de visibilité** à la publication (privé / instance / public) | L'UI promet « privé », l'API expose publiquement : le modèle de visibilité n'est pas décidé | M |
| AMEL-51 | Avertissement de spoiler avec masquage au clic | Fonctionnalité attendue sur un lecteur de manga, absente | S |
| AMEL-52 | Ancrage par chapitre | `comments.chapter_id` existe en base, l'UI ne l'utilise pas | M |

### 16. Notifications
**Observé** : 52 notifications réelles, in-app + Web Push, scan toutes les 4 h,
plafond de 5 par cycle, anti-doublon.

| # | Amélioration | Pourquoi | Effort |
|---|---|---|---|
| AMEL-53 | **Regroupement** : « 3 nouveaux chapitres sur Blue Lock » | 52 notifications individuelles noient l'information | M |
| AMEL-54 | Réglage de fréquence et sélection des séries à surveiller | Le scan est global toutes les 4 h, non paramétrable | M |
| AMEL-55 | Bouton « Lire maintenant » dans la notification | Le lien mène à la page, une action directe économise un geste | S |
| AMEL-56 | Purge automatique des notifications lues de plus de 30 j | Aucune rétention définie ; la table croît indéfiniment | S |

### 17. Statistiques, objectifs & badges
**Observé** : heatmap 12 jours, séries courante/record, 5/9 accomplissements,
objectifs hebdo et annuel, `STATS_TZ`.

| # | Amélioration | Pourquoi | Effort |
|---|---|---|---|
| AMEL-57 | Répartition par genre, source, format dans le temps | Les données existent (events, favorites, tags) ; les stats restent des compteurs | M |
| AMEL-58 | Rétrospective annuelle partageable | Le matériau est déjà là (heatmap, top séries, badges) | M |
| AMEL-59 | Badges avec progression visible et prochain palier | 5/9 affichés, sans indication de ce qui reste à faire pour les 4 autres | S |
| AMEL-60 | Objectif adaptatif suggéré d'après le rythme réel | « 10/15 » fixé à la main ; le rythme est mesuré (21 ce mois-ci) | S |

### 18. Profil (privé & public)
**Observé** : 5 panneaux, niveau, badges, `privateProfile`, partage.

| # | Amélioration | Pourquoi | Effort |
|---|---|---|---|
| AMEL-61 | **Granularité de confidentialité** (stats / bibliothèque / notes séparément) | Aujourd'hui tout ou rien | M |
| AMEL-62 | Aperçu « voici ce que voient les autres » | Impossible aujourd'hui de vérifier son propre profil public — d'autant que BUG-01 le rend faux | S |
| AMEL-63 | Vitrine de séries épinglées | `userdata.pins` existe dans les réglages et reste vide | S |

### 19. Historique de lecture
**Observé** : panneau dédié du profil, filtres 7 j / 30 j / cette année, type de
contenu, genres, moment de lecture, groupement par période, tri asc/desc,
pagination.

| # | Amélioration | Pourquoi | Effort |
|---|---|---|---|
| AMEL-112 | **Suppression sélective d'entrées** (pas seulement « tout effacer ») | `/me/clear-history` est tout-ou-rien ; on peut vouloir retirer une seule série | S |
| AMEL-113 | Export de l'historique (CSV / JSON) | L'export global existe, mais l'historique n'est pas exploitable à part | S |
| AMEL-114 | Reprise directe depuis une ligne d'historique | Chaque entrée mène à la fiche, pas à la position exacte | S |

### 20. Mode incognito
**Observé** : `sessionStorage.inko_incognito`, classe `incognito-on`, toast
« lecture non enregistrée ». **Respecté par la progression, ignoré par le
marquage « lu »** (BUG-22).

| # | Amélioration | Pourquoi | Effort |
|---|---|---|---|
| AMEL-106 | **Indicateur permanent** pendant que le mode est actif | Seul un toast fugace signale l'état ; on peut lire une heure sans savoir | S |
| AMEL-107 | Étendre la couverture : favoris, notes, événements, recherches récentes | Seule la progression est actuellement protégée | M |
| AMEL-108 | Choix de portée : « cette série » plutôt que global | Le besoin réel est de masquer une lecture précise, pas toute une session | M |

### 21. Première ouverture : visite guidée & consentement
**Observé** : `onboarding.js` — 7 étapes, drapeau `inko_tour_done`, rejouable
depuis les paramètres ; `eula.js` — modal `mh_eula_v2`, boutons Refuser /
Continuer, case à cocher.

| # | Amélioration | Pourquoi | Effort |
|---|---|---|---|
| AMEL-109 | **Rendre la visite interruptible et reprenable** | 7 étapes bloquantes au premier lancement, sans reprise si on quitte | S |
| AMEL-110 | Que fait « Refuser » de l'EULA ? Définir et implémenter le parcours | Le bouton existe ; le comportement en cas de refus n'est pas explicité | S |
| AMEL-111 | Visite contextuelle à la 1ʳᵉ visite de chaque page plutôt qu'un bloc initial | Une visite de 7 écrans avant d'avoir vu l'app se retient mal | M |

## VI.5 Infrastructure

### 22. Déploiement & mode hub
**Observé** : Docker Compose (app + MySQL, healthcheck, secret obligatoire),
Cloudflare Tunnel documenté, `TRUST_PROXY`, `CORS_ORIGINS`, sauvegardes
planifiées, image multi-stage `node:22-alpine`.

| # | Amélioration | Pourquoi | Effort |
|---|---|---|---|
| AMEL-115 | **Assistant de première configuration** (secret, CORS, SMTP, sauvegardes) | La mise en ligne suppose de lire l'en-tête du `docker-compose.yml` et le README | M |
| AMEL-116 | Page « santé de l'instance » : base, extensions, disque, dernière sauvegarde | Aujourd'hui `/api/health` ne dit rien (BUG-03) et rien n'est exposé à l'admin | M |
| AMEL-117 | Image Docker multi-architecture (arm64) | Le README vise explicitement Raspberry Pi et NAS | M |
| AMEL-118 | Compose optionnel avec Caddy + HTTPS automatique | Le tunnel est documenté mais le reverse-proxy classique reste à la charge de l'utilisateur | M |

### 23. API REST
**Observé** : 96 routes, réponses JSON homogènes, `errorHandler` sans fuite,
rate-limiting différencié, `authRequired` / `authOptional` / `adminRequired`.

| # | Amélioration | Pourquoi | Effort |
|---|---|---|---|
| AMEL-119 | **Documenter l'API** (OpenAPI généré depuis le routeur) | 96 routes, aucune référence — le README décrit une poignée d'endpoints | M |
| AMEL-120 | Versionner (`/api/v1`) avant toute ouverture à des clients tiers | Le modèle Mihon invite des clients externes ; aucune stratégie de compatibilité | S |
| AMEL-121 | Pagination homogène (`limit`/`offset` + `total`) sur toutes les collections | Certaines routes paginent, d'autres renvoient tout (`/me/favorites` : 358 entrées) | M |

### 24. Sources & extensions
**Observé** : 9 extensions, contrat validé, bouton « Tester » (6 s), MAJ par
SHA-256, activation/désactivation, santé hebdomadaire en CI.

| # | Amélioration | Pourquoi | Effort |
|---|---|---|---|
| AMEL-64 | **Cache serveur par source** avec TTL configurable | `getOne` n'a aucun cache : 201 scrapes pour un affichage de profil (BUG-02) | M |
| AMEL-65 | Indicateur de santé permanent sur la page Sources | `source-health.js` collecte déjà les succès/échecs, seul l'admin y accède | S |
| AMEL-66 | Ordre de préférence des sources par l'utilisateur | `defaultSource()` code en dur `weebcentral` puis `sushiscan` | M |
| AMEL-67 | Bac à sable pour les extensions (`node:vm`, permissions réseau) | Une extension = du JS avec les pleins pouvoirs Node (SEC-08) | L |
| AMEL-68 | Journal des requêtes par source (diagnostic utilisateur) | Quand une source casse, l'utilisateur n'a aucun moyen de comprendre | M |

### 25. Comptes & authentification
**Observé** : mode local sans compte, Google Sign-In, AniList, reset SMTP,
bcrypt, JWT 30 j.

| # | Amélioration | Pourquoi | Effort |
|---|---|---|---|
| AMEL-69 | Liste des sessions actives + révocation | Aucune visibilité ni contrôle (SEC-05) | M |
| AMEL-70 | Politique de mot de passe et indicateur de robustesse | Minimum 6 caractères, aucun retour visuel | S |
| AMEL-71 | 2FA TOTP optionnelle | Pertinent dès que l'instance est exposée en ligne | L |
| AMEL-72 | Synchronisation bidirectionnelle AniList (statuts, notes, progression) | Le lien existe mais reste largement à sens unique | L |

### 26. Sauvegarde & portabilité
**Observé** : export RGPD complet, import fusionnel batché, dump nocturne (14
rotations) irrécupérable.

| # | Amélioration | Pourquoi | Effort |
|---|---|---|---|
| AMEL-73 | **Restauration depuis l'interface** (fichier → aperçu → confirmation) | Le dump existe mais aucun chemin ne le relit (BUG-12) | M |
| AMEL-74 | Chiffrement optionnel des sauvegardes par phrase secrète | 26 comptes en clair sur disque (SEC-15) | M |
| AMEL-75 | Sauvegarde vers un dossier externe (OneDrive, disque réseau) | `BACKUP_DIR` existe déjà : il ne manque qu'un réglage dans l'UI | S |
| AMEL-76 | Import depuis Mihon / Tachiyomi / MangaDex | Enlève la barrière d'entrée pour un utilisateur qui migre | L |

### 27. PWA & hors-ligne
**Observé** : 4 caches, `inko-offline` persistant, téléchargement pause/reprise
(0→26 entrées), navigation preload, page de repli.

| # | Amélioration | Pourquoi | Effort |
|---|---|---|---|
| AMEL-77 | **Téléchargement par lot** (toute une série, N prochains chapitres) | Aujourd'hui chapitre par chapitre — inutilisable pour préparer un trajet | M |
| AMEL-78 | Gestion du stockage : quoi supprimer, quota par série | `navigator.storage` est déjà lu (6 Mo / 2,82 Go), sans levier de gestion | M |
| AMEL-79 | File de synchronisation visible avec état des écritures en attente | La file offline existe (`queueOffline`) mais reste invisible | S |
| AMEL-80 | Précache généré automatiquement à partir des pages | Liste maintenue à la main, 15 fichiers manquants (BUG-11) | S |

### 28. Interface & accessibilité
**Observé** : 4 thèmes, accent personnalisable, skip-link, RTL/LTR/webtoon,
nav mobile.

| # | Amélioration | Pourquoi | Effort |
|---|---|---|---|
| AMEL-81 | **Palette de commandes (`Ctrl+K`)** | 96 routes, 22 pages, beaucoup de gestes profonds dans l'arborescence | M |
| AMEL-82 | Raccourcis clavier personnalisables + aide `?` | Plusieurs raccourcis existent (`J`, `B`, `A`) sans être découvrables | M |
| AMEL-83 | Thème à contraste renforcé | 58 échecs WCAG en thème clair (A11Y-02) | S |
| AMEL-84 | Mode « une main » sur mobile (contrôles en bas) | 781 cibles sous 44 px, contrôles en haut d'écran | M |

### 29. Internationalisation
**Observé** : FR source + EN par correspondance (666 chaînes, 55 motifs),
couverture 86 %.

| # | Amélioration | Pourquoi | Effort |
|---|---|---|---|
| AMEL-85 | Extraction des chaînes → catalogue de clés + contrôle CI des manquantes | Clé = texte français exact : toute reformulation casse la traduction en silence | L |
| AMEL-86 | Bascule de langue **sans rechargement** (I18N-05) | Le retour au FR force un `location.reload()` | M |
| AMEL-87 | Langues supplémentaires (ES, DE) une fois l'extraction faite | Impossible aujourd'hui sans repasser sur tout le HTML | M |

### 30. Administration & modération
**Observé** : 6 routes serveur + 6 méthodes client, **aucune interface**.

| # | Amélioration | Pourquoi | Effort |
|---|---|---|---|
| AMEL-88 | **Page d'administration** (stats, comptes, rôles, bannissements) | Tout le backend est écrit et inatteignable (BUG-13) | M |
| AMEL-89 | File de modération des signalements | On peut signaler, jamais traiter | M |
| AMEL-90 | Journal d'audit des actions d'admin | Bannir/promouvoir sans trace | M |

### 31. Desktop
**Observé** : Tauri 2, sidecar Node, MariaDB embarquée, MAJ intégrée, NSIS.

| # | Amélioration | Pourquoi | Effort |
|---|---|---|---|
| AMEL-91 | Passer à l'updater Tauri **signé** | La MAJ maison n'effectue aucune vérification (SEC-03) | M |
| AMEL-92 | Builds macOS et Linux | Le code est verrouillé sur Windows (DESK-03) | L |
| AMEL-93 | Démarrage au login + réduction en zone de notification | Le mode « hub » suppose une app toujours active | S |
| AMEL-94 | Écran de démarrage avec diagnostic (base, sidecar, extensions) | Un échec produit aujourd'hui un écran noir | M |

### 32. Musique
**Observé** : 8 stations YouTube en dur, lecteur persistant, fichiers locaux,
onglet Radio Browser.

| # | Amélioration | Pourquoi | Effort |
|---|---|---|---|
| AMEL-95 | Vérifier la disponibilité des flux et basculer automatiquement | 8 identifiants YouTube codés en dur : un live arrêté casse la station en silence | S |
| AMEL-96 | Ambiances liées à la série lue (via les tags) | Les tags sont déjà disponibles côté client | M |
| AMEL-97 | Baisse automatique du volume à l'ouverture d'une vidéo | Deux sources audio simultanées possibles | S |

## VI.6 Vue d'ensemble

Les cinq améliorations au **meilleur rapport impact/effort**, toutes ancrées dans
une mesure de cet audit :

| Rang | Amélioration | Justification mesurée | Effort |
|---|---|---|---|
| 1 | **AMEL-64** — cache serveur par source | Supprime 201 requêtes externes par affichage de profil et protège du bannissement IP | M |
| 2 | **AMEL-31** — catégories de bibliothèque | La colonne `favorites.category` existe déjà ; 358 séries sans regroupement | M |
| 3 | **AMEL-77** — téléchargement par lot | Le hors-ligne est complet techniquement mais inutilisable chapitre par chapitre | M |
| 4 | **AMEL-15** — chapitre suivant automatique | Le geste le plus fréquent d'une session de lecture, 2 h de travail | S |
| 5 | **AMEL-43** — export Markdown des notes | Le journal est une vraie différenciation, aujourd'hui enfermée | S |

---

# PARTIE VII — CE QUI FONCTIONNE (à ne pas casser)

Vérifié **par l'action**, pas par la lecture :

**Lecture** — Lecteur d'images : 18 contrôles, 3 modes, zoom, clavier conforme au
RTL configuré, mode immersif, plein écran, défilement auto, partage.
**Virtualisation 2.3.4 confirmée : 326 pages → 5 requêtes.** Téléchargement
hors-ligne 0→26 entrées avec pause/reprise. Marquer chapitre + précédents 18/18.
Progression persistée avec `totalPages`.

**Découverte** — Recherche multi-sources : 119 résultats sur 4 sources avec
groupement cross-source. Catalogue : filtres genre/statut **cumulatifs**,
pagination, changement de source, 2 vues.

**Bibliothèque** — 358 séries, 4 onglets, filtres type et statut conformes aux
badges, export CSV, sélection multiple.

**Organisation** — Collections : CRUD complet vérifié. Fiche série : onglets,
statut persisté, marquage, signets, recherche de chapitres.

**Compte** — Mode local sans compte, thème persisté en base, 5 panneaux de
profil, notifications réelles générées par `backgroundScan`, commentaires
poster/supprimer.

**Infrastructure** — 9/9 extensions chargées, secret faible détecté au boot,
rate-limits actifs, `BLOCKED_DIRS`, 4 caches SW, purge RGPD quotidienne,
anti-SSRF du proxy d'images, aucune injection SQL ni de commande.

---

# PARTIE VIII — ENVIRONNEMENT

- Serveur Inko : **en cours**, port 8088.
- `mysqld.exe` : **en cours**, lancé manuellement (le service `InkoMySQL` demande
  une élévation ; MySQL s'était arrêté en cours d'audit).
- Données de test nettoyées et retour à l'état initial vérifié. Reliquat sans
  effet : quelques entrées du cache `inko-offline` créées par le test de
  téléchargement — le bouton « Vider le cache » des paramètres les purge.

*Audit du 28 juillet 2026 — `main` @ `89e2b4a`, base réelle 26 comptes.
**100 constats · 84 actions correctives · 121 améliorations sur 32 fonctionnalités ·
3,56 Go récupérables.** Couverture croisée vérifiée mécaniquement.
Chaque mesure relevée, chaque contrôle actionné.*
