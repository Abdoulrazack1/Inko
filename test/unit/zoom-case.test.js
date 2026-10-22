// ============================================================
// test/unit/zoom-case.test.js — trouver la case désignée sur une planche
// ------------------------------------------------------------
// Vérifié dans le vrai lecteur (Chromium, planche de 4 cases bordées de
// gouttières blanches) : double-clic au milieu de la case centrale droite →
// la case est cadrée et centrée, 283 %, elle occupe 92 % de la hauteur de
// lecture ; Échap ramène la planche entière.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'js', 'zoom-case.js'), 'utf8');
const window = {};
// eslint-disable-next-line no-new-func
new Function('window', 'document', SRC)(window, {});
const { detecterCase } = window.MH.zoomCase;

/** Planche synthétique : fond blanc, cases grises texturées. */
function planche(w, h, cases) {
    const px = new Uint8ClampedArray(w * h * 4).fill(255);
    for (const [x0, y0, x1, y1] of cases) {
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
            const v = 60 + ((x * 7 + y * 13) % 120);   // texture : jamais un fond uni
            const i = (y * w + x) * 4; px[i] = px[i + 1] = px[i + 2] = v;
        }
    }
    return px;
}

const W = 100, H = 140;
const CASES = [[2, 2, 97, 44], [2, 48, 48, 92], [52, 48, 97, 92], [2, 96, 97, 137]];
const px = planche(W, H, CASES);
const proche = (a, b) => Math.abs(a - b) < 0.03;

test('le point au milieu d\'une case rend cette case', () => {
    const r = detecterCase(px, W, H, 75, 70);              // case du milieu à droite
    assert.ok(r, 'une case doit être trouvée');
    assert.ok(proche(r.x, 52 / W) && proche(r.y, 48 / H), JSON.stringify(r));
    assert.ok(proche(r.w, 46 / W) && proche(r.h, 45 / H), JSON.stringify(r));
});

test('une case pleine largeur est trouvée entière', () => {
    const r = detecterCase(px, W, H, 50, 20);
    assert.ok(r && proche(r.w, 96 / W) && proche(r.h, 43 / H), JSON.stringify(r));
});

test('un point dans une gouttière ne cadre rien', () => {
    assert.equal(detecterCase(px, W, H, 50, 46), null);   // gouttière horizontale
});

test('une planche sans gouttière (pleine page) ne cadre rien : on garde le zoom ancré', () => {
    const pleine = planche(W, H, [[0, 0, W - 1, H - 1]]);
    assert.equal(detecterCase(pleine, W, H, 50, 70), null);
});

test('le lecteur cadre la case au double-clic et au double appui, Échap ramène la planche', () => {
    const lecteur = fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'js', 'chapitre.js'), 'utf8');
    assert.match(lecteur, /addEventListener\('dblclick'[\s\S]{0,200}zoomerSurCase\(\{ x: e\.clientX, y: e\.clientY \}, img\)/);
    assert.match(lecteur, /lastTap = 0; zoomerSurCase\(/);
    assert.match(lecteur, /if \(zoomCaseActif\(\)\) \{ quitterZoomCase\(\); return; \}/);
    // Sans case reconnaissable : le zoom ancré existant, pas rien.
    assert.match(lecteur, /if \(!kase\) \{ toggleTapZoom\(point\); return; \}/);
    assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'chapitre.html'), 'utf8'), /<script src="assets\/js\/zoom-case\.js"><\/script>/);
});
