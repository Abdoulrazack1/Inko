#!/usr/bin/env node
'use strict';
// ============================================================
// verifier-android8.js — le PRODUIT embarqué tourne-t-il sur Android 8 ?
// ------------------------------------------------------------
// `build-mobile-www.js` transpile vers chrome61, le WebView livré avec
// Android 8.0. Son commentaire dit pourquoi : sur émulateur API 26, chaque
// fichier JavaScript échouait sur « Uncaught SyntaxError: Unexpected
// token . » — l'opérateur `?.`. L'application s'ouvrait sur un écran mort.
//
// Ce script ne regarde pas la transpilation. Il regarde le RÉSULTAT, pour
// la même raison que `verifier-apk.js` : deux installeurs sont sortis avec
// zéro source dedans, le build passait, la CI était verte, et rien ne
// regardait le produit.
//
// Ce qu'il a trouvé en naissant, et qui justifie son existence : la
// transpilation ne voyait que des FICHIERS. Les pages étaient copiées
// telles quelles, donc tout bloc écrit DANS la page y échappait.
// `offline.html` portait un `?.` dans son script en ligne — la page
// montrée quand tout le reste a déjà échoué, dont le bouton
// « Réessayer » ne faisait donc rien sur Android 8, et qui ne se
// rechargeait pas au retour du réseau. Son commentaire DESK-02 explique
// que le gestionnaire est posé en JavaScript parce que la CSP interdit
// `onclick` : il n'y avait aucun recours.
//
// ── Ce que ce script NE couvre pas, et il faut le dire ──
//
// esbuild abaisse de la SYNTAXE. Il n'ajoute aucune prothèse d'API et ne
// réécrit pas une fonctionnalité CSS absente. `color-mix()`, `gap` dans un
// conteneur flex, `:is()` sont postérieurs à Chrome 61 et resteront tels
// quels : le WebView les ignore, en silence. Ce ne sont pas des erreurs
// fatales — une déclaration ignorée dégrade, un fichier qui ne se parse
// pas disparaît — alors ils sont COMPTÉS, pas refusés. Les refuser
// demanderait de les remplacer, ce qui est un autre travail.

const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..');
const SORTIE = path.join(RACINE, 'mobile', 'www');
const CHECK = process.argv.includes('--check');

// ── Retirer ce qui n'est pas du code ────────────────────────
// Un `?.` dans une chaîne ou un commentaire n'a jamais fait tomber un
// moteur. Sans ce nettoyage, le garde-fou crierait sur ses propres
// commentaires — et un garde-fou qui crie à tort finit désarmé.
function codeSeul(js) {
    return js
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
        .replace(/'(?:\\.|[^'\\\n])*'/g, "''")
        .replace(/"(?:\\.|[^"\\\n])*"/g, '""')
        .replace(/`(?:\\.|[^`\\])*`/g, '``');
}
const cssSeul = (css) => css.replace(/\/\*[\s\S]*?\*\//g, ' ');

// ── Ce qui tue un fichier entier sur Chrome 61 ──────────────
// Chacun est de la syntaxe qu'esbuild SAIT abaisser : le rencontrer dans
// le produit ne veut pas dire « à corriger à la main », ça veut dire « ce
// fichier n'est pas passé par la transpilation ».
const FATAL_JS = [
    [/\?\./g, 'chaînage optionnel `?.`', 'Chrome 80'],
    [/\?\?=/g, 'affectation `??=`', 'Chrome 85'],
    [/\?\?/g, 'coalescence `??`', 'Chrome 80'],
    [/\|\|=/g, 'affectation `||=`', 'Chrome 85'],
    [/&&=/g, 'affectation `&&=`', 'Chrome 85'],
    [/^\s*#[A-Za-z_$][\w$]*\s*[=;(]/gm, 'champ privé de classe `#x`', 'Chrome 74'],
    [/\bstatic\s*\{/g, 'bloc `static {}`', 'Chrome 94'],
];
// `inset` est ignoré SANS ERREUR par le WebView d'Android 8 : l'élément
// garde des décalages `auto` et ne couvre rien. Repéré sur l'écran de
// configuration du hub, présent dans le DOM et jamais visible.
const FATAL_CSS = [
    [/(^|[;{\s])inset\s*:/g, 'raccourci `inset`', 'Chrome 87'],
];
// Postérieurs à Chrome 61, non abaissés, et simplement ignorés.
const SIGNALES_CSS = [
    [/color-mix\s*\(/g, 'color-mix()', 'Chrome 111'],
    [/:is\s*\(/g, ':is()', 'Chrome 88'],
    [/\bclamp\s*\(/g, 'clamp()', 'Chrome 79'],
    [/backdrop-filter\s*:/g, 'backdrop-filter', 'Chrome 76'],
];

// ── Une dette, relevée et bornée ────────────────────────────
// Les extensions embarquées sont copiées telles quelles, et trois d'entre
// elles portent de la syntaxe post-Chrome 61. Sur Android 8 en mode
// autonome, ces trois sources ne se chargent donc pas.
//
// Elles ne sont PAS transpilées ici, et c'est délibéré : leur empreinte
// est publiée dans `extensions/hashes.json` et vérifiée à l'exécution.
// Réécrire le fichier change l'empreinte, donc casse la vérification
// d'intégrité — c'est une chaîne à reprendre d'un bout à l'autre
// (génération, publication, contrôle), pas une ligne à changer ici.
//
// En attendant, le compte est GELÉ : la dette ne peut pas grandir, et un
// chiffre qui baisse fait échouer aussi, pour qu'on vienne le corriger.
const DETTE = {
    'extensions/mangadex/index.js': 15,
    'extensions/novelbin/index.js': 2,
    'extensions/novelfull/index.js': 1,
};

function chercher(texte, regles) {
    const out = [];
    for (const [re, nom, depuis] of regles) {
        re.lastIndex = 0;
        const n = (texte.match(re) || []).length;
        if (n) out.push({ nom, depuis, n });
    }
    return out;
}

/** Les blocs écrits dans la page, rendus séparément. */
function blocsEnLigne(html) {
    const out = [];
    for (const m of html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/gi)) {
        if (m[1].trim()) out.push({ type: 'js', code: m[1] });
    }
    for (const m of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) {
        if (m[1].trim()) out.push({ type: 'css', code: m[1] });
    }
    return out;
}

function fichiers(dir, acc = []) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) fichiers(p, acc);
        else acc.push(p);
    }
    return acc;
}

function principal() {
    if (!fs.existsSync(SORTIE)) {
        console.error('::error::mobile/www absent — lancer `npm run mobile:www` avant ce contrôle.');
        process.exit(1);
    }
    const tous = fichiers(SORTIE);
    const fatals = [];
    const signales = new Map();
    let scannes = 0;

    const noter = (liste, rel, quoi) => {
        for (const t of liste) fatals.push({ rel, quoi, ...t });
    };
    const compter = (liste) => {
        for (const t of liste) signales.set(t.nom, (signales.get(t.nom) || 0) + t.n);
    };

    for (const p of tous) {
        const rel = path.relative(SORTIE, p).replace(/\\/g, '/');
        // Les vendors sont distribués en ES5 par leurs auteurs et ne sont
        // volontairement pas retouchés par le build : les juger ici
        // reviendrait à exiger ce qu'on a décidé de ne pas faire.
        if (rel.includes('vendor')) continue;
        const ext = path.extname(p).toLowerCase();
        if (ext === '.js') {
            scannes++;
            const trouves = chercher(codeSeul(fs.readFileSync(p, 'utf8')), FATAL_JS);
            if (rel in DETTE) {
                const n = trouves.reduce((s, t) => s + t.n, 0);
                if (n !== DETTE[rel]) {
                    fatals.push({ rel, quoi: 'dette gelée', depuis: `${DETTE[rel]} relevé(s)`,
                        nom: `${n} construction(s) au lieu de ${DETTE[rel]}`, n });
                }
                continue;
            }
            noter(trouves, rel, 'script');
        } else if (ext === '.css') {
            scannes++;
            const css = cssSeul(fs.readFileSync(p, 'utf8'));
            noter(chercher(css, FATAL_CSS), rel, 'feuille');
            compter(chercher(css, SIGNALES_CSS));
        } else if (ext === '.html') {
            scannes++;
            for (const b of blocsEnLigne(fs.readFileSync(p, 'utf8'))) {
                if (b.type === 'js') noter(chercher(codeSeul(b.code), FATAL_JS), rel, 'script en ligne');
                else {
                    const css = cssSeul(b.code);
                    noter(chercher(css, FATAL_CSS), rel, 'style en ligne');
                    compter(chercher(css, SIGNALES_CSS));
                }
            }
        }
    }

    if (!scannes) {
        console.error('::error::aucun fichier examiné dans mobile/www — le build a-t-il tourné ?');
        process.exit(1);
    }

    for (const [nom, n] of [...signales].sort((a, b) => b[1] - a[1])) {
        const d = SIGNALES_CSS.find((r) => r[1] === nom);
        console.log(`  · ${nom} (${d ? d[2] : '?'}) — ${n} déclaration(s) ignorée(s) sur Android 8, sans erreur`);
    }

    if (fatals.length) {
        console.error(`\n::error::${fatals.length} construction(s) que le WebView d’Android 8 ne sait pas lire.`);
        console.error('Un fichier qui ne se parse pas n’est pas dégradé : il est absent.\n');
        for (const f of fatals) {
            console.error(`  ${f.rel}  (${f.quoi})  ${f.nom} × ${f.n} — ${f.depuis}`);
        }
        console.error('\nCes formes sont abaissées par build-mobile-www.js : les retrouver ici');
        console.error('signifie que le fichier n’est pas passé par la transpilation.');
        process.exit(1);
    }

    console.log(`✔ Android 8 : ${scannes} fichier(s) du paquet, aucune syntaxe hors de portée du WebView.`);
    if (!CHECK) console.log('  (--check : même contrôle, pour la CI)');
}

principal();
