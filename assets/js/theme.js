// ============================================================
// theme.js — Application du thème (clair/sombre) sur toutes les pages
// ============================================================
// À charger TÔT (juste après storage.js) pour éviter le flash.
// Source de vérité : Storage.getPref('theme') ('dark' | 'light' | 'auto').
// ============================================================
(function () {
    'use strict';

    function resolve(theme) {
        if (theme === 'light')  return 'light';
        if (theme === 'dark')   return 'dark';
        if (theme === 'amoled') return 'amoled';   // noir pur (OLED)
        // auto → suit le système
        try {
            return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
        } catch (e) { return 'dark'; }
    }

    function apply(theme) {
        // §13 : l'édition claire « Washi » est la référence → défaut clair.
        const t = resolve(theme || (window.Storage?.getPref('theme')) || 'light');
        document.documentElement.setAttribute('data-theme', t);
        // Met aussi à jour la meta theme-color pour la PWA
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.content = t === 'light' ? '#eeece6' : (t === 'amoled' ? '#000000' : '#111113');
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
        // §13 : par défaut on laisse le double accent fonctionnel Kakishibu/Ai du CSS.
        // Un accent perso reste possible (power-user) mais écrase le double accent.
        if (!accent || accent === '#c1531b') {
            root.removeProperty('--accent'); root.removeProperty('--orange'); root.removeProperty('--orange2'); root.removeProperty('--orange-glow');
            return;
        }
        root.setProperty('--accent', accent);
        root.setProperty('--orange', accent);
        root.setProperty('--orange2', lighten(accent, 0.12));
        root.setProperty('--orange-glow', 'transparent');   // §13 : aucun glow
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
            window.Storage?.setPref('accent', hex || '#c1531b');
            applyAccent(hex);
        },
        currentAccent() { return window.Storage?.getPref('accent') || '#c1531b'; },
        set(theme) {
            window.Storage?.setPref('theme', theme);
            apply(theme);
        },
        current() { return window.Storage?.getPref('theme') || 'light'; },
    };
})();
