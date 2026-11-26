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

// ── DSK-11 / SEC-33 : TOUS les comptes root, pas seulement localhost ──
// L'application se connecte en TCP sur 127.0.0.1 (résolution de noms
// désactivée) : elle arrive comme root@127.0.0.1. Protéger root@localhost
// seul laissait ce compte ouvert à tous les programmes de la machine, et
// faisait refuser l'application elle-même au démarrage suivant.
test('secureEmbedded : le mot de passe est posé sur chaque compte root, les anonymes sont retirés', async () => {
    const c = {
        queries: [],
        escape: (v) => "'" + String(v).replace(/'/g, "''") + "'",
        async query(sql) {
            this.queries.push(sql);
            if (/User = 'root'/.test(sql)) return [[{ h: 'localhost' }, { h: '127.0.0.1' }, { h: '::1' }, { h: 'MA-MACHINE' }]];
            if (/User = ''/.test(sql)) return [[{ h: 'localhost' }]];
            return [{}];
        },
    };
    const pw = await secureEmbedded(c);
    for (const hote of ['localhost', '127.0.0.1', '::1', 'MA-MACHINE']) {
        assert.ok(c.queries.some(q => q.startsWith(`ALTER USER 'root'@'${hote}' IDENTIFIED BY '${pw}'`)), `root@${hote} doit être protégé`);
    }
    assert.ok(c.queries.includes("DROP USER ''@'localhost'"), 'le compte anonyme doit disparaître');
});

test('secureEmbedded : un échec sur les comptes secondaires ne bloque pas le démarrage', async () => {
    const c = {
        queries: [],
        escape: (v) => "'" + String(v) + "'",
        async query(sql) { this.queries.push(sql); if (/mysql\.user/.test(sql)) throw new Error('table absente'); return [{}]; },
    };
    let pw;
    await assert.doesNotReject(async () => { pw = await secureEmbedded(c); });
    assert.ok(pw && pw.length >= 32);
});

// ── DSK-10 : le schéma s'applique DANS la base ─────────────────
// `schema.sql` ne choisit plus de base (2.5.0). Sans `database` sur la
// connexion qui le joue : « No database selected », et une installation
// neuve sans MySQL ne démarrait jamais.
test('ensureSchemaOn : le schéma est joué sur une connexion qui choisit la base', async () => {
    const { ensureSchemaOn } = require('../lib/embedded-db').__test;
    const mysql = require('mysql2/promise');
    const avant = mysql.createConnection;
    let options = null;
    mysql.createConnection = async (o) => { options = o; return { query: async () => [{}], end: async () => {} }; };
    try {
        const conn = {
            config: { host: '127.0.0.1', port: 3406, user: 'root', password: 'x' },
            async query(sql) { return /COUNT/.test(sql) ? [[{ n: 0 }]] : [{}]; },
        };
        await ensureSchemaOn(conn);
    } finally { mysql.createConnection = avant; }
    assert.ok(options, 'le schéma doit être appliqué');
    assert.equal(options.database, process.env.DB_NAME || 'inko');
    assert.equal(options.multipleStatements, true);
});
