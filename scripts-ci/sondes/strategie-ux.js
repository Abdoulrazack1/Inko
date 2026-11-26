#!/usr/bin/env node
// ============================================================
// sondes/strategie-ux.js — l'orchestrateur de l'expérience
// ------------------------------------------------------------
//   OBSERVER → NOTER → COMPARER → PLANIFIER → CORRIGER → VÉRIFIER → RAPPORTER
//
//   node scripts-ci/sondes/strategie-ux.js                 # joue les sondes ux-*, note, planifie
//   node scripts-ci/sondes/strategie-ux.js --sans-sonder   # note à partir des relevés existants
//   node scripts-ci/sondes/strategie-ux.js --sondes=ux-ecrans,ux-redaction
//   node scripts-ci/sondes/strategie-ux.js --reference     # accepte l'état actuel (notes et captures)
//   node scripts-ci/sondes/strategie-ux.js --seuil=3       # barrière : échoue si une note perd plus de 3 points
//   node scripts-ci/sondes/strategie-ux.js --appliquer [--risque=faible|moyen] [--sans-tests] [--sur-main]
//
// Les relevés des autres sondes (mobile, interaction, chaos, parcours…) sont repris de
// docs/audit/sondes.json : lancer la campagne les rafraîchit.
// Voir docs/ux/STRATEGIE-UX.md.
// ============================================================
'use strict';
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const C = require('./_commun');
const N = require('./ux-notes');

const SONDES_UX = ['ux-coherence', 'ux-ecrans', 'ux-navigation', 'ux-parcours', 'ux-retour', 'ux-redaction', 'ux-visuel'];
const argv = process.argv.slice(2);
const drapeau = (n) => argv.includes('--' + n);
const valeur = (n) => (argv.find(a => a.startsWith('--' + n + '=')) || '').split('=')[1];
const DOSSIER = C.abs('docs', 'ux');
const f = (...p) => path.join(DOSSIER, ...p);
const lireJson = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; } };
const titre = (t) => console.log('\n' + '═'.repeat(64) + '\n  ' + t + '\n' + '═'.repeat(64));
const git = (...a) => cp.spawnSync('git', a, { cwd: C.RACINE, encoding: 'utf8' });

/** Joue les sondes demandées, deux à la fois (chacune a son serveur et sa base jetables). */
async function observer(noms) {
    const { executerSondes } = require('./lancer');
    const anciens = lireJson(f('releves.json')) || { sondes: {}, trouvailles: [] };
    const file = noms.slice();
    const couloir = async () => {
        while (file.length) {
            const nom = file.shift();
            const r = await executerSondes([nom]);
            anciens.sondes[nom] = r.sondes[nom];
            anciens.trouvailles = anciens.trouvailles.filter(x => x.sonde !== nom).concat(r.trouvailles);
            anciens.date = r.date;
            fs.writeFileSync(f('releves.json'), JSON.stringify(require('./_propre').nettoyer(anciens), null, 1));
        }
    };
    // les mesures de délai (ux-retour, ux-parcours) tournent seules
    const sensibles = file.filter(n => /retour|parcours/.test(n));
    sensibles.forEach(n => file.splice(file.indexOf(n), 1));
    await Promise.all([couloir(), couloir()]);
    file.push(...sensibles); await couloir();
    return anciens;
}

/** Les relevés des sondes UX, complétés par ceux de la campagne générale. */
function rassembler() {
    const ux = lireJson(f('releves.json')) || { sondes: {}, trouvailles: [] };
    const tout = lireJson(C.abs('docs', 'audit', 'sondes.json')) || { sondes: {}, trouvailles: [] };
    const deUx = new Set(Object.keys(ux.sondes));
    return {
        sondes: [...new Set([...Object.keys(tout.sondes), ...deUx])],
        trouvailles: tout.trouvailles.filter(x => !deUx.has(x.sonde)).concat(ux.trouvailles),
        dates: { ux: ux.date || null, campagne: tout.date || null },
    };
}

const barre = (n) => (n === null ? '—' : '█'.repeat(Math.round(n / 5)).padEnd(20, '·') + ' ' + String(n).padStart(3));

function rapport(etat, ecart, journal) {
    const l = ['# Expérience d\'Inko — rapport', '', `Produit par \`scripts-ci/sondes/strategie-ux.js\`. Relevés d'expérience : ${(etat.dates.ux || '—').slice(0, 16).replace('T', ' ')} ; campagne générale : ${(etat.dates.campagne || '—').slice(0, 16).replace('T', ' ')} (UTC).`, '',
        `## Note d'ensemble : ${etat.globale === null ? '—' : etat.globale + ' / 100'}${ecart ? ` (${ecart.globale >= 0 ? '+' : ''}${ecart.globale} depuis la référence)` : ''}`, '',
        'Une note mesure ce que les sondes savent voir, pas la qualité ressentie : elle sert à comparer deux états et à ordonner le travail. Calcul : voir `STRATEGIE-UX.md`.', '',
        '| Dimension | Note | Écart | Familles de défauts | Sondes manquantes |', '|---|---:|---:|---:|---|',
        ...Object.entries(etat.dimensions).sort((a, b) => (a[1].note ?? 101) - (b[1].note ?? 101)).map(([k, d]) => `| ${d.nom} | ${d.note ?? '—'} | ${ecart && ecart.notes[k] !== undefined ? (ecart.notes[k] > 0 ? '+' : '') + ecart.notes[k] : '·'} | ${d.chantiers} | ${d.sondesAbsentes.join(', ') || '·'} |`),
        '', '## Pages, de la plus abîmée à la mieux tenue', '', '| Page | Note | Familles | dont graves |', '|---|---:|---:|---:|',
        ...Object.entries(etat.pages).sort((a, b) => a[1].note - b[1].note).map(([p, v]) => `| ${p} | ${v.note} | ${v.chantiers} | ${v.graves} |`), ''];
    const VAGUES = { 1: 'Vague 1 — grave et rapide : à faire d\'abord', 2: 'Vague 2 — le reste du grave et les gains faciles', 3: 'Vague 3 — chantiers moyens', 4: 'Vague 4 — finitions' };
    for (const [v, nom] of Object.entries(VAGUES)) {
        const c = etat.plan.filter(x => x.vague === +v);
        if (!c.length) continue;
        l.push(`## ${nom} (${c.length})`, '', '| Famille | Gravité | Effort | Occurrences | Pages | Exemple et geste |', '|---|---|:---:|---:|---|---|',
            ...c.map(x => `| \`${x.id}\` | ${x.gravite} | ${x.effort} | ${x.occurrences} | ${x.pages.length > 4 ? x.pages.length + ' pages' : x.pages.map(p => p.replace('.html', '')).join(', ') || '·'} | ${String(x.titre).replace(/\|/g, '/').slice(0, 150)}${x.correctif ? ' — *' + String(x.correctif).replace(/\|/g, '/').slice(0, 130) + '*' : ''} |`), '');
    }
    if (ecart) l.push('## Depuis la référence', '', `Apparus : ${ecart.apparus.map(c => '`' + c.id + '`').join(', ') || 'aucun'}.`, '', `Disparus : ${ecart.disparus.map(c => '`' + c.id + '`').join(', ') || 'aucun'}.`, '');
    if (journal.corriger) l.push('## Corrections', '', '```json', JSON.stringify({ corriger: journal.corriger, verifier: journal.verifier }, null, 1), '```', '');
    return l.join('\n');
}

async function principal() {
    fs.mkdirSync(DOSSIER, { recursive: true });
    const journal = {};
    // ── 1. OBSERVER ──
    if (drapeau('sans-sonder')) titre('1/7  OBSERVER — relevés existants (--sans-sonder)');
    else { const noms = valeur('sondes') ? valeur('sondes').split(',') : SONDES_UX; titre('1/7  OBSERVER ' + noms.join(', ')); await observer(noms); }
    // ── 2. NOTER ──
    titre('2/7  NOTER');
    const releves = rassembler();
    const etat = { ...N.noter(releves.trouvailles, releves.sondes), dates: releves.dates };
    for (const d of Object.values(etat.dimensions)) console.log(`  ${d.nom.padEnd(30)} ${barre(d.note)}`);
    console.log(`  ${'ENSEMBLE'.padEnd(30)} ${barre(etat.globale)}`);
    // ── 3. COMPARER ──
    titre('3/7  COMPARER à la référence');
    const ref = lireJson(f('reference.json'));
    const ecart = N.comparer(etat, ref);
    if (!ecart) console.log('  pas encore de référence : --reference pour poser l\'état actuel');
    else console.log(`  ensemble ${ecart.globale >= 0 ? '+' : ''}${ecart.globale} · ${ecart.apparus.length} famille(s) apparue(s) · ${ecart.disparus.length} disparue(s)`);
    // ── 4. PLANIFIER ──
    titre('4/7  PLANIFIER');
    for (const v of [1, 2, 3, 4]) console.log(`  vague ${v} : ${etat.plan.filter(c => c.vague === v).length} famille(s)`);
    etat.plan.slice(0, 10).forEach((c, i) => console.log(`  ${String(i + 1).padStart(2)}. [${c.gravite}/${c.effort}] ${c.id} × ${c.occurrences} — ${c.titre.slice(0, 90)}`));
    // ── 5. CORRIGER ──
    let touches = [];
    const { CORRECTEURS_UX } = require('./correcteurs/ux');
    const NIVEAUX = { nul: 0, faible: 1, moyen: 2 };
    const maximum = NIVEAUX[valeur('risque') || 'faible'];
    const presents = new Set(releves.trouvailles.map(x => x.id));
    titre('5/7  CORRIGER' + (drapeau('appliquer') ? '' : ' — aperçu (ajouter --appliquer)'));
    const branche = git('rev-parse', '--abbrev-ref', 'HEAD').stdout.trim();
    const protegee = /^(main|master)$/.test(branche) && !drapeau('sur-main');
    for (const c of CORRECTEURS_UX) {
        const plan = await c.plan(); const utile = c.couvre.some(i => presents.has(i)); const permis = NIVEAUX[c.risque] <= maximum;
        console.log(`  ${plan.length && utile ? (permis ? '▶' : '·') : '✓'} ${c.nom.padEnd(22)} risque ${c.risque.padEnd(6)} ${plan.length} fichier(s)${!utile ? ' · aucun relevé ne le demande' : !permis ? ' · risque non autorisé' : ''}`);
        if (!drapeau('appliquer') || !plan.length || !utile || !permis) continue;
        if (protegee) { console.log(`    ✗ branche « ${branche} » protégée : créer une branche ou passer --sur-main`); process.exitCode = 2; continue; }
        const sales = plan.filter(x => git('status', '--porcelain', '--', x.fichier).stdout.trim());
        if (sales.length) { console.log(`    ⚠ fichiers déjà modifiés, correcteur sauté : ${sales.map(x => x.fichier).join(', ')}`); continue; }
        const faits = await c.appliquer(); touches.push(...faits.map(x => x.fichier));
        (journal.corriger = journal.corriger || []).push({ correcteur: c.nom, fichiers: faits.map(x => x.fichier) });
    }
    // ── 6. VÉRIFIER ──
    if (touches.length && !drapeau('sans-tests')) {
        titre('6/7  VÉRIFIER');
        const npm = (cwd) => cp.spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['test'], { cwd, encoding: 'utf8', shell: process.platform === 'win32', timeout: 900000 });
        const r = npm(C.RACINE); journal.verifier = { ok: r.status === 0 };
        console.log(r.status === 0 ? '  ✔ tests au vert' : '  ✗ tests en échec : restauration\n' + (r.stdout + r.stderr).split('\n').slice(-14).join('\n'));
        if (r.status !== 0) { for (const x of [...new Set(touches)]) git('checkout', '--', x); journal.verifier.restaure = touches; process.exitCode = 1; }
    } else titre('6/7  VÉRIFIER — rien à vérifier');
    // ── 7. RAPPORTER ──
    titre('7/7  RAPPORTER');
    const { propre, nettoyer } = require('./_propre');
    fs.writeFileSync(f('tableau.json'), JSON.stringify(nettoyer({ date: new Date().toISOString(), ...etat, ecart }), null, 1));
    fs.writeFileSync(f('RAPPORT-UX.md'), propre(rapport(etat, ecart, journal)) + '\n');
    const histo = lireJson(f('historique.json')) || [];
    histo.push({ date: new Date().toISOString(), globale: etat.globale, notes: Object.fromEntries(Object.entries(etat.dimensions).map(([k, d]) => [k, d.note])), familles: etat.plan.length });
    fs.writeFileSync(f('historique.json'), JSON.stringify(histo.slice(-200), null, 1));
    if (drapeau('reference')) {
        fs.writeFileSync(f('reference.json'), JSON.stringify(etat, null, 1));
        if (fs.existsSync(f('captures'))) { fs.rmSync(f('reference'), { recursive: true, force: true }); fs.cpSync(f('captures'), f('reference'), { recursive: true }); }
        console.log('  référence posée (notes et captures)');
    }
    console.log('  docs/ux/RAPPORT-UX.md · tableau.json · historique.json');
    if (valeur('seuil') !== undefined) {
        const motifs = N.barriere(ecart, Number(valeur('seuil')) || 0);
        if (!ecart) console.log('  barrière : aucune référence, rien à comparer');
        else if (motifs.length) { console.error('\n✗ barrière franchie :\n  ' + motifs.join('\n  ')); process.exitCode = 1; }
        else console.log('  ✔ barrière respectée');
    }
}

module.exports = { SONDES_UX, rassembler, rapport };
if (require.main === module) principal().catch((e) => { console.error(e); process.exit(1); });
