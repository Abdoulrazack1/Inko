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

    // Audit A11Y-02 : au changement de thème, les propriétés qui portent une
    // `transition` gardaient l'ANCIENNE couleur. Mesuré : en basculant en clair,
    // les liens du pied de page (`.footer-col a`, qui a `transition: color`)
    // restaient à #b2afa5 — la valeur du thème sombre — sur fond clair #e7e4da,
    // soit 1.73:1 alors que le seuil AA est 4.5:1. Les éléments SANS transition
    // (.footer-desc, même variable) se mettaient bien à jour, ce qui rendait le
    // défaut invisible en lecture de code.
    // Correctif : on neutralise les transitions le temps du basculement, puis on
    // force un recalcul de style avant de les réactiver.
    function suspendTransitions() {
        const style = document.createElement('style');
        style.id = 'theme-switching';
        style.textContent = '*,*::before,*::after{transition:none !important}';
        document.head.appendChild(style);
        return () => {
            void document.documentElement.offsetHeight;   // force le recalcul
            requestAnimationFrame(() => {
                requestAnimationFrame(() => style.remove());
            });
        };
    }

    let booted = false;
    function apply(theme) {
        // §13 : l'édition claire « Washi » est la référence → défaut clair.
        const t = resolve(theme || (window.Storage?.getPref('theme')) || 'light');
        // Au tout premier appel (avant peinture) rien n'a encore de transition
        // en cours : inutile de payer le suspend.
        const restore = booted ? suspendTransitions() : null;
        document.documentElement.setAttribute('data-theme', t);
        // Met aussi à jour la meta theme-color pour la PWA
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.content = t === 'light' ? '#eeece6' : (t === 'amoled' ? '#000000' : '#111113');
        if (restore) restore();
        booted = true;
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
        // '#ff6b1a' = ancien orange par défaut (jamais un choix délibéré) → traité comme
        // « non défini » pour que les comptes existants héritent aussi du nouveau design.
        if (!accent || accent === '#c1531b' || accent.toLowerCase() === '#ff6b1a') {
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
    } catch (e) { window.MH?.err?.('theme.js', e); }

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
