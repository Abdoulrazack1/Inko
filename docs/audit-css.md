# Audit des feuilles de style

## Feuilles de style — empilement et conflits

14 feuilles · 2233 règles · 248 Ko

| Feuille | Règles | Lignes | Poids |
|---|---|---|---|
| `global.css` | 405 | 2397 | 45 Ko |
| `profil.css` | 354 | 1900 | 34 Ko |
| `chapitre.css` | 221 | 1404 | 28 Ko |
| `serie.css` | 221 | 1218 | 22 Ko |
| `accueil.css` | 186 | 1045 | 19 Ko |
| `catalogue.css` | 159 | 826 | 15 Ko |
| `collections.css` | 132 | 730 | 14 Ko |
| `bibliotheque.css` | 116 | 698 | 13 Ko |
| `collection-detail.css` | 109 | 554 | 10 Ko |
| `notes.css` | 86 | 542 | 10 Ko |
| `music.css` | 78 | 472 | 9 Ko |
| `lecture.css` | 71 | 452 | 9 Ko |
| `recherche.css` | 53 | 336 | 6 Ko |
| `fonts.css` | 42 | 862 | 15 Ko |

### L’échelle des `z-index` — 49 déclarations, 25 paliers distincts

Une échelle qui compte des dizaines de paliers ne se raisonne plus :
poser un élément « au-dessus » devient une devinette, et c’est ainsi
qu’un bandeau finit par recouvrir la barre de navigation.

```
0  1  2  3  4  5  6  10  50  60  70  80  90  95  120  130  200  1000  4000  9000  9400  9500  9600  9999  10000
```

**Les 15 plus hauts** — ce sont eux qui recouvrent tout le reste :

- `10000` — `#inko-titlebar` (global.css:626)
- `10000` — `.skip-link` (global.css:1883)
- `9999` — `body.incognito-on::before` (global.css:487)
- `9999` — `.toast` (global.css:1285)
- `9600` — `#incognitoBar` (global.css:496)
- `9600` — `.undo-bar` (global.css:1977)
- `9600` — `.histo-menu` (profil.css:1860)
- `9500` — `.mh-continue-menu` (global.css:1898)
- `9500` — `.novel-quote-btn` (lecture.css:356)
- `9400` — `.novel-find` (lecture.css:373)
- `9000` — `#inko-music` (music.css:6)
- `4000` — `.notes-ui` (notes.css:7)
- `1000` — `.reader-settings-pop` (chapitre.css:967)
- `1000` — `.site-header` (global.css:302)
- `1000` — `.list-modal-backdrop` (global.css:1721)

### 36 déclarations `!important`

Chacune rend un correctif de mise en page impossible sans en ajouter
un autre. C’est la dette qui se paie à chaque retouche.

- `border-color` — 4 fois
- `width` — 4 fois
- `max-width` — 3 fois
- `color` — 3 fois
- `bottom` — 3 fois
- `height` — 2 fois
- `max-height` — 2 fois
- `display` — 2 fois
- `padding` — 1 fois
- `gap` — 1 fois
- `outline` — 1 fois
- `outline-offset` — 1 fois

### 0 propriétés déclarées PLUSIEURS FOIS sur le même sélecteur

L’une gagne, et laquelle dépend de l’ordre de chargement des feuilles.

