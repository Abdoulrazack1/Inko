// ============================================================
// test/unit/demarrage-mesure.test.js — le démarrage se mesure, et ce
// qu'on en disait était faux
// ------------------------------------------------------------
// Le chantier affirmait : « réduire le temps de premier lancement —
// l'initialisation de la base domine ». Personne ne l'avait mesuré.
//
// Relevé du 9 novembre, base déjà en service (démarrage À CHAUD) :
//
//      44 ms    7 %   checkCurl, synchrone et bloquant
//     104 ms   18 %   require embedded-db
//      75 ms   13 %   ensureDatabase
//     397 ms   69 %   require app
//     577 ms  100 %   total
//
// LA BASE FAIT 13 %. Ce qui domine, c'est le chargement des modules — et
// il n'y a pas de coupable : ~400 ms répartis sur des centaines de
// fichiers, le plus gros à 36 ms (`axios`), puis 30 (`mime-types`). Il
// n'y a rien à retirer d'un bloc.
//
// Un seul cas net : le contrôle de `curl`. Il bloquait le démarrage le
// temps d'un sous-processus, pour imprimer un avertissement que rien, au
// démarrage, n'attend — la première extension qui appellera `curl` est à
// des secondes de là.
//
// LE GAIN MESURÉ EST PETIT, et il faut le dire ainsi. Sept démarrages
// complets de chaque côté, du `spawn` jusqu'à la ligne « Inko backend » :
//
//     avant   médiane 943 ms   (905 – 1031)
//     après   médiane 924 ms   (845 –  964)
//
// Dix-neuf millisecondes sur neuf cents, et les deux plages se
// chevauchent largement. Ce n'est pas les 44 ms que la mesure
// intra-processus laissait espérer : `execFileSync` amorçait aussi la
// machinerie de `child_process` dont la version asynchrone a besoin.
// Ce qui est acquis est structurel — un appel bloquant de moins sur le
// chemin critique — pas spectaculaire.
//
// CE QUI N'A PAS ÉTÉ MESURÉ : le PREMIER lancement. Là, `ensureDatabase`
// crée la MariaDB embarquée et joue toutes les migrations, et la base
// domine probablement. Le mesurer demande de détruire une base
// existante ; je ne l'ai pas fait sur la machine de quelqu'un.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..', '..');
const lire = (...p) => fs.readFileSync(path.join(RACINE, ...p), 'utf8').replace(/\r\n/g, '\n');

test('le contrôle de curl ne bloque plus le démarrage', () => {
    const s = lire('server', 'server.js');
    assert.ok(!/execFileSync\('curl'/.test(s),
        'un appel synchrone attend le sous-processus : rien au démarrage n’attend sa réponse');
    assert.match(s, /execFile\('curl', \['--version'\]/, 'la version asynchrone reste');
    assert.match(s, /curl` est introuvable/, 'et l’avertissement aussi : on ne l’a pas supprimé');
    // L'ordre : la préparation de la base ne doit pas attendre derrière lui.
    assert.ok(s.indexOf("execFile('curl'") < s.indexOf('ensureDatabase()'),
        'il part tôt, mais sans retenir la suite');
});

test('l’instrument de mesure existe et dit ce qu’il ne couvre pas', () => {
    // Le vrai manque n'était pas la performance, c'était l'absence
    // d'instrument : l'affirmation « la base domine » n'avait jamais été
    // confrontée à un chiffre.
    const s = lire('scripts-ci', 'mesure-demarrage.js');
    assert.match(s, /require embedded-db/);
    assert.match(s, /ensureDatabase/);
    assert.match(s, /require app/);
    assert.match(s, /démarrage à CHAUD/i,
        'le relevé doit dire de quel démarrage il parle');
    assert.match(s, /PREMIER lancement/,
        'et dire explicitement que le premier lancement n’est pas couvert');
    assert.match(s, /--modules/, 'le détail par module doit rester accessible');
});

test('le temps PROPRE est mesuré, pas le temps cumulé', () => {
    // Sans soustraire les enfants, tout le coût remonte au premier module
    // chargé et le relevé ne désigne rien.
    const s = lire('scripts-ci', 'mesure-demarrage.js');
    assert.match(s, /cadre\.enfants/);
    assert.match(s, /total - cadre\.enfants/,
        'le temps propre, c’est le total moins ce qui a été passé dans les enfants');
    assert.match(s, /Module\.prototype\.require = vrai/,
        'et l’instrumentation se retire : un script de mesure ne laisse pas de traces');
});

test('le script de mesure n’est pas branché comme une porte de CI', () => {
    // Il mesure, il ne juge pas. Un seuil de temps sur une machine
    // partagée produirait des échecs qui ne veulent rien dire — c'est
    // exactement le piège des relevés de cette semaine.
    for (const w of fs.readdirSync(path.join(RACINE, '.github', 'workflows'))) {
        assert.ok(!lire('.github', 'workflows', w).includes('mesure-demarrage'),
            w + ' ne doit pas transformer une mesure en verdict');
    }
});
