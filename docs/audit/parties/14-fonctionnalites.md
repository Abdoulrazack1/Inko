## 15. Ce qu'il faut ajouter

> Ces fonctionnalités viennent de ce que **l'application sait déjà faire à moitié** (un module existe, une donnée est déjà collectée, un besoin est déjà exprimé dans le code) ou de ce que **ses utilisateurs viennent chercher chez un lecteur de manga**. Chacune est classée par **impact** (ce que ça change pour l'utilisateur) et **effort**, avec ses prérequis.
> Les corrections des §2–§14 passent **avant** : ajouter une fonction à une base dont plus d'un cinquième des couvertures manquent et dont une source sur deux est en panne ne fait que multiplier les défauts visibles.

### 15.1 Les fondations d'une bibliothèque qu'on peut croire

| ID | Fonctionnalité | Impact | Effort | Prérequis |
|---|---|:-:|:-:|---|
| **FEA-01** | **Corbeille et « Récemment retirés »** (restauration en un clic, purge à 30 j) | ★★★ | M | DAT-01 |
| **FEA-02** | **Annuler partout** : toute suppression → barre « Annuler » 8 s (favori, liste, note, signet, catégorie, téléchargement) | ★★★ | M | UX-01 |
| **FEA-03** | **Assistant de restauration** dans Paramètres › Données : liste des sauvegardes, aperçu (`previewBackup` existe), restauration **précédée d'une sauvegarde de l'état actuel** | ★★★ | M | DAT-06, DSK-06 |
| **FEA-04** | **Journal d'activité lisible** (« 12:11 — 497 séries retirées depuis cet ordinateur ») avec origine par événement | ★★ | S | DAT-02 |
| **FEA-05** | **Sauvegarde distante chiffrée** : destination WebDAV / Nextcloud / dossier synchronisé (le chiffrement `sauvegarde-chiffree.js` existe) | ★★ | M | SEC-08 |

### 15.2 Des sources qui tiennent

| ID | Fonctionnalité | Impact | Effort | Prérequis |
|---|---|:-:|:-:|---|
| **FEA-06** | **6 sources de manga et 6 de livres saines** (EXT-08) | ★★★ | L | EXT-09 |
| **FEA-07** | **Bascule automatique de source** à la lecture quand la source est en panne (consentement unique) | ★★★ | M | EXT-11 |
| **FEA-08** | **Migration proactive** : « SushiScan est mort : migrer 84 séries ? » avec aperçu des correspondances | ★★ | M | EXT-11 |
| **FEA-09** | **Tableau de santé des sources** (pastilles, latence, dernier succès, « Essayer ») | ★★ | S | EXT-12 |
| **FEA-10** | **Catalogue de sources hors ligne** : index local des titres Gutenberg/Wikisource, recherche instantanée sans réseau | ★★ | M | EXT-05 |

### 15.3 Lire, mieux

| ID | Fonctionnalité | Impact | Effort | Notes |
|---|---|:-:|:-:|---|
| **FEA-11** | **Livres audio** (Librivox) + synthèse vocale améliorée : vitesse, minuterie de sommeil, reprise au mot près | ★★ | M | le lecteur musique et la synthèse (`lecture.js`, `localreader.js`) existent déjà |
| **FEA-12** | **Accessibilité de lecture** : police pour la dyslexie (OpenDyslexic/Atkinson), interlignage, mode e-ink (noir et blanc, sans animation), contraste renforcé | ★★ | S | aucune trace aujourd'hui |
| **FEA-13** | **Téléchargement intelligent** : « garder les 5 prochains chapitres hors ligne, sur Wi-Fi, pour les séries en cours » | ★★★ | M | `downloads.js` existe |
| **FEA-14** | **Annotations et surbrillance** dans les romans, export Markdown (vers un coffre Obsidian) | ★★ | M | `reading_notes` existe |
| **FEA-15** | **Préchargement adaptatif** des planches (2 suivantes sur réseau lent, 6 sinon) et indicateur de réseau | ★★ | S | PER-05 |
| **FEA-16** | **Reprise instantanée** : ouvrir directement la dernière planche depuis le bureau, la zone de notification ou un raccourci d'app | ★★ | S | DSK-05 |

### 15.4 Suivre et découvrir

| ID | Fonctionnalité | Impact | Effort | Notes |
|---|---|:-:|:-:|---|
| **FEA-17** | **Synchronisation MyAnimeList et Kitsu** (en plus d'AniList) : statut, chapitre lu, note | ★★ | M | Kitsu répond (200, JSON) ; `anilist.js` donne le patron |
| **FEA-18** | **Calendrier des sorties** : prochains chapitres attendus (AniList *airing*) pour les séries suivies | ★★ | M | |
| **FEA-19** | **Recommandations** par proximité de tags avec la bibliothèque (`reco-tags.js` existe) enrichies par les recommandations AniList | ★ | M | |
| **FEA-20** | **Collections intelligentes** : filtres enregistrés (« en cours, non lus > 5 », « pas ouvertes depuis 30 j ») | ★★ | M | filtres + `restaurerFiltres` existent |
| **FEA-21** | **Étiquettes personnelles** (`#à-relire`, `#prêté`) en plus des catégories | ★ | S | |
| **FEA-22** | **Détecteur de doublons à l'ajout** (même titre, autre source) au lieu d'un bandeau a posteriori | ★★ | S | `doublons.js` existe |
| **FEA-23** | **Rétrospective annuelle** partageable (image) : séries, chapitres, heures de lecture (`reading_time` est collecté) | ★ | M | `stats.html` existe |

### 15.5 Appareils, distribution, écosystème

| ID | Fonctionnalité | Impact | Effort | Prérequis |
|---|---|:-:|:-:|---|
| **FEA-24** | **Android : raccourcis d'application** (appui long sur l'icône : Reprendre, Bibliothèque, Rechercher) et **cible de partage** (« Ouvrir dans Inko » depuis un lien de série) — le widget « Reprendre » existe déjà | ★★ | M | |
| **FEA-25** | **Zone de notification + lancement avec Windows + scan en arrière-plan** (notification native « 3 nouveaux chapitres ») | ★★★ | M | DSK-05, UPD-09 |
| **FEA-26** | **macOS et Linux** (`.dmg`, AppImage, `.deb`), Steam Deck | ★★ | L | DSK-04 |
| **FEA-27** | **Distribution Android** : F-Droid et/ou Google Play | ★★ | L | MOB-04 |
| **FEA-28** | **Serveur OPDS** : exposer la bibliothèque téléchargée/locale à KOReader, Moon+, Librera | ★★ | M | |
| **FEA-29** | **Import depuis Mihon / Tachiyomi** (sauvegarde `.tachibk`) : *le* chemin de migration des lecteurs Android de manga | ★★★ | M | vérifier `import.html` / `import-listes.js` |
| **FEA-30** | **Notifications sortantes** (webhook, ntfy, Gotify) pour les auto-hébergeurs | ★ | S | |
| **FEA-31** | **Profils locaux** sur un même PC (PIN, contenu adulte par profil) | ★ | L | |
| **FEA-32** | **Page `/api/docs`** (Redoc) + **SDK d'extension** (`extension.d.ts`, `new-extension`, `ext:record`, `ext:try`) | ★★ | M | EXT-09, EXT-14 |

### 15.6 Les trois qui valent d'abord

1. **FEA-01 + FEA-02 + FEA-03** — la corbeille, l'annulation, la restauration guidée : *ne plus jamais vivre le §3.1*.
2. **FEA-07 + FEA-09** — la bascule de source et le tableau de santé : transformer les pannes de sources en non-événements.
3. **FEA-13 + FEA-25** — le téléchargement intelligent et le scan en arrière-plan avec notification : ce qui fait passer d'un *lecteur* à un *compagnon de suivi*.
