// ecouteurs — les boutons de la page sont-ils branchés AVANT d'attendre le réseau ?
// ------------------------------------------------------------
// Le défaut du §3.3 : `await loadLibrary()` (jusqu'à 40 appels vers des sources
// externes) précède `wireLibRefresh()` — tant que le réseau n'a pas répondu, le
// bouton n'a aucun écouteur. Cette sonde cherche le même motif partout :
// dans un gestionnaire DOMContentLoaded (ou une fonction init), un `await` sur un
// appel réseau placé AVANT des appels de branchement (wire*, bind*, addEventListener).
'use strict';
const path = require('path');

const ATTENTE_RESEAU = /await\s+(?:[\w.]*\bAPI\b[\w.]*|[\w.]*(?:load|charger|fetch|get|scan|refresh|init)[A-Za-z]*)\s*\(/;
const BRANCHEMENT = /\b(?:wire\w*|bind\w*|brancher\w*|init(?:Tabs|Filters|Select|Menu|Events)\w*)\s*\(|\.addEventListener\(\s*['"]click/;

module.exports = {
    nom: 'ecouteurs',
    description: 'Contrôles branchés après une attente réseau (boutons inertes pendant le chargement)',
    async run(ctx) {
        const fichiers = [...ctx.parcourir(ctx.abs('assets', 'js'), ctx.ext('.js'))].filter(p => !/vendor|\.min\./.test(p));
        const resultats = [];
        for (const p of fichiers) {
            const t = ctx.lire(p), r = ctx.rel(p);
            const lignes = t.split('\n');
            // blocs candidats : DOMContentLoaded async, ou fonction init/boot async
            const re = /(DOMContentLoaded['"],\s*async|async function (?:init|boot|demarrer|main)\w*\s*\()/g;
            let m;
            while ((m = re.exec(t))) {
                const debut = ctx.ligneDe(t, m.index);
                // le bloc court jusqu'à la première ligne `});` ou `}` au même retrait
                const indent = (lignes[debut - 1].match(/^\s*/) || [''])[0].length;
                let fin = Math.min(lignes.length, debut + 120);
                for (let i = debut; i < Math.min(lignes.length, debut + 160); i++) { if (/^\s*\}\)?;?\s*$/.test(lignes[i]) && (lignes[i].length - lignes[i].trimStart().length) <= indent) { fin = i + 1; break; } }
                let premiereAttente = null;
                for (let i = debut; i < fin; i++) {
                    const L = lignes[i];
                    if (/^\s*\/\//.test(L)) continue;
                    if (premiereAttente === null && ATTENTE_RESEAU.test(L) && !/API\.(isLoggedIn|ready)|API\?\.ready|window\.API\?\.ready/.test(L) && !/UserData\??\.ready|loadSourceTypes/.test(L)) premiereAttente = i + 1;
                    if (premiereAttente !== null && i + 1 > premiereAttente && BRANCHEMENT.test(L)) {
                        const apres = [];
                        for (let k = i; k < fin; k++) if (BRANCHEMENT.test(lignes[k]) && !/^\s*\/\//.test(lignes[k])) apres.push(lignes[k].trim().replace(/\s+/g, ' ').slice(0, 60));
                        resultats.push({ fichier: r, attente: premiereAttente, ligneAttente: lignes[premiereAttente - 1].trim().slice(0, 90), branchements: apres.length, exemples: apres.slice(0, 5), premierBranchement: i + 1 });
                        break;
                    }
                }
            }
        }
        ctx.mesure('ecouteurs_apres_attente', resultats.map(x => `${x.fichier}:${x.attente} → ${x.branchements} branchement(s) après`));
        for (const x of resultats) {
            ctx.trouver({
                gravite: x.branchements >= 4 ? 'haute' : 'moyenne', id: 'ECOUTEURS-APRES-ATTENTE', categorie: 'bug',
                titre: `${path.basename(x.fichier)} : ${x.branchements} branchement(s) de contrôles APRÈS \`${x.ligneAttente}\` — les boutons sont inertes tant que le réseau n'a pas répondu`,
                fichier: x.fichier, ligne: x.attente,
                detail: `Attente ligne ${x.attente}, premier branchement ligne ${x.premierBranchement}.\nBranchés en retard : ${x.exemples.join(' · ')}`,
                correctif: 'Brancher les écouteurs (ils ne dépendent que du DOM statique) AVANT l\'attente, ou déléguer l\'événement sur le conteneur ; lancer le chargement sans `await` et re-rendre à l\'arrivée des données.', effort: 'S',
            });
        }
    },
};
