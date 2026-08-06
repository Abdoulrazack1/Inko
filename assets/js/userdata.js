// ============================================================
// userdata.js — Données utilisateur légères, jamais perdues.
// ------------------------------------------------------------
// Stocke signets, notes personnelles, épingles, objectif de
// lecture et historique de recherche. Double persistance :
//   1) miroir localStorage (instantané, hors-ligne)
//   2) synchro serveur via /me/settings (clé "userdata")
// La source de vérité reste le compte ; le local évite toute
// perte visuelle entre deux sessions ou hors connexion.
// ============================================================
(function () {
    'use strict';

    const LKEY = 'inko_userdata_v1';
    const DEFAULTS = { notes: {}, pins: [], goal: {}, searchHistory: [], bookmarks: [] };

    let data = load();
    let pulled = false;
    let saveTimer = null;

    function load() {
        try { return Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(LKEY)) || {}); }
        catch (e) { return Object.assign({}, DEFAULTS); }
    }
    function persistLocal() { try { localStorage.setItem(LKEY, JSON.stringify(data)); } catch (e) { window.MH?.err?.('userdata.js', e); } }

    function scheduleSync() {
        persistLocal();
        if (!window.API?.isLoggedIn?.()) return;
        clearTimeout(saveTimer);
        saveTimer = setTimeout(async () => {
            try { await API.me.saveSettings({ userdata: data }); } catch (e) { window.MH?.err?.('userdata.js', e); }
        }, 700);
    }

    // Envoi d'un signet, sans bloquer l'interface : la pose d'un signet doit
    // être instantanée à l'écran, le serveur suit.
    function envoyerSignet(b) {
        if (!window.API?.isLoggedIn?.()) return;
        API.me.addBookmark(b).catch(e => window.MH?.err?.('userdata.js', e));
    }

    // À appeler tôt sur les pages qui lisent les données utilisateur.
    async function ready() {
        if (pulled) return data;
        if (window.API?.isLoggedIn?.()) {
            try {
                const s = await API.me.settings();
                if (s && s.userdata && typeof s.userdata === 'object') {
                    // `bookmarks` ne vient plus des réglages (audit AMEL-41) :
                    // on garde ceux déjà en mémoire pour ne pas les écraser
                    // avec un blob qui, après migration, ne les contient plus.
                    const { bookmarks: _ignore, ...reste } = s.userdata;
                    data = Object.assign({}, DEFAULTS, reste, { bookmarks: data.bookmarks || [] });
                    persistLocal();
                }
            } catch (e) { /* hors-ligne : on garde le miroir local */ }
            try {
                const liste = await API.me.bookmarks();
                if (Array.isArray(liste)) { data.bookmarks = liste; persistLocal(); }
            } catch (e) { /* hors-ligne : le miroir local fait foi */ }
        }
        pulled = true;
        return data;
    }

    const keyOf = (mangaId, source) => `${source || ''}:${mangaId}`;

    window.UserData = {
        ready,
        all() { return data; },

        // ── Notes personnelles par série ──
        getNote(mangaId, source) { return data.notes[keyOf(mangaId, source)] || ''; },
        setNote(mangaId, source, text) {
            const k = keyOf(mangaId, source);
            if (text && text.trim()) data.notes[k] = text.trim();
            else delete data.notes[k];
            scheduleSync();
        },

        // ── Épingles (séries en haut de la bibliothèque) ──
        isPinned(mangaId, source) { return data.pins.includes(keyOf(mangaId, source)); },
        togglePin(mangaId, source) {
            const k = keyOf(mangaId, source);
            const i = data.pins.indexOf(k);
            if (i >= 0) data.pins.splice(i, 1); else data.pins.unshift(k);
            scheduleSync();
            return i < 0; // true si désormais épinglé
        },
        pinKey: keyOf,

        // ── Objectif de lecture ──
        getGoal() { return data.goal || {}; },
        setGoal(g) { data.goal = Object.assign({}, data.goal, g); scheduleSync(); },

        // ── Historique de recherche ──
        getSearchHistory() { return data.searchHistory || []; },
        pushSearch(q) {
            q = (q || '').trim();
            if (!q) return;
            data.searchHistory = [q, ...data.searchHistory.filter(x => x.toLowerCase() !== q.toLowerCase())].slice(0, 12);
            scheduleSync();
        },
        clearSearchHistory() { data.searchHistory = []; scheduleSync(); },

        // ── Signets de lecture (chapitre + position) ──
        // Audit AMEL-41 : ils vivaient dans le blob de réglages, rechargé à
        // chaque page et réécrit EN ENTIER au moindre ajout — avec un plafond
        // arbitraire de 200. Ils ont désormais leur table.
        //
        // La surface reste SYNCHRONE (`getBookmarks()` rend un tableau) : une
        // douzaine d'appelants la lisent en plein rendu, et la rendre async
        // aurait demandé de réécrire chacun d'eux pour un gain nul. Le miroir
        // local sert de source de lecture, le serveur de source de vérité.
        getBookmarks() { return data.bookmarks || []; },
        addBookmark(b) {
            // b: { mangaId, source, title, cover, chapterId, chapterNum, page, label }
            data.bookmarks = data.bookmarks.filter(x => !(x.chapterId === b.chapterId && x.mangaId === b.mangaId));
            data.bookmarks.unshift(Object.assign({ at: Date.now() }, b));
            persistLocal();
            envoyerSignet(b);
        },
        removeBookmark(mangaId, chapterId) {
            data.bookmarks = data.bookmarks.filter(x => !(x.chapterId === chapterId && x.mangaId === mangaId));
            persistLocal();
            if (window.API?.isLoggedIn?.()) {
                API.me.removeBookmark(mangaId, chapterId)
                    .catch(e => window.MH?.err?.('userdata.js', e));
            }
        },
        hasBookmark(mangaId, chapterId) {
            return data.bookmarks.some(x => x.chapterId === chapterId && x.mangaId === mangaId);
        },
    };
})();
