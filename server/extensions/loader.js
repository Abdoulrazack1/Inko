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

// ── Audit SEC-08 : vérification d'empreinte AU CHARGEMENT ────
// Le commentaire ci-dessus affirmait que le canal officiel était vérifié par
// SHA-256. C'était vrai à l'INSTALLATION, pas au chargement : un index.js
// modifié après coup — autre processus, sauvegarde restaurée, édition
// manuelle, malware — était exécuté sans broncher à chaque démarrage, avec
// les pleins droits Node.
// On compare donc chaque extension officielle à hashes.json au boot.
// Politique : on REFUSE de charger une extension officielle altérée. Une
// extension non officielle reste chargée (elle n'a pas d'empreinte de
// référence) mais l'avertissement existant s'applique déjà.
// EXT_ALLOW_MODIFIED=1 permet de développer sur une extension officielle
// sans se faire refuser à chaque sauvegarde.
const crypto = require('crypto');
const ALLOW_MODIFIED = process.env.EXT_ALLOW_MODIFIED === '1';

let _expectedHashes = null;
function expectedHashes() {
    if (_expectedHashes) return _expectedHashes;
    // hashes.json vit avec les sources de référence, pas avec la copie runtime.
    const candidates = [
        path.join(__dirname, '..', '..', 'extensions-community', 'hashes.json'),
        path.join(__dirname, 'hashes.json'),
    ];
    for (const p of candidates) {
        try {
            _expectedHashes = JSON.parse(fs.readFileSync(p, 'utf8'));
            return _expectedHashes;
        } catch (e) { /* fichier absent : on essaie le suivant */ }
    }
    _expectedHashes = {};
    return _expectedHashes;
}

// Renvoie null si l'extension est intègre (ou non vérifiable), sinon la raison.
function integrityProblem(id, file) {
    if (!OFFICIAL_IDS.has(id)) return null;          // hors canal officiel : pas de référence
    const want = expectedHashes()[id];
    if (!want) return null;                          // empreinte inconnue : rien à comparer
    let got;
    try { got = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
    catch (e) { return `illisible (${e.code || e.message})`; }
    if (got === want) return null;
    return `empreinte SHA-256 différente de la référence (attendu ${want.slice(0, 12)}…, obtenu ${got.slice(0, 12)}…)`;
}

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

            // Audit SEC-08 : contrôle d'intégrité AVANT le require — une fois
            // le module chargé, son code s'est déjà exécuté.
            const problem = integrityProblem(d.name, indexPath);
            if (problem) {
                if (ALLOW_MODIFIED) {
                    console.warn(`[ext] ⚠ "${d.name}" modifiée (${problem}) — chargée quand même (EXT_ALLOW_MODIFIED=1)`);
                } else {
                    console.error(`[ext] ✖ "${d.name}" REFUSÉE : ${problem}`);
                    console.error('       Cette extension officielle a été modifiée depuis sa publication.');
                    console.error('       Réinstalle-la depuis Sources, ou EXT_ALLOW_MODIFIED=1 si c\'est voulu (développement).');
                    return;
                }
            }

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
        // Audit BUG-06 : tris réellement honorés. Absent = la source ne se
        // prononce pas, l'UI garde tous ses tris (rétro-compatible).
        sorts:        Array.isArray(s.sorts) ? s.sorts : null,
        // Audit PERF-08 : hôtes servant les IMAGES de cette source, quand ils
        // diffèrent du site lui-même (CDN de scans). Ils élargissent la liste
        // blanche du proxy d'images — et rien d'autre.
        imageHosts:   Array.isArray(s.imageHosts) ? s.imageHosts : [],
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
