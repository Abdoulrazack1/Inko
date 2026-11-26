## 14. Documentation, communication et cadre légal

**Mesuré** : {{mesure:docs.documents_md}} documents Markdown, **0 lien relatif cassé**, `LICENSE` (Apache-2.0), `SECURITY.md`, `CONTRIBUTING.md`, `CHANGELOG.md` à jour pour 2.9.0, `NOTICE.md` (honnête et précise sur ce que la distribution contient), `openapi.json` **généré**, `docs/` riche (audits mobile, clavier, contrôles, CSS, états, i18n, push). C'est un niveau de documentation rare.

### DOC-01 🟠 Le README refait n'est pas publié, et ses captures ne sont qu'à un tiers · effort S

**État réel** :
- `README.md` : réécrit en entier (≈ 900 lignes), **modifié et non commité**.
- `assets/screenshots/` : **5 captures nouvelles sur ≈ 15 prévues** (`accueil`, `bibliotheque`, `catalogue`, `lecteur`, `serie` en `.jpg` ; seule `accueil` a été relue). Restent : `roman`, `sources`, `essai-source`, `statistiques`, `parametres`, `musique`, `accueil-sombre`, `bibliotheque-sombre`, `mobile-*`.
- `scripts-ci/captures-readme.js` : **le lot complet s'est arrêté avec le code 4**, non diagnostiqué.
- La section « Aperçu » du README **référence encore les anciens fichiers** (`home.png`, `reader.png`, `music.png`, `catalogue.png`, `serie.png`) : les nouvelles captures ne sont pas branchées. `tools/shot-home.js` et `AUDIT-INKO-2026-07-28.md` y font aussi référence.
- La sonde `docs` signale « 5 captures non référencées par le README ».

**À faire (dans cet ordre)** : (1) diagnostiquer le code 4 (probable : un sélecteur de scène absent ou le navigateur de repli) ; (2) **relire chaque capture** — vie privée (pas de vrai titre ni de compte), contenu adulte, qualité, cohérence des thèmes ; (3) relancer toutes les scènes ; (4) brancher les `.jpg` dans le README ; (5) supprimer les 5 `.png` après vérification des références ; (6) commit **explicite** des chemins (jamais `git add -A` : `promo/` pèse ≈ 80 Mo) ; (7) PR.

**Critère** : `docs` ne signale plus de capture orpheline ; le README s'affiche entièrement sur GitHub, clair et sombre.

### DOC-02 🟡 Les variables d'environnement ne sont pas documentées · effort S

Voir API-13 : dix variables lues par le serveur, dont deux qui **ouvrent des portes** (`CORS_ALLOW_ANY`, `INKO_LOCAL_ANY_HOST`). Un tableau « nom · défaut · effet · **risque** » dans le README et dans `server/.env.example`.

### DOC-03 🟡 Cadre communautaire incomplet · effort S

Absents : `CODE_OF_CONDUCT.md`, `.github/ISSUE_TEMPLATE/` (bug, source cassée, demande de source, suggestion), `.github/PULL_REQUEST_TEMPLATE.md` (checklist : tests, changelog, captures avant/après, `npm run gen-*`). L'issue « source cassée » devrait **demander la sortie du bac à sable** (« Essayer » → copier le rapport).

### DOC-04 🟡 Documentation en français seulement · effort M

`README.md` et `docs/` en français ; le public des **extensions** et des lecteurs de manga est largement international. **Au minimum** : `README.en.md` (présentation, installation, extensions) et `docs/extensions.md` en anglais ; le reste peut rester en français.

### DOC-05 🟠 Les licences des composants embarqués ne sont pas listées · effort M

`NOTICE.md` décrit très bien **le rapport aux œuvres**, mais **aucun fichier ne liste les composants tiers livrés** dans l'installeur et l'APK :

| Composant | Licence | Obligation |
|---|---|---|
| **MariaDB 11.8.8** (binaires dans l'installeur) | **GPL-2.0** | texte de la licence + **offre de code source** (lien vers les sources de cette version) |
| **Node.js** (sidecar) | MIT | texte de la licence |
| Polices **Archivo Narrow, Bitter, IBM Plex Sans** | **OFL-1.1** | texte + noms réservés |
| **pdf.js** (+ worker) | Apache-2.0 | `NOTICE` |
| **JSZip** | MIT *ou* GPL-3.0 (double) | choisir MIT, l'indiquer |
| **three.js**, **qrcode** | MIT | texte |
| **GSAP / ScrollTrigger** | licence GreenSock « Standard » (non OSI) | **à vérifier** : l'usage dans une application redistribuée est permis, mais pas tous les usages ; envisager un remplacement par animations CSS + Web Animations API (le code ne s'en sert que pour des révélations d'entrée) |
| Dépendances npm du serveur | MIT/ISC/Apache pour la quasi-totalité | `npm run licences` généré |

**Correctif** : `THIRD-PARTY-NOTICES.md` **généré** (`license-checker` pour npm, liste maintenue pour les binaires), **embarqué dans l'installeur et l'APK**, affiché dans Paramètres › À propos › Licences. Pour MariaDB : lien explicite vers `downloads.mariadb.org` pour la version exacte.

### DOC-06 🟡 La page Confidentialité doit refléter ce que le navigateur contacte réellement · effort S

La sonde `boutons` relève les hôtes que le **navigateur** appelle directement (hors hub) ; ils doivent tous figurer dans `confidentialite.html`, avec la raison (image, police, API). Voir §6 pour le relevé. Chaque appel direct révèle **l'adresse IP et la page consultée** au tiers.

### DOC-07 🟡 Pas de documentation d'architecture · effort M

L'utilisateur a fourni un schéma d'architecture (Reader → clients Android/Windows → hub Express `app.js` → routes `index.js` → auth ; bibliothèque et lecture ; sources et découverte ; MySQL). Il mérite d'être **dans le dépôt** : `docs/architecture.md` avec un diagramme **Mermaid** (rendu natif par GitHub), les flux critiques (lecture d'un chapitre, scan de mises à jour, appairage, mise à jour de l'app), et les **décisions** (ADR courts : pourquoi vanilla, pourquoi MariaDB embarquée, pourquoi `curl`, pourquoi le miroir local). La matière existe — dans les commentaires du code, qui racontent chaque décision ; il faut la **ramasser**.

### DOC-08 🔵 Un seul document d'audit vivant · effort S

Archiver `AUDIT-INKO-2026-07-28.md`, `AUDIT-QA-2026-08-12.md`, `audit.md` sous `docs/audit/archives/`, garder **celui-ci** (régénérable : §17) ; pointer depuis le README.

### DOC-09 🔵 Référence d'API consultable · effort S

`openapi.json` est généré (131 chemins) mais n'est lisible que par un outil. Servir **Redoc/Swagger UI** à `/api/docs` (statique, une page) pour les auto-hébergeurs et les auteurs d'extensions.

### DOC-10 🔵 Guide utilisateur et FAQ · effort M

« Pourquoi ma source ne répond pas ? », « Comment migrer ma bibliothèque ? », « Comment restaurer une sauvegarde ? » (**le §3.1 en a eu besoin**), « Que faire si Windows bloque l'installeur ? » (DSK-01). Une page `docs/aide/` + un lien depuis Paramètres.

### DOC-11 🔵 Présence du projet · effort S

Le dépôt GitHub : description, **topics** (`manga-reader`, `tauri`, `self-hosted`, `capacitor`, `extensions`), image d'aperçu social, **Discussions** activées, `FUNDING` si pertinent, notes de release automatiques (`notes-release.js` existe), badge CI. Un **post LinkedIn** de présentation est prévu (rédaction seule — **non publié** sans validation).

### Ce qui est bien et à conserver

`NOTICE.md` (précis sur le rôle réel du logiciel et sur l'IP visible du téléphone) · `SECURITY.md` · `CHANGELOG.md` tenu · commentaires-récits dans le code · `docs/audit-*.md` par thème · génération de la référence d'API · **0 lien cassé**.
