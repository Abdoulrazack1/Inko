// ============================================================
// test/unit/zones-sures-encoche.test.js — l'encoche ne mord rien, et ce
// n'est pas un hasard
// ------------------------------------------------------------
// Item du chantier : « Vérifier les zones sûres sur encoche ». Vérifié,
// et il n'y a rien à corriger — mais pour une raison qu'il faut écrire,
// sinon elle se perdra.
//
// Relevé : neuf éléments sont collés à un bord de l'écran en
// `position: fixed` — l'en-tête, la barre de navigation mobile, le dock
// musical, la barre du lecteur d'images, celle du lecteur de texte,
// celle du lecteur local, l'en-tête de comparaison, la barre de
// progression et la barre de titre du bureau. Deux seulement tiennent
// compte de `env(safe-area-inset-*)`.
//
// Ce serait un défaut si l'application entrait dans la zone de
// l'encoche. Elle n'y entre jamais :
//
//   · aucune des 26 pages ne déclare `viewport-fit=cover` ;
//   · le projet Android ne pose nulle part
//     `windowLayoutInDisplayCutoutMode` / `shortEdges` ;
//   · le mode immersif du lecteur passe par `requestFullscreen()`, qui
//     masque la barre d'état mais respecte l'encoche sans cet opt-in.
//
// Sans opt-in, le système réduit lui-même la fenêtre et
// `env(safe-area-inset-*)` vaut 0. Les deux usages existants sont donc
// une ceinture par-dessus les bretelles — inoffensifs.
//
// CE TEST tient l'implication, pas l'état : le jour où quelqu'un ajoute
// `viewport-fit=cover` — pour gagner les quelques pixels sous la barre
// d'état —, les neuf éléments deviennent d'un coup des défauts réels. Le
// test échoue alors, et dit quoi faire.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..', '..');
const CSS_DIR = path.join(RACINE, 'assets', 'css');

const pages = fs.readdirSync(RACINE).filter((f) => f.endsWith('.html'));
const couvre = pages.filter((p) => /viewport-fit\s*=\s*cover/
    .test(fs.readFileSync(path.join(RACINE, p), 'utf8')));

/** Les règles `position: fixed|sticky` ancrées à un bord haut ou bas. */
function collesAuBord() {
    const out = [];
    for (const f of fs.readdirSync(CSS_DIR).filter((x) => x.endsWith('.css'))) {
        const src = fs.readFileSync(path.join(CSS_DIR, f), 'utf8').replace(/\r\n/g, '\n');
        for (const m of src.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
            const corps = m[2];
            if (!/position:\s*(fixed|sticky)/.test(corps)) continue;
            if (!/\b(top|bottom):\s*0/.test(corps)) continue;
            out.push({
                fichier: f,
                sel: m[1].trim().split('\n').pop().trim(),
                sur: /safe-area-inset/.test(corps),
            });
        }
    }
    return out;
}

test('aucune page n’entre dans la zone de l’encoche', () => {
    // C'est CE fait qui rend les neuf éléments inoffensifs. S'il change,
    // le test suivant prend le relais.
    assert.deepEqual(couvre, [],
        'ces pages déclarent viewport-fit=cover : les éléments collés aux '
        + 'bords doivent alors tenir compte de env(safe-area-inset-*) — '
        + `voir le test suivant.\n  ${couvre.join('\n  ')}`);
});

test('et le projet Android ne demande pas l’encoche non plus', () => {
    const racine = path.join(RACINE, 'android', 'app', 'src', 'main');
    if (!fs.existsSync(racine)) return;            // pas de projet Android ici
    const fautes = [];
    const parcourir = (d) => {
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
            const p = path.join(d, e.name);
            if (e.isDirectory()) {
                // `assets/public` est la COPIE du site : déjà couverte plus haut.
                if (e.name === 'public' || e.name === 'node_modules') continue;
                parcourir(p); continue;
            }
            if (!/\.(xml|java|kt)$/.test(e.name)) continue;
            const s = fs.readFileSync(p, 'utf8');
            if (/windowLayoutInDisplayCutoutMode|shortEdges|LAYOUT_IN_DISPLAY_CUTOUT/.test(s)) {
                fautes.push(path.relative(RACINE, p));
            }
        }
    };
    parcourir(racine);
    assert.deepEqual(fautes, [],
        `ces fichiers demandent la zone de l’encoche :\n  ${fautes.join('\n  ')}`);
});

test('si jamais on y entre, tout ce qui touche un bord doit s’en protéger', () => {
    // L'implication, pas l'état. Tant que la condition est fausse, ce
    // test ne demande rien ; le jour où elle devient vraie, il énumère
    // exactement ce qu'il reste à faire.
    if (!couvre.length) {
        assert.ok(collesAuBord().length > 0, 'le relevé trouve bien des éléments collés');
        return;
    }
    const nus = collesAuBord().filter((r) => !r.sur)
        .map((r) => `${r.fichier} — ${r.sel}`);
    assert.deepEqual(nus, [],
        'viewport-fit=cover est actif : ces éléments collés à un bord n’ont '
        + `aucun env(safe-area-inset-*) et passeront sous l’encoche :\n  ${nus.join('\n  ')}`);
});
