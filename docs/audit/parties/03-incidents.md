## 3. Les incidents signalés

Trois problèmes remontés par l'utilisateur, instruits à part parce qu'ils appellent une réponse nette : **que s'est-il passé, pourquoi, et qu'est-ce qui garantit que cela ne se reproduira pas.**

---

### 3.1 « Pourquoi ma bibliothèque est vide ? »

#### Ce qui s'est passé (établi)

Les événements de la base réelle permettent de reconstituer la séquence, sans conjecture :

| Fait | Source |
|---|---|
| **993 événements `unfavorite`** pour un seul compte — le propriétaire local (id 26) | table `events`, journée du 2026-11-09 |
| entre **11:11:12 et 11:13:09 UTC** (12:11–12:13 à Paris), dont **990 dans la seule première minute** | idem |
| portant sur **497 œuvres distinctes** — c'est-à-dire *toute* la bibliothèque (521 favoris aujourd'hui, 495 restaurés), la plupart **deux fois** | `COUNT(DISTINCT manga_id)` |
| **aucune autre activité notable** ce jour-là : 11 lectures, 3 ajouts, 2 changements de statut | `GROUP BY type` |
| le champ `metadata` est **vide** sur tous ces événements, `source` est `NULL` sur les premiers | lignes 5946-5948 |
| la dernière sauvegarde nocturne antérieure est celle du **8 novembre** : c'est elle qui a permis de restaurer 495 séries | `server/backups/` |

**Conclusion ferme :** ce n'est pas une corruption, ni un bug d'affichage, ni une perte de connexion. **Quelqu'un ou quelque chose a demandé au serveur de retirer chaque favori, un par un, et le serveur l'a fait.** Il n'y a aucune trace d'anomalie technique : le comportement est exactement celui du code.

#### Pourquoi le serveur l'a accepté (établi, reproduit)

1. **`removeFavorite` supprime sur demande, sans condition** (`server/controllers/user.controller.js:155-165`) : un `DELETE` par œuvre, une ligne enlevée, un événement inscrit. Rien ne distingue un clic d'une boucle.
2. **Le geste existe dans l'interface** : « Tout sélectionner (N) » puis « Retirer » appelle `bulkDelete` (`assets/js/bibliotheque.js:1409-1424`), qui envoie **un `DELETE` par série, séquentiellement**, avec une seule confirmation (`MH.confirm`). `catch (e) { /* on continue */ }` avale tout échec.
3. **Aucune corbeille, aucun annuler.** Une fois la ligne supprimée, seule la sauvegarde la rend.
4. **Reproduit sur la base jetable** : 300 favoris supprimés en **699 ms** par 300 `DELETE` consécutifs, 0 refus (aucun 409/423/429), 0 restant. C'est la sonde `flux-ecriture`.

#### Ce qui n'est pas établi

**Qui a déclenché la suppression.** Trois hypothèses restent ouvertes, aucune n'est prouvée :

| Hypothèse | Pour | Contre |
|---|---|---|
| **A. Un geste humain** : « Tout sélectionner » puis « Retirer », confirmé | le chemin existe, une confirmation est demandée mais ne dit pas « toute votre bibliothèque » ; la liste étant filtrée, on peut sélectionner « tout » sans mesurer | 497 séries d'un coup est un geste inhabituel ; le doublon d'événements (≈ ×2) évoque deux boucles |
| **B. Un test ou un script lancé contre le serveur réel** | `playwright.config.js` fixe `reuseExistingServer: !process.env.CI` sur le port **8088** : si un serveur de dev tourne, la suite e2e s'y branche — avec `LOCAL_MODE=1`, donc **sur la vraie base** ; la table `users` contient **25 comptes de test** (`TestUser`, `Otaku2…9`, `preview`, `spotitest`…) : des suites ont déjà écrit dans cette base | aucun scénario e2e ne supprime en masse (`grep` sur `test/e2e`) |
| **C. Une session de développement assistée** (un script de nettoyage ou de capture exécuté contre la base réelle) | la fenêtre de 2 minutes ressemble à un script ; `source: NULL` indique un appel direct à l'API sans le contexte du lecteur | aucun commit ni script correspondant dans l'historique |

> **La réponse honnête à « pourquoi » est donc : parce que le serveur n'a aucune raison de refuser — et on ne sait pas encore qui a demandé.** Le correctif n'a pas besoin de la réponse pour être efficace : il doit rendre l'événement **impossible sans intention explicite** et **réversible quoi qu'il arrive** (DAT-01, DAT-02, DAT-03).

#### Ce qui a déjà été fait

- Les 495 favoris ont été **restaurés** depuis la sauvegarde du 8 novembre (la bibliothèque compte 521 favoris aujourd'hui, ajouts postérieurs inclus).
- `Storage.cacheLibrary` refuse désormais d'écraser un miroir local garni par une liste vide (`assets/js/storage.js`, **modification non encore commitée**). Ce garde-fou protège la copie locale ; il **ne protège pas la base**.

#### Ce qu'il faut faire

| ID | Correctif | Effort |
|---|---|---|
| **DAT-01** 🔴 | **Corbeille 30 jours** : `favorites.deleted_at` au lieu de `DELETE` ; liste « Récemment retirés » dans Paramètres ; purge à 30 jours. **Plafond serveur** : au-delà de 20 retraits en 10 s pour un compte → `429` + en-tête de confirmation explicite. **Sauvegarde automatique** avant toute suppression ≥ 10 éléments. | M |
| **DAT-02** 🟠 | **Origine des événements** : `events.device_id`, `events.user_agent` (tronqué), `events.ip` (hachée), `events.origin` (`ui`/`api`/`import`/`test`). Aujourd'hui `metadata` est `NULL` : impossible de répondre à « qui ? » la prochaine fois. | S |
| **DAT-03** 🟠 | **Suppression en masse atomique et annulable** : `POST /me/favorites/bulk-remove {ids}` → une transaction, un événement `bulk_unfavorite {n, ids}`, une réponse `{undoToken}` valable 30 s ; la barre « N séries retirées — Annuler ». Le libellé de confirmation doit dire **« N séries sur N »** quand la sélection couvre toute la bibliothèque. | M |
| **DAT-04** 🟠 | **Isoler les tests de la vraie base** : refuser `reuseExistingServer` si la base n'est pas `inko_e2e*` ; le serveur lancé par Playwright doit **forcer** `DB_NAME` et refuser de démarrer si `NODE_ENV=test` pointe sur `inko`. Les 25 comptes de test dans la base réelle sont la preuve que l'isolation n'a pas tenu. | S |
| **DAT-05** 🟡 | **Purger les 25 comptes de test** de la base réelle (après sauvegarde) ; garder `id 26`. | S |
| **DAT-06** 🟡 | **Sauvegarde déclenchée par l'événement**, pas seulement par l'horloge : à la fermeture de l'app, avant migration, avant import, avant suppression en masse. Aujourd'hui, un PC éteint la nuit = pas de sauvegarde. | S |

**Critère d'acceptation** : la sonde `flux-ecriture` ne signale plus `FLUX-SUPPRESSION-MASSE` ; supprimer 300 favoris en boucle produit des `429`, et la corbeille les restitue.

---

### 3.2 « Les covers manquantes, ça ne fait pas sérieux »

#### Ce qui est mesuré

La sonde `couvertures` tire **80 couvertures réelles** de la bibliothèque et les demande au proxy d'images, hôte par hôte :

| Hôte de la couverture | Favoris concernés | Résultat |
|---|---:|---|
| `temp.compsci88.com` (WeebCentral) | 374 | ✅ **59 / 59** |
| `chireads.com` | 9 | ✅ 2 / 2 |
| `uploads.mangadex.org` | 31 | ❌ **0 / 6** — réponse 502 |
| `sushiscan.fr` | 83 | ❌ **0 / 12** — réponse 502 |
| `novelfull.com` | 3 | ❌ 0 / 1 |
| `www.gutenberg.org` | 2 | ❌ HTML au lieu d'une image (site en 503) |

→ **≈ 22 % des favoris (117 sur 521 : 83 SushiScan + 31 MangaDex + 3 NovelFull) ont une couverture qui ne s'affiche pas — l'échantillon de 80 en mesure {{mesure:couvertures.couvertures_taux_echec_pct}} % — et c'est entièrement déterminé par l'hôte** : toutes celles de trois sources, aucune des autres. Ce n'est pas du hasard, donc **c'est réparable de façon déterministe**. En plus, **18 favoris n'ont aucune URL de couverture enregistrée**.

#### Pourquoi ces trois hôtes échouent

- **`uploads.mangadex.org`** : derrière un défi anti-bot (réponse HTML au lieu de l'image, journalisée par le proxy). C'est le CDN, pas l'API : l'API MangaDex répond, et expose les liens d'agrégateurs (`al` = AniList, `kt` = Kitsu, `mal`).
- **`sushiscan.fr`** : **certificat TLS expiré le 21 novembre** (établi le 25) — toute connexion échoue. Le même site répond sur `sushiscan.net` (EXT-01, corrigé).
- **`novelfull.com`** : idem, une seule œuvre.

#### Ce que le code fait aujourd'hui

Le travail déjà livré (« un dessin au lieu d'une lettre », disjoncteur par hôte) **rend l'échec propre** : plus de lettre, un livre dessiné, et l'hôte en panne n'est plus martelé. C'est une amélioration réelle de l'*affichage de l'échec*. **Il n'y a toujours aucune tentative de trouver l'image ailleurs.** L'utilisateur voit donc un joli placeholder au lieu d'une couverture : « ça ne fait pas sérieux » reste vrai.

#### Plan de correction (COV-01 à COV-06)

| ID | Correctif | Effort |
|---|---|---|
| **COV-01** 🔴 | **Repli par œuvre dans le proxy** (`image.controller.js`, après l'échec de l'hôte d'origine). Ordre : 1) **API MangaDex** (`/manga/{id}?includes[]=cover_art`, ou `/cover?manga[]=`) pour les œuvres MangaDex ; 2) **AniList** par titre (GraphQL `Media(search:…, type: MANGA){coverImage{extraLarge large}}`) — déjà utilisé ailleurs dans l'app ; 3) **Kitsu** (`/manga?filter[text]=` — mesuré 200 JSON) ; 4) **Open Library** (`covers.openlibrary.org`) pour les livres ; 5) le dessin. Cache disque de la correspondance `titre → URL trouvée`, concurrence limitée à 3, délai de 4 s par maillon. | M |
| **COV-02** 🔴 | **Écrire le résultat en base** : quand un repli réussit, `UPDATE favorites SET cover = ? WHERE …` — la recherche n'a lieu **qu'une fois par œuvre**, et la bibliothèque devient autonome (les 18 favoris sans URL se remplissent aussi). | S |
| **COV-03** 🟠 | **Tâche de fond de réparation** : au démarrage et après chaque scan, parcourir les favoris dont la couverture est absente ou connue morte, 3 à la fois, jusqu'à 50 par passe ; journaliser dans la page Système (« 31 couvertures réparées »). | M |
| **COV-04** 🟠 | **Cache des images lui-même** : `cache-img` est un cache *d'URL* ; garder aussi les octets des couvertures de la bibliothèque (≈ 40 Ko × 521 ≈ 20 Mo) pour que la bibliothèque s'affiche **même quand tous les sites sont tombés** et **hors ligne**. | M |
| **COV-05** 🟡 | **Affichage** : réserver le ratio (`aspect-ratio: 2/3`) pour éviter le décalage ; fondu à l'arrivée ; un seul `onerror` (pas de boucle) ; `loading="lazy"` + `decoding="async"`. Le placeholder dessiné reste en **dernier** recours. | S |
| **COV-06** 🟡 | **Sonde permanente** : intégrer `couvertures` à `sources-health.yml` ; seuil d'alerte à 5 % d'échec. | S |

**Critère d'acceptation** : la sonde `couvertures` mesure **< 3 %** d'échec sur 80 œuvres tirées au hasard, et **0** favori sans URL.

