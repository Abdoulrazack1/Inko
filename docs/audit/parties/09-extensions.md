## 9. Extensions et sources

> **Point de départ** : l'architecture (extensions Mihon-like, hashes SHA-256 vérifiés, bac à sable, santé suivie, migration de source) est **excellente**. Ce qui manque, c'est le **nombre de sources saines** et la **mécanique qui rend les pannes invisibles pour l'utilisateur**.

### 9.1 État mesuré le {{date}} — chaîne complète sur chaque source

Le bac à sable déroule les quatre étapes sur **une œuvre réelle** : recherche → fiche → chapitres → pages (ou texte). Résultat :

| Source | Type · langue | Favoris | Recherche | Fiche | Chapitres | Pages / texte | Verdict |
|---|---|---:|:-:|:-:|:-:|:-:|---|
| **WeebCentral** 1.4.1 | manga · EN | **391** | ✅ 158 ms | ✅ | ✅ 420 ms | ✅ 59 ms | ✅ **saine** |
| **NovelFull** 1.2.2 | roman · EN | 3 | ✅ | ✅ | ✅ | ✅ | ✅ **saine** |
| **MangaDex** 1.3.0 | manga · multi | 31 | ✅ 340 ms | ✅ | ✅ 330 ms | ❌ | 🟠 pages (voir EXT-06) ; **couvertures 0/6** |
| **SushiScan** 1.1.0 | manga · FR | **84** | ❌ *aucun résultat exploitable (pas d'`id`)* | — | — | — | 🔴 **recherche cassée** ; **couvertures 0/12** |
| **NovelBin** 1.3.0 | roman · EN | 1 | ❌ *pas d'`id`* | — | — | — | 🔴 recherche cassée |
| **Chireads** 1.2.2 | roman · FR | 9 | ❌ *pas d'`id`* | — | — | — | 🔴 recherche cassée (couvertures 2/2 ✅) |
| **Royal Road** 1.2.2 | roman · EN | 0 | ❌ *HTTP 403* | — | — | — | 🔴 bloquée par un défi anti-bot |
| **Gutenberg** 1.2.3 | livre · multi | 2 | ✅ 8,3 s | ❌ 20 s | ✅ | ❌ 20 s | 🟠 `gutendex.com` ne répond pas |
| **Livres en français** 1.0.3 | livre · FR | 0 | ✅ 9,1 s | ❌ 20 s | ✅ | ❌ 20 s | 🟠 idem |

**Lecture.** 2 sources saines sur 9. Les trois sources de manga : **une** saine, une à pages cassées, une à recherche cassée. La bibliothèque réelle dépend à **75 % d'une seule source saine (WeebCentral : 391 / 521)** ; **SushiScan (84 favoris, 16 %) a une recherche cassée et aucune couverture** — c'est aussi pourquoi ses séries ne se mettent plus à jour (§3.3).

### 9.2 Réparer l'existant

#### EXT-01 ✅ SushiScan : certificat de `sushiscan.fr` expiré — corrigé le 25 novembre

**Cause établie** (le lendemain de l'audit) : le certificat TLS de `sushiscan.fr` a **expiré le 21 novembre** (`SEC_E_CERT_EXPIRED`). Toute requête échouait — recherche vide (« pas d'`id` ») et couvertures en 502. `sushiscan.net` sert le même site, avec un certificat valide jusqu'en 2027, les mêmes adresses de séries et de chapitres.

**Fait** : extension 1.2.0 sur `sushiscan.net` ; vérifié en direct (recherche, fiche, chapitres, 194 planches, couverture). Les favoris et la progression restent valables ; les anciennes couvertures se réparent d'elles-mêmes (COV-01).

**Reste** : une fixture figée et un test de contrat (EXT-10), et **un contrôle de l'expiration des certificats** des sources dans `sources-health.yml` — cette panne se voyait venir.

#### EXT-02 🟠 NovelBin : recherche sans `id` · effort S

Même symptôme, 1 favori. Mêmes remèdes (sélecteurs candidats, fixture). Reprend `d05b158` (« une page d'erreur n'est pas du contenu, et novelbin revit ») : la source a déjà été réparée une fois, ce qui confirme la fragilité des sélecteurs uniques.

#### EXT-03 🟠 Chireads : recherche sans `id` ; correctif de fiche/chapitres prêt mais non appliqué · effort S

Un correctif existe (`ed170.py` dans le dossier de travail) : `getManga` avec `prem()` sur `#refresh-detail-title`, `.refresh-detail-hero-copy h1`, `.refresh-detail-meta`, `.refresh-detail-summary-content`, `.refresh-detail-cover img` ; `getChapters` avec `SELS = ['.refresh-detail-chapter-list a', '.chapitre-table a, .chapitre a[href*="/translatedtales/"]', 'a[href*="/translatedtales/"]']`. **À appliquer, puis** : `cp` vers `server/extensions/chireads`, `npm run gen-ext-hashes`, entrée de `changelog.json`, essai au bac à sable. La **recherche** reste à reprendre (même motif que les autres) : 9 favoris.

#### EXT-04 🟠 Royal Road : HTTP 403 (défi anti-bot) · effort S

`royalroad.com` répond « Just a moment… » (page de défi Cloudflare) à toute requête automatisée ; mesuré aussi pour **ScribbleHub, Feedbooks et Mangakakalot**. **Il ne faut pas tenter de contourner un défi anti-bot** (hors périmètre éthique et fragile). **Ce qu'il faut faire** : (1) l'interface doit dire **« Royal Road bloque les applications — source indisponible »** au lieu d'une erreur générique, avec le lien « Ouvrir dans le navigateur » ; (2) désactiver proprement la source (`disabledReason`) plutôt que la laisser échouer à chaque recherche groupée ; (3) étudier les **flux officiels** (RSS de syndication par fiction) pour le suivi des nouveaux chapitres seulement.

#### EXT-05 🟠 Gutenberg ×2 : `gutendex.com` et `gutenberg.org` indisponibles · effort M

Au moment des essais : `gutendex.com` **ne répond pas en 15 s** et `gutenberg.org` renvoie **503** (limitation de débit ou panne). Le journal du serveur : `curl : Command failed … gutendex.com/books/?page=1&search=dracula`. Les étapes « fiche » et « texte » expirent à 20 s ; la recherche passe en 8–9 s *sans tri*.

**Correctif** : **ne plus dépendre d'un service tiers pour chercher.** Gutenberg publie son **catalogue complet** (`feeds/pg_catalog.csv`, ≈ 17 Mo, quotidien) : l'**indexer localement** (≈ 75 000 titres, recherche en < 50 ms, hors ligne), rafraîchi chaque semaine. Textes : **miroirs multiples** (`gutenberg.org`, `aleph.gutenberg.org`, `gutenberg.pglaf.org`) avec bascule automatique. Repli de métadonnées : **Open Library** (200 JSON mesuré). Délai de 6 s par essai, pas 20.

#### EXT-06 🟡 MangaDex : « pages du chapitre » en échec sur la première œuvre testée · effort S

L'extension saute déjà les chapitres `externalUrl` (renvoyant vers MANGA Plus). Le bac à sable prend le **dernier** chapitre de la liste ; celui-ci n'est pas servi par le CDN (« il est référencé mais son serveur d'images ne le connaît pas »). C'est une **limite du bac à sable**, pas de l'extension : **essayer jusqu'à 3 chapitres** avant de conclure à l'échec.

#### EXT-07 🟠 `versions.json` est périmé : les clients ne voient jamais les mises à jour · effort S 🤖

**Preuve** : le fichier date du **16 juillet** ; le code a évolué jusqu'au 9 novembre.

| Source | Code (`index.js`) | `versions.json` |
|---|---|---|
| WeebCentral | 1.4.1 | **1.2.1** |
| MangaDex | 1.3.0 | **1.2.1** |
| SushiScan | 1.1.0 | **0.7.2** |
| NovelBin | 1.3.0 | **1.2.2** |
| Gutenberg | 1.2.3 | **1.2.2** |
| Livres en français | 1.0.3 | **1.0.2** |

C'est ce fichier que `/extensions/updates` lit (`extensions.controller.js:59`) pour décider s'il existe une version plus récente. **Conséquence : un correctif publié (la réparation de WeebCentral, de MangaDex…) n'est jamais proposé aux autres installations.** Le bouton « Mettre à jour » des extensions affiche « à jour » à tort. `gen-ext-hashes` régénère `hashes.json` mais **pas** `versions.json`.

**Correctif** : générer `versions.json` **depuis** les `version:` des `index.js` dans le même script que les empreintes, et l'ajouter aux gardes de CI (`--check`). **Un correcteur existe** (`versions-extensions`, voir §17).

### 9.3 La redondance : trois sources de manga ne suffisent pas

#### EXT-08 🟠 Le catalogue doit pouvoir perdre n'importe quelle source sans que la bibliothèque devienne illisible · effort L

**Cible** : au moins **6 sources de manga saines** et **6 de livres**, dont les trois quarts dans la langue de la bibliothèque. Faisabilité **mesurée** (GET anonymes, une fois, le {{date}}) :

**Manga et bande dessinée**

| Source | Réponse | Verdict | Notes |
|---|---|---|---|
| **MangaKatana** | 200, HTML de recherche 80 Ko | ✅ **à faire en premier** | scraping classique, pas de défi |
| **Mangapill** | 200, 135 Ko | ✅ à faire | HTML simple, images directes |
| **Bato.to** | 200, 38 Ko | ✅ à faire | miroirs multiples (domaines à configurer) |
| **Webtoons** (officiel) | 200 | ✅ à faire | contenu **légal et gratuit** ; FR/EN ; format vertical → mode webtoon déjà géré |
| **Tapas** | 200 | 🟡 à étudier | surtout comics/webnovels, une partie payante |
| **Asura**, **Flame Comics** | 200 (Next.js, 460–800 Ko) | 🟡 | pages lourdes ; chercher les points d'accès JSON internes |
| **Japscan** (FR) | 200 (2 Mo) | 🟡 à vérifier | historiquement protégé ; **à tester dans la durée avant d'investir** |
| **Comick** | l'API ne résout plus, le site répond | 🟡 | SPA ; API à redécouvrir |
| **MANGA Plus** (officiel) | 200 mais **« Account Banned »** | ❌ | exige des en-têtes d'application ; hors périmètre |
| **Mangakakalot** | **403** (défi) | ❌ | ne pas contourner |
| **Lelscan**, **Anime-Sama** | 404 / pas de réponse | ❌ | domaines à retrouver |

**Livres, romans, domaine public**

| Source | Réponse | Verdict | Notes |
|---|---|---|---|
| **Wikisource** (FR/EN) | 200 **JSON** (`api.php`) | ✅ **à faire en premier** | API officielle, corpus immense et relu, **FR de qualité** |
| **Standard Ebooks** | 200 (HTML) | ✅ à faire | EPUB soignés, domaine public ; `/feeds/opds` demande une authentification → scraper la recherche |
| **Open Library** + **Internet Archive** | 200 **JSON** | ✅ à faire | filtrer *domaine public / empruntable* ; **aussi source de couvertures** (COV-01) |
| **Bibebook**, **ebooksgratuits** | 200 | ✅ à faire | **FR**, domaine public |
| **Wuxiaworld** | 200 (Next.js, 300 Ko) | 🟡 | traductions officielles, en partie payantes |
| **AO3** | pas de réponse en 15 s | 🟡 à retenter | fanfictions ; export HTML/EPUB natif |
| **Librivox** | — (non testé) | 🟡 | **livres audio** libres : s'accorde avec le lecteur musique et la synthèse vocale |
| **Feedbooks**, **ScribbleHub**, **Royal Road** | **403** (défi) | ❌ | ne pas contourner |

**Ordre conseillé** : MangaKatana → Mangapill → Bato.to → Webtoons ‖ Wikisource → Standard Ebooks → Open Library/Internet Archive → Bibebook. Chaque source = **une extension de 250–450 lignes**, un bac à sable vert, une fixture figée, une entrée de changelog, un test de contrat.

#### EXT-09 🟠 Une extension nouvelle doit naître avec son filet · effort M

Faire de ces trois choses un **gabarit** : `npm run new-extension -- <id>` crée `extensions-community/<id>/{index.js, __fixtures__/, test.js}` ; `npm run ext:record -- <id> "<requête>"` **enregistre** les réponses réelles (recherche, fiche, chapitres, pages) dans `__fixtures__` ; `npm run ext:try -- <id> "<requête>"` rejoue le bac à sable **en ligne de commande**. Aujourd'hui, écrire une source suppose de lancer l'app entière.

#### EXT-10 🟠 Tests de contrat hors ligne pour chaque source · effort M

`sources-health.yml` mesure **en direct** — utile, mais une panne n'y apparaît qu'une fois le site changé, et un site en panne passagère déclenche de fausses alertes. **Ajouter** des tests **sur fixtures figées** : ils prouvent que *le code lit correctement le HTML qu'on lui donne*. Lorsque la CI en direct passe au rouge et que la fixture reste verte, la panne est **côté site** ; si la fixture rougit, c'est **côté code**. Dans les deux cas on sait quoi faire.

### 9.4 Le comportement de l'application quand une source tombe

#### EXT-11 🟠 Une source en panne ne doit pas se voir, et quand elle se voit il faut proposer une issue · effort M

Aujourd'hui : la source échoue à chaque appel (délai complet), la recherche groupée **attend** les échecs, les mises à jour affichent « À jour » (§3.3), les couvertures tombent sur le dessin. **Cible** :
1. **Disjoncteur par source** (comme `/api/img`) : après 3 échecs ou 60 % d'échec sur 5 min, la source est **mise de côté 10 min**, les appels sautent l'attente ;
2. **Bandeau discret sur la fiche** : « SushiScan ne répond pas depuis 12 min — **Chercher cette œuvre sur WeebCentral / MangaDex** » (la recherche multi-source et `migration-sources.js` existent) ;
3. **Basculer automatiquement la lecture** vers une autre source si l'œuvre y existe avec le même titre (consentement unique, mémorisé) ;
4. **Migration proactive** : quand une source est morte depuis 7 jours, proposer « Migrer les 84 séries de SushiScan » avec aperçu des correspondances.

#### EXT-12 🟡 Santé des sources : afficher ce que le serveur sait déjà · effort S

`/extensions/health` renvoie par source : dernier succès, dernier échec, série d'échecs, latence, taux d'échec, **champs vus ou jamais vus** (`description` jamais renseignée sur WeebCentral). Seul un résumé est visible. **Afficher** la page Sources comme un tableau de bord : pastille verte/orange/rouge, latence, « dernier succès il y a 3 min », bouton « Essayer » (bac à sable).

#### EXT-13 🟡 `sushiscan/index.js` fait 921 lignes · effort M

Trois fois la taille des autres. Séparer `index.js` (interface), `recherche.js` (index adulte), `pages.js` ; sinon la prochaine panne sera plus longue à réparer que la précédente.

### 9.5 L'écosystème des extensions

#### EXT-14 🟡 Documentation d'auteur, types, publication · effort M

`server/extensions/README.md` et `exemples.js` existent. **Manquent** : une référence de l'API hôte (`http`, `cheerio`, `html`, helpers de statut), un `extension.d.ts` pour l'autocomplétion, une **page « écrire une extension »** (docs/), des règles de publication (nom, licence, hashes, changelog, version) et un **guide de contribution** (`CONTRIBUTING.md` existe ; ajouter une PR template « nouvelle source » avec la checklist : bac à sable vert, fixture, changelog, aucun secret).

#### EXT-15 🔵 Signature des extensions · effort L

Les empreintes SHA-256 protègent contre une corruption, **pas** contre un dépôt compromis (le même dépôt publie le code et les empreintes). **Option** : signature détachée (Ed25519) vérifiée avec une clé publique **embarquée dans l'app**.

#### EXT-16 🔵 Règles de bonne conduite envers les sites sources · effort S

Plafonds déjà bornés dans le bac à sable (une œuvre, un chapitre, une page). **Généraliser** : `robots.txt` lu une fois par hôte, délai minimal par hôte (≥ 500 ms), `User-Agent` honnête avec lien vers le projet, aucune action sur les pages de connexion. La note « Le site d'une source est tenu par quelqu'un » du bac à sable doit devenir une règle de **tout** le code.

### 9.6 Ce qui est bien et à conserver

Hashes d'extensions vérifiés à l'installation · **bac à sable** (rapport par étape, borné, sans trace) · santé par source avec champs « jamais vus » (détecte une refonte avant l'utilisateur) · lecture du **statut HTTP réel** (`curl -w`) et refus de mettre en cache une page d'erreur · `externalUrl` de MangaDex sautées · migration de source avec correspondance · Gutenberg : détection d'encodage · `sources-health.yml` en CI.
