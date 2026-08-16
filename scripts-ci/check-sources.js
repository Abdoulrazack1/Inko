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

// Dossier des extensions : server/extensions par défaut (copies installées),
// mais surchargeable via EXT_DIR — la CI (audit B-6) pointe sur
// extensions-community/ qui a besoin de cheerio ; on le résout depuis
// server/node_modules pour ne pas dupliquer l'install.
const EXT_DIR = process.env.EXT_DIR
    ? path.resolve(process.env.EXT_DIR)
    : path.join(__dirname, '..', 'server', 'extensions');
const TIMEOUT = 45_000;
// Les extensions font require('axios')/require('cheerio') : ces deps vivent dans
// server/node_modules. On étend le chemin de résolution des modules pour que
// check-sources.js puisse charger extensions-community/ (audit B-6).
const serverModules = path.join(__dirname, '..', 'server', 'node_modules');
if (fs.existsSync(serverModules)) {
    process.env.NODE_PATH = (process.env.NODE_PATH ? process.env.NODE_PATH + path.delimiter : '') + serverModules;
    require('module').Module._initPaths();
}

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
    let blocages = 0;   // sites qui refusent le runner : signalés, pas comptés
    for (const dir of dirs) {
        const label = dir.padEnd(14);
        let src;
        try { src = require(path.join(EXT_DIR, dir, 'index.js')); }
        catch (e) { console.log(`✖ ${label} chargement impossible : ${e.message}`); failures++; continue; }
        if (typeof src.warmup === 'function') { try { await withTimeout(src.warmup(), TIMEOUT, dir); } catch (e) {} }
        const t0 = Date.now();
        const DEMANDE = 5;
        try {
            const r = await withTimeout(src.popular({ limit: DEMANDE }), TIMEOUT, dir);
            const resultats = (r && r.results) || [];
            const n = resultats.length;
            const secs = ((Date.now() - t0) / 1000).toFixed(1);

            if (n === 0) {
                console.log(`✖ ${label} 0 résultat (${secs}s) — balisage ou URL du site probablement changés`);
                failures++;
                continue;
            }

            // ── BUG-07 : « répond » ne veut pas dire « respecte le contrat » ──
            // WeebCentral rendait 32 résultats pour `limit=3`, et ce script la
            // déclarait saine parce qu'il ne comptait que « plus de zéro ».
            // Toute pagination bâtie dessus était fausse, et rien ne pouvait
            // l'attraper. Une source qui ment sur sa limite est cassée d'une
            // façon plus insidieuse qu'une source muette : elle a l'air de
            // marcher.
            const ruptures = [];
            if (n > DEMANDE) ruptures.push(`limit ignoré (${n} rendus pour ${DEMANDE} demandés)`);

            // Le contrat minimal d'une entrée : un identifiant utilisable et un
            // titre. Sans identifiant, l'entrée ne peut mener nulle part ;
            // sans titre, elle est illisible dans une grille.
            const sansId    = resultats.filter(m => !m || !m.id).length;
            const sansTitre = resultats.filter(m => !m || !String(m.title || '').trim()).length;
            if (sansId)    ruptures.push(`${sansId} entrée(s) sans identifiant`);
            if (sansTitre) ruptures.push(`${sansTitre} entrée(s) sans titre`);

            if (ruptures.length) {
                console.log(`✖ ${label} ${n} résultat(s) en ${secs}s — contrat rompu : ${ruptures.join(' ; ')}`);
                failures++;
            } else {
                console.log(`✔ ${label} ${n} résultat(s) en ${secs}s`);
            }
        } catch (e) {
            // ── Bloqué n'est pas cassé ──────────────────────
            // Relevé sur les runs du 3 et du 10 août : HTTP 403,
            // « Command failed: curl », délais dépassés — sur CINQ sources à la
            // fois, alors que les mêmes répondent depuis une connexion
            // domestique. Les sites scrapés bloquent les adresses de centres de
            // données : c'est le RUNNER qu'ils refusent, pas la source qui a
            // cassé.
            //
            // Compter ça comme une panne fait crier au loup chaque semaine. Et
            // une alarme à laquelle on ne croit plus ne sert à rien — c'est
            // exactement ce qui a laissé novelbin morte quatre lundis de suite
            // pendant que le job était rouge.
            //
            // Ces échecs sont donc SIGNALÉS sans faire échouer le contrôle. Une
            // source réellement cassée, elle, répond 200 et rend une liste vide
            // ou des entrées incomplètes : ces cas restent des pannes.
            const m = String((e && e.message) || e || '');
            const bloque = /HTTP 40[13]|HTTP 429|HTTP 5\d\d|Command failed: curl|délai|timeout|ETIMEDOUT|ECONNRESET|EAI_AGAIN|socket hang up/i.test(m);
            if (bloque) {
                console.log(`\u26a0 ${label} injoignable depuis ce runner \u2014 ${m.slice(0, 80)}`);
                blocages++;
            } else {
                console.log(`\u2716 ${label} ${m}`);
                failures++;
            }
        }
    }
    if (blocages) {
        console.log(`\n${blocages} source(s) ont refusé ce runner (403/429/délai) — non compté comme panne.`);
        console.log('   Ces sites bloquent les adresses de centres de données ; vérifier depuis'
            + ' une connexion domestique avant de conclure.');
    }
    console.log(failures ? `\n${failures} source(s) cassée(s).` : '\nAucune source cassée.');
    process.exit(failures ? 1 : 0);
})();
