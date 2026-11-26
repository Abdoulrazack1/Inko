// Scénario : migrer une série vers une autre source, puis annuler ; photographier chaque table.
'use strict';
const E = require('./_enfant').preparer();

(async () => {
    const { pool } = E.srv('config', 'db');
    const migrations = E.srv('lib', 'migration-sources');
    const uid = E.args.uid;
    const [tables] = await pool.query(
        `SELECT table_name AS t, GROUP_CONCAT(column_name) AS c FROM information_schema.columns
         WHERE table_schema = DATABASE() GROUP BY table_name HAVING SUM(column_name = 'manga_id') > 0`);
    const photo = async () => {
        const o = {};
        for (const { t, c } of tables) {
            if (/source_migrations/.test(t)) continue;
            const cols = c.split(',');
            const ou = cols.includes('user_id') ? 'WHERE user_id = ?' : t === 'list_items' ? 'WHERE list_id IN (SELECT id FROM lists WHERE user_id = ?)' : '';
            const [lignes] = await pool.query(`SELECT * FROM \`${t}\` ${ou}`, ou ? [uid] : []);
            o[t] = lignes;
        }
        return o;
    };
    // les chapitres 1 à 10 existent en face ; le 12 n'existe pas
    const cibles = Array.from({ length: 10 }, (_, i) => ({ id: 'n-' + (10 - i), chapter: 10 - i }));
    const avant = await photo();
    const r = await migrations.migrer(uid, { source: 'fausse', mangaId: 'ancien' }, { source: 'autre', mangaId: 'nouveau', titre: 'Série suivie' }, migrations.TRANSPORTABLE, cibles);
    const migre = await photo();
    await migrations.annuler(uid, r.id);
    const rendu = await photo();
    E.dire({ resultat: r, avant, migre, rendu });
    await pool.end(); process.exit(0);
})().catch((e) => { E.dire({ erreur: e.stack }); process.exit(0); });
