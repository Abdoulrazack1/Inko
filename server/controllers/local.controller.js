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

// Audit §5 : plafond CUMULÉ par utilisateur (300 Mo max par fichier ne
// bornait pas le volume total — un compte pouvait remplir le disque du hub).
const QUOTA_MB = parseInt(process.env.LOCAL_IMPORT_QUOTA_MB || '2048', 10);   // 2 Go par défaut

// Audit SEC-14 : le type était décidé sur la SEULE extension du nom de fichier.
// Un fichier renommé en .cbz passait quel que soit son contenu. On lit les
// octets d'en-tête, qui ne mentent pas :
//   ZIP (CBZ et EPUB sont des ZIP) : 50 4B 03 04 / 05 06 / 07 08
//   PDF                            : 25 50 44 46  ("%PDF")
// Le contrôle reste tolérant sur les variantes de ZIP (vide, segmenté).
function sniffType(filePath) {
    let fd;
    try {
        fd = fs.openSync(filePath, 'r');
        const buf = Buffer.alloc(4);
        fs.readSync(fd, buf, 0, 4, 0);
        if (buf[0] === 0x50 && buf[1] === 0x4B &&
            ((buf[2] === 0x03 && buf[3] === 0x04) ||
             (buf[2] === 0x05 && buf[3] === 0x06) ||
             (buf[2] === 0x07 && buf[3] === 0x08))) return 'zip';
        if (buf.toString('ascii') === '%PDF') return 'pdf';
        if (buf[0] === 0x52 && buf[1] === 0x61 && buf[2] === 0x72 && buf[3] === 0x21) return 'rar';
        return 'inconnu';
    } catch (e) { return 'illisible'; }
    finally { if (fd !== undefined) { try { fs.closeSync(fd); } catch (e) { /* déjà fermé */ } } }
}

// POST /api/library/import/local — téléverse un fichier
function importLocal(req, res, next) {
    upload(req, res, async (err) => {
        if (err) return res.status(400).json({ error: err.message });
        if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu' });

        // Vérification du contenu réel avant tout enregistrement (audit SEC-14)
        const extRaw = (path.extname(req.file.originalname) || '').toLowerCase();
        const declared = ALLOWED[extRaw] || 'cbz';
        const actual = sniffType(req.file.path);
        const expected = declared === 'pdf' ? 'pdf' : 'zip';   // cbz et epub sont des ZIP
        if (actual !== expected) {
            fs.unlink(req.file.path, () => {});
            const detail = actual === 'rar'
                ? 'ce fichier est une archive RAR (CBR), pas un ZIP — convertis-le en CBZ'
                : `contenu détecté : ${actual}`;
            return res.status(400).json({
                error: `Le contenu du fichier ne correspond pas à son extension (${extRaw}) — ${detail}.`,
            });
        }

        try {
            const [[used]] = await pool.query(
                'SELECT COALESCE(SUM(size), 0) AS total FROM local_imports WHERE user_id = ?',
                [req.user.id]
            );
            if (Number(used.total) + req.file.size > QUOTA_MB * 1024 * 1024) {
                fs.unlink(req.file.path, () => {});
                const usedMb = Math.round(Number(used.total) / 1048576);
                return res.status(413).json({
                    error: `Quota de stockage atteint (${usedMb} Mo utilisés sur ${QUOTA_MB} Mo). Supprime d'anciens imports pour libérer de la place.`,
                });
            }
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
        const items = rows.map(r => ({ id: r.id, title: r.title, type: r.type, size: r.size, createdAt: r.created_at }));
        // Audit AMEL-105 : le quota n'existait que dans le message de REFUS.
        // L'utilisateur téléversait donc un fichier de 300 Mo pour apprendre à
        // la fin qu'il n'y avait plus de place. L'état est renvoyé avec la
        // liste — aucun appel supplémentaire, la page l'affiche avant l'import.
        const utilise = items.reduce((n, it) => n + (+it.size || 0), 0);
        res.json({
            items,
            quota: {
                utilise,
                total: QUOTA_MB * 1024 * 1024,
                maxFichier: 300 * 1024 * 1024,
            },
        });
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
