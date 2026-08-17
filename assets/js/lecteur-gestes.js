// ============================================================
// lecteur-gestes.js — le pinch, et le chrome qui s'efface
// ------------------------------------------------------------
// Audit IX.8 : « le lecteur, c'est 90 % du temps passé dans l'app ; tout le
// reste n'existe que pour y amener. »
//
// `chapitre.js` porte déjà le balayage horizontal et le double-tap. Deux
// gestes manquaient, et l'audit les nomme :
//
//   · le PINCH — « Pincer → zoom : boutons `changeZoom`, morts sous CSP ;
//     aucun pinch ». C'est le geste que tout lecteur essaie en premier sur
//     une planche dont il ne lit pas les bulles.
//   · le CHROME QUI S'EFFACE — « au repos : rien. Ni barre, ni compteur, ni
//     bouton. » Aujourd'hui la barre reste, et mange 50 px de hauteur en
//     permanence sur un écran de 812.
//
// Module séparé : `chapitre.js` fait 1 654 lignes, et y empiler une machine à
// états tactile le rendrait illisible. Ici, tout ce qui touche au doigt.
//
// ── La décision sur le pinch ────────────────────────────────
// L'audit la demandait explicitement : « laisser au WebView
// (`user-scalable=yes`) est gratuit mais casse la mise en page ; le gérer
// soi-même est le seul moyen d'obtenir un zoom qui reste DANS la planche ».
//
// On le gère soi-même. Le zoom du navigateur déplacerait la barre d'outils, la
// barre de navigation et le reste de la page hors de l'écran — on ne veut
// zoomer QUE la planche, et pouvoir la faire glisser une fois zoomée.
(function () {
    'use strict';
    if (window.MH?.lecteurGestes) return;

    // Un pincement plus court que ça est un tremblement, pas une intention.
    const SEUIL_PINCH = 12;
    const ZOOM_MIN = 100, ZOOM_MAX = 400;
    const CHROME_MS = 3000;

    /**
     * Attache les gestes à la zone de lecture.
     * @param {object} api  fourni par `chapitre.js` :
     *   { zone, wrappers(), getZoom(), setZoom(z, point), estDefilement() }
     */
    function attacher(api) {
        const zone = api.zone;
        if (!zone || zone.dataset.gestesBound) return;
        zone.dataset.gestesBound = '1';

        pinch(zone, api);
        chromeAuto(api);
    }

    // ── Pinch ───────────────────────────────────────────────
    function pinch(zone, api) {
        let actif = false;
        let ecartInitial = 0;
        let zoomInitial = 100;
        let centre = null;

        const ecart = (t) => {
            const dx = t[0].clientX - t[1].clientX;
            const dy = t[0].clientY - t[1].clientY;
            return Math.hypot(dx, dy);
        };
        const milieu = (t) => ({
            x: (t[0].clientX + t[1].clientX) / 2,
            y: (t[0].clientY + t[1].clientY) / 2,
        });

        zone.addEventListener('touchstart', (e) => {
            if (e.touches.length !== 2) return;
            actif = true;
            ecartInitial = ecart(e.touches);
            zoomInitial = api.getZoom();
            centre = milieu(e.touches);
        }, { passive: true });

        // NON passif : c'est le seul moyen d'empêcher le zoom du NAVIGATEUR,
        // qui déplacerait toute la page — barre d'outils comprise — au lieu de
        // la seule planche.
        zone.addEventListener('touchmove', (e) => {
            if (!actif || e.touches.length !== 2) return;
            e.preventDefault();
            const d = ecart(e.touches);
            if (Math.abs(d - ecartInitial) < SEUIL_PINCH) return;
            const facteur = d / (ecartInitial || 1);
            const z = Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoomInitial * facteur)));
            // L'ancrage suit le MILIEU des deux doigts : c'est le point que
            // l'utilisateur désigne, et il doit rester sous eux.
            api.setZoom(z, z > 100 ? centre : null);
        }, { passive: false });

        const fin = (e) => {
            if (!actif) return;
            if (e.touches && e.touches.length > 0) return;   // un doigt reste posé
            actif = false;
            // Sous 105 %, on retombe franchement à 100 : un zoom de 102 % laisse
            // une planche floue et un utilisateur qui ne sait pas s'il a zoomé.
            if (api.getZoom() < 105) api.setZoom(100, null);
        };
        zone.addEventListener('touchend', fin, { passive: true });
        zone.addEventListener('touchcancel', fin, { passive: true });
    }

    // ── Le chrome s'efface ──────────────────────────────────
    // « Au repos : rien. » La barre réapparaît au tap central et se retire
    // seule après 3 s. On ne la masque JAMAIS tant que l'utilisateur la
    // touche : un menu qui disparaît sous le doigt est une trahison.
    function chromeAuto(api) {
        const barre = document.getElementById('readerToolbar');
        if (!barre || barre.dataset.autoHide) return;
        barre.dataset.autoHide = '1';

        // Seulement au doigt. À la souris, une barre qui s'efface oblige à
        // bouger pour la retrouver — c'est du bruit, pas du confort.
        if (!window.matchMedia || !window.matchMedia('(pointer: coarse)').matches) return;

        // IX.8 : « Au repos : rien. » La barre d'état d'Android fait partie de
        // ce rien. Une planche qui s'arrête 24 px sous le haut de l'écran n'est
        // pas immersive, et l'heure posée au-dessus d'une case est du bruit
        // exactement là où le regard travaille.
        //
        // Elle suit le même état que la barre de l'application : les faire
        // disparaître séparément donnerait un demi plein-écran, qui a l'air
        // d'un défaut d'affichage plutôt que d'une intention.
        const immersion = (actif) => { window.INKO_NATIF?.immersion?.(actif); };

        let minuteur = null;
        const montrer = () => {
            immersion(false);
            barre.classList.remove('chrome-cache');
            clearTimeout(minuteur);
            minuteur = setTimeout(() => {
                // Ne pas se retirer si l'utilisateur est en train d'interagir
                // avec la barre elle-même.
                if (barre.matches(':hover') || barre.contains(document.activeElement)) { montrer(); return; }
                barre.classList.add('chrome-cache');
                immersion(true);
            }, CHROME_MS);
        };
        const basculer = () => {
            if (barre.classList.contains('chrome-cache')) montrer();
            else { clearTimeout(minuteur); barre.classList.add('chrome-cache'); immersion(true); }
        };

        // En quittant le lecteur, la barre d'état doit revenir. Sans ça, on
        // sort sur une bibliothèque sans heure ni batterie — et l'utilisateur
        // croit que c'est l'application qui est cassée, pas qu'elle a oublié de
        // rendre ce qu'elle avait emprunté.
        window.addEventListener('pagehide', () => immersion(false));

        // Le tap CENTRAL bascule. Les tiers gauche et droit appartiennent déjà
        // à la navigation de page (`data-act`), et les leur voler ferait
        // tourner une page à chaque tentative d'afficher la barre.
        api.zone.addEventListener('click', (e) => {
            if (e.target.closest('[data-act]')) return;   // zone de navigation
            const r = api.zone.getBoundingClientRect();
            const x = (e.clientX - r.left) / (r.width || 1);
            if (x > 0.33 && x < 0.67) basculer();
        });

        // Le défilement révèle la barre : on cherche souvent à revenir en
        // arrière juste après avoir fait défiler.
        let dernierY = window.scrollY;
        window.addEventListener('scroll', () => {
            if (Math.abs(window.scrollY - dernierY) > 40) { dernierY = window.scrollY; montrer(); }
        }, { passive: true });

        montrer();
        window.MH?.toast?.('Touche le centre de l’écran pour afficher ou masquer la barre');
    }

    window.MH = window.MH || {};
    window.MH.lecteurGestes = attacher;
})();
