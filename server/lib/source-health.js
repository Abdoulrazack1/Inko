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

// Instrumente un appel de source : enregistre succès/échec puis relaie.
//
// Les tests de bout en bout (audit QUAL-03) ont mis en évidence un défaut de
// signalisation : quand un site scrapé nous limite ou tombe, l'erreur remontait
// sans `status` et le gestionnaire global la traduisait en **HTTP 500**. Le
// navigateur, les journaux et toute supervision concluaient donc « le serveur
// Inko est en panne » alors qu'un site TIERS était indisponible. La base
// injoignable bénéficiait déjà d'un 503 explicite ; les sources, non.
//
// On marque donc l'erreur avant de la relayer :
//   · 504 quand le site nous fait attendre ou nous limite (réessayer a du sens)
//   · 502 pour toute autre défaillance amont
// Une erreur qui porte déjà un `status` (validation, 404 de source…) n'est pas
// touchée : elle vient de notre logique, pas du réseau.
const UPSTREAM_SLOW = /limit|timeout|délai dépassé|delai depasse|429|503|trop de requ/i;

async function track(id, fn, etiquette) {
    // La durée fait partie du diagnostic (audit AMEL-68) : une source qui
    // répond en 12 s n'est pas « en panne » mais explique à elle seule une
    // page qui rame — et les compteurs agrégés ne la distinguent pas d'une
    // source saine.
    const t0 = Date.now();
    try {
        const r = await fn();
        recordOk(id);
        noter(id, { at: Date.now(), ms: Date.now() - t0, ok: true, op: etiquette || null });
        return r;
    } catch (e) {
        recordFail(id, e);
        if (e && !e.status) {
            e.status = UPSTREAM_SLOW.test(String(e.message || '')) ? 504 : 502;
            e.upstream = id || true;
        }
        noter(id, {
            at: Date.now(), ms: Date.now() - t0, ok: false, op: etiquette || null,
            status: e?.status || null,
            error: String((e && e.message) || e || 'erreur inconnue').slice(0, 200),
        });
        throw e;
    }
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

// ── Journal par source (audit AMEL-68) ──────────────────────
// Quand une source casse, l'utilisateur voyait « Erreur » et rien d'autre :
// impossible de distinguer « le site est tombé », « il nous limite », « il a
// changé de structure » ou « c'est ma connexion ». Les compteurs agrégés
// (oks/fails/streak) ne le disent pas non plus — ils ne gardent QUE le
// dernier message, écrasé au prochain échec.
//
// On garde donc les derniers appels, avec leur durée et leur issue. En mémoire
// et borné : c'est un outil de diagnostic immédiat, pas un historique — le
// persister demanderait une table et une rétention pour une donnée qui ne vaut
// que dans les minutes qui suivent la panne.
const JOURNAL_MAX = 40;
const journal = new Map();   // id → [{ at, ms, ok, error }]

function noter(id, ligne) {
    if (!id) return;
    const l = journal.get(id) || [];
    l.unshift(ligne);
    if (l.length > JOURNAL_MAX) l.length = JOURNAL_MAX;
    journal.set(id, l);
}

function journalDe(id, limite = JOURNAL_MAX) {
    return (journal.get(id) || []).slice(0, limite);
}

function snapshot() {
    return [...health.entries()].map(([id, h]) => ({ id, ...h }));
}

module.exports = { recordOk, recordFail, track, test, snapshot, journalDe, JOURNAL_MAX };
