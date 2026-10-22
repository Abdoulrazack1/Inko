// ============================================================
// test/unit/signet-note.test.js — un signet qui porte une phrase
// ------------------------------------------------------------
// Vérifié dans le vrai lecteur (Chromium, serveur et MySQL réels) : page 3,
// B → le champ s'ouvre avec le focus, on tape « la case à montrer à Inès »,
// Entrée → le serveur rend { page: 3, note: "la case à montrer à Inès" } ;
// B rouvre la note préremplie avec « Retirer le signet » ; la bibliothèque
// affiche la phrase et « Lire » ouvre `…&page=3`.
// Avant : B posait le signet PUIS partait vers la bibliothèque (raccourci
// global sur la même touche), et le serveur enregistrait page = 1.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const lire = (f) => fs.readFileSync(path.join(__dirname, '..', '..', f), 'utf8');
const SRC = lire('assets/js/chapitre.js');
const bloc = SRC.slice(SRC.indexOf('    function signetCourant()'), SRC.indexOf('    // ── Mode immersif'));

function monter({ existants = [], page = 3 } = {}) {
    const { window } = new JSDOM('<body><button id="btnBookmark"></button></body>');
    let signets = existants.slice();
    const UserData = {
        getBookmarks: () => signets,
        addBookmark: (b) => { signets = signets.filter(x => x.chapterId !== b.chapterId); signets.unshift(b); },
        removeBookmark: (m, c) => { signets = signets.filter(x => x.chapterId !== c); },
    };
    // eslint-disable-next-line no-new-func
    const api = new Function('window', 'document', 'UserData', 'MH', 'API', 'manga', 'currentChap', 'currentPage', 'refreshBookmarkBtn',
        bloc + '; return { toggleBookmark };')(
        { UserData }, window.document, UserData, { toast: () => {} }, { sources: { current: 'weebcentral' } },
        { id: 'm1', title: 'Série' }, { id: 'c1', chapter: '4' }, page, () => {});
    return { api, doc: window.document, signets: () => signets, window };
}

test('B pose le signet avec sa VRAIE page et ouvre le champ de la note', () => {
    const m = monter();
    m.api.toggleBookmark();
    assert.equal(m.signets()[0].page, 3, 'la page part au serveur, pas seulement le libellé');
    const champ = m.doc.getElementById('signetNote');
    assert.ok(champ, 'le champ est ouvert');
    assert.equal(m.doc.getElementById('signetRetirer'), null, 'signet tout juste posé : pas de « retirer »');
});

test('la phrase est enregistrée, sans espaces parasites', () => {
    const m = monter();
    m.api.toggleBookmark();
    m.doc.getElementById('signetNote').value = '  la case à montrer  ';
    m.doc.getElementById('signetPop').dispatchEvent(new m.window.Event('submit', { cancelable: true }));
    assert.equal(m.signets()[0].note, 'la case à montrer');
    assert.equal(m.doc.getElementById('signetPop'), null);
});

test('sur un signet existant : note préremplie, page d\'origine gardée, retrait possible', () => {
    const m = monter({ existants: [{ mangaId: 'm1', chapterId: 'c1', page: 9, note: 'la révélation' }], page: 3 });
    m.api.toggleBookmark();
    assert.equal(m.doc.getElementById('signetNote').value, 'la révélation');
    m.doc.getElementById('signetPop').dispatchEvent(new m.window.Event('submit', { cancelable: true }));
    assert.equal(m.signets()[0].page, 9, 'relire sa note ne déplace pas le signet');
    m.api.toggleBookmark();
    m.doc.getElementById('signetRetirer').click();
    assert.equal(m.signets().length, 0);
});

test('les touches du lecteur ne déclenchent plus les raccourcis globaux', () => {
    const global = lire('assets/js/global.js');
    assert.match(global, /if \(touchesReservees\.has\(e\.key\)\) return;\s*const action = MH\.actionRaccourci\(e\.key\);/);
    assert.match(SRC, /reserverTouches\?\.\(\[[^\]]*'b', 'B', 'h', 'H'[^\]]*'\?'/);
    assert.match(lire('assets/js/lecture.js'), /reserverTouches\?\.\(\[/);
    assert.match(SRC, /case 'b': case 'B': e\.preventDefault\(\); toggleBookmark\(\);/);
});

test('la bibliothèque rouvre la page marquée et montre la phrase', () => {
    const biblio = lire('assets/js/bibliotheque.js');
    assert.match(biblio, /MH\.readerHref\(b\.mangaId, b\.chapterId, b\.source, b\.page\)/);
    assert.match(biblio, /<q class="bm-note">\$\{MH\.esc\(b\.note\)\}<\/q>/);
});
