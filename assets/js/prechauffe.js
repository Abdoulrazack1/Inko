// ============================================================
// prechauffe.js — préparer les prochains chapitres, sur secteur et en Wi-Fi
// ------------------------------------------------------------
// Télécharger pour le trajet du lendemain, c'est y penser la veille, série par
// série. Or le meilleur moment est connu : le téléphone branché, sur le Wi-Fi
// de la maison. Avec l'option, Inko y met en file les DEUX chapitres qui
// suivent la position de chacune des cinq séries lues le plus récemment.
//
// ── Conditions, toutes requises ─────────────────────────────
//   · sur secteur (`navigator.getBattery`) — inconnu = non : on ne vide pas
//     une batterie pour un confort ;
//   · pas sur le réseau mobile, et pas en mode économie de données ;
//   · au plus une fois toutes les six heures.
// La file existante fait le reste : un chapitre à la fois, reprise après
// coupure, et le plafond de stockage s'il y en a un.
(function () {
    'use strict';

    const CLE_DERNIER = 'inko_prechauffe_dernier';
    const INTERVALLE = 6 * 3600 * 1000;
    const SERIES = 5, PAR_SERIE = 2;

    /** Toutes les conditions sont-elles réunies ? */
    function conditionsReunies({ secteur, reseau, economie }) {
        if (secteur !== true) return false;
        if (economie) return false;
        return reseau !== 'cellular' && reseau !== 'aucun' && reseau !== 'none';
    }

    /** Les `n` chapitres qui suivent la position, pas encore téléchargés. */
    function chapitresAPrechauffer(chapitres, position, dejaLa, n = PAR_SERIE) {
        const num = (c) => parseFloat(c.chapter);
        return (chapitres || [])
            .filter(c => Number.isFinite(num(c)) && num(c) > position && !dejaLa.has(c.id))
            .sort((a, b) => num(a) - num(b))
            .slice(0, n);
    }

    async function etat() {
        let secteur = null, reseau = 'inconnu';
        try { secteur = navigator.getBattery ? !!(await navigator.getBattery()).charging : null; } catch (e) { secteur = null; }
        try {
            if (window.INKO_NATIF?.reseau) reseau = (await window.INKO_NATIF.reseau()).type || 'inconnu';
            else if (navigator.connection?.type) reseau = navigator.connection.type;
        } catch (e) { /* inconnu */ }
        return { secteur, reseau, economie: !!navigator.connection?.saveData };
    }

    function actif() { return window.Storage?.getPref?.('prechauffe') === '1'; }

    async function lancer({ force = false } = {}) {
        if (!actif() || !window.API?.isLoggedIn?.() || !window.DlFile || !window.Downloads) return { lance: false, raison: 'inactif' };
        let dernier = 0;
        try { dernier = Number(localStorage.getItem(CLE_DERNIER)) || 0; } catch (e) { /* stockage bloqué */ }
        if (!force && Date.now() - dernier < INTERVALLE) return { lance: false, raison: 'recent' };
        if (!conditionsReunies(await etat())) return { lance: false, raison: 'conditions' };
        try { localStorage.setItem(CLE_DERNIER, String(Date.now())); } catch (e) { /* tant pis */ }

        const prog = await window.API.me.progress();
        const series = Object.entries(prog || {}).map(([id, p]) => ({ mangaId: id, ...p }))
            .filter(p => p.source && !window.MH?.isNovelSource?.(p.source) && Number.isFinite(parseFloat(p.chapter)))
            .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
            .slice(0, SERIES);
        const dejaLa = new Set((await window.Downloads.list()).map(c => c.chapterId));
        // La progression ne porte ni titre ni couverture : la file les affiche.
        const fiches = new Map();
        try { ((await window.API.me.favorites()) || []).forEach(f => fiches.set(f.mangaId, f)); } catch (e) { /* sans titres */ }
        let ajoutes = 0;
        for (const s of series) {
            try {
                const r = await window.API.mangas.chaptersFor(s.source, s.mangaId, { lang: window.Storage?.getPref?.('readingLang') || 'fr,en' });
                const lot = chapitresAPrechauffer(r.results || [], parseFloat(s.chapter), dejaLa);
                ajoutes += window.DlFile.ajouter(lot.map(c => ({
                    chapterId: c.id, mangaId: s.mangaId, chapterNum: c.chapter,
                    mangaTitle: fiches.get(s.mangaId)?.title || '', cover: fiches.get(s.mangaId)?.cover || '', source: s.source,
                })));
            } catch (e) { /* source muette : la suivante */ }
        }
        return { lance: true, ajoutes };
    }

    window.MH = window.MH || {};
    window.MH.prechauffe = { conditionsReunies, chapitresAPrechauffer, lancer, etat };

    if (typeof document === 'undefined' || !document.addEventListener) return;
    document.addEventListener('DOMContentLoaded', () => {
        // Pas au premier affichage : la page a mieux à faire pendant dix secondes.
        setTimeout(() => { lancer().catch(() => {}); }, 10000);
        // Et au moment où l'on branche le téléphone.
        navigator.getBattery?.().then(b => b.addEventListener('chargingchange', () => {
            if (b.charging) lancer().catch(() => {});
        })).catch(() => {});
    });
})();
