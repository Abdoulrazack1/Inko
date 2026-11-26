// correcteurs/ux.js — les corrections d'interface vraiment mécaniques. Tout ce qui demande
// un choix de design (hiérarchie, parcours, mots) reste au plan : on ne devine pas.
// Même contrat que correcteurs/index.js (idempotent, plan = ce qu'applique appliquer).
'use strict';
const fs = require('fs');
const path = require('path');

const RACINE = process.env.SONDES_RACINE ? path.resolve(process.env.SONDES_RACINE) : path.resolve(__dirname, '..', '..', '..');
const lire = (f) => fs.readFileSync(path.join(RACINE, f), 'utf8');
function ecrire(f, texte, original) {
    const cible = path.join(RACINE, f), tmp = cible + '.sonde-tmp';
    fs.writeFileSync(tmp, /\r\n/.test(original) ? texte.replace(/\r?\n/g, '\r\n') : texte);
    fs.renameSync(tmp, cible);
}
const pages = () => fs.readdirSync(RACINE).filter(f => f.endsWith('.html'));

function transformation({ nom, description, couvre, risque, fichiers, transformer }) {
    const calculer = () => fichiers().map(f => { const brut = lire(f), t = brut.replace(/\r\n/g, '\n'); const neuf = transformer(t, f); return neuf === t ? null : { fichier: f, brut, neuf }; }).filter(Boolean);
    return {
        nom, description, couvre, risque,
        async plan() { return calculer().map(c => ({ fichier: c.fichier, resume: description })); },
        async appliquer() { return calculer().map(c => { ecrire(c.fichier, c.neuf, c.brut); return { fichier: c.fichier, resume: description }; }); },
    };
}

/** Applique `f` aux seuls textes visibles d'une page : ni balises, ni scripts, ni styles, ni <pre>/<code>. */
function surLeTexte(html, f) {
    return html.split(/(<!--[\s\S]*?-->|<(script|style|pre|code)\b[\s\S]*?<\/\2>|<[^>]+>)/gi)
        .map((bout, i) => {
            // split avec groupe imbriqué : positions 0 = texte, 1 = balise ou bloc, 2 = nom du bloc
            if (i % 3 === 0) return f(bout || '');
            return i % 3 === 1 ? bout : '';
        }).join('');
}

const MARQUE = '/* sonde ux : pas de zoom forcé à la saisie sur téléphone */';

const CORRECTEURS_UX = [
    transformation({
        nom: 'points-de-suspension', risque: 'faible', couvre: ['UX-RED-POINTS'],
        description: 'remplace « ... » par « … » dans les textes des pages',
        fichiers: pages,
        transformer: (t) => surLeTexte(t, (x) => x.replace(/(\p{L})\.\.\.(?!\.)/gu, '$1…')),
    }),
    transformation({
        nom: 'espaces-fines', risque: 'moyen', couvre: ['UX-RED-ESPACE'],
        description: 'rend insécable et fine l’espace avant « : ; ! ? » dans les textes des pages françaises',
        fichiers: pages,
        transformer: (t) => surLeTexte(t, (x) => x.replace(/(\p{L}|»|\)) ([:;!?])(?=\s|$)/gu, '$1 $2')),
    }),
    transformation({
        nom: 'zoom-saisie', risque: 'moyen', couvre: ['MOB-ZOOM-SAISIE'],
        description: 'champs à 16 px au moins sur écran tactile étroit (iOS ne zoome plus)',
        fichiers: () => ['assets/css/global.css'],
        transformer: (t) => t.includes(MARQUE) ? t : t.replace(/\s*$/, '\n') + `\n${MARQUE}\n@media (max-width: 600px) and (pointer: coarse) {\n  input:not([type="checkbox"]):not([type="radio"]):not([type="range"]), select, textarea { font-size: max(16px, 1em) !important; }\n}\n`,
    }),
];

module.exports = { CORRECTEURS_UX, surLeTexte };
