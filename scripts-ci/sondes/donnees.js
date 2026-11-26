// donnees — état RÉEL de la base (lecture seule : SELECT uniquement) et schéma vivant
'use strict';
const path = require('path');
module.exports = {
    nom: 'donnees',
    description: 'Volumétrie, orphelins, doublons, couvertures absentes, sessions, événements, index réels',
    async run(ctx) {
        let mysql;
        try { mysql = require(path.join(ctx.racine, 'server', 'node_modules', 'mysql2', 'promise')); } catch (e) { ctx.trouver({ gravite: 'info', id: 'DATA-SKIP', titre: 'mysql2 introuvable : sonde de données ignorée' }); return; }
        try { require(path.join(ctx.racine, 'server', 'node_modules', 'dotenv')).config({ path: path.join(ctx.racine, 'server', '.env'), quiet: true }); } catch (e) { /* env optionnel */ }
        let c;
        try {
            c = await mysql.createConnection({ host: process.env.DB_HOST || '127.0.0.1', port: +(process.env.DB_PORT || 3306), user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD || '', database: process.env.DB_NAME || 'inko', connectTimeout: 4000 });
        } catch (e) { ctx.trouver({ gravite: 'info', id: 'DATA-SKIP', titre: 'Base injoignable : sonde de données ignorée (' + e.code + ')' }); return; }
        const q = async (sql, p) => { const [r] = await c.query(sql, p); return r; };
        try {
            await c.query('SET SESSION TRANSACTION READ ONLY');
            const tables = await q('SELECT table_name AS t, table_rows AS n, ROUND((data_length+index_length)/1024) AS ko FROM information_schema.tables WHERE table_schema = DATABASE() ORDER BY (data_length+index_length) DESC');
            ctx.mesure('tables_vivantes', tables.map(t => `${t.t}: ~${t.n} lignes, ${t.ko} Ko`));
            const get = async (sql) => (await q(sql))[0] || {};
            const n = async (t) => (await get(`SELECT COUNT(*) AS n FROM \`${t}\``)).n;
            const [users, favs, hist, ev, sess] = [await n('users'), await n('favorites'), await n('read_chapters').catch(() => 0), await n('events').catch(() => 0), await n('sessions').catch(() => 0)];
            ctx.mesure('comptes', { users, favoris: favs, chapitres_lus: hist, evenements: ev, sessions: sess });
            // 1. sessions qui grossissent
            if (sess > 300) ctx.trouver({ gravite: 'moyenne', id: 'DATA-SESSIONS', categorie: 'données', titre: `${sess} lignes dans sessions pour ${users} compte(s)`, correctif: 'La purge doit borner par compte et par ancienneté (DB-01 l\'a déjà traité : vérifier qu\'elle tourne).', effort: 'S' });
            // 2. orphelins (les FK le devraient interdire : on vérifie qu'elles existent vraiment)
            for (const [t, col, parent] of [['favorites', 'user_id', 'users'], ['progress', 'user_id', 'users'], ['read_chapters', 'user_id', 'users'], ['events', 'user_id', 'users'], ['list_items', 'list_id', 'lists'], ['ratings', 'user_id', 'users']]) {
                try { const o = (await get(`SELECT COUNT(*) AS n FROM \`${t}\` x LEFT JOIN \`${parent}\` p ON p.id = x.\`${col}\` WHERE p.id IS NULL`)).n; if (o) ctx.trouver({ gravite: 'haute', id: 'DATA-ORPHELINS', categorie: 'données', titre: `${o} ligne(s) orpheline(s) dans ${t}.${col} → ${parent}`, correctif: 'Clé étrangère manquante sur la base vivante (le schéma dit autre chose) : migration de rattrapage + nettoyage.', effort: 'S' }); } catch (e) { /* table absente */ }
            }
            // 3. favoris : couvertures absentes, sources, doublons de titre
            const sansCover = (await get("SELECT COUNT(*) AS n FROM favorites WHERE cover IS NULL OR cover = ''")).n;
            ctx.mesure('favoris_sans_couverture', sansCover);
            if (sansCover) ctx.trouver({ gravite: 'haute', id: 'DATA-COUVERTURES-VIDES', categorie: 'couvertures', titre: `${sansCover}/${favs} favori(s) sans aucune URL de couverture enregistrée`, correctif: 'Le repli (MangaDex → AniList → Kitsu) doit aussi servir à REMPLIR cette colonne à l\'ajout et en tâche de fond.', effort: 'M' });
            const parSource = await q('SELECT source, COUNT(*) AS n FROM favorites GROUP BY source ORDER BY n DESC');
            ctx.mesure('favoris_par_source', parSource);
            const hotes = {};
            for (const r of await q("SELECT cover FROM favorites WHERE cover LIKE 'http%'")) { try { const h = new URL(r.cover).host; hotes[h] = (hotes[h] || 0) + 1; } catch (e) { /* url invalide */ } }
            ctx.mesure('hotes_de_couvertures', hotes);
            const doublons = await q('SELECT LOWER(title) AS t, COUNT(*) AS n FROM favorites WHERE user_id = (SELECT MIN(id) FROM users) GROUP BY LOWER(title) HAVING n > 1 ORDER BY n DESC LIMIT 15').catch(() => []);
            if (doublons.length) ctx.trouver({ gravite: 'basse', id: 'DATA-DOUBLONS-TITRE', categorie: 'données', titre: `${doublons.length} titre(s) présent(s) plusieurs fois dans la bibliothèque (sources différentes)`, detail: doublons.map(d => `${d.t} ×${d.n}`).join('\n'), correctif: 'La détection de doublons existe (doublons.js) : l\'afficher au moment de l\'ajout.', effort: 'M' });
            // 4. événements : volume et ancienneté
            if (ev > 20000) ctx.trouver({ gravite: 'moyenne', id: 'DATA-EVENEMENTS', categorie: 'données', titre: `${ev} événements stockés sans purge visible`, correctif: 'Rétention (180 j) + agrégation mensuelle pour les statistiques.', effort: 'M' });
            const types = await q('SELECT type, COUNT(*) AS n, MIN(created_at) AS min, MAX(created_at) AS max FROM events GROUP BY type ORDER BY n DESC LIMIT 12').catch(() => []);
            ctx.mesure('evenements_par_type', types.map(t => `${t.type}: ${t.n}`));
            // 5. suppression en masse de favoris (incident du 9 novembre)
            const rm = await q("SELECT DATE(created_at) AS j, COUNT(*) AS n FROM events WHERE type LIKE '%fav%remove%' OR type LIKE '%unfav%' OR type = 'favorite_remove' GROUP BY DATE(created_at) HAVING n >= 20 ORDER BY n DESC LIMIT 5").catch(() => []);
            if (rm.length) ctx.trouver({ gravite: 'haute', id: 'DATA-SUPPRESSION-MASSE', categorie: 'données', titre: 'Journées avec ≥ 20 retraits de favoris (suppression de masse)', detail: rm.map(r => `${String(r.j).slice(0, 10)} : ${r.n}`).join('\n'), correctif: 'Corbeille 30 j + confirmation au-delà de N retraits/minute + garde côté API (refuser > 10 suppressions en 5 s sans en-tête de confirmation).', effort: 'M' });
            // 6. index réels : tables sans index secondaire alors que grosses
            for (const t of tables.filter(t => t.n > 2000)) {
                const idx = await q(`SHOW INDEX FROM \`${t.t}\``).catch(() => []);
                const noms = new Set(idx.map(i => i.Key_name));
                if (noms.size <= 1) ctx.trouver({ gravite: 'moyenne', id: 'DATA-INDEX-MANQUANT', categorie: 'performance', titre: `${t.t} (~${t.n} lignes) n'a que sa clé primaire`, correctif: 'Index sur les colonnes de filtre/tri réelles (voir EXPLAIN des requêtes de stats).', effort: 'S' });
            }
            // 7. sauvegardes
            const fs = require('fs'); const bdir = path.join(ctx.racine, 'server', 'backups');
            if (fs.existsSync(bdir)) {
                const fichiers = fs.readdirSync(bdir).filter(f => f.endsWith('.json')).map(f => ({ f, t: fs.statSync(path.join(bdir, f)).mtimeMs })).sort((a, b) => b.t - a.t);
                ctx.mesure('sauvegardes', { nombre: fichiers.length, derniere: fichiers[0] && new Date(fichiers[0].t).toISOString() });
                if (fichiers[0] && Date.now() - fichiers[0].t > 3 * 86400000) ctx.trouver({ gravite: 'haute', id: 'DATA-SAUVEGARDE-ANCIENNE', categorie: 'données', titre: `Dernière sauvegarde : ${new Date(fichiers[0].t).toISOString().slice(0, 10)} (> 3 jours)`, correctif: 'La sauvegarde nocturne ne tourne que serveur allumé : sauvegarder aussi à la fermeture de l\'app et avant toute migration.', effort: 'S' });
            } else ctx.trouver({ gravite: 'haute', id: 'DATA-PAS-DE-SAUVEGARDE', titre: 'Aucun dossier de sauvegardes', effort: 'S' });
            // 8. charset
            const cs = await q("SELECT table_name AS t, table_collation AS c FROM information_schema.tables WHERE table_schema = DATABASE() AND table_collation NOT LIKE 'utf8mb4%'");
            if (cs.length) ctx.trouver({ gravite: 'moyenne', id: 'DATA-COLLATION', categorie: 'données', titre: `${cs.length} table(s) hors utf8mb4 (emoji et caractères CJK tronqués)`, detail: cs.map(x => `${x.t}: ${x.c}`).join('\n'), effort: 'S' });
        } finally { await c.end(); }
    },
};
