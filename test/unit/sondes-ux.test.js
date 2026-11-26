// ============================================================
// test/unit/sondes-ux.test.js — l'orchestrateur d'expérience ne ment pas
// ------------------------------------------------------------
// Les notes servent à comparer deux états et à ordonner le travail : elles doivent
// monter quand on corrige, ne rien inventer pour ce qui n'est pas mesuré, et la
// barrière doit se fermer sur un défaut grave nouveau. Les correcteurs suivent les
// mêmes promesses que les autres (idempotents, honnêtes, fins de ligne conservées).
// ============================================================
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const RACINE = fs.mkdtempSync(path.join(os.tmpdir(), 'inko-ux-'));
process.env.SONDES_RACINE = RACINE;
const ecrire = (f, t) => { const p = path.join(RACINE, f); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, t); };
const lire = (f) => fs.readFileSync(path.join(RACINE, f), 'utf8');

ecrire('page.html', '<!DOCTYPE html>\r\n<html lang="fr">\r\n<head><title>x</title></head>\r\n<body>\r\n<p>Chargement... Tu es prêt ? Oui : vas-y !</p>\r\n<input placeholder="Chercher...">\r\n<script>const a = "Attends... : ?";</script>\r\n<code>a ? b : c...</code>\r\n<!-- note... : -->\r\n</body>\r\n</html>\r\n');
ecrire('assets/css/global.css', ':root { --x: 1px; }\n');

const N = require('../../scripts-ci/sondes/ux-notes');
const { CORRECTEURS_UX, surLeTexte } = require('../../scripts-ci/sondes/correcteurs/ux');
const par = (nom) => CORRECTEURS_UX.find(c => c.nom === nom);

const releve = (id, gravite, extra = {}) => ({ sonde: 'ux-ecrans', dimension: 'hierarchie', id, gravite, effort: 'S', titre: `page.html : ${id}`, fichier: 'page.html', ...extra });

test('une dimension non mesurée n’a pas de note', () => {
    const e = N.noter([], ['ux-ecrans']);
    assert.strictEqual(e.dimensions.hierarchie.note, 100);
    assert.strictEqual(e.dimensions.efficacite.note, null);
    assert.strictEqual(e.dimensions.efficacite.mesuree, false);
});

test('la note baisse avec la gravité et le nombre, et remonte quand on corrige', () => {
    const note = (l) => N.noter(l, ['ux-ecrans']).dimensions.hierarchie.note;
    const une = note([releve('A', 'moyenne')]);
    const grave = note([releve('A', 'haute')]);
    const trois = note([1, 2, 3].map(i => releve('A', 'moyenne', { titre: `p${i}.html : A`, fichier: `p${i}.html` })));
    assert.ok(grave < une && trois < une && une < 100);
    assert.strictEqual(note([]), 100);
});

test('le même défaut sur beaucoup de pages pèse moins que autant de défauts différents', () => {
    const memes = N.noter(Array.from({ length: 8 }, (_, i) => releve('A', 'moyenne', { titre: `p${i} : A`, fichier: `p${i}.html` })), ['ux-ecrans']);
    const divers = N.noter(Array.from({ length: 8 }, (_, i) => releve('D' + i, 'moyenne')), ['ux-ecrans']);
    assert.ok(memes.dimensions.hierarchie.note > divers.dimensions.hierarchie.note);
    assert.strictEqual(memes.plan.length, 1);
    assert.strictEqual(memes.plan[0].occurrences, 8);
});

test('le plan met d’abord ce qui est grave et peu coûteux', () => {
    const e = N.noter([releve('FINITION', 'basse'), releve('GROS', 'haute', { effort: 'XL' }), releve('VITE', 'haute'), releve('FACILE', 'moyenne')], ['ux-ecrans']);
    assert.deepStrictEqual(e.plan.map(c => c.id), ['VITE', 'FACILE', 'GROS', 'FINITION']);
    assert.deepStrictEqual(e.plan.map(c => c.vague), [1, 2, 2, 4].sort((a, b) => a - b));
});

test('les relevés de sécurité ou d’outillage ne comptent pas dans l’expérience', () => {
    assert.strictEqual(N.dimensionDe({ sonde: 'securite-dyn', id: 'SD-SSRF', gravite: 'critique' }), null);
    assert.strictEqual(N.dimensionDe({ sonde: 'mobile', id: 'MOB-INTERROMPU', gravite: 'basse' }), null);
    assert.strictEqual(N.dimensionDe({ sonde: 'mobile', id: 'MOB-CIBLE-24', gravite: 'haute' }), 'adaptation');
    assert.strictEqual(N.dimensionDe({ sonde: 'parcours', id: 'CLAIR-AXE-LINK-NAME', gravite: 'haute' }), 'accessibilite');
});

test('la barrière se ferme sur un défaut grave nouveau ou une note qui chute', () => {
    const ref = N.noter([releve('A', 'moyenne')], ['ux-ecrans']);
    const pire = N.noter([releve('A', 'moyenne'), releve('B', 'haute')], ['ux-ecrans']);
    const motifs = N.barriere(N.comparer(pire, ref), 1);
    assert.ok(motifs.some(m => m.includes('B')));
    assert.ok(motifs.some(m => /Hiérarchie/.test(m)));
    assert.deepStrictEqual(N.barriere(N.comparer(ref, ref), 0), []);
    assert.strictEqual(N.comparer(ref, pire).disparus.length, 1);
});

test('surLeTexte ne touche ni aux balises, ni aux scripts, ni au code, ni aux commentaires', () => {
    const html = '<a title="x...">y...</a><script>z...</script><code>w...</code><!-- v... -->';
    assert.strictEqual(surLeTexte(html, (t) => t.replace(/\.\.\./g, '…')), '<a title="x...">y…</a><script>z...</script><code>w...</code><!-- v... -->');
});

test('correcteurs : plan honnête, idempotents, fins de ligne conservées', async () => {
    for (const nom of ['points-de-suspension', 'espaces-fines', 'zoom-saisie']) {
        const c = par(nom);
        const avant = ['page.html', 'assets/css/global.css'].map(lire);
        const plan = await c.plan();
        assert.deepStrictEqual(['page.html', 'assets/css/global.css'].map(lire), avant, `${nom} : plan() ne doit rien écrire`);
        assert.ok(plan.length > 0, `${nom} : devrait trouver quelque chose`);
        const faits = await c.appliquer();
        assert.deepStrictEqual(faits.map(x => x.fichier), plan.map(x => x.fichier));
        assert.deepStrictEqual(await c.appliquer(), [], `${nom} : second passage sans effet`);
    }
    const page = lire('page.html');
    assert.ok(page.includes('Chargement… Tu es prêt ? Oui : vas-y !'));
    assert.ok(page.includes('const a = "Attends... : ?";'), 'le script reste intact');
    assert.ok(page.includes('<code>a ? b : c...</code>'), 'le code reste intact');
    assert.ok(page.includes('placeholder="Chercher..."'), 'les attributs restent intacts');
    assert.ok(page.includes('\r\n') && !/[^\r]\n/.test(page), 'CRLF conservé');
    assert.ok(lire('assets/css/global.css').includes('font-size: max(16px, 1em)'));
});

test.after(() => fs.rmSync(RACINE, { recursive: true, force: true }));
