// ============================================================
// local.controller.js — Import de fichiers locaux (EPUB / CBZ / CBR)
// ------------------------------------------------------------
// Téléversement via multipart (multer), stockage sur disque dans
// server/uploads/<userId>/, métadonnées en base (local_imports).
// Les fichiers ne sont PAS servis statiquement : accès via endpoint
// authentifié + vérification de propriété.
// ============================================================
const path   = require('path');
const fs     = require('fs');
const multer = require('multer');
const { pool } = require('../config/db');

const UPLOAD_ROOT = path.join(__dirname, '..', 'uploads');
// .cbr retiré (audit N9) : le lecteur intégré ne lit pas le RAR — refuser à
// l'upload avec un message clair plutôt que de laisser découvrir à la lecture.
const ALLOWED = { '.cbz': 'cbz', '.epub': 'epub', '.zip': 'cbz', '.pdf': 'pdf' };

const storage = multer.diskStorage({
    destination(req, _file, cb) {
        const dir = path.join(UPLOAD_ROOT, String(req.user.id));
        fs.mkdir(dir, { recursive: true }, (err) => cb(err, dir));
    },
    filename(_req, file, cb) {
        const ext = (path.extname(file.originalname) || '').toLowerCase();
        cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 300 * 1024 * 1024 },     // 300 Mo max
    fileFilter(_req, file, cb) {
        const ext = (path.extname(file.originalname) || '').toLowerCase();
        if (ALLOWED[ext]) return cb(null, true);
        if (ext === '.cbr') return cb(new Error('CBR (archive RAR) non supporté : convertis-le en CBZ (ZIP)'));
        cb(new Error('Format non supporté (EPUB, PDF, CBZ uniquement)'));
    },
}).single('file');

// POST /api/library/import/local — téléverse un fichier
function importLocal(req, res, next) {
    upload(req, res, async (err) => {
        if (err) return res.status(400).json({ error: err.message });
        if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu' });
        try {
            const ext  = (path.extname(req.file.originalname) || '').toLowerCase();
            const type = ALLOWED[ext] || 'cbz';
            const title = (req.body.title || path.basename(req.file.originalname, ext) || 'Sans titre')
                .replace(/[._]+/g, ' ').trim().slice(0, 512);
            const [r] = await pool.query(
                'INSERT INTO local_imports (user_id, title, type, filename, size) VALUES (?, ?, ?, ?, ?)',
                [req.user.id, title, type, req.file.filename, req.file.size]
            );
            res.json({ id: r.insertId, title, type, size: req.file.size });
        } catch (e) {
            fs.unlink(req.file.path, () => {});   // rollback du fichier si l'insert échoue
            next(e);
        }
    });
}

// GET /api/library/local — liste les imports de l'utilisateur
async function listLocal(req, res, next) {
    try {
        const [rows] = await pool.query(
            'SELECT id, title, type, size, created_at FROM local_imports WHERE user_id = ? ORDER BY created_at DESC',
            [req.user.id]
        );
        res.json(rows.map(r => ({ id: r.id, title: r.title, type: r.type, size: r.size, createdAt: r.created_at })));
    } catch (e) { next(e); }
}

// GET /api/library/local/:id/file — sert le fichier (propriétaire uniquement)
async function getLocalFile(req, res, next) {
    try {
        const [[row]] = await pool.query(
            'SELECT filename, type FROM local_imports WHERE id = ? AND user_id = ?',
            [parseInt(req.params.id, 10), req.user.id]
        );
        if (!row) return res.status(404).json({ error: 'Fichier introuvable' });
        const fp = path.join(UPLOAD_ROOT, String(req.user.id), row.filename);
        if (!fs.existsSync(fp)) return res.status(404).json({ error: 'Fichier manquant sur le disque' });
        res.set('Content-Type', 'application/octet-stream');
        res.set('Cache-Control', 'private, max-age=86400');
        fs.createReadStream(fp).pipe(res);
    } catch (e) { next(e); }
}

// DELETE /api/library/local/:id — supprime l'import (DB + disque)
async function deleteLocal(req, res, next) {
    try {
        const [[row]] = await pool.query(
            'SELECT filename FROM local_imports WHERE id = ? AND user_id = ?',
            [parseInt(req.params.id, 10), req.user.id]
        );
        if (!row) return res.status(404).json({ error: 'Introuvable' });
        await pool.query('DELETE FROM local_imports WHERE id = ? AND user_id = ?',
            [parseInt(req.params.id, 10), req.user.id]);
        fs.unlink(path.join(UPLOAD_ROOT, String(req.user.id), row.filename), () => {});
        res.json({ ok: true });
    } catch (e) { next(e); }
}

module.exports = { importLocal, listLocal, getLocalFile, deleteLocal };
