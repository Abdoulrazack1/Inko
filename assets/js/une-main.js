// ============================================================
// une-main.js — atteindre le haut de l'écran avec un pouce
// ------------------------------------------------------------
// Audit P3.4 / AMEL-84.
//
// Un téléphone moderne fait 6,7 pouces. Tenu à une main — dans le métro, une
// main sur la barre — le pouce couvre environ les deux tiers bas de l'écran.
// Tout ce qui est au-dessus demande de changer de prise, c'est-à-dire de
// libérer l'autre main, c'est-à-dire de s'arrêter.
//
// Ce n'est pas une préférence esthétique : c'est la différence entre une
// application utilisable debout et une application utilisable assis.
//
// ── Ce que ce mode fait, et ce qu'il ne fait pas ────────────
//
// Il DESCEND le contenu : la page entière glisse vers le bas d'un tiers de
// l'écran, laissant une bande vide en haut. Tout ce qui était hors de portée
// entre dans la zone du pouce. Toucher la bande vide remonte la page.
//
// C'est le geste d'« accessibilité » d'iOS et de One-Handed Mode d'Android —
// délibérément le même, parce qu'il est déjà appris. Inventer un autre moyen
// d'atteindre le haut de l'écran, c'est demander à l'utilisateur d'apprendre
// deux fois la même chose.
//
// Il NE réorganise PAS les écrans. Une mise en page « main gauche » et une
// « main droite » doubleraient le nombre d'écrans à tenir à jour, pour un gain
// que ce simple décalage obtient déjà.
//
// ── Pourquoi il se retire tout seul ─────────────────────────
//
// Le mode est ponctuel : on l'active pour atteindre un bouton, pas pour lire
// avec un tiers d'écran en moins. Il se retire au premier appui utile, et après
// dix secondes d'inactivité. Un mode qu'on doit penser à désactiver est un mode
// qu'on finit par subir.
(function () {
    'use strict';
    if (window.MH?.uneMain) return;

    // Sans pointeur grossier, ce mode n'a aucun sens : à la souris, tout
    // l'écran est déjà à portée.
    if (!window.matchMedia || !matchMedia('(hover: none)').matches) return;

    const CLE = 'inko_une_main';
    const DECALAGE = 0.32;      // part de la hauteur d'écran libérée en haut
    const REPOS_MS = 10000;     // retrait automatique après inactivité

    let actif = false;
    let minuteur = null;

    function styles() {
        if (document.getElementById('mh-une-main-css')) return;
        const s = document.createElement('style');
        s.id = 'mh-une-main-css';
        s.textContent = `
        /* ── Pourquoi un rembourrage et NON un \`transform\` sur le corps ──
           Le réflexe est de translater \`body\`. Mesuré, il casse tout : un
           élément transformé devient le BLOC CONTENEUR de ses descendants
           \`position: fixed\`. L'en-tête, déjà fixe en haut, descendait alors
           deux fois (520 px au lieu de 260), et la barre d'onglets — fixée à
           \`bottom: 0\` — se retrouvait au bas du DOCUMENT et non de l'écran :
           mesurée à 4922 px, c'est-à-dire nulle part.

           Décaler le flux ne crée aucun bloc conteneur. Le contenu descend,
           les éléments fixes restent maîtres de leur position, et on ne
           déplace ensuite que ceux qu'il faut.

           Et une MARGE, pas un rembourrage : le corps porte déjà un
           padding-top qui dégage l'en-tête fixe (52 px ici). Le redéfinir le
           REMPLACERAIT — mesuré, 52 px devenaient 260 au lieu de 312, et le
           contenu passait sous l'en-tête. Une marge, elle, s'ajoute. */
        html.mh-une-main body{margin-top:var(--mh-une-main-y,0)}
        /* L'en-tête, lui, est hors de portée : c'est justement ce qu'on vient
           chercher. Un \`transform\` sur un élément DÉJÀ fixe ne change pas son
           propre positionnement — il le décale, simplement. */
        html.mh-une-main .site-header{
            transform:translateY(var(--mh-une-main-y,0));
            transition:transform .22s cubic-bezier(.22,.7,.28,1)}
        /* Ce qui est ancré EN BAS ne bouge pas : la barre d'onglets, le
           bandeau et l'avis hors-ligne sont déjà dans la zone du pouce. Les
           descendre les pousserait hors de l'écran — c'est exactement ce que
           faisait la première version. */
        /* La bande libérée. Elle n'est PAS décorative : c'est la cible qui
           rend la page. Sans repère visuel, on ne devine pas qu'on peut la
           toucher — et on se retrouve avec un écran amputé sans savoir
           pourquoi. */
        .mh-une-main-bande{
            position:fixed;top:0;left:0;right:0;z-index:2147481200;
            display:flex;align-items:flex-end;justify-content:center;
            padding-bottom:10px;
            background:linear-gradient(to bottom,var(--bg,#111),transparent);
            color:var(--text3,#888);font-size:12.5px;
            font-family:system-ui,-apple-system,sans-serif}
        .mh-une-main-bande::before{content:'▲';margin-right:7px;font-size:10px}`;
        document.head.appendChild(s);
    }

    let bande = null;

    function activer() {
        styles();
        actif = true;
        const y = Math.round(window.innerHeight * DECALAGE);
        document.documentElement.style.setProperty('--mh-une-main-y', y + 'px');
        document.documentElement.classList.add('mh-une-main');

        if (!bande) {
            bande = document.createElement('div');
            bande.className = 'mh-une-main-bande';
            bande.setAttribute('role', 'button');
            bande.setAttribute('tabindex', '0');
            bande.textContent = 'Toucher pour remonter';
            bande.addEventListener('click', desactiver);
            document.body.appendChild(bande);
        }
        bande.style.height = y + 'px';
        bande.hidden = false;

        // Toute action utile rend l'écran : on a atteint ce qu'on visait.
        document.addEventListener('click', surAction, true);
        reporter();
        try { window.INKO_NATIF?.vibrer?.('leger'); } catch (e) { /* sans importance */ }
    }

    function desactiver() {
        actif = false;
        clearTimeout(minuteur);
        document.documentElement.classList.remove('mh-une-main');
        document.documentElement.style.removeProperty('--mh-une-main-y');
        if (bande) bande.hidden = true;
        document.removeEventListener('click', surAction, true);
    }

    function surAction(e) {
        // Le clic sur la bande a son propre gestionnaire ; le laisser passer
        // ici désactiverait deux fois, ce qui est inoffensif mais confus à
        // relire.
        if (bande && bande.contains(e.target)) return;
        // Un appui sur un contrôle réel : c'est ce qu'on était venu chercher.
        if (e.target.closest && e.target.closest('a, button, input, select, textarea, [role="button"]')) {
            desactiver();
        }
    }

    function reporter() {
        clearTimeout(minuteur);
        minuteur = setTimeout(desactiver, REPOS_MS);
    }

    function basculer() { if (actif) desactiver(); else activer(); }

    /**
     * Le déclencheur : un balayage vers le BAS depuis le tout bas de l'écran.
     *
     * Cette zone n'appartient à rien d'autre — la barre d'onglets est au-dessus,
     * et le défilement de page ne commence jamais par un geste vers le bas
     * depuis le bord inférieur. C'est aussi, et surtout, l'endroit où le pouce
     * se trouve DÉJÀ quand il ne peut pas atteindre le haut.
     */
    function installerGeste() {
        const BORD = 24;        // px depuis le bas où le geste peut commencer
        const COURSE = 40;      // px de descente pour déclencher
        let y0 = null, x0 = null;

        document.addEventListener('touchstart', (e) => {
            if (!e.touches || e.touches.length !== 1) return;
            const t = e.touches[0];
            y0 = (window.innerHeight - t.clientY <= BORD) ? t.clientY : null;
            x0 = t.clientX;
        }, { passive: true });

        document.addEventListener('touchmove', (e) => {
            if (y0 === null || !e.touches || !e.touches.length) return;
            const t = e.touches[0];
            // Vers le bas, et pas de côté : un geste oblique est un balayage de
            // carte ou une navigation par le bord, pas cette demande-ci.
            if (t.clientY - y0 > COURSE && Math.abs(t.clientX - x0) < COURSE) {
                y0 = null;
                if (!actif) activer();
            }
        }, { passive: true });

        document.addEventListener('touchend', () => { y0 = null; if (actif) reporter(); }, { passive: true });
    }

    // Le réglage ne fait qu'ARMER le geste. Il n'active pas le mode en
    // permanence : lire avec un tiers d'écran en moins serait absurde.
    function arme() {
        try { return window.Storage?.getPref?.(CLE) === '1'; } catch (e) { return false; }
    }

    if (arme()) installerGeste();

    window.MH = window.MH || {};
    window.MH.uneMain = {
        basculer, activer, desactiver,
        arme,
        armer(v) {
            try { window.Storage?.setPref?.(CLE, v ? '1' : '0'); } catch (e) { /* stockage refusé */ }
            if (v) installerGeste(); else desactiver();
        },
        CLE,
    };
})();
