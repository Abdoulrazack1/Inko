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
const crypto = require('crypto');
const { pool } = require('../config/db');

const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, '..', 'backups');
const KEEP = Math.max(2, parseInt(process.env.BACKUP_KEEP || '14', 10) || 14);

// ── Audit SEC-15 : chiffrement des sauvegardes ───────────────
// Le dump contient l'email et TOUTE la bibliothèque de chaque compte, en clair
// sur le disque. Correctement exclu de git et bloqué en HTTP, mais lisible par
// n'importe quel autre processus ou compte de la machine, et emporté tel quel
// par une synchro cloud ou une sauvegarde système.
// Chiffrement optionnel, activé en posant BACKUP_PASSPHRASE : AES-256-GCM,
// clé dérivée par scrypt avec un sel aléatoire par fichier. Sans passphrase on
// garde le clair — l'imposer casserait les installations existantes et
// rendrait les dumps irrécupérables si l'utilisateur perd la phrase.
// SEC-04 : en desktop, une passphrase est TIRÉE AU SORT au premier démarrage
// plutôt que de laisser les dumps en clair. Le raisonnement d'origine
// ci-dessus reste valable pour un serveur — imposer une phrase à un
// administrateur casserait ses sauvegardes existantes et les rendrait
// irrécupérables s'il la perd. Mais sur une installation desktop, personne ne
// pose jamais cette variable : le défaut était donc « email et bibliothèque de
// tous les comptes, en clair sur le disque », pour tout le monde.
//
// La passphrase générée vit dans le profil de l'utilisateur, avec les mêmes
// droits que le mot de passe de la base (`lib/secrets-locaux.js`). Elle est
// donc récupérable pour restaurer — c'est la différence avec une phrase perdue.
const IS_DESKTOP = !!process.env.APP_VERSION;
const PASSPHRASE = process.env.BACKUP_PASSPHRASE
    || (IS_DESKTOP ? (require('./secrets-locaux').obtenir('backup-passphrase', 32) || '') : '');
const MAGIC = 'INKOENC1';           // en-tête : permet de reconnaître un dump chiffré

function encrypt(plaintext, passphrase) {
    const salt = crypto.randomBytes(16);
    const iv   = crypto.randomBytes(12);
    const key  = crypto.scryptSync(passphrase, salt, 32);
    const c    = crypto.createCipheriv('aes-256-gcm', key, iv);
    const enc  = Buffer.concat([c.update(plaintext, 'utf8'), c.final()]);
    // MAGIC | salt(16) | iv(12) | tag(16) | données
    return Buffer.concat([Buffer.from(MAGIC, 'ascii'), salt, iv, c.getAuthTag(), enc]);
}

function decrypt(buf, passphrase) {
    if (buf.slice(0, MAGIC.length).toString('ascii') !== MAGIC) {
        throw new Error('ce fichier n\'est pas une sauvegarde chiffrée Inko');
    }
    let o = MAGIC.length;
    const salt = buf.slice(o, o += 16);
    const iv   = buf.slice(o, o += 12);
    const tag  = buf.slice(o, o += 16);
    const key  = crypto.scryptSync(passphrase, salt, 32);
    const d    = crypto.createDecipheriv('aes-256-gcm', key, iv);
    d.setAuthTag(tag);
    // GCM authentifie : une passphrase fausse fait échouer final(), elle ne
    // produit pas de JSON corrompu qu'on croirait valide.
    return Buffer.concat([d.update(buf.slice(o)), d.final()]).toString('utf8');
}

function isEncrypted(buf) {
    return Buffer.isBuffer(buf) && buf.slice(0, MAGIC.length).toString('ascii') === MAGIC;
}

// Mêmes données que l'export manuel (user.controller exportData), par compte
async function buildUserExport(u) {
    const uid = u.id;
    const [favorites]    = await pool.query('SELECT manga_id, source, title, cover, category, last_chapter, added_at FROM favorites WHERE user_id = ?', [uid]);
    // `library.rating` a été supprimée (colonne morte, migration 5) — la
    // sélectionner faisait échouer buildUserExport pour CHAQUE compte, et le
    // dump nocturne tombait de 120 Ko à 2 Ko de messages d'erreur. Les notes
    // vivent dans la table `ratings`, déjà exportée plus bas.
    // La table `library` a fusionné dans `favorites` (migration 7, audit
    // DB-02). La clé `library` du fichier reste : une sauvegarde doit rester
    // relisible, y compris par une version antérieure.
    const [library]      = await pool.query(
        'SELECT manga_id, status FROM favorites WHERE user_id = ? AND status IS NOT NULL', [uid]);
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
    const day = new Date().toISOString().slice(0, 10);
    // Extension distincte : on voit d'un coup d'œil ce qui est chiffré, et le
    // script de restauration sait quoi faire sans deviner (audit SEC-15).
    const ext = PASSPHRASE ? 'json.enc' : 'json';
    const file = path.join(BACKUP_DIR, `inko-backup-${day}.${ext}`);
    const json = JSON.stringify(payload);
    fs.writeFileSync(file, PASSPHRASE ? encrypt(json, PASSPHRASE) : json);   // écrase le dump du jour si relancé
    // Le dump reste lisible par le seul propriétaire (POSIX ; sans effet sur
    // Windows, où le dossier de l'app fait déjà la séparation).
    try { fs.chmodSync(file, 0o600); } catch (e) { /* système de fichiers sans permissions */ }
    // Rotation : garde les KEEP plus récents (les deux formats confondus)
    const all = fs.readdirSync(BACKUP_DIR).filter(f => /^inko-backup-.*\.json(\.enc)?$/.test(f)).sort();
    all.slice(0, Math.max(0, all.length - KEEP)).forEach(f => {
        try { fs.unlinkSync(path.join(BACKUP_DIR, f)); } catch (e) { /* déjà supprimé */ }
    });
    return { file, accounts: accounts.length, encrypted: !!PASSPHRASE };
}

// Planification : premier passage 5 min après le démarrage (laisse la DB
// s'initialiser), puis toutes les 24 h. Idempotent sur la journée (même nom
// de fichier) : un serveur redémarré plusieurs fois n'empile pas les dumps.
let scheduled = false;
function scheduleBackups() {
    if (scheduled || process.env.DISABLE_BACKUPS === '1') return;
    scheduled = true;
    if (!PASSPHRASE) {
        console.warn('[backup] ⚠ sauvegardes EN CLAIR (email + bibliothèque de tous les comptes).');
        console.warn('         Définis BACKUP_PASSPHRASE pour les chiffrer (AES-256-GCM).');
    } else if (!process.env.BACKUP_PASSPHRASE) {
        // Le chiffrement est actif sans que l'utilisateur ait rien fait : il
        // doit savoir OÙ est la clé, sinon une restauration depuis une autre
        // machine est impossible et le dump devient un fichier inerte.
        console.log(`[backup] sauvegardes chiffrées — clé dans ${path.join(require('./secrets-locaux').dossier(), 'backup-passphrase.json')}`);
    }
    const run = () => runBackup()
        .then(r => console.log(`[backup] ${r.accounts} compte(s) → ${r.file}${r.encrypted ? ' (chiffré)' : ''}`))
        .catch(e => console.warn('[backup] échec :', e.message));
    // Audit : `.unref()` comme les autres minuteries du projet (app.js) —
    // sans lui, le process Node ne peut plus se terminer naturellement.
    setTimeout(run, 5 * 60_000).unref();
    setInterval(run, 24 * 3600_000).unref();
}

// ── Acces depuis l'interface (audit AMEL-73/75) ──────────────
// Le script CLI de restauration existe (BUG-12), mais il faut un acces shell
// au serveur. Une sauvegarde qu'on ne sait restaurer qu'en SSH n'existe pas
// pour la personne qui utilise l'app.
//
// Le dossier reste hors de l'arborescence statique : rien n'est SERVI, on
// expose seulement la liste et une lecture ciblee, cote serveur.
function listerSauvegardes() {
    try {
        return fs.readdirSync(BACKUP_DIR)
            .filter(f => /^inko-backup-.*\.json(\.enc)?$/.test(f))
            .sort().reverse()
            .map(f => {
                const st = fs.statSync(path.join(BACKUP_DIR, f));
                return { file: f, size: st.size, at: st.mtime, encrypted: f.endsWith('.enc') };
            });
    } catch (e) { return []; }
}

// Le nom vient du client : on ne le concatene JAMAIS au chemin sans l'avoir
// retrouve dans la liste reelle. Un `../../etc/passwd` ne correspond a aucune
// entree, donc ne mene nulle part.
function cheminSur(nom) {
    const connu = listerSauvegardes().find(b => b.file === nom);
    return connu ? path.join(BACKUP_DIR, connu.file) : null;
}

function lireSauvegarde(nom, passphrase) {
    const chemin = cheminSur(nom);
    if (!chemin) { const e = new Error('Sauvegarde introuvable'); e.status = 404; throw e; }
    const brut = fs.readFileSync(chemin);
    let json;
    if (isEncrypted(brut)) {
        const pass = passphrase || PASSPHRASE;
        if (!pass) { const e = new Error('Cette sauvegarde est chiffree : phrase secrete requise'); e.status = 400; throw e; }
        try { json = decrypt(brut, pass); }
        catch (err) { const e = new Error('Phrase secrete incorrecte'); e.status = 400; throw e; }
    } else {
        json = brut.toString('utf8');
    }
    const data = JSON.parse(json);
    if (!data || !Array.isArray(data.accounts)) {
        const e = new Error('Fichier de sauvegarde illisible'); e.status = 400; throw e;
    }
    return data;
}

module.exports = {
    runBackup, scheduleBackups, encrypt, decrypt, isEncrypted,
    listerSauvegardes, lireSauvegarde, BACKUP_DIR,
    chiffrementActif: () => !!PASSPHRASE,
};
