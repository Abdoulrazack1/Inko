### 1.5 Avancement au 25 novembre (branche `audit/s0-s1`, non commitée)

> Les chiffres du reste du document décrivent l'état **avant** ces corrections (relevés du 24 novembre). Ce tableau dit ce qui a été fait depuis, et comment cela a été vérifié.

**Vérifications** : 1 008 tests du front et 300 du serveur au vert (0 échec) · OpenAPI, précache, métadonnées, Android 8, changelog des extensions : à jour · parcours complets dans un vrai navigateur sur **serveur et base jetables** (la base réelle n'a pas été migrée).

| Point | Fait | Preuve |
|---|---|---|
| **DAT-01** Corbeille 30 j, plafond | Table `favorites_corbeille` (migration 28), purge quotidienne ; au-delà de 20 retraits à l'unité en 10 s → `429` | `corbeille.test.js` rejoue la boucle : 20 acceptés, 40 refusés |
| **DAT-02** Origine des événements | `events.origine` (client · navigateur · local/réseau · automate) | base d'essai : `web · Chrome/153 · local · automate` |
| **DAT-03** Retrait en lot annulable | `POST /me/favorites/bulk-remove` atomique, nombre à confirmer, « TOUTE ta bibliothèque », barre **Annuler** ; mode autonome Android compris | navigateur : 36 retirées → 0, **Annuler** → 36 |
| **DAT-06** (partiel) | Sauvegarde `inko-avant-retrait-…` avant tout lot ≥ 10, rotation à part ; refus si elle échoue | `corbeille.test.js` |
| **DAT-04** Tests isolés | e2e : base `inko_e2e` préparée à la volée, port 8187, aucun serveur repris | `serveur-sous-test.spec.js` au vert |
| **SEC-01** CORS | Fermé par défaut ; `/auth/local` refuse toute origine tierce | page tierce : **403**, aucun `Access-Control-Allow-Origin` |
| **SEC-02** Fichiers servis | Liste blanche (pages, `assets/`, manifeste, service worker) | `/package.json`, `/docs/…`, `/server/.env` : **404** |
| **SEC-04** Adresses de couverture | `javascript:`, `data:text/html`… refusées à l'écriture et à l'import | `fermeture.test.js` |
| **API-01** Import | Forme validée : `400` avec le champ en cause | `corbeille.test.js` |
| **UPD-01** Écouteurs d'abord | Bibliothèque et Journal branchés avant tout appel réseau | sonde `ecouteurs` : plus signalés |
| **UPD-02/03/04/05** Bouton | Compteur dans le bouton, bilan hors du flux, injoignables annoncés, vérification automatique silencieuse | sonde `boutons` : retour en **1 ms** (7 à 20 s avant), décalage **0 px** (208 avant) |
| **UPD-06** Un bouton, un sens | « Vérifier les chapitres » | — |
| **COV-01/02** Couvertures | Réparation automatique : adresse actuelle → source → identifiant MangaDex→AniList → titre AniList (comparaison sévère), vérifiée puis enregistrée | vrais favoris morts copiés : **0 → 18 / 20** en une minute |
| **EXT-01** SushiScan | Passé à `sushiscan.net` (1.2.0) — **cause : certificat de `sushiscan.fr` expiré le 21 novembre** | en direct : recherche, fiche, 9 tomes, 194 planches, couverture |
| **EXT-07**, **API-11** | `versions.json` et version du serveur alignés (correcteurs) | `npm run gen-ext-hashes`, gardes au vert |

**Restent, dans S0/S1** : DAT-05 (purger les 25 comptes de test **de votre base** — attend votre accord) · DAT-06 complet (sauvegarde avant migration, à la fermeture) · COV-03/04/05 (réparation de fond, octets en cache, ratios réservés) · UPD-07/08 · A11Y (reste du §8).

**Deux affirmations de la première version, corrigées** : les événements **sont** purgés après 400 jours (DAT-07) ; `lecture.js` signalé par la sonde `ecouteurs` est un **faux positif** (l'attente est dans la branche hors ligne).
