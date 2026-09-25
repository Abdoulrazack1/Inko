// ============================================================
// test/unit/compat.test.js — les fonctions absentes du WebView d'Android 8
// ------------------------------------------------------------
// esbuild abaisse la SYNTAXE pour Chrome 61, pas les FONCTIONS. Constaté sur
// émulateur API 26 : « Promise.allSettled is not a function » à l'ouverture
// de l'accueil. Ces tests simulent un moteur sans ces fonctions.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');
const SRC = fs.readFileSync(path.join(ROOT, 'assets', 'js', 'compat.js'), 'utf8');

/** Un contexte où les fonctions récentes ont été retirées. */
function moteurAncien() {
    const ctx = vm.createContext({});
    vm.runInContext(`
        delete Promise.allSettled; delete Object.fromEntries;
        delete Array.prototype.flat; delete Array.prototype.flatMap; delete Array.prototype.at;
        delete String.prototype.matchAll; delete String.prototype.replaceAll;
        var window = globalThis;
    `, ctx);
    vm.runInContext(SRC, ctx);
    return ctx;
}

test('Promise.allSettled rend le statut de chaque promesse', async () => {
    const ctx = moteurAncien();
    const r = await vm.runInContext('Promise.allSettled([Promise.resolve(1), Promise.reject(new Error("x"))])', ctx);
    assert.equal(r[0].status, 'fulfilled');
    assert.equal(r[0].value, 1);
    assert.equal(r[1].status, 'rejected');
});

test('Object.fromEntries, flat, at, replaceAll', () => {
    const ctx = moteurAncien();
    assert.deepEqual(JSON.parse(vm.runInContext('JSON.stringify(Object.fromEntries([["a",1],["b",2]]))', ctx)), { a: 1, b: 2 });
    assert.equal(vm.runInContext('[1,[2,[3]]].flat(2).length', ctx), 3);
    assert.equal(vm.runInContext('[1,2,3].at(-1)', ctx), 3);
    assert.equal(vm.runInContext('"a-b-c".replaceAll("-", "+")', ctx), 'a+b+c');
});

test('matchAll parcourt toutes les correspondances (les #tags du journal)', () => {
    const ctx = moteurAncien();
    const n = vm.runInContext('[..."un #tag et #autre".matchAll(/#(\\w+)/g)].map(m => m[1]).join(",")', ctx);
    assert.equal(n, 'tag,autre');
});

test('compat.js est injecté EN PREMIER dans les pages de l’APK', () => {
    const build = fs.readFileSync(path.join(ROOT, 'scripts-ci', 'build-mobile-www.js'), 'utf8');
    const i = build.indexOf("'<script src=\"assets/js/compat.js\"></script>'");
    const j = build.indexOf("'<script src=\"assets/js/natif.js\"></script>'");
    assert.ok(i > 0 && i < j, 'avant natif.js, donc avant tout le reste');
});
