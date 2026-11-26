// ============================================================
// lib/fichiers-publics.js — ce que le serveur a le droit de servir (SEC-02)
// ------------------------------------------------------------
// FRONTEND_DIR retombe sur la racine du dépôt en développement. La garde était
// une liste NOIRE de dossiers : tout ce qui n'y figurait pas sortait — le
// code des tests, les scripts, `Dockerfile`, `package.json`, les documents
// d'audit de sécurité, et tout dossier ajouté demain.
//
// On inverse : seuls sortent les pages de la racine, `assets/`, le manifeste,
// le service worker et l'icône. Le reste n'est pas un fichier « interdit », il
// n'est tout simplement pas servi.
// ============================================================
'use strict';

const fs = require('fs');
const path = require('path');

const FIXES = new Set(['/', '/manifest.webmanifest', '/service-worker.js', '/favicon.ico']);

/** Les noms de pages présents à la racine (`bibliotheque` pour `bibliotheque.html`). */
function pagesDe(dossier) {
    try { return new Set(fs.readdirSync(dossier).filter(f => f.toLowerCase().endsWith('.html')).map(f => f.slice(0, -5))); }
    catch (e) { return new Set(); }
}

/**
 * @param {string} chemin  `req.path` (encodé)
 * @param {Set<string>} pages  résultat de `pagesDe`
 */
function estPublic(chemin, pages) {
    let p;
    try { p = decodeURIComponent(String(chemin || '')); } catch (e) { return false; }
    // un antislash est un séparateur sous Windows : on juge ce que le disque lira
    p = p.replace(/\\/g, '/');
    if (p.includes('\0') || p.split('/').includes('..')) return false;
    if (path.posix.normalize(p) !== p) return false;       // `//`, `/./` : rien d'ambigu
    if (FIXES.has(p)) return true;
    if (p.startsWith('/assets/')) return true;
    const m = /^\/([A-Za-z0-9_-]+)(\.html)?$/.exec(p);
    return !!m && pages.has(m[1]);
}

module.exports = { estPublic, pagesDe };
