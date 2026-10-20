// ============================================================
// source-secours.js — lire le chapitre ailleurs quand sa source ne répond plus
// ------------------------------------------------------------
// Une source tombe (site en panne, blocage, changement de balisage) : le
// lecteur affichait « Chapitre introuvable », et c'était tout. Or la même
// série est souvent publiée chez une autre source activée — la fiche le sait
// déjà (« Disponible ailleurs », AMEL-102), mais il fallait y retourner,
// chercher, retrouver le chapitre à la main.
//
// Ici, le lecteur le fait seul : même titre (normalisé), même NUMÉRO de
// chapitre, sur les sources d'images activées, une à une. S'il trouve, il lit
// les pages de la source de secours et le DIT, en restant rattaché à la série
// d'origine : la progression continue au même endroit, rien n'est migré.
// Il ne devine pas : titre ou numéro inconnu, rien de proche n'est proposé.
(function () {
    'use strict';

    const norm = (t) => (t || '').toLowerCase().normalize('NFD')
        .replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '');

    /** Le chapitre de même numéro, ou null. */
    function chapitreDeMemeNumero(chapitres, numero) {
        const n = parseFloat(numero);
        if (!Number.isFinite(n)) return null;
        return (chapitres || []).find(c => parseFloat(c.chapter) === n) || null;
    }

    /** Sources candidates : images, activées, capables de chercher, pas celle qui est tombée. */
    function candidates(sources, enPanne, { estRoman = () => false, activee = () => true } = {}) {
        return (sources || []).filter(s => s.id !== enPanne && !estRoman(s.id) && activee(s.id)
            && (s.capabilities || []).includes('search'));
    }

    /**
     * Cherche le chapitre `numero` de `titre` ailleurs. Rend
     * { source, nomSource, mangaId, chapitre, pages } ou null.
     */
    async function chercher({ titre, numero, enPanne, API, MH, max = 4 }) {
        if (!titre || numero == null || !Number.isFinite(parseFloat(numero))) return null;
        let sources = [];
        try { sources = (await API.sources.list()) || []; } catch (e) { return null; }
        const liste = candidates(sources, enPanne, {
            estRoman: (id) => !!MH?.isNovelSource?.(id),
            activee: (id) => (MH?.isSourceEnabled ? MH.isSourceEnabled(id) : true),
        }).slice(0, max);
        const cible = norm(titre);
        // Une à une : c'est un secours, pas une rafale vers cinq sites.
        for (const s of liste) {
            try {
                const r = await API.mangas.searchFor(s.id, { q: titre, limit: 6 });
                const m = (r.results || []).find(x => norm(x.title) === cible);
                if (!m) continue;
                const chs = await API.mangas.chaptersFor(s.id, m.id, {});
                const c = chapitreDeMemeNumero(chs.results || chs.chapters || [], numero);
                if (!c) continue;
                const p = await API.mangas.pagesFor(s.id, c.id);
                if (!(p?.pages || []).length) continue;
                return { source: s.id, nomSource: s.name || s.id, mangaId: m.id, chapitre: c, pages: p.pages };
            } catch (e) { /* cette source aussi est muette : la suivante */ }
        }
        return null;
    }

    window.MH = window.MH || {};
    window.MH.sourceSecours = { norm, chapitreDeMemeNumero, candidates, chercher };
})();
