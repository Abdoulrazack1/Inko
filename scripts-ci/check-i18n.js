#!/usr/bin/env node
// ============================================================
// check-i18n.js — Chaînes non traduites (audit I18N-03)
// ------------------------------------------------------------
// L'app traduit par CORRESPONDANCE EXACTE du texte source français :
// en.json.strings["Bibliothèque"] = "Library". Cette approche a un défaut
// structurel — reformuler un libellé dans le HTML ou le JS casse sa traduction
// EN SILENCE. Rien ne le signalait : ni au build (il n'y en a pas), ni à
// l'exécution (une chaîne non trouvée est simplement laissée telle quelle).
// Résultat mesuré à l'audit : 89 % de couverture, et des libellés comme
// « Tout » / « Mangas » / « Romans » restés en français dans l'interface
// anglaise sans que personne ne le sache.
//
// Ce script extrait les chaînes visibles du HTML et des littéraux d'interface
// du JS, puis liste celles qui manquent au dictionnaire.
//
//   node scripts-ci/check-i18n.js            → rapport
//   node scripts-ci/check-i18n.js --check    → échoue si la couverture baisse
//   node scripts-ci/check-i18n.js --json     → sortie machine
// ============================================================
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DICT = path.join(ROOT, 'assets', 'i18n', 'en.json');
const CHECK = process.argv.includes('--check');
const JSON_OUT = process.argv.includes('--json');

// Seuil de non-régression : la couverture ne doit jamais redescendre en
// dessous. Elle était de 51 % quand ce script a été écrit (l'audit annonçait
// 89 %, mais il ne mesurait que le texte entre balises HTML — ni les attributs,
// ni les littéraux du JS, qui portent l'essentiel des messages d'interface).
// Un lot de 60 libellés l'a portée à 59 %. À RELEVER à chaque lot traduit :
// le but de ce seuil est d'empêcher le retour en arrière, pas d'entériner
// l'état actuel.
// Relevé après le lot AMEL-64/68 (122 traductions ajoutées) : la couverture
// est passée de 47 % à 63 %. Un seuil qu'on ne relève jamais finit par
// autoriser une régression silencieuse de 15 points.
const MIN_COVERAGE = 60;

const en = JSON.parse(fs.readFileSync(DICT, 'utf8'));
const known = new Set(Object.keys(en.strings || {}));
const patterns = (en.patterns || []).map(p => { try { return new RegExp(p[0]); } catch (e) { return null; } }).filter(Boolean);

// Une chaîne est « couverte » si elle est dans le dictionnaire OU si un motif
// paramétré la reconnaît (« il y a 3 min », « 12 sur 48 »…).
const covered = s => known.has(s) || patterns.some(re => re.test(s));

// Heuristique de français : présence d'accents, ou d'un mot-outil courant.
// Volontairement stricte — on préfère rater une chaîne que crier au loup sur
// un identifiant technique ou un titre d'œuvre.
const FR = /[àâäéèêëîïôöùûüçœ]|^(Tout|Tous|Toutes|Aucun|Aucune|Voir|Plus|Moins|Suivant|Précédent|Fermer|Annuler|Valider|Chargement|Recherche|Nouveau|Nouvelle)\b|\b(le|la|les|des|une|dans|pour|avec|sur|par|est|sont|ton|ta|tes|ce|cette|qui|que)\b/i;

const found = new Map();   // chaîne → [sources]
function add(s, where) {
    s = s.replace(/\s+/g, ' ').trim();
    if (s.length < 2 || s.length > 200) return;
    if (!/[A-Za-zÀ-ÿ]{2}/.test(s)) return;     // pas de texte réel
    if (/^[0-9\s.,%:/·—–-]+$/.test(s)) return; // nombres et ponctuation
    if (!FR.test(s)) return;                    // pas manifestement français
    if (!found.has(s)) found.set(s, new Set());
    found.get(s).add(where);
}

// ── HTML : contenu textuel entre balises + attributs visibles ──
for (const f of fs.readdirSync(ROOT).filter(x => x.endsWith('.html'))) {
    const c = fs.readFileSync(path.join(ROOT, f), 'utf8')
        .replace(/<script[\s\S]*?<\/script>/g, '')
        .replace(/<style[\s\S]*?<\/style>/g, '')
        .replace(/<!--[\s\S]*?-->/g, '');
    for (const m of c.matchAll(/>([^<>{}]+)</g)) add(m[1], f);
    for (const m of c.matchAll(/(?:title|placeholder|aria-label|alt)="([^"]+)"/g)) add(m[1], f);
}

// ── JS : littéraux passés à l'UI (toast, textContent, innerHTML simple) ──
const JS_DIR = path.join(ROOT, 'assets', 'js');
for (const f of fs.readdirSync(JS_DIR).filter(x => x.endsWith('.js'))) {
    const c = fs.readFileSync(path.join(JS_DIR, f), 'utf8')
        .replace(/^\s*\/\/.*$/gm, '')            // commentaires de ligne
        .replace(/\/\*[\s\S]*?\*\//g, '');       // commentaires de bloc
    // Chaînes simples et gabarits sans interpolation
    for (const m of c.matchAll(/'([^'\\\n]{3,200})'/g)) add(m[1], f);
    for (const m of c.matchAll(/"([^"\\\n]{3,200})"/g)) add(m[1], f);
    for (const m of c.matchAll(/`([^`$\\\n]{3,200})`/g)) add(m[1], f);
}

const all = [...found.keys()];
const missing = all.filter(s => !covered(s));
const pct = all.length ? Math.round(((all.length - missing.length) / all.length) * 100) : 100;

// ── Traductions orphelines (audit AMEL-85) ───────────────────
// L'autre moitié du problème de dérive. La clé est le texte français EXACT :
// quand un libellé est reformulé, sa traduction ne casse pas seulement — elle
// reste dans le dictionnaire, invisible et morte. On finit avec un fichier qui
// grossit sans que personne ne sache ce qui sert encore.
//
// On ne fait PAS échouer la CI là-dessus : une chaîne peut légitimement
// n'apparaître que dans un code rarement atteint, et l'extracteur ne voit pas
// tout. Un avertissement chiffré suffit à décider quand faire le ménage.
// PREMIERE VERSION FAUSSE, corrigee : je comparais aux chaines EXTRAITES, ce
// qui donnait 382 orphelines dont « Accueil » et « Catalogue » — des libelles
// bien vivants, mais poses depuis un gabarit JS que l'extracteur ne decoupe
// pas en chaines isolees. Un signal a 382 faux positifs est pire qu'aucun
// signal : on apprend a l'ignorer.
//
// On cherche donc le texte francais N'IMPORTE OU dans les sources. C'est
// grossier mais ca ne se trompe que dans un sens : une chaine encore presente
// ne sera jamais declaree morte.
const CORPUS = [
    ...fs.readdirSync(ROOT).filter(x => x.endsWith('.html')).map(f => path.join(ROOT, f)),
    ...fs.readdirSync(JS_DIR).filter(x => x.endsWith('.js')).map(f => path.join(JS_DIR, f)),
].map(f => { try { return fs.readFileSync(f, 'utf8'); } catch (e) { return ''; } }).join(String.fromCharCode(10));
const presentes = new Set(all);
const orphelines = [...known].filter(k => !presentes.has(k) && !CORPUS.includes(k));
if (!JSON_OUT && orphelines.length) {
    console.log(`
Traductions orphelines : ${orphelines.length} entrée(s) de en.json`);
    console.log('ne correspondent plus à aucun texte source (libellé reformulé ou supprimé).');
    console.log("Ce n'est pas bloquant — juste du poids mort dans le dictionnaire :");
    for (const o of orphelines.slice(0, 8)) console.log(`  · "${o}"`);
    if (orphelines.length > 8) console.log(`  … et ${orphelines.length - 8} autres`);
}


if (JSON_OUT) {
    console.log(JSON.stringify({
        total: all.length, couvertes: all.length - missing.length, pourcentage: pct,
        manquantes: missing.map(s => ({ texte: s, fichiers: [...found.get(s)] })),
        orphelines,
    }, null, 2));
} else {
    console.log(`Chaînes françaises détectées : ${all.length}`);
    console.log(`Couvertes par en.json        : ${all.length - missing.length} (${pct} %)`);
    if (missing.length) {
        console.log(`\nNon traduites (${missing.length}) — les 30 premières :\n`);
        for (const s of missing.slice(0, 30)) {
            console.log(`  "${s}"`);
            console.log(`      ← ${[...found.get(s)].slice(0, 3).join(', ')}`);
        }
        if (missing.length > 30) console.log(`\n  … et ${missing.length - 30} autres (--json pour la liste complète)`);
    }
}

if (CHECK && pct < MIN_COVERAGE) {
    console.error(`\n::error::Couverture i18n ${pct} % < seuil ${MIN_COVERAGE} %.`);
    console.error('Ajoute les chaînes manquantes dans assets/i18n/en.json (clé = texte français exact).');
    process.exit(1);
}
