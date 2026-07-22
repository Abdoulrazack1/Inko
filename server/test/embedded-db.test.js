// test/embedded-db.test.js — durcissement du démarrage base embarquée (audit S12)
// ------------------------------------------------------------
// Garde-fou anti « écran noir » : poser le mot de passe root de la MariaDB
// embarquée est une opération BEST-EFFORT. Si le serveur refuse la requête
// (version, syntaxe, droits), le backend doit démarrer quand même en mot de
// passe vide — jamais crasher. Ces tests utilisent une fausse connexion, donc
// aucune base réelle requise.
const { test } = require('node:test');
const assert = require('node:assert');
const { secureEmbedded } = require('../lib/embedded-db');

// Fausse connexion mysql2 minimale
function fakeConn({ failAlter = false, failSet = false } = {}) {
    return {
        queries: [],
        escape: (v) => "'" + String(v).replace(/'/g, "''") + "'",
        async query(sql) {
            this.queries.push(sql);
            if (/^ALTER USER/i.test(sql) && failAlter) throw new Error('ALTER USER non supporté');
            if (/^SET PASSWORD/i.test(sql) && failSet) throw new Error('PASSWORD() supprimée');
            return [{}];
        },
    };
}

test('secureEmbedded : ALTER USER en priorité, renvoie un mot de passe', async () => {
    const c = fakeConn();
    const pw = await secureEmbedded(c);
    assert.ok(pw && pw.length >= 32, 'mot de passe généré');
    assert.match(c.queries[0], /^ALTER USER 'root'@'localhost' IDENTIFIED BY/);
});

test('secureEmbedded : repli sur SET PASSWORD si ALTER USER échoue', async () => {
    const c = fakeConn({ failAlter: true });
    const pw = await secureEmbedded(c);
    assert.ok(pw && pw.length >= 32);
    assert.match(c.queries[0], /^ALTER USER/);
    assert.match(c.queries[1], /^SET PASSWORD = PASSWORD\(/);
});

test('secureEmbedded : les DEUX formes échouent → PAS d\'exception, mot de passe vide', async () => {
    const c = fakeConn({ failAlter: true, failSet: true });
    // Le point critique : ne doit JAMAIS rejeter (sinon backend down = écran noir)
    let pw;
    await assert.doesNotReject(async () => { pw = await secureEmbedded(c); });
    assert.equal(pw, '', 'repli en mot de passe vide, démarrage préservé');
});

test('secureEmbedded : n\'échappe jamais le mot de passe hors littéral SQL', async () => {
    const c = fakeConn();
    await secureEmbedded(c);
    // le mot de passe est passé en littéral échappé (quotes), pas de placeholder ?
    assert.doesNotMatch(c.queries[0], /\?/);
    assert.match(c.queries[0], /IDENTIFIED BY '[0-9a-f]+'/);
});
