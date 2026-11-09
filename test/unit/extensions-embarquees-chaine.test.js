// ============================================================
// test/unit/extensions-embarquees-chaine.test.js — abaisser une extension
// sans perdre ce que son empreinte garantissait
// ------------------------------------------------------------
// Les extensions embarquees etaient copiees telles quelles dans le paquet
// mobile, et `extensions-community/hashes.json` avec elles. Mesure du
// garde-fou Android 8 : trois d'entre elles portent de la syntaxe
// posterieure a Chrome 61 — mangadex (15 constructions), novelbin (2),
// novelfull (1). Sur le WebView d'Android 8, ces fichiers ne se parsent
// pas : en mode autonome, ces trois sources n'existaient pas, et rien ne
// le disait.
//
// POURQUOI CE N'ETAIT PAS UNE LIGNE A CHANGER. L'empreinte est verifiee
// AVANT execution, cote telephone (`sources-embarquees.js`) comme cote
// serveur (audit S-2) : « c'est du code qui parle au reseau ». Transpiler
// change le contenu, donc l'empreinte — et recalculer naivement
// l'empreinte sur le fichier transpile remplacerait un controle
// d'integrite par une tautologie : « le fichier est bien celui que le
// build a ecrit », sans plus aucun lien avec la reference publiee.
//
// LA CHAINE, en trois temps, qui garde la propriete au lieu de la
// contourner :
//
//   1. la SOURCE est verifiee contre `extensions-community/hashes.json`,
//      la reference publiee — une source qui ne correspond pas ARRETE le
//      build. Ce controle-la n'existait pas dans le build ;
//   2. seulement ensuite, elle est abaissee vers chrome61 ;
//   3. le `hashes.json` du paquet porte l'empreinte du fichier ABAISSE,
//      c'est-a-dire de celui qui sera reellement execute.
//
// Ce que le telephone verifie a donc toujours un sens : il execute
// exactement ce que le build a produit, et le build n'a produit que ce
// qui correspondait a la reference publiee.
//
// Ce test tient les TROIS maillons dans la source du build. Le maillon
// manquant se verrait a l'oeil — et c'est precisement le genre de chose
// qu'on relit sans voir.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const RACINE = path.join(__dirname, '..', '..');
const lire = (...p) => fs.readFileSync(path.join(RACINE, ...p), 'utf8').replace(/\r\n/g, '\n');
const BUILD = lire('scripts-ci', 'build-mobile-www.js');

function bloc() {
    const i = BUILD.indexOf('function embarquerExtensions(src, dest) {');
    assert.notEqual(i, -1, 'embarquerExtensions doit rester reperable');
    return BUILD.slice(i, BUILD.indexOf('\n}\n', i));
}

test('maillon 1 : la source est confrontee a la reference publiee', () => {
    const b = bloc();
    assert.match(b, /JSON\.parse\(fs\.readFileSync\(refChemin, 'utf8'\)\)/,
        'la reference publiee doit etre lue');
    assert.match(b, /const vu = sha256\(brut\);/, 'l’empreinte porte sur la SOURCE');
    assert.match(b, /if \(vu !== attendu\) \{[\s\S]{0,400}?process\.exit\(1\)/,
        'une source qui ne correspond pas doit ARRETER le build, pas l’avertir');
    assert.match(b, /if \(!attendu\) \{[\s\S]{0,300}?process\.exit\(1\)/,
        'une extension sans empreinte publiee doit arreter le build aussi');
});

test('maillon 2 : l’abaissement vient APRES la verification', () => {
    const b = bloc();
    const iVerif = b.indexOf('if (vu !== attendu)');
    const iTrans = b.indexOf('esbuild.transformSync');
    assert.ok(iVerif !== -1 && iTrans !== -1);
    assert.ok(iVerif < iTrans,
        'verifier apres avoir transpile ne verifierait plus rien d’utile');
    assert.match(b, /target: CIBLE/, 'la meme cible que le reste du paquet');
    assert.match(b, /catch \(e\) \{[\s\S]{0,300}?transpilation impossible[\s\S]{0,200}?process\.exit\(1\)/,
        'une transpilation qui echoue ne doit pas laisser passer la source brute');
});

test('maillon 3 : l’empreinte du paquet porte sur ce qui sera execute', () => {
    const b = bloc();
    assert.match(b, /empreintes\[nom\] = sha256\(sortie\);/,
        'l’empreinte du paquet porte sur la SORTIE, pas sur la source');
    assert.match(b, /fs\.writeFileSync\(path\.join\(dest, nom, 'index\.js'\), sortie\)/,
        'c’est bien la sortie qui est ecrite dans le paquet');
    // Et le hashes.json du paquet est ECRIT, plus copie : copier la
    // reference apres avoir transpile ferait echouer chaque extension a
    // l’execution — le telephone refuserait tout.
    assert.ok(!/copyFileSync\([^)]*hashes\.json/.test(BUILD),
        'le hashes.json du paquet ne doit plus etre une copie de la reference');
    assert.match(b, /fs\.writeFileSync\(path\.join\(dest, 'hashes\.json'\)/);
});

test('la reference publiee correspond aux sources d’aujourd’hui', () => {
    // Si ce test tombe, ce n'est pas lui qu'il faut corriger : une
    // extension a change sans que `npm run gen-ext-hashes` soit relance,
    // et le build mobile s'arretera pour la meme raison.
    const dir = path.join(RACINE, 'extensions-community');
    const ref = JSON.parse(lire('extensions-community', 'hashes.json'));
    let n = 0;
    for (const id of fs.readdirSync(dir)) {
        const f = path.join(dir, id, 'index.js');
        if (!fs.existsSync(f)) continue;
        n++;
        const vu = crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
        assert.equal(vu, ref[id], id + ' : empreinte publiee perimee — npm run gen-ext-hashes');
    }
    assert.ok(n >= 5, 'au moins cinq extensions attendues, ' + n + ' trouvee(s)');
    assert.equal(Object.keys(ref).length, n,
        'hashes.json ne doit pas lister une extension absente');
});

test('le telephone verifie toujours avant d’executer', () => {
    // La chaine ci-dessus n'a de valeur que si le client s'en sert
    // encore. Le jour ou ce controle disparait, le reste ne protege plus
    // rien.
    const src = lire('assets', 'js', 'sources-embarquees.js');
    assert.match(src, /const vue = await empreinte\(source\);/);
    assert.match(src, /if \(vue !== empreintes\[id\]\) \{ refusees\.push/,
        'une empreinte qui ne correspond pas doit ecarter l’extension');
    assert.match(src, /return \{ chargees: 0, refusees: \['\(empreintes introuvables\)'\] \}/,
        'sans fichier d’empreintes, on ne charge rien');
});
