#!/usr/bin/env node
// ============================================================
// sondes/rapport.js — transforme sondes.json en annexe lisible
// ------------------------------------------------------------
//   node scripts-ci/sondes/rapport.js [sondes.json] [sortie.md]
//
// Produit l'ANNEXE brute d'un audit : chaque trouvaille, groupée par
// identifiant, avec preuve (fichier:ligne), correctif et effort. La
// synthèse rédigée à la main (docs/AUDIT-….md) s'appuie dessus ;
// l'annexe, elle, se régénère à volonté.
// ============================================================
'use strict';
const fs = require('fs');
const path = require('path');
const C = require('./_commun');
const ORDRE = ['critique', 'haute', 'moyenne', 'basse', 'info'];
const ICONE = { critique: '🔴', haute: '🟠', moyenne: '🟡', basse: '🔵', info: '⚪' };

function generer(donnees) {
    const t = donnees.trouvailles;
    const L = [];
    const par = (cle, liste = t) => liste.reduce((m, f) => ((m[f[cle] || '—'] = (m[f[cle] || '—'] || []).concat(f)), m), {});
    L.push('# Annexe — résultats bruts des sondes', '');
    L.push(`> Généré le ${donnees.date.slice(0, 10)} par \`scripts-ci/sondes/\`. ${t.length} trouvailles. Document régénérable : ne pas éditer à la main.`, '');
    L.push('## Tableau de bord', '');
    L.push('| Sonde | Durée | Trouvailles | ' + ORDRE.map(g => ICONE[g]).join(' | ') + ' |', '|---|---:|---:|' + ORDRE.map(() => '---:').join('|') + '|');
    for (const [nom, s] of Object.entries(donnees.sondes)) L.push(`| ${nom} | ${(s.ms / 1000).toFixed(1)} s | ${s.nombre} | ` + ORDRE.map(g => s.parGravite[g] || '·').join(' | ') + ' |');
    const tot = {}; t.forEach(f => { tot[f.gravite] = (tot[f.gravite] || 0) + 1; });
    L.push(`| **Total** | | **${t.length}** | ` + ORDRE.map(g => tot[g] || '·').join(' | ') + ' |', '');
    L.push('## Mesures relevées', '');
    for (const [nom, s] of Object.entries(donnees.sondes)) {
        const m = Object.entries(s.mesures || {});
        if (!m.length) continue;
        L.push(`### ${nom}`, '');
        for (const [k, v] of m) {
            const txt = typeof v === 'object' ? JSON.stringify(v) : String(v);
            L.push(`- **${k}** : ${txt.length > 700 ? txt.slice(0, 700) + ' …' : txt}`);
        }
        L.push('');
    }
    L.push('## Trouvailles', '');
    for (const g of ORDRE) {
        const dansG = t.filter(f => f.gravite === g);
        if (!dansG.length) continue;
        L.push(`### ${ICONE[g]} ${g[0].toUpperCase() + g.slice(1)} (${dansG.length})`, '');
        const parId = par('id', dansG);
        for (const [id, liste] of Object.entries(parId)) {
            if (liste.length > 5) {
                L.push(`#### \`${id}\` — ${liste.length} occurrences`, '');
                L.push(`${liste[0].correctif ? '**Correctif** : ' + liste[0].correctif + ' ' : ''}(effort unitaire ${liste[0].effort})`, '');
                for (const f of liste.slice(0, 40)) L.push(`- ${f.titre}${f.fichier ? ` — \`${f.fichier}${f.ligne ? ':' + f.ligne : ''}\`` : ''}`);
                if (liste.length > 40) L.push(`- … et ${liste.length - 40} autres`);
                L.push('');
            } else for (const f of liste) {
                L.push(`#### \`${f.id}\` ${f.titre}`, '');
                const meta = [`sonde **${f.sonde}**`, f.categorie && `catégorie ${f.categorie}`, `effort ${f.effort}`, f.fichier && `\`${f.fichier}${f.ligne ? ':' + f.ligne : ''}\``].filter(Boolean);
                L.push(meta.join(' · '), '');
                if (f.detail) L.push('```', f.detail.slice(0, 900), '```', '');
                if (f.correctif) L.push(`**Correctif** : ${f.correctif}`, '');
            }
        }
    }
    return L.join('\n');
}

module.exports = { generer };
if (require.main === module) {
    const entree = process.argv[2] || path.join(C.RACINE, 'docs', 'audit', 'sondes.json');
    const sortie = process.argv[3] || path.join(C.RACINE, 'docs', 'audit', 'ANNEXE-SONDES.md');
    fs.writeFileSync(sortie, generer(JSON.parse(fs.readFileSync(entree, 'utf8'))));
    console.log('→', C.rel(sortie));
}
