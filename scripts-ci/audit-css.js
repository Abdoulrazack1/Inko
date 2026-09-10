#!/usr/bin/env node
// ============================================================
// audit-css.js — l'empilement, les conflits, le poids
// ------------------------------------------------------------
// L'audit dans le navigateur COMPTE les chevauchements ; il n'explique pas
// pourquoi ils arrivent. 99 recouvrements sur 23 pages ne sont probablement
// pas 99 défauts : c'est un empilement mal ordonné, et ça se lit dans les
// feuilles, sans navigateur.
//
// Ce script relève ce qui produit ce genre de panne :
//
//   · les `z-index` déclarés, triés — l'échelle réelle de l'application,
//     à comparer à celle qu'on croit avoir ;
//   · les `position: fixed` qui, sans `z-index`, se recouvrent dans l'ordre
//     du document — l'ordre le moins prévisible qui soit ;
//   · les `!important`, qui rendent un correctif de mise en page impossible
//     sans en ajouter un autre ;
//   · les sélecteurs déclarés plusieurs fois avec des valeurs différentes ;
//   · le poids réel, règle par fichier.
'use strict';

const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..');
const CSS = path.join(RACINE, 'mobile', 'www', 'assets', 'css');

/** Retire les commentaires : ils citent souvent des valeurs qu'on chercherait. */
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');

/**
 * Le bloc `@` qui englobe la position donnée, ou '' à la racine.
 *
 * Une règle écrite dans `@media (max-width: 768px)` n'entre en concurrence
 * qu'avec les règles du MÊME contexte. Comparer sans en tenir compte fait
 * passer tout le responsive du projet pour une pile de conflits.
 *
 * On compte les accolades depuis le début : celle qui reste ouverte au-dessus
 * de nous et qui commence par `@` est notre contexte.
 */
function blocEnglobant(s, position) {
    const pile = [];
    for (let i = 0; i < position; i++) {
        if (s[i] === '{') {
            const debut = s.lastIndexOf('}', i - 1) + 1;
            const tete = s.slice(Math.max(debut, s.lastIndexOf('{', i - 1) + 1), i).trim();
            pile.push(tete);
        } else if (s[i] === '}') pile.pop();
    }
    const at = pile.filter((t) => t.startsWith('@'));
    return at.length ? at.join(' » ').replace(/\s+/g, ' ') + ' » ' : '';
}

function analyser() {
    const fichiers = fs.existsSync(CSS)
        ? fs.readdirSync(CSS).filter((f) => f.endsWith('.css'))
        : [];

    const zindex = [];
    const fixesSansZ = [];
    const importants = [];
    const parFichier = [];
    const declarations = new Map();      // "selecteur|propriete" → [valeurs]

    for (const f of fichiers) {
        const brut = fs.readFileSync(path.join(CSS, f), 'utf8');
        const s = sansCommentaires(brut);
        const lignes = brut.split('\n').length;
        const regles = (s.match(/\{/g) || []).length;

        for (const m of s.matchAll(/z-index\s*:\s*(-?\d+)/g)) {
            const avant = s.slice(0, m.index);
            zindex.push({ f, valeur: +m[1], ligne: avant.split('\n').length,
                selecteur: (avant.match(/([^{}]+)\{[^{}]*$/) || [, '?'])[1].trim().split('\n').pop().slice(0, 60) });
        }

        // Un bloc `position: fixed` sans z-index : l'ordre du document décide.
        //
        // Sauf que la CASCADE existe, et l'ignorer donnait deux faux positifs
        // sur deux — les seuls que ce script trouvait :
        //
        //   · `.reader-pages-area.paged .page-counter-badge` ne redéfinit que
        //     `position` et `bottom` ; la règle de base `.page-counter-badge`
        //     déclare `z-index: 5` quelques lignes plus haut ;
        //   · `#inko-music .im-pill` vit dans `#inko-music`, qui est
        //     `position: fixed; z-index: 9000` — donc un contexte
        //     d'empilement. Son enfant s'empile DEDANS : lui donner un z-index
        //     ne changerait rien à son rang vis-à-vis du reste de la page.
        //
        // Un rapport dont chaque entrée est un faux positif cesse d'être lu.
        // On vérifie donc ces deux échappatoires avant de signaler.
        const echapper = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const declareZ = (partie) => partie.length > 1
            && new RegExp(echapper(partie) + '[^{}]*\\{[^{}]*z-index').test(s);
        for (const bloc of s.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
            const [, sel, corps] = bloc;
            if (/position\s*:\s*fixed/.test(corps) && !/z-index/.test(corps)) {
                const propre = sel.trim().split('\n').pop().trim();
                const parties = propre.split(/[\s>+~]+/).filter(Boolean);
                const dernier = parties[parties.length - 1] || '';
                const ancetres = parties.slice(0, -1);
                // Le même composant final porte-t-il un z-index ailleurs ?
                const heriteDeLaBase = declareZ(dernier);
                // Un ancêtre crée-t-il déjà un contexte d'empilement ?
                const dansUnContexte = ancetres.some(declareZ);
                if (!heriteDeLaBase && !dansUnContexte) {
                    fixesSansZ.push({ f, selecteur: propre.slice(0, 60) });
                }
            }
            // Le CONTEXTE compte, et l'ignorer rendait ce relevé inutilisable.
            //
            // Les 291 « conflits » qu'il annonçait étaient presque tous du CSS
            // parfaitement correct :
            //
            //   · `.hero → height : 520px vs 460px vs 380px` — trois valeurs
            //     dans trois `@media` différentes. C'est du responsive, pas un
            //     conflit ;
            //   · `from → transform : scale(1.06) vs scale(0.985)` — deux
            //     `@keyframes` sans rapport, dont les sélecteurs s'appellent
            //     tous les deux `from`.
            //
            // On qualifie donc la clé par le bloc `@` englobant, et on écarte
            // les sélecteurs d'images-clés. Ce qui reste est une vraie
            // redéclaration : deux valeurs, même sélecteur, même contexte —
            // l'une gagne, et laquelle dépend de l'ordre du fichier.
            const contexte = blocEnglobant(s, bloc.index);
            const estImageCle = /^\s*(from|to|\d+%)\s*$/.test(sel);
            if (!estImageCle && !/^\s*@/.test(sel)) {
                // Le REPLI ANDROID 8, qui est voulu et documenté partout où il
                // apparaît : la même propriété écrite deux fois DANS LA MÊME
                // règle, la seconde avec `env()` ou `calc(… env(…))`. Le WebView
                // d'Android 8 ne sait pas lire `env()` et jette la déclaration
                // ENTIÈRE plutôt que de retomber sur une valeur par défaut ;
                // sans le doublon, `bottom` disparaîtrait et le bandeau irait se
                // coller en haut de l'écran (régression MOB-02).
                //
                // Le signaler revenait à demander de casser exactement ce que
                // ce doublon protège. On le reconnaît, on le laisse tranquille.
                const replisAndroid8 = new Set();
                for (const d of corps.matchAll(/([a-z-]+)\s*:\s*([^;]+);/g)) {
                    if (/env\s*\(/.test(d[2])) replisAndroid8.add(d[1]);
                }
                for (const d of corps.matchAll(/([a-z-]+)\s*:\s*([^;]+);/g)) {
                    if (replisAndroid8.has(d[1])) continue;
                    // La clé porte le FICHIER : `global.css` pose la base et
                    // `accueil.css` la surcharge, c'est la cascade, telle
                    // qu'on l'a voulue. Ce qui mérite un regard, c'est le même
                    // sélecteur redéclaré DEUX FOIS dans le même fichier et le
                    // même contexte — là, l'une des deux valeurs ne sert à
                    // rien, et personne ne sait laquelle.
                    const cle = f + ' » ' + contexte + sel.trim().replace(/\s+/g, ' ') + '|' + d[1];
                    if (!declarations.has(cle)) declarations.set(cle, new Set());
                    declarations.get(cle).add(d[2].trim());
                }
            }
        }

        for (const m of s.matchAll(/([a-z-]+)\s*:[^;]*!important/g)) {
            importants.push({ f, propriete: m[1], ligne: s.slice(0, m.index).split('\n').length });
        }

        parFichier.push({ f, lignes, regles, octets: Buffer.byteLength(brut) });
    }

    // Un même sélecteur qui redéclare la MÊME propriété avec des valeurs
    // différentes : l'une gagne, et laquelle dépend de l'ordre de chargement.
    const conflits = [...declarations.entries()]
        .filter(([, v]) => v.size > 1)
        .map(([k, v]) => ({ ou: k, valeurs: [...v].slice(0, 3) }));

    return { fichiers: parFichier, zindex, fixesSansZ, importants, conflits };
}

function rapport(a) {
    const L = [];
    L.push('## Feuilles de style — empilement et conflits');
    L.push('');

    const totO = a.fichiers.reduce((n, f) => n + f.octets, 0);
    const totR = a.fichiers.reduce((n, f) => n + f.regles, 0);
    L.push(`${a.fichiers.length} feuilles · ${totR} règles · ${Math.round(totO / 1024)} Ko`);
    L.push('');
    L.push('| Feuille | Règles | Lignes | Poids |');
    L.push('|---|---|---|---|');
    for (const f of a.fichiers.sort((x, y) => y.regles - x.regles)) {
        L.push(`| \`${f.f}\` | ${f.regles} | ${f.lignes} | ${Math.round(f.octets / 1024)} Ko |`);
    }
    L.push('');

    // ── L'échelle des z-index ───────────────────────────────
    const paliers = [...new Set(a.zindex.map((z) => z.valeur))].sort((x, y) => x - y);
    L.push(`### L’échelle des \`z-index\` — ${a.zindex.length} déclarations, ${paliers.length} paliers distincts`);
    L.push('');
    L.push('Une échelle qui compte des dizaines de paliers ne se raisonne plus :');
    L.push('poser un élément « au-dessus » devient une devinette, et c’est ainsi');
    L.push('qu’un bandeau finit par recouvrir la barre de navigation.');
    L.push('');
    L.push('```');
    L.push(paliers.join('  '));
    L.push('```');
    L.push('');
    const hauts = a.zindex.filter((z) => z.valeur >= 1000).sort((x, y) => y.valeur - x.valeur);
    if (hauts.length) {
        L.push(`**Les ${Math.min(hauts.length, 15)} plus hauts** — ce sont eux qui recouvrent tout le reste :`);
        L.push('');
        for (const z of hauts.slice(0, 15)) {
            L.push(`- \`${z.valeur}\` — \`${z.selecteur}\` (${z.f}:${z.ligne})`);
        }
        L.push('');
    }

    // ── Les fixed sans z-index ──────────────────────────────
    if (a.fixesSansZ.length) {
        L.push(`### ${a.fixesSansZ.length} éléments \`position: fixed\` SANS \`z-index\``);
        L.push('');
        L.push('Leur empilement dépend alors de l’ordre du document — l’ordre le');
        L.push('moins prévisible, et celui qui change dès qu’on déplace un bloc.');
        L.push('');
        for (const f of a.fixesSansZ.slice(0, 20)) L.push(`- \`${f.selecteur}\` (${f.f})`);
        if (a.fixesSansZ.length > 20) L.push(`- … et ${a.fixesSansZ.length - 20} autres`);
        L.push('');
    }

    // ── Les !important ──────────────────────────────────────
    L.push(`### ${a.importants.length} déclarations \`!important\``);
    L.push('');
    L.push('Chacune rend un correctif de mise en page impossible sans en ajouter');
    L.push('un autre. C’est la dette qui se paie à chaque retouche.');
    L.push('');
    const parProp = {};
    for (const i of a.importants) parProp[i.propriete] = (parProp[i.propriete] || 0) + 1;
    for (const [p, n] of Object.entries(parProp).sort((x, y) => y[1] - x[1]).slice(0, 12)) {
        L.push(`- \`${p}\` — ${n} fois`);
    }
    L.push('');

    // ── Les conflits ────────────────────────────────────────
    L.push(`### ${a.conflits.length} propriétés déclarées PLUSIEURS FOIS sur le même sélecteur`);
    L.push('');
    L.push('L’une gagne, et laquelle dépend de l’ordre de chargement des feuilles.');
    L.push('');
    for (const c of a.conflits.slice(0, 15)) {
        const [sel, prop] = c.ou.split('|');
        L.push(`- \`${sel.slice(0, 50)}\` → \`${prop}\` : ${c.valeurs.map((v) => '`' + v.slice(0, 24) + '`').join(' vs ')}`);
    }
    if (a.conflits.length > 15) L.push(`- … et ${a.conflits.length - 15} autres`);
    L.push('');
    return L.join('\n');
}

const a = analyser();
const texte = rapport(a);
const dest = path.join(RACINE, 'docs', 'audit-css.md');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, '# Audit des feuilles de style\n\n' + texte);
console.log(`z-index : ${a.zindex.length} déclarations, ${new Set(a.zindex.map((z) => z.valeur)).size} paliers`);
console.log(`fixed sans z-index : ${a.fixesSansZ.length}`);
console.log(`!important : ${a.importants.length}`);
console.log(`conflits de déclaration : ${a.conflits.length}`);
console.log('→ docs/audit-css.md');
