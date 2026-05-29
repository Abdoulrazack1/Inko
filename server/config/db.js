// config/db.js — Pool MySQL réutilisé partout
const mysql = require('mysql2/promise');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const pool = mysql.createPool({
    host:     process.env.DB_HOST     || '127.0.0.1',
    port:     parseInt(process.env.DB_PORT || '3306', 10),
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME     || 'inko',
    waitForConnections: true,
    connectionLimit:    15,
    queueLimit:         0,
    charset:            'utf8mb4',
    decimalNumbers:     true,
});

async function ping() {
    const conn = await pool.getConnection();
    try { await conn.query('SELECT 1'); }
    finally { conn.release(); }
}

module.exports = { pool, ping };
