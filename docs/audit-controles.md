# Audit fonctionnel — chaque contrôle, dans les deux modes

Relevé du 2026-09-09. Chaque bouton, lien et bascule a été **actionné**,
et l’état de la page comparé avant/après.

| Verdict | Sens |
|---|---|
| `NAVIGUE` | l’URL a changé — le contrôle fonctionne |
| `AGIT` | le DOM a changé — panneau ouvert, liste filtrée, bascule |
| `OUVRE UN ONGLET` | `target="_blank"` : la page courante ne bouge pas, c’est normal |
| `AGIT (focus déplacé)` | le focus a changé de cible — un lien d’évitement, une ancre |
| `AGIT (défilement)` | la page a défilé |
| `MÊME PAGE` | lien vers la page courante : il ne peut rien changer, et c’est normal |
| `RECHARGE LA PAGE` | la page est repartie du serveur — identique à l’œil, mais le contrôle a agi |
| `INERTE` | **rien n’a bougé** — à examiner |
| `ÉVITÉ` | libellé destructif : non actionné, par précaution |

- **autonome** — `http://127.0.0.1:8612`
- **hub** — `http://127.0.0.1:8088`

## Sans nom accessible — un lecteur d’écran annonce le pictogramme

Ni texte, ni `aria-label`, ni `title` : le contrôle est atteignable au
clavier et reste indéchiffrable sans le voir.

_Aucun._

## À corriger — inerte dans TOUS les modes audités

**1 contrôle(s)** ne réagissent ni en autonome, ni via le hub.

| Page | Contrôle | Élément |
|---|---|---|
| `parametres` | Couleur d’accentuation Bleu | `button` |

## Dépend du hub ou d’un compte — inerte en autonome seulement

Ces contrôles fonctionnent une fois le serveur joignable. Le défaut, s’il y
en a un, n’est pas dans le bouton : c’est que **rien ne dit à l’utilisateur**
pourquoi il ne se passe rien.

| Page | Contrôle | Élément |
|---|---|---|
| `recherche` | Nouveautés | `a` |
| `recherche` | Top | `a` |
| `recherche` | Importer un fichier | `a` |
| `serie` | Catalogue | `a` |
| `serie` | Nouveautés | `a` |
| `collection-detail` | Catalogue | `a` |
| `collection-detail` | Nouveautés | `a` |
| `collection-detail` | Top | `a` |
| `notifications` | Non lues | `button` |
| `notifications` | Réponses | `button` |
| `notifications` | Mentions | `button` |
| `notifications` | Chapitres | `button` |
| `parametres` | Gérer | `button` |
| `parametres` | LTR → | `button` |
| `parametres` | ↕ Webtoon | `button` |
| `parametres` | Double | `button` |
| `profil` | ↗ Partager | `button` |
| `profil` | Connecter un ordinateur | `button` |
| `liste` | Catalogue | `a` |
| `liste` | Nouveautés | `a` |

---

# Mode « autonome » — `http://127.0.0.1:8612`

| Page | Contrôles | Naviguent | Agissent | Onglet | **Inertes** | Erreurs JS | Actif 404 | API 404 | 404 tiers |
|---|---|---|---|---|---|---|---|---|---|
| accueil | 35 | 13 | 13 | 5 | **0** | 0 | 0 | 0 | 15 |
| catalogue | 52 | 10 | 21 | 4 | **0** | 0 | 0 | 0 | 15 |
| recherche | 24 | 6 | 9 | 4 | **3** | 0 | 0 | 0 | 15 |
| bibliotheque | 29 | 10 | 10 | 4 | **0** | 0 | 0 | 0 | 15 |
| serie | 26 | 11 | 7 | 4 | **2** | 0 | 0 | 0 | 15 |
| chapitre | 22 | 9 | 6 | 4 | **0** | 0 | 0 | 0 | 15 |
| lecture | 20 | 9 | 6 | 4 | **0** | 0 | 0 | 0 | 15 |
| collections | 26 | 4 | 16 | 4 | **0** | 0 | 0 | 0 | 15 |
| collection-detail | 24 | 9 | 7 | 4 | **3** | 0 | 0 | 0 | 15 |
| notes | 29 | 12 | 11 | 4 | **0** | 0 | 0 | 0 | 15 |
| notifications | 33 | 11 | 12 | 4 | **4** | 0 | 0 | 0 | 15 |
| downloads | 24 | 10 | 7 | 4 | **0** | 0 | 0 | 0 | 15 |
| import | 24 | 11 | 7 | 4 | **0** | 0 | 0 | 0 | 15 |
| localreader | 3 | 3 | 0 | 0 | **0** | 0 | 0 | 0 | 4 |
| parametres | 65 | 14 | 30 | 4 | **5** | 0 | 0 | 0 | 15 |
| profil | 46 | 12 | 8 | 4 | **2** | 0 | 0 | 0 | 15 |
| u | 24 | 10 | 8 | 4 | **0** | 0 | 0 | 0 | 15 |
| stats | 25 | 12 | 7 | 4 | **0** | 0 | 0 | 0 | 15 |
| sources | 29 | 15 | 8 | 4 | **0** | 0 | 0 | 0 | 15 |
| liste | 24 | 10 | 7 | 4 | **2** | 0 | 0 | 0 | 15 |
| anilist | 2 | 2 | 0 | 0 | **0** | 0 | 0 | 0 | 0 |
| confidentialite | 2 | 1 | 0 | 1 | **0** | 0 | 0 | 0 | 4 |
| offline | 4 | 3 | 0 | 0 | **0** | 0 | 0 | 0 | 0 |

**21 contrôles inertes** dans ce mode.


## `accueil.html`

URL auditée : `/accueil.html`

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
| Aller au contenu | `a` | MÊME PAGE |
| Inko | `a` | MÊME PAGE |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (page modifiée) |
| Actualiser mes séries (nouveaux chapitres) — j | `button#btnRefresh` | AGIT (page modifiée) |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | AGIT (page modifiée) |
| Paramètres | `a` | NAVIGUE → parametres.html |
| Réessayer | `button` | AGIT (focus déplacé) |
| Ma bibliothèque | `a` | NAVIGUE → bibliotheque.html |
| Voir l'historique → | `a` | NAVIGUE → profil.html |
| connecter un ordinateur | `a` | MÊME PAGE |
| Tendances précédentes | `button#trendPrev` | AGIT (focus déplacé) |
| Tendances suivantes | `button#trendNext` | AGIT (focus déplacé) |
| Voir tout → | `a` | NAVIGUE → catalogue.html |
| Tout | `button` | AGIT (page modifiée) |
| Suivis | `button` | AGIT (page modifiée) |
| Populaire | `button` | AGIT (page modifiée) |
| Charger plus | `button#btnMore` | AGIT (page modifiée) |
| Voir sur GitHub ★ | `a` | OUVRE UN ONGLET |
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
| Accueil | `a` | MÊME PAGE |
| Bibliothèque | `a` | NAVIGUE → bibliotheque.html |
| Recherche | `a` | NAVIGUE → recherche.html |
| Profil | `a` | NAVIGUE → profil.html |
| Plus de sections | `button#mnavMore` | AGIT (page modifiée) |


## `catalogue.html`

URL auditée : `/catalogue.html`

> État : **non connecté** · mode autonome (aucun hub)
> Les verdicts qui suivent se lisent dans CET état.

**15 réponse(s) 404 de sites tiers** — souvent normal (une extension pagine jusqu’au 404 pour savoir qu’elle a fini) :

- `sushiscan.fr/genres/adulte/`
- `sushiscan.fr/genres/hentai/`
- `sushiscan.fr/genres/pornhwa/page/4/`
- `sushiscan.fr/genres/pornhwa/page/5/`
- `sushiscan.fr/genres/ecchi/page/3/`
- `sushiscan.fr/genres/ecchi/page/4/`
- … et 9 autre(s)

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | MÊME PAGE |
| Inko | `a` | AGIT (focus déplacé) |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (page modifiée) |
| Actualiser mes séries (nouveaux chapitres) — j | `button#btnRefresh` | AGIT (page modifiée) |
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
| Catalogue | `a` | MÊME PAGE |
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


## `recherche.html`

URL auditée : `/recherche.html`

> État : **non connecté** · mode autonome (aucun hub)
> Les verdicts qui suivent se lisent dans CET état.

**15 réponse(s) 404 de sites tiers** — souvent normal (une extension pagine jusqu’au 404 pour savoir qu’elle a fini) :

- `sushiscan.fr/genres/hentai/`
- `sushiscan.fr/genres/adulte/`
- `sushiscan.fr/genres/pornhwa/page/5/`
- `sushiscan.fr/genres/pornhwa/page/4/`
- `sushiscan.fr/genres/ecchi/page/4/`
- `sushiscan.fr/genres/ecchi/page/5/`
- … et 9 autre(s)

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | MÊME PAGE |
| Inko | `a` | AGIT (focus déplacé) |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (page modifiée) |
| Actualiser mes séries (nouveaux chapitres) — j | `button#btnRefresh` | AGIT (page modifiée) |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | AGIT (page modifiée) |
| Paramètres | `a` | NAVIGUE → parametres.html |
| Rechercher | `button#seGo` | AGIT (focus déplacé) |
| Catalogue | `a` | AGIT (focus déplacé) |
| Nouveautés | `a` | **INERTE** |
| Top | `a` | **INERTE** |
| Importer un fichier | `a` | **INERTE** |
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
| Recherche | `a` | MÊME PAGE |
| Profil | `a` | NAVIGUE → profil.html |
| Plus de sections | `button#mnavMore` | AGIT (page modifiée) |


## `bibliotheque.html`

URL auditée : `/bibliotheque.html`

> État : **non connecté** · mode autonome (aucun hub)
> La page affiche : « Aucun ordinateur connecté Cette page lit des données que ton ordinateur synchronise. Sans hub connecté, elle reste vide — le catalogue, la r »
> Les verdicts qui suivent se lisent dans CET état.

**15 réponse(s) 404 de sites tiers** — souvent normal (une extension pagine jusqu’au 404 pour savoir qu’elle a fini) :

- `sushiscan.fr/genres/ecchi/page/4/`
- `sushiscan.fr/genres/hentai/`
- `sushiscan.fr/genres/adulte/`
- `sushiscan.fr/genres/pornhwa/page/5/`
- `sushiscan.fr/genres/pornhwa/page/4/`
- `sushiscan.fr/genres/ecchi/page/3/`
- … et 9 autre(s)

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | MÊME PAGE |
| Inko | `a` | AGIT (focus déplacé) |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (page modifiée) |
| Actualiser mes séries (nouveaux chapitres) — j | `button#btnRefresh` | AGIT (page modifiée) |
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
| Désactiver | `button` | DISPARU |
| Accueil | `a` | NAVIGUE → accueil.html |
| Bibliothèque | `a` | MÊME PAGE |
| Recherche | `a` | NAVIGUE → recherche.html |
| Profil | `a` | NAVIGUE → profil.html |
| Plus de sections | `button#mnavMore` | AGIT (page modifiée) |
| Fermer l'astuce | `button` | DISPARU |


## `serie.html`

URL auditée : `/serie.html`

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
| Aller au contenu | `a` | MÊME PAGE |
| Inko | `a` | AGIT (focus déplacé) |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (page modifiée) |
| Actualiser mes séries (nouveaux chapitres) — j | `button#btnRefresh` | AGIT (page modifiée) |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | AGIT (page modifiée) |
| Paramètres | `a` | NAVIGUE → parametres.html |
| Rechercher | `a` | NAVIGUE → recherche.html |
| Ma bibliothèque | `a` | NAVIGUE → bibliotheque.html |
| Catalogue | `a` | **INERTE** |
| Nouveautés | `a` | **INERTE** |
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
- `sushiscan.fr/genres/ecchi/page/4/`
- `sushiscan.fr/genres/ecchi/page/5/`
- `sushiscan.fr/genres/ecchi/page/3/`
- `sushiscan.fr/genres/pornhwa/page/4/`
- … et 9 autre(s)

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | MÊME PAGE |
| Inko | `a` | AGIT (focus déplacé) |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (page modifiée) |
| Actualiser mes séries (nouveaux chapitres) — j | `button#btnRefresh` | AGIT (page modifiée) |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | AGIT (page modifiée) |
| Paramètres | `a` | NAVIGUE → parametres.html |
| ↩ Retour | `button` | NAVIGUE → parametres.html |
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
| Désactiver | `button` | DISPARU |
| Fermer l'astuce | `button` | DISPARU |


## `lecture.html`

URL auditée : `/lecture.html`

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
| Aller au contenu | `a` | MÊME PAGE |
| Inko | `a` | AGIT (focus déplacé) |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (page modifiée) |
| Actualiser mes séries (nouveaux chapitres) — j | `button#btnRefresh` | AGIT (page modifiée) |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | AGIT (page modifiée) |
| Paramètres | `a` | NAVIGUE → parametres.html |
| ↩ Retour | `button` | NAVIGUE → parametres.html |
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


## `collections.html`

URL auditée : `/collections.html`

> État : **non connecté** · mode autonome (aucun hub)
> La page affiche : « Connecte-toi pour créer tes listes Garde tes séries organisées en collections personnalisées, synchronisées sur tous tes appareils. Se conne »
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
| Aller au contenu | `a` | MÊME PAGE |
| Inko | `a` | AGIT (focus déplacé) |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (page modifiée) |
| Actualiser mes séries (nouveaux chapitres) — j | `button#btnRefresh` | AGIT (page modifiée) |
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
| Désactiver | `button` | DISPARU |
| Accueil | `a` | AGIT (page modifiée) |
| Bibliothèque | `a` | NAVIGUE → bibliotheque.html |
| Recherche | `a` | NAVIGUE → recherche.html |
| Profil | `a` | NAVIGUE → profil.html |
| Plus de sections | `button#mnavMore` | AGIT (page modifiée) |


## `collection-detail.html`

URL auditée : `/collection-detail.html`

> État : **non connecté** · mode autonome (aucun hub)
> Les verdicts qui suivent se lisent dans CET état.

**15 réponse(s) 404 de sites tiers** — souvent normal (une extension pagine jusqu’au 404 pour savoir qu’elle a fini) :

- `sushiscan.fr/genres/hentai/`
- `sushiscan.fr/genres/adulte/`
- `sushiscan.fr/genres/ecchi/page/3/`
- `sushiscan.fr/genres/ecchi/page/4/`
- `sushiscan.fr/genres/ecchi/page/5/`
- `sushiscan.fr/genres/pornhwa/page/4/`
- … et 9 autre(s)

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | MÊME PAGE |
| Inko | `a` | AGIT (focus déplacé) |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (page modifiée) |
| Actualiser mes séries (nouveaux chapitres) — j | `button#btnRefresh` | AGIT (page modifiée) |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | AGIT (page modifiée) |
| Paramètres | `a` | NAVIGUE → parametres.html |
| ← Mes listes | `a` | NAVIGUE → collections.html |
| Catalogue | `a` | **INERTE** |
| Nouveautés | `a` | **INERTE** |
| Top | `a` | **INERTE** |
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

> État : **non connecté** · mode autonome (aucun hub)
> Les verdicts qui suivent se lisent dans CET état.

**15 réponse(s) 404 de sites tiers** — souvent normal (une extension pagine jusqu’au 404 pour savoir qu’elle a fini) :

- `sushiscan.fr/genres/adulte/`
- `sushiscan.fr/genres/hentai/`
- `sushiscan.fr/genres/pornhwa/page/4/`
- `sushiscan.fr/genres/ecchi/page/4/`
- `sushiscan.fr/genres/pornhwa/page/5/`
- `sushiscan.fr/genres/smut/page/7/`
- … et 9 autre(s)

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | MÊME PAGE |
| Inko | `a` | AGIT (focus déplacé) |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (page modifiée) |
| Actualiser mes séries (nouveaux chapitres) — j | `button#btnRefresh` | AGIT (page modifiée) |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | AGIT (page modifiée) |
| Paramètres | `a` | NAVIGUE → parametres.html |
| Lire chaque série du début à la fin | `button#jrRecit` | AGIT (focus déplacé) |
| Exporter en Markdown (Obsidian, Logseq…) | `button#jrExportMd` | AGIT (focus déplacé) |
| Filtrer par série | `select#jrFiltreSerie` | AGIT (focus déplacé) |
| Tout afficher | `button#jrFiltresRaz` | AGIT (focus déplacé) |
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


## `notifications.html`

URL auditée : `/notifications.html`

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
| Aller au contenu | `a` | MÊME PAGE |
| Inko | `a` | AGIT (focus déplacé) |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (page modifiée) |
| Actualiser mes séries (nouveaux chapitres) — j | `button#btnRefresh` | AGIT (page modifiée) |
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
| Fermer l'astuce | `button` | DISPARU |


## `downloads.html`

URL auditée : `/downloads.html`

> État : **non connecté** · mode autonome (aucun hub)
> Les verdicts qui suivent se lisent dans CET état.

**15 réponse(s) 404 de sites tiers** — souvent normal (une extension pagine jusqu’au 404 pour savoir qu’elle a fini) :

- `sushiscan.fr/genres/adulte/`
- `sushiscan.fr/genres/hentai/`
- `sushiscan.fr/genres/pornhwa/page/4/`
- `sushiscan.fr/genres/pornhwa/page/5/`
- `sushiscan.fr/genres/ecchi/page/5/`
- `sushiscan.fr/genres/ecchi/page/4/`
- … et 9 autre(s)

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | MÊME PAGE |
| Inko | `a` | AGIT (focus déplacé) |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (page modifiée) |
| Actualiser mes séries (nouveaux chapitres) — j | `button#btnRefresh` | AGIT (page modifiée) |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | AGIT (page modifiée) |
| Paramètres | `a` | NAVIGUE → parametres.html |
| Catalogue | `a` | NAVIGUE → recherche.html |
| Nouveautés | `a` | NAVIGUE → catalogue.html?sort=latest |
| Top | `a` | NAVIGUE → catalogue.html?sort=rating |
| Importer un fichier | `a` | NAVIGUE → import.html |
| Téléchargements | `a` | MÊME PAGE |
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


## `import.html`

URL auditée : `/import.html`

> État : **non connecté** · mode autonome (aucun hub)
> Les verdicts qui suivent se lisent dans CET état.

**15 réponse(s) 404 de sites tiers** — souvent normal (une extension pagine jusqu’au 404 pour savoir qu’elle a fini) :

- `sushiscan.fr/genres/hentai/`
- `sushiscan.fr/genres/adulte/`
- `sushiscan.fr/genres/ecchi/page/5/`
- `sushiscan.fr/genres/ecchi/page/4/`
- `sushiscan.fr/genres/ecchi/page/3/`
- `sushiscan.fr/genres/pornhwa/page/5/`
- … et 9 autre(s)

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | MÊME PAGE |
| Inko | `a` | AGIT (focus déplacé) |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (page modifiée) |
| Actualiser mes séries (nouveaux chapitres) — j | `button#btnRefresh` | AGIT (page modifiée) |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | AGIT (page modifiée) |
| Paramètres | `a` | NAVIGUE → parametres.html |
| Connecter un ordinateur | `button` | NAVIGUE → parametres.html |
| Catalogue | `a` | NAVIGUE → catalogue.html |
| Nouveautés | `a` | NAVIGUE → catalogue.html?sort=latest |
| Top | `a` | NAVIGUE → catalogue.html?sort=rating |
| Importer un fichier | `a` | MÊME PAGE |
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


## `localreader.html`

URL auditée : `/localreader.html`

> État : **non connecté** · mode autonome (aucun hub)
> Les verdicts qui suivent se lisent dans CET état.

**4 réponse(s) 404 de sites tiers** — souvent normal (une extension pagine jusqu’au 404 pour savoir qu’elle a fini) :

- `sushiscan.fr/genres/adulte/`
- `sushiscan.fr/genres/hentai/`
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

**15 réponse(s) 404 de sites tiers** — souvent normal (une extension pagine jusqu’au 404 pour savoir qu’elle a fini) :

- `sushiscan.fr/genres/adulte/`
- `sushiscan.fr/genres/hentai/`
- `sushiscan.fr/genres/pornhwa/page/4/`
- `sushiscan.fr/genres/pornhwa/page/5/`
- `sushiscan.fr/genres/ecchi/page/3/`
- `sushiscan.fr/genres/ecchi/page/5/`
- … et 9 autre(s)

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | MÊME PAGE |
| Inko | `a` | AGIT (focus déplacé) |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (page modifiée) |
| Actualiser mes séries (nouveaux chapitres) — j | `button#btnRefresh` | AGIT (page modifiée) |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | AGIT (page modifiée) |
| Paramètres | `a` | MÊME PAGE |
| Connecter un ordinateur | `button` | AGIT (page modifiée) |
| Afficher le code | `button` | AGIT (page modifiée) |
| Gérer | `button` | **INERTE** |
| INPUT | `input#chkUneMain` | AGIT (page modifiée) |
| Activer | `button#btnNotifsMobiles` | AGIT (focus déplacé) |
| ← RTL | `button` | AGIT (page modifiée) |
| LTR → | `button` | **INERTE** |
| ↕ Webtoon | `button` | **INERTE** |
| Page | `button` | AGIT (focus déplacé) |
| Double | `button` | **INERTE** |
| Défilement | `button` | AGIT (page modifiée) |
| Haute | `button` | AGIT (page modifiée) |
| Éco | `button` | AGIT (page modifiée) |
| FR + EN | `button` | NAVIGUE → catalogue.html |
| FR | `button` | AGIT (page modifiée) |
| EN | `button` | AGIT (page modifiée) |
| + JA | `button` | AGIT (page modifiée) |
| Sombre | `button` | AGIT (page modifiée) |
| AMOLED | `button` | AGIT (page modifiée) |
| Clair | `button` | AGIT (page modifiée) |
| Contraste renforcé (AAA) — texte plus sombre,  | `button` | AGIT (page modifiée) |
| Auto | `button` | AGIT (page modifiée) |
| Couleur d’accentuation Orange | `button` | NAVIGUE → accueil.html |
| Couleur d’accentuation Bleu | `button` | **INERTE** |
| Couleur d’accentuation Violet | `button` | DISPARU |
| Couleur d’accentuation Vert | `button` | DISPARU |
| Couleur d’accentuation Rose | `button` | DISPARU |
| Couleur d’accentuation Rouge | `button` | DISPARU |
| Couleur d’accentuation Cyan | `button` | DISPARU |
| Couleur d’accentuation Ambre | `button` | DISPARU |
| Flouté | `button` | AGIT (page modifiée) |
| Visible | `button` | AGIT (page modifiée) |
| Connecter | `button` | NAVIGUE → https://anilist.co/login?apiVersion=v2&client_id=43908&response_type=token& |
| Ouvrir le lecteur | `button#btnOpenMusic` | AGIT (page modifiée) |
| Vérifier | `button#btnCheckUpdate` | AGIT (page modifiée) |
| Vider le cache | `button#btnClearCache` | ÉVITÉ (destructif) |
| Revoir la visite | `button#btnReplayTour` | AGIT (focus déplacé) |
| Afficher | `button#btnDiagVoir` | AGIT (page modifiée) |
| Copier le rapport | `button#btnDiagCopier` | AGIT (page modifiée) |
| Exporter | `button#btnExport` | NAVIGUE → recherche.html |
| Importer | `button#btnImport` | AGIT (page modifiée) |
| Effacer | `button#btnClearHistory` | ÉVITÉ (destructif) |
| Reinitialiser | `button#btnResetShortcuts` | ÉVITÉ (destructif) |
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
| Désactiver | `button` | DISPARU |
| Accueil | `a` | NAVIGUE → accueil.html |
| Bibliothèque | `a` | NAVIGUE → bibliotheque.html |
| Recherche | `a` | NAVIGUE → recherche.html |
| Profil | `a` | NAVIGUE → profil.html |
| Plus de sections | `button#mnavMore` | AGIT (page modifiée) |


## `profil.html`

URL auditée : `/profil.html`

> État : **non connecté** · mode autonome (aucun hub)
> Les verdicts qui suivent se lisent dans CET état.

**15 réponse(s) 404 de sites tiers** — souvent normal (une extension pagine jusqu’au 404 pour savoir qu’elle a fini) :

- `sushiscan.fr/genres/ecchi/page/4/`
- `sushiscan.fr/genres/adulte/`
- `sushiscan.fr/genres/hentai/`
- `sushiscan.fr/genres/pornhwa/page/4/`
- `sushiscan.fr/genres/pornhwa/page/5/`
- `sushiscan.fr/genres/ecchi/page/5/`
- … et 9 autre(s)

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | MÊME PAGE |
| Inko | `a` | AGIT (focus déplacé) |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (page modifiée) |
| Actualiser mes séries (nouveaux chapitres) — j | `button#btnRefresh` | AGIT (page modifiée) |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | AGIT (page modifiée) |
| Paramètres | `a` | NAVIGUE → parametres.html |
| Éditer | `button` | AGIT (focus déplacé) |
| ↗ Partager | `button` | **INERTE** |
| ⊞ Vue d'ensemble | `a` | MÊME PAGE |
| Ma bibliothèque | `a` | NAVIGUE → bibliotheque.html |
| Historique | `a` | MÊME PAGE |
| ≡ Listes de lecture | `a` | MÊME PAGE |
| ★ Mes avis | `a` | MÊME PAGE |
| Badges | `a` | MÊME PAGE |
| Statistiques détaillées | `a` | NAVIGUE → stats.html |
| Connecter un ordinateur | `button` | **INERTE** |
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
| Profil | `a` | MÊME PAGE |
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
| Fermer l'astuce | `button` | DISPARU |


## `u.html`

URL auditée : `/u.html?u=demo&preview=1`

> État : **non connecté** · mode autonome (aucun hub)
> Les verdicts qui suivent se lisent dans CET état.

**15 réponse(s) 404 de sites tiers** — souvent normal (une extension pagine jusqu’au 404 pour savoir qu’elle a fini) :

- `sushiscan.fr/genres/adulte/`
- `sushiscan.fr/genres/hentai/`
- `sushiscan.fr/genres/pornhwa/page/4/`
- `sushiscan.fr/genres/pornhwa/page/5/`
- `sushiscan.fr/genres/ecchi/page/3/`
- `sushiscan.fr/genres/ecchi/page/4/`
- … et 9 autre(s)

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | MÊME PAGE |
| Inko | `a` | AGIT (focus déplacé) |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (page modifiée) |
| Actualiser mes séries (nouveaux chapitres) — j | `button#btnRefresh` | AGIT (page modifiée) |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | AGIT (page modifiée) |
| Paramètres | `a` | NAVIGUE → parametres.html |
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
| Désactiver | `button` | DISPARU |
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

- `sushiscan.fr/genres/hentai/`
- `sushiscan.fr/genres/adulte/`
- `sushiscan.fr/genres/pornhwa/page/4/`
- `sushiscan.fr/genres/pornhwa/page/5/`
- `sushiscan.fr/genres/ecchi/page/3/`
- `sushiscan.fr/genres/ecchi/page/4/`
- … et 9 autre(s)

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | MÊME PAGE |
| Inko | `a` | AGIT (focus déplacé) |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (page modifiée) |
| Actualiser mes séries (nouveaux chapitres) — j | `button#btnRefresh` | AGIT (page modifiée) |
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

- `sushiscan.fr/genres/hentai/`
- `sushiscan.fr/genres/adulte/`
- `sushiscan.fr/genres/pornhwa/page/4/`
- `sushiscan.fr/genres/pornhwa/page/5/`
- `sushiscan.fr/genres/ecchi/page/3/`
- `sushiscan.fr/genres/ecchi/page/4/`
- … et 9 autre(s)

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | MÊME PAGE |
| Inko | `a` | AGIT (focus déplacé) |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (page modifiée) |
| Actualiser mes séries (nouveaux chapitres) — j | `button#btnRefresh` | AGIT (page modifiée) |
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
| Désactiver | `button` | DISPARU |
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

- `sushiscan.fr/genres/hentai/`
- `sushiscan.fr/genres/adulte/`
- `sushiscan.fr/genres/pornhwa/page/4/`
- `sushiscan.fr/genres/pornhwa/page/5/`
- `sushiscan.fr/genres/ecchi/page/4/`
- `sushiscan.fr/genres/smut/page/7/`
- … et 9 autre(s)

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | MÊME PAGE |
| Inko | `a` | AGIT (focus déplacé) |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (page modifiée) |
| Actualiser mes séries (nouveaux chapitres) — j | `button#btnRefresh` | AGIT (page modifiée) |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | AGIT (page modifiée) |
| Paramètres | `a` | NAVIGUE → parametres.html |
| Aller à l’accueil | `a` | NAVIGUE → accueil.html |
| Catalogue | `a` | **INERTE** |
| Nouveautés | `a` | **INERTE** |
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

**4 réponse(s) 404 de sites tiers** — souvent normal (une extension pagine jusqu’au 404 pour savoir qu’elle a fini) :

- `sushiscan.fr/genres/adulte/`
- `sushiscan.fr/genres/hentai/`
- `sushiscan.fr/genres/pornhwa/page/4/`
- `sushiscan.fr/genres/pornhwa/page/5/`

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
| Réessayer | `button#offRetry` | RECHARGE LA PAGE |

---

# Mode « hub » — `http://127.0.0.1:8088`

| Page | Contrôles | Naviguent | Agissent | Onglet | **Inertes** | Erreurs JS | Actif 404 | API 404 | 404 tiers |
|---|---|---|---|---|---|---|---|---|---|
| accueil | 35 | 14 | 13 | 5 | **0** | 0 | 0 | 0 | 0 |
| catalogue | 69 | 14 | 21 | 4 | **0** | 0 | 0 | 0 | 0 |
| recherche | 59 | 26 | 10 | 4 | **1** | 0 | 0 | 0 | 0 |
| bibliotheque | 444 | 12 | 12 | 4 | **0** | 0 | 0 | 0 | 0 |
| serie | 60 | 11 | 9 | 4 | **0** | 0 | 0 | 0 | 0 |
| chapitre | 43 | 9 | 6 | 4 | **0** | 0 | 0 | 0 | 0 |
| lecture | 24 | 10 | 6 | 4 | **0** | 0 | 0 | 0 | 0 |
| collections | 31 | 6 | 18 | 4 | **1** | 0 | 0 | 0 | 0 |
| collection-detail | 28 | 13 | 9 | 4 | **0** | 0 | 0 | 0 | 0 |
| notes | 31 | 13 | 12 | 4 | **0** | 0 | 0 | 0 | 0 |
| notifications | 68 | 12 | 16 | 4 | **1** | 0 | 0 | 0 | 0 |
| downloads | 26 | 11 | 8 | 4 | **0** | 0 | 0 | 0 | 0 |
| import | 28 | 13 | 8 | 4 | **0** | 0 | 0 | 0 | 0 |
| localreader | 3 | 3 | 0 | 0 | **0** | 0 | 0 | 0 | 0 |
| parametres | 77 | 19 | 41 | 4 | **2** | 0 | 0 | 0 | 0 |
| profil | 76 | 21 | 21 | 5 | **5** | 0 | 0 | 0 | 0 |
| u | 26 | 11 | 8 | 4 | **2** | 0 | 0 | 1 | 0 |
| stats | 30 | 13 | 9 | 4 | **0** | 0 | 0 | 0 | 0 |
| sources | 42 | 13 | 12 | 4 | **1** | 0 | 0 | 0 | 0 |
| liste | 28 | 13 | 9 | 4 | **0** | 0 | 0 | 0 | 0 |
| anilist | 2 | 2 | 0 | 0 | **0** | 0 | 0 | 0 | 0 |
| confidentialite | 2 | 1 | 0 | 1 | **0** | 0 | 0 | 0 | 0 |
| offline | 4 | 3 | 0 | 0 | **0** | 0 | 0 | 0 | 0 |

**13 contrôles inertes** dans ce mode.


## `accueil.html`

URL auditée : `/accueil.html`

> État : **connecté**
> Les verdicts qui suivent se lisent dans CET état.

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | MÊME PAGE |
| Inko | `a` | MÊME PAGE |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (focus déplacé) |
| Reprendre ma dernière lecture | `button#btnContinue` | NAVIGUE → chapitre.html?manga=46e530ce-0766-4cbd-b005-5e6fb0ba5e71&chapter=fa3ddc54-3799-4301-bec0-c8c8c35d0677&source=mangadex |
| Actualiser mes séries (nouveaux chapitres) | `button#btnRefresh` | AGIT (page modifiée) |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | AGIT (page modifiée) |
| Notifications — aucune non lue | `button#btnNotif` | AGIT (page modifiée) |
| Paramètres | `a` | NAVIGUE → parametres.html |
| Kaito | `a` | NAVIGUE → profil.html |
| Voir l'historique → | `a` | NAVIGUE → profil.html |
| Tendances précédentes | `button#trendPrev` | AGIT (focus déplacé) |
| Tendances suivantes | `button#trendNext` | AGIT (page modifiée) |
| Voir tout → | `a` | NAVIGUE → catalogue.html |
| Tout | `button` | AGIT (page modifiée) |
| Suivis | `button` | AGIT (page modifiée) |
| Populaire | `button` | AGIT (page modifiée) |
| Charger plus | `button#btnMore` | AGIT (page modifiée) |
| Voir sur GitHub ★ | `a` | OUVRE UN ONGLET |
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
| Accueil | `a` | MÊME PAGE |
| Bibliothèque | `a` | NAVIGUE → bibliotheque.html |
| Recherche | `a` | NAVIGUE → recherche.html |
| Profil | `a` | NAVIGUE → profil.html |
| Plus de sections | `button#mnavMore` | AGIT (page modifiée) |


## `catalogue.html`

URL auditée : `/catalogue.html`

> État : **connecté**
> Les verdicts qui suivent se lisent dans CET état.

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | MÊME PAGE |
| Inko | `a` | AGIT (focus déplacé) |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (page modifiée) |
| Reprendre ma dernière lecture | `button#btnContinue` | NAVIGUE → chapitre.html?manga=46e530ce-0766-4cbd-b005-5e6fb0ba5e71&chapter=fa3ddc54-3799-4301-bec0-c8c8c35d0677&source=mangadex |
| Actualiser mes séries (nouveaux chapitres) | `button#btnRefresh` | DISPARU |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | AGIT (page modifiée) |
| Notifications — aucune non lue | `button#btnNotif` | AGIT (page modifiée) |
| Paramètres | `a` | NAVIGUE → parametres.html |
| Kaito | `a` | NAVIGUE → profil.html |
| Filtres | `button#btnFiltresFeuille` | AGIT (panneau) |
| Toutes les sources | `button` | AGIT (page modifiée) |
| Chireads | `button` | DISPARU |
| Project Gutenberg | `button` | DISPARU |
| Livres en français | `button` | DISPARU |
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
| Voir la fiche | `a` | NAVIGUE → serie.html?id=b0b721ff-c388-4486-aa0f-c2b0bb321512 |
| Grille | `button` | AGIT (focus déplacé) |
| Liste | `button` | AGIT (page modifiée) |
| Trier le catalogue | `select#sortSelect` | AGIT (focus déplacé) |
| Charger la suite | `button#catLoadMore` | DISPARU |
| Page précédente | `button` | DISPARU |
| Page 1 | `button` | DISPARU |
| Page 2 | `button` | DISPARU |
| Page 3 | `button` | DISPARU |
| Page 3497 | `button` | DISPARU |
| Page suivante | `button` | DISPARU |
| Voir toutes les collections → | `a` | NAVIGUE → collections.html |
| Catalogue | `a` | MÊME PAGE |
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


## `recherche.html`

URL auditée : `/recherche.html`

> État : **connecté**
> Les verdicts qui suivent se lisent dans CET état.

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | MÊME PAGE |
| Inko | `a` | AGIT (focus déplacé) |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (page modifiée) |
| Reprendre ma dernière lecture | `button#btnContinue` | NAVIGUE → chapitre.html?manga=46e530ce-0766-4cbd-b005-5e6fb0ba5e71&chapter=fa3ddc54-3799-4301-bec0-c8c8c35d0677&source=mangadex |
| Actualiser mes séries (nouveaux chapitres) | `button#btnRefresh` | AGIT (page modifiée) |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | AGIT (page modifiée) |
| Notifications — aucune non lue | `button#btnNotif` | AGIT (page modifiée) |
| Paramètres | `a` | NAVIGUE → parametres.html |
| Kaito | `a` | NAVIGUE → profil.html |
| Rechercher | `button#seGo` | AGIT (focus déplacé) |
| tout effacer | `button#seHistClear` | ÉVITÉ (destructif) |
| Frieren - Beyond Journey's End | `a` | NAVIGUE → serie.html?id=01J76XYDGDQERFSK333582BNBZ&source=weebcentral |
| Tyranny | `a` | NAVIGUE → serie.html?id=3846f669-4277-43ca-ada8-0c57961f5f1f&source=mangadex |
| Kekkai no Noah | `a` | NAVIGUE → serie.html?id=1f91350e-c216-4ca8-961f-71cf65d9fb4e&source=mangadex |
| Moby Dick; Or, The Whale | `a` | NAVIGUE → serie.html?id=2701&source=gutenberg |
| My Isekai Life - I Gained a Second Character C | `a` | NAVIGUE → serie.html?id=01J76XYCT53KQ0JESVSWE2SAAS&source=weebcentral |
| Finding the Invisible Star | `a` | NAVIGUE → serie.html?id=01KZNSXCKDBP1BMW8HD6JGWF4K&source=weebcentral |
| The Oracles of Kami | `a` | NAVIGUE → serie.html?id=01KMDAY0W668R58QM4ZYH03JPM&source=weebcentral |
| The book review digest, volume 05, 1909 | `a` | NAVIGUE → serie.html?id=79330&source=gutenberg |
| Imouto wa Kanojo ni Deki Nai no ni | `a` | NAVIGUE → serie.html?id=01J76XYGNVN7WSG7QSA93CSNRG&source=weebcentral |
| Egao no Taenai Shokuba desu. | `a` | NAVIGUE → serie.html?id=5199b00b-f55d-43d2-bf36-63873adee286&source=mangadex |
| Death Note (Color) | `a` | NAVIGUE → serie.html?id=01J76XYEVSN36R3RWD9TNKB1BM&source=weebcentral |
| Madoromi Barmaid | `a` | NAVIGUE → serie.html?id=b8a3be2d-a2be-4e9a-b1c2-8a46aacc9aba&source=mangadex |
| Na Honjaman Level-Up | `a` | AGIT (focus déplacé) |
| Sono Bisque Doll wa Koi o Suru | `a` | **INERTE** |
| Kage no Jitsuryokusha ni Naritakute! | `a` | NAVIGUE → serie.html?id=77bee52c-d2d6-44ad-a33a-1734c1fe696a&source=mangadex |
| Tensei Shitara Slime datta Ken | `a` | NAVIGUE → serie.html?id=e78a489b-6632-4d61-b00b-5206f5b8b22b&source=mangadex |
| Chainsaw Man | `a` | DISPARU |
| Sousou no Frieren | `a` | DISPARU |
| Otome Game Sekai wa Mob ni Kibishii Sekai desu | `a` | DISPARU |
| One Punch-Man | `a` | DISPARU |
| Mushoku Tensei: Isekai Ittara Honki Dasu | `a` | DISPARU |
| Komi-san wa Komyushou Desu. | `a` | DISPARU |
| Lv2 kara Cheat datta Moto Yuusha Kouho no Matt | `a` | DISPARU |
| Ijiranaide, Nagatoro-san | `a` | DISPARU |
| Tsuki ga Michibiku Isekai Douchuu | `a` | DISPARU |
| Kumo desu ga, Nani ka? | `a` | DISPARU |
| Ki ni Natteru Hito ga Otoko ja Nakatta | `a` | DISPARU |
| Anta to Osananajimi tte dake demo Iya nanoni!  | `a` | DISPARU |
| Mieruko-chan | `a` | DISPARU |
| Akuyaku Reijou Level 99 ~Watashi wa Ura Boss d | `a` | DISPARU |
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
| Bibliothèque — 227 séries avec des chapitres n | `a` | NAVIGUE → bibliotheque.html |
| Recherche | `a` | MÊME PAGE |
| Profil | `a` | NAVIGUE → profil.html |
| Plus de sections | `button#mnavMore` | AGIT (page modifiée) |


## `bibliotheque.html`

URL auditée : `/bibliotheque.html`

> État : **connecté**
> Les verdicts qui suivent se lisent dans CET état.

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | MÊME PAGE |
| Inko | `a` | AGIT (focus déplacé) |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (page modifiée) |
| Reprendre ma dernière lecture | `button#btnContinue` | NAVIGUE → chapitre.html?manga=46e530ce-0766-4cbd-b005-5e6fb0ba5e71&chapter=fa3ddc54-3799-4301-bec0-c8c8c35d0677&source=mangadex |
| Actualiser mes séries (nouveaux chapitres) | `button#btnRefresh` | AGIT (page modifiée) |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | AGIT (page modifiée) |
| Notifications — aucune non lue | `button#btnNotif` | AGIT (page modifiée) |
| Paramètres | `a` | NAVIGUE → parametres.html |
| Kaito | `a` | NAVIGUE → profil.html |
| Bibliothèque | `button` | AGIT (focus déplacé) |
| Mises à jour | `button` | AGIT (page modifiée) |
| Signets | `button` | AGIT (page modifiée) |
| Téléchargements | `button` | AGIT (page modifiée) |
| Trier la bibliothèque | `select#libSort` | ERREUR : locator.click: Element is not visible |
| Vue grille | `button` | ERREUR : locator.click: Element is not visible |
| Vue liste | `button` | ERREUR : locator.click: Element is not visible |
| Changer la densité d'affichage | `button#btnLibDensity` | ERREUR : locator.click: Element is not visible |
| Sélectionner plusieurs séries | `button#btnLibSelect` | ERREUR : locator.click: Element is not visible |
| Ouvrir une série au hasard dans ma bibliothèqu | `button#btnLibRandom` | ERREUR : locator.click: Element is not visible |
| Télécharger une sauvegarde de mes données (JSO | `button#btnLibExport` | ERREUR : locator.click: Element is not visible |
| Exporter la bibliothèque en CSV (tableur, Good | `button#btnLibExportCsv` | ERREUR : locator.click: Element is not visible |
| Restaurer une sauvegarde (JSON) | `button#btnLibImport` | ERREUR : locator.click: Element is not visible |
| Vérifier les nouveaux chapitres de toute la bi | `button#btnLibRefresh` | ERREUR : locator.click: Element is not visible |
| 1191 One Piece Chap. 1192 | `a` | ERREUR : locator.click: Element is not visible |
| 57 Death Note (Color) Chap. 22 | `a` | ERREUR : locator.click: Element is not visible |
| 99 Witch Hat Atelier Chap. 96 | `a` | ERREUR : locator.click: Element is not visible |
| 154 The Heroic Legend of Arslan Chap. 153 | `a` | ERREUR : locator.click: Element is not visible |
| 245 Dandadan Chap. 241 | `a` | ERREUR : locator.click: Element is not visible |
| 36 Boruto: Two Blue Vortex Chap. 36 | `a` | ERREUR : locator.click: Element is not visible |
| 369 Kengan Omega Chap. 363 | `a` | ERREUR : locator.click: Element is not visible |
| 233 Zipang Chap. 229 | `a` | ERREUR : locator.click: Element is not visible |
| 201 The Fragrant Flower Blooms With Dignity Ch | `a` | ERREUR : locator.click: Element is not visible |
| 252 The Seven Deadly Sins - Four Knights of th | `a` | ERREUR : locator.click: Element is not visible |
| 274 Sakamoto Days Chap. 269 | `a` | ERREUR : locator.click: Element is not visible |
| 101 Centuria Chap. 98 | `a` | ERREUR : locator.click: Element is not visible |
| Tout375 | `button` | ERREUR : locator.click: Element is not visible |
| Mangas360 | `button` | ERREUR : locator.click: Element is not visible |
| Romans15 | `button` | ERREUR : locator.click: Element is not visible |
| En cours2 | `button` | ERREUR : locator.click: Element is not visible |
| Terminé1 | `button` | ERREUR : locator.click: Element is not visible |
| À lire1 | `button` | ERREUR : locator.click: Element is not visible |
| En pause1 | `button` | ERREUR : locator.click: Element is not visible |
| Toutes sources | `button` | ERREUR : locator.click: Element is not visible |
| chireads9 | `button` | ERREUR : locator.click: Element is not visible |
| gutenberg2 | `button` | ERREUR : locator.click: Element is not visible |
| mangadex21 | `button` | ERREUR : locator.click: Element is not visible |
| novelbin1 | `button` | ERREUR : locator.click: Element is not visible |
| novelfull3 | `button` | ERREUR : locator.click: Element is not visible |
| sushiscan83 | `button` | ERREUR : locator.click: Element is not visible |
| weebcentral256 | `button` | ERREUR : locator.click: Element is not visible |
| N'afficher que les séries avec des chapitres n | `button#chipUnread` | ERREUR : locator.click: Element is not visible |
| 7 ✕ Imouto wa Kanojo ni Deki Nai no ni Pas com | `a` | ERREUR : locator.click: Element is not visible |
| Épingler | `button` | ERREUR : locator.click: Element is not visible |
| 147 ✕ Frieren - Beyond Journey's End Pas comme | `a` | ERREUR : locator.click: Element is not visible |
| 12 ✕ Tyranny Pas commencé · mangadex | `a` | ERREUR : locator.click: Element is not visible |
| 25 ✕ Kekkai no Noah Pas commencé · mangadex | `a` | ERREUR : locator.click: Element is not visible |
| ROMAN ✕ Moby Dick; Or, The Whale Chap. 1 · gut | `a` | ERREUR : locator.click: Element is not visible |
| 99 ✕ My Isekai Life - I Gained a Second Charac | `a` | ERREUR : locator.click: Element is not visible |
| 4 ✕ Finding the Invisible Star Pas commencé ·  | `a` | ERREUR : locator.click: Element is not visible |
| 15 ✕ The Oracles of Kami Pas commencé · weebce | `a` | ERREUR : locator.click: Element is not visible |
| ROMAN 1 ✕ The book review digest, volume 05, 1 | `a` | ERREUR : locator.click: Element is not visible |
| 32 ✕ Egao no Taenai Shokuba desu. Chap. 1 · ma | `a` | ERREUR : locator.click: Element is not visible |
| 57 ✕ Death Note (Color) Chap. 22 · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 38 ✕ Madoromi Barmaid Pas commencé · mangadex | `a` | ERREUR : locator.click: Element is not visible |
| 12 ✕ Shoujouhime Pas commencé · mangadex | `a` | ERREUR : locator.click: Element is not visible |
| 281 ✕ Yu☆Gi☆Oh! (Official Colored) Pas commenc | `a` | ERREUR : locator.click: Element is not visible |
| 240 ✕ Shadows House (Official Colored) Pas com | `a` | ERREUR : locator.click: Element is not visible |
| 126 ✕ Golden Kamuy (Official Colored) Pas comm | `a` | ERREUR : locator.click: Element is not visible |
| 158 ✕ Kimagure Orange Road (Official Colored)  | `a` | ERREUR : locator.click: Element is not visible |
| 47 ✕ The Darwin Incident Pas commencé · weebce | `a` | ERREUR : locator.click: Element is not visible |
| 16 ✕ The Spellbook Library Pas commencé · weeb | `a` | ERREUR : locator.click: Element is not visible |
| 400 ✕ Hunter x Hunter (Official Colored) Pas c | `a` | ERREUR : locator.click: Element is not visible |
| 25 ✕ Kurumizawa's Folly Pas commencé · weebcen | `a` | ERREUR : locator.click: Element is not visible |
| 18 ✕ Majo to Kyurasu Pas commencé · weebcentra | `a` | ERREUR : locator.click: Element is not visible |
| 67 ✕ Kurozakuro Pas commencé · mangadex | `a` | ERREUR : locator.click: Element is not visible |
| 13 ✕ Division Chief Kosaku Shima Pas commencé  | `a` | ERREUR : locator.click: Element is not visible |
| 25 ✕ The Blue Eye of Horus Pas commencé · weeb | `a` | ERREUR : locator.click: Element is not visible |
| 10 ✕ Stitches Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 37 ✕ No. 5 Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 20 ✕ Jin Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 72 ✕ Dangu Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 72 ✕ Libidors Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 64 ✕ Drowning Love Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 97 ✕ Radiation House Pas commencé · weebcentra | `a` | ERREUR : locator.click: Element is not visible |
| 15 ✕ Knights of Sidonia Pas commencé · weebcen | `a` | ERREUR : locator.click: Element is not visible |
| 70 ✕ Issak Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 87 ✕ To the Abandoned Sacred Beasts Pas commen | `a` | ERREUR : locator.click: Element is not visible |
| 201 ✕ Manchuria Opium Squad Pas commencé · wee | `a` | ERREUR : locator.click: Element is not visible |
| 48 ✕ Paradise Kiss Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 85 ✕ Drifters Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 142 ✕ Lone Wolf and Cub Pas commencé · weebcen | `a` | ERREUR : locator.click: Element is not visible |
| 157 ✕ Batuque Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 65 ✕ Dai Dark Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 100 ✕ Dead Dead Demon’s Dededede Destruction P | `a` | ERREUR : locator.click: Element is not visible |
| 56 ✕ We Shall Now Begin Ethics Pas commencé ·  | `a` | ERREUR : locator.click: Element is not visible |
| 9 ✕ Mujina in to the Deep Pas commencé · weebc | `a` | ERREUR : locator.click: Element is not visible |
| 124 ✕ Yaiba - Samurai Legend Pas commencé · we | `a` | ERREUR : locator.click: Element is not visible |
| 87 ✕ Kowloon Generic Romance Pas commencé · we | `a` | ERREUR : locator.click: Element is not visible |
| 82 ✕ Gunka no Baltzar Pas commencé · weebcentr | `a` | ERREUR : locator.click: Element is not visible |
| 142 ✕ Sanda Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 40 ✕ Welcome to the N.H.K. Pas commencé · weeb | `a` | ERREUR : locator.click: Element is not visible |
| 115 ✕ Blades of the Guardians Pas commencé · w | `a` | ERREUR : locator.click: Element is not visible |
| 31 ✕ Under Doctor Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 126 ✕ Eden - It's an Endless World! Pas commen | `a` | ERREUR : locator.click: Element is not visible |
| 48 ✕ The Isekai Doctor - Any Sufficiently Adva | `a` | ERREUR : locator.click: Element is not visible |
| 329 ✕ Flame of Recca Pas commencé · weebcentra | `a` | ERREUR : locator.click: Element is not visible |
| 16 ✕ LOVE-BULLET Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| ✕ Angel Densetsu Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 88 ✕ Gleipnir Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 85 ✕ Princess Jellyfish Pas commencé · weebcen | `a` | ERREUR : locator.click: Element is not visible |
| 59 ✕ Snowball Earth Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 338 ✕ H2 Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 15 ✕ Dig It Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 38 ✕ Cosmos Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 25 ✕ Akuyaku Kizoku to shite Hitsuyou na Sore  | `a` | ERREUR : locator.click: Element is not visible |
| 124 ✕ Historie Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 90 ✕ Hirayasumi Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 345 ✕ Kekkaishi Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 109 ✕ Noragami - Stray God Pas commencé · weeb | `a` | ERREUR : locator.click: Element is not visible |
| 79 ✕ Skip and Loafer Pas commencé · weebcentra | `a` | ERREUR : locator.click: Element is not visible |
| 68 ✕ Hero Organization Chap. 66 · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 160 ✕ Nue's Exorcist Pas commencé · weebcentra | `a` | ERREUR : locator.click: Element is not visible |
| 242 ✕ Battle in 5 Seconds After Meeting Pas co | `a` | ERREUR : locator.click: Element is not visible |
| 122 ✕ The Quintessential Quintuplets (Color) P | `a` | ERREUR : locator.click: Element is not visible |
| 90 ✕ Zom 100 - Bucket List of the Dead Pas com | `a` | ERREUR : locator.click: Element is not visible |
| 376 ✕ Days Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 8 ✕ The Journey of a Dark Elf with Fading Powe | `a` | ERREUR : locator.click: Element is not visible |
| 21 ✕ Nana Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 122 ✕ Black Lagoon Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 73 ✕ Smile! Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 233 ✕ Tsubasa - RESERVoir CHRoNiCLE Pas commen | `a` | ERREUR : locator.click: Element is not visible |
| 192 ✕ UQ Holder! Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 86 ✕ The Fable - The Second Contact Pas commen | `a` | ERREUR : locator.click: Element is not visible |
| 226 ✕ Zetman Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 83 ✕ Dark Gathering Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 30 ✕ The Strange House Pas commencé · weebcent | `a` | ERREUR : locator.click: Element is not visible |
| 30 ✕ Tower Dungeon Chap. 29 · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 51 ✕ Ruri Dragon Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 407 ✕ Ranma 1/2 Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 558 ✕ Inuyasha Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 97 ✕ Chainsaw Man (Color) Pas commencé · weebc | `a` | ERREUR : locator.click: Element is not visible |
| 45 ✕ The Bugle Call - Song of War Pas commencé | `a` | ERREUR : locator.click: Element is not visible |
| 263 ✕ World Trigger Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 163 ✕ Jagaaaaaan Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 228 ✕ Black Butler Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 155 ✕ Claymore Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 35 ✕ A Thousand Petals Pas commencé · weebcent | `a` | ERREUR : locator.click: Element is not visible |
| 6 ✕ Dragon Circus Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 124 ✕ Record of Ragnarok Pas commencé · weebce | `a` | ERREUR : locator.click: Element is not visible |
| 7 ✕ AGERECO! Getting Into the Voice Acting Spi | `a` | ERREUR : locator.click: Element is not visible |
| 5 ✕ To Dusk and Twilight Pas commencé · weebce | `a` | ERREUR : locator.click: Element is not visible |
| 95 ✕ Ghost Fixers Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| ✕ Usagi Drop Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 16 ✕ The Chrysalis Heart Pas commencé · weebce | `a` | ERREUR : locator.click: Element is not visible |
| 41 ✕ Haimiya Is Scary Cute Pas commencé · weeb | `a` | ERREUR : locator.click: Element is not visible |
| 250 ✕ Blue Box Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 327 ✕ Vagabond Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 1076 ✕ One Piece (Color) Pas commencé · weebce | `a` | ERREUR : locator.click: Element is not visible |
| 238 ✕ One-Punch Man Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 99 ✕ Witch Hat Atelier Chap. 96 · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 278 ✕ Shangri-La Frontier Pas commencé · weebc | `a` | ERREUR : locator.click: Element is not visible |
| 139 ✕ Kindergarten WARS Pas commencé · weebcen | `a` | ERREUR : locator.click: Element is not visible |
| 192 ✕ Oblivion Battery Pas commencé · weebcent | `a` | ERREUR : locator.click: Element is not visible |
| 39 ✕ WITCHRIV Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 93 ✕ Catenaccio Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 77 ✕ Parashoppers Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 335 ✕ Mao Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 61 ✕ I Was Summoned to Be a Saint, but Was Rob | `a` | ERREUR : locator.click: Element is not visible |
| 9 ✕ It's Not Easy Being Cute Pas commencé · we | `a` | ERREUR : locator.click: Element is not visible |
| 40 ✕ Porter of Heroes Pas commencé · weebcentr | `a` | ERREUR : locator.click: Element is not visible |
| 57 ✕ Gangsta. Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 1 ✕ Un zoo en hiver Pas commencé · sushiscan | `a` | ERREUR : locator.click: Element is not visible |
| 6 ✕ Say Hello to Black Jack Pas commencé · sus | `a` | ERREUR : locator.click: Element is not visible |
| 3 ✕ Sanda Pas commencé · sushiscan | `a` | ERREUR : locator.click: Element is not visible |
| 17 ✕ Sounds of Life Pas commencé · sushiscan | `a` | ERREUR : locator.click: Element is not visible |
| 25 ✕ Nura – Le seigneur des Yôkai Pas commencé | `a` | ERREUR : locator.click: Element is not visible |
| 23 ✕ Bug Ego Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 308 ✕ Ace of the Diamond: Act II Pas commencé  | `a` | ERREUR : locator.click: Element is not visible |
| 365 ✕ TSUYOSHI Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 221 ✕ Go! Go! Loser Ranger! Pas commencé · wee | `a` | ERREUR : locator.click: Element is not visible |
| 120 ✕ Fool Night Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 13 ✕ Gambling Apocalypes Kaiji Pas commencé ·  | `a` | ERREUR : locator.click: Element is not visible |
| 255 ✕ Tobaku Datenroku Kaiji - One Poker Hen P | `a` | ERREUR : locator.click: Element is not visible |
| 461 ✕ Tobaku Datenroku Kaiji - 24oku Dasshutsu | `a` | ERREUR : locator.click: Element is not visible |
| 97 ✕ Tobaku Datenroku Kaiji - Kazuya Hen Pas c | `a` | ERREUR : locator.click: Element is not visible |
| 134 ✕ Tobaku Hakairoku Kaiji Pas commencé · we | `a` | ERREUR : locator.click: Element is not visible |
| 306 ✕ Akagi Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 310 ✕ Nobunaga no Chef Pas commencé · weebcent | `a` | ERREUR : locator.click: Element is not visible |
| 273 ✕ Hyouge Mono Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 883 ✕ Kingdom Pas commencé · sushiscan | `a` | ERREUR : locator.click: Element is not visible |
| ✕ Dimension W Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 95 ✕ JoJo no Kimyou na Bouken: Part 7 - Steel  | `a` | ERREUR : locator.click: Element is not visible |
| 164 ✕ Ten - The Nice Guy on the Path of Tenho  | `a` | ERREUR : locator.click: Element is not visible |
| 90 ✕ Golden Man Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 4 ✕ Neon Genesis Evangelion (Official Colored) | `a` | ERREUR : locator.click: Element is not visible |
| 68 ✕ The Case Study of Vanitas Pas commencé ·  | `a` | ERREUR : locator.click: Element is not visible |
| 109 ✕ A Bride's Story Pas commencé · weebcentr | `a` | ERREUR : locator.click: Element is not visible |
| ✕ Zatch Bell! Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 120 ✕ Drifting Dragons Pas commencé · weebcent | `a` | ERREUR : locator.click: Element is not visible |
| 74 ✕ Made in Abyss Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| ROMAN 29 ✕ Jobless Reincarnation - Mushoku Ten | `a` | ERREUR : locator.click: Element is not visible |
| 1 ✕ Les Enfants de l’Empire Pas commencé · sus | `a` | ERREUR : locator.click: Element is not visible |
| 1 ✕ Japanese Zero Fighter Pas commencé · sushi | `a` | ERREUR : locator.click: Element is not visible |
| 6 ✕ Seven Shakespeares Pas commencé · sushisca | `a` | ERREUR : locator.click: Element is not visible |
| 2 ✕ Le Siège des exilées Pas commencé · sushis | `a` | ERREUR : locator.click: Element is not visible |
| 3 ✕ Redrum 327 Pas commencé · sushiscan | `a` | ERREUR : locator.click: Element is not visible |
| 233 ✕ Zipang Chap. 229 · mangadex | `a` | ERREUR : locator.click: Element is not visible |
| 4 ✕ Hitomoji – Stress Mortel Pas commencé · su | `a` | ERREUR : locator.click: Element is not visible |
| 6 ✕ Phénix, l’oiseau de feu Pas commencé · sus | `a` | ERREUR : locator.click: Element is not visible |
| 19 ✕ Le Pavillon des hommes Pas commencé · sus | `a` | ERREUR : locator.click: Element is not visible |
| 7 ✕ Dans le sens du vent – Nord, Nord-Ouest Pa | `a` | ERREUR : locator.click: Element is not visible |
| 10 ✕ Saturn Return Pas commencé · sushiscan | `a` | ERREUR : locator.click: Element is not visible |
| 1 ✕ Rash !! – Perfect édition Pas commencé · s | `a` | ERREUR : locator.click: Element is not visible |
| 17 ✕ March comes in like a lion Pas commencé · | `a` | ERREUR : locator.click: Element is not visible |
| 11 ✕ Land Pas commencé · sushiscan | `a` | ERREUR : locator.click: Element is not visible |
| 13 ✕ Yawara! Pas commencé · sushiscan | `a` | ERREUR : locator.click: Element is not visible |
| 10 ✕ Hellsing Pas commencé · sushiscan | `a` | ERREUR : locator.click: Element is not visible |
| 35 ✕ Nippon Sangoku Pas commencé · mangadex | `a` | ERREUR : locator.click: Element is not visible |
| 169 ✕ Blue Exorcist Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 259 ✕ Mission: Yozakura Family Pas commencé ·  | `a` | ERREUR : locator.click: Element is not visible |
| 153 ✕ Blood on the Tracks Pas commencé · weebc | `a` | ERREUR : locator.click: Element is not visible |
| 77 ✕ Veil Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 38 ✕ Gokurakugai Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 86 ✕ The Apothecary Diaries Pas commencé · wee | `a` | ERREUR : locator.click: Element is not visible |
| 52 ✕ Rai Rai Rai Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 201 ✕ The Fragrant Flower Blooms With Dignity  | `a` | ERREUR : locator.click: Element is not visible |
| 53 ✕ Saigo ni Hitotsu Dake Onegai Shite mo Yor | `a` | ERREUR : locator.click: Element is not visible |
| 92 ✕ Flying Witch Pas commencé · mangadex | `a` | ERREUR : locator.click: Element is not visible |
| 28 ✕ JoJo no Kimyou na Bouken Dai-9-bu: The JO | `a` | ERREUR : locator.click: Element is not visible |
| 686 ✕ Bleach (Official Colored) Pas commencé · | `a` | ERREUR : locator.click: Element is not visible |
| 110 ✕ JoJo no Kimyou na Bouken: Part 8 - JoJol | `a` | ERREUR : locator.click: Element is not visible |
| 583 ✕ History's Strongest Disciple Kenichi Pas | `a` | ERREUR : locator.click: Element is not visible |
| 1515 ✕ Hajime no Ippo Pas commencé · weebcentr | `a` | ERREUR : locator.click: Element is not visible |
| 89 ✕ KAIJIN FUGEKI: Kindled Spirits Pas commen | `a` | ERREUR : locator.click: Element is not visible |
| 8 ✕ Takemitsu Zamurai Pas commencé · weebcentr | `a` | ERREUR : locator.click: Element is not visible |
| 114 ✕ Yawara! Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 45 ✕ The World's Strongest Butler Pas commencé | `a` | ERREUR : locator.click: Element is not visible |
| 91 ✕ Yongbi the Invincible - A Side Story Pas  | `a` | ERREUR : locator.click: Element is not visible |
| 103 ✕ Crying Freeman Pas commencé · weebcentra | `a` | ERREUR : locator.click: Element is not visible |
| 84 ✕ Shigurui Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 266 ✕ Sidooh Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| ✕ Yowamushi Pedal Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 720 ✕ Initial D Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 113 ✕ Captain Tsubasa Pas commencé · weebcentr | `a` | ERREUR : locator.click: Element is not visible |
| 72 ✕ Welcome to the Ballroom Pas commencé · we | `a` | ERREUR : locator.click: Element is not visible |
| ✕ Rookies Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 248 ✕ Chihayafuru Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 39 ✕ Yakuza Fiancé - Raise wa Tanin ga Ii Pas  | `a` | ERREUR : locator.click: Element is not visible |
| 201 ✕ Liar Game Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 131 ✕ Tobaku Datenroku Kaiji Pas commencé · we | `a` | ERREUR : locator.click: Element is not visible |
| 154 ✕ Back When You Called Us Devils Pas comme | `a` | ERREUR : locator.click: Element is not visible |
| 82 ✕ Freesia Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 89 ✕ Blue Period Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 119 ✕ Battle Royale Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 60 ✕ Firefly Wedding Pas commencé · weebcentra | `a` | ERREUR : locator.click: Element is not visible |
| 84 ✕ After God Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 63 ✕ War of the Adults Pas commencé · weebcent | `a` | ERREUR : locator.click: Element is not visible |
| 104 ✕ Pandora Hearts Pas commencé · weebcentra | `a` | ERREUR : locator.click: Element is not visible |
| 42 ✕ The Drifting Classroom Perfect Edition Pa | `a` | ERREUR : locator.click: Element is not visible |
| 22 ✕ Umineko When They Cry -Episode 1- Legend  | `a` | ERREUR : locator.click: Element is not visible |
| ✕ Psyren Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 93 ✕ Moriarty the Patriot Pas commencé · weebc | `a` | ERREUR : locator.click: Element is not visible |
| 51 ✕ Seraph of the End - Guren Ichinose - Cata | `a` | ERREUR : locator.click: Element is not visible |
| 74 ✕ The Shadows of Who We Once Were Pas comme | `a` | ERREUR : locator.click: Element is not visible |
| 97 ✕ Angel Voice (KOYANO Takao) Pas commencé · | `a` | ERREUR : locator.click: Element is not visible |
| 205 ✕ King Golf Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 245 ✕ Ahiru no Sora Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 160 ✕ Cross Game Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 190 ✕ Hikaru no Go Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 3 ✕ Ultra Heaven Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 11 ✕ Bokurano Ours Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 63 ✕ #DRCL midnight children Pas commencé · we | `a` | ERREUR : locator.click: Element is not visible |
| 85 ✕ Heavenly Delusion Pas commencé · weebcent | `a` | ERREUR : locator.click: Element is not visible |
| 39 ✕ JoJo's Bizarre Adventure - Part 9 - The J | `a` | ERREUR : locator.click: Element is not visible |
| 330 ✕ Higanjima Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 153 ✕ Ultraman Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 20 ✕ Haunted Peak Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 129 ✕ Bungo Stray Dogs Pas commencé · weebcent | `a` | ERREUR : locator.click: Element is not visible |
| 83 ✕ Steel of the Celestial Shadows Pas commen | `a` | ERREUR : locator.click: Element is not visible |
| 21 ✕ Dandadan Pas commencé · sushiscan | `a` | ERREUR : locator.click: Element is not visible |
| 75 ✕ Dogsred Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 222 ✕ March Comes in Like a Lion Pas commencé  | `a` | ERREUR : locator.click: Element is not visible |
| 567 ✕ Giant Killing Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 329 ✕ F Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 102 ✕ Beck - Mongolian Chop Squad Pas commencé | `a` | ERREUR : locator.click: Element is not visible |
| 21 ✕ A Witch's Life in Mongol Pas commencé · w | `a` | ERREUR : locator.click: Element is not visible |
| 6 ✕ Akira Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 136 ✕ Tenjo Tenge Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 43 ✕ Himizu Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 254 ✕ Happy! Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 97 ✕ Akira Failing in Love Chap. 92 · weebcent | `a` | ERREUR : locator.click: Element is not visible |
| 1166 ✕ Case Closed Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 452 ✕ Sleepy Princess in the Demon Castle Pas  | `a` | ERREUR : locator.click: Element is not visible |
| 121 ✕ Mushoku Tensei - Jobless Reincarnation P | `a` | ERREUR : locator.click: Element is not visible |
| 24 ✕ JoJo’s Bizarre Adventure : Steel Ball Run | `a` | ERREUR : locator.click: Element is not visible |
| 24 ✕ Dragon no I de Oyasumi Pas commencé · wee | `a` | ERREUR : locator.click: Element is not visible |
| 369 ✕ Kengan Omega Chap. 363 · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 237 ✕ Kengan Ashura Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 48 ✕ Initial D Pas commencé · sushiscan | `a` | ERREUR : locator.click: Element is not visible |
| 13 ✕ Black Lagoon Pas commencé · sushiscan | `a` | ERREUR : locator.click: Element is not visible |
| 39 ✕ Get Backers Pas commencé · sushiscan | `a` | ERREUR : locator.click: Element is not visible |
| 4 ✕ Gokurakugai Pas commencé · sushiscan | `a` | ERREUR : locator.click: Element is not visible |
| 49 ✕ Dream Team Pas commencé · sushiscan | `a` | ERREUR : locator.click: Element is not visible |
| 25 ✕ Chiruran Pas commencé · sushiscan | `a` | ERREUR : locator.click: Element is not visible |
| 25 ✕ Sidooh Pas commencé · sushiscan | `a` | ERREUR : locator.click: Element is not visible |
| 17 ✕ Ascension Pas commencé · sushiscan | `a` | ERREUR : locator.click: Element is not visible |
| 27 ✕ JoJo’s Bizarre Adventure : JoJolion Pas c | `a` | ERREUR : locator.click: Element is not visible |
| 9 ✕ Bride Stories Pas commencé · sushiscan | `a` | ERREUR : locator.click: Element is not visible |
| 24 ✕ Pandora Hearts Pas commencé · sushiscan | `a` | ERREUR : locator.click: Element is not visible |
| 24 ✕ World Trigger Pas commencé · sushiscan | `a` | ERREUR : locator.click: Element is not visible |
| 10 ✕ Ichi The Killer Pas commencé · sushiscan | `a` | ERREUR : locator.click: Element is not visible |
| 5 ✕ Les Noces des Lucioles Pas commencé · sush | `a` | ERREUR : locator.click: Element is not visible |
| 19 ✕ Radiant Pas commencé · sushiscan | `a` | ERREUR : locator.click: Element is not visible |
| 8 ✕ Wistoria: Wand and Sword Pas commencé · su | `a` | ERREUR : locator.click: Element is not visible |
| 26 ✕ Mission: Yozakura Family Pas commencé · s | `a` | ERREUR : locator.click: Element is not visible |
| 105 ✕ Détective Conan Pas commencé · sushiscan | `a` | ERREUR : locator.click: Element is not visible |
| 45 ✕ Yona, princesse de l’aube Pas commencé ·  | `a` | ERREUR : locator.click: Element is not visible |
| 63 ✕ Fairy Tail Pas commencé · sushiscan | `a` | ERREUR : locator.click: Element is not visible |
| 69 ✕ Ichi the Witch Pas commencé · sushiscan | `a` | ERREUR : locator.click: Element is not visible |
| ROMAN 1181 ✕ Lord of Mysteries 2: Circle of In | `a` | ERREUR : locator.click: Element is not visible |
| ROMAN 1432 ✕ Lord of the Mysteries Pas commenc | `a` | ERREUR : locator.click: Element is not visible |
| 201 ✕ To Your Eternity Pas commencé · weebcent | `a` | ERREUR : locator.click: Element is not visible |
| 2 ✕ Centuria Pas commencé · sushiscan | `a` | ERREUR : locator.click: Element is not visible |
| 72 ✕ Ginga Eiyuu Densetsu (FUJISAKI Ryuu) Pas  | `a` | ERREUR : locator.click: Element is not visible |
| 425 ✕ Karakuri Circus Pas commencé · weebcentr | `a` | ERREUR : locator.click: Element is not visible |
| 20 ✕ Bakuman. Pas commencé · sushiscan | `a` | ERREUR : locator.click: Element is not visible |
| 37 ✕ Eyeshield 21 Pas commencé · sushiscan | `a` | ERREUR : locator.click: Element is not visible |
| 154 ✕ The Heroic Legend of Arslan Chap. 153 ·  | `a` | ERREUR : locator.click: Element is not visible |
| 153 ✕ Les Liens du sang [Version Scantrad] Pas | `a` | ERREUR : locator.click: Element is not visible |
| 166 ✕ Oshi no Ko Pas commencé · sushiscan | `a` | ERREUR : locator.click: Element is not visible |
| 22 ✕ The Fable Pas commencé · sushiscan | `a` | ERREUR : locator.click: Element is not visible |
| 18 ✕ Four Knights of the Apocalypse Pas commen | `a` | ERREUR : locator.click: Element is not visible |
| 30 ✕ Boruto: Two Blue Vortex Pas commencé · su | `a` | ERREUR : locator.click: Element is not visible |
| 15 ✕ Les Carnets de l’Apothicaire Pas commencé | `a` | ERREUR : locator.click: Element is not visible |
| 275 ✕ Slam Dunk Pas commencé · sushiscan | `a` | ERREUR : locator.click: Element is not visible |
| 125 ✕ Kagurabachi Pas commencé · sushiscan | `a` | ERREUR : locator.click: Element is not visible |
| 268 ✕ Sakamoto Days Pas commencé · sushiscan | `a` | ERREUR : locator.click: Element is not visible |
| 165 ✕ Gachiakuta Pas commencé · sushiscan | `a` | ERREUR : locator.click: Element is not visible |
| ROMAN 230 ✕ Le Système Technologique d’un Etud | `a` | ERREUR : locator.click: Element is not visible |
| ROMAN 740 ✕ Laissez-moi Jouer en Paix｜Let me g | `a` | ERREUR : locator.click: Element is not visible |
| ROMAN 916 ✕ Le Quotidien d'un Prodige Immortel | `a` | ERREUR : locator.click: Element is not visible |
| ROMAN 780 ✕ Crazy Detective｜狂探 Pas commencé ·  | `a` | ERREUR : locator.click: Element is not visible |
| ROMAN 50 ✕ Le Faucheur de la lune \| Reaper of  | `a` | ERREUR : locator.click: Element is not visible |
| ROMAN 10 ✕ Infinite Bloodcore \| 无限血核 Pas comme | `a` | ERREUR : locator.click: Element is not visible |
| ROMAN 3180 ✕ Shadow Slave Pas commencé · novel | `a` | ERREUR : locator.click: Element is not visible |
| ROMAN 102 ✕ Voyageurs du lointain \| 天涯客 Pas co | `a` | ERREUR : locator.click: Element is not visible |
| ROMAN 272 ✕ L’Avènement des trois calamités \|  | `a` | ERREUR : locator.click: Element is not visible |
| 8 ✕ Dai Dark Pas commencé · sushiscan | `a` | ERREUR : locator.click: Element is not visible |
| 14 ✕ L’Atelier des Sorciers Pas commencé · sus | `a` | ERREUR : locator.click: Element is not visible |
| 241 ✕ Dandadan [Scantrad] Pas commencé · sushi | `a` | ERREUR : locator.click: Element is not visible |
| 16 ✕ Blue Period Pas commencé · sushiscan | `a` | ERREUR : locator.click: Element is not visible |
| 8 ✕ The Bugle Call Pas commencé · sushiscan | `a` | ERREUR : locator.click: Element is not visible |
| 147 ✕ MPD-Psycho Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 10 ✕ Le Bateau de Thésée Pas commencé · sushis | `a` | ERREUR : locator.click: Element is not visible |
| 68 ✕ Drama Queen Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 62 ✕ Dragon and Chameleon Pas commencé · weebc | `a` | ERREUR : locator.click: Element is not visible |
| 214 ✕ Dance Dance Danseur Pas commencé · weebc | `a` | ERREUR : locator.click: Element is not visible |
| 258 ✕ Full Ahead Coco Pas commencé · weebcentr | `a` | ERREUR : locator.click: Element is not visible |
| 96 ✕ Shinobi Undercover Chap. 92 · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 56 ✕ The Nito Exorcists Pas commencé · weebcen | `a` | ERREUR : locator.click: Element is not visible |
| 400 ✕ Hunter x Hunter (Color) Pas commencé · w | `a` | ERREUR : locator.click: Element is not visible |
| 30 ✕ L’habitant de l’infini Pas commencé · sus | `a` | ERREUR : locator.click: Element is not visible |
| 626 ✕ The Ravages of Time Chap. 1 · weebcentra | `a` | ERREUR : locator.click: Element is not visible |
| En cours 17 ✕ Ascension [Version officielle] P | `a` | ERREUR : locator.click: Element is not visible |
| En cours 40 ✕ Angel Voice Pas commencé · sushi | `a` | ERREUR : locator.click: Element is not visible |
| Terminé 9 ✕ Akane-Banashi Pas commencé · sushi | `a` | ERREUR : locator.click: Element is not visible |
| En pause 11 ✕ Les Mémoires de Vanitas Pas comm | `a` | ERREUR : locator.click: Element is not visible |
| À lire 256 ✕ D.Gray-man Pas commencé · sushisc | `a` | ERREUR : locator.click: Element is not visible |
| 357 ✕ Air Gear Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 258 ✕ D.Gray-Man Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 122 ✕ Sousei no Taiga Pas commencé · weebcentr | `a` | ERREUR : locator.click: Element is not visible |
| 133 ✕ How Do We Relationship Pas commencé · we | `a` | ERREUR : locator.click: Element is not visible |
| 432 ✕ Uchuu Kyoudai Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 145 ✕ GOSU Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 108 ✕ Land of the Lustrous Pas commencé · weeb | `a` | ERREUR : locator.click: Element is not visible |
| 314 ✕ Golden Kamuy Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 36 ✕ Boruto: Two Blue Vortex Chap. 36 · weebce | `a` | ERREUR : locator.click: Element is not visible |
| 240 ✕ The Fable Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 124 ✕ Make the Exorcist Fall in Love Pas comme | `a` | ERREUR : locator.click: Element is not visible |
| 25 ✕ Jujutsu Kaisen Modulo Pas commencé · weeb | `a` | ERREUR : locator.click: Element is not visible |
| 276 ✕ Yona of the Dawn Pas commencé · weebcent | `a` | ERREUR : locator.click: Element is not visible |
| 221 ✕ Akane-banashi Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 47 ✕ The Summer Hikaru Died Pas commencé · wee | `a` | ERREUR : locator.click: Element is not visible |
| 539 ✕ Usogui Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 170 ✕ The Climber Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 252 ✕ The Seven Deadly Sins - Four Knights of  | `a` | ERREUR : locator.click: Element is not visible |
| 101 ✕ Centuria Chap. 98 · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 179 ✕ Tokyo Ghoul:re Pas commencé · weebcentra | `a` | ERREUR : locator.click: Element is not visible |
| 383 ✕ Gantz Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 178 ✕ Marriage Toxin Pas commencé · weebcentra | `a` | ERREUR : locator.click: Element is not visible |
| 97 ✕ Ichi the Witch Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 245 ✕ Dandadan Chap. 241 · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 420 ✕ Hunter x Hunter Pas commencé · weebcentr | `a` | ERREUR : locator.click: Element is not visible |
| 274 ✕ Sakamoto Days Chap. 269 · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 686 ✕ Bleach (Color) Pas commencé · weebcentra | `a` | ERREUR : locator.click: Element is not visible |
| 131 ✕ Kagurabachi Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 68 ✕ Wistoria - Wand and Sword Pas commencé ·  | `a` | ERREUR : locator.click: Element is not visible |
| 421 ✕ Rokudenashi Blues Pas commencé · weebcen | `a` | ERREUR : locator.click: Element is not visible |
| 1191 ✕ One Piece Chap. 1192 · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 173 ✕ Gachiakuta Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 76 ✕ Choujin X Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 10 ✕ Kujô l’implacable Pas commencé · sushisca | `a` | ERREUR : locator.click: Element is not visible |
| 57 ✕ Dragon Head Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 159 ✕ Seraph of the End - Vampire Reign Pas co | `a` | ERREUR : locator.click: Element is not visible |
| 220 ✕ Vinland Saga Pas commencé · sushiscan | `a` | ERREUR : locator.click: Element is not visible |
| 9 ✕ Monster – Edition Deluxe Pas commencé · su | `a` | ERREUR : locator.click: Element is not visible |
| 182 ✕ Magi - Sinbad no Bouken Pas commencé · w | `a` | ERREUR : locator.click: Element is not visible |
| 56 ✕ Daemons of the Shadow Realm Pas commencé  | `a` | ERREUR : locator.click: Element is not visible |
| 14 ✕ Gloutons & Dragons Pas commencé · sushisc | `a` | ERREUR : locator.click: Element is not visible |
| 8 ✕ Magus of the Library Pas commencé · sushis | `a` | ERREUR : locator.click: Element is not visible |
| 37 ✕ Magi – The Labyrinth of Magic Chap. 1 · s | `a` | ERREUR : locator.click: Element is not visible |
| 168 ✕ Dorohedoro Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 163 ✕ The World Is Mine Pas commencé · weebcen | `a` | ERREUR : locator.click: Element is not visible |
| 240 ✕ Shadows House Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 111 ✕ Kiichi VS Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 3 ✕ Billy the Kid 21 Pas commencé · sushiscan | `a` | ERREUR : locator.click: Element is not visible |
| 97 ✕ Neon Genesis Evangelion Pas commencé · we | `a` | ERREUR : locator.click: Element is not visible |
| 15 ✕ MARS Pas commencé · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
| 10 ✕ Banana Fish Chap. 10 · sushiscan | `a` | ERREUR : locator.click: Element is not visible |
| 46 ✕ Ushijima, l’usurier de l’ombre Pas commen | `a` | ERREUR : locator.click: Element is not visible |
| 10 ✕ Ikigami Pas commencé · sushiscan | `a` | ERREUR : locator.click: Element is not visible |
| 10 ✕ Fool Night Pas commencé · sushiscan | `a` | ERREUR : locator.click: Element is not visible |
| 13 ✕ Call of the Night Pas commencé · sushisca | `a` | ERREUR : locator.click: Element is not visible |
| 27 ✕ Claymore Pas commencé · sushiscan | `a` | ERREUR : locator.click: Element is not visible |
| 22 ✕ Terra Formars Pas commencé · sushiscan | `a` | ERREUR : locator.click: Element is not visible |
| ROMAN 116 ✕ Le conte du cultivateur regressé C | `a` | ERREUR : locator.click: Element is not visible |
| 356 ✕ Blue Lock Chap. 356 · weebcentral | `a` | ERREUR : locator.click: Element is not visible |
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
| EN | `button` | AGIT (focus déplacé) |
| Accueil | `a` | NAVIGUE → accueil.html |
| Bibliothèque — 227 séries avec des chapitres n | `a` | MÊME PAGE |
| Recherche | `a` | NAVIGUE → recherche.html |
| Profil | `a` | NAVIGUE → profil.html |
| Plus de sections | `button#mnavMore` | AGIT (page modifiée) |


## `serie.html`

URL auditée : `/serie.html?id=01J76XY7E9FNDZ1DBBM6PBJPFK&source=weebcentral`

> État : **connecté**
> Les verdicts qui suivent se lisent dans CET état.

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | MÊME PAGE |
| Inko | `a` | AGIT (focus déplacé) |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (page modifiée) |
| Reprendre ma dernière lecture | `button#btnContinue` | NAVIGUE → chapitre.html?manga=46e530ce-0766-4cbd-b005-5e6fb0ba5e71&chapter=fa3ddc54-3799-4301-bec0-c8c8c35d0677&source=mangadex |
| Actualiser mes séries (nouveaux chapitres) | `button#btnRefresh` | DISPARU |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | AGIT (page modifiée) |
| Notifications — aucune non lue | `button#btnNotif` | AGIT (page modifiée) |
| Paramètres | `a` | NAVIGUE → parametres.html |
| Kaito | `a` | NAVIGUE → profil.html |
| Action | `a` | DISPARU |
| Adventure | `a` | DISPARU |
| Comedy | `a` | DISPARU |
| Drama | `a` | DISPARU |
| Reprendre Ch.1192 Reprendre où tu t'es arrêté· | `button#btnResume` | DISPARU |
| Repartir du chapitre 1 | `button#btnReadStart` | DISPARU |
| Ouvrir le premier chapitre non lu | `button#btnNextUnread` | DISPARU |
| Dans ma liste | `button#btnFavorite` | DISPARU |
| Mettre en tête de « À lire ensuite » | `button#btnFile` | DISPARU |
| Statut de lecture | `select#serieStatus` | DISPARU |
| + Catégorie | `button#btnCategory` | DISPARU |
| Suivre cette série depuis une autre source, en | `button` | DISPARU |
| Lire cette série sans laisser de trace | `button#btnPrive` | DISPARU |
| Mettre en avant sur ton profil public | `button#btnPin` | DISPARU |
| Ne plus être averti des nouveaux chapitres | `button#btnNotify` | DISPARU |
| + Liste | `button#btnAddList` | DISPARU |
| Suivi AniList — pousse ta progression, ton sta | `button#btnAniList` | DISPARU |
| Partager | `button#btnShare` | DISPARU |
| Lancer la station « Pluie » — Ambiance nature | `button#btnAmbiance` | DISPARU |
| Aperçu | `button` | DISPARU |
| Chapitres (1192) | `button` | DISPARU |
| Voir tous → | `button` | DISPARU |
| Chap. 1192 Chapitre 1192 EN | `a` | DISPARU |
| Ajouter un signet | `button` | DISPARU |
| Non lu — clic pour marquer lu | `button` | DISPARU |
| Chap. 1191 Chapitre 1191 EN | `a` | DISPARU |
| Chap. 1190 Chapitre 1190 EN | `a` | DISPARU |
| Chap. 1189 Chapitre 1189 EN | `a` | DISPARU |
| Chap. 1188 Chapitre 1188 EN | `a` | DISPARU |
| Du même auteur · ODA Eiichiro | `a` | DISPARU |
| Fantasy | `a` | DISPARU |
| Shounen | `a` | DISPARU |
| Catalogue | `a` | AGIT (page modifiée) |
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
| Bibliothèque — 227 séries avec des chapitres n | `a` | NAVIGUE → bibliotheque.html |
| Recherche | `a` | NAVIGUE → recherche.html |
| Profil | `a` | NAVIGUE → profil.html |
| Plus de sections | `button#mnavMore` | AGIT (page modifiée) |
| Fermer l'astuce | `button` | DISPARU |


## `chapitre.html`

URL auditée : `/chapitre.html?manga=01J76XY7E9FNDZ1DBBM6PBJPFK&chapter=01M1PDC3T1X0C0X02YV7TNC0Q3&source=weebcentral`

> État : **connecté**
> Les verdicts qui suivent se lisent dans CET état.

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | MÊME PAGE |
| Inko | `a` | AGIT (page modifiée) |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (page modifiée) |
| Reprendre ma dernière lecture | `button#btnContinue` | NAVIGUE → chapitre.html?manga=46e530ce-0766-4cbd-b005-5e6fb0ba5e71&chapter=fa3ddc54-3799-4301-bec0-c8c8c35d0677&source=mangadex |
| Actualiser mes séries (nouveaux chapitres) — d | `button#btnRefresh` | DISPARU |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | AGIT (page modifiée) |
| Notifications — aucune non lue | `button#btnNotif` | AGIT (page modifiée) |
| Paramètres | `a` | NAVIGUE → parametres.html |
| Kaito | `a` | NAVIGUE → profil.html |
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


## `lecture.html`

URL auditée : `/lecture.html?manga=01J76XY7E9FNDZ1DBBM6PBJPFK&chapter=01M1PDC3T1X0C0X02YV7TNC0Q3&source=weebcentral`

> État : **connecté**
> Les verdicts qui suivent se lisent dans CET état.

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | MÊME PAGE |
| Inko | `a` | AGIT (focus déplacé) |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (page modifiée) |
| Reprendre ma dernière lecture | `button#btnContinue` | NAVIGUE → chapitre.html?manga=01J76XY7E9FNDZ1DBBM6PBJPFK&chapter=01M1PDC3T1X0C0X02YV7TNC0Q3&source=weebcentral |
| Actualiser mes séries (nouveaux chapitres) | `button#btnRefresh` | DISPARU |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | AGIT (page modifiée) |
| Notifications — aucune non lue | `button#btnNotif` | AGIT (page modifiée) |
| Paramètres | `a` | NAVIGUE → parametres.html |
| Kaito | `a` | NAVIGUE → profil.html |
| Réessayer | `button` | DISPARU |
| ↩ Retour | `button` | NAVIGUE → profil.html |
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

> État : **connecté**
> Les verdicts qui suivent se lisent dans CET état.

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | MÊME PAGE |
| Inko | `a` | AGIT (focus déplacé) |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (page modifiée) |
| Reprendre ma dernière lecture | `button#btnContinue` | NAVIGUE → chapitre.html?manga=01J76XY7E9FNDZ1DBBM6PBJPFK&chapter=01M1PDC3T1X0C0X02YV7TNC0Q3&source=weebcentral |
| Actualiser mes séries (nouveaux chapitres) | `button#btnRefresh` | AGIT (page modifiée) |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | AGIT (page modifiée) |
| Notifications — aucune non lue | `button#btnNotif` | AGIT (page modifiée) |
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
| Bibliothèque — 227 séries avec des chapitres n | `a` | NAVIGUE → bibliotheque.html |
| Recherche | `a` | NAVIGUE → recherche.html |
| Profil | `a` | NAVIGUE → profil.html |
| Plus de sections | `button#mnavMore` | AGIT (page modifiée) |


## `collection-detail.html`

URL auditée : `/collection-detail.html`

> État : **connecté**
> Les verdicts qui suivent se lisent dans CET état.

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | MÊME PAGE |
| Inko | `a` | AGIT (focus déplacé) |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (page modifiée) |
| Reprendre ma dernière lecture | `button#btnContinue` | NAVIGUE → chapitre.html?manga=01J76XY7E9FNDZ1DBBM6PBJPFK&chapter=01M1PDC3T1X0C0X02YV7TNC0Q3&source=weebcentral |
| Actualiser mes séries (nouveaux chapitres) | `button#btnRefresh` | AGIT (page modifiée) |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | AGIT (page modifiée) |
| Notifications — aucune non lue | `button#btnNotif` | AGIT (page modifiée) |
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
| Désactiver | `button` | DISPARU |
| Accueil | `a` | NAVIGUE → accueil.html |
| Bibliothèque — 227 séries avec des chapitres n | `a` | NAVIGUE → bibliotheque.html |
| Recherche | `a` | NAVIGUE → recherche.html |
| Profil | `a` | NAVIGUE → profil.html |
| Plus de sections | `button#mnavMore` | AGIT (page modifiée) |


## `notes.html`

URL auditée : `/notes.html`

> État : **connecté**
> Les verdicts qui suivent se lisent dans CET état.

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | MÊME PAGE |
| Inko | `a` | AGIT (focus déplacé) |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (page modifiée) |
| Reprendre ma dernière lecture | `button#btnContinue` | NAVIGUE → chapitre.html?manga=01J76XY7E9FNDZ1DBBM6PBJPFK&chapter=01M1PDC3T1X0C0X02YV7TNC0Q3&source=weebcentral |
| Actualiser mes séries (nouveaux chapitres) | `button#btnRefresh` | AGIT (page modifiée) |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | AGIT (page modifiée) |
| Notifications — aucune non lue | `button#btnNotif` | AGIT (page modifiée) |
| Paramètres | `a` | NAVIGUE → parametres.html |
| Kaito | `a` | NAVIGUE → profil.html |
| Lire chaque série du début à la fin | `button#jrRecit` | AGIT (page modifiée) |
| Exporter en Markdown (Obsidian, Logseq…) | `button#jrExportMd` | AGIT (page modifiée) |
| Filtrer par série | `select#jrFiltreSerie` | AGIT (focus déplacé) |
| Tout afficher | `button#jrFiltresRaz` | AGIT (focus déplacé) |
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
| Bibliothèque — 227 séries avec des chapitres n | `a` | NAVIGUE → bibliotheque.html |
| Recherche | `a` | NAVIGUE → recherche.html |
| Profil | `a` | NAVIGUE → profil.html |
| Plus de sections | `button#mnavMore` | AGIT (page modifiée) |


## `notifications.html`

URL auditée : `/notifications.html`

> État : **connecté**
> Les verdicts qui suivent se lisent dans CET état.

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | MÊME PAGE |
| Inko | `a` | AGIT (focus déplacé) |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (page modifiée) |
| Reprendre ma dernière lecture | `button#btnContinue` | NAVIGUE → chapitre.html?manga=01J76XY7E9FNDZ1DBBM6PBJPFK&chapter=01M1PDC3T1X0C0X02YV7TNC0Q3&source=weebcentral |
| Actualiser mes séries (nouveaux chapitres) | `button#btnRefresh` | AGIT (page modifiée) |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | AGIT (page modifiée) |
| Notifications — aucune non lue | `button#btnNotif` | AGIT (page modifiée) |
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
| 334 nouveaux chapitres Mao · 334 chapitres à l | `a` | DISPARU |
| 122 nouveaux chapitres My Isekai Life - I Gain | `a` | DISPARU |
| 75 nouveaux chapitres Dogsred · 75 chapitres à | `a` | DISPARU |
| 8 nouveaux chapitres Imouto wa Kanojo ni Deki  | `a` | DISPARU |
| 202 nouveaux chapitres The Fragrant Flower Blo | `a` | DISPARU |
| 147 nouveaux chapitres Kindergarten WARS · 147 | `a` | DISPARU |
| 133 nouveaux chapitres Kagurabachi · 133 chapi | `a` | DISPARU |
| 40 nouveaux chapitres Gokurakugai · 40 chapitr | `a` | DISPARU |
| 39 nouveaux chapitres JoJo's Bizarre Adventure | `a` | DISPARU |
| 81 nouveaux chapitres Rai Rai Rai · 81 chapitr | `a` | DISPARU |
| 21 nouveaux chapitres A Witch's Life in Mongol | `a` | DISPARU |
| 419 nouveaux chapitres Hunter x Hunter · 419 c | `a` | DISPARU |
| 273 nouveaux chapitres Sakamoto Days · 273 cha | `a` | DISPARU |
| 238 nouveaux chapitres Shadows House · 238 cha | `a` | DISPARU |
| 63 nouveaux chapitres War of the Adults · 63 c | `a` | DISPARU |
| 61 nouveaux chapitres I Was Summoned to Be a S | `a` | DISPARU |
| 277 nouveaux chapitres Shangri-La Frontier · 2 | `a` | DISPARU |
| 95 nouveaux chapitres Ghost Fixers · 95 chapit | `a` | DISPARU |
| 90 nouveaux chapitres Blue Period · 90 chapitr | `a` | DISPARU |
| 65 nouveaux chapitres Dragon and Chameleon · 6 | `a` | DISPARU |
| 40 nouveaux chapitres Porter of Heroes · 40 ch | `a` | DISPARU |
| 95 nouveaux chapitres Ichi the Witch · 95 chap | `a` | DISPARU |
| 94 nouveaux chapitres Shinobi Undercover · 94  | `a` | DISPARU |
| 354 nouveaux chapitres Blue Lock · 354 chapitr | `a` | DISPARU |
| 94 nouveaux chapitres Akira Failing in Love ·  | `a` | DISPARU |
| 87 nouveaux chapitres KAIJIN FUGEKI: Kindled S | `a` | DISPARU |
| 75 nouveaux chapitres Parashoppers · 75 chapit | `a` | DISPARU |
| 23 nouveaux chapitres Bug Ego · 23 chapitres à | `a` | DISPARU |
| 65 nouveaux chapitres Drama Queen · 65 chapitr | `a` | DISPARU |
| 67 nouveaux chapitres Hero Organization · 67 c | `a` | DISPARU |
| 154 nouveaux chapitres The Heroic Legend of Ar | `a` | DISPARU |
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
| Bibliothèque — 227 séries avec des chapitres n | `a` | DISPARU |
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
| Aller au contenu | `a` | MÊME PAGE |
| Inko | `a` | AGIT (focus déplacé) |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (page modifiée) |
| Reprendre ma dernière lecture | `button#btnContinue` | NAVIGUE → chapitre.html?manga=01J76XY7E9FNDZ1DBBM6PBJPFK&chapter=01M1PDC3T1X0C0X02YV7TNC0Q3&source=weebcentral |
| Actualiser mes séries (nouveaux chapitres) | `button#btnRefresh` | AGIT (page modifiée) |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | AGIT (page modifiée) |
| Notifications — aucune non lue | `button#btnNotif` | AGIT (page modifiée) |
| Paramètres | `a` | NAVIGUE → parametres.html |
| Kaito | `a` | NAVIGUE → profil.html |
| Catalogue | `a` | NAVIGUE → recherche.html |
| Nouveautés | `a` | NAVIGUE → catalogue.html?sort=latest |
| Top | `a` | NAVIGUE → catalogue.html?sort=rating |
| Importer un fichier | `a` | NAVIGUE → import.html |
| Téléchargements | `a` | MÊME PAGE |
| Code source | `a` | OUVRE UN ONGLET |
| Signaler un bug | `a` | OUVRE UN ONGLET |
| Versions | `a` | OUVRE UN ONGLET |
| Confidentialité | `a` | NAVIGUE → confidentialite.html |
| Licence | `a` | OUVRE UN ONGLET |
| FR | `button` | AGIT (page modifiée) |
| EN | `button` | AGIT (page modifiée) |
| Accueil | `a` | NAVIGUE → accueil.html |
| Bibliothèque — 249 séries avec des chapitres n | `a` | DISPARU |
| Recherche | `a` | NAVIGUE → recherche.html |
| Profil | `a` | NAVIGUE → profil.html |
| Plus de sections | `button#mnavMore` | AGIT (page modifiée) |


## `import.html`

URL auditée : `/import.html`

> État : **connecté**
> Les verdicts qui suivent se lisent dans CET état.

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | MÊME PAGE |
| Inko | `a` | AGIT (focus déplacé) |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (page modifiée) |
| Reprendre ma dernière lecture | `button#btnContinue` | NAVIGUE → chapitre.html?manga=01J76XY7E9FNDZ1DBBM6PBJPFK&chapter=01M1PDC3T1X0C0X02YV7TNC0Q3&source=weebcentral |
| Actualiser mes séries (nouveaux chapitres) | `button#btnRefresh` | AGIT (page modifiée) |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | AGIT (page modifiée) |
| Notifications — aucune non lue | `button#btnNotif` | AGIT (page modifiée) |
| Paramètres | `a` | NAVIGUE → parametres.html |
| Kaito | `a` | NAVIGUE → profil.html |
| Choisir un fichier | `button` | NAVIGUE → recherche.html |
| Catalogue | `a` | NAVIGUE → catalogue.html |
| Nouveautés | `a` | NAVIGUE → catalogue.html?sort=latest |
| Top | `a` | NAVIGUE → catalogue.html?sort=rating |
| Importer un fichier | `a` | MÊME PAGE |
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
| Bibliothèque — 223 séries avec des chapitres n | `a` | NAVIGUE → bibliotheque.html |
| Recherche | `a` | NAVIGUE → recherche.html |
| Profil | `a` | NAVIGUE → profil.html |
| Plus de sections | `button#mnavMore` | AGIT (page modifiée) |


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
| Aller au contenu | `a` | MÊME PAGE |
| Inko | `a` | AGIT (focus déplacé) |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (page modifiée) |
| Reprendre ma dernière lecture | `button#btnContinue` | NAVIGUE → chapitre.html?manga=01J76XY7E9FNDZ1DBBM6PBJPFK&chapter=01M1PDC3T1X0C0X02YV7TNC0Q3&source=weebcentral |
| Actualiser mes séries (nouveaux chapitres) | `button#btnRefresh` | AGIT (page modifiée) |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | AGIT (page modifiée) |
| Notifications — aucune non lue | `button#btnNotif` | AGIT (page modifiée) |
| Paramètres | `a` | MÊME PAGE |
| Kaito | `a` | NAVIGUE → profil.html |
| Enregistrer | `button#btnSaveUsername` | AGIT (page modifiée) |
| Afficher le code | `button` | AGIT (focus déplacé) |
| Gérer | `button` | AGIT (panneau) |
| INPUT | `input#chkUneMain` | AGIT (page modifiée) |
| Activer | `button#btnNotifsMobiles` | AGIT (focus déplacé) |
| ← RTL | `button` | NAVIGUE → catalogue.html |
| LTR → | `button` | AGIT (page modifiée) |
| ↕ Webtoon | `button` | AGIT (page modifiée) |
| Page | `button` | AGIT (page modifiée) |
| Double | `button` | AGIT (page modifiée) |
| Défilement | `button` | AGIT (page modifiée) |
| Haute | `button` | AGIT (focus déplacé) |
| Éco | `button` | AGIT (page modifiée) |
| FR + EN | `button` | NAVIGUE → catalogue.html |
| FR | `button` | AGIT (page modifiée) |
| EN | `button` | AGIT (page modifiée) |
| + JA | `button` | AGIT (page modifiée) |
| Sombre | `button` | AGIT (page modifiée) |
| AMOLED | `button` | AGIT (page modifiée) |
| Clair | `button` | AGIT (page modifiée) |
| Contraste renforcé (AAA) — texte plus sombre,  | `button` | AGIT (page modifiée) |
| Auto | `button` | AGIT (page modifiée) |
| Couleur d’accentuation Orange | `button` | NAVIGUE → accueil.html |
| Couleur d’accentuation Bleu | `button` | **INERTE** |
| Couleur d’accentuation Violet | `button` | DISPARU |
| Couleur d’accentuation Vert | `button` | DISPARU |
| Couleur d’accentuation Rose | `button` | DISPARU |
| Couleur d’accentuation Rouge | `button` | DISPARU |
| Couleur d’accentuation Cyan | `button` | DISPARU |
| Couleur d’accentuation Ambre | `button` | DISPARU |
| Flouté | `button` | AGIT (focus déplacé) |
| Visible | `button` | AGIT (page modifiée) |
| Connecter | `button` | NAVIGUE → https://anilist.co/login?apiVersion=v2&client_id=43908&response_type=token& |
| Ouvrir le lecteur | `button#btnOpenMusic` | AGIT (page modifiée) |
| Vérifier | `button#btnCheckUpdate` | AGIT (focus déplacé) |
| Vider le cache | `button#btnClearCache` | ÉVITÉ (destructif) |
| Revoir la visite | `button#btnReplayTour` | **INERTE** |
| Afficher | `button#btnDiagVoir` | AGIT (focus déplacé) |
| Copier le rapport | `button#btnDiagCopier` | AGIT (page modifiée) |
| Exporter | `button#btnExport` | NAVIGUE → recherche.html |
| Importer | `button#btnImport` | AGIT (focus déplacé) |
| Effacer | `button#btnClearHistory` | ÉVITÉ (destructif) |
| Modifier le raccourci Rechercher | `button` | AGIT (page modifiée) |
| Modifier le raccourci Lecture aleatoire | `button` | AGIT (page modifiée) |
| Modifier le raccourci Reprendre la lecture | `button` | AGIT (page modifiée) |
| Modifier le raccourci Ma bibliotheque | `button` | AGIT (page modifiée) |
| Modifier le raccourci Accueil | `button` | NAVIGUE → recherche.html |
| Modifier le raccourci Afficher cette aide | `button` | AGIT (page modifiée) |
| Reinitialiser | `button#btnResetShortcuts` | ÉVITÉ (destructif) |
| Restaurer | `button` | NAVIGUE → recherche.html |
| Me deconnecter | `button` | AGIT (panneau) |
| Fermer | `button` | AGIT (page modifiée) |
| Fermer les autres | `button#btnRevokeOthers` | AGIT (panneau) |
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
| Accueil | `a` | NAVIGUE → accueil.html |
| Bibliothèque — 223 séries avec des chapitres n | `a` | NAVIGUE → bibliotheque.html |
| Recherche | `a` | NAVIGUE → recherche.html |
| Profil | `a` | NAVIGUE → profil.html |
| Plus de sections | `button#mnavMore` | AGIT (page modifiée) |


## `profil.html`

URL auditée : `/profil.html`

> État : **connecté**
> Les verdicts qui suivent se lisent dans CET état.

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | MÊME PAGE |
| Inko | `a` | AGIT (focus déplacé) |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (page modifiée) |
| Reprendre ma dernière lecture | `button#btnContinue` | NAVIGUE → chapitre.html?manga=01J76XY7E9FNDZ1DBBM6PBJPFK&chapter=01M1PDC3T1X0C0X02YV7TNC0Q3&source=weebcentral |
| Actualiser mes séries (nouveaux chapitres) | `button#btnRefresh` | AGIT (page modifiée) |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | AGIT (page modifiée) |
| Notifications — aucune non lue | `button#btnNotif` | AGIT (page modifiée) |
| Paramètres | `a` | NAVIGUE → parametres.html |
| Kaito | `a` | MÊME PAGE |
| Éditer | `button` | AGIT (page modifiée) |
| ↗ Partager | `button` | AGIT (focus déplacé) |
| ⊞ Vue d'ensemble | `a` | MÊME PAGE |
| Ma bibliothèque | `a` | AGIT (focus déplacé) |
| Historique | `a` | MÊME PAGE |
| ≡ Listes de lecture | `a` | MÊME PAGE |
| ★ Mes avis | `a` | MÊME PAGE |
| Badges | `a` | MÊME PAGE |
| Statistiques détaillées | `a` | **INERTE** |
| ▶ Reprendre | `a` | AGIT (focus déplacé) |
| Modifier l'objectif | `button#goalEdit` | AGIT (page modifiée) |
| Voir tout | `a` | MÊME PAGE |
| Premier pas — Lire son premier chapitre — voir | `div` | **INERTE** |
| Lancé — 10 chapitres lus — voir tous les badge | `div` | AGIT (page modifiée) |
| Coup de cœur — Ajouter un favori — voir tous l | `div` | **INERTE** |
| Régulier — 7 jours de lecture actifs — voir to | `div` | **INERTE** |
| Voir toute la collection | `a` | MÊME PAGE |
| Frieren - Beyond Journey's End | `a` | **INERTE** |
| Tyranny | `a` | AGIT (page modifiée) |
| Kekkai no Noah | `a` | NAVIGUE → serie.html?id=1f91350e-c216-4ca8-961f-71cf65d9fb4e&source=mangadex |
| Moby Dick; Or, The Whale | `a` | NAVIGUE → serie.html?id=2701&source=gutenberg |
| My Isekai Life - I Gained a Second Character C | `a` | NAVIGUE → serie.html?id=01J76XYCT53KQ0JESVSWE2SAAS&source=weebcentral |
| Finding the Invisible Star | `a` | NAVIGUE → serie.html?id=01KZNSXCKDBP1BMW8HD6JGWF4K&source=weebcentral |
| Reprendre One Piece au chapitre 1192 | `a` | NAVIGUE → chapitre.html?manga=01J76XY7E9FNDZ1DBBM6PBJPFK&chapter=01M1PDC3T1X0C0X02YV7TNC0Q3&source=weebcentral |
| Reprendre Boruto: Naruto Next Generations au c | `a` | NAVIGUE → chapitre.html?manga=46e530ce-0766-4cbd-b005-5e6fb0ba5e71&chapter=fa3ddc54-3799-4301-bec0-c8c8c35d0677&source=mangadex |
| Reprendre Pride and Prejudice au chapitre 1 | `a` | NAVIGUE → lecture.html?manga=1342&chapter=1342%3Afull&source=gutenberg |
| Reprendre JoJo's Bizarre Adventure - Part 7 -  | `a` | NAVIGUE → chapitre.html?manga=01J76XY8NHVJYQJ3VJB51PAQ7B&chapter=01J76XYVXV8H6PYVQCKJZB8MS4&source=weebcentral |
| Voir tous | `a` | MÊME PAGE |
| Connecter | `button` | NAVIGUE → https://anilist.co/login?apiVersion=v2&client_id=43908&response_type=token& |
| Droite → Gauche | `button` | AGIT (page modifiée) |
| Gauche → Droite | `button` | AGIT (page modifiée) |
| Sombre | `button` | AGIT (page modifiée) |
| Clair | `button` | AGIT (page modifiée) |
| Vertical | `button` | AGIT (page modifiée) |
| Horizontal | `button` | AGIT (page modifiée) |
| Aperçu public | `a#btnApercuPublic` | NAVIGUE → u.html?u=Kaito&preview=1 |
| Inko Open-source · Gratuit | `a` | OUVRE UN ONGLET |
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
| Bibliothèque — 223 séries avec des chapitres n | `a` | NAVIGUE → bibliotheque.html |
| Recherche | `a` | NAVIGUE → recherche.html |
| Profil | `a` | MÊME PAGE |
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
| Fermer l'astuce | `button` | DISPARU |


## `u.html`

URL auditée : `/u.html?u=demo&preview=1`

> État : **connecté**
> Les verdicts qui suivent se lisent dans CET état.

**1 réponse(s) 404 de l’API** — souvent la bonne réponse (« ce compte n’existe pas ») ; à lire avec ce que la page affiche alors :

- `/api/users/profile/demo?as=public`

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | MÊME PAGE |
| Inko | `a` | AGIT (focus déplacé) |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (page modifiée) |
| Reprendre ma dernière lecture | `button#btnContinue` | NAVIGUE → chapitre.html?manga=01J76XY7E9FNDZ1DBBM6PBJPFK&chapter=01M1PDC3T1X0C0X02YV7TNC0Q3&source=weebcentral |
| Actualiser mes séries (nouveaux chapitres) | `button#btnRefresh` | AGIT (page modifiée) |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | AGIT (page modifiée) |
| Notifications — aucune non lue | `button#btnNotif` | AGIT (page modifiée) |
| Paramètres | `a` | NAVIGUE → parametres.html |
| Kaito | `a` | NAVIGUE → profil.html |
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
| Bibliothèque — 223 séries avec des chapitres n | `a` | NAVIGUE → bibliotheque.html |
| Recherche | `a` | NAVIGUE → recherche.html |
| Profil | `a` | NAVIGUE → profil.html |
| Plus de sections | `button#mnavMore` | AGIT (page modifiée) |


## `stats.html`

URL auditée : `/stats.html`

> État : **connecté**
> Les verdicts qui suivent se lisent dans CET état.

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | MÊME PAGE |
| Inko | `a` | AGIT (focus déplacé) |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (page modifiée) |
| Reprendre ma dernière lecture | `button#btnContinue` | NAVIGUE → chapitre.html?manga=01J76XY7E9FNDZ1DBBM6PBJPFK&chapter=01M1PDC3T1X0C0X02YV7TNC0Q3&source=weebcentral |
| Actualiser mes séries (nouveaux chapitres) | `button#btnRefresh` | AGIT (page modifiée) |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | AGIT (page modifiée) |
| Notifications — aucune non lue | `button#btnNotif` | AGIT (page modifiée) |
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
| Désactiver | `button` | DISPARU |
| Accueil | `a` | NAVIGUE → accueil.html |
| Bibliothèque — 223 séries avec des chapitres n | `a` | NAVIGUE → bibliotheque.html |
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
| Aller au contenu | `a` | MÊME PAGE |
| Inko | `a` | AGIT (focus déplacé) |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (page modifiée) |
| Reprendre ma dernière lecture | `button#btnContinue` | NAVIGUE → chapitre.html?manga=01J76XY7E9FNDZ1DBBM6PBJPFK&chapter=01M1PDC3T1X0C0X02YV7TNC0Q3&source=weebcentral |
| Actualiser mes séries (nouveaux chapitres) | `button#btnRefresh` | AGIT (page modifiée) |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | AGIT (page modifiée) |
| Notifications — aucune non lue | `button#btnNotif` | AGIT (page modifiée) |
| Paramètres | `a` | NAVIGUE → parametres.html |
| Kaito | `a` | NAVIGUE → profil.html |
| Chercher des mises à jour des extensions | `button#btnCheckExt` | **INERTE** |
| Vérifier que la source répond | `button` | AGIT (page modifiée) |
| Voir les derniers appels a cette source | `button` | AGIT (panneau) |
| Remonter MangaDex | `button` | AGIT (page modifiée) |
| Réactiver cette source | `button` | AGIT (page modifiée) |
| Désinstaller complètement cette extension | `button` | DISPARU |
| Activer | `button` | DISPARU |
| Remonter SushiScan | `button` | DISPARU |
| Ne plus utiliser cette source (masquée en rech | `button` | DISPARU |
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
| Bibliothèque — 223 séries avec des chapitres n | `a` | NAVIGUE → bibliotheque.html |
| Recherche | `a` | NAVIGUE → recherche.html |
| Profil | `a` | NAVIGUE → profil.html |
| Plus de sections | `button#mnavMore` | AGIT (page modifiée) |


## `liste.html`

URL auditée : `/liste.html`

> État : **connecté**
> Les verdicts qui suivent se lisent dans CET état.

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | MÊME PAGE |
| Inko | `a` | AGIT (focus déplacé) |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (page modifiée) |
| Reprendre ma dernière lecture | `button#btnContinue` | NAVIGUE → chapitre.html?manga=01J76XY7E9FNDZ1DBBM6PBJPFK&chapter=01M1PDC3T1X0C0X02YV7TNC0Q3&source=weebcentral |
| Actualiser mes séries (nouveaux chapitres) | `button#btnRefresh` | AGIT (page modifiée) |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | AGIT (page modifiée) |
| Notifications — aucune non lue | `button#btnNotif` | AGIT (page modifiée) |
| Paramètres | `a` | NAVIGUE → parametres.html |
| Kaito | `a` | NAVIGUE → profil.html |
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
| Bibliothèque — 223 séries avec des chapitres n | `a` | NAVIGUE → bibliotheque.html |
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
| Réessayer | `button#offRetry` | RECHARGE LA PAGE |

