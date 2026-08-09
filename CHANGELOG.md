# Journal des versions — Inko

Toutes les versions notables de l'application. Les installeurs Windows sont
publiés sur [la page des releases](https://github.com/Abdoulrazack1/Inko/releases).

## 2.5.0 — Remediation complete de l'audit de juillet 2026

Cette version traite l'integralite de la partie « ameliorations » de
l'audit du 28 juillet : 32 domaines fonctionnels, hors interface
d'administration. Chaque lot a ete verifie dans un vrai navigateur, sur
les vraies donnees, et pas seulement par des tests.

**Notations et avis**
- **Demi-etoiles** : la note passe sur 10 et s'affiche en 5 etoiles avec
  demis. Cinq crans, c'etait trop grossier — tout finissait a 4.
- On te propose de noter une serie **au moment ou tu la termines**, une
  seule fois, jamais si tu l'as deja notee.
- Ta note est comparee a la **moyenne AniList** : « 4/5 » ne veut rien
  dire sans point de comparaison.

**Commentaires**
- **Portee explicite** a la publication : moi seul, les membres, ou tout
  le monde. L'interface promettait « prive » pendant que l'API servait
  tout a n'importe quel visiteur — ce n'etait pas un reglage manquant,
  c'etait une promesse fausse.
- Avertissement **spoiler** avec devoilement au clic, et rattachement
  d'un commentaire a un chapitre precis.

**Notifications**
- **Regroupement** : une serie qui publie trois fois occupe une ligne,
  pas trois. Les 110 notifications accumulees ont ete fusionnees en 61.
- **Frequence reglable** (jamais, 4 h, 12 h, 24 h, 3 jours) et **mise en
  sourdine par serie**, sans cesser de la suivre.
- « Lire maintenant » ouvre le premier chapitre **non lu**, plus le
  dernier paru : sur trois chapitres de retard, l'ancien lien faisait
  sauter les deux du milieu.
- Les notifications lues de plus de 30 jours sont effacees.

**Statistiques**
- Repartition de tes lectures **par source et par mois**, sur 12 mois,
  avec la part scans / romans.
- **Retrospective annuelle** copiable dans le presse-papiers.
- Les badges affichent ce qu'il **reste a faire** et nomment le prochain
  palier a portee.
- L'objectif hebdomadaire peut se caler sur **ton rythme reel** (mediane
  des 8 dernieres semaines).

**Profil**
- **Confidentialite par section** : statistiques, listes, series
  epinglees et bibliotheque se reglent separement.
- **Apercu public** : voir son profil exactement comme le voit un
  inconnu.
- **Vitrine de series epinglees**, choisie depuis une fiche.

**Historique**
- **Suppression ciblee** : retirer une serie, ou un seul chapitre, sans
  perdre le reste.
- **Export** de l'historique en CSV ou JSON.
- « Reprendre » rouvre a la **position exacte**, pas au debut du
  chapitre.

**Lecture privee**
- **Bandeau permanent** qui nomme l'etat et se coupe d'un clic : un
  liseré de 3 px ne disait pas ce qui etait actif.
- Couverture etendue : progression, chapitres lus, **activite** et
  **recherches recentes** ne sont plus enregistres.
- **Portee par serie** : masquer une lecture sans couper toute la
  session.

**Premier lancement**
- La visite guidee est **interruptible et reprenable** : quitter posait
  le meme drapeau que terminer.
- **« Refuser » les conditions fait enfin quelque chose** : le choix est
  memorise et respecte, avec une explication et un retour possible.
  Auparavant, recharger la page suffisait a passer outre.
- Chaque page presente son **astuce** a la premiere visite, au lieu de
  sept ecrans avant d'avoir rien vu.

**Sources**
- **Etat de chaque source** visible en permanence, et **journal des
  derniers appels** pour comprendre pourquoi une source ne repond pas.
- **Ordre de preference** personnalisable.
- Duree de cache propre a chaque source (un livre du domaine public ne
  change jamais).

**Compte et securite**
- **Sessions actives** listees et revocables **une par une** : changer
  son mot de passe deconnectait jusqu'ici tous ses propres appareils.
- **Politique de mot de passe** : 8 caracteres minimum, refus des mots
  de passe les plus courants et de ceux contenant ton pseudo. La
  longueur prime sur la composition.

**Sauvegarde**
- **Restauration depuis les parametres** : apercu de ce qui va entrer,
  puis confirmation. Le script existait mais demandait un acces SSH.

**Hors-ligne**
- **Poids de chaque serie telechargee** et tri par taille : « 6 Mo
  utilises » ne disait pas par quoi.
- La **file de synchronisation** est visible : une ecriture en attente
  qu'on ne voit pas ressemble a une ecriture perdue.

**Interface**
- **Raccourcis clavier personnalisables**, avec detection des conflits.
- **Theme a contraste renforce** (AAA), pour la basse vision et les
  ecrans en plein soleil.

**Musique**
- Un flux mort **bascule sur un secours** au lieu d'afficher « en
  lecture » sans un son.
- **Ambiance suggeree** selon les tags de la serie.
- Le volume **baisse automatiquement** quand une autre source audio
  demarre, et le dock le dit.

**Application de bureau**
- La croix **reduit dans la zone de notification** et garde le serveur
  actif : la fermer coupait la lecture des autres appareils.
- **Demarrage au login**, desactive par defaut.
- L'ecran de demarrage **dit ce qui a echoue** (serveur, base ou
  extensions) au lieu d'un message unique.

**Deploiement et API**
- `npm run setup` genere une configuration complete avec un vrai secret,
  et `npm run setup:check` l'audite.
- **Page de sante de l'instance** : base, volumes, extensions, age de la
  derniere sauvegarde, espace disque.
- **HTTPS automatique** via une surcouche Caddy optionnelle.
- **Reference d'API generee** (128 operations) et prefixe **`/api/v1`**
  pour les clients tiers.
- Pagination `limit`/`offset` sur les collections, **sans changer la
  forme de reponse existante**.

**Corrections trouvees en verifiant**
- Une image sans source sur le profil rechargeait la page entiere comme
  image.
- Un roman consulte depuis l'historique ouvrait le lecteur d'images.
- Les listes marquees « publiques » n'apparaissaient sur aucun ecran.
- Sept boutons et interrupteurs presents dans l'interface n'etaient
  relies a aucun code.
- Cinq flux Web Push simultanes se remplacaient l'un l'autre : un seul
  arrivait.

## 2.3.4 — Lecture fluide sur les longs chapitres et les volumes

**Lecteur**
- **Le mode défilement ne charge plus tout le chapitre d'un coup.** Toutes les
  pages étaient réclamées en même temps dès l'ouverture : supportable sur un
  chapitre court, ingérable sur un chapitre long — et catastrophique sur un
  **volume complet**. Les pages sont désormais chargées au fil du défilement,
  par petits paquets, et celles qu'on a laissées loin derrière sont libérées.
- **La barre de défilement est juste dès l'ouverture** : chaque page réserve sa
  place avant même d'être chargée, donc plus de sauts pendant la lecture.
- **Fichiers importés (CBZ) : gros gain sur les volumes.** Chaque page était
  décompressée et gardée en mémoire jusqu'à la fermeture du fichier. Sur un
  volume de 300 pages, la mémoire utilisée passe d'environ **1 Go à 8 Mo**.
- Une page qui a échoué se recharge proprement avec « Réessayer », sans
  relancer tout le chapitre.

**Paramètres**
- Nouveau bouton **« Vider le cache »** (section Application) : remet l'app à
  neuf si l'affichage reste figé ou incohérent après une mise à jour. Ton
  compte, ta bibliothèque, ta progression et tes **chapitres téléchargés
  hors-ligne sont conservés**.

## 2.3.3 — Audit de juillet : sécurité, synchro multi-appareils & radio

**Sécurité (audit du 21-22 juillet, traité en entier)**
- Trois vecteurs XSS fermés : pseudo piégé via le bouton « Répondre », liens
  `javascript:` dans les chapitres de romans scrapés (assainis côté serveur ET
  côté lecteur) et dans les EPUB importés.
- Le déploiement « hub sans Docker » ne peut plus exposer `server/` (sauvegardes,
  clé Web Push) ; la mise à jour intégrée exige désormais une session (anti-CSRF).
- Proxy d'images restreint aux domaines des sources connues (`IMG_PROXY_ALLOW`
  pour étendre), rate-limit sur la recherche multi-sources et les images,
  cache d'images borné en mémoire.
- « Mot de passe oublié » envoie un **vrai email** quand un SMTP est configuré ;
  sans SMTP en production, la réponse est honnête au lieu d'un faux succès.
  Le formulaire newsletter du pied de page (qui ne faisait rien) est retiré.
- Désinstallation/réinstallation d'extensions réservées aux admins ; cookie de
  session `Secure` en production ; les erreurs 5xx ne fuient plus de détails
  internes ; base embarquée protégée par mot de passe aléatoire.
- Profil privé : plus aucune fuite (avatar, bio, date d'inscription).

**Accès distant & multi-appareils**
- **L'accès via Cloudflare Tunnel fonctionne** (détection d'origine corrigée).
- L'état activé/désactivé des sources et la **position de lecture des fichiers
  importés** suivent désormais le compte d'un appareil à l'autre.
- Les actions faites hors-ligne (marquer lu, progression) sont **rejouées
  automatiquement** au retour du réseau.

**Interface & accessibilité**
- Journal, Sources, Statistiques et Collections enfin accessibles sur mobile
  (bouton « Plus » dans la barre du bas) ; l'app installée n'est plus verrouillée
  en portrait.
- Aperçu des cartes et suggestions de recherche utilisables **au clavier**
  (flèches, Échap) avec la sémantique d'accessibilité correspondante ; le
  carrousel d'accueil respecte « réduire les animations » et se met en pause
  au focus clavier.
- Messages honnêtes : « Connexion requise » remplace le trompeur « Serveur
  injoignable » sur 8 pages.

**Contenu & données**
- « Tendances » affiche les séries **réellement mises à jour récemment**
  (distinctes du Top manga) ; genres populaires calculés depuis la source active.
- Pourcentage de lecture exact (fini le « 20 pages » deviné) ; pagination du
  Journal, des notifications et de l'historique ; humeur d'une note enfin
  effaçable ; import de sauvegarde beaucoup plus rapide (batché).
- Page profil : 5× moins d'appels serveur au chargement, panneau « Top séries »
  réparé, double fenêtre d'édition corrigée.

**Musique**
- Nouvel onglet **Radio** : des milliers de stations via l'annuaire libre
  Radio Browser (recherche + genres), sans inscription ni clé.

**Sous le capot**
- Migrations de base versionnées, quota de stockage par utilisateur sur les
  imports, alertes de stockage avant téléchargement, caches mémoire bornés,
  Dependabot, **32 tests** (unitaires + intégration MySQL).
- Démarrage de la base embarquée à toute épreuve : le durcissement du mot de
  passe root est best-effort et ne peut jamais empêcher l'app de se lancer.

## 2.3.2 — Fenêtre premium, actualisation fiable & MAJ robustes

**Interface bureau**
- **Fenêtre « premium » sans bordure système** : Inko a désormais sa propre
  barre de titre intégrée (déplacer / réduire / agrandir / fermer) dans le thème
  de l'app, à la place de la barre blanche de Windows. Le splash de démarrage est
  déplaçable avec une croix de secours ; `Alt+F4` reste toujours actif.

**Fiabilité**
- **Bouton « Actualiser » (nouveaux chapitres)** : ne s'interrompt plus avec
  « le serveur met trop de temps à répondre ». Le scan tolère les sources lentes
  (délai de 20 s par série côté serveur, timeout de 3 min côté client), et une
  source bloquée (Cloudflare, site HS) n'empêche plus les autres de se mettre à
  jour. Retour visuel clair pendant la recherche.
- **Mise à jour de l'app plus robuste** : l'installeur est retrouvé
  automatiquement via l'API GitHub (nom stable *ou* installeur versionné), avec
  des messages clairs quand une publication est encore en cours.

## 2.3.1 — Sécurité, téléchargements pause/reprise & performance

**Sécurité (audit du 18 juillet)**
- Déploiement Docker durci : refus de démarrer avec un secret JWT par défaut,
  CORS strict par défaut en production.
- Mises à jour d'extensions épinglées sur une release et vérifiées par SHA-256.
- Proxy d'images durci contre le DNS rebinding ; CSP active aussi en desktop ;
  compte de démonstration retiré par défaut.

**Téléchargements**
- **Pause / reprise / annulation** d'un téléchargement en cours.
- Reprise intelligente (les pages déjà récupérées ne sont pas re-téléchargées)
  et bouton **« Relancer »** pour compléter un chapitre incomplet.

**Performance**
- Compression gzip (scripts ~4× plus légers sur le réseau), cache long pour les
  ressources immuables, chargement paresseux des couvertures de listes.

**Fiabilité**
- Erreurs autrefois silencieuses désormais tracées ; erreurs serveur journalisées
  en production ; vérification hebdomadaire automatique de l'état des sources.

## 2.3.0 — App bilingue FR/EN & audit fonctionnel complet

- **Interface entièrement traduisible FR / EN** (sélecteur de langue au pied de
  page) — sans jamais altérer les titres d'œuvres ni le contenu des chapitres.
- **Filtre de contenu adulte** : œuvres +18 floutées par défaut, avec
  confirmation d'ouverture, réglable dans les paramètres.
- **Rattachement AniList corrigeable** (voir / changer la fiche liée).
- Catalogue « Toutes les sources » paginé, recherche plus profonde (36/source),
  export CSV de la bibliothèque, sauvegarde automatique quotidienne (mode hub).
- Nombreuses corrections : commentaires paginés (plus de disparitions au-delà de
  300), heatmap et séries de lecture en heure locale, sources qui remplissent
  enfin toute la grille, encodage des classiques Gutenberg, stations musicales,
  refonte des notifications.

## Versions antérieures

- **2.2.x** — App 100 % autonome (base embarquée), visite guidée, filtres
  catalogue enrichis, extension « Livres FR », synchronisation AniList complète,
  mise à jour intégrée, splash avec progression.
- **2.2.0** — Client AniList officiel embarqué (connexion en un clic).
- **2.1.0** — Retrait de Spotify, passage en app locale « façon Mihon ».
