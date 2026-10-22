// ============================================================
// test/unit/listes-intelligentes-regles.test.js — « en cours, non lu depuis
// 30 jours, source active »
// ------------------------------------------------------------
// Le côté serveur (règle d'inactivité, échelle des notes) est vérifié contre
// MySQL dans server/test/integration.db.test.js. Ici : le formulaire et la
// règle « source active », appliquée par le client.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const lire = (f) => fs.readFileSync(path.join(__dirname, '..', '..', f), 'utf8');

test('le formulaire propose et relit les deux nouvelles règles', () => {
    const html = lire('collections.html');
    assert.match(html, /id="listRuleInactif"[\s\S]*value="30">30 jours/);
    assert.match(html, /id="listRuleSourceActive"/);
    const js = lire('assets/js/collections.js');
    assert.match(js, /if \(inactif\) regles\.inactifJours = \+inactif;/);
    assert.match(js, /regles\.sourceActive = true;/);
    assert.match(js, /getElementById\('listRuleInactif'\)\.value = regles\?\.inactifJours/);
});

test('« source active » retire les séries des sources désactivées sur CET appareil', async () => {
    const api = lire('assets/js/api.js');
    const i = api.indexOf("lists:            ()");
    const debut = api.indexOf('a => {', i);
    const corps = api.slice(debut, api.indexOf('return a; }', debut) + 'return a; }'.length);
    const window = { MH: { isSourceEnabled: (s) => s !== 'coupee' } };
    // eslint-disable-next-line no-new-func
    const filtre = new Function('window', 'proxyCover', 'return ' + corps)(window, (u) => u);
    const listes = filtre([
        { rules: { sourceActive: true }, items: [{ id: 'a', source: 'weebcentral' }, { id: 'b', source: 'coupee' }] },
        { rules: { status: ['reading'] }, items: [{ id: 'c', source: 'coupee' }] },
    ]);
    assert.deepStrictEqual(listes[0].items.map(x => x.id), ['a']);
    assert.deepStrictEqual(listes[1].items.map(x => x.id), ['c'], 'sans la règle, rien n’est retiré');
});

test('le serveur compare les étoiles du formulaire aux notes sur 10', () => {
    const c = lire('server/controllers/user.controller.js');
    assert.match(c, /params\.push\(regles\.minRating \* 2\);/);
    assert.match(c, /p\.updated_at IS NULL OR p\.updated_at < NOW\(\) - INTERVAL \? DAY/);
});
