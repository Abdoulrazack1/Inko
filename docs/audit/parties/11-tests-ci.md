## 11. Tests et qualité

**Inventaire** : {{mesure:tests.fichiers_tests.unit}} fichiers de tests unitaires du front, {{mesure:tests.fichiers_tests.serveur}} côté serveur, {{mesure:tests.fichiers_tests.e2e}} scénarios Playwright — soit **1 289 tests exécutés avec succès** lors de cet audit (**1 008** front + **281** serveur, 0 échec, dont les 12 tests des correcteurs de sondes ajoutés ici). Les gardes de dérive (openapi, précache, hashes, métadonnées, Android 8, changelog des extensions) tournent en CI. Les 26 pages ont toutes au moins un scénario e2e. C'est une base **largement au-dessus de la moyenne**.

La question n'est pas *combien*, mais **ce que les tests prouvent**.

### TST-01 🟠 {{mesure:tests.tests_qui_lisent_le_source}} fichiers de test vérifient le texte du code, pas son comportement · effort XL

La sonde repère les fichiers qui lisent un fichier source (`readFileSync`, `lire(…)`) et font des `assert.match(src, /…/)` **sans jamais exécuter le module**. Exemples de la forme : `assert.match(b, /'-C', '-'/)` (« curl demande la reprise »), `assert.ok(!/timeout: 300000/.test(SRC))`.

Ces tests ont une vraie utilité — ils **figent une décision** (« on a retiré ce plafond de 300 s, qu'il ne revienne pas »). Mais ils :
- **passent tant que la regex est présente**, même si la fonction est cassée ;
- **cassent au moindre renommage ou reformatage** (CRLF/LF : déjà trois fois dans l'historique) ;
- donnent un **faux sentiment de couverture** : 113 fichiers « verts » ne protègent pas 113 comportements.

**Correctif (progressif, par criticité)** :
1. **Conserver** ceux qui verrouillent une *décision de configuration* (timeouts, flags, en-têtes) — les renommer `decision-*.test.js` pour les distinguer ;
2. **Convertir** en tests de comportement (jsdom, déjà en `devDependencies`) les modules dont une panne coûte cher : `api.js` (file hors-ligne, `clientAt`), `storage.js` (garde du miroir : **le test du miroir de 495 entrées n'existe qu'en texte**), `bibliotheque.js` (`bulkDelete`, `wireLibRefresh`), `serie.js`, `chapitre.js` (modes de lecture, reprise) ;
3. **Règle de revue** : toute correction de bug s'accompagne d'un test qui **échoue sans elle**, en comportement quand c'est possible.

**Critère** : un tableau `docs/tests.md` classe chaque fichier (`décision` / `comportement` / `intégration`) ; la part « comportement » monte de ≈ 30 % à 60 % sur les 20 modules critiques.

### TST-02 🟠 {{mesure:tests.routes_non_citees_par_un_test}} routes sur {{mesure:routes.routes_total}} ne sont citées par aucun test · effort L

`/auth/logout`, `/auth/sessions*`, `/auth/profile`, `/auth/delete` (partiellement), `/extensions/health`, `/extensions/:id/bac-a-sable`, `/extensions/update`… Les parcours d'écriture de la sonde ont montré que **ce sont précisément les routes d'écriture qui cachent les défauts** (import → 500, couverture `javascript:`).

**Correctif** : un **test de contrat généré depuis `openapi.json`** : pour chaque route, (a) sans jeton → 401/403, (b) avec jeton et corps vide → jamais 500, (c) avec corps aléatoire (`fast-check`) → jamais 500. 151 routes × 3 cas pour ≈ 200 lignes de code.

### TST-03 🟠 Les tests e2e peuvent tourner sur la vraie base · effort S

`playwright.config.js` : `reuseExistingServer: !process.env.CI` sur le port **8088** — si un serveur de dev tourne, la suite s'y branche, avec `LOCAL_MODE=1`, donc **sur la base `inko` réelle**. La table `users` contient **25 comptes de test** : la preuve existe. **Correctif** : DAT-04 — la suite exige `DB_NAME=inko_e2e*` et **refuse** de démarrer autrement ; port dédié (8187) ; jamais de réutilisation.

### TST-04 🟡 Aucun test de régression visuelle · effort M

Le défaut du §3.3 (décalage de 208 px) et les CLS de 0,4–0,8 sont **invisibles** à tous les tests actuels. **Ajouter** : `expect(page).toHaveScreenshot()` sur 6 pages × 3 viewports (bureau, tablette, mobile) × 2 thèmes ; les scènes existent déjà dans `scripts-ci/captures-readme.js`. Et **un budget de CLS** : échec si > 0,1 sur les pages clés (la sonde `pages` le mesure).

### TST-05 🟡 L'exploration des boutons doit devenir un test de fumée · effort M

La sonde `boutons` clique tous les contrôles des 26 pages et détecte les boutons morts, recouverts, ou qui lèvent une erreur. **La brancher en e2e** (`test/e2e/fumee-controles.spec.js`, sur base jetable) avec une liste de tolérances versionnée.

### TST-06 🟡 Pas de mesure de couverture · effort S

`node --test --experimental-test-coverage` (serveur) et `c8` (front, via jsdom) ; publier le taux par module ; **cliquet** (la couverture ne peut pas baisser). Aujourd'hui on ne sait pas quelle part de `user.controller.js` (1 831 lignes, 47 écritures SQL) est exercée.

### TST-07 🟡 Deux modules serveur sans test nommé · effort M

`migration.controller.js` (210 lignes — **migration de source, opération qui réécrit 4 tables**) et `push-fcm.js` (149). Voir DAT-09 et MOB-05.

### TST-08 🔵 Deux tests ignorés · effort S

`identite-hub.test.js` et `integration.db.test.js` contiennent un `skip` conditionnel (MySQL absent). Acceptable localement ; **en CI, `REQUIRE_DB_TESTS=1` les rend obligatoires** (c'est déjà le cas) — le vérifier dans le journal d'une exécution récente.

### TST-09 🔵 Tests de mutation sur les modules purs · effort L

Quelques modules purs (`politique de mot de passe`, `appariement`, `type-image`, `bounded-cache`, `couverture`) pourraient passer **Stryker** : un test qui survit à une mutation ne vérifie rien.

### TST-10 🔵 `test/e2e/audit-controles.spec.js` : 927 lignes, une fonction de 284 lignes · effort M

`auditerMode()` (284 lignes) cumule l'exploration, les assertions et le rapport. La sonde `boutons` en fait mieux avec moins de code : à fusionner (TST-05).

### Ce qui est bien et à conserver

`test/helpers` partagés · tests de **non-régression nommés par audit** (`securite-p02`, `couvertures-absentes`, `maj-bureau-reprenable`) qui racontent *pourquoi* · base `inko_test` jetable recréée à chaque suite · `check-i18n`, `verifier-*` comme tests d'**invariants** · suites séparées front/serveur (une dépendance serveur qui fuit dans le job front est détectée — `maj-bureau-reprenable.test.js` a été déplacé pour cela).

---

## 12. CI/CD et dépendances

### 12.1 Intégration continue

Six workflows : `ci`, `release`, `android`, `android-release`, `android-emulateur`, `sources-health`. **Bien** : base MySQL réelle en service, `REQUIRE_DB_TESTS`, gardes de dérive, matrice de vérifications Android, tag de release re-pointable, santé des sources planifiée.

#### CI-01 🟠 Aucun audit de dépendances ni analyse de code en CI · effort S

Pas de `npm audit`, **CodeQL**, `dependency-review-action`, `cargo audit`, ni analyse des secrets (`gitleaks`/`trufflehog`). Les sondes montrent **0 vulnérabilité aujourd'hui** : le but est que cela reste vrai. **Correctif** : un job `securite` (audit en production, CodeQL JS, gitleaks sur le diff), bloquant sur *high/critical*.

#### CI-02 🟡 `ci.yml` sans bloc `permissions` · effort S 🤖

Le jeton `GITHUB_TOKEN` a les droits d'écriture par défaut. Le correcteur `ci-permissions` ajoute `permissions: contents: read`. Les workflows de publication gardent leurs droits explicites (`release.yml`, `android-release.yml` déclarent déjà `permissions:`).

#### CI-03 🟡 Aucun `timeout-minutes` (6 workflows) · effort S

Un job bloqué consomme 6 h. 15 min pour les tests, 45 pour l'émulateur Android, 30 pour les builds.

#### CI-04 🟡 Quatre actions tierces non épinglées · effort S

`reactivecircus/android-emulator-runner@v2`, `android-actions/setup-android@v4` ×2, `softprops/action-gh-release@v3` → SHA complet (dependabot les met à jour).

#### CI-05 🟡 `dependabot` ne surveille pas `gradle` ni `docker` · effort S

Les dépendances Android (Gradle) et l'image de base du conteneur sont donc **hors surveillance**.

#### CI-06 🟡 `npm run lint` ne couvre que `assets/js` et `service-worker.js` · effort M

`package.json` : `"lint": "eslint assets/js service-worker.js"`. Les **≈ 10 000 lignes** du serveur (`server/**`) et les scripts (`scripts-ci/**`) ne sont jamais linté. **Correctif** : étendre à `server/` avec la config Node (`no-unused-vars`, `no-undef`, `no-floating-promises` via `typescript-eslint` en JS) ; commencer en avertissements, durcir par répertoire.

#### CI-07 🟡 Les sondes ne tournent pas en continu · effort S

**Brancher `scripts-ci/sondes/strategie.js --sans-dynamiques` en CI nocturne** : publie `ANNEXE-SONDES.md` en artefact et **échoue si le nombre de trouvailles de gravité ≥ haute augmente** par rapport à `docs/audit/baseline.json`. Un audit qui n'est pas rejoué se périme en un mois.

#### CI-08 🔵 Pas de SBOM ni d'attestation de provenance · effort S

Pour un installeur qui s'auto-met à jour : générer un **SBOM CycloneDX** et une **attestation SLSA** (`actions/attest-build-provenance`) attachés à chaque release.

#### CI-09 🔵 Une seule commande de release · effort M

La dérive `server/package.json` 2.5.7 vs racine 2.9.0 prouve que la version se met à jour **à la main** en plusieurs endroits (racine, serveur, `tauri.conf.json`, `Cargo.toml`, `desktop-tauri/package.json`, `versionMobile`, `versionCodeMobile`, `RELEASE_*`). **Correctif** : `npm run release -- 2.10.0` qui bumpe tout, régénère les dérivés (`gen-*`), vérifie, et crée le tag.

### 12.2 Dépendances

| Mesure | Valeur |
|---|---|
| Vulnérabilités (`npm audit --omit=dev`) | **0** racine · **0** serveur |
| Versions majeures en retard | **1** : `web-push` 3.6.7 → 4.0.0 (serveur) |
| Paquets en retard (mineur/correctif) | 7 racine · 5 serveur |
| Versions : racine / serveur / Tauri / Cargo / mobile | 2.9.0 / **2.5.7** / 2.9.0 / 2.9.0 / 1.4.1 |

#### DEP-01 🟡 Version du serveur périmée · effort S 🤖

Voir API-11.

#### DEP-02 🔵 `engines.node` divergent · effort S

Racine `>=22.22.2` ; serveur `>=18`. Le serveur embarqué tourne sous Node 22 : aligner (`>=22.22.2`) pour ne plus promettre un support que rien ne teste.

#### DEP-03 🔵 `web-push` 4.0.0 · effort S

Une majeure ; test e2e de la notification push (MOB-05) avant la montée.

#### DEP-04 🔵 Licences des composants embarqués · effort M

Voir DOC-05 (légal).

### Ce qui est bien et à conserver

Verrous `package-lock.json` partout · `dependabot` actif (npm, cargo, actions) · versions mineures à jour (aucune majeure en retard côté front) · `npm audit` propre · Node épinglé par `.nvmrc`.
