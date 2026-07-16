// ============================================================
// backup.js — Sauvegardes automatiques planifiées (audit N35)
// ------------------------------------------------------------
// L'export manuel existait (bouton Paramètres) mais dépendait de la
// mémoire de l'utilisateur. Ici : un dump JSON de TOUS les comptes est
// écrit chaque nuit dans server/backups/ (rotation, 14 fichiers max).
// Fichiers locaux uniquement — jamais servis par HTTP (le dossier n'est
// pas dans l'arborescence statique).
// ============================================================
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');

const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, '..', 'backups');
const KEEP = Math.max(2, parseInt(process.env.BACKUP_KEEP || '14', 10) || 14);

// Mêmes données que l'export manuel (user.controller exportData), par compte
async function buildUserExport(u) {
    const uid = u.id;
    const [favorites]    = await pool.query('SELECT manga_id, source, title, cover, category, last_chapter, added_at FROM favorites WHERE user_id = ?', [uid]);
    const [library]      = await pool.query('SELECT manga_id, status, rating FROM library WHERE user_id = ?', [uid]);
    const [progress]     = await pool.query('SELECT manga_id, chapter_id, chapter_number, page, source FROM progress WHERE user_id = ?', [uid]);
    const [readChapters] = await pool.query('SELECT manga_id, chapter_id, chapter_number FROM read_chapters WHERE user_id = ?', [uid]);
    const [ratings]      = await pool.query('SELECT manga_id, rating, review FROM ratings WHERE user_id = ?', [uid]);
    const [lists]        = await pool.query('SELECT id, name, description, is_public, created_at FROM lists WHERE user_id = ?', [uid]);
    const [listItems] = lists.length
        ? await pool.query('SELECT list_id, manga_id, source, title, position FROM list_items WHERE list_id IN (?)', [lists.map(l => l.id)])
        : [[]];
    const [[settingsRow]] = await pool.query('SELECT data FROM user_settings WHERE user_id = ?', [uid]);
    return {
        user: { id: uid, username: u.username, email: u.email },
        favorites, library, progress, readChapters, ratings, lists, listItems,
        settings: settingsRow ? (typeof settingsRow.data === 'string' ? JSON.parse(settingsRow.data) : settingsRow.data) : {},
    };
}

async function runBackup() {
    const [users] = await pool.query('SELECT id, username, email FROM users');
    const accounts = [];
    for (const u of users) {
        try { accounts.push(await buildUserExport(u)); }
        catch (e) { accounts.push({ user: { id: u.id, username: u.username }, error: e.message }); }
    }
    const payload = {
        inkoBackup: 1,
        createdAt: new Date().toISOString(),
        accounts,
    };
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const file = path.join(BACKUP_DIR, `inko-backup-${new Date().toISOString().slice(0, 10)}.json`);
    fs.writeFileSync(file, JSON.stringify(payload));   // écrase le fichier du jour si relancé
    // Rotation : garde les KEEP plus récents
    const all = fs.readdirSync(BACKUP_DIR).filter(f => /^inko-backup-.*\.json$/.test(f)).sort();
    all.slice(0, Math.max(0, all.length - KEEP)).forEach(f => {
        try { fs.unlinkSync(path.join(BACKUP_DIR, f)); } catch (e) {}
    });
    return { file, accounts: accounts.length };
}

// Planification : premier passage 5 min après le démarrage (laisse la DB
// s'initialiser), puis toutes les 24 h. Idempotent sur la journée (même nom
// de fichier) : un serveur redémarré plusieurs fois n'empile pas les dumps.
let scheduled = false;
function scheduleBackups() {
    if (scheduled || process.env.DISABLE_BACKUPS === '1') return;
    scheduled = true;
    const run = () => runBackup()
        .then(r => console.log(`[backup] ${r.accounts} compte(s) → ${r.file}`))
        .catch(e => console.warn('[backup] échec :', e.message));
    setTimeout(run, 5 * 60_000);
    setInterval(run, 24 * 3600_000);
}

module.exports = { runBackup, scheduleBackups };
