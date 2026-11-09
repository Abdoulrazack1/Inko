// ============================================================
// test/unit/couvertures-absentes.test.js — la couverture qu'on n'a pas,
// et l'hote qui n'en donnera aucune
// ------------------------------------------------------------
// Deux choses, qui viennent du meme constat : « parfois les couvertures
// ne sont pas la, et on a des lettres ».
//
// ── 1. La lettre ne voulait rien dire ──
//
// Le visuel de remplacement affichait la PREMIERE LETTRE de sa graine.
// Or les trente points d'appel passent tous un IDENTIFIANT, jamais un
// titre : douze passent `f.mangaId`, quatre `m.id`. La lettre affichee
// etait donc le premier caractere de `01J76XY...` ou d'un UUID — un
// « 0 » ou un « a » geant, qui ne designe rien et se lit comme un
// defaut d'affichage.
//
// On dessine desormais un livre entrouvert, au trait, sur un fond qui
// garde la teinte derivee de l'identifiant — cette teinte distinguait
// les cartes entre elles et fait bien ce travail. Aucun texte : le
// titre est deja sous la carte, partout.
//
// ── 2. Pourquoi elles manquent, et pourquoi on arretait pas d'essayer ──
//
// Mesure du 9 novembre, une page de bibliotheque : 48 requetes de
// couverture vers uploads.mangadex.org, 48 echecs. MangaDex a place son
// CDN de couvertures derriere un defi anti-bot — toute requete est
// redirigee vers une page HTML `edge/challenge`, que le controle des
// octets refuse a juste titre. Verifie avec un UA de navigateur et un
// Referer : le defi s'applique quand meme, en 256 comme en 512.
//
// Ce n'est pas reparable de notre cote, et ca ne doit pas l'etre : un
// defi anti-automatisation est une decision du site. Ce qui est de
// notre ressort, c'est de ne pas le frapper quarante-huit fois pour
// apprendre quarante-huit fois la meme chose — chaque tentative coute
// 191 ms, un processus curl et un jeton de concurrence pris a des
// images qui, elles, pourraient arriver.
//
// Mesure apres, dix demandes d'affilee sur l'hote en panne :
//
//     0 a 5   source-error   ~180 ms   (vraies tentatives)
//     6 a 9   host-paused        6 ms   (aucune connexion)
//
// Et la propriete qui compte : pendant la pause, une image DEJA en
// cache sort toujours en 200 HIT. Une pause ne doit pas rendre aveugle
// a ce qu'on possede.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..', '..');
const lire = (...p) => fs.readFileSync(path.join(RACINE, ...p), 'utf8').replace(/\r\n/g, '\n');
const GLOBAL = lire('assets', 'js', 'global.js');
const PROXY = lire('server', 'controllers', 'image.controller.js');

/** Charge `placeholderCover` depuis la source reelle. */
function charger() {
    const i = GLOBAL.indexOf('    window.MH.placeholderCover = function (seed) {');
    assert.notEqual(i, -1, 'placeholderCover doit rester reperable');
    const bloc = GLOBAL.slice(i, GLOBAL.indexOf('\n    };', i) + 7);
    const window = { MH: {} };
    // eslint-disable-next-line no-new-func
    new Function('window', bloc)(window);
    return window.MH.placeholderCover;
}

test('le visuel de remplacement ne porte plus aucune lettre', () => {
    const ph = charger();
    for (const graine of ['01J76XYA1TQYKV6W4BCMR2WD5M', 'a1c7c817-4e59', '78027', 'z']) {
        const svg = decodeURIComponent(ph(graine).replace('data:image/svg+xml;utf8,', ''));
        assert.ok(!/<text/.test(svg), graine + ' : plus de <text> dans le visuel');
        assert.ok(!/font-size/.test(svg), graine + ' : plus de typographie du tout');
    }
});

test('il dessine un livre, et rien qu’avec des formes', () => {
    // Pas de filtre ni de masque : le WebView d’Android 8 doit le rendre
    // tel quel.
    const svg = decodeURIComponent(charger()('x').replace('data:image/svg+xml;utf8,', ''));
    assert.match(svg, /viewBox="0 0 300 420"/, 'le format 2:3 des couvertures, mesure a 0,667');
    assert.match(svg, /<path d="M150 150/, 'les deux pages du livre');
    assert.match(svg, /<path d="M150 150 L150 285"/, 'et leur pli');
    for (const interdit of ['<filter', 'mask=', 'backdrop', 'foreignObject']) {
        assert.ok(!svg.includes(interdit), 'rien que des formes : ' + interdit + ' est de trop');
    }
});

test('la teinte reste propre à l’œuvre : les cartes se distinguent', () => {
    const ph = charger();
    const teinte = (s) => (decodeURIComponent(ph(s)).match(/hsl\((\d+)/) || [])[1];
    const a = teinte('01J76XYA1TQYKV6W4BCMR2WD5M');
    const b = teinte('a1c7c817-4e59-43b7');
    assert.ok(a && b, 'une teinte doit etre derivee');
    assert.notEqual(a, b, 'deux œuvres differentes ne doivent pas rendre la meme couverture');
    assert.equal(teinte('meme-graine'), teinte('meme-graine'), 'et la meme œuvre, la meme');
});

test('un hôte qui refuse tout finit en pause, sans connexion', () => {
    assert.match(PROXY, /const ECHECS_SEUIL = parseInt\(process\.env\.IMG_HOTE_SEUIL \|\| '6', 10\);/);
    assert.match(PROXY, /const ECHECS_REPOS = parseInt\(process\.env\.IMG_HOTE_REPOS_MS \|\| '120000', 10\);/);
    assert.match(PROXY, /X-Inko-Proxy', 'host-paused'/,
        'la reponse doit DIRE que c’est une pause, pas une panne de plus');
    assert.match(PROXY, /noterSuccesHote\(host\);/,
        'un seul succes remet le compteur a zero : c’est une pause, pas une liste noire');
});

test('le cache passe AVANT la pause', () => {
    // La propriete qui compte : une pause ne doit pas rendre aveugle a ce
    // qu’on possede deja. Verifie en vrai sur official.lowee.us — image
    // en cache servie 200 HIT pendant que l’hote etait en pause.
    const i = PROXY.indexOf('if (await servirDepuisCache(url, res)) return;\n\n    if (hoteEnPause(host))');
    assert.notEqual(i, -1, 'le cache doit etre interroge avant la pause');
    const iPause = PROXY.indexOf('if (hoteEnPause(host))');
    const iDns = PROXY.indexOf('const safe = await resolveSafeHost(host);');
    assert.ok(iPause < iDns,
        'la pause doit court-circuiter AVANT la resolution DNS : sinon elle n’economise rien');
});

test('la pause ne compte que les echecs, et se raconte une fois', () => {
    const i = PROXY.indexOf('function noterEchecHote(host) {');
    assert.notEqual(i, -1);
    const b = PROXY.slice(i, PROXY.indexOf('\n}', i));
    assert.match(b, /if \(e\.echecs >= ECHECS_SEUIL && !e\.jusqua\)/,
        'le journal ne doit se remplir qu’une fois par pause, pas a chaque image');
    assert.match(b, /echecs d'affilee/, 'et dire combien, pour qu’on puisse juger');
});
