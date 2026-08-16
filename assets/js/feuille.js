// ============================================================
// feuille.js — la feuille montante, geste de fermeture compris
// ------------------------------------------------------------
// Audit IX.6. Elle remplace, au doigt, toute barre latérale et toute fenêtre
// de dialogue conçue pour une souris : filtres du catalogue, réglages du
// lecteur, menus d'appui long.
//
// ── Ce qui la rend utilisable, et qu'on oublie souvent ──────
//
// LA FERMETURE PAR GLISSÉ EST OBLIGATOIRE. C'est LE geste attendu d'une
// feuille montante — l'audit le note comme tel. Une feuille qui ne se ferme
// qu'au bouton se fait tirer vers le bas par l'utilisateur, ne bouge pas, et
// passe pour cassée.
//
// L'ACTION EST ANCRÉE EN BAS. Sur un écran de 812 px tenu à une main, le haut
// est hors de portée du pouce. Un « Appliquer » en tête de feuille oblige à
// changer de prise.
//
// LE CONTENU DÉFILE, PAS LA FEUILLE. Sans quoi un glissé pour lire la suite
// des filtres refermerait la feuille — le geste de lecture et le geste de
// fermeture seraient le même.
//
// Aucun gestionnaire en ligne : la CSP de l'app installée les bloque
// (DESK-01).
(function () {
    'use strict';
    if (window.MH?.feuille) return;

    const HAUTEURS = { rapide: 40, filtres: 75, edition: 100 };
    // En dessous, un glissé est une hésitation, pas une intention de fermer.
    const SEUIL_FERMETURE = 90;

    function styles() {
        if (document.getElementById('mh-feuille-css')) return;
        const s = document.createElement('style');
        s.id = 'mh-feuille-css';
        s.textContent = `
        .mh-feuille-fond{position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:2147481000;
            background:rgba(0,0,0,.4);opacity:0;transition:opacity .2s ease}
        .mh-feuille-fond.ouverte{opacity:1}
        .mh-feuille{position:fixed;left:0;right:0;bottom:0;z-index:2147481001;
            background:var(--bg2,#1a1a1e);border-top-left-radius:18px;border-top-right-radius:18px;
            border-top:1px solid var(--border,#333);box-shadow:0 -12px 40px rgba(0,0,0,.5);
            display:flex;flex-direction:column;max-height:100vh;
            transform:translateY(100%);transition:transform .26s cubic-bezier(.22,.7,.28,1);
            padding-bottom:env(safe-area-inset-bottom, 0)}
        .mh-feuille.ouverte{transform:translateY(0)}
        .mh-feuille.glisse{transition:none}
        .mh-feuille-poignee{flex:0 0 auto;padding:10px 0 4px;display:flex;justify-content:center;
            cursor:grab;touch-action:none}
        .mh-feuille-poignee::before{content:'';width:38px;height:4px;border-radius:2px;
            background:var(--text3,#888);opacity:.6}
        .mh-feuille-tete{flex:0 0 auto;display:flex;align-items:center;gap:12px;
            padding:4px 18px 12px;border-bottom:1px solid var(--border,#333)}
        .mh-feuille-titre{flex:1 1 auto;font-family:var(--font-head,inherit);font-size:17px;font-weight:700;
            color:var(--text,#eee)}
        .mh-feuille-corps{flex:1 1 auto;overflow-y:auto;overscroll-behavior:contain;
            -webkit-overflow-scrolling:touch;padding:14px 18px}
        .mh-feuille-pied{flex:0 0 auto;padding:12px 18px calc(12px + env(safe-area-inset-bottom, 0px));
            border-top:1px solid var(--border,#333);display:flex;gap:10px}
        .mh-feuille-pied .btn{flex:1 1 auto;min-height:48px}
        /* 901 et non 900 : à exactement 900 px, la requête max-width utilisée
           par catalogue.js pour décider du mode ET une min-width de 900
           seraient vraies toutes les deux — la feuille se centrerait pendant
           que le code la croit collée en bas. Une frontière doit appartenir à
           un seul côté. */
        @media (min-width: 901px){
            /* Sur grand écran, une feuille collée en bas serait absurde : elle
               devient une boîte centrée, sans changer son contenu ni son code. */
            .mh-feuille{left:50%;right:auto;bottom:auto;top:50%;transform:translate(-50%,-45%) scale(.98);
                width:min(560px,92vw);border-radius:16px;border:1px solid var(--border,#333);
                max-height:86vh;opacity:0}
            .mh-feuille.ouverte{transform:translate(-50%,-50%) scale(1);opacity:1}
            .mh-feuille-poignee{display:none}
        }`;
        document.head.appendChild(s);
    }

    /**
     * Ouvre une feuille montante.
     * @param {object} o
     *   titre      texte de l'en-tête
     *   hauteur    'rapide' | 'filtres' | 'edition'  (40 / 75 / 100 %)
     *   contenu    Node ou chaîne HTML
     *   actionTete { libelle, onClick }   — « Effacer », à droite du titre
     *   actions    [{ libelle, principal?, onClick }] — ancrées en bas
     *   onFermeture()
     * @returns {{ fermer: Function, corps: HTMLElement, majPied: Function }}
     */
    function feuille(o = {}) {
        styles();
        const fond = document.createElement('div');
        fond.className = 'mh-feuille-fond';
        const f = document.createElement('div');
        f.className = 'mh-feuille';
        f.setAttribute('role', 'dialog');
        f.setAttribute('aria-modal', 'true');
        if (o.titre) f.setAttribute('aria-label', o.titre);
        f.style.height = (HAUTEURS[o.hauteur] || HAUTEURS.filtres) + '%';

        const esc = (t) => window.MH?.esc ? window.MH.esc(t) : String(t ?? '');
        f.innerHTML = `
            <div class="mh-feuille-poignee" aria-hidden="true"></div>
            ${o.titre ? `<div class="mh-feuille-tete">
                <span class="mh-feuille-titre">${esc(o.titre)}</span>
                ${o.actionTete ? `<button class="btn btn-ghost btn-sm" data-f="tete">${esc(o.actionTete.libelle)}</button>` : ''}
            </div>` : ''}
            <div class="mh-feuille-corps"></div>
            ${(o.actions && o.actions.length) ? `<div class="mh-feuille-pied">${o.actions.map((a, i) =>
        `<button class="btn ${a.principal ? 'btn-primary' : 'btn-ghost'}" data-f="${i}">${esc(a.libelle)}</button>`).join('')}</div>` : ''}`;

        const corps = f.querySelector('.mh-feuille-corps');
        if (o.contenu instanceof Node) corps.appendChild(o.contenu);
        else if (typeof o.contenu === 'string') corps.innerHTML = o.contenu;

        document.body.appendChild(fond);
        document.body.appendChild(f);
        // Deux images successives : sans ce délai, le navigateur applique
        // l'état final directement et la feuille APPARAÎT au lieu de monter.
        //
        // Mais `requestAnimationFrame` ne s'exécute PAS quand rien n'est
        // composé — onglet en arrière-plan, fenêtre masquée. La feuille
        // resterait alors à `translateY(100%)` : présente, correcte, et
        // invisible. Constaté sur le panneau d'aperçu masqué.
        //
        // Un repli au minuteur garantit l'ouverture. Faire dépendre
        // l'AFFICHAGE d'un seul mécanisme, c'est accepter qu'il disparaisse
        // dans les cas qu'on ne teste pas.
        let ouvert = false;
        const ouvrir = () => {
            if (ouvert) return;
            ouvert = true;
            fond.classList.add('ouverte');
            f.classList.add('ouverte');
        };
        requestAnimationFrame(() => requestAnimationFrame(ouvrir));
        setTimeout(ouvrir, 120);

        let ferme = false;
        const fermer = () => {
            if (ferme) return;
            ferme = true;
            f.classList.remove('ouverte');
            fond.classList.remove('ouverte');
            document.removeEventListener('keydown', surTouche);
            setTimeout(() => { f.remove(); fond.remove(); }, 280);
            if (o.onFermeture) o.onFermeture();
        };
        function surTouche(e) { if (e.key === 'Escape') { e.preventDefault(); fermer(); } }
        document.addEventListener('keydown', surTouche);
        fond.addEventListener('click', fermer);

        f.querySelector('[data-f="tete"]')?.addEventListener('click', () => o.actionTete.onClick({ fermer, corps }));
        (o.actions || []).forEach((a, i) => {
            f.querySelector(`[data-f="${i}"]`)?.addEventListener('click', () => a.onClick({ fermer, corps }));
        });

        glisserPourFermer(f, fermer);

        return {
            fermer,
            corps,
            // Permet de refléter une sélection en cours : « Appliquer (12) ».
            majPied(i, libelle) {
                const b = f.querySelector(`[data-f="${i}"]`);
                if (b) b.textContent = libelle;
            },
        };
    }

    // ── Le glissé ───────────────────────────────────────────
    // Pris sur la POIGNÉE et sur l'en-tête, jamais sur le corps : sinon un
    // glissé pour lire la suite des filtres refermerait la feuille, et le
    // geste de lecture et le geste de fermeture seraient le même.
    function glisserPourFermer(f, fermer) {
        const zones = [f.querySelector('.mh-feuille-poignee'), f.querySelector('.mh-feuille-tete')].filter(Boolean);
        let y0 = 0, dy = 0, actif = false;

        const debut = (e) => {
            if (e.touches && e.touches.length !== 1) return;
            actif = true; dy = 0;
            y0 = (e.touches ? e.touches[0].clientY : e.clientY);
            f.classList.add('glisse');
        };
        const bouge = (e) => {
            if (!actif) return;
            const y = (e.touches ? e.touches[0].clientY : e.clientY);
            dy = Math.max(0, y - y0);        // vers le HAUT : on ne suit pas
            f.style.transform = `translateY(${dy}px)`;
        };
        const fin = () => {
            if (!actif) return;
            actif = false;
            f.classList.remove('glisse');
            f.style.transform = '';
            if (dy > SEUIL_FERMETURE) fermer();
        };

        for (const z of zones) {
            z.addEventListener('touchstart', debut, { passive: true });
            z.addEventListener('touchmove', bouge, { passive: true });
            z.addEventListener('touchend', fin, { passive: true });
            z.addEventListener('touchcancel', fin, { passive: true });
            // Souris aussi : la poignée est visible sur un écran tactile posé
            // sur un bureau, et l'y rendre inerte serait déroutant.
            z.addEventListener('mousedown', debut);
        }
        window.addEventListener('mousemove', bouge);
        window.addEventListener('mouseup', fin);
    }

    window.MH = window.MH || {};
    window.MH.feuille = feuille;
})();
