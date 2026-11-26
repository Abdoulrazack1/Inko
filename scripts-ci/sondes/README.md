# Sondes, correcteurs et stratégie

Outillage d'audit **reproductible** d'Inko : on **mesure** au lieu de supposer, on **corrige** ce qui est mécanique, on **vérifie**, on **compare**, on **rapporte**.

```
SONDER → PLANIFIER → CORRIGER → VÉRIFIER → COMPARER → RAPPORTER
```

| Commande | Effet |
|---|---|
| `npm run sondes` | toutes les sondes (serveur de dev sur `:8088` requis pour les dynamiques) |
| `npm run sondes:statique` | sondes **statiques seulement** (≈ 20 s, aucun serveur) — adapté à la CI |
| `node scripts-ci/sondes/lancer.js --liste` | liste les sondes |
| `node scripts-ci/sondes/lancer.js securite,css` | certaines sondes |
| `BOUTONS_PAGES=bibliotheque.html node scripts-ci/sondes/lancer.js boutons` | le peigne fin sur une page |
| `node scripts-ci/sondes/strategie.js --appliquer` | applique les correcteurs de risque **nul** (refuse sur `main`) |
| `node scripts-ci/sondes/strategie.js --appliquer --risque=faible` | + risque faible (`moyen` : opt-in) |
| `node scripts-ci/sondes/fusionner.js docs/audit/sondes-boutons.json` | fusionne une passe partielle dans `sondes.json` |
| `node scripts-ci/sondes/pages-md.js` | génère la partie « page par page » et l'inventaire des contrôles |
| `node scripts-ci/sondes/rapport.js` | génère `docs/audit/ANNEXE-SONDES.md` |
| `node scripts-ci/sondes/assembler-audit.js` | assemble `docs/AUDIT-2026-11-24.md` depuis `docs/audit/parties/` |

## Campagne complète et expérience

| Commande | Effet |
|---|---|
| `npm run sondes:campagne` | toutes les sondes, par couloirs parallèles, sur des serveurs et bases jetables (≈ 45 min) |
| `node scripts-ci/sondes/campagne.js xss,lecteur` | rejoue ces sondes et les refond dans `docs/audit/sondes.json` |
| `npm run ux` | sondes d'expérience, notes sur dix dimensions, plan en quatre vagues (`docs/ux/`) |
| `npm run ux:barriere` | échoue si une note perd plus de 3 points ou si un défaut grave apparaît |
| `npm run ux -- --reference` | accepte l'état actuel, captures comprises |

La stratégie est dans [`docs/ux/STRATEGIE-UX.md`](../../docs/ux/STRATEGIE-UX.md). Les relevés vérifiés et reconnus sans objet sont listés, avec leur raison, dans `triage.js`.

## Les garanties

- **Les sondes lisent.** Aucune ne doit écrire dans le dépôt ni dans la vraie base (`SELECT` seulement ; `SET SESSION TRANSACTION READ ONLY`).
- **Tout script SQL chargé passe par `_garde-sql.js`.** Il retire les ordres qui désignent une base (`USE`, `CREATE DATABASE`…) et refuse le script s'il en reste. Incident du 25/11/2026 : l'ancien `schema.sql` de la v2.3.4 commence par `USE inko;` ; chargé tel quel par `mise-a-niveau`, il a créé une table vide `library` dans la vraie base (données intactes, vérifié en lecture seule). Ne jamais charger un `.sql` sans ce filtre.
- **Les parcours d'écriture tournent sur des bases jetables** (`inko_sonde`, `inko_sonde_b`), créées puis détruites, sur d'autres ports (8097, 8096) — jamais sur `inko`.
- **Le navigateur de la sonde ne sort pas** : ses requêtes externes sont bloquées et comptées (vie privée). Les routes qui écrivent des fichiers de configuration (`/auth/google-config`, `/anilist/config`, `/app/update`, installation d'extensions) sont interceptées.
- **Les correcteurs sont idempotents, honnêtes (`plan` = ce que fait `appliquer`) et respectent les fins de ligne** — `test/unit/sondes-correcteurs.test.js` le vérifie sur une copie jetable (`SONDES_RACINE`).
- **`--appliquer` refuse de tourner sur `main`**, ne touche **jamais** un fichier déjà modifié, lance les suites de tests ensuite et **restaure** les fichiers au premier échec.

## Les sondes

Statiques : `structure`, `securite`, `routes`, `sql`, `erreurs`, `a11y-html`, `css`, `i18n`, `perf-statique`, `code-mort`, `dependances`, `tests`, `plateformes`, `docs`, `ci`.
Dynamiques : `extensions` (bac à sable de chaque source), `donnees` (base réelle, lecture seule), `couvertures`, `api-acces`, `api-contrat`, `flux-ecriture` (base jetable), `boutons` (chaque contrôle de chaque page, base jetable), `pages` (26 pages, axe-core, CLS, LCP).

Seconde passe : `analyse` (ESLint strict), `references` (appels, routes, identifiants et fichiers qui pointent dans le vide), `certificats`, `securite-dyn` (attaques jouées), `integrite` (sauvegarde, export, effacement, concurrence, migrations), `xss`, `chaos` (pannes d'API), `parcours` (compte vide, largeurs, thème clair, anglais), `interaction` (clavier, fenêtres, saisies), `lecteur`, `mobile`, `charge` (2 000 et 10 000 favoris, fuites).

Expérience : `ux-coherence`, `ux-ecrans`, `ux-navigation`, `ux-parcours`, `ux-retour`, `ux-redaction`, `ux-visuel`.

> `securite-dyn` joue une prise de compte et `integrite` vide des tables : toujours sur des bases créées pour l'occasion puis détruites. La seule lecture de la base réelle porte sur sa structure et des comptes de lignes.

## Ajouter une sonde

```js
// scripts-ci/sondes/ma-sonde.js
module.exports = {
    nom: 'ma-sonde',
    description: 'Ce qu\'elle examine, en une ligne',
    async run(ctx) {
        // ctx.lire(chemin) · ctx.parcourir(dossier, filtre) · ctx.chercher(texte, regex, cb)
        ctx.mesure('ma_mesure', 42);
        ctx.trouver({ gravite: 'haute', id: 'MA-SONDE-ID', categorie: 'bug',
            titre: 'Ce qui ne va pas', fichier: 'chemin', ligne: 12,
            detail: 'la preuve', correctif: 'quoi faire', effort: 'S' });
    },
};
```

Puis l'ajouter à `SONDES` dans `lancer.js` (et à `DYNAMIQUES` si elle exige un serveur).

## Ajouter un correcteur

Voir `correcteurs/index.js` : `parTransformation({ nom, risque, couvre, fichiers, transformer })` pour un changement de texte, `parGenerateur({ … })` pour relancer un script `gen-*`. Toujours : idempotent, un test dans `sondes-correcteurs.test.js`.
