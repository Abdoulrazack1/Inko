#!/usr/bin/env node
// ============================================================
// sondes/assembler-audit.js — assemble le document d'audit
// ------------------------------------------------------------
//   node scripts-ci/sondes/assembler-audit.js
//
// Le document final est la concaténation des PARTIES rédigées
// (docs/audit/parties/NN-*.md) où les chiffres ne sont jamais tapés à la
// main : ils s'écrivent  {{total}}  {{gravite:haute}}  {{sonde:css}}
// {{mesure:routes.routes_total}}  {{tableau-sondes}}  et sont remplacés
// par les valeurs de docs/audit/sondes.json. Un chiffre périmé dans un
// audit est pire que pas de chiffre : il fait croire que le travail est
// fait ou à faire.
//
// Un jeton inconnu fait ÉCHOUER l'assemblage (jamais de {{…}} publié).
// ============================================================
'use strict';
const fs = require('fs');
const path = require('path');
const C = require('./_commun');

const donnees = JSON.parse(fs.readFileSync(path.join(C.RACINE, 'docs', 'audit', 'sondes.json'), 'utf8'));
const dossier = path.join(C.RACINE, 'docs', 'audit', 'parties');
const parties = fs.readdirSync(dossier).filter(f => /^\d+.*\.md$/.test(f)).sort();

const par = (cle) => donnees.trouvailles.reduce((m, f) => ((m[f[cle]] = (m[f[cle]] || 0) + 1), m), {});
const gr = par('gravite');
const NOMS = { critique: 'critiques', haute: 'hautes', moyenne: 'moyennes', basse: 'basses', info: 'informatives' };

const tableauSondes = () => ['| Sonde | Ce qu\'elle examine | Trouvailles | 🔴 | 🟠 | 🟡 | 🔵 |', '|---|---|---:|---:|---:|---:|---:|']
    .concat(Object.entries(donnees.sondes).map(([n, s]) => `| \`${n}\` | ${s.description} | ${s.nombre} | ${s.parGravite.critique || '·'} | ${s.parGravite.haute || '·'} | ${s.parGravite.moyenne || '·'} | ${s.parGravite.basse || '·'} |`)).join('\n');

function valeur(jeton) {
    let m;
    if (jeton === 'total') return String(donnees.trouvailles.length);
    if (jeton === 'date') return donnees.date.slice(0, 10);
    if (jeton === 'nb-sondes') return String(Object.keys(donnees.sondes).length);
    if (jeton === 'tableau-sondes') return tableauSondes();
    if ((m = /^gravite:(\w+)$/.exec(jeton))) return String(gr[m[1]] || 0);
    if ((m = /^sonde:([\w-]+)$/.exec(jeton))) { const s = donnees.sondes[m[1]]; if (!s) throw new Error('sonde inconnue ' + m[1]); return String(s.nombre); }
    if ((m = /^id:([\w-]+)$/.exec(jeton))) return String(donnees.trouvailles.filter(f => f.id === m[1]).length);
    // les clés de mesure peuvent contenir des espaces (« liens AniList »)
    if ((m = /^mesure:([\w-]+)\.([^.]+)(?:\.([^.]+))?(?:\.([^.]+))?$/.exec(jeton))) {
        const s = donnees.sondes[m[1]]; if (!s) throw new Error('sonde inconnue ' + m[1]);
        let v = s.mesures[m[2]]; for (const k of [m[3], m[4]]) if (k && v !== undefined && v !== null) v = v[k];
        if (v === undefined) throw new Error('mesure inconnue ' + jeton);
        return typeof v === 'object' ? JSON.stringify(v) : String(v);
    }
    throw new Error('jeton inconnu {{' + jeton + '}}');
}

let sortie = '';
const erreurs = [];
for (const p of parties) {
    const t = fs.readFileSync(path.join(dossier, p), 'utf8').replace(/\r\n/g, '\n');
    sortie += t.replace(/\{\{([^}]+)\}\}/g, (_, j) => { try { return valeur(j.trim()); } catch (e) { erreurs.push(`${p}: ${e.message}`); return '⟦' + j + '⟧'; } }).replace(/\s*$/, '\n\n');
}
if (erreurs.length) { console.error('✗ jetons non résolus :\n  ' + erreurs.join('\n  ')); process.exit(1); }
const cible = path.join(C.RACINE, 'docs', 'AUDIT-2026-11-24.md');
fs.writeFileSync(cible, sortie);
console.log(`✓ ${C.rel(cible)} — ${parties.length} parties, ${sortie.split('\n').length} lignes, ${Math.round(sortie.length / 1024)} Ko`);
