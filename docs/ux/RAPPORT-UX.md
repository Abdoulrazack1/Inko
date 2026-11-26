# Expérience d'Inko — rapport

Produit par `scripts-ci/sondes/strategie-ux.js`. Relevés d'expérience : 2026-11-25 23:18 ; campagne générale : 2026-11-25 22:34 (UTC).

## Note d'ensemble : 45 / 100

Une note mesure ce que les sondes savent voir, pas la qualité ressentie : elle sert à comparer deux états et à ordonner le travail. Calcul : voir `STRATEGIE-UX.md`.

| Dimension | Note | Écart | Familles de défauts | Sondes manquantes |
|---|---:|---:|---:|---|
| Réponse et états | 9 | · | 19 | · |
| Accessibilité | 17 | · | 24 | · |
| Téléphone et tailles d’écran | 26 | · | 10 | · |
| Fluidité ressentie | 41 | · | 13 | · |
| Efficacité des gestes | 50 | · | 11 | · |
| Cohérence du design | 52 | · | 16 | · |
| Mots et langue | 63 | · | 6 | · |
| Se repérer et revenir | 65 | · | 7 | · |
| Hiérarchie et lisibilité | 81 | · | 5 | · |
| Rendu et images | 99 | · | 1 | · |

## Pages, de la plus abîmée à la mieux tenue

| Page | Note | Familles | dont graves |
|---|---:|---:|---:|
| bibliotheque.html | 10 | 30 | 10 |
| recherche.html | 15 | 26 | 9 |
| serie.html | 17 | 26 | 8 |
| collection-detail.html | 18 | 23 | 8 |
| stats.html | 18 | 24 | 8 |
| u.html | 23 | 21 | 7 |
| accueil.html | 24 | 21 | 6 |
| parametres.html | 26 | 23 | 5 |
| notifications.html | 31 | 20 | 4 |
| collections.html | 32 | 17 | 5 |
| catalogue.html | 33 | 18 | 4 |
| sources.html | 35 | 17 | 4 |
| profil.html | 39 | 18 | 3 |
| lecture.html | 40 | 15 | 4 |
| import.html | 41 | 15 | 4 |
| notes.html | 41 | 15 | 3 |
| comparer.html | 44 | 14 | 3 |
| confidentialite.html | 45 | 11 | 4 |
| chapitre.html | 45 | 12 | 3 |
| liste.html | 48 | 13 | 3 |
| index.html | 52 | 10 | 3 |
| systeme.html | 52 | 10 | 3 |
| downloads.html | 52 | 15 | 2 |
| anilist.html | 61 | 6 | 3 |
| localreader.html | 68 | 6 | 2 |
| offline.html | 98 | 2 | 0 |

## Vague 1 — grave et rapide : à faire d'abord (32)

| Famille | Gravité | Effort | Occurrences | Pages | Exemple et geste |
|---|---|:---:|---:|---|---|
| `ANGLAIS-RESTE-FRANCAIS` | haute | S | 22 | 22 pages | accueil.html en anglais : 13 texte(s) encore en français — *Ajouter les entrées à assets/i18n/en.json ; traduire aussi title, aria-label et placeholder.* |
| `MOB-CIBLE-24` | haute | S | 15 | 15 pages | accueil.html : 6 cible(s) tactile(s) sous 24 px (minimum WCAG 2.2) — *min-width et min-height à 44 px (zone d'appui, pas forcément le dessin).* |
| `UX-COH-TEXTE` | haute | S | 12 | 7 pages | catalogue.html (bureau) : 53 % des textes hors de l'échelle typographique — *Utiliser les jetons --t-*.* |
| `SAISIE-5XX` | haute | S | 11 | 11 pages | comparer.html : saisie dans « headerSearch » → erreur serveur |
| `CLAIR-AXE-COLOR-CONTRAST` | haute | S | 9 | 9 pages | anilist.html (thème clair) : color-contrast × 1 |
| `CHAOS-EXCEPTION` | haute | S | 8 | 7 pages | accueil.html : exception JavaScript quand réponses illisibles (portail captif) — *Garder l'appel (try/catch) et poser un état d'erreur.* |
| `CHAOS-ATTENTE-SANS-FIN` | haute | S | 8 | 6 pages | accueil.html : chargement qui ne s'arrête pas quand réponses illisibles (portail captif) — *Remplacer le squelette par un état d'erreur avec « Réessayer ».* |
| `CHAOS-PAGE-BLANCHE` | haute | S | 7 | collection-detail, liste, serie, u | collection-detail.html : page quasi blanche quand réponses illisibles (portail captif) |
| `AXE-COLOR-CONTRAST` | haute | S | 6 | 6 pages | anilist.html : axe « color-contrast » (serious) × 1 |
| `MOB-BARRE-MASQUE` | haute | S | 5 | 5 pages | bibliotheque.html : en bas de page, des contrôles restent sous la barre fixe — *padding-bottom égal à la hauteur de la barre et à env(safe-area-inset-bottom).* |
| `LARGEUR-DEBORDE` | haute | S | 3 | accueil, index, recherche | accueil.html à 320 px : défilement horizontal de 39 px — *min-width:0, flex-wrap, max-width:100% sur les éléments listés.* |
| `BTN-RECOUVERT` | haute | S | 2 | chapitre, import | chapitre.html : « Téléchargements » ne répond pas au clic — recouvert par div#readerPagesArea.reader-pages-area — *Le clic atteint la couche et non le contrôle : pointer-events:none sur la couche, ou rehausser le contrôle.* |
| `BTN-RESEAU-KO` | haute | S | 2 | serie | serie.html : clic sur « Sources » → requête en échec (502 GET /api/sources/royalroad/mangas/search) |
| `PAGE-CLS` | haute | M | 11 | 8 pages | accueil.html (bureau) : décalage de mise en page CLS = 0.33 — *Réserver la place (aspect-ratio / min-height) des cartes et images avant leur arrivée.* |
| `VIDE-5XX` | haute | S | 1 | recherche | recherche.html : erreur serveur sur un compte tout neuf |
| `CLAIR-AXE-ARIA-REQUIRED-CHILDREN` | haute | S | 1 | bibliotheque | bibliotheque.html (thème clair) : aria-required-children × 1 |
| `CLAIR-AXE-LINK-NAME` | haute | S | 1 | collection-detail | collection-detail.html (thème clair) : link-name × 1 |
| `CLAIR-AXE-LINK-IN-TEXT-BLOCK` | haute | S | 1 | confidentialite | confidentialite.html (thème clair) : link-in-text-block × 2 |
| `CLAIR-AXE-SCROLLABLE-REGION-FOCUSABLE` | haute | S | 1 | stats | stats.html (thème clair) : scrollable-region-focusable × 1 |
| `AXE-ARIA-REQUIRED-CHILDREN` | haute | S | 1 | bibliotheque | bibliotheque.html : axe « aria-required-children » (critical) × 1 |
| `AXE-LINK-IN-TEXT-BLOCK` | haute | S | 1 | confidentialite | confidentialite.html : axe « link-in-text-block » (serious) × 2 |
| `AXE-SCROLLABLE-REGION-FOCUSABLE` | haute | S | 1 | stats | stats.html : axe « scrollable-region-focusable » (serious) × 1 |
| `ROMAN-PROGRESSION` | haute | S | 1 | · | La lecture d'un roman n'est pas enregistrée |
| `REF-SANS-CONNEXION` | haute | S | 1 | · | Aucun écran ne permet de se connecter — *Écran de connexion, d’inscription et de récupération.* |
| `REF-SANS-INSCRIPTION` | haute | S | 1 | · | Aucun écran ne permet de créer un compte — *Écran de connexion, d’inscription et de récupération.* |
| `REF-SANS-MDP` | haute | S | 1 | · | Aucun écran ne permet de changer son mot de passe — *Écran de connexion, d’inscription et de récupération.* |
| `REF-EFFACEMENT-IMPOSSIBLE` | haute | S | 1 | · | Le propriétaire d’une installation locale ne peut pas supprimer son compte — *En mode local, confirmer par une phrase tapée (« SUPPRIMER ») sur la boucle locale.* |
| `UX-RESULTATS-SANS-LIEN` | haute | S | 1 | · | Les résultats de recherche ne sont pas des liens : impossibles à ouvrir au clavier ou dans un nouvel onglet — *Un <a href> couvrant la carte, les puces de sources en liens séparés.* |
| `DSK-FENETRE-SANS-BARRE` | haute | S | 1 | · | Application Windows : 4 page(s) sans boutons de fenêtre (ni réduire, ni fermer, ni déplacer) — *Injecter la barre depuis un script commun à toutes les pages.* |
| `VOL-DOM` | haute | M | 2 | bibliotheque | bibliotheque.html avec 2000 favoris : 26 577 éléments dans la page — *Liste virtualisée ou pagination ; ne construire que ce qui est à l'écran.* |
| `UX-PARCOURS-ECHEC` | haute | M | 2 | bibliotheque | « Retirer une série puis se raviser » n'aboutit pas au bureau — *Rejouer à la main, puis rendre le contrôle visible et son effet immédiat.* |
| `UX-NAV-RETOUR-PANNEAU` | haute | M | 2 | chapitre, serie | chapitre.html (téléphone) : le bouton Retour quitte la page au lieu de fermer le panneau ouvert — *history.pushState à l'ouverture, fermeture sur popstate — dans le composant commun.* |

## Vague 2 — le reste du grave et les gains faciles (37)

| Famille | Gravité | Effort | Occurrences | Pages | Exemple et geste |
|---|---|:---:|---:|---|---|
| `ACCENT-CONTRASTE` | moyenne | S | 56 | bibliotheque, serie, sources, stats | bibliotheque.html : 3 texte(s) peu lisible(s) avec l'accent #22c55e (sombre) |
| `BTN-MORT` | moyenne | S | 26 | 11 pages | accueil.html : « Inko » ne produit aucun effet visible au clic — *Vérifier le gestionnaire : écouteur absent ou jeté par une erreur au chargement ; ou contrôle décoratif à retirer/griser.* |
| `PERF-SCRIPTS-BLOQUANTS` | moyenne | S | 23 | 23 pages | accueil.html : 16 scripts sans defer (parse bloquant) — *defer sur tous les scripts non critiques ; conserve l'ordre d'exécution.* |
| `MOB-CIBLE-40` | moyenne | S | 20 | 20 pages | accueil.html : 31 cible(s) entre 24 et 40 px — *Viser 44 × 44.* |
| `MOB-PAYSAGE-BARRES` | moyenne | S | 19 | 19 pages | accueil.html en paysage : les barres fixes prennent 194 px sur 390 — *Réduire ou escamoter les barres quand la hauteur manque.* |
| `CHAOS-SILENCE` | moyenne | S | 12 | 8 pages | bibliotheque.html : rien ne dit à l'utilisateur que réponses illisibles (portail captif) — *MH.poserEtatErreur avec « Réessayer ».* |
| `PAGE-ERREUR-CONSOLE` | moyenne | S | 12 | 6 pages | accueil.html (bureau) : 1 erreur(s) console |
| `CLAVIER-FOCUS-CACHE` | moyenne | S | 12 | 12 pages | accueil.html : le focus passe sur 20 élément(s) invisible(s) — *inert, visibility:hidden ou tabindex=-1 sur les panneaux fermés.* |
| `MOB-ZOOM-SAISIE` | moyenne | S | 11 | 11 pages | bibliotheque.html : 2 champ(s) sous 16 px, qui font zoomer l'écran sur iOS — *font-size: 16px sur les champs sous 600 px.* |
| `CHAOS-VALEUR-BRUTE` | moyenne | S | 9 | 8 pages | accueil.html : valeur manquante affichée telle quelle (réponses illisibles (portail captif)) |
| `PAGE-RESEAU-KO` | moyenne | S | 8 | accueil, bibliotheque, index, profil | accueil.html (bureau) : 1 requête(s) en échec |
| `UX-RET-DOUBLE-ENVOI` | moyenne | S | 7 | notifications, parametres | notifications.html : deux appuis sur « Non lues » envoient deux fois la même demande — *Désactiver le contrôle tant que la réponse n'est pas arrivée.* |
| `UX-NAV-REPERE` | moyenne | S | 6 | 6 pages | accueil.html : la navigation n'indique pas qu'on est sur cette page — *aria-current="page" et style actif.* |
| `FENETRE-AXE` | moyenne | S | 5 | chapitre, parametres, serie | chapitre.html : « Plus d'actions » — 1 défaut(s) d'accessibilité |
| `LARGEUR-CHEVAUCHEMENT` | moyenne | S | 4 | bibliotheque, collection-detail, notifications, sources | bibliotheque.html à 360 px : des contrôles se chevauchent |
| `UX-ECR-SANS-TITRE` | moyenne | S | 4 | recherche, u | recherche.html (bureau) : aucun titre de page visible à l'arrivée — *Un h1 visible qui dit où l'on est.* |
| `UX-ECR-ACTIONS` | moyenne | S | 4 | serie, sources, stats | serie.html (bureau) : 2 actions « principales » se disputent le premier écran — *Une seule action pleine par écran ; les autres en secondaire.* |
| `ECOUTEURS-APRES-ATTENTE` | moyenne | S | 3 | · | lecture.js : 2 branchement(s) de contrôles APRÈS `const dl = window.Downloads ? await window.Downloads.get(chapterId) : null;` — les boutons sont iner — *Brancher les écouteurs (ils ne dépendent que du DOM statique) AVANT l'attente, ou déléguer l'événement sur le conteneur ; lancer l* |
| `LECTEUR-TOUCHE-INERTE` | moyenne | S | 3 | · | Mode « page » : la touche Space ne fait rien |
| `UX-NAV-ETAT-PERDU` | moyenne | S | 2 | bibliotheque, catalogue | bibliotheque.html : l'onglet « Signets » est oubliée au rechargement — *Garder le choix dans l'adresse (partageable) ou les préférences.* |
| `A11Y-BOUTON-MUET` | moyenne | S | 1 | bibliotheque | Bouton à icône sans nom accessible — *aria-label="…"* |
| `A11Y-TITRE` | moyenne | S | 1 | chapitre, collection-detail, lecture, serie | <title> absent ou vide |
| `A11Y-CHAMP-SANS-LABEL` | moyenne | S | 1 | collections | <input> sans label |
| `CSS-100VH` | moyenne | S | 1 | · | 3 usage(s) de height:100vh : la barre d'adresse mobile rogne la page — *100dvh avec repli 100vh (Android 8 ignore dvh : @supports).* |
| `CSS-VAR-INDEFINIE` | moyenne | S | 1 | · | 4 variable(s) CSS utilisée(s) mais jamais définie(s) — *var(--x) sans définition retombe sur la valeur initiale : le style disparaît sans erreur.* |
| `CSS-SELECTEURS-RECENTS` | moyenne | S | 1 | · | 3 sélecteur(s) :is()/:where()/:has() : ignorés par le WebView Android 8 (Chrome 61) — *La règle entière est jetée par un navigateur qui ne connaît pas un sélecteur de la liste ; dupliquer sans :is().* |
| `BTN-SANS-NOM` | moyenne | S | 1 | collection-detail | collection-detail.html (bureau) : a 155×232 sans nom accessible — *aria-label ou texte visible.* |
| `LECTEUR-REGLAGES-ECHAP` | moyenne | S | 1 | · | Après avoir touché une case ou un curseur, Échap ne ferme plus les réglages du lecteur — *Laisser passer Échap dans toucheIgnoree.* |
| `LECTEUR-CIBLES` | moyenne | S | 1 | · | Téléphone : 14 bouton(s) du lecteur sous 40 px |
| `CLAVIER-INATTEIGNABLE` | moyenne | S | 1 | chapitre | chapitre.html : 8 élément(s) cliquable(s) impossibles à atteindre au clavier |
| `FENETRE-ECHAP` | moyenne | S | 1 | parametres | parametres.html : Échap ne ferme pas « Afficher » |
| `REF-ARIA` | moyenne | S | 1 | bibliotheque | bibliotheque.html : 1 référence(s) d'accessibilité vers un élément absent — *Corriger l'identifiant ou retirer l'attribut (aria-controls peut désigner un panneau créé à l'ouverture).* |
| `REF-FONCTION-SANS-ECRAN` | moyenne | S | 1 | · | 21 fonction(s) de l’API cliente qu’aucun écran n’appelle — *Brancher chaque fonction à un écran, ou la retirer.* |
| `REF-SANS-OUBLI` | moyenne | S | 1 | · | Aucun écran « mot de passe oublié » — *Écran de connexion, d’inscription et de récupération.* |
| `UX-COH-TITRES` | moyenne | S | 1 | · | Le titre principal change de taille ou de graisse selon la page (13 formes) — *Un seul style de titre de page.* |
| `UX-NAV-SANS-RETOUR` | moyenne | S | 1 | confidentialite | confidentialite.html : aucun moyen visible de revenir au niveau supérieur — *Lien « ← … » ou fil d'Ariane.* |
| `UX-COH-BOUTONS` | haute | L | 1 | · | Les boutons prennent 53 formes différentes — *Trois tailles et quatre variantes, un seul composant.* |

## Vague 3 — chantiers moyens (11)

| Famille | Gravité | Effort | Occurrences | Pages | Exemple et geste |
|---|---|:---:|---:|---|---|
| `VOL-BLOCAGE` | moyenne | M | 2 | bibliotheque, profil | bibliotheque.html avec 10000 favoris : l'écran se fige 471 ms d'un coup — *Découper le rendu (par lots, requestIdleCallback).* |
| `NET-POIDS` | moyenne | M | 2 | catalogue, systeme | catalogue.html : 2418 Ko à analyser au chargement — *Charger à la demande les modules secondaires.* |
| `A11Y-DIV-CLIQUABLE-JS` | moyenne | M | 1 | · | 2 élément(s) div/span cliquable(s) créés en JS sans rôle ni tabindex — *Utiliser <button>, ou role="button" + tabindex="0" + gestion Entrée/Espace.* |
| `CSS-LOURDE` | moyenne | M | 1 | · | assets/css/global.css pèse 118 Ko (feuille bloquante au rendu) — *Scinder : critique en tête, reste en chargement différé ; retirer les règles mortes.* |
| `PERF-PAS-MINIFIE` | moyenne | M | 1 | · | 1818 Ko de JS applicatif servi tel quel (aucune minification) — *esbuild --minify dans le build web/desktop ; l'APK le fait déjà (transpilation chrome61) : même chaîne pour le web. Gain attendu ~* |
| `VOL-SAISIE` | moyenne | M | 1 | bibliotheque | bibliotheque.html avec 10000 favoris : filtrer bloque 2853 ms — *Différer le filtrage (150 ms) et ne pas reconstruire la grille.* |
| `UX-COH-CHAMPS` | moyenne | M | 1 | · | Les champs de saisie prennent 15 formes différentes — *Deux tailles de champ.* |
| `UX-ECR-CONTENU-BAS` | moyenne | M | 1 | profil | profil.html (mobile) : le contenu commence à 530 px, soit 63 % de l'écran — *Réduire les en-têtes, regrouper les filtres, faire remonter le contenu.* |
| `UX-RED-ERREUR-BRUTE` | moyenne | M | 1 | · | 30 message(s) collent l'erreur technique derrière « Erreur : » — *MH.toastErreur : dire ce qui s'est passé, ce que ça change et quoi faire.* |
| `UX-PALETTE-SANS-ROLE` | moyenne | M | 1 | · | Au téléphone, « Plus » ouvre une palette de commandes dont les lignes ne sont ni des liens ni des boutons — *Une feuille de navigation avec de vrais liens au téléphone ; role="option" dans la palette.* |
| `UX-COH-ESPACEMENT` | moyenne | L | 1 | · | 18 valeurs d'espacement hors de l'échelle — *Ramener chaque valeur au jeton --sp-* le plus proche.* |

## Vague 4 — finitions (32)

| Famille | Gravité | Effort | Occurrences | Pages | Exemple et geste |
|---|---|:---:|---:|---|---|
| `LIEN-VIDE` | basse | S | 36 | 20 pages | accueil.html : lien « Aléatoire » sans destination (#) |
| `NET-DOUBLON` | basse | S | 19 | 19 pages | accueil.html : 3 lecture(s) d'API demandée(s) plusieurs fois — *Mutualiser la requête (SHARED_GET).* |
| `LARGEUR-TEXTE-COUPE` | basse | S | 15 | localreader, recherche, u | localreader.html à 320 px : texte coupé sans points de suspension |
| `SAISIE-DEBORDE` | basse | S | 15 | 15 pages | catalogue.html : un texte long dans « headerSearch » élargit la page de 1518 px |
| `UX-NAV-ORPHELINE` | basse | S | 15 | 15 pages | anilist.html : aucun lien permanent (seulement atteinte par une action) — *Lui donner une place dans la navigation, ou la retirer.* |
| `PERF-IMAGE-LOURDE` | basse | S | 10 | · | tools/frames/01-intro.png : 599 Ko — *WebP/AVIF ou redimensionner.* |
| `CSS-CLASSES-MORTES` | basse | S | 7 | · | 18 classe(s) de assets/css/catalogue.css jamais référencée(s) (HTML/JS) — *Vérifier les classes composées dynamiquement (préfixe + variable) avant de supprimer.* |
| `MOB-TEXTE-MINUSCULE` | basse | S | 7 | 7 pages | chapitre.html : texte sous 11 px — *Plancher à 12 px.* |
| `UX-ECR-LIGNE-LONGUE` | basse | S | 7 | 7 pages | confidentialite.html (bureau) : lignes de plus de 95 signes — *max-width: 70ch sur le texte courant.* |
| `UX-ECR-TAILLES` | basse | S | 2 | profil, stats | profil.html (bureau) : 8 tailles de texte sur un seul écran — *Quatre ou cinq niveaux suffisent.* |
| `UX-RED-JARGON` | basse | S | 2 | · | Jargon à l'écran : « JSON » (1) — *Dire ce que cela change pour le lecteur ; garder le terme technique pour la page Système.* |
| `BTN-CIBLE-PETITE` | basse | M | 16 | 16 pages | accueil.html : 32 cibles tactiles trop petites (< 32 px) — *Zone tactile ≥ 44×44 (padding ou ::before invisible).* |
| `NET-JS-INUTILE` | basse | M | 6 | 6 pages | accueil.html : 61 % des 661 Ko de JavaScript ne servent pas au chargement — *Découper global.js ; import à la demande.* |
| `A11Y-LIEN-EVITEMENT` | basse | S | 1 | 24 pages | Pas de lien d'évitement (« Aller au contenu ») — *Premier élément focusable : <a class="skip" href="#main">.* |
| `A11Y-H1` | basse | S | 1 | collection-detail, lecture, liste, serie | Aucun <h1> dans le HTML statique (peut être rendu en JS) — *Un h1 (même visuellement masqué) donne le repère de page aux lecteurs d'écran.* |
| `I18N-IDENTIQUES` | basse | S | 1 | · | 28 entrée(s) dont la traduction est identique au français |
| `PERF-IMG-SANS-DIM` | basse | S | 1 | anilist, offline, profil | <img> sans width/height ni loading : décalage de mise en page |
| `PERF-POLICES` | basse | S | 1 | · | 27 fichiers de polices (3 familles × graisses × sous-ensembles) — *unicode-range déjà utile ; supprimer les graisses non utilisées (grep font-weight).* |
| `VIE-PRIVEE-HOTES-EXTERNES` | basse | S | 1 | · | Le navigateur contacte directement 4 hôte(s) externe(s) : github.com, www.youtube.com, s4.anilist.co, graphql.anilist.co — *Chaque appel direct révèle l'adresse IP et la page consultée au tiers ; passer par le proxy local (ou auto-héberger la police/icôn* |
| `FENETRE-SANS-NOM` | basse | S | 1 | parametres | parametres.html : la fenêtre « Gérer » n'a pas de nom accessible — *aria-labelledby sur le titre.* |
| `UX-COH-RAYON` | basse | S | 1 | recherche | recherche.html (mobile) : 24 % des rayons hors de l'échelle — *Utiliser les jetons --r-*.* |
| `UX-ECR-IMAGE-FLOUE` | basse | S | 1 | accueil | accueil.html (bureau) : image(s) affichée(s) plus grande(s) que leur définition — *Demander la bonne taille de couverture.* |
| `UX-RED-APOSTROPHE` | basse | S | 1 | · | Deux apostrophes se mélangent : 9 droites, 34 typographiques — *Choisir « ’ ».* |
| `UX-RED-ERREUR-SANS-ISSUE` | basse | S | 1 | · | 3 message(s) d'erreur sans geste proposé — *Terminer chaque erreur par ce que le lecteur peut faire.* |
| `UX-NAV-TITRES-DOUBLES` | basse | S | 1 | · | 3 titre(s) d'onglet partagés par plusieurs pages — *Un titre propre à chaque page.* |
| `NET-GROS-FICHIER` | basse | L | 5 | · | /assets/js/global.js : 214 Ko, 57 % exécutés au chargement (21 pages) — *Découper par fonction ; ce fichier pèse sur chaque page qui le charge.* |
| `CSS-ZINDEX` | basse | M | 1 | · | Échelle z-index sans règle : 24 valeurs distinctes, max 10000 — *Échelle de variables (--z-nav, --z-modale, --z-toast…) ; le violet « par-dessus le bouton » vient de ce genre d'empilement.* |
| `CSS-FONT-PX` | basse | M | 1 | · | 142 font-size en px : ignore le réglage de taille de texte du système — *rem/em ou l'échelle typographique existante.* |
| `PAGE-CIBLES-PETITES` | basse | M | 1 | catalogue | catalogue.html : 36 cibles tactiles < 24 px — *Zone tactile minimale 44×44 (padding invisible).* |
| `UX-COH-COULEURS` | basse | M | 1 | · | 23 couleurs de texte différentes à l'écran — *Se limiter aux encres du thème et aux accents.* |
| `UX-COH-OMBRES` | basse | M | 1 | · | 14 ombres différentes (le projet en définit cinq) — *Utiliser les jetons --e-*.* |
| `CSS-COULEURS-LITTERALES` | basse | L | 1 | · | 406 couleurs littérales hors variables (dont les feuilles de thème sombre/clair) — *Tout passer par des variables ; chaque littéral est un endroit où le thème clair/sombre/contraste peut diverger.* |

