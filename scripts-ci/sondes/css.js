// css — dette de style : couleurs en dur, !important, z-index, unités, doublons, poids
'use strict';
module.exports = {
    nom: 'css',
    description: 'Couleurs littérales, !important, z-index, tailles en px, sélecteurs morts, poids par feuille',
    async run(ctx) {
        const feuilles = [...ctx.parcourir(ctx.abs('assets', 'css'), ctx.ext('.css'))];
        const bilan = { octets: 0, regles: 0, important: 0, couleursLitterales: 0, zindex: [], pxFont: 0, vh100: 0 };
        const tokens = new Set();
        const global = ctx.lire(ctx.abs('assets', 'css', 'global.css'));
        for (const m of global.matchAll(/(--[\w-]+)\s*:/g)) tokens.add(m[1]);
        ctx.mesure('variables_css_definies', tokens.size);
        const utilisees = new Set();
        const toutHtml = [...ctx.parcourir(ctx.racine, ctx.ext('.html'))].filter(p => ctx.rel(p).split('/').length === 1).map(p => ctx.lire(p)).join('\n');
        const toutJs = [...ctx.parcourir(ctx.abs('assets', 'js'), ctx.ext('.js'))].filter(p => !/vendor|\.min\./.test(p)).map(p => ctx.lire(p)).join('\n');
        const tousCss = feuilles.map(p => ctx.lire(p)).join('\n');
        for (const m of tousCss.matchAll(/var\((--[\w-]+)/g)) utilisees.add(m[1]);
        const parFeuille = [];
        for (const p of feuilles) {
            const t = ctx.lire(p), r = ctx.rel(p);
            const sansComm = t.replace(/\/\*[\s\S]*?\*\//g, '');
            const n = (re) => (sansComm.match(re) || []).length;
            const imp = n(/!important/g);
            const col = n(/#[0-9a-fA-F]{3,8}\b|rgba?\(\s*\d/g);
            bilan.octets += t.length; bilan.important += imp; bilan.couleursLitterales += col;
            bilan.regles += n(/\{/g);
            parFeuille.push([r, Math.round(t.length / 1024), imp, col]);
            for (const m of sansComm.matchAll(/z-index\s*:\s*(-?\d+)/g)) bilan.zindex.push(+m[1]);
            ctx.chercher(sansComm, /font-size\s*:\s*(\d+(?:\.\d+)?)px/, () => bilan.pxFont++);
            ctx.chercher(sansComm, /(?<![-\w])(?:height|min-height)\s*:\s*100vh\b/, (m, l) => { bilan.vh100++; });
            if (imp > 25) ctx.trouver({ gravite: 'moyenne', id: 'CSS-IMPORTANT', categorie: 'maintenabilité', titre: `${imp} !important dans ${r}`, fichier: r, correctif: 'Réduire la spécificité en amont ; chaque !important impose le suivant.', effort: 'M' });
            if (t.length > 60 * 1024) ctx.trouver({ gravite: 'moyenne', id: 'CSS-LOURDE', categorie: 'performance', titre: `${r} pèse ${Math.round(t.length / 1024)} Ko (feuille bloquante au rendu)`, fichier: r, correctif: 'Scinder : critique en tête, reste en chargement différé ; retirer les règles mortes.', effort: 'M' });
        }
        ctx.mesure('css_bilan', { ...bilan, zindex: undefined, zindexMax: Math.max(0, ...bilan.zindex), zindexDistincts: new Set(bilan.zindex).size });
        ctx.mesure('css_par_feuille_ko_imp_couleurs', parFeuille.sort((a, b) => b[1] - a[1]));
        if (bilan.couleursLitterales > 400) ctx.trouver({ gravite: 'basse', id: 'CSS-COULEURS-LITTERALES', categorie: 'cohérence', titre: `${bilan.couleursLitterales} couleurs littérales hors variables (dont les feuilles de thème sombre/clair)`, correctif: 'Tout passer par des variables ; chaque littéral est un endroit où le thème clair/sombre/contraste peut diverger.', effort: 'L' });
        const zd = new Set(bilan.zindex).size;
        if (zd > 18 || Math.max(0, ...bilan.zindex) > 9999) ctx.trouver({ gravite: 'basse', id: 'CSS-ZINDEX', categorie: 'maintenabilité', titre: `Échelle z-index sans règle : ${zd} valeurs distinctes, max ${Math.max(0, ...bilan.zindex)}`, correctif: 'Échelle de variables (--z-nav, --z-modale, --z-toast…) ; le violet « par-dessus le bouton » vient de ce genre d\'empilement.', effort: 'M' });
        if (bilan.vh100) ctx.trouver({ gravite: 'moyenne', id: 'CSS-100VH', categorie: 'mobile', titre: `${bilan.vh100} usage(s) de height:100vh : la barre d'adresse mobile rogne la page`, correctif: '100dvh avec repli 100vh (Android 8 ignore dvh : @supports).', effort: 'S' });
        if (bilan.pxFont > 120) ctx.trouver({ gravite: 'basse', id: 'CSS-FONT-PX', categorie: 'accessibilité', titre: `${bilan.pxFont} font-size en px : ignore le réglage de taille de texte du système`, correctif: 'rem/em ou l\'échelle typographique existante.', effort: 'M' });

        // variables définies et jamais utilisées / utilisées et jamais définies
        const jamaisDefinies = [...utilisees].filter(v => !tokens.has(v) && !new RegExp(`${v}\\s*:`).test(tousCss) && !new RegExp(`['"\`]${v}['"\`]|setProperty\\(\\s*['"]${v}`).test(toutJs));
        if (jamaisDefinies.length) ctx.trouver({ gravite: 'moyenne', id: 'CSS-VAR-INDEFINIE', categorie: 'bug', titre: `${jamaisDefinies.length} variable(s) CSS utilisée(s) mais jamais définie(s)`, detail: jamaisDefinies.slice(0, 30).join(', '), correctif: 'var(--x) sans définition retombe sur la valeur initiale : le style disparaît sans erreur.', effort: 'S' });
        const mortes = [...tokens].filter(v => !utilisees.has(v) && !toutJs.includes(v) && !toutHtml.includes(v));
        if (mortes.length > 8) ctx.trouver({ gravite: 'basse', id: 'CSS-VAR-MORTE', categorie: 'code mort', titre: `${mortes.length} variable(s) CSS définie(s) jamais utilisée(s)`, detail: mortes.slice(0, 40).join(', '), effort: 'S' });

        // classes déclarées et introuvables ailleurs (candidats)
        const classesCss = new Map();
        for (const p of feuilles) { const t = ctx.lire(p).replace(/\/\*[\s\S]*?\*\//g, ''); for (const m of t.matchAll(/\.([a-zA-Z_][\w-]{2,})/g)) { if (!classesCss.has(m[1])) classesCss.set(m[1], ctx.rel(p)); } }
        const corpus = toutHtml + '\n' + toutJs + '\n' + [...ctx.parcourir(ctx.abs('assets', 'js'), ctx.ext('.html'))].map(p => ctx.lire(p)).join('\n');
        const mortesCls = [];
        for (const [c, f] of classesCss) {
            if (/^(is|has|js|no|mh|inko)-/.test(c) && false) continue;
            if (/\d$|^(a|b|c|d|e|f)\d?$/.test(c)) continue;
            if (!corpus.includes(c)) mortesCls.push([c, f]);
        }
        ctx.mesure('classes_css_declarees', classesCss.size);
        ctx.mesure('classes_css_sans_usage_visible', mortesCls.length);
        const parF = {}; mortesCls.forEach(([c, f]) => (parF[f] = parF[f] || []).push(c));
        for (const [f, l] of Object.entries(parF)) if (l.length >= 10) ctx.trouver({ gravite: 'basse', id: 'CSS-CLASSES-MORTES', categorie: 'code mort', titre: `${l.length} classe(s) de ${f} jamais référencée(s) (HTML/JS)`, fichier: f, detail: l.slice(0, 40).map(c => '.' + c).join(' ') + (l.length > 40 ? ' …' : ''), correctif: 'Vérifier les classes composées dynamiquement (préfixe + variable) avant de supprimer.', effort: 'S' });
        // thème : feuilles sans bloc de thème clair
        const global2 = tousCss;
        if (!/\[data-theme=["']?light|prefers-color-scheme:\s*light|\.light\b|data-theme="light"/.test(global2)) ctx.trouver({ gravite: 'haute', id: 'CSS-THEME-CLAIR', categorie: 'fonctionnalité', titre: 'Aucun thème clair détecté dans les feuilles', correctif: 'Le résumé précédent notait « theme light » en suspens : à vérifier.', effort: 'L' });
        // Android 8 : propriétés sans repli (le garde-fou officiel existe ; on compte juste)
        const nbGap = (tousCss.match(/\bgap\s*:/g) || []).length, nbAspect = (tousCss.match(/aspect-ratio\s*:/g) || []).length, nbInset = (tousCss.match(/(?<![-\w])inset\s*:/g) || []).length, nbIs = (tousCss.match(/:is\(|:where\(|:has\(/g) || []).length;
        ctx.mesure('css_recents', { gap: nbGap, aspectRatio: nbAspect, inset: nbInset, isWhereHas: nbIs });
        if (nbIs) ctx.trouver({ gravite: 'moyenne', id: 'CSS-SELECTEURS-RECENTS', categorie: 'mobile', titre: `${nbIs} sélecteur(s) :is()/:where()/:has() : ignorés par le WebView Android 8 (Chrome 61)`, correctif: 'La règle entière est jetée par un navigateur qui ne connaît pas un sélecteur de la liste ; dupliquer sans :is().', effort: 'S' });
    },
};
