// controllers/user.controller.js — user data : favoris, library, progress, lists, comments, events
const { pool } = require('../config/db');
const { notifyMentions, createNotification } = require('../lib/notify');

// Identifiant d'œuvre plausible. Les routes se contentaient d'un `if
// (!mangaId)` : une valeur non-chaîne passait donc au travers et arrivait en
// base sérialisée — un favori réellement enregistré sous l'identifiant
// « [object Object] » a été créé de cette façon (erreur d'appel côté client,
// `addFavorite({mangaId})` au lieu de `addFavorite(mangaId, meta)`).
// Le serveur ne peut pas empêcher un mauvais appel, mais il peut refuser
// d'écrire une donnée qu'aucune source ne produira jamais.
function idOeuvreValide(v) {
    if (typeof v !== 'string') return false;
    const t = v.trim();
    if (!t || t.length > 191) return false;
    return !/^\[object /.test(t) && t !== 'undefined' && t !== 'null';
}

// ── helper events ───────────────────────────────────────────────
async function pushEvent(userId, type, payload = {}) {
    const { mangaId, chapterId, metadata } = payload;
    await pool.query(
        'INSERT INTO events (user_id, type, manga_id, chapter_id, metadata) VALUES (?, ?, ?, ?, ?)',
        [userId, type, mangaId || null, chapterId || null, metadata ? JSON.stringify(metadata) : null]
    );
}

// ──────────────────────────────────────────────────────────────
// FAVORITES
// ──────────────────────────────────────────────────────────────
async function getFavorites(req, res, next) {
    try {
        // Audit DB-02 : le statut vivait dans une table `library` de même clé
        // primaire, ce qui imposait un LEFT JOIN sur la lecture la plus
        // fréquente de l'application. Il est désormais une colonne de
        // `favorites` (migration 7).
        const [rows] = await pool.query(
            `SELECT manga_id, source, title, cover, last_chapter, category, added_at, status
             FROM favorites
             WHERE user_id = ? ORDER BY added_at DESC`,
            [req.user.id]
        );
        res.json(rows.map(r => ({
            mangaId: r.manga_id, source: r.source || 'mangadex',
            title: r.title, cover: r.cover, lastChapter: r.last_chapter,
            category: r.category || null, status: r.status || null,
            addedAt: r.added_at,
        })));
    } catch (e) { next(e); }
}

async function addFavorite(req, res, next) {
    try {
        const { mangaId, source, title, cover } = req.body;
        if (!idOeuvreValide(mangaId)) return res.status(400).json({ error: 'mangaId invalide' });
        await pool.query(
            `INSERT INTO favorites (user_id, manga_id, source, title, cover)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE source = VALUES(source),
                title = COALESCE(VALUES(title), title),
                cover = COALESCE(VALUES(cover), cover)`,
            [req.user.id, mangaId, source || 'mangadex', title || null, cover || null]
        );
        await pushEvent(req.user.id, 'favorite', { mangaId });
        res.json({ ok: true });
    } catch (e) { next(e); }
}

async function removeFavorite(req, res, next) {
    try {
        await pool.query(
            'DELETE FROM favorites WHERE user_id = ? AND manga_id = ?',
            [req.user.id, req.params.mangaId]
        );
        await pushEvent(req.user.id, 'unfavorite', { mangaId: req.params.mangaId });
        res.json({ ok: true });
    } catch (e) { next(e); }
}

// Assigne une catégorie à un favori (crée le favori s'il n'existe pas)
async function setFavoriteCategory(req, res, next) {
    try {
        const { category, title, cover, source } = req.body;
        await pool.query(
            `INSERT INTO favorites (user_id, manga_id, category, title, cover, source)
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE category = VALUES(category),
                title = COALESCE(title, VALUES(title)), cover = COALESCE(cover, VALUES(cover))`,
            [req.user.id, req.params.mangaId, category || null, title || null, cover || null, source || 'mangadex']
        );
        res.json({ ok: true });
    } catch (e) { next(e); }
}

// ──────────────────────────────────────────────────────────────
// LIBRARY (status par manga)
// ──────────────────────────────────────────────────────────────
async function getLibrary(req, res, next) {
    try {
        // `library.rating` a été supprimée (migration 5) : c'était une colonne
        // morte, jamais renseignée, doublon de la table `ratings` qui porte la
        // note, l'avis et l'horodatage. On garde `rating: null` dans la réponse
        // pour ne pas casser un client qui lirait encore ce champ.
        //
        // Audit DB-02 : la table `library` elle-même a fusionné dans
        // `favorites` (migration 7). « Être dans la bibliothèque avec un
        // statut » = une ligne de favoris dont `status` n'est pas NULL. La
        // forme de la réponse ne change pas.
        const [rows] = await pool.query(
            `SELECT manga_id, status, added_at, status_updated_at FROM favorites
             WHERE user_id = ? AND status IS NOT NULL ORDER BY status_updated_at DESC`,
            [req.user.id]
        );
        res.json(rows.map(r => ({
            mangaId: r.manga_id, status: r.status, rating: null,
            addedAt: r.added_at, updatedAt: r.status_updated_at,
        })));
    } catch (e) { next(e); }
}

async function setLibraryStatus(req, res, next) {
    try {
        const { status, rating } = req.body;
        const valid = ['reading', 'completed', 'planned', 'paused', 'dropped'];
        if (status && !valid.includes(status))
            return res.status(400).json({ error: 'Statut invalide' });

        // Audit DB-02 : retirer le statut ne supprime plus une ligne d'une
        // table dédiée — c'est le champ qui repasse à NULL. Le favori, lui,
        // reste : perdre son titre et sa couverture parce qu'on a effacé un
        // statut serait une régression.
        if (!status) {
            await pool.query(
                'UPDATE favorites SET status = NULL, status_updated_at = NULL WHERE user_id = ? AND manga_id = ?',
                [req.user.id, req.params.mangaId]);
            return res.json({ ok: true, removed: true });
        }

        // La note n'est plus stockée ici (colonne supprimée, migration 5) :
        // elle appartient à la table `ratings`, via PUT /me/ratings/:mangaId.
        //
        // L'INSERT ... ON DUPLICATE KEY crée le favori s'il n'existe pas :
        // poser un statut sur une série revient à la mettre dans sa
        // bibliothèque. C'était déjà ce que l'interface montrait — elle
        // n'affiche que `favorites`, donc un statut sans favori n'était visible
        // nulle part.
        await pool.query(
            `INSERT INTO favorites (user_id, manga_id, status, status_updated_at)
             VALUES (?, ?, ?, CURRENT_TIMESTAMP)
             ON DUPLICATE KEY UPDATE status = VALUES(status), status_updated_at = CURRENT_TIMESTAMP`,
            [req.user.id, req.params.mangaId, status]
        );
        await pushEvent(req.user.id, 'status_change',
            { mangaId: req.params.mangaId, metadata: { status, rating } });
        res.json({ ok: true });
    } catch (e) { next(e); }
}

// ──────────────────────────────────────────────────────────────
// PROGRESS
// ──────────────────────────────────────────────────────────────
async function getAllProgress(req, res, next) {
    try {
        const [rows] = await pool.query(
            'SELECT manga_id, chapter_id, chapter_number, page, total_pages, source, updated_at FROM progress WHERE user_id = ? ORDER BY updated_at DESC',
            [req.user.id]
        );
        const map = {};
        rows.forEach(r => {
            map[r.manga_id] = {
                chapterId:  r.chapter_id,
                chapter:    r.chapter_number,
                page:       r.page,
                totalPages: r.total_pages || null,   // audit HIST2
                source:     r.source || null,
                updatedAt:  r.updated_at,
            };
        });
        res.json(map);
    } catch (e) { next(e); }
}

async function setProgress(req, res, next) {
    try {
        const { chapterId, chapter, page, totalPages, source } = req.body;
        const mangaId = req.params.mangaId;
        // total_pages (audit HIST2) : persiste le vrai nombre de pages du
        // chapitre pour que le profil calcule un % exact au lieu de deviner 20.
        const tp = Number.isFinite(parseInt(totalPages, 10)) && parseInt(totalPages, 10) > 0
            ? parseInt(totalPages, 10) : null;
        // Audit AMEL-29 : le dernier écrivain gagnait, sans comparaison de
        // dates. Deux appareils qui lisent la même série — un téléphone hors
        // ligne qui rejoue sa file au retour du réseau, une tablette restée
        // ouverte — pouvaient donc faire RECULER la progression : l'écriture
        // arrivée en dernier écrasait la plus avancée.
        //
        // `updated_at` sert d'arbitre. `clientAt` est la date à laquelle le
        // client a réellement lu ; sans elle on retombe sur l'heure du serveur,
        // ce qui reste le comportement d'avant.
        //
        // La comparaison est faite DANS le UPDATE, pas en JS : deux requêtes
        // concurrentes sur la même ligne s'entrelaceraient entre le SELECT et
        // l'UPDATE, et on retomberait sur le défaut qu'on corrige.
        const clientAt = Number.isFinite(Date.parse(req.body.clientAt || ''))
            ? new Date(req.body.clientAt) : null;
        await pool.query(
            `INSERT INTO progress (user_id, manga_id, chapter_id, chapter_number, page, total_pages, source, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))
             ON DUPLICATE KEY UPDATE
                chapter_id     = IF(VALUES(updated_at) >= updated_at, VALUES(chapter_id),     chapter_id),
                chapter_number = IF(VALUES(updated_at) >= updated_at, VALUES(chapter_number), chapter_number),
                page           = IF(VALUES(updated_at) >= updated_at, VALUES(page),           page),
                total_pages    = IF(VALUES(updated_at) >= updated_at, VALUES(total_pages),    total_pages),
                source         = IF(VALUES(updated_at) >= updated_at, COALESCE(VALUES(source), source), source),
                updated_at     = GREATEST(updated_at, VALUES(updated_at))`,
            [req.user.id, mangaId, chapterId || null, chapter || null, page || 1, tp, source || null, clientAt]
        );
        await enregistrerHistorique(req.user.id, mangaId, chapterId, chapter, page, source);
        await pushEvent(req.user.id, 'read',
            { mangaId, chapterId, metadata: { chapter, page } });
        res.json({ ok: true });
    } catch (e) { next(e); }
}

// ── Historique de progression (audit AMEL-28) ────────────────
// `progress` ne garde qu'une ligne par (compte, série) : ouvrir par erreur le
// chapitre 1 d'une série lue au chapitre 300 écrasait définitivement la
// position. On conserve une trace, mais UNIQUEMENT aux changements de chapitre
// — enregistrer chaque page tournée produirait des milliers de lignes par série
// sans rien apporter : ce qu'on veut retrouver, c'est « j'étais au chapitre
// 300 », pas « page 14 ».
const HISTO_MAX = 20;

async function enregistrerHistorique(userId, mangaId, chapterId, chapter, page, source) {
    if (!chapterId) return;
    try {
        const [[dernier]] = await pool.query(
            `SELECT chapter_id FROM progress_history
             WHERE user_id = ? AND manga_id = ? ORDER BY recorded_at DESC, id DESC LIMIT 1`,
            [userId, mangaId]);
        if (dernier && dernier.chapter_id === chapterId) return;   // même chapitre : rien à noter

        await pool.query(
            `INSERT INTO progress_history (user_id, manga_id, chapter_id, chapter_number, page, source)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [userId, mangaId, chapterId, chapter || null, page || 1, source || null]);

        // Purge bornée : sans elle, une longue série accumulerait indéfiniment.
        // On garde les 20 dernières positions, ce qui couvre largement le
        // « je viens de perdre ma place » sans devenir un journal de lecture.
        await pool.query(
            `DELETE FROM progress_history
             WHERE user_id = ? AND manga_id = ?
               AND id NOT IN (
                   SELECT id FROM (
                       SELECT id FROM progress_history
                       WHERE user_id = ? AND manga_id = ?
                       ORDER BY recorded_at DESC, id DESC LIMIT ?
                   ) AS derniers
               )`,
            [userId, mangaId, userId, mangaId, HISTO_MAX]);
    } catch (e) {
        // L'historique est un filet de sécurité, pas une donnée critique : son
        // échec ne doit jamais empêcher d'enregistrer la progression elle-même.
        console.warn('[progress] historique non enregistré :', e.code || e.message);
    }
}

// GET /api/me/progress/:mangaId/history — positions précédentes
async function getProgressHistory(req, res, next) {
    try {
        const [rows] = await pool.query(
            `SELECT chapter_id, chapter_number, page, source, recorded_at
             FROM progress_history WHERE user_id = ? AND manga_id = ?
             ORDER BY recorded_at DESC, id DESC LIMIT ?`,
            [req.user.id, req.params.mangaId, HISTO_MAX]);
        res.json(rows.map(r => ({
            chapterId: r.chapter_id, chapter: r.chapter_number,
            page: r.page, source: r.source, at: r.recorded_at,
        })));
    } catch (e) { next(e); }
}

// Retire une œuvre de "reprendre la lecture" (efface sa progression)
async function deleteProgress(req, res, next) {
    try {
        await pool.query('DELETE FROM progress WHERE user_id = ? AND manga_id = ?',
            [req.user.id, req.params.mangaId]);
        res.json({ ok: true });
    } catch (e) { next(e); }
}

// ──────────────────────────────────────────────────────────────
// READ CHAPTERS
// ──────────────────────────────────────────────────────────────
async function getReadChapters(req, res, next) {
    try {
        const [rows] = await pool.query(
            'SELECT manga_id, chapter_id, chapter_number, read_at FROM read_chapters WHERE user_id = ? ORDER BY read_at DESC',
            [req.user.id]
        );
        const byManga = {};
        rows.forEach(r => {
            byManga[r.manga_id] = byManga[r.manga_id] || [];
            byManga[r.manga_id].push({ chapterId: r.chapter_id, chapter: r.chapter_number, readAt: r.read_at });
        });
        res.json(byManga);
    } catch (e) { next(e); }
}

async function markChapter(req, res, next) {
    try {
        const { mangaId, chapterId, chapter, read = true } = req.body;
        if (!mangaId || !chapterId) return res.status(400).json({ error: 'mangaId et chapterId requis' });
        if (read) {
            const [r] = await pool.query(
                `INSERT IGNORE INTO read_chapters (user_id, manga_id, chapter_id, chapter_number)
                 VALUES (?, ?, ?, ?)`,
                [req.user.id, mangaId, chapterId, chapter || null]
            );
            if (r.affectedRows) await pushEvent(req.user.id, 'read', { mangaId, chapterId, chapter });
        } else {
            await pool.query(
                'DELETE FROM read_chapters WHERE user_id = ? AND chapter_id = ?',
                [req.user.id, chapterId]
            );
        }
        res.json({ ok: true });
    } catch (e) { next(e); }
}

// Marque plusieurs chapitres lus en un seul appel (ex. "marquer jusqu'ici")
async function markChaptersBulk(req, res, next) {
    try {
        const { mangaId, chapters } = req.body;
        if (!mangaId || !Array.isArray(chapters) || !chapters.length)
            return res.status(400).json({ error: 'mangaId et chapters[] requis' });
        const values = chapters
            .filter(c => c && c.chapterId)
            .map(c => [req.user.id, mangaId, c.chapterId, (c.chapter ?? null)]);
        if (!values.length) return res.json({ ok: true, count: 0 });
        await pool.query(
            'INSERT IGNORE INTO read_chapters (user_id, manga_id, chapter_id, chapter_number) VALUES ?',
            [values]
        );
        res.json({ ok: true, count: values.length });
    } catch (e) { next(e); }
}

// POST /me/read-chapters/unmark-bulk — annulation d'un marquage (audit AMEL-40)
// « Marquer tout comme lu » touche des centaines de chapitres d'un coup et
// n'avait AUCUN retour arrière : un clic malheureux effaçait la frontière entre
// lu et non lu, qui est la donnée la plus longue à reconstituer.
// Le démarquage un par un existait, mais 1 183 requêtes pour annuler un geste
// unique n'est pas une annulation.
async function unmarkChaptersBulk(req, res, next) {
    try {
        const { mangaId, chapterIds } = req.body || {};
        if (!mangaId || !Array.isArray(chapterIds) || !chapterIds.length) {
            return res.status(400).json({ error: 'mangaId et chapterIds[] requis' });
        }
        const ids = chapterIds.filter(c => typeof c === 'string' && c).slice(0, 5000);
        if (!ids.length) return res.json({ ok: true, count: 0 });
        const [r] = await pool.query(
            `DELETE FROM read_chapters
             WHERE user_id = ? AND manga_id = ? AND chapter_id IN (${ids.map(() => '?').join(',')})`,
            [req.user.id, mangaId, ...ids]);
        res.json({ ok: true, count: r.affectedRows });
    } catch (e) { next(e); }
}

// ──────────────────────────────────────────────────────────────
// LISTS
// ──────────────────────────────────────────────────────────────
// ── Listes intelligentes (audit AMEL-38) ────────────────────
// Les filtres de la bibliothèque calculaient déjà « statut X + genre Y », mais
// ce calcul était jetable : impossible de le figer, de le nommer, d'y revenir.
// Une liste intelligente n'a pas de membres — elle a des RÈGLES, et son contenu
// se recalcule à chaque lecture. Elle ne se périme donc jamais.
//
// Les règles portent sur ce que la BASE connaît (statut, catégorie, note,
// source), et pas sur les genres : ceux-ci vivent chez les sources distantes,
// et les évaluer imposerait autant de scrapes que de séries à chaque
// affichage. La restriction est explicite plutôt que subie.
const REGLES_STATUT = new Set(['reading', 'completed', 'planned', 'paused', 'dropped']);

function lireRegles(brut) {
    if (!brut) return null;
    let r;
    try { r = typeof brut === 'string' ? JSON.parse(brut) : brut; } catch (e) { return null; }
    if (!r || typeof r !== 'object') return null;
    const out = {};
    if (Array.isArray(r.status)) out.status = r.status.filter(s => REGLES_STATUT.has(s));
    if (typeof r.category === 'string' && r.category.trim()) out.category = r.category.trim().slice(0, 64);
    if (typeof r.source === 'string' && r.source.trim()) out.source = r.source.trim().slice(0, 64);
    if (Number.isFinite(+r.minRating) && +r.minRating >= 1 && +r.minRating <= 5) out.minRating = +r.minRating;
    return Object.keys(out).length ? out : null;
}

async function itemsDeRegles(userId, regles) {
    const where = ['f.user_id = ?'];
    const params = [userId];
    if (regles.status?.length) {
        where.push(`f.status IN (${regles.status.map(() => '?').join(',')})`);
        params.push(...regles.status);
    }
    if (regles.category) { where.push('f.category = ?'); params.push(regles.category); }
    if (regles.source)   { where.push('f.source = ?');   params.push(regles.source); }
    let jointure = '';
    if (regles.minRating) {
        jointure = 'JOIN ratings r ON r.user_id = f.user_id AND r.manga_id = f.manga_id';
        where.push('r.rating >= ?');
        params.push(regles.minRating);
    }
    const [rows] = await pool.query(
        `SELECT f.manga_id, f.source, f.title, f.cover
         FROM favorites f ${jointure}
         WHERE ${where.join(' AND ')}
         ORDER BY f.added_at DESC LIMIT 500`, params);
    return rows.map(r => ({ id: r.manga_id, source: r.source, title: r.title, cover: r.cover }));
}

async function getLists(req, res, next) {
    try {
        const [lists] = await pool.query(
            'SELECT id, name, description, is_public, rules, created_at FROM lists WHERE user_id = ? ORDER BY created_at DESC',
            [req.user.id]
        );
        if (!lists.length) return res.json([]);
        const ids = lists.map(l => l.id);
        const [items] = await pool.query(
            'SELECT list_id, manga_id, source, title, cover, position FROM list_items WHERE list_id IN (?) ORDER BY position, added_at',
            [ids]
        );
        const byList = {};
        items.forEach(it => {
            byList[it.list_id] = byList[it.list_id] || [];
            byList[it.list_id].push({ id: it.manga_id, source: it.source, title: it.title, cover: it.cover });
        });

        const sortie = [];
        for (const l of lists) {
            const regles = lireRegles(l.rules);
            const contenu = regles ? await itemsDeRegles(req.user.id, regles) : (byList[l.id] || []);
            sortie.push({
                id: l.id, name: l.name, description: l.description,
                isPublic: !!l.is_public, createdAt: l.created_at,
                rules: regles || null, smart: !!regles,
                items: contenu,
                mangaIds: contenu.map(it => it.id),
            });
        }
        res.json(sortie);
    } catch (e) { next(e); }
}

async function createList(req, res, next) {
    try {
        const { name, description, isPublic, rules } = req.body;
        if (!name || name.trim().length < 1)
            return res.status(400).json({ error: 'Nom requis' });
        // Audit AMEL-38 : les regles sont NORMALISEES avant stockage. On
        // n'enregistre que ce qu'on sait evaluer — un critere inconnu serait
        // accepte, affiche, et ne filtrerait rien.
        const regles = lireRegles(rules);
        const [r] = await pool.query(
            'INSERT INTO lists (user_id, name, description, is_public, rules) VALUES (?, ?, ?, ?, ?)',
            [req.user.id, name.trim(), description || null, !!isPublic, regles ? JSON.stringify(regles) : null]
        );
        res.json({ id: r.insertId, name: name.trim(), smart: !!regles, mangaIds: [] });
    } catch (e) { next(e); }
}

async function updateList(req, res, next) {
    try {
        const { name, description, isPublic, rules } = req.body;
        const fields = [];
        const params = [];
        if (name)        { fields.push('name = ?');        params.push(name.trim()); }
        if (description !== undefined) { fields.push('description = ?'); params.push(description); }
        if (isPublic !== undefined) { fields.push('is_public = ?'); params.push(!!isPublic); }
        // `rules: null` retire les regles et rend la liste ordinaire ; absent,
        // le champ n'est pas touche (audit AMEL-38).
        if (rules !== undefined) {
            const regles = lireRegles(rules);
            fields.push('rules = ?'); params.push(regles ? JSON.stringify(regles) : null);
        }
        if (!fields.length) return res.json({ ok: true });
        params.push(req.params.id, req.user.id);
        await pool.query(`UPDATE lists SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`, params);
        res.json({ ok: true });
    } catch (e) { next(e); }
}

async function deleteList(req, res, next) {
    try {
        await pool.query('DELETE FROM lists WHERE id = ? AND user_id = ?',
            [req.params.id, req.user.id]);
        res.json({ ok: true });
    } catch (e) { next(e); }
}

// ──────────────────────────────────────────────────────────────
// SIGNETS (audit AMEL-41)
// ──────────────────────────────────────────────────────────────
// Ils vivaient dans `user_settings.data.userdata.bookmarks` : un blob JSON
// rechargé à chaque page et réécrit EN ENTIER au moindre ajout. Un signet n'est
// pas une préférence — c'est une donnée qui croît, se liste et se supprime à
// l'unité. Le plafond arbitraire de 200 disparaît avec le blob.
async function getBookmarks(req, res, next) {
    try {
        const [rows] = await pool.query(
            `SELECT manga_id, chapter_id, source, title, cover, chapter_num, page, label, created_at
             FROM bookmarks WHERE user_id = ? ORDER BY created_at DESC`, [req.user.id]);
        res.json(rows.map(r => ({
            mangaId: r.manga_id, chapterId: r.chapter_id, source: r.source,
            title: r.title, cover: r.cover, chapterNum: r.chapter_num,
            page: r.page, label: r.label, at: new Date(r.created_at).getTime(),
        })));
    } catch (e) { next(e); }
}

async function addBookmark(req, res, next) {
    try {
        const { mangaId, chapterId, source, title, cover, chapterNum, page, label } = req.body || {};
        if (!idOeuvreValide(mangaId) || !idOeuvreValide(chapterId)) {
            return res.status(400).json({ error: 'mangaId et chapterId requis' });
        }
        await pool.query(
            `INSERT INTO bookmarks
             (user_id, manga_id, chapter_id, source, title, cover, chapter_num, page, label)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                source = VALUES(source), title = VALUES(title), cover = VALUES(cover),
                chapter_num = VALUES(chapter_num), page = VALUES(page), label = VALUES(label),
                created_at = CURRENT_TIMESTAMP`,
            [req.user.id, mangaId, chapterId, source || null, title || null, cover || null,
                Number.isFinite(+chapterNum) ? +chapterNum : null,
                Number.isFinite(+page) ? +page : 1, label || null]);
        res.json({ ok: true });
    } catch (e) { next(e); }
}

async function removeBookmark(req, res, next) {
    try {
        await pool.query('DELETE FROM bookmarks WHERE user_id = ? AND manga_id = ? AND chapter_id = ?',
            [req.user.id, req.params.mangaId, req.params.chapterId]);
        res.json({ ok: true });
    } catch (e) { next(e); }
}

// PUT /me/lists/:id/order — réordonne les éléments (audit AMEL-37)
// `list_items.position` existait en base et était déjà utilisée pour TRIER
// (ORDER BY position, added_at), mais aucune route ne l'écrivait : elle valait
// 0 partout, si bien que l'ordre affiché était en réalité l'ordre d'ajout.
async function reorderList(req, res, next) {
    try {
        const ids = Array.isArray(req.body?.mangaIds) ? req.body.mangaIds : null;
        if (!ids || !ids.length) return res.status(400).json({ error: 'mangaIds requis' });

        const [[list]] = await pool.query('SELECT id FROM lists WHERE id = ? AND user_id = ?',
            [req.params.id, req.user.id]);
        if (!list) return res.status(404).json({ error: 'Liste introuvable' });

        // Un seul aller-retour plutôt qu'un UPDATE par ligne : une liste de
        // cent titres ferait sinon cent requêtes, et un réordonnancement à la
        // souris en déclenche un à chaque dépôt.
        const cas = ids.map((_, i) => 'WHEN ? THEN ?').join(' ');
        const params = [];
        ids.forEach((id, i) => { params.push(String(id), i); });
        await pool.query(
            `UPDATE list_items SET position = CASE manga_id ${cas} ELSE position END
             WHERE list_id = ? AND manga_id IN (${ids.map(() => '?').join(',')})`,
            [...params, req.params.id, ...ids.map(String)]);
        res.json({ ok: true });
    } catch (e) { next(e); }
}

async function addToList(req, res, next) {
    try {
        const { mangaId, source, title, cover } = req.body;
        if (!idOeuvreValide(mangaId)) return res.status(400).json({ error: 'mangaId invalide' });
        // Check ownership
        const [[list]] = await pool.query('SELECT id FROM lists WHERE id = ? AND user_id = ?',
            [req.params.id, req.user.id]);
        if (!list) return res.status(404).json({ error: 'Liste introuvable' });
        await pool.query(
            `INSERT INTO list_items (list_id, manga_id, source, title, cover) VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE source=VALUES(source), title=VALUES(title), cover=VALUES(cover)`,
            [req.params.id, mangaId, source || null, title || null, cover || null]
        );
        res.json({ ok: true });
    } catch (e) { next(e); }
}

async function removeFromList(req, res, next) {
    try {
        const [[list]] = await pool.query('SELECT id FROM lists WHERE id = ? AND user_id = ?',
            [req.params.id, req.user.id]);
        if (!list) return res.status(404).json({ error: 'Liste introuvable' });
        await pool.query(
            'DELETE FROM list_items WHERE list_id = ? AND manga_id = ?',
            [req.params.id, req.params.mangaId]
        );
        res.json({ ok: true });
    } catch (e) { next(e); }
}

// ──────────────────────────────────────────────────────────────
// COMMENTS
// ──────────────────────────────────────────────────────────────

// Audit AMEL-50 : trois portées, et une seule règle pour toutes les
// requêtes de lecture — dupliquer la condition, c'est se garantir qu'une
// des copies finira par diverger et laisser fuiter du privé.
//   private  : seulement son auteur (un carnet, pas un message)
//   instance : les membres connectés de cette instance (l'ancien défaut)
//   public   : tout le monde, y compris les visiteurs non connectés
const VISIBILITES = ['private', 'instance', 'public'];
function visibiliteSql(user) {
    if (user?.role === 'admin') return { where: '1=1', params: [] };   // modération
    if (!user) return { where: "visibility = 'public'", params: [] };
    return { where: "(visibility IN ('public','instance') OR user_id = ?)", params: [user.id] };
}

async function getComments(req, res, next) {
    try {
        // Pagination par fil de discussion (audit N51) : l'ancien plafond dur
        // (300 plus anciens, jamais d'offset) faisait disparaître tout commentaire
        // au-delà du seuil — y compris celui qu'on venait de poster. On pagine
        // désormais les commentaires RACINE du plus récent au plus ancien, et on
        // ramène l'intégralité des réponses de chaque fil affiché pour ne jamais
        // couper un arbre en deux. Le front reconstruit l'arbre via parentId.
        const isAdmin = req.user?.role === 'admin';
        const limit   = Math.min(Math.max(parseInt(req.query.limit  || '50', 10) || 50, 1), 100);
        const offset  = Math.max(parseInt(req.query.offset || '0', 10) || 0, 0);
        // Audit AMEL-50 : filtre de visibilité. Un visiteur anonyme ne voit que
        // le public ; un membre voit en plus l'instance et SES propres notes
        // privées. Le filtre est posé en SQL, pas après coup en JavaScript :
        // un commentaire privé ne doit jamais quitter la base.
        const visSql = visibiliteSql(req.user);
        // Audit AMEL-52 : commentaires d'un chapitre précis. Sans ce filtre,
        // l'ancrage ne servirait qu'à afficher une étiquette.
        const chapId = (req.query.chapterId || '').trim() || null;
        const filtreChap = chapId ? ' AND chapter_id = ?' : '';
        const [roots] = await pool.query(
            `SELECT id FROM comments
             WHERE manga_id = ? AND parent_id IS NULL AND ${visSql.where}${filtreChap}
             ORDER BY created_at DESC
             LIMIT ? OFFSET ?`,
            [req.params.mangaId, ...visSql.params, ...(chapId ? [chapId] : []), limit, offset]
        );
        let rows = [];
        if (roots.length) {
            [rows] = await pool.query(
                `WITH RECURSIVE thread AS (
                     SELECT id FROM comments WHERE id IN (?)
                     UNION ALL
                     SELECT c.id FROM comments c JOIN thread t ON c.parent_id = t.id
                 )
                 SELECT c.id, c.text, c.chapter_id, c.parent_id, c.created_at,
                        c.visibility, c.spoiler, c.user_id, u.username, u.avatar
                 FROM comments c
                 JOIN users u ON u.id = c.user_id
                 WHERE c.id IN (SELECT id FROM thread) AND ${visSql.where.replace(/\b(visibility|user_id)\b/g, 'c.$1')}
                 ORDER BY c.created_at ASC`,
                [roots.map(r => r.id), ...visSql.params]
            );
        }
        const [[counts]] = await pool.query(
            `SELECT COUNT(*) AS total, COALESCE(SUM(parent_id IS NULL), 0) AS roots
             FROM comments WHERE manga_id = ? AND ${visSql.where}${filtreChap}`,
            [req.params.mangaId, ...visSql.params, ...(chapId ? [chapId] : [])]
        );
        let reportCounts = {};
        if (isAdmin && rows.length) {
            const [reps] = await pool.query(
                `SELECT comment_id, COUNT(*) AS n FROM reports
                 WHERE status = 'open' AND comment_id IN (?) GROUP BY comment_id`,
                [rows.map(r => r.id)]
            );
            reps.forEach(r => { reportCounts[r.comment_id] = r.n; });
        }
        res.json({
            items: rows.map(r => ({
                id: r.id, text: r.text, chapterId: r.chapter_id,
                parentId: r.parent_id || null,
                visibility: r.visibility, spoiler: !!r.spoiler,
                user: r.username, avatar: r.avatar || r.username[0].toUpperCase(),
                createdAt: r.created_at,
                reports: reportCounts[r.id] || 0,
            })),
            total: Number(counts.total) || 0,
            hasMore: offset + roots.length < Number(counts.roots),
        });
    } catch (e) { next(e); }
}

// Derniers commentaires toutes séries confondues (vitrine catalogue)
async function getRecentComments(req, res, next) {
    try {
        const limit = Math.min(parseInt(req.query.limit || '6', 10), 20);
        const [rows] = await pool.query(
            `SELECT c.id, c.text, c.manga_id, c.created_at, c.spoiler,
                    u.username, u.avatar,
                    rt.rating,
                    (SELECT f.title  FROM favorites f WHERE f.manga_id = c.manga_id AND f.title IS NOT NULL LIMIT 1) AS manga_title,
                    (SELECT f.source FROM favorites f WHERE f.manga_id = c.manga_id AND f.source IS NOT NULL LIMIT 1) AS manga_source
             FROM comments c
             JOIN users u ON u.id = c.user_id
             LEFT JOIN ratings rt ON rt.user_id = c.user_id AND rt.manga_id = c.manga_id
             WHERE c.visibility IN ('public','instance')
             ORDER BY c.created_at DESC
             LIMIT ?`,
            [limit]
        );
        res.json(rows.map(r => ({
            id: r.id, text: r.text, mangaId: r.manga_id, spoiler: !!r.spoiler,
            mangaTitle: r.manga_title || null, mangaSource: r.manga_source || null,
            rating: r.rating || null,
            user: r.username, avatar: r.avatar || r.username[0].toUpperCase(),
            createdAt: r.created_at,
        })));
    } catch (e) { next(e); }
}

async function addComment(req, res, next) {
    try {
        const { text, chapterId, parentId, spoiler } = req.body;
        const mangaId = req.params.mangaId;
        if (!text || text.trim().length < 1)
            return res.status(400).json({ error: 'Commentaire vide' });
        if (text.length > 1000)
            return res.status(400).json({ error: 'Commentaire trop long (1000 caractères max)' });
        // Audit AMEL-50 : une portée inconnue ne doit pas silencieusement
        // retomber sur le défaut le plus ouvert — on refuse.
        let visibility = req.body.visibility || 'instance';
        if (!VISIBILITES.includes(visibility))
            return res.status(400).json({ error: 'Portée invalide (private, instance ou public)' });

        // Réponse : valide que le parent existe et appartient à la même œuvre
        let parent = null;
        if (parentId) {
            const [[p]] = await pool.query(
                'SELECT id, user_id, visibility FROM comments WHERE id = ? AND manga_id = ?',
                [parentId, mangaId]
            );
            if (!p) return res.status(400).json({ error: 'Commentaire parent introuvable' });
            parent = p;
            // Une réponse ne peut pas être plus visible que ce à quoi elle
            // répond : elle en cite le contenu, l'élargir le divulguerait.
            if (VISIBILITES.indexOf(visibility) > VISIBILITES.indexOf(p.visibility))
                visibility = p.visibility;
        }

        const [r] = await pool.query(
            'INSERT INTO comments (user_id, manga_id, chapter_id, text, parent_id, visibility, spoiler) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [req.user.id, mangaId, chapterId || null, text.trim(), parent ? parent.id : null,
                visibility, spoiler ? 1 : 0]
        );
        await pushEvent(req.user.id, 'comment', { mangaId, chapterId });

        // Notifications : réponse au parent + mentions @username.
        // Un commentaire privé ne notifie personne — la notification porte les
        // 140 premiers caractères du texte, elle contournerait la portée que
        // l'on vient d'appliquer en base.
        const link = `/serie.html?id=${encodeURIComponent(mangaId)}#comment-${r.insertId}`;
        if (visibility !== 'private') {
            if (parent && parent.user_id !== req.user.id) {
                await createNotification(parent.user_id, {
                    type: 'reply', title: `@${req.user.username} a répondu à ton commentaire`,
                    body: text.trim().slice(0, 140), link, actor: req.user.username,
                });
            }
            await notifyMentions(text, { actor: req.user.username, link });
        }

        res.json({ id: r.insertId, ok: true });
    } catch (e) { next(e); }
}

// Signaler un commentaire (modération)
async function reportComment(req, res, next) {
    try {
        const commentId = parseInt(req.params.commentId, 10);
        if (!commentId) return res.status(400).json({ error: 'Commentaire invalide' });
        const { reason } = req.body || {};
        const [[c]] = await pool.query('SELECT id, manga_id FROM comments WHERE id = ?', [commentId]);
        if (!c) return res.status(404).json({ error: 'Commentaire introuvable' });
        // Un seul signalement ouvert par utilisateur et par commentaire
        const [[dup]] = await pool.query(
            `SELECT id FROM reports WHERE reporter_id = ? AND comment_id = ? AND status = 'open'`,
            [req.user.id, commentId]
        );
        if (dup) return res.json({ ok: true, already: true });
        await pool.query(
            'INSERT INTO reports (reporter_id, comment_id, manga_id, reason) VALUES (?, ?, ?, ?)',
            [req.user.id, commentId, c.manga_id, (reason || '').slice(0, 255) || null]
        );
        res.json({ ok: true });
    } catch (e) { next(e); }
}

// Supprimer son propre commentaire (ou tout commentaire si admin)
async function deleteComment(req, res, next) {
    try {
        const commentId = parseInt(req.params.commentId, 10);
        if (!commentId) return res.status(400).json({ error: 'Commentaire invalide' });
        const isAdmin = req.user.role === 'admin';
        const [r] = await pool.query(
            `DELETE FROM comments WHERE id = ?` + (isAdmin ? '' : ' AND user_id = ?'),
            isAdmin ? [commentId] : [commentId, req.user.id]
        );
        if (!r.affectedRows) return res.status(404).json({ error: 'Introuvable ou non autorisé' });
        res.json({ ok: true });
    } catch (e) { next(e); }
}

// ──────────────────────────────────────────────────────────────
// EVENTS / ACTIVITY
// ──────────────────────────────────────────────────────────────
async function getEvents(req, res, next) {
    try {
        const limit = Math.min(parseInt(req.query.limit || '200', 10), 500);
        const [rows] = await pool.query(
            `SELECT id, type, manga_id, chapter_id, metadata, created_at
             FROM events WHERE user_id = ?
             ORDER BY created_at DESC LIMIT ?`,
            [req.user.id, limit]
        );
        res.json(rows.map(r => ({
            id: r.id, type: r.type,
            mangaId: r.manga_id, chapterId: r.chapter_id,
            metadata: r.metadata ? (typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata) : null,
            at: r.created_at,
        })));
    } catch (e) { next(e); }
}

async function getStats(req, res, next) {
    try {
        const uid = req.user.id;
        const [[totals]] = await pool.query(
            `SELECT
                (SELECT COUNT(*) FROM favorites WHERE user_id = ?) AS favorites,
                (SELECT COUNT(*) FROM favorites WHERE user_id = ? AND status IS NOT NULL) AS library,
                (SELECT COUNT(*) FROM read_chapters WHERE user_id = ?) AS chapters_read,
                (SELECT COUNT(*) FROM read_chapters WHERE user_id = ? AND read_at > NOW() - INTERVAL 30 DAY) AS chapters_this_month,
                (SELECT COUNT(DISTINCT manga_id) FROM read_chapters WHERE user_id = ?) AS series_read,
                (SELECT COUNT(*) FROM ratings WHERE user_id = ?) AS ratings`,
            [uid, uid, uid, uid, uid, uid]
        );

        // Heatmap + streak dans le fuseau de l'utilisateur (audit N55) : l'ancien
        // découpage DATE()/toISOString était 100% UTC — un chapitre lu à 0h30
        // heure de Paris comptait pour la veille, cassait les séries de lecture
        // et allumait la mauvaise case. Le regroupement par jour se fait donc en
        // Node (pas de CONVERT_TZ : les tables timezone de MySQL ne sont pas
        // chargées dans l'image Docker) avec un fuseau configurable.
        const TZ = process.env.STATS_TZ || 'Europe/Paris';
        const dayFmt = new Intl.DateTimeFormat('en-CA', {   // en-CA → YYYY-MM-DD
            timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
        });
        const dayKey = d => dayFmt.format(d);
        const [reads] = await pool.query(
            `SELECT read_at FROM read_chapters
             WHERE user_id = ? AND read_at > NOW() - INTERVAL 365 DAY`,
            [uid]
        );
        const heatmap = {};
        reads.forEach(r => {
            const k = dayKey(r.read_at);
            heatmap[k] = (heatmap[k] || 0) + 1;
        });

        // Séries de lecture (streak) — arithmétique calendaire sur les clés
        // YYYY-MM-DD elles-mêmes (minuit UTC), indépendante du fuseau du serveur.
        const set = new Set(Object.keys(heatmap));
        const prevKey = k => {
            const d = new Date(k + 'T00:00:00Z');
            d.setUTCDate(d.getUTCDate() - 1);
            return d.toISOString().slice(0, 10);
        };
        let current = 0; let k = dayKey(new Date());
        if (!set.has(k)) k = prevKey(k);
        while (set.has(k)) { current++; k = prevKey(k); }
        const sorted = [...set].sort();
        let longest = 0, run = 0, prev = null;
        sorted.forEach(d => {
            if (prev && (new Date(d) - new Date(prev)) / 86400000 === 1) run++; else run = 1;
            longest = Math.max(longest, run); prev = d;
        });

        res.json({ totals, heatmap, streak: { current, longest }, timezone: TZ });
    } catch (e) { next(e); }
}

// ──────────────────────────────────────────────────────────────
// RATINGS (note + review)
// ──────────────────────────────────────────────────────────────
async function getMangaRating(req, res, next) {
    try {
        const mangaId = req.params.mangaId;
        // Moyenne + nombre + note de l'user courant
        const [[agg]] = await pool.query(
            'SELECT AVG(rating) AS avg, COUNT(*) AS count FROM ratings WHERE manga_id = ?',
            [mangaId]
        );
        let mine = null;
        const uid = req.user?.id || req.userId;
        if (uid) {
            const [[r]] = await pool.query(
                'SELECT rating, review FROM ratings WHERE user_id = ? AND manga_id = ?',
                [uid, mangaId]
            );
            if (r) mine = { rating: r.rating, review: r.review };
        }
        res.json({
            average: agg.avg ? Math.round(agg.avg * 10) / 10 : null,
            count:   agg.count || 0,
            mine,
        });
    } catch (e) { next(e); }
}

async function setMangaRating(req, res, next) {
    try {
        const mangaId = req.params.mangaId;
        const { rating, review } = req.body || {};
        // Audit AMEL-47 : echelle sur 10 (demi-etoiles). Une note sur 5
        // envoyee par un client anterieur reste acceptee et convertie, plutot
        // que rejetee : un ancien onglet ouvert ne doit pas casser.
        let r = parseInt(rating, 10);
        const surCinq = req.body?.scale === 5;
        if (surCinq && r >= 1 && r <= 5) r = r * 2;
        if (!r || r < 1 || r > 10)
            return res.status(400).json({ error: 'Note entre 1 et 10 requise (demi-etoiles)' });
        await pool.query(
            `INSERT INTO ratings (user_id, manga_id, rating, review)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE rating = VALUES(rating), review = VALUES(review)`,
            [req.user.id, mangaId, r, review || null]
        );
        await pushEvent(req.user.id, 'rating', { mangaId, metadata: { rating: r } });
        res.json({ ok: true });
    } catch (e) { next(e); }
}

async function deleteMangaRating(req, res, next) {
    try {
        await pool.query('DELETE FROM ratings WHERE user_id = ? AND manga_id = ?',
            [req.user.id, req.params.mangaId]);
        res.json({ ok: true });
    } catch (e) { next(e); }
}

// Mes notes (pour profil)
async function getMyRatings(req, res, next) {
    try {
        const [rows] = await pool.query(
            'SELECT manga_id, rating, review, updated_at FROM ratings WHERE user_id = ? ORDER BY updated_at DESC',
            [req.user.id]
        );
        res.json(rows.map(r => ({ mangaId: r.manga_id, rating: r.rating, review: r.review, updatedAt: r.updated_at })));
    } catch (e) { next(e); }
}

// ──────────────────────────────────────────────────────────────
// SETTINGS (préférences synchronisées)
// ──────────────────────────────────────────────────────────────
async function getSettings(req, res, next) {
    try {
        const [[row]] = await pool.query('SELECT data FROM user_settings WHERE user_id = ?', [req.user.id]);
        const data = row ? (typeof row.data === 'string' ? JSON.parse(row.data) : row.data) : {};
        res.json(data || {});
    } catch (e) { next(e); }
}

async function setSettings(req, res, next) {
    try {
        const incoming = req.body || {};
        // Validation (audit API3) : objet simple, taille bornée — évite qu'un
        // client stocke des blobs arbitraires de plusieurs Mo dans user_settings.
        if (typeof incoming !== 'object' || Array.isArray(incoming))
            return res.status(400).json({ error: 'Réglages invalides (objet attendu)' });
        const payload = JSON.stringify(incoming);
        if (payload.length > 256 * 1024)
            return res.status(413).json({ error: 'Réglages trop volumineux (256 Ko max)' });
        // Fusion ATOMIQUE côté base (JSON_MERGE_PATCH, deep-merge) : deux écritures
        // partielles concurrentes (ex. UserData + toggle) ne s'écrasent plus l'une
        // l'autre — corrige la perte de mise à jour du read-modify-write JS.
        await pool.query(
            `INSERT INTO user_settings (user_id, data) VALUES (?, CAST(? AS JSON))
             ON DUPLICATE KEY UPDATE data = JSON_MERGE_PATCH(COALESCE(data, JSON_OBJECT()), CAST(? AS JSON))`,
            [req.user.id, payload, payload]
        );
        const [[row]] = await pool.query('SELECT data FROM user_settings WHERE user_id = ?', [req.user.id]);
        const data = row ? (typeof row.data === 'string' ? JSON.parse(row.data) : row.data) : {};
        res.json(data);
    } catch (e) { next(e); }
}

// ── Liens AniList (audit PERF-09) ────────────────────────────
// Ce cache titre → id AniList vivait dans user_settings.data, chargé À CHAQUE
// PAGE : 7 348 octets sur les 8 188 du blob, une entrée par titre jamais
// résolu, sans éviction. Table dédiée, chargée uniquement par anilist.js —
// donc seulement sur les pages qui en ont besoin.
async function getAnilistLinks(req, res, next) {
    try {
        const [rows] = await pool.query(
            'SELECT title_key, anilist_id, exact FROM anilist_links WHERE user_id = ?', [req.user.id]);
        const out = {};
        rows.forEach(r => { out[r.title_key] = { id: r.anilist_id, exact: !!r.exact }; });
        res.json(out);
    } catch (e) { next(e); }
}

// Fusion partielle : { "<clé>": { id, exact } } ; une valeur null supprime.
async function setAnilistLinks(req, res, next) {
    try {
        const body = req.body || {};
        if (typeof body !== 'object' || Array.isArray(body))
            return res.status(400).json({ error: 'Objet attendu' });
        const keys = Object.keys(body).slice(0, 500);
        const toUpsert = [], toDelete = [];
        for (const k of keys) {
            const key = String(k).slice(0, 191);
            if (!key) continue;
            const v = body[k];
            if (v === null) { toDelete.push(key); continue; }
            const id = parseInt(v && v.id, 10);
            if (!Number.isFinite(id)) continue;
            toUpsert.push([req.user.id, key, id, v.exact ? 1 : 0]);
        }
        if (toDelete.length) {
            await pool.query('DELETE FROM anilist_links WHERE user_id = ? AND title_key IN (?)',
                [req.user.id, toDelete]);
        }
        if (toUpsert.length) {
            await pool.query(
                `INSERT INTO anilist_links (user_id, title_key, anilist_id, exact) VALUES ?
                 ON DUPLICATE KEY UPDATE anilist_id = VALUES(anilist_id), exact = VALUES(exact)`,
                [toUpsert]);
        }
        res.json({ ok: true, updated: toUpsert.length, removed: toDelete.length });
    } catch (e) { next(e); }
}

// ──────────────────────────────────────────────────────────────
// EXPORT / RESET data
// ──────────────────────────────────────────────────────────────
async function exportData(req, res, next) {
    try {
        const uid = req.user.id;
        const [favorites]    = await pool.query('SELECT manga_id, source, title, cover, category, last_chapter, added_at FROM favorites WHERE user_id = ?', [uid]);
        // `library.rating` supprimée (migration 5) — les notes sont exportées
        // depuis la table `ratings`, plus bas. La table `library` elle-même a
        // fusionné dans `favorites` (migration 7, audit DB-02) ; la clé
        // `library` du fichier d'export est CONSERVÉE telle quelle pour que les
        // sauvegardes restent lisibles par les deux versions.
        const [library]      = await pool.query(
            'SELECT manga_id, status FROM favorites WHERE user_id = ? AND status IS NOT NULL', [uid]);
        const [progress]     = await pool.query('SELECT manga_id, chapter_id, chapter_number, page, source FROM progress WHERE user_id = ?', [uid]);
        const [readChapters] = await pool.query('SELECT manga_id, chapter_id, chapter_number FROM read_chapters WHERE user_id = ?', [uid]);
        const [ratings]      = await pool.query('SELECT manga_id, rating, review FROM ratings WHERE user_id = ?', [uid]);
        // Portabilité complète (RGPD art. 20, audit P3) : TOUTES les données du compte
        const [comments]     = await pool.query('SELECT manga_id, chapter_id, text, parent_id, created_at FROM comments WHERE user_id = ?', [uid]);
        const [events]       = await pool.query('SELECT type, manga_id, chapter_id, metadata, created_at FROM events WHERE user_id = ? ORDER BY created_at DESC LIMIT 5000', [uid]);
        const [lists]        = await pool.query('SELECT id, name, description, is_public, created_at FROM lists WHERE user_id = ?', [uid]);
        const [listItems] = lists.length
            ? await pool.query('SELECT list_id, manga_id, source, title, position FROM list_items WHERE list_id IN (?)', [lists.map(l => l.id)])
            : [[]];
        const [notifications] = await pool.query('SELECT type, title, body, link, is_read, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 500', [uid]).catch(() => [[]]);
        const [[settingsRow]] = await pool.query('SELECT data FROM user_settings WHERE user_id = ?', [uid]);
        res.json({
            inkoVersion: 3,
            // Audit AMEL-47 : sans ce marqueur, une note « 4 » est ambiguë —
            // 4/5 dans un fichier d'avant la bascule, 4/10 après. L'import
            // doublerait les unes ou laisserait les autres divisées par deux.
            ratingScale: 10,
            exportedAt: new Date().toISOString(),
            user: { username: req.user.username, email: req.user.email, avatar: req.user.avatar, createdAt: req.user.created_at },
            favorites, library, progress, readChapters, ratings,
            comments, events, lists, listItems, notifications,
            settings: settingsRow ? (typeof settingsRow.data === 'string' ? JSON.parse(settingsRow.data) : settingsRow.data) : {},
        });
    } catch (e) { next(e); }
}

// Restaure une sauvegarde JSON (fusion, sans écraser ce qui n'est pas dans le fichier)
async function importData(req, res, next) {
    try {
        const uid = req.user.id;
        const d = req.body || {};
        const counts = { favorites: 0, library: 0, progress: 0, readChapters: 0, ratings: 0 };

        // Audit B3 : import batché (INSERT ... VALUES ? multi-lignes, par
        // paquets de 500) au pattern de markChaptersBulk — l'ancienne version
        // faisait une requête await-ée PAR entrée : sur une sauvegarde de
        // plusieurs milliers d'items, l'import durait des dizaines de
        // secondes et risquait un timeout côté front.
        const CHUNK = 500;
        async function bulk(sql, rows, cb) {
            for (let i = 0; i < rows.length; i += CHUNK) {
                const slice = rows.slice(i, i + CHUNK);
                try {
                    await pool.query(sql, [slice]);
                    cb(slice.length);
                } catch (e) {
                    // Un paquet en erreur (donnée corrompue) n'annule pas le reste
                    console.warn('[import] paquet ignoré :', e.code || e.message);
                }
            }
        }

        const favRows = (d.favorites || [])
            .filter(f => f.manga_id || f.mangaId)
            .map(f => [uid, f.manga_id || f.mangaId, f.source || null, f.title || null,
                       f.cover || null, f.category || null, f.last_chapter ?? null]);
        await bulk(
            `INSERT INTO favorites (user_id, manga_id, source, title, cover, category, last_chapter)
             VALUES ?
             ON DUPLICATE KEY UPDATE source=COALESCE(VALUES(source),source),
               title=COALESCE(VALUES(title),title), cover=COALESCE(VALUES(cover),cover),
               category=COALESCE(VALUES(category),category)`,
            favRows, n => counts.favorites += n);

        // `library.rating` supprimée (migration 5) : un ancien fichier d'export
        // peut encore la porter, on l'ignore simplement — la note utile est
        // dans `d.ratings`, importée plus bas.
        // Audit DB-02 : le statut est maintenant une colonne de `favorites`.
        // L'import écrit donc dans la même table que le bloc précédent — d'où
        // l'ordre : les favoris d'abord (titre, couverture, source), les
        // statuts ensuite, sans écraser ce qui vient d'être posé.
        const libRows = (d.library || [])
            .filter(l => l.manga_id || l.mangaId)
            .map(l => [uid, l.manga_id || l.mangaId, l.status || 'reading']);
        await bulk(
            `INSERT INTO favorites (user_id, manga_id, status) VALUES ?
             ON DUPLICATE KEY UPDATE status=VALUES(status), status_updated_at=CURRENT_TIMESTAMP`,
            libRows, n => counts.library += n);

        const progRows = (d.progress || [])
            .filter(p => p.manga_id || p.mangaId)
            .map(p => [uid, p.manga_id || p.mangaId, p.chapter_id || p.chapterId || null,
                       p.chapter_number ?? p.chapter ?? null, p.page || 1, p.source || null]);
        await bulk(
            `INSERT INTO progress (user_id, manga_id, chapter_id, chapter_number, page, source)
             VALUES ?
             ON DUPLICATE KEY UPDATE chapter_id=VALUES(chapter_id), chapter_number=VALUES(chapter_number),
               page=VALUES(page), source=COALESCE(VALUES(source),source)`,
            progRows, n => counts.progress += n);

        const readRows = (d.readChapters || [])
            .filter(r => (r.manga_id || r.mangaId) && (r.chapter_id || r.chapterId))
            .map(r => [uid, r.manga_id || r.mangaId, r.chapter_id || r.chapterId,
                       r.chapter_number ?? r.chapter ?? null]);
        await bulk(
            'INSERT IGNORE INTO read_chapters (user_id, manga_id, chapter_id, chapter_number) VALUES ?',
            readRows, n => counts.readChapters += n);

        // Audit DB-04 : l'import écrivait la note telle quelle. La validation
        // 1..5 n'existait qu'à l'écriture par l'API, donc un fichier d'import
        // (fabriqué à la main, exporté d'un autre outil, ou simplement ancien)
        // pouvait insérer n'importe quelle valeur. Depuis que la contrainte
        // CHECK existe en base, ces lignes seraient rejetées EN SILENCE et
        // l'utilisateur perdrait ses notes sans le savoir. On borne donc ici.
        //
        // Audit AMEL-47 : l'échelle est passée à 10. Un fichier qui ne porte
        // pas `ratingScale` vient forcément d'avant la bascule — ses notes sont
        // sur 5 et doivent être doublées, exactement comme la migration 12 l'a
        // fait en base. Sans cela, réimporter sa propre sauvegarde divisait
        // toutes ses notes par deux.
        const echelleSource = Number(d.ratingScale) === 10 ? 10 : 5;
        const facteur = echelleSource === 10 ? 1 : 2;
        const rateRows = (d.ratings || [])
            .filter(r => (r.manga_id || r.mangaId) && r.rating != null && !isNaN(parseFloat(r.rating)))
            .map(r => [uid, r.manga_id || r.mangaId,
                       Math.min(10, Math.max(1, Math.round(parseFloat(r.rating) * facteur))),
                       r.review || null]);
        await bulk(
            `INSERT INTO ratings (user_id, manga_id, rating, review) VALUES ?
             ON DUPLICATE KEY UPDATE rating=VALUES(rating), review=VALUES(review)`,
            rateRows, n => counts.ratings += n);

        res.json({ ok: true, imported: counts });
    } catch (e) { next(e); }
}

async function clearHistory(req, res, next) {
    try {
        const uid = req.user.id;
        await pool.query('DELETE FROM events WHERE user_id = ?', [uid]);
        await pool.query('DELETE FROM progress WHERE user_id = ?', [uid]);
        await pool.query('DELETE FROM read_chapters WHERE user_id = ?', [uid]);
        res.json({ ok: true });
    } catch (e) { next(e); }
}

// ──────────────────────────────────────────────────────────────
// UPDATES — nouveaux chapitres des mangas suivis (refonte §15)
// Cœur partagé dans lib/updates.js (aussi utilisé par la tâche de
// fond qui pousse les notifications de nouveaux chapitres).
// ──────────────────────────────────────────────────────────────
const updatesLib = require('../lib/updates');

async function checkUpdates(req, res, next) {
    try {
        const uid    = req.user.id;
        const manga  = req.query.manga || null;                       // vérif d'une seule série
        const scope  = req.query.scope === 'all' ? 'all' : 'active';  // défaut : ignore Terminé/Abandonné
        const lang   = (req.query.lang || 'fr,en');

        // Cooldown serveur (§15.4-5) : 15 min entre deux scans COMPLETS.
        // Pas de cooldown pour la vérification d'une seule série.
        if (!manga) {
            const left = updatesLib.fullScanCooldown(uid);
            if (left > 0) {
                return res.status(429).json({
                    error: `Bibliothèque déjà vérifiée récemment — réessaie dans ${Math.ceil(left / 60000)} min`,
                    retryInMs: left,
                });
            }
        }

        const result = await updatesLib.scanUserUpdates(uid, { scope, mangaId: manga, lang });
        if (!manga) updatesLib.markFullScan(uid);
        res.json({ ...result, checkedAt: Date.now() });
    } catch (e) { next(e); }
}

module.exports = {
    getFavorites, addFavorite, removeFavorite, setFavoriteCategory,
    getAnilistLinks, setAnilistLinks,
    getLibrary, setLibraryStatus,
    getAllProgress, setProgress, deleteProgress, getProgressHistory,
    getReadChapters, markChapter, markChaptersBulk, unmarkChaptersBulk,
    getLists, createList, updateList, deleteList, addToList, removeFromList, reorderList,
    getBookmarks, addBookmark, removeBookmark,
    getComments, addComment, getRecentComments, reportComment, deleteComment,
    getEvents, getStats,
    getMangaRating, setMangaRating, deleteMangaRating, getMyRatings,
    getSettings, setSettings,
    exportData, importData, clearHistory,
    checkUpdates,
};
