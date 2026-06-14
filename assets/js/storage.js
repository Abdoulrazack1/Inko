// ============================================================
// storage.js — Préférences UI locales (mode lecture, zoom, etc.)
// ============================================================
// La source de vérité pour favoris/progression/etc. est désormais
// l'API backend (cf api.js). Storage ne garde que ce qui est
// strictement local : préférences d'affichage et cache court.
// ============================================================
(function () {
    'use strict';

    const PREF_KEY = 'mh_prefs';
    const DEFAULT_PREFS = {
        readMode:        'page',    // 'page' | 'scroll' | 'double'
        zoom:            100,
        quality:         'high',    // 'high' | 'saver'
        theme:           'dark',
        readingDir:      'rtl',     // right-to-left default for manga
        autoMarkRead:    true,
        notifications:   true,
    };

    function get(key, fb) {
        try { const r = localStorage.getItem(key); return r === null ? fb : JSON.parse(r); }
        catch(e) { return fb; }
    }
    function set(key, val) {
        try { localStorage.setItem(key, JSON.stringify(val)); }
        catch(e) {}
    }

    // Miroir local de la bibliothèque : permet de continuer à voir ses séries
    // même hors-ligne ou déconnecté (la source de vérité reste le serveur).
    const LIB_KEY = 'inko_lib_mirror';

    window.Storage = {
        getPrefs()       { return { ...DEFAULT_PREFS, ...get(PREF_KEY, {}) }; },
        setPref(k, v)    { const p = window.Storage.getPrefs(); p[k] = v; set(PREF_KEY, p); },
        getPref(k)       { return window.Storage.getPrefs()[k]; },

        // ── Cache bibliothèque (favoris) ──
        cacheLibrary(favs) {
            try {
                const slim = (favs || []).map(f => ({
                    mangaId: f.mangaId, title: f.title, cover: f.cover,
                    source: f.source, status: f.status, category: f.category,
                    lastChapter: f.lastChapter,
                }));
                set(LIB_KEY, { at: Date.now(), favs: slim });
            } catch (e) {}
        },
        getCachedLibrary() {
            const c = get(LIB_KEY, null);
            return c && Array.isArray(c.favs) ? c : null;
        },
        clearLibraryCache() { try { localStorage.removeItem(LIB_KEY); } catch (e) {} },
    };
})();
