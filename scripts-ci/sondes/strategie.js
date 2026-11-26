#!/usr/bin/env node
// ============================================================
// sondes/strategie.js — l'orchestrateur de toute la stratégie
// ------------------------------------------------------------
//   SONDER → PLANIFIER → CORRIGER → VÉRIFIER → COMPARER → RAPPORTER
//
//   node scripts-ci/sondes/strategie.js                    # sonder + planifier (lecture seule)
//   node scripts-ci/sondes/strategie.js --appliquer        # + appliquer les correcteurs de risque « nul »
//   node scripts-ci/sondes/strategie.js --appliquer --risque=faible
//   node scripts-ci/sondes/strategie.js --sans-dynamiques  # ignore pages/extensions/données/couvertures
//   node scripts-ci/sondes/strategie.js --sondes=css,a11y-html
//   node scripts-ci/sondes/strategie.js --sans-tests       # n'exécute pas les suites après correction
//   node scripts-ci/sondes/strategie.js --sur-main         # autorise --appliquer sur main (déconseillé)
//
// Garanties :
//   · par défaut RIEN n'est modifié (hors docs/audit/) ;
//   · --appliquer refuse de tourner sur main/master ;
//   · un fichier déjà modifié dans l'arbre de travail n'est JAMAIS touché ;
//   · après correction, les suites de tests tournent ; au moindre échec les
//     fichiers touchés sont RESTAURÉS (git checkout) et le rapport le dit ;
//   · la comparaison avant/après rejoue les sondes et montre ce qui a bougé.
// ============================================================
'use strict';
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const C = require('./_commun');
const { SONDES, DYNAMIQUES, executerSondes, ecrire } = require('./lancer');
const { CORRECTEURS } = require('./correcteurs');
const { generer } = require('./rapport');

const argv = process.argv.slice(2);
const drapeau = (n) => argv.includes('--' + n);
const valeur = (n) => (argv.find(a => a.startsWith('--' + n + '=')) || '').split('=')[1];
const NIVEAUX = { nul: 0, faible: 1, moyen: 2 };
const RISQUE_MAX = NIVEAUX[valeur('risque') || 'nul'];
const git = (...a) => cp.spawnSync('git', a, { cwd: C.RACINE, encoding: 'utf8' });
const titre = (t) => console.log('\n' + '═'.repeat(64) + '\n  ' + t + '\n' + '═'.repeat(64));

function resume(sortie) {
    const par = {}; sortie.trouvailles.forEach(f => { par[f.id] = (par[f.id] || 0) + 1; });
    const gr = {}; sortie.trouvailles.forEach(f => { gr[f.gravite] = (gr[f.gravite] || 0) + 1; });
    return { total: sortie.trouvailles.length, parGravite: gr, parId: par };
}

(async () => {
    const t0 = Date.now();
    let noms = valeur('sondes') ? valeur('sondes').split(',') : SONDES;
    if (drapeau('sans-dynamiques')) noms = noms.filter(n => !DYNAMIQUES.has(n));
    const journal = { debut: new Date().toISOString(), options: argv, phases: {} };

    // ── 1. SONDER ────────────────────────────────────────────
    titre('1/6  SONDER');
    const avant = await executerSondes(noms);
    const rAvant = resume(avant);
    journal.phases.sonder = { sondes: noms, ...rAvant };
    ecrire(avant, 'sondes.json');

    // ── 2. PLANIFIER ─────────────────────────────────────────
    titre('2/6  PLANIFIER les correcteurs');
    const idsPresents = new Set(avant.trouvailles.map(f => f.id));
    const plans = [];
    for (const c of CORRECTEURS) {
        // un correcteur s'active si une trouvaille qu'il couvre existe… ou si son plan est non vide
        let plan = [];
        try { plan = await c.plan(); } catch (e) { console.log(`  ✗ ${c.nom} : plan impossible (${e.message})`); continue; }
        const concerne = c.couvre.some(i => idsPresents.has(i)) || plan.length > 0;
        const permis = NIVEAUX[c.risque] <= RISQUE_MAX;
        plans.push({ c, plan, concerne, permis });
        if (plan.length) console.log(`  ${permis ? '▶' : '·'} ${c.nom.padEnd(18)} risque ${c.risque.padEnd(6)} ${plan.length} fichier(s)  ${permis ? '' : '(niveau de risque non autorisé)'}  — ${c.description}`);
        else console.log(`  ✓ ${c.nom.padEnd(18)} rien à corriger`);
    }
    journal.phases.planifier = plans.map(p => ({ correcteur: p.c.nom, risque: p.c.risque, fichiers: p.plan.map(x => x.fichier), permis: p.permis }));

    // ── 3. CORRIGER ──────────────────────────────────────────
    let touches = [];
    if (!drapeau('appliquer')) {
        titre('3/6  CORRIGER — ignoré (lecture seule ; ajouter --appliquer)');
    } else {
        titre('3/6  CORRIGER');
        const branche = git('rev-parse', '--abbrev-ref', 'HEAD').stdout.trim();
        if (/^(main|master)$/.test(branche) && !drapeau('sur-main')) {
            console.log(`  ✗ branche « ${branche} » : crée d'abord une branche (git switch -c audit/corrections) ou passe --sur-main.`);
            process.exitCode = 2; journal.phases.corriger = { refus: 'branche protégée' };
        } else {
            const faits = [];
            for (const { c, plan, permis } of plans) {
                if (!plan.length || !permis) continue;
                const sales = plan.filter(x => !x.fichier.startsWith('(') && git('status', '--porcelain', '--', x.fichier).stdout.trim());
                if (sales.length) { console.log(`  ⚠ ${c.nom} : ${sales.length} fichier(s) déjà modifié(s) dans l'arbre de travail — correcteur sauté (${sales.map(s => s.fichier).join(', ')})`); continue; }
                try {
                    const r = await c.appliquer();
                    console.log(`  ✔ ${c.nom.padEnd(18)} ${r.length} fichier(s)`);
                    r.forEach(x => faits.push({ correcteur: c.nom, ...x }));
                } catch (e) { console.log(`  ✗ ${c.nom} : ${e.message}`); }
            }
            touches = [...new Set(faits.map(f => f.fichier).filter(f => !f.startsWith('(')))];
            // les générateurs peuvent toucher d'autres fichiers : on relit git
            const modifies = git('status', '--porcelain').stdout.split('\n').filter(Boolean).map(l => l.slice(3).replace(/"/g, ''));
            touches = [...new Set([...touches, ...modifies.filter(f => !/^docs\/audit\/|^scripts-ci\/sondes\//.test(f) && !/^(README\.md|assets\/js\/storage\.js|reponse-lilian\.md)$/.test(f) && !f.startsWith('assets/screenshots/') && f !== 'scripts-ci/captures-readme.js')])];
            journal.phases.corriger = { faits, fichiersTouches: touches };
        }
    }

    // ── 4. VÉRIFIER ──────────────────────────────────────────
    if (touches.length && !drapeau('sans-tests')) {
        titre('4/6  VÉRIFIER (suites de tests)');
        const lancer = (nom, args, cwd) => { const r = cp.spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, { cwd, encoding: 'utf8', shell: process.platform === 'win32', timeout: 900000 }); const ok = r.status === 0; console.log(`  ${ok ? '✔' : '✗'} ${nom}`); if (!ok) console.log((r.stdout + r.stderr).split('\n').slice(-12).join('\n')); return ok; };
        const ok = lancer('tests front (npm test)', ['test'], C.RACINE) && lancer('tests serveur (server: npm test)', ['test'], path.join(C.RACINE, 'server'));
        journal.phases.verifier = { ok };
        if (!ok) {
            console.log('\n  ↩ Échec : restauration des fichiers touchés par les correcteurs.');
            for (const f of touches) git('checkout', '--', f);
            journal.phases.verifier.restaure = touches; touches = [];
        }
    } else titre('4/6  VÉRIFIER — rien à vérifier' + (drapeau('sans-tests') ? ' (--sans-tests)' : ''));

    // ── 5. COMPARER ──────────────────────────────────────────
    titre('5/6  COMPARER avant / après');
    let apres = avant;
    if (touches.length) {
        apres = await executerSondes(noms.filter(n => !DYNAMIQUES.has(n)), { silencieux: true });
        const rApres = resume(apres);
        const delta = {};
        for (const id of new Set([...Object.keys(rAvant.parId), ...Object.keys(rApres.parId)])) {
            const d = (rApres.parId[id] || 0) - (rAvant.parId[id] || 0);
            if (d) delta[id] = d;
        }
        console.log(`  total : ${rAvant.total} → ${rApres.total}`);
        for (const [id, d] of Object.entries(delta)) console.log(`  ${d < 0 ? '↓' : '↑'} ${id.padEnd(28)} ${d}`);
        journal.phases.comparer = { avant: rAvant.total, apres: rApres.total, delta };
    } else console.log('  (aucune modification : pas de nouvelle mesure)');

    // ── 6. RAPPORTER ─────────────────────────────────────────
    titre('6/6  RAPPORTER');
    fs.writeFileSync(path.join(C.RACINE, 'docs', 'audit', 'ANNEXE-SONDES.md'), generer(avant));
    journal.fin = new Date().toISOString(); journal.duree_s = Math.round((Date.now() - t0) / 1000);
    ecrire(journal, 'strategie.json');
    console.log('  docs/audit/sondes.json · ANNEXE-SONDES.md · strategie.json');
    console.log(`  ${rAvant.total} trouvailles`, rAvant.parGravite, `— ${journal.duree_s} s`);
})();
