// ============================================================
// loader.js — Charge dynamiquement les extensions
// ============================================================
// Au boot, scanne `server/extensions/` et charge tous les sous-dossiers
// qui exportent une source valide. Expose un registre interrogeable.
// ============================================================
const fs   = require('fs');
const path = require('path');
const { validateSource } = require('../lib/source-interface');

const EXT_DIR = __dirname;
const registry = new Map(); // id → source

function loadAll() {
    if (registry.size) return registry; // déjà chargé

    let entries;
    try { entries = fs.readdirSync(EXT_DIR, { withFileTypes: true }); }
    catch (e) { console.warn('[ext] impossible de lire le dossier extensions:', e.message); return registry; }

    entries
        .filter(d => d.isDirectory())
        .forEach(d => {
            const indexPath = path.join(EXT_DIR, d.name, 'index.js');
            if (!fs.existsSync(indexPath)) return;
            try {
                // Force le re-require (utile en dev)
                delete require.cache[require.resolve(indexPath)];
                const src = require(indexPath);
                const v = validateSource(src);
                if (!v.ok) {
                    console.warn(`[ext] "${d.name}" rejeté: ${v.errors.join(', ')}`);
                    return;
                }
                registry.set(src.id, src);
                console.log(`[ext] ✓ ${src.id} v${src.version} (${src.name})`);
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

module.exports = { loadAll, getAll, get, manifest, defaultSource };
