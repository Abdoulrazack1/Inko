// perf-statique — poids, scripts bloquants, images, polices, précache (sans navigateur)
'use strict';
const fs = require('fs');
module.exports = {
    nom: 'perf-statique',
    description: 'Poids JS/CSS/images/polices par page, scripts sans defer, images sans dimensions, cache SW',
    async run(ctx) {
        const pages = [...ctx.parcourir(ctx.racine, ctx.ext('.html'))].filter(p => ctx.rel(p).split('/').length === 1);
        const taille = (rel) => { try { return fs.statSync(ctx.abs(rel.split('?')[0].replace(/^\//, ''))).size; } catch (e) { return 0; } };
        const tableau = [];
        for (const p of pages) {
            const t = ctx.lire(p), r = ctx.rel(p);
            const scripts = [...t.matchAll(/<script\b([^>]*)>/g)].filter(m => /\bsrc=/.test(m[1])).map(m => ({ src: (/src=["']([^"']+)/.exec(m[1]) || [])[1], defer: /\bdefer\b|\basync\b|type=["']module/.test(m[1]) }));
            const css = [...t.matchAll(/<link[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)/g)].map(m => m[1]);
            const jsKo = scripts.reduce((s, x) => s + taille(x.src || ''), 0), cssKo = css.reduce((s, x) => s + taille(x), 0);
            tableau.push({ page: r, scripts: scripts.length, js_ko: ctx.kb(jsKo), css_ko: ctx.kb(cssKo), bloquants: scripts.filter(x => !x.defer && !/^https?:/.test(x.src || '')).length });
            const bloq = scripts.filter(x => !x.defer);
            if (bloq.length > 3) ctx.trouver({ gravite: 'moyenne', id: 'PERF-SCRIPTS-BLOQUANTS', categorie: 'performance', titre: `${r} : ${bloq.length} scripts sans defer (parse bloquant)`, fichier: r, detail: bloq.map(x => x.src).join('\n'), correctif: 'defer sur tous les scripts non critiques ; conserve l\'ordre d\'exécution.', effort: 'S' });
            if (jsKo > 700 * 1024) ctx.trouver({ gravite: 'moyenne', id: 'PERF-JS-LOURD', categorie: 'performance', titre: `${r} charge ${ctx.kb(jsKo)} Ko de JS`, fichier: r, correctif: 'Charger à la demande ce que la page n\'utilise pas au premier écran (hero3d/three, pdf.js, jszip, gsap).', effort: 'M' });
            const lourds = scripts.filter(x => taille(x.src || '') > 250 * 1024);
            lourds.forEach(x => ctx.trouver({ gravite: 'basse', id: 'PERF-VENDOR-LOURD', categorie: 'performance', titre: `${r} charge ${x.src} (${ctx.kb(taille(x.src))} Ko)`, fichier: r, correctif: 'import dynamique à l\'ouverture de la fonctionnalité concernée.', effort: 'M' }));
            ctx.chercher(t, /<img\b(?![^>]*\bloading=)[^>]*>/, (m, l) => { if (!/width=|height=/.test(m[0])) ctx.trouver({ gravite: 'basse', id: 'PERF-IMG-SANS-DIM', categorie: 'performance', titre: '<img> sans width/height ni loading : décalage de mise en page', fichier: r, ligne: l, effort: 'S' }); });
            if (!/<link[^>]*rel=["']preload["'][^>]*font/.test(t) && /fonts\.css/.test(t)) ctx.trouver({ gravite: 'basse', id: 'PERF-FONT-PRELOAD', categorie: 'performance', titre: 'Polices locales sans preload (texte invisible/sauté au premier rendu)', fichier: r, correctif: 'preload de la police du corps + font-display: swap vérifié.', effort: 'S' });
        }
        ctx.mesure('pages_poids', tableau.sort((a, b) => b.js_ko - a.js_ko));
        // fichiers JS bruts : jamais minifiés ?
        const js = [...ctx.parcourir(ctx.abs('assets', 'js'), ctx.ext('.js'))];
        const total = js.reduce((s, p) => s + fs.statSync(p).size, 0);
        ctx.mesure('js_applicatif_ko', ctx.kb(total));
        if (total > 1.2 * 1024 * 1024) ctx.trouver({ gravite: 'moyenne', id: 'PERF-PAS-MINIFIE', categorie: 'performance', titre: `${ctx.kb(total)} Ko de JS applicatif servi tel quel (aucune minification)`, correctif: 'esbuild --minify dans le build web/desktop ; l\'APK le fait déjà (transpilation chrome61) : même chaîne pour le web. Gain attendu ~55 % + gzip.', effort: 'M' });
        const sw = ctx.lire(ctx.abs('service-worker.js'));
        const pre = (/PRECACHE\s*=\s*\[([\s\S]*?)\]/.exec(sw) || [, ''])[1];
        const nbPre = (pre.match(/['"]/g) || []).length / 2;
        const poidsPre = [...pre.matchAll(/['"]([^'"]+)['"]/g)].reduce((s, m) => s + taille(m[1]), 0);
        ctx.mesure('precache', { entrees: nbPre, ko: ctx.kb(poidsPre) });
        if (poidsPre > 6 * 1024 * 1024) ctx.trouver({ gravite: 'moyenne', id: 'PERF-PRECACHE-LOURD', categorie: 'performance', titre: `Précache du service worker : ${ctx.kb(poidsPre)} Ko téléchargés à la première visite`, fichier: 'service-worker.js', correctif: 'Précacher le noyau (global, api, accueil) ; le reste en stale-while-revalidate à l\'usage.', effort: 'M' });
        // polices : variantes inutiles
        const polices = fs.readdirSync(ctx.abs('assets', 'font'));
        ctx.mesure('polices_fichiers', polices.length);
        if (polices.length > 24) ctx.trouver({ gravite: 'basse', id: 'PERF-POLICES', categorie: 'performance', titre: `${polices.length} fichiers de polices (3 familles × graisses × sous-ensembles)`, correctif: 'unicode-range déjà utile ; supprimer les graisses non utilisées (grep font-weight).', effort: 'S' });
        // images brutes volumineuses
        for (const p of ctx.parcourir(ctx.racine, ctx.ext('.png', '.jpg', '.jpeg', '.webp', '.gif'))) {
            const r = ctx.rel(p);
            if (/node_modules|promo|android|mobile\/|desktop-tauri|test-results|screenshots|docs\//.test(r)) continue;
            const s = fs.statSync(p).size;
            if (s > 300 * 1024) ctx.trouver({ gravite: 'basse', id: 'PERF-IMAGE-LOURDE', categorie: 'performance', titre: `${r} : ${ctx.kb(s)} Ko`, fichier: r, correctif: 'WebP/AVIF ou redimensionner.', effort: 'S' });
        }
        // captures du README
        let poidsCaptures = 0; try { poidsCaptures = fs.readdirSync(ctx.abs('assets', 'screenshots')).reduce((s, f) => s + fs.statSync(ctx.abs('assets', 'screenshots', f)).size, 0); } catch (e) { /* aucun */ }
        ctx.mesure('captures_ko', ctx.kb(poidsCaptures));
        // compression côté serveur
        const app = ctx.lire(ctx.abs('server', 'app.js'));
        if (!/express\.static\([^)]*(maxAge|etag|immutable)/.test(app.replace(/\n/g, ' '))) ctx.trouver({ gravite: 'basse', id: 'PERF-STATIC-CACHE', categorie: 'performance', titre: 'express.static sans en-têtes de cache explicites visibles', fichier: 'server/app.js', correctif: 'Cache long + fingerprint pour polices/vendor ; no-cache pour HTML/JS applicatif (déjà décidé : piège cache JS 7 j).', effort: 'S' });
    },
};
