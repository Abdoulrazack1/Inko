#!/usr/bin/env node
// ============================================================
// check-sources.js — Santé des sources (audit F.13)
// ------------------------------------------------------------
// Les sites de scraping cassent silencieusement (changement de balisage,
// de domaine, Cloudflare…) : ce script appelle popular() sur chaque
// extension installée et signale toute source qui renvoie 0 résultat ou
// une erreur — à lancer à la main, en cron ou en CI, HORS du serveur de
// production (il fait de vraies requêtes vers les sites).
//
// Usage :  node tools/check-sources.js [--only <id>]
// Sortie : code 0 si tout va bien, 1 si au moins une source est en panne.
// ============================================================
const fs = require('fs');
const path = require('path');

const EXT_DIR = path.join(__dirname, '..', 'server', 'extensions');
const TIMEOUT = 45_000;

const onlyIdx = process.argv.indexOf('--only');
const only = onlyIdx !== -1 ? process.argv[onlyIdx + 1] : null;

function withTimeout(p, ms, label) {
    return Promise.race([
        p,
        new Promise((_, rej) => setTimeout(() => rej(new Error(`délai dépassé (${ms / 1000}s)`)), ms)),
    ]);
}

(async () => {
    const dirs = fs.readdirSync(EXT_DIR, { withFileTypes: true })
        .filter(d => d.isDirectory() && fs.existsSync(path.join(EXT_DIR, d.name, 'index.js')))
        .map(d => d.name)
        .filter(d => !only || d === only);
    if (!dirs.length) { console.error('Aucune extension trouvée dans', EXT_DIR); process.exit(1); }

    let failures = 0;
    for (const dir of dirs) {
        const label = dir.padEnd(14);
        let src;
        try { src = require(path.join(EXT_DIR, dir, 'index.js')); }
        catch (e) { console.log(`✖ ${label} chargement impossible : ${e.message}`); failures++; continue; }
        if (typeof src.warmup === 'function') { try { await withTimeout(src.warmup(), TIMEOUT, dir); } catch (e) {} }
        const t0 = Date.now();
        try {
            const r = await withTimeout(src.popular({ limit: 5 }), TIMEOUT, dir);
            const n = (r && r.results || []).length;
            const secs = ((Date.now() - t0) / 1000).toFixed(1);
            if (n > 0) console.log(`✔ ${label} ${n} résultat(s) en ${secs}s`);
            else { console.log(`✖ ${label} 0 résultat (${secs}s) — balisage ou URL du site probablement changés`); failures++; }
        } catch (e) {
            console.log(`✖ ${label} ${e.message}`);
            failures++;
        }
    }
    console.log(failures ? `\n${failures} source(s) en panne.` : '\nToutes les sources répondent.');
    process.exit(failures ? 1 : 0);
})();
