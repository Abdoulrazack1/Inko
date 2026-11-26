// flux-ecriture — parcours d'ÉCRITURE joués sur un serveur JETABLE (base inko_sonde, port 8097)
// Jamais sur votre base réelle : la base est créée, remplie, puis supprimée par la sonde.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');
const { requete, percentile } = require('./_http');

const BASE_JETABLE = 'inko_sonde';
const PORT = 8097;

module.exports = {
    nom: 'flux-ecriture',
    description: 'Inscription, favoris, progression, listes, notes, export/import, suppression en masse, limiteur : sur serveur et base jetables',
    async run(ctx) {
        let mysql;
        try { mysql = require(path.join(ctx.racine, 'server', 'node_modules', 'mysql2', 'promise')); require(path.join(ctx.racine, 'server', 'node_modules', 'dotenv')).config({ path: path.join(ctx.racine, 'server', '.env'), quiet: true }); } catch (e) { ctx.trouver({ gravite: 'info', id: 'FLUX-SKIP', titre: 'mysql2 introuvable' }); return; }
        const cx = { host: process.env.DB_HOST || '127.0.0.1', port: +(process.env.DB_PORT || 3306), user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD || '', multipleStatements: true, connectTimeout: 4000 };
        let admin;
        try { admin = await mysql.createConnection(cx); } catch (e) { ctx.trouver({ gravite: 'info', id: 'FLUX-SKIP', titre: 'MySQL injoignable : parcours d\'écriture non joués (' + e.code + ')' }); return; }
        let serveur; const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'inko-sonde-'));
        const nettoyer = async () => {
            try { if (serveur) serveur.kill(); } catch (e) { /* déjà arrêté */ }
            try { await admin.query('DROP DATABASE IF EXISTS `' + BASE_JETABLE + '`'); await admin.end(); } catch (e) { /* idem */ }
            try { fs.rmSync(dossier, { recursive: true, force: true }); } catch (e) { /* idem */ }
        };
        try {
            await admin.query('DROP DATABASE IF EXISTS `' + BASE_JETABLE + '`');
            await admin.query('CREATE DATABASE `' + BASE_JETABLE + '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
            await admin.query('USE `' + BASE_JETABLE + '`');
            await admin.query(require('./_garde-sql').sansBaseImposee(fs.readFileSync(ctx.abs('server', 'db', 'schema.sql'), 'utf8'), BASE_JETABLE));
            // identifiants hors de portée des vrais comptes (la suppression d'un compte efface server/uploads/<compte>)
            await admin.query('ALTER TABLE users AUTO_INCREMENT = ' + PORT * 1000);
            const t0 = Date.now();
            const tmp = path.join(dossier, 'tmp'); fs.mkdirSync(tmp, { recursive: true });
            serveur = cp.spawn(process.execPath, [ctx.abs('server', 'server.js')], {
                cwd: ctx.abs('server'), windowsHide: true,
                env: { ...process.env, TEMP: tmp, TMP: tmp, TMPDIR: tmp, APPDATA: path.join(dossier, 'profil'), PORT: String(PORT), DB_NAME: BASE_JETABLE, LOCAL_MODE: '0', DISABLE_BACKUPS: '1', INKO_MDNS: '0', BACKUP_DIR: dossier, NODE_ENV: 'test', LOCAL_RATE_FACTOR: '1' },
            });
            let journal = ''; serveur.stdout.on('data', d => journal += d); serveur.stderr.on('data', d => journal += d);
            const base = 'http://127.0.0.1:' + PORT;
            let pret = false;
            for (let i = 0; i < 60 && !pret; i++) { await new Promise(r => setTimeout(r, 500)); const r = await requete(base, '/api/health', { delaiMs: 1500 }); pret = r.statut === 200; }
            if (!pret) { ctx.trouver({ gravite: 'haute', id: 'FLUX-DEMARRAGE', categorie: 'bug', titre: 'Le serveur ne démarre pas sur une base vierge (60 s)', detail: journal.slice(-600), effort: 'M' }); return; }
            ctx.mesure('demarrage_base_vierge_ms', Date.now() - t0);

            // ── inscription / connexion ──
            const mail = `sonde${Date.now()}@example.test`;
            const mdp = 'Rt7-Lmnop-Quartz-2026!';
            const ins = await requete(base, '/api/auth/register', { methode: 'POST', corps: { username: 'sonde', email: mail, password: mdp } });
            if (ins.statut !== 200 && ins.statut !== 201) { ctx.trouver({ gravite: 'haute', id: 'FLUX-INSCRIPTION', categorie: 'bug', titre: `Inscription sur base vierge → ${ins.statut}`, detail: String(ins.texte).slice(0, 300), effort: 'M' }); return; }
            const jeton = (ins.json && ins.json.token) || ((await requete(base, '/api/auth/login', { methode: 'POST', corps: { email: mail, password: mdp } })).json || {}).token;
            if (!jeton) { ctx.trouver({ gravite: 'haute', id: 'FLUX-CONNEXION', categorie: 'bug', titre: 'Aucun jeton après inscription/connexion', effort: 'M' }); return; }
            const A = (m, p, corps) => requete(base, '/api' + p, { methode: m, corps, jeton });
            const ok = (r) => r.statut && r.statut < 300;
            const etapes = [];
            const essai = async (nom, f) => { const t = Date.now(); try { const r = await f(); etapes.push([nom, r === true ? 'ok' : r, Date.now() - t]); return r; } catch (e) { etapes.push([nom, 'EXC ' + e.message, 0]); } };

            // ── favoris : ajout, lecture, doublon, suppression ──
            await essai('favori : ajout', async () => { const r = await A('POST', '/me/favorites', { mangaId: 'sonde-1', source: 'mangadex', title: 'Œuvre ✓ 漫画 "guillemets"', cover: 'https://example.test/c.jpg' }); return ok(r) || `statut ${r.statut} ${String(r.texte).slice(0, 80)}`; });
            await essai('favori : doublon idempotent', async () => { const r = await A('POST', '/me/favorites', { mangaId: 'sonde-1', source: 'mangadex', title: 'Œuvre ✓ 漫画 "guillemets"' }); const l = await A('GET', '/me/favorites'); const n = ((l.json && (l.json.favorites || l.json)) || []).filter(f => (f.mangaId || f.manga_id) === 'sonde-1').length; return n === 1 || `${n} lignes pour un même favori`; });
            await essai('favori : unicode préservé', async () => { const l = await A('GET', '/me/favorites'); const f = ((l.json && (l.json.favorites || l.json)) || []).find(x => (x.mangaId || x.manga_id) === 'sonde-1'); return (f && /漫画/.test(f.title)) || 'titre unicode altéré : ' + (f && f.title); });
            await essai('favori : id invalide refusé', async () => { const r = await A('POST', '/me/favorites', { mangaId: '../../x'.repeat(40), source: 'x' }); return r.statut === 400 || `accepté (${r.statut})`; });
            await essai('favori : couverture javascript: refusée', async () => { await A('POST', '/me/favorites', { mangaId: 'sonde-js', source: 'x', title: 't', cover: 'javascript:alert(1)' }); const l = await A('GET', '/me/favorites'); const f = ((l.json && (l.json.favorites || l.json)) || []).find(x => (x.mangaId || x.manga_id) === 'sonde-js'); return !f || !/^javascript:/i.test(f.cover || '') || 'URL javascript: conservée en base'; });
            await essai('favori : XSS dans le titre stocké tel quel (l\'échappement doit se faire à l\'affichage)', async () => { await A('POST', '/me/favorites', { mangaId: 'sonde-xss', source: 'x', title: '<img src=x onerror=alert(1)>' }); const l = await A('GET', '/me/favorites'); const f = ((l.json && (l.json.favorites || l.json)) || []).find(x => (x.mangaId || x.manga_id) === 'sonde-xss'); return f ? (/<img/.test(f.title) ? 'stocké brut (OK si échappé partout à l\'affichage — voir SEC-XSS-CANDIDAT)' : true) : 'absent'; });

            // ── progression, chapitres lus, notation, listes, notes ──
            await essai('progression : écriture + relecture', async () => { const r = await A('PUT', '/me/progress/sonde-1', { chapterId: 'c1', chapterNum: 3, page: 7, source: 'mangadex', mangaTitle: 't' }); const l = await A('GET', '/me/progress'); return (ok(r) && l.statut === 200) || `PUT ${r.statut} GET ${l.statut} ${String(r.texte).slice(0, 80)}`; });
            await essai('chapitre lu : marquer', async () => { const r = await A('POST', '/me/read-chapters', { mangaId: 'sonde-1', chapterId: 'c1', source: 'mangadex' }); return ok(r) || `statut ${r.statut} ${String(r.texte).slice(0, 80)}`; });
            await essai('chapitres lus : lot de 2000', async () => { const t = Date.now(); const r = await A('POST', '/me/read-chapters/bulk', { mangaId: 'sonde-1', source: 'mangadex', chapters: Array.from({ length: 2000 }, (_, i) => ({ chapterId: 'b' + i, chapter: i })) }); return (ok(r) && Date.now() - t < 5000) || `statut ${r.statut} en ${Date.now() - t} ms`; });
            await essai('notation 1–10', async () => { const r = await A('PUT', '/ratings/sonde-1', { rating: 9 }); return ok(r) || `statut ${r.statut}`; });
            await essai('notation hors bornes refusée', async () => { const r = await A('PUT', '/ratings/sonde-1', { rating: 99 }); return r.statut === 400 || `acceptée (${r.statut})`; });
            let listeId;
            await essai('liste : création + ajout + suppression', async () => { const c = await A('POST', '/me/lists', { name: 'Ma liste' }); listeId = c.json && (c.json.id || (c.json.list && c.json.list.id)); const a = await A('POST', `/me/lists/${listeId}/items`, { mangaId: 'sonde-1', source: 'mangadex', title: 't' }); const d = await A('DELETE', `/me/lists/${listeId}`); return (ok(c) && ok(a) && ok(d)) || `créer ${c.statut} ajouter ${a.statut} supprimer ${d.statut}`; });
            await essai('note : création', async () => { const r = await A('POST', '/me/notes', { mangaId: 'sonde-1', body: 'une note', text: 'une note', title: 'n', kind: 'note' }); return ok(r) || `statut ${r.statut} ${String(r.texte).slice(0, 100)}`; });

            // ── isolement entre comptes ──
            await essai('isolement : un autre compte ne voit pas mes favoris', async () => {
                const m2 = `sonde2${Date.now()}@example.test`; const i2 = await requete(base, '/api/auth/register', { methode: 'POST', corps: { username: 'sonde2', email: m2, password: mdp } });
                const t2 = (i2.json && i2.json.token) || ((await requete(base, '/api/auth/login', { methode: 'POST', corps: { email: m2, password: mdp } })).json || {}).token;
                const l = await requete(base, '/api/me/favorites', { jeton: t2 }); const n = ((l.json && (l.json.favorites || l.json)) || []).length;
                const d = await requete(base, '/api/me/favorites/sonde-1', { methode: 'DELETE', jeton: t2 });
                const mien = await A('GET', '/me/favorites'); const encore = ((mien.json && (mien.json.favorites || mien.json)) || []).some(f => (f.mangaId || f.manga_id) === 'sonde-1');
                return (n === 0 && encore) || `fuite : l'autre compte voit ${n} favori(s) / mon favori encore présent: ${encore}`;
            });

            // ── l'incident du 9 novembre : suppression en masse ──
            const lot = 300; const ids = Array.from({ length: lot }, (_, i) => 'masse-' + i);
            await Promise.all(ids.map(id => A('POST', '/me/favorites', { mangaId: id, source: 'mangadex', title: id })));
            const tSupp = Date.now(); let refus = 0; const suppr = [];
            for (let i = 0; i < ids.length; i += 20) { const rs = await Promise.all(ids.slice(i, i + 20).map(id => A('DELETE', '/me/favorites/' + encodeURIComponent(id)))); rs.forEach(r => { if (r.statut === 429 || r.statut === 409 || r.statut === 423) refus++; suppr.push(r.statut); }); }
            const reste = await A('GET', '/me/favorites'); const nReste = ((reste.json && (reste.json.favorites || reste.json)) || []).filter(f => /^masse-/.test(f.mangaId || f.manga_id)).length;
            ctx.mesure('suppression_masse', { demandees: lot, refusees: refus, restantes: nReste, ms: Date.now() - tSupp });
            if (nReste === 0 && !refus) ctx.trouver({ gravite: 'haute', id: 'FLUX-SUPPRESSION-MASSE', categorie: 'données', titre: `${lot} favoris supprimés en ${Date.now() - tSupp} ms par ${lot} appels DELETE consécutifs : aucune garde, aucune corbeille`,
                detail: 'Reproduit le mécanisme de l\'incident du 9 novembre (990 événements favorite/unfavorite en 2 minutes, bibliothèque de 495 séries vidée). Rien côté serveur ne distingue un clic d\'une boucle.',
                correctif: '1) corbeille 30 jours (colonne deleted_at) ; 2) plafond de suppressions (ex. > 20 en 10 s → 429 + demande de confirmation explicite) ; 3) sauvegarde automatique avant toute suppression ≥ 10 ; 4) endpoint « annuler » qui rejoue les unfavorite récents.', effort: 'M' });
            const ev = await admin.query('SELECT COUNT(*) AS n FROM events WHERE type = ?', ['unfavorite']).then(([r]) => r[0].n).catch(() => null);
            ctx.mesure('evenements_unfavorite_apres_masse', ev);

            // ── export / import : aller-retour ──
            await essai('export → import : les favoris font l’aller-retour (le reste : sonde integrite)', async () => {
                const ex = await A('GET', '/me/export'); if (ex.statut !== 200) return `export ${ex.statut}`;
                const avant = JSON.stringify((await A('GET', '/me/favorites')).json).length;
                const im = await A('POST', '/me/import', ex.json);
                const apres = JSON.stringify((await A('GET', '/me/favorites')).json).length;
                return (ok(im) && Math.abs(avant - apres) < avant * 0.05) || `import ${im.statut}, taille ${avant} → ${apres}`;
            });
            await essai('import : charge hostile refusée', async () => { const r = await A('POST', '/me/import', { favorites: 'pas un tableau', progress: 42 }); return (r.statut >= 400 && r.statut < 500) || `statut ${r.statut}`; });

            // ── limiteur de débit sur la connexion ──
            const codes = {};
            for (let i = 0; i < 40; i++) { const r = await requete(base, '/api/auth/login', { methode: 'POST', corps: { email: 'nobody@example.test', password: 'x' + i }, delaiMs: 8000 }); codes[r.statut] = (codes[r.statut] || 0) + 1; }
            ctx.mesure('login_40_tentatives', codes);
            if (!codes[429]) ctx.trouver({ gravite: 'haute', id: 'FLUX-PAS-DE-LIMITE-CONNEXION', categorie: 'sécurité', titre: '40 connexions ratées consécutives : aucune n\'est limitée (429)', detail: JSON.stringify(codes), correctif: 'authLimiter à vérifier (clé IP, fenêtre, plafond) ; essentiel dès que l\'instance est exposée (Docker/Caddy).', effort: 'S' });
            // ── suppression de compte : tout disparaît ──
            await essai('suppression de compte : cascade complète', async () => {
                const d = await A('POST', '/auth/delete', { password: mdp }); if (!ok(d)) return `statut ${d.statut} ${String(d.texte).slice(0, 100)}`;
                const [[r]] = await admin.query('SELECT (SELECT COUNT(*) FROM favorites WHERE manga_id LIKE "sonde%" OR manga_id LIKE "masse%") AS f, (SELECT COUNT(*) FROM progress) AS p, (SELECT COUNT(*) FROM read_chapters) AS r, (SELECT COUNT(*) FROM events WHERE user_id NOT IN (SELECT id FROM users)) AS e');
                return (r.f + r.p + r.r + r.e === 0) || `restes après suppression : favoris ${r.f}, progression ${r.p}, chapitres ${r.r}, événements ${r.e}`;
            });
            ctx.mesure('flux_etapes', etapes.map(e => `${e[1] === 'ok' || e[1] === true ? '✓' : '✗'} ${e[0]} (${e[2]} ms)${e[1] === true ? '' : ' → ' + e[1]}`));
            for (const [nom, res, ms] of etapes) if (res !== true && res !== 'ok') ctx.trouver({ gravite: /fuite|présent|restes/.test(String(res)) ? 'critique' : /stocké brut/.test(String(res)) ? 'info' : 'haute', id: 'FLUX-ETAPE-KO', categorie: 'bug', titre: `Parcours « ${nom} » : ${String(res).slice(0, 160)}`, effort: 'M' });
            if (/\[err\]|Error:|TypeError|ReferenceError/.test(journal)) ctx.trouver({ gravite: 'moyenne', id: 'FLUX-JOURNAL-ERREURS', categorie: 'bug', titre: 'Le serveur a journalisé des erreurs pendant les parcours', detail: journal.split('\n').filter(l => /\[err\]|Error/.test(l)).slice(0, 8).join('\n'), effort: 'M' });
        } catch (e) {
            ctx.trouver({ gravite: 'moyenne', id: 'FLUX-INTERROMPU', categorie: 'bug', titre: 'Sonde d\'écriture interrompue : ' + e.message, detail: String(e.stack).split('\n').slice(0, 4).join('\n'), effort: 'S' });
        } finally { await nettoyer(); }
    },
};
