# Audit fonctionnel — chaque contrôle de chaque page

Relevé du 2026-09-08. Chaque bouton, lien et bascule
a été **actionné**, et l’état de la page comparé avant/après.

| Verdict | Sens |
|---|---|
| `NAVIGUE` | l’URL a changé — le contrôle fonctionne |
| `AGIT` | le DOM a changé — panneau ouvert, liste filtrée, bascule |
| `INERTE` | **rien n’a bougé** — à examiner |
| `ÉVITÉ` | libellé destructif : non actionné, par précaution |

> ⚠ `INERTE` est un constat, pas une condamnation : un bouton peut
> légitimement ne rien faire dans cet état (« Marquer lu » sans chapitre
> chargé). Sans hub ni réseau, tout ce qui dépend d’une source l’est aussi.

## Vue d’ensemble

| Page | Contrôles | Naviguent | Agissent | **Inertes** | Erreurs JS | 404 |
|---|---|---|---|---|---|---|
| accueil | 33 | 0 | 1 | **1** | 0 | 4 |
| catalogue | 39 | 2 | 8 | **11** | 0 | 8 |
| recherche | 37 | 13 | 5 | **4** | 0 | 8 |
| bibliotheque | 28 | 9 | 7 | **7** | 0 | 8 |
| serie | 25 | 13 | 6 | **4** | 0 | 8 |
| chapitre | 21 | 10 | 5 | **5** | 0 | 8 |
| lecture | 20 | 9 | 5 | **5** | 0 | 8 |
| collections | 25 | 6 | 9 | **10** | 0 | 8 |
| collection-detail | 25 | 12 | 6 | **6** | 0 | 8 |
| notes | 26 | 12 | 6 | **8** | 0 | 8 |
| notifications | 34 | 2 | 3 | **10** | 0 | 8 |
| downloads | 35 | 6 | 3 | **2** | 0 | 8 |
| import | 37 | 2 | 3 | **2** | 0 | 8 |
| localreader | 3 | 3 | 0 | **0** | 0 | 2 |
| parametres | 74 | 1 | 4 | **1** | 0 | 8 |
| profil | 47 | 9 | 3 | **4** | 0 | 8 |
| u | 35 | 10 | 6 | **7** | 0 | 8 |
| stats | 26 | 2 | 3 | **2** | 0 | 2 |
| sources | 40 | 16 | 7 | **5** | 0 | 8 |
| liste | 25 | 11 | 6 | **7** | 0 | 8 |
| anilist | 2 | 2 | 0 | **0** | 0 | 2 |
| confidentialite | 2 | 1 | 0 | **1** | 0 | 4 |
| offline | 0 | 0 | 0 | **0** | 0 | 1 |

**102 contrôles inertes** au total.

---

## Le détail, page par page

### `accueil.html`

URL auditée : `/accueil.html`

**Ressources absentes (404) :**

- `https://sushiscan.fr/genres/hentai/`
- `https://sushiscan.fr/genres/adulte/`
- `https://sushiscan.fr/genres/pornhwa/page/4/`
- `https://sushiscan.fr/genres/pornhwa/page/5/`

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | **INERTE** |
| Inko | `a` | AGIT (page modifiée) |
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
| Voir sur GitHub ★ | `a` | DISPARU |
| Catalogue | `a` | DISPARU |
| Nouveautés | `a` | DISPARU |
| Top | `a` | DISPARU |
| Importer un fichier | `a` | DISPARU |
| Téléchargements | `a` | DISPARU |
| Code source | `a` | DISPARU |
| Signaler un bug | `a` | DISPARU |
| Versions | `a` | DISPARU |
| Confidentialité | `a` | DISPARU |
| Licence | `a` | DISPARU |
| FR | `button` | DISPARU |
| EN | `button` | DISPARU |
| Accueil | `a` | DISPARU |
| Bibliothèque | `a` | DISPARU |
| Recherche | `a` | DISPARU |
| Profil | `a` | DISPARU |
| Plus de sections | `button#mnavMore` | DISPARU |


### `catalogue.html`

URL auditée : `/catalogue.html`

**Ressources absentes (404) :**

- `https://sushiscan.fr/genres/adulte/`
- `https://sushiscan.fr/genres/hentai/`
- `https://sushiscan.fr/genres/pornhwa/page/5/`
- `https://sushiscan.fr/genres/pornhwa/page/4/`
- `https://sushiscan.fr/genres/ecchi/page/4/`
- `https://sushiscan.fr/genres/ecchi/page/5/`
- `https://sushiscan.fr/genres/ecchi/page/3/`
- `https://sushiscan.fr/genres/erotique/page/8/`

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | **INERTE** |
| Inko | `a` | NAVIGUE → accueil.html |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (page modifiée) |
| Actualiser mes séries (nouveaux chapitres) | `button#btnRefresh` | AGIT (page modifiée) |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | AGIT (page modifiée) |
| Paramètres | `a` | NAVIGUE → parametres.html |
| Filtres | `button#btnFiltresFeuille` | AGIT (panneau) |
| Toutes les sources | `button` | AGIT (page modifiée) |
| MangaDex | `button` | DISPARU |
| Tout | `button` | **INERTE** |
| En cours | `button` | AGIT (page modifiée) |
| Terminés | `button` | **INERTE** |
| Pause | `button` | **INERTE** |
| Shōnen | `button` | **INERTE** |
| Seinen | `button` | **INERTE** |
| Shōjo | `button` | **INERTE** |
| Josei | `button` | **INERTE** |
| Lecture aléatoire | `button#btnRandom` | **INERTE** |
| Grille | `button` | AGIT (page modifiée) |
| Liste | `button` | **INERTE** |
| Trier le catalogue | `select#sortSelect` | **INERTE** |
| Réessayer | `button` | DISPARU |
| Catalogue | `a` | AGIT (page modifiée) |
| Nouveautés | `a` | DISPARU |
| Top | `a` | DISPARU |
| Importer un fichier | `a` | DISPARU |
| Téléchargements | `a` | DISPARU |
| Code source | `a` | DISPARU |
| Signaler un bug | `a` | DISPARU |
| Versions | `a` | DISPARU |
| Confidentialité | `a` | DISPARU |
| Licence | `a` | DISPARU |
| FR | `button` | DISPARU |
| EN | `button` | DISPARU |
| Accueil | `a` | DISPARU |
| Bibliothèque | `a` | DISPARU |
| Recherche | `a` | DISPARU |
| Profil | `a` | DISPARU |
| Plus de sections | `button#mnavMore` | DISPARU |


### `recherche.html`

URL auditée : `/recherche.html`

**Ressources absentes (404) :**

- `https://sushiscan.fr/genres/hentai/`
- `https://sushiscan.fr/genres/adulte/`
- `https://sushiscan.fr/genres/pornhwa/page/5/`
- `https://sushiscan.fr/genres/pornhwa/page/4/`
- `https://sushiscan.fr/genres/ecchi/page/3/`
- `https://sushiscan.fr/genres/ecchi/page/4/`
- `https://sushiscan.fr/genres/ecchi/page/5/`
- `https://sushiscan.fr/genres/smut/page/7/`

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | **INERTE** |
| Inko | `a` | NAVIGUE → accueil.html |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (page modifiée) |
| Actualiser mes séries (nouveaux chapitres) | `button#btnRefresh` | AGIT (page modifiée) |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | AGIT (page modifiée) |
| Paramètres | `a` | NAVIGUE → parametres.html |
| Rechercher | `button#seGo` | **INERTE** |
| Catalogue | `a` | NAVIGUE → catalogue.html |
| Nouveautés | `a` | NAVIGUE → catalogue.html?sort=latest |
| Top | `a` | NAVIGUE → catalogue.html?sort=rating |
| Importer un fichier | `a` | NAVIGUE → import.html |
| Téléchargements | `a` | NAVIGUE → downloads.html |
| Code source | `a` | NAVIGUE → accueil.html |
| Signaler un bug | `a` | NAVIGUE → accueil.html |
| Versions | `a` | NAVIGUE → accueil.html |
| Confidentialité | `a` | NAVIGUE → confidentialite.html |
| Licence | `a` | **INERTE** |
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


### `bibliotheque.html`

URL auditée : `/bibliotheque.html`

**Ressources absentes (404) :**

- `https://sushiscan.fr/genres/adulte/`
- `https://sushiscan.fr/genres/hentai/`
- `https://sushiscan.fr/genres/pornhwa/page/5/`
- `https://sushiscan.fr/genres/pornhwa/page/4/`
- `https://sushiscan.fr/genres/ecchi/page/4/`
- `https://sushiscan.fr/genres/ecchi/page/5/`
- `https://sushiscan.fr/genres/smut/page/9/`
- `https://sushiscan.fr/genres/ecchi/page/3/`

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | **INERTE** |
| Inko | `a` | NAVIGUE → accueil.html |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (page modifiée) |
| Actualiser mes séries (nouveaux chapitres) | `button#btnRefresh` | AGIT (page modifiée) |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | AGIT (page modifiée) |
| Paramètres | `a` | NAVIGUE → parametres.html |
| Bibliothèque | `button` | **INERTE** |
| Signets | `button` | AGIT (page modifiée) |
| Téléchargements | `button` | AGIT (page modifiée) |
| Se reconnecter | `button` | ERREUR : locator.click: Element is not visible |
| Catalogue | `a` | NAVIGUE → accueil.html |
| Nouveautés | `a` | NAVIGUE → catalogue.html?sort=latest |
| Top | `a` | NAVIGUE → catalogue.html?sort=rating |
| Importer un fichier | `a` | NAVIGUE → import.html |
| Téléchargements | `a` | NAVIGUE → downloads.html |
| Code source | `a` | **INERTE** |
| Signaler un bug | `a` | **INERTE** |
| Versions | `a` | **INERTE** |
| Confidentialité | `a` | NAVIGUE → confidentialite.html |
| Licence | `a` | **INERTE** |
| FR | `button` | AGIT (page modifiée) |
| EN | `button` | AGIT (page modifiée) |
| Accueil | `a` | NAVIGUE → accueil.html |
| Bibliothèque | `a` | **INERTE** |
| Recherche | `a` | DISPARU |
| Profil | `a` | DISPARU |
| Plus de sections | `button#mnavMore` | DISPARU |
| Fermer l'astuce | `button` | DISPARU |


### `serie.html`

URL auditée : `/serie.html`

**Ressources absentes (404) :**

- `https://sushiscan.fr/genres/adulte/`
- `https://sushiscan.fr/genres/hentai/`
- `https://sushiscan.fr/genres/pornhwa/page/4/`
- `https://sushiscan.fr/genres/pornhwa/page/5/`
- `https://sushiscan.fr/genres/ecchi/page/3/`
- `https://sushiscan.fr/genres/ecchi/page/4/`
- `https://sushiscan.fr/genres/ecchi/page/5/`
- `https://sushiscan.fr/genres/smut/page/7/`

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | **INERTE** |
| Inko | `a` | NAVIGUE → accueil.html |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (page modifiée) |
| Actualiser mes séries (nouveaux chapitres) | `button#btnRefresh` | AGIT (page modifiée) |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | AGIT (page modifiée) |
| Paramètres | `a` | NAVIGUE → parametres.html |
| Catalogue | `a` | NAVIGUE → catalogue.html |
| Nouveautés | `a` | NAVIGUE → catalogue.html?sort=latest |
| Top | `a` | NAVIGUE → catalogue.html?sort=rating |
| Importer un fichier | `a` | NAVIGUE → import.html |
| Téléchargements | `a` | NAVIGUE → downloads.html |
| Code source | `a` | **INERTE** |
| Signaler un bug | `a` | **INERTE** |
| Versions | `a` | NAVIGUE → accueil.html |
| Confidentialité | `a` | NAVIGUE → confidentialite.html |
| Licence | `a` | **INERTE** |
| FR | `button` | AGIT (page modifiée) |
| EN | `button` | AGIT (page modifiée) |
| Désactiver | `button` | DISPARU |
| Accueil | `a` | NAVIGUE → accueil.html |
| Bibliothèque | `a` | NAVIGUE → bibliotheque.html |
| Recherche | `a` | NAVIGUE → recherche.html |
| Profil | `a` | NAVIGUE → profil.html |
| Plus de sections | `button#mnavMore` | AGIT (page modifiée) |
| Fermer l'astuce | `button` | DISPARU |


### `chapitre.html`

URL auditée : `/chapitre.html`

**Ressources absentes (404) :**

- `https://sushiscan.fr/genres/adulte/`
- `https://sushiscan.fr/genres/hentai/`
- `https://sushiscan.fr/genres/pornhwa/page/4/`
- `https://sushiscan.fr/genres/pornhwa/page/5/`
- `https://sushiscan.fr/genres/ecchi/page/5/`
- `https://sushiscan.fr/genres/ecchi/page/3/`
- `https://sushiscan.fr/genres/ecchi/page/4/`
- `https://sushiscan.fr/genres/smut/page/8/`

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | **INERTE** |
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
| Code source | `a` | **INERTE** |
| Signaler un bug | `a` | **INERTE** |
| Versions | `a` | **INERTE** |
| Confidentialité | `a` | NAVIGUE → confidentialite.html |
| Licence | `a` | **INERTE** |
| FR | `button` | AGIT (page modifiée) |
| EN | `button` | AGIT (page modifiée) |
| Fermer l'astuce | `button` | DISPARU |


### `lecture.html`

URL auditée : `/lecture.html`

**Ressources absentes (404) :**

- `https://sushiscan.fr/genres/hentai/`
- `https://sushiscan.fr/genres/adulte/`
- `https://sushiscan.fr/genres/pornhwa/page/5/`
- `https://sushiscan.fr/genres/pornhwa/page/4/`
- `https://sushiscan.fr/genres/ecchi/page/4/`
- `https://sushiscan.fr/genres/ecchi/page/3/`
- `https://sushiscan.fr/genres/ecchi/page/5/`
- `https://sushiscan.fr/genres/smut/page/8/`

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | **INERTE** |
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
| Code source | `a` | **INERTE** |
| Signaler un bug | `a` | **INERTE** |
| Versions | `a` | **INERTE** |
| Confidentialité | `a` | NAVIGUE → confidentialite.html |
| Licence | `a` | **INERTE** |
| FR | `button` | AGIT (page modifiée) |
| EN | `button` | AGIT (page modifiée) |
| Désactiver | `button` | DISPARU |


### `collections.html`

URL auditée : `/collections.html`

**Ressources absentes (404) :**

- `https://sushiscan.fr/genres/hentai/`
- `https://sushiscan.fr/genres/adulte/`
- `https://sushiscan.fr/genres/pornhwa/page/4/`
- `https://sushiscan.fr/genres/pornhwa/page/5/`
- `https://sushiscan.fr/genres/ecchi/page/5/`
- `https://sushiscan.fr/genres/ecchi/page/3/`
- `https://sushiscan.fr/genres/ecchi/page/4/`
- `https://sushiscan.fr/genres/smut/page/7/`

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | **INERTE** |
| Inko | `a` | NAVIGUE → accueil.html |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (page modifiée) |
| Actualiser mes séries (nouveaux chapitres) | `button#btnRefresh` | AGIT (page modifiée) |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | AGIT (page modifiée) |
| Paramètres | `a` | NAVIGUE → parametres.html |
| + Nouvelle liste | `button#btnNewList` | AGIT (page modifiée) |
| Se connecter | `a` | **INERTE** |
| Catalogue | `a` | **INERTE** |
| Nouveautés | `a` | **INERTE** |
| Top | `a` | **INERTE** |
| Importer un fichier | `a` | AGIT (page modifiée) |
| Téléchargements | `a` | **INERTE** |
| Code source | `a` | **INERTE** |
| Signaler un bug | `a` | **INERTE** |
| Versions | `a` | **INERTE** |
| Confidentialité | `a` | **INERTE** |
| Licence | `a` | AGIT (page modifiée) |
| FR | `button` | AGIT (page modifiée) |
| EN | `button` | AGIT (page modifiée) |
| Accueil | `a` | NAVIGUE → accueil.html |
| Bibliothèque | `a` | NAVIGUE → bibliotheque.html |
| Recherche | `a` | NAVIGUE → recherche.html |
| Profil | `a` | NAVIGUE → profil.html |
| Plus de sections | `button#mnavMore` | AGIT (page modifiée) |


### `collection-detail.html`

URL auditée : `/collection-detail.html`

**Ressources absentes (404) :**

- `https://sushiscan.fr/genres/adulte/`
- `https://sushiscan.fr/genres/hentai/`
- `https://sushiscan.fr/genres/pornhwa/page/4/`
- `https://sushiscan.fr/genres/pornhwa/page/5/`
- `https://sushiscan.fr/genres/ecchi/page/4/`
- `https://sushiscan.fr/genres/ecchi/page/3/`
- `https://sushiscan.fr/genres/ecchi/page/5/`
- `https://sushiscan.fr/genres/smut/page/7/`

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | **INERTE** |
| Inko | `a` | NAVIGUE → accueil.html |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (page modifiée) |
| Actualiser mes séries (nouveaux chapitres) | `button#btnRefresh` | AGIT (page modifiée) |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | AGIT (page modifiée) |
| Paramètres | `a` | NAVIGUE → parametres.html |
| ← Mes listes | `a` | NAVIGUE → collections.html |
| Catalogue | `a` | NAVIGUE → catalogue.html |
| Nouveautés | `a` | NAVIGUE → catalogue.html?sort=latest |
| Top | `a` | NAVIGUE → catalogue.html?sort=rating |
| Importer un fichier | `a` | **INERTE** |
| Téléchargements | `a` | **INERTE** |
| Code source | `a` | NAVIGUE → accueil.html |
| Signaler un bug | `a` | **INERTE** |
| Versions | `a` | **INERTE** |
| Confidentialité | `a` | NAVIGUE → confidentialite.html |
| Licence | `a` | **INERTE** |
| FR | `button` | AGIT (page modifiée) |
| EN | `button` | AGIT (page modifiée) |
| Désactiver | `button` | DISPARU |
| Accueil | `a` | NAVIGUE → accueil.html |
| Bibliothèque | `a` | NAVIGUE → bibliotheque.html |
| Recherche | `a` | NAVIGUE → recherche.html |
| Profil | `a` | NAVIGUE → profil.html |
| Plus de sections | `button#mnavMore` | AGIT (page modifiée) |


### `notes.html`

URL auditée : `/notes.html`

**Ressources absentes (404) :**

- `https://sushiscan.fr/genres/adulte/`
- `https://sushiscan.fr/genres/hentai/`
- `https://sushiscan.fr/genres/pornhwa/page/4/`
- `https://sushiscan.fr/genres/pornhwa/page/5/`
- `https://sushiscan.fr/genres/ecchi/page/4/`
- `https://sushiscan.fr/genres/ecchi/page/3/`
- `https://sushiscan.fr/genres/ecchi/page/5/`
- `https://sushiscan.fr/genres/smut/page/9/`

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | **INERTE** |
| Inko | `a` | NAVIGUE → accueil.html |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (page modifiée) |
| Actualiser mes séries (nouveaux chapitres) | `button#btnRefresh` | AGIT (page modifiée) |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | AGIT (page modifiée) |
| Paramètres | `a` | NAVIGUE → parametres.html |
| Lire chaque serie du debut a la fin | `button#jrRecit` | **INERTE** |
| Exporter en Markdown (Obsidian, Logseq…) | `button#jrExportMd` | **INERTE** |
| Se reconnecter | `button` | **INERTE** |
| Catalogue | `a` | NAVIGUE → catalogue.html |
| Nouveautés | `a` | NAVIGUE → catalogue.html?sort=latest |
| Top | `a` | NAVIGUE → catalogue.html?sort=rating |
| Importer un fichier | `a` | NAVIGUE → import.html |
| Téléchargements | `a` | NAVIGUE → downloads.html |
| Code source | `a` | **INERTE** |
| Signaler un bug | `a` | **INERTE** |
| Versions | `a` | **INERTE** |
| Confidentialité | `a` | NAVIGUE → confidentialite.html |
| Licence | `a` | **INERTE** |
| FR | `button` | AGIT (page modifiée) |
| EN | `button` | AGIT (page modifiée) |
| Accueil | `a` | NAVIGUE → accueil.html |
| Bibliothèque | `a` | NAVIGUE → bibliotheque.html |
| Recherche | `a` | NAVIGUE → recherche.html |
| Profil | `a` | NAVIGUE → profil.html |
| Plus de sections | `button#mnavMore` | AGIT (page modifiée) |


### `notifications.html`

URL auditée : `/notifications.html`

**Ressources absentes (404) :**

- `https://sushiscan.fr/genres/hentai/`
- `https://sushiscan.fr/genres/adulte/`
- `https://sushiscan.fr/genres/pornhwa/page/5/`
- `https://sushiscan.fr/genres/pornhwa/page/4/`
- `https://sushiscan.fr/genres/ecchi/page/4/`
- `https://sushiscan.fr/genres/ecchi/page/3/`
- `https://sushiscan.fr/genres/ecchi/page/5/`
- `https://sushiscan.fr/genres/smut/page/7/`

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | **INERTE** |
| Inko | `a` | NAVIGUE → accueil.html |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (page modifiée) |
| Actualiser mes séries (nouveaux chapitres) | `button#btnRefresh` | AGIT (page modifiée) |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | AGIT (page modifiée) |
| Paramètres | `a` | NAVIGUE → parametres.html |
| Actualiser les notifications | `button#ntRefresh` | **INERTE** |
| Recevoir les notifications même Inko fermé | `button#ntEnablePush` | **INERTE** |
| Fréquence de vérification des nouveaux chapitr | `select#ntFreq` | **INERTE** |
| Toutes | `button` | **INERTE** |
| Non lues | `button` | **INERTE** |
| Réponses | `button` | **INERTE** |
| Mentions | `button` | **INERTE** |
| Chapitres | `button` | **INERTE** |
| Se reconnecter | `button` | **INERTE** |
| Catalogue | `a` | DISPARU |
| Nouveautés | `a` | DISPARU |
| Top | `a` | DISPARU |
| Importer un fichier | `a` | DISPARU |
| Téléchargements | `a` | DISPARU |
| Code source | `a` | DISPARU |
| Signaler un bug | `a` | DISPARU |
| Versions | `a` | DISPARU |
| Confidentialité | `a` | DISPARU |
| Licence | `a` | DISPARU |
| FR | `button` | DISPARU |
| EN | `button` | DISPARU |
| Désactiver | `button` | DISPARU |
| Accueil | `a` | DISPARU |
| Bibliothèque | `a` | DISPARU |
| Recherche | `a` | DISPARU |
| Profil | `a` | DISPARU |
| Plus de sections | `button#mnavMore` | DISPARU |
| Fermer l'astuce | `button` | DISPARU |


### `downloads.html`

URL auditée : `/downloads.html`

**Ressources absentes (404) :**

- `https://sushiscan.fr/genres/adulte/`
- `https://sushiscan.fr/genres/hentai/`
- `https://sushiscan.fr/genres/pornhwa/page/4/`
- `https://sushiscan.fr/genres/pornhwa/page/5/`
- `https://sushiscan.fr/genres/ecchi/page/3/`
- `https://sushiscan.fr/genres/ecchi/page/4/`
- `https://sushiscan.fr/genres/ecchi/page/5/`
- `https://sushiscan.fr/genres/smut/page/7/`

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | **INERTE** |
| Inko | `a` | NAVIGUE → accueil.html |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (page modifiée) |
| Actualiser mes séries (nouveaux chapitres) | `button#btnRefresh` | AGIT (page modifiée) |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | AGIT (page modifiée) |
| Paramètres | `a` | NAVIGUE → parametres.html |
| Catalogue | `a` | NAVIGUE → accueil.html |
| Nouveautés | `a` | NAVIGUE → catalogue.html?sort=latest |
| Top | `a` | NAVIGUE → catalogue.html?sort=rating |
| Importer un fichier | `a` | NAVIGUE → import.html |
| Téléchargements | `a` | **INERTE** |
| Code source | `a` | DISPARU |
| Signaler un bug | `a` | DISPARU |
| Versions | `a` | DISPARU |
| Confidentialité | `a` | DISPARU |
| Licence | `a` | DISPARU |
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


### `import.html`

URL auditée : `/import.html`

**Ressources absentes (404) :**

- `https://sushiscan.fr/genres/adulte/`
- `https://sushiscan.fr/genres/hentai/`
- `https://sushiscan.fr/genres/pornhwa/page/4/`
- `https://sushiscan.fr/genres/pornhwa/page/5/`
- `https://sushiscan.fr/genres/ecchi/page/3/`
- `https://sushiscan.fr/genres/ecchi/page/4/`
- `https://sushiscan.fr/genres/ecchi/page/5/`
- `https://sushiscan.fr/genres/erotique/page/8/`

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | **INERTE** |
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
| Code source | `a` | DISPARU |
| Signaler un bug | `a` | DISPARU |
| Versions | `a` | DISPARU |
| Confidentialité | `a` | DISPARU |
| Licence | `a` | DISPARU |
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


### `localreader.html`

URL auditée : `/localreader.html`

**Ressources absentes (404) :**

- `https://sushiscan.fr/genres/hentai/`
- `https://sushiscan.fr/genres/adulte/`

| Contrôle | Élément | Verdict |
|---|---|---|
| ← Bibliothèque | `a` | NAVIGUE → import.html |
| Mes fichiers importés | `a` | NAVIGUE → import.html |
| Ma bibliothèque | `a` | NAVIGUE → bibliotheque.html |


### `parametres.html`

URL auditée : `/parametres.html`

**Ressources absentes (404) :**

- `https://sushiscan.fr/genres/adulte/`
- `https://sushiscan.fr/genres/hentai/`
- `https://sushiscan.fr/genres/pornhwa/page/4/`
- `https://sushiscan.fr/genres/pornhwa/page/5/`
- `https://sushiscan.fr/genres/ecchi/page/3/`
- `https://sushiscan.fr/genres/ecchi/page/4/`
- `https://sushiscan.fr/genres/ecchi/page/5/`
- `https://sushiscan.fr/genres/erotique/page/8/`

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | **INERTE** |
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
| Code source | `a` | DISPARU |
| Signaler un bug | `a` | DISPARU |
| Versions | `a` | DISPARU |
| Confidentialité | `a` | DISPARU |
| Licence | `a` | DISPARU |
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


### `profil.html`

URL auditée : `/profil.html`

**Ressources absentes (404) :**

- `https://sushiscan.fr/genres/hentai/`
- `https://sushiscan.fr/genres/adulte/`
- `https://sushiscan.fr/genres/pornhwa/page/5/`
- `https://sushiscan.fr/genres/pornhwa/page/4/`
- `https://sushiscan.fr/genres/ecchi/page/4/`
- `https://sushiscan.fr/genres/smut/page/7/`
- `https://sushiscan.fr/genres/ecchi/page/3/`
- `https://sushiscan.fr/genres/ecchi/page/5/`

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | **INERTE** |
| Inko | `a` | NAVIGUE → accueil.html |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (page modifiée) |
| Actualiser mes séries (nouveaux chapitres) | `button#btnRefresh` | AGIT (page modifiée) |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | AGIT (page modifiée) |
| Paramètres | `a` | NAVIGUE → parametres.html |
| Éditer | `button` | **INERTE** |
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
| Code source | `a` | DISPARU |
| Signaler un bug | `a` | DISPARU |
| Versions | `a` | DISPARU |
| Confidentialité | `a` | DISPARU |
| Licence | `a` | DISPARU |
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


### `u.html`

URL auditée : `/u.html?u=demo&preview=1`

**Ressources absentes (404) :**

- `https://sushiscan.fr/genres/hentai/`
- `https://sushiscan.fr/genres/adulte/`
- `https://sushiscan.fr/genres/pornhwa/page/5/`
- `https://sushiscan.fr/genres/pornhwa/page/4/`
- `https://sushiscan.fr/genres/ecchi/page/3/`
- `https://sushiscan.fr/genres/ecchi/page/5/`
- `https://sushiscan.fr/genres/ecchi/page/4/`
- `https://sushiscan.fr/genres/smut/page/7/`

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | **INERTE** |
| Inko | `a` | NAVIGUE → accueil.html |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (page modifiée) |
| Actualiser mes séries (nouveaux chapitres) | `button#btnRefresh` | AGIT (page modifiée) |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | AGIT (page modifiée) |
| Paramètres | `a` | NAVIGUE → parametres.html |
| Catalogue | `a` | NAVIGUE → catalogue.html |
| Nouveautés | `a` | NAVIGUE → catalogue.html?sort=latest |
| Top | `a` | **INERTE** |
| Importer un fichier | `a` | **INERTE** |
| Téléchargements | `a` | NAVIGUE → catalogue.html |
| Code source | `a` | **INERTE** |
| Signaler un bug | `a` | **INERTE** |
| Versions | `a` | **INERTE** |
| Confidentialité | `a` | NAVIGUE → confidentialite.html |
| Licence | `a` | **INERTE** |
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


### `stats.html`

URL auditée : `/stats.html`

**Ressources absentes (404) :**

- `https://sushiscan.fr/genres/hentai/`
- `https://sushiscan.fr/genres/adulte/`

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | **INERTE** |
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
| Code source | `a` | DISPARU |
| Signaler un bug | `a` | DISPARU |
| Versions | `a` | DISPARU |
| Confidentialité | `a` | DISPARU |
| Licence | `a` | DISPARU |
| FR | `button` | DISPARU |
| EN | `button` | DISPARU |
| Désactiver | `button` | DISPARU |
| Accueil | `a` | DISPARU |
| Bibliothèque | `a` | DISPARU |
| Recherche | `a` | DISPARU |
| Profil | `a` | DISPARU |
| Plus de sections | `button#mnavMore` | DISPARU |
| Fermer l'astuce | `button` | DISPARU |


### `sources.html`

URL auditée : `/sources.html`

**Ressources absentes (404) :**

- `https://sushiscan.fr/genres/hentai/`
- `https://sushiscan.fr/genres/adulte/`
- `https://sushiscan.fr/genres/pornhwa/page/4/`
- `https://sushiscan.fr/genres/pornhwa/page/5/`
- `https://sushiscan.fr/genres/ecchi/page/5/`
- `https://sushiscan.fr/genres/ecchi/page/4/`
- `https://sushiscan.fr/genres/smut/page/8/`
- `https://sushiscan.fr/genres/ecchi/page/3/`

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | **INERTE** |
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
| Catalogue | `a` | NAVIGUE → accueil.html |
| Nouveautés | `a` | NAVIGUE → catalogue.html?sort=latest |
| Top | `a` | NAVIGUE → catalogue.html?sort=rating |
| Importer un fichier | `a` | NAVIGUE → import.html |
| Téléchargements | `a` | NAVIGUE → downloads.html |
| Code source | `a` | **INERTE** |
| Signaler un bug | `a` | **INERTE** |
| Versions | `a` | **INERTE** |
| Confidentialité | `a` | NAVIGUE → confidentialite.html |
| Licence | `a` | **INERTE** |
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


### `liste.html`

URL auditée : `/liste.html`

**Ressources absentes (404) :**

- `https://sushiscan.fr/genres/hentai/`
- `https://sushiscan.fr/genres/adulte/`
- `https://sushiscan.fr/genres/pornhwa/page/5/`
- `https://sushiscan.fr/genres/pornhwa/page/4/`
- `https://sushiscan.fr/genres/ecchi/page/3/`
- `https://sushiscan.fr/genres/ecchi/page/5/`
- `https://sushiscan.fr/genres/ecchi/page/4/`
- `https://sushiscan.fr/genres/smut/page/7/`

| Contrôle | Élément | Verdict |
|---|---|---|
| Aller au contenu | `a` | **INERTE** |
| Inko | `a` | NAVIGUE → accueil.html |
| Mode incognito (lecture privée) | `button#btnIncognito` | AGIT (page modifiée) |
| Actualiser mes séries (nouveaux chapitres) | `button#btnRefresh` | AGIT (page modifiée) |
| Musique (s'ouvre dans une fenêtre qui reste en | `button#btnMusic` | AGIT (page modifiée) |
| Paramètres | `a` | NAVIGUE → parametres.html |
| Aller à l’accueil | `a` | NAVIGUE → accueil.html |
| Catalogue | `a` | NAVIGUE → catalogue.html |
| Nouveautés | `a` | **INERTE** |
| Top | `a` | **INERTE** |
| Importer un fichier | `a` | NAVIGUE → catalogue.html |
| Téléchargements | `a` | NAVIGUE → catalogue.html |
| Code source | `a` | **INERTE** |
| Signaler un bug | `a` | **INERTE** |
| Versions | `a` | **INERTE** |
| Confidentialité | `a` | NAVIGUE → confidentialite.html |
| Licence | `a` | **INERTE** |
| FR | `button` | AGIT (page modifiée) |
| EN | `button` | AGIT (page modifiée) |
| Désactiver | `button` | DISPARU |
| Accueil | `a` | NAVIGUE → accueil.html |
| Bibliothèque | `a` | NAVIGUE → bibliotheque.html |
| Recherche | `a` | NAVIGUE → recherche.html |
| Profil | `a` | NAVIGUE → profil.html |
| Plus de sections | `button#mnavMore` | AGIT (page modifiée) |


### `anilist.html`

URL auditée : `/anilist.html`

**Ressources absentes (404) :**

- `https://sushiscan.fr/genres/ecchi/page/4/`
- `https://sushiscan.fr/genres/ecchi/page/5/`

| Contrôle | Élément | Verdict |
|---|---|---|
| Retour aux paramètres | `a` | NAVIGUE → parametres.html |
| Accueil | `a` | NAVIGUE → accueil.html |


### `confidentialite.html`

URL auditée : `/confidentialite.html`

**Ressources absentes (404) :**

- `https://sushiscan.fr/genres/hentai/`
- `https://sushiscan.fr/genres/adulte/`
- `https://sushiscan.fr/genres/pornhwa/page/4/`
- `https://sushiscan.fr/genres/pornhwa/page/5/`

| Contrôle | Élément | Verdict |
|---|---|---|
| Paramètres | `a` | NAVIGUE → parametres.html |
| dépôt du projet | `a` | **INERTE** |


### `offline.html`

URL auditée : `/offline.html`

**Ressources absentes (404) :**

- `/offline.html`

Aucun contrôle visible.
