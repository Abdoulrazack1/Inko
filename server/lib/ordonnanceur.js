// ============================================================
// ordonnanceur.js — File d'attente par source, avec priorités
// ============================================================
// Sans elle, chaque requête du navigateur partait immédiatement vers le site
// distant. Une seule ouverture de fiche série vérifiait ses 12 recommandations
// sur les 9 sources : ~110 requêtes sortantes en rafale. WeebCentral répondait
// 429, et le lecteur ouvert juste après héritait du refus (« Weebcentral ne
// répond pas ») alors que la source allait très bien.
//
// Deux règles :
//   1. au plus N appels simultanés vers une même source (N = 4, ajustable
//      par SOURCE_CONCURRENCY) ;
//   2. quand une place se libère, on sert d'abord ce que l'utilisateur
//      attend à l'écran (pages, texte, fiche, chapitres), puis les
//      recherches, et en dernier les tâches de fond (vérification de
//      recommandations, scan des mises à jour).
//
// Une tâche de fond qui attend trop longtemps est abandonnée plutôt que de
// s'exécuter pour un écran que l'utilisateur a déjà quitté.
//
// Espacement adaptatif : quand un site répond « trop de requêtes » (429), on
// cesse de l'interroger quelques secondes, puis on espace les appels. Chaque
// succès resserre un peu l'espacement. Sans ça, l'actualisation d'une
// bibliothèque de 300 séries WeebCentral faisait bannir l'adresse IP pendant
// plusieurs minutes — et plus rien ne se lisait sur cette source.
// ============================================================

const PRIO = { haute: 0, normale: 1, basse: 2 };
const CONCURRENCE = Math.max(1, parseInt(process.env.SOURCE_CONCURRENCY || '4', 10) || 4);
const ATTENTE_MAX_BASSE = 20000;     // une tâche de fond périmée ne sert plus à rien

const ESPACEMENT_MAX = 4000;
const PAUSE_429 = 3000;
const PAUSE_MAX = 60000;
// Au-delà de cette pause restante, une tâche non urgente échoue tout de suite
// (« source saturée ») au lieu d'attendre : c'est le signe d'un blocage durable,
// et insister ne ferait que le prolonger.
const SEUIL_SATURE = 10000;
const LIMITE = /limit|429|too many|trop de requ/i;

const files = new Map();   // sourceId -> { actifs, attente, espacement, prochain, reveil }

function fileDe(id) {
    let f = files.get(id);
    if (!f) {
        f = { actifs: 0, attente: [[], [], []], espacement: 0, prochain: 0, reveil: null, refus: 0 };
        files.set(id, f);
    }
    return f;
}

function estLimite(e) {
    const st = e && (e.response?.status || e.statusCode);
    if (st === 429) return true;
    return LIMITE.test(String(e && e.message || ''));
}

/** Le site a dit « trop de requêtes » : on se tait, puis on espace. */
function freiner(id, e) {
    const f = fileDe(id);
    const ra = parseInt(e?.response?.headers?.['retry-after'], 10);
    f.refus++;
    // Refus consécutifs : 3 s, 6 s, 12 s… jusqu'à une minute.
    const expo = Math.min(PAUSE_MAX, PAUSE_429 * 2 ** (f.refus - 1));
    const pause = Number.isFinite(ra) && ra > 0 ? Math.max(Math.min(ra * 1000, PAUSE_MAX), expo) : expo;
    f.espacement = Math.min(ESPACEMENT_MAX, Math.max(400, f.espacement * 2));
    f.prochain = Math.max(f.prochain, Date.now() + pause);
}

function detendre(f) {
    f.refus = 0;
    if (f.espacement) f.espacement = f.espacement < 60 ? 0 : Math.round(f.espacement * 0.93);
}

function suivant(f) {
    for (const q of f.attente) if (q.length) return q.shift();
    return null;
}

function erreurSaturee(id, f) {
    const s = Math.ceil((f.prochain - Date.now()) / 1000);
    return Object.assign(new Error(`Source saturée (trop de requêtes) — nouvel essai possible dans ${s} s`),
        { status: 503, sature: true, upstream: id });
}

/** Pendant un blocage durable, les tâches non urgentes échouent tout de suite. */
function purgerNonUrgentes(id, f) {
    if (f.prochain - Date.now() <= SEUIL_SATURE) return;
    for (const niveau of [PRIO.normale, PRIO.basse]) {
        const q = f.attente[niveau];
        // Les tâches « patientes » (scan de bibliothèque en arrière-plan)
        // restent : elles n'ont personne qui attend devant un écran, et
        // abandonner 280 séries parce que le site a demandé une minute de
        // pause rendait le scan inutile.
        const gardees = [];
        while (q.length) {
            const t = q.shift();
            if (t.patient) gardees.push(t); else t.rejeter(erreurSaturee(id, f));
        }
        q.push(...gardees);
    }
}

function pomper(id) {
    const f = fileDe(id);
    purgerNonUrgentes(id, f);
    while (f.actifs < CONCURRENCE) {
        if (!f.attente.some(q => q.length)) return;
        const attente = f.prochain - Date.now();
        if (attente > 0) {
            if (!f.reveil) f.reveil = setTimeout(() => { f.reveil = null; pomper(id); }, attente);
            return;
        }
        const t = suivant(f);
        if (!t) return;
        if (t.expire && Date.now() > t.expire) {
            t.rejeter(Object.assign(new Error('Requête abandonnée (source occupée)'), { status: 503, abandon: true }));
            continue;
        }
        f.actifs++;
        f.prochain = Date.now() + f.espacement;
        Promise.resolve().then(t.fn).then(
            (v) => { detendre(f); t.resoudre(v); },
            (e) => { if (estLimite(e)) { freiner(id, e); purgerNonUrgentes(id, f); } t.rejeter(e); },
        ).finally(() => {
            f.actifs--;
            pomper(id);
        });
    }
}

/**
 * Exécute `fn` quand la source `id` a une place libre.
 * @param {string} id        identifiant de la source
 * @param {'haute'|'normale'|'basse'} prio
 * @param {() => Promise<any>} fn
 */
function planifier(id, prio, fn, { patient = false } = {}) {
    const niveau = PRIO[prio] ?? PRIO.normale;
    return new Promise((resoudre, rejeter) => {
        fileDe(id).attente[niveau].push({
            fn, resoudre, rejeter, patient,
            expire: (niveau === PRIO.basse && !patient) ? Date.now() + ATTENTE_MAX_BASSE : 0,
        });
        pomper(id);
    });
}

/** Priorité demandée par le client (`X-Inko-Priority: low`), bornée. */
function prioDe(req, defaut = 'normale') {
    const h = String(req.get?.('x-inko-priority') || req.query?.prio || '').toLowerCase();
    if (h === 'low' || h === 'basse') return 'basse';
    return defaut;
}

function etat() {
    const out = {};
    for (const [id, f] of files) out[id] = { actifs: f.actifs, enAttente: f.attente.map(q => q.length), espacementMs: f.espacement };
    return out;
}

module.exports = { planifier, prioDe, etat, CONCURRENCE };
