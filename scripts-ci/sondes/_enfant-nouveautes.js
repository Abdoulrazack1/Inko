// Scénario : la tâche de fond des nouveautés, face à une source simulée.
'use strict';
const E = require('./_enfant').preparer();

(async () => {
    const { pool } = E.srv('config', 'db');
    const loader = E.srv('extensions', 'loader');
    const chapitres = (dernier) => Array.from({ length: dernier }, (_, i) => ({ id: 'ch-' + (dernier - i), chapter: dernier - i, publishedAt: new Date(Date.now() - i * 86400000).toISOString() }));
    const fausse = { id: 'fausse', name: 'Source simulée', getChapters: async () => ({ results: chapitres(11) }) };
    loader.get = (id) => (id === 'fausse' ? fausse : null);
    const maj = E.srv('lib', 'updates');
    const compter = async () => (await pool.query("SELECT COUNT(DISTINCT group_key) AS n FROM notifications WHERE type = 'new_chapter'"))[0][0].n;
    const passages = [];
    for (let i = 0; i < 3; i++) {
        await pool.query('UPDATE users SET last_notif_scan = NULL');
        await new Promise((r) => setTimeout(r, 30));          // le mémo des chapitres est réglé à 1 ms
        await maj.backgroundScan();
        await new Promise((r) => setTimeout(r, 1500));        // les mises à jour de favoris partent sans attente
        passages.push(Number(await compter()));
    }
    const [[retard]] = await pool.query('SELECT COUNT(*) AS n FROM favorites WHERE last_chapter = 11');
    await new Promise((r) => setTimeout(r, 2500));            // laisse partir les notifications poussées
    E.dire({ passages, series: E.args.series, aJour: retard.n });
    await pool.end(); process.exit(0);
})().catch((e) => { E.dire({ erreur: e.stack }); process.exit(0); });
