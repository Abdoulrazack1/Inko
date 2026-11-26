// i18n — couverture de traduction, chaînes en dur (réutilise check-i18n.js)
'use strict';
const cp = require('child_process');
module.exports = {
    nom: 'i18n',
    description: 'Couverture EN, chaînes françaises en dur dans le JS, clés orphelines',
    async run(ctx) {
        const r = cp.spawnSync(process.execPath, [ctx.abs('scripts-ci', 'check-i18n.js')], { cwd: ctx.racine, encoding: 'utf8', timeout: 60000 });
        const sortie = (r.stdout || '') + (r.stderr || '');
        const cov = /(\d+(?:[.,]\d+)?)\s*%/.exec(sortie);
        ctx.mesure('check_i18n_code_sortie', r.status);
        if (cov) ctx.mesure('couverture_i18n_pct', cov[1]);
        if (r.status !== 0) ctx.trouver({ gravite: 'moyenne', id: 'I18N-CHECK-ROUGE', categorie: 'i18n', titre: 'check-i18n échoue', detail: sortie.split('\n').slice(0, 25).join('\n'), correctif: 'Traduire les chaînes listées dans assets/i18n/en.json.', effort: 'M' });
        // dictionnaire : valeurs vides ou identiques à la clé
        let en = {};
        try { en = JSON.parse(ctx.lire(ctx.abs('assets', 'i18n', 'en.json'))).strings || {}; } catch (e) { ctx.trouver({ gravite: 'haute', id: 'I18N-JSON', titre: 'en.json illisible', effort: 'S' }); }
        const vides = Object.entries(en).filter(([k, v]) => !String(v).trim());
        const identiques = Object.entries(en).filter(([k, v]) => k === v && /[a-zé]{4,}/i.test(k));
        ctx.mesure('i18n_entrees', Object.keys(en).length);
        if (vides.length) ctx.trouver({ gravite: 'moyenne', id: 'I18N-VIDES', categorie: 'i18n', titre: `${vides.length} traduction(s) vide(s)`, detail: vides.slice(0, 20).map(x => x[0]).join('\n'), effort: 'S' });
        if (identiques.length > 5) ctx.trouver({ gravite: 'basse', id: 'I18N-IDENTIQUES', categorie: 'i18n', titre: `${identiques.length} entrée(s) dont la traduction est identique au français`, detail: identiques.slice(0, 20).map(x => x[0]).join('\n'), effort: 'S' });
        // clés orphelines : chaîne du dictionnaire absente de tout le front
        const corpus = [...ctx.parcourir(ctx.racine, (p) => /\.(html|js)$/.test(p))].filter(p => !/node_modules|server\/|android|mobile\/|desktop-tauri|promo|test|vendor|docs\//.test(ctx.rel(p))).map(p => ctx.lire(p)).join('\n');
        const orph = Object.keys(en).filter(k => k.length > 3 && !corpus.includes(k.slice(0, 40)));
        ctx.mesure('i18n_cles_orphelines', orph.length);
        if (orph.length > 10) ctx.trouver({ gravite: 'basse', id: 'I18N-ORPHELINES', categorie: 'code mort', titre: `${orph.length} clé(s) de traduction dont le texte français n'apparaît plus dans l'UI`, detail: orph.slice(0, 25).join('\n'), correctif: 'Reformulation côté FR sans mise à jour du dictionnaire : la traduction est morte en silence.', effort: 'S' });
        // une seule langue
        ctx.trouver({ gravite: 'info', id: 'I18N-LANGUES', categorie: 'produit', titre: 'Deux langues seulement (FR source, EN)', detail: 'Le mécanisme « correspondance exacte du texte français » interdit de fait une troisième langue sans refonte (clés stables).', correctif: 'Passer à des clés stables (ex. bibliotheque.titre) avant d\'ajouter ES/PT/AR (lecteurs de manga).', effort: 'XL' });
    },
};
