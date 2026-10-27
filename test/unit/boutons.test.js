// ============================================================
// test/unit/boutons.test.js — un seul jeu de boutons, et leurs états
// ------------------------------------------------------------
// Contrairement aux cartes, le système `.btn` existait : 176 usages,
// quatre variantes, deux tailles. Deux choses lui manquaient, et toutes
// les deux sont des règles ABSENTES — le genre de défaut qu'une relecture
// ne voit pas, puisqu'il n'y a rien à lire.
//
//   · `btn-danger` était employé sur les trois boutons les plus dangereux
//     de l'application — effacer l'historique, fermer les autres sessions,
//     supprimer le compte — et n'existait pas dans le système : la classe
//     était déclarée dans `parametres.html`, sur des boutons qui ne
//     portaient même pas `.btn`. Mesuré côte à côte sur cette page :
//
//         .btn-danger (local)   36 px   padding 16   rayon 8    13px / 500
//         .btn .btn-sm          32 px   padding 13   rayon 16   12px / 600
//
//   · `.btn` n'avait aucun état désactivé, alors que 53 endroits du code
//     posent `.disabled = true`. Vérifié dans la page : fond, texte,
//     opacité et curseur identiques avant et après — le curseur annonçait
//     encore un clic possible.
//
// Après : les trois boutons de danger sont à 32 px / rayon 16 / 12px / 600
// comme leurs voisins, contraste du texte de 7,19 à 10,56 selon le thème,
// et un bouton désactivé change d'opacité et de curseur.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..', '..');
const CSS = path.join(RACINE, 'assets', 'css');
const lire = (...p) => fs.readFileSync(path.join(RACINE, ...p), 'utf8');

const FEUILLES = fs.readdirSync(CSS)
    .filter(f => f.endsWith('.css'))
    .map(f => fs.readFileSync(path.join(CSS, f), 'utf8'))
    .join('\n');

const PAGES = fs.readdirSync(RACINE).filter(f => f.endsWith('.html'));
const SCRIPTS = fs.readdirSync(path.join(RACINE, 'assets', 'js'))
    .filter(f => f.endsWith('.js'))
    .map(f => lire('assets', 'js', f))
    .join('\n');

test('toute variante employée est définie dans une feuille partagée', () => {
    // Une classe `btn-*` écrite dans un gabarit mais définie nulle part
    // rend un bouton nu. C'est ce qui est arrivé à `btn-danger`.
    const employees = new Set();
    const moisson = (src) => {
        for (const m of src.matchAll(/class="([^"]*\bbtn\b[^"]*)"/g)) {
            for (const c of m[1].split(/\s+/)) if (/^btn-/.test(c)) employees.add(c);
        }
    };
    moisson(SCRIPTS);
    for (const p of PAGES) moisson(lire(p));

    const orphelines = [...employees].filter(c => !new RegExp('\\.' + c + '\\b').test(FEUILLES));
    assert.deepEqual(orphelines.sort(), [],
        `variantes employées mais définies nulle part :\n  ${orphelines.join('\n  ')}`);
});

test('aucune page ne redessine un bouton du système dans son propre <style>', () => {
    // `parametres.html` définissait `.btn-danger` chez elle : la page avait
    // donc ses boutons à elle, plus courts, moins arrondis, moins gras.
    const fautes = [];
    for (const p of PAGES) {
        for (const bloc of lire(p).match(/<style>[\s\S]*?<\/style>/g) || []) {
            for (const m of bloc.matchAll(/(^|[\s,{}])(\.btn(?:-[a-z-]+)?)\s*[,{:]/g)) {
                // Une page a le droit de POSER un bouton dans sa mise en
                // page — l'étirer dans une rangée, lui garantir 44 px sous
                // le doigt. Ce qu'elle n'a pas le droit de faire, c'est lui
                // donner une AUTRE APPARENCE : c'est ainsi que les trois
                // boutons de suppression ont fini plus courts, moins
                // arrondis et moins gras que leurs voisins.
                const regle = bloc.slice(m.index, bloc.indexOf('}', m.index));
                if (/(background|border-radius|font-size|font-weight|\bcolor)\s*:/.test(regle)) {
                    fautes.push(`${p} — ${m[2]}`);
                }
            }
        }
    }
    assert.deepEqual([...new Set(fautes)], [],
        `à ramener dans le système :\n  ${[...new Set(fautes)].join('\n  ')}`);
});

test('un bouton désactivé ne ressemble pas à un bouton actif', () => {
    const regle = /\.btn:disabled,\s*\n?\.btn\[aria-disabled="true"\]\s*\{([^}]*)\}/.exec(FEUILLES);
    assert.ok(regle, '.btn doit avoir un état désactivé — 53 endroits du code le posent');
    assert.match(regle[1], /opacity\s*:/, 'il doit se voir');
    assert.match(regle[1], /cursor\s*:\s*not-allowed/,
        'et le curseur ne doit plus annoncer un clic possible');
});

test('un bouton désactivé ne se soulève plus sous la souris', () => {
    // Chaque variante pose son propre `:hover` avec une translation. Sans
    // extinction, un bouton inerte continuait de réagir.
    assert.match(FEUILLES, /\.btn:disabled\s*\{\s*pointer-events:\s*none/,
        'le `disabled` natif éteint tous les survols d’un coup');
    // `aria-disabled` reste cliquable et focalisable par construction : ses
    // survols s’éteignent un par un, variante par variante.
    for (const v of ['.btn-primary', '.btn-secondary', '.btn-ghost', '.btn-danger']) {
        assert.ok(FEUILLES.includes(`${v}[aria-disabled="true"]:hover`),
            `${v} doit éteindre son survol quand il est annoncé désactivé`);
    }
});

test('les boutons de danger sont dans le système', () => {
    const page = lire('parametres.html');
    for (const id of ['btnClearHistory', 'btnRevokeOthers', 'btnDeleteAccount']) {
        const m = new RegExp(`<button class="([^"]*)" id="${id}"`).exec(page);
        assert.ok(m, `${id} doit exister`);
        assert.match(m[1], /\bbtn\b/, `${id} : un bouton de suppression doit porter la géométrie du système`);
        assert.match(m[1], /btn-danger/, `${id} : et dire qu’il est dangereux`);
    }
});
