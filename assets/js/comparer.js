// ============================================================
// comparer.js — le même chapitre chez deux sources, côte à côte
// ------------------------------------------------------------
// Deux équipes de traduction ne rendent pas la même réplique de la même
// façon, et l'une des deux a parfois sauté une bulle ou une page. Jusqu'ici,
// comparer voulait dire deux onglets et des allers-retours. Cette page ouvre
// le chapitre de la source courante à gauche, le même chapitre chez une autre
// source à droite, et fait défiler les deux ensemble.
//
// ── Retrouver la série et le chapitre ailleurs ──────────────
// La série : même rapprochement que « Disponible ailleurs » sur la fiche
// (AMEL-102), un titre normalisé identique. Le chapitre : même NUMÉRO. Les
// identifiants ne se correspondent jamais d'une source à l'autre.
//
// ── Défilement synchronisé ──────────────────────────────────
// Proportionnel, pas au pixel : les deux sources n'ont ni le même nombre de
// pages (crédits, pages de recrutement) ni la même hauteur d'image. À 40 %
// du chapitre à gauche, la droite est à 40 % du sien.
(function () {
    'use strict';

    const norm = (t) => (t || '').toLowerCase().normalize('NFD')
        .replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '');

    /** Le chapitre de même numéro dans une autre liste, ou null. */
    function chapitreEquivalent(chapitres, numero) {
        const n = parseFloat(numero);
        if (!Number.isFinite(n)) return null;
        return (chapitres || []).find(c => parseFloat(c.chapter) === n) || null;
    }

    /** Position proportionnelle d'une colonne à l'autre (0 → 0, fin → fin). */
    function positionCorrespondante(scrollTop, hauteurA, vueA, hauteurB, vueB) {
        const courseA = hauteurA - vueA, courseB = hauteurB - vueB;
        if (courseA <= 0 || courseB <= 0) return 0;
        return Math.round((scrollTop / courseA) * courseB);
    }

    window.MH = window.MH || {};
    window.MH.comparer = { norm, chapitreEquivalent, positionCorrespondante };
    if (typeof document === 'undefined' || !document.getElementById?.('cmpRoot')) return;

    const params = new URLSearchParams(location.search);
    const mangaId = params.get('manga'), chapterId = params.get('chapter'), sourceA = params.get('source');
    const $ = (id) => document.getElementById(id);

    function colonne(el, { source, nom, numero, pages, message }) {
        if (message) { el.innerHTML = `<div class="cmp-vide">${MH.esc(message)}</div>`; return; }
        el.innerHTML = `<div class="cmp-tete"><strong>${MH.esc(nom)}</strong> · ${MH.esc(MH.unitLabel?.(source, { short: true }) || 'Chap.')} ${MH.esc(String(numero))} · ${pages.length} pages</div>`
            + pages.map((p, i) => `<img class="cmp-page" loading="lazy" decoding="async" alt="Page ${i + 1}" src="${MH.esc(MH.proxify(p.url))}">`).join('');
    }

    async function sourcesAvecLaSerie(titre) {
        let sources = [];
        try { sources = (await API.sources.list()) || []; } catch (e) { return []; }
        const candidates = sources.filter(s => s.id !== sourceA
            && !MH.isNovelSource?.(s.id)
            && (MH.isSourceEnabled ? MH.isSourceEnabled(s.id) : true)
            && (s.capabilities || []).includes('search'));
        const cible = norm(titre);
        const trouves = [];
        await Promise.all(candidates.map(async (s) => {
            try {
                const r = await API.mangas.searchFor(s.id, { q: titre, limit: 6 });
                const m = (r.results || []).find(x => norm(x.title) === cible);
                if (m) trouves.push({ source: s.id, nom: s.name || s.id, id: m.id });
            } catch (e) { /* source muette : simplement pas proposée */ }
        }));
        return trouves.sort((a, b) => a.nom.localeCompare(b.nom));
    }

    let numero = null;
    async function chargerB(choix) {
        const el = $('cmpB');
        el.innerHTML = '<div class="cmp-vide">Chargement…</div>';
        try {
            const chaps = await API.mangas.chaptersFor(choix.source, choix.id, { lang: window.Storage?.getPref('readingLang') || 'fr,en' });
            const chap = chapitreEquivalent(chaps.results || [], numero);
            if (!chap) { colonne(el, { message: `${choix.nom} ne propose pas le chapitre ${numero}.` }); return; }
            const p = await API.mangas.pagesFor(choix.source, chap.id);
            colonne(el, { source: choix.source, nom: choix.nom, numero, pages: p.pages || [] });
            el.scrollTop = positionCorrespondante($('cmpA').scrollTop, $('cmpA').scrollHeight, $('cmpA').clientHeight, el.scrollHeight, el.clientHeight);
        } catch (e) {
            colonne(el, { message: `${choix.nom} ne répond pas pour l'instant.` });
        }
    }

    function synchroniser() {
        const a = $('cmpA'), b = $('cmpB');
        let meneur = null, relache = null;
        const suivre = (de, vers) => () => {
            if (!$('cmpSync').checked) return;
            if (meneur && meneur !== de) return;   // l'autre colonne bouge parce qu'on la pousse
            meneur = de;
            vers.scrollTop = positionCorrespondante(de.scrollTop, de.scrollHeight, de.clientHeight, vers.scrollHeight, vers.clientHeight);
            clearTimeout(relache);
            relache = setTimeout(() => { meneur = null; }, 120);
        };
        a.addEventListener('scroll', suivre(a, b), { passive: true });
        b.addEventListener('scroll', suivre(b, a), { passive: true });
    }

    document.addEventListener('DOMContentLoaded', async () => {
        MH.initPage?.('');
        $('cmpRetour').href = MH.readerHref(mangaId, chapterId, sourceA);
        if (!mangaId || !chapterId || !sourceA) {
            colonne($('cmpA'), { message: 'Ouvre cette page depuis le lecteur : il manque la série ou le chapitre.' });
            return;
        }
        synchroniser();
        let manga, chaps, pages;
        try {
            [manga, chaps, pages] = await Promise.all([
                API.mangas.getFrom(sourceA, mangaId),
                API.mangas.chaptersFor(sourceA, mangaId, { lang: window.Storage?.getPref('readingLang') || 'fr,en' }),
                API.mangas.pagesFor(sourceA, chapterId),
            ]);
        } catch (e) {
            colonne($('cmpA'), { message: 'Impossible de charger ce chapitre pour l\'instant.' });
            return;
        }
        const chap = (chaps.results || []).find(c => c.id === chapterId);
        numero = chap?.chapter ?? '?';
        $('cmpTitre').textContent = `${manga.title} — chapitre ${numero}`;
        document.title = `Comparer · ${manga.title} ${numero} — Inko`;
        const nomA = (await API.sources.list().catch(() => [])).find?.(s => s.id === sourceA)?.name || sourceA;
        colonne($('cmpA'), { source: sourceA, nom: nomA, numero, pages: pages.pages || [] });

        const autres = await sourcesAvecLaSerie(manga.title);
        const select = $('cmpSourceB');
        if (!autres.length) {
            select.innerHTML = '<option>Aucune autre source</option>';
            colonne($('cmpB'), { message: 'Aucune autre source activée ne propose cette série.' });
            return;
        }
        select.innerHTML = autres.map((a, i) => `<option value="${i}">${MH.esc(a.nom)}</option>`).join('');
        select.disabled = false;
        const voulue = autres.findIndex(a => a.source === params.get('b'));
        if (voulue > 0) select.value = String(voulue);
        select.addEventListener('change', () => chargerB(autres[+select.value]));
        chargerB(autres[+select.value || 0]);
    });
})();
