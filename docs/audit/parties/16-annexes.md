## 17. Annexes

### 17.1 Rejouer l'audit

Tout ce document est **reproductible** :

```powershell
# 1. lancer le serveur de développement (port 8088) — la base réelle n'est lue qu'en SELECT
node server/server.js

# 2. sonder : sondes statiques + dynamiques, lecture seule, écrit docs/audit/sondes.json
node scripts-ci/sondes/strategie.js

# 3. régénérer l'annexe brute et le document
node scripts-ci/sondes/rapport.js
node scripts-ci/sondes/assembler-audit.js
```

| Commande | Effet |
|---|---|
| `node scripts-ci/sondes/lancer.js --liste` | liste les sondes |
| `node scripts-ci/sondes/lancer.js securite,css` | certaines sondes seulement |
| `… strategie.js --sans-dynamiques` | **sondes statiques uniquement** (pas de serveur nécessaire ; durée ≈ 20 s ; convient à la CI) |
| `BOUTONS_PAGES=bibliotheque.html node scripts-ci/sondes/lancer.js boutons` | le peigne fin sur une seule page |
| `… strategie.js --appliquer` | applique les **correcteurs de risque nul** (refuse sur `main`) |
| `… strategie.js --appliquer --risque=faible` | + correcteurs de risque faible |
| `… strategie.js --appliquer --risque=moyen --sans-tests` | tous, sans lancer les suites (déconseillé) |

**Garanties** : les sondes **lisent** ; les parcours d'écriture et le peigne fin tournent sur des **bases jetables** (`inko_sonde`, `inko_sonde_b`) créées puis détruites, sur d'autres ports (8097, 8096) ; le navigateur de la sonde **n'appelle aucun site externe** (les requêtes sont bloquées et comptées) ; les routes qui écrivent des fichiers de configuration (`/auth/google-config`, `/anilist/config`, `/app/update`, installation d'extensions) sont **interceptées**.

### 17.2 La stratégie en six temps

```
SONDER → PLANIFIER → CORRIGER → VÉRIFIER → COMPARER → RAPPORTER
```

1. **Sonder** : {{nb-sondes}} sondes, résultats dans `docs/audit/sondes.json`.
2. **Planifier** : chaque correcteur déclare ce qu'il changerait (`plan`), sans rien écrire.
3. **Corriger** (`--appliquer`) : refus sur `main`/`master` ; un fichier déjà modifié n'est **jamais** touché ; écriture atomique ; respect des fins de ligne.
4. **Vérifier** : suites de tests du front et du serveur ; au premier échec, **les fichiers touchés sont restaurés** (`git checkout`).
5. **Comparer** : les sondes sont rejouées ; le delta par identifiant est affiché.
6. **Rapporter** : `sondes.json`, `ANNEXE-SONDES.md`, `strategie.json`.

### 17.3 Les correcteurs

| Correcteur | Traite | Risque | Effet |
|---|---|:-:|---|
| `noopener` | `SEC-NOOPENER` | nul | `rel="noopener noreferrer"` sur les liens `target=_blank` |
| `lang` | `A11Y-LANG` | nul | `lang="fr"` sur `<html>` |
| `openapi` | `RTE-OPENAPI-DERIVE` | nul | régénère `server/openapi.json` |
| `precache` | `PERF-PRECACHE-DERIVE` | nul | régénère la liste de précache du service worker |
| `meta` | `DOC-CHIFFRE-PERIME` | nul | régénère les métadonnées dérivées |
| `mouvement-reduit` | `A11Y-REDUCED-MOTION` | faible | bloc `@media (prefers-reduced-motion: reduce)` dans `global.css` |
| `vh-dvh` | `CSS-100VH` | faible | repli `100dvh` après `100vh` (Android 8 l'ignore, les autres l'appliquent) |
| `versions` | `DEP-VERSION-DERIVE` | faible | aligne `server/package.json` et son verrou sur la racine (**API-11**) |
| `versions-extensions` | `EXT-VERSIONS-JSON-PERIME` | faible | aligne `extensions-community/versions.json` sur les `index.js` (**EXT-07**) |
| `allowbackup` | `PLT-ALLOWBACKUP` | moyen | `android:allowBackup="false"` (**MOB-01**) |
| `ci-permissions` | `CI-PERMISSIONS` | moyen | `permissions: contents: read` sur `ci.yml` (**CI-02**) |
| `catch-muet` | `ERR-CATCH-MUET` | moyen | trace les `catch {}` muets du front via `MH.err` |

**Au {{date}}**, la planification à sec indique ce qui serait appliqué sans rien toucher : `noopener` (1 fichier), `precache`, `vh-dvh` (2), `versions` (2), `allowbackup` (1), `ci-permissions` (1). Les correcteurs ne couvrent que le **mécanique** : tout le reste de ce document demande du jugement.

### 17.4 Correspondance sonde → point d'audit

| Identifiant de sonde | Point d'audit |
|---|---|
| `FLUX-SUPPRESSION-MASSE`, `DATA-SUPPRESSION-MASSE` | §3.1 · DAT-01 à DAT-06 |
| `COUV-HOTE-EN-PANNE`, `DATA-COUVERTURES-VIDES`, `PAGE-IMAGES-CASSEES` | §3.2 · COV-01 à COV-06 |
| `MAJ-*`, `BTN-MORT` (bibliothèque), `CONTRAT-TIMEOUT` (`/me/updates`) | §3.3 · UPD-01 à UPD-09 |
| `ACCES-CORS-OUVERT`, `ACCES-CORS-PREFLIGHT` | SEC-01 |
| `ACCES-FICHIER-EXPOSE`, `ACCES-DEPOT-SERVI` | SEC-02 |
| `PLT-CSP-UNSAFE-INLINE`, `PLT-TAURI-*`, `ACCES-ENTETES` | SEC-03 |
| `FLUX-ETAPE-KO` (couverture `javascript:`) | SEC-04 |
| `SEC-FUITE-ERREUR` | SEC-05 |
| `RTE-SANS-LIMITEUR`, `FLUX-SUPPRESSION-MASSE` | SEC-06 |
| `CONTRAT-SANS-CACHE` | SEC-07 |
| `RTE-PARAMS-NON-VALIDES`, `SEC-SQL-*` | SEC-10 (+ triage) |
| `ECOUTEURS-APRES-ATTENTE` | UPD-01 (+ `notes.js`, `lecture.js`) |
| `SEC-XSS-CANDIDAT` | SEC-11 |
| `CI-ACTION-NON-EPINGLEE`, `CI-DEPENDABOT-ECOSYSTEME` | SEC-12 · CI-04, CI-05 |
| `SQL-SANS-TRANSACTION` | DAT-09 |
| `SQL-MIGRATION-DESTRUCTRICE`, `SQL-MIGRATIONS-TROUS` | DAT-11 |
| `FLUX-ETAPE-KO` (import 500) | API-01 |
| `CONTRAT-LENT` / `CHARGE-DEGRADEE` / durées externes | API-03 |
| `SQL-N-PLUS-1` | API-06 |
| `RTE-CORPS-12MO` | API-07 |
| `ERR-CONSOLE-LOG-SERVEUR` | API-08 |
| `DEP-VERSION-DERIVE` | API-11 · DEP-01 |
| `DOC-ENV-NON-DOCUMENTEES` | API-13 · DOC-02 |
| `PERF-PAS-MINIFIE` | PER-01 |
| `PERF-SCRIPTS-BLOQUANTS` | PER-02 |
| `PAGE-CLS` | PER-03 |
| `PAGE-DOM-LOURD`, `PAGE-TACHES-LONGUES` | PER-04, PER-07 |
| `CSS-LOURDE`, `CSS-CLASSES-MORTES` | PER-06 |
| `AXE-COLOR-CONTRAST` | A11Y-01 |
| `A11Y-LIEN-EVITEMENT` | A11Y-02 |
| `AXE-LINK-NAME` | A11Y-03 |
| `A11Y-TITRE`, `A11Y-H1` | A11Y-04 |
| `A11Y-CHAMP-SANS-LABEL` | A11Y-05 |
| `AXE-SCROLLABLE-REGION-FOCUSABLE` | A11Y-06 |
| `A11Y-DIV-CLIQUABLE-JS` | A11Y-07 |
| `AXE-LINK-IN-TEXT-BLOCK` | A11Y-09 |
| `PAGE-CIBLES-PETITES`, `BTN-CIBLE-PETITE` | A11Y-10 |
| `I18N-*` | I18N-01 à I18N-04 |
| `EXT-CHAINE-CASSEE`, `EXT-CATALOGUE-*` | EXT-01 à EXT-08 |
| `EXT-VERSIONS-JSON-PERIME` | EXT-07 |
| `TEST-SOURCE-GREP` | TST-01 |
| `TEST-ROUTES-NON-APPELEES` | TST-02 |
| `TEST-SERVEUR-NON-TESTE` | TST-07 |
| `PLT-ALLOWBACKUP`, `PLT-CLEARTEXT`, `PLT-MIXED-CONTENT` | MOB-01 à MOB-03 |
| `STR-GROS`, `STR-FONCTION` | ARC-01 à ARC-03 |
| `MORT-*` | ARC-07 |
| (lecture du code : `systeme.html` liée au pied de page) | ARC-10 |
| `DOC-CAPTURES-ORPHELINES` | DOC-01 |
| `DOC-COMMUNAUTE` | DOC-03 |

### 17.5 Fichiers produits

| Fichier | Contenu |
|---|---|
| `docs/AUDIT-2026-11-24.md` | **ce document** (assemblé) |
| `docs/audit/parties/*.md` | les parties rédigées, avec des jetons à doubles accolades pour tous les chiffres |
| `docs/audit/sondes.json` | résultats bruts de la dernière passe |
| `docs/audit/ANNEXE-SONDES.md` | **chaque trouvaille** avec preuve, correctif, effort (régénéré) |
| `docs/audit/inventaire-controles.json` | **chaque contrôle de chaque page** : libellé, taille, recouvrement, effet du clic |
| `docs/audit/captures/maj-*.jpg` | le scénario « Mettre à jour » à 0, 0,4, 2,9 et 8,9 s |
| `docs/audit/strategie.json` | journal de la dernière exécution de la stratégie |
| `scripts-ci/sondes/` | les sondes, les correcteurs, l'orchestrateur, le générateur de rapport |
