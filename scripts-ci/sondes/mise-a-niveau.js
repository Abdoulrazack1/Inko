// mise-a-niveau — mettre à jour une installation ancienne : pour chaque version publiée, on
// reconstruit sa base avec SON code, on y met des données, puis on lance les migrations
// actuelles. Rien ne doit se perdre, et le schéma doit rejoindre celui d'une installation neuve.
'use strict';
const cp = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const VERSIONS = ['v2.3.4', 'v2.5.0', 'v2.5.7', 'v2.6.1', 'v2.7.0', 'v2.8.0', 'v2.8.2', 'v2.9.0'];
const { sansBaseImposee } = require('./_garde-sql');

module.exports = {
    nom: 'mise-a-niveau',
    description: 'Mise à niveau depuis chaque version publiée : migrations, données conservées, schéma final',
    async run(ctx) {
        const T = (gravite, id, titre, detail, correctif, extra = {}) => ctx.trouver({ gravite, id, categorie: 'mise à niveau', titre, detail, correctif, effort: 'M', fichier: 'server/db/migrate.js', ...extra });
        const mysql = require(path.join(ctx.racine, 'server', 'node_modules', 'mysql2', 'promise'));
        require(path.join(ctx.racine, 'server', 'node_modules', 'dotenv')).config({ path: ctx.abs('server', '.env'), quiet: true });
        const admin = await mysql.createConnection({ host: process.env.DB_HOST || '127.0.0.1', port: +(process.env.DB_PORT || 3306), user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD || '', multipleStatements: true });
        const dossiers = [];
        const releves = {};
        const migrer = (racineServeur, base) => cp.spawnSync(process.execPath, ['-e', "require('./db/migrate').ensureSchema().then(()=>process.exit(0)).catch(e=>{console.error('ECHEC '+(e.code||'')+' '+e.message);process.exit(1)})"], { cwd: racineServeur, env: { ...process.env, DB_NAME: base, DISABLE_BACKUPS: '1' }, encoding: 'utf8', timeout: 120000 });
        const colonnes = async (base) => (await admin.query('SELECT table_name AS t, column_name AS c, column_type AS y FROM information_schema.columns WHERE table_schema = ?', [base]))[0].map(r => `${r.t}.${r.c} ${r.y}`);
        const index = async (base) => [...new Set((await admin.query('SELECT table_name AS t, index_name AS i, GROUP_CONCAT(column_name ORDER BY seq_in_index) AS c FROM information_schema.statistics WHERE table_schema = ? GROUP BY table_name, index_name', [base]))[0].map(r => `${r.t} (${r.c})`))];
        const creer = async (base, schema) => { await admin.query(`DROP DATABASE IF EXISTS \`${base}\``); await admin.query(`CREATE DATABASE \`${base}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`); await admin.query(`USE \`${base}\``); await admin.query(sansBaseImposee(schema, base)); };
        try {
            await creer('inko_s_neuf', fs.readFileSync(ctx.abs('server', 'db', 'schema.sql'), 'utf8'));
            const n0 = migrer(ctx.abs('server'), 'inko_s_neuf');
            if (n0.status !== 0) { T('critique', 'MAN-INSTALLATION-NEUVE', 'Les migrations échouent sur une installation neuve', (n0.stderr || '').slice(-500), ''); return; }
            const neuf = { col: await colonnes('inko_s_neuf'), idx: await index('inko_s_neuf') };
            for (const v of VERSIONS) {
                const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'inko-' + v + '-')); dossiers.push(dir);
                const archive = path.join(dir, 's.tar');
                const a = cp.spawnSync('git', ['archive', '--format=tar', '-o', archive, v, 'server'], { cwd: ctx.racine, encoding: 'utf8' });
                if (a.status !== 0) { releves[v] = 'étiquette absente'; continue; }
                cp.spawnSync('tar', ['-xf', 's.tar'], { cwd: dir });
                const serveur = path.join(dir, 'server');
                if (!fs.existsSync(path.join(serveur, 'db', 'migrate.js'))) { releves[v] = 'sans migrations'; continue; }
                fs.symlinkSync(ctx.abs('server', 'node_modules'), path.join(serveur, 'node_modules'), 'junction');
                const base = 'inko_s_' + v.replace(/\W/g, '_');
                try {
                    await creer(base, fs.readFileSync(path.join(serveur, 'db', 'schema.sql'), 'utf8'));
                    const ancien = migrer(serveur, base);
                    if (ancien.status !== 0) { releves[v] = 'ancienne version non reconstituée : ' + (ancien.stderr || '').split('\n').find(l => /ECHEC/.test(l)); continue; }
                    // des données comme en écrivait cette version
                    await admin.query(`USE \`${base}\``);
                    const tables = new Set((await admin.query('SELECT table_name AS t FROM information_schema.tables WHERE table_schema = ?', [base]))[0].map(r => r.t));
                    const cols = await colonnes(base);
                    const a1 = (t, c) => cols.some(x => x.startsWith(`${t}.${c} `));
                    const [u] = await admin.query("INSERT INTO users (username, email, password_hash) VALUES ('Ancien', 'ancien@exemple.test', 'x')"); const uid = u.insertId;
                    const poser = async (t, ligne) => { if (!tables.has(t)) return; const k = Object.keys(ligne).filter(c => a1(t, c)); await admin.query(`INSERT INTO \`${t}\` (${k.join(',')}) VALUES (${k.map(() => '?').join(',')})`, k.map(c => ligne[c])); };
                    const titreLong = 'Œuvre ancienne 漫画 ' + 'é'.repeat(120);
                    for (let i = 1; i <= 5; i++) await poser('favorites', { user_id: uid, manga_id: 'm' + i, source: 'mangadex', title: i === 5 ? titreLong : 'Œuvre ' + i, cover: 'https://exemple.test/' + i + '.jpg', category: i === 1 ? 'À relire' : null });
                    await poser('library', { user_id: uid, manga_id: 'm2', status: 'completed' }); await poser('library', { user_id: uid, manga_id: 'm9', status: 'planned' });
                    await poser('progress', { user_id: uid, manga_id: 'm1', chapter_id: 'c7', chapter_number: 7.5, page: 12, source: 'mangadex' });
                    for (let i = 1; i <= 4; i++) await poser('read_chapters', { user_id: uid, manga_id: 'm1', chapter_id: 'c' + i, chapter_number: i });
                    const [[echelle]] = await admin.query("SELECT COUNT(*) AS n FROM information_schema.check_constraints WHERE constraint_schema = ? AND check_clause LIKE '%10%'", [base]);
                    await poser('ratings', { user_id: uid, manga_id: 'm1', rating: 4, review: 'bien' });
                    await poser('lists', { id: 1, user_id: uid, name: 'Ancienne liste', is_public: 1 }); await poser('list_items', { list_id: 1, manga_id: 'm1', source: 'mangadex', title: 'Œuvre 1' });
                    await poser('user_settings', { user_id: uid, data: JSON.stringify({ userdata: { bookmarks: [{ mangaId: 'm1', chapterId: 'c7', page: 3, at: Date.parse('2026-09-01') }] }, anilistLinks: { m1: { id: 30002 } }, libCategories: ['À relire'] }) });
                    await poser('comments', { user_id: uid, manga_id: 'm1', text: 'ancien commentaire' });
                    // la mise à niveau
                    const t0 = Date.now(); const r = migrer(ctx.abs('server'), base);
                    releves[v] = { migration: r.status === 0 ? 'réussie' : 'ÉCHEC', ms: Date.now() - t0 };
                    if (r.status !== 0) { T('critique', 'MAN-ECHEC', `Mettre à jour depuis ${v} échoue : le serveur ne démarrerait plus`, (r.stderr || '').split('\n').filter(l => /ECHEC|✖|SQL/.test(l)).slice(0, 6).join('\n'), 'Rendre la migration fautive tolérante à l\'état laissé par cette version ; ajouter ce parcours en CI.'); continue; }
                    await admin.query(`USE \`${base}\``);
                    const compte = async (sql) => (await admin.query(sql, [uid]))[0][0].n;
                    const pertes = [];
                    const f = await compte('SELECT COUNT(*) AS n FROM favorites WHERE user_id = ?'); if (f < 5) pertes.push(`favoris ${f}/5`);
                    if (tables.has('library') && !(await compte("SELECT COUNT(*) AS n FROM favorites WHERE user_id = ? AND status = 'completed'"))) pertes.push('statut « terminé » perdu');
                    if (tables.has('library') && !(await compte("SELECT COUNT(*) AS n FROM favorites WHERE user_id = ? AND manga_id = 'm9'"))) pertes.push('statut d\'une série non suivie perdu');
                    if ((await compte("SELECT COUNT(*) AS n FROM progress WHERE user_id = ? AND chapter_number = 7.5 AND page = 12")) !== 1) pertes.push('progression');
                    if (tables.has('read_chapters') && (await compte('SELECT COUNT(*) AS n FROM read_chapters WHERE user_id = ?')) !== 4) pertes.push('chapitres lus');
                    const [notes] = await admin.query('SELECT rating FROM ratings WHERE user_id = ?', [uid]);
                    const attendu = echelle.n ? 4 : 8;
                    if (!notes.length) pertes.push('note perdue'); else if (+notes[0].rating !== attendu) pertes.push(`note ${notes[0].rating} au lieu de ${attendu}`);
                    if ((await compte('SELECT COUNT(*) AS n FROM list_items WHERE list_id IN (SELECT id FROM lists WHERE user_id = ?)')) !== 1) pertes.push('élément de liste');
                    const dansReglages = !cols.some(c => c.startsWith('bookmarks.'));
                    if (dansReglages && !(await compte('SELECT COUNT(*) AS n FROM bookmarks WHERE user_id = ?'))) pertes.push('signet enregistré dans les réglages');
                    if (!cols.some(c => c.startsWith('anilist_links.')) && !(await compte('SELECT COUNT(*) AS n FROM anilist_links WHERE user_id = ?'))) pertes.push('lien AniList');
                    releves[v].pertes = pertes;
                    if (pertes.length) T('haute', 'MAN-PERTE', `Mise à jour depuis ${v} : données altérées (${pertes.join(', ')})`, JSON.stringify(releves[v]), 'Corriger la migration concernée.');
                    const col = await colonnes(base), idx = await index(base);
                    const manque = neuf.col.filter(x => !col.includes(x)), manqueIdx = neuf.idx.filter(x => !idx.includes(x)), enTrop = col.filter(x => !neuf.col.includes(x));
                    releves[v].schema = { manquantOuDifferent: manque, indexAbsents: manqueIdx, enTrop };
                    if (manque.length || manqueIdx.length) T('moyenne', 'MAN-SCHEMA', `Mise à jour depuis ${v} : ${manque.length} colonne(s) et ${manqueIdx.length} index d'une installation neuve absents ou différents`, [...manque, ...manqueIdx].slice(0, 20).join('\n'), 'Migration de réalignement.', { effort: 'S' });
                    const encore = migrer(ctx.abs('server'), base);
                    if (encore.status !== 0) T('haute', 'MAN-REDEMARRAGE', `Après mise à jour depuis ${v}, le second démarrage échoue`, (encore.stderr || '').slice(-300), '');
                } finally {
                    await admin.query(`DROP DATABASE IF EXISTS \`${base}\``).catch(() => { });
                }
            }
            ctx.mesure('mise_a_niveau_releves', releves);
            ctx.mesure('mise_a_niveau_versions', Object.values(releves).filter(r => r.migration === 'réussie').length + '/' + VERSIONS.length);
        } finally {
            await admin.query('DROP DATABASE IF EXISTS inko_s_neuf').catch(() => { }); await admin.end();
            for (const d of dossiers) {
                // la jonction vers node_modules est retirée AVANT tout effacement récursif
                const j = path.join(d, 'server', 'node_modules');
                try { if (fs.lstatSync(j).isSymbolicLink()) fs.unlinkSync(j); } catch (e) { /* pas de jonction */ }
                try { fs.lstatSync(j); } catch (e) { fs.rmSync(d, { recursive: true, force: true }); }
            }
        }
    },
};
