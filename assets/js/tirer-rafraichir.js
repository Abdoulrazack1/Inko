// ============================================================
// tirer-rafraichir.js — tirer vers le bas pour actualiser
// ------------------------------------------------------------
// Le geste que tout le monde essaie en premier sur un téléphone, et qui ne
// faisait rien. Sur une bibliothèque ou une liste de nouveaux chapitres, c'est
// LE réflexe : on tire, on relâche, on attend le contenu frais.
//
// Son absence ne se signale pas — elle se ressent comme une application qui
// « ne réagit pas ». L'utilisateur conclut que le contenu est à jour, alors
// qu'il regarde peut-être une page chargée il y a une heure.
//
// ── Le piège numéro un : le geste natif de Chrome ───────────
//
// Chrome sur Android a SON propre tirer-pour-rafraîchir, qui recharge la page
// entière. Sans le neutraliser, les deux se déclenchent : notre indicateur
// apparaît, puis Chrome recharge par-dessus — on perd la position, les filtres,
// et le travail qu'on vient de faire.
//
// `overscroll-behavior-y: contain` le désactive. C'est la seule ligne qui rende
// ce module utilisable, et elle doit porter sur l'élément qui DÉFILE.
//
// ── Le piège numéro deux : le lecteur ───────────────────────
//
// En lecture, un tirer vers le bas est un geste de PAGE, pas de rafraîchissement.
// Recharger un chapitre au milieu d'une planche est exactement ce qu'il ne faut
// pas faire. Le module ne s'installe donc que sur les pages qui le demandent.
//
// Aucun gestionnaire en ligne : la CSP de l'app installée les bloque (DESK-01).
(function () {
    'use strict';
    if (window.MH?.tirerRafraichir) return;
    if (!window.matchMedia || !matchMedia('(hover: none)').matches) return;

    const SEUIL = 72;        // px à tirer pour déclencher
    const MAX = 110;         // px au-delà desquels l'indicateur ne descend plus
    const RESISTANCE = 0.45; // le doigt parcourt plus que l'indicateur : sans ça
                             // le geste part trop vite et se déclenche par accident

    let y0 = null, dy = 0, actif = false, enCours = false;
    let ind = null, rappel = null;

    function styles() {
        if (document.getElementById('mh-ptr-css')) return;
        const s = document.createElement('style');
        s.id = 'mh-ptr-css';
        s.textContent = `
        /* Neutralise le tirer-pour-rafraîchir NATIF de Chrome. Sans ça, les
           deux se déclenchent et Chrome recharge la page entière par-dessus —
           on perd position, filtres et saisie en cours. */
        html.mh-ptr-actif, html.mh-ptr-actif body{overscroll-behavior-y:contain}
        .mh-ptr{position:fixed;left:50%;top:0;z-index:2147481300;
            width:36px;height:36px;margin-left:-18px;
            display:flex;align-items:center;justify-content:center;
            border-radius:50%;
            background:var(--glass-bg,#1a1a1e);
            -webkit-backdrop-filter:var(--glass-blur);backdrop-filter:var(--glass-blur);
            border:1px solid var(--glass-border,#333);
            box-shadow:var(--glass-inner),0 4px 14px rgba(0,0,0,.4);
            color:var(--accent,#c1531b);font-size:17px;
            transform:translateY(-60px);opacity:0;
            transition:opacity .12s linear}
        .mh-ptr.retour{transition:transform .25s cubic-bezier(.22,.7,.28,1),opacity .2s}
        /* Au-delà du seuil, la flèche pivote : c'est le seul moyen de savoir,
           AVANT de relâcher, que le geste va partir. */
        .mh-ptr span{display:block;transition:transform .15s var(--ease-out,ease)}
        .mh-ptr.arme span{transform:rotate(180deg)}
        .mh-ptr.tourne span{animation:mh-ptr-tourne .8s linear infinite}
        @keyframes mh-ptr-tourne{to{transform:rotate(360deg)}}`;
        document.head.appendChild(s);
    }

    function indicateur() {
        if (ind) return ind;
        styles();
        ind = document.createElement('div');
        ind.className = 'mh-ptr';
        ind.setAttribute('aria-hidden', 'true');
        ind.innerHTML = '<span>↓</span>';
        document.body.appendChild(ind);
        return ind;
    }

    function placer(px, arme) {
        const e = indicateur();
        e.classList.remove('retour');
        e.style.transform = `translateY(${Math.min(px, MAX) - 46}px)`;
        e.style.opacity = String(Math.min(1, px / SEUIL));
        e.classList.toggle('arme', !!arme);
    }

    function ranger() {
        if (!ind) return;
        ind.classList.add('retour');
        ind.classList.remove('arme', 'tourne');
        ind.style.transform = 'translateY(-60px)';
        ind.style.opacity = '0';
    }

    // Le haut de la page. `scrollY` ne suffit pas : certaines pages défilent
    // dans un conteneur interne, et on ne doit alors PAS capter le geste.
    function enHaut() {
        const y = window.scrollY || document.documentElement.scrollTop || 0;
        return y <= 2;
    }

    async function declencher() {
        if (enCours) return;
        enCours = true;
        const e = indicateur();
        e.classList.remove('arme');
        e.classList.add('tourne');
        e.style.transform = `translateY(${SEUIL - 46}px)`;
        e.style.opacity = '1';
        try { window.INKO_NATIF?.vibrer?.('leger'); } catch (err) { /* sans importance */ }
        try {
            // Le rappel de la page, s'il y en a un. Sinon on recharge — c'est
            // le comportement attendu, et il vaut mieux que ne rien faire.
            if (rappel) await rappel();
            else { window.location.reload(); return; }
        } catch (err) {
            window.MH?.err?.('tirer-rafraichir.js', err);
            window.MH?.bandeau?.('Actualisation impossible — vérifie ta connexion.');
        } finally {
            enCours = false;
            ranger();
        }
    }

    function surDebut(e) {
        if (enCours || !e.touches || e.touches.length !== 1) return;
        y0 = enHaut() ? e.touches[0].clientY : null;
        dy = 0;
        actif = false;
    }

    function surBouge(e) {
        if (y0 === null || enCours || !e.touches || !e.touches.length) return;
        const brut = e.touches[0].clientY - y0;
        // Vers le HAUT, ou la page a défilé entre-temps : ce n'est pas notre geste.
        if (brut <= 0 || !enHaut()) { if (actif) { actif = false; ranger(); } y0 = null; return; }
        dy = brut * RESISTANCE;
        actif = true;
        placer(dy, dy >= SEUIL);
    }

    function surFin() {
        if (y0 === null) return;
        const partir = actif && dy >= SEUIL;
        y0 = null; actif = false;
        if (partir) declencher();
        else ranger();
    }

    /**
     * Active le geste sur CETTE page.
     * @param {Function} [surRafraichir] rend une promesse ; sans lui, on recharge
     */
    function installer(surRafraichir) {
        rappel = surRafraichir || null;
        if (document.documentElement.classList.contains('mh-ptr-actif')) return;
        styles();
        document.documentElement.classList.add('mh-ptr-actif');
        document.addEventListener('touchstart', surDebut, { passive: true });
        document.addEventListener('touchmove', surBouge, { passive: true });
        document.addEventListener('touchend', surFin, { passive: true });
        document.addEventListener('touchcancel', surFin, { passive: true });
    }

    window.MH = window.MH || {};
    window.MH.tirerRafraichir = { installer, SEUIL };

    // ── Où le geste s'installe tout seul ────────────────────
    // Les pages de LISTE, celles dont le contenu vieillit et qu'on revient
    // consulter. Jamais le lecteur : un tirer vers le bas y est un geste de
    // page, et recharger au milieu d'une planche est exactement ce qu'il ne
    // faut pas faire.
    const PAGES = {
        'accueil.html': null,
        'index.html': null,
        'bibliotheque.html': null,
        'catalogue.html': null,
        'recherche.html': null,
        'notifications.html': null,
        'downloads.html': null,
    };
    const ici = location.pathname.replace(/^.*\//, '') || 'index.html';
    if (Object.prototype.hasOwnProperty.call(PAGES, ici)) installer(PAGES[ici]);
})();
