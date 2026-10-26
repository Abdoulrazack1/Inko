// ============================================================
// reco-tags.js — recommandations par tags croisés, calculées ici
// ------------------------------------------------------------
// La recommandation de l'accueil partait d'UNE série — la dernière lue — et
// d'UN de ses genres : après un chapitre de shōjo entre deux seinens, tout
// l'accueil devenait shōjo. Elle ne savait rien du reste de l'historique.
//
// Ici, un profil : les genres de TOUT ce qu'on a lu, pondérés par la note
// qu'on a donnée, l'avancement, et l'ancienneté (une lecture d'il y a un an
// pèse moitié moins). Puis des candidats qui CROISENT deux genres forts du
// profil — « action + fantasy », pas « action » tout court — classés par
// affinité avec l'ensemble. Aucun service tiers : tout part de l'historique
// local et des recherches de la source.
//
// Les genres d'une série ne sont connus qu'en ouvrant sa fiche : chaque fiche
// chargée les laisse en cache (api.js, `noterTagsSerie` — api.js est chargé
// sur toutes les pages), et le profil s'en sert.
(function () {
    'use strict';

    const CLE = 'inko_tags_series';
    const cle = (source, id) => `${source || ''}|${id}`;

    function lireCache() {
        try { return JSON.parse(localStorage.getItem(CLE) || '{}') || {}; } catch (e) { return {}; }
    }
    function tagsDe(source, id) { return lireCache()[cle(source, id)] || null; }

    /**
     * Profil de genres. `lectures` : [{ tags, note (0-10|null), chapitre,
     * joursDepuis }]. Rend [{ tag, poids }] trié, le plus fort d'abord.
     */
    function profilTags(lectures) {
        const p = new Map();
        for (const l of lectures || []) {
            if (!l?.tags?.length) continue;
            const note = Number.isFinite(l.note) ? l.note : null;
            // Une série notée bas fait BAISSER ses genres ; non notée : neutre.
            const facteurNote = note === null ? 1 : (note - 4) / 3;          // 10 → 2, 7 → 1, 4 → 0, 1 → -1
            const facteurAvance = 1 + Math.min(1, Math.log10(1 + (l.chapitre || 0)) / 2);   // 1 à 2
            const facteurAge = Math.pow(0.5, (l.joursDepuis || 0) / 365);   // demi-vie d'un an
            const w = facteurNote * facteurAvance * facteurAge;
            // Un genre parmi douze compte moins qu'un genre parmi deux.
            const part = w / Math.sqrt(l.tags.length);
            for (const t of l.tags) p.set(t, (p.get(t) || 0) + part);
        }
        return [...p.entries()].map(([tag, poids]) => ({ tag, poids }))
            .filter(x => x.poids > 0)
            .sort((a, b) => b.poids - a.poids);
    }

    /** Paires des trois genres les plus forts : ce qu'on va chercher. */
    function pairesCroisees(profil) {
        const top = profil.slice(0, 3).map(x => x.tag);
        const out = [];
        for (let i = 0; i < top.length; i++) for (let j = i + 1; j < top.length; j++) out.push([top[i], top[j]]);
        return out;
    }

    /** Affinité d'un candidat avec le profil, et les genres qui la portent. */
    function affinite(tags, profil) {
        const poids = new Map(profil.map(x => [x.tag, x.poids]));
        const communs = (tags || []).filter(t => poids.has(t));
        if (communs.length < 2) return { score: 0, communs };   // « croisés » : au moins deux
        const s = communs.reduce((n, t) => n + poids.get(t), 0) / Math.sqrt((tags || []).length);
        return { score: s, communs: communs.sort((a, b) => poids.get(b) - poids.get(a)) };
    }

    window.MH = window.MH || {};
    window.MH.recoTags = { tagsDe, profilTags, pairesCroisees, affinite };
})();
