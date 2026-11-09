// ============================================================
// test/unit/migrations-chaine.test.js — mettre a jour depuis deux
// versions en arriere
// ------------------------------------------------------------
// L'item disait « tester la mise a jour depuis deux versions en
// arriere ». Personne ne l'avait fait, et la reponse n'etait pas
// devinable : les migrations sont additives et rejouables, mais rien ne
// le verifiait sur une vraie base.
//
// Fait, sur une base JETABLE (`scripts-ci/essai-migrations.js`) :
//
//   A. socle schema.sql + toutes les migrations     -> schema A
//   B. A, moins les DEUX dernieres versions,
//      puis rattrapage                              -> schema B
//   C. rejeu complet par-dessus                     -> schema C
//
// Releve du 9 novembre : 27 migrations, rattrapage complet, et
// A = B = C, compares colonne par colonne et index par index via
// `information_schema`. La chaine tient.
//
// ── Ce que l'essai a trouve en chemin ──
//
// Le tableau `MIGRATIONS` se termine par 23, 24, **27, 26, 25** — deux
// branches developpees en parallele, fusionnees sans se relire. Et
// `ensureSchema` iterait le tableau DANS SON ORDRE : sur une base neuve,
// la 27 s'appliquait avant la 26 et la 25.
//
// Ca n'a rien casse — ces trois-la sont independantes, et l'essai rend
// le meme schema dans les deux sens. Mais le commentaire juste au-dessus
// de la boucle explique precisement le danger de l'ordre, et le tableau
// le contredisait. La premiere migration qui dependra d'une precedente
// echouerait sur une installation NEUVE uniquement : le pire endroit
// pour trouver ca.
//
// Les migrations sont donc TRIEES par version avant d'etre appliquees,
// et ce fichier tient l'invariant.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..', '..');
const lire = (...p) => fs.readFileSync(path.join(RACINE, ...p), 'utf8').replace(/\r\n/g, '\n');
const SRC = lire('server', 'db', 'migrate.js');

/** Les versions, dans l'ordre OU ELLES SONT ECRITES. */
function versionsDeclarees() {
    return [...SRC.matchAll(/\{\s*version:\s*(\d+),/g)].map((m) => Number(m[1]));
}

test('chaque version n’est declaree qu’une fois', () => {
    const v = versionsDeclarees();
    assert.ok(v.length >= 25, 'au moins 25 migrations attendues, ' + v.length + ' trouvees');
    const doublons = v.filter((x, i) => v.indexOf(x) !== i);
    assert.deepEqual(doublons, [],
        'deux migrations de meme version : la seconde ne serait jamais appliquee');
});

test('les versions se suivent sans trou', () => {
    // Un trou n'est pas fatal — la boucle applique ce qui manque — mais
    // c'est presque toujours une migration perdue a la fusion.
    const v = [...versionsDeclarees()].sort((a, b) => a - b);
    for (let i = 1; i < v.length; i++) {
        assert.equal(v[i], v[i - 1] + 1, 'trou entre ' + v[i - 1] + ' et ' + v[i]);
    }
    assert.equal(v[0], 1, 'la premiere version doit etre 1');
});

test('elles sont appliquees DANS L’ORDRE DES VERSIONS, pas du tableau', () => {
    // L'invariant que l'essai a rendu necessaire. Le tableau est
    // aujourd'hui desordonne (…24, 27, 26, 25) et peut le redevenir a
    // chaque fusion : c'est le tri qui protege, pas la discipline.
    assert.match(SRC, /const ordonnees = \[\.\.\.MIGRATIONS\]\.sort\(\(x, y\) => x\.version - y\.version\);/);
    assert.match(SRC, /for \(const m of ordonnees\) \{/);
    assert.ok(!/for \(const m of MIGRATIONS\) \{/.test(SRC),
        'plus aucune boucle sur le tableau brut');
});

test('le tableau EST desordonne : le tri n’est pas decoratif', () => {
    // Si ce test tombe parce que quelqu'un a range le tableau, tant
    // mieux — mais le tri doit rester, pour la prochaine fusion.
    const v = versionsDeclarees();
    const trie = [...v].sort((a, b) => a - b);
    assert.notDeepEqual(v, trie,
        'le tableau est range : garder le tri quand meme, et mettre ce test a jour');
});

test('une migration qui echoue n’est pas enregistree comme appliquee', () => {
    // Audit DB-05. C'est ce qui rend le rattrapage possible : une version
    // marquee a tort ne serait jamais rejouee.
    const i = SRC.indexOf('try {\n            await m.apply();');
    assert.notEqual(i, -1, 'l’application doit rester sous try');
    const b = SRC.slice(i, i + 900);
    assert.match(b, /a échoué — versions suivantes non appliquées/);
    assert.ok(b.indexOf('await m.apply()') < b.indexOf('schema_migrations'),
        'on enregistre APRES avoir reussi, jamais avant');
});

test('l’essai sur base jetable existe, et ne touche pas la base de travail', () => {
    const s = lire('scripts-ci', 'essai-migrations.js');
    assert.match(s, /const BASE = 'inko_essai_migr';/,
        'un nom en dur : une variable d’environnement mal posee ne doit pas rediriger la destruction');
    assert.match(s, /DROP DATABASE IF EXISTS/);
    assert.ok(!/process\.env\.DB_NAME \|\|/.test(s),
        'la base de travail ne doit jamais pouvoir devenir la cible');
    assert.match(s, /information_schema/,
        'la comparaison porte sur le schema reel, pas sur « ca a l’air de marcher »');
    assert.match(s, /deux derni[eè]res/i);
});
