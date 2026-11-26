## 4. Données et fiabilité

> Au-delà de l'incident du §3.1 : ce que la base **vivante** montre (lecture seule) et ce que le schéma et le code permettent.

### État réel de la base (relevé du {{date}})

| Mesure | Valeur |
|---|---|
| Comptes | **{{mesure:donnees.comptes.users}}** (dont **25 comptes de test** : `TestUser`, `Otaku2…9`, `preview`, `spotitest`, `oauth`… ; le seul vrai compte est l'id 26) |
| Favoris | {{mesure:donnees.comptes.favoris}} — répartis : WeebCentral 391 · SushiScan 84 · MangaDex 31 · Chireads 9 · NovelFull 3 · Gutenberg 2 · NovelBin 1 |
| Événements | {{mesure:donnees.comptes.evenements}} (`read` 3 733 · `favorite` 2 053 · `unfavorite` 1 049 · `status_change` 46) |
| Sessions | {{mesure:donnees.comptes.sessions}} pour 26 comptes |
| Chapitres lus | {{mesure:donnees.comptes.chapitres_lus}} (la lecture suivie est jeune ou peu utilisée) |
| Hôtes de couvertures | `temp.compsci88.com` 374 · `sushiscan.fr` 83 · `uploads.mangadex.org` 31 · `chireads.com` 9 … |
| Sauvegardes | 13 fichiers ; la plus récente de moins de 24 h |
| Favoris sans couverture | 18 |

### DAT-07 🔵 La rétention des événements existe, sans agrégation · effort M

> **Correction** : la première version de cet audit affirmait qu'il n'y avait aucune rétention. C'est faux — `server/app.js` (ménage quotidien) supprime les événements de **plus de 400 jours**.

Ce qui reste : `events` porte ≈ 7 000 lignes, dont plus de la moitié viennent de l'incident ; les statistiques, le journal d'activité et l'export la lisent entière, et ce qui dépasse 400 jours disparaît **sans être résumé**. **Correctif** : agrégation mensuelle (`events_mensuels(user_id, mois, type, n)`) avant purge ; index `(user_id, type, created_at)`.

### DAT-08 🟡 L'import n'est pas atomique : un paquet en erreur est ignoré en silence · effort M

`importData` (`user.controller.js:1356-1380`) traite par paquets de 500 et, sur erreur, **`console.warn` puis continue**. Résultat : un import « réussi » peut avoir perdu des paquets entiers, avec un compte `counts` qui ne dit pas ce qui manque.

**Correctif** : une **transaction** par import ; en cas d'échec, tout est annulé et le message dit *quelle ligne* et *pourquoi* ; à défaut, renvoyer `{importes, ignores: [{index, raison}]}` et l'afficher.

### DAT-09 🟡 {{id:SQL-SANS-TRANSACTION}} fichiers font de nombreuses écritures sans transaction · effort M

`user.controller.js` (47 écritures SQL), `auth.controller.js` (16), `migrate.js` (8) n'utilisent **aucune** transaction. Cas où cela compte : suppression de compte (cascade — la FK `ON DELETE CASCADE` protège), **fusion de doublons** (`migration-sources.js` : `UPDATE` de 4 tables), **déplacement de source**, **import**, **renommage de catégorie**. Un plantage au milieu laisse un état mixte (série présente dans l'ancienne et la nouvelle source).

**Correctif** : un utilitaire `await enTransaction(async (cx) => {…})` ; l'appliquer aux 6 opérations multi-tables ci-dessus.

### DAT-10 🟡 Sessions : 92 lignes pour un compte actif · effort S

La purge existe (`DB-01`, `sessions.js`) et `/auth/local` réutilise le jeton vivant. **Mais** 92 sessions subsistent. À vérifier : la purge borne-t-elle **par compte** (garder les N dernières) et pas seulement par ancienneté ? Un test d'intégration doit prouver qu'**un compte ne dépasse jamais 10 sessions**.

### DAT-11 🟡 Migrations : numérotation irrégulière et opérations destructrices · effort S

Les versions apparaissent dans l'ordre de **fichier** 24 → 27 → 26 → 25 (le code les applique triées, ce qui est correct, mais le fichier trompe celui qui ajoute la suivante). Deux migrations font `DROP COLUMN` (`migrate.js:145`) et `DROP TABLE` (`migrate.js:782`) : **irréversibles**.

**Correctif** : (1) ranger les migrations dans l'ordre numérique ; (2) **sauvegarde automatique** avant toute migration destructrice (le dossier existe) ; (3) `down()` ou, à défaut, une note « non réversible » ; (4) `essai-migrations.js` en CI sur une base **remplie** (pas seulement vierge).

### DAT-12 🟡 `server/db/migrate.js` fait 1 049 lignes et mêle schéma et rattrapages de données · effort L

Chaque migration est une fonction dans un seul fichier. **Correctif** : `server/db/migrations/0001-….js` (une par fichier), un registre généré, et des tests unitaires par migration sur un jeu de données de la version précédente.

### DAT-13 🔵 `SELECT *` (24 occurrences) sur des tables à colonnes JSON/TEXT · effort M

Surtout `users`, `lists`, `reading_notes`. Lister les colonnes — gain mesurable sur `/me/export` (982 Ko) et `/me/favorites` (192 Ko).

### DAT-14 🔵 Pas de sauvegarde « avant l'irréversible » en dehors de la nuit · effort S

Voir DAT-06 : fermeture de l'app, migration, import, suppression en masse, restauration (sauvegarde de l'état *avant* de restaurer — **aujourd'hui, restaurer écrase sans filet**).

---

## 5. Backend et API

> Mesuré sur la base réelle puis sur une base d'essai : **{{mesure:api-contrat.contrat_get.total}} routes GET sans paramètre appelées** (hors flux SSE et ancien scan synchrone, volontairement exclus), **0 réponse 5xx**, toutes les routes locales sous 130 ms. La surface est de **{{mesure:routes.routes_total}} routes**, dont 103 sur session et 9 sur admin, 38 avec limiteur.

### API-01 🟠 L'import renvoie une erreur 500 sur une charge malformée · effort S

**Preuve (`flux-ecriture`)** : `POST /me/import {"favorites":"pas un tableau","progress":42}` → **500**, journal : `TypeError: (d.favorites || []).filter is not a function` (`user.controller.js:1381`). Un fichier d'import corrompu ou mal formé plante au lieu de répondre 400 — et c'est précisément la route qu'on utilise **en cas de sinistre**.

**Correctif** : valider la forme (`Array.isArray`, bornes, types) et répondre `400 { error, champ }` ; tests de propriété sur des charges aléatoires.

### API-02 🟠 Le résultat de l'import ne dit pas ce qui a été perdu

Voir DAT-08.

### API-03 🟠 Les sources lentes bloquent la réponse sans plafond clair · effort M

`/mangas/popular` : **17 s** ; `/mangas/latest` : **7,5 s** ; `/mangas/search` : 9 s (sondes `api-contrat`, via WeebCentral). La page d'accueil et le catalogue en dépendent. L'interface attend, puis affiche l'erreur.

**Correctif** : (1) **stale-while-revalidate** — servir immédiatement la dernière liste connue (cache disque 15 min) et rafraîchir en arrière-plan ; (2) **plafond dur** de 6 s par source avec `504 {source, delaiMs}` ; (3) **disjoncteur par source** (comme pour les images) : après 3 échecs, 60 s sans appel ; (4) requêtes `popular` et `latest` **en parallèle** à l'accueil, pas en série.

### API-04 🟡 Ancien balayage synchrone `GET /me/updates` · effort S

Voir UPD-08. À remplacer par `GET /me/updates/:mangaId` (une série) et retirer la route sans paramètre.

### API-05 🟡 Pas de pagination sur `/me/favorites` (192 Ko) ni `/me/export` (982 Ko) · effort M

Le code sait paginer (`limit`/`offset`, `user.controller.js:75-90`) mais l'interface appelle sans. À 5 000 favoris, la bibliothèque télécharge 2 Mo à chaque page. **Correctif** : liste allégée (`id, titre, couverture, statut, source`) + curseur ; ETag + 304.

### API-06 🟡 Requêtes dans des boucles (27 emplacements) · effort M

`notes.controller.js:174`, `profile.controller.js:109`, `user.controller.js:756,1301,1305,1372`, `migrate.js` ×4 et d'autres : `await db.query` dans un `for`. Sur 500 favoris, 500 allers-retours. **Correctif** : `INSERT … VALUES ?`, `UPDATE … WHERE id IN (?)`, `CASE` (déjà fait pour `reorderList`).

### API-07 🟡 Corps JSON plafonné à 12 Mo pour *toutes* les routes · effort S

`express.json({ limit: '12mb' })` (`app.js:28`). **Mesuré** : un corps de 13 Mo est bien refusé (413) mais un corps de **2 Mo sur `/auth/login`** est lu et analysé avant le rejet (400). **Correctif** : 100 ko par défaut, 12 Mo **uniquement** sur `/me/import` et `/me/backups/*`.

### API-08 🟡 Journalisation non structurée · effort M

`console.log/warn/error` partout (9 + 9 + 14 dans `db/init.js`, `migrate.js`, `restore-backup.js`), pas de niveaux, pas d'identifiant de requête, pas de format machine. Quand quelque chose casse chez un utilisateur, **on ne peut pas répondre à « que s'est-il passé ? »** (c'est exactement la limite rencontrée au §3.1).

**Correctif** : un journal minimal JSON-lignes (`{t, niveau, rid, route, user, ms, statut, erreur}`) vers un fichier tournant dans le profil ; `X-Request-Id` renvoyé et affiché dans les messages d'erreur ; la page Système lit ce journal.

### API-09 🟡 Pas de métriques exposées · effort M

Rien ne dit combien de temps prennent les routes, combien de scans réussissent, quelle part des couvertures échoue. **Correctif** : `GET /api/instance/metrics` (admin) : latences p50/p95 par route, compteurs par source, taux d'échec des images — alimente la page Système et les alertes de la CI `sources-health`.

### API-10 🟡 Contrat de version d'API · effort S

`/api/v1` et `/api` sont montés ensemble (`app.js:47-48`) sans politique de dépréciation. Les apps Android (1.4.1) et desktop (2.9.0) parlent à un hub qui peut avoir une autre version : `hubId` existe, **pas de négociation de version**. **Correctif** : `GET /api/health` renvoie `{version, api: 1, minClient: "1.3.0"}` ; le client affiche « mets l'app à jour » plutôt que de planter sur un champ manquant.

### API-11 🔵 Version annoncée périmée · effort S 🤖

`server/package.json` dit **2.5.7**, la racine **2.9.0**. `/api/health` publie `APP_VERSION` (posée par Tauri) mais un serveur lancé à la main annonce 2.5.7. Le correcteur `versions` l'aligne ; le script de release doit l'**imposer** (test `package.json == server/package.json`).

### API-12 🔵 `server/db/init.js` n'est requis par rien · effort S

Script manuel (`npm run init-db`). Garder, mais documenter ; ou le supprimer si `ensureSchema` couvre tout.

### API-13 🔵 Dix variables d'environnement lues mais non documentées · effort S

`FRONTEND_DIR`, `APP_VERSION`, `INKO_MARIADB_DIR`, `INKO_DB_FALLBACK`, `DISABLE_SESSION_PURGE`, `UPDATES_MEMO_MS`, `INKO_LOCAL_ANY_HOST`, `CORS_ALLOW_ANY`, `LOCAL_RATE_FACTOR`, `USERNAME`. Un tableau (nom, défaut, effet, **danger**) dans le README et `server/.env.example`. `INKO_LOCAL_ANY_HOST=1` et `CORS_ALLOW_ANY=1` en particulier **ouvrent des portes** : elles doivent être documentées *avec* leur risque.

### Ce qui est bien et à conserver

Express 5 (rejets propagés à `errorHandler`) · pool MySQL borné · `healthcheck` qui teste la base · arrêt propre (SIGINT/SIGTERM/SIGBREAK/SIGHUP) · `unhandledRejection` capté · `openapi.json` **généré** et vérifié en CI (131 chemins) · limiteurs différenciés (`auth`, `search`, `img`, `relay`) · cache des mémos de scan borné (`BoundedCache`) · `curl` comme client réseau pour contourner les empreintes TLS, avec avertissement au démarrage.
