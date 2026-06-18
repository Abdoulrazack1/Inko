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

    // ── Couleur d'accent personnalisable ──
    function hexToRgba(hex, a) {
        const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
        if (!m) return `rgba(255,107,26,${a})`;
        return `rgba(${parseInt(m[1],16)},${parseInt(m[2],16)},${parseInt(m[3],16)},${a})`;
    }
    function lighten(hex, amt) {
        const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
        if (!m) return '#ff8c42';
        const c = [1,2,3].map(i => Math.min(255, Math.round(parseInt(m[i],16) + 255 * amt)));
        return '#' + c.map(x => x.toString(16).padStart(2,'0')).join('');
    }
    function applyAccent(hex) {
        const accent = hex || window.Storage?.getPref('accent');
        const root = document.documentElement.style;
        if (!accent || accent === '#ff6b1a') {
            root.removeProperty('--orange'); root.removeProperty('--orange2'); root.removeProperty('--orange-glow');
            return;
        }
        root.setProperty('--orange', accent);
        root.setProperty('--orange2', lighten(accent, 0.12));
        root.setProperty('--orange-glow', hexToRgba(accent, 0.25));
        const meta = document.querySelector('meta[name="theme-color"]');
    }
    applyAccent();

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
        applyAccent,
        setAccent(hex) {
            window.Storage?.setPref('accent', hex || '#ff6b1a');
            applyAccent(hex);
        },
        currentAccent() { return window.Storage?.getPref('accent') || '#ff6b1a'; },
        set(theme) {
            window.Storage?.setPref('theme', theme);
            apply(theme);
        },
        current() { return window.Storage?.getPref('theme') || 'dark'; },
    };
})();
