// code-mort — fichiers et fonctions que personne n'appelle
'use strict';
const path = require('path');
module.exports = {
    nom: 'code-mort',
    description: 'Fichiers JS non référencés, fonctions globales jamais appelées, modules serveur orphelins',
    async run(ctx) {
        const jsDir = ctx.abs('assets', 'js');
        const js = [...ctx.parcourir(jsDir, ctx.ext('.js'))];
        const refs = [...ctx.parcourir(ctx.racine, (p) => /\.(html|js|json|gradle|rs|toml)$/.test(p))]
            .filter(p => !/node_modules|promo|test-results|\.min\./.test(ctx.rel(p)) && !/^assets\/js\//.test(ctx.rel(p)) || /^assets\/js\/(hub|global|natif|prechauffe)\.js$/.test(ctx.rel(p)));
        const corpus = refs.map(p => ctx.lire(p)).join('\n');
        const orph = [];
        for (const p of js) {
            const nom = path.basename(p);
            if (!corpus.includes(nom)) orph.push(ctx.rel(p));
        }
        ctx.mesure('js_non_references', orph);
        for (const f of orph) ctx.trouver({ gravite: 'basse', id: 'MORT-JS-ORPHELIN', categorie: 'code mort', titre: `${f} n'est référencé par aucune page, aucun build, aucun test`, fichier: f, correctif: 'Supprimer, ou documenter pourquoi il est chargé dynamiquement.', effort: 'S' });

        // fonctions de niveau supérieur dans les IIFE exposées sur MH.* et jamais lues
        const tous = js.map(p => ctx.lire(p)).join('\n');
        const expose = new Map();
        for (const p of js) { const t = ctx.lire(p); ctx.chercher(t, /\bMH\.(\w+)\s*=\s*(?:async\s*)?(?:function|\(|\w+\s*=>)/, (m, l) => { if (!expose.has(m[1])) expose.set(m[1], `${ctx.rel(p)}:${l}`); }); }
        const inutiles = [];
        for (const [nom, ou] of expose) {
            const n = (tous.match(new RegExp(`\\bMH\\.${nom}\\b`, 'g')) || []).length + (tous.match(new RegExp(`\\{[^}]*\\b${nom}\\b[^}]*\\}\\s*=\\s*(?:window\\.)?MH\\b`, 'g')) || []).length;
            const html = [...ctx.parcourir(ctx.racine, ctx.ext('.html'))].some(p => ctx.rel(p).split('/').length === 1 && ctx.lire(p).includes(`MH.${nom}`));
            if (n <= 1 && !html && !new RegExp(`MH\\[['"\`]${nom}`).test(tous)) inutiles.push([nom, ou]);
        }
        ctx.mesure('mh_exposes', expose.size); ctx.mesure('mh_exposes_jamais_lus', inutiles.length);
        if (inutiles.length) ctx.trouver({ gravite: 'basse', id: 'MORT-MH-INUTILISE', categorie: 'code mort', titre: `${inutiles.length} fonction(s) exposée(s) sur MH jamais appelée(s) ailleurs`, detail: inutiles.slice(0, 40).map(([n, o]) => `MH.${n}  (${o})`).join('\n'), correctif: 'Retirer de l\'API publique interne ; garder si utilisée par les extensions embarquées (vérifier le bac à sable).', effort: 'S' });

        // modules serveur jamais requis
        const lib = [...ctx.parcourir(ctx.abs('server'), ctx.ext('.js'))].filter(p => !/node_modules|server\/test|backups|uploads|server\/extensions|scripts\//.test(ctx.rel(p)));
        const serveurTexte = [...ctx.parcourir(ctx.abs('server'), ctx.ext('.js'))].filter(p => !/node_modules/.test(p)).map(p => ctx.lire(p)).join('\n') + ctx.lire(ctx.abs('package.json'));
        const modOrph = [];
        for (const p of lib) {
            const b = path.basename(p, '.js');
            if (['server', 'app', 'index', 'loader'].includes(b)) continue;
            const re = new RegExp(`require\\([^)]*${b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]\\)`);
            const autres = [...ctx.parcourir(ctx.abs('server'), ctx.ext('.js'))].filter(q => q !== p && !/node_modules/.test(q)).some(q => re.test(ctx.lire(q)));
            if (!autres && !re.test(ctx.lire(ctx.abs('scripts-ci', 'run-unit-tests.js')))) modOrph.push(ctx.rel(p));
        }
        for (const f of modOrph) ctx.trouver({ gravite: 'basse', id: 'MORT-SERVEUR-ORPHELIN', categorie: 'code mort', titre: `${f} n'est requis par aucun autre module serveur`, fichier: f, correctif: 'Vérifier appel dynamique (require(variable)) ou script manuel ; sinon supprimer.', effort: 'S' });

        // fichiers à la racine qui ressemblent à du résidu
        for (const f of ['pivot-ltr.png', 'pivot-rtl.png', 'signet-biblio.png', 'RELEASE_TITLE.txt', 'RELEASE_NOTES.md', 'audit.md', 'reponse-lilian.md', 'test-results'])
            try { require('fs').statSync(ctx.abs(f)); ctx.trouver({ gravite: 'basse', id: 'MORT-RESIDU-RACINE', categorie: 'hygiène', titre: `Résidu à la racine du dépôt : ${f}`, fichier: f, correctif: 'Déplacer sous docs/ ou assets/, ou .gitignore.', effort: 'S' }); } catch (e) { /* absent */ }
        // dossiers de documentation d'audit successifs
        const audits = require('fs').readdirSync(ctx.racine).filter(f => /^AUDIT|^audit/.test(f));
        if (audits.length > 2) ctx.trouver({ gravite: 'basse', id: 'MORT-AUDITS-EMPILES', categorie: 'hygiène', titre: `${audits.length} documents d'audit à la racine (${audits.join(', ')})`, correctif: 'Un seul document vivant (celui-ci) ; archiver les précédents sous docs/audit/archives/.', effort: 'S' });
    },
};
