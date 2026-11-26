// routes — surface HTTP : authentification, limiteurs, contrôleurs orphelins, écart OpenAPI
'use strict';
module.exports = {
    nom: 'routes',
    description: 'Routes mutantes sans auth, sans limiteur, handlers manquants/orphelins, dérive OpenAPI',
    async run(ctx) {
        const src = ctx.lire(ctx.abs('server', 'routes', 'index.js'));
        const RE = /router\.(get|post|put|delete|patch)\s*\(\s*'([^']+)'\s*,?\s*([\s\S]*?)\)\s*;/g;
        const routes = [];
        let m;
        while ((m = RE.exec(src))) {
            const [tout, methode, chemin, reste] = m;
            routes.push({
                methode: methode.toUpperCase(), chemin, ligne: ctx.ligneDe(src, m.index),
                auth: /adminRequired/.test(reste) ? 'admin' : /authRequired/.test(reste) ? 'session' : /authOptional/.test(reste) ? 'optionnelle' : /localOnly/.test(reste) ? 'local' : 'aucune',
                limiteur: (reste.match(/(\w*Limiter)/) || [])[1] || null,
                handler: (reste.match(/(\w+\.\w+)\s*$/) || [])[1] || (/=>/.test(reste) ? '(inline)' : '?'),
            });
        }
        ctx.mesure('routes_total', routes.length);
        const stat = { auth: {}, limiteur: 0, methodes: {} };
        routes.forEach(r => { stat.auth[r.auth] = (stat.auth[r.auth] || 0) + 1; if (r.limiteur) stat.limiteur++; stat.methodes[r.methode] = (stat.methodes[r.methode] || 0) + 1; });
        ctx.mesure('routes_stats', stat);

        // 1. mutation sans authentification
        const tolere = /^\/(auth\/(login|register|forgot|reset|logout|password-strength|google|local)|log\b|csp-report|vitals)/;
        for (const r of routes) {
            if (r.methode !== 'GET' && r.auth === 'aucune' && !tolere.test(r.chemin)) {
                ctx.trouver({ gravite: 'haute', id: 'RTE-MUTATION-OUVERTE', categorie: 'sécurité', titre: `${r.methode} ${r.chemin} modifie l'état sans authentification`,
                    fichier: 'server/routes/index.js', ligne: r.ligne, correctif: 'Ajouter auth.authRequired (ou documenter pourquoi la route est publique).', effort: 'S' });
            }
            if (r.methode !== 'GET' && !r.limiteur && !/auth\/(me|sessions)/.test(r.chemin) && r.auth !== 'aucune') {
                // beaucoup de routes écrivent sans limiteur dédié : on compte, on ne crie pas
                r._sansLimiteur = true;
            }
        }
        const sansLim = routes.filter(r => r._sansLimiteur);
        ctx.mesure('routes_ecriture_sans_limiteur', sansLim.length);
        if (sansLim.length) ctx.trouver({ gravite: 'basse', id: 'RTE-SANS-LIMITEUR', categorie: 'robustesse', titre: `${sansLim.length} route(s) d'écriture sans limiteur dédié`,
            detail: sansLim.map(r => `${r.methode} ${r.chemin}`).join('\n'),
            correctif: 'Vérifier que writeLimiter est bien appliqué globalement (app.js) ; sinon l\'ajouter par route.', effort: 'S' });
        // GET qui sortent vers Internet sans limiteur
        for (const r of routes) {
            if (r.methode === 'GET' && !r.limiteur && /(search|relay|proxy|img|anilist|artwork|chapter|pages|metadata|popular|latest)/i.test(r.chemin))
                ctx.trouver({ gravite: 'moyenne', id: 'RTE-SORTIE-SANS-LIMITEUR', categorie: 'robustesse', titre: `GET ${r.chemin} (sortie réseau probable) sans limiteur`, fichier: 'server/routes/index.js', ligne: r.ligne,
                    correctif: 'searchLimiter / relayLimiter selon le cas : chaque appel peut se transformer en N requêtes vers un site tiers.', effort: 'S' });
        }

        // 2. handlers inexistants / contrôleurs orphelins
        const importes = {};
        for (const [, nom, fichier] of src.matchAll(/const\s+(\w+)\s*=\s*require\('\.\.\/controllers\/([\w.-]+)'\)/g)) importes[nom] = fichier;
        const exportes = {};
        for (const [nom, f] of Object.entries(importes)) {
            const t = ctx.lire(ctx.abs('server', 'controllers', f + '.js'));
            const noms = new Set();
            for (const [, a] of t.matchAll(/exports\.(\w+)\s*=/g)) noms.add(a);
            const debut = t.search(/module\.exports\s*=\s*\{/);
            if (debut >= 0) {
                // corps jusqu'à l'accolade fermante appariée, commentaires retirés
                let i = t.indexOf('{', debut), niv = 0, j = i;
                for (; j < t.length; j++) { if (t[j] === '{') niv++; else if (t[j] === '}' && --niv === 0) break; }
                const corps = t.slice(i + 1, j).replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
                // niveau 0 seulement : on ignore le contenu d'éventuelles sous-accolades
                let n0 = '', d = 0;
                for (const ch of corps) { if (ch === '{') d++; else if (ch === '}') d--; else if (d === 0) n0 += ch; }
                for (const [, a] of n0.matchAll(/(?:^|[,\s])([A-Za-z_$][\w$]*)\s*(?=[,:]|\s*$)/gm)) noms.add(a);
            }
            exportes[nom] = noms;
        }
        const utilises = {};
        for (const r of routes) {
            const mm = /^(\w+)\.(\w+)$/.exec(r.handler);
            if (!mm) continue;
            (utilises[mm[1]] = utilises[mm[1]] || new Set()).add(mm[2]);
            if (exportes[mm[1]] && exportes[mm[1]].size && !exportes[mm[1]].has(mm[2]))
                ctx.trouver({ gravite: 'critique', id: 'RTE-HANDLER-ABSENT', categorie: 'bug', titre: `${r.methode} ${r.chemin} : ${r.handler} n'est pas exporté`, fichier: 'server/routes/index.js', ligne: r.ligne, correctif: 'Corriger le nom ou exporter la fonction (sinon Express lève au démarrage).', effort: 'S' });
        }
        for (const [nom, f] of Object.entries(importes)) {
            const t = ctx.lire(ctx.abs('server', 'controllers', f + '.js'));
            const dehors = [...exportes[nom]].filter(n => !(utilises[nom] && utilises[nom].has(n)) && !new RegExp(`${nom}\\.${n}\\b`).test(src));
            // un export peut servir à un autre module (tests, jobs) : on vérifie ailleurs
            const reels = dehors.filter(n => {
                for (const p of ctx.parcourir(ctx.abs('server'), ctx.ext('.js'))) { const r = ctx.rel(p); if (/node_modules|controllers\/|server\/test/.test(r) && !r.includes('/test/')) continue; if (new RegExp(`\\b${n}\\b`).test(ctx.lire(p)) && !r.endsWith(f + '.js')) return false; }
                return true;
            });
            if (reels.length) ctx.trouver({ gravite: 'basse', id: 'RTE-EXPORT-ORPHELIN', categorie: 'code mort', titre: `${f}.js exporte ${reels.length} fonction(s) jamais routée(s) ni importée(s)`, fichier: `server/controllers/${f}.js`, detail: reels.join(', '), correctif: 'Supprimer ou brancher.', effort: 'S' });
        }

        // 3. écart avec OpenAPI publié
        try {
            const oa = JSON.parse(ctx.lire(ctx.abs('server', 'openapi.json')));
            const dansOa = new Set();
            for (const [p, ops] of Object.entries(oa.paths || {})) for (const k of Object.keys(ops)) dansOa.add(k.toUpperCase() + ' ' + p.replace(/\{(\w+)\}/g, ':$1'));
            const manquantes = routes.filter(r => !dansOa.has(r.methode + ' ' + r.chemin));
            ctx.mesure('openapi_chemins', Object.keys(oa.paths || {}).length);
            if (manquantes.length) ctx.trouver({ gravite: 'basse', id: 'RTE-OPENAPI-DERIVE', categorie: 'docs', titre: `${manquantes.length} route(s) absente(s) de openapi.json`, detail: manquantes.slice(0, 20).map(r => `${r.methode} ${r.chemin}`).join('\n'), correctif: 'npm run gen-openapi', effort: 'S' });
        } catch (e) { ctx.trouver({ gravite: 'moyenne', id: 'RTE-OPENAPI-ILLISIBLE', titre: 'openapi.json illisible : ' + e.message, effort: 'S' }); }

        // 4. paramètres :id non validés dans les contrôleurs (heuristique)
        const sansValid = [];
        for (const f of new Set(Object.values(importes))) {
            const t = ctx.lire(ctx.abs('server', 'controllers', f + '.js'));
            ctx.chercher(t, /req\.params\.(\w+)/, (mm, l) => {
                const ctxt = t.slice(Math.max(0, mm.index - 50), mm.index + 400);
                if (/parseInt|Number\(|safeId|validerId|isValid|\.match\(|test\(|\+req\.params|encodeURIComponent|normaliser|allowlist|whitelist/.test(ctxt) === false) sansValid.push(`server/controllers/${f}.js:${l} (params.${mm[1]})`);
            });
        }
        ctx.mesure('params_sans_validation_visible', sansValid.length);
        if (sansValid.length) ctx.trouver({ gravite: 'basse', id: 'RTE-PARAMS-NON-VALIDES', categorie: 'robustesse', titre: `${sansValid.length} usage(s) de req.params sans validation visible`, detail: sansValid.slice(0, 25).join('\n'), correctif: 'Valider (type, longueur, motif) au bord ; un middleware de schéma centraliserait cela.', effort: 'M' });

        // 5. taille des corps
        const app = ctx.lire(ctx.abs('server', 'app.js'));
        const lim = /express\.json\(\{\s*limit:\s*'(\d+)mb'/.exec(app);
        if (lim && +lim[1] >= 10) ctx.trouver({ gravite: 'moyenne', id: 'RTE-CORPS-12MO', categorie: 'robustesse', titre: `Corps JSON plafonné à ${lim[1]} Mo pour TOUTES les routes`, fichier: 'server/app.js', ligne: ctx.ligneDe(app, lim.index),
            detail: 'Le plafond généreux sert à l\'import de sauvegarde ; il s\'applique aussi à /auth/login.', correctif: 'json({limit:\'100kb\'}) par défaut ; un parseur à 12 Mo uniquement sur les routes d\'import.', effort: 'S' });
    },
};
