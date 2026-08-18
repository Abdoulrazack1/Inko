// ============================================================
// test/unit/cheerio-navigateur.test.js — le faux cheerio contre le VRAI
// ------------------------------------------------------------
// Six extensions scrapent du HTML avec `cheerio`. Pour qu'elles tournent aussi
// sur le téléphone, `cheerio-navigateur.js` réimplémente son interface sur
// `DOMParser`. Toute divergence de comportement se traduirait par une source
// qui « ne trouve rien » sur mobile et marche sur le PC — le pire des défauts
// à diagnostiquer, parce qu'il n'y a ni erreur ni trace.
//
// D'où ce test : chaque assertion est passée aux DEUX implémentations, et on
// exige le MÊME résultat. Le vrai cheerio est celui que le serveur utilise
// déjà (`server/node_modules`), pas une version choisie pour l'occasion.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..', '..');

let vraiCheerio = null;
for (const p of [path.join(ROOT, 'server', 'node_modules', 'cheerio'), 'cheerio']) {
    try { vraiCheerio = require(p); break; } catch (e) { /* suivant */ }
}

// Le module s'appuie sur `DOMParser`, absent de Node : on le prend de JSDOM.
const dom = new JSDOM('<!doctype html><html><body></body></html>', { runScripts: 'outside-only' });
dom.window.eval(fs.readFileSync(path.join(ROOT, 'assets', 'js', 'cheerio-navigateur.js'), 'utf8'));
const faux = dom.window.INKO_CHEERIO;

const HTML = `
<html><body>
  <div class="liste" id="principal">
    <a class="item" href="/a" data-id="1">Premier</a>
    <a class="item vedette" href="/b" data-id="2">Deuxième</a>
    <a class="item" href="/c">Troisième</a>
    <span class="vide"></span>
  </div>
  <div class="liste">
    <a class="item" href="/d">Quatrième</a>
  </div>
  <script>du bruit</script>
</body></html>`;

/** Applique la même fonction aux deux implémentations et compare. */
function pareil(nom, fn) {
    test(nom, () => {
        if (!vraiCheerio) { console.log('   (cheerio absent — comparaison sautée)'); return; }
        const attendu = fn(vraiCheerio.load(HTML));
        const obtenu = fn(faux.load(HTML));
        assert.deepEqual(obtenu, attendu,
            `divergence : le vrai cheerio rend ${JSON.stringify(attendu)}, le nôtre ${JSON.stringify(obtenu)}`);
    });
}

pareil('.length compte les mêmes éléments', ($) => $('.item').length);
pareil('.text() concatène TOUS les éléments retenus', ($) => $('.item').text());
pareil('.text() sur un seul élément', ($) => $('#principal .vedette').text());
pareil('.attr() rend la valeur du premier', ($) => $('.item').attr('href'));
pareil('.attr() d’un attribut absent est undefined, jamais null', ($) => {
    const v = $('.item').attr('inexistant');
    return [v, v === undefined, v === null];
});
pareil('.first() puis .attr()', ($) => $('.item').first().attr('data-id'));
pareil('.eq() accepte un index', ($) => $('.item').eq(1).text());
pareil('.find() descend dans la sélection', ($) => $('#principal').find('a.item').length);
pareil('.find() ne dédouble pas sur plusieurs racines', ($) => $('.liste').find('.item').length);
pareil('.parent() remonte', ($) => $('.vedette').parent().attr('id'));
pareil('.closest() remonte jusqu’au sélecteur', ($) => $('.vedette').closest('.liste').attr('id'));
pareil('.filter() par sélecteur', ($) => $('.item').filter('.vedette').length);
pareil('.filter() par fonction reçoit (index, element)', ($) =>
    $('.item').filter((i) => i % 2 === 0).length);
pereilOuPas();

function pereilOuPas() {
    // `.map()` rend un objet cheerio : la chaîne `.map(...).get()` est le
    // motif utilisé par les six extensions. Rendre un tableau la casserait.
    pareil('.map().get() rend un tableau de valeurs', ($) =>
        $('.item').map((i, el) => $(el).attr('href')).get());

    pareil('.each() est appelé avec (index, element)', ($) => {
        const vus = [];
        $('.item').each((i, el) => vus.push(i + ':' + $(el).text()));
        return vus;
    });
}

pareil('.get() sans argument rend tous les nœuds', ($) => $('.item').get().length);
pareil('.html() rend le contenu interne du premier', ($) => $('.vedette').html());
pareil('.html() sur une sélection vide', ($) => $('.absent').html());
pareil('.next() prend le frère suivant', ($) => $('.item').first().next().text());
pareil('.children() liste les enfants directs', ($) => $('#principal').children().length);
pareil('.remove() retire de l’arbre', ($) => {
    $('script').remove();
    return $('script').length;
});
pareil('.data() lit les attributs data-', ($) => $('.vedette').data('id'));
pareil('un sélecteur sans résultat rend une sélection vide', ($) => [$('.rien').length, $('.rien').text()]);
pareil('.add() fusionne deux sélections', ($) => $('.vedette').add($('.vide')).length);

test('le HTML mal formé est réparé comme un navigateur le ferait', () => {
    // C'est le cas NORMAL du scraping : balises non fermées, imbrications
    // illégales. `DOMParser` applique les règles de réparation du HTML réel.
    const casse = '<div class="a"><p>un<div class="b">deux</div>';
    const $ = faux.load(casse);
    assert.equal($('.a').length, 1);
    assert.equal($('.b').length, 1);
    assert.match($('.b').text(), /deux/);
});

test('un document vide ne fait pas tomber le module', () => {
    for (const entree of ['', null, undefined, '<>']) {
        const $ = faux.load(entree);
        assert.equal($('.quoi').length, 0);
        assert.equal($('.quoi').text(), '');
    }
});
