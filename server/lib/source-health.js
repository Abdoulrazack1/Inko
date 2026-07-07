// ============================================================
// lib/source-health.js — Santé des extensions (audit §7.3 rec 3)
// ------------------------------------------------------------
// Journalise en mémoire, par source : dernière requête réussie, dernier
// échec + message, nombre d'échecs consécutifs. Permet à l'admin de repérer
// une source cassée (site qui a changé de structure, Cloudflare…) avant que
// les utilisateurs ne tombent dessus. En mémoire seulement : remis à zéro au
// redémarrage — suffisant pour un premier diagnostic, pas de migration DB.
// ============================================================
const health = new Map(); // id → { okAt, failAt, error, oks, fails, streak }

function entry(id) {
    if (!health.has(id)) health.set(id, { okAt: null, failAt: null, error: null, oks: 0, fails: 0, streak: 0 });
    return health.get(id);
}

function recordOk(id) {
    if (!id) return;
    const h = entry(id);
    h.okAt = Date.now(); h.oks++; h.streak = 0; h.error = null;
}

function recordFail(id, err) {
    if (!id) return;
    const h = entry(id);
    h.failAt = Date.now(); h.fails++; h.streak++;
    h.error = String((err && err.message) || err || 'erreur inconnue').slice(0, 300);
}

// Instrumente un appel de source : enregistre succès/échec puis relaie tel quel.
async function track(id, fn) {
    try { const r = await fn(); recordOk(id); return r; }
    catch (e) { recordFail(id, e); throw e; }
}

// Test de connectivité léger : première capacité disponible, limit 1.
async function test(src) {
    if (!src) throw new Error('source inconnue');
    const caps = src.capabilities || [];
    let method, args;
    if (caps.includes('popular') || typeof src.popular === 'function') { method = 'popular'; args = { limit: 1 }; }
    else if (caps.includes('latest') || typeof src.latest === 'function') { method = 'latest'; args = { limit: 1 }; }
    else { method = 'search'; args = { q: 'a', limit: 1 }; }
    const r = await track(src.id, () => src[method](args));
    const count = (r && (r.total ?? (Array.isArray(r.results) ? r.results.length : 0))) || 0;
    return { method, count };
}

function snapshot() {
    return [...health.entries()].map(([id, h]) => ({ id, ...h }));
}

module.exports = { recordOk, recordFail, track, test, snapshot };
