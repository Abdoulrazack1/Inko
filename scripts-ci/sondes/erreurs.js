// erreurs — gestion d'erreurs, promesses flottantes, journalisation, minuteurs
'use strict';
module.exports = {
    nom: 'erreurs',
    description: 'catch vides, promesses sans catch, console.*, setInterval sans nettoyage, handlers async',
    async run(ctx) {
        const front = [...ctx.parcourir(ctx.abs('assets', 'js'), ctx.ext('.js'))].filter(p => !/vendor|\.min\./.test(p));
        const serveur = [...ctx.parcourir(ctx.abs('server'), ctx.ext('.js'))].filter(p => !/node_modules|server\/test|backups|uploads/.test(ctx.rel(p)));
        const bilan = { catchVides: 0, catchAvales: 0, consoleLog: 0, thenSansCatch: 0, intervalles: 0, ecouteursGlobaux: 0, fetchSansOk: 0 };
        const parFic = {};
        const note = (f, cle, l) => { (parFic[f] = parFic[f] || {}); (parFic[f][cle] = parFic[f][cle] || []).push(l); };
        for (const p of [...front, ...serveur]) {
            const t = ctx.lire(p), r = ctx.rel(p);
            const serv = r.startsWith('server/');
            // catch vide ou qui avale sans trace
            ctx.chercher(t, /catch\s*(?:\(\s*\w*\s*\))?\s*\{\s*(\/\/[^\n]*|\/\*[\s\S]*?\*\/)?\s*\}/, (m, l) => {
                bilan.catchVides++;
                // un commentaire explicatif rend le choix délibéré ; on ne signale que les muets
                if (!m[1]) { bilan.catchAvales++; note(r, 'catch muet', l); }
            });
            ctx.chercher(t, /\.then\([^)]*\)\s*(?:;|\n)(?![\s\S]{0,80}\.catch)/, (m, l) => {
                // une chaîne .then(...) terminée sans .catch dans la même instruction
                const ligne = t.split('\n')[l - 1] || '';
                if (!/\.catch|await|return/.test(ligne) && /\.then\(/.test(ligne)) { bilan.thenSansCatch++; note(r, 'then sans catch', l); }
            });
            ctx.chercher(t, /console\.(log|debug)\(/, (m, l) => { bilan.consoleLog++; if (serv) note(r, 'console.log serveur', l); });
            ctx.chercher(t, /setInterval\(/, (m, l) => { bilan.intervalles++; const bloc = t.slice(m.index - 200, m.index + 600); if (!/clearInterval|\.unref\(\)|visibilitychange/.test(t)) note(r, 'setInterval sans clearInterval', l); });
            ctx.chercher(t, /\b(?:window|document)\.addEventListener\(\s*['"](scroll|resize|mousemove|touchmove|pointermove)['"]\s*,\s*(?:\([^)]*\)|function)/, (m, l) => { bilan.ecouteursGlobaux++; if (!/passive|\{\s*once|removeEventListener|requestAnimationFrame|throttle|debounce|rafThrottle/.test(t.slice(m.index, m.index + 700))) note(r, 'écouteur global sans passive/throttle', l); });
            if (!serv) ctx.chercher(t, /await\s+fetch\([^)]*\)\s*;?\s*\n\s*(?:const|let)\s+\w+\s*=\s*await\s+\w+\.json\(\)/, (m, l) => { bilan.fetchSansOk++; note(r, 'fetch + json sans test de res.ok', l); });
        }
        ctx.mesure('erreurs_bilan', bilan);
        for (const [f, d] of Object.entries(parFic)) {
            for (const [cle, lignes] of Object.entries(d)) {
                const seuil = { 'catch muet': 6, 'then sans catch': 3, 'console.log serveur': 8, 'setInterval sans clearInterval': 1, 'écouteur global sans passive/throttle': 1, 'fetch + json sans test de res.ok': 1 }[cle] || 3;
                if (lignes.length < seuil) continue;
                ctx.trouver({
                    gravite: cle === 'setInterval sans clearInterval' || cle.includes('écouteur') ? 'moyenne' : 'basse', id: 'ERR-' + cle.toUpperCase().replace(/[^A-Z]+/g, '-'), categorie: 'robustesse',
                    titre: `${lignes.length}× « ${cle} » dans ${f}`, fichier: f, ligne: lignes[0], detail: 'Lignes : ' + lignes.slice(0, 15).join(', '),
                    correctif: { 'catch muet': 'Au minimum MH.err(\'fichier\', e) : une erreur avalée sans trace est un bug invisible.', 'then sans catch': 'Ajouter .catch ou passer en async/await avec try.', 'console.log serveur': 'Utiliser le journal du serveur (niveaux) plutôt que console.log.', 'setInterval sans clearInterval': 'Arrêter le minuteur sur pagehide/visibilitychange (batterie, onglet en arrière-plan).', 'écouteur global sans passive/throttle': '{ passive: true } et rAF/throttle : bloque le défilement sur WebView Android 8.', 'fetch + json sans test de res.ok': 'Vérifier res.ok avant .json() : une page d\'erreur HTML fait lever un SyntaxError opaque.' }[cle],
                    effort: 'S',
                });
            }
        }
        // handlers Express async sans try/catch (Express 5 propage les rejets, mais on veut un message utile)
        const nonProteges = [];
        for (const p of serveur.filter(p => /controllers\//.test(ctx.rel(p)))) {
            const t = ctx.lire(p), r = ctx.rel(p);
            ctx.chercher(t, /(?:exports\.\w+|async function \w+)\s*=?\s*(?:async\s*)?\(?\s*req\s*,\s*res/, (m, l) => {
                const corps = t.slice(m.index, m.index + 3000);
                const fin = corps.search(/\n(?:exports\.|async function|function|module\.exports)/);
                const bloc = fin > 0 ? corps.slice(0, fin) : corps;
                if (/await\s/.test(bloc) && !/try\s*\{/.test(bloc)) nonProteges.push(`${r}:${l}`);
            });
        }
        ctx.mesure('handlers_async_sans_try', nonProteges.length);
        if (nonProteges.length) ctx.trouver({ gravite: 'moyenne', id: 'ERR-HANDLER-SANS-TRY', categorie: 'robustesse', titre: `${nonProteges.length} handler(s) avec await mais sans try/catch`,
            detail: nonProteges.slice(0, 30).join('\n'), correctif: 'Express 5 transmet le rejet à errorHandler (OK) mais perd le contexte métier ; vérifier le mapping des erreurs SQL (doublon, FK) → 409/422 plutôt que 500.', effort: 'M' });
        // process-level
        const server = ctx.lire(ctx.abs('server', 'server.js')) + '\n' + ctx.lire(ctx.abs('server', 'app.js'));
        if (!/unhandledRejection/.test(server)) ctx.trouver({ gravite: 'moyenne', id: 'ERR-PAS-DE-UNHANDLED', categorie: 'robustesse', titre: 'Pas de gestionnaire process.on(unhandledRejection)', fichier: 'server/server.js', correctif: 'Journaliser et continuer (ou sortir proprement) plutôt que de laisser Node décider.', effort: 'S' });
        if (!/SIGTERM|SIGINT/.test(server)) ctx.trouver({ gravite: 'moyenne', id: 'ERR-PAS-D-ARRET-PROPRE', categorie: 'robustesse', titre: 'Pas d\'arrêt propre (SIGTERM/SIGINT)', fichier: 'server/server.js', correctif: 'Fermer le serveur HTTP puis le pool MySQL ; indispensable pour la base embarquée.', effort: 'S' });
    },
};
