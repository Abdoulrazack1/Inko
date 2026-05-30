// ============================================================
// theme.js — Application du thème (clair/sombre) sur toutes les pages
// ============================================================
// À charger TÔT (juste après storage.js) pour éviter le flash.
// Source de vérité : Storage.getPref('theme') ('dark' | 'light' | 'auto').
// ============================================================
(function () {
    'use strict';

    function resolve(theme) {
        if (theme === 'light') return 'light';
        if (theme === 'dark')  return 'dark';
        // auto → suit le système
        try {
            return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
        } catch (e) { return 'dark'; }
    }

    function apply(theme) {
        const t = resolve(theme || (window.Storage?.getPref('theme')) || 'dark');
        document.documentElement.setAttribute('data-theme', t);
        // Met aussi à jour la meta theme-color pour la PWA
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.content = t === 'light' ? '#ffffff' : '#0d0d0f';
    }

    // Applique immédiatement (avant DOMContentLoaded → pas de flash)
    apply();

    // Réagit aux changements système si mode auto
    try {
        window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
            if ((window.Storage?.getPref('theme') || 'dark') === 'auto') apply('auto');
        });
    } catch (e) {}

    window.Theme = {
        apply,
        set(theme) {
            window.Storage?.setPref('theme', theme);
            apply(theme);
        },
        current() { return window.Storage?.getPref('theme') || 'dark'; },
    };
})();
