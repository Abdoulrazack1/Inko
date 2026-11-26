// ============================================================
// sondes/_commun.js — outillage partagé par toutes les sondes
// ------------------------------------------------------------
// Une sonde est un module qui exporte :
//
//     module.exports = { nom, description, async run(ctx) { … } }
//
// et rapporte via `ctx.trouver({...})`. Rien n'est écrit sur le
// dépôt ni dans la vraie base : une sonde LIT. L'orchestrateur
// (lancer.js) agrège tout en JSON.
//
// Gravité : critique > haute > moyenne > basse > info.
//   critique : perte de données, faille exploitable, appli inutilisable
//   haute    : bug visible par l'utilisateur ou risque réel
//   moyenne  : dette qui coûtera, défaut de robustesse
//   basse    : finition, cohérence
//   info     : mesure, pas un défaut
// ============================================================
'use strict';
const fs = require('fs');
const path = require('path');

// SONDES_RACINE permet de jouer les sondes et les correcteurs sur une COPIE (tests).
const RACINE = process.env.SONDES_RACINE ? path.resolve(process.env.SONDES_RACINE) : path.resolve(__dirname, '..', '..');
const IGNORES = new Set(['node_modules', '.git', '.taste-skill', '.claude', 'test-results', 'promo', 'build', 'dist',
    'www', '.gradle', 'target', 'gen', 'out', 'playwright-report']);

function* parcourir(dossier, filtre) {
    let entrees;
    try { entrees = fs.readdirSync(dossier, { withFileTypes: true }); } catch (e) { return; }
    for (const e of entrees) {
        if (IGNORES.has(e.name)) continue;
        const p = path.join(dossier, e.name);
        if (e.isDirectory()) yield* parcourir(p, filtre);
        else if (!filtre || filtre(p)) yield p;
    }
}
const rel = (p) => path.relative(RACINE, p).split(path.sep).join('/');
const lire = (p) => { try { return fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n'); } catch (e) { return ''; } };
const abs = (...p) => path.join(RACINE, ...p);
const ext = (...e) => (p) => e.includes(path.extname(p).toLowerCase());

/** Numéro de ligne (1-based) d'un index dans un texte. */
function ligneDe(texte, index) {
    let n = 1;
    for (let i = 0; i < index && i < texte.length; i++) if (texte.charCodeAt(i) === 10) n++;
    return n;
}
/** Applique une regex globale et appelle cb(match, ligne). */
function chercher(texte, re, cb) {
    const g = re.global ? re : new RegExp(re.source, re.flags + 'g');
    let m;
    while ((m = g.exec(texte))) {
        cb(m, ligneDe(texte, m.index));
        if (m[0].length === 0) g.lastIndex++;
    }
}
const kb = (o) => Math.round(o / 1024);

function creerContexte(nom) {
    const trouvailles = [];
    const mesures = {};
    return {
        racine: RACINE, rel, lire, abs, parcourir, ext, ligneDe, chercher, kb,
        trouvailles, mesures,
        /** @param {{gravite:string,id:string,titre:string,fichier?:string,ligne?:number,detail?:string,correctif?:string,effort?:string,categorie?:string}} f */
        trouver(f) {
            trouvailles.push({ sonde: nom, gravite: 'moyenne', effort: 'M', ...f });
        },
        mesure(cle, val) { mesures[cle] = val; },
    };
}
module.exports = { RACINE, parcourir, rel, lire, abs, ext, ligneDe, chercher, kb, creerContexte, IGNORES };
