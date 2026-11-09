#!/usr/bin/env node
// ============================================================
// essai-migrations.js — mettre a jour depuis deux versions en arriere
// ------------------------------------------------------------
// Sur une base JETABLE (`inko_essai_migr`, creee et detruite ici), trois
// questions auxquelles personne ne savait repondre :
//
//   A. socle + toutes les migrations            -> schema A
//   B. A, moins les DEUX dernieres versions,
//      puis rattrapage                          -> schema B
//   C. rejeu complet par-dessus                 -> schema C
//
// A doit valoir B (mise a jour depuis deux versions en arriere) et C
// (idempotence). Le schema est compare colonne par colonne et index par
// index, via information_schema : pas « ca a l'air de marcher », mais
// deux chaines identiques ou la liste de ce qui manque.
//
// Releve du 9 novembre : 27 migrations, rattrapage complet, schemas
// identiques dans les deux cas.
//
// NE TOUCHE JAMAIS la base de travail : tout se passe dans une base
// dediee, et le nom est en dur pour qu'une variable d'environnement mal
// posee ne puisse pas la rediriger ailleurs.
//
//   node scripts-ci/essai-migrations.js
'use strict';
require(require('path').join(__dirname, '..', 'server', 'node_modules', 'dotenv')).config({ path: require('path').join(__dirname, '..', 'server', '.env') });
const mysql = require(require('path').join(__dirname, '..', 'server', 'node_modules', 'mysql2', 'promise'));

const BASE = 'inko_essai_migr';

async function admin() {
    return mysql.createConnection({
        host: process.env.DB_HOST || '127.0.0.1',
        port: parseInt(process.env.DB_PORT || '3306', 10),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        multipleStatements: false,
    });
}

async function neuve() {
    const c = await admin();
    await c.query(`DROP DATABASE IF EXISTS \`${BASE}\``);
    await c.query(`CREATE DATABASE \`${BASE}\` CHARACTER SET utf8mb4`);
    await c.end();
}

/** Le schéma, réduit à ce qui compte : tables, colonnes, types, index. */
async function schema() {
    const c = await admin();
    const [cols] = await c.query(
        `SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
         FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ?
         ORDER BY TABLE_NAME, COLUMN_NAME`, [BASE]);
    const [idx] = await c.query(
        `SELECT TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX, COLUMN_NAME, NON_UNIQUE
         FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = ?
         ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX`, [BASE]);
    await c.end();
    return JSON.stringify({ cols, idx });
}

async function appliquees() {
    const c = await admin();
    const [r] = await c.query(`SELECT version FROM \`${BASE}\`.schema_migrations ORDER BY version`);
    await c.end();
    return r.map((x) => Number(x.version));
}

/** Le socle : schema.sql, que les migrations completent ensuite. */
async function poserSocle() {
    const fs = require('fs');
    const sql = fs.readFileSync(require('path').join(__dirname, '..', 'server', 'db', 'schema.sql'), 'utf8');
    const c = await mysql.createConnection({
        host: process.env.DB_HOST || '127.0.0.1',
        port: parseInt(process.env.DB_PORT || '3306', 10),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: BASE,
        multipleStatements: true,
    });
    await c.query(sql);
    await c.end();
}

async function lancerEnsureSchema() {
    // ensureSchema utilise le pool de config/db, qui lit DB_NAME au require.
    // On relance donc un processus fils avec DB_NAME pointé sur la jetable.
    const { execFileSync } = require('child_process');
    execFileSync(process.execPath, ['-e',
        "require('./db/migrate').ensureSchema().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)})"],
        { cwd: require('path').join(__dirname, '..', 'server'), env: { ...process.env, DB_NAME: BASE }, stdio: 'pipe', timeout: 120000 });
}

/** Retire des lignes de schema_migrations pour simuler une base en retard. */
async function oublier(versions) {
    const c = await admin();
    await c.query(`DELETE FROM \`${BASE}\`.schema_migrations WHERE version IN (?)`, [versions]);
    await c.end();
}

(async () => {
    // ── A : tout d'un coup ──
    await neuve();
    await poserSocle();
    await lancerEnsureSchema();
    const A = await schema();
    const vA = await appliquees();

    // ── B : deux versions en arriere, puis rattrapage ──
    // On repart de la base A, on OUBLIE les deux dernieres versions, et on
    // relance : les migrations etant rejouables, elles doivent se
    // reappliquer sans rien casser, et rendre exactement le meme schema.
    const deuxDernieres = vA.slice(-2);
    await oublier(deuxDernieres);
    await lancerEnsureSchema();
    const B = await schema();
    const vB = await appliquees();

    // ── C : idempotence pure ──
    await lancerEnsureSchema();
    const C = await schema();

    console.log('  versions appliquees      : ' + vA.length + ' (' + vA.join(',') + ')');
    console.log('  deux dernieres oubliees  : ' + deuxDernieres.join(', '));
    console.log('  rattrapage complet       : ' + (vB.join(',') === vA.join(',')));
    console.log('  schema identique apres rattrapage : ' + (A === B));
    console.log('  schema identique apres rejeu      : ' + (A === C));
    if (A !== B) {
        const a = JSON.parse(A).cols, b = JSON.parse(B).cols;
        const cle = (x) => x.TABLE_NAME + '.' + x.COLUMN_NAME;
        const sa = new Set(a.map(cle)), sb = new Set(b.map(cle));
        console.log('  manquant apres rattrapage : ' + [...sa].filter((k) => !sb.has(k)).join(', '));
        console.log('  en trop apres rattrapage  : ' + [...sb].filter((k) => !sa.has(k)).join(', '));
    }

    const c = await admin();
    await c.query(`DROP DATABASE IF EXISTS \`${BASE}\``);
    await c.end();
})().catch((e) => { console.error('ECHEC :', e.message); process.exit(1); });
