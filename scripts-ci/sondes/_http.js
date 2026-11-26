// _http.js — client HTTP minimal pour les sondes dynamiques (mesure le temps, ne suit pas les redirections)
'use strict';
const http = require('http');

/**
 * @param {string} base  http://hôte:port
 * @param {string} chemin
 * @param {{methode?:string, corps?:any, brut?:Buffer|string, entetes?:object, jeton?:string, delaiMs?:number, cookie?:string}} o
 */
function requete(base, chemin, o = {}) {
    return new Promise((ok) => {
        const t0 = process.hrtime.bigint();
        let u;
        try { u = new URL(chemin, base); } catch (e) { return ok({ erreur: 'url invalide' }); }
        const data = o.brut !== undefined ? o.brut : (o.corps !== undefined ? JSON.stringify(o.corps) : null);
        const entetes = { ...(data !== null ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) } : {}), ...(o.jeton ? { authorization: 'Bearer ' + o.jeton } : {}), ...(o.cookie ? { cookie: o.cookie } : {}), ...(o.entetes || {}) };
        const req = http.request(u, { method: o.methode || 'GET', headers: entetes, agent: false, timeout: o.delaiMs || 30000 }, (res) => {
            const morceaux = []; let n = 0;
            res.on('data', d => { n += d.length; if (n < 3e6) morceaux.push(d); });
            res.on('end', () => {
                const texte = Buffer.concat(morceaux).toString('utf8');
                let json; try { json = JSON.parse(texte); } catch (e) { /* pas du JSON */ }
                ok({ statut: res.statusCode, entetes: res.headers, texte, json, octets: n, ms: Number(process.hrtime.bigint() - t0) / 1e6 });
            });
        });
        req.on('error', e => ok({ erreur: e.code || e.message, ms: Number(process.hrtime.bigint() - t0) / 1e6 }));
        req.on('timeout', () => { req.destroy(); ok({ erreur: 'timeout', ms: Number(process.hrtime.bigint() - t0) / 1e6 }); });
        if (data !== null) req.write(data);
        req.end();
    });
}

/** Routes déclarées (méthode, chemin, auth, limiteur) lues dans routes/index.js. */
function routesDuServeur(ctx) {
    const src = ctx.lire(ctx.abs('server', 'routes', 'index.js'));
    const RE = /router\.(get|post|put|delete|patch)\s*\(\s*'([^']+)'\s*,?\s*([\s\S]*?)\)\s*;/g;
    const routes = []; let m;
    while ((m = RE.exec(src))) routes.push({ methode: m[1].toUpperCase(), chemin: m[2], reste: m[3], ligne: ctx.ligneDe(src, m.index),
        auth: /adminRequired/.test(m[3]) ? 'admin' : /authRequired/.test(m[3]) ? 'session' : /authOptional/.test(m[3]) ? 'optionnelle' : /localOnly/.test(m[3]) ? 'local' : 'aucune' });
    return routes;
}

async function jetonLocal(base) {
    const r = await requete(base, '/api/auth/local', { methode: 'POST', corps: {} });
    return r.json && r.json.token;
}
const percentile = (arr, p) => { if (!arr.length) return 0; const s = [...arr].sort((a, b) => a - b); return Math.round(s[Math.min(s.length - 1, Math.floor(p / 100 * s.length))]); };

module.exports = { requete, routesDuServeur, jetonLocal, percentile };
