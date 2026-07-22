// ============================================================
// loader.js — Charge dynamiquement les extensions
// ============================================================
// Au boot, scanne `server/extensions/` et charge tous les sous-dossiers
// qui exportent une source valide. Expose un registre interrogeable.
// ============================================================
const fs   = require('fs');
const os   = require('os');
const path = require('path');
const { validateSource } = require('../lib/source-interface');

const EXT_DIR = __dirname;
const registry = new Map(); // id → source

// Liste des extensions DÉSINSTALLÉES par l'utilisateur (issue #2). Stockée dans
// un dossier inscriptible qui SURVIT aux mises à jour de l'app (les extensions
// sont bundlées : les supprimer physiquement ne tiendrait pas). Le loader
// ignore simplement ces ids au chargement.
function uninstalledPath() {
    const base = process.env.APPDATA || path.join(os.homedir(), '.config');
    return path.join(base, 'Inko', 'uninstalled-extensions.json');
}
function readUninstalled() {
    try { return new Set(JSON.parse(fs.readFileSync(uninstalledPath(), 'utf8'))); }
    catch (e) { return new Set(); }
}
function writeUninstalled(set) {
    try {
        fs.mkdirSync(path.dirname(uninstalledPath()), { recursive: true });
        fs.writeFileSync(uninstalledPath(), JSON.stringify([...set]));
    } catch (e) {}
}

// Canal officiel (vérifié par SHA-256 à l'installation/MAJ) — audit S13
const OFFICIAL_IDS = new Set([
    'mangadex', 'weebcentral', 'sushiscan', 'novelfull', 'novelbin',
    'royalroad', 'chireads', 'gutenberg', 'gutenberg-fr',
]);

function loadAll() {
    if (registry.size) return registry; // déjà chargé

    const uninstalled = readUninstalled();
    let entries;
    try { entries = fs.readdirSync(EXT_DIR, { withFileTypes: true }); }
    catch (e) { console.warn('[ext] impossible de lire le dossier extensions:', e.message); return registry; }

    entries
        .filter(d => d.isDirectory())
        .forEach(d => {
            const indexPath = path.join(EXT_DIR, d.name, 'index.js');
            if (!fs.existsSync(indexPath)) return;
            if (uninstalled.has(d.name)) return;   // désinstallée par l'utilisateur
            try {
                // Force le re-require (utile en dev)
                delete require.cache[require.resolve(indexPath)];
                const src = require(indexPath);
                const v = validateSource(src);
                if (!v.ok) {
                    console.warn(`[ext] "${d.name}" rejeté: ${v.errors.join(', ')}`);
                    return;
                }
                if (uninstalled.has(src.id)) return;   // désinstallée (par id)
                registry.set(src.id, src);
                console.log(`[ext] ✓ ${src.id} v${src.version} (${src.name})`);
                // Audit S13 : une extension = du JS exécuté avec les pleins
                // pouvoirs Node dans ce process. Le canal officiel est vérifié
                // par SHA-256 ; tout id hors canal est signalé clairement pour
                // que l'admin sache qu'il fait confiance à du code tiers.
                if (!OFFICIAL_IDS.has(src.id)) {
                    console.warn(`[ext] ⚠ "${src.id}" n'est pas une extension officielle : code tiers non vérifié, exécuté avec les droits du serveur (audit S13)`);
                }
            } catch (e) {
                console.warn(`[ext] "${d.name}" échec de chargement:`, e.message);
            }
        });

    return registry;
}

function getAll() {
    return [...loadAll().values()];
}

function get(id) {
    return loadAll().get(id) || null;
}

/**
 * Manifest publique (sans les fonctions, juste les métadonnées).
 */
function manifest() {
    return getAll().map(s => ({
        id:           s.id,
        name:         s.name,
        lang:         s.lang,
        baseUrl:      s.baseUrl,
        nsfw:         !!s.nsfw,
        version:      s.version,
        type:         s.type || 'manga',   // 'manga' (images) | 'novel' (texte)
        // unit : découpe l'affichage « Chapitre » vs « Tome » (audit §6). L'axe
        // correct n'est PAS manga/roman mais sérialisé-par-épisodes vs publié-par-
        // volumes : une source ne bascule en 'volume' que si elle le déclare.
        unit:         s.unit === 'volume' ? 'volume' : 'chapter',
        description:  s.description || '',
        capabilities: s.capabilities || [],
    }));
}

/**
 * Renvoie la source par défaut (la première chargée). En modèle Mihon strict,
 * il n'y a pas de "défaut" et le client doit toujours préciser ?source=...
 * On garde une fallback pour ne pas casser les routes existantes.
 */
function defaultSource() {
    const all = getAll();
    // WeebCentral héberge les pages des titres populaires (MangaDex en licencie
    // beaucoup en "externalUrl" → illisibles). On le privilégie par défaut.
    const preferred = ['weebcentral', 'sushiscan'];
    for (const id of preferred) {
        const s = all.find(x => x.id === id);
        if (s) return s;
    }
    return all[0] || null;
}

// Recharge le registre (après installation/MAJ d'une extension)
function reload() {
    registry.clear();
    return loadAll();
}

// Désinstalle / réinstalle une extension (issue #2) — persistant, puis reload.
function uninstall(id) {
    const set = readUninstalled(); set.add(id); writeUninstalled(set); reload();
    return [...set];
}
function reinstall(id) {
    const set = readUninstalled(); set.delete(id); writeUninstalled(set); reload();
    return [...set];
}
function isUninstalled(id) { return readUninstalled().has(id); }
function uninstalledList() { return [...readUninstalled()]; }

module.exports = { loadAll, getAll, get, manifest, defaultSource, reload, uninstall, reinstall, isUninstalled, uninstalledList };
