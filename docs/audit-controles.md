# Audit fonctionnel — chaque contrôle, dans les deux modes

Relevé du 2026-09-08. Chaque bouton, lien et bascule a été **actionné**,
et l’état de la page comparé avant/après.

| Verdict | Sens |
|---|---|
| `NAVIGUE` | l’URL a changé — le contrôle fonctionne |
| `AGIT` | le DOM a changé — panneau ouvert, liste filtrée, bascule |
| `OUVRE UN ONGLET` | `target="_blank"` : la page courante ne bouge pas, c’est normal |
| `AGIT (focus déplacé)` | le focus a changé de cible — un lien d’évitement, une ancre |
| `AGIT (défilement)` | la page a défilé |
| `INERTE` | **rien n’a bougé** — à examiner |
| `ÉVITÉ` | libellé destructif : non actionné, par précaution |

- **autonome** — `http://127.0.0.1:8612`
- **hub** — `http://127.0.0.1:8088`

## Sans nom accessible — un lecteur d’écran annonce le pictogramme

Ni texte, ni `aria-label`, ni `title` : le contrôle est atteignable au
clavier et reste indéchiffrable sans le voir.

_Aucun._

## À corriger — inerte dans TOUS les modes audités

**2 contrôle(s)** ne réagissent ni en autonome, ni via le hub.

| Page | Contrôle | Élément |
|---|---|---|
| `import` | Importer un fichier | `a` |
| `offline` | Réessayer | `button#offRetry` |

## Dépend du hub ou d’un compte — inerte en autonome seulement

Ces contrôles fonctionnent une fois le serveur joignable. Le défaut, s’il y
en a un, n’est pas dans le bouton : c’est que **rien ne dit à l’utilisateur**
pourquoi il ne se passe rien.

| Page | Contrôle | Élément |
|---|---|---|
| `recherche` | Recherche | `a` |
| `bibliotheque` | Bibliothèque | `a` |
| `notifications` | Non lues | `button` |
| `notifications` | Réponses | `button` |
| `notifications` | Mentions | `button` |
| `notifications` | Chapitres | `button` |
| `profil` | ↗ Partager | `button` |
| `profil` | Profil | `a` |
| `u` | Catalogue | `a` |
| `u` | Nouveautés | `a` |

---

# Mode « autonome » — `http://127.0.0.1:8612`

| Page | Contrôles | Naviguent | Agissent | Onglet | **Inertes** | Erreurs JS | Actif 404 | API 404 | 404 tiers |
|---|---|---|---|---|---|---|---|---|---|
| accueil | 33 | 0 | 2 | 5 | **0** | 0 | 0 | 0 | 4 |
| catalogue | 39 | 2 | 19 | 4 | **0** | 0 | 0 | 0 | 15 |
| recherche | 37 | 9 | 8 | 4 | **1** | 0 | 0 | 0 | 15 |
| bibliotheque | 28 | 9 | 9 | 4 | **1** | 0 | 0 | 0 | 15 |
| serie | 25 | 11 | 8 | 4 | **0** | 0 | 0 | 0 | 14 |
| chapitre | 21 | 10 | 6 | 4 | **0** | 0 | 0 | 0 | 15 |
| lecture | 20 | 9 | 6 | 4 | **0** | 0 | 0 | 0 | 10 |
| collections | 25 | 5 | 16 | 4 | **0** | 0 | 0 | 0 | 15 |
| collection-detail | 25 | 12 | 8 | 4 | **0** | 0 | 0 | 0 | 8 |
| notes | 26 | 12 | 10 | 4 | **0** | 0 | 0 | 0 | 15 |
| notifications | 34 | 13 | 11 | 4 | **4** | 0 | 0 | 0 | 15 |
| downloads | 23 | 6 | 5 | 4 | **0** | 0 | 0 | 0 | 9 |
| import | 37 | 6 | 4 | 4 | **1** | 0 | 0 | 0 | 15 |
| localreader | 3 | 3 | 0 | 0 | **0** | 0 | 0 | 0 | 4 |
| parametres | 74 | 1 | 5 | 4 | **0** | 0 | 0 | 0 | 14 |
| profil | 47 | 18 | 8 | 4 | **2** | 0 | 0 | 0 | 15 |
| u | 23 | 10 | 7 | 4 | **2** | 0 | 0 | 0 | 15 |
| stats | 26 | 13 | 7 | 4 | **0** | 0 | 0 | 0 | 15 |
| sources | 28 | 16 | 8 | 4 | **0** | 0 | 0 | 0 | 15 |
| liste | 25 | 12 | 8 | 4 | **0** | 0 | 0 | 0 | 15 |
| anilist | 2 | 2 | 0 | 0 | **0** | 0 | 0 | 0 | 0 |
| confidentialite | 2 | 1 | 0 | 1 | **0** | 0 | 0 | 0 | 7 |
| offline | 4 | 3 | 0 | 0 | **1** | 0 | 0 | 0 | 0 |

**12 contrôles inertes** dans ce mode.


## `accueil.html`

URL auditée : `/accueil.html`

> État : **non connecté** · mode autonome (aucun hub)
> Les verdicts qui suivent se lisent dans CET état.

**4 réponse(s) 404 de sites tiers** — souvent normal (une extension pagine jusqu’au 404 pour savoir qu’elle a fini) :

- `sushiscan.fr/genres/hentai/`
- `sushiscan.fr/genres/adulte/`
- `sushiscan.fr/genres/pornhwa/page/4/`
- `sushiscan.fr/genres/pornhwa/page/5/`

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | AGIT (focus déplacé) |
| Inko | `a` | AGIT (focus déplacé) |
| Mode incognito (lecture privée) | `button#btnIncognito` | DISPARU |
| Actualiser mes séries (nouveaux chapitres) | `button#btnRefresh` | DISPARU |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | DISPARU |
| Paramètres | `a` | DISPARU |
| Voir l'historique → | `a` | DISPARU |
| connecter un ordinateur | `a` | DISPARU |
| Tendances précédentes | `button#trendPrev` | DISPARU |
| Tendances suivantes | `button#trendNext` | DISPARU |
| Voir tout → | `a` | DISPARU |
| Tout | `button` | DISPARU |
| Suivis | `button` | DISPARU |
| Populaire | `button` | DISPARU |
| Charger plus | `button#btnMore` | DISPARU |
| Voir sur GitHub ★ | `a` | OUVRE UN ONGLET |
| Catalogue | `a` | DISPARU |
| Nouveautés | `a` | DISPARU |
| Top | `a` | DISPARU |
| Importer un fichier | `a` | DISPARU |
| Téléchargements | `a` | DISPARU |
| Code source | `a` | OUVRE UN ONGLET |
| Signaler un bug | `a` | OUVRE UN ONGLET |
| Versions | `a` | OUVRE UN ONGLET |
| Confidentialité | `a` | DISPARU |
| Licence | `a` | OUVRE UN ONGLET |
| FR | `button` | DISPARU |
| EN | `button` | DISPARU |
| Accueil | `a` | DISPARU |
| Bibliothèque | `a` | DISPARU |
| Recherche | `a` | DISPARU |
| Profil | `a` | DISPARU |
| Plus de sections | `button#mnavMore` | DISPARU |


## `catalogue.html`

URL auditée : `/catalogue.html`

> État : **non connecté** · mode autonome (aucun hub)
> Les verdicts qui suivent se lisent dans CET état.

**15 réponse(s) 404 de sites tiers** — souvent normal (une extension pagine jusqu’au 404 pour savoir qu’elle a fini) :

- `sushiscan.fr/genres/hentai/`
- `sushiscan.fr/genres/adulte/`
- `sushiscan.fr/genres/pornhwa/page/5/`
- `sushiscan.fr/genres/pornhwa/page/4/`
- `sushiscan.fr/genres/ecchi/page/4/`
- `sushiscan.fr/genres/ecchi/page/3/`
- … et 9 autre(s)

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | AGIT (focus déplacé) |
| Inko | `a` | NAVIGUE → accueil.html |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (page modifiée) |
| Actualiser mes séries (nouveaux chapitres) | `button#btnRefresh` | AGIT (page modifiée) |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | AGIT (page modifiée) |
| Paramètres | `a` | NAVIGUE → parametres.html |
| Filtres | `button#btnFiltresFeuille` | AGIT (panneau) |
| Toutes les sources | `button` | AGIT (page modifiée) |
| MangaDex | `button` | DISPARU |
| Tout | `button` | AGIT (page modifiée) |
| En cours | `button` | AGIT (page modifiée) |
| Terminés | `button` | AGIT (page modifiée) |
| Pause | `button` | AGIT (page modifiée) |
| Shōnen | `button` | AGIT (page modifiée) |
| Seinen | `button` | AGIT (page modifiée) |
| Shōjo | `button` | AGIT (page modifiée) |
| Josei | `button` | AGIT (page modifiée) |
| Lecture aléatoire | `button#btnRandom` | AGIT (page modifiée) |
| Grille | `button` | AGIT (page modifiée) |
| Liste | `button` | AGIT (page modifiée) |
| Trier le catalogue | `select#sortSelect` | AGIT (focus déplacé) |
| Réessayer | `button` | DISPARU |
| Catalogue | `a` | AGIT (page modifiée) |
| Nouveautés | `a` | DISPARU |
| Top | `a` | DISPARU |
| Importer un fichier | `a` | DISPARU |
| Téléchargements | `a` | DISPARU |
| Code source | `a` | OUVRE UN ONGLET |
| Signaler un bug | `a` | OUVRE UN ONGLET |
| Versions | `a` | OUVRE UN ONGLET |
| Confidentialité | `a` | DISPARU |
| Licence | `a` | OUVRE UN ONGLET |
| FR | `button` | DISPARU |
| EN | `button` | DISPARU |
| Accueil | `a` | DISPARU |
| Bibliothèque | `a` | DISPARU |
| Recherche | `a` | DISPARU |
| Profil | `a` | DISPARU |
| Plus de sections | `button#mnavMore` | DISPARU |


## `recherche.html`

URL auditée : `/recherche.html`

> État : **non connecté** · mode autonome (aucun hub)
> Les verdicts qui suivent se lisent dans CET état.

**15 réponse(s) 404 de sites tiers** — souvent normal (une extension pagine jusqu’au 404 pour savoir qu’elle a fini) :

- `sushiscan.fr/genres/hentai/`
- `sushiscan.fr/genres/adulte/`
- `sushiscan.fr/genres/pornhwa/page/4/`
- `sushiscan.fr/genres/ecchi/page/4/`
- `sushiscan.fr/genres/ecchi/page/3/`
- `sushiscan.fr/genres/ecchi/page/5/`
- … et 9 autre(s)

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | AGIT (focus déplacé) |
| Inko | `a` | NAVIGUE → accueil.html |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (page modifiée) |
| Actualiser mes séries (nouveaux chapitres) | `button#btnRefresh` | AGIT (page modifiée) |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | AGIT (page modifiée) |
| Paramètres | `a` | NAVIGUE → parametres.html |
| Rechercher | `button#seGo` | AGIT (focus déplacé) |
| Catalogue | `a` | NAVIGUE → catalogue.html |
| Nouveautés | `a` | NAVIGUE → catalogue.html?sort=latest |
| Top | `a` | NAVIGUE → catalogue.html?sort=rating |
| Importer un fichier | `a` | AGIT (page modifiée) |
| Téléchargements | `a` | NAVIGUE → downloads.html |
| Code source | `a` | OUVRE UN ONGLET |
| Signaler un bug | `a` | OUVRE UN ONGLET |
| Versions | `a` | OUVRE UN ONGLET |
| Confidentialité | `a` | NAVIGUE → confidentialite.html |
| Licence | `a` | OUVRE UN ONGLET |
| FR | `button` | AGIT (page modifiée) |
| EN | `button` | AGIT (page modifiée) |
| Désactiver | `button` | DISPARU |
| Accueil | `a` | NAVIGUE → accueil.html |
| Bibliothèque | `a` | NAVIGUE → bibliotheque.html |
| Recherche | `a` | **INERTE** |
| Profil | `a` | DISPARU |
| Plus de sections | `button#mnavMore` | DISPARU |
| Stations | `button` | DISPARU |
| Radio | `button` | DISPARU |
| YouTube | `button` | DISPARU |
| Fichiers | `button` | DISPARU |
| Piste ou station précédente | `button#im-prev` | DISPARU |
| Lecture / pause | `button#im-pp` | DISPARU |
| Piste ou station suivante | `button#im-next` | DISPARU |
| Mode répétition | `button#im-repeat` | DISPARU |
| Minuterie de sommeil | `button#im-timer` | DISPARU |
| Agrandir le lecteur | `button#im-exp` | DISPARU |
| Réduire le lecteur en pastille | `button#im-min` | DISPARU |
| Fermer le lecteur et arrêter la musique | `button#im-close` | DISPARU |


## `bibliotheque.html`

URL auditée : `/bibliotheque.html`

> État : **non connecté** · mode autonome (aucun hub)
> La page affiche : « Aucun ordinateur connecté Cette page lit des données que ton ordinateur synchronise. Sans hub connecté, elle reste vide — le catalogue, la r »
> Les verdicts qui suivent se lisent dans CET état.

**15 réponse(s) 404 de sites tiers** — souvent normal (une extension pagine jusqu’au 404 pour savoir qu’elle a fini) :

- `sushiscan.fr/genres/adulte/`
- `sushiscan.fr/genres/pornhwa/page/4/`
- `sushiscan.fr/genres/pornhwa/page/5/`
- `sushiscan.fr/genres/ecchi/page/3/`
- `sushiscan.fr/genres/ecchi/page/4/`
- `sushiscan.fr/genres/ecchi/page/5/`
- … et 9 autre(s)

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | AGIT (focus déplacé) |
| Inko | `a` | NAVIGUE → accueil.html |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (page modifiée) |
| Actualiser mes séries (nouveaux chapitres) | `button#btnRefresh` | AGIT (page modifiée) |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | AGIT (page modifiée) |
| Paramètres | `a` | NAVIGUE → parametres.html |
| Bibliothèque | `button` | AGIT (focus déplacé) |
| Signets | `button` | AGIT (page modifiée) |
| Téléchargements | `button` | AGIT (page modifiée) |
| Connecter un ordinateur | `button` | ERREUR : locator.click: Element is not visible |
| Catalogue | `a` | NAVIGUE → recherche.html |
| Nouveautés | `a` | NAVIGUE → catalogue.html?sort=latest |
| Top | `a` | NAVIGUE → catalogue.html?sort=rating |
| Importer un fichier | `a` | NAVIGUE → import.html |
| Téléchargements | `a` | NAVIGUE → downloads.html |
| Code source | `a` | OUVRE UN ONGLET |
| Signaler un bug | `a` | OUVRE UN ONGLET |
| Versions | `a` | OUVRE UN ONGLET |
| Confidentialité | `a` | NAVIGUE → confidentialite.html |
| Licence | `a` | OUVRE UN ONGLET |
| FR | `button` | AGIT (page modifiée) |
| EN | `button` | AGIT (page modifiée) |
| Accueil | `a` | NAVIGUE → accueil.html |
| Bibliothèque | `a` | **INERTE** |
| Recherche | `a` | DISPARU |
| Profil | `a` | DISPARU |
| Plus de sections | `button#mnavMore` | DISPARU |
| Fermer l'astuce | `button` | DISPARU |


## `serie.html`

URL auditée : `/serie.html`

> État : **non connecté** · mode autonome (aucun hub)
> Les verdicts qui suivent se lisent dans CET état.

**14 réponse(s) 404 de sites tiers** — souvent normal (une extension pagine jusqu’au 404 pour savoir qu’elle a fini) :

- `sushiscan.fr/genres/adulte/`
- `sushiscan.fr/genres/hentai/`
- `sushiscan.fr/genres/ecchi/page/5/`
- `sushiscan.fr/genres/ecchi/page/4/`
- `sushiscan.fr/genres/ecchi/page/3/`
- `sushiscan.fr/genres/pornhwa/page/5/`
- … et 8 autre(s)

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | AGIT (focus déplacé) |
| Inko | `a` | NAVIGUE → accueil.html |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (page modifiée) |
| Actualiser mes séries (nouveaux chapitres) | `button#btnRefresh` | AGIT (page modifiée) |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | AGIT (page modifiée) |
| Paramètres | `a` | NAVIGUE → parametres.html |
| Catalogue | `a` | NAVIGUE → catalogue.html |
| Nouveautés | `a` | NAVIGUE → catalogue.html?sort=latest |
| Top | `a` | NAVIGUE → catalogue.html?sort=rating |
| Importer un fichier | `a` | NAVIGUE → import.html |
| Téléchargements | `a` | AGIT (page modifiée) |
| Code source | `a` | OUVRE UN ONGLET |
| Signaler un bug | `a` | OUVRE UN ONGLET |
| Versions | `a` | OUVRE UN ONGLET |
| Confidentialité | `a` | NAVIGUE → confidentialite.html |
| Licence | `a` | OUVRE UN ONGLET |
| FR | `button` | AGIT (page modifiée) |
| EN | `button` | AGIT (page modifiée) |
| Désactiver | `button` | DISPARU |
| Accueil | `a` | NAVIGUE → accueil.html |
| Bibliothèque | `a` | NAVIGUE → bibliotheque.html |
| Recherche | `a` | NAVIGUE → recherche.html |
| Profil | `a` | NAVIGUE → profil.html |
| Plus de sections | `button#mnavMore` | AGIT (page modifiée) |
| Fermer l'astuce | `button` | DISPARU |


## `chapitre.html`

URL auditée : `/chapitre.html`

> État : **non connecté** · mode autonome (aucun hub)
> Les verdicts qui suivent se lisent dans CET état.

**15 réponse(s) 404 de sites tiers** — souvent normal (une extension pagine jusqu’au 404 pour savoir qu’elle a fini) :

- `sushiscan.fr/genres/hentai/`
- `sushiscan.fr/genres/adulte/`
- `sushiscan.fr/genres/pornhwa/page/4/`
- `sushiscan.fr/genres/pornhwa/page/5/`
- `sushiscan.fr/genres/ecchi/page/3/`
- `sushiscan.fr/genres/ecchi/page/5/`
- … et 9 autre(s)

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | AGIT (focus déplacé) |
| Inko | `a` | NAVIGUE → accueil.html |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (page modifiée) |
| Actualiser mes séries (nouveaux chapitres) | `button#btnRefresh` | AGIT (page modifiée) |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | AGIT (page modifiée) |
| Paramètres | `a` | NAVIGUE → parametres.html |
| ↩ Retour | `a` | NAVIGUE → parametres.html |
| Accueil | `a` | NAVIGUE → accueil.html |
| Catalogue | `a` | NAVIGUE → catalogue.html |
| Nouveautés | `a` | NAVIGUE → catalogue.html?sort=latest |
| Top | `a` | NAVIGUE → catalogue.html?sort=rating |
| Importer un fichier | `a` | NAVIGUE → import.html |
| Téléchargements | `a` | NAVIGUE → downloads.html |
| Code source | `a` | OUVRE UN ONGLET |
| Signaler un bug | `a` | OUVRE UN ONGLET |
| Versions | `a` | OUVRE UN ONGLET |
| Confidentialité | `a` | NAVIGUE → confidentialite.html |
| Licence | `a` | OUVRE UN ONGLET |
| FR | `button` | AGIT (page modifiée) |
| EN | `button` | AGIT (page modifiée) |
| Fermer l'astuce | `button` | DISPARU |


## `lecture.html`

URL auditée : `/lecture.html`

> État : **non connecté** · mode autonome (aucun hub)
> Les verdicts qui suivent se lisent dans CET état.

**10 réponse(s) 404 de sites tiers** — souvent normal (une extension pagine jusqu’au 404 pour savoir qu’elle a fini) :

- `sushiscan.fr/genres/erotique/page/9/`
- `sushiscan.fr/genres/hentai/`
- `sushiscan.fr/genres/adulte/`
- `sushiscan.fr/genres/pornhwa/page/4/`
- `sushiscan.fr/genres/pornhwa/page/5/`
- `sushiscan.fr/genres/ecchi/page/4/`
- … et 4 autre(s)

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | AGIT (focus déplacé) |
| Inko | `a` | NAVIGUE → accueil.html |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (page modifiée) |
| Actualiser mes séries (nouveaux chapitres) | `button#btnRefresh` | AGIT (page modifiée) |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | AGIT (page modifiée) |
| Paramètres | `a` | NAVIGUE → parametres.html |
| ↩ Retour | `a` | NAVIGUE → parametres.html |
| Catalogue | `a` | NAVIGUE → catalogue.html |
| Nouveautés | `a` | NAVIGUE → catalogue.html?sort=latest |
| Top | `a` | NAVIGUE → catalogue.html?sort=rating |
| Importer un fichier | `a` | NAVIGUE → import.html |
| Téléchargements | `a` | NAVIGUE → downloads.html |
| Code source | `a` | OUVRE UN ONGLET |
| Signaler un bug | `a` | OUVRE UN ONGLET |
| Versions | `a` | OUVRE UN ONGLET |
| Confidentialité | `a` | NAVIGUE → confidentialite.html |
| Licence | `a` | OUVRE UN ONGLET |
| FR | `button` | AGIT (page modifiée) |
| EN | `button` | AGIT (page modifiée) |
| Désactiver | `button` | DISPARU |


## `collections.html`

URL auditée : `/collections.html`

> État : **non connecté** · mode autonome (aucun hub)
> La page affiche : « Connecte-toi pour créer tes listes Garde tes séries organisées en collections personnalisées, synchronisées sur tous tes appareils. Se conne »
> Les verdicts qui suivent se lisent dans CET état.

**15 réponse(s) 404 de sites tiers** — souvent normal (une extension pagine jusqu’au 404 pour savoir qu’elle a fini) :

- `sushiscan.fr/genres/adulte/`
- `sushiscan.fr/genres/hentai/`
- `sushiscan.fr/genres/pornhwa/page/4/`
- `sushiscan.fr/genres/pornhwa/page/5/`
- `sushiscan.fr/genres/ecchi/page/4/`
- `sushiscan.fr/genres/ecchi/page/3/`
- … et 9 autre(s)

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | AGIT (focus déplacé) |
| Inko | `a` | NAVIGUE → accueil.html |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (page modifiée) |
| Actualiser mes séries (nouveaux chapitres) | `button#btnRefresh` | AGIT (page modifiée) |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | AGIT (page modifiée) |
| Paramètres | `a` | NAVIGUE → parametres.html |
| + Nouvelle liste | `button#btnNewList` | AGIT (page modifiée) |
| Se connecter | `a` | AGIT (focus déplacé) |
| Catalogue | `a` | AGIT (focus déplacé) |
| Nouveautés | `a` | AGIT (focus déplacé) |
| Top | `a` | AGIT (page modifiée) |
| Importer un fichier | `a` | AGIT (focus déplacé) |
| Téléchargements | `a` | AGIT (focus déplacé) |
| Code source | `a` | OUVRE UN ONGLET |
| Signaler un bug | `a` | OUVRE UN ONGLET |
| Versions | `a` | OUVRE UN ONGLET |
| Confidentialité | `a` | AGIT (focus déplacé) |
| Licence | `a` | OUVRE UN ONGLET |
| FR | `button` | AGIT (page modifiée) |
| EN | `button` | AGIT (page modifiée) |
| Accueil | `a` | AGIT (page modifiée) |
| Bibliothèque | `a` | NAVIGUE → bibliotheque.html |
| Recherche | `a` | NAVIGUE → recherche.html |
| Profil | `a` | NAVIGUE → profil.html |
| Plus de sections | `button#mnavMore` | AGIT (page modifiée) |


## `collection-detail.html`

URL auditée : `/collection-detail.html`

> État : **non connecté** · mode autonome (aucun hub)
> Les verdicts qui suivent se lisent dans CET état.

**8 réponse(s) 404 de sites tiers** — souvent normal (une extension pagine jusqu’au 404 pour savoir qu’elle a fini) :

- `sushiscan.fr/genres/hentai/`
- `sushiscan.fr/genres/adulte/`
- `sushiscan.fr/genres/pornhwa/page/5/`
- `sushiscan.fr/genres/pornhwa/page/4/`
- `sushiscan.fr/genres/ecchi/page/3/`
- `sushiscan.fr/genres/smut/page/7/`
- … et 2 autre(s)

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | AGIT (focus déplacé) |
| Inko | `a` | NAVIGUE → accueil.html |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (page modifiée) |
| Actualiser mes séries (nouveaux chapitres) | `button#btnRefresh` | AGIT (page modifiée) |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | AGIT (page modifiée) |
| Paramètres | `a` | NAVIGUE → parametres.html |
| ← Mes listes | `a` | NAVIGUE → collections.html |
| Catalogue | `a` | NAVIGUE → catalogue.html |
| Nouveautés | `a` | NAVIGUE → catalogue.html?sort=latest |
| Top | `a` | AGIT (page modifiée) |
| Importer un fichier | `a` | NAVIGUE → recherche.html |
| Téléchargements | `a` | NAVIGUE → recherche.html |
| Code source | `a` | OUVRE UN ONGLET |
| Signaler un bug | `a` | OUVRE UN ONGLET |
| Versions | `a` | OUVRE UN ONGLET |
| Confidentialité | `a` | NAVIGUE → confidentialite.html |
| Licence | `a` | OUVRE UN ONGLET |
| FR | `button` | AGIT (page modifiée) |
| EN | `button` | AGIT (page modifiée) |
| Désactiver | `button` | DISPARU |
| Accueil | `a` | NAVIGUE → accueil.html |
| Bibliothèque | `a` | NAVIGUE → bibliotheque.html |
| Recherche | `a` | NAVIGUE → recherche.html |
| Profil | `a` | NAVIGUE → profil.html |
| Plus de sections | `button#mnavMore` | AGIT (page modifiée) |


## `notes.html`

URL auditée : `/notes.html`

> État : **non connecté** · mode autonome (aucun hub)
> Les verdicts qui suivent se lisent dans CET état.

**15 réponse(s) 404 de sites tiers** — souvent normal (une extension pagine jusqu’au 404 pour savoir qu’elle a fini) :

- `sushiscan.fr/genres/hentai/`
- `sushiscan.fr/genres/adulte/`
- `sushiscan.fr/genres/pornhwa/page/4/`
- `sushiscan.fr/genres/ecchi/page/4/`
- `sushiscan.fr/genres/ecchi/page/3/`
- `sushiscan.fr/genres/pornhwa/page/5/`
- … et 9 autre(s)

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | AGIT (focus déplacé) |
| Inko | `a` | NAVIGUE → accueil.html |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (page modifiée) |
| Actualiser mes séries (nouveaux chapitres) | `button#btnRefresh` | AGIT (page modifiée) |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | AGIT (page modifiée) |
| Paramètres | `a` | NAVIGUE → parametres.html |
| Lire chaque série du début à la fin | `button#jrRecit` | AGIT (focus déplacé) |
| Exporter en Markdown (Obsidian, Logseq…) | `button#jrExportMd` | AGIT (focus déplacé) |
| Connecter un ordinateur | `button` | AGIT (focus déplacé) |
| Catalogue | `a` | NAVIGUE → catalogue.html |
| Nouveautés | `a` | NAVIGUE → catalogue.html?sort=latest |
| Top | `a` | NAVIGUE → catalogue.html?sort=rating |
| Importer un fichier | `a` | NAVIGUE → import.html |
| Téléchargements | `a` | NAVIGUE → downloads.html |
| Code source | `a` | OUVRE UN ONGLET |
| Signaler un bug | `a` | OUVRE UN ONGLET |
| Versions | `a` | OUVRE UN ONGLET |
| Confidentialité | `a` | NAVIGUE → confidentialite.html |
| Licence | `a` | OUVRE UN ONGLET |
| FR | `button` | AGIT (page modifiée) |
| EN | `button` | AGIT (page modifiée) |
| Accueil | `a` | NAVIGUE → accueil.html |
| Bibliothèque | `a` | NAVIGUE → bibliotheque.html |
| Recherche | `a` | NAVIGUE → recherche.html |
| Profil | `a` | NAVIGUE → profil.html |
| Plus de sections | `button#mnavMore` | AGIT (page modifiée) |


## `notifications.html`

URL auditée : `/notifications.html`

> État : **non connecté** · mode autonome (aucun hub)
> Les verdicts qui suivent se lisent dans CET état.

**15 réponse(s) 404 de sites tiers** — souvent normal (une extension pagine jusqu’au 404 pour savoir qu’elle a fini) :

- `sushiscan.fr/genres/adulte/`
- `sushiscan.fr/genres/hentai/`
- `sushiscan.fr/genres/pornhwa/page/4/`
- `sushiscan.fr/genres/pornhwa/page/5/`
- `sushiscan.fr/genres/ecchi/page/4/`
- `sushiscan.fr/genres/smut/page/7/`
- … et 9 autre(s)

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | AGIT (focus déplacé) |
| Inko | `a` | NAVIGUE → accueil.html |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (page modifiée) |
| Actualiser mes séries (nouveaux chapitres) | `button#btnRefresh` | AGIT (page modifiée) |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | AGIT (page modifiée) |
| Paramètres | `a` | NAVIGUE → parametres.html |
| Actualiser les notifications | `button#ntRefresh` | AGIT (focus déplacé) |
| Recevoir les notifications même Inko fermé | `button#ntEnablePush` | AGIT (focus déplacé) |
| Fréquence de vérification des nouveaux chapitr | `select#ntFreq` | AGIT (focus déplacé) |
| Toutes | `button` | AGIT (focus déplacé) |
| Non lues | `button` | **INERTE** |
| Réponses | `button` | **INERTE** |
| Mentions | `button` | **INERTE** |
| Chapitres | `button` | **INERTE** |
| Connecter un ordinateur | `button` | NAVIGUE → parametres.html |
| Catalogue | `a` | NAVIGUE → catalogue.html |
| Nouveautés | `a` | NAVIGUE → catalogue.html?sort=latest |
| Top | `a` | NAVIGUE → catalogue.html?sort=rating |
| Importer un fichier | `a` | NAVIGUE → import.html |
| Téléchargements | `a` | NAVIGUE → downloads.html |
| Code source | `a` | OUVRE UN ONGLET |
| Signaler un bug | `a` | OUVRE UN ONGLET |
| Versions | `a` | OUVRE UN ONGLET |
| Confidentialité | `a` | NAVIGUE → confidentialite.html |
| Licence | `a` | OUVRE UN ONGLET |
| FR | `button` | AGIT (page modifiée) |
| EN | `button` | AGIT (page modifiée) |
| Désactiver | `button` | DISPARU |
| Accueil | `a` | NAVIGUE → accueil.html |
| Bibliothèque | `a` | NAVIGUE → bibliotheque.html |
| Recherche | `a` | NAVIGUE → recherche.html |
| Profil | `a` | NAVIGUE → profil.html |
| Plus de sections | `button#mnavMore` | AGIT (page modifiée) |
| Fermer l'astuce | `button` | DISPARU |


## `downloads.html`

URL auditée : `/downloads.html`

> État : **non connecté** · mode autonome (aucun hub)
> Les verdicts qui suivent se lisent dans CET état.

**9 réponse(s) 404 de sites tiers** — souvent normal (une extension pagine jusqu’au 404 pour savoir qu’elle a fini) :

- `sushiscan.fr/genres/pornhwa/page/5/`
- `sushiscan.fr/genres/ecchi/page/3/`
- `sushiscan.fr/genres/hentai/`
- `sushiscan.fr/genres/adulte/`
- `sushiscan.fr/genres/ecchi/page/5/`
- `sushiscan.fr/genres/pornhwa/page/4/`
- … et 3 autre(s)

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | AGIT (focus déplacé) |
| Inko | `a` | NAVIGUE → accueil.html |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (page modifiée) |
| Actualiser mes séries (nouveaux chapitres) | `button#btnRefresh` | AGIT (page modifiée) |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | AGIT (page modifiée) |
| Paramètres | `a` | NAVIGUE → parametres.html |
| Catalogue | `a` | NAVIGUE → recherche.html |
| Nouveautés | `a` | NAVIGUE → catalogue.html?sort=latest |
| Top | `a` | NAVIGUE → catalogue.html?sort=rating |
| Importer un fichier | `a` | NAVIGUE → import.html |
| Téléchargements | `a` | AGIT (page modifiée) |
| Code source | `a` | OUVRE UN ONGLET |
| Signaler un bug | `a` | OUVRE UN ONGLET |
| Versions | `a` | OUVRE UN ONGLET |
| Confidentialité | `a` | DISPARU |
| Licence | `a` | OUVRE UN ONGLET |
| FR | `button` | DISPARU |
| EN | `button` | DISPARU |
| Accueil | `a` | DISPARU |
| Bibliothèque | `a` | DISPARU |
| Recherche | `a` | DISPARU |
| Profil | `a` | DISPARU |
| Plus de sections | `button#mnavMore` | DISPARU |


## `import.html`

URL auditée : `/import.html`

> État : **non connecté** · mode autonome (aucun hub)
> Les verdicts qui suivent se lisent dans CET état.

**15 réponse(s) 404 de sites tiers** — souvent normal (une extension pagine jusqu’au 404 pour savoir qu’elle a fini) :

- `sushiscan.fr/genres/adulte/`
- `sushiscan.fr/genres/hentai/`
- `sushiscan.fr/genres/pornhwa/page/5/`
- `sushiscan.fr/genres/pornhwa/page/4/`
- `sushiscan.fr/genres/ecchi/page/4/`
- `sushiscan.fr/genres/ecchi/page/5/`
- … et 9 autre(s)

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | AGIT (focus déplacé) |
| Inko | `a` | NAVIGUE → accueil.html |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (page modifiée) |
| Actualiser mes séries (nouveaux chapitres) | `button#btnRefresh` | AGIT (page modifiée) |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | AGIT (page modifiée) |
| Paramètres | `a` | NAVIGUE → parametres.html |
| Connecter un ordinateur | `button` | NAVIGUE → parametres.html |
| Catalogue | `a` | NAVIGUE → catalogue.html |
| Nouveautés | `a` | NAVIGUE → catalogue.html?sort=latest |
| Top | `a` | NAVIGUE → catalogue.html?sort=rating |
| Importer un fichier | `a` | **INERTE** |
| Téléchargements | `a` | DISPARU |
| Code source | `a` | OUVRE UN ONGLET |
| Signaler un bug | `a` | OUVRE UN ONGLET |
| Versions | `a` | OUVRE UN ONGLET |
| Confidentialité | `a` | DISPARU |
| Licence | `a` | OUVRE UN ONGLET |
| FR | `button` | DISPARU |
| EN | `button` | DISPARU |
| Désactiver | `button` | DISPARU |
| Accueil | `a` | DISPARU |
| Bibliothèque | `a` | DISPARU |
| Recherche | `a` | DISPARU |
| Profil | `a` | DISPARU |
| Plus de sections | `button#mnavMore` | DISPARU |
| Stations | `button` | DISPARU |
| Radio | `button` | DISPARU |
| YouTube | `button` | DISPARU |
| Fichiers | `button` | DISPARU |
| Piste ou station précédente | `button#im-prev` | DISPARU |
| Lecture / pause | `button#im-pp` | DISPARU |
| Piste ou station suivante | `button#im-next` | DISPARU |
| Mode répétition | `button#im-repeat` | DISPARU |
| Minuterie de sommeil | `button#im-timer` | DISPARU |
| Agrandir le lecteur | `button#im-exp` | DISPARU |
| Réduire le lecteur en pastille | `button#im-min` | DISPARU |
| Fermer le lecteur et arrêter la musique | `button#im-close` | DISPARU |


## `localreader.html`

URL auditée : `/localreader.html`

> État : **non connecté** · mode autonome (aucun hub)
> Les verdicts qui suivent se lisent dans CET état.

**4 réponse(s) 404 de sites tiers** — souvent normal (une extension pagine jusqu’au 404 pour savoir qu’elle a fini) :

- `sushiscan.fr/genres/hentai/`
- `sushiscan.fr/genres/adulte/`
- `sushiscan.fr/genres/pornhwa/page/4/`
- `sushiscan.fr/genres/pornhwa/page/5/`

| Contrôle | Élément | Verdict |
|---|---|---|
| ← Bibliothèque | `a` | NAVIGUE → import.html |
| Mes fichiers importés | `a` | NAVIGUE → import.html |
| Ma bibliothèque | `a` | NAVIGUE → bibliotheque.html |


## `parametres.html`

URL auditée : `/parametres.html`

> État : **non connecté** · mode autonome (aucun hub)
> Les verdicts qui suivent se lisent dans CET état.

**14 réponse(s) 404 de sites tiers** — souvent normal (une extension pagine jusqu’au 404 pour savoir qu’elle a fini) :

- `sushiscan.fr/genres/hentai/`
- `sushiscan.fr/genres/adulte/`
- `sushiscan.fr/genres/pornhwa/page/4/`
- `sushiscan.fr/genres/pornhwa/page/5/`
- `sushiscan.fr/genres/ecchi/page/4/`
- `sushiscan.fr/genres/ecchi/page/3/`
- … et 8 autre(s)

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | AGIT (focus déplacé) |
| Inko | `a` | NAVIGUE → accueil.html |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (page modifiée) |
| Actualiser mes séries (nouveaux chapitres) | `button#btnRefresh` | AGIT (page modifiée) |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | AGIT (page modifiée) |
| Paramètres | `a` | AGIT (page modifiée) |
| Connecter un ordinateur | `button` | DISPARU |
| Afficher le code | `button` | DISPARU |
| Gérer | `button` | DISPARU |
| INPUT | `input#chkUneMain` | DISPARU |
| Activer | `button#btnNotifsMobiles` | DISPARU |
| ← RTL | `button` | DISPARU |
| LTR → | `button` | DISPARU |
| ↕ Webtoon | `button` | DISPARU |
| Page | `button` | DISPARU |
| Double | `button` | DISPARU |
| Défilement | `button` | DISPARU |
| Haute | `button` | DISPARU |
| Éco | `button` | DISPARU |
| FR + EN | `button` | DISPARU |
| FR | `button` | DISPARU |
| EN | `button` | DISPARU |
| + JA | `button` | DISPARU |
| Sombre | `button` | DISPARU |
| AMOLED | `button` | DISPARU |
| Clair | `button` | DISPARU |
| Contraste renforcé (AAA) — texte plus sombre,  | `button` | DISPARU |
| Auto | `button` | DISPARU |
| #ff6b1a | `button` | DISPARU |
| #3b82f6 | `button` | DISPARU |
| #a855f7 | `button` | DISPARU |
| #22c55e | `button` | DISPARU |
| #ec4899 | `button` | DISPARU |
| #ef4444 | `button` | DISPARU |
| #06b6d4 | `button` | DISPARU |
| #f59e0b | `button` | DISPARU |
| Flouté | `button` | DISPARU |
| Visible | `button` | DISPARU |
| Connecter | `button` | DISPARU |
| Ouvrir le lecteur | `button#btnOpenMusic` | DISPARU |
| Vérifier | `button#btnCheckUpdate` | DISPARU |
| Vider le cache | `button#btnClearCache` | ÉVITÉ (destructif) |
| Revoir la visite | `button#btnReplayTour` | DISPARU |
| Exporter | `button#btnExport` | DISPARU |
| Importer | `button#btnImport` | DISPARU |
| Effacer | `button#btnClearHistory` | ÉVITÉ (destructif) |
| Reinitialiser | `button#btnResetShortcuts` | ÉVITÉ (destructif) |
| Catalogue | `a` | DISPARU |
| Nouveautés | `a` | DISPARU |
| Top | `a` | DISPARU |
| Importer un fichier | `a` | DISPARU |
| Téléchargements | `a` | DISPARU |
| Code source | `a` | OUVRE UN ONGLET |
| Signaler un bug | `a` | OUVRE UN ONGLET |
| Versions | `a` | OUVRE UN ONGLET |
| Confidentialité | `a` | DISPARU |
| Licence | `a` | OUVRE UN ONGLET |
| Accueil | `a` | DISPARU |
| Bibliothèque | `a` | DISPARU |
| Recherche | `a` | DISPARU |
| Profil | `a` | DISPARU |
| Plus de sections | `button#mnavMore` | DISPARU |
| Stations | `button` | DISPARU |
| Radio | `button` | DISPARU |
| YouTube | `button` | DISPARU |
| Fichiers | `button` | DISPARU |
| Piste ou station précédente | `button#im-prev` | DISPARU |
| Lecture / pause | `button#im-pp` | DISPARU |
| Piste ou station suivante | `button#im-next` | DISPARU |
| Mode répétition | `button#im-repeat` | DISPARU |
| Minuterie de sommeil | `button#im-timer` | DISPARU |
| Agrandir le lecteur | `button#im-exp` | DISPARU |
| Réduire le lecteur en pastille | `button#im-min` | DISPARU |
| Fermer le lecteur et arrêter la musique | `button#im-close` | DISPARU |


## `profil.html`

URL auditée : `/profil.html`

> État : **non connecté** · mode autonome (aucun hub)
> Les verdicts qui suivent se lisent dans CET état.

**15 réponse(s) 404 de sites tiers** — souvent normal (une extension pagine jusqu’au 404 pour savoir qu’elle a fini) :

- `sushiscan.fr/genres/smut/page/8/`
- `sushiscan.fr/genres/smut/page/7/`
- `sushiscan.fr/genres/smut/page/9/`
- `sushiscan.fr/genres/adulte/`
- `sushiscan.fr/genres/hentai/`
- `sushiscan.fr/genres/pornhwa/page/4/`
- … et 9 autre(s)

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | AGIT (focus déplacé) |
| Inko | `a` | NAVIGUE → accueil.html |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (page modifiée) |
| Actualiser mes séries (nouveaux chapitres) | `button#btnRefresh` | AGIT (page modifiée) |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | AGIT (page modifiée) |
| Paramètres | `a` | NAVIGUE → parametres.html |
| Éditer | `button` | AGIT (focus déplacé) |
| ↗ Partager | `button` | **INERTE** |
| ⊞ Vue d'ensemble | `a` | NAVIGUE → profil.html# |
| Ma bibliothèque | `a` | NAVIGUE → bibliotheque.html |
| Historique | `a` | NAVIGUE → profil.html# |
| ≡ Listes de lecture | `a` | NAVIGUE → profil.html# |
| ★ Mes avis | `a` | NAVIGUE → profil.html# |
| Badges | `a` | NAVIGUE → profil.html# |
| Statistiques détaillées | `a` | NAVIGUE → stats.html |
| Connecter un ordinateur | `button` | AGIT (page modifiée) |
| Catalogue | `a` | NAVIGUE → catalogue.html |
| Nouveautés | `a` | NAVIGUE → catalogue.html?sort=latest |
| Top | `a` | NAVIGUE → catalogue.html?sort=rating |
| Importer un fichier | `a` | NAVIGUE → import.html |
| Téléchargements | `a` | NAVIGUE → downloads.html |
| Code source | `a` | OUVRE UN ONGLET |
| Signaler un bug | `a` | OUVRE UN ONGLET |
| Versions | `a` | OUVRE UN ONGLET |
| Confidentialité | `a` | NAVIGUE → confidentialite.html |
| Licence | `a` | OUVRE UN ONGLET |
| FR | `button` | AGIT (page modifiée) |
| EN | `button` | AGIT (page modifiée) |
| Désactiver | `button` | DISPARU |
| Accueil | `a` | NAVIGUE → accueil.html |
| Bibliothèque | `a` | NAVIGUE → bibliotheque.html |
| Recherche | `a` | NAVIGUE → recherche.html |
| Profil | `a` | **INERTE** |
| Plus de sections | `button#mnavMore` | DISPARU |
| Stations | `button` | DISPARU |
| Radio | `button` | DISPARU |
| YouTube | `button` | DISPARU |
| Fichiers | `button` | DISPARU |
| Piste ou station précédente | `button#im-prev` | DISPARU |
| Lecture / pause | `button#im-pp` | DISPARU |
| Piste ou station suivante | `button#im-next` | DISPARU |
| Mode répétition | `button#im-repeat` | DISPARU |
| Minuterie de sommeil | `button#im-timer` | DISPARU |
| Agrandir le lecteur | `button#im-exp` | DISPARU |
| Réduire le lecteur en pastille | `button#im-min` | DISPARU |
| Fermer le lecteur et arrêter la musique | `button#im-close` | DISPARU |
| Fermer l'astuce | `button` | DISPARU |


## `u.html`

URL auditée : `/u.html?u=demo&preview=1`

> État : **non connecté** · mode autonome (aucun hub)
> Les verdicts qui suivent se lisent dans CET état.

**15 réponse(s) 404 de sites tiers** — souvent normal (une extension pagine jusqu’au 404 pour savoir qu’elle a fini) :

- `sushiscan.fr/genres/hentai/`
- `sushiscan.fr/genres/adulte/`
- `sushiscan.fr/genres/pornhwa/page/4/`
- `sushiscan.fr/genres/pornhwa/page/5/`
- `sushiscan.fr/genres/ecchi/page/3/`
- `sushiscan.fr/genres/ecchi/page/4/`
- … et 9 autre(s)

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | AGIT (focus déplacé) |
| Inko | `a` | NAVIGUE → accueil.html |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (page modifiée) |
| Actualiser mes séries (nouveaux chapitres) | `button#btnRefresh` | AGIT (page modifiée) |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | AGIT (page modifiée) |
| Paramètres | `a` | NAVIGUE → parametres.html |
| Catalogue | `a` | **INERTE** |
| Nouveautés | `a` | **INERTE** |
| Top | `a` | NAVIGUE → catalogue.html?sort=rating |
| Importer un fichier | `a` | NAVIGUE → recherche.html |
| Téléchargements | `a` | NAVIGUE → recherche.html |
| Code source | `a` | OUVRE UN ONGLET |
| Signaler un bug | `a` | OUVRE UN ONGLET |
| Versions | `a` | OUVRE UN ONGLET |
| Confidentialité | `a` | NAVIGUE → confidentialite.html |
| Licence | `a` | OUVRE UN ONGLET |
| FR | `button` | AGIT (page modifiée) |
| EN | `button` | AGIT (page modifiée) |
| Accueil | `a` | NAVIGUE → accueil.html |
| Bibliothèque | `a` | NAVIGUE → bibliotheque.html |
| Recherche | `a` | NAVIGUE → recherche.html |
| Profil | `a` | NAVIGUE → profil.html |
| Plus de sections | `button#mnavMore` | AGIT (page modifiée) |


## `stats.html`

URL auditée : `/stats.html`

> État : **non connecté** · mode autonome (aucun hub)
> Les verdicts qui suivent se lisent dans CET état.

**15 réponse(s) 404 de sites tiers** — souvent normal (une extension pagine jusqu’au 404 pour savoir qu’elle a fini) :

- `sushiscan.fr/genres/pornhwa/page/5/`
- `sushiscan.fr/genres/adulte/`
- `sushiscan.fr/genres/hentai/`
- `sushiscan.fr/genres/ecchi/page/4/`
- `sushiscan.fr/genres/pornhwa/page/4/`
- `sushiscan.fr/genres/ecchi/page/3/`
- … et 9 autre(s)

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | AGIT (focus déplacé) |
| Inko | `a` | NAVIGUE → accueil.html |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (page modifiée) |
| Actualiser mes séries (nouveaux chapitres) | `button#btnRefresh` | AGIT (page modifiée) |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | AGIT (page modifiée) |
| Paramètres | `a` | NAVIGUE → parametres.html |
| Connecter un ordinateur | `button` | NAVIGUE → parametres.html |
| Catalogue | `a` | NAVIGUE → catalogue.html |
| Nouveautés | `a` | NAVIGUE → catalogue.html?sort=latest |
| Top | `a` | NAVIGUE → catalogue.html?sort=rating |
| Importer un fichier | `a` | NAVIGUE → import.html |
| Téléchargements | `a` | NAVIGUE → downloads.html |
| Code source | `a` | OUVRE UN ONGLET |
| Signaler un bug | `a` | OUVRE UN ONGLET |
| Versions | `a` | OUVRE UN ONGLET |
| Confidentialité | `a` | NAVIGUE → confidentialite.html |
| Licence | `a` | OUVRE UN ONGLET |
| FR | `button` | AGIT (page modifiée) |
| EN | `button` | AGIT (page modifiée) |
| Désactiver | `button` | DISPARU |
| Accueil | `a` | NAVIGUE → accueil.html |
| Bibliothèque | `a` | NAVIGUE → bibliotheque.html |
| Recherche | `a` | NAVIGUE → recherche.html |
| Profil | `a` | NAVIGUE → profil.html |
| Plus de sections | `button#mnavMore` | AGIT (page modifiée) |
| Fermer l'astuce | `button` | DISPARU |


## `sources.html`

URL auditée : `/sources.html`

> État : **non connecté** · mode autonome (aucun hub)
> Les verdicts qui suivent se lisent dans CET état.

**15 réponse(s) 404 de sites tiers** — souvent normal (une extension pagine jusqu’au 404 pour savoir qu’elle a fini) :

- `sushiscan.fr/genres/adulte/`
- `sushiscan.fr/genres/ecchi/page/3/`
- `sushiscan.fr/genres/pornhwa/page/5/`
- `sushiscan.fr/genres/pornhwa/page/4/`
- `sushiscan.fr/genres/ecchi/page/5/`
- `sushiscan.fr/genres/ecchi/page/4/`
- … et 9 autre(s)

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | AGIT (focus déplacé) |
| Inko | `a` | NAVIGUE → accueil.html |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (page modifiée) |
| Actualiser mes séries (nouveaux chapitres) | `button#btnRefresh` | AGIT (page modifiée) |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | AGIT (page modifiée) |
| Paramètres | `a` | NAVIGUE → parametres.html |
| Activer | `button` | NAVIGUE → catalogue.html |
| Vérifier que la source répond | `button` | NAVIGUE → bibliotheque.html |
| Voir les derniers appels a cette source | `button` | NAVIGUE → recherche.html |
| Remonter MangaDex | `button` | NAVIGUE → profil.html |
| Ne plus utiliser cette source (masquée en rech | `button` | AGIT (page modifiée) |
| Catalogue | `a` | NAVIGUE → recherche.html |
| Nouveautés | `a` | NAVIGUE → catalogue.html?sort=latest |
| Top | `a` | NAVIGUE → catalogue.html?sort=rating |
| Importer un fichier | `a` | NAVIGUE → import.html |
| Téléchargements | `a` | NAVIGUE → downloads.html |
| Code source | `a` | OUVRE UN ONGLET |
| Signaler un bug | `a` | OUVRE UN ONGLET |
| Versions | `a` | OUVRE UN ONGLET |
| Confidentialité | `a` | NAVIGUE → confidentialite.html |
| Licence | `a` | OUVRE UN ONGLET |
| FR | `button` | AGIT (page modifiée) |
| EN | `button` | AGIT (page modifiée) |
| Accueil | `a` | NAVIGUE → accueil.html |
| Bibliothèque | `a` | NAVIGUE → bibliotheque.html |
| Recherche | `a` | NAVIGUE → recherche.html |
| Profil | `a` | NAVIGUE → profil.html |
| Plus de sections | `button#mnavMore` | AGIT (page modifiée) |


## `liste.html`

URL auditée : `/liste.html`

> État : **non connecté** · mode autonome (aucun hub)
> Les verdicts qui suivent se lisent dans CET état.

**15 réponse(s) 404 de sites tiers** — souvent normal (une extension pagine jusqu’au 404 pour savoir qu’elle a fini) :

- `sushiscan.fr/genres/adulte/`
- `sushiscan.fr/genres/hentai/`
- `sushiscan.fr/genres/pornhwa/page/4/`
- `sushiscan.fr/genres/pornhwa/page/5/`
- `sushiscan.fr/genres/ecchi/page/4/`
- `sushiscan.fr/genres/ecchi/page/5/`
- … et 9 autre(s)

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | AGIT (focus déplacé) |
| Inko | `a` | NAVIGUE → accueil.html |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (page modifiée) |
| Actualiser mes séries (nouveaux chapitres) | `button#btnRefresh` | AGIT (page modifiée) |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | AGIT (page modifiée) |
| Paramètres | `a` | NAVIGUE → parametres.html |
| Aller à l’accueil | `a` | NAVIGUE → accueil.html |
| Catalogue | `a` | NAVIGUE → catalogue.html |
| Nouveautés | `a` | AGIT (page modifiée) |
| Top | `a` | NAVIGUE → recherche.html |
| Importer un fichier | `a` | NAVIGUE → recherche.html |
| Téléchargements | `a` | NAVIGUE → downloads.html |
| Code source | `a` | OUVRE UN ONGLET |
| Signaler un bug | `a` | OUVRE UN ONGLET |
| Versions | `a` | OUVRE UN ONGLET |
| Confidentialité | `a` | NAVIGUE → confidentialite.html |
| Licence | `a` | OUVRE UN ONGLET |
| FR | `button` | AGIT (page modifiée) |
| EN | `button` | AGIT (page modifiée) |
| Désactiver | `button` | DISPARU |
| Accueil | `a` | NAVIGUE → accueil.html |
| Bibliothèque | `a` | NAVIGUE → bibliotheque.html |
| Recherche | `a` | NAVIGUE → recherche.html |
| Profil | `a` | NAVIGUE → profil.html |
| Plus de sections | `button#mnavMore` | AGIT (page modifiée) |


## `anilist.html`

URL auditée : `/anilist.html`

> État : **non connecté**
> Les verdicts qui suivent se lisent dans CET état.

| Contrôle | Élément | Verdict |
|---|---|---|
| Retour aux paramètres | `a` | NAVIGUE → parametres.html |
| Accueil | `a` | NAVIGUE → accueil.html |


## `confidentialite.html`

URL auditée : `/confidentialite.html`

> État : **non connecté** · mode autonome (aucun hub)
> Les verdicts qui suivent se lisent dans CET état.

**7 réponse(s) 404 de sites tiers** — souvent normal (une extension pagine jusqu’au 404 pour savoir qu’elle a fini) :

- `sushiscan.fr/genres/hentai/`
- `sushiscan.fr/genres/adulte/`
- `sushiscan.fr/genres/pornhwa/page/4/`
- `sushiscan.fr/genres/pornhwa/page/5/`
- `sushiscan.fr/genres/ecchi/page/3/`
- `sushiscan.fr/genres/ecchi/page/4/`
- … et 1 autre(s)

| Contrôle | Élément | Verdict |
|---|---|---|
| Paramètres | `a` | NAVIGUE → parametres.html |
| dépôt du projet | `a` | OUVRE UN ONGLET |


## `offline.html`

URL auditée : `/offline.html`

> État : **non connecté**
> Les verdicts qui suivent se lisent dans CET état.

| Contrôle | Élément | Verdict |
|---|---|---|
| Mes téléchargements | `a` | NAVIGUE → downloads.html |
| Ma bibliothèque | `a` | NAVIGUE → bibliotheque.html |
| Mon journal | `a` | NAVIGUE → notes.html |
| Réessayer | `button#offRetry` | **INERTE** |

---

# Mode « hub » — `http://127.0.0.1:8088`

| Page | Contrôles | Naviguent | Agissent | Onglet | **Inertes** | Erreurs JS | Actif 404 | API 404 | 404 tiers |
|---|---|---|---|---|---|---|---|---|---|
| accueil | 77 | 0 | 2 | 5 | **0** | 0 | 0 | 0 | 0 |
| catalogue | 56 | 4 | 16 | 4 | **0** | 0 | 0 | 0 | 0 |
| recherche | 28 | 2 | 5 | 4 | **0** | 0 | 0 | 0 | 0 |
| bibliotheque | 40 | 2 | 5 | 4 | **0** | 0 | 0 | 0 | 0 |
| serie | 50 | 1 | 2 | 4 | **0** | 0 | 0 | 0 | 0 |
| chapitre | 44 | 0 | 4 | 4 | **0** | 0 | 0 | 0 | 0 |
| lecture | 35 | 11 | 7 | 4 | **0** | 0 | 0 | 0 | 0 |
| collections | 31 | 7 | 18 | 4 | **1** | 0 | 0 | 0 | 0 |
| collection-detail | 27 | 14 | 9 | 4 | **0** | 0 | 0 | 0 | 0 |
| notes | 29 | 14 | 10 | 4 | **0** | 0 | 0 | 0 | 0 |
| notifications | 70 | 14 | 16 | 4 | **1** | 0 | 0 | 0 | 0 |
| downloads | 27 | 8 | 5 | 4 | **1** | 0 | 0 | 0 | 0 |
| import | 38 | 7 | 5 | 4 | **1** | 0 | 0 | 0 | 0 |
| localreader | 3 | 3 | 0 | 0 | **0** | 0 | 0 | 0 | 0 |
| parametres | 87 | 2 | 6 | 4 | **0** | 0 | 0 | 0 | 0 |
| profil | 72 | 3 | 6 | 5 | **0** | 0 | 0 | 0 | 0 |
| u | 38 | 13 | 9 | 4 | **0** | 0 | 0 | 1 | 0 |
| stats | 29 | 14 | 9 | 4 | **0** | 0 | 0 | 0 | 0 |
| sources | 41 | 14 | 9 | 4 | **1** | 0 | 0 | 0 | 0 |
| liste | 27 | 1 | 2 | 4 | **0** | 0 | 0 | 0 | 0 |
| anilist | 2 | 2 | 0 | 0 | **0** | 0 | 0 | 0 | 0 |
| confidentialite | 2 | 1 | 0 | 1 | **0** | 0 | 0 | 0 | 0 |
| offline | 4 | 3 | 0 | 0 | **1** | 0 | 0 | 0 | 0 |

**6 contrôles inertes** dans ce mode.


## `accueil.html`

URL auditée : `/accueil.html`

> État : **connecté**
> Les verdicts qui suivent se lisent dans CET état.

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | AGIT (page modifiée) |
| Inko | `a` | AGIT (page modifiée) |
| Mode incognito (lecture privée) | `button#btnIncognito` | DISPARU |
| Reprendre ma dernière lecture | `button#btnContinue` | DISPARU |
| Actualiser mes séries (nouveaux chapitres) | `button#btnRefresh` | DISPARU |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | DISPARU |
| Notifications | `button#btnNotif` | DISPARU |
| Paramètres | `a` | DISPARU |
| Kaito | `a` | DISPARU |
| Umine the Island Inn | `a` | DISPARU |
| Comedy | `a` | DISPARU |
| Romance | `a` | DISPARU |
| Seinen | `a` | DISPARU |
| Lire le dernier chapitre | `a#heroRead` | DISPARU |
| Voir la fiche | `a` | DISPARU |
| Ajouter aux favoris | `button` | DISPARU |
| Umine the Island Inn | `button` | DISPARU |
| Rent-A-Girlfriend | `button` | DISPARU |
| A Couple of Cuckoos | `button` | DISPARU |
| Wind Breaker (NII Satoru) | `button` | DISPARU |
| Tune In to the Midnight Heart | `button` | DISPARU |
| The Seven Deadly Sins - Four Knights of the Ap | `button` | DISPARU |
| Voir l'historique → | `a` | DISPARU |
| Tendances précédentes | `button#trendPrev` | DISPARU |
| Tendances suivantes | `button#trendNext` | DISPARU |
| 1 Umine the Island Inn 2026 · ongoing | `a` | DISPARU |
| 2 Rent-A-Girlfriend 2017 · ongoing | `a` | DISPARU |
| 3 A Couple of Cuckoos 2020 · ongoing | `a` | DISPARU |
| 4 Wind Breaker (NII Satoru) 2021 · ongoing | `a` | DISPARU |
| 5 Tune In to the Midnight Heart 2023 · ongoing | `a` | DISPARU |
| 6 The Seven Deadly Sins - Four Knights of the  | `a` | DISPARU |
| 7 Shangri-La Frontier 2020 · ongoing | `a` | DISPARU |
| 8 Medaka Kuroiwa is Impervious to My Charms 20 | `a` | DISPARU |
| 9 Blue Lock 2018 · ongoing | `a` | DISPARU |
| 10 Class of Brains 2025 · ongoing | `a` | DISPARU |
| Voir tout → | `a` | DISPARU |
| Tout | `button` | DISPARU |
| Suivis | `button` | DISPARU |
| Populaire | `button` | DISPARU |
| Charger plus | `button#btnMore` | DISPARU |
| 1 One Piece 1997 · shounen | `a` | DISPARU |
| 2 Blue Lock 2018 · shounen | `a` | DISPARU |
| 3 Bleach (Color) 2001 · shounen | `a` | DISPARU |
| 4 Hunter x Hunter 1998 · shounen | `a` | DISPARU |
| 5 Kingdom 2006 · seinen | `a` | DISPARU |
| 6 Chained Soldier 2019 · shounen | `a` | DISPARU |
| 7 One-Punch Man 2012 · seinen | `a` | DISPARU |
| 8 Kagurabachi 2023 · shounen | `a` | DISPARU |
| 9 Bleach 2001 · shounen | `a` | DISPARU |
| 10 The Exiled Heavy Knight Knows How to Game t | `a` | DISPARU |
| Détails → | `a` | DISPARU |
| Shounen | `a` | DISPARU |
| Drama | `a` | DISPARU |
| Action | `a` | DISPARU |
| Adventure | `a` | DISPARU |
| Supernatural | `a` | DISPARU |
| Fantasy | `a` | DISPARU |
| School Life | `a` | DISPARU |
| Harem | `a` | DISPARU |
| Voir sur GitHub ★ | `a` | OUVRE UN ONGLET |
| Catalogue | `a` | DISPARU |
| Nouveautés | `a` | DISPARU |
| Top | `a` | DISPARU |
| Importer un fichier | `a` | DISPARU |
| Téléchargements | `a` | DISPARU |
| Code source | `a` | OUVRE UN ONGLET |
| Signaler un bug | `a` | OUVRE UN ONGLET |
| Versions | `a` | OUVRE UN ONGLET |
| Confidentialité | `a` | DISPARU |
| Licence | `a` | OUVRE UN ONGLET |
| FR | `button` | DISPARU |
| EN | `button` | DISPARU |
| Accueil | `a` | DISPARU |
| Bibliothèque | `a` | DISPARU |
| Recherche | `a` | DISPARU |
| Profil | `a` | DISPARU |
| Plus de sections | `button#mnavMore` | DISPARU |


## `catalogue.html`

URL auditée : `/catalogue.html`

> État : **connecté**
> Les verdicts qui suivent se lisent dans CET état.

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | AGIT (page modifiée) |
| Inko | `a` | NAVIGUE → accueil.html |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (page modifiée) |
| Reprendre ma dernière lecture | `button#btnContinue` | NAVIGUE → chapitre.html?manga=01J76XY7E9FNDZ1DBBM6PBJPFK&chapter=01M1PDC3T1X0C0X02YV7TNC0Q3&source=weebcentral |
| Actualiser mes séries (nouveaux chapitres) | `button#btnRefresh` | AGIT (page modifiée) |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | AGIT (page modifiée) |
| Notifications | `button#btnNotif` | AGIT (page modifiée) |
| Paramètres | `a` | NAVIGUE → parametres.html |
| Kaito | `a` | NAVIGUE → profil.html |
| Filtres | `button#btnFiltresFeuille` | AGIT (panneau) |
| Toutes les sources | `button` | AGIT (page modifiée) |
| Chireads | `button` | DISPARU |
| Project Gutenberg | `button` | DISPARU |
| Livres en français | `button` | DISPARU |
| MangaDex | `button` | DISPARU |
| NovelBin | `button` | DISPARU |
| NovelFull | `button` | DISPARU |
| Royal Road | `button` | DISPARU |
| SushiScan | `button` | DISPARU |
| Weeb Central | `button` | DISPARU |
| Tout | `button` | AGIT (page modifiée) |
| En cours | `button` | AGIT (page modifiée) |
| Terminés | `button` | AGIT (page modifiée) |
| Pause | `button` | AGIT (page modifiée) |
| Shōnen | `button` | AGIT (page modifiée) |
| Seinen | `button` | AGIT (page modifiée) |
| Shōjo | `button` | AGIT (page modifiée) |
| Josei | `button` | AGIT (page modifiée) |
| Lecture aléatoire | `button#btnRandom` | AGIT (page modifiée) |
| Voir la fiche | `a` | ERREUR : page.evaluate: Execution context was destroyed, most likely  |
| Grille | `button` | DISPARU |
| Liste | `button` | DISPARU |
| Trier le catalogue | `select#sortSelect` | DISPARU |
| Charger la suite | `button#catLoadMore` | DISPARU |
| Page précédente | `button` | DISPARU |
| Page 1 | `button` | DISPARU |
| Page 2 | `button` | DISPARU |
| Page suivante | `button` | DISPARU |
| Voir toutes les collections → | `a` | DISPARU |
| Catalogue | `a` | DISPARU |
| Nouveautés | `a` | DISPARU |
| Top | `a` | DISPARU |
| Importer un fichier | `a` | DISPARU |
| Téléchargements | `a` | DISPARU |
| Code source | `a` | OUVRE UN ONGLET |
| Signaler un bug | `a` | OUVRE UN ONGLET |
| Versions | `a` | OUVRE UN ONGLET |
| Confidentialité | `a` | DISPARU |
| Licence | `a` | OUVRE UN ONGLET |
| FR | `button` | DISPARU |
| EN | `button` | DISPARU |
| Accueil | `a` | DISPARU |
| Bibliothèque | `a` | DISPARU |
| Recherche | `a` | DISPARU |
| Profil | `a` | DISPARU |
| Plus de sections | `button#mnavMore` | DISPARU |


## `recherche.html`

URL auditée : `/recherche.html`

> État : **connecté**
> Les verdicts qui suivent se lisent dans CET état.

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | AGIT (page modifiée) |
| Inko | `a` | NAVIGUE → accueil.html |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (focus déplacé) |
| Reprendre ma dernière lecture | `button#btnContinue` | NAVIGUE → chapitre.html?manga=01J76XY7E9FNDZ1DBBM6PBJPFK&chapter=01M1PDC3T1X0C0X02YV7TNC0Q3&source=weebcentral |
| Actualiser mes séries (nouveaux chapitres) | `button#btnRefresh` | AGIT (page modifiée) |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | AGIT (focus déplacé) |
| Notifications | `button#btnNotif` | AGIT (page modifiée) |
| Paramètres | `a` | ERREUR : page.evaluate: Execution context was destroyed, most likely  |
| Kaito | `a` | DISPARU |
| Rechercher | `button#seGo` | DISPARU |
| tout effacer | `button#seHistClear` | ÉVITÉ (destructif) |
| Catalogue | `a` | DISPARU |
| Nouveautés | `a` | DISPARU |
| Top | `a` | DISPARU |
| Importer un fichier | `a` | DISPARU |
| Téléchargements | `a` | DISPARU |
| Code source | `a` | OUVRE UN ONGLET |
| Signaler un bug | `a` | OUVRE UN ONGLET |
| Versions | `a` | OUVRE UN ONGLET |
| Confidentialité | `a` | DISPARU |
| Licence | `a` | OUVRE UN ONGLET |
| FR | `button` | DISPARU |
| EN | `button` | DISPARU |
| Accueil | `a` | DISPARU |
| Bibliothèque | `a` | DISPARU |
| Recherche | `a` | DISPARU |
| Profil | `a` | DISPARU |
| Plus de sections | `button#mnavMore` | DISPARU |


## `bibliotheque.html`

URL auditée : `/bibliotheque.html`

> État : **connecté**
> Les verdicts qui suivent se lisent dans CET état.

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | AGIT (page modifiée) |
| Inko | `a` | NAVIGUE → accueil.html |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (page modifiée) |
| Reprendre ma dernière lecture | `button#btnContinue` | DISPARU |
| Actualiser mes séries (nouveaux chapitres) | `button#btnRefresh` | AGIT (page modifiée) |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | AGIT (page modifiée) |
| Notifications | `button#btnNotif` | AGIT (page modifiée) |
| Paramètres | `a` | NAVIGUE → parametres.html |
| Kaito | `a` | ERREUR : page.evaluate: Execution context was destroyed, most likely  |
| Bibliothèque | `button` | DISPARU |
| Mises à jour | `button` | DISPARU |
| Signets | `button` | DISPARU |
| Téléchargements | `button` | DISPARU |
| Trier la bibliothèque | `select#libSort` | DISPARU |
| Vue grille | `button` | DISPARU |
| Vue liste | `button` | DISPARU |
| Changer la densité d'affichage | `button#btnLibDensity` | DISPARU |
| Sélectionner plusieurs séries | `button#btnLibSelect` | DISPARU |
| Ouvrir une série au hasard dans ma bibliothèqu | `button#btnLibRandom` | DISPARU |
| Télécharger une sauvegarde de mes données (JSO | `button#btnLibExport` | DISPARU |
| Exporter la bibliothèque en CSV (tableur, Good | `button#btnLibExportCsv` | DISPARU |
| Restaurer une sauvegarde (JSON) | `button#btnLibImport` | DISPARU |
| Vérifier les nouveaux chapitres de toute la bi | `button#btnLibRefresh` | DISPARU |
| Catalogue | `a` | DISPARU |
| Nouveautés | `a` | DISPARU |
| Top | `a` | DISPARU |
| Importer un fichier | `a` | DISPARU |
| Téléchargements | `a` | DISPARU |
| Code source | `a` | OUVRE UN ONGLET |
| Signaler un bug | `a` | OUVRE UN ONGLET |
| Versions | `a` | OUVRE UN ONGLET |
| Confidentialité | `a` | DISPARU |
| Licence | `a` | OUVRE UN ONGLET |
| FR | `button` | DISPARU |
| EN | `button` | DISPARU |
| Accueil | `a` | DISPARU |
| Bibliothèque | `a` | DISPARU |
| Recherche | `a` | DISPARU |
| Profil | `a` | DISPARU |
| Plus de sections | `button#mnavMore` | DISPARU |


## `serie.html`

URL auditée : `/serie.html?id=01J76XY7E9FNDZ1DBBM6PBJPFK&source=weebcentral`

> État : **connecté**
> Les verdicts qui suivent se lisent dans CET état.

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | AGIT (page modifiée) |
| Inko | `a` | NAVIGUE → accueil.html |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (focus déplacé) |
| Reprendre ma dernière lecture | `button#btnContinue` | ERREUR : page.evaluate: Execution context was destroyed, most likely  |
| Actualiser mes séries (nouveaux chapitres) | `button#btnRefresh` | DISPARU |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | DISPARU |
| Notifications | `button#btnNotif` | DISPARU |
| Paramètres | `a` | DISPARU |
| Kaito | `a` | DISPARU |
| Action | `a` | DISPARU |
| Adventure | `a` | DISPARU |
| Comedy | `a` | DISPARU |
| Drama | `a` | DISPARU |
| Reprendre Ch.1192 Reprendre où tu t'es arrêté· | `button#btnResume` | DISPARU |
| Repartir du chapitre 1 | `button#btnReadStart` | DISPARU |
| Ouvrir le premier chapitre non lu | `button#btnNextUnread` | DISPARU |
| Dans ma liste | `button#btnFavorite` | DISPARU |
| Statut de lecture | `select#serieStatus` | DISPARU |
| + Catégorie | `button#btnCategory` | DISPARU |
| Suivre cette série depuis une autre source, en | `button` | DISPARU |
| Lire cette série sans laisser de trace | `button#btnPrive` | DISPARU |
| Mettre en avant sur ton profil public | `button#btnPin` | DISPARU |
| Ne plus être averti des nouveaux chapitres | `button#btnNotify` | DISPARU |
| + Liste | `button#btnAddList` | DISPARU |
| Suivi AniList — pousse ta progression, ton sta | `button#btnAniList` | DISPARU |
| Partager | `button#btnShare` | DISPARU |
| Aperçu | `button` | DISPARU |
| Chapitres | `button` | DISPARU |
| Voir tous → | `button` | DISPARU |
| Du même auteur · ODA Eiichiro | `a` | DISPARU |
| Fantasy | `a` | DISPARU |
| Shounen | `a` | DISPARU |
| Catalogue | `a` | DISPARU |
| Nouveautés | `a` | DISPARU |
| Top | `a` | DISPARU |
| Importer un fichier | `a` | DISPARU |
| Téléchargements | `a` | DISPARU |
| Code source | `a` | OUVRE UN ONGLET |
| Signaler un bug | `a` | OUVRE UN ONGLET |
| Versions | `a` | OUVRE UN ONGLET |
| Confidentialité | `a` | DISPARU |
| Licence | `a` | OUVRE UN ONGLET |
| FR | `button` | DISPARU |
| EN | `button` | DISPARU |
| Désactiver | `button` | DISPARU |
| Accueil | `a` | DISPARU |
| Bibliothèque | `a` | DISPARU |
| Recherche | `a` | DISPARU |
| Profil | `a` | DISPARU |
| Plus de sections | `button#mnavMore` | DISPARU |


## `chapitre.html`

URL auditée : `/chapitre.html?manga=01J76XY7E9FNDZ1DBBM6PBJPFK&chapter=01M1PDC3T1X0C0X02YV7TNC0Q3&source=weebcentral`

> État : **connecté**
> Les verdicts qui suivent se lisent dans CET état.

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | AGIT (page modifiée) |
| Inko | `a` | AGIT (page modifiée) |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (page modifiée) |
| Reprendre ma dernière lecture | `button#btnContinue` | AGIT (focus déplacé) |
| Actualiser mes séries (nouveaux chapitres) | `button#btnRefresh` | DISPARU |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | DISPARU |
| Notifications | `button#btnNotif` | DISPARU |
| Paramètres | `a` | DISPARU |
| Kaito | `a` | DISPARU |
| ← One Piece | `a` | DISPARU |
| Chapitre précédent | `button#btnPrevChap` | DISPARU |
| Chap. 1192Chap. 1191Chap. 1190Chap. 1189Chap.  | `select#chapSelect` | DISPARU |
| Chapitre suivant | `button#btnNextChap` | DISPARU |
| Ajouter un signet sur cette page (B) | `button#btnBookmark` | DISPARU |
| Mes notes de lecture (J) | `button#btnNotes` | DISPARU |
| Partager ce chapitre | `button#btnShare` | DISPARU |
| Mode immersif — masquer l'interface (I) | `button#btnImmersive` | DISPARU |
| Marquer ce chapitre (et les précédents) comme  | `button#btnMarkRead` | DISPARU |
| Télécharger pour lire hors-ligne | `button#btnDownload` | DISPARU |
| Zoom − | `button#btnZoomOut` | DISPARU |
| Zoom + | `button#btnZoomIn` | DISPARU |
| Plein écran | `button#btnFullscreen` | DISPARU |
| Défilement automatique (A) | `button#btnAutoScroll` | DISPARU |
| Réglages du lecteur | `button#btnReaderSettings` | DISPARU |
| Page/page | `button` | DISPARU |
| ↕ Défilement | `button` | DISPARU |
| Double | `button` | DISPARU |
| Première page (Début) | `button` | DISPARU |
| ← Précédent | `button` | DISPARU |
| Suivant → | `button` | DISPARU |
| Dernière page (Fin) | `button` | DISPARU |
| Catalogue | `a` | DISPARU |
| Nouveautés | `a` | DISPARU |
| Top | `a` | DISPARU |
| Importer un fichier | `a` | DISPARU |
| Téléchargements | `a` | DISPARU |
| Code source | `a` | OUVRE UN ONGLET |
| Signaler un bug | `a` | OUVRE UN ONGLET |
| Versions | `a` | OUVRE UN ONGLET |
| Confidentialité | `a` | DISPARU |
| Licence | `a` | OUVRE UN ONGLET |
| FR | `button` | DISPARU |
| EN | `button` | DISPARU |
| Désactiver | `button` | DISPARU |


## `lecture.html`

URL auditée : `/lecture.html?manga=01J76XY7E9FNDZ1DBBM6PBJPFK&chapter=01M1PDC3T1X0C0X02YV7TNC0Q3&source=weebcentral`

> État : **connecté**
> Les verdicts qui suivent se lisent dans CET état.

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | AGIT (focus déplacé) |
| Inko | `a` | NAVIGUE → accueil.html |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (focus déplacé) |
| Reprendre ma dernière lecture | `button#btnContinue` | NAVIGUE → chapitre.html?manga=01J76XY7E9FNDZ1DBBM6PBJPFK&chapter=01M1PDC3T1X0C0X02YV7TNC0Q3&source=weebcentral |
| Actualiser mes séries (nouveaux chapitres) | `button#btnRefresh` | AGIT (page modifiée) |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | AGIT (page modifiée) |
| Notifications | `button#btnNotif` | AGIT (page modifiée) |
| Paramètres | `a` | NAVIGUE → parametres.html |
| Kaito | `a` | NAVIGUE → profil.html |
| ↩ Retour | `a` | NAVIGUE → profil.html |
| Catalogue | `a` | NAVIGUE → catalogue.html |
| Nouveautés | `a` | NAVIGUE → catalogue.html?sort=latest |
| Top | `a` | NAVIGUE → catalogue.html?sort=rating |
| Importer un fichier | `a` | NAVIGUE → import.html |
| Téléchargements | `a` | NAVIGUE → downloads.html |
| Code source | `a` | OUVRE UN ONGLET |
| Signaler un bug | `a` | OUVRE UN ONGLET |
| Versions | `a` | OUVRE UN ONGLET |
| Confidentialité | `a` | NAVIGUE → confidentialite.html |
| Licence | `a` | OUVRE UN ONGLET |
| FR | `button` | AGIT (page modifiée) |
| EN | `button` | AGIT (page modifiée) |
| Stations | `button` | ERREUR : locator.click: Element is not visible |
| Radio | `button` | ERREUR : locator.click: Element is not visible |
| YouTube | `button` | ERREUR : locator.click: Element is not visible |
| Fichiers | `button` | ERREUR : locator.click: Element is not visible |
| Piste ou station précédente | `button#im-prev` | ERREUR : locator.click: Element is not visible |
| Lecture / pause | `button#im-pp` | ERREUR : locator.click: Element is not visible |
| Piste ou station suivante | `button#im-next` | ERREUR : locator.click: Element is not visible |
| Mode répétition | `button#im-repeat` | ERREUR : locator.click: Element is not visible |
| Minuterie de sommeil | `button#im-timer` | ERREUR : locator.click: Element is not visible |
| Agrandir le lecteur | `button#im-exp` | ERREUR : locator.click: Element is not visible |
| Réduire le lecteur en pastille | `button#im-min` | ERREUR : locator.click: Element is not visible |
| Fermer le lecteur et arrêter la musique | `button#im-close` | ERREUR : locator.click: Element is not visible |
| Fermer l'astuce | `button` | DISPARU |


## `collections.html`

URL auditée : `/collections.html`

> État : **connecté**
> Les verdicts qui suivent se lisent dans CET état.

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | AGIT (focus déplacé) |
| Inko | `a` | NAVIGUE → accueil.html |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (focus déplacé) |
| Reprendre ma dernière lecture | `button#btnContinue` | NAVIGUE → chapitre.html?manga=01J76XY7E9FNDZ1DBBM6PBJPFK&chapter=01M1PDC3T1X0C0X02YV7TNC0Q3&source=weebcentral |
| Actualiser mes séries (nouveaux chapitres) | `button#btnRefresh` | AGIT (page modifiée) |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | AGIT (page modifiée) |
| Notifications | `button#btnNotif` | AGIT (page modifiée) |
| Paramètres | `a` | NAVIGUE → parametres.html |
| Kaito | `a` | NAVIGUE → profil.html |
| + Nouvelle liste | `button#btnNewList` | AGIT (page modifiée) |
| Ouvrir la collection Lecture prioritaire — 5 œ | `a` | AGIT (focus déplacé) |
| Lecture prioritaire | `a` | AGIT (focus déplacé) |
| Modifier | `button` | **INERTE** |
| Supprimer | `button` | ÉVITÉ (destructif) |
| Catalogue | `a` | AGIT (focus déplacé) |
| Nouveautés | `a` | AGIT (focus déplacé) |
| Top | `a` | AGIT (page modifiée) |
| Importer un fichier | `a` | AGIT (focus déplacé) |
| Téléchargements | `a` | AGIT (focus déplacé) |
| Code source | `a` | OUVRE UN ONGLET |
| Signaler un bug | `a` | OUVRE UN ONGLET |
| Versions | `a` | OUVRE UN ONGLET |
| Confidentialité | `a` | AGIT (focus déplacé) |
| Licence | `a` | OUVRE UN ONGLET |
| FR | `button` | AGIT (page modifiée) |
| EN | `button` | AGIT (page modifiée) |
| Accueil | `a` | AGIT (page modifiée) |
| Bibliothèque | `a` | NAVIGUE → bibliotheque.html |
| Recherche | `a` | NAVIGUE → recherche.html |
| Profil | `a` | NAVIGUE → profil.html |
| Plus de sections | `button#mnavMore` | AGIT (page modifiée) |


## `collection-detail.html`

URL auditée : `/collection-detail.html`

> État : **connecté**
> Les verdicts qui suivent se lisent dans CET état.

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | AGIT (focus déplacé) |
| Inko | `a` | NAVIGUE → accueil.html |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (focus déplacé) |
| Reprendre ma dernière lecture | `button#btnContinue` | NAVIGUE → chapitre.html?manga=01J76XY7E9FNDZ1DBBM6PBJPFK&chapter=01M1PDC3T1X0C0X02YV7TNC0Q3&source=weebcentral |
| Actualiser mes séries (nouveaux chapitres) | `button#btnRefresh` | AGIT (page modifiée) |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | AGIT (page modifiée) |
| Notifications | `button#btnNotif` | AGIT (page modifiée) |
| Paramètres | `a` | NAVIGUE → parametres.html |
| Kaito | `a` | NAVIGUE → profil.html |
| ← Mes listes | `a` | NAVIGUE → collections.html |
| Catalogue | `a` | NAVIGUE → catalogue.html |
| Nouveautés | `a` | NAVIGUE → catalogue.html?sort=latest |
| Top | `a` | AGIT (page modifiée) |
| Importer un fichier | `a` | NAVIGUE → recherche.html |
| Téléchargements | `a` | NAVIGUE → recherche.html |
| Code source | `a` | OUVRE UN ONGLET |
| Signaler un bug | `a` | OUVRE UN ONGLET |
| Versions | `a` | OUVRE UN ONGLET |
| Confidentialité | `a` | NAVIGUE → confidentialite.html |
| Licence | `a` | OUVRE UN ONGLET |
| FR | `button` | AGIT (page modifiée) |
| EN | `button` | AGIT (page modifiée) |
| Accueil | `a` | NAVIGUE → accueil.html |
| Bibliothèque | `a` | NAVIGUE → bibliotheque.html |
| Recherche | `a` | NAVIGUE → recherche.html |
| Profil | `a` | NAVIGUE → profil.html |
| Plus de sections | `button#mnavMore` | AGIT (page modifiée) |


## `notes.html`

URL auditée : `/notes.html`

> État : **connecté**
> Les verdicts qui suivent se lisent dans CET état.

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | AGIT (focus déplacé) |
| Inko | `a` | NAVIGUE → accueil.html |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (focus déplacé) |
| Reprendre ma dernière lecture | `button#btnContinue` | NAVIGUE → chapitre.html?manga=01J76XY7E9FNDZ1DBBM6PBJPFK&chapter=01M1PDC3T1X0C0X02YV7TNC0Q3&source=weebcentral |
| Actualiser mes séries (nouveaux chapitres) | `button#btnRefresh` | AGIT (page modifiée) |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | AGIT (page modifiée) |
| Notifications | `button#btnNotif` | AGIT (page modifiée) |
| Paramètres | `a` | NAVIGUE → parametres.html |
| Kaito | `a` | NAVIGUE → profil.html |
| Lire chaque série du début à la fin | `button#jrRecit` | AGIT (page modifiée) |
| Exporter en Markdown (Obsidian, Logseq…) | `button#jrExportMd` | AGIT (page modifiée) |
| Commencer à lire → | `a` | DISPARU |
| Catalogue | `a` | NAVIGUE → catalogue.html |
| Nouveautés | `a` | NAVIGUE → catalogue.html?sort=latest |
| Top | `a` | NAVIGUE → catalogue.html?sort=rating |
| Importer un fichier | `a` | NAVIGUE → import.html |
| Téléchargements | `a` | NAVIGUE → downloads.html |
| Code source | `a` | OUVRE UN ONGLET |
| Signaler un bug | `a` | OUVRE UN ONGLET |
| Versions | `a` | OUVRE UN ONGLET |
| Confidentialité | `a` | NAVIGUE → confidentialite.html |
| Licence | `a` | OUVRE UN ONGLET |
| FR | `button` | AGIT (page modifiée) |
| EN | `button` | AGIT (page modifiée) |
| Accueil | `a` | NAVIGUE → accueil.html |
| Bibliothèque | `a` | NAVIGUE → bibliotheque.html |
| Recherche | `a` | NAVIGUE → recherche.html |
| Profil | `a` | NAVIGUE → profil.html |
| Plus de sections | `button#mnavMore` | AGIT (page modifiée) |


## `notifications.html`

URL auditée : `/notifications.html`

> État : **connecté**
> Les verdicts qui suivent se lisent dans CET état.

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | AGIT (focus déplacé) |
| Inko | `a` | NAVIGUE → accueil.html |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (focus déplacé) |
| Reprendre ma dernière lecture | `button#btnContinue` | NAVIGUE → chapitre.html?manga=01J76XY7E9FNDZ1DBBM6PBJPFK&chapter=01M1PDC3T1X0C0X02YV7TNC0Q3&source=weebcentral |
| Actualiser mes séries (nouveaux chapitres) | `button#btnRefresh` | AGIT (page modifiée) |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | AGIT (page modifiée) |
| Notifications | `button#btnNotif` | AGIT (page modifiée) |
| Paramètres | `a` | NAVIGUE → parametres.html |
| Kaito | `a` | NAVIGUE → profil.html |
| Actualiser les notifications | `button#ntRefresh` | **INERTE** |
| Recevoir les notifications même Inko fermé | `button#ntEnablePush` | AGIT (page modifiée) |
| Tout marquer lu | `button#ntMarkAll` | AGIT (page modifiée) |
| Fréquence de vérification des nouveaux chapitr | `select#ntFreq` | AGIT (focus déplacé) |
| Toutes | `button` | AGIT (page modifiée) |
| Non lues | `button` | AGIT (page modifiée) |
| Réponses | `button` | AGIT (page modifiée) |
| Mentions | `button` | AGIT (page modifiée) |
| Chapitres | `button` | AGIT (page modifiée) |
| 8 nouveaux chapitres Imouto wa Kanojo ni Deki  | `a` | DISPARU |
| 122 nouveaux chapitres My Isekai Life - I Gain | `a` | DISPARU |
| 334 nouveaux chapitres Mao · 334 chapitres à l | `a` | DISPARU |
| 75 nouveaux chapitres Dogsred · 75 chapitres à | `a` | DISPARU |
| 39 nouveaux chapitres JoJo's Bizarre Adventure | `a` | DISPARU |
| 40 nouveaux chapitres Gokurakugai · 40 chapitr | `a` | DISPARU |
| 133 nouveaux chapitres Kagurabachi · 133 chapi | `a` | DISPARU |
| 147 nouveaux chapitres Kindergarten WARS · 147 | `a` | DISPARU |
| 202 nouveaux chapitres The Fragrant Flower Blo | `a` | DISPARU |
| 21 nouveaux chapitres A Witch's Life in Mongol | `a` | DISPARU |
| 81 nouveaux chapitres Rai Rai Rai · 81 chapitr | `a` | DISPARU |
| 61 nouveaux chapitres I Was Summoned to Be a S | `a` | DISPARU |
| 63 nouveaux chapitres War of the Adults · 63 c | `a` | DISPARU |
| 238 nouveaux chapitres Shadows House · 238 cha | `a` | DISPARU |
| 273 nouveaux chapitres Sakamoto Days · 273 cha | `a` | DISPARU |
| 419 nouveaux chapitres Hunter x Hunter · 419 c | `a` | DISPARU |
| 95 nouveaux chapitres Ghost Fixers · 95 chapit | `a` | DISPARU |
| 90 nouveaux chapitres Blue Period · 90 chapitr | `a` | DISPARU |
| 277 nouveaux chapitres Shangri-La Frontier · 2 | `a` | DISPARU |
| 65 nouveaux chapitres Dragon and Chameleon · 6 | `a` | DISPARU |
| 40 nouveaux chapitres Porter of Heroes · 40 ch | `a` | DISPARU |
| 94 nouveaux chapitres Shinobi Undercover · 94  | `a` | DISPARU |
| 95 nouveaux chapitres Ichi the Witch · 95 chap | `a` | DISPARU |
| 23 nouveaux chapitres Bug Ego · 23 chapitres à | `a` | DISPARU |
| 75 nouveaux chapitres Parashoppers · 75 chapit | `a` | DISPARU |
| 87 nouveaux chapitres KAIJIN FUGEKI: Kindled S | `a` | DISPARU |
| 94 nouveaux chapitres Akira Failing in Love ·  | `a` | DISPARU |
| 354 nouveaux chapitres Blue Lock · 354 chapitr | `a` | DISPARU |
| 65 nouveaux chapitres Drama Queen · 65 chapitr | `a` | DISPARU |
| 67 nouveaux chapitres Hero Organization · 67 c | `a` | DISPARU |
| 154 nouveaux chapitres The Heroic Legend of Ar | `a` | DISPARU |
| 28 nouveaux chapitres Egao no Taenai Shokuba d | `a` | DISPARU |
| 245 nouveaux chapitres Dandadan · 245 chapitre | `a` | DISPARU |
| 3149 nouveaux chapitres Shadow Slave · 3149 ch | `a` | DISPARU |
| Catalogue | `a` | NAVIGUE → catalogue.html |
| Nouveautés | `a` | NAVIGUE → catalogue.html?sort=latest |
| Top | `a` | NAVIGUE → catalogue.html?sort=rating |
| Importer un fichier | `a` | NAVIGUE → import.html |
| Téléchargements | `a` | NAVIGUE → downloads.html |
| Code source | `a` | OUVRE UN ONGLET |
| Signaler un bug | `a` | OUVRE UN ONGLET |
| Versions | `a` | OUVRE UN ONGLET |
| Confidentialité | `a` | NAVIGUE → confidentialite.html |
| Licence | `a` | OUVRE UN ONGLET |
| FR | `button` | AGIT (page modifiée) |
| EN | `button` | AGIT (page modifiée) |
| Accueil | `a` | NAVIGUE → accueil.html |
| Bibliothèque | `a` | NAVIGUE → bibliotheque.html |
| Recherche | `a` | NAVIGUE → recherche.html |
| Profil | `a` | NAVIGUE → profil.html |
| Plus de sections | `button#mnavMore` | AGIT (page modifiée) |
| Fermer l'astuce | `button` | DISPARU |


## `downloads.html`

URL auditée : `/downloads.html`

> État : **connecté**
> Les verdicts qui suivent se lisent dans CET état.

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | AGIT (focus déplacé) |
| Inko | `a` | NAVIGUE → accueil.html |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (focus déplacé) |
| Reprendre ma dernière lecture | `button#btnContinue` | NAVIGUE → chapitre.html?manga=01J76XY7E9FNDZ1DBBM6PBJPFK&chapter=01M1PDC3T1X0C0X02YV7TNC0Q3&source=weebcentral |
| Actualiser mes séries (nouveaux chapitres) | `button#btnRefresh` | AGIT (page modifiée) |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | AGIT (page modifiée) |
| Notifications | `button#btnNotif` | AGIT (page modifiée) |
| Paramètres | `a` | NAVIGUE → parametres.html |
| Kaito | `a` | NAVIGUE → profil.html |
| Catalogue | `a` | NAVIGUE → recherche.html |
| Nouveautés | `a` | NAVIGUE → catalogue.html?sort=latest |
| Top | `a` | NAVIGUE → catalogue.html?sort=rating |
| Importer un fichier | `a` | NAVIGUE → import.html |
| Téléchargements | `a` | **INERTE** |
| Code source | `a` | OUVRE UN ONGLET |
| Signaler un bug | `a` | OUVRE UN ONGLET |
| Versions | `a` | OUVRE UN ONGLET |
| Confidentialité | `a` | DISPARU |
| Licence | `a` | OUVRE UN ONGLET |
| FR | `button` | DISPARU |
| EN | `button` | DISPARU |
| Accueil | `a` | DISPARU |
| Bibliothèque | `a` | DISPARU |
| Recherche | `a` | DISPARU |
| Profil | `a` | DISPARU |
| Plus de sections | `button#mnavMore` | DISPARU |
| Fermer l'astuce | `button` | DISPARU |


## `import.html`

URL auditée : `/import.html`

> État : **connecté**
> Les verdicts qui suivent se lisent dans CET état.

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | AGIT (focus déplacé) |
| Inko | `a` | NAVIGUE → accueil.html |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (focus déplacé) |
| Reprendre ma dernière lecture | `button#btnContinue` | NAVIGUE → chapitre.html?manga=01J76XY7E9FNDZ1DBBM6PBJPFK&chapter=01M1PDC3T1X0C0X02YV7TNC0Q3&source=weebcentral |
| Actualiser mes séries (nouveaux chapitres) | `button#btnRefresh` | AGIT (page modifiée) |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | AGIT (page modifiée) |
| Notifications | `button#btnNotif` | AGIT (page modifiée) |
| Paramètres | `a` | NAVIGUE → parametres.html |
| Kaito | `a` | NAVIGUE → profil.html |
| Catalogue | `a` | NAVIGUE → catalogue.html |
| Nouveautés | `a` | NAVIGUE → catalogue.html?sort=latest |
| Top | `a` | NAVIGUE → catalogue.html?sort=rating |
| Importer un fichier | `a` | **INERTE** |
| Téléchargements | `a` | DISPARU |
| Code source | `a` | OUVRE UN ONGLET |
| Signaler un bug | `a` | OUVRE UN ONGLET |
| Versions | `a` | OUVRE UN ONGLET |
| Confidentialité | `a` | DISPARU |
| Licence | `a` | OUVRE UN ONGLET |
| FR | `button` | DISPARU |
| EN | `button` | DISPARU |
| Accueil | `a` | DISPARU |
| Bibliothèque | `a` | DISPARU |
| Recherche | `a` | DISPARU |
| Profil | `a` | DISPARU |
| Plus de sections | `button#mnavMore` | DISPARU |
| Stations | `button` | DISPARU |
| Radio | `button` | DISPARU |
| YouTube | `button` | DISPARU |
| Fichiers | `button` | DISPARU |
| Piste ou station précédente | `button#im-prev` | DISPARU |
| Lecture / pause | `button#im-pp` | DISPARU |
| Piste ou station suivante | `button#im-next` | DISPARU |
| Mode répétition | `button#im-repeat` | DISPARU |
| Minuterie de sommeil | `button#im-timer` | DISPARU |
| Agrandir le lecteur | `button#im-exp` | DISPARU |
| Réduire le lecteur en pastille | `button#im-min` | DISPARU |
| Fermer le lecteur et arrêter la musique | `button#im-close` | DISPARU |


## `localreader.html`

URL auditée : `/localreader.html`

> État : **connecté**
> Les verdicts qui suivent se lisent dans CET état.

| Contrôle | Élément | Verdict |
|---|---|---|
| ← Bibliothèque | `a` | NAVIGUE → import.html |
| Importer un fichier | `a` | NAVIGUE → import.html |
| Mes fichiers importés | `a` | NAVIGUE → bibliotheque.html#downloads |


## `parametres.html`

URL auditée : `/parametres.html`

> État : **connecté**
> Les verdicts qui suivent se lisent dans CET état.

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | AGIT (focus déplacé) |
| Inko | `a` | NAVIGUE → accueil.html |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (focus déplacé) |
| Reprendre ma dernière lecture | `button#btnContinue` | NAVIGUE → chapitre.html?manga=01J76XY7E9FNDZ1DBBM6PBJPFK&chapter=01M1PDC3T1X0C0X02YV7TNC0Q3&source=weebcentral |
| Actualiser mes séries (nouveaux chapitres) | `button#btnRefresh` | AGIT (page modifiée) |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | AGIT (page modifiée) |
| Notifications | `button#btnNotif` | AGIT (page modifiée) |
| Paramètres | `a` | AGIT (page modifiée) |
| Kaito | `a` | DISPARU |
| Enregistrer | `button#btnSaveUsername` | DISPARU |
| Afficher le code | `button` | DISPARU |
| Gérer | `button` | DISPARU |
| INPUT | `input#chkUneMain` | DISPARU |
| Activer | `button#btnNotifsMobiles` | DISPARU |
| ← RTL | `button` | DISPARU |
| LTR → | `button` | DISPARU |
| ↕ Webtoon | `button` | DISPARU |
| Page | `button` | DISPARU |
| Double | `button` | DISPARU |
| Défilement | `button` | DISPARU |
| Haute | `button` | DISPARU |
| Éco | `button` | DISPARU |
| FR + EN | `button` | DISPARU |
| FR | `button` | DISPARU |
| EN | `button` | DISPARU |
| + JA | `button` | DISPARU |
| Sombre | `button` | DISPARU |
| AMOLED | `button` | DISPARU |
| Clair | `button` | DISPARU |
| Contraste renforcé (AAA) — texte plus sombre,  | `button` | DISPARU |
| Auto | `button` | DISPARU |
| #ff6b1a | `button` | DISPARU |
| #3b82f6 | `button` | DISPARU |
| #a855f7 | `button` | DISPARU |
| #22c55e | `button` | DISPARU |
| #ec4899 | `button` | DISPARU |
| #ef4444 | `button` | DISPARU |
| #06b6d4 | `button` | DISPARU |
| #f59e0b | `button` | DISPARU |
| Flouté | `button` | DISPARU |
| Visible | `button` | DISPARU |
| Connecter | `button` | DISPARU |
| Ouvrir le lecteur | `button#btnOpenMusic` | DISPARU |
| Vérifier | `button#btnCheckUpdate` | DISPARU |
| Vider le cache | `button#btnClearCache` | ÉVITÉ (destructif) |
| Revoir la visite | `button#btnReplayTour` | DISPARU |
| Exporter | `button#btnExport` | DISPARU |
| Importer | `button#btnImport` | DISPARU |
| Effacer | `button#btnClearHistory` | ÉVITÉ (destructif) |
| Modifier le raccourci Rechercher | `button` | DISPARU |
| Modifier le raccourci Lecture aleatoire | `button` | DISPARU |
| Modifier le raccourci Reprendre la lecture | `button` | DISPARU |
| Modifier le raccourci Ma bibliotheque | `button` | DISPARU |
| Modifier le raccourci Accueil | `button` | DISPARU |
| Modifier le raccourci Afficher cette aide | `button` | DISPARU |
| Reinitialiser | `button#btnResetShortcuts` | ÉVITÉ (destructif) |
| Restaurer | `button` | DISPARU |
| Me deconnecter | `button` | DISPARU |
| Fermer | `button` | DISPARU |
| Fermer les autres | `button#btnRevokeOthers` | DISPARU |
| Catalogue | `a` | DISPARU |
| Nouveautés | `a` | DISPARU |
| Top | `a` | DISPARU |
| Importer un fichier | `a` | DISPARU |
| Téléchargements | `a` | DISPARU |
| Code source | `a` | OUVRE UN ONGLET |
| Signaler un bug | `a` | OUVRE UN ONGLET |
| Versions | `a` | OUVRE UN ONGLET |
| Confidentialité | `a` | DISPARU |
| Licence | `a` | OUVRE UN ONGLET |
| Accueil | `a` | DISPARU |
| Bibliothèque | `a` | DISPARU |
| Recherche | `a` | DISPARU |
| Profil | `a` | DISPARU |
| Plus de sections | `button#mnavMore` | DISPARU |
| Stations | `button` | DISPARU |
| Radio | `button` | DISPARU |
| YouTube | `button` | DISPARU |
| Fichiers | `button` | DISPARU |
| Piste ou station précédente | `button#im-prev` | DISPARU |
| Lecture / pause | `button#im-pp` | DISPARU |
| Piste ou station suivante | `button#im-next` | DISPARU |
| Mode répétition | `button#im-repeat` | DISPARU |
| Minuterie de sommeil | `button#im-timer` | DISPARU |
| Agrandir le lecteur | `button#im-exp` | DISPARU |
| Réduire le lecteur en pastille | `button#im-min` | DISPARU |
| Fermer le lecteur et arrêter la musique | `button#im-close` | DISPARU |


## `profil.html`

URL auditée : `/profil.html`

> État : **connecté**
> Les verdicts qui suivent se lisent dans CET état.

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | AGIT (focus déplacé) |
| Inko | `a` | NAVIGUE → accueil.html |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (focus déplacé) |
| Reprendre ma dernière lecture | `button#btnContinue` | NAVIGUE → chapitre.html?manga=01J76XY7E9FNDZ1DBBM6PBJPFK&chapter=01M1PDC3T1X0C0X02YV7TNC0Q3&source=weebcentral |
| Actualiser mes séries (nouveaux chapitres) | `button#btnRefresh` | AGIT (page modifiée) |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | AGIT (page modifiée) |
| Notifications | `button#btnNotif` | AGIT (page modifiée) |
| Paramètres | `a` | NAVIGUE → parametres.html |
| Kaito | `a` | AGIT (page modifiée) |
| Éditer | `button` | DISPARU |
| ↗ Partager | `button` | DISPARU |
| ⊞ Vue d'ensemble | `a` | DISPARU |
| Ma bibliothèque | `a` | DISPARU |
| Historique | `a` | DISPARU |
| ≡ Listes de lecture | `a` | DISPARU |
| ★ Mes avis | `a` | DISPARU |
| Badges | `a` | DISPARU |
| Statistiques détaillées | `a` | DISPARU |
| ▶ Reprendre | `a` | DISPARU |
| Modifier l'objectif | `button#goalEdit` | DISPARU |
| Voir tout | `a` | DISPARU |
| Voir toute la collection | `a` | DISPARU |
| Frieren - Beyond Journey's End | `a` | DISPARU |
| Tyranny | `a` | DISPARU |
| Kekkai no Noah | `a` | DISPARU |
| Moby Dick; Or, The Whale | `a` | DISPARU |
| My Isekai Life - I Gained a Second Character C | `a` | DISPARU |
| Finding the Invisible Star | `a` | DISPARU |
| Reprendre One Piece au chapitre 1192 | `a` | DISPARU |
| Reprendre JoJo's Bizarre Adventure - Part 7 -  | `a` | DISPARU |
| Reprendre Death Note (Color) au chapitre 22 | `a` | DISPARU |
| Reprendre Witch Hat Atelier au chapitre 96 | `a` | DISPARU |
| Voir tous | `a` | DISPARU |
| Connecter | `button` | DISPARU |
| Droite → Gauche | `button` | DISPARU |
| Gauche → Droite | `button` | DISPARU |
| Sombre | `button` | DISPARU |
| Clair | `button` | DISPARU |
| Vertical | `button` | DISPARU |
| Horizontal | `button` | DISPARU |
| Aperçu public | `a#btnApercuPublic` | DISPARU |
| Inko Open-source · Gratuit | `a` | OUVRE UN ONGLET |
| Catalogue | `a` | DISPARU |
| Nouveautés | `a` | DISPARU |
| Top | `a` | DISPARU |
| Importer un fichier | `a` | DISPARU |
| Téléchargements | `a` | DISPARU |
| Code source | `a` | OUVRE UN ONGLET |
| Signaler un bug | `a` | OUVRE UN ONGLET |
| Versions | `a` | OUVRE UN ONGLET |
| Confidentialité | `a` | DISPARU |
| Licence | `a` | OUVRE UN ONGLET |
| FR | `button` | DISPARU |
| EN | `button` | DISPARU |
| Accueil | `a` | DISPARU |
| Bibliothèque | `a` | DISPARU |
| Recherche | `a` | DISPARU |
| Profil | `a` | DISPARU |
| Plus de sections | `button#mnavMore` | DISPARU |
| Stations | `button` | DISPARU |
| Radio | `button` | DISPARU |
| YouTube | `button` | DISPARU |
| Fichiers | `button` | DISPARU |
| Piste ou station précédente | `button#im-prev` | DISPARU |
| Lecture / pause | `button#im-pp` | DISPARU |
| Piste ou station suivante | `button#im-next` | DISPARU |
| Mode répétition | `button#im-repeat` | DISPARU |
| Minuterie de sommeil | `button#im-timer` | DISPARU |
| Agrandir le lecteur | `button#im-exp` | DISPARU |
| Réduire le lecteur en pastille | `button#im-min` | DISPARU |
| Fermer le lecteur et arrêter la musique | `button#im-close` | DISPARU |
| Fermer l'astuce | `button` | DISPARU |


## `u.html`

URL auditée : `/u.html?u=demo&preview=1`

> État : **connecté**
> Les verdicts qui suivent se lisent dans CET état.

**1 réponse(s) 404 de l’API** — souvent la bonne réponse (« ce compte n’existe pas ») ; à lire avec ce que la page affiche alors :

- `/api/users/profile/demo?as=public`

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | AGIT (focus déplacé) |
| Inko | `a` | NAVIGUE → accueil.html |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (focus déplacé) |
| Reprendre ma dernière lecture | `button#btnContinue` | NAVIGUE → chapitre.html?manga=01J76XY7E9FNDZ1DBBM6PBJPFK&chapter=01M1PDC3T1X0C0X02YV7TNC0Q3&source=weebcentral |
| Actualiser mes séries (nouveaux chapitres) | `button#btnRefresh` | AGIT (page modifiée) |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | AGIT (page modifiée) |
| Notifications | `button#btnNotif` | AGIT (page modifiée) |
| Paramètres | `a` | NAVIGUE → parametres.html |
| Kaito | `a` | NAVIGUE → profil.html |
| Catalogue | `a` | NAVIGUE → catalogue.html |
| Nouveautés | `a` | AGIT (page modifiée) |
| Top | `a` | NAVIGUE → catalogue.html?sort=rating |
| Importer un fichier | `a` | NAVIGUE → recherche.html |
| Téléchargements | `a` | NAVIGUE → recherche.html |
| Code source | `a` | OUVRE UN ONGLET |
| Signaler un bug | `a` | OUVRE UN ONGLET |
| Versions | `a` | OUVRE UN ONGLET |
| Confidentialité | `a` | NAVIGUE → confidentialite.html |
| Licence | `a` | OUVRE UN ONGLET |
| FR | `button` | AGIT (page modifiée) |
| EN | `button` | AGIT (page modifiée) |
| Accueil | `a` | NAVIGUE → accueil.html |
| Bibliothèque | `a` | NAVIGUE → bibliotheque.html |
| Recherche | `a` | NAVIGUE → recherche.html |
| Profil | `a` | NAVIGUE → profil.html |
| Plus de sections | `button#mnavMore` | AGIT (page modifiée) |
| Stations | `button` | DISPARU |
| Radio | `button` | DISPARU |
| YouTube | `button` | DISPARU |
| Fichiers | `button` | DISPARU |
| Piste ou station précédente | `button#im-prev` | DISPARU |
| Lecture / pause | `button#im-pp` | DISPARU |
| Piste ou station suivante | `button#im-next` | DISPARU |
| Mode répétition | `button#im-repeat` | DISPARU |
| Minuterie de sommeil | `button#im-timer` | DISPARU |
| Agrandir le lecteur | `button#im-exp` | DISPARU |
| Réduire le lecteur en pastille | `button#im-min` | DISPARU |
| Fermer le lecteur et arrêter la musique | `button#im-close` | DISPARU |


## `stats.html`

URL auditée : `/stats.html`

> État : **connecté**
> Les verdicts qui suivent se lisent dans CET état.

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | AGIT (focus déplacé) |
| Inko | `a` | NAVIGUE → accueil.html |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (focus déplacé) |
| Reprendre ma dernière lecture | `button#btnContinue` | NAVIGUE → chapitre.html?manga=01J76XY7E9FNDZ1DBBM6PBJPFK&chapter=01M1PDC3T1X0C0X02YV7TNC0Q3&source=weebcentral |
| Actualiser mes séries (nouveaux chapitres) | `button#btnRefresh` | AGIT (page modifiée) |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | AGIT (page modifiée) |
| Notifications | `button#btnNotif` | AGIT (page modifiée) |
| Paramètres | `a` | NAVIGUE → parametres.html |
| Kaito | `a` | NAVIGUE → profil.html |
| Définir | `button#goalSave` | AGIT (page modifiée) |
| Copier ma rétrospective | `button#retroShare` | DISPARU |
| Catalogue | `a` | NAVIGUE → catalogue.html |
| Nouveautés | `a` | NAVIGUE → catalogue.html?sort=latest |
| Top | `a` | NAVIGUE → catalogue.html?sort=rating |
| Importer un fichier | `a` | NAVIGUE → import.html |
| Téléchargements | `a` | NAVIGUE → downloads.html |
| Code source | `a` | OUVRE UN ONGLET |
| Signaler un bug | `a` | OUVRE UN ONGLET |
| Versions | `a` | OUVRE UN ONGLET |
| Confidentialité | `a` | NAVIGUE → confidentialite.html |
| Licence | `a` | OUVRE UN ONGLET |
| FR | `button` | AGIT (page modifiée) |
| EN | `button` | AGIT (page modifiée) |
| Accueil | `a` | NAVIGUE → accueil.html |
| Bibliothèque | `a` | NAVIGUE → bibliotheque.html |
| Recherche | `a` | NAVIGUE → recherche.html |
| Profil | `a` | NAVIGUE → profil.html |
| Plus de sections | `button#mnavMore` | AGIT (page modifiée) |
| Fermer l'astuce | `button` | DISPARU |


## `sources.html`

URL auditée : `/sources.html`

> État : **connecté**
> Les verdicts qui suivent se lisent dans CET état.

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | AGIT (focus déplacé) |
| Inko | `a` | NAVIGUE → accueil.html |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (focus déplacé) |
| Reprendre ma dernière lecture | `button#btnContinue` | NAVIGUE → chapitre.html?manga=01J76XY7E9FNDZ1DBBM6PBJPFK&chapter=01M1PDC3T1X0C0X02YV7TNC0Q3&source=weebcentral |
| Actualiser mes séries (nouveaux chapitres) | `button#btnRefresh` | AGIT (page modifiée) |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | AGIT (page modifiée) |
| Notifications | `button#btnNotif` | AGIT (page modifiée) |
| Paramètres | `a` | NAVIGUE → parametres.html |
| Kaito | `a` | NAVIGUE → profil.html |
| Chercher des mises à jour des extensions | `button#btnCheckExt` | **INERTE** |
| Activer | `button` | AGIT (page modifiée) |
| Vérifier que la source répond | `button` | DISPARU |
| Voir les derniers appels a cette source | `button` | DISPARU |
| Remonter MangaDex | `button` | DISPARU |
| Ne plus utiliser cette source (masquée en rech | `button` | DISPARU |
| Désinstaller complètement cette extension | `button` | DISPARU |
| Remonter SushiScan | `button` | DISPARU |
| Remonter Weeb Central | `button` | DISPARU |
| Remonter Chireads | `button` | DISPARU |
| Remonter Project Gutenberg | `button` | DISPARU |
| Remonter Livres en français | `button` | DISPARU |
| Remonter NovelBin | `button` | DISPARU |
| Remonter NovelFull | `button` | DISPARU |
| Remonter Royal Road | `button` | DISPARU |
| Catalogue | `a` | NAVIGUE → catalogue.html |
| Nouveautés | `a` | NAVIGUE → catalogue.html?sort=latest |
| Top | `a` | NAVIGUE → catalogue.html?sort=rating |
| Importer un fichier | `a` | NAVIGUE → import.html |
| Téléchargements | `a` | NAVIGUE → downloads.html |
| Code source | `a` | OUVRE UN ONGLET |
| Signaler un bug | `a` | OUVRE UN ONGLET |
| Versions | `a` | OUVRE UN ONGLET |
| Confidentialité | `a` | NAVIGUE → confidentialite.html |
| Licence | `a` | OUVRE UN ONGLET |
| FR | `button` | AGIT (page modifiée) |
| EN | `button` | AGIT (page modifiée) |
| Accueil | `a` | NAVIGUE → accueil.html |
| Bibliothèque | `a` | NAVIGUE → bibliotheque.html |
| Recherche | `a` | NAVIGUE → recherche.html |
| Profil | `a` | NAVIGUE → profil.html |
| Plus de sections | `button#mnavMore` | AGIT (page modifiée) |


## `liste.html`

URL auditée : `/liste.html`

> État : **connecté**
> Les verdicts qui suivent se lisent dans CET état.

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | AGIT (focus déplacé) |
| Inko | `a` | NAVIGUE → accueil.html |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (focus déplacé) |
| Reprendre ma dernière lecture | `button#btnContinue` | ERREUR : page.evaluate: Execution context was destroyed, most likely  |
| Actualiser mes séries (nouveaux chapitres) | `button#btnRefresh` | DISPARU |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | DISPARU |
| Notifications | `button#btnNotif` | DISPARU |
| Paramètres | `a` | DISPARU |
| Kaito | `a` | DISPARU |
| Aller à l’accueil | `a` | DISPARU |
| Catalogue | `a` | DISPARU |
| Nouveautés | `a` | DISPARU |
| Top | `a` | DISPARU |
| Importer un fichier | `a` | DISPARU |
| Téléchargements | `a` | DISPARU |
| Code source | `a` | OUVRE UN ONGLET |
| Signaler un bug | `a` | OUVRE UN ONGLET |
| Versions | `a` | OUVRE UN ONGLET |
| Confidentialité | `a` | DISPARU |
| Licence | `a` | OUVRE UN ONGLET |
| FR | `button` | DISPARU |
| EN | `button` | DISPARU |
| Accueil | `a` | DISPARU |
| Bibliothèque | `a` | DISPARU |
| Recherche | `a` | DISPARU |
| Profil | `a` | DISPARU |
| Plus de sections | `button#mnavMore` | DISPARU |


## `anilist.html`

URL auditée : `/anilist.html`

> État : **non connecté**
> Les verdicts qui suivent se lisent dans CET état.

| Contrôle | Élément | Verdict |
|---|---|---|
| Retour aux paramètres | `a` | NAVIGUE → parametres.html |
| Accueil | `a` | NAVIGUE → accueil.html |


## `confidentialite.html`

URL auditée : `/confidentialite.html`

> État : **connecté**
> Les verdicts qui suivent se lisent dans CET état.

| Contrôle | Élément | Verdict |
|---|---|---|
| Paramètres | `a` | NAVIGUE → parametres.html |
| dépôt du projet | `a` | OUVRE UN ONGLET |


## `offline.html`

URL auditée : `/offline.html`

> État : **non connecté**
> Les verdicts qui suivent se lisent dans CET état.

| Contrôle | Élément | Verdict |
|---|---|---|
| Mes téléchargements | `a` | NAVIGUE → downloads.html |
| Ma bibliothèque | `a` | NAVIGUE → bibliotheque.html |
| Mon journal | `a` | NAVIGUE → notes.html |
| Réessayer | `button#offRetry` | **INERTE** |

