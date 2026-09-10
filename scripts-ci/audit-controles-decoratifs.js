#!/usr/bin/env node
// ============================================================
// audit-controles-decoratifs.js — le bouton qui répond sans rien faire
// ------------------------------------------------------------
// L'audit des contrôles (test/e2e/audit-controles.spec.js) actionne chaque
// bouton et regarde si la page change. Il ne peut donc PAS voir le défaut le
// plus retors de cette famille : un bouton qui change son propre aspect, et
// rien d'autre.
//
// La page change bel et bien — une classe `active` s'est déplacée — alors le
// verdict est « AGIT ». Et pour l'utilisateur, c'est pire qu'un bouton mort :
// le bouton s'allume, donc on croit que le filtre a filtré.
//
// Constaté sur l'onglet Historique du profil : « Derniers 7 jours »,
// « 30 jours » et « Cette année » se passaient une classe et ne touchaient
// jamais à la liste. Trouvé aussi deux gestionnaires morts — l'un câblé sur un
// sélecteur qui n'existe dans aucun balisage, l'autre doublon d'un câblage
// complet posé ailleurs.
//
// ── Comment on décide ───────────────────────────────────────
//
// On lit les gestionnaires de clic écrits en fonction fléchée, et on signale
// ceux dont le corps ne fait QUE de la présentation : `classList`, `style`,
// `textContent`, `setAttribute`… sans jamais appeler autre chose, ni affecter
// une variable extérieure.
//
// C'est une heuristique, et elle a ses limites — un menu qui se ferme au clic
// dehors ne fait, légitimement, que de la présentation. Le rapport le dit :
// il donne à lire, il ne condamne pas.
//
//   node scripts-ci/audit-controles-decoratifs.js
// ============================================================
'use strict';

const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..');
const JS = path.join(RACINE, 'assets', 'js');

/** Ce qui ne change que l'apparence. */
const PRESENTATION = /classList|\.style\b|textContent|innerHTML|setAttribute|removeAttribute|\.hidden\b|dataset\./;

/**
 * Les appels qui ne prouvent RIEN : ils font partie du geste de présentation
 * lui-même, ou de la plomberie d'un gestionnaire.
 */
const NEUTRES = new Set([
    'if', 'for', 'while', 'switch', 'catch', 'return', 'function',
    'forEach', 'map', 'filter', 'find', 'some', 'every',
    'querySelector', 'querySelectorAll', 'getElementById', 'closest', 'matches',
    'String', 'Number', 'Boolean', 'Array',
    'toggle', 'add', 'remove', 'contains',
    'setAttribute', 'removeAttribute', 'getAttribute', 'hasAttribute',
    'preventDefault', 'stopPropagation', 'addEventListener', 'esc',
]);

/** Une affectation vers l'extérieur : le gestionnaire retient une décision. */
const AFFECTE_DEHORS = /^\s*(?!const |let |var )[\w$.[\]]+\s*=(?!=)/m;
/** Activer ou désactiver un contrôle est un effet, pas une décoration. */
const CHANGE_ETAT = /\.(disabled|checked|value)\s*=(?!=)/;

function analyser() {
    const fichiers = fs.existsSync(JS)
        ? fs.readdirSync(JS).filter((f) => f.endsWith('.js')).sort()
        : [];
    const trouves = [];

    for (const f of fichiers) {
        const src = fs.readFileSync(path.join(JS, f), 'utf8');
        // Le corps est délimité en COMPTANT les accolades, pas par une
        // expression régulière.
        //
        // Une regex non gourmande s'arrête à la première fermeture rencontrée
        // — c'est-à-dire à celle d'une closure imbriquée. Un gestionnaire qui
        // commence par `forEach(b => { … })` puis appelle la fonction de rendu
        // se retrouvait alors tronqué avant l'appel utile, et déclaré
        // décoratif. L'outil accusait exactement le code qui venait d'être
        // corrigé.
        const re = /addEventListener\(\s*['"]click['"]\s*,\s*(?:\([^)]*\)|[\w$]+)\s*=>\s*\{/g;
        let m;
        while ((m = re.exec(src))) {
            const debut = m.index + m[0].length;
            let profondeur = 1;
            let i = debut;
            while (i < src.length && profondeur > 0) {
                const c = src[i];
                if (c === '{') profondeur++;
                else if (c === '}') profondeur--;
                i++;
            }
            if (profondeur !== 0) continue;         // corps non refermé : on passe
            const corps = src.slice(debut, i - 1);
            if (!PRESENTATION.test(corps)) continue;
            if (AFFECTE_DEHORS.test(corps) || CHANGE_ETAT.test(corps)) continue;
            const appels = [...corps.matchAll(/\b[a-zA-Z_$][\w$]*\s*\(/g)]
                .map((a) => a[0].slice(0, -1).trim())
                .filter((a) => !NEUTRES.has(a));
            if (appels.length) continue;
            trouves.push({
                f,
                ligne: src.slice(0, m.index).split('\n').length,
                extrait: corps.replace(/\s+/g, ' ').trim().slice(0, 140),
            });
        }
    }
    return trouves;
}

const trouves = analyser();
const L = [];
L.push('# Audit — les contrôles qui répondent sans rien faire');
L.push('');
L.push(`Relevé du ${new Date().toISOString().slice(0, 10)}.`);
L.push('');
L.push('Un gestionnaire de clic qui ne fait que déplacer une classe `active` est');
L.push('**pire qu’un bouton mort** : le bouton s’allume, donc on croit que le filtre');
L.push('a filtré. L’audit des contrôles ne peut pas le voir — pour lui, la page a');
L.push('bien changé, alors il conclut « AGIT ».');
L.push('');
L.push('> ⚠ Heuristique. Un menu qui se ferme au clic dehors ne fait,');
L.push('> légitimement, que de la présentation. À lire, pas à appliquer.');
L.push('');
if (!trouves.length) L.push('_Aucun gestionnaire purement décoratif._');
else {
    L.push(`**${trouves.length}** gestionnaire(s) à regarder.`);
    L.push('');
    L.push('| Fichier | Ligne | Ce que fait le gestionnaire |');
    L.push('|---|---|---|');
    for (const t of trouves) {
        L.push(`| \`${t.f}\` | ${t.ligne} | \`${t.extrait.replace(/\|/g, '\\|')}\` |`);
    }
}

const dest = path.join(RACINE, 'docs', 'audit-decoratifs.md');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, L.join('\n') + '\n');
console.log(`gestionnaires purement décoratifs : ${trouves.length}`);
console.log('→ docs/audit-decoratifs.md');
