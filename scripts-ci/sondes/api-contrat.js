// api-contrat — chaque GET sans paramètre, authentifié : statut, latence, poids ; puis mini-charge
'use strict';
const { requete, routesDuServeur, jetonLocal, percentile } = require('./_http');

module.exports = {
    nom: 'api-contrat',
    description: 'Balayage authentifié des GET (lecture seule) : 5xx, lenteurs, charges utiles, cache, puis percentiles sous charge légère',
    async run(ctx) {
        const base = process.env.INKO_URL || 'http://localhost:8088';
        const sante = await requete(base, '/api/health');
        if (sante.erreur) { ctx.trouver({ gravite: 'info', id: 'CONTRAT-SKIP', titre: 'Serveur injoignable : sonde de contrat ignorée' }); return; }
        const jeton = await jetonLocal(base);
        if (!jeton) { ctx.trouver({ gravite: 'info', id: 'CONTRAT-SKIP', titre: 'Authentification locale impossible' }); return; }
        const externes = /(search|popular|latest|anilist|artwork|relay|\/img|\/test$|updates\/scan|\/updates$|chapters|pages|text|metadata|recommend|similar|trending|discover|catalog)/i;
        const gets = routesDuServeur(ctx).filter(r => r.methode === 'GET' && !/:\w+/.test(r.chemin) && !/^\/(health|openapi\.json)$/.test(r.chemin)
            // flux SSE (ne se termine jamais, par conception) et ancien scan SYNCHRONE :
            // le second déclenche un vrai balayage de la bibliothèque — il est signalé
            // à part (voir CONTRAT-SYNCHRONE) mais jamais appelé par une sonde.
            && !/(remote\/stream|^\/me\/updates$)/.test(r.chemin));
        const releve = [];
        for (const r of gets) {
            const ext = externes.test(r.chemin);
            const rep = await requete(base, '/api' + r.chemin, { jeton, delaiMs: ext ? 25000 : 10000 });
            releve.push({ chemin: r.chemin, ext, statut: rep.statut || rep.erreur, ms: Math.round(rep.ms || 0), octets: rep.octets || 0, ct: (rep.entetes && rep.entetes['content-type'] || '').split(';')[0], json: !!rep.json, cache: rep.entetes && rep.entetes['cache-control'], ligne: r.ligne, corps: String(rep.texte || '').slice(0, 160) });
        }
        ctx.mesure('contrat_get', { total: releve.length, ok: releve.filter(x => x.statut < 300).length, auth: releve.filter(x => [401, 403].includes(x.statut)).length, client: releve.filter(x => x.statut >= 400 && x.statut < 500 && ![401, 403].includes(x.statut)).length, serveur: releve.filter(x => x.statut >= 500).length, timeouts: releve.filter(x => x.statut === 'timeout').length });
        ctx.mesure('contrat_plus_lents', releve.slice().sort((a, b) => b.ms - a.ms).slice(0, 12).map(x => `${x.chemin} ${x.ms} ms ${Math.round(x.octets / 1024)} Ko${x.ext ? ' (externe)' : ''}`));
        for (const x of releve) {
            if (x.statut >= 500) ctx.trouver({ gravite: 'haute', id: 'CONTRAT-5XX', categorie: 'bug', titre: `GET ${x.chemin} → ${x.statut}`, fichier: 'server/routes/index.js', ligne: x.ligne, detail: x.corps, correctif: 'Une route de lecture sans paramètre ne doit jamais faire 500 : cas vide / base vide / source absente à gérer.', effort: 'S' });
            else if (x.statut === 'timeout') ctx.trouver({ gravite: x.ext ? 'moyenne' : 'haute', id: 'CONTRAT-TIMEOUT', categorie: 'performance', titre: `GET ${x.chemin} : pas de réponse en ${x.ext ? 25 : 10} s`, fichier: 'server/routes/index.js', ligne: x.ligne, effort: 'M' });
            else if (!x.ext && x.ms > 800) ctx.trouver({ gravite: x.ms > 2500 ? 'haute' : 'moyenne', id: 'CONTRAT-LENT', categorie: 'performance', titre: `GET ${x.chemin} : ${x.ms} ms (lecture locale, cible < 300 ms)`, fichier: 'server/routes/index.js', ligne: x.ligne, correctif: 'EXPLAIN de la requête, index, agrégation en SQL plutôt qu\'en JS, mise en cache courte.', effort: 'M' });
            if (x.octets > 1.5 * 1024 * 1024) ctx.trouver({ gravite: 'moyenne', id: 'CONTRAT-LOURD', categorie: 'performance', titre: `GET ${x.chemin} renvoie ${Math.round(x.octets / 1024)} Ko`, fichier: 'server/routes/index.js', ligne: x.ligne, correctif: 'Pagination, champs réduits, ou ETag + 304.', effort: 'M' });
            if (x.statut < 300 && x.ct && !x.ct.includes('json') && !/csv|text|zip|octet|image/.test(x.ct)) ctx.trouver({ gravite: 'basse', id: 'CONTRAT-TYPE', categorie: 'api', titre: `GET ${x.chemin} répond ${x.ct}`, effort: 'S' });
            if (x.statut < 300 && x.json && !x.cache && x.octets > 20000) ctx.trouver({ gravite: 'basse', id: 'CONTRAT-SANS-CACHE', categorie: 'performance', titre: `GET ${x.chemin} (${Math.round(x.octets / 1024)} Ko) sans Cache-Control ni ETag exploitable`, correctif: 'ETag faible + 304 : le front rappelle ces routes à chaque page.', effort: 'S' });
        }
        // ── mini-charge : 6 clients en parallèle, 24 requêtes chacun ──
        const cibles = [['/api/health', null], ['/api/sources', null], ['/api/me/favorites', jeton], ['/accueil.html', null], ['/assets/js/global.js', null]];
        const charge = {};
        for (const [chemin, tok] of cibles) {
            const durees = []; let ko = 0;
            const fil = async () => { for (let i = 0; i < 24; i++) { const r = await requete(base, chemin, { jeton: tok || undefined, delaiMs: 15000 }); if (!r.statut || r.statut >= 500) ko++; else durees.push(r.ms); } };
            await Promise.all(Array.from({ length: 6 }, fil));
            charge[chemin] = { n: durees.length, p50: percentile(durees, 50), p95: percentile(durees, 95), max: Math.round(Math.max(0, ...durees)), erreurs: ko };
            if (percentile(durees, 95) > 600 || ko) ctx.trouver({ gravite: ko ? 'haute' : 'moyenne', id: 'CHARGE-DEGRADEE', categorie: 'performance', titre: `${chemin} sous 6 clients simultanés : p95 ${percentile(durees, 95)} ms, ${ko} erreur(s)`, correctif: 'Pool MySQL (15), requêtes synchrones sur le fil principal, ou middleware coûteux (journalisation, compression).', effort: 'M' });
        }
        ctx.mesure('charge_6x24', charge);
    },
};
