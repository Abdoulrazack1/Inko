### 1.7 Troisième vague : ce qui est livré, le hors-ligne, les fichiers, les autres appareils

Sondes ajoutées : `imports`, `modes`, `hors-ligne`, `livraison`, `mise-a-niveau`, `exactitude`, `appareils`, `administration`, `resilience`, `vie-privee`, `adaptabilite`, `licences`, `autonome`, et sept sondes d'expérience (`ux-*`).

#### 1.7.1 Urgences

#### SEC-28 🔴 Quand SushiScan répond mal, le filtre des contenus pour adultes se désactive · effort S

**Preuve**, rejouée sans réseau avec une source simulée : les pages de genres sont refusées, le catalogue répond ; le titre réservé aux adultes sort dans le catalogue normal, et **y reste après le rétablissement**. **Cause** : l'index des titres à masquer est construit à partir des pages de genres ; chaque échec est avalé, la liste vide ou incomplète est gardée six heures en mémoire et écrite dans le dossier temporaire, relue au redémarrage. Un fichier de ce type, vide, a été trouvé sur cette machine (§1.7.6). **Correctif** : ne jamais garder un index incomplet ; tant qu'il n'est pas complet, ne rien servir de cette source plutôt que tout.

#### SEC-24 🔴 Un livre EPUB piégé exécute du code dans l'application · effort M

**Preuve** : un EPUB fabriqué pour l'essai, ouvert dans le lecteur de fichiers, exécute du JavaScript par quatre voies différentes (section CDATA, commentaire, instruction de traitement, animation SVG). **Cause** : `sanitizeChapter` (`assets/js/localreader.js`) analyse le chapitre comme du XML puis le réinjecte avec `innerHTML`, qui le relit comme du HTML : ces constructions changent de sens entre les deux ; la liste des balises retirées est par ailleurs incomplète. Le script agit avec la session ouverte. **Correctif** : liste blanche de balises et d'attributs en reconstruisant des nœuds (ou une bibliothèque éprouvée), et affichage dans un cadre isolé sans script. **N'ouvrir que des livres dont on connaît la provenance.**

#### OPS-06 🔴 Depuis un autre appareil du réseau, l'interface ne se charge pas · effort S

**Preuve**, application de bureau et configuration de production : depuis l'adresse réseau, en http, aucune page ne fonctionne ; le navigateur réclame chaque fichier en https. **Cause** : la politique de contenu ajoute `upgrade-insecure-requests` (défaut de la bibliothèque `helmet`). Sur la machine elle-même, tout marche, ce qui rend le défaut invisible au développement. **Correctif** : désactiver cette directive tant que le serveur n'est pas derrière HTTPS.

#### OPS-07 🔴 L'image Docker construite depuis un dépôt propre ne contient aucune source · effort S

**Preuve par simulation** (Docker n'est pas installé sur cette machine) : un serveur démarré avec les seuls fichiers d'un clone répond avec zéro source ; `server/extensions/*/` est ignoré par git et le `Dockerfile` ne copie pas `extensions-community/`.

#### OPS-08 🔴 Avec le fichier Docker fourni, personne ne peut entrer · effort L

**Déduit du code** : la connexion automatique reste active mais n'accepte que la boucle locale, et une requête qui traverse le port publié arrive d'une autre adresse (refus rejoué depuis le réseau). Avec `LOCAL_MODE=0`, il n'existe aucun écran de connexion (FON-03). Avec OPS-06 et OPS-07, **le déploiement Docker documenté est inutilisable**.

#### FON-06 🟠 Les commentaires publiés avec la portée par défaut ne sont visibles de personne · effort S

La lecture utilise `authOptional`, qui ne renseigne que `req.userId`, alors que le filtre regarde `req.user` : tout lecteur connecté est traité comme un visiteur. Il ne voit ni les commentaires réservés à l'instance (le défaut) ni les siens ; la modération perd sa vue d'ensemble. **Rejoué** sur une instance à trois comptes.

#### 1.7.2 Données et fichiers

#### DAT-19 🟠 Les fichiers importés ne sont dans aucune sauvegarde · effort M

Ni la sauvegarde automatique ni l'export ne mentionnent la table `local_imports` ou le dossier des fichiers.

#### DAT-20 🟠 Favoris, signets et notes faits sans réseau sont perdus · effort M

**Preuve** : réseau coupé, cinq gestes ; au retour, seuls la progression et les chapitres lus arrivent. Les autres ne sont pas mis en file (`api.js`, `OFFLINE_OK`) et l'écran ne le dit pas.

#### SEC-25 🟠 Un livre peut emmener ailleurs et signaler qu'on le lit · effort S

Un chapitre contenant une redirection fait quitter l'application ; images de fond, vidéos, sons et liens suivis contactent six adresses extérieures à l'ouverture.

#### SEC-26 🟠 Les exports CSV transforment des titres en formules · effort S

Un titre commençant par `=`, `+`, `-` ou `@` sort tel quel : un tableur l'exécute. Les titres viennent des sources et des fichiers importés.

#### SEC-27 🟠 Un téléphone appairé peut appairer d'autres appareils · effort S

Un appareil au rôle « lecteur » obtient un code d'appairage et la liste des sauvegardes. Un téléphone volé peut donc se multiplier avant d'être révoqué. Les routes d'administration, elles, sont bien refusées, et la révocation coupe l'accès immédiatement.

#### 1.7.3 Application installée et mises à jour

#### DSK-07 🟠 La vérification de signature et le téléchargement de secours de la mise à jour sont cassés · effort S

Les deux commandes PowerShell de `update.controller.js`, rejouées à l'identique sur un fichier inoffensif, échouent à l'analyse : avec `-Command`, les arguments sont recollés au texte au lieu d'être passés à `param()`. Seules restent l'empreinte publiée et `curl`.

#### DSK-08 🟠 L'application installée ne reçoit aucun correctif de source entre deux versions · effort M

L'installeur embarque `extensions-community/` et le contrôleur lit ce dossier dès qu'il existe : « Mettre à jour » compare la version installée à la copie livrée avec elle. **Déduit du code et de la configuration du paquet.** La réparation de SushiScan exigera donc une nouvelle version.

#### DSK-09 🟠 Quatre pages de l'application Windows n'ont pas de boutons de fenêtre · effort S

**Preuve** en simulant l'environnement de l'application dans un navigateur : `localreader.html` (la lecture de vos fichiers), `systeme.html`, `confidentialite.html` et `anilist.html` ne reçoivent pas la barre de titre. La fenêtre est configurée sans cadre (`"decorations": false`) et la barre n'est ajoutée que par `MH.initPage`, que ces pages n'appellent pas : impossible d'y réduire, fermer ou déplacer la fenêtre à la souris ; `systeme.html` n'offre en plus aucun lien pour en sortir. **Correctif** : injecter la barre depuis un script chargé par toutes les pages.

#### ROB-05 🟠 Une panne de la base déconnecte l'utilisateur · effort S

**Preuve** : base indisponible, chaque requête authentifiée répond 401 « Token invalide ou expiré » ; l'interface efface alors la session (`api.js`). **Cause** : `authRequired` entoure la vérification du jeton **et** la lecture en base d'un seul `catch`. **Correctif** : ne répondre 401 que si le jeton est refusé, 503 sinon.

#### OPS-10 🟡 Port déjà pris : le serveur annonce qu'il a démarré · effort S

**Preuve** : un second serveur lancé sur un port occupé écrit « Inko backend → http://localhost:… » et reste en vie sans écouter. **Cause** : avec Express 5, la fonction passée à `listen` est aussi appelée en cas d'erreur, et `app.js` ignore son argument. **Correctif** : tester l'erreur, la dire, quitter avec un code non nul.

#### UX-08 🟠 Après un téléchargement réussi, le bouton propose encore « Télécharger », et le toucher efface · effort S

Le bloc `finally` de `chapitre.js` remet l'ancien libellé après le succès ; l'appui suivant supprime le chapitre sans confirmation. La lecture sans réseau, elle, fonctionne.

#### 1.7.4 Expérience

#### A11Y-14 🟠 Les résultats de recherche ne sont pas des liens · effort S

Des `<div>` avec un écouteur de clic : impossibles à ouvrir au clavier, dans un nouvel onglet, ou à annoncer par un lecteur d'écran.

#### UX-09 🟠 Retirer une série à l'unité ne s'annule pas · effort S

La confirmation existe, mais « Annuler » n'a été posé que sur le retrait en lot (parcours joué au bureau et au téléphone).

#### UX-10 🟠 Au téléphone, le bouton Retour quitte la page au lieu de fermer le panneau · effort M

Rejoué sur les réglages du lecteur et sur un menu de la fiche série ; les panneaux de la bibliothèque et du catalogue, eux, se ferment.

#### A11Y-15 🟠 Thème clair : contrastes insuffisants · effort S

Relevés par `parcours` et `pages` sur plusieurs pages ; les couleurs d'accent alternatives en ajoutent ({{id:ACCENT-CONTRASTE}} cas).

#### I18N-05 🟠 L'interface anglaise reste largement en français · effort L

Textes restants sur {{id:ANGLAIS-RESTE-FRANCAIS}} pages ; certains relevés incluent des titres d'œuvres, qui n'ont pas à être traduits.

#### MOB-09 🟠 Des cibles tactiles sous 24 px · effort S

Sur {{id:MOB-CIBLE-24}} pages (minimum WCAG 2.2).

#### MOB-10 🟠 La barre du bas masque des contrôles en fin de page · effort S

#### MOB-11 🟡 En paysage, les barres fixes prennent la moitié de l'écran · effort S

194 px sur 390 sur la plupart des pages.

#### MOB-12 🟡 Des champs sous 16 px font zoomer l'écran sur iPhone · effort S

#### PER-13 🟠 La bibliothèque devient très lente à partir de quelques milliers de séries · effort L

2 000 favoris : 26 577 éléments et 16 s de rendu ; 10 000 : 46 448 éléments, 37 s, filtrage qui bloque près de 3 s. Les interfaces des autres pages tiennent. Liste virtualisée.

#### ROB-04 🟡 Un changement fait sur un autre appareil n'apparaît qu'après rechargement · effort M

#### OPS-09 🟡 Instance partagée : personne n'est administrateur au départ, le dernier peut disparaître · effort S

Le premier compte inscrit a le rôle ordinaire ; le dernier administrateur peut supprimer son compte ; un compte banni obtient encore un jeton à la connexion ; modifier un compte inexistant répond « réussi ».

#### LEC-01 🟡 Échap ne ferme plus les réglages du lecteur après une case ou un curseur · effort S

#### DOC-12 🔵 Deux bibliothèques copiées dans le dépôt ne sont pas citées · effort S

`qrcode` et `three` n'apparaissent ni dans `NOTICE.md` ni dans le README.

#### A11Y-16 🟡 En contraste forcé, on ne voit plus quel choix est actif · effort S

**Preuve** (captures) : onglets de la bibliothèque et de l'accueil tous soulignés pareil, boutons de vue du catalogue identiques, et le libellé de la catégorie sélectionnée « Tout » **disparaît**. **Correctif** : `@media (forced-colors: active)` avec un contour sur l'état actif, sans aplat par-dessus le texte.

#### UX-11 🟡 Un titre hors norme élargit la page · effort S

Un titre long sans espace, ou une description de liste de 2 000 caractères collés, provoque un défilement horizontal à l'accueil, dans le carnet et sur le profil public. `overflow-wrap: anywhere` et `min-width: 0`.

#### UX-12 🟡 « Confidentialité » et « Système » s'affichent sans en-tête · effort S

L'emplacement de l'en-tête est présent mais jamais rempli (`MH.initPage` n'est pas appelé) : plus de navigation, et aucun lien du tout sur la page « Système ». Même cause que DSK-09.

#### SEC-29 🟡 Le navigateur contacte AniList directement ; un hôte du serveur n'est pas déclaré · effort S

La recherche d'illustrations part du navigateur vers `graphql.anilist.co` et charge les images de `s4.anilist.co` : ces services voient l'adresse du lecteur. Côté serveur, `hot.planeptune.us` (images d'une source) ne figure pas dans la page « Confidentialité ».

#### MOB-13 🟡 Sans PC, chaque page relance des appels à SushiScan, et le catalogue n'a qu'une source · effort M

**Preuve** sur l'interface construite pour l'APK : 21 appels à `sushiscan.net` à chaque ouverture de page, parce que les sources sont rechargées et que l'index des titres pour adultes ne peut pas être gardé (voir SEC-28). Le catalogue ne propose que MangaDex : quand elle refuse (depuis ce réseau, défi anti-robot), l'écran affiche « Unexpected token '<' … is not valid JSON ».

#### 1.7.5 Ce qui a tenu

À ne pas casser, éprouvé dans cette vague : mise à niveau depuis les huit versions publiées sans perte (seul un index manque après la 2.3.4) ; statistiques, séries de jours, fuseau, listes intelligentes et compteurs d'écran justes (20 vérifications sur 20) ; refus des fichiers importés au mauvais contenu, quota et isolement entre comptes ; chapitre et roman téléchargés relisibles sans réseau ; installation du service worker complète ; gestes du mode autonome conservés après rechargement ; télécommande et révocation d'appareil ; connexions à la base coupées en pleine activité : reprise immédiate, et les 39 écritures annoncées réussies sont toutes en base ; base disparue : le contrôle de santé répond bien « indisponible » ; 218 gestes au hasard sans une exception ; lecture privée : aucune trace en base.

#### 1.7.6 Deux incidents pendant l'audit

**La base réelle.** La première version de la sonde `mise-a-niveau` a chargé le `schema.sql` de la v2.3.4 sans le filtrer. Ce fichier commence par `USE inko;` : il s'est exécuté **sur la base réelle**. Vérification faite ensuite, en lecture seule : une table vide `library` a été créée (2 index), sept tables ont été reconstruites à l'identique ; aucune colonne, aucun index existant ni aucun nombre de lignes n'a changé. La table n'a pas été supprimée sans accord. Depuis, tout script SQL chargé par une sonde passe par `_garde-sql.js`, qui retire les ordres désignant une base et refuse le script s'il en reste.

**Le dossier temporaire.** Un test de l'application lancé le 25/11 à 21 h 49 (serveur réel démarré par Playwright) a écrit un index **vide** des titres pour adultes, que votre application aurait relu jusqu'à 3 h 49 le 26/11 (conséquence de SEC-28). Le fichier a été copié puis supprimé le 26/11 vers 0 h 25 ; il se reconstruit au prochain démarrage. Les serveurs d'essai des sondes ont désormais leur propre dossier temporaire.
