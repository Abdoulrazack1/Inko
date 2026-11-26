// couvertures — les couvertures de la bibliothèque s'affichent-elles vraiment, hôte par hôte ?
'use strict';
const path = require('path');
const { requete } = require('./extensions');

module.exports = {
    nom: 'couvertures',
    description: 'Joignabilité des couvertures réelles via le proxy d\'images, par hôte (lecture seule)',
    async run(ctx) {
        const base = process.env.INKO_URL || 'http://localhost:8088';
        const sante = await requete(base, '/api/health');
        if (sante.erreur) { ctx.trouver({ gravite: 'info', id: 'COUV-SKIP', titre: 'Serveur injoignable : sonde des couvertures ignorée' }); return; }
        let mysql;
        try { mysql = require(path.join(ctx.racine, 'server', 'node_modules', 'mysql2', 'promise')); require(path.join(ctx.racine, 'server', 'node_modules', 'dotenv')).config({ path: path.join(ctx.racine, 'server', '.env'), quiet: true }); } catch (e) { return; }
        let c;
        try { c = await mysql.createConnection({ host: process.env.DB_HOST || '127.0.0.1', port: +(process.env.DB_PORT || 3306), user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD || '', database: process.env.DB_NAME || 'inko', connectTimeout: 4000 }); } catch (e) { return; }
        let lignes;
        try { [lignes] = await c.query("SELECT manga_id, source, title, cover FROM favorites WHERE cover LIKE 'http%' ORDER BY RAND() LIMIT 80"); } finally { await c.end(); }
        const parHote = {};
        const lot = lignes.slice();
        const travailler = async () => {
            while (lot.length) {
                const f = lot.pop(); let h; try { h = new URL(f.cover).host; } catch (e) { continue; }
                const t0 = Date.now();
                const r = await new Promise((ok) => {
                    require('http').get(`${base}/api/img?url=${encodeURIComponent(f.cover)}`, { timeout: 25000 }, res => { let n = 0; res.on('data', d => n += d.length); res.on('end', () => ok({ statut: res.statusCode, type: res.headers['content-type'], octets: n })); }).on('error', e => ok({ erreur: e.code })).on('timeout', function () { this.destroy(); ok({ erreur: 'timeout' }); });
                });
                const e = (parHote[h] = parHote[h] || { ok: 0, ko: 0, ms: 0, exemples: [] });
                const bon = r.statut === 200 && /^image\//.test(r.type || '') && r.octets > 500;
                if (bon) e.ok++; else { e.ko++; if (e.exemples.length < 3) e.exemples.push(`${f.title} [${f.source}] → ${r.statut || r.erreur} ${r.type || ''}`); }
                e.ms += Date.now() - t0;
            }
        };
        await Promise.all([travailler(), travailler(), travailler(), travailler()]);
        ctx.mesure('couvertures_par_hote', Object.fromEntries(Object.entries(parHote).map(([h, e]) => [h, `${e.ok} ok / ${e.ko} KO, ${Math.round(e.ms / Math.max(1, e.ok + e.ko))} ms moy.`])));
        const total = Object.values(parHote).reduce((s, e) => s + e.ok + e.ko, 0), ko = Object.values(parHote).reduce((s, e) => s + e.ko, 0);
        ctx.mesure('couvertures_taux_echec_pct', total ? Math.round(100 * ko / total) : null);
        for (const [h, e] of Object.entries(parHote)) {
            const n = e.ok + e.ko;
            if (e.ko && e.ko / n >= 0.2) ctx.trouver({ gravite: e.ko / n > 0.6 ? 'critique' : 'haute', id: 'COUV-HOTE-EN-PANNE', categorie: 'couvertures', titre: `Couvertures de ${h} : ${e.ko}/${n} en échec`, detail: e.exemples.join('\n'),
                correctif: 'Repli par œuvre : MangaDex API (liens al/kt/mal) → AniList (coverImage) → Kitsu → image dessinée ; écrire l\'URL trouvée dans favorites.cover pour ne le faire qu\'une fois.', effort: 'M' });
        }
    },
};
