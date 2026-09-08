# Audit des feuilles de style

## Feuilles de style — empilement et conflits

14 feuilles · 2196 règles · 244 Ko

| Feuille | Règles | Lignes | Poids |
|---|---|---|---|
| `global.css` | 407 | 2404 | 46 Ko |
| `profil.css` | 348 | 1858 | 33 Ko |
| `serie.css` | 222 | 1218 | 22 Ko |
| `chapitre.css` | 221 | 1405 | 28 Ko |
| `accueil.css` | 182 | 1025 | 18 Ko |
| `catalogue.css` | 159 | 826 | 15 Ko |
| `collections.css` | 132 | 730 | 14 Ko |
| `collection-detail.css` | 109 | 554 | 10 Ko |
| `bibliotheque.css` | 108 | 647 | 12 Ko |
| `music.css` | 78 | 473 | 9 Ko |
| `notes.css` | 76 | 481 | 9 Ko |
| `lecture.css` | 58 | 369 | 7 Ko |
| `recherche.css` | 54 | 341 | 6 Ko |
| `fonts.css` | 42 | 862 | 15 Ko |

### L’échelle des `z-index` — 47 déclarations, 24 paliers distincts

Une échelle qui compte des dizaines de paliers ne se raisonne plus :
poser un élément « au-dessus » devient une devinette, et c’est ainsi
qu’un bandeau finit par recouvrir la barre de navigation.

```
0  1  2  3  4  5  6  10  50  60  70  80  90  95  120  130  200  1000  4000  9000  9500  9600  9999  10000
```

**Les 13 plus hauts** — ce sont eux qui recouvrent tout le reste :

- `10000` — `#inko-titlebar` (global.css:635)
- `10000` — `.skip-link` (global.css:1890)
- `9999` — `body.incognito-on::before` (global.css:496)
- `9999` — `.toast` (global.css:1293)
- `9600` — `#incognitoBar` (global.css:505)
- `9600` — `.undo-bar` (global.css:1984)
- `9500` — `.mh-continue-menu` (global.css:1905)
- `9500` — `.novel-quote-btn` (lecture.css:356)
- `9000` — `#inko-music` (music.css:6)
- `4000` — `.notes-ui` (notes.css:7)
- `1000` — `.reader-settings-pop` (chapitre.css:968)
- `1000` — `.site-header` (global.css:311)
- `1000` — `.list-modal-backdrop` (global.css:1729)

### 38 déclarations `!important`

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
- `prefers-reduced-motion` — 2 fois
- `transition-duration` — 2 fois
- `padding` — 1 fois
- `gap` — 1 fois

### 11 propriétés déclarées PLUSIEURS FOIS sur le même sélecteur

L’une gagne, et laquelle dépend de l’ordre de chargement des feuilles.

- `accueil.css » @media (max-width: 768px) » .hero` → `height` : `460px` vs `380px`
- `accueil.css » @media (max-width: 768px) » .hero-co` → `padding` : `0 18px 30px` vs `0 16px 32px`
- `chapitre.css » .reader-page-img` → `transition` : `opacity 0.3s ease` vs `opacity .25s ease`
- `global.css » @media (prefers-reduced-motion: reduc` → `animation-duration` : `.01ms !important` vs `0.01ms !important`
- `global.css » @media (prefers-reduced-motion: reduc` → `transition-duration` : `.01ms !important` vs `0.01ms !important`
- `global.css » @media (max-width: 1024px) » #btnBack` → `bottom` : `78px !important` vs `calc(64px + env(safe-are`
- `global.css » @media (max-width: 1024px) » .mobile-` → `padding-bottom` : `0` vs `env(safe-area-inset-bott`
- `music.css » #inko-music .im-bar` → `box-shadow` : `inset 0 1px 0 rgba(255, ` vs `0 8px 40px rgba(0, 0, 0,`
- `recherche.css » .se-src-chip:hover` → `border-color` : `var(--accent)` vs `var(--orange)`
- `recherche.css » .se-local-item span` → `display` : `block` vs `-webkit-box`
- `serie.css » @media (max-width: 768px) » .chap-sear` → `width` : `110px` vs `140px`
