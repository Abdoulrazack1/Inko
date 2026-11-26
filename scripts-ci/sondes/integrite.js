// integrite — les données survivent-elles vraiment ? Sauvegarde puis restauration, export
// puis import, effacement de compte, écritures simultanées, migrations et écart de schéma.
// Tout se joue sur des bases jetables ; la base réelle n'est lue que par information_schema.
'use strict';
const cp = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { demarrer } = require('./_jetable');
const { requete } = require('./_http');

const MDP = () => 'Zq7!' + crypto.randomBytes(9).toString('base64url');
const IGNOREES = new Set(['sessions', 'password_resets', 'schema_migrations', 'app_settings', 'users']);

async function remplir(appel) {
    const rep = [];
    const f = async (nom, m, p, c) => { const r = await appel(m, p, c); if (r.statut >= 400) rep.push(`${nom} → ${r.statut} ${r.texte.slice(0, 80)}`); return r; };
    for (let i = 1; i <= 5; i++) await f('favori', 'POST', '/me/favorites', { mangaId: 'o-' + i, source: 'mangadex', title: 'Œuvre ' + i, cover: 'https://uploads.mangadex.org/c/' + i + '.jpg' });
    await f('catégorie', 'PUT', '/me/favorites/o-1/category', { category: 'À relire' });
    await f('statut', 'PUT', '/me/library/o-2', { status: 'completed' });
    await f('progression', 'PUT', '/me/progress/o-1', { chapterId: 'c2', chapter: 2, page: 7, totalPages: 30, source: 'mangadex' });
    await f('progression 2', 'PUT', '/me/progress/o-1', { chapterId: 'c3', chapter: 3, page: 1, totalPages: 30, source: 'mangadex' });
    await f('lus', 'POST', '/me/read-chapters/bulk', { mangaId: 'o-1', chapters: [{ chapterId: 'c1', chapter: 1 }, { chapterId: 'c2', chapter: 2 }] });
    await f('note /10', 'PUT', '/ratings/o-1', { rating: 8, review: 'Bien' });
    const l = await f('liste', 'POST', '/me/lists', { name: 'Liste', description: 'd', isPublic: true });
    const lid = l.json && l.json.id;
    for (const i of [1, 2]) await f('élément', 'POST', `/me/lists/${lid}/items`, { mangaId: 'o-' + i, source: 'mangadex', title: 'Œuvre ' + i, cover: 'https://uploads.mangadex.org/c/' + i + '.jpg' });
    await f('règles', 'POST', '/me/lists', { name: 'Intelligente', rules: { status: 'completed' } });
    await f('carnet', 'POST', '/me/notes', { mangaId: 'o-1', mangaTitle: 'Œuvre 1', body: 'Ma note de carnet', chapterId: 'c1' });
    await f('signet', 'POST', '/me/bookmarks', { mangaId: 'o-1', chapterId: 'c1', source: 'mangadex', title: 'Œuvre 1', chapterNum: 1, page: 4, label: 'L', note: 'N' });
    await f('commentaire', 'POST', '/comments/o-1', { text: 'Commentaire' });
    await f('réglages', 'PUT', '/me/settings', { libCategories: ['À relire'], reader: { bg: 'sepia' } });
    await f('lien AniList', 'PUT', '/me/anilist-links', { 'o-1': { id: 30002, exact: true } });
    await f('temps de lecture', 'POST', '/me/temps-lecture', { secondes: 600 });
    await f('fréquence', 'PUT', '/me/notif-prefs', { everyHours: 24 });
    await f('surveillance', 'PUT', '/me/notif-watch/o-3', { notify: false });
    await f('push', 'POST', '/me/push/subscribe', { endpoint: 'https://fcm.googleapis.com/fcm/send/essai-inko', keys: { p256dh: 'p', auth: 'a' } });
    await appel('DELETE', '/me/favorites/o-5');
    return rep;
}

module.exports = {
    nom: 'integrite',
    description: 'Sauvegarde → restauration, export → import, effacement de compte, écritures simultanées, migrations, écart de schéma',
    async run(ctx) {
        const T = (gravite, id, titre, detail, correctif, extra = {}) => ctx.trouver({ gravite, id, categorie: 'données', titre, detail, correctif, effort: 'M', ...extra });
        const J = await demarrer(ctx, { base: 'inko_s_integ', port: 8101 });
        if (!J) return;
        const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'inko-integ-'));
        try {
            const appel = (m, p, c) => J.api(m, p, c);
            const rates = await remplir(appel);
            if (rates.length) T('info', 'INT-REMPLISSAGE', 'Certaines écritures de préparation ont été refusées', rates.join('\n'), '');
            const [moi] = await J.sql('SELECT * FROM users ORDER BY id LIMIT 1'); const uid = moi.id;
            const tablesUtil = (await J.sql("SELECT table_name AS t FROM information_schema.columns WHERE table_schema = 'inko_s_integ' AND column_name = 'user_id' ORDER BY table_name")).map(r => r.t);
            const compter = async (u) => { const o = {}; for (const t of tablesUtil) o[t] = (await J.sql(`SELECT COUNT(*) AS n FROM \`${t}\` WHERE user_id = ?`, [u]))[0].n; o.list_items = (await J.sql('SELECT COUNT(*) AS n FROM list_items WHERE list_id IN (SELECT id FROM lists WHERE user_id = ?)', [u]))[0].n; return o; };
            const photo = async (u) => ({
                favoris: await J.sql('SELECT manga_id, source, title, cover, category, status, notify, added_at FROM favorites WHERE user_id = ? ORDER BY manga_id', [u]),
                progression: await J.sql('SELECT manga_id, chapter_id, chapter_number, page, source, total_pages, updated_at FROM progress WHERE user_id = ? ORDER BY manga_id', [u]).catch(() => J.sql('SELECT * FROM progress WHERE user_id = ?', [u])),
                listes: await J.sql('SELECT name, description, is_public, rules FROM lists WHERE user_id = ? ORDER BY name', [u]),
                elements: await J.sql('SELECT manga_id, source, title, cover, position FROM list_items WHERE list_id IN (SELECT id FROM lists WHERE user_id = ?) ORDER BY manga_id', [u]),
                notes10: await J.sql('SELECT manga_id, rating, review FROM ratings WHERE user_id = ?', [u]),
            });
            const avant = await compter(uid), photoAvant = await photo(uid);
            ctx.mesure('integrite_tables_utilisateur', avant);
            const exporte = await appel('GET', '/me/export');

            const vider = async () => { await J.sql('DELETE FROM list_items WHERE list_id IN (SELECT id FROM lists WHERE user_id = ?)', [uid]); for (const t of tablesUtil) if (!IGNOREES.has(t)) await J.sql(`DELETE FROM \`${t}\` WHERE user_id = ?`, [uid]); await J.sql('UPDATE users SET notif_every_hours = DEFAULT WHERE id = ?', [uid]).catch(() => { }); };
            const bilan = async (nom, id, titre, fichier) => {
                const apres = await compter(uid);
                const perdues = Object.keys(avant).filter(t => !IGNOREES.has(t) && avant[t] > 0 && apres[t] < avant[t]).map(t => `${t} : ${avant[t]} → ${apres[t]}`);
                const p = await photo(uid);
                const champs = [];
                for (const [bloc, lignes] of Object.entries(photoAvant)) {
                    const cle = new Set();
                    lignes.forEach((l, i) => { const m = p[bloc].find(x => x.manga_id === l.manga_id && x.name === l.name) || p[bloc][i]; if (!m) return; for (const k of Object.keys(l)) if (JSON.stringify(l[k]) !== JSON.stringify(m[k])) cle.add(k); });
                    if (cle.size) champs.push(`${bloc} : ${[...cle].join(', ')}`);
                }
                ctx.mesure('integrite_' + nom, { perdues, champsAlteres: champs });
                if (perdues.length || champs.length) T('critique', id, titre, (perdues.length ? 'Tables non rendues (lignes avant → après) :\n' + perdues.join('\n') : '') + (champs.length ? '\n\nChamps perdus ou altérés :\n' + champs.join('\n') : ''), 'Une seule liste des tables du compte, partagée par la sauvegarde, la restauration, l\'export et l\'import, avec un test qui échoue dès qu\'une table à user_id n\'y figure pas.', { fichier, effort: 'L' });
            };

            // ── 1. sauvegarde nocturne → restauration ──
            const env = { ...process.env, DB_NAME: 'inko_s_integ', BACKUP_DIR: temp, DISABLE_BACKUPS: '1' }; delete env.APP_VERSION; delete env.BACKUP_PASSPHRASE;
            const sauv = cp.spawnSync(process.execPath, ['-e', "require('dotenv').config({quiet:true});require('./lib/backup').runBackup().then(r=>{console.log('FICHIER='+r.file);process.exit(0)}).catch(e=>{console.error(e.message);process.exit(1)})"], { cwd: ctx.abs('server'), env, encoding: 'utf8', timeout: 60000 });
            const fichier = ((sauv.stdout || '').match(/FICHIER=(.+)/) || [])[1];
            if (!fichier) T('haute', 'INT-SAUVEGARDE-ECHEC', 'La sauvegarde ne s\'écrit pas', (sauv.stderr || sauv.stdout || '').slice(-500), '');
            else {
                await vider();
                const rest = cp.spawnSync(process.execPath, ['scripts/restore-backup.js', fichier.trim(), '--user', String(uid)], { cwd: ctx.abs('server'), env, encoding: 'utf8', timeout: 60000 });
                if (rest.status !== 0) T('haute', 'INT-RESTAURATION-ECHEC', 'Le script de restauration échoue', (rest.stderr || rest.stdout || '').slice(-600), '', { fichier: 'server/scripts/restore-backup.js' });
                await bilan('sauvegarde', 'INT-SAUVEGARDE-INCOMPLETE', 'La sauvegarde automatique ne rend pas toute la bibliothèque après restauration', 'server/lib/backup.js');
            }
            // ── 2. export → import ──
            await vider();
            const imp = await appel('POST', '/me/import', exporte.json);
            if (imp.statut >= 400) T('haute', 'INT-IMPORT-ECHEC', `Réimporter son propre export échoue (${imp.statut})`, imp.texte.slice(0, 300), '');
            await bilan('export', 'INT-EXPORT-INCOMPLET', 'Exporter puis réimporter son compte perd des données', 'server/controllers/user.controller.js');
            // importer deux fois ne doit rien doubler
            const c1 = await compter(uid); await appel('POST', '/me/import', exporte.json); const c2 = await compter(uid);
            const doubles = Object.keys(c1).filter(t => c2[t] > c1[t] && t !== 'events' && !IGNOREES.has(t)).map(t => `${t} : ${c1[t]} → ${c2[t]}`);
            if (doubles.length) T('haute', 'INT-IMPORT-DOUBLONS', 'Importer deux fois le même fichier crée des doublons', doubles.join('\n'), 'Clé d\'unicité (nom de liste) ou fusion.', { fichier: 'server/controllers/user.controller.js' });

            // ce que cela représente sur la base réelle : des comptes de lignes, rien d'autre
            try {
                const [r] = await J.sql('SELECT (SELECT COUNT(*) FROM inko.anilist_links) AS `liens AniList`, (SELECT COUNT(*) FROM inko.bookmarks) AS signets, (SELECT COUNT(*) FROM inko.reading_notes) AS `notes de carnet`, (SELECT COUNT(*) FROM inko.reading_time) AS `jours de temps de lecture`, (SELECT COUNT(*) FROM inko.lists) AS listes, (SELECT COUNT(*) FROM inko.progress_history) AS `lignes d historique`, (SELECT COUNT(*) FROM inko.events) AS `événements`');
                ctx.mesure('integrite_base_reelle_exposee', r);
                T('info', 'INT-EXPOSITION-REELLE', 'Ce que ta base contient aujourd’hui dans les tables mal couvertes', Object.entries(r).map(([k, v]) => k + ' : ' + v).join(String.fromCharCode(10)), '');
            } catch (e) { /* pas de base réelle sur cette machine */ }

            // ── 3. effacement de compte (RGPD art. 17) ──
            const mdp = MDP(); const reg = await requete(J.url, '/api/auth/register', { methode: 'POST', corps: { username: 'Efface', email: 'efface@exemple.test', password: mdp } });
            const t3 = reg.json && reg.json.token, u3 = reg.json && reg.json.user && reg.json.user.id;
            if (t3) {
                const a3 = (m, p, c) => requete(J.url, '/api' + p, { methode: m, corps: c, jeton: t3 });
                await remplir(a3);
                const lids = (await J.sql('SELECT id FROM lists WHERE user_id = ?', [u3])).map(r => r.id);
                const sup = await a3('POST', '/auth/delete', { password: mdp });
                const reste = await compter(u3);
                const restes = Object.entries(reste).filter(([, n]) => n > 0).map(([t, n]) => `${t} : ${n}`);
                if (lids.length) { const [x] = await J.sql('SELECT COUNT(*) AS n FROM list_items WHERE list_id IN (?)', [lids]); if (x.n) restes.push(`list_items orphelins : ${x.n}`); }
                ctx.mesure('integrite_effacement', { statut: sup.statut, restes });
                if (sup.statut !== 200) T('haute', 'INT-EFFACEMENT-ECHEC', `La suppression du compte répond ${sup.statut}`, sup.texte.slice(0, 200), '');
                if (restes.length) T('haute', 'INT-EFFACEMENT-INCOMPLET', 'Des données restent après la suppression d\'un compte', restes.join('\n'), 'Clé étrangère ON DELETE CASCADE sur chaque table à user_id.', { fichier: 'server/db/migrate.js' });
                const apres = await a3('GET', '/auth/me'); if (apres.statut === 200) T('haute', 'INT-JETON-APRES-EFFACEMENT', 'Le jeton marche encore après la suppression du compte', '', '');
            }
            const fks = await J.sql("SELECT table_name AS t FROM information_schema.key_column_usage WHERE table_schema = 'inko_s_integ' AND column_name = 'user_id' AND referenced_table_name = 'users'");
            const sansFk = tablesUtil.filter(t => !fks.some(f => f.t === t));
            if (sansFk.length) T('moyenne', 'INT-SANS-CLE-ETRANGERE', `${sansFk.length} table(s) à user_id sans clé étrangère vers users`, sansFk.join(', '), 'Ajouter la contrainte avec ON DELETE CASCADE.', { fichier: 'server/db/migrate.js' });

            // ── 4. écritures simultanées ──
            const verdicts = {};
            const salve = async (n, f) => Promise.all(Array.from({ length: n }, (_, i) => f(i)));
            let r = await salve(30, () => appel('POST', '/me/favorites', { mangaId: 'conc-1', source: 'mangadex', title: 'C' }));
            verdicts.favori = { erreurs: r.filter(x => x.statut >= 500).length, lignes: (await J.sql("SELECT COUNT(*) AS n FROM favorites WHERE manga_id = 'conc-1'"))[0].n };
            r = await salve(30, (i) => appel('PUT', '/me/progress/conc-1', { chapterId: 'c' + i, chapter: i, page: 1, source: 'mangadex' }));
            verdicts.progression = { erreurs: r.filter(x => x.statut >= 500).length, lignes: (await J.sql("SELECT COUNT(*) AS n FROM progress WHERE manga_id = 'conc-1'"))[0].n, chapitre: (await J.sql("SELECT chapter_number AS c FROM progress WHERE manga_id = 'conc-1'"))[0].c };
            await appel('PUT', '/me/progress/conc-2', { chapterId: 'c9', chapter: 9, page: 9, source: 'mangadex', clientAt: new Date().toISOString() });
            await appel('PUT', '/me/progress/conc-2', { chapterId: 'c1', chapter: 1, page: 1, source: 'mangadex', clientAt: new Date(Date.now() - 86400000).toISOString() });
            const [vieux] = await J.sql("SELECT chapter_number AS c FROM progress WHERE manga_id = 'conc-2'");
            if (Number(vieux.c) !== 9) T('haute', 'INT-PROGRESSION-RECULE', 'Une progression plus ancienne écrase la plus récente', `chapitre ${vieux.c} au lieu de 9`, 'Comparer clientAt.');
            await appel('PUT', '/me/progress/conc-3', { chapterId: 'c9', chapter: 9, page: 9, source: 'mangadex' });
            await appel('PUT', '/me/progress/conc-3', { chapterId: 'c1', chapter: 1, page: 1, source: 'mangadex' });
            const [sans] = await J.sql("SELECT chapter_number AS c FROM progress WHERE manga_id = 'conc-3'");
            ctx.mesure('integrite_progression_sans_date', Number(sans.c));
            const l = await appel('POST', '/me/lists', { name: 'Conc' }); const lid = l.json.id;
            r = await salve(20, () => appel('POST', `/me/lists/${lid}/items`, { mangaId: 'conc-1' }));
            verdicts.liste = { erreurs: r.filter(x => x.statut >= 500).length, lignes: (await J.sql('SELECT COUNT(*) AS n FROM list_items WHERE list_id = ?', [lid]))[0].n };
            r = await salve(25, () => appel('POST', '/me/temps-lecture', { secondes: 10 }));
            r = await salve(10, () => appel('POST', '/me/lists', { name: 'Même nom' }));
            const [memes] = await J.sql("SELECT COUNT(*) AS n FROM lists WHERE name = 'Même nom'");
            if (memes.n > 1) T('basse', 'INT-LISTES-MEME-NOM', `${memes.n} listes de même nom peuvent coexister (double clic)`, '10 créations simultanées.', 'Bouton désactivé pendant l\'envoi et unicité (user_id, name).');
            r = await salve(10, () => appel('POST', '/me/bookmarks', { mangaId: 'conc-1', chapterId: 'c1', page: 1 }));
            verdicts.signet = { erreurs: r.filter(x => x.statut >= 500).length };
            r = await salve(80, () => appel('GET', '/me/favorites'));
            verdicts.lectures = { erreurs: r.filter(x => x.statut !== 200 && x.statut !== 429).length };
            // code d'appairage et jeton de réinitialisation : une seule utilisation
            const pc = await appel('POST', '/devices/pair-code', {}); const code = pc.json && pc.json.code;
            if (code) { r = await salve(6, (i) => requete(J.url, '/api/devices/pair', { methode: 'POST', corps: { code, nom: 'T' + i } })); verdicts.appairage = { reussites: r.filter(x => x.statut === 201).length, statuts: r.map(x => x.statut) }; if (verdicts.appairage.reussites > 1) T('haute', 'INT-APPAIRAGE-DOUBLE', `Un même code d'appairage a servi ${verdicts.appairage.reussites} fois`, '', 'UPDATE … WHERE used_at IS NULL.'); }
            const f = await requete(J.url, '/api/auth/forgot', { methode: 'POST', corps: { email: 'owner@inko.local' } });
            if (f.json && f.json.token) { r = await salve(6, () => requete(J.url, '/api/auth/reset', { methode: 'POST', corps: { email: moi.email, token: f.json.token, newPassword: MDP() } })); const n = r.filter(x => x.statut === 200).length; verdicts.reinitialisation = { reussites: n }; if (n > 1) T('moyenne', 'INT-RESET-DOUBLE', `Un même lien de réinitialisation a servi ${n} fois (envois simultanés)`, 'SELECT puis UPDATE sans verrou dans resetPassword.', 'UPDATE password_resets SET used = 1 WHERE … AND used = 0, puis vérifier affectedRows avant de changer le mot de passe.', { fichier: 'server/controllers/auth.controller.js' }); }
            ctx.mesure('integrite_simultane', verdicts);
            for (const [k, v] of Object.entries(verdicts)) { if (v.erreurs) T('haute', 'INT-SIMULTANE', `Écritures simultanées (${k}) : ${v.erreurs} erreur(s)`, JSON.stringify(v), 'Transaction ou INSERT … ON DUPLICATE KEY.'); if (v.lignes > 1) T('haute', 'INT-DOUBLON', `Écritures simultanées (${k}) : ${v.lignes} lignes au lieu d'une`, '', 'Clé unique.'); }

            // ── 5. migrations : rejeu, base vide, écart avec la base réelle ──
            const migrer = (base) => cp.spawnSync(process.execPath, ['-e', "require('dotenv').config({quiet:true});require('./db/migrate').ensureSchema().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)})"], { cwd: ctx.abs('server'), env: { ...env, DB_NAME: base }, encoding: 'utf8', timeout: 90000 });
            await J.sql('DELETE FROM schema_migrations');
            const rejeu = migrer('inko_s_integ');
            if (rejeu.status !== 0) T('moyenne', 'INT-MIGRATION-REJEU', 'Rejouer les migrations sur une base à jour échoue', (rejeu.stderr || '').slice(-500), 'Chaque migration doit être rejouable.', { fichier: 'server/db/migrate.js' });
            const schema = async (base) => ({
                col: (await J.sql('SELECT table_name AS t, column_name AS c, column_type AS y, is_nullable AS n FROM information_schema.columns WHERE table_schema = ?', [base])).map(r => `${r.t}.${r.c} ${r.y} ${r.n === 'YES' ? 'NULL' : 'NOT NULL'}`),
                idx: [...new Set((await J.sql('SELECT table_name AS t, index_name AS i, GROUP_CONCAT(column_name ORDER BY seq_in_index) AS c, MIN(non_unique) AS u FROM information_schema.statistics WHERE table_schema = ? GROUP BY table_name, index_name', [base])).map(r => `${r.t} (${r.c})${r.u ? '' : ' unique'}`))],
            });
            const neuf = await schema('inko_s_integ');
            await J.sql('DROP DATABASE IF EXISTS inko_s_vide'); await J.sql('CREATE DATABASE inko_s_vide CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
            try {
                const vide = migrer('inko_s_vide');
                if (vide.status !== 0) T('basse', 'INT-MIGRATION-BASE-VIDE', 'Les migrations seules ne construisent pas la base (schema.sql obligatoire)', (vide.stderr || '').slice(-400), 'Faire de schema.sql la migration 0, ou le documenter et le tester.', { fichier: 'server/db/migrate.js' });
            } finally { await J.sql('DROP DATABASE IF EXISTS inko_s_vide'); }
            const existe = await J.sql("SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = 'inko'");
            if (existe[0].n) {
                const reel = await schema('inko'); // lecture de la structure uniquement
                const diff = (a, b) => a.filter(x => !b.includes(x));
                const manque = diff(neuf.col, reel.col), enTrop = diff(reel.col, neuf.col), idxM = diff(neuf.idx, reel.idx), idxP = diff(reel.idx, neuf.idx);
                ctx.mesure('integrite_ecart_schema', { colonnesAbsentesOuDifferentes: manque, colonnesEnPlus: enTrop, indexAbsents: idxM, indexEnPlus: idxP });
                if (manque.length + enTrop.length + idxM.length + idxP.length) T('moyenne', 'INT-ECART-SCHEMA', `Ta base diffère d'une installation neuve : ${manque.length} colonne(s) et ${idxM.length} index attendus absents ou différents, ${enTrop.length} colonne(s) et ${idxP.length} index en plus`, `Attendu, absent de la base réelle :\n${[...manque, ...idxM].slice(0, 30).join('\n')}\n\nPrésent seulement dans la base réelle :\n${[...enTrop, ...idxP].slice(0, 30).join('\n')}\n\nLa base réelle n'a pas reçu la migration 28 (branche non lancée sur elle) : les lignes favorites_corbeille et events.origine sont normales.`, 'Migration de réalignement.', { fichier: 'server/db/migrate.js' });
            }
        } finally { await J.arreter(); try { fs.rmSync(temp, { recursive: true, force: true }); } catch (e) { /* verrou Windows */ } }
    },
};
