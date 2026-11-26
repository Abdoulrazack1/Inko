// a11y-html — accessibilité statique des 26 pages (la dynamique est dans « pages »)
'use strict';
module.exports = {
    nom: 'a11y-html',
    description: 'Images sans alt, boutons sans nom, champs sans label, titres, lang, tabindex, clics sur éléments non interactifs',
    async run(ctx) {
        const pages = [...ctx.parcourir(ctx.racine, ctx.ext('.html'))].filter(p => ctx.rel(p).split('/').length === 1);
        const js = [...ctx.parcourir(ctx.abs('assets', 'js'), ctx.ext('.js'))].filter(p => !/vendor|\.min\./.test(p));
        ctx.mesure('pages_html', pages.length);
        let sansAlt = 0, btnMuets = 0, champsSansLabel = 0;
        for (const p of pages) {
            const t = ctx.lire(p), r = ctx.rel(p);
            if (!/<html[^>]*\blang=/.test(t)) ctx.trouver({ gravite: 'moyenne', id: 'A11Y-LANG', categorie: 'accessibilité', titre: 'Pas d\'attribut lang sur <html>', fichier: r, correctif: '<html lang="fr">', effort: 'S' });
            if (!/<meta[^>]*name=["']viewport/.test(t)) ctx.trouver({ gravite: 'haute', id: 'A11Y-VIEWPORT', categorie: 'mobile', titre: 'Pas de meta viewport', fichier: r, effort: 'S' });
            if (!/<title>[^<]+<\/title>/.test(t)) ctx.trouver({ gravite: 'moyenne', id: 'A11Y-TITRE', categorie: 'accessibilité', titre: '<title> absent ou vide', fichier: r, effort: 'S' });
            if (!/<h1\b/.test(t)) ctx.trouver({ gravite: 'basse', id: 'A11Y-H1', categorie: 'accessibilité', titre: 'Aucun <h1> dans le HTML statique (peut être rendu en JS)', fichier: r, correctif: 'Un h1 (même visuellement masqué) donne le repère de page aux lecteurs d\'écran.', effort: 'S' });
            if (!/<main\b|role=["']main/.test(t)) ctx.trouver({ gravite: 'basse', id: 'A11Y-MAIN', categorie: 'accessibilité', titre: 'Pas de landmark <main>', fichier: r, effort: 'S' });
            ctx.chercher(t, /<img\b(?![^>]*\balt=)[^>]*>/, (m, l) => { sansAlt++; ctx.trouver({ gravite: 'moyenne', id: 'A11Y-IMG-ALT', categorie: 'accessibilité', titre: '<img> sans alt', fichier: r, ligne: l, detail: m[0].slice(0, 120), correctif: 'alt="" si décorative, sinon texte.', effort: 'S' }); });
            ctx.chercher(t, /<button\b([^>]*)>\s*(<(?:svg|i|span)[^>]*>[\s\S]{0,300}?<\/(?:svg|i|span)>\s*)?<\/button>/, (m, l) => {
                if (!/aria-label|aria-labelledby|title=/.test(m[1])) { btnMuets++; ctx.trouver({ gravite: 'moyenne', id: 'A11Y-BOUTON-MUET', categorie: 'accessibilité', titre: 'Bouton à icône sans nom accessible', fichier: r, ligne: l, detail: m[0].replace(/\s+/g, ' ').slice(0, 140), correctif: 'aria-label="…"', effort: 'S' }); }
            });
            ctx.chercher(t, /<(input|select|textarea)\b([^>]*)>/, (m, l) => {
                const a = m[2];
                if (/type=["'](hidden|submit|button|reset|checkbox-ignored)["']/.test(a)) return;
                const id = (/\bid=["']([^"']+)["']/.exec(a) || [])[1];
                const lie = id && new RegExp(`for=["']${id}["']`).test(t);
                if (!lie && !/aria-label|aria-labelledby|title=|placeholder=/.test(a) && !new RegExp(`<label[^>]*>[^<]*<${m[1]}[^>]*${id ? 'id=["\']' + id : '@@'}`).test(t)) { champsSansLabel++; ctx.trouver({ gravite: 'moyenne', id: 'A11Y-CHAMP-SANS-LABEL', categorie: 'accessibilité', titre: `<${m[1]}> sans label`, fichier: r, ligne: l, detail: m[0].slice(0, 120), effort: 'S' }); }
            });
            ctx.chercher(t, /tabindex=["']([1-9])\d*["']/, (m, l) => ctx.trouver({ gravite: 'basse', id: 'A11Y-TABINDEX-POSITIF', categorie: 'accessibilité', titre: 'tabindex positif : casse l\'ordre naturel de tabulation', fichier: r, ligne: l, effort: 'S' }));
            ctx.chercher(t, /<(div|span|li|p)\b[^>]*\bonclick=/, (m, l) => { if (!/role=|tabindex/.test(m[0])) ctx.trouver({ gravite: 'moyenne', id: 'A11Y-CLIC-NON-INTERACTIF', categorie: 'accessibilité', titre: `<${m[1]} onclick> sans rôle ni tabindex : inatteignable au clavier`, fichier: r, ligne: l, effort: 'S' }); });
            // saut de titres
            const niveaux = [...t.matchAll(/<h([1-6])\b/g)].map(x => +x[1]);
            for (let i = 1; i < niveaux.length; i++) if (niveaux[i] - niveaux[i - 1] > 1) { ctx.trouver({ gravite: 'basse', id: 'A11Y-SAUT-TITRE', categorie: 'accessibilité', titre: `Saut de titre h${niveaux[i - 1]} → h${niveaux[i]}`, fichier: r, effort: 'S' }); break; }
            if (!/skip|aller au contenu|contenu principal/i.test(t)) ctx.trouver({ gravite: 'basse', id: 'A11Y-LIEN-EVITEMENT', categorie: 'accessibilité', titre: 'Pas de lien d\'évitement (« Aller au contenu »)', fichier: r, correctif: 'Premier élément focusable : <a class="skip" href="#main">.', effort: 'S' });
        }
        // JS : éléments cliquables fabriqués sans rôle/clavier
        let divClic = 0; const liste = [];
        for (const p of js) {
            const t = ctx.lire(p), r = ctx.rel(p);
            ctx.chercher(t, /createElement\(['"](div|span)['"]\)[\s\S]{0,300}?addEventListener\(\s*['"]click['"]/, (m, l) => {
                if (!/role|tabindex|button/.test(m[0])) { divClic++; liste.push(`${r}:${l}`); }
            });
            ctx.chercher(t, /<(div|span)\b[^>]*\bclass=["'][^"']*(?:btn|button|clickable|cliquable)[^"']*["'][^>]*>/, (m, l) => { if (!/role=|tabindex/.test(m[0])) { divClic++; liste.push(`${r}:${l}`); } });
        }
        ctx.mesure('a11y_img_sans_alt', sansAlt); ctx.mesure('a11y_boutons_muets', btnMuets); ctx.mesure('a11y_champs_sans_label', champsSansLabel); ctx.mesure('a11y_div_cliquables_js', divClic);
        if (divClic) ctx.trouver({ gravite: 'moyenne', id: 'A11Y-DIV-CLIQUABLE-JS', categorie: 'accessibilité', titre: `${divClic} élément(s) div/span cliquable(s) créés en JS sans rôle ni tabindex`, detail: liste.slice(0, 25).join('\n'), correctif: 'Utiliser <button>, ou role="button" + tabindex="0" + gestion Entrée/Espace.', effort: 'M' });
        // focus visible
        const css = [...ctx.parcourir(ctx.abs('assets', 'css'), ctx.ext('.css'))].map(p => ctx.lire(p)).join('\n');
        const nbOutlineNone = (css.match(/outline\s*:\s*(none|0)\b/g) || []).length;
        const nbFocusVisible = (css.match(/:focus-visible/g) || []).length;
        ctx.mesure('css_outline_none', nbOutlineNone); ctx.mesure('css_focus_visible', nbFocusVisible);
        if (nbOutlineNone > nbFocusVisible) ctx.trouver({ gravite: 'moyenne', id: 'A11Y-FOCUS-SUPPRIME', categorie: 'accessibilité', titre: `${nbOutlineNone} « outline: none » pour ${nbFocusVisible} :focus-visible`, correctif: 'Chaque outline:none doit avoir son remplaçant :focus-visible.', effort: 'M' });
        if (!/prefers-reduced-motion/.test(css)) ctx.trouver({ gravite: 'moyenne', id: 'A11Y-REDUCED-MOTION', categorie: 'accessibilité', titre: 'Aucun @media (prefers-reduced-motion)', correctif: 'Couper animations/parallax/GSAP/Three pour ces utilisateurs.', effort: 'S' });
        const nbReduced = (css.match(/prefers-reduced-motion/g) || []).length;
        const jsAll = js.map(p => ctx.lire(p)).join('\n');
        const anim = (css.match(/@keyframes/g) || []).length;
        ctx.mesure('keyframes', anim); ctx.mesure('reduced_motion_css', nbReduced); ctx.mesure('reduced_motion_js', (jsAll.match(/prefers-reduced-motion/g) || []).length);
    },
};
