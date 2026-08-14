// ============================================================
// lib/sessions.js — durée de vie des sessions (audit DB-01)
// ------------------------------------------------------------
// `sessions` était la plus grosse table de la base : 1 820 lignes au moment de
// l'audit, 4 578 deux jours plus tard, pour UN seul compte. Aucune n'avait
// jamais expiré, parce qu'aucune colonne ne disait quand elle devait.
//
// La cause n'est pas un pic d'activité : `/api/auth/local` est appelé à CHAQUE
// chargement de page, et signer un jeton insère une ligne. Le volume suivait
// donc le nombre de pages affichées, pas le nombre de connexions.
//
// Trois pièces referment la fuite, et il faut les trois :
//   1. `expires_at` / `revoked_at` sur la table          (migration 18)
//   2. la réutilisation de session dans `localAuth`      (auth.controller.js)
//   3. cette purge, au démarrage puis chaque jour        (ici)
//
// Sans la 2, la table regrossit ; sans la 3, l'existant ne part jamais.
'use strict';

const { pool } = require('../config/db');

// Une seule planification par processus, même si le module est requis
// plusieurs fois — `require` met en cache, mais un rechargement en test ou un
// double appel depuis `server.js` ne doit pas empiler deux minuteurs.
let planifiee = false;

const JOUR_MS = 24 * 3600 * 1000;

/**
 * Convertit la durée de vie des jetons (`JWT_EXPIRES`, ex. `30d`, `12h`) en
 * millisecondes. La session doit expirer AVEC son jeton : plus tôt et
 * l'utilisateur est déconnecté alors que son jeton est encore valide, plus
 * tard et une ligne survit à ce qu'elle décrit.
 */
function dureeJeton() {
    const brut = String(process.env.JWT_EXPIRES || '30d').trim();
    const m = /^(\d+)\s*([smhd])?$/i.exec(brut);
    if (!m) return 30 * JOUR_MS;              // valeur inattendue : on garde le défaut documenté
    const n = Number(m[1]);
    const unite = (m[2] || 's').toLowerCase();
    const facteur = { s: 1000, m: 60_000, h: 3_600_000, d: JOUR_MS }[unite];
    return n * facteur;
}

/** Échéance à poser sur une session créée maintenant. */
function echeance() {
    return new Date(Date.now() + dureeJeton());
}

/**
 * Supprime les sessions périmées ou révoquées.
 * Ne jette jamais : une purge qui échoue ne doit pas empêcher le serveur de
 * démarrer ni de servir. Elle se represente le lendemain.
 * @returns {Promise<number>} lignes supprimées
 */
async function purger() {
    try {
        const [r] = await pool.query(
            'DELETE FROM sessions WHERE expires_at < NOW() OR revoked_at IS NOT NULL');
        return r.affectedRows || 0;
    } catch (e) {
        console.warn('[sessions] purge impossible :', e.message);
        return 0;
    }
}

/** Purge au démarrage, puis toutes les 24 h. */
function planifier() {
    if (planifiee || process.env.DISABLE_SESSION_PURGE === '1') return;
    planifiee = true;
    const tour = () => purger().then(n => {
        if (n > 0) console.log(`[sessions] ${n} session(s) expirée(s) purgée(s).`);
    });
    // Décalé de 30 s : le démarrage a déjà les migrations et le chargement des
    // extensions à faire ; une suppression de plusieurs milliers de lignes n'a
    // aucune raison de leur disputer la connexion.
    setTimeout(tour, 30_000).unref?.();
    setInterval(tour, JOUR_MS).unref?.();
}

module.exports = { purger, planifier, echeance, dureeJeton };
