// ============================================================
// test/unit/minuteur-lecture.test.js — « encore 20 minutes »
// ------------------------------------------------------------
// Vérifié dans le vrai lecteur (Chromium, chapitre de 4 pages, enchaînement
// automatique coché) :
//   · minuteur hérité du chapitre précédent, échéance en page 1 → rien
//     (on ne coupe pas une planche) ; arrivée en page 4 → l'encart, et PAS
//     de compte à rebours vers le chapitre suivant ;
//   · échu pendant le changement de chapitre → l'encart dès l'ouverture ;
//   · minuteur non échu → l'enchaînement marche comme avant.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'js', 'chapitre.js'), 'utf8');
const bloc = SRC.slice(SRC.indexOf('    const CLE_MINUTEUR'), SRC.indexOf('    // ── Réglages lecteur : application + panneau ──'));

function monter({ minuteur, page = 1, total = 4 } = {}) {
    const { window } = new JSDOM('<body></body>');
    const store = new Map(minuteur ? [['inko_minuteur', JSON.stringify(minuteur)]] : []);
    const sessionStorage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: k => store.delete(k) };
    const minuteries = [];
    const env = { page, total, enchainementAnnule: 0, toasts: [] };
    // eslint-disable-next-line no-new-func
    const api = new Function('document', 'sessionStorage', 'setTimeout', 'clearTimeout', 'MH', 'env', `
        let sleepMins = 0, sleepTimerId = null, autoTimer = null;
        const stopAutoScroll = () => {};
        const annulerEnchainement = () => { env.enchainementAnnule++; };
        let totalPages = env.total, currentPage = env.page;
        ${bloc}
        return { armerMinuteur, lireMinuteur, setSleepTimer, triggerSleep,
                 echu: () => sleepEchu, allerA: (p) => { currentPage = p; if (sleepEchu && p >= totalPages) afficherRappelMinuteur(); } };
    `).call({}, window.document, sessionStorage, (f, ms) => { minuteries.push({ f, ms }); return minuteries.length; }, () => {},
        { icon: () => '', toast: (t) => env.toasts.push(t) }, env);
    return { api, store, minuteries, env, rappel: () => window.document.getElementById('sleepRappel') };
}

test('le minuteur est noté pour la session et survit au changement de chapitre', () => {
    const a = monter();
    a.api.setSleepTimer(20);
    const m = JSON.parse(a.store.get('inko_minuteur'));
    assert.equal(m.mins, 20);
    // Le chapitre suivant (nouvelle page) relit l'échéance et réarme le reste.
    const b = monter({ minuteur: m });
    b.api.armerMinuteur(b.api.lireMinuteur(), true);
    assert.equal(b.minuteries.length, 1);
    assert.ok(b.minuteries[0].ms > 19 * 60000 && b.minuteries[0].ms <= 20 * 60000);
});

test('échéance au milieu du chapitre : rien ne s\'affiche, l\'encart attend la dernière page', () => {
    const a = monter({ page: 2 });
    a.api.setSleepTimer(20);
    a.minuteries.at(-1).f();                  // l'heure passe
    assert.equal(a.rappel(), null, 'on ne coupe pas une planche');
    assert.equal(a.env.enchainementAnnule, 1, 'plus d\'enchaînement automatique');
    a.api.allerA(4);
    assert.match(a.rappel().textContent, /Tes 20 minutes sont passées\.[\s\S]*Fin de chapitre/);
    assert.equal(a.store.get('inko_minuteur'), undefined, 'consommé : il ne revient pas au chapitre suivant');
});

test('échu pendant le changement de chapitre : l\'encart dès l\'ouverture', () => {
    const a = monter({ minuteur: { mins: 20, fin: Date.now() - 1000 } });
    a.api.armerMinuteur(a.api.lireMinuteur(), true);
    assert.match(a.rappel().textContent, /Entre deux chapitres/);
});

test('« Encore 10 min » relance un minuteur, Off l\'efface', () => {
    const a = monter({ minuteur: { mins: 20, fin: Date.now() - 1000 } });
    a.api.armerMinuteur(a.api.lireMinuteur(), true);
    a.rappel().querySelector('#sleepEncore').onclick();
    assert.equal(JSON.parse(a.store.get('inko_minuteur')).mins, 10);
    assert.equal(a.rappel(), null);
    a.api.setSleepTimer(0);
    assert.equal(a.store.get('inko_minuteur'), undefined);
});

test('le lecteur branche le minuteur au chargement, à la dernière page et sur l\'enchaînement', () => {
    assert.match(SRC, /armerMinuteur\(lireMinuteur\(\), true\);/);
    assert.match(SRC, /if \(sleepEchu && p >= totalPages\) afficherRappelMinuteur\(\);/);
    // La garde, pas sa place : la lecture continue en pose une autre sur la
    // même ligne, et les deux doivent tenir ensemble.
    const ligne = SRC.split('\n').find(l => /armerEnchainement\(chapitreSuivant\(\)\)/.test(l));
    assert.ok(ligne, 'la ligne qui arme l’enchaînement doit rester repérable');
    assert.match(ligne, /autoNextActif\(\)/);
    assert.match(ligne, /!sleepEchu/,
        'minuterie échue : on ne lance pas le chapitre suivant tout seul');
    assert.ok(!/sleepOverlay/.test(SRC), 'plus de voile plein écran');
});
