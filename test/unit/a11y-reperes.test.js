// ============================================================
// test/unit/a11y-reperes.test.js — titres, repères, étiquettes (A11Y-01/02/03)
// ------------------------------------------------------------
// L'audit relevait 4 pages sans `h1`, 3 sans `main`, 8 champs sans étiquette.
// Ces manques ne se voient jamais à l'écran : la page est parfaitement
// utilisable à la souris, et parfaitement opaque au clavier et à la voix.
//
// C'est aussi le genre de dette qui revient toute seule — il suffit d'ajouter
// une page. D'où ce test, qui échoue sur la page suivante.
//
// Deux subtilités que ma première mesure avait ratées, et qui sont donc
// encodées ici :
//   — un champ DANS un `<label>` est étiqueté implicitement (valide) ;
//   — un `h1` injecté par le script de la page compte : la page en a bien un.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const pages = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html')).sort();
const lire = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

// Les scripts communs : ils ne portent pas le titre d'une page précise.
const COMMUNS = new Set(['global', 'i18n', 'pwa', 'eula', 'api', 'hub', 'natif',
    'theme', 'feuille', 'une-main', 'tirer-rafraichir', 'storage', 'userdata']);

/** Le `h1` peut être écrit dans la page, ou posé par son script. */
function aUnTitre(page) {
    const html = lire(page);
    if (/<h1[\s>]/.test(html)) return true;

    const scripts = [...html.matchAll(/<script src="assets\/js\/([a-z0-9-]+)\.js"/g)]
        .map((m) => m[1]).filter((n) => !COMMUNS.has(n));
    return scripts.some((n) => {
        try { return /<h1[\s>]/.test(fs.readFileSync(path.join(ROOT, 'assets', 'js', n + '.js'), 'utf8')); }
        catch (e) { return false; }
    });
}

test('chaque page a un titre de niveau 1', () => {
    const sans = pages.filter((p) => !aUnTitre(p));
    assert.deepEqual(sans, [], `pages sans h1 : ${sans.join(', ')}`);
});

test('chaque page a un repère principal', () => {
    // Sans `<main>`, « aller au contenu » n'a pas de cible : le lecteur d'écran
    // repart de l'en-tête à chaque page, donc de la navigation entière.
    const sans = pages.filter((p) => !/<main[\s>]/.test(lire(p)));
    assert.deepEqual(sans, [], `pages sans main : ${sans.join(', ')}`);
});

test('chaque champ de saisie est étiqueté', () => {
    // Un `placeholder` N'EST PAS une étiquette : il disparaît dès qu'on tape,
    // et plusieurs lecteurs d'écran ne l'annoncent pas. Le champ devient alors
    // « zone de texte », sans plus.
    const nus = [];
    for (const p of pages) {
        const s = lire(p);
        for (const m of s.matchAll(/<(input|select|textarea)\b([^>]*)>/g)) {
            const attrs = m[2];
            if (/type=["'](hidden|submit|button|reset)["']/.test(attrs)) continue;
            if (/aria-label\s*=|aria-labelledby\s*=|title\s*=/.test(attrs)) continue;

            const id = /id=["']([^"']+)/.exec(attrs);
            if (id && new RegExp('<label[^>]*for=["\']' + id[1] + '["\']').test(s)) continue;

            // Étiquetage implicite : le `<label>` ouvert n'est pas refermé.
            const avant = s.slice(0, m.index);
            if (avant.lastIndexOf('<label') > avant.lastIndexOf('</label>')) continue;

            nus.push(`${p}:${avant.split('\n').length} ${id ? '#' + id[1] : m[1]}`);
        }
    }
    assert.deepEqual(nus, [], `champs sans étiquette :\n  ${nus.join('\n  ')}`);
});

test('aucun gestionnaire écrit en attribut (DESK-02)', () => {
    // Sous la CSP de l'app installée, `onclick="…"` est INERTE. L'audit en
    // comptait 52 ; le dernier survivant était le bouton « Réessayer » de la
    // page hors-ligne — c'est-à-dire le seul bouton d'une page qui ne sert
    // qu'à ça.
    const coupables = [];
    for (const p of pages) {
        const s = lire(p);
        for (const m of s.matchAll(/\son(click|change|input|submit|load|error|keydown)\s*=\s*["']/g)) {
            coupables.push(`${p}:${s.slice(0, m.index).split('\n').length}`);
        }
    }
    assert.deepEqual(coupables, [], `gestionnaires en attribut : ${coupables.join(', ')}`);
});

test('la classe qui cache aux yeux sans cacher aux lecteurs est correcte', () => {
    // `display:none` et `visibility:hidden` retirent l'élément de l'arbre
    // d'accessibilité AUSSI : un titre ainsi masqué ne sert plus à rien.
    const css = fs.readFileSync(path.join(ROOT, 'assets', 'css', 'global.css'), 'utf8');
    const bloc = /\.a11y-invisible\s*\{([^}]*)\}/.exec(css);
    assert.ok(bloc, '.a11y-invisible doit exister');
    assert.ok(!/display\s*:\s*none/.test(bloc[1]), 'display:none retirerait le titre des lecteurs d’écran');
    assert.ok(!/visibility\s*:\s*hidden/.test(bloc[1]), 'visibility:hidden aussi');
    assert.match(bloc[1], /position\s*:\s*absolute/);
});
