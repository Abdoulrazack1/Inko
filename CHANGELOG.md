# Journal des versions — Inko

Toutes les versions notables de l'application. Les installeurs Windows sont
publiés sur [la page des releases](https://github.com/Abdoulrazack1/Inko/releases).

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
  Dependabot, **28 tests** (unitaires + intégration MySQL).

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
