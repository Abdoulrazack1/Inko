# Journal des versions — Inko

Toutes les versions notables de l'application. Les installeurs Windows sont
publiés sur [la page des releases](https://github.com/Abdoulrazack1/Inko/releases).

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
