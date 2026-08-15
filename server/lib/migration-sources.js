// ============================================================
// lib/migration-sources.js — déménager une œuvre d'une source à l'autre
// ------------------------------------------------------------
// Audit XIII.1. Trois sources d'Inko ne répondent plus ou plus complètement,
// et 13 séries en dépendent (chireads 9, novelfull 3, novelbin 1). Leur
// progression, leurs notes, leurs signets sont toujours en base — mais l'œuvre
// est inatteignable. Sans migration, une source qui casse est une perte sèche.
//
// ── Deux règles gouvernent tout ce fichier ──────────────────
//
// 1. ON NE DEVINE JAMAIS. Le report se fait par NUMÉRO de chapitre, et un
//    numéro sans équivalent en face est signalé, pas rapproché du plus proche.
//    Faire croire à un lecteur qu'il a lu un chapitre qu'il n'a pas lu est
//    exactement le genre d'erreur qu'il ne pourra ni voir ni corriger.
//
// 2. TOUT EST RÉVERSIBLE PENDANT SEPT JOURS. L'état antérieur complet est
//    conservé avant la moindre écriture. Le score qui guide le choix de la
//    cible n'est qu'une heuristique : il faut pouvoir se tromper.
//
// Au-delà de sept jours, la progression a repris sur la nouvelle source :
// restaurer détruirait ce qui a été lu depuis. La fenêtre est donc fermée.
'use strict';

const { pool } = require('../config/db');
const appariement = require('./appariement');

const FENETRE_JOURS = 7;

// `etat_avant` est stocké en JSON : les dates y deviennent des chaînes ISO en
// `Z`, que MySQL refuse telles quelles pour une colonne TIMESTAMP
// (« Incorrect datetime value »). On les rend à `mysql2` sous forme d'objet
// Date, qu'il sait formater. Sans ça, l'annulation échoue — c'est-à-dire
// précisément au moment où l'utilisateur en a besoin.
function dateOuNull(v) {
    if (v == null) return null;
    const d = v instanceof Date ? v : new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
}

// Ce que la migration sait transporter. Chaque entrée est indépendante :
// l'utilisateur coche ce qu'il veut, et un élément qui échoue n'emporte pas
// les autres.
const TRANSPORTABLE = ['favori', 'progression', 'chapitres_lus', 'notes', 'notation', 'signets'];

/**
 * Photographie tout ce qui se rattache à une œuvre, pour un utilisateur.
 * C'est à la fois l'entrée de la migration et son filet de sécurité.
 */
async function etatDe(userId, mangaId) {
    const [[favori]] = await pool.query(
        'SELECT * FROM favorites WHERE user_id = ? AND manga_id = ?', [userId, mangaId]);
    const [[progression]] = await pool.query(
        'SELECT * FROM progress WHERE user_id = ? AND manga_id = ?', [userId, mangaId]);
    const [chapitresLus] = await pool.query(
        'SELECT * FROM read_chapters WHERE user_id = ? AND manga_id = ?', [userId, mangaId]);
    const [notes] = await pool.query(
        'SELECT * FROM reading_notes WHERE user_id = ? AND manga_id = ?', [userId, mangaId]);
    const [[notation]] = await pool.query(
        'SELECT * FROM ratings WHERE user_id = ? AND manga_id = ?', [userId, mangaId]);
    const [signets] = await pool.query(
        'SELECT * FROM bookmarks WHERE user_id = ? AND manga_id = ?', [userId, mangaId]);
    return { favori: favori || null, progression: progression || null, chapitresLus, notes, notation: notation || null, signets };
}

/**
 * Migre une œuvre. Rien n'est écrit avant que l'état antérieur ne soit
 * enregistré — si cette écriture échoue, la migration n'a pas lieu.
 *
 * @param {number} userId
 * @param {{source:string, mangaId:string}} de
 * @param {{source:string, mangaId:string, titre?:string, cover?:string}} vers
 * @param {string[]} conserver  sous-ensemble de TRANSPORTABLE
 * @param {Array} chapitresCible  chapitres de la source d'arrivée : { id, number }
 */
async function migrer(userId, de, vers, conserver, chapitresCible) {
    const garder = new Set((conserver || []).filter(x => TRANSPORTABLE.includes(x)));
    if (!garder.size) {
        const e = new Error('Rien à conserver : la migration n’aurait aucun effet.');
        e.status = 400; throw e;
    }
    if (de.source === vers.source && de.mangaId === vers.mangaId) {
        const e = new Error('La source d’arrivée est la source de départ.');
        e.status = 400; throw e;
    }

    const avant = await etatDe(userId, de.mangaId);
    if (!avant.favori && !avant.progression && !avant.chapitresLus.length) {
        const e = new Error('Rien à migrer pour cette œuvre.');
        e.status = 404; throw e;
    }

    // L'appariement se calcule AVANT toute écriture : s'il ne donne rien, on
    // veut le dire à l'utilisateur sans avoir rien touché.
    // `lib/appariement.js` ne connaît PAS le schéma de la base : on lui passe
    // la forme qu'il documente. Les lignes de `read_chapters` portent
    // `chapter_number` ; la conversion se fait ici, à la frontière, plutôt
    // qu'en élargissant le contrat d'un module qu'on veut pouvoir lire seul.
    const lus = (avant.chapitresLus || []).map(c => ({
        chapterId: c.chapter_id,
        chapter: c.chapter_number,
    }));
    const { reportes, absents } = appariement.apparierChapitres(lus, chapitresCible);
    const parAncienId = new Map(reportes.map(r => [r.ancienId, r]));

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // Le filet, d'abord. `etat_avant` porte l'intégralité de ce qui va être
        // touché : sans lui, l'annulation ne pourrait que supprimer, pas rendre.
        const [ins] = await conn.query(
            `INSERT INTO source_migrations
                (user_id, manga_id, source_avant, id_avant, source_apres, id_apres, etat_avant, reportes, absents)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [userId, de.mangaId, de.source, de.mangaId, vers.source, vers.mangaId,
                JSON.stringify(avant), reportes.length, absents.length]);

        const memeId = de.mangaId === vers.mangaId;

        if (garder.has('favori') && avant.favori) {
            // Le favori porte l'identifiant ET la source : les deux changent.
            // `INSERT … ON DUPLICATE` plutôt qu'un UPDATE, car l'utilisateur
            // peut déjà avoir la série en favori sur la source d'arrivée.
            await conn.query(
                `INSERT INTO favorites (user_id, manga_id, source, title, cover, category, status, status_updated_at, last_chapter)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE source = VALUES(source),
                     title = COALESCE(VALUES(title), title),
                     cover = COALESCE(VALUES(cover), cover),
                     category = COALESCE(VALUES(category), category),
                     status = COALESCE(VALUES(status), status)`,
                [userId, vers.mangaId, vers.source,
                    vers.titre || avant.favori.title, vers.cover || avant.favori.cover,
                    avant.favori.category, avant.favori.status, dateOuNull(avant.favori.status_updated_at),
                    avant.favori.last_chapter]);
            if (!memeId) {
                await conn.query('DELETE FROM favorites WHERE user_id = ? AND manga_id = ?', [userId, de.mangaId]);
            }
        }

        if (garder.has('chapitres_lus') && reportes.length) {
            for (const r of reportes) {
                await conn.query(
                    `INSERT IGNORE INTO read_chapters (user_id, manga_id, chapter_id, chapter_number)
                     VALUES (?, ?, ?, ?)`,
                    [userId, vers.mangaId, r.nouvelId, r.numero]);
            }
            if (!memeId) {
                await conn.query('DELETE FROM read_chapters WHERE user_id = ? AND manga_id = ?', [userId, de.mangaId]);
            }
        }

        if (garder.has('progression') && avant.progression) {
            // La position courante prend le PLUS GRAND numéro effectivement
            // reporté — pas celui d'origine, qui peut ne pas exister en face.
            // La page dans le chapitre n'est pas transportée : deux sources ne
            // découpent pas les planches pareil, et une page inventée renvoie
            // le lecteur au mauvais endroit sans qu'il comprenne.
            const courant = parAncienId.get(avant.progression.chapter_id);
            const meilleur = courant || reportes.reduce(
                (acc, r) => (!acc || r.numero > acc.numero ? r : acc), null);
            if (meilleur) {
                await conn.query(
                    `INSERT INTO progress (user_id, manga_id, chapter_id, chapter_number, page, total_pages, source, updated_at)
                     VALUES (?, ?, ?, ?, 1, NULL, ?, NOW())
                     ON DUPLICATE KEY UPDATE chapter_id = VALUES(chapter_id),
                         chapter_number = VALUES(chapter_number), page = 1,
                         total_pages = NULL, source = VALUES(source), updated_at = NOW()`,
                    [userId, vers.mangaId, meilleur.nouvelId, meilleur.numero, vers.source]);
            }
            if (!memeId) {
                await conn.query('DELETE FROM progress WHERE user_id = ? AND manga_id = ?', [userId, de.mangaId]);
            }
        }

        // Notes, notation : rattachées à l'ŒUVRE, pas au chapitre. Elles
        // suivent l'identifiant sans transformation.
        if (garder.has('notes') && avant.notes.length && !memeId) {
            await conn.query(
                'UPDATE reading_notes SET manga_id = ?, source = ? WHERE user_id = ? AND manga_id = ?',
                [vers.mangaId, vers.source, userId, de.mangaId]);
        }
        if (garder.has('notation') && avant.notation && !memeId) {
            // Clé primaire (user_id, manga_id) : un `UPDATE … SET manga_id`
            // suivi d'un `DELETE … WHERE manga_id = ancien` supprimerait la
            // ligne qu'on vient de déplacer si l'UPDATE avait été ignoré pour
            // cause de doublon. On écrit la cible, puis on retire la source.
            await conn.query(
                `INSERT INTO ratings (user_id, manga_id, rating, review)
                 VALUES (?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE rating = VALUES(rating), review = COALESCE(VALUES(review), review)`,
                [userId, vers.mangaId, avant.notation.rating, avant.notation.review]);
            await conn.query('DELETE FROM ratings WHERE user_id = ? AND manga_id = ?', [userId, de.mangaId]);
        }

        // Signets : ancrés à un chapitre PRÉCIS. On ne reporte que ceux dont le
        // chapitre a trouvé son équivalent ; les autres sont laissés, et
        // comptés dans les avertissements.
        // `bookmarks` n'a pas de clé technique : sa clé primaire est
        // (user_id, manga_id, chapter_id). On INSÈRE donc la version migrée
        // puis on retire l'ancienne, plutôt que de tenter un UPDATE par `id`
        // — qui n'existe pas et ne toucherait aucune ligne.
        let signetsPerdus = 0;
        if (garder.has('signets') && avant.signets.length) {
            for (const s of avant.signets) {
                const r = parAncienId.get(s.chapter_id);
                if (!r) { signetsPerdus++; continue; }
                await conn.query(
                    `INSERT IGNORE INTO bookmarks
                        (user_id, manga_id, chapter_id, source, title, cover, chapter_num, page, label)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [userId, vers.mangaId, r.nouvelId, vers.source,
                        vers.titre || s.title, vers.cover || s.cover, r.numero, s.page, s.label]);
            }
            if (!memeId) {
                await conn.query('DELETE FROM bookmarks WHERE user_id = ? AND manga_id = ?', [userId, de.mangaId]);
            }
        }

        await conn.commit();
        return {
            id: ins.insertId,
            migre: true,
            chapitresReportes: reportes.length,
            chapitresAbsents: absents,
            signetsPerdus,
            reversibleJusquA: new Date(Date.now() + FENETRE_JOURS * 86400e3).toISOString(),
        };
    } catch (e) {
        try { await conn.rollback(); } catch (e2) { /* connexion déjà perdue */ }
        throw e;
    } finally {
        conn.release();
    }
}

/**
 * Annule une migration dans la fenêtre de sept jours : restaure l'état
 * photographié et retire ce qui avait été écrit du côté d'arrivée.
 */
async function annuler(userId, migrationId) {
    const [[m]] = await pool.query(
        'SELECT * FROM source_migrations WHERE id = ? AND user_id = ?', [migrationId, userId]);
    if (!m) { const e = new Error('Migration introuvable.'); e.status = 404; throw e; }
    if (m.annulee_at) { const e = new Error('Cette migration a déjà été annulée.'); e.status = 409; throw e; }

    const age = (Date.now() - new Date(m.created_at).getTime()) / 86400e3;
    if (age > FENETRE_JOURS) {
        // Refus explicite plutôt que restauration silencieuse : au-delà de la
        // fenêtre, la lecture a repris sur la nouvelle source et l'ancien état
        // est devenu FAUX. Restaurer effacerait ce qui a été lu depuis.
        const e = new Error(`Passé ${FENETRE_JOURS} jours, une migration ne peut plus être annulée — ta lecture a repris depuis.`);
        e.status = 409; throw e;
    }

    const avant = typeof m.etat_avant === 'string' ? JSON.parse(m.etat_avant) : m.etat_avant;
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // Retirer d'abord ce que la migration a posé côté arrivée, sinon la
        // restauration se heurterait aux clés uniques.
        if (m.id_apres !== m.id_avant) {
            await conn.query('DELETE FROM favorites     WHERE user_id = ? AND manga_id = ?', [userId, m.id_apres]);
            await conn.query('DELETE FROM progress      WHERE user_id = ? AND manga_id = ?', [userId, m.id_apres]);
            await conn.query('DELETE FROM read_chapters WHERE user_id = ? AND manga_id = ?', [userId, m.id_apres]);
            await conn.query('UPDATE reading_notes SET manga_id = ?, source = ? WHERE user_id = ? AND manga_id = ?',
                [m.id_avant, m.source_avant, userId, m.id_apres]);
            await conn.query('DELETE FROM ratings WHERE user_id = ? AND manga_id = ?', [userId, m.id_apres]);
            await conn.query('DELETE FROM bookmarks WHERE user_id = ? AND manga_id = ?', [userId, m.id_apres]);
        }

        if (avant.favori) {
            const f = avant.favori;
            await conn.query(
                `INSERT INTO favorites (user_id, manga_id, source, title, cover, category, status, status_updated_at, last_chapter)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE source = VALUES(source), title = VALUES(title), cover = VALUES(cover),
                     category = VALUES(category), status = VALUES(status)`,
                [userId, f.manga_id, f.source, f.title, f.cover, f.category, f.status,
                    dateOuNull(f.status_updated_at), f.last_chapter]);
        }
        if (avant.progression) {
            const p = avant.progression;
            await conn.query(
                `INSERT INTO progress (user_id, manga_id, chapter_id, chapter_number, page, total_pages, source, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE chapter_id = VALUES(chapter_id), chapter_number = VALUES(chapter_number),
                     page = VALUES(page), total_pages = VALUES(total_pages), source = VALUES(source), updated_at = VALUES(updated_at)`,
                [userId, p.manga_id, p.chapter_id, p.chapter_number, p.page, p.total_pages, p.source,
                    dateOuNull(p.updated_at) || new Date()]);
        }
        if (avant.notation) {
            await conn.query(
                `INSERT INTO ratings (user_id, manga_id, rating, review) VALUES (?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE rating = VALUES(rating), review = VALUES(review)`,
                [userId, avant.notation.manga_id, avant.notation.rating, avant.notation.review]);
        }
        for (const c of avant.chapitresLus || []) {
            await conn.query(
                'INSERT IGNORE INTO read_chapters (user_id, manga_id, chapter_id, chapter_number) VALUES (?, ?, ?, ?)',
                [userId, c.manga_id, c.chapter_id, c.chapter_number]);
        }
        for (const s of avant.signets || []) {
            await conn.query(
                `INSERT IGNORE INTO bookmarks
                    (user_id, manga_id, chapter_id, source, title, cover, chapter_num, page, label)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [userId, s.manga_id, s.chapter_id, s.source, s.title, s.cover, s.chapter_num, s.page, s.label]);
        }

        await conn.query('UPDATE source_migrations SET annulee_at = NOW() WHERE id = ?', [migrationId]);
        await conn.commit();
        return { annulee: true, mangaId: m.id_avant, source: m.source_avant };
    } catch (e) {
        try { await conn.rollback(); } catch (e2) { /* connexion déjà perdue */ }
        throw e;
    } finally {
        conn.release();
    }
}

/** Migrations encore annulables, les plus récentes d'abord. */
async function annulables(userId) {
    const [rows] = await pool.query(
        `SELECT id, manga_id, source_avant, source_apres, id_apres, reportes, absents, created_at
           FROM source_migrations
          WHERE user_id = ? AND annulee_at IS NULL
            AND created_at > NOW() - INTERVAL ? DAY
          ORDER BY created_at DESC`, [userId, FENETRE_JOURS]);
    return rows;
}

/**
 * Purge les photographies devenues inutiles. `etat_avant` contient la
 * bibliothèque d'une série entière : les garder indéfiniment ferait de cette
 * table le prochain DB-01.
 */
async function purger() {
    try {
        const [r] = await pool.query(
            'DELETE FROM source_migrations WHERE created_at < NOW() - INTERVAL ? DAY', [FENETRE_JOURS * 2]);
        return r.affectedRows || 0;
    } catch (e) {
        console.warn('[migration] purge impossible :', e.message);
        return 0;
    }
}

module.exports = { etatDe, migrer, annuler, annulables, purger, TRANSPORTABLE, FENETRE_JOURS };
