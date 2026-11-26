---

### 3.3 « Le bouton Mettre à jour : un truc violet par-dessus quand j'appuie, et la mise à jour ne fonctionne pas bien »

Deux symptômes, **une cause racine** qui a été **reproduite et chronométrée** (sonde `boutons`, scénario « mise à jour » ; captures dans `docs/audit/captures/maj-*.jpg`).

#### Ce qui se passe, seconde par seconde

Bibliothèque de 36 séries dont la couverture manque (cas réel : 18 favoris sans couverture dans votre base), clic sur « Mettre à jour » 2,5 s après l'ouverture de la page. **Quatre essais indépendants** donnent un premier retour visuel à **7,3 s, 7,7 s, 8,1 s et 20,4 s** — le délai dépend de la vitesse à laquelle les sources répondent ; le décalage de mise en page est **identique à chaque essai (208 px / 30 px)**. Chronologie de l'essai « type » :

| Instant après le clic | Ce que voit l'utilisateur |
|---|---|
| 0 → **≈ 7,5 s** (jusqu'à 20 s) | **Rien.** Le bouton ne se désactive pas, aucun texte n'apparaît, aucune rotation. C'est la phase où l'on re-clique. |
| **≈ 7,5 s** | « Recherche de nouveautés… » (c'est le *scan automatique*, pas la réponse au clic) |
| +0,05 s | « Vérification… » — **le bouton et la barre d'outils se décalent de 208 px** : la ligne de statut entre dans le flux |
| +1 s → +7 s | « Vérification… 24 / 36 » puis « 35 / 36 » : **la barre de progression en `var(--accent)`** (violette dans votre thème) apparaît sur une **nouvelle ligne sous la barre d'outils** et **pousse toute la grille de 30 px vers le bas** |

C'est cela, « le truc violet par-dessus » : une barre accent surgit sous le pointeur *au moment où le bouton se déplace*, plusieurs secondes après le clic. La sonde de recouvrement (`elementsFromPoint` sur 9 points du bouton, 4 instants) n'a trouvé **aucune couche** posée sur le bouton : ce n'est pas un voile, c'est **un décalage de mise en page**.

#### La cause racine : les boutons de la page n'existent pas encore quand on clique

`assets/js/bibliotheque.js:194-201` :

```js
await loadLibrary();       // ← attend
bindUpdates();
wireNotifyButton();
wireLibRefresh();          // ← le bouton « Mettre à jour » n'a AUCUN écouteur avant cette ligne
wireLibRandom();           //   idem « Aléatoire »
wireLibExtras();           //   idem menu « … », export, import
wireViewToggle();          //   idem grille / liste
wireSelect();              //   idem « Sélectionner »
wireGridDelegation();      //   idem clics sur les cartes
```

et `loadLibrary()` se termine (`bibliotheque.js:745-760`) par :

```js
const missing = favs.filter(f => !f.title || !f.cover);
if (missing.length) {
    await Promise.allSettled(missing.slice(0, 40).map(async f => {   // ← jusqu'à 40 appels vers des sources externes
        … const m = await API.mangas.getFrom(f.source, f.mangaId); …
```

**Chaque contrôle de la page reste inerte tant que jusqu'à 40 requêtes vers des sites tiers ne sont pas revenues.** Avec des sources lentes ou en panne (SushiScan, MangaDex : ≈ 22 % de la bibliothèque), cela dure **10 s et plus** — mesuré 11 s sur la base d'essai. Le clic n'est pas « perdu » : il n'a simplement personne pour l'écouter.

Trois effets en cascade :

1. **« Mettre à jour » (mais aussi « Aléatoire », « Sélectionner », « Filtres », grille/liste, menu « … ») ne répondent pas pendant plusieurs secondes** après chaque ouverture de la bibliothèque. L'utilisateur conclut que « la maj ne fonctionne pas ».
2. **Le résultat de ces 40 appels n'est jamais enregistré.** Il met à jour le tableau local et le miroir `localStorage`, **jamais la base** : à la visite suivante, les mêmes 40 appels repartent. C'est du travail refait à chaque affichage, et la raison pour laquelle COV-02 (écrire la couverture trouvée) est la clé.
3. **Le scan automatique (`maybeAutoCheck`) se déclenche en même temps** : deux vérifications peuvent se chevaucher avec celle du clic, d'où des textes qui se succèdent (« Recherche de nouveautés… » → « Vérification… »).

> Ce défaut est **structurel** : n'importe quelle page qui fait `await <réseau>` *avant* d'attacher ses écouteurs a le même comportement. La sonde `boutons` clique chaque contrôle de chaque page 2,2 s après le chargement : les pages concernées ressortent dans `BTN-MORT` (§6).
>
> **La sonde `ecouteurs` (statique) retrouve le motif ailleurs :** `bibliotheque.js:196` (10 branchements après `await loadLibrary()`) ; `notes.js:22` — **le Journal** : filtres, export Markdown et récit restent inertes jusqu'au retour de `await loadStats()` ; (`lecture.js:118`, signalé aussi, est un **faux positif** : l'attente est dans la branche hors ligne.) Deux autres occurrences (`notifications.js:46`, `profil.js:1231`) sont à vérifier : l'attente y est dans un gestionnaire, pas au chargement. **Même correctif partout** : brancher d'abord, charger ensuite.

#### Les autres causes de « ne fonctionne pas bien »

| # | Cause | Preuve |
|---|---|---|
| 4 | **Le résultat ne distingue pas « à jour » de « impossible à vérifier ».** `À jour · 14:32` s'écrit dès que la promesse se résout, que 500 séries aient été lues ou 380. | `bibliotheque.js:575` |
| 5 | **Le bouton « Mettre à jour » a trois sens** : vérifier les chapitres (bibliothèque), mettre à jour une extension (sources), installer l'app (desktop). | `sources.js:52`, `global.js:3642` |
| 6 | **Un ancien chemin synchrone existe encore** : `GET /me/updates` sans `manga` fait un balayage complet **dans la requête HTTP** — plus de 25 s sans réponse. Seul `serie.js:1665` l'appelle (avec `manga`, donc inoffensif). | `routes/index.js:344` ; sonde `api-contrat` |
| 7 | **15 minutes de garde silencieuse** : un second clic rend « le dernier résultat connu » (`frais: false`) sans que l'interface le dise. | `user.controller.js:1667-1677` |
| 8 | **Pas d'annulation** : un scan de 500 séries dure des minutes, fermer la page ne l'arrête pas. | `api.js:925` |
| 9 | **Les sources lentes tirent tout vers le bas** : `/mangas/popular` 17 s, `/mangas/latest` 7,5 s sous la sonde. | `api-contrat` |

#### Ce qu'il faut faire (UPD-01 à UPD-09)

| ID | Correctif | Effort |
|---|---|---|
| **UPD-01** 🔴 | **Attacher les écouteurs AVANT d'attendre le réseau.** Déplacer `bindUpdates()…wireGridDelegation()` avant `await loadLibrary()` (ils ne dépendent que du DOM statique) ; rendre l'enrichissement des 40 séries **non bloquant** : `loadLibrary()` rend la main après le premier rendu, l'enrichissement part en arrière-plan et re-rend à l'arrivée. | S |
| **UPD-02** 🔴 | **Persister l'enrichissement** : `PUT /me/favorites/:id/meta {title, cover}` pour chaque fiche complétée (COV-02) — plus jamais deux fois le même appel. | S |
| **UPD-03** 🟠 | **Retour immédiat au clic** (< 100 ms) : le bouton passe en état « en cours » (icône qui tourne, `aria-busy`, texte « Vérification… 0 / 36 ») **avant** tout appel réseau, et **dans le bouton** — plus de ligne de statut dans le flux. | S |
| **UPD-04** 🟠 | **Réserver la place du statut** : `min-height` fixe ou positionnement absolu ; la barre de progression ne doit jamais déplacer la page (CLS = 0). | S |
| **UPD-05** 🟠 | **Résultat honnête** : « 498 vérifiées · 23 injoignables (SushiScan ×18, MangaDex ×5) — Réessayer ces 23 ». | M |
| **UPD-06** 🟠 | **Un bouton, un sens** : « Vérifier les nouveaux chapitres » / « Mettre à jour les extensions » / « Installer la version 2.x ». | S |
| **UPD-07** 🟡 | **Annulation** (`DELETE /me/updates/scan` + « Arrêter »), **ordre intelligent** (séries en cours d'abord, sources au disjoncteur ouvert sautées), plafond de 15 s par source. | M |
| **UPD-08** 🟡 | **Dire le cooldown** : « Déjà vérifié il y a 6 min — prochaine possible dans 9 min ». Retirer l'ancien `GET /me/updates` synchrone. | S |
| **UPD-09** 🔵 | **Vérification automatique silencieuse** (pas de texte dans la barre d'outils) avec notification discrète « 3 nouveaux chapitres ». | M |

**Critère d'acceptation** : sonde `boutons` — le premier retour visuel arrive en **< 100 ms** après le clic, le bouton et la grille **ne bougent pas** (décalage 0 px), aucun `BTN-MORT` sur `bibliotheque.html` même avec des sources en panne.
