#!/usr/bin/env node
// ============================================================
// clean.js — Purge les artefacts de build (audit III.11)
// ------------------------------------------------------------
// L'arbre de travail avait atteint 3 973 Mo pour ~3 Mo de code source :
//   · desktop/                       782 Mo  (Electron orphelin, remplacé par Tauri)
//   · desktop-tauri/…/target/      2 185 Mo  (cache cargo + 12 installeurs obsolètes)
//   · tools/                         738 Mo  (chaîne vidéo, sans rapport avec Inko)
// Rien ne purgeait jamais : `bundle/` accumulait un installeur par version
// publiée (2.0.0 → 2.3.3 y dormaient encore), et cargo ne nettoie pas seul.
//
//   node scripts-ci/clean.js            → purge sûre (bundle + dist)
//   node scripts-ci/clean.js --all      → + cache de compilation Rust
//   node scripts-ci/clean.js --dry-run  → montre sans supprimer
// ============================================================
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const ALL = args.includes('--all');

// `safe` : régénéré par le prochain build, aucune raison de le garder.
// `heavy` : cache de compilation — le supprimer coûte un rebuild complet (~10 min).
const TARGETS = [
    { rel: 'desktop-tauri/src-tauri/target/release/bundle', kind: 'safe',
      why: 'installeurs NSIS des versions publiées (recréés au prochain build)' },
    { rel: 'desktop', kind: 'safe',
      why: 'reliquat Electron — aucun fichier source, remplacé par desktop-tauri/' },
    { rel: 'desktop-tauri/src-tauri/target', kind: 'heavy',
      why: 'cache de compilation Rust (rebuild complet nécessaire ensuite)' },
];

function sizeOf(dir) {
    let total = 0;
    const stack = [dir];
    while (stack.length) {
        const cur = stack.pop();
        let entries;
        try { entries = fs.readdirSync(cur, { withFileTypes: true }); } catch (e) { continue; }
        for (const e of entries) {
            const p = path.join(cur, e.name);
            if (e.isDirectory()) stack.push(p);
            else { try { total += fs.statSync(p).size; } catch (e2) { /* fichier volatil */ } }
        }
    }
    return total;
}

const mb = b => Math.round(b / 1048576);

let freed = 0;
for (const t of TARGETS) {
    if (t.kind === 'heavy' && !ALL) continue;
    const abs = path.join(ROOT, t.rel);
    if (!fs.existsSync(abs)) continue;
    const s = sizeOf(abs);
    freed += s;
    if (DRY) {
        console.log(`  [dry-run] ${t.rel} — ${mb(s)} Mo : ${t.why}`);
    } else {
        fs.rmSync(abs, { recursive: true, force: true });
        console.log(`  supprimé  ${t.rel} — ${mb(s)} Mo`);
    }
}

if (!freed) {
    console.log('Rien à purger — l\'arbre est déjà propre.');
} else {
    console.log(`\n${DRY ? 'Récupérable' : 'Récupéré'} : ${mb(freed)} Mo`);
    if (!ALL) console.log('Ajoute --all pour purger aussi le cache de compilation Rust.');
}
