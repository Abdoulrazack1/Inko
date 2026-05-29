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

    window.Storage = {
        getPrefs()       { return { ...DEFAULT_PREFS, ...get(PREF_KEY, {}) }; },
        setPref(k, v)    { const p = window.Storage.getPrefs(); p[k] = v; set(PREF_KEY, p); },
        getPref(k)       { return window.Storage.getPrefs()[k]; },
    };
})();
