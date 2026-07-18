// db/init.js — Exécute schema.sql (CREATE DATABASE + tables) puis seed un compte démo
const fs    = require('fs');
const path  = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

(async () => {
    const cfg = {
        host:     process.env.DB_HOST,
        port:     parseInt(process.env.DB_PORT || '3306', 10),
        user:     process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        multipleStatements: true,
    };

    console.log('▸ Connexion à MySQL en root…');
    const conn = await mysql.createConnection(cfg);

    const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    console.log('▸ Exécution du schema…');
    await conn.query(sql);

    const dbName = process.env.DB_NAME;
    await conn.query(`USE \`${dbName}\``);

    // Compte démo (audit S-4) : identifiants triviaux (demo@inko.app/demo1234)
    // codés en dur — une porte d'entrée publique si on repasse en LOCAL_MODE=0.
    // On ne le crée QUE sur demande explicite (SEED_DEMO=1). En mode local
    // (défaut), resolveOwner() crée de toute façon un propriétaire avec un mot
    // de passe aléatoire au premier appel API — aucun seed nécessaire.
    if (process.env.SEED_DEMO === '1') {
        console.log('▸ Création du compte démo (SEED_DEMO=1)…');
        const [rows] = await conn.query('SELECT id FROM users WHERE email = ?', ['demo@inko.app']);
        if (!rows.length) {
            const hash = await bcrypt.hash('demo1234', 10);
            await conn.query(
                'INSERT INTO users (username, email, password_hash, avatar) VALUES (?, ?, ?, ?)',
                ['Kaito', 'demo@inko.app', hash, 'K']
            );
            console.log('  Compte demo cree : demo@inko.app / demo1234');
        } else {
            console.log('  ↻ Compte démo déjà présent.');
        }
    } else {
        console.log('▸ Compte démo non créé (SEED_DEMO≠1) — le propriétaire local est créé automatiquement.');
    }

    await conn.end();

    // Migrations additives (threads, reports, notifications, push…)
    try {
        await require('./migrate').ensureSchema();
        console.log('▸ Migrations additives appliquées.');
    } catch (e) {
        console.warn('▸ Migrations additives ignorées :', e.message);
    }

    console.log('Base de données prête.');
    process.exit(0);
})().catch(err => {
    console.error('Erreur init :', err.message);
    process.exit(1);
});
