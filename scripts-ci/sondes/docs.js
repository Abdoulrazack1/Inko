// docs — dérive documentaire : liens, variables d'environnement, chiffres périmés, captures
'use strict';
const fs = require('fs');
const path = require('path');
module.exports = {
    nom: 'docs',
    description: 'Liens relatifs cassés, variables d\'env non documentées, chiffres du README, captures référencées',
    async run(ctx) {
        const mds = [...ctx.parcourir(ctx.racine, ctx.ext('.md'))].filter(p => !/node_modules|promo|android|desktop-tauri\/(node|src-tauri)|extensions-community\/.*\/|docs\/audit\//.test(ctx.rel(p)));
        ctx.mesure('documents_md', mds.length);
        let cassés = 0;
        for (const p of mds) {
            const t = ctx.lire(p), r = ctx.rel(p), dir = path.dirname(p);
            ctx.chercher(t, /\]\((?!https?:|#|mailto:|data:)([^)\s]+)\)/, (m, l) => {
                const cible = decodeURIComponent(m[1].split('#')[0].split('?')[0]);
                if (!cible) return;
                if (!fs.existsSync(path.resolve(dir, cible))) { cassés++; ctx.trouver({ gravite: /README/.test(r) ? 'moyenne' : 'basse', id: 'DOC-LIEN-CASSE', categorie: 'docs', titre: `Lien cassé : ${m[1]}`, fichier: r, ligne: l, correctif: 'Corriger le chemin ou retirer le lien.', effort: 'S' }); }
            });
            ctx.chercher(t, /(?:src=["']|!\[[^\]]*\]\()(?!https?:|data:)([^"')\s]+\.(?:png|jpe?g|svg|gif|webp))/, (m, l) => { if (!fs.existsSync(path.resolve(dir, m[1]))) { cassés++; ctx.trouver({ gravite: 'moyenne', id: 'DOC-IMAGE-ABSENTE', categorie: 'docs', titre: `Image référencée introuvable : ${m[1]}`, fichier: r, ligne: l, effort: 'S' }); } });
        }
        ctx.mesure('liens_casses', cassés);
        // variables d'environnement lues par le serveur vs documentées
        const lues = new Set();
        for (const p of ctx.parcourir(ctx.abs('server'), ctx.ext('.js'))) { if (/node_modules|server\/test/.test(ctx.rel(p))) continue; for (const m of ctx.lire(p).matchAll(/process\.env\.([A-Z][A-Z0-9_]+)/g)) lues.add(m[1]); }
        const doc = ctx.lire(ctx.abs('server', '.env.example')) + ctx.lire(ctx.abs('README.md')) + ctx.lire(ctx.abs('docker-compose.yml')) + [...ctx.parcourir(ctx.abs('docs'), ctx.ext('.md'))].map(p => ctx.lire(p)).join('\n');
        const bruit = new Set(['NODE_ENV', 'APPDATA', 'HOME', 'USERPROFILE', 'PATH', 'DEBUG', 'NO_DEPRECATION', 'TRACE_DEPRECATION', 'NO_PROXY', 'no_proxy', 'LOCALAPPDATA', 'TEMP', 'TMP']);
        const nondoc = [...lues].filter(v => !bruit.has(v) && !doc.includes(v));
        ctx.mesure('env_lues', lues.size); ctx.mesure('env_non_documentees', nondoc);
        if (nondoc.length) ctx.trouver({ gravite: 'basse', id: 'DOC-ENV-NON-DOCUMENTEES', categorie: 'docs', titre: `${nondoc.length} variable(s) d'environnement lue(s) mais documentée(s) nulle part`, detail: nondoc.join(', '), correctif: 'Tableau dans le README + server/.env.example (nom, défaut, effet).', effort: 'S' });
        // chiffres du README vs réalité
        const readme = ctx.lire(ctx.abs('README.md'));
        const routes = (ctx.lire(ctx.abs('server/routes/index.js')).match(/router\.(get|post|put|delete|patch)\s*\(/g) || []).length;
        const dit = [...readme.matchAll(/(\d{2,4})\s+(routes|tests|migrations|pages|extensions|sources)/gi)].map(m => [m[0], +m[1], m[2].toLowerCase()]);
        const reel = { routes, pages: [...ctx.parcourir(ctx.racine, ctx.ext('.html'))].filter(p => ctx.rel(p).split('/').length === 1).length };
        for (const [txt, n, k] of dit) if (reel[k] && Math.abs(reel[k] - n) > Math.max(3, n * 0.08)) ctx.trouver({ gravite: 'basse', id: 'DOC-CHIFFRE-PERIME', categorie: 'docs', titre: `README annonce « ${txt} », le code en compte ${reel[k]}`, fichier: 'README.md', correctif: 'Générer ces chiffres (gen-meta) plutôt que les écrire.', effort: 'S' });
        // captures : anciennes vs nouvelles
        const shots = fs.existsSync(ctx.abs('assets/screenshots')) ? fs.readdirSync(ctx.abs('assets/screenshots')) : [];
        const refsReadme = [...readme.matchAll(/assets\/screenshots\/([\w.-]+)/g)].map(m => m[1]);
        const inutilises = shots.filter(f => !refsReadme.includes(f));
        ctx.mesure('captures', { presentes: shots.length, referencees: new Set(refsReadme).size });
        if (inutilises.length) ctx.trouver({ gravite: 'basse', id: 'DOC-CAPTURES-ORPHELINES', categorie: 'docs', titre: `${inutilises.length} capture(s) non référencée(s) par le README`, detail: inutilises.join(', '), effort: 'S' });
        // documents obligatoires
        for (const f of ['LICENSE', 'SECURITY.md', 'CONTRIBUTING.md', 'CHANGELOG.md', 'NOTICE.md']) if (!fs.existsSync(ctx.abs(f))) ctx.trouver({ gravite: 'basse', id: 'DOC-MANQUANT', categorie: 'docs', titre: `${f} absent`, effort: 'S' });
        for (const f of ['CODE_OF_CONDUCT.md', '.github/ISSUE_TEMPLATE', '.github/PULL_REQUEST_TEMPLATE.md']) if (!fs.existsSync(ctx.abs(f))) ctx.trouver({ gravite: 'basse', id: 'DOC-COMMUNAUTE', categorie: 'docs', titre: `${f} absent (gabarit communautaire)`, correctif: 'Utile dès que des contributeurs d\'extensions arrivent.', effort: 'S' });
        // changelog à jour ?
        const pkg = JSON.parse(ctx.lire(ctx.abs('package.json')));
        if (!new RegExp(`\\[?${pkg.version.replace(/\./g, '\\.')}\\]?`).test(ctx.lire(ctx.abs('CHANGELOG.md')))) ctx.trouver({ gravite: 'moyenne', id: 'DOC-CHANGELOG-RETARD', categorie: 'docs', titre: `CHANGELOG sans entrée pour ${pkg.version}`, fichier: 'CHANGELOG.md', effort: 'S' });
        // README en français seulement
        ctx.trouver({ gravite: 'info', id: 'DOC-LANGUE', categorie: 'docs', titre: 'README uniquement en français', correctif: 'Une version EN (README.en.md) ouvre le projet aux contributeurs d\'extensions internationaux.', effort: 'M' });
    },
};
