// migration — déménager une série vers une autre source : qu'est-ce qui suit, qu'est-ce qui
// reste derrière, et « annuler » rend-il exactement l'état d'avant ?
'use strict';
const { demarrer } = require('./_jetable');
const { jouer } = require('./_enfant');

const NOMS = { favorites: 'favori', progress: 'position', read_chapters: 'chapitres lus', reading_notes: 'notes', ratings: 'avis', bookmarks: 'signets', list_items: 'place dans les listes', progress_history: 'historique des positions', events: 'activité', comments: 'commentaires', progress_devices: 'positions par appareil' };
const VOLATILES = new Set(['updated_at', 'last_seen_at']);

module.exports = {
    nom: 'migration',
    description: 'Changement de source d\'une série puis annulation, table par table',
    async run(ctx) {
        const T = (gravite, id, titre, detail, correctif) => ctx.trouver({ gravite, id, categorie: 'données', titre, detail, correctif, effort: 'M', fichier: 'server/lib/migration-sources.js' });
        const J = await demarrer(ctx, { base: 'inko_s_migr', port: 8165 });
        if (!J) return;
        try {
            const m = 'ancien';
            await J.api('POST', '/me/favorites', { mangaId: m, source: 'fausse', title: 'Série suivie' });
            await J.api('PUT', `/me/favorites/${m}/notify`, { notify: false });
            await J.sql("UPDATE favorites SET notify = 0, added_at = '2024-03-01 10:00:00', category = 'À relire', status = 'paused', unread_count = 4 WHERE manga_id = 'ancien'");
            for (let n = 1; n <= 8; n++) await J.api('POST', '/me/read-chapters', { mangaId: m, chapterId: 'a-' + n, chapter: n });
            await J.api('POST', '/me/read-chapters', { mangaId: m, chapterId: 'a-12', chapter: 12 });
            for (const n of [3, 8]) await J.api('PUT', `/me/progress/${m}`, { chapterId: 'a-' + n, chapter: n, page: 5, source: 'fausse' });
            await J.api('POST', '/me/notes', { mangaId: m, source: 'fausse', mangaTitle: 'Série suivie', body: 'Une note', chapterId: 'a-3' });
            await J.api('PUT', `/ratings/${m}`, { rating: 4, review: 'Un avis' });
            await J.api('POST', '/me/bookmarks', { mangaId: m, chapterId: 'a-5', source: 'fausse', chapterNum: 5, page: 2, label: 'Signet', note: 'La phrase à garder' });
            await J.api('POST', '/me/bookmarks', { mangaId: m, chapterId: 'a-12', source: 'fausse', chapterNum: 12, page: 1, label: 'Sans équivalent', note: 'Perdu ?' });
            const liste = await J.api('POST', '/me/lists', { name: 'Ma liste' });
            const idListe = liste.json && (liste.json.id || (liste.json.list && liste.json.list.id));
            if (idListe) await J.api('POST', `/me/lists/${idListe}/items`, { mangaId: m, source: 'fausse', title: 'Série suivie' });
            await J.api('POST', `/comments/${m}`, { body: 'Un commentaire', chapterId: 'a-3' });
            const [u] = await J.sql('SELECT user_id AS id FROM favorites WHERE manga_id = ?', [m]);
            const r = await jouer(ctx, '_enfant-migration.js', 'inko_s_migr', { uid: u.id });
            if (r.erreur) { T('haute', 'MIG-ECHEC', 'La migration échoue sur un compte ordinaire', r.erreur, ''); return; }
            const lignes = (p, t, id) => (p[t] || []).filter(l => l.manga_id === id);
            const restees = Object.keys(r.avant).filter(t => lignes(r.migre, t, 'ancien').length).map(t => `${NOMS[t] || t} : ${lignes(r.migre, t, 'ancien').length} ligne(s) encore attachée(s) à l'ancienne série`);
            if (restees.length) T('haute', 'MIG-LAISSE-DERRIERE', `Changer de source laisse derrière : ${Object.keys(r.avant).filter(t => lignes(r.migre, t, 'ancien').length).map(t => NOMS[t] || t).join(', ')}`, restees.join('\n') + '\nLa série disparaît donc de ses listes, ou y reste sous une source morte.', 'Déplacer aussi les listes, l\'historique, l\'activité et les commentaires.');
            const comparer = (t, avant, apres) => Object.keys(avant).filter(k => !VOLATILES.has(k) && k !== 'manga_id' && String(avant[k]) !== String(apres[k])).map(k => `${NOMS[t] || t}.${k} : ${JSON.stringify(avant[k])} → ${JSON.stringify(apres[k])}`);
            const f0 = lignes(r.avant, 'favorites', 'ancien')[0], f1 = lignes(r.migre, 'favorites', 'nouveau')[0];
            const changes = f0 && f1 ? comparer('favorites', f0, f1).filter(x => /\.(added_at|notify|category|status|unread_count|status_updated_at)/.test(x)) : [];
            if (changes.length) T('moyenne', 'MIG-REGLAGES-PERDUS', 'La série migrée perd ses réglages : date d\'ajout, notifications coupées…', changes.join('\n'), 'Copier toutes les colonnes du favori.');
            // chapitres lus et signets sans équivalent
            const absents = lignes(r.avant, 'read_chapters', 'ancien').length - lignes(r.migre, 'read_chapters', 'nouveau').length - lignes(r.migre, 'read_chapters', 'ancien').length;
            const signets = lignes(r.avant, 'bookmarks', 'ancien').length - lignes(r.migre, 'bookmarks', 'nouveau').length - lignes(r.migre, 'bookmarks', 'ancien').length;
            ctx.mesure('migration_resultat', { ...r.resultat, chapitresSupprimes: absents, signetsSupprimes: signets });
            const ecarts = [];
            for (const t of Object.keys(r.avant)) {
                const a = lignes(r.avant, t, 'ancien'), z = lignes(r.rendu, t, 'ancien');
                if (t === 'events') continue;
                if (a.length !== z.length) { ecarts.push(`${NOMS[t] || t} : ${a.length} ligne(s) avant, ${z.length} après annulation`); continue; }
                const cle = (l) => String(l.id ?? l.chapter_id ?? l.list_id ?? '');
                for (const ligne of a) { const autre = z.find(x => cle(x) === cle(ligne)); if (autre) ecarts.push(...comparer(t, ligne, autre)); }
            }
            ctx.mesure('migration_ecarts_apres_annulation', ecarts);
            if (ecarts.length) T('haute', 'MIG-ANNULATION-INEXACTE', `« Annuler » une migration ne rend pas l'état d'avant (${ecarts.length} écart(s))`, ecarts.slice(0, 20).join('\n'), 'Restaurer toutes les colonnes photographiées.');
        } finally { await J.arreter(); }
    },
};
