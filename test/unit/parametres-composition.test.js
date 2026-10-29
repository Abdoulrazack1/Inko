// ============================================================
// test/unit/parametres-composition.test.js — un réglage ne se cherche
// pas sous deux cent dix-neuf lignes
// ------------------------------------------------------------
// Mesure de départ, page réelle : 19 810 px de haut, dont 14 189 px
// pour UNE carte — « Sessions actives », qui affichait les 219 sessions
// du compte sans plafond, chacune avec son bouton. Soit 72 % d'une page
// de réglages occupés par une liste, et 218 des 259 boutons.
//
// Et ses styles vivaient dans un bloc <style> du gabarit : c'était la
// seule page de l'application dans ce cas, donc la seule que rien de ce
// qui lit assets/css/*.css ne voyait — ni le générateur du repli
// aspect-ratio, ni le test qui interdit une virgule traînante dans une
// liste de sélecteurs, ni aucun test de composition.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const lire = (...p) => fs.readFileSync(path.join(__dirname, '..', '..', ...p), 'utf8');
const HTML = lire('parametres.html').replace(/\r\n/g, '\n');
const JS = lire('assets', 'js', 'parametres.js').replace(/\r\n/g, '\n');

test('la page a enfin une feuille de style', () => {
    const chemin = path.join(__dirname, '..', '..', 'assets', 'css', 'parametres.css');
    assert.ok(fs.existsSync(chemin), 'assets/css/parametres.css existe');
    assert.ok(!/<style>/.test(HTML), 'et le gabarit n’en porte plus');
    assert.match(HTML, /<link rel="stylesheet" href="assets\/css\/parametres\.css">/);
    // Ce qui compte : les outils qui balaient assets/css/*.css la voient.
    const CSS = fs.readFileSync(chemin, 'utf8').replace(/\r\n/g, '\n');
    assert.ok(CSS.includes('.set-card'), 'les règles ont bien suivi');
    assert.ok(CSS.includes('@media (max-width: 640px)'), 'les media queries aussi');
});

const CSS = lire('assets', 'css', 'parametres.css').replace(/\r\n/g, '\n');
const regle = (sel) => {
    const m = new RegExp('\\n' + sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' \\{([^}]*)\\}').exec(CSS);
    return m ? m[1] : null;
};

test('deux cent dix-neuf lignes ne tiennent pas dans une carte', () => {
    // La liste était rendue en entier : `sessions.map(...)`, sans plafond.
    assert.ok(!/sessions\.map\(s => `/.test(JS), 'plus de rendu intégral');
    assert.match(JS, /const VISIBLES = 5;/, 'un plafond');
    assert.match(JS, /const reste = rang\.length - VISIBLES;/);
    assert.match(JS, /rang\.slice\(0, VISIBLES\)\.map\(rangee\)/, 'les cinq premières');
    assert.match(JS, /rang\.slice\(VISIBLES\)\.map\(rangee\)/, 'le reste, replié');
    assert.match(JS, /Voir les \$\{reste\} autres sessions/, 'et un dépliant qui dit combien');
    // La session courante en tête, puis les plus récemment vues.
    assert.match(JS, /\(b\.current \? 1 : 0\) - \(a\.current \? 1 : 0\)/);
    assert.match(JS, /new Date\(b\.lastSeenAt\) - new Date\(a\.lastSeenAt\)/);
    // Un dépliant annonce son état.
    assert.match(JS, /aria-expanded="false"/);
    assert.match(JS, /plus\.setAttribute\('aria-expanded', String\(!ouvert\)\)/);
});

test('un panneau est un fond OU un filet', () => {
    // Dix-huit cartes, chacune avec les deux.
    const c = regle('.set-card');
    assert.ok(c, '.set-card');
    assert.ok(!/border: 1px solid/.test(c), 'dix-huit cartes portaient les deux');
    assert.match(c, /background: var\(--bg2\)/);
    // La zone de danger et la carte NSFW se marquaient par la couleur de
    // leur filet : elles prennent le filet d'accent utilisé partout ailleurs.
    assert.match(regle('.danger-zone'), /box-shadow: inset 3px 0 0/);
    assert.ok(!/\.danger-zone \{[^}]*border-color/.test(CSS));
});

test('le choix actif d’un segment n’est pas un aplat d’accent', () => {
    const a = regle('.seg button.active');
    assert.ok(a, '.seg button.active');
    assert.ok(!/var\(--orange\)/.test(a), 'septième écran, même réponse');
    assert.match(a, /background: var\(--bg4\)/, 'un pas de clarté');
    assert.match(a, /color: var\(--text\)/, 'et l’encre pleine');
});

test('plus de style en ligne pour le repère « cet appareil »', () => {
    assert.ok(!/style="color:var\(--accent-text\);font-size:11px"/.test(JS));
    assert.match(JS, /<span class="sess-ici">/);
    assert.ok(regle('.sess-ici'), 'et il a une règle');
});

test('les textes visibles portent leurs accents', () => {
    // « Me deconnecter », « Session fermee », « Base de donnees »,
    // « Desactive » étaient affichés tels quels.
    for (const faute of ['Me deconnecter', 'Session fermee', 'Base de donnees',
        "'Desactive'", 'Deconnecte', 'fermee(s)', 'deconnecte immediatement']) {
        assert.ok(!JS.includes(faute), `« ${faute} » s’affichait sans ses accents`);
    }
    assert.match(JS, /Me déconnecter/);
    assert.ok(!/Sante de l/.test(HTML), '« Santé de l’instance » aussi');
});

test('rien ne descend sous onze pixels dans les réglages', () => {
    const fautes = [];
    for (const m of CSS.matchAll(/([^\n{}]*)\{([^}]*font-size:\s*([\d.]+)px[^}]*)\}/g)) {
        if (Number(m[3]) < 11) fautes.push(`${m[1].trim()} — ${m[3]}px`);
    }
    assert.deepEqual(fautes, [], `sous le plancher :\n  ${fautes.join('\n  ')}`);
});

test('plus de petite capitale espacée dans les réglages', () => {
    const fautes = [];
    for (const m of CSS.matchAll(/([^\n{}]*)\{([^}]*)\}/g)) {
        if (/text-transform:\s*uppercase/.test(m[2])) fautes.push(m[1].trim());
    }
    assert.deepEqual(fautes, [], `à passer en bas de casse :\n  ${fautes.join('\n  ')}`);
});
