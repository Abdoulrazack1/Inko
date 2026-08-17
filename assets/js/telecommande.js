// ============================================================
// telecommande.js — piloter la lecture d'un écran depuis un autre (P3.1)
// ------------------------------------------------------------
// On lit sur l'écran du salon, et on tourne les pages depuis le téléphone
// qu'on a déjà en main. Sans ça, il faut se lever, ou garder un clavier sur
// les genoux.
//
// Deux rôles, jamais les deux à la fois sur le même appareil :
//
//   ÉCOUTER   le lecteur s'abonne au flux et EXÉCUTE ce qui arrive
//   PILOTER   un autre appareil envoie des commandes
//
// ── Pourquoi l'abonnement ne marche que là où il y a un cookie ──
//
// `EventSource` ne peut pas porter d'en-tête `Authorization` — c'est une
// limite du standard, pas un oubli. Le flux s'authentifie donc par cookie,
// c'est-à-dire depuis le site et l'app de bureau, qui sont sur la même origine
// que le hub.
//
// Ça tombe bien : c'est exactement le sens utile. C'est le GRAND écran qu'on
// pilote, et le téléphone qui pilote — or le téléphone, lui, envoie des POST,
// que `api.js` sait signer avec son jeton d'appareil.
//
// Aucun gestionnaire en ligne : la CSP de l'app installée les bloque (DESK-01).
(function () {
    'use strict';
    if (window.MH?.telecommande) return;

    let source = null;
    let reconnexions = 0;

    // ── Rôle « écouter » ────────────────────────────────────
    /**
     * @param {Object.<string,Function>} actions  action → ce qu'elle exécute
     */
    function ecouter(actions) {
        if (source) return true;
        if (typeof EventSource === 'undefined') return false;
        // Sans cookie, le flux serait refusé : inutile d'ouvrir une connexion
        // qui échouera en boucle. `EventSource` réessaie indéfiniment, et une
        // reconnexion toutes les trois secondes contre un 401 tiendrait la
        // radio du téléphone éveillée pour rien.
        if (window.INKO_HUB) return false;

        const nom = etiquetteAppareil();
        try {
            source = new EventSource(
                (window.API?.base || '/api') + '/me/remote/stream?nom=' + encodeURIComponent(nom));
        } catch (e) { window.MH?.err?.('telecommande.js', e); return false; }

        source.addEventListener('commande', (ev) => {
            let c;
            try { c = JSON.parse(ev.data); } catch (e) { return; }
            const fn = actions[c.action];
            if (!fn) return;      // action que CE lecteur ne sait pas faire
            try { fn(c.valeur); } catch (e) { window.MH?.err?.('telecommande.js', e); }
        });

        source.addEventListener('open', () => { reconnexions = 0; });
        source.addEventListener('error', () => {
            // `EventSource` se reconnecte tout seul ; on n'intervient que si
            // ça s'acharne — un hub arrêté ne doit pas produire une tentative
            // toutes les trois secondes jusqu'à la fin des temps.
            if (++reconnexions >= 8) arreter();
        });
        return true;
    }

    function arreter() {
        if (!source) return;
        try { source.close(); } catch (e) { /* déjà fermé */ }
        source = null;
    }

    // Ce que l'utilisateur verra dans la liste des écrans pilotables. Le nom de
    // la série lue est bien plus parlant que « Chrome » : quand deux écrans
    // écoutent, c'est le seul moyen de savoir lequel on pilote.
    function etiquetteAppareil() {
        const titre = document.querySelector('.reader-manga-title, #readerTitle, h1');
        const t = (titre?.textContent || '').trim();
        return t ? t.slice(0, 40) : (document.title || 'Écran').slice(0, 40);
    }

    // ── Rôle « piloter » ────────────────────────────────────
    async function envoyer(action, valeur) {
        return window.API.remote.commander(action, valeur);
    }

    /**
     * Le panneau de télécommande. Une feuille montante au doigt, une boîte
     * centrée à la souris — le même composant que partout ailleurs.
     */
    async function ouvrirPanneau() {
        if (!window.MH?.feuille) return;

        const boite = document.createElement('div');
        boite.className = 'mh-tc';
        boite.innerHTML = `
            <div class="mh-tc-etat" id="mhTcEtat">Recherche d’un écran…</div>
            <div class="mh-tc-pave">
                <button class="btn btn-ghost" data-tc="page-precedente" aria-label="Page précédente">‹</button>
                <button class="btn btn-primary" data-tc="page-suivante" aria-label="Page suivante">›</button>
            </div>
            <div class="mh-tc-rangee">
                <button class="btn btn-ghost btn-sm" data-tc="chapitre-precedent">⟨ Chapitre</button>
                <button class="btn btn-ghost btn-sm" data-tc="chapitre-suivant">Chapitre ⟩</button>
            </div>
            <div class="mh-tc-rangee">
                <button class="btn btn-ghost btn-sm" data-tc="plein-ecran">Plein écran</button>
                <button class="btn btn-ghost btn-sm" data-tc="defilement-auto">Défilement auto</button>
            </div>`;

        const f = MH.feuille({ titre: 'Télécommande', hauteur: 'rapide', contenu: boite });
        const etat = boite.querySelector('#mhTcEtat');

        // On DIT combien d'écrans écoutent, avant le premier appui. Une
        // télécommande qui ne répond pas parce que rien n'écoute est
        // indiscernable d'une télécommande cassée.
        try {
            const r = await window.API.remote.ecrans();
            const n = (r.ecrans || []).length;
            etat.textContent = n
                ? (n === 1 ? `Pilote : ${r.ecrans[0]}` : `${n} écrans à l’écoute`)
                : 'Aucun écran à l’écoute — ouvre un chapitre sur l’ordinateur.';
            etat.classList.toggle('mh-tc-vide', !n);
        } catch (e) {
            etat.textContent = 'Impossible de joindre le hub.';
            etat.classList.add('mh-tc-vide');
        }

        boite.addEventListener('click', async (e) => {
            const b = e.target.closest('[data-tc]');
            if (!b) return;
            b.disabled = true;
            try {
                const r = await envoyer(b.dataset.tc, null);
                if (!r.ecrans) {
                    etat.textContent = 'Aucun écran à l’écoute — ouvre un chapitre sur l’ordinateur.';
                    etat.classList.add('mh-tc-vide');
                } else {
                    // Retour physique : on ne regarde pas le téléphone quand on
                    // s'en sert comme télécommande, on regarde l'autre écran.
                    window.INKO_NATIF?.vibrer?.('leger');
                }
            } catch (err) {
                etat.textContent = 'Commande non transmise : ' + err.message;
                etat.classList.add('mh-tc-vide');
            } finally { b.disabled = false; }
        });
        return f;
    }

    function styles() {
        if (document.getElementById('mh-tc-css')) return;
        const s = document.createElement('style');
        s.id = 'mh-tc-css';
        s.textContent = `
        .mh-tc{display:flex;flex-direction:column;gap:12px}
        .mh-tc-etat{font-size:13px;color:var(--text2,#aaa);text-align:center;min-height:19px}
        .mh-tc-etat.mh-tc-vide{color:var(--hanko,#a83232)}
        /* Les deux flèches occupent la LARGEUR et la hauteur d'un pouce : c'est
           la commande qu'on utilise cent fois par chapitre, et on la vise sans
           regarder l'écran. */
        .mh-tc-pave{display:flex;gap:10px}
        .mh-tc-pave .btn{flex:1;min-height:76px;font-size:30px;line-height:1}
        .mh-tc-rangee{display:flex;gap:10px}
        .mh-tc-rangee .btn{flex:1;min-height:48px}`;
        document.head.appendChild(s);
    }

    window.MH = window.MH || {};
    window.MH.telecommande = {
        ecouter, arreter, envoyer,
        ouvrir() { styles(); return ouvrirPanneau(); },
        ecoute() { return !!source; },
    };
})();
