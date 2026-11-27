// ============================================================
// barre-fenetre.js — boutons de fenêtre des pages qui ne chargent pas global.js
// ------------------------------------------------------------
// DSK-09 : la fenêtre de l'application Windows est SANS cadre
// (`"decorations": false`) ; c'est la page qui dessine réduire, agrandir,
// fermer et la zone de déplacement. global.js le fait dans MH.initPage —
// mais la lecture d'un fichier importé (localreader.html) et le retour
// d'AniList (anilist.html) ne chargent pas global.js : on y restait bloqué,
// sans pouvoir ni fermer ni déplacer la fenêtre à la souris.
// Même balisage que global.js ; un style de secours quand global.css manque.
// ============================================================
(function () {
    'use strict';
    function fenetre() {
        const T = window.__TAURI__;
        if (!T || !T.window) return null;
        try { return (T.window.getCurrentWindow || T.window.getCurrent).call(T.window) || null; } catch (e) { return null; }
    }
    function poser() {
        if (!window.__TAURI__ || document.getElementById('inko-titlebar')) return;
        const racine = document.documentElement;
        racine.classList.add('tauri-app');
        const avecFeuille = !!getComputedStyle(racine).getPropertyValue('--titlebar-h').trim();
        if (!avecFeuille) {
            const st = document.createElement('style');
            st.textContent = '#inko-titlebar{position:fixed;top:0;left:0;right:0;height:34px;z-index:10000;display:flex;align-items:center;justify-content:space-between;background:#17171b;border-bottom:1px solid rgba(233,231,224,.09);user-select:none;-webkit-user-select:none;color:#bcbab5;font:600 13px system-ui,sans-serif}'
                + '#inko-titlebar .tb-brand{display:flex;align-items:center;gap:8px;padding-left:12px;height:100%;flex:1}#inko-titlebar .tb-logo{width:16px;height:16px;pointer-events:none}'
                + '#inko-titlebar .tb-controls{display:flex;height:100%}#inko-titlebar .tb-btn{width:46px;height:100%;display:flex;align-items:center;justify-content:center;background:transparent;border:0;color:inherit;cursor:pointer}'
                + '#inko-titlebar .tb-btn:hover{background:rgba(233,231,224,.12)}#inko-titlebar .tb-close:hover{background:#e81123;color:#fff}';
            document.head.appendChild(st);
        }
        const barre = document.createElement('div');
        barre.id = 'inko-titlebar';
        barre.setAttribute('data-tauri-drag-region', '');
        barre.innerHTML = '<div class="tb-brand" data-tauri-drag-region><img src="/assets/img/icon.svg" alt="" class="tb-logo" draggable="false"><span class="tb-title">Inko</span></div>'
            + '<div class="tb-controls">'
            + '<button class="tb-btn" id="tbMin" title="Réduire" aria-label="Réduire"><svg viewBox="0 0 12 12" width="11" height="11"><line x1="2" y1="6" x2="10" y2="6" stroke="currentColor" stroke-width="1.2"/></svg></button>'
            + '<button class="tb-btn" id="tbMax" title="Agrandir" aria-label="Agrandir"><svg viewBox="0 0 12 12" width="11" height="11"><rect x="2.5" y="2.5" width="7" height="7" fill="none" stroke="currentColor" stroke-width="1.2"/></svg></button>'
            + '<button class="tb-btn tb-close" id="tbClose" title="Fermer" aria-label="Fermer"><svg viewBox="0 0 12 12" width="11" height="11"><line x1="3" y1="3" x2="9" y2="9" stroke="currentColor" stroke-width="1.3"/><line x1="9" y1="3" x2="3" y2="9" stroke="currentColor" stroke-width="1.3"/></svg></button>'
            + '</div>';
        document.body.prepend(barre);
        // La page n'a pas l'en-tête de l'application : on lui rend la hauteur de la barre.
        if (!document.body.classList.contains('page-body')) {
            document.body.style.paddingTop = 'calc(34px + ' + (getComputedStyle(document.body).paddingTop || '0px') + ')';
        }
        const agir = (geste) => () => { try { const w = fenetre(); if (w) w[geste](); } catch (e) { /* fenêtre indisponible */ } };
        barre.querySelector('#tbMin').onclick = agir('minimize');
        barre.querySelector('#tbMax').onclick = agir('toggleMaximize');
        barre.querySelector('#tbClose').onclick = agir('close');
        barre.addEventListener('dblclick', (e) => { if (!e.target.closest('.tb-controls')) agir('toggleMaximize')(); });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', poser);
    else poser();
})();
