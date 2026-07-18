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

    // À appeler tôt sur les pages qui lisent les données utilisateur.
    async function ready() {
        if (pulled) return data;
        if (window.API?.isLoggedIn?.()) {
            try {
                const s = await API.me.settings();
                if (s && s.userdata && typeof s.userdata === 'object') {
                    data = Object.assign({}, DEFAULTS, s.userdata);
                    persistLocal();
                }
            } catch (e) { /* hors-ligne : on garde le miroir local */ }
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
        getBookmarks() { return data.bookmarks || []; },
        addBookmark(b) {
            // b: { mangaId, source, title, cover, chapterId, chapterNum, page, label }
            data.bookmarks = data.bookmarks.filter(x => !(x.chapterId === b.chapterId && x.mangaId === b.mangaId));
            data.bookmarks.unshift(Object.assign({ at: Date.now() }, b));
            data.bookmarks = data.bookmarks.slice(0, 200);
            scheduleSync();
        },
        removeBookmark(mangaId, chapterId) {
            data.bookmarks = data.bookmarks.filter(x => !(x.chapterId === chapterId && x.mangaId === mangaId));
            scheduleSync();
        },
        hasBookmark(mangaId, chapterId) {
            return data.bookmarks.some(x => x.chapterId === chapterId && x.mangaId === mangaId);
        },
    };
})();
