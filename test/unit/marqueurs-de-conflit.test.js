// ============================================================
// test/unit/marqueurs-de-conflit.test.js — rien ne part avec des
// marqueurs de conflit dedans
// ------------------------------------------------------------
// Trente et une branches parties du même point, toutes touchant
// `global.css` : la fusion a produit environ quatre cents conflits. Deux
// d'entre eux ont été COMMITÉS tels quels, marqueurs compris, et ont
// traversé 812 tests et cinq portillons de CI sans en faire tomber un
// seul. On ne les a vus qu'en ouvrant la page dans un navigateur.
//
// Ce qu'ils coûtaient :
//
//   · `parametres.html` — `<<<<<<< HEAD` affiché en haut de la page, en
//     texte, au-dessus du titre. Le côté HEAD était vide ; le côté
//     branche portait le lien vers `assets/css/parametres.css`, c'est-à-dire
//     tout l'objet de la PR qui sortait le CSS du bloc <style>.
//
//   · `service-worker.js` — QUINZE `const CACHE_VERSION` empilés, un par
//     fusion. Le fichier ne se parsait plus : `node --check` rendait
//     « SyntaxError: Unexpected token '<<' ». Un service worker qui ne
//     parse pas ne s'installe pas. L'application n'avait donc plus de
//     cache hors-ligne, plus de précache, plus de mise à jour — et rien
//     ne le disait.
//
// Pourquoi aucun test ne l'a vu : ils cherchent tous des motifs PRÉSENTS.
// `parametres-composition.test.js` demande que le lien vers la feuille
// existe dans le gabarit — il existait, entre deux marqueurs. Un fichier
// peut contenir tout ce qu'on exige de lui et rester cassé.
//
// D'où ce test, qui ne cherche pas ce qui doit être là mais ce qui ne
// doit jamais l'être.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..', '..');

// On balaie les sources suivies, pas les dépendances ni le construit.
const IGNORES = new Set(['node_modules', '.git', 'dist', 'build', 'coverage',
    'android', 'desktop-tauri', 'promo', 'www', '.cache']);
const SUFFIXES = ['.js', '.mjs', '.cjs', '.html', '.css', '.json', '.md', '.yml', '.yaml'];

function fichiers(dir, acc = []) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.name.startsWith('.') && e.name !== '.github') continue;
        if (IGNORES.has(e.name)) continue;
        const p = path.join(dir, e.name);
        if (e.isDirectory()) fichiers(p, acc);
        else if (SUFFIXES.some((s) => e.name.endsWith(s))) acc.push(p);
    }
    return acc;
}

// Ce fichier-ci PARLE des marqueurs : il les écrit donc, dans ses
// commentaires et dans ses propres motifs. Il s'exclut lui-même.
const MOI = path.relative(RACINE, __filename).replace(/\\/g, '/');

test('aucun marqueur de conflit dans les sources', () => {
    // En trois morceaux, sinon ce test se signalerait lui-même au balayage.
    const OUVRE = '<'.repeat(7);
    const SEPARE = '='.repeat(7);
    const FERME = '>'.repeat(7);

    const fautes = [];
    for (const f of fichiers(RACINE)) {
        const rel = path.relative(RACINE, f).replace(/\\/g, '/');
        if (rel === MOI) continue;
        let texte;
        try { texte = fs.readFileSync(f, 'utf8'); } catch { continue; }
        if (!texte.includes(OUVRE) && !texte.includes(FERME)) continue;
        texte.split('\n').forEach((l, i) => {
            const n = l.replace(/\r$/, '');
            // Un marqueur occupe le DÉBUT de sa ligne. `=======` seul
            // compte aussi : c'est un séparateur, jamais du code.
            if (n.startsWith(OUVRE) || n.startsWith(FERME) || n === SEPARE) {
                fautes.push(`${rel}:${i + 1} — ${n.slice(0, 60)}`);
            }
        });
    }
    assert.deepEqual(fautes, [],
        `marqueurs de conflit commités :\n  ${fautes.join('\n  ')}`);
});

test('le service worker se parse', () => {
    // Le test précédent attrape les marqueurs ; celui-ci attrape tout le
    // reste. Un service worker qui ne parse pas ne s'installe pas, et
    // l'application perd son cache hors-ligne sans un mot.
    const src = fs.readFileSync(path.join(RACINE, 'service-worker.js'), 'utf8');
    assert.doesNotThrow(() => new Function(src),
        'service-worker.js ne se parse pas');
});

test('une seule version de cache, et elle est générée', () => {
    const src = fs.readFileSync(path.join(RACINE, 'service-worker.js'), 'utf8');
    const versions = src.match(/^const CACHE_VERSION = '[^']*';$/gm) || [];
    assert.equal(versions.length, 1,
        `${versions.length} déclarations de CACHE_VERSION :\n  ${versions.join('\n  ')}`);
    // L'empreinte est posée par gen-precache : elle suit la version
    // applicative et le contenu des assets.
    assert.match(versions[0], /^const CACHE_VERSION = 'inko-\d+\.\d+\.\d+-[0-9a-f]{6}';$/);
});

test('les gabarits se referment', () => {
    // Un marqueur dans du HTML passe inaperçu : le navigateur l'affiche en
    // texte au lieu de se plaindre. On compte donc les balises ouvrantes
    // et fermantes des conteneurs qu'une fusion coupe le plus souvent.
    const pages = fs.readdirSync(RACINE).filter((f) => f.endsWith('.html'));
    assert.ok(pages.length > 5, 'les pages sont bien à la racine');
    const fautes = [];
    for (const p of pages) {
        const src = fs.readFileSync(path.join(RACINE, p), 'utf8');
        for (const balise of ['head', 'body', 'main']) {
            const o = (src.match(new RegExp(`<${balise}[\\s>]`, 'g')) || []).length;
            const c = (src.match(new RegExp(`</${balise}>`, 'g')) || []).length;
            if (o !== c) fautes.push(`${p} — <${balise}> ouvert ${o} fois, fermé ${c}`);
        }
    }
    assert.deepEqual(fautes, [], `gabarits déséquilibrés :\n  ${fautes.join('\n  ')}`);
});
