// ============================================================
// lib/corbeille.js — retirer sans perdre (audit DAT-01, DAT-02, DAT-03)
// ------------------------------------------------------------
// L'incident du 9 novembre : 993 retraits de favoris en deux minutes, une
// bibliothèque de 495 séries vidée. Le serveur a fait exactement ce qu'on lui
// demandait — et c'est le défaut : rien ne distinguait un clic d'une boucle,
// rien ne se rattrapait, et aucun événement ne disait d'où venait la demande.
//
// Trois réponses, dans ce module :
//
//   1. toute ligne retirée est d'abord copiée dans `favorites_corbeille`
//      (la ligne ENTIÈRE) et restaurable pendant 30 jours ;
//   2. les retraits à l'unité sont plafonnés : au-delà d'un rythme humain, la
//      demande est refusée et renvoie vers le retrait en lot, qui exige de
//      dire combien d'éléments on retire ;
//   3. un lot de 10 éléments ou plus est précédé d'une sauvegarde complète.
//
// Le module ne parle qu'à la connexion qu'on lui donne : le contrôleur gère
// la transaction, et les tests s'en passent.
// ============================================================
'use strict';

const crypto = require('crypto');

const DUREE_JOURS = 30;
/** Au-delà de ce nombre de retraits à l'unité dans la fenêtre, on refuse. */
const PLAFOND_UNITAIRE = Number(process.env.FAV_SUPPRESSION_MAX || 20);
const FENETRE_MS = Number(process.env.FAV_SUPPRESSION_FENETRE_MS || 10000);
/** À partir de ce volume, un retrait en lot déclenche une sauvegarde préalable. */
const SEUIL_SAUVEGARDE = 10;
/** Un lot ne peut pas dépasser cette taille (une bibliothèque entière tient largement). */
const LOT_MAX = 5000;

const rythmes = new Map();   // userId → horodatages récents

/**
 * Enregistre une demande de retrait à l'unité et dit si elle passe.
 * @returns {{ok: boolean, attendreS: number}}
 */
function plafondUnitaire(userId, maintenant = Date.now()) {
    const liste = (rythmes.get(userId) || []).filter(t => maintenant - t < FENETRE_MS);
    if (liste.length >= PLAFOND_UNITAIRE) {
        rythmes.set(userId, liste);
        return { ok: false, attendreS: Math.max(1, Math.ceil((FENETRE_MS - (maintenant - liste[0])) / 1000)) };
    }
    liste.push(maintenant);
    rythmes.set(userId, liste);
    // la table ne grossit pas indéfiniment sur une instance à nombreux comptes
    if (rythmes.size > 2000) for (const [k, v] of rythmes) if (!v.length || maintenant - v[v.length - 1] > FENETRE_MS) rythmes.delete(k);
    return { ok: true, attendreS: 0 };
}
function _oublierRythmes() { rythmes.clear(); }

/** D'où vient la demande : assez pour répondre à « qui ? », sans conserver l'adresse. */
function origineDe(req) {
    if (!req) return null;
    const h = (n) => String((req.headers && req.headers[n]) || '');
    const client = h('x-inko-client').replace(/[^\w.-]/g, '').slice(0, 20);
    const ua = h('user-agent');
    const moteur = (/(Firefox|Edg|OPR|Chrome|Safari)\/(\d+)/.exec(ua) || [])[0]
        || (/^(curl|node|axios|Playwright|HeadlessChrome|Python)[^ ]*/i.exec(ua) || [])[0]
        || (ua ? ua.split(' ')[0] : 'sans agent');
    const auto = /HeadlessChrome|Playwright|curl|python|node-fetch|axios/i.test(ua) ? ' · automate' : '';
    const ip = (req.socket && req.socket.remoteAddress) || '';
    const lieu = /^(::1|127\.|::ffff:127\.)/.test(ip) ? 'local' : 'réseau';
    return `${client || 'web'} · ${moteur.slice(0, 32)} · ${lieu}${auto}`.slice(0, 96);
}

/**
 * Copie les favoris visés dans la corbeille, puis les retire.
 * À appeler DANS une transaction (`cx` = connexion).
 * @returns {Promise<{lot: string, retires: string[]}>}
 */
async function retirer(cx, userId, mangaIds, origine) {
    const lot = crypto.randomUUID();
    const ids = [...new Set((mangaIds || []).map(String))].filter(Boolean).slice(0, LOT_MAX);
    if (!ids.length) return { lot, retires: [] };
    const [lignes] = await cx.query('SELECT * FROM favorites WHERE user_id = ? AND manga_id IN (?)', [userId, ids]);
    if (!lignes.length) return { lot, retires: [] };
    await cx.query(
        'INSERT INTO favorites_corbeille (user_id, manga_id, donnees, lot, origine) VALUES ?',
        [lignes.map(l => [userId, l.manga_id, JSON.stringify(l), lot, origine || null])]);
    const retires = lignes.map(l => l.manga_id);
    await cx.query('DELETE FROM favorites WHERE user_id = ? AND manga_id IN (?)', [userId, retires]);
    return { lot, retires };
}

/** Une valeur relue du JSON, prête à repartir vers la base. */
function versSql(v) {
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(v)) return new Date(v);
    if (v && typeof v === 'object') return JSON.stringify(v);
    return v;
}

/**
 * Remet des favoris depuis la corbeille (un lot entier, ou des œuvres précises).
 * Ne remplace jamais un favori déjà revenu entre-temps. À appeler en transaction.
 * @returns {Promise<{restaures: number, dejaPresents: number}>}
 */
async function restaurer(cx, userId, { lot, mangaIds } = {}) {
    const ou = ['user_id = ?']; const args = [userId];
    if (lot) { ou.push('lot = ?'); args.push(String(lot)); }
    if (Array.isArray(mangaIds) && mangaIds.length) { ou.push('manga_id IN (?)'); args.push(mangaIds.map(String)); }
    if (ou.length === 1) return { restaures: 0, dejaPresents: 0 };
    // le plus récent d'abord : si une œuvre a été retirée deux fois, c'est sa dernière version qui revient
    const [entrees] = await cx.query(`SELECT id, manga_id, donnees FROM favorites_corbeille WHERE ${ou.join(' AND ')} ORDER BY id DESC`, args);
    if (!entrees.length) return { restaures: 0, dejaPresents: 0 };
    const [cols] = await cx.query("SELECT column_name AS c FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'favorites'");
    const colonnes = cols.map(x => x.c);
    let restaures = 0, dejaPresents = 0;
    const vus = new Set();
    for (const e of entrees) {
        if (vus.has(e.manga_id)) continue;
        vus.add(e.manga_id);
        let d; try { d = JSON.parse(e.donnees); } catch (x) { continue; }
        // seules les colonnes qui existent ENCORE : le schéma peut avoir évolué depuis le retrait
        const presentes = colonnes.filter(c => c !== 'user_id' && Object.prototype.hasOwnProperty.call(d, c));
        const [r] = await cx.query(
            `INSERT IGNORE INTO favorites (user_id, ${presentes.map(c => '`' + c + '`').join(', ')}) VALUES (?)`,
            [[userId, ...presentes.map(c => versSql(d[c]))]]);
        if (r.affectedRows) restaures++; else dejaPresents++;
    }
    await cx.query('DELETE FROM favorites_corbeille WHERE user_id = ? AND id IN (?)', [userId, entrees.map(e => e.id)]);
    return { restaures, dejaPresents };
}

/** Les lots récents, avec de quoi les reconnaître. */
async function lister(cx, userId, limite = 20) {
    const [lignes] = await cx.query(
        `SELECT lot, manga_id, donnees, origine, supprime_le FROM favorites_corbeille
         WHERE user_id = ? AND supprime_le > (NOW() - INTERVAL ? DAY) ORDER BY id DESC LIMIT 5000`,
        [userId, DUREE_JOURS]);
    const lots = new Map();
    for (const l of lignes) {
        if (!lots.has(l.lot)) {
            if (lots.size >= limite) continue;
            lots.set(l.lot, { lot: l.lot, supprimeLe: l.supprime_le, origine: l.origine, nombre: 0, apercu: [], mangaIds: [] });
        }
        const x = lots.get(l.lot);
        x.nombre++;
        x.mangaIds.push(l.manga_id);
        if (x.apercu.length < 5) { let d = {}; try { d = JSON.parse(l.donnees); } catch (e) { /* ligne illisible */ } x.apercu.push(d.title || l.manga_id); }
    }
    return [...lots.values()];
}

/** Efface définitivement ce qui a dépassé la durée de conservation. */
async function purger(cx) {
    const [r] = await cx.query('DELETE FROM favorites_corbeille WHERE supprime_le < (NOW() - INTERVAL ? DAY)', [DUREE_JOURS]);
    return r.affectedRows || 0;
}

module.exports = {
    retirer, restaurer, lister, purger, plafondUnitaire, origineDe, _oublierRythmes,
    DUREE_JOURS, PLAFOND_UNITAIRE, FENETRE_MS, SEUIL_SAUVEGARDE, LOT_MAX,
};
