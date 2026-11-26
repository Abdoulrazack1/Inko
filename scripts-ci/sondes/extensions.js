// extensions — qualité des sources : statique + chaîne complète via le bac à sable (si serveur joignable)
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const http = require('http');

function requete(base, chemin, { methode = 'GET', corps, jeton } = {}) {
    return new Promise((ok) => {
        const u = new URL(chemin, base);
        const data = corps ? JSON.stringify(corps) : null;
        const req = http.request(u, { method: methode, timeout: 60000, headers: { 'content-type': 'application/json', ...(jeton ? { authorization: 'Bearer ' + jeton } : {}), ...(data ? { 'content-length': Buffer.byteLength(data) } : {}) } }, (res) => {
            let b = ''; res.on('data', d => b += d); res.on('end', () => { let j; try { j = JSON.parse(b); } catch (e) { /* texte */ } ok({ statut: res.statusCode, json: j, texte: b }); });
        });
        req.on('error', e => ok({ erreur: e.code || e.message })); req.on('timeout', () => { req.destroy(); ok({ erreur: 'timeout' }); });
        if (data) req.write(data); req.end();
    });
}
module.exports = {
    nom: 'extensions', requete,
    description: 'Hash, changelog, version, taille, gestion d\'erreur de chaque extension + bac à sable en direct',
    async run(ctx) {
        const dossier = ctx.abs('extensions-community');
        const ids = fs.readdirSync(dossier).filter(f => fs.statSync(path.join(dossier, f)).isDirectory());
        const hashes = (() => { try { return JSON.parse(ctx.lire(path.join(dossier, 'hashes.json'))); } catch (e) { return {}; } })();
        const versions = (() => { try { return JSON.parse(ctx.lire(path.join(dossier, 'versions.json'))); } catch (e) { return {}; } })();
        const changelog = (() => { try { return JSON.parse(ctx.lire(path.join(dossier, 'changelog.json'))); } catch (e) { return {}; } })();
        ctx.mesure('extensions', ids);
        const types = { manga: [], livre: [] };
        for (const id of ids) {
            const f = path.join(dossier, id, 'index.js'); const t = ctx.lire(f); const r = `extensions-community/${id}/index.js`;
            const copie = ctx.lire(ctx.abs('server', 'extensions', id, 'index.js'));
            if (copie && copie !== t) ctx.trouver({ gravite: 'haute', id: 'EXT-COPIE-DIVERGE', categorie: 'extensions', titre: `${id} : server/extensions diffère de la source de vérité`, fichier: r, correctif: 'Recopier puis npm run gen-ext-hashes.', effort: 'S' });
            if (!copie) ctx.mesure('ext_non_installee_' + id, true);
            const sha = crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
            const h = hashes[id] || (hashes.sources && hashes.sources[id]);
            const attendu = typeof h === 'string' ? h : h && (h.sha256 || h.hash);
            if (attendu && attendu !== sha) ctx.trouver({ gravite: 'haute', id: 'EXT-HASH-FAUX', categorie: 'extensions', titre: `${id} : empreinte de hashes.json périmée`, fichier: r, correctif: 'npm run gen-ext-hashes', effort: 'S' });
            // versions.json est ce que les clients lisent pour savoir qu'une mise à jour existe :
            // s'il retarde sur le code, plus personne ne voit les correctifs publiés.
            const vCode = (/\bversion\s*:\s*['"]([\d.]+)['"]/.exec(t) || [])[1];
            const vCat = versions[id] || (versions.sources && versions.sources[id]);
            if (vCode && vCat && vCode !== vCat) ctx.trouver({ gravite: 'haute', id: 'EXT-VERSIONS-JSON-PERIME', categorie: 'extensions', titre: `${id} : le code est en ${vCode}, versions.json annonce ${vCat} — les clients ne voient jamais la mise à jour`, fichier: 'extensions-community/versions.json', correctif: 'Générer versions.json depuis les index.js (gen-ext-hashes) et le vérifier en CI.', effort: 'S' });
            if (!versions[id] && !(versions.sources && versions.sources[id])) ctx.trouver({ gravite: 'basse', id: 'EXT-SANS-VERSION', categorie: 'extensions', titre: `${id} absente de versions.json`, effort: 'S' });
            if (!changelog[id] && !(changelog.sources && changelog.sources[id])) ctx.trouver({ gravite: 'basse', id: 'EXT-SANS-CHANGELOG', categorie: 'extensions', titre: `${id} sans entrée de changelog`, effort: 'S' });
            // qualité du code
            const lignes = t.split('\n').length;
            const appels = (t.match(/\b(httpGet|fetchHtml|get\(|axios|fetch\()/g) || []).length;
            const timeouts = /timeout/i.test(t); const retry = /retry|retent|essai|attempt/i.test(t); const statut = /status|\.ok\b|statut/i.test(t);
            if (!timeouts) ctx.trouver({ gravite: 'moyenne', id: 'EXT-SANS-TIMEOUT', categorie: 'extensions', titre: `${id} : aucun délai explicite sur ses appels réseau`, fichier: r, correctif: 'Délai par appel via l\'API http de l\'hôte.', effort: 'S' });
            if (!statut) ctx.trouver({ gravite: 'moyenne', id: 'EXT-STATUT-IGNORE', categorie: 'extensions', titre: `${id} : ne regarde pas le code HTTP (une page d\'erreur 200/403 est lue comme du contenu)`, fichier: r, correctif: 'Vérifier le statut et le type de contenu avant d\'analyser.', effort: 'S' });
            if (!retry) ctx.trouver({ gravite: 'basse', id: 'EXT-SANS-REPRISE', categorie: 'extensions', titre: `${id} : aucune reprise sur erreur passagère (429/5xx)`, fichier: r, effort: 'S' });
            if (!/getChapters/.test(t)) ctx.trouver({ gravite: 'haute', id: 'EXT-SANS-CHAPITRES', categorie: 'extensions', titre: `${id} : getChapters absent`, fichier: r, effort: 'M' });
            const roman = /getText/.test(t); types[roman ? 'livre' : 'manga'].push(id);
            ctx.chercher(t, /\.(?:find|select)\(\s*['"][^'"]{0,6}['"]/, () => { });
            const selecteurs = (t.match(/\$\(\s*['"`][^'"`]+['"`]/g) || []).length;
            if (selecteurs > 25 && !/SELS|candidats|repli|fallback/i.test(t)) ctx.trouver({ gravite: 'moyenne', id: 'EXT-SELECTEURS-FRAGILES', categorie: 'extensions', titre: `${id} : ${selecteurs} sélecteurs CSS sans liste de repli (la moindre refonte du site casse la source)`, fichier: r, correctif: 'Listes de sélecteurs candidats (comme chireads) + test de contrat sur une page figée.', effort: 'M' });
            if (lignes > 500) ctx.trouver({ gravite: 'basse', id: 'EXT-GROSSE', categorie: 'extensions', titre: `${id} : ${lignes} lignes`, fichier: r, effort: 'M' });
            ctx.mesure('ext_' + id, { lignes, appels, roman });
        }
        ctx.mesure('extensions_par_type', types);
        if (types.manga.length < 4) ctx.trouver({ gravite: 'haute', id: 'EXT-CATALOGUE-MANGA', categorie: 'produit', titre: `Seulement ${types.manga.length} source(s) de mangas : ${types.manga.join(', ')}`, detail: 'Une seule panne de site suffit à vider le catalogue.', correctif: 'Ajouter des sources de redondance (voir feuille de route : MangaPlus, Comick/mirroirs, MangaKatana, Mangakakalot, ManhuaPlus, scans FR : Lelscan, Mangas-origines, Japscan non).', effort: 'L' });
        if (types.livre.length < 6) ctx.trouver({ gravite: 'moyenne', id: 'EXT-CATALOGUE-LIVRES', categorie: 'produit', titre: `${types.livre.length} source(s) de livres/romans : ${types.livre.join(', ')}`, correctif: 'Domaine public : Standard Ebooks, Project Gutenberg (fait), Wikisource, Open Library/Internet Archive, ebooksgratuits FR, Bibebook ; romans web : Wuxiaworld, Webnovel mirrors, ScribbleHub.', effort: 'L' });

        // ── Chaîne complète en direct (bac à sable), si le serveur répond ──
        const base = process.env.INKO_URL || 'http://localhost:8088';
        const sante = await requete(base, '/api/health');
        if (sante.erreur || !sante.json) { ctx.trouver({ gravite: 'info', id: 'EXT-DIRECT-SKIP', titre: 'Serveur injoignable : bac à sable non joué (' + (sante.erreur || sante.statut) + ')' }); return; }
        const auth = await requete(base, '/api/auth/local', { methode: 'POST', corps: {} });
        const jeton = auth.json && auth.json.token;
        if (!jeton) { ctx.trouver({ gravite: 'info', id: 'EXT-DIRECT-SKIP', titre: 'Authentification locale impossible : bac à sable non joué' }); return; }
        const requetes = { mangadex: 'one piece', weebcentral: 'one piece', sushiscan: 'one piece', novelbin: 'lord of the mysteries', novelfull: 'lord of the mysteries', royalroad: 'mother of learning', chireads: 'reine', gutenberg: 'dracula', 'gutenberg-fr': 'victor hugo' };
        const verdicts = {};
        for (const id of ids) {
            const t0 = Date.now();
            const r = await requete(base, `/api/extensions/${id}/bac-a-sable`, { methode: 'POST', jeton, corps: { requete: requetes[id] || 'a' } });
            const etapes = (r.json && (r.json.etapes || r.json.steps)) || [];
            verdicts[id] = { statut: r.statut || r.erreur, ms: Date.now() - t0, etapes: etapes.map(e => `${e.etape}:${e.ok ? 'ok' : 'KO'}(${e.ms}ms)`), ok: etapes.length > 0 && etapes.every(e => e.ok) };
            if (!verdicts[id].ok) {
                const ko = etapes.filter(e => !e.ok);
                ctx.trouver({ gravite: ko.some(e => /recherche|search/i.test(e.etape)) ? 'haute' : 'moyenne', id: 'EXT-CHAINE-CASSEE', categorie: 'extensions', titre: `Source ${id} : ${ko.length ? 'étape(s) en échec — ' + ko.map(e => e.etape).join(', ') : 'aucun résultat exploitable'}`,
                    fichier: `extensions-community/${id}/index.js`, detail: ko.map(e => `${e.etape}: ${e.erreur || e.detail || '?'}`).join('\n') || JSON.stringify(r.json || r.texte).slice(0, 300), correctif: 'Réparer le sélecteur/endpoint de l\'étape (bac à sable : bouton « Essayer »).', effort: 'M' });
            }
        }
        ctx.mesure('bac_a_sable', verdicts);
        // état de santé suivi par le serveur
        const sa = await requete(base, '/api/extensions/health', { jeton });
        if (sa.json) ctx.mesure('sante_serveur', sa.json);
    },
};
