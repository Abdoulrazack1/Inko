#!/usr/bin/env node
// ============================================================
// restore-backup.js — Restauration d'une sauvegarde (audit BUG-12)
// ------------------------------------------------------------
// lib/backup.js écrit chaque nuit un dump JSON de TOUS les comptes, avec
// rotation sur 14 fichiers. Sauf qu'AUCUN code ne savait le relire :
//   · le dump a la forme  { inkoBackup: 1, accounts: [ { user, favorites… } ] }
//   · user.controller importData() attend  { favorites, library, progress… }
//     — c'est-à-dire la forme de l'export PAR COMPTE, pas celle du dump.
// Donner un dump nocturne à /api/me/import n'importait donc rien du tout, et
// server/scripts/ ne contenait que reset-password.js. Six dumps dormaient sur
// le disque sans aucun moyen de s'en servir : une sauvegarde qu'on ne peut pas
// restaurer n'en est pas une.
//
// Usage :
//   node scripts/restore-backup.js --list
//   node scripts/restore-backup.js <fichier.json> --dry-run
//   node scripts/restore-backup.js <fichier.json> --user 26
//   node scripts/restore-backup.js <fichier.json> --all
//
// Par défaut : FUSION (rien n'est supprimé). --replace vide d'abord les
// données du compte visé.
// ============================================================
'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');

const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, '..', 'backups');
const args = process.argv.slice(2);
const has = f => args.includes(f);
const val = f => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };

const DRY = has('--dry-run');
const ALL = has('--all');
const REPLACE = has('--replace');
const ONLY_USER = val('--user');
const file = args.find(a => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--user');

function listBackups() {
    if (!fs.existsSync(BACKUP_DIR)) {
        console.log(`Aucun dossier de sauvegarde (${BACKUP_DIR}).`);
        return;
    }
    const files = fs.readdirSync(BACKUP_DIR)
        .filter(f => /^inko-backup-.*\.json$/.test(f))
        .sort().reverse();
    if (!files.length) { console.log('Aucune sauvegarde trouvée.'); return; }
    console.log(`Sauvegardes dans ${BACKUP_DIR} :\n`);
    for (const f of files) {
        const p = path.join(BACKUP_DIR, f);
        const size = Math.round(fs.statSync(p).size / 1024);
        let n = '?';
        try { n = (JSON.parse(fs.readFileSync(p, 'utf8')).accounts || []).length; } catch (e) { n = 'illisible'; }
        console.log(`  ${f}   ${String(size).padStart(5)} Ko   ${n} compte(s)`);
    }
    console.log('\nRestaurer :  node scripts/restore-backup.js <fichier> --user <id>');
}

// Insertion par paquets — même approche que importData (audit B3) : une requête
// par entrée était intenable sur une bibliothèque de plusieurs centaines de titres.
async function bulkInsert(sql, rows, chunk = 500) {
    let n = 0;
    for (let i = 0; i < rows.length; i += chunk) {
        const slice = rows.slice(i, i + chunk);
        if (!slice.length) continue;
        const [r] = await pool.query(sql, [slice]);
        n += r.affectedRows || slice.length;
    }
    return n;
}

async function restoreAccount(acc, targetUserId) {
    const uid = targetUserId;
    const counts = {};

    if (REPLACE) {
        for (const t of ['favorites', 'library', 'progress', 'read_chapters', 'ratings']) {
            await pool.query(`DELETE FROM ${t} WHERE user_id = ?`, [uid]);
        }
        await pool.query('DELETE FROM list_items WHERE list_id IN (SELECT id FROM lists WHERE user_id = ?)', [uid]);
        await pool.query('DELETE FROM lists WHERE user_id = ?', [uid]);
    }

    const f = acc.favorites || [];
    if (f.length) counts.favoris = await bulkInsert(
        `INSERT INTO favorites (user_id, manga_id, source, title, cover, category, last_chapter) VALUES ?
         ON DUPLICATE KEY UPDATE source=VALUES(source),
           title=COALESCE(VALUES(title),title), cover=COALESCE(VALUES(cover),cover),
           category=COALESCE(VALUES(category),category), last_chapter=COALESCE(VALUES(last_chapter),last_chapter)`,
        f.map(x => [uid, x.manga_id ?? x.mangaId, x.source || 'mangadex', x.title || null,
                    x.cover || null, x.category || null, x.last_chapter ?? x.lastChapter ?? null]));

    const lib = acc.library || [];
    if (lib.length) counts.bibliotheque = await bulkInsert(
        `INSERT INTO library (user_id, manga_id, status, rating) VALUES ?
         ON DUPLICATE KEY UPDATE status=VALUES(status)`,
        lib.map(x => [uid, x.manga_id ?? x.mangaId, x.status || 'reading', x.rating ?? null]));

    const pr = acc.progress || [];
    if (pr.length) counts.progression = await bulkInsert(
        `INSERT INTO progress (user_id, manga_id, chapter_id, chapter_number, page, source) VALUES ?
         ON DUPLICATE KEY UPDATE chapter_id=VALUES(chapter_id), chapter_number=VALUES(chapter_number),
           page=VALUES(page), source=VALUES(source)`,
        pr.map(x => [uid, x.manga_id ?? x.mangaId, x.chapter_id ?? x.chapterId ?? null,
                     x.chapter_number ?? x.chapterNumber ?? null, x.page ?? 1, x.source || null]));

    const rc = acc.readChapters || acc.read_chapters || [];
    if (rc.length) counts.chapitresLus = await bulkInsert(
        `INSERT IGNORE INTO read_chapters (user_id, manga_id, chapter_id, chapter_number) VALUES ?`,
        rc.map(x => [uid, x.manga_id ?? x.mangaId, x.chapter_id ?? x.chapterId,
                     x.chapter_number ?? x.chapterNumber ?? null]));

    const ra = acc.ratings || [];
    if (ra.length) counts.notes = await bulkInsert(
        `INSERT INTO ratings (user_id, manga_id, rating, review) VALUES ?
         ON DUPLICATE KEY UPDATE rating=VALUES(rating), review=VALUES(review)`,
        ra.map(x => [uid, x.manga_id ?? x.mangaId, x.rating, x.review || null]));

    // Listes : l'id d'origine ne peut pas être réutilisé (auto-increment),
    // on recrée et on remappe les items.
    const lists = acc.lists || [];
    const items = acc.listItems || acc.list_items || [];
    if (lists.length) {
        let created = 0, itemsAdded = 0;
        for (const l of lists) {
            const [r] = await pool.query(
                'INSERT INTO lists (user_id, name, description, is_public) VALUES (?, ?, ?, ?)',
                [uid, l.name || 'Liste restaurée', l.description || null, l.is_public ?? l.isPublic ? 1 : 0]);
            created++;
            const own = items.filter(it => (it.list_id ?? it.listId) === l.id);
            if (own.length) {
                itemsAdded += await bulkInsert(
                    `INSERT IGNORE INTO list_items (list_id, manga_id, source, title, position) VALUES ?`,
                    own.map(it => [r.insertId, it.manga_id ?? it.mangaId, it.source || null,
                                   it.title || null, it.position ?? 0]));
            }
        }
        counts.listes = created;
        counts.elementsDeListes = itemsAdded;
    }

    if (acc.settings && Object.keys(acc.settings).length) {
        await pool.query(
            `INSERT INTO user_settings (user_id, data) VALUES (?, ?)
             ON DUPLICATE KEY UPDATE data = VALUES(data)`,
            [uid, JSON.stringify(acc.settings)]);
        counts.reglages = 1;
    }
    return counts;
}

(async () => {
    if (has('--list') || !file) { listBackups(); process.exit(0); }

    const p = path.isAbsolute(file) ? file : path.join(BACKUP_DIR, file);
    if (!fs.existsSync(p)) { console.error(`Fichier introuvable : ${p}`); process.exit(1); }

    let dump;
    try { dump = JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch (e) { console.error('JSON illisible :', e.message); process.exit(1); }

    if (!dump.inkoBackup || !Array.isArray(dump.accounts)) {
        console.error('Ce fichier n\'est pas une sauvegarde Inko (clé inkoBackup/accounts absente).');
        process.exit(1);
    }

    console.log(`Sauvegarde du ${dump.createdAt || '?'} — ${dump.accounts.length} compte(s)\n`);

    const targets = ONLY_USER
        ? dump.accounts.filter(a => String(a.user?.id) === String(ONLY_USER))
        : (ALL ? dump.accounts : []);

    if (!targets.length) {
        console.log('Comptes présents dans la sauvegarde :\n');
        for (const a of dump.accounts) {
            const u = a.user || {};
            console.log(`  id=${String(u.id).padEnd(4)} ${String(u.username || '?').padEnd(24)} ${u.email || ''}` +
                        `   ${(a.favorites || []).length} favoris, ${(a.readChapters || []).length} chapitres lus`);
        }
        console.log('\nPrécise --user <id> pour restaurer un compte, ou --all pour tous.');
        console.log('Ajoute --dry-run pour simuler, --replace pour écraser au lieu de fusionner.');
        process.exit(0);
    }

    for (const acc of targets) {
        const u = acc.user || {};
        // Le compte doit exister : on ne recrée pas d'utilisateur (mot de passe
        // absent du dump), on restaure DANS un compte existant.
        const [[exists]] = await pool.query('SELECT id, username FROM users WHERE id = ?', [u.id]);
        if (!exists) {
            console.warn(`  ⚠ compte id=${u.id} (${u.username}) absent de la base — ignoré.`);
            console.warn('    Recrée-le d\'abord, puis relance avec --user <nouvel-id>.');
            continue;
        }
        console.log(`→ ${exists.username} (id=${exists.id})${REPLACE ? ' [REMPLACEMENT]' : ' [fusion]'}`);
        if (DRY) {
            console.log(`    simulation : ${(acc.favorites || []).length} favoris, ` +
                        `${(acc.readChapters || []).length} chapitres lus, ` +
                        `${(acc.lists || []).length} liste(s)`);
            continue;
        }
        const counts = await restoreAccount(acc, exists.id);
        for (const [k, v] of Object.entries(counts)) console.log(`    ${k} : ${v}`);
    }

    console.log(DRY ? '\nSimulation terminée — rien n\'a été écrit.' : '\nRestauration terminée.');
    process.exit(0);
})().catch(e => { console.error('Échec :', e.message); process.exit(1); });
