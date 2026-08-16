#!/usr/bin/env node
// ============================================================
// gen-repli-aspect-ratio.js — que les couvertures existent sur Android 8
// ------------------------------------------------------------
// `aspect-ratio` est une propriété de Chrome 88. Le WebView d'Android 8
// (Chrome 61) l'IGNORE — silencieusement, comme `inset`.
//
// Ce n'est pas un défaut cosmétique. Une boîte `aspect-ratio: 3/4` dont
// l'unique enfant est `<img style="height:100%">` n'a plus AUCUNE source de
// hauteur : la boîte fait 0, l'image fait 0. Mesuré dans le navigateur en
// neutralisant la propriété — 223 px → 0 px. Toutes les couvertures de
// l'application disparaissent, sur toutes les pages à la fois.
//
// ── Pourquoi générer plutôt que corriger à la main ──────────
//
// Quinze déclarations réparties sur neuf feuilles. Les corriger une par une
// laisse le PROBLÈME entier : la seizième, écrite dans six mois, repassera
// inaperçue exactement de la même façon. Le repli est donc dérivé du source,
// et `--check` échoue en intégration continue s'il n'est plus à jour — le
// même dispositif que le précache.
//
// ── La subtilité du `padding-top` ───────────────────────────
//
// Un pourcentage de `padding-top` se rapporte à la LARGEUR DU BLOC CONTENEUR,
// pas à celle de l'élément. Sur un élément de largeur automatique qui remplit
// son conteneur, les deux coïncident et le repli est exact. Sur un élément de
// largeur FIXE (`width: 200px`), ils diffèrent : `padding-top: 150%` d'un
// conteneur de 600 px donnerait 900 px au lieu de 300. Ces cas reçoivent donc
// une hauteur en pixels, calculée.
//
// ── Et les enfants ──────────────────────────────────────────
//
// `height: 100%` dans une boîte de hauteur 0 vaut 0. L'image doit donc passer
// en absolu — ce que les couvertures supportent, leur conteneur étant déjà
// `position: relative` pour leurs badges.
'use strict';

const fs = require('fs');
const path = require('path');

const DOSSIER = path.join(__dirname, '..', 'assets', 'css');
const CIBLE = path.join(DOSSIER, 'global.css');
const DEBUT = '/* ══ REPLI aspect-ratio — GÉNÉRÉ par scripts-ci/gen-repli-aspect-ratio.js ══ */';
const FIN = '/* ══ fin du repli aspect-ratio ══ */';

// ── Lecture des règles ──────────────────────────────────────
// Un analyseur à pile plutôt qu'une expression rationnelle : il faut savoir
// dans quelles requêtes média une déclaration se trouve pour les reproduire,
// et ignorer ce qui est déjà dans un `@supports`.
function reglesAvecRatio(css) {
    const trouvees = [];
    const pile = [];              // préludes @media/@supports en cours
    let i = 0, tampon = '';

    while (i < css.length) {
        const c = css[i];

        if (c === '/' && css[i + 1] === '*') {          // commentaire
            const fin = css.indexOf('*/', i + 2);
            i = fin === -1 ? css.length : fin + 2;
            continue;
        }
        if (c === '{') {
            const prelude = tampon.trim();
            tampon = '';
            if (prelude.startsWith('@')) { pile.push(prelude); i++; continue; }

            // Corps d'une règle ordinaire : on le lit jusqu'à l'accolade
            // fermante correspondante (les règles imbriquées n'existent pas
            // dans ces feuilles — Chrome 61 ne les lirait pas).
            let prof = 1, j = i + 1;
            while (j < css.length && prof > 0) {
                if (css[j] === '{') prof++;
                else if (css[j] === '}') prof--;
                j++;
            }
            const corps = css.slice(i + 1, j - 1);
            const m = /(?:^|;)\s*aspect-ratio\s*:\s*([^;}]+)/.exec(corps);
            if (m && !pile.some(p => p.startsWith('@supports'))) {
                trouvees.push({
                    media: pile.filter(p => p.startsWith('@media')),
                    selecteur: prelude.replace(/\s+/g, ' '),
                    valeur: m[1].trim(),
                    largeurFixe: (/(?:^|;)\s*width\s*:\s*(\d+(?:\.\d+)?)px/.exec(corps) || [])[1] || null,
                });
            }
            i = j;
            continue;
        }
        if (c === '}') { pile.pop(); i++; tampon = ''; continue; }
        tampon += c;
        i++;
    }
    return trouvees;
}

// « 3/4 », « 3 / 4 », « 1 », « auto »  →  hauteur/largeur, ou null
function rapport(valeur) {
    if (/^auto$/i.test(valeur)) return 'auto';
    const m = /^(\d+(?:\.\d+)?)\s*(?:\/\s*(\d+(?:\.\d+)?))?$/.exec(valeur);
    if (!m) return null;
    const l = parseFloat(m[1]);
    const h = m[2] === undefined ? l : parseFloat(m[2]);
    if (!l || !h) return null;
    return h / l;
}

function arrondi(n) { return String(Math.round(n * 10000) / 10000); }

function construire() {
    const fichiers = fs.readdirSync(DOSSIER)
        .filter(f => f.endsWith('.css'))
        .sort();

    const parMedia = new Map();   // prélude média (ou '') → lignes
    let total = 0, ignorees = [];

    for (const f of fichiers) {
        const css = fs.readFileSync(path.join(DOSSIER, f), 'utf8');
        const brut = f === 'global.css' ? css.split(DEBUT)[0] : css;   // jamais se relire soi-même
        for (const r of reglesAvecRatio(brut)) {
            const rap = rapport(r.valeur);
            if (rap === null) { ignorees.push(`${f} : ${r.selecteur} { aspect-ratio: ${r.valeur} }`); continue; }
            const cle = r.media.join(' and ').replace(/@media\s*/g, '').trim();
            if (!parMedia.has(cle)) parMedia.set(cle, []);
            const lignes = parMedia.get(cle);

            if (rap === 'auto') {
                // Annule un repli plus général (ex. la vue en liste du
                // catalogue, qui repasse la couverture en hauteur fixe).
                lignes.push(`  ${r.selecteur} { padding-top: 0; }`);
            } else if (r.largeurFixe) {
                // Largeur fixe : le pourcentage se rapporterait au conteneur.
                lignes.push(`  ${r.selecteur} { height: ${arrondi(parseFloat(r.largeurFixe) * rap)}px; }`);
            } else {
                lignes.push(`  ${r.selecteur} { height: 0; padding-top: ${arrondi(rap * 100)}%; }`);
                // `height: 100%` vaut 0 dans une boîte de hauteur nulle.
                lignes.push(`  ${r.selecteur} > img { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }`);
            }
            total++;
        }
    }

    const corps = [];
    for (const [media, lignes] of parMedia) {
        if (media) corps.push(`@media ${media} {`, ...lignes.map(l => '  ' + l), '}');
        else corps.push(...lignes);
    }

    const bloc = [
        DEBUT,
        '/* Ne pas modifier à la main : `npm run gen-repli-ar` régénère ce bloc.',
        `   ${total} déclaration(s) répliquée(s) pour les navigateurs sans aspect-ratio`,
        '   (WebView Android 8 = Chrome 61). Sur un navigateur récent, ce bloc',
        '   entier est ignoré. */',
        '@supports not (aspect-ratio: 1 / 1) {',
        ...corps.map(l => '  ' + l),
        '}',
        FIN,
    ].join('\n');

    return { bloc, total, ignorees };
}

function main() {
    const check = process.argv.includes('--check');
    const { bloc, total, ignorees } = construire();
    const actuel = fs.readFileSync(CIBLE, 'utf8');
    const avant = actuel.split(DEBUT)[0].replace(/\s+$/, '');
    const neuf = avant + '\n\n' + bloc + '\n';

    if (ignorees.length) {
        console.error('✖ aspect-ratio non reconnu (repli impossible) :');
        ignorees.forEach(l => console.error('   ' + l));
        process.exit(1);
    }
    if (check) {
        if (actuel !== neuf) {
            console.error('✖ le repli aspect-ratio de global.css n’est plus à jour.');
            console.error('  Une déclaration `aspect-ratio` a été ajoutée ou modifiée sans régénérer le repli.');
            console.error('  Sans lui, la boîte concernée fait 0 px de haut sur le WebView d’Android 8.');
            console.error('  → npm run gen-repli-ar');
            process.exit(1);
        }
        console.log(`✔ repli aspect-ratio à jour (${total} déclaration(s))`);
        return;
    }
    fs.writeFileSync(CIBLE, neuf, 'utf8');
    console.log(`✔ repli aspect-ratio écrit dans global.css (${total} déclaration(s))`);
}

main();
