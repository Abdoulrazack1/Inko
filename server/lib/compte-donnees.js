// ============================================================
// lib/compte-donnees.js — TOUTES les données d'un compte, une seule fois
// ------------------------------------------------------------
// DAT-15 / DAT-16. L'export, l'import, la sauvegarde nocturne et le script de
// restauration tenaient chacun SA liste de tables, écrite à la main. Aucune
// n'était complète, et elles divergeaient : rejoué sur un serveur d'essai,
// une sauvegarde puis restauration perdait signets, notes du carnet, liens
// AniList, temps de lecture, historique, activité et commentaires ; un export
// puis import perdait aussi les listes et les réglages, qui étaient pourtant
// DANS le fichier. Les dates d'ajout étaient remises à zéro.
//
// Ici la liste n'est plus écrite : ce sont les tables qui portent `user_id`,
// lues dans la base. Une table ajoutée demain par une migration est donc
// sauvegardée sans que personne ait à y penser. Seul ce qui NE DOIT PAS
// voyager est nommé (sessions, appareils, codes à usage unique…).
// ============================================================
'use strict';
const { pool } = require('../config/db');

// Ce qui reste attaché à CETTE installation, ou n'a plus d'usage.
const EXCLUES = new Set([
    'sessions', 'password_resets', 'pair_codes', 'devices', 'device_push_tokens', 'progress_devices',
    'source_migrations', 'spotify_accounts', 'library', 'local_imports',
]);
// Les fichiers importés vivent sur le disque du hub (server/uploads) : ils ne
// tiennent pas dans un fichier JSON. Leur liste est jointe pour qu'on sache ce
// qu'il faut copier à part (DAT-19).
const FICHIERS = 'local_imports';
const COMPTE = ['avatar', 'bio', 'notif_every_hours'];

let _schema = null;
async function schema() {
    if (_schema && _schema.at > Date.now() - 60_000) return _schema;
    const [cols] = await pool.query(
        `SELECT table_name AS t, column_name AS c, column_key AS k, extra AS e, data_type AS d
           FROM information_schema.columns WHERE table_schema = DATABASE()
          ORDER BY table_name, ordinal_position`);
    const tables = {};
    for (const x of cols) {
        const t = tables[x.t] || (tables[x.t] = { colonnes: [], pk: [], auto: null, json: new Set(), generees: new Set() });
        t.colonnes.push(x.c);
        if (x.k === 'PRI') t.pk.push(x.c);
        if (/auto_increment/i.test(x.e)) t.auto = x.c;
        if (/(virtual|stored) generated/i.test(x.e)) t.generees.add(x.c);
        if (x.d === 'json') t.json.add(x.c);
    }
    _schema = { at: Date.now(), tables };
    return _schema;
}

const tablesDuCompte = (s) => Object.keys(s.tables).filter(t => s.tables[t].colonnes.includes('user_id') && !EXCLUES.has(t)).sort();

/** Photographie complète d'un compte. */
async function exporter(uid) {
    const s = await schema();
    const tables = {};
    for (const t of tablesDuCompte(s)) {
        const [lignes] = await pool.query(`SELECT * FROM \`${t}\` WHERE user_id = ?`, [uid]);
        tables[t] = lignes.map(({ user_id, ...reste }) => reste);
    }
    if (s.tables.list_items && tables.lists) {
        const ids = tables.lists.map(l => l.id);
        tables.list_items = ids.length ? (await pool.query('SELECT * FROM list_items WHERE list_id IN (?)', [ids]))[0] : [];
    }
    let fichiers = [];
    if (s.tables[FICHIERS]) [fichiers] = await pool.query(`SELECT id, title, type, filename, size, created_at FROM \`${FICHIERS}\` WHERE user_id = ?`, [uid]);
    const [[u]] = await pool.query(`SELECT ${COMPTE.filter(c => s.tables.users.colonnes.includes(c)).map(c => `\`${c}\``).join(', ') || '1'} FROM users WHERE id = ?`, [uid]);
    return { tables, compte: u || {}, fichiersImportes: fichiers };
}

// Une date ISO lue dans un fichier JSON redevient un objet Date : MySQL refuse
// le « Z » final dans une colonne TIMESTAMP. Un objet (colonne JSON) repart
// en texte : `mysql2` transformerait sinon `{a: 1}` en « a = 1 ».
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
function valeur(v, json) {
    if (v === undefined) return null;
    if (json && v !== null && typeof v === 'object') return JSON.stringify(v);
    if (typeof v === 'string' && ISO.test(v)) return new Date(v);
    if (v !== null && typeof v === 'object' && !(v instanceof Date)) return JSON.stringify(v);
    return v;
}
const signature = (l, cols) => JSON.stringify(cols.map(c => { const v = l[c]; return v instanceof Date ? v.toISOString() : (v !== null && typeof v === 'object' ? JSON.stringify(v) : v == null ? null : String(v)); }));

/**
 * Rend à un compte ce que contient une photographie `exporter`, sans rien
 * effacer : ce qui existe est mis à jour, ce qui manque est ajouté, et ce qui
 * est déjà là à l'identique n'est pas dupliqué (réimporter deux fois son
 * propre fichier ne double ni l'activité ni les notes).
 * @returns {Object} nombre de lignes rendues par table
 */
async function importer(uid, photo) {
    const s = await schema();
    const autorisees = new Set(tablesDuCompte(s));
    const rendu = {};
    const listes = new Map(), commentaires = new Map();
    // Les listes d'abord (les éléments s'y rattachent), les commentaires dans
    // l'ordre (une réponse vient après son parent).
    const ordre = Object.keys(photo.tables || {}).filter(t => autorisees.has(t))
        .sort((a, b) => (a === 'lists' ? -1 : b === 'lists' ? 1 : 0));
    for (const t of ordre) {
        const def = s.tables[t];
        const lignes = (photo.tables[t] || []).filter(l => l && typeof l === 'object');
        if (t === 'comments') lignes.sort((a, b) => (a.parent_id ? 1 : 0) - (b.parent_id ? 1 : 0) || (a.id || 0) - (b.id || 0));
        const cols = def.colonnes.filter(c => c !== 'user_id' && c !== def.auto && !def.generees.has(c));
        let existants = null;
        if (def.auto) {
            // Sans clé naturelle : on reconnaît une ligne déjà présente à son contenu.
            const [deja] = await pool.query(`SELECT * FROM \`${t}\` WHERE user_id = ?`, [uid]);
            existants = new Map(deja.map(l => [signature(l, cols.filter(c => c !== 'parent_id')), l[def.auto]]));
        }
        let n = 0;
        for (const l of lignes) {
            const presentes = cols.filter(c => Object.prototype.hasOwnProperty.call(l, c));
            if (!presentes.length) continue;
            const ligne = { ...l };
            if (t === 'comments' && ligne.parent_id) ligne.parent_id = commentaires.get(ligne.parent_id) || null;
            if (def.auto) {
                const sig = signature(ligne, cols.filter(c => c !== 'parent_id'));
                if (existants.has(sig)) {
                    if (t === 'lists') listes.set(l.id, existants.get(sig));
                    if (t === 'comments') commentaires.set(l.id, existants.get(sig));
                    continue;
                }
            }
            const valeurs = presentes.map(c => valeur(ligne[c], def.json.has(c)));
            const maj = presentes.filter(c => !def.pk.includes(c));
            try {
                const [r] = await pool.query(
                    `INSERT INTO \`${t}\` (user_id, ${presentes.map(c => `\`${c}\``).join(', ')}) VALUES (?, ${presentes.map(() => '?').join(', ')})`
                    + (!def.auto && maj.length ? ` ON DUPLICATE KEY UPDATE ${maj.map(c => `\`${c}\` = VALUES(\`${c}\`)`).join(', ')}` : ''),
                    [uid, ...valeurs]);
                if (t === 'lists') listes.set(l.id, r.insertId);
                if (t === 'comments') commentaires.set(l.id, r.insertId);
                n++;
            } catch (e) {
                // Une ligne abîmée n'emporte pas le reste ; elle est comptée à part.
                rendu[t + '_ignorees'] = (rendu[t + '_ignorees'] || 0) + 1;
            }
        }
        rendu[t] = n;
    }
    // Les éléments de liste, rattachés aux nouvelles listes
    if (s.tables.list_items && Array.isArray(photo.tables && photo.tables.list_items)) {
        const def = s.tables.list_items;
        const cols = def.colonnes.filter(c => c !== 'list_id' && !def.generees.has(c));
        let n = 0;
        for (const l of photo.tables.list_items) {
            const liste = listes.get(l && l.list_id);
            if (!liste) continue;
            const presentes = cols.filter(c => Object.prototype.hasOwnProperty.call(l, c));
            try {
                await pool.query(
                    `INSERT INTO list_items (list_id, ${presentes.map(c => `\`${c}\``).join(', ')}) VALUES (?, ${presentes.map(() => '?').join(', ')})`
                    + ` ON DUPLICATE KEY UPDATE ${presentes.filter(c => !def.pk.includes(c)).map(c => `\`${c}\` = VALUES(\`${c}\`)`).join(', ') || 'list_id = list_id'}`,
                    [liste, ...presentes.map(c => valeur(l[c], def.json.has(c)))]);
                n++;
            } catch (e) { rendu.list_items_ignorees = (rendu.list_items_ignorees || 0) + 1; }
        }
        rendu.list_items = n;
    }
    const compte = photo.compte || {};
    const champs = COMPTE.filter(c => compte[c] !== undefined && s.tables.users.colonnes.includes(c));
    if (champs.length) {
        await pool.query(`UPDATE users SET ${champs.map(c => `\`${c}\` = ?`).join(', ')} WHERE id = ?`, [...champs.map(c => compte[c]), uid]);
    }
    return rendu;
}

module.exports = { exporter, importer, tablesDuCompte, EXCLUES };
