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

## À corriger — inerte dans TOUS les modes audités

**10 contrôle(s)** ne réagissent ni en autonome, ni via le hub.

| Page | Contrôle | Élément |
|---|---|---|
| `catalogue` | Terminés | `button` |
| `catalogue` | Pause | `button` |
| `catalogue` | Shōnen | `button` |
| `catalogue` | Seinen | `button` |
| `catalogue` | Shōjo | `button` |
| `catalogue` | Josei | `button` |
| `catalogue` | Liste | `button` |
| `notifications` | Réponses | `button` |
| `notifications` | Mentions | `button` |
| `downloads` | Téléchargements | `a` |

## Dépend du hub ou d’un compte — inerte en autonome seulement

Ces contrôles fonctionnent une fois le serveur joignable. Le défaut, s’il y
en a un, n’est pas dans le bouton : c’est que **rien ne dit à l’utilisateur**
pourquoi il ne se passe rien.

| Page | Contrôle | Élément |
|---|---|---|
| `recherche` | Recherche | `a` |
| `bibliotheque` | Bibliothèque | `a` |
| `notifications` | Non lues | `button` |
| `notifications` | Chapitres | `button` |
| `import` | Se reconnecter | `button` |
| `profil` | ↗ Partager | `button` |
| `profil` | Se reconnecter | `button` |
| `u` | Catalogue | `a` |
| `u` | Nouveautés | `a` |
| `stats` | Se reconnecter | `button` |

---

# Mode « autonome » — `http://127.0.0.1:8612`

| Page | Contrôles | Naviguent | Agissent | Onglet | **Inertes** | Erreurs JS | 404 interne | 404 tiers |
|---|---|---|---|---|---|---|---|---|
| accueil | 33 | 0 | 2 | 5 | **0** | 0 | 0 | 8 |
| catalogue | 39 | 2 | 12 | 4 | **7** | 0 | 0 | 15 |
| recherche | 37 | 9 | 8 | 4 | **1** | 0 | 0 | 12 |
| bibliotheque | 28 | 9 | 9 | 4 | **1** | 0 | 0 | 10 |
| serie | 25 | 11 | 8 | 4 | **0** | 0 | 0 | 12 |
| chapitre | 21 | 10 | 6 | 4 | **0** | 0 | 0 | 4 |
| lecture | 20 | 9 | 6 | 4 | **0** | 0 | 0 | 6 |
| collections | 25 | 5 | 16 | 4 | **0** | 0 | 0 | 15 |
| collection-detail | 25 | 12 | 8 | 4 | **0** | 0 | 0 | 14 |
| notes | 26 | 12 | 10 | 4 | **0** | 0 | 0 | 15 |
| notifications | 34 | 2 | 9 | 4 | **4** | 0 | 0 | 15 |
| downloads | 35 | 6 | 4 | 4 | **1** | 0 | 0 | 9 |
| import | 37 | 2 | 4 | 4 | **1** | 0 | 0 | 11 |
| localreader | 3 | 3 | 0 | 0 | **0** | 0 | 0 | 2 |
| parametres | 74 | 1 | 5 | 4 | **0** | 0 | 0 | 15 |
| profil | 47 | 9 | 5 | 4 | **2** | 0 | 0 | 15 |
| u | 35 | 10 | 7 | 4 | **2** | 0 | 0 | 15 |
| stats | 26 | 2 | 4 | 4 | **1** | 0 | 0 | 12 |
| sources | 40 | 16 | 8 | 4 | **0** | 0 | 0 | 12 |
| liste | 25 | 12 | 8 | 4 | **0** | 0 | 0 | 14 |
| anilist | 2 | 2 | 0 | 0 | **0** | 0 | 0 | 0 |
| confidentialite | 2 | 1 | 0 | 1 | **0** | 0 | 0 | 4 |
| offline | 0 | 0 | 0 | 0 | **0** | 0 | 1 | 0 |

**20 contrôles inertes** dans ce mode.


## `accueil.html`

URL auditée : `/accueil.html`

> État : **non connecté** · mode autonome (aucun hub)
> Les verdicts qui suivent se lisent dans CET état.

**8 réponse(s) 404 de sites tiers** — souvent normal (une extension pagine jusqu’au 404 pour savoir qu’elle a fini) :

- `sushiscan.fr/genres/hentai/`
- `sushiscan.fr/genres/adulte/`
- `sushiscan.fr/genres/pornhwa/page/4/`
- `sushiscan.fr/genres/pornhwa/page/5/`
- `sushiscan.fr/genres/ecchi/page/3/`
- `sushiscan.fr/genres/ecchi/page/4/`
- … et 2 autre(s)

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | AGIT (focus déplacé) |
| Inko | `a` | AGIT (focus déplacé) |
| Mode incognito (lecture privée) | `button#btnIncognito` | DISPARU |
| Actualiser mes séries (nouveaux chapitres) | `button#btnRefresh` | DISPARU |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | DISPARU |
| Paramètres | `a` | DISPARU |
| Voir l'historique → | `a` | DISPARU |
| se reconnecter | `a` | DISPARU |
| ‹ | `button#trendPrev` | DISPARU |
| › | `button#trendNext` | DISPARU |
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
- `sushiscan.fr/genres/pornhwa/page/4/`
- `sushiscan.fr/genres/pornhwa/page/5/`
- `sushiscan.fr/genres/ecchi/page/3/`
- `sushiscan.fr/genres/erotique/page/8/`
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
| Tout | `button` | AGIT (focus déplacé) |
| En cours | `button` | AGIT (page modifiée) |
| Terminés | `button` | **INERTE** |
| Pause | `button` | **INERTE** |
| Shōnen | `button` | **INERTE** |
| Seinen | `button` | **INERTE** |
| Shōjo | `button` | **INERTE** |
| Josei | `button` | **INERTE** |
| Lecture aléatoire | `button#btnRandom` | AGIT (focus déplacé) |
| Grille | `button` | AGIT (page modifiée) |
| Liste | `button` | **INERTE** |
| Trier le catalogue | `select#sortSelect` | AGIT (page modifiée) |
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

**12 réponse(s) 404 de sites tiers** — souvent normal (une extension pagine jusqu’au 404 pour savoir qu’elle a fini) :

- `sushiscan.fr/genres/hentai/`
- `sushiscan.fr/genres/adulte/`
- `sushiscan.fr/genres/pornhwa/page/4/`
- `sushiscan.fr/genres/pornhwa/page/5/`
- `sushiscan.fr/genres/ecchi/page/3/`
- `sushiscan.fr/genres/ecchi/page/4/`
- … et 6 autre(s)

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
| Importer un fichier | `a` | AGIT (focus déplacé) |
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
> La page affiche : « Connexion requise Ta session a expiré ou tu n'es pas connecté. Recharge la page pour rétablir la session. Se reconnecter »
> Les verdicts qui suivent se lisent dans CET état.

**10 réponse(s) 404 de sites tiers** — souvent normal (une extension pagine jusqu’au 404 pour savoir qu’elle a fini) :

- `sushiscan.fr/genres/hentai/`
- `sushiscan.fr/genres/adulte/`
- `sushiscan.fr/genres/pornhwa/page/4/`
- `sushiscan.fr/genres/pornhwa/page/5/`
- `sushiscan.fr/genres/ecchi/page/3/`
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
| Bibliothèque | `button` | AGIT (focus déplacé) |
| Signets | `button` | AGIT (page modifiée) |
| Téléchargements | `button` | AGIT (page modifiée) |
| Se reconnecter | `button` | ERREUR : locator.click: Element is not visible |
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

**12 réponse(s) 404 de sites tiers** — souvent normal (une extension pagine jusqu’au 404 pour savoir qu’elle a fini) :

- `sushiscan.fr/genres/pornhwa/page/4/`
- `sushiscan.fr/genres/hentai/`
- `sushiscan.fr/genres/adulte/`
- `sushiscan.fr/genres/pornhwa/page/5/`
- `sushiscan.fr/genres/ecchi/page/4/`
- `sushiscan.fr/genres/ecchi/page/3/`
- … et 6 autre(s)

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
| Téléchargements | `a` | AGIT (focus déplacé) |
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

**4 réponse(s) 404 de sites tiers** — souvent normal (une extension pagine jusqu’au 404 pour savoir qu’elle a fini) :

- `sushiscan.fr/genres/hentai/`
- `sushiscan.fr/genres/pornhwa/page/5/`
- `sushiscan.fr/genres/pornhwa/page/4/`
- `sushiscan.fr/genres/adulte/`

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

**6 réponse(s) 404 de sites tiers** — souvent normal (une extension pagine jusqu’au 404 pour savoir qu’elle a fini) :

- `sushiscan.fr/genres/adulte/`
- `sushiscan.fr/genres/hentai/`
- `sushiscan.fr/genres/ecchi/page/5/`
- `sushiscan.fr/genres/ecchi/page/4/`
- `sushiscan.fr/genres/pornhwa/page/4/`
- `sushiscan.fr/genres/pornhwa/page/5/`

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

- `sushiscan.fr/genres/hentai/`
- `sushiscan.fr/genres/adulte/`
- `sushiscan.fr/genres/ecchi/page/4/`
- `sushiscan.fr/genres/ecchi/page/5/`
- `sushiscan.fr/genres/ecchi/page/3/`
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
| Paramètres | `a` | NAVIGUE → parametres.html |
| ← Mes listes | `a` | NAVIGUE → collections.html |
| Catalogue | `a` | NAVIGUE → catalogue.html |
| Nouveautés | `a` | NAVIGUE → catalogue.html?sort=latest |
| Top | `a` | AGIT (focus déplacé) |
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
| Lire chaque serie du debut a la fin | `button#jrRecit` | AGIT (focus déplacé) |
| Exporter en Markdown (Obsidian, Logseq…) | `button#jrExportMd` | AGIT (focus déplacé) |
| Se reconnecter | `button` | AGIT (focus déplacé) |
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
| Actualiser les notifications | `button#ntRefresh` | AGIT (focus déplacé) |
| Recevoir les notifications même Inko fermé | `button#ntEnablePush` | AGIT (focus déplacé) |
| Fréquence de vérification des nouveaux chapitr | `select#ntFreq` | AGIT (focus déplacé) |
| Toutes | `button` | AGIT (focus déplacé) |
| Non lues | `button` | **INERTE** |
| Réponses | `button` | **INERTE** |
| Mentions | `button` | **INERTE** |
| Chapitres | `button` | **INERTE** |
| Se reconnecter | `button` | AGIT (focus déplacé) |
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
| Fermer l'astuce | `button` | DISPARU |


## `downloads.html`

URL auditée : `/downloads.html`

> État : **non connecté** · mode autonome (aucun hub)
> Les verdicts qui suivent se lisent dans CET état.

**9 réponse(s) 404 de sites tiers** — souvent normal (une extension pagine jusqu’au 404 pour savoir qu’elle a fini) :

- `sushiscan.fr/genres/hentai/`
- `sushiscan.fr/genres/adulte/`
- `sushiscan.fr/genres/pornhwa/page/5/`
- `sushiscan.fr/genres/pornhwa/page/4/`
- `sushiscan.fr/genres/ecchi/page/3/`
- `sushiscan.fr/genres/ecchi/page/4/`
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


## `import.html`

URL auditée : `/import.html`

> État : **non connecté** · mode autonome (aucun hub)
> Les verdicts qui suivent se lisent dans CET état.

**11 réponse(s) 404 de sites tiers** — souvent normal (une extension pagine jusqu’au 404 pour savoir qu’elle a fini) :

- `sushiscan.fr/genres/hentai/`
- `sushiscan.fr/genres/adulte/`
- `sushiscan.fr/genres/pornhwa/page/4/`
- `sushiscan.fr/genres/pornhwa/page/5/`
- `sushiscan.fr/genres/ecchi/page/3/`
- `sushiscan.fr/genres/ecchi/page/4/`
- … et 5 autre(s)

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | AGIT (focus déplacé) |
| Inko | `a` | NAVIGUE → accueil.html |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (page modifiée) |
| Actualiser mes séries (nouveaux chapitres) | `button#btnRefresh` | AGIT (page modifiée) |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | AGIT (page modifiée) |
| Paramètres | `a` | NAVIGUE → parametres.html |
| Se reconnecter | `button` | **INERTE** |
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

**2 réponse(s) 404 de sites tiers** — souvent normal (une extension pagine jusqu’au 404 pour savoir qu’elle a fini) :

- `sushiscan.fr/genres/hentai/`
- `sushiscan.fr/genres/adulte/`

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

- `sushiscan.fr/genres/hentai/`
- `sushiscan.fr/genres/adulte/`
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
| Paramètres | `a` | AGIT (page modifiée) |
| Se reconnecter | `button` | DISPARU |
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
| Contraste renforce (AAA) — texte plus sombre,  | `button` | DISPARU |
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

- `sushiscan.fr/genres/hentai/`
- `sushiscan.fr/genres/adulte/`
- `sushiscan.fr/genres/pornhwa/page/4/`
- `sushiscan.fr/genres/pornhwa/page/5/`
- `sushiscan.fr/genres/ecchi/page/5/`
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
| Éditer | `button` | AGIT (focus déplacé) |
| ↗ Partager | `button` | **INERTE** |
| ⊞ Vue d'ensemble | `a` | NAVIGUE → profil.html# |
| Ma bibliothèque | `a` | NAVIGUE → bibliotheque.html |
| Historique | `a` | NAVIGUE → profil.html# |
| ≡ Listes de lecture | `a` | NAVIGUE → profil.html# |
| ★ Mes avis | `a` | NAVIGUE → profil.html# |
| Badges | `a` | NAVIGUE → profil.html# |
| Statistiques détaillées | `a` | NAVIGUE → stats.html |
| Se reconnecter | `button` | **INERTE** |
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
- `sushiscan.fr/genres/ecchi/page/5/`
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

> État : **non connecté** · mode autonome (aucun hub)
> Les verdicts qui suivent se lisent dans CET état.

**12 réponse(s) 404 de sites tiers** — souvent normal (une extension pagine jusqu’au 404 pour savoir qu’elle a fini) :

- `sushiscan.fr/genres/ecchi/page/4/`
- `sushiscan.fr/genres/hentai/`
- `sushiscan.fr/genres/adulte/`
- `sushiscan.fr/genres/ecchi/page/3/`
- `sushiscan.fr/genres/ecchi/page/5/`
- `sushiscan.fr/genres/pornhwa/page/4/`
- … et 6 autre(s)

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | AGIT (focus déplacé) |
| Inko | `a` | NAVIGUE → accueil.html |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (page modifiée) |
| Actualiser mes séries (nouveaux chapitres) | `button#btnRefresh` | AGIT (page modifiée) |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | AGIT (page modifiée) |
| Paramètres | `a` | NAVIGUE → parametres.html |
| Se reconnecter | `button` | **INERTE** |
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
| Fermer l'astuce | `button` | DISPARU |


## `sources.html`

URL auditée : `/sources.html`

> État : **non connecté** · mode autonome (aucun hub)
> Les verdicts qui suivent se lisent dans CET état.

**12 réponse(s) 404 de sites tiers** — souvent normal (une extension pagine jusqu’au 404 pour savoir qu’elle a fini) :

- `sushiscan.fr/genres/hentai/`
- `sushiscan.fr/genres/adulte/`
- `sushiscan.fr/genres/pornhwa/page/4/`
- `sushiscan.fr/genres/pornhwa/page/5/`
- `sushiscan.fr/genres/ecchi/page/3/`
- `sushiscan.fr/genres/ecchi/page/4/`
- … et 6 autre(s)

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


## `liste.html`

URL auditée : `/liste.html`

> État : **non connecté** · mode autonome (aucun hub)
> Les verdicts qui suivent se lisent dans CET état.

**14 réponse(s) 404 de sites tiers** — souvent normal (une extension pagine jusqu’au 404 pour savoir qu’elle a fini) :

- `sushiscan.fr/genres/erotique/page/9/`
- `sushiscan.fr/genres/hentai/`
- `sushiscan.fr/genres/adulte/`
- `sushiscan.fr/genres/pornhwa/page/4/`
- `sushiscan.fr/genres/pornhwa/page/5/`
- `sushiscan.fr/genres/ecchi/page/3/`
- … et 8 autre(s)

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

**4 réponse(s) 404 de sites tiers** — souvent normal (une extension pagine jusqu’au 404 pour savoir qu’elle a fini) :

- `sushiscan.fr/genres/hentai/`
- `sushiscan.fr/genres/adulte/`
- `sushiscan.fr/genres/pornhwa/page/5/`
- `sushiscan.fr/genres/pornhwa/page/4/`

| Contrôle | Élément | Verdict |
|---|---|---|
| Paramètres | `a` | NAVIGUE → parametres.html |
| dépôt du projet | `a` | OUVRE UN ONGLET |


## `offline.html`

URL auditée : `/offline.html`

> État : **non connecté**
> Les verdicts qui suivent se lisent dans CET état.

**Ressources du paquet absentes (404) — toujours un défaut :**

- `/offline.html`

Aucun contrôle visible.
---

# Mode « hub » — `http://127.0.0.1:8088`

| Page | Contrôles | Naviguent | Agissent | Onglet | **Inertes** | Erreurs JS | 404 interne | 404 tiers |
|---|---|---|---|---|---|---|---|---|
| accueil | 85 | 52 | 19 | 5 | **7** | 0 | 0 | 0 |
| catalogue | 69 | 6 | 12 | 4 | **8** | 0 | 0 | 0 |
| recherche | 71 | 6 | 6 | 4 | **0** | 0 | 0 | 0 |
| bibliotheque | 445 | 0 | 1 | 4 | **0** | 0 | 0 | 0 |
| serie | 73 | 10 | 9 | 4 | **4** | 0 | 0 | 0 |
| chapitre | 44 | 9 | 7 | 4 | **1** | 0 | 0 | 0 |
| lecture | 23 | 11 | 8 | 4 | **0** | 0 | 0 | 0 |
| collections | 31 | 7 | 18 | 4 | **1** | 0 | 0 | 0 |
| collection-detail | 27 | 14 | 9 | 4 | **0** | 0 | 0 | 0 |
| notes | 29 | 14 | 10 | 4 | **0** | 0 | 0 | 0 |
| notifications | 71 | 14 | 13 | 4 | **4** | 0 | 0 | 0 |
| downloads | 27 | 8 | 5 | 4 | **1** | 0 | 0 | 0 |
| import | 38 | 7 | 5 | 4 | **1** | 0 | 0 | 0 |
| localreader | 3 | 3 | 0 | 0 | **0** | 0 | 0 | 0 |
| parametres | 87 | 2 | 5 | 4 | **1** | 0 | 0 | 0 |
| profil | 69 | 3 | 6 | 5 | **0** | 0 | 0 | 0 |
| u | 38 | 13 | 9 | 4 | **0** | 0 | 1 | 0 |
| stats | 30 | 14 | 9 | 4 | **0** | 0 | 0 | 0 |
| sources | 41 | 14 | 8 | 4 | **2** | 0 | 0 | 0 |
| liste | 27 | 11 | 8 | 4 | **0** | 0 | 0 | 0 |
| anilist | 2 | 2 | 0 | 0 | **0** | 0 | 0 | 0 |
| confidentialite | 2 | 1 | 0 | 1 | **0** | 0 | 0 | 0 |
| offline | 4 | 3 | 0 | 0 | **1** | 0 | 0 | 0 |

**31 contrôles inertes** dans ce mode.


## `accueil.html`

URL auditée : `/accueil.html`

> État : **connecté**
> Les verdicts qui suivent se lisent dans CET état.

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | AGIT (focus déplacé) |
| Inko | `a` | **INERTE** |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (page modifiée) |
| Reprendre ma dernière lecture | `button#btnContinue` | NAVIGUE → chapitre.html?manga=01J76XY8NHVJYQJ3VJB51PAQ7B&chapter=01J76XYVXV8H6PYVQCKJZB8MS4&source=weebcentral |
| Actualiser mes séries (nouveaux chapitres) | `button#btnRefresh` | AGIT (page modifiée) |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | AGIT (page modifiée) |
| Notifications | `button#btnNotif` | AGIT (page modifiée) |
| Paramètres | `a` | NAVIGUE → parametres.html |
| Kaito | `a` | NAVIGUE → profil.html |
| Kagetora-kun wa Modorenai | `a` | NAVIGUE → serie.html?id=01KGQ1Q0JQSZT112JY5V75X1D4&source=weebcentral |
| Comedy | `a` | NAVIGUE → catalogue.html?tag=Comedy |
| Ecchi | `a` | NAVIGUE → catalogue.html?tag=Ecchi |
| Gender Bender | `a` | NAVIGUE → catalogue.html?tag=Gender%20Bender |
| School Life | `a` | NAVIGUE → catalogue.html?tag=School%20Life |
| Lire le Ch. 15 | `a#heroRead` | NAVIGUE → chapitre.html?manga=01KGQ1Q0JQSZT112JY5V75X1D4&chapter=01M1ZM2MK0S9S9G7KH3QPF5CJ9&source=weebcentral |
| Voir la fiche | `a` | AGIT (focus déplacé) |
| Ajouter aux favoris | `button` | DISPARU |
| Kagetora-kun wa Modorenai | `button` | **INERTE** |
| Saikyou no Kurokishi, Sentou Maid ni Tenshoku  | `button` | AGIT (page modifiée) |
| Ushiro no Shoumen Kamui-san | `button` | AGIT (page modifiée) |
| Natsume Arata no Kekkon | `button` | **INERTE** |
| Outbreak Company - Moeru Shinryakusha | `button` | AGIT (page modifiée) |
| ATM Ojisan: Isekai de Mote-ki ga Tomaranai! | `button` | **INERTE** |
| Voir l'historique → | `a` | NAVIGUE → profil.html |
| JoJo's Bizarre Adventure - Part 7 - Steel Ball | `a` | NAVIGUE → chapitre.html?manga=01J76XY8NHVJYQJ3VJB51PAQ7B&chapter=01J76XYVXV8H6PYVQCKJZB8MS4&source=weebcentral |
| Reprendre à une position précédente | `button` | AGIT (page modifiée) |
| Retirer de la liste | `button` | ÉVITÉ (destructif) |
| Death Note (Color) Chapitre 22 · Page 1 | `a` | NAVIGUE → chapitre.html?manga=01J76XYEVSN36R3RWD9TNKB1BM&chapter=01KEN4NB3SMH2Y5E1J24E1WFYN&source=weebcentral |
| Witch Hat Atelier Chapitre 96 · Page 4 | `a` | NAVIGUE → chapitre.html?manga=01J76XYC2K8QWFZZRYYCZMN6EF&chapter=01KQX8GNHWSKQ9S2M3F7DM3Y08&source=weebcentral |
| One Piece Chapitre 1190 · Page 1 | `a` | **INERTE** |
| ‹ | `button#trendPrev` | **INERTE** |
| › | `button#trendNext` | AGIT (focus déplacé) |
| 1 Kagetora-kun wa Modorenai 2025 · ongoing | `a` | AGIT (page modifiée) |
| 2 Saikyou no Kurokishi, Sentou Maid ni Tenshok | `a` | NAVIGUE → serie.html?id=01J76XYD8NR8J2QHGSB0QZW1ZC |
| 3 Ushiro no Shoumen Kamui-san 2020 · ongoing | `a` | NAVIGUE → serie.html?id=01J76XYE9H83QW0EBXAPCER4A6 |
| 4 Natsume Arata no Kekkon 2019 · ongoing | `a` | NAVIGUE → serie.html?id=01J76XYE747R6MYCAP87T3YMBF |
| 5 Outbreak Company - Moeru Shinryakusha 2012 · | `a` | NAVIGUE → serie.html?id=01J76XYA0WAY21M9PJ76BWM60W |
| 6 ATM Ojisan: Isekai de Mote-ki ga Tomaranai!  | `a` | NAVIGUE → serie.html?id=01KMN65Y8ETVXN72MB4YMP79CE |
| 7 Amai Seikatsu 1990 · ongoing | `a` | NAVIGUE → serie.html?id=01J76XYA71W21F6FE3M0PN1VFQ |
| 8 The Reincarnated King of Fists 2024 · ongoin | `a` | NAVIGUE → serie.html?id=01JRZBAVB829AKGARECHF5QWYR |
| 9 The Regressed Mercenary Has a Plan 2024 · on | `a` | NAVIGUE → serie.html?id=01JNKHGT37KPS3KBVA5CG1X7V0 |
| 10 Absolute Sword Sense 2022 · ongoing | `a` | NAVIGUE → serie.html?id=01JJ2D2B46DZ8QYPVGNVC63V3E |
| Voir tout → | `a` | NAVIGUE → catalogue.html |
| Tout | `button` | AGIT (page modifiée) |
| Suivis | `button` | AGIT (page modifiée) |
| Populaire | `button` | AGIT (page modifiée) |
| Charger plus | `button#btnMore` | AGIT (page modifiée) |
| 1 One Piece 1997 · shounen | `a` | NAVIGUE → serie.html?id=01J76XY7E9FNDZ1DBBM6PBJPFK |
| 2 Blue Lock 2018 · shounen | `a` | NAVIGUE → serie.html?id=01J76XYD7E91K8QP6CY0Y53900 |
| 3 Bleach (Color) 2001 · shounen | `a` | NAVIGUE → serie.html?id=01J76XYEVQ0ZFHSDZBTNA55Y1F |
| 4 Hunter x Hunter 1998 · shounen | `a` | NAVIGUE → serie.html?id=01J76XY7EXQV9RE9KQ3JYE0WZ9 |
| 5 Kingdom 2006 · seinen | `a` | NAVIGUE → serie.html?id=01J76XY7VSG3R5ANYPDWTXDVP6 |
| 6 Chained Soldier 2019 · shounen | `a` | NAVIGUE → serie.html?id=01J76XYCVRSNNY2C2QH721967B |
| 7 One-Punch Man 2012 · seinen | `a` | NAVIGUE → serie.html?id=01J76XY7KT7J224EBK6J816Y1Q |
| 8 The Exiled Heavy Knight Knows How to Game th | `a` | NAVIGUE → serie.html?id=01J76XYFHVMSQVDJPQ42TN2XYN |
| 9 Bleach 2001 · shounen | `a` | NAVIGUE → serie.html?id=01J76XY7E4JCPK14V53BVQWD9Y |
| 10 Kagurabachi 2023 · shounen | `a` | NAVIGUE → serie.html?id=01J76XYGGM22WZP7T4TKA4ZFAF |
| Détails → | `a` | NAVIGUE → stats.html |
| Action | `a` | NAVIGUE → catalogue.html?tag=Action |
| Drama | `a` | NAVIGUE → catalogue.html?tag=Drama |
| Adventure | `a` | NAVIGUE → catalogue.html?tag=Adventure |
| Fantasy | `a` | NAVIGUE → catalogue.html?tag=Fantasy |
| Shounen | `a` | NAVIGUE → catalogue.html?tag=Shounen |
| Supernatural | `a` | NAVIGUE → catalogue.html?tag=Supernatural |
| Seinen | `a` | NAVIGUE → catalogue.html?tag=Seinen |
| Romance | `a` | NAVIGUE → catalogue.html?tag=Romance |
| Martial Arts | `a` | NAVIGUE → catalogue.html?tag=Martial%20Arts |
| Voir sur GitHub ★ | `a` | OUVRE UN ONGLET |
| Catalogue | `a` | NAVIGUE → catalogue.html |
| Nouveautés | `a` | NAVIGUE → catalogue.html?sort=latest |
| Top | `a` | NAVIGUE → catalogue.html |
| Importer un fichier | `a` | NAVIGUE → import.html |
| Téléchargements | `a` | NAVIGUE → downloads.html |
| Code source | `a` | OUVRE UN ONGLET |
| Signaler un bug | `a` | OUVRE UN ONGLET |
| Versions | `a` | OUVRE UN ONGLET |
| Confidentialité | `a` | NAVIGUE → confidentialite.html |
| Licence | `a` | OUVRE UN ONGLET |
| FR | `button` | AGIT (page modifiée) |
| EN | `button` | **INERTE** |
| Accueil | `a` | AGIT (page modifiée) |
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
| Aller au contenu | `a` | AGIT (page modifiée) |
| Inko | `a` | NAVIGUE → accueil.html |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (page modifiée) |
| Reprendre ma dernière lecture | `button#btnContinue` | NAVIGUE → chapitre.html?manga=01J76XY8NHVJYQJ3VJB51PAQ7B&chapter=01J76XYVXV8H6PYVQCKJZB8MS4&source=weebcentral |
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
| Tout | `button` | AGIT (focus déplacé) |
| En cours | `button` | AGIT (page modifiée) |
| Terminés | `button` | **INERTE** |
| Pause | `button` | **INERTE** |
| Shōnen | `button` | **INERTE** |
| Seinen | `button` | **INERTE** |
| Shōjo | `button` | **INERTE** |
| Josei | `button` | **INERTE** |
| Lecture aléatoire | `button#btnRandom` | AGIT (focus déplacé) |
| Voir la fiche | `a` | NAVIGUE → serie.html?id=01J76XY7VSG3R5ANYPDWTXDVP6 |
| Grille | `button` | AGIT (focus déplacé) |
| Liste | `button` | **INERTE** |
| Trier le catalogue | `select#sortSelect` | AGIT (focus déplacé) |
| Charger la suite | `button#catLoadMore` | DISPARU |
| ‹ | `button` | DISPARU |
| 1 | `button` | DISPARU |
| 2 | `button` | DISPARU |
| › | `button` | DISPARU |
| Voir toutes les collections → | `a` | NAVIGUE → collections.html |
| Catalogue | `a` | **INERTE** |
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
| Aller au contenu | `a` | AGIT (focus déplacé) |
| Inko | `a` | NAVIGUE → accueil.html |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (focus déplacé) |
| Reprendre ma dernière lecture | `button#btnContinue` | NAVIGUE → chapitre.html?manga=01J76XY8NHVJYQJ3VJB51PAQ7B&chapter=01J76XYVXV8H6PYVQCKJZB8MS4&source=weebcentral |
| Actualiser mes séries (nouveaux chapitres) | `button#btnRefresh` | AGIT (page modifiée) |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | AGIT (page modifiée) |
| Notifications | `button#btnNotif` | AGIT (page modifiée) |
| Paramètres | `a` | NAVIGUE → parametres.html |
| Kaito | `a` | NAVIGUE → profil.html |
| Rechercher | `button#seGo` | AGIT (focus déplacé) |
| tout effacer | `button#seHistClear` | ÉVITÉ (destructif) |
| Frieren - Beyond Journey's End | `a` | NAVIGUE → serie.html?id=01J76XYDGDQERFSK333582BNBZ&source=weebcentral |
| Tyranny | `a` | NAVIGUE → serie.html?id=3846f669-4277-43ca-ada8-0c57961f5f1f&source=mangadex |
| Kekkai no Noah | `a` | DISPARU |
| Moby Dick; Or, The Whale | `a` | DISPARU |
| My Isekai Life - I Gained a Second Character C | `a` | DISPARU |
| Finding the Invisible Star | `a` | DISPARU |
| The Oracles of Kami | `a` | DISPARU |
| The book review digest, volume 05, 1909 | `a` | DISPARU |
| Imouto wa Kanojo ni Deki Nai no ni | `a` | DISPARU |
| Egao no Taenai Shokuba desu. | `a` | DISPARU |
| Death Note (Color) | `a` | DISPARU |
| Madoromi Barmaid | `a` | DISPARU |
| One Piece | `a` | DISPARU |
| Blue Lock | `a` | DISPARU |
| Bleach (Color) | `a` | DISPARU |
| Hunter x Hunter | `a` | DISPARU |
| Kingdom | `a` | DISPARU |
| Chained Soldier | `a` | DISPARU |
| One-Punch Man | `a` | DISPARU |
| The Exiled Heavy Knight Knows How to Game the  | `a` | DISPARU |
| Bleach | `a` | DISPARU |
| Kagurabachi | `a` | DISPARU |
| Jujutsu Kaisen | `a` | DISPARU |
| One Piece (Color) | `a` | DISPARU |
| The Mortifying Ordeal of Being Seen | `a` | DISPARU |
| Berserk | `a` | DISPARU |
| Gachiakuta | `a` | DISPARU |
| Welcome to Demon School! Iruma-kun | `a` | DISPARU |
| Chainsaw Man | `a` | DISPARU |
| The Fragrant Flower Blooms With Dignity | `a` | DISPARU |
| Catalogue | `a` | ERREUR : page.evaluate: Execution context was destroyed, most likely  |
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

> État : **connecté**
> Les verdicts qui suivent se lisent dans CET état.

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | AGIT (focus déplacé) |
| Inko | `a` | ERREUR : page.evaluate: Execution context was destroyed, most likely  |
| Mode incognito (lecture privée) | `button#btnIncognito` | DISPARU |
| Reprendre ma dernière lecture | `button#btnContinue` | DISPARU |
| Actualiser mes séries (nouveaux chapitres) | `button#btnRefresh` | DISPARU |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | DISPARU |
| Notifications | `button#btnNotif` | DISPARU |
| Paramètres | `a` | DISPARU |
| Kaito | `a` | DISPARU |
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
| 57 Death Note (Color) Chap. 22 | `a` | DISPARU |
| 98 Witch Hat Atelier Chap. 96 | `a` | DISPARU |
| 1191 One Piece Chap. 1190 | `a` | DISPARU |
| 154 The Heroic Legend of Arslan Chap. 153 | `a` | DISPARU |
| 245 Dandadan Chap. 241 | `a` | DISPARU |
| 36 Boruto: Two Blue Vortex Chap. 36 | `a` | DISPARU |
| 368 Kengan Omega Chap. 363 | `a` | DISPARU |
| 233 Zipang Chap. 229 | `a` | DISPARU |
| 200 The Fragrant Flower Blooms With Dignity Ch | `a` | DISPARU |
| 251 The Seven Deadly Sins - Four Knights of th | `a` | DISPARU |
| 274 Sakamoto Days Chap. 269 | `a` | DISPARU |
| 101 Centuria Chap. 98 | `a` | DISPARU |
| Tout375 | `button` | DISPARU |
| Mangas360 | `button` | DISPARU |
| Romans15 | `button` | DISPARU |
| En cours2 | `button` | DISPARU |
| Terminé1 | `button` | DISPARU |
| À lire1 | `button` | DISPARU |
| En pause1 | `button` | DISPARU |
| Toutes sources | `button` | DISPARU |
| chireads9 | `button` | DISPARU |
| gutenberg2 | `button` | DISPARU |
| mangadex21 | `button` | DISPARU |
| novelbin1 | `button` | DISPARU |
| novelfull3 | `button` | DISPARU |
| sushiscan83 | `button` | DISPARU |
| weebcentral256 | `button` | DISPARU |
| N'afficher que les séries avec des chapitres n | `button#chipUnread` | DISPARU |
| 7 ✕ Imouto wa Kanojo ni Deki Nai no ni Pas com | `a` | DISPARU |
| Épingler | `button` | DISPARU |
| 147 ✕ Frieren - Beyond Journey's End Pas comme | `a` | DISPARU |
| 12 ✕ Tyranny Pas commencé · mangadex | `a` | DISPARU |
| 25 ✕ Kekkai no Noah Pas commencé · mangadex | `a` | DISPARU |
| ROMAN ✕ Moby Dick; Or, The Whale Chap. 1 · gut | `a` | DISPARU |
| 99 ✕ My Isekai Life - I Gained a Second Charac | `a` | DISPARU |
| 4 ✕ Finding the Invisible Star Pas commencé ·  | `a` | DISPARU |
| 13 ✕ The Oracles of Kami Pas commencé · weebce | `a` | DISPARU |
| ROMAN 1 ✕ The book review digest, volume 05, 1 | `a` | DISPARU |
| 32 ✕ Egao no Taenai Shokuba desu. Chap. 1 · ma | `a` | DISPARU |
| 57 ✕ Death Note (Color) Chap. 22 · weebcentral | `a` | DISPARU |
| 37 ✕ Madoromi Barmaid Pas commencé · mangadex | `a` | DISPARU |
| 12 ✕ Shoujouhime Pas commencé · mangadex | `a` | DISPARU |
| 281 ✕ Yu☆Gi☆Oh! (Official Colored) Pas commenc | `a` | DISPARU |
| 240 ✕ Shadows House (Official Colored) Pas com | `a` | DISPARU |
| 126 ✕ Golden Kamuy (Official Colored) Pas comm | `a` | DISPARU |
| 158 ✕ Kimagure Orange Road (Official Colored)  | `a` | DISPARU |
| 47 ✕ The Darwin Incident Pas commencé · weebce | `a` | DISPARU |
| 16 ✕ The Spellbook Library Pas commencé · weeb | `a` | DISPARU |
| 400 ✕ Hunter x Hunter (Official Colored) Pas c | `a` | DISPARU |
| 25 ✕ Kurumizawa's Folly Pas commencé · weebcen | `a` | DISPARU |
| 17 ✕ Majo to Kyurasu Pas commencé · weebcentra | `a` | DISPARU |
| 67 ✕ Kurozakuro Pas commencé · mangadex | `a` | DISPARU |
| 13 ✕ Division Chief Kosaku Shima Pas commencé  | `a` | DISPARU |
| 25 ✕ The Blue Eye of Horus Pas commencé · weeb | `a` | DISPARU |
| 10 ✕ Stitches Pas commencé · weebcentral | `a` | DISPARU |
| 37 ✕ No. 5 Pas commencé · weebcentral | `a` | DISPARU |
| 20 ✕ Jin Pas commencé · weebcentral | `a` | DISPARU |
| 72 ✕ Dangu Pas commencé · weebcentral | `a` | DISPARU |
| 72 ✕ Libidors Pas commencé · weebcentral | `a` | DISPARU |
| 64 ✕ Drowning Love Pas commencé · weebcentral | `a` | DISPARU |
| 97 ✕ Radiation House Pas commencé · weebcentra | `a` | DISPARU |
| 15 ✕ Knights of Sidonia Pas commencé · weebcen | `a` | DISPARU |
| 70 ✕ Issak Pas commencé · weebcentral | `a` | DISPARU |
| 87 ✕ To the Abandoned Sacred Beasts Pas commen | `a` | DISPARU |
| 201 ✕ Manchuria Opium Squad Pas commencé · wee | `a` | DISPARU |
| 48 ✕ Paradise Kiss Pas commencé · weebcentral | `a` | DISPARU |
| 85 ✕ Drifters Pas commencé · weebcentral | `a` | DISPARU |
| 142 ✕ Lone Wolf and Cub Pas commencé · weebcen | `a` | DISPARU |
| 157 ✕ Batuque Pas commencé · weebcentral | `a` | DISPARU |
| 65 ✕ Dai Dark Pas commencé · weebcentral | `a` | DISPARU |
| 100 ✕ Dead Dead Demon’s Dededede Destruction P | `a` | DISPARU |
| 56 ✕ We Shall Now Begin Ethics Pas commencé ·  | `a` | DISPARU |
| 9 ✕ Mujina in to the Deep Pas commencé · weebc | `a` | DISPARU |
| 124 ✕ Yaiba - Samurai Legend Pas commencé · we | `a` | DISPARU |
| 87 ✕ Kowloon Generic Romance Pas commencé · we | `a` | DISPARU |
| 82 ✕ Gunka no Baltzar Pas commencé · weebcentr | `a` | DISPARU |
| 142 ✕ Sanda Pas commencé · weebcentral | `a` | DISPARU |
| 40 ✕ Welcome to the N.H.K. Pas commencé · weeb | `a` | DISPARU |
| 115 ✕ Blades of the Guardians Pas commencé · w | `a` | DISPARU |
| 28 ✕ Under Doctor Pas commencé · weebcentral | `a` | DISPARU |
| 126 ✕ Eden - It's an Endless World! Pas commen | `a` | DISPARU |
| 48 ✕ The Isekai Doctor - Any Sufficiently Adva | `a` | DISPARU |
| 329 ✕ Flame of Recca Pas commencé · weebcentra | `a` | DISPARU |
| 15 ✕ LOVE-BULLET Pas commencé · weebcentral | `a` | DISPARU |
| ✕ Angel Densetsu Pas commencé · weebcentral | `a` | DISPARU |
| 88 ✕ Gleipnir Pas commencé · weebcentral | `a` | DISPARU |
| 85 ✕ Princess Jellyfish Pas commencé · weebcen | `a` | DISPARU |
| 59 ✕ Snowball Earth Pas commencé · weebcentral | `a` | DISPARU |
| 338 ✕ H2 Pas commencé · weebcentral | `a` | DISPARU |
| 15 ✕ Dig It Pas commencé · weebcentral | `a` | DISPARU |
| 38 ✕ Cosmos Pas commencé · weebcentral | `a` | DISPARU |
| 25 ✕ Akuyaku Kizoku to shite Hitsuyou na Sore  | `a` | DISPARU |
| 124 ✕ Historie Pas commencé · weebcentral | `a` | DISPARU |
| 90 ✕ Hirayasumi Pas commencé · weebcentral | `a` | DISPARU |
| 345 ✕ Kekkaishi Pas commencé · weebcentral | `a` | DISPARU |
| 109 ✕ Noragami - Stray God Pas commencé · weeb | `a` | DISPARU |
| 79 ✕ Skip and Loafer Pas commencé · weebcentra | `a` | DISPARU |
| 68 ✕ Hero Organization Chap. 66 · weebcentral | `a` | DISPARU |
| 160 ✕ Nue's Exorcist Pas commencé · weebcentra | `a` | DISPARU |
| 242 ✕ Battle in 5 Seconds After Meeting Pas co | `a` | DISPARU |
| 122 ✕ The Quintessential Quintuplets (Color) P | `a` | DISPARU |
| 90 ✕ Zom 100 - Bucket List of the Dead Pas com | `a` | DISPARU |
| 376 ✕ Days Pas commencé · weebcentral | `a` | DISPARU |
| 8 ✕ The Journey of a Dark Elf with Fading Powe | `a` | DISPARU |
| 21 ✕ Nana Pas commencé · weebcentral | `a` | DISPARU |
| 122 ✕ Black Lagoon Pas commencé · weebcentral | `a` | DISPARU |
| 73 ✕ Smile! Pas commencé · weebcentral | `a` | DISPARU |
| 233 ✕ Tsubasa - RESERVoir CHRoNiCLE Pas commen | `a` | DISPARU |
| 192 ✕ UQ Holder! Pas commencé · weebcentral | `a` | DISPARU |
| 86 ✕ The Fable - The Second Contact Pas commen | `a` | DISPARU |
| 226 ✕ Zetman Pas commencé · weebcentral | `a` | DISPARU |
| 83 ✕ Dark Gathering Pas commencé · weebcentral | `a` | DISPARU |
| 30 ✕ The Strange House Pas commencé · weebcent | `a` | DISPARU |
| 30 ✕ Tower Dungeon Chap. 29 · weebcentral | `a` | DISPARU |
| 51 ✕ Ruri Dragon Pas commencé · weebcentral | `a` | DISPARU |
| 407 ✕ Ranma 1/2 Pas commencé · weebcentral | `a` | DISPARU |
| 558 ✕ Inuyasha Pas commencé · weebcentral | `a` | DISPARU |
| 97 ✕ Chainsaw Man (Color) Pas commencé · weebc | `a` | DISPARU |
| 45 ✕ The Bugle Call - Song of War Pas commencé | `a` | DISPARU |
| 263 ✕ World Trigger Pas commencé · weebcentral | `a` | DISPARU |
| 163 ✕ Jagaaaaaan Pas commencé · weebcentral | `a` | DISPARU |
| 228 ✕ Black Butler Pas commencé · weebcentral | `a` | DISPARU |
| 155 ✕ Claymore Pas commencé · weebcentral | `a` | DISPARU |
| 35 ✕ A Thousand Petals Pas commencé · weebcent | `a` | DISPARU |
| 6 ✕ Dragon Circus Pas commencé · weebcentral | `a` | DISPARU |
| 124 ✕ Record of Ragnarok Pas commencé · weebce | `a` | DISPARU |
| 7 ✕ AGERECO! Getting Into the Voice Acting Spi | `a` | DISPARU |
| 5 ✕ To Dusk and Twilight Pas commencé · weebce | `a` | DISPARU |
| 95 ✕ Ghost Fixers Pas commencé · weebcentral | `a` | DISPARU |
| ✕ Usagi Drop Pas commencé · weebcentral | `a` | DISPARU |
| 16 ✕ The Chrysalis Heart Pas commencé · weebce | `a` | DISPARU |
| 40 ✕ Haimiya Is Scary Cute Pas commencé · weeb | `a` | DISPARU |
| 250 ✕ Blue Box Pas commencé · weebcentral | `a` | DISPARU |
| 327 ✕ Vagabond Pas commencé · weebcentral | `a` | DISPARU |
| 1076 ✕ One Piece (Color) Pas commencé · weebce | `a` | DISPARU |
| 237 ✕ One-Punch Man Pas commencé · weebcentral | `a` | DISPARU |
| 98 ✕ Witch Hat Atelier Chap. 96 · weebcentral | `a` | DISPARU |
| 277 ✕ Shangri-La Frontier Pas commencé · weebc | `a` | DISPARU |
| 138 ✕ Kindergarten WARS Pas commencé · weebcen | `a` | DISPARU |
| 192 ✕ Oblivion Battery Pas commencé · weebcent | `a` | DISPARU |
| 38 ✕ WITCHRIV Pas commencé · weebcentral | `a` | DISPARU |
| 92 ✕ Catenaccio Pas commencé · weebcentral | `a` | DISPARU |
| 77 ✕ Parashoppers Pas commencé · weebcentral | `a` | DISPARU |
| 334 ✕ Mao Pas commencé · weebcentral | `a` | DISPARU |
| 61 ✕ I Was Summoned to Be a Saint, but Was Rob | `a` | DISPARU |
| 9 ✕ It's Not Easy Being Cute Pas commencé · we | `a` | DISPARU |
| 40 ✕ Porter of Heroes Pas commencé · weebcentr | `a` | DISPARU |
| 57 ✕ Gangsta. Pas commencé · weebcentral | `a` | DISPARU |
| 1 ✕ Un zoo en hiver Pas commencé · sushiscan | `a` | DISPARU |
| 6 ✕ Say Hello to Black Jack Pas commencé · sus | `a` | DISPARU |
| 3 ✕ Sanda Pas commencé · sushiscan | `a` | DISPARU |
| 17 ✕ Sounds of Life Pas commencé · sushiscan | `a` | DISPARU |
| 25 ✕ Nura – Le seigneur des Yôkai Pas commencé | `a` | DISPARU |
| 23 ✕ Bug Ego Pas commencé · weebcentral | `a` | DISPARU |
| 308 ✕ Ace of the Diamond: Act II Pas commencé  | `a` | DISPARU |
| 365 ✕ TSUYOSHI Pas commencé · weebcentral | `a` | DISPARU |
| 221 ✕ Go! Go! Loser Ranger! Pas commencé · wee | `a` | DISPARU |
| 120 ✕ Fool Night Pas commencé · weebcentral | `a` | DISPARU |
| 13 ✕ Gambling Apocalypes Kaiji Pas commencé ·  | `a` | DISPARU |
| 255 ✕ Tobaku Datenroku Kaiji - One Poker Hen P | `a` | DISPARU |
| 461 ✕ Tobaku Datenroku Kaiji - 24oku Dasshutsu | `a` | DISPARU |
| 97 ✕ Tobaku Datenroku Kaiji - Kazuya Hen Pas c | `a` | DISPARU |
| 134 ✕ Tobaku Hakairoku Kaiji Pas commencé · we | `a` | DISPARU |
| 306 ✕ Akagi Pas commencé · weebcentral | `a` | DISPARU |
| 310 ✕ Nobunaga no Chef Pas commencé · weebcent | `a` | DISPARU |
| 273 ✕ Hyouge Mono Pas commencé · weebcentral | `a` | DISPARU |
| 883 ✕ Kingdom Pas commencé · sushiscan | `a` | DISPARU |
| ✕ Dimension W Pas commencé · weebcentral | `a` | DISPARU |
| 95 ✕ JoJo no Kimyou na Bouken: Part 7 - Steel  | `a` | DISPARU |
| 164 ✕ Ten - The Nice Guy on the Path of Tenho  | `a` | DISPARU |
| 90 ✕ Golden Man Pas commencé · weebcentral | `a` | DISPARU |
| 4 ✕ Neon Genesis Evangelion (Official Colored) | `a` | DISPARU |
| 68 ✕ The Case Study of Vanitas Pas commencé ·  | `a` | DISPARU |
| 109 ✕ A Bride's Story Pas commencé · weebcentr | `a` | DISPARU |
| ✕ Zatch Bell! Pas commencé · weebcentral | `a` | DISPARU |
| 120 ✕ Drifting Dragons Pas commencé · weebcent | `a` | DISPARU |
| 74 ✕ Made in Abyss Pas commencé · weebcentral | `a` | DISPARU |
| ROMAN 29 ✕ Jobless Reincarnation - Mushoku Ten | `a` | DISPARU |
| 1 ✕ Les Enfants de l’Empire Pas commencé · sus | `a` | DISPARU |
| 1 ✕ Japanese Zero Fighter Pas commencé · sushi | `a` | DISPARU |
| 6 ✕ Seven Shakespeares Pas commencé · sushisca | `a` | DISPARU |
| 2 ✕ Le Siège des exilées Pas commencé · sushis | `a` | DISPARU |
| 3 ✕ Redrum 327 Pas commencé · sushiscan | `a` | DISPARU |
| 233 ✕ Zipang Chap. 229 · mangadex | `a` | DISPARU |
| 4 ✕ Hitomoji – Stress Mortel Pas commencé · su | `a` | DISPARU |
| 6 ✕ Phénix, l’oiseau de feu Pas commencé · sus | `a` | DISPARU |
| 19 ✕ Le Pavillon des hommes Pas commencé · sus | `a` | DISPARU |
| 7 ✕ Dans le sens du vent – Nord, Nord-Ouest Pa | `a` | DISPARU |
| 10 ✕ Saturn Return Pas commencé · sushiscan | `a` | DISPARU |
| 1 ✕ Rash !! – Perfect édition Pas commencé · s | `a` | DISPARU |
| 17 ✕ March comes in like a lion Pas commencé · | `a` | DISPARU |
| 11 ✕ Land Pas commencé · sushiscan | `a` | DISPARU |
| 13 ✕ Yawara! Pas commencé · sushiscan | `a` | DISPARU |
| 10 ✕ Hellsing Pas commencé · sushiscan | `a` | DISPARU |
| 35 ✕ Nippon Sangoku Pas commencé · mangadex | `a` | DISPARU |
| 169 ✕ Blue Exorcist Pas commencé · weebcentral | `a` | DISPARU |
| 259 ✕ Mission: Yozakura Family Pas commencé ·  | `a` | DISPARU |
| 153 ✕ Blood on the Tracks Pas commencé · weebc | `a` | DISPARU |
| 77 ✕ Veil Pas commencé · weebcentral | `a` | DISPARU |
| 38 ✕ Gokurakugai Pas commencé · weebcentral | `a` | DISPARU |
| 86 ✕ The Apothecary Diaries Pas commencé · wee | `a` | DISPARU |
| 52 ✕ Rai Rai Rai Pas commencé · weebcentral | `a` | DISPARU |
| 200 ✕ The Fragrant Flower Blooms With Dignity  | `a` | DISPARU |
| 53 ✕ Saigo ni Hitotsu Dake Onegai Shite mo Yor | `a` | DISPARU |
| 92 ✕ Flying Witch Pas commencé · mangadex | `a` | DISPARU |
| 28 ✕ JoJo no Kimyou na Bouken Dai-9-bu: The JO | `a` | DISPARU |
| 686 ✕ Bleach (Official Colored) Pas commencé · | `a` | DISPARU |
| 110 ✕ JoJo no Kimyou na Bouken: Part 8 - JoJol | `a` | DISPARU |
| 583 ✕ History's Strongest Disciple Kenichi Pas | `a` | DISPARU |
| 1515 ✕ Hajime no Ippo Pas commencé · weebcentr | `a` | DISPARU |
| 88 ✕ KAIJIN FUGEKI: Kindled Spirits Pas commen | `a` | DISPARU |
| 8 ✕ Takemitsu Zamurai Pas commencé · weebcentr | `a` | DISPARU |
| 114 ✕ Yawara! Pas commencé · weebcentral | `a` | DISPARU |
| 45 ✕ The World's Strongest Butler Pas commencé | `a` | DISPARU |
| 91 ✕ Yongbi the Invincible - A Side Story Pas  | `a` | DISPARU |
| 103 ✕ Crying Freeman Pas commencé · weebcentra | `a` | DISPARU |
| 84 ✕ Shigurui Pas commencé · weebcentral | `a` | DISPARU |
| 266 ✕ Sidooh Pas commencé · weebcentral | `a` | DISPARU |
| ✕ Yowamushi Pedal Pas commencé · weebcentral | `a` | DISPARU |
| 720 ✕ Initial D Pas commencé · weebcentral | `a` | DISPARU |
| 113 ✕ Captain Tsubasa Pas commencé · weebcentr | `a` | DISPARU |
| 72 ✕ Welcome to the Ballroom Pas commencé · we | `a` | DISPARU |
| ✕ Rookies Pas commencé · weebcentral | `a` | DISPARU |
| 248 ✕ Chihayafuru Pas commencé · weebcentral | `a` | DISPARU |
| 39 ✕ Yakuza Fiancé - Raise wa Tanin ga Ii Pas  | `a` | DISPARU |
| 201 ✕ Liar Game Pas commencé · weebcentral | `a` | DISPARU |
| 131 ✕ Tobaku Datenroku Kaiji Pas commencé · we | `a` | DISPARU |
| 154 ✕ Back When You Called Us Devils Pas comme | `a` | DISPARU |
| 82 ✕ Freesia Pas commencé · weebcentral | `a` | DISPARU |
| 89 ✕ Blue Period Pas commencé · weebcentral | `a` | DISPARU |
| 119 ✕ Battle Royale Pas commencé · weebcentral | `a` | DISPARU |
| 60 ✕ Firefly Wedding Pas commencé · weebcentra | `a` | DISPARU |
| 84 ✕ After God Pas commencé · weebcentral | `a` | DISPARU |
| 63 ✕ War of the Adults Pas commencé · weebcent | `a` | DISPARU |
| 104 ✕ Pandora Hearts Pas commencé · weebcentra | `a` | DISPARU |
| 42 ✕ The Drifting Classroom Perfect Edition Pa | `a` | DISPARU |
| 22 ✕ Umineko When They Cry -Episode 1- Legend  | `a` | DISPARU |
| ✕ Psyren Pas commencé · weebcentral | `a` | DISPARU |
| 93 ✕ Moriarty the Patriot Pas commencé · weebc | `a` | DISPARU |
| 51 ✕ Seraph of the End - Guren Ichinose - Cata | `a` | DISPARU |
| 74 ✕ The Shadows of Who We Once Were Pas comme | `a` | DISPARU |
| 97 ✕ Angel Voice (KOYANO Takao) Pas commencé · | `a` | DISPARU |
| 205 ✕ King Golf Pas commencé · weebcentral | `a` | DISPARU |
| 245 ✕ Ahiru no Sora Pas commencé · weebcentral | `a` | DISPARU |
| 160 ✕ Cross Game Pas commencé · weebcentral | `a` | DISPARU |
| 190 ✕ Hikaru no Go Pas commencé · weebcentral | `a` | DISPARU |
| 3 ✕ Ultra Heaven Pas commencé · weebcentral | `a` | DISPARU |
| 11 ✕ Bokurano Ours Pas commencé · weebcentral | `a` | DISPARU |
| 63 ✕ #DRCL midnight children Pas commencé · we | `a` | DISPARU |
| 85 ✕ Heavenly Delusion Pas commencé · weebcent | `a` | DISPARU |
| 39 ✕ JoJo's Bizarre Adventure - Part 9 - The J | `a` | DISPARU |
| 330 ✕ Higanjima Pas commencé · weebcentral | `a` | DISPARU |
| 153 ✕ Ultraman Pas commencé · weebcentral | `a` | DISPARU |
| 18 ✕ Haunted Peak Pas commencé · weebcentral | `a` | DISPARU |
| 129 ✕ Bungo Stray Dogs Pas commencé · weebcent | `a` | DISPARU |
| 83 ✕ Steel of the Celestial Shadows Pas commen | `a` | DISPARU |
| 21 ✕ Dandadan Pas commencé · sushiscan | `a` | DISPARU |
| 75 ✕ Dogsred Pas commencé · weebcentral | `a` | DISPARU |
| 222 ✕ March Comes in Like a Lion Pas commencé  | `a` | DISPARU |
| 557 ✕ Giant Killing Pas commencé · weebcentral | `a` | DISPARU |
| 329 ✕ F Pas commencé · weebcentral | `a` | DISPARU |
| 102 ✕ Beck - Mongolian Chop Squad Pas commencé | `a` | DISPARU |
| 21 ✕ A Witch's Life in Mongol Pas commencé · w | `a` | DISPARU |
| 6 ✕ Akira Pas commencé · weebcentral | `a` | DISPARU |
| 136 ✕ Tenjo Tenge Pas commencé · weebcentral | `a` | DISPARU |
| 43 ✕ Himizu Pas commencé · weebcentral | `a` | DISPARU |
| 254 ✕ Happy! Pas commencé · weebcentral | `a` | DISPARU |
| 96 ✕ Akira Failing in Love Chap. 92 · weebcent | `a` | DISPARU |
| 1166 ✕ Case Closed Pas commencé · weebcentral | `a` | DISPARU |
| 451 ✕ Sleepy Princess in the Demon Castle Pas  | `a` | DISPARU |
| 121 ✕ Mushoku Tensei - Jobless Reincarnation P | `a` | DISPARU |
| 24 ✕ JoJo’s Bizarre Adventure : Steel Ball Run | `a` | DISPARU |
| 24 ✕ Dragon no I de Oyasumi Pas commencé · wee | `a` | DISPARU |
| 368 ✕ Kengan Omega Chap. 363 · weebcentral | `a` | DISPARU |
| 237 ✕ Kengan Ashura Pas commencé · weebcentral | `a` | DISPARU |
| 48 ✕ Initial D Pas commencé · sushiscan | `a` | DISPARU |
| 13 ✕ Black Lagoon Pas commencé · sushiscan | `a` | DISPARU |
| 39 ✕ Get Backers Pas commencé · sushiscan | `a` | DISPARU |
| 4 ✕ Gokurakugai Pas commencé · sushiscan | `a` | DISPARU |
| 49 ✕ Dream Team Pas commencé · sushiscan | `a` | DISPARU |
| 25 ✕ Chiruran Pas commencé · sushiscan | `a` | DISPARU |
| 25 ✕ Sidooh Pas commencé · sushiscan | `a` | DISPARU |
| 17 ✕ Ascension Pas commencé · sushiscan | `a` | DISPARU |
| 27 ✕ JoJo’s Bizarre Adventure : JoJolion Pas c | `a` | DISPARU |
| 9 ✕ Bride Stories Pas commencé · sushiscan | `a` | DISPARU |
| 24 ✕ Pandora Hearts Pas commencé · sushiscan | `a` | DISPARU |
| 24 ✕ World Trigger Pas commencé · sushiscan | `a` | DISPARU |
| 10 ✕ Ichi The Killer Pas commencé · sushiscan | `a` | DISPARU |
| 5 ✕ Les Noces des Lucioles Pas commencé · sush | `a` | DISPARU |
| 19 ✕ Radiant Pas commencé · sushiscan | `a` | DISPARU |
| 8 ✕ Wistoria: Wand and Sword Pas commencé · su | `a` | DISPARU |
| 26 ✕ Mission: Yozakura Family Pas commencé · s | `a` | DISPARU |
| 105 ✕ Détective Conan Pas commencé · sushiscan | `a` | DISPARU |
| 45 ✕ Yona, princesse de l’aube Pas commencé ·  | `a` | DISPARU |
| 63 ✕ Fairy Tail Pas commencé · sushiscan | `a` | DISPARU |
| 69 ✕ Ichi the Witch Pas commencé · sushiscan | `a` | DISPARU |
| ROMAN 1181 ✕ Lord of Mysteries 2: Circle of In | `a` | DISPARU |
| ROMAN 1432 ✕ Lord of the Mysteries Pas commenc | `a` | DISPARU |
| 201 ✕ To Your Eternity Pas commencé · weebcent | `a` | DISPARU |
| 2 ✕ Centuria Pas commencé · sushiscan | `a` | DISPARU |
| 72 ✕ Ginga Eiyuu Densetsu (FUJISAKI Ryuu) Pas  | `a` | DISPARU |
| 425 ✕ Karakuri Circus Pas commencé · weebcentr | `a` | DISPARU |
| 20 ✕ Bakuman. Pas commencé · sushiscan | `a` | DISPARU |
| 37 ✕ Eyeshield 21 Pas commencé · sushiscan | `a` | DISPARU |
| 154 ✕ The Heroic Legend of Arslan Chap. 153 ·  | `a` | DISPARU |
| 153 ✕ Les Liens du sang [Version Scantrad] Pas | `a` | DISPARU |
| 166 ✕ Oshi no Ko Pas commencé · sushiscan | `a` | DISPARU |
| 22 ✕ The Fable Pas commencé · sushiscan | `a` | DISPARU |
| 18 ✕ Four Knights of the Apocalypse Pas commen | `a` | DISPARU |
| 30 ✕ Boruto: Two Blue Vortex Pas commencé · su | `a` | DISPARU |
| 15 ✕ Les Carnets de l’Apothicaire Pas commencé | `a` | DISPARU |
| 275 ✕ Slam Dunk Pas commencé · sushiscan | `a` | DISPARU |
| 125 ✕ Kagurabachi Pas commencé · sushiscan | `a` | DISPARU |
| 268 ✕ Sakamoto Days Pas commencé · sushiscan | `a` | DISPARU |
| 165 ✕ Gachiakuta Pas commencé · sushiscan | `a` | DISPARU |
| ROMAN 230 ✕ Le Système Technologique d’un Etud | `a` | DISPARU |
| ROMAN 740 ✕ Laissez-moi Jouer en Paix｜Let me g | `a` | DISPARU |
| ROMAN 916 ✕ Le Quotidien d'un Prodige Immortel | `a` | DISPARU |
| ROMAN 780 ✕ Crazy Detective｜狂探 Pas commencé ·  | `a` | DISPARU |
| ROMAN 50 ✕ Le Faucheur de la lune \| Reaper of  | `a` | DISPARU |
| ROMAN 10 ✕ Infinite Bloodcore \| 无限血核 Pas comme | `a` | DISPARU |
| ROMAN 3178 ✕ Shadow Slave Pas commencé · novel | `a` | DISPARU |
| ROMAN 102 ✕ Voyageurs du lointain \| 天涯客 Pas co | `a` | DISPARU |
| ROMAN 272 ✕ L’Avènement des trois calamités \|  | `a` | DISPARU |
| 8 ✕ Dai Dark Pas commencé · sushiscan | `a` | DISPARU |
| 14 ✕ L’Atelier des Sorciers Pas commencé · sus | `a` | DISPARU |
| 241 ✕ Dandadan [Scantrad] Pas commencé · sushi | `a` | DISPARU |
| 16 ✕ Blue Period Pas commencé · sushiscan | `a` | DISPARU |
| 8 ✕ The Bugle Call Pas commencé · sushiscan | `a` | DISPARU |
| 147 ✕ MPD-Psycho Pas commencé · weebcentral | `a` | DISPARU |
| 10 ✕ Le Bateau de Thésée Pas commencé · sushis | `a` | DISPARU |
| 68 ✕ Drama Queen Pas commencé · weebcentral | `a` | DISPARU |
| 62 ✕ Dragon and Chameleon Pas commencé · weebc | `a` | DISPARU |
| 214 ✕ Dance Dance Danseur Pas commencé · weebc | `a` | DISPARU |
| 258 ✕ Full Ahead Coco Pas commencé · weebcentr | `a` | DISPARU |
| 96 ✕ Shinobi Undercover Chap. 92 · weebcentral | `a` | DISPARU |
| 56 ✕ The Nito Exorcists Pas commencé · weebcen | `a` | DISPARU |
| 390 ✕ Hunter x Hunter (Color) Pas commencé · w | `a` | DISPARU |
| 30 ✕ L’habitant de l’infini Pas commencé · sus | `a` | DISPARU |
| 626 ✕ The Ravages of Time Chap. 1 · weebcentra | `a` | DISPARU |
| En cours 17 ✕ Ascension [Version officielle] P | `a` | DISPARU |
| En cours 40 ✕ Angel Voice Pas commencé · sushi | `a` | DISPARU |
| Terminé 9 ✕ Akane-Banashi Pas commencé · sushi | `a` | DISPARU |
| En pause 11 ✕ Les Mémoires de Vanitas Pas comm | `a` | DISPARU |
| À lire 256 ✕ D.Gray-man Pas commencé · sushisc | `a` | DISPARU |
| 357 ✕ Air Gear Pas commencé · weebcentral | `a` | DISPARU |
| 258 ✕ D.Gray-Man Pas commencé · weebcentral | `a` | DISPARU |
| 122 ✕ Sousei no Taiga Pas commencé · weebcentr | `a` | DISPARU |
| 133 ✕ How Do We Relationship Pas commencé · we | `a` | DISPARU |
| 432 ✕ Uchuu Kyoudai Pas commencé · weebcentral | `a` | DISPARU |
| 145 ✕ GOSU Pas commencé · weebcentral | `a` | DISPARU |
| 108 ✕ Land of the Lustrous Pas commencé · weeb | `a` | DISPARU |
| 314 ✕ Golden Kamuy Pas commencé · weebcentral | `a` | DISPARU |
| 36 ✕ Boruto: Two Blue Vortex Chap. 36 · weebce | `a` | DISPARU |
| 240 ✕ The Fable Pas commencé · weebcentral | `a` | DISPARU |
| 124 ✕ Make the Exorcist Fall in Love Pas comme | `a` | DISPARU |
| 25 ✕ Jujutsu Kaisen Modulo Pas commencé · weeb | `a` | DISPARU |
| 276 ✕ Yona of the Dawn Pas commencé · weebcent | `a` | DISPARU |
| 221 ✕ Akane-banashi Pas commencé · weebcentral | `a` | DISPARU |
| 47 ✕ The Summer Hikaru Died Pas commencé · wee | `a` | DISPARU |
| 539 ✕ Usogui Pas commencé · weebcentral | `a` | DISPARU |
| 170 ✕ The Climber Pas commencé · weebcentral | `a` | DISPARU |
| 251 ✕ The Seven Deadly Sins - Four Knights of  | `a` | DISPARU |
| 101 ✕ Centuria Chap. 98 · weebcentral | `a` | DISPARU |
| 179 ✕ Tokyo Ghoul:re Pas commencé · weebcentra | `a` | DISPARU |
| 383 ✕ Gantz Pas commencé · weebcentral | `a` | DISPARU |
| 178 ✕ Marriage Toxin Pas commencé · weebcentra | `a` | DISPARU |
| 97 ✕ Ichi the Witch Pas commencé · weebcentral | `a` | DISPARU |
| 245 ✕ Dandadan Chap. 241 · weebcentral | `a` | DISPARU |
| 420 ✕ Hunter x Hunter Pas commencé · weebcentr | `a` | DISPARU |
| 274 ✕ Sakamoto Days Chap. 269 · weebcentral | `a` | DISPARU |
| 686 ✕ Bleach (Color) Pas commencé · weebcentra | `a` | DISPARU |
| 131 ✕ Kagurabachi Pas commencé · weebcentral | `a` | DISPARU |
| 67 ✕ Wistoria - Wand and Sword Pas commencé ·  | `a` | DISPARU |
| 421 ✕ Rokudenashi Blues Pas commencé · weebcen | `a` | DISPARU |
| 1191 ✕ One Piece Chap. 1190 · weebcentral | `a` | DISPARU |
| 173 ✕ Gachiakuta Pas commencé · weebcentral | `a` | DISPARU |
| 76 ✕ Choujin X Pas commencé · weebcentral | `a` | DISPARU |
| 10 ✕ Kujô l’implacable Pas commencé · sushisca | `a` | DISPARU |
| 10 ✕ Dragon Head Pas commencé · weebcentral | `a` | DISPARU |
| 159 ✕ Seraph of the End - Vampire Reign Pas co | `a` | DISPARU |
| 220 ✕ Vinland Saga Pas commencé · sushiscan | `a` | DISPARU |
| 9 ✕ Monster – Edition Deluxe Pas commencé · su | `a` | DISPARU |
| 182 ✕ Magi - Sinbad no Bouken Pas commencé · w | `a` | DISPARU |
| 56 ✕ Daemons of the Shadow Realm Pas commencé  | `a` | DISPARU |
| 14 ✕ Gloutons & Dragons Pas commencé · sushisc | `a` | DISPARU |
| 8 ✕ Magus of the Library Pas commencé · sushis | `a` | DISPARU |
| 37 ✕ Magi – The Labyrinth of Magic Chap. 1 · s | `a` | DISPARU |
| 168 ✕ Dorohedoro Pas commencé · weebcentral | `a` | DISPARU |
| 163 ✕ The World Is Mine Pas commencé · weebcen | `a` | DISPARU |
| 240 ✕ Shadows House Pas commencé · weebcentral | `a` | DISPARU |
| 111 ✕ Kiichi VS Pas commencé · weebcentral | `a` | DISPARU |
| 3 ✕ Billy the Kid 21 Pas commencé · sushiscan | `a` | DISPARU |
| 97 ✕ Neon Genesis Evangelion Pas commencé · we | `a` | DISPARU |
| 15 ✕ MARS Pas commencé · weebcentral | `a` | DISPARU |
| 10 ✕ Banana Fish Chap. 10 · sushiscan | `a` | DISPARU |
| 46 ✕ Ushijima, l’usurier de l’ombre Pas commen | `a` | DISPARU |
| 10 ✕ Ikigami Pas commencé · sushiscan | `a` | DISPARU |
| 10 ✕ Fool Night Pas commencé · sushiscan | `a` | DISPARU |
| 13 ✕ Call of the Night Pas commencé · sushisca | `a` | DISPARU |
| 27 ✕ Claymore Pas commencé · sushiscan | `a` | DISPARU |
| 22 ✕ Terra Formars Pas commencé · sushiscan | `a` | DISPARU |
| ROMAN 116 ✕ Le conte du cultivateur regressé C | `a` | DISPARU |
| 355 ✕ Blue Lock Chap. 356 · weebcentral | `a` | DISPARU |
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


## `serie.html`

URL auditée : `/serie.html?id=01J76XY7E9FNDZ1DBBM6PBJPFK&source=weebcentral`

> État : **connecté**
> Les verdicts qui suivent se lisent dans CET état.

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | AGIT (focus déplacé) |
| Inko | `a` | NAVIGUE → accueil.html |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (focus déplacé) |
| Reprendre ma dernière lecture | `button#btnContinue` | NAVIGUE → chapitre.html?manga=01J76XY8NHVJYQJ3VJB51PAQ7B&chapter=01J76XYVXV8H6PYVQCKJZB8MS4&source=weebcentral |
| Actualiser mes séries (nouveaux chapitres) | `button#btnRefresh` | AGIT (page modifiée) |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | AGIT (page modifiée) |
| Notifications | `button#btnNotif` | AGIT (page modifiée) |
| Paramètres | `a` | NAVIGUE → parametres.html |
| Kaito | `a` | NAVIGUE → profil.html |
| Action | `a` | DISPARU |
| Adventure | `a` | DISPARU |
| Comedy | `a` | DISPARU |
| Drama | `a` | DISPARU |
| Reprendre Ch.1190 Reprendre où tu t'es arrêté· | `button#btnResume` | DISPARU |
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
| MangaDex | `a` | DISPARU |
| SushiScan | `a` | DISPARU |
| Du même auteur · ODA Eiichiro | `a` | DISPARU |
| Fantasy | `a` | DISPARU |
| Shounen | `a` | DISPARU |
| Catalogue | `a` | NAVIGUE → catalogue.html |
| Nouveautés | `a` | **INERTE** |
| Top | `a` | **INERTE** |
| Importer un fichier | `a` | **INERTE** |
| Téléchargements | `a` | **INERTE** |
| Code source | `a` | OUVRE UN ONGLET |
| Signaler un bug | `a` | OUVRE UN ONGLET |
| Versions | `a` | OUVRE UN ONGLET |
| Confidentialité | `a` | NAVIGUE → confidentialite.html |
| Licence | `a` | OUVRE UN ONGLET |
| FR | `button` | AGIT (page modifiée) |
| EN | `button` | AGIT (page modifiée) |
| Désactiver | `button` | AGIT (page modifiée) |
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
| Fermer l'astuce | `button` | DISPARU |


## `chapitre.html`

URL auditée : `/chapitre.html?manga=01J76XY7E9FNDZ1DBBM6PBJPFK&chapter=01M1PDC3T1X0C0X02YV7TNC0Q3&source=weebcentral`

> État : **connecté**
> Les verdicts qui suivent se lisent dans CET état.

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | AGIT (focus déplacé) |
| Inko | `a` | **INERTE** |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (page modifiée) |
| Reprendre ma dernière lecture | `button#btnContinue` | NAVIGUE → chapitre.html?manga=01J76XY8NHVJYQJ3VJB51PAQ7B&chapter=01J76XYVXV8H6PYVQCKJZB8MS4&source=weebcentral |
| Actualiser mes séries (nouveaux chapitres) | `button#btnRefresh` | AGIT (page modifiée) |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | AGIT (page modifiée) |
| Notifications | `button#btnNotif` | AGIT (page modifiée) |
| Paramètres | `a` | NAVIGUE → parametres.html |
| Kaito | `a` | NAVIGUE → profil.html |
| ← One Piece | `a` | DISPARU |
| ‹ | `button#btnPrevChap` | DISPARU |
| Chap. 1192Chap. 1191Chap. 1190Chap. 1189Chap.  | `select#chapSelect` | DISPARU |
| › | `button#btnNextChap` | DISPARU |
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
| Fermer l'astuce | `button` | DISPARU |


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
| Désactiver | `button` | AGIT (page modifiée) |


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
| 5 | `a` | AGIT (focus déplacé) |
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
| Top | `a` | AGIT (focus déplacé) |
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
| Lire chaque série du début à la fin | `button#jrRecit` | AGIT (focus déplacé) |
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
| Actualiser mes séries (nouveaux chapitres) | `button#btnRefresh` | **INERTE** |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | AGIT (page modifiée) |
| Notifications | `button#btnNotif` | AGIT (page modifiée) |
| Paramètres | `a` | NAVIGUE → parametres.html |
| Kaito | `a` | NAVIGUE → profil.html |
| Actualiser les notifications | `button#ntRefresh` | **INERTE** |
| Recevoir les notifications même Inko fermé | `button#ntEnablePush` | AGIT (focus déplacé) |
| Tout marquer lu | `button#ntMarkAll` | AGIT (focus déplacé) |
| Fréquence de vérification des nouveaux chapitr | `select#ntFreq` | AGIT (focus déplacé) |
| Toutes | `button` | AGIT (focus déplacé) |
| Non lues | `button` | AGIT (page modifiée) |
| Réponses | `button` | **INERTE** |
| Mentions | `button` | **INERTE** |
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
| 21 nouveaux chapitres A Witch's Life in Mongol | `a` | DISPARU |
| 81 nouveaux chapitres Rai Rai Rai · 81 chapitr | `a` | DISPARU |
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
| 75 nouveaux chapitres Parashoppers · 75 chapit | `a` | DISPARU |
| 23 nouveaux chapitres Bug Ego · 23 chapitres à | `a` | DISPARU |
| 87 nouveaux chapitres KAIJIN FUGEKI: Kindled S | `a` | DISPARU |
| 94 nouveaux chapitres Akira Failing in Love ·  | `a` | DISPARU |
| 65 nouveaux chapitres Drama Queen · 65 chapitr | `a` | DISPARU |
| 67 nouveaux chapitres Hero Organization · 67 c | `a` | DISPARU |
| 154 nouveaux chapitres The Heroic Legend of Ar | `a` | DISPARU |
| 3149 nouveaux chapitres Shadow Slave · 3149 ch | `a` | DISPARU |
| 245 nouveaux chapitres Dandadan · 245 chapitre | `a` | DISPARU |
| 28 nouveaux chapitres Egao no Taenai Shokuba d | `a` | DISPARU |
| 50 nouveaux chapitres Ruri Dragon · 50 chapitr | `a` | DISPARU |
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
| Actualiser mes séries (nouveaux chapitres) | `button#btnRefresh` | **INERTE** |
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
| ▶ | `a` | DISPARU |
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

**Ressources du paquet absentes (404) — toujours un défaut :**

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
| Nouveautés | `a` | AGIT (focus déplacé) |
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
| Viser 10/semaine | `button#goalSuggest` | AGIT (page modifiée) |
| Définir | `button#goalSave` | DISPARU |
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
| Actualiser mes séries (nouveaux chapitres) | `button#btnRefresh` | **INERTE** |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | AGIT (page modifiée) |
| Notifications | `button#btnNotif` | AGIT (page modifiée) |
| Paramètres | `a` | NAVIGUE → parametres.html |
| Kaito | `a` | NAVIGUE → profil.html |
| Chercher des mises à jour des extensions | `button#btnCheckExt` | **INERTE** |
| Activer | `button` | AGIT (défilement) |
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
| EN | `button` | AGIT (focus déplacé) |
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
| Reprendre ma dernière lecture | `button#btnContinue` | NAVIGUE → chapitre.html?manga=01J76XY7E9FNDZ1DBBM6PBJPFK&chapter=01M1PDC3T1X0C0X02YV7TNC0Q3&source=weebcentral |
| Actualiser mes séries (nouveaux chapitres) | `button#btnRefresh` | AGIT (page modifiée) |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | AGIT (page modifiée) |
| Notifications | `button#btnNotif` | AGIT (page modifiée) |
| Paramètres | `a` | NAVIGUE → parametres.html |
| Kaito | `a` | NAVIGUE → profil.html |
| Aller à l’accueil | `a` | NAVIGUE → accueil.html |
| Catalogue | `a` | NAVIGUE → catalogue.html |
| Nouveautés | `a` | AGIT (focus déplacé) |
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
| Bibliothèque | `a` | ERREUR : page.evaluate: Execution context was destroyed, most likely  |
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

