## 6. Page par page, bouton par bouton

> **Méthode.** Chaque page a été ouverte dans un vrai navigateur (bureau 1 366 × 800 et mobile 390 × 844), sur un serveur et une base **jetables** garnis de 36 séries d'essai. Pour chaque contrôle visible (lien, bouton, onglet, case, champ, menu) : mesure de sa taille et de son **nom accessible**, test de **recouvrement** (qu'y a-t-il vraiment au point où l'on clique ?), puis **clic réel à la souris** — dédoublonné par famille, 2 par famille au plus — avec relevé de l'effet : navigation, modification du DOM, fenêtre, requêtes, **erreurs JavaScript**, **requêtes en échec**. Les pages à paramètres (série, lecteur, liste) sont ouvertes avec une œuvre **réelle**.
>
> **25 pages** explorées. L'inventaire complet — *chaque* contrôle, son effet — est dans `docs/audit/INVENTAIRE-CONTROLES.md` (généré).

### Synthèse

| | Total |
|---|---:|
| Contrôles visibles (bureau) | **1279** |
| Contrôles cliqués | **483** |
| Sans aucun effet | 26 |
| Qui lèvent une erreur JavaScript | 0 |
| Qui déclenchent une requête en échec | 2 |
| Recouverts | 2 |

### Ce que le peigne fin établit

1. **Les contrôles répondent.** Sur 483 clics réels : **0 erreur JavaScript**. La sonde signale 26 contrôle(s) sans effet et 2 recouvert(s) ; un échantillon rejoué à la main (navigation, reprise de lecture, import, téléchargements) répond normalement : ces relevés sont écartés (`triage.js`). La couche d'interaction n'est pas le problème.
2. **Le défaut est ailleurs : le moment où les contrôles deviennent actifs.** La bibliothèque ignore tous les clics pendant **7 à 20 s** (quatre essais : 7,3 / 7,7 / 8,1 / 20,4 s) (écouteurs branchés après l'attente réseau — §3.3, `UPD-01`) ; la même structure existe dans le **Journal** (`notes.js:22`) et le **lecteur de romans** (`lecture.js:118`). Les sondes statiques et dynamiques s'accordent.
3. **« Aléatoire » est un lien vers `#` sur 26 pages** (`A11Y-13`) : un seul gabarit d'en-tête à corriger.
4. **Les boutons d'en-tête (Musique, Notifications) mesurent 30 × 30 px** sur toutes les pages (`A11Y-10`).
5. **2 clics déclenchent une requête en échec** — tous vers des sources mortes (SushiScan, Royal Road, MangaDex sur des œuvres d'essai) : **l'application n'a aucun repli** et l'erreur est visible (EXT-11). Ce décompte dépend de l'état des sources au moment de l'essai.
6. **Le dock musique ouvert recouvre 40 % de la fenêtre, persiste d'une page à l'autre et se superpose aux astuces** (`UX-07`) — constaté en direct, capture à l'appui.
7. **Le navigateur appelle directement des tiers** : couvertures AniList (372 requêtes), GraphQL AniList (49), API YouTube (363, lecture musique reprise), GitHub (`SEC-13`).
8. **Limites de la méthode** : les contrôles **mobiles** sont inspectés (taille, nom, recouvrement) mais **non cliqués** ; les pages à paramètres ne sont explorées que si la source d'essai répond ; les dialogues ouverts sont fermés, pas parcourus ; les **gestes** (balayage, appui long, pincement) et le **clavier du lecteur** relèvent de tests e2e dédiés.

### accueil.html — Accueil

Tableau de bord : **reprendre la lecture**, nouveautés, recommandations, raccourcis. Première page vue.

| | Bureau | Mobile |
|---|---:|---:|
| Contrôles visibles | 37 | 52 |
| Contrôles cliqués | 7 | — |
| Requêtes API | 42 | 39 |
| Décalage de mise en page (CLS) | 0.334 | 0.026 |
| Nœuds DOM | 653 | 654 |
| Tâches longues (ms) | 91 | 65 |

**Fonctionnalités de la page** : Bouton « Continuer » · Rangées de séries (en cours, nouveautés) · Carrousel / héros · Accès rapides.

**Résultat des clics** : 1 / 7 produisent un effet, **6 sans aucun effet**.

**Contrôles sans effet au clic** :

- « Inko » ne produit aucun effet visible au clic — _a 61×28 · aucun changement du DOM, aucune requête, aucune fenêtre_
- « Accueil » ne produit aucun effet visible au clic — _a 68×32 · aucun changement du DOM, aucune requête, aucune fenêtre_
- « Catalogue » ne produit aucun effet visible au clic — _a 84×32 · aucun changement du DOM, aucune requête, aucune fenêtre_
- « Bibliothèque » ne produit aucun effet visible au clic — _a 100×32 · aucun changement du DOM, aucune requête, aucune fenêtre_
- « Aléatoire » ne produit aucun effet visible au clic — _a 78×32 · aucun changement du DOM, aucune requête, aucune fenêtre_
- « Sources » ne produit aucun effet visible au clic — _a 72×32 · aucun changement du DOM, aucune requête, aucune fenêtre_

**Autres constats sur cette page**

| | Constat | Origine |
|---|---|---|
| 🟠 | accueil.html : exception JavaScript quand réponses illisibles (portail captif) | `CHAOS-EXCEPTION` |
| 🟠 | accueil.html : chargement qui ne s'arrête pas quand réponses illisibles (portail captif) | `CHAOS-ATTENTE-SANS-FIN` |
| 🟠 | accueil.html à 320 px : défilement horizontal de 39 px | `LARGEUR-DEBORDE` |
| 🟠 | accueil.html en anglais : 13 texte(s) encore en français | `ANGLAIS-RESTE-FRANCAIS` |
| 🟠 | accueil.html (bureau) : décalage de mise en page CLS = 0.33 | `PAGE-CLS` |
| 🟠 | accueil.html : 6 cible(s) tactile(s) sous 24 px (minimum WCAG 2.2) | `MOB-CIBLE-24` |
| 🟡 | accueil.html : 16 scripts sans defer (parse bloquant) | `PERF-SCRIPTS-BLOQUANTS` |
| 🟡 | accueil.html : valeur manquante affichée telle quelle (réponses illisibles (portail captif)) | `CHAOS-VALEUR-BRUTE` |
| 🟡 | accueil.html (bureau) : 1 erreur(s) console | `PAGE-ERREUR-CONSOLE` |
| 🟡 | accueil.html (bureau) : 1 requête(s) en échec | `PAGE-RESEAU-KO` |
| 🟡 | accueil.html (mobile) : 1 erreur(s) console | `PAGE-ERREUR-CONSOLE` |
| 🟡 | accueil.html (mobile) : 1 requête(s) en échec | `PAGE-RESEAU-KO` |
| 🟡 | accueil.html : 31 cible(s) entre 24 et 40 px | `MOB-CIBLE-40` |
| 🟡 | accueil.html en paysage : les barres fixes prennent 194 px sur 390 | `MOB-PAYSAGE-BARRES` |

### index.html — Racine

Page de **redirection** (`<meta http-equiv="refresh">` vers `accueil.html`, 1,6 Ko) pour les serveurs statiques qui n'ont pas d'`index` configuré. Les mesures ci-dessous sont celles de **l'accueil après redirection**.

| | Bureau | Mobile |
|---|---:|---:|
| Contrôles visibles | 51 | 53 |
| Contrôles cliqués | 26 | — |
| Requêtes API | 67 | 55 |
| Décalage de mise en page (CLS) | 0.334 | 0.167 |
| Nœuds DOM | 653 | 654 |
| Tâches longues (ms) | 0 | 103 |

**Fonctionnalités de la page** : Redirection immédiate vers l'accueil · Repère minimal sans JavaScript.

**Résultat des clics** : 22 / 26 produisent un effet, **4 sans aucun effet**.

**Contrôles sans effet au clic** :

- « Inko » ne produit aucun effet visible au clic — _a 61×28 · aucun changement du DOM, aucune requête, aucune fenêtre_
- « Lecteur » ne produit aucun effet visible au clic — _a 98×32 · aucun changement du DOM, aucune requête, aucune fenêtre_
- « 0 chapters read » ne produit aucun effet visible au clic — _a 91×17 · aucun changement du DOM, aucune requête, aucune fenêtre_
- « 0 Chapters this month » ne produit aucun effet visible au clic — _a 129×17 · aucun changement du DOM, aucune requête, aucune fenêtre_

**Autres constats sur cette page**

| | Constat | Origine |
|---|---|---|
| 🟠 | index.html à 320 px : défilement horizontal de 39 px | `LARGEUR-DEBORDE` |
| 🟠 | index.html en anglais : 14 texte(s) encore en français | `ANGLAIS-RESTE-FRANCAIS` |
| 🟠 | index.html (bureau) : décalage de mise en page CLS = 0.33 | `PAGE-CLS` |
| 🟡 | index.html (bureau) : 18 erreur(s) console | `PAGE-ERREUR-CONSOLE` |
| 🟡 | index.html (bureau) : 2 requête(s) en échec | `PAGE-RESEAU-KO` |
| 🟡 | index.html (mobile) : 9 erreur(s) console | `PAGE-ERREUR-CONSOLE` |
| 🟡 | index.html (mobile) : 2 requête(s) en échec | `PAGE-RESEAU-KO` |
| 🟡 | index.html (mobile) : décalage de mise en page CLS = 0.17 | `PAGE-CLS` |
| 🔵 | Pas de lien d'évitement (« Aller au contenu ») | `A11Y-LIEN-EVITEMENT` |
| 🔵 | index.html : lien « Random » sans destination (#) | `LIEN-VIDE` |
| 🔵 | index.html : 32 cibles tactiles trop petites (< 32 px) | `BTN-CIBLE-PETITE` |
| 🔵 | index.html : 4 lecture(s) d'API demandée(s) plusieurs fois | `NET-DOUBLON` |

### bibliotheque.html — Bibliothèque

La bibliothèque personnelle : séries suivies, statuts, catégories, mises à jour, signets, téléchargements.

| | Bureau | Mobile |
|---|---:|---:|
| Contrôles visibles | 75 | 142 |
| Contrôles cliqués | 9 | — |
| Requêtes API | 96 | 78 |
| Décalage de mise en page (CLS) | 0.17 | 0.081 |
| Nœuds DOM | 793 | 794 |
| Tâches longues (ms) | 72 | 76 |

**Fonctionnalités de la page** : Onglets Bibliothèque / Mises à jour / Signets / Téléchargements · Recherche locale, filtres, tri · Grille / liste · Mode « Sélectionner » (statut, catégorie, retrait en masse) · **Mettre à jour** (scan des nouveaux chapitres) · Menu « … » (export CSV/JSON, import) · Catégories · Aléatoire.

**Résultat des clics** : 8 / 9 produisent un effet, **1 sans aucun effet**.

**Contrôles sans effet au clic** :

- « Catalogue » ne produit aucun effet visible au clic — _a 84×32 · aucun changement du DOM, aucune requête, aucune fenêtre_

**Autres constats sur cette page**

| | Constat | Origine |
|---|---|---|
| 🔴 | bibliotheque.html : la donnée « favori.id » est injectée comme HTML et EXÉCUTÉE | `XSS-INJECTION` |
| 🟠 | bibliotheque.html : exception JavaScript quand réponses illisibles (portail captif) | `CHAOS-EXCEPTION` |
| 🟠 | bibliotheque.html : chargement qui ne s'arrête pas quand réponses illisibles (portail captif) | `CHAOS-ATTENTE-SANS-FIN` |
| 🟠 | bibliotheque.html : chargement qui ne s'arrête pas quand réseau coupé | `CHAOS-ATTENTE-SANS-FIN` |
| 🟠 | bibliotheque.html (thème clair) : aria-required-children × 1 | `CLAIR-AXE-ARIA-REQUIRED-CHILDREN` |
| 🟠 | bibliotheque.html : axe « aria-required-children » (critical) × 1 | `AXE-ARIA-REQUIRED-CHILDREN` |
| 🟠 | bibliotheque.html : axe « color-contrast » (serious) × 2 | `AXE-COLOR-CONTRAST` |
| 🟠 | bibliotheque.html avec 2000 favoris : 26 577 éléments dans la page | `VOL-DOM` |
| 🟠 | bibliotheque.html avec 10000 favoris : 46 448 éléments dans la page | `VOL-DOM` |
| 🟠 | bibliotheque.html : en bas de page, des contrôles restent sous la barre fixe | `MOB-BARRE-MASQUE` |
| 🟡 | Bouton à icône sans nom accessible | `A11Y-BOUTON-MUET` |
| 🟡 | bibliotheque.html : 17 scripts sans defer (parse bloquant) | `PERF-SCRIPTS-BLOQUANTS` |
| 🟡 | bibliotheque.html : rien ne dit à l'utilisateur que réponses illisibles (portail captif) | `CHAOS-SILENCE` |
| 🟡 | bibliotheque.html : rien ne dit à l'utilisateur que réseau coupé | `CHAOS-SILENCE` |

### catalogue.html — Catalogue

Découverte par source : populaires, dernières sorties, genres, filtres, collections.

| | Bureau | Mobile |
|---|---:|---:|
| Contrôles visibles | 150 | 64 |
| Contrôles cliqués | 44 | — |
| Requêtes API | 70 | 64 |
| Décalage de mise en page (CLS) | 0.73 | 0 |
| Nœuds DOM | 794 | 795 |
| Tâches longues (ms) | 189 | 70 |

**Fonctionnalités de la page** : Choix de la source · Recherche, filtres de statut/langue/note · Genres · Cartes avec ajout rapide à la bibliothèque · Listes mises en avant.

**Résultat des clics** : 40 / 44 produisent un effet, **4 sans aucun effet**.

**Contrôles sans effet au clic** :

- « Inko » ne produit aucun effet visible au clic — _a 61×28 · aucun changement du DOM, aucune requête, aucune fenêtre_
- « Accueil » ne produit aucun effet visible au clic — _a 68×32 · aucun changement du DOM, aucune requête, aucune fenêtre_
- « Catalogue » ne produit aucun effet visible au clic — _a 85×32 · aucun changement du DOM, aucune requête, aucune fenêtre_
- « Bibliothèque » ne produit aucun effet visible au clic — _a 100×32 · aucun changement du DOM, aucune requête, aucune fenêtre_

**Autres constats sur cette page**

| | Constat | Origine |
|---|---|---|
| 🟠 | catalogue.html en anglais : 32 texte(s) encore en français | `ANGLAIS-RESTE-FRANCAIS` |
| 🟠 | catalogue.html (bureau) : décalage de mise en page CLS = 0.73 | `PAGE-CLS` |
| 🟠 | catalogue.html : 35 cible(s) tactile(s) sous 24 px (minimum WCAG 2.2) | `MOB-CIBLE-24` |
| 🟡 | catalogue.html : 14 scripts sans defer (parse bloquant) | `PERF-SCRIPTS-BLOQUANTS` |
| 🟡 | catalogue.html : valeur manquante affichée telle quelle (réponses illisibles (portail captif)) | `CHAOS-VALEUR-BRUTE` |
| 🟡 | catalogue.html (bureau) : 24 erreur(s) console | `PAGE-ERREUR-CONSOLE` |
| 🟡 | catalogue.html (mobile) : 21 erreur(s) console | `PAGE-ERREUR-CONSOLE` |
| 🟡 | catalogue.html : 2418 Ko à analyser au chargement | `NET-POIDS` |
| 🟡 | catalogue.html : 15 cible(s) entre 24 et 40 px | `MOB-CIBLE-40` |
| 🟡 | catalogue.html : 2 champ(s) sous 16 px, qui font zoomer l'écran sur iOS | `MOB-ZOOM-SAISIE` |
| 🟡 | catalogue.html en paysage : les barres fixes prennent 194 px sur 390 | `MOB-PAYSAGE-BARRES` |
| 🟡 | catalogue.html en contraste forcé : on ne voit plus quel choix est actif | `ADA-FORCE-ETAT` |
| 🔵 | catalogue.html : lien « Aléatoire » sans destination (#) | `LIEN-VIDE` |
| 🔵 | catalogue.html : 39 cibles tactiles trop petites (< 32 px) | `BTN-CIBLE-PETITE` |

### recherche.html — Recherche

Recherche **sur toutes les sources** à la fois, avec filtres et résultats locaux.

| | Bureau | Mobile |
|---|---:|---:|
| Contrôles visibles | 71 | 52 |
| Contrôles cliqués | 35 (tronqué) | — |
| Requêtes API | 63 | 60 |
| Décalage de mise en page (CLS) | 0.561 | 0.306 |
| Nœuds DOM | 317 | 317 |
| Tâches longues (ms) | 77 | 91 |

**Fonctionnalités de la page** : Champ de recherche + filtres · Résultats groupés par source · Résultats de la bibliothèque locale.

**Résultat des clics** : 33 / 35 produisent un effet, **2 sans aucun effet**.

**Contrôles sans effet au clic** :

- « Inko » ne produit aucun effet visible au clic — _a 61×28 · aucun changement du DOM, aucune requête, aucune fenêtre_
- « Home » ne produit aucun effet visible au clic — _a 59×32 · aucun changement du DOM, aucune requête, aucune fenêtre_

**Autres constats sur cette page**

| | Constat | Origine |
|---|---|---|
| 🟠 | recherche.html : chargement qui ne s'arrête pas quand réseau coupé | `CHAOS-ATTENTE-SANS-FIN` |
| 🟠 | recherche.html : chargement qui ne s'arrête pas quand API en erreur 500 | `CHAOS-ATTENTE-SANS-FIN` |
| 🟠 | recherche.html : erreur serveur sur un compte tout neuf | `VIDE-5XX` |
| 🟠 | recherche.html à 320 px : défilement horizontal de 42 px | `LARGEUR-DEBORDE` |
| 🟠 | recherche.html (thème clair) : color-contrast × 113 | `CLAIR-AXE-COLOR-CONTRAST` |
| 🟠 | recherche.html en anglais : 52 texte(s) encore en français | `ANGLAIS-RESTE-FRANCAIS` |
| 🟠 | recherche.html (bureau) : décalage de mise en page CLS = 0.56 | `PAGE-CLS` |
| 🟠 | recherche.html (mobile) : décalage de mise en page CLS = 0.31 | `PAGE-CLS` |
| 🟠 | recherche.html : 1 cible(s) tactile(s) sous 24 px (minimum WCAG 2.2) | `MOB-CIBLE-24` |
| 🟠 | recherche.html : saisie dans « headerSearch » → erreur serveur | `SAISIE-5XX` |
| 🟡 | recherche.html : 10 scripts sans defer (parse bloquant) | `PERF-SCRIPTS-BLOQUANTS` |
| 🟡 | recherche.html : rien ne dit à l'utilisateur que réseau coupé | `CHAOS-SILENCE` |
| 🟡 | recherche.html : valeur manquante affichée telle quelle (réponses illisibles (portail captif)) | `CHAOS-VALEUR-BRUTE` |
| 🟡 | recherche.html : rien ne dit à l'utilisateur que API en erreur 500 | `CHAOS-SILENCE` |

### serie.html — Fiche d'une série

Fiche : couverture, synopsis, genres, **liste des chapitres**, progression, statut, note, ajout en bibliothèque, téléchargement, notes.

| | Bureau | Mobile |
|---|---:|---:|
| Contrôles visibles | 88 | 65 |
| Contrôles cliqués | 9 | — |
| Requêtes API | 42 | 39 |
| Décalage de mise en page (CLS) | 0.103 | 0 |
| Nœuds DOM | 198 | 198 |
| Tâches longues (ms) | 135 | 111 |

**Fonctionnalités de la page** : Ajouter / retirer des favoris · Statut et note · Liste des chapitres (lu / non lu, signets, téléchargement) · Continuer / Commencer · Chapitres sur d'autres sources (`chapitresAilleurs`) · « À lire ensuite ».

**Résultat des clics** : 7 / 9 produisent un effet, **2 sans aucun effet**, **2 déclenchent une requête en échec**.

**Contrôles sans effet au clic** :

- « Home » ne produit aucun effet visible au clic — _a 59×32 · aucun changement du DOM, aucune requête, aucune fenêtre_
- « Resume my last read » ne produit aucun effet visible au clic — _button 34×34 · aucun changement du DOM, aucune requête, aucune fenêtre_

**Clics qui déclenchent une requête en échec** :

- clic sur « Sources » → requête en échec (502 GET /api/sources/royalroad/mangas/search) — _502 GET /api/sources/royalroad/mangas/search_
- clic sur « Resume my last read » → requête en échec (502 GET /api/sources/royalroad/mangas/search) — _502 GET /api/sources/royalroad/mangas/search_

**Autres constats sur cette page**

| | Constat | Origine |
|---|---|---|
| 🟠 | serie.html : page quasi blanche quand API lente (14 s) | `CHAOS-PAGE-BLANCHE` |
| 🟠 | serie.html : 11 cible(s) tactile(s) sous 24 px (minimum WCAG 2.2) | `MOB-CIBLE-24` |
| 🟠 | serie.html : saisie dans « headerSearch » → erreur serveur | `SAISIE-5XX` |
| 🟡 | <title> absent ou vide | `A11Y-TITRE` |
| 🟡 | serie.html : 15 scripts sans defer (parse bloquant) | `PERF-SCRIPTS-BLOQUANTS` |
| 🟡 | serie.html : rien ne dit à l'utilisateur que réponses illisibles (portail captif) | `CHAOS-SILENCE` |
| 🟡 | serie.html : 1 texte(s) peu lisible(s) avec l'accent #22c55e (sombre) | `ACCENT-CONTRASTE` |
| 🟡 | serie.html : 1 texte(s) peu lisible(s) avec l'accent #22c55e (clair) | `ACCENT-CONTRASTE` |
| 🟡 | serie.html : 1 texte(s) peu lisible(s) avec l'accent #ec4899 (sombre) | `ACCENT-CONTRASTE` |
| 🟡 | serie.html : 1 texte(s) peu lisible(s) avec l'accent #ec4899 (clair) | `ACCENT-CONTRASTE` |
| 🟡 | serie.html : 1 texte(s) peu lisible(s) avec l'accent #ef4444 (sombre) | `ACCENT-CONTRASTE` |
| 🟡 | serie.html : 1 texte(s) peu lisible(s) avec l'accent #ef4444 (clair) | `ACCENT-CONTRASTE` |
| 🟡 | serie.html : 1 texte(s) peu lisible(s) avec l'accent #06b6d4 (sombre) | `ACCENT-CONTRASTE` |
| 🟡 | serie.html : 1 texte(s) peu lisible(s) avec l'accent #06b6d4 (clair) | `ACCENT-CONTRASTE` |

### chapitre.html — Lecteur de manga

Lecteur : **pages, défilement, double page**, zoom, gestes, clavier, préchargement, reprise, commentaires, téléchargement.

| | Bureau | Mobile |
|---|---:|---:|
| Contrôles visibles | 25 | 31 |
| Contrôles cliqués | 2 | — |
| Requêtes API | 41 | 37 |
| Décalage de mise en page (CLS) | 0.017 | 0 |
| Nœuds DOM | 168 | 167 |
| Tâches longues (ms) | 165 | 80 |

**Fonctionnalités de la page** : Modes de lecture (page/défilement/double, RTL/LTR) · Zoom et ajustement · Chapitre précédent/suivant · Gestes et zones tactiles · Raccourcis clavier · Commentaires · Mode une main.

**Résultat des clics** : 1 / 2 produisent un effet, **1 recouverts**.

**Contrôles recouverts (le clic n'atteint pas le bouton)** :

- « Téléchargements » ne répond pas au clic — recouvert par div#readerPagesArea.reader-pages-area — _fond rgba(0, 0, 0, 0), opacité 1, position relative, z-index auto_

**Autres constats sur cette page**

| | Constat | Origine |
|---|---|---|
| 🟠 | chapitre.html : 2 cible(s) tactile(s) sous 24 px (minimum WCAG 2.2) | `MOB-CIBLE-24` |
| 🟡 | <title> absent ou vide | `A11Y-TITRE` |
| 🟡 | chapitre.html : 18 scripts sans defer (parse bloquant) | `PERF-SCRIPTS-BLOQUANTS` |
| 🟡 | chapitre.html : 18 cible(s) entre 24 et 40 px | `MOB-CIBLE-40` |
| 🟡 | chapitre.html : 1 champ(s) sous 16 px, qui font zoomer l'écran sur iOS | `MOB-ZOOM-SAISIE` |
| 🟡 | chapitre.html : 8 élément(s) cliquable(s) impossibles à atteindre au clavier | `CLAVIER-INATTEIGNABLE` |
| 🟡 | chapitre.html : « Plus d'actions » — 1 défaut(s) d'accessibilité | `FENETRE-AXE` |
| 🔵 | Pas de lien d'évitement (« Aller au contenu ») | `A11Y-LIEN-EVITEMENT` |
| 🔵 | chapitre.html : 8 cibles tactiles trop petites (< 32 px) | `BTN-CIBLE-PETITE` |
| 🔵 | chapitre.html : texte sous 11 px | `MOB-TEXTE-MINUSCULE` |

### lecture.html — Lecteur de romans

Lecteur de texte : police, taille, thème, table des matières, synthèse vocale, notes.

| | Bureau | Mobile |
|---|---:|---:|
| Contrôles visibles | 39 | 26 |
| Contrôles cliqués | 32 | — |
| Requêtes API | 36 | 33 |
| Décalage de mise en page (CLS) | 0.034 | 0 |
| Nœuds DOM | 149 | 148 |
| Tâches longues (ms) | 62 | 146 |

**Fonctionnalités de la page** : Typographie et thème · Table des matières · Synthèse vocale · Surlignage / notes · Chapitre suivant.

**Résultat des clics** : 32 / 32 produisent un effet.

**Autres constats sur cette page**

| | Constat | Origine |
|---|---|---|
| 🟠 | lecture.html : axe « color-contrast » (serious) × 1 | `AXE-COLOR-CONTRAST` |
| 🟠 | lecture.html : 1 cible(s) tactile(s) sous 24 px (minimum WCAG 2.2) | `MOB-CIBLE-24` |
| 🟠 | lecture.html : saisie dans « headerSearch » → erreur serveur | `SAISIE-5XX` |
| 🟡 | <title> absent ou vide | `A11Y-TITRE` |
| 🟡 | lecture.html : 11 scripts sans defer (parse bloquant) | `PERF-SCRIPTS-BLOQUANTS` |
| 🟡 | lecture.html : 16 cible(s) entre 24 et 40 px | `MOB-CIBLE-40` |
| 🟡 | lecture.html : 1 champ(s) sous 16 px, qui font zoomer l'écran sur iOS | `MOB-ZOOM-SAISIE` |
| 🟡 | lecture.html en paysage : les barres fixes prennent 191 px sur 390 | `MOB-PAYSAGE-BARRES` |
| 🔵 | Aucun <h1> dans le HTML statique (peut être rendu en JS) | `A11Y-H1` |
| 🔵 | Pas de lien d'évitement (« Aller au contenu ») | `A11Y-LIEN-EVITEMENT` |
| 🔵 | lecture.html : lien « Random » sans destination (#) | `LIEN-VIDE` |
| 🔵 | lecture.html : 5 cibles tactiles trop petites (< 32 px) | `BTN-CIBLE-PETITE` |
| 🔵 | lecture.html : un texte long dans « headerSearch » élargit la page de 1518 px | `SAISIE-DEBORDE` |

### localreader.html — Lecteur de fichiers locaux

Lecture d'un **fichier importé** (EPUB, PDF, CBZ).

| | Bureau | Mobile |
|---|---:|---:|
| Contrôles visibles | 3 | 3 |
| Contrôles cliqués | 3 | — |
| Requêtes API | 16 | 14 |
| Décalage de mise en page (CLS) | 0 | 0 |
| Nœuds DOM | 39 | 39 |
| Tâches longues (ms) | 0 | 0 |

**Fonctionnalités de la page** : Navigation par page / chapitre · Synthèse vocale · Polices et thèmes.

**Résultat des clics** : 3 / 3 produisent un effet.

**Autres constats sur cette page**

| | Constat | Origine |
|---|---|---|
| 🟠 | localreader.html : 1 cible(s) tactile(s) sous 24 px (minimum WCAG 2.2) | `MOB-CIBLE-24` |
| 🟡 | localreader.html : 6 scripts sans defer (parse bloquant) | `PERF-SCRIPTS-BLOQUANTS` |
| 🟡 | localreader.html en anglais : 1 texte(s) encore en français | `ANGLAIS-RESTE-FRANCAIS` |
| 🟡 | localreader.html : rien ne dit qu'on est hors ligne | `HL-SILENCE` |
| 🔵 | Pas de lien d'évitement (« Aller au contenu ») | `A11Y-LIEN-EVITEMENT` |
| 🔵 | localreader.html à 320 px : texte coupé sans points de suspension | `LARGEUR-TEXTE-COUPE` |
| 🔵 | localreader.html à 360 px : texte coupé sans points de suspension | `LARGEUR-TEXTE-COUPE` |
| 🔵 | localreader.html à 768 px : texte coupé sans points de suspension | `LARGEUR-TEXTE-COUPE` |
| 🔵 | localreader.html à 1024 px : texte coupé sans points de suspension | `LARGEUR-TEXTE-COUPE` |
| 🔵 | localreader.html à 1920 px : texte coupé sans points de suspension | `LARGEUR-TEXTE-COUPE` |

### import.html — Import de fichiers

Import d'**EPUB / PDF / CBZ** vers la bibliothèque locale (glisser-déposer).

| | Bureau | Mobile |
|---|---:|---:|
| Contrôles visibles | 40 | 21 |
| Contrôles cliqués | 16 | — |
| Requêtes API | 36 | 33 |
| Décalage de mise en page (CLS) | 0.062 | 0 |
| Nœuds DOM | 211 | 210 |
| Tâches longues (ms) | 89 | 86 |

**Fonctionnalités de la page** : Zone de dépôt · File d'import · Liste des importés.

**Résultat des clics** : 15 / 16 produisent un effet, **1 recouverts**.

**Contrôles recouverts (le clic n'atteint pas le bouton)** :

- « Import a file » ne répond pas au clic — recouvert par div.mh-etat-vide — _fond rgba(0, 0, 0, 0), opacité 1, position static, z-index auto_

**Autres constats sur cette page**

| | Constat | Origine |
|---|---|---|
| 🟠 | import.html : en bas de page, des contrôles restent sous la barre fixe | `MOB-BARRE-MASQUE` |
| 🟠 | import.html : saisie dans « headerSearch » → erreur serveur | `SAISIE-5XX` |
| 🟡 | import.html : 10 scripts sans defer (parse bloquant) | `PERF-SCRIPTS-BLOQUANTS` |
| 🟡 | import.html en anglais : 5 texte(s) encore en français | `ANGLAIS-RESTE-FRANCAIS` |
| 🟡 | import.html : 6 cible(s) entre 24 et 40 px | `MOB-CIBLE-40` |
| 🟡 | import.html en paysage : les barres fixes prennent 194 px sur 390 | `MOB-PAYSAGE-BARRES` |
| 🟡 | import.html : le focus passe sur 1 élément(s) invisible(s) | `CLAVIER-FOCUS-CACHE` |
| 🟡 | import.html : rien ne dit qu'on est hors ligne | `HL-SILENCE` |
| 🔵 | Pas de lien d'évitement (« Aller au contenu ») | `A11Y-LIEN-EVITEMENT` |
| 🔵 | import.html : lien « Random » sans destination (#) | `LIEN-VIDE` |
| 🔵 | import.html : 1 lecture(s) d'API demandée(s) plusieurs fois | `NET-DOUBLON` |
| 🔵 | import.html : 62 % des 643 Ko de JavaScript ne servent pas au chargement | `NET-JS-INUTILE` |
| 🔵 | import.html : un texte long dans « headerSearch » élargit la page de 1518 px | `SAISIE-DEBORDE` |

### downloads.html — Téléchargements

Chapitres **téléchargés pour la lecture hors ligne**, espace utilisé, export CBZ.

| | Bureau | Mobile |
|---|---:|---:|
| Contrôles visibles | 42 | 23 |
| Contrôles cliqués | 6 | — |
| Requêtes API | 37 | 34 |
| Décalage de mise en page (CLS) | 0.057 | 0 |
| Nœuds DOM | 212 | 212 |
| Tâches longues (ms) | 78 | 77 |

**Fonctionnalités de la page** : Liste par série · Suppression / export · Espace de stockage.

**Résultat des clics** : 6 / 6 produisent un effet.

**Autres constats sur cette page**

| | Constat | Origine |
|---|---|---|
| 🟠 | downloads.html : saisie dans « headerSearch » → erreur serveur | `SAISIE-5XX` |
| 🟡 | downloads.html : 12 scripts sans defer (parse bloquant) | `PERF-SCRIPTS-BLOQUANTS` |
| 🟡 | downloads.html en anglais : 4 texte(s) encore en français | `ANGLAIS-RESTE-FRANCAIS` |
| 🟡 | downloads.html : 8 cible(s) entre 24 et 40 px | `MOB-CIBLE-40` |
| 🟡 | downloads.html : 1 champ(s) sous 16 px, qui font zoomer l'écran sur iOS | `MOB-ZOOM-SAISIE` |
| 🟡 | downloads.html en paysage : les barres fixes prennent 194 px sur 390 | `MOB-PAYSAGE-BARRES` |
| 🟡 | downloads.html : le focus passe sur 1 élément(s) invisible(s) | `CLAVIER-FOCUS-CACHE` |
| 🔵 | Pas de lien d'évitement (« Aller au contenu ») | `A11Y-LIEN-EVITEMENT` |
| 🔵 | downloads.html : lien « Random » sans destination (#) | `LIEN-VIDE` |
| 🔵 | downloads.html : 6 cibles tactiles trop petites (< 32 px) | `BTN-CIBLE-PETITE` |
| 🔵 | downloads.html : 3 lecture(s) d'API demandée(s) plusieurs fois | `NET-DOUBLON` |
| 🔵 | downloads.html : 63 % des 693 Ko de JavaScript ne servent pas au chargement | `NET-JS-INUTILE` |
| 🔵 | downloads.html : un texte long dans « headerSearch » élargit la page de 1518 px | `SAISIE-DEBORDE` |

### collections.html — Mes listes

Listes de lecture personnelles (collections), création, filtres de statut.

| | Bureau | Mobile |
|---|---:|---:|
| Contrôles visibles | 44 | 25 |
| Contrôles cliqués | 26 | — |
| Requêtes API | 36 | 33 |
| Décalage de mise en page (CLS) | 0.063 | 0 |
| Nœuds DOM | 256 | 255 |
| Tâches longues (ms) | 103 | 89 |

**Fonctionnalités de la page** : Création de liste · Filtre par statut · Cartes de listes.

**Résultat des clics** : 26 / 26 produisent un effet.

**Autres constats sur cette page**

| | Constat | Origine |
|---|---|---|
| 🟠 | collections.html : exception JavaScript quand réponses illisibles (portail captif) | `CHAOS-EXCEPTION` |
| 🟠 | collections.html : chargement qui ne s'arrête pas quand réponses illisibles (portail captif) | `CHAOS-ATTENTE-SANS-FIN` |
| 🟠 | collections.html : 1 cible(s) tactile(s) sous 24 px (minimum WCAG 2.2) | `MOB-CIBLE-24` |
| 🟠 | collections.html : en bas de page, des contrôles restent sous la barre fixe | `MOB-BARRE-MASQUE` |
| 🟡 | <input> sans label | `A11Y-CHAMP-SANS-LABEL` |
| 🟡 | collections.html : 6 scripts sans defer (parse bloquant) | `PERF-SCRIPTS-BLOQUANTS` |
| 🟡 | collections.html : rien ne dit à l'utilisateur que réponses illisibles (portail captif) | `CHAOS-SILENCE` |
| 🟡 | collections.html en anglais : 3 texte(s) encore en français | `ANGLAIS-RESTE-FRANCAIS` |
| 🟡 | collections.html : 8 cible(s) entre 24 et 40 px | `MOB-CIBLE-40` |
| 🟡 | collections.html en paysage : les barres fixes prennent 194 px sur 390 | `MOB-PAYSAGE-BARRES` |
| 🟡 | collections.html : le focus passe sur 1 élément(s) invisible(s) | `CLAVIER-FOCUS-CACHE` |
| 🔵 | Pas de lien d'évitement (« Aller au contenu ») | `A11Y-LIEN-EVITEMENT` |
| 🔵 | collections.html : lien « Random » sans destination (#) | `LIEN-VIDE` |
| 🔵 | collections.html : 7 cibles tactiles trop petites (< 32 px) | `BTN-CIBLE-PETITE` |

### collection-detail.html — Détail d'une liste

Contenu d'une liste : réordonner, partager (lien public), supprimer.

| | Bureau | Mobile |
|---|---:|---:|
| Contrôles visibles | 47 | 25 |
| Contrôles cliqués | 28 | — |
| Requêtes API | 33 | 30 |
| Décalage de mise en page (CLS) | 0.009 | 0 |
| Nœuds DOM | 178 | 177 |
| Tâches longues (ms) | 125 | 142 |

**Fonctionnalités de la page** : Réordonner · Partager · Retirer une série.

**Résultat des clics** : 28 / 28 produisent un effet.

**Autres constats sur cette page**

| | Constat | Origine |
|---|---|---|
| 🟠 | collection-detail.html : exception JavaScript quand réponses illisibles (portail captif) | `CHAOS-EXCEPTION` |
| 🟠 | collection-detail.html : page quasi blanche quand réponses illisibles (portail captif) | `CHAOS-PAGE-BLANCHE` |
| 🟠 | collection-detail.html : page quasi blanche quand API lente (14 s) | `CHAOS-PAGE-BLANCHE` |
| 🟠 | collection-detail.html (thème clair) : color-contrast × 2 | `CLAIR-AXE-COLOR-CONTRAST` |
| 🟠 | collection-detail.html (thème clair) : link-name × 1 | `CLAIR-AXE-LINK-NAME` |
| 🟠 | collection-detail.html : 2 cible(s) tactile(s) sous 24 px (minimum WCAG 2.2) | `MOB-CIBLE-24` |
| 🟠 | collection-detail.html : en bas de page, des contrôles restent sous la barre fixe | `MOB-BARRE-MASQUE` |
| 🟡 | <title> absent ou vide | `A11Y-TITRE` |
| 🟡 | collection-detail.html : 6 scripts sans defer (parse bloquant) | `PERF-SCRIPTS-BLOQUANTS` |
| 🟡 | collection-detail.html : rien ne dit à l'utilisateur que réponses illisibles (portail captif) | `CHAOS-SILENCE` |
| 🟡 | collection-detail.html à 1024 px : des contrôles se chevauchent | `LARGEUR-CHEVAUCHEMENT` |
| 🟡 | collection-detail.html en anglais : 6 texte(s) encore en français | `ANGLAIS-RESTE-FRANCAIS` |
| 🟡 | collection-detail.html (bureau) : a 155×232 sans nom accessible | `BTN-SANS-NOM` |
| 🟡 | collection-detail.html : 10 cible(s) entre 24 et 40 px | `MOB-CIBLE-40` |

### liste.html — Liste partagée

Vue **publique** d'une liste partagée par lien.

| | Bureau | Mobile |
|---|---:|---:|
| Contrôles visibles | 40 | 21 |
| Contrôles cliqués | 21 | — |
| Requêtes API | 35 | 33 |
| Décalage de mise en page (CLS) | 0.01 | 0 |
| Nœuds DOM | 185 | 184 |
| Tâches longues (ms) | 0 | 127 |

**Fonctionnalités de la page** : Lecture seule.

**Résultat des clics** : 21 / 21 produisent un effet.

**Autres constats sur cette page**

| | Constat | Origine |
|---|---|---|
| 🟠 | liste.html : page quasi blanche quand API lente (14 s) | `CHAOS-PAGE-BLANCHE` |
| 🟠 | liste.html : 1 cible(s) tactile(s) sous 24 px (minimum WCAG 2.2) | `MOB-CIBLE-24` |
| 🟡 | liste.html : 9 scripts sans defer (parse bloquant) | `PERF-SCRIPTS-BLOQUANTS` |
| 🟡 | liste.html en anglais : 4 texte(s) encore en français | `ANGLAIS-RESTE-FRANCAIS` |
| 🟡 | liste.html : 5 cible(s) entre 24 et 40 px | `MOB-CIBLE-40` |
| 🟡 | liste.html en paysage : les barres fixes prennent 194 px sur 390 | `MOB-PAYSAGE-BARRES` |
| 🟡 | liste.html : le focus passe sur 1 élément(s) invisible(s) | `CLAVIER-FOCUS-CACHE` |
| 🔵 | Aucun <h1> dans le HTML statique (peut être rendu en JS) | `A11Y-H1` |
| 🔵 | Pas de lien d'évitement (« Aller au contenu ») | `A11Y-LIEN-EVITEMENT` |
| 🔵 | liste.html : lien « Random » sans destination (#) | `LIEN-VIDE` |
| 🔵 | liste.html : 1 lecture(s) d'API demandée(s) plusieurs fois | `NET-DOUBLON` |
| 🔵 | liste.html : un texte long dans « headerSearch » élargit la page de 1518 px | `SAISIE-DEBORDE` |

### notes.html — Journal de lecture

Notes et citations de lecture, humeurs, filtres par série/type, épinglage.

| | Bureau | Mobile |
|---|---:|---:|
| Contrôles visibles | 49 | 31 |
| Contrôles cliqués | 25 | — |
| Requêtes API | 42 | 39 |
| Décalage de mise en page (CLS) | 0.035 | 0.011 |
| Nœuds DOM | 239 | 238 |
| Tâches longues (ms) | 0 | 73 |

**Fonctionnalités de la page** : Création / édition de note · Filtres (humeur, série, type) · Épingles.

**Résultat des clics** : 23 / 25 produisent un effet, **2 sans aucun effet**.

**Contrôles sans effet au clic** :

- « Journal » ne produit aucun effet visible au clic — _a 70×32 · aucun changement du DOM, aucune requête, aucune fenêtre_
- « Random » ne produit aucun effet visible au clic — _a 74×32 · aucun changement du DOM, aucune requête, aucune fenêtre_

**Autres constats sur cette page**

| | Constat | Origine |
|---|---|---|
| 🟠 | notes.html : 1 cible(s) tactile(s) sous 24 px (minimum WCAG 2.2) | `MOB-CIBLE-24` |
| 🟡 | notes.html : 10 scripts sans defer (parse bloquant) | `PERF-SCRIPTS-BLOQUANTS` |
| 🟡 | notes.html : valeur manquante affichée telle quelle (réponses illisibles (portail captif)) | `CHAOS-VALEUR-BRUTE` |
| 🟡 | notes.html : valeur manquante affichée telle quelle (réponses vides) | `CHAOS-VALEUR-BRUTE` |
| 🟡 | notes.html en anglais : 5 texte(s) encore en français | `ANGLAIS-RESTE-FRANCAIS` |
| 🟡 | notes.html : 14 cible(s) entre 24 et 40 px | `MOB-CIBLE-40` |
| 🟡 | notes.html : 1 champ(s) sous 16 px, qui font zoomer l'écran sur iOS | `MOB-ZOOM-SAISIE` |
| 🟡 | notes.html en paysage : les barres fixes prennent 194 px sur 390 | `MOB-PAYSAGE-BARRES` |
| 🟡 | notes.html : le focus passe sur 1 élément(s) invisible(s) | `CLAVIER-FOCUS-CACHE` |
| 🟡 | notes.html (bureau) : un titre hors norme élargit la page de 258 px | `ADA-EXTREME-DEBORDE` |
| 🟡 | notes.html (mobile) : un titre hors norme élargit la page de 1010 px | `ADA-EXTREME-DEBORDE` |
| 🔵 | Pas de lien d'évitement (« Aller au contenu ») | `A11Y-LIEN-EVITEMENT` |
| 🔵 | notes.html : lien « Random » sans destination (#) | `LIEN-VIDE` |
| 🔵 | notes.html : 9 cibles tactiles trop petites (< 32 px) | `BTN-CIBLE-PETITE` |

### notifications.html — Notifications

Nouveaux chapitres, événements, états.

| | Bureau | Mobile |
|---|---:|---:|
| Contrôles visibles | 49 | 30 |
| Contrôles cliqués | 21 | — |
| Requêtes API | 39 | 35 |
| Décalage de mise en page (CLS) | 0.051 | 0.069 |
| Nœuds DOM | 213 | 213 |
| Tâches longues (ms) | 89 | 78 |

**Fonctionnalités de la page** : Liste, marquer comme lu · Activer les notifications.

**Résultat des clics** : 19 / 21 produisent un effet, **2 sans aucun effet**.

**Contrôles sans effet au clic** :

- « Inko » ne produit aucun effet visible au clic — _a 61×28 · aucun changement du DOM, aucune requête, aucune fenêtre_
- « Home » ne produit aucun effet visible au clic — _a 59×32 · aucun changement du DOM, aucune requête, aucune fenêtre_

**Autres constats sur cette page**

| | Constat | Origine |
|---|---|---|
| 🟠 | notifications.html : exception JavaScript quand réponses illisibles (portail captif) | `CHAOS-EXCEPTION` |
| 🟠 | notifications.html : chargement qui ne s'arrête pas quand réponses illisibles (portail captif) | `CHAOS-ATTENTE-SANS-FIN` |
| 🟠 | notifications.html : saisie dans « headerSearch » → erreur serveur | `SAISIE-5XX` |
| 🟡 | notifications.html : 9 scripts sans defer (parse bloquant) | `PERF-SCRIPTS-BLOQUANTS` |
| 🟡 | notifications.html : rien ne dit à l'utilisateur que réponses illisibles (portail captif) | `CHAOS-SILENCE` |
| 🟡 | notifications.html : valeur manquante affichée telle quelle (réponses vides) | `CHAOS-VALEUR-BRUTE` |
| 🟡 | notifications.html à 1024 px : des contrôles se chevauchent | `LARGEUR-CHEVAUCHEMENT` |
| 🟡 | notifications.html en anglais : 7 texte(s) encore en français | `ANGLAIS-RESTE-FRANCAIS` |
| 🟡 | notifications.html : 11 cible(s) entre 24 et 40 px | `MOB-CIBLE-40` |
| 🟡 | notifications.html : 1 champ(s) sous 16 px, qui font zoomer l'écran sur iOS | `MOB-ZOOM-SAISIE` |
| 🟡 | notifications.html en paysage : les barres fixes prennent 194 px sur 390 | `MOB-PAYSAGE-BARRES` |
| 🟡 | notifications.html : le focus passe sur 1 élément(s) invisible(s) | `CLAVIER-FOCUS-CACHE` |
| 🟡 | notifications.html : rien ne dit qu'on est hors ligne | `HL-SILENCE` |
| 🔵 | Pas de lien d'évitement (« Aller au contenu ») | `A11Y-LIEN-EVITEMENT` |

### stats.html — Statistiques

Statistiques de lecture : objectif hebdomadaire, répartition, activité, temps de lecture.

| | Bureau | Mobile |
|---|---:|---:|
| Contrôles visibles | 45 | 26 |
| Contrôles cliqués | 24 | — |
| Requêtes API | 44 | 42 |
| Décalage de mise en page (CLS) | 0.388 | 0.437 |
| Nœuds DOM | 948 | 947 |
| Tâches longues (ms) | 481 | 97 |

**Fonctionnalités de la page** : Objectif hebdomadaire · Répartitions · Activité récente.

**Résultat des clics** : 24 / 24 produisent un effet.

**Autres constats sur cette page**

| | Constat | Origine |
|---|---|---|
| 🟠 | stats.html (thème clair) : color-contrast × 18 | `CLAIR-AXE-COLOR-CONTRAST` |
| 🟠 | stats.html (thème clair) : scrollable-region-focusable × 1 | `CLAIR-AXE-SCROLLABLE-REGION-FOCUSABLE` |
| 🟠 | stats.html en anglais : 427 texte(s) encore en français | `ANGLAIS-RESTE-FRANCAIS` |
| 🟠 | stats.html (bureau) : décalage de mise en page CLS = 0.39 | `PAGE-CLS` |
| 🟠 | stats.html : axe « color-contrast » (serious) × 12 | `AXE-COLOR-CONTRAST` |
| 🟠 | stats.html : axe « scrollable-region-focusable » (serious) × 1 | `AXE-SCROLLABLE-REGION-FOCUSABLE` |
| 🟠 | stats.html (mobile) : décalage de mise en page CLS = 0.44 | `PAGE-CLS` |
| 🟠 | stats.html : saisie dans « headerSearch » → erreur serveur | `SAISIE-5XX` |
| 🟡 | stats.html : 9 scripts sans defer (parse bloquant) | `PERF-SCRIPTS-BLOQUANTS` |
| 🟡 | stats.html : valeur manquante affichée telle quelle (réponses illisibles (portail captif)) | `CHAOS-VALEUR-BRUTE` |
| 🟡 | stats.html : 14 texte(s) peu lisible(s) avec l'accent #22c55e (sombre) | `ACCENT-CONTRASTE` |
| 🟡 | stats.html : 21 texte(s) peu lisible(s) avec l'accent #22c55e (clair) | `ACCENT-CONTRASTE` |
| 🟡 | stats.html : 14 texte(s) peu lisible(s) avec l'accent #ec4899 (sombre) | `ACCENT-CONTRASTE` |
| 🟡 | stats.html : 21 texte(s) peu lisible(s) avec l'accent #ec4899 (clair) | `ACCENT-CONTRASTE` |

### profil.html — Profil

Profil du propriétaire : vue d'ensemble, badges, historique, listes, sources de connexion.

| | Bureau | Mobile |
|---|---:|---:|
| Contrôles visibles | 73 | 55 |
| Contrôles cliqués | 52 | — |
| Requêtes API | 75 | 70 |
| Décalage de mise en page (CLS) | 0.078 | 0 |
| Nœuds DOM | 1296 | 1295 |
| Tâches longues (ms) | 55 | 0 |

**Fonctionnalités de la page** : Vue d'ensemble · Badges · Historique · Comptes liés.

**Résultat des clics** : 52 / 52 produisent un effet.

**Autres constats sur cette page**

| | Constat | Origine |
|---|---|---|
| 🟠 | profil.html (thème clair) : color-contrast × 1 | `CLAIR-AXE-COLOR-CONTRAST` |
| 🟠 | profil.html : 7 cible(s) tactile(s) sous 24 px (minimum WCAG 2.2) | `MOB-CIBLE-24` |
| 🟡 | profil.html : 11 scripts sans defer (parse bloquant) | `PERF-SCRIPTS-BLOQUANTS` |
| 🟡 | profil.html en anglais : 9 texte(s) encore en français | `ANGLAIS-RESTE-FRANCAIS` |
| 🟡 | profil.html (bureau) : 19 erreur(s) console | `PAGE-ERREUR-CONSOLE` |
| 🟡 | profil.html (bureau) : 18 requête(s) en échec | `PAGE-RESEAU-KO` |
| 🟡 | profil.html (mobile) : 17 erreur(s) console | `PAGE-ERREUR-CONSOLE` |
| 🟡 | profil.html (mobile) : 16 requête(s) en échec | `PAGE-RESEAU-KO` |
| 🟡 | profil.html avec 10000 favoris : l'écran se fige 542 ms d'un coup | `VOL-BLOCAGE` |
| 🟡 | profil.html : 18 cible(s) entre 24 et 40 px | `MOB-CIBLE-40` |
| 🟡 | profil.html en paysage : les barres fixes prennent 194 px sur 390 | `MOB-PAYSAGE-BARRES` |
| 🟡 | profil.html : rien ne dit qu'on est hors ligne | `HL-SILENCE` |
| 🔵 | <img> sans width/height ni loading : décalage de mise en page | `PERF-IMG-SANS-DIM` |
| 🔵 | profil.html : lien « Random » sans destination (#) | `LIEN-VIDE` |

### u.html — Profil public

Profil **public** d'un autre utilisateur.

| | Bureau | Mobile |
|---|---:|---:|
| Contrôles visibles | 40 | 21 |
| Contrôles cliqués | 28 | — |
| Requêtes API | 35 | 31 |
| Décalage de mise en page (CLS) | 0.009 | 0 |
| Nœuds DOM | 187 | 186 |
| Tâches longues (ms) | 112 | 0 |

**Fonctionnalités de la page** : Lecture seule.

**Résultat des clics** : 27 / 28 produisent un effet, **1 sans aucun effet**.

**Contrôles sans effet au clic** :

- « Sources » ne produit aucun effet visible au clic — _a 72×32 · aucun changement du DOM, aucune requête, aucune fenêtre_

**Autres constats sur cette page**

| | Constat | Origine |
|---|---|---|
| 🟠 | u.html : exception JavaScript quand réponses illisibles (portail captif) | `CHAOS-EXCEPTION` |
| 🟠 | u.html : chargement qui ne s'arrête pas quand réponses illisibles (portail captif) | `CHAOS-ATTENTE-SANS-FIN` |
| 🟠 | u.html : page quasi blanche quand réponses illisibles (portail captif) | `CHAOS-PAGE-BLANCHE` |
| 🟠 | u.html : page quasi blanche quand réponses vides | `CHAOS-PAGE-BLANCHE` |
| 🟠 | u.html : page quasi blanche quand API lente (14 s) | `CHAOS-PAGE-BLANCHE` |
| 🟠 | u.html (thème clair) : color-contrast × 1 | `CLAIR-AXE-COLOR-CONTRAST` |
| 🟠 | u.html : 1 cible(s) tactile(s) sous 24 px (minimum WCAG 2.2) | `MOB-CIBLE-24` |
| 🟠 | u.html : saisie dans « headerSearch » → erreur serveur | `SAISIE-5XX` |
| 🟡 | u.html : 9 scripts sans defer (parse bloquant) | `PERF-SCRIPTS-BLOQUANTS` |
| 🟡 | u.html : rien ne dit à l'utilisateur que réponses illisibles (portail captif) | `CHAOS-SILENCE` |
| 🟡 | u.html en anglais : 7 texte(s) encore en français | `ANGLAIS-RESTE-FRANCAIS` |
| 🟡 | u.html : 5 cible(s) entre 24 et 40 px | `MOB-CIBLE-40` |
| 🟡 | u.html en paysage : les barres fixes prennent 194 px sur 390 | `MOB-PAYSAGE-BARRES` |
| 🟡 | u.html : le focus passe sur 1 élément(s) invisible(s) | `CLAVIER-FOCUS-CACHE` |

### sources.html — Sources

Extensions : installées, mises à jour, **santé**, **bac à sable** (« Essayer »), activation.

| | Bureau | Mobile |
|---|---:|---:|
| Contrôles visibles | 102 | 80 |
| Contrôles cliqués | 42 | — |
| Requêtes API | 39 | 36 |
| Décalage de mise en page (CLS) | 0.426 | 0 |
| Nœuds DOM | 474 | 473 |
| Tâches longues (ms) | 205 | 72 |

**Fonctionnalités de la page** : Vérifier les mises à jour · Installer / désinstaller / désactiver · Essayer (bac à sable) · Journal et santé par source.

**Résultat des clics** : 42 / 42 produisent un effet.

**Autres constats sur cette page**

| | Constat | Origine |
|---|---|---|
| 🟠 | sources.html (thème clair) : color-contrast × 3 | `CLAIR-AXE-COLOR-CONTRAST` |
| 🟠 | sources.html en anglais : 29 texte(s) encore en français | `ANGLAIS-RESTE-FRANCAIS` |
| 🟠 | sources.html (bureau) : décalage de mise en page CLS = 0.43 | `PAGE-CLS` |
| 🟠 | sources.html : saisie dans « headerSearch » → erreur serveur | `SAISIE-5XX` |
| 🟡 | sources.html : 8 scripts sans defer (parse bloquant) | `PERF-SCRIPTS-BLOQUANTS` |
| 🟡 | sources.html : valeur manquante affichée telle quelle (réponses illisibles (portail captif)) | `CHAOS-VALEUR-BRUTE` |
| 🟡 | sources.html à 768 px : des contrôles se chevauchent | `LARGEUR-CHEVAUCHEMENT` |
| 🟡 | sources.html : 9 texte(s) peu lisible(s) avec l'accent #22c55e (sombre) | `ACCENT-CONTRASTE` |
| 🟡 | sources.html : 12 texte(s) peu lisible(s) avec l'accent #22c55e (clair) | `ACCENT-CONTRASTE` |
| 🟡 | sources.html : 9 texte(s) peu lisible(s) avec l'accent #ec4899 (sombre) | `ACCENT-CONTRASTE` |
| 🟡 | sources.html : 12 texte(s) peu lisible(s) avec l'accent #ec4899 (clair) | `ACCENT-CONTRASTE` |
| 🟡 | sources.html : 9 texte(s) peu lisible(s) avec l'accent #ef4444 (sombre) | `ACCENT-CONTRASTE` |
| 🟡 | sources.html : 12 texte(s) peu lisible(s) avec l'accent #ef4444 (clair) | `ACCENT-CONTRASTE` |
| 🟡 | sources.html : 9 texte(s) peu lisible(s) avec l'accent #06b6d4 (sombre) | `ACCENT-CONTRASTE` |

### parametres.html — Paramètres

Tous les réglages : apparence, lecture, appareils/appairage, données (sauvegardes), confidentialité, raccourcis, mise à jour.

| | Bureau | Mobile |
|---|---:|---:|
| Contrôles visibles | 105 | 87 |
| Contrôles cliqués | 6 | — |
| Requêtes API | 47 | 43 |
| Décalage de mise en page (CLS) | 0.043 | 0 |
| Nœuds DOM | 596 | 600 |
| Tâches longues (ms) | 283 | 62 |

**Fonctionnalités de la page** : Apparence (thème, accent, densité, typographie) · Lecture (mode, sens, qualité) · Appareils et appairage · Sauvegardes (créer, aperçu, restaurer) · Mode invité · Gestes sur les cartes · Raccourcis clavier · Mises à jour.

**Résultat des clics** : 6 / 6 produisent un effet.

**Autres constats sur cette page**

| | Constat | Origine |
|---|---|---|
| 🟠 | parametres.html : exception JavaScript quand réponses illisibles (portail captif) | `CHAOS-EXCEPTION` |
| 🟠 | parametres.html : exception JavaScript quand réponses vides | `CHAOS-EXCEPTION` |
| 🟠 | parametres.html en anglais : 36 texte(s) encore en français | `ANGLAIS-RESTE-FRANCAIS` |
| 🟠 | parametres.html : 3 cible(s) tactile(s) sous 24 px (minimum WCAG 2.2) | `MOB-CIBLE-24` |
| 🟠 | parametres.html : en bas de page, des contrôles restent sous la barre fixe | `MOB-BARRE-MASQUE` |
| 🟠 | parametres.html : saisie dans « headerSearch » → erreur serveur | `SAISIE-5XX` |
| 🟡 | parametres.html : 12 scripts sans defer (parse bloquant) | `PERF-SCRIPTS-BLOQUANTS` |
| 🟡 | parametres.html : valeur manquante affichée telle quelle (réponses vides) | `CHAOS-VALEUR-BRUTE` |
| 🟡 | parametres.html : 42 cible(s) entre 24 et 40 px | `MOB-CIBLE-40` |
| 🟡 | parametres.html : 4 champ(s) sous 16 px, qui font zoomer l'écran sur iOS | `MOB-ZOOM-SAISIE` |
| 🟡 | parametres.html en paysage : les barres fixes prennent 194 px sur 390 | `MOB-PAYSAGE-BARRES` |
| 🟡 | parametres.html : le focus passe sur 1 élément(s) invisible(s) | `CLAVIER-FOCUS-CACHE` |
| 🟡 | parametres.html : « Gérer » — 1 défaut(s) d'accessibilité | `FENETRE-AXE` |
| 🟡 | parametres.html : « Afficher » — 1 défaut(s) d'accessibilité | `FENETRE-AXE` |

### systeme.html — Système de style

**Page interne** : catalogue des composants et des jetons de design (couleurs, espacements). Destinée au développement, mais **liée dans le pied de page de toutes les pages et livrée aux utilisateurs** (ARC-10).

| | Bureau | Mobile |
|---|---:|---:|
| Contrôles visibles | 14 | 0 |
| Contrôles cliqués | 1 | — |
| Requêtes API | 104 | 102 |
| Décalage de mise en page (CLS) | 0.05 | 0 |
| Nœuds DOM | 850 | 849 |
| Tâches longues (ms) | 214 | 0 |

**Fonctionnalités de la page** : Aperçu des composants.

**Résultat des clics** : 0 / 1 produisent un effet, **1 sans aucun effet**.

**Contrôles sans effet au clic** :

- « Stations » ne produit aucun effet visible au clic — _button[role=tab] 99×33 · aucun changement du DOM, aucune requête, aucune fenêtre_

**Autres constats sur cette page**

| | Constat | Origine |
|---|---|---|
| 🟠 | systeme.html (thème clair) : color-contrast × 16 | `CLAIR-AXE-COLOR-CONTRAST` |
| 🟠 | systeme.html en anglais : 47 texte(s) encore en français | `ANGLAIS-RESTE-FRANCAIS` |
| 🟠 | systeme.html : axe « color-contrast » (serious) × 21 | `AXE-COLOR-CONTRAST` |
| 🟡 | systeme.html : 7 scripts sans defer (parse bloquant) | `PERF-SCRIPTS-BLOQUANTS` |
| 🟡 | systeme.html : 3045 Ko à analyser au chargement | `NET-POIDS` |
| 🟡 | systeme.html : rien ne dit qu'on est hors ligne | `HL-SILENCE` |
| 🟡 | systeme.html à 200 % : texte coupé | `ADA-ZOOM-COUPE` |
| 🔵 | Pas de lien d'évitement (« Aller au contenu ») | `A11Y-LIEN-EVITEMENT` |
| 🔵 | systeme.html : 64 % des 529 Ko de JavaScript ne servent pas au chargement | `NET-JS-INUTILE` |

### comparer.html — Comparer deux traductions

Comparaison côte à côte de deux traductions d'un même chapitre.

| | Bureau | Mobile |
|---|---:|---:|
| Contrôles visibles | 32 | 13 |
| Contrôles cliqués | 17 | — |
| Requêtes API | 33 | 30 |
| Décalage de mise en page (CLS) | 0.016 | 0 |
| Nœuds DOM | 152 | 151 |
| Tâches longues (ms) | 116 | 60 |

**Fonctionnalités de la page** : Choix des deux sources · Alignement des textes.

**Résultat des clics** : 17 / 17 produisent un effet.

**Autres constats sur cette page**

| | Constat | Origine |
|---|---|---|
| 🟠 | comparer.html : 1 cible(s) tactile(s) sous 24 px (minimum WCAG 2.2) | `MOB-CIBLE-24` |
| 🟠 | comparer.html : saisie dans « headerSearch » → erreur serveur | `SAISIE-5XX` |
| 🟡 | comparer.html : 6 scripts sans defer (parse bloquant) | `PERF-SCRIPTS-BLOQUANTS` |
| 🟡 | comparer.html : rien ne dit à l'utilisateur que réseau coupé | `CHAOS-SILENCE` |
| 🟡 | comparer.html : rien ne dit à l'utilisateur que réponses illisibles (portail captif) | `CHAOS-SILENCE` |
| 🟡 | comparer.html : rien ne dit à l'utilisateur que API en erreur 500 | `CHAOS-SILENCE` |
| 🟡 | comparer.html en anglais : 2 texte(s) encore en français | `ANGLAIS-RESTE-FRANCAIS` |
| 🟡 | comparer.html : 5 cible(s) entre 24 et 40 px | `MOB-CIBLE-40` |
| 🟡 | comparer.html : 1 champ(s) sous 16 px, qui font zoomer l'écran sur iOS | `MOB-ZOOM-SAISIE` |
| 🟡 | comparer.html en paysage : les barres fixes prennent 194 px sur 390 | `MOB-PAYSAGE-BARRES` |
| 🟡 | comparer.html : le focus passe sur 1 élément(s) invisible(s) | `CLAVIER-FOCUS-CACHE` |
| 🟡 | comparer.html : rien ne dit qu'on est hors ligne | `HL-SILENCE` |
| 🔵 | Pas de lien d'évitement (« Aller au contenu ») | `A11Y-LIEN-EVITEMENT` |
| 🔵 | comparer.html : lien « Random » sans destination (#) | `LIEN-VIDE` |

### anilist.html — Connexion AniList

Retour d'authentification OAuth AniList.

| | Bureau | Mobile |
|---|---:|---:|
| Contrôles visibles | 2 | 2 |
| Contrôles cliqués | 2 | — |
| Requêtes API | 3 | 3 |
| Décalage de mise en page (CLS) | 0 | 0 |
| Nœuds DOM | 27 | 27 |
| Tâches longues (ms) | 0 | 0 |

**Fonctionnalités de la page** : Redirection après connexion.

**Résultat des clics** : 2 / 2 produisent un effet.

**Autres constats sur cette page**

| | Constat | Origine |
|---|---|---|
| 🟠 | anilist.html (thème clair) : color-contrast × 1 | `CLAIR-AXE-COLOR-CONTRAST` |
| 🟠 | anilist.html : axe « color-contrast » (serious) × 1 | `AXE-COLOR-CONTRAST` |
| 🟡 | anilist.html en anglais : 1 texte(s) encore en français | `ANGLAIS-RESTE-FRANCAIS` |
| 🟡 | anilist.html : rien ne dit qu'on est hors ligne | `HL-SILENCE` |
| 🔵 | Pas de lien d'évitement (« Aller au contenu ») | `A11Y-LIEN-EVITEMENT` |
| 🔵 | <img> sans width/height ni loading : décalage de mise en page | `PERF-IMG-SANS-DIM` |

### confidentialite.html — Confidentialité

Politique de confidentialité (données, hôtes contactés, Android).

| | Bureau | Mobile |
|---|---:|---:|
| Contrôles visibles | 16 | 2 |
| Contrôles cliqués | 1 | — |
| Requêtes API | 23 | 20 |
| Décalage de mise en page (CLS) | 0 | 0 |
| Nœuds DOM | 112 | 111 |
| Tâches longues (ms) | 0 | 0 |

**Fonctionnalités de la page** : Texte légal · Liens vers les réglages.

**Résultat des clics** : 0 / 1 produisent un effet, **1 sans aucun effet**.

**Contrôles sans effet au clic** :

- « Settings » ne produit aucun effet visible au clic — _a 53×19 · aucun changement du DOM, aucune requête, aucune fenêtre_

**Autres constats sur cette page**

| | Constat | Origine |
|---|---|---|
| 🟠 | confidentialite.html (thème clair) : color-contrast × 2 | `CLAIR-AXE-COLOR-CONTRAST` |
| 🟠 | confidentialite.html (thème clair) : link-in-text-block × 2 | `CLAIR-AXE-LINK-IN-TEXT-BLOCK` |
| 🟠 | confidentialite.html : axe « color-contrast » (serious) × 2 | `AXE-COLOR-CONTRAST` |
| 🟠 | confidentialite.html : axe « link-in-text-block » (serious) × 2 | `AXE-LINK-IN-TEXT-BLOCK` |
| 🟡 | confidentialite.html : 7 scripts sans defer (parse bloquant) | `PERF-SCRIPTS-BLOQUANTS` |
| 🟡 | Le navigateur contacte directement 2 hôte(s) extérieur(s) : ils voient ton adresse | `VP-NAVIGATEUR-DIRECT` |
| 🟡 | 1 hôte(s) contacté(s) par le serveur ne figurent pas dans la page Confidentialité | `VP-NON-DECLARE-SERVEUR` |
| 🔵 | Pas de lien d'évitement (« Aller au contenu ») | `A11Y-LIEN-EVITEMENT` |
| 🔵 | confidentialite.html : 67 % des 520 Ko de JavaScript ne servent pas au chargement | `NET-JS-INUTILE` |

