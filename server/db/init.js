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

    console.log('▸ Création du compte démo…');
    const dbName = process.env.DB_NAME;
    await conn.query(`USE \`${dbName}\``);

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

    await conn.end();
    console.log('Base de données prête.');
    process.exit(0);
})().catch(err => {
    console.error('Erreur init :', err.message);
    process.exit(1);
});
