#!/usr/bin/env node
// ============================================================
// sondes/lancer.js — exécute les sondes d'audit
// ------------------------------------------------------------
//   node scripts-ci/sondes/lancer.js                 # toutes les sondes
//   node scripts-ci/sondes/lancer.js securite,sql    # certaines
//   node scripts-ci/sondes/lancer.js --liste         # lister
//   INKO_URL=http://localhost:8088 …                 # sondes dynamiques
//
// Sortie : docs/audit/sondes.json (résultats bruts). Les sondes LISENT :
// aucune n'écrit dans le dépôt ni dans la vraie base. Les corrections
// vivent à part (correcteurs/) et sont pilotées par strategie.js.
// ============================================================
'use strict';
const fs = require('fs');
const path = require('path');
const C = require('./_commun');

const SONDES = ['structure', 'ecouteurs', 'securite', 'routes', 'sql', 'erreurs', 'a11y-html', 'css', 'i18n', 'perf-statique',
    'code-mort', 'dependances', 'tests', 'plateformes', 'docs', 'ci', 'extensions', 'donnees', 'couvertures', 'api-acces', 'api-contrat', 'flux-ecriture', 'boutons', 'pages',
    'analyse', 'references', 'certificats', 'securite-dyn', 'integrite', 'xss', 'chaos', 'parcours', 'interaction', 'lecteur', 'mobile', 'charge', 'imports', 'modes', 'hors-ligne', 'livraison', 'mise-a-niveau', 'exactitude', 'appareils', 'administration', 'resilience', 'vie-privee', 'adaptabilite', 'licences', 'autonome', 'filtre-adulte', 'exposition', 'nouveautes', 'migration', 'base-embarquee', 'coquille', 
        'ux-coherence', 'ux-ecrans', 'ux-navigation', 'ux-parcours', 'ux-retour', 'ux-redaction', 'ux-visuel'];
const DYNAMIQUES = new Set(['extensions', 'donnees', 'couvertures', 'api-acces', 'api-contrat', 'flux-ecriture', 'boutons', 'pages', 'references', 'certificats', 'securite-dyn', 'integrite', 'xss', 'chaos', 'parcours', 'interaction', 'lecteur', 'mobile', 'charge', 'imports', 'modes', 'hors-ligne', 'livraison', 'mise-a-niveau', 'exactitude', 'appareils', 'administration', 'resilience', 'vie-privee', 'adaptabilite', 'licences', 'autonome', 'filtre-adulte', 'exposition', 'nouveautes', 'migration', 'base-embarquee', 'coquille', 'ux-coherence', 'ux-ecrans', 'ux-navigation', 'ux-parcours', 'ux-retour', 'ux-redaction', 'ux-visuel']);
const ORDRE = { critique: 0, haute: 1, moyenne: 2, basse: 3, info: 4 };

/** Exécute des sondes et rend { date, sondes, trouvailles }. */
async function executerSondes(noms, { silencieux = false } = {}) {
    const sortie = { date: new Date().toISOString(), sondes: {}, trouvailles: [] };
    for (const nom of noms) {
        let sonde;
        try { sonde = require('./' + nom); } catch (e) { if (!silencieux) console.log(`✗ ${nom} : introuvable (${e.message.split('\n')[0]})`); continue; }
        const ctx = C.creerContexte(nom);
        const t0 = Date.now();
        try { await sonde.run(ctx); } catch (e) {
            ctx.trouver({ gravite: 'info', id: 'SONDE-PLANTEE', titre: `La sonde « ${nom} » a planté : ${e.message}`, detail: String(e.stack).split('\n').slice(0, 5).join('\n') });
        }
        const par = {};
        ctx.trouvailles.forEach(f => { par[f.gravite] = (par[f.gravite] || 0) + 1; });
        sortie.sondes[nom] = { description: sonde.description, ms: Date.now() - t0, mesures: ctx.mesures, nombre: ctx.trouvailles.length, parGravite: par };
        sortie.trouvailles.push(...ctx.trouvailles);
        if (!silencieux) console.log(`✓ ${nom.padEnd(14)} ${String(ctx.trouvailles.length).padStart(4)} trouvaille(s)  ${JSON.stringify(par)}  ${Date.now() - t0} ms`);
    }
    sortie.trouvailles.sort((a, b) => ORDRE[a.gravite] - ORDRE[b.gravite]);
    return sortie;
}

function ecrire(sortie, nomFichier) {
    const dossier = path.join(C.RACINE, 'docs', 'audit');
    fs.mkdirSync(dossier, { recursive: true });
    const cible = path.join(dossier, nomFichier);
    fs.writeFileSync(cible, JSON.stringify(require('./_propre').nettoyer(sortie), null, 1));
    return cible;
}

module.exports = { SONDES, DYNAMIQUES, ORDRE, executerSondes, ecrire };

if (require.main === module) (async () => {
    const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
    if (process.argv.includes('--liste')) {
        for (const n of SONDES) { try { const s = require('./' + n); console.log(n.padEnd(14), s.description); } catch (e) { console.log(n.padEnd(14), '(absente)'); } }
        return;
    }
    const noms = args[0] ? args[0].split(',') : SONDES;
    const sortie = await executerSondes(noms);
    const cible = ecrire(sortie, args[0] ? 'sondes-partiel.json' : 'sondes.json');
    const total = {};
    sortie.trouvailles.forEach(f => { total[f.gravite] = (total[f.gravite] || 0) + 1; });
    console.log(`\n${sortie.trouvailles.length} trouvaille(s) au total`, total, '→', C.rel(cible));
})();
