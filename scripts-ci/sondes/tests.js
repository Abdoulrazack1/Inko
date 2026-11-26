// tests — qualité de la suite : tests qui lisent le source, absence de test, tests ignorés
'use strict';
const path = require('path');
module.exports = {
    nom: 'tests',
    description: 'Couverture par module, tests « source-grep », tests ignorés, e2e, tests sans assertion',
    async run(ctx) {
        const unit = [...ctx.parcourir(ctx.abs('test', 'unit'), ctx.ext('.js'))];
        const srv = [...ctx.parcourir(ctx.abs('server', 'test'), ctx.ext('.js'))].filter(p => !/node_modules/.test(p));
        const e2e = [...ctx.parcourir(ctx.abs('test', 'e2e'), ctx.ext('.js'))];
        ctx.mesure('fichiers_tests', { unit: unit.length, serveur: srv.length, e2e: e2e.length });
        const corpusTests = [...unit, ...srv, ...e2e].map(p => ctx.lire(p)).join('\n');
        let sourceGrep = 0, sansAssert = 0, skips = 0, tests = 0;
        const fragiles = [];
        for (const p of [...unit, ...srv]) {
            const t = ctx.lire(p), r = ctx.rel(p);
            const n = (t.match(/\btest\(|\bit\(/g) || []).length; tests += n;
            const lit = /readFileSync\([^)]*(assets|server|\.\.)/.test(t) || /\blire\(/.test(t);
            const requireReel = /require\([^)]*(assets\/js|controllers|\/lib\/)/.test(t) || /new JSDOM|vm\.runIn|loadScript|chargerScript/.test(t);
            if (lit && !requireReel) { sourceGrep++; fragiles.push(r); }
            if (/\.skip\(|\btest\.todo|\bit\.skip|\{\s*skip\s*:\s*true/.test(t)) { skips++; ctx.trouver({ gravite: 'basse', id: 'TEST-IGNORE', categorie: 'tests', titre: 'Test ignoré (skip/todo)', fichier: r, effort: 'S' }); }
            if (n > 0 && !/assert|expect/.test(t)) { sansAssert++; ctx.trouver({ gravite: 'moyenne', id: 'TEST-SANS-ASSERTION', categorie: 'tests', titre: 'Fichier de test sans aucune assertion', fichier: r, effort: 'S' }); }
        }
        ctx.mesure('tests_total_approx', tests); ctx.mesure('tests_qui_lisent_le_source', sourceGrep);
        if (sourceGrep > 20) ctx.trouver({ gravite: 'moyenne', id: 'TEST-SOURCE-GREP', categorie: 'tests', titre: `${sourceGrep} fichiers de test vérifient le TEXTE du source plutôt que son comportement`, detail: fragiles.slice(0, 30).join('\n'),
            correctif: 'Un test qui cherche une regex dans le code passe tant que la regex y est, même si la fonction est cassée (et casse au moindre renommage). Convertir en tests de comportement avec jsdom (déjà en devDependency) pour les modules critiques : api, storage, serie, chapitre.', effort: 'XL' });
        // modules sans aucun test qui les nomme
        const sans = [];
        for (const p of ctx.parcourir(ctx.abs('assets', 'js'), ctx.ext('.js'))) { const b = path.basename(p); if (/vendor|\.min\./.test(p)) continue; if (!corpusTests.includes(b) && !corpusTests.includes(b.replace('.js', ''))) sans.push([b, ctx.lire(p).split('\n').length]); }
        const sansSrv = [];
        for (const p of ctx.parcourir(ctx.abs('server'), ctx.ext('.js'))) { const r = ctx.rel(p); if (!/controllers\/|lib\/|middleware\//.test(r) || /node_modules|test\//.test(r)) continue; const b = path.basename(p); if (!corpusTests.includes(b) && !corpusTests.includes(b.replace('.js', ''))) sansSrv.push([r, ctx.lire(p).split('\n').length]); }
        ctx.mesure('front_sans_test_nomme', sans.length); ctx.mesure('serveur_sans_test_nomme', sansSrv.length);
        for (const [b, n] of sans.filter(x => x[1] > 300)) ctx.trouver({ gravite: n > 800 ? 'haute' : 'moyenne', id: 'TEST-MODULE-NON-TESTE', categorie: 'tests', titre: `assets/js/${b} (${n} lignes) n'est nommé par aucun test`, fichier: 'assets/js/' + b, correctif: 'Test de comportement (jsdom) sur les chemins critiques.', effort: 'L' });
        for (const [r, n] of sansSrv.filter(x => x[1] > 120)) ctx.trouver({ gravite: 'moyenne', id: 'TEST-SERVEUR-NON-TESTE', categorie: 'tests', titre: `${r} (${n} lignes) n'est nommé par aucun test`, fichier: r, effort: 'M' });
        // e2e : pages couvertes
        const pages = [...ctx.parcourir(ctx.racine, ctx.ext('.html'))].filter(p => ctx.rel(p).split('/').length === 1).map(p => path.basename(p));
        const e2eTexte = e2e.map(p => ctx.lire(p)).join('\n');
        const nonCouvertes = pages.filter(p => !e2eTexte.includes(p.replace('.html', '')));
        ctx.mesure('pages_sans_e2e', nonCouvertes);
        if (nonCouvertes.length > 5) ctx.trouver({ gravite: 'moyenne', id: 'TEST-E2E-PAGES', categorie: 'tests', titre: `${nonCouvertes.length}/${pages.length} pages sans scénario e2e`, detail: nonCouvertes.join(', '), correctif: 'Un parcours fumée (charge sans erreur console) par page, généré depuis la liste des pages.', effort: 'M' });
        // intégration serveur : routes jamais appelées par un test
        const routes = ctx.lire(ctx.abs('server', 'routes', 'index.js'));
        const chemins = [...routes.matchAll(/router\.(?:get|post|put|delete)\s*\(\s*'([^']+)'/g)].map(m => m[1]);
        const sansAppel = chemins.filter(c => { const base = c.replace(/\/:\w+/g, '').split('/').filter(Boolean).join('/'); return base && !corpusTests.includes(base); });
        ctx.mesure('routes_non_citees_par_un_test', sansAppel.length);
        if (sansAppel.length > 40) ctx.trouver({ gravite: 'moyenne', id: 'TEST-ROUTES-NON-APPELEES', categorie: 'tests', titre: `${sansAppel.length}/${chemins.length} routes ne sont citées dans aucun test`, detail: sansAppel.slice(0, 50).join('\n'), correctif: 'Test de contrat supertest-like (http natif) généré depuis openapi.json : statut attendu sans auth (401), avec auth (200).', effort: 'L' });
    },
};
