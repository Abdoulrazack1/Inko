// API-14 / SEC-21 / SEC-22 : une saisie invalide est refusée (4xx), jamais
// une erreur serveur, et le message SQL ne sort pas.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { errorHandler } = require('../middleware/errorHandler');

function repondre(err) {
    let statut = 0, corps = null;
    const res = { status(c) { statut = c; return this; }, json(b) { corps = b; return this; } };
    const avant = console.warn; console.warn = () => {};
    try { errorHandler(err, {}, res, () => {}); } finally { console.warn = avant; }
    return { statut, corps };
}

test('une erreur SQL de donnée invalide devient 400, sans le message SQL', () => {
    for (const code of ['ER_TRUNCATED_WRONG_VALUE', 'ER_BAD_FIELD_ERROR', 'ER_DATA_TOO_LONG', 'ER_SP_UNDECLARED_VAR', 'ER_INVALID_JSON_TEXT']) {
        const r = repondre(Object.assign(new Error("Unknown column 'NaN' in 'where clause'"), { code }));
        assert.strictEqual(r.statut, 400, code);
        assert.ok(!/column|NaN|where/i.test(r.corps.error), code + ' : le message SQL ne sort pas');
    }
});

test('un corps illisible ou trop gros répond 400 / 413', () => {
    assert.strictEqual(repondre(Object.assign(new Error('x'), { type: 'entity.parse.failed', status: 400 })).statut, 400);
    assert.strictEqual(repondre(Object.assign(new Error('x'), { type: 'entity.too.large', status: 413 })).statut, 413);
});

test('SEC-21 : 12 Mo seulement pour l’import, et après l’authentification', () => {
    const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
    assert.ok(!/express\.json\(\{ limit: '12mb' \}\)/.test(app), "plus de limite de 12 Mo globale");
    assert.match(app, /express\.json\(\{ limit: '2mb' \}\)/);
    const routes = fs.readFileSync(path.join(__dirname, '..', 'routes', 'index.js'), 'utf8');
    assert.match(routes, /'\/me\/import',\s+auth\.authRequired, require\('express'\)\.json\(\{ limit: '12mb' \}\)/);
});

test('SEC-22 : la couverture d’une note passe par le filtre des adresses', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'controllers', 'notes.controller.js'), 'utf8');
    assert.match(src, /couverture\.brute\(b\.cover\)/);
    assert.strictEqual(require('../lib/couverture').brute('javascript:alert(1)'), null);
});
