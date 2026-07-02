// ============================================================
// motion.js — Animations d'interface (GSAP + ScrollTrigger)
// ------------------------------------------------------------
// Chargé sur toutes les pages via global.js. Respecte
// prefers-reduced-motion (n'anime rien si l'utilisateur le demande).
// Rôle purement décoratif : si GSAP est absent, l'app reste 100% fonctionnelle.
// ============================================================
(function () {
    'use strict';

    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const gsap = window.gsap;
    if (!gsap || reduced) {
        // Pas d'animation : on s'assure que rien ne reste masqué.
        window.MH = window.MH || {};
        window.MH.motion = { reveal() {}, enabled: false };
        return;
    }
    if (window.ScrollTrigger) gsap.registerPlugin(window.ScrollTrigger);

    const M = { enabled: true };

    // ── Entrées staggerées : grilles de cartes qui montent en fondu ──
    // Sélecteurs des conteneurs de cartes des différentes pages.
    const GRID_SELECTORS = [
        '#resultsGrid', '#libraryGrid', '.manga-grid', '.card-grid',
        '#latestRow', '.results-grid', '#favsGrid', '.up-cards', '.ad-cards', '.st-cards',
    ];
    const CARD_SELECTORS = '.manga-card, .lib2-card, .up-card, .ad-card, .st-card, .latest-mini';

    let revealObserver = null;
    function ensureObserver() {
        if (revealObserver || !('IntersectionObserver' in window)) return revealObserver;
        revealObserver = new IntersectionObserver((entries, obs) => {
            const batch = entries.filter(e => e.isIntersecting).map(e => e.target);
            if (!batch.length) return;
            batch.forEach(el => obs.unobserve(el));
            gsap.fromTo(batch,
                { opacity: 0, y: 18 },
                { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out', stagger: 0.04, overwrite: 'auto' }
            );
        }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
        return revealObserver;
    }

    // Anime les cartes présentes (ou à venir) dans un conteneur
    function reveal(root) {
        if (!M.enabled) return;
        const scope = root || document;
        const obs = ensureObserver();
        const cards = scope.querySelectorAll(CARD_SELECTORS);
        cards.forEach(c => {
            if (c.dataset.revealed) return;
            c.dataset.revealed = '1';
            gsap.set(c, { opacity: 0, y: 18 });
            if (obs) obs.observe(c);
            else gsap.to(c, { opacity: 1, y: 0, duration: 0.4 });
        });
    }
    M.reveal = reveal;

    // ── Tilt 3D léger au survol des couvertures ──
    function bindTilt() {
        if (matchMedia('(hover: none)').matches) return; // pas de tilt sur tactile
        document.addEventListener('pointermove', onTilt);
        document.addEventListener('pointerleave', onLeave, true);
    }
    function onTilt(e) {
        const card = e.target.closest('.manga-card, .up-avatar, .serie-cover, .focus-cover');
        if (!card) return;
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        gsap.to(card, {
            rotationY: px * 8, rotationX: -py * 8, transformPerspective: 700,
            duration: 0.3, ease: 'power2.out', overwrite: 'auto',
        });
    }
    function onLeave(e) {
        const card = e.target.closest && e.target.closest('.manga-card, .up-avatar, .serie-cover, .focus-cover');
        if (!card) return;
        gsap.to(card, { rotationY: 0, rotationX: 0, duration: 0.5, ease: 'power3.out', overwrite: 'auto' });
    }

    // ── Fondu d'entrée de page + header qui descend ──
    function pageIntro() {
        const header = document.querySelector('.site-header');
        if (header) gsap.fromTo(header, { y: -12, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: 'power2.out' });
        const main = header && header.nextElementSibling;
        if (main) gsap.fromTo(main, { opacity: 0 }, { opacity: 1, duration: 0.35, ease: 'power1.out' });
    }

    function boot() {
        pageIntro();
        bindTilt();
        // Première passe + surveille les grilles remplies dynamiquement
        GRID_SELECTORS.forEach(sel => {
            document.querySelectorAll(sel).forEach(grid => {
                reveal(grid);
                const mo = new MutationObserver(() => reveal(grid));
                mo.observe(grid, { childList: true });
            });
        });
        reveal(document);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();

    window.MH = window.MH || {};
    window.MH.motion = M;
})();
