## 17. Ce qui manque pour faire d'Inko la référence

295 éléments en 23 domaines. Priorités : **P0** fondation (30) · **P1** attendu (156) · **P2** différenciant (96) · **P3** ambitieux (13).

Effort : S moins d'une demi-journée · M un à deux jours · L trois à huit jours · XL plus de deux semaines. Ce sont des estimations, pas des mesures.

Ce catalogue est une proposition : rien de ce qu'il décrit n'est développé, et « meilleure que tout ce qui existe » se juge à l'usage, pas au nombre de lignes. Les comparaisons avec d'autres logiciels s'appuient sur leurs notes de version consultées le 25 novembre 2026 et ne sont pas exhaustives.

| Domaine | P0 | P1 | P2 | P3 | Total |
|---|---:|---:|---:|---:|---:|
| Fonctions présentes dans le code mais inaccessibles | 5 | 3 | 3 | · | 11 |
| Comptes, famille et protection | 6 | 5 | 5 | 1 | 17 |
| Bibliothèque et organisation | 1 | 12 | 8 | 1 | 22 |
| Fiche série | · | 9 | 6 | 1 | 16 |
| Lecteur de mangas | 1 | 11 | 9 | 1 | 22 |
| Lecteur de romans et de livres | · | 9 | 7 | 1 | 17 |
| Fichiers personnels et formats | · | 5 | 5 | 1 | 11 |
| Découverte et recherche | · | 7 | 5 | 1 | 13 |
| Sources et extensions | 1 | 8 | 3 | · | 12 |
| Téléchargements et hors-ligne | · | 10 | 3 | · | 13 |
| Mises à jour et notifications | · | 4 | 3 | · | 7 |
| Suivi et services tiers | · | 5 | 2 | · | 7 |
| Journal et statistiques | · | 4 | 5 | 1 | 10 |
| Partage et vie de famille | 1 | 2 | 4 | 2 | 9 |
| Données, sauvegarde et synchronisation | 2 | 5 | 4 | · | 11 |
| Ouverture et intégrations | · | 4 | 5 | 1 | 10 |
| Plateformes et distribution | 2 | 6 | 6 | 1 | 15 |
| Accessibilité et langues | · | 5 | 3 | 1 | 9 |
| Confidentialité et sécurité visibles | 5 | 3 | 3 | · | 11 |
| Installation, exploitation et aide | · | 7 | 4 | · | 11 |
| Composants d'interface à unifier | 3 | 8 | 1 | · | 12 |
| Boutons et réglages manquants, page par page | · | 20 | · | · | 20 |
| Qualité qui rend tout cela tenable | 3 | 4 | 2 | · | 9 |

### 17.1 Fonctions présentes dans le code mais inaccessibles

Écrites, parfois testées côté serveur, et pourtant personne ne peut s'en servir. Le gain le moins cher du catalogue.

| Réf. | Priorité | Effort | Type | Où | Élément |
|---|:---:|:---:|---|---|---|
| REP-01 | P0 | M | réparation | serie.html | **Rétablir la section Commentaires sur la fiche** — serie.js sait publier, répondre, signaler, supprimer et paginer ; la page n'a plus #commentsList, #commentForm ni #commentCount, et rien n'appelle loadComments() au chargement. |
| REP-02 | P0 | S | réparation | accueil.html | **Faire apparaître l'onglet « Pour toi »** — rendreReco() cherche #shelfReco, qui n'existe pas : les recommandations par tags croisés ne s'affichent jamais. |
| REP-03 | P0 | L | réparation | connexion | **Écran de connexion pour le mode multi-comptes** — LOCAL_MODE=0 est documenté (Docker) mais API.auth.login n'est appelée nulle part. |
| REP-04 | P0 | S | réparation | collections.html | **Remplacer les liens vers connexion.html et login.html** — Deux boutons « Se connecter » mènent à des pages absentes. |
| REP-05 | P0 | S | réparation | parametres.html | **Rendre possible la suppression du compte en mode local** — Le mot de passe du propriétaire est aléatoire : la confirmation demandée est impossible à fournir. |
| REP-06 | P1 | M | réparation | bibliotheque.html | **Écran Corbeille** — L'API de la corbeille existe (30 jours de rétention) ; seul « Annuler » juste après le retrait y donne accès. |
| REP-07 | P1 | M | réparation | sources.html | **Annuler une migration de source** — La migration est réversible 7 jours côté serveur ; API.migrate.annulables n'est appelée par aucun écran. |
| REP-08 | P1 | M | réparation | serie.html | **Historique de position d'une série** — API.me.progressHistory existe sans écran : « revenir où j'étais avant ». |
| REP-09 | P2 | M | réparation | catalogue.html | **Trancher le sort du calendrier de la semaine, du focus et des choix de l'équipe** — Code qui cherche #weekCalendar, #catalogueFocus, #teamPicksGrid : le brancher (voir Découverte) ou le retirer. |
| REP-10 | P2 | S | réparation | accueil.html | **Retirer hero3d.js ou le rebrancher** — Plus aucune page ne le charge ; il part encore dans certaines coques. |
| REP-11 | P2 | S | réparation | global | **Proposer l'installation de l'application** — pwa:installable est émis, personne ne l'écoute : pas de bouton « Installer Inko ». |

### 17.2 Comptes, famille et protection

Ce qu'il faut pour partager un hub à la maison sans partager sa bibliothèque, ses notes ni son rôle d'administrateur.

| Réf. | Priorité | Effort | Type | Où | Élément |
|---|:---:|:---:|---|---|---|
| CPT-01 | P0 | M | page | connexion.html | **Page Connexion** — Adresse, mot de passe, « rester connecté », erreurs claires, limite d'essais visible. |
| CPT-02 | P0 | M | page | inscription.html | **Page Création de compte** — Indicateur de force branché sur /auth/password-strength, qui existe. |
| CPT-03 | P0 | M | page | recuperation.html | **Page Mot de passe oublié** — Sans jamais renvoyer le jeton à un appareil distant ; en local, confirmation sur la machine. |
| CPT-04 | P0 | S | bouton | parametres.html | **Changer son mot de passe** — API.auth.changePassword existe. |
| CPT-05 | P0 | M | fonction | serveur | **Fermer l'inscription et inviter par lien** — Réglage ouvert / sur invitation / fermé, codes à usage unique. |
| CPT-06 | P0 | S | fonction | serveur | **Déconnexion qui ferme réellement la session** — Supprimer la ligne de session, pas seulement le cookie. |
| CPT-07 | P1 | L | page | admin.html | **Console d'administration (Inko Admin)** — Comptes, rôles, bannissements, signalements : les routes /admin/* existent toutes, sans aucun écran. |
| CPT-08 | P1 | M | page | profils.html | **Choix du profil au démarrage** — « Qui lit ? » avec avatar, sur un appareil partagé. |
| CPT-09 | P1 | M | fonction | parametres.html | **Code PIN et empreinte à l'ouverture** — Verrou d'application sur Android et bureau. |
| CPT-10 | P1 | M | fonction | bibliotheque.html | **Bibliothèque ou catégorie masquée** — Visible après code ; exclue du widget, des notifications et des vignettes. |
| CPT-11 | P1 | L | fonction | profils | **Profils enfants et contrôle parental** — Classification maximale, sources autorisées, horaires, code pour sortir. |
| CPT-12 | P2 | M | fonction | connexion | **Double authentification (TOTP) et codes de secours** — Indispensable si le hub est exposé en ligne. |
| CPT-13 | P2 | M | fonction | connexion | **Clés d'accès (passkeys)** — Connexion sans mot de passe sur les hubs en HTTPS. |
| CPT-14 | P2 | M | composant | parametres.html | **Photo de profil importée** — Avec recadrage ; aujourd'hui, une lettre. |
| CPT-15 | P2 | M | fonction | serveur | **Quotas par compte** — Imports, téléchargements, extensions autorisées. |
| CPT-16 | P2 | S | composant | parametres.html | **Journal des connexions** — Qui, quand, depuis quel appareil ; alerte sur un nouvel appareil. |
| CPT-17 | P3 | L | fonction | serveur | **Connexion par fournisseur OIDC** — Authelia, Authentik, Keycloak pour les hubs auto-hébergés. |

### 17.3 Bibliothèque et organisation

Le cœur quotidien : à 500 séries et plus, tout ce qui évite de faire défiler.

| Réf. | Priorité | Effort | Type | Où | Élément |
|---|:---:|:---:|---|---|---|
| BIB-01 | P0 | L | composant | bibliotheque.html | **Grille virtualisée** — N'afficher que les cartes visibles : la page reste instantanée à 10 000 séries. |
| BIB-02 | P1 | M | fonction | bibliotheque.html | **Étiquettes personnelles** — Libres, plusieurs par série, filtrables et combinables avec les catégories. |
| BIB-03 | P1 | M | composant | bibliotheque.html | **Constructeur de listes intelligentes** — Interface visuelle des règles (statut, source, note, non-lus, ancienneté, étiquette) avec aperçu en direct. |
| BIB-04 | P1 | S | bouton | bibliotheque.html | **Enregistrer la vue courante** — Filtres + tri + affichage sous un nom, épinglables en onglets. |
| BIB-05 | P1 | M | composant | bibliotheque.html | **Menu contextuel d'une carte** — Clic droit et appui long : reprendre, tout marquer lu, catégorie, liste, télécharger, partager, retirer. |
| BIB-06 | P1 | M | fonction | bibliotheque.html | **Actions en lot complètes** — Statut, catégorie, étiquette, liste, marquer lu, télécharger, migrer, exporter la sélection. |
| BIB-07 | P1 | M | fonction | serie.html | **Modifier les informations d'une série** — Titre, titres alternatifs, auteur, résumé, genres, avec « revenir à la version de la source ». |
| BIB-08 | P1 | M | fonction | serie.html | **Couverture personnalisée** — Choisir parmi les couvertures connues, importer un fichier ou une adresse. |
| BIB-09 | P1 | M | fonction | bibliotheque.html | **Fusionner deux fiches d'une même œuvre** — Une série, plusieurs sources, une seule progression, repli automatique. |
| BIB-10 | P1 | M | fonction | bibliotheque.html | **Catégories ordonnables et réglées une à une** — Ordre à la souris, tri et affichage propres, exclusion des mises à jour. |
| BIB-11 | P1 | S | composant | bibliotheque.html | **Compteurs par onglet et par filtre** — Combien de séries derrière chaque choix avant de le toucher. |
| BIB-12 | P1 | S | bouton | bibliotheque.html | **« Au hasard dans ce filtre »** — Tirer une série parmi la vue courante. |
| BIB-13 | P1 | S | composant | bibliotheque.html | **Index alphabétique latéral** — Saut direct à une lettre. |
| BIB-14 | P2 | M | fonction | bibliotheque.html | **Regroupement par auteur, source, statut ou saga** — Sections repliables. |
| BIB-15 | P2 | M | fonction | bibliotheque.html | **Sagas et ordre de lecture** — Suites, préquelles, spin-offs reliés, « ensuite, lis… ». |
| BIB-16 | P2 | M | fonction | bibliotheque.html | **Rangement par tomes** — Chapitres regroupés par volume, couvertures de tome, possession physique. |
| BIB-17 | P2 | M | fonction | bibliotheque.html | **Collection physique** — Tomes possédés, manquants, prix, prêtés à qui ; scan du code-barres ISBN. |
| BIB-18 | P2 | M | page | doublons | **Page de résolution des doublons** — Comparer côte à côte, choisir, fusionner en lot. |
| BIB-19 | P2 | M | composant | bibliotheque.html | **Vue étagère et vue tableau** — Dos de livres ; tableau à colonnes choisies et triables. |
| BIB-20 | P2 | S | fonction | bibliotheque.html | **Archiver au lieu de retirer** — Hors des vues et des vérifications, progression conservée. |
| BIB-21 | P2 | M | fonction | bibliotheque.html | **Rappels par série** — « Reprends dans deux semaines », « attends dix chapitres ». |
| BIB-22 | P3 | L | fonction | bibliotheque.html | **Rangement proposé automatiquement** — Catégories suggérées d'après les genres et les habitudes, toujours validées à la main. |

### 17.4 Fiche série

La page où l'on décide quoi lire : plus de contrôle sur les chapitres, plus de contexte sur l'œuvre.

| Réf. | Priorité | Effort | Type | Où | Élément |
|---|:---:|:---:|---|---|---|
| FIC-01 | P1 | M | composant | serie.html | **Sélection multiple de chapitres** — Marquer lu ou non lu, télécharger, supprimer ; maintenir Maj pour une plage. |
| FIC-02 | P1 | S | bouton | serie.html | **« Lu jusqu'ici »** — Marquer ce chapitre et tous les précédents (le lecteur de romans le fait déjà). |
| FIC-03 | P1 | M | fonction | serie.html | **Filtrer et préférer une équipe de traduction** — Choix par série, masquage des autres. |
| FIC-04 | P1 | M | fonction | serie.html | **Dédoublonner les chapitres** — Un seul exemplaire par numéro, selon la langue et l'équipe préférées ; signaler les numéros manquants. |
| FIC-05 | P1 | S | composant | serie.html | **Filtres de chapitres** — Non lus, téléchargés, avec signet ; mémorisés par série. |
| FIC-06 | P1 | S | composant | serie.html | **Recherche et saut à un numéro** — Indispensable sur 1 000 chapitres ; liste virtualisée. |
| FIC-07 | P1 | S | bouton | serie.html | **Rafraîchir cette série** — Avec date de dernière vérification et résultat. |
| FIC-08 | P1 | M | composant | serie.html | **État de la source et bascule en un geste** — « Cette source ne répond pas — lire sur une autre » avec correspondance des chapitres. |
| FIC-09 | P1 | M | fonction | serie.html | **Réglages de lecture propres à la série** — Sens, ajustement, fond, recadrage (le mode est déjà mémorisé). |
| FIC-10 | P2 | M | composant | serie.html | **Prochaine sortie estimée** — D'après le rythme déjà calculé ; compte à rebours. |
| FIC-11 | P2 | M | fonction | serie.html | **Titres alternatifs, auteurs, dessinateurs, éditeur, magazine** — Chaque nom cliquable. |
| FIC-12 | P2 | M | composant | serie.html | **Galerie des couvertures par tome** — Avec zoom. |
| FIC-13 | P2 | M | composant | serie.html | **Relations de l'œuvre** — Suite, préquelle, adaptation, anime, roman d'origine. |
| FIC-14 | P2 | S | composant | serie.html | **Ma note, mon avis et mes dates** — Début, fin, relectures, au même endroit. |
| FIC-15 | P2 | M | composant | serie.html | **Notes du carnet liées à la série** — Avec les signets, dans un onglet. |
| FIC-16 | P3 | L | fonction | serie.html | **Résumé « où en étais-je » sans spoiler** — Construit localement à partir de ses propres notes et citations. |

### 17.5 Lecteur de mangas

Là où se passe l'essentiel du temps. Mihon est la référence à égaler, puis à dépasser.

| Réf. | Priorité | Effort | Type | Où | Élément |
|---|:---:|:---:|---|---|---|
| LEC-01 | P0 | M | fonction | chapitre.html | **Planche en échec : réessayer, changer de source, signaler** — Un seul écran d'erreur utile par planche, avec relance de toutes les planches manquantes. |
| LEC-02 | P1 | M | composant | chapitre.html | **Zones de tape configurables** — Gabarits (L, bords, Kindle, désactivé), inversion, aperçu à la première ouverture. |
| LEC-03 | P1 | M | composant | chapitre.html | **Menu d'une planche** — Appui long : enregistrer, partager, copier, définir comme couverture, recharger, signaler. |
| LEC-04 | P1 | M | composant | chapitre.html | **Tiroir des chapitres** — Passer à n'importe quel chapitre sans quitter le lecteur. |
| LEC-05 | P1 | S | composant | chapitre.html | **Grille de toutes les planches** — Aperçu d'ensemble et saut. |
| LEC-06 | P1 | S | composant | chapitre.html | **Horloge, batterie et temps restant en plein écran** — Incrustation discrète, désactivable. |
| LEC-07 | P1 | S | fonction | chapitre.html | **Filtres de couleur** — Niveaux de gris, inversion, contraste, saturation, netteté. |
| LEC-08 | P1 | S | fonction | chapitre.html | **Ignorer les chapitres déjà lus ou en double** — Pendant l'enchaînement. |
| LEC-09 | P1 | S | fonction | chapitre.html | **Seuil de « lu » réglable** — Dernière planche, 90 %, ou manuel. |
| LEC-10 | P1 | S | fonction | chapitre.html | **Préchargement réglable** — Nombre de planches d'avance ; désactivé sur connexion mesurée. |
| LEC-11 | P1 | M | fonction | chapitre.html | **Défilement continu fiable sur planches très hautes** — Découpage des bandes géantes, mémoire bornée. |
| LEC-12 | P1 | S | fonction | chapitre.html | **Décalage de la double page** — Réaligner les planches quand la couverture fausse la paire. |
| LEC-13 | P2 | M | fonction | chapitre.html | **Lecture guidée case par case** — Détection des cases locale, parcours dans le sens de lecture. |
| LEC-14 | P2 | L | fonction | chapitre.html | **Agrandissement de qualité des scans pauvres** — Modèle local (WebGPU) ou sur le hub, avec comparaison avant/après. |
| LEC-15 | P2 | L | fonction | chapitre.html | **Reconnaissance de texte sur la planche** — Sélectionner une bulle, copier, chercher. |
| LEC-16 | P2 | L | fonction | chapitre.html | **Traduction à la demande d'une bulle** — Moteur local (LibreTranslate) ; rien n'est envoyé sans accord explicite. |
| LEC-17 | P2 | M | fonction | chapitre.html | **Dictionnaire japonais/coréen/chinois** — Définition et lecture au toucher, mots enregistrés dans le carnet. |
| LEC-18 | P2 | M | fonction | chapitre.html | **Manette et télécommande** — Tourner, zoomer, changer de chapitre. |
| LEC-19 | P2 | M | fonction | chapitre.html | **Mode encre électronique** — Sans animations, contraste fort, rafraîchissement par page. |
| LEC-20 | P2 | S | composant | chapitre.html | **Transitions de page au choix** — Aucune, glissement, fondu ; respect de « réduire les animations ». |
| LEC-21 | P2 | M | fonction | chapitre.html | **Recherche de la source d'une planche meilleure** — Comparer la résolution entre sources et proposer la meilleure. |
| LEC-22 | P3 | XL | fonction | chapitre.html | **Ambiance sonore liée à la lecture** — La musique d'ambiance suit le genre ou la série. |

### 17.6 Lecteur de romans et de livres

Pour rivaliser avec les meilleures liseuses, pas seulement avec les lecteurs de mangas.

| Réf. | Priorité | Effort | Type | Où | Élément |
|---|:---:|:---:|---|---|---|
| ROM-01 | P1 | L | fonction | lecture.html | **Surlignages en couleurs et annotations persistants** — Sur romans et EPUB, avec liste, export et reprise au passage. |
| ROM-02 | P1 | M | composant | lecture.html | **Barre au toucher d'un passage** — Surligner, annoter, citer, définir, traduire, partager. |
| ROM-03 | P1 | M | fonction | lecture.html | **Dictionnaire intégré** — Dictionnaires hors ligne téléchargeables. |
| ROM-04 | P1 | S | fonction | lecture.html | **Marges, espacement des paragraphes, justification et césure** — Réglages manquants. |
| ROM-05 | P1 | S | fonction | lecture.html | **Polices supplémentaires dont une pour la dyslexie** — Et import de ses propres polices. |
| ROM-06 | P1 | M | composant | lecture.html | **Choix de la voix, vitesse, hauteur et minuterie de lecture vocale** — Mémorisés par langue. |
| ROM-07 | P1 | M | fonction | lecture.html | **Lecture vocale écran éteint** — Contrôles sur l'écran verrouillé, enchaînement des chapitres (service Android). |
| ROM-08 | P1 | M | fonction | lecture.html | **Nettoyage des publicités et notes de la source** — Règles par source et par série. |
| ROM-09 | P1 | M | composant | lecture.html | **Table des matières latérale avec avancement** — Chapitres lus, téléchargés, annotés. |
| ROM-10 | P2 | M | fonction | lecture.html | **Temps restant dans le chapitre et le livre** — D'après sa propre vitesse. |
| ROM-11 | P2 | M | fonction | lecture.html | **Remplacements personnalisés** — Renommer un personnage mal traduit. |
| ROM-12 | P2 | M | fonction | lecture.html | **CSS et scripts personnels** — Réservé au bureau, avec bouton de remise à zéro. |
| ROM-13 | P2 | M | fonction | lecture.html | **Notes de bas de page en bulle** — Sans perdre sa place. |
| ROM-14 | P2 | S | fonction | lecture.html | **Règle de lecture et lecture bionique** — Aides à la concentration. |
| ROM-15 | P2 | L | fonction | lecture.html | **Voix neuronales hors ligne** — Moteur local sur le hub, mise en cache audio par chapitre. |
| ROM-16 | P2 | L | fonction | lecture.html | **Traduction d'un chapitre** — Moteur local, original et traduction côte à côte. |
| ROM-17 | P3 | XL | fonction | lecture.html | **Carnet de personnages construit au fil de la lecture** — Façon « X-Ray », local et sans spoiler au-delà de la page lue. |

### 17.7 Fichiers personnels et formats

Devenir la bibliothèque de tout ce qu'on possède, pas seulement de ce que les sources offrent.

| Réf. | Priorité | Effort | Type | Où | Élément |
|---|:---:|:---:|---|---|---|
| FMT-01 | P1 | M | fonction | import.html | **CBR, CB7 et CBT** — Aujourd'hui refusés avec « convertis-le en CBZ ». |
| FMT-02 | P1 | L | fonction | parametres.html | **Dossier surveillé** — Pointer un dossier : indexation, séries et tomes détectés, mise à jour automatique. |
| FMT-03 | P1 | M | fonction | import.html | **Lire ComicInfo.xml et les métadonnées EPUB** — Série, numéro, auteurs, genres. |
| FMT-04 | P1 | M | fonction | import.html | **Import de dossiers entiers avec file et reprise** — Progression par fichier, doublons ignorés. |
| FMT-05 | P1 | M | page | localreader | **Fiche d'un fichier importé** — Couverture, métadonnées modifiables, série, notes — comme une œuvre en ligne. |
| FMT-06 | P2 | M | fonction | import.html | **MOBI, AZW3 et FB2** — Conversion sur le hub. |
| FMT-07 | P2 | M | fonction | import.html | **DOCX, Markdown et texte** — Pour ses propres lectures. |
| FMT-08 | P2 | L | fonction | import.html | **Livres audio (M4B, MP3)** — Chapitres, vitesse, reprise synchronisée. |
| FMT-09 | P2 | M | fonction | import.html | **Recherche automatique de métadonnées et de couvertures** — AniList, MangaUpdates, Open Library, avec validation. |
| FMT-10 | P2 | S | bouton | import.html | **Exporter ses fichiers et renommer en lot** — Gabarit « Série v01 ». |
| FMT-11 | P3 | L | fonction | lecture.html | **Lecture et écoute synchronisées** — Passer du texte à l'audio au même endroit. |

### 17.8 Découverte et recherche

Trouver la prochaine lecture sans dépendre d'un service qui profile.

| Réf. | Priorité | Effort | Type | Où | Élément |
|---|:---:|:---:|---|---|---|
| DEC-01 | P1 | M | page | calendrier.html | **Calendrier des sorties** — Semaine et mois, mes séries, estimations, export vers l'agenda. |
| DEC-02 | P1 | M | composant | recherche.html | **Filtres avancés sur la recherche globale** — Genres inclus et exclus, statut, année, langue, type, source. |
| DEC-03 | P1 | M | page | auteur.html | **Page d'un auteur** — Toutes ses œuvres, toutes sources. |
| DEC-04 | P1 | S | page | genre.html | **Page d'un genre ou d'un thème** — Populaires, récents, non lus. |
| DEC-05 | P1 | S | bouton | catalogue.html | **« Pas intéressé » et masquage de genres** — Appliqués partout. |
| DEC-06 | P1 | S | bouton | recherche.html | **Coller une adresse pour ouvrir l'œuvre** — Reconnaître les liens des sites des sources. |
| DEC-07 | P1 | M | composant | catalogue.html | **Aperçu rapide** — Résumé, genres, chapitres, bouton Ajouter, sans quitter la grille. |
| DEC-08 | P2 | M | fonction | recherche.html | **Recherches enregistrées et alertes** — « Préviens-moi d'une nouveauté seinen terminée ». |
| DEC-09 | P2 | M | fonction | accueil.html | **Rayons composables** — Choisir, ordonner et masquer les rayons de l'accueil. |
| DEC-10 | P2 | M | page | tendances.html | **Nouveautés et saisons** — Adaptations en anime, nouveautés par source. |
| DEC-11 | P2 | L | fonction | recherche.html | **Recherche par le sens** — « Une histoire de cuisine dans un monde de fantasy », calculée localement. |
| DEC-12 | P2 | L | fonction | recherche.html | **Retrouver une œuvre à partir d'une planche** — Empreinte d'image comparée à sa bibliothèque et aux couvertures. |
| DEC-13 | P3 | L | fonction | accueil.html | **Parcours de lecture proposés** — Classiques d'un genre, dans l'ordre, avec progression. |

### 17.9 Sources et extensions

La partie la plus fragile : ce qui la rendrait solide et ouverte.

| Réf. | Priorité | Effort | Type | Où | Élément |
|---|:---:|:---:|---|---|---|
| SRC-01 | P0 | L | fonction | serveur | **Isoler les extensions** — Processus séparé, droits déclarés (hôtes réseau), mémoire et durée bornées. Aujourd'hui, une extension a tous les droits du serveur. |
| SRC-02 | P1 | M | fonction | sources.html | **Dépôts d'extensions tiers** — Ajouter une adresse de dépôt, clé de signature affichée, mises à jour liées au dépôt d'origine. |
| SRC-03 | P1 | L | page | extensions.html | **Boutique d'extensions** — Recherche, langue, type, contenu (sûr, mixte, 18+), santé mesurée, journal des versions. |
| SRC-04 | P1 | M | fonction | sources.html | **Réglages propres à chaque source** — Langue, qualité, miroir, identifiants, fréquence. |
| SRC-05 | P1 | M | fonction | sources.html | **Changement de domaine sans mise à jour** — Adresse modifiable et proposée quand le certificat ou le domaine tombe. |
| SRC-06 | P1 | M | composant | sources.html | **Historique de santé** — Courbe de disponibilité, dernière panne, cause en français. |
| SRC-07 | P1 | S | bouton | sources.html | **Ouvrir dans le navigateur intégré** — Pour passer soi-même un contrôle demandé par le site, sans le contourner. |
| SRC-08 | P1 | M | fonction | serveur | **Repli automatique entre sources** — Chapitre absent ou en panne : proposer la même œuvre ailleurs. |
| SRC-09 | P1 | M | fonction | extensions | **Nouvelles sources francophones et officielles** — Éditeurs et plateformes légales avec API publique en priorité. |
| SRC-10 | P2 | M | plateforme | outils | **Kit de développement d'extensions** — Commande de création, tests contre captures enregistrées, documentation interactive. |
| SRC-11 | P2 | M | fonction | serveur | **Contrôle quotidien des sources** — Alerte avant que le lecteur ne s'en aperçoive. |
| SRC-12 | P2 | M | fonction | sources.html | **Source « mes serveurs »** — Komga, Kavita, Suwayomi, OPDS comme sources. |

### 17.10 Téléchargements et hors-ligne

Prendre le train sans y penser.

| Réf. | Priorité | Effort | Type | Où | Élément |
|---|:---:|:---:|---|---|---|
| DL-01 | P1 | M | fonction | downloads.html | **Téléchargement automatique des nouveaux chapitres** — Par série ou catégorie, nombre d'avance conservé. |
| DL-02 | P1 | S | fonction | downloads.html | **Supprimer après lecture** — Immédiat, après N chapitres, sauf signets. |
| DL-03 | P1 | S | fonction | parametres.html | **Conditions de téléchargement** — Wi-Fi seulement, en charge, plage horaire. |
| DL-04 | P1 | M | composant | downloads.html | **File ordonnable** — Priorité, glisser-déposer, tout mettre en pause, reprendre les échecs. |
| DL-05 | P1 | M | composant | downloads.html | **Tableau de l'espace occupé** — Par série et par source, tri par poids, nettoyage assisté. |
| DL-06 | P1 | M | fonction | android | **Stockage sur carte SD et dossier choisi** — Fichiers CBZ réutilisables. |
| DL-07 | P1 | M | fonction | android | **Téléchargement en tâche de fond fiable** — Notification de progression, reprise après redémarrage. |
| DL-08 | P2 | S | bouton | downloads.html | **Exporter plusieurs séries en CBZ** — En un lot, avec ComicInfo. |
| DL-09 | P2 | M | fonction | downloads.html | **Valise de voyage** — « Remplis 2 Go avec ce que je lirai probablement ». |
| DL-10 | P2 | M | fonction | global | **Mode hors-ligne complet** — Recherche, statistiques, notes et listes utilisables sans hub, synchronisés ensuite. |
| DL-11 | P1 | M | fonction | global | **File d’attente pour tous les gestes hors ligne** — Favoris, signets, notes et listes rejoués au retour, avec l’état visible. |
| DL-12 | P1 | S | composant | global | **« Nouvelle version prête — Recharger »** — À l’installation d’une mise à jour de l’application. |
| DL-13 | P1 | S | composant | global | **Bandeau « hors ligne » commun** — Sur chaque page, avec ce qui reste possible. |

### 17.11 Mises à jour et notifications

Savoir ce qui sort, sans bruit.

| Réf. | Priorité | Effort | Type | Où | Élément |
|---|:---:|:---:|---|---|---|
| MAJ-01 | P1 | M | page | mises-a-jour.html | **Page dédiée aux nouveautés** — Fil chronologique, groupé par jour, tout télécharger, tout marquer lu. |
| MAJ-02 | P1 | S | fonction | parametres.html | **Heures calmes et résumé groupé** — Une notification par jour au choix. |
| MAJ-03 | P1 | S | composant | serie.html | **Priorité par série** — Immédiate, groupée, silencieuse. |
| MAJ-04 | P1 | M | fonction | parametres.html | **Choix des catégories à vérifier et de la fréquence** — Par catégorie, avec conditions réseau. |
| MAJ-05 | P2 | M | intégration | serveur | **Webhooks, ntfy, Gotify, Discord, Telegram, courriel** — Canaux au choix, bouton « Envoyer un essai ». |
| MAJ-06 | P2 | S | intégration | serveur | **Flux RSS et agenda ICS privés** — Adresse à jeton, révocable. |
| MAJ-07 | P2 | S | composant | notifications.html | **Reporter et archiver** — « Me le rappeler ce soir ». |

### 17.12 Suivi et services tiers

Mihon 0.21 suit AniList, Bangumi, Kitsu, MangaUpdates, Shikimori, Hikka, MangaBaka et d'autres ; Inko n'en synchronise qu'un.

| Réf. | Priorité | Effort | Type | Où | Élément |
|---|:---:|:---:|---|---|---|
| SUI-01 | P1 | L | intégration | parametres.html | **MyAnimeList en synchronisation** — Pas seulement l'import d'un fichier. |
| SUI-02 | P1 | M | intégration | parametres.html | **MangaUpdates, Kitsu, Shikimori, Bangumi, MangaBaka** — Même interface pour tous. |
| SUI-03 | P1 | M | composant | serie.html | **Fenêtre de suivi sur la fiche** — Statut, chapitre, volume, note, dates, relectures, par service. |
| SUI-04 | P1 | M | fonction | bibliotheque.html | **Association en lot** — Proposer les correspondances, valider d'un coup. |
| SUI-05 | P1 | M | page | synchro-suivi | **Tableau des écarts** — Ce qui diffère entre Inko et chaque service, choisir le sens. |
| SUI-06 | P2 | M | fonction | serveur | **File de synchronisation avec reprise** — Visible, rejouable, respectant les limites. |
| SUI-07 | P2 | M | intégration | parametres.html | **Hardcover, Open Library, Goodreads (import)** — Pour les romans et les livres. |

### 17.13 Journal et statistiques

Inko est déjà en avance ; voici ce qui en ferait un argument à lui seul.

| Réf. | Priorité | Effort | Type | Où | Élément |
|---|:---:|:---:|---|---|---|
| STA-01 | P1 | S | bouton | stats.html | **Exporter ses statistiques (CSV, JSON)** — La route d'export d'historique existe. |
| STA-02 | P1 | M | composant | stats.html | **Période libre et comparaison** — Mois contre mois, année contre année. |
| STA-03 | P1 | M | composant | stats.html | **Temps par série, source, genre et auteur** — Avec tableaux accessibles. |
| STA-04 | P1 | M | page | historique.html | **Historique complet** — Chronologie, recherche, suppression ciblée, reprise. |
| STA-05 | P2 | M | page | retrospective.html | **Rétrospective annuelle illustrée** — Cartes à partager, générées localement. |
| STA-06 | P2 | M | fonction | stats.html | **Vitesse de lecture et temps pour rattraper** — « Il te reste 6 h sur cette série ». |
| STA-07 | P2 | M | fonction | notes.html | **Export du journal vers Obsidian et Readwise** — Au-delà du Markdown actuel : synchronisation d'un dossier. |
| STA-08 | P2 | M | composant | notes.html | **Images et captures de planche dans les notes** — Avec renvoi à la page. |
| STA-09 | P2 | S | fonction | stats.html | **Objectifs multiples** — Chapitres, heures, séries terminées, par type. |
| STA-10 | P3 | L | fonction | notes.html | **Cartes de révision pour les mots rencontrés** — Répétition espacée. |

### 17.14 Partage et vie de famille

Social à l'échelle d'une maison ou d'un cercle, jamais un réseau public imposé.

| Réf. | Priorité | Effort | Type | Où | Élément |
|---|:---:|:---:|---|---|---|
| SOC-01 | P0 | M | fonction | profil.html | **Réglages de confidentialité du profil** — Privé par défaut ; choisir ce qui est visible. |
| SOC-02 | P1 | M | composant | serie.html | **Commentaires par chapitre masqués tant qu'on n'y est pas** — L'ancrage et le marqueur de spoiler existent déjà. |
| SOC-03 | P1 | M | composant | liste.html | **Partager une liste par lien et QR, la copier chez soi** — Bouton « Ajouter à ma bibliothèque ». |
| SOC-04 | P2 | M | fonction | profil.html | **Recommander à un membre du foyer** — Avec un mot, dans ses notifications. |
| SOC-05 | P2 | M | fonction | collections.html | **Listes à plusieurs mains** — Droits de lecture ou d'écriture. |
| SOC-06 | P2 | M | composant | accueil.html | **Activité du foyer** — « Alex a terminé Berserk », désactivable par chacun. |
| SOC-07 | P2 | S | composant | serie.html | **Réactions sur une planche** — Visibles après lecture. |
| SOC-08 | P3 | L | fonction | chapitre.html | **Lecture à deux, synchronisée** — Même page sur deux écrans. |
| SOC-09 | P3 | M | fonction | profil.html | **Clubs de lecture** — Rythme commun, discussion par arc. |

### 17.15 Données, sauvegarde et synchronisation

La promesse « ta bibliothèque t'appartient » doit être tenue à la ligne près.

| Réf. | Priorité | Effort | Type | Où | Élément |
|---|:---:|:---:|---|---|---|
| SAU-01 | P0 | L | réparation | serveur | **Sauvegarde et export complets** — Signets, notes du carnet, temps de lecture, historique, liens AniList, listes, réglages, dates d'ajout : une seule liste de tables, vérifiée par un test. |
| SAU-02 | P0 | M | réparation | serveur | **Import qui rétablit tout ce que l'export contient** — Les listes et les réglages exportés sont ignorés à l'import. |
| SAU-03 | P1 | M | composant | parametres.html | **Aperçu détaillé avant restauration** — Ce qui sera ajouté, modifié, ignoré ; choix par catégorie ; fusion ou remplacement. |
| SAU-04 | P1 | M | intégration | parametres.html | **Sauvegarde vers WebDAV, Nextcloud, S3, Drive** — Chiffrée avant l'envoi. |
| SAU-05 | P1 | S | composant | accueil.html | **Alerte « aucune sauvegarde depuis N jours »** — Avec un bouton « Sauvegarder maintenant ». |
| SAU-06 | P1 | M | fonction | import.html | **Importer une sauvegarde Mihon ou Tachiyomi** — La porte d'entrée la plus utile pour de nouveaux utilisateurs. |
| SAU-07 | P1 | M | page | assistant | **Déménager d'un PC ou d'un hub à un autre** — Assistant pas à pas, vérification à l'arrivée. |
| SAU-08 | P2 | M | fonction | serveur | **Versions horodatées et retour en arrière** — Restaurer la bibliothèque d'un jour précis. |
| SAU-09 | P2 | L | fonction | serveur | **Synchronisation entre deux hubs** — PC de la maison et NAS, avec résolution de conflits. |
| SAU-10 | P2 | S | bouton | parametres.html | **Exporter en CSV** — Pour tableur. |
| SAU-11 | P2 | M | fonction | serveur | **Vérifier chaque sauvegarde en la restaurant à blanc** — Une sauvegarde non relue n'en est pas une. |

### 17.16 Ouverture et intégrations

Komga documente OPDS v1/v2 et la synchronisation Kobo ; Inko ne parle encore à aucune liseuse.

| Réf. | Priorité | Effort | Type | Où | Élément |
|---|:---:|:---:|---|---|---|
| INT-01 | P1 | L | intégration | serveur | **Serveur OPDS 1.2 et 2.0** — Lire sa bibliothèque depuis KOReader, Panels, Moon+. |
| INT-02 | P1 | L | intégration | serveur | **Synchronisation KOReader** — Progression partagée avec la liseuse. |
| INT-03 | P1 | M | fonction | parametres.html | **Jetons d'API personnels** — Portée et expiration choisies, révocables. |
| INT-04 | P1 | M | page | api.html | **Documentation d'API consultable** — openapi.json est servi mais aucun écran ne le montre. |
| INT-05 | P2 | XL | intégration | serveur | **Synchronisation Kobo native** — La liseuse voit Inko comme sa boutique. |
| INT-06 | P2 | M | intégration | serveur | **Envoyer vers Kindle ou liseuse par courriel** — Avec conversion. |
| INT-07 | P2 | M | intégration | navigateur | **Extension « Ajouter à Inko »** — Depuis la page d'une œuvre. |
| INT-08 | P2 | S | intégration | bureau | **Présence Discord** — Désactivée par défaut. |
| INT-09 | P2 | M | intégration | serveur | **Intégration Home Assistant** — Compteur de non-lus, lampe de lecture. |
| INT-10 | P3 | L | intégration | serveur | **Serveur compatible avec l'API Komga** — Réutiliser les applications existantes. |

### 17.17 Plateformes et distribution

Être partout, et s'installer sans avertissement inquiétant.

| Réf. | Priorité | Effort | Type | Où | Élément |
|---|:---:|:---:|---|---|---|
| PLT-01 | P0 | M | plateforme | windows | **Signer l'installeur Windows** — Fin de « éditeur inconnu » et condition d'une mise à jour sûre. |
| PLT-02 | P0 | M | plateforme | android | **Signer l'APK avec une clé de production** — La chaîne existe, la clé manque ; indispensable avant toute diffusion. |
| PLT-03 | P1 | M | plateforme | android | **Publier sur F-Droid et en dépôt Obtainium** — Mises à jour automatiques. |
| PLT-04 | P1 | L | plateforme | bureau | **Versions macOS et Linux** — Tauri le permet ; signature et notarisation à prévoir. |
| PLT-05 | P1 | M | plateforme | docker | **Images publiées amd64 et arm64** — Avec notice Synology, Unraid, Raspberry Pi. |
| PLT-06 | P1 | M | fonction | bureau | **Ouvrir un CBZ ou un EPUB d'un double-clic** — Associations de fichiers et glisser-déposer sur la fenêtre. |
| PLT-07 | P1 | M | fonction | bureau | **Liens inko:// et notifications système** — Ouvrir une série depuis un lien ou une notification. |
| PLT-08 | P1 | M | plateforme | windows | **Mise à jour différentielle avec retour arrière** — Canal stable et bêta. |
| PLT-09 | P2 | M | plateforme | windows | **Version portable** — Sur clé USB. |
| PLT-10 | P2 | L | plateforme | ios | **Application iPhone et iPad** — Capacitor, TestFlight ; la PWA en attendant. |
| PLT-11 | P2 | L | plateforme | tv | **Mode télévision** — Navigation à la télécommande, grandes cartes. |
| PLT-12 | P2 | M | plateforme | android | **Widgets supplémentaires** — Nouveautés, objectif, file « à lire ensuite ». |
| PLT-13 | P2 | S | plateforme | android | **Raccourcis d'icône et tuile rapide** — Reprendre, mode invité. |
| PLT-14 | P2 | M | plateforme | liseuse | **Interface allégée pour liseuses** — Sans animations, gros contrôles. |
| PLT-15 | P3 | M | plateforme | montre | **Compagnon montre** — Tourner les pages, minuterie. |

### 17.18 Accessibilité et langues

Une application « meilleure que tout » se lit par tout le monde.

| Réf. | Priorité | Effort | Type | Où | Élément |
|---|:---:|:---:|---|---|---|
| A11-01 | P1 | L | fonction | global | **Interface anglaise complète** — Y compris infobulles, libellés accessibles et messages d'erreur du serveur. |
| A11-02 | P1 | L | fonction | global | **Espagnol, portugais, allemand, italien** — Fichiers de traduction ouverts aux contributions. |
| A11-03 | P1 | M | fonction | global | **Taille de l'interface réglable** — 90 à 150 %, sans casser la mise en page. |
| A11-04 | P1 | S | composant | parametres.html | **Réduire les animations, au choix dans l'application** — En plus du réglage du système. |
| A11-05 | P1 | M | fonction | global | **Cibles de 44 px partout au doigt** — Voir les relevés des sondes mobile. |
| A11-06 | P2 | L | fonction | global | **Japonais, chinois, coréen, arabe (droite à gauche)** — Mise en page miroir. |
| A11-07 | P2 | L | fonction | chapitre.html | **Description des planches pour lecteur d'écran** — Texte reconnu lu à voix haute, case par case. |
| A11-08 | P2 | S | composant | parametres.html | **Palettes pour daltoniens** — Et motifs sur les graphiques. |
| A11-09 | P3 | L | fonction | global | **Commandes vocales** — « Page suivante », « reprendre ». |

### 17.19 Confidentialité et sécurité visibles

Faire de la confiance une fonction qu'on voit.

| Réf. | Priorité | Effort | Type | Où | Élément |
|---|:---:|:---:|---|---|---|
| CNF-01 | P0 | S | réparation | serveur | **Ne jamais renvoyer un jeton de réinitialisation à un appareil distant** — Voir les failles critiques. |
| CNF-02 | P0 | S | réparation | serveur | **Secret de signature tiré au sort dans tous les cas** — Plus de secret de repli écrit dans le code. |
| CNF-03 | P0 | S | réparation | bibliotheque.html | **Échapper tout identifiant affiché** — Injection exécutée prouvée par la sonde. |
| CNF-04 | P0 | M | réparation | localreader.html | **Assainir les livres importés par liste blanche** — Quatre techniques de contournement prouvées ; affichage dans un cadre isolé. |
| CNF-05 | P0 | S | réparation | serveur | **Ne plus forcer le https sur un hub en http** — Sinon l’interface ne se charge depuis aucun autre appareil. |
| CNF-06 | P1 | M | page | confidentialite | **Tableau « ce qui sort de ta machine »** — Chaque hôte contacté, dernier appel, interrupteur. |
| CNF-07 | P1 | M | fonction | parametres.html | **Proxy, DNS chiffré et réseau par source** — Choix explicite, sans contournement des protections des sites. |
| CNF-08 | P1 | M | fonction | parametres.html | **Mode strict : aucune requête directe** — Tout passe par le hub. |
| CNF-09 | P2 | M | fonction | serveur | **Chiffrement de la base et des imports au repos** — Clé liée à la session Windows. |
| CNF-10 | P2 | M | fonction | serveur | **HTTPS automatique sur le réseau local** — Certificat appairé avec le QR. |
| CNF-11 | P2 | S | bouton | parametres.html | **« Effacer mes traces »** — Historique, recherches, cache, en un geste documenté. |

### 17.20 Installation, exploitation et aide

Qu'une personne non technique réussisse seule, du premier lancement à la panne.

| Réf. | Priorité | Effort | Type | Où | Élément |
|---|:---:|:---:|---|---|---|
| HUB-01 | P1 | L | page | bienvenue.html | **Assistant de premier lancement** — Langue, thème, sources, import (Mihon, MAL, fichiers), sauvegarde, appareil mobile. |
| HUB-02 | P1 | M | page | aide.html | **Centre d'aide dans l'application** — Recherche, pannes courantes, « copier mon diagnostic ». |
| HUB-03 | P1 | S | page | nouveautes.html | **« Quoi de neuf » après une mise à jour** — Avec captures, consultable ensuite. |
| HUB-04 | P1 | S | page | 404.html | **Page introuvable utile** — Recherche et retour. |
| HUB-05 | P1 | M | composant | systeme.html | **Journal du serveur lisible et exportable** — Filtres, sans données personnelles. |
| HUB-06 | P1 | M | composant | systeme.html | **Santé et réparations en un bouton** — Base, disque, sources, certificats, sauvegardes, versions. |
| HUB-07 | P1 | S | composant | parametres.html | **« Où sont mes données »** — Dossiers de la base, des sauvegardes et des fichiers, bouton pour les ouvrir et les copier. |
| HUB-08 | P2 | M | fonction | serveur | **Métriques Prometheus et alerte disque** — Pour les hubs. |
| HUB-09 | P2 | M | fonction | bureau | **Rapport de plantage local** — Rien n'est envoyé sans accord. |
| HUB-10 | P2 | S | bouton | parametres.html | **Réinitialiser un réglage, une page, tout** — Avec aperçu. |
| HUB-11 | P2 | M | plateforme | site | **Site de présentation et documentation** — Démonstration en ligne sans données. |

### 17.21 Composants d'interface à unifier

Un seul composant par besoin, réutilisé partout : c'est ce qui supprime des familles entières de défauts relevés par les sondes.

| Réf. | Priorité | Effort | Type | Où | Élément |
|---|:---:|:---:|---|---|---|
| DS-01 | P0 | M | composant | global | **État d'erreur avec « Réessayer » sur chaque zone chargée** — Aujourd'hui, plusieurs pages restent muettes quand l'API tombe. |
| DS-02 | P0 | M | composant | global | **Squelette de chargement borné dans le temps** — Jamais d'attente sans fin. |
| DS-03 | P0 | S | composant | global | **Image avec repli, nouvel essai et proportions réservées** — Plus de décalage ni de case cassée. |
| DS-04 | P1 | M | composant | global | **Une seule fenêtre modale et une seule feuille mobile** — Focus piégé, Échap, nom accessible, retour du focus. |
| DS-05 | P1 | M | composant | global | **Menu déroulant et menu contextuel** — Clavier complet. |
| DS-06 | P1 | M | composant | global | **Liste virtualisée** — Bibliothèque, chapitres, historique. |
| DS-07 | P1 | S | composant | global | **État vide avec action** — Chaque écran dit quoi faire ensuite. |
| DS-08 | P1 | S | composant | global | **Notifications avec action et file** — Annuler, voir, réessayer. |
| DS-09 | P1 | S | composant | global | **Onglets, puces de filtre, interrupteurs et curseurs communs** — Mêmes tailles tactiles partout. |
| DS-10 | P1 | M | composant | global | **Barre de navigation mobile qui ne masque rien** — Réserve de hauteur automatique. |
| DS-11 | P1 | S | bouton | global | **Retour cohérent et fil d'Ariane** — Depuis chaque page secondaire. |
| DS-12 | P2 | M | composant | global | **Page de référence du design system tenue par des tests** — Chaque composant, chaque état, chaque thème. |

### 17.22 Boutons et réglages manquants, page par page

Les ajouts ponctuels qui ne relèvent pas d'un chantier ci-dessus.

| Réf. | Priorité | Effort | Type | Où | Élément |
|---|:---:|:---:|---|---|---|
| PAGE-01 | P1 | S | bouton | accueil.html | **Personnaliser l'accueil** — Ordre et visibilité des blocs. |
| PAGE-02 | P1 | S | bouton | accueil.html | **Masquer ou terminer une reprise** — Depuis la carte « Reprendre ». |
| PAGE-03 | P1 | S | bouton | catalogue.html | **Mémoriser mes filtres par source** — Et « revenir à la position » au retour. |
| PAGE-04 | P1 | S | bouton | catalogue.html | **Charger la suite avec position conservée** — Retour arrière sans repartir du haut. |
| PAGE-05 | P1 | S | bouton | recherche.html | **Choisir les sources interrogées et annuler** — Par recherche. |
| PAGE-06 | P1 | S | bouton | collections.html | **Trier, chercher, dupliquer, fusionner des listes** — Et couverture composée choisie. |
| PAGE-07 | P1 | S | bouton | collection-detail.html | **Ajouter une œuvre depuis la liste** — Recherche intégrée ; tri ; description modifiable. |
| PAGE-08 | P1 | S | bouton | liste.html | **Copier cette liste chez moi** — Pour un visiteur connecté. |
| PAGE-09 | P1 | S | bouton | notes.html | **Filtrer par humeur, type et date** — Et sélection multiple pour exporter ou supprimer. |
| PAGE-10 | P1 | S | bouton | notifications.html | **Tout supprimer et filtrer par série** — Avec annulation. |
| PAGE-11 | P1 | S | bouton | profil.html | **Voir mon profil comme les autres** — Et le rendre privé au même endroit. |
| PAGE-12 | P1 | S | bouton | downloads.html | **Chercher et trier les téléchargements** — Ouvrir, relire, supprimer en lot. |
| PAGE-13 | P1 | S | bouton | import.html | **Zone de dépôt avec collage d'adresse** — Et file visible. |
| PAGE-14 | P1 | S | bouton | sources.html | **Tester toutes les sources** — Résumé en une vue. |
| PAGE-15 | P1 | S | bouton | stats.html | **Choisir la période et masquer des blocs** — Mémorisé. |
| PAGE-16 | P1 | S | bouton | parametres.html | **Exporter et importer tous les réglages** — Pas seulement l'apparence. |
| PAGE-17 | P1 | S | bouton | comparer.html | **Adopter cette source** — Depuis la comparaison, migrer la série. |
| PAGE-18 | P1 | S | bouton | u.html | **Suivre, copier une liste, signaler** — Selon les droits. |
| PAGE-19 | P1 | S | bouton | systeme.html | **Copier le diagnostic et lancer les réparations** — Depuis la même page. |
| PAGE-20 | P1 | S | bouton | anilist.html | **Page de retour de connexion explicite** — Succès, échec, réessayer, en français. |

### 17.23 Qualité qui rend tout cela tenable

Sans quoi chaque fonction ajoutée en casse deux autres.

| Réf. | Priorité | Effort | Type | Où | Élément |
|---|:---:|:---:|---|---|---|
| ING-01 | P0 | M | fonction | ci | **Exécuter les sondes statiques et de sécurité à chaque demande de fusion** — Échec sur toute trouvaille critique nouvelle. |
| ING-02 | P0 | L | fonction | tests | **Tests de bout en bout des parcours essentiels** — Lire, reprendre, sauvegarder, restaurer, retirer, mettre à jour. |
| ING-03 | P0 | M | fonction | ci | **Essai d’installation neuve avant chaque publication** — Profil vierge, sans MySQL : l’application doit démarrer, se connecter et garder une série. |
| ING-04 | P1 | XL | fonction | front | **Découper les quatre fichiers de plus de 1 200 lignes** — chapitre.js, global.js, bibliotheque.js, serie.js. |
| ING-05 | P1 | L | fonction | front | **Empaquetage et chargement à la demande** — Une partie du JavaScript chargé ne sert pas au démarrage. |
| ING-06 | P1 | L | fonction | serveur | **Valider chaque entrée par un schéma** — Fin des erreurs 500 sur mauvais type. |
| ING-07 | P1 | M | fonction | serveur | **Pagination sur toutes les listes** — Favoris, progression, événements, chapitres lus. |
| ING-08 | P2 | XL | fonction | front | **Passage progressif à TypeScript ou JSDoc vérifié** — Sur api.js et storage.js d'abord. |
| ING-09 | P2 | M | fonction | ci | **Mesure de performance suivie** — Budgets par page, comparaison entre versions. |

