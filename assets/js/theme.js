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
        // Audit AMEL-83 : contraste renforce (AAA). Ce n'est PAS une variante
        // de « clair » : il doit rester choisi explicitement, y compris quand
        // le systeme est en sombre — quelqu'un qui en a besoin en a besoin
        // tout le temps.
        if (theme === 'contrast') return 'contrast';
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
        if (meta) {
            meta.content = t === 'light' ? '#eeece6'
                : t === 'amoled' ? '#000000'
                    : t === 'contrast' ? '#ffffff' : '#111113';
        }
        if (restore) restore();
        booted = true;
    }

    // ── Couleur d'accent personnalisable ──
    // `hexToRgba` vivait ici pour fabriquer le halo de l'accent. Le §13 a
    // supprime le halo (`--orange-glow: transparent`) : la fonction n'avait
    // plus d'appelant, seulement l'air d'en avoir un.
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

    // ── Densité d'affichage ──
    // Les trois jeux de jetons existaient depuis l'étape 2 ; il n'y avait
    // aucun moyen de les choisir. `[data-densite]` était stylé, et
    // personne ne posait jamais l'attribut.
    //
    // Posé ici plutôt qu'ailleurs pour la même raison que le thème : il
    // change la taille des cartes et l'écart des grilles, donc il doit
    // être là AVANT la première peinture. Appliqué après coup, toute la
    // page se réorganiserait sous les yeux.
    //
    // « Confortable » est le défaut, et c'est l'ABSENCE d'attribut : un
    // défaut qui doit s'écrire quelque part finit par s'écrire deux fois.
    const DENSITES = ['compact', 'confortable', 'spacieux'];
    function applyDensite(d) {
        const v = d || window.Storage?.getPref?.('densite') || 'confortable';
        const root = document.documentElement;
        if (!DENSITES.includes(v) || v === 'confortable') root.removeAttribute('data-densite');
        else root.setAttribute('data-densite', v);
    }
    applyDensite();

    // Applique immédiatement (avant DOMContentLoaded → pas de flash)
    apply();

    // Réagit aux changements système si mode auto
    try {
        window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
            if ((window.Storage?.getPref('theme') || 'dark') === 'auto') apply('auto');
        });
    } catch (e) { window.MH?.err?.('theme.js', e); }

    // ── L'apparence, emportable ─────────────────────────────
    //
    // Trois réglages d'apparence vivent dans `Storage` — le thème, la
    // couleur d'accent, la densité — et six de plus pour la typographie
    // des romans. Les régler prend du temps, et ce temps était perdu à
    // chaque nouvel appareil : rien ne permettait de les emporter.
    //
    // CE QU'ON N'IMPORTE PAS, et c'est le cœur de la décision. Un
    // « thème personnalisé » pourrait vouloir dire un fichier qui pose
    // des variables CSS arbitraires. On s'y refuse : un fichier qui
    // s'échange pourrait alors rendre un texte invisible, ou repeindre
    // un bouton de suppression en bouton anodin. Ce qui passe est une
    // LISTE FERMÉE de réglages, chacun validé contre son domaine. Un
    // fichier de thème ne peut donc rien faire que l'interface des
    // réglages ne permette déjà.
    //
    // Et rien ne part nulle part : un fichier sur l'appareil, lu par
    // l'appareil. L'application promet de ne rien envoyer.
    const HEX = /^#[0-9a-f]{6}$/i;
    const CHAMPS = {
        theme:       (v) => ['light', 'dark', 'amoled', 'contrast', 'auto'].includes(v),
        accent:      (v) => typeof v === 'string' && HEX.test(v),
        densite:     (v) => DENSITES.includes(v),
        novel_size:  (v) => Number.isFinite(+v) && +v >= 12 && +v <= 32,
        novel_lh:    (v) => Number.isFinite(+v) && +v >= 1.2 && +v <= 2.6,
        novel_width: (v) => Number.isFinite(+v) && +v >= 40 && +v <= 100,
        novel_font:  (v) => ['serif', 'sans', 'mono'].includes(v),
        novel_theme: (v) => ['dark', 'black', 'sepia', 'light'].includes(v),
        novel_mode:  (v) => ['scroll', 'pages'].includes(v),
    };

    function exporterApparence() {
        const out = {};
        for (const cle of Object.keys(CHAMPS)) {
            const v = window.Storage?.getPref?.(cle);
            if (v !== undefined && v !== null && v !== '') out[cle] = v;
        }
        // `format` pour qu'un fichier d'une version future soit reconnu
        // comme tel au lieu d'être appliqué de travers.
        return { format: 'inko-apparence', version: 1, reglages: out };
    }

    /**
     * @returns {{appliques: string[], refuses: string[], erreur?: string}}
     * Les refus sont RENDUS, pas avalés : un réglage qui ne passe pas doit
     * se dire, sinon on cherche pourquoi la couleur n'a pas changé.
     *
     * L'import FUSIONNE, il ne remplace pas. Un fichier qui ne dit rien
     * de la typographie des romans laisse la sienne : importer l'apparence
     * de quelqu'un ne doit pas effacer en silence un réglage dont ce
     * fichier n'a jamais parlé. Un export complet, lui, porte tout ce qui
     * est posé — alors un aller-retour rend bien l'état d'origine.
     */
    function importerApparence(donnees) {
        if (!donnees || typeof donnees !== 'object' || Array.isArray(donnees)) {
            return { appliques: [], refuses: [], erreur: 'Ce fichier n’est pas une apparence Inko.' };
        }
        if (donnees.format !== 'inko-apparence') {
            return { appliques: [], refuses: [], erreur: 'Ce fichier n’est pas une apparence Inko.' };
        }
        if (donnees.version !== 1) {
            return { appliques: [], refuses: [], erreur: `Apparence en version ${donnees.version}, cette app lit la 1.` };
        }
        const r = donnees.reglages;
        if (!r || typeof r !== 'object' || Array.isArray(r)) {
            return { appliques: [], refuses: [], erreur: 'Le fichier ne contient aucun réglage.' };
        }
        const appliques = [], refuses = [];
        for (const [cle, val] of Object.entries(r)) {
            const valide = CHAMPS[cle];
            if (!valide || !valide(val)) { refuses.push(cle); continue; }
            window.Storage?.setPref?.(cle, val);
            appliques.push(cle);
        }
        // Les trois réglages de l'interface se voient tout de suite ; la
        // typographie des romans s'applique à l'ouverture d'un chapitre,
        // puisque c'est là qu'elle est lue.
        if (appliques.includes('theme')) apply(r.theme);
        if (appliques.includes('accent')) applyAccent(r.accent);
        if (appliques.includes('densite')) applyDensite(r.densite);
        return { appliques, refuses };
    }

    window.Theme = {
        apply,
        exporterApparence,
        importerApparence,
        champsApparence: Object.keys(CHAMPS),
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
        applyDensite,
        densites: DENSITES.slice(),
        currentDensite() { return window.Storage?.getPref('densite') || 'confortable'; },
    };
})();
