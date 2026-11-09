'use strict';
// ============================================================
// bac-a-sable.js — essayer une extension sur UNE série, sans l'activer
// ------------------------------------------------------------
// « Tester » existait déjà, et ne répond qu'à une question : la source
// répond-elle ? Un appel, `limit: 1`, un temps. C'est utile quand une
// source tombe, et insuffisant pour décider de l'activer : une source
// peut répondre à une recherche et ne jamais rendre de chapitres, ou
// rendre des chapitres sans pages lisibles. Le découvrir se faisait en
// l'activant, puis en s'étonnant.
//
// Le bac à sable déroule la CHAÎNE COMPLÈTE sur une seule œuvre —
// chercher, ouvrir la fiche, lister les chapitres, récupérer la première
// page ou le texte — et rend chaque étape séparément, avec son temps et
// ce qu'elle a produit. Une source qui échoue le fait presque toujours à
// UNE étape ; un verdict global ne dit pas laquelle.
//
// ── Ce que ce module ne fait pas, et c'est l'essentiel ──
//
// Il n'active rien, n'installe rien, n'écrit rien : ni favori, ni
// historique, ni préférence, ni cache d'images. Un bac à sable qui
// laisse des traces n'en est pas un. Il se contente d'APPELER
// l'extension telle qu'elle est déjà chargée.
//
// Il est aussi BORNÉ, parce qu'un essai ne doit pas se transformer en
// charge pour le site d'en face : une œuvre, un chapitre, une page, et
// un délai par étape. Le site d'une source est tenu par quelqu'un.

const PAS_DE_DELAI = Number(process.env.SANDBOX_STEP_TIMEOUT_MS || 20000);

/** Borne une promesse dans le temps, sans laisser traîner le minuteur. */
function avecDelai(p, ms, quoi) {
    let t;
    const limite = new Promise((_, rej) => {
        t = setTimeout(() => rej(new Error(`${quoi} : pas de réponse en ${Math.round(ms / 1000)} s`)), ms);
    });
    return Promise.race([p, limite]).finally(() => clearTimeout(t));
}

/** Une étape : son nom, ce qu'elle a produit, ou pourquoi elle a échoué. */
async function etape(nom, attendu, f) {
    const t0 = Date.now();
    try {
        const valeur = await avecDelai(Promise.resolve().then(f), PAS_DE_DELAI, nom);
        const r = attendu(valeur);
        return { etape: nom, ok: r.ok, ms: Date.now() - t0, detail: r.detail, valeur: r.valeur };
    } catch (e) {
        return { etape: nom, ok: false, ms: Date.now() - t0, erreur: e.message || String(e) };
    }
}

// Les extensions rendent une liste sous TROIS formes selon l'endroit :
// un tableau nu, `{ results }`, ou `{ chapters }`. Le chantier avait deja
// releve la meme divergence entre le moteur embarque et le hub, et elle
// m'a repris ici : mon premier lecteur n'acceptait que `{ chapters }` et
// annoncait « aucun chapitre » sur une serie qui en a 556. Un outil de
// diagnostic qui se trompe est pire que pas d'outil.
function liste(r) {
    if (Array.isArray(r)) return r;
    if (r && Array.isArray(r.results)) return r.results;
    if (r && Array.isArray(r.chapters)) return r.chapters;
    if (r && Array.isArray(r.pages)) return r.pages;
    return [];
}
const premier = (r) => liste(r)[0];

/**
 * Déroule la chaîne sur une œuvre.
 * @param {object} src  l'extension, telle que le chargeur l'expose
 * @param {string} q    ce qu'on cherche ; vide = on prend ce que la source met en avant
 * @returns {{id, titre, etapes: Array, verdict: string}}
 */
async function essayer(src, q) {
    if (!src) throw new Error('source inconnue');
    const etapes = [];
    const requete = String(q || '').trim();

    // 1. Trouver UNE œuvre. Sans requête, on prend ce que la source met
    //    en avant : c'est le chemin qu'emprunte la page d'accueil.
    const recherche = await etape(
        requete ? `recherche « ${requete} »` : 'mise en avant',
        (r) => {
            const m = premier(r);
            return m && m.id
                ? { ok: true, detail: `« ${m.title || m.id} »`, valeur: m }
                : { ok: false, detail: 'aucun résultat exploitable (pas d’`id`)' };
        },
        () => (requete
            ? src.search({ q: requete, limit: 1 })
            : (typeof src.popular === 'function' ? src.popular({ limit: 1 })
                : typeof src.latest === 'function' ? src.latest({ limit: 1 })
                    : src.search({ q: 'a', limit: 1 }))),
    );
    etapes.push(recherche);
    const oeuvre = recherche.valeur;
    delete recherche.valeur;
    if (!oeuvre) return { etapes, verdict: verdictDe(etapes) };

    // 2. La fiche. C'est elle qui porte le titre, la couverture, le
    //    statut : une source qui la rend vide donne une bibliothèque
    //    pleine de cartes anonymes.
    const fiche = await etape('fiche de l’œuvre',
        (m) => (m && (m.title || m.id)
            ? { ok: true, detail: resumerFiche(m), valeur: m }
            : { ok: false, detail: 'fiche vide' }),
        () => src.getManga(oeuvre.id));
    etapes.push(fiche);
    const detail = fiche.valeur || oeuvre;
    delete fiche.valeur;

    // 3. Les chapitres.
    const chap = await etape('liste des chapitres',
        (r) => {
            const l = liste(r);
            return l.length
                ? { ok: true, detail: `${l.length} chapitre(s)`, valeur: l[l.length - 1] }
                // Verifie : sur MangaDex, une oeuvre mise en avant peut
                // n'avoir AUCUN chapitre dans la langue reglee. L'etape
                // echoue a juste titre, mais la cause n'est pas la source :
                // le dire evite d'accuser une extension qui fonctionne.
                : { ok: false, detail: 'aucun chapitre — soit cette œuvre n’en a pas '
                    + 'dans la langue réglée, soit la source ne les rend plus. Réessaie '
                    + 'en nommant une série que tu sais disponible.' };
        },
        () => src.getChapters(oeuvre.id));
    etapes.push(chap);
    const unChapitre = chap.valeur;
    delete chap.valeur;
    if (!unChapitre) return { id: oeuvre.id, titre: detail.title, etapes, verdict: verdictDe(etapes) };

    // 4. Le contenu : des pages, ou du texte. C'est l'étape qu'un simple
    //    « la source répond » ne regardait jamais, et c'est la seule qui
    //    dise si on pourra LIRE.
    // Le TYPE DECLARE par l'extension, pas une devinette sur ses methodes.
    //
    // Premiere version : « elle a getText et pas getPages, donc c'est du
    // texte ». Faux pour Project Gutenberg, qui expose les deux — son
    // `getPages` existe uniquement pour lever une erreur explicative. Le
    // bac a sable appelait donc getPages sur une source de livres et
    // rapportait l'echec comme un defaut de la source, alors qu'il
    // s'etait trompe de porte. Les extensions declarent `type` :
    // 'novel' ou 'book' pour du texte, autre chose pour des planches.
    const type = String(src.type || src.format || '').toLowerCase();
    const roman = typeof src.getText === 'function'
        && (type === 'novel' || type === 'book' || typeof src.getPages !== 'function');
    const contenu = roman
        ? await etape('texte du chapitre',
            (t) => {
                const s = typeof t === 'string' ? t : (t && (t.content || t.text)) || '';
                return s.length > 200
                    ? { ok: true, detail: `${s.length} caractères` }
                    : { ok: false, detail: `seulement ${s.length} caractère(s)` };
            },
            () => src.getText(unChapitre.id, oeuvre.id))
        : await etape('pages du chapitre',
            (p) => {
                const l = liste(p);
                return l.length
                    ? { ok: true, detail: `${l.length} page(s), la 1re : ${apercuUrl(l[0])}` }
                    : { ok: false, detail: 'aucune page' };
            },
            () => src.getPages(unChapitre.id, oeuvre.id));
    etapes.push(contenu);

    return { id: oeuvre.id, titre: detail.title || oeuvre.title, etapes, verdict: verdictDe(etapes) };
}

function resumerFiche(m) {
    const bouts = [];
    if (m.title) bouts.push(`« ${m.title} »`);
    bouts.push(m.cover || m.coverThumb ? 'couverture' : 'SANS couverture');
    if (m.status) bouts.push(m.status);
    if (Array.isArray(m.tags) && m.tags.length) bouts.push(`${m.tags.length} tag(s)`);
    return bouts.join(', ');
}

function apercuUrl(p) {
    const u = typeof p === 'string' ? p : (p && (p.url || p.src)) || '';
    try { return new URL(u).host; } catch (e) { return u ? u.slice(0, 40) : '(vide)'; }
}

// Le verdict ne résume pas, il DÉSIGNE. « Partiel » sans dire où serait
// aussi inutile que l'ancien « Erreur ».
function verdictDe(etapes) {
    const kos = etapes.filter((e) => !e.ok);
    if (!kos.length) return 'complet : cette source est lisible de bout en bout';
    if (kos.length === etapes.length) return 'aucune étape ne passe : la source ne répond pas, ou a changé';
    return 'partiel : ' + kos.map((e) => e.etape).join(', ');
}

module.exports = { essayer, PAS_DE_DELAI };
