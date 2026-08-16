// ============================================================
// cartes-gestes.js — appui long et balayages sur les cartes
// ------------------------------------------------------------
// Audit IX.6. Sur bureau, une carte offre ses actions AU SURVOL : le cœur
// apparaît, la surcouche « Lire » se lève. Au doigt, le survol n'existe pas —
// ces boutons sont donc soit invisibles, soit affichés en permanence par-dessus
// une couverture de 109 px, où on les touche en voulant ouvrir la série.
//
// Le CSS les retire (global.css, sous `hover: none`). Ce module rend les mêmes
// actions autrement :
//
//   appui long           menu contextuel + vibration courte
//   balayage à droite    marquer la série lue      fond vert, ✓
//   balayage à gauche    télécharger le prochain   fond bleu, ↓
//
// ── Les deux balayages sont ANNULABLES ──────────────────────
//
// Non par principe, mais parce qu'on les déclenche par accident : le geste de
// balayage et le geste de défilement partent du même doigt, au même endroit.
// « Marquer la série lue » efface la frontière entre lu et non lu — la donnée
// la plus longue à reconstituer, et celle qu'aucune source ne peut redonner.
//
// L'annulation est EXACTE : on ne démarque que les chapitres que ce geste a
// marqués. Le marquage en masse existant (bibliothèque, « Tout lu ») envoie
// tous les chapitres sans regarder lesquels étaient déjà lus ; annuler cela
// aurait effacé aussi des lectures antérieures. On calcule donc l'écart avant
// d'écrire.
//
// Aucun gestionnaire en ligne : la CSP de l'app installée les bloque (DESK-01).
(function () {
    'use strict';
    if (window.MH?.cartesGestes) return;

    // Inerte au pointeur fin, et volontairement. Sur bureau les mêmes actions
    // existent déjà (le cœur, la fiche série) : un second chemin ne ferait que
    // deux endroits à tenir à jour. Et un « appui long » à la souris est un clic
    // qu'on ne relâche pas — personne ne le fait exprès.
    if (!window.matchMedia || !matchMedia('(hover: none)').matches) return;

    const CARTES = '.manga-card, .lib2-card';
    const APPUI_LONG = 500;   // ms avant que l'appui devienne un menu
    const TOLERANCE = 10;     // px de dérive tolérée pendant l'appui long
    const ENGAGEMENT = 14;    // px avant de décider que c'est un balayage
    const SEUIL_MIN = 90;     // px, plancher du seuil de déclenchement

    function styles() {
        if (document.getElementById('mh-gestes-css')) return;
        const s = document.createElement('style');
        s.id = 'mh-gestes-css';
        s.textContent = `
        /* touch-action: pan-y dit au navigateur que le défilement VERTICAL lui
           appartient et que l'horizontal est à nous. Sans ça, il faudrait
           annuler l'événement pour empêcher la page de partir de côté — donc un
           écouteur NON passif sur chaque touchmove, donc un défilement saccadé
           sur toute la grille, pour un geste qui sert rarement. */
        ${CARTES.split(',').map(s => s.trim() + '{touch-action:pan-y}').join('')}

        /* Une seule variable porte le déplacement : tous les enfants suivent.
           L'alternative — déplacer la carte elle-même — obligerait à
           l'envelopper dans un conteneur pour loger le fond derrière, donc à
           modifier le balisage de trois pages. */
        .mh-carte-glisse > *:not(.mh-carte-fond){transform:translateX(var(--mh-dx,0))}
        .mh-carte-glisse.mh-carte-retour > *:not(.mh-carte-fond){transition:transform .22s cubic-bezier(.22,.7,.28,1)}

        .mh-carte-fond{position:absolute;top:0;left:0;width:100%;height:100%;
            z-index:0;display:flex;align-items:center;padding:0 16px;
            border-radius:inherit;color:#fff;font-size:22px;font-weight:700;
            opacity:.55;transition:opacity .12s linear}
        .mh-carte-fond.arme{opacity:1}
        .mh-carte-fond.droite{background:var(--green,#3f7d4e);justify-content:flex-start}
        .mh-carte-fond.gauche{background:var(--blue,#3d5170);justify-content:flex-end}
        /* Au-delà du seuil, l'icône grossit : c'est le seul moyen de savoir,
           AVANT de relâcher, que l'action partira. */
        .mh-carte-fond span{display:block;transform:scale(.8);transition:transform .12s var(--ease-out,ease)}
        .mh-carte-fond.arme span{transform:scale(1.15)}

        .mh-menu-carte{display:flex;flex-direction:column;gap:2px;margin:-6px -4px}
        .mh-menu-carte button{display:flex;align-items:center;gap:12px;
            min-height:52px;padding:0 12px;width:100%;
            background:transparent;border:0;border-radius:10px;
            color:var(--text,#eee);font-family:inherit;font-size:14.5px;
            text-align:left;cursor:pointer}
        .mh-menu-carte button:active{background:var(--bg3,#222)}
        .mh-menu-carte button[disabled]{opacity:.5}
        .mh-menu-carte .mh-menu-ico{flex:0 0 22px;text-align:center;font-size:17px;color:var(--text3,#888)}
        .mh-menu-carte .mh-menu-danger{color:var(--hanko,#a83232)}`;
        document.head.appendChild(s);
    }

    // ── Ce que la carte sait d'elle-même ────────────────────
    function contexte(carte) {
        const lien = carte.matches('a') ? carte : carte.querySelector('a[href*="serie.html"]');
        const href = lien ? lien.getAttribute('href') : null;
        let source = carte.dataset.src || '';
        if (!source && href) {
            const q = href.split('?')[1] || '';
            source = new URLSearchParams(q).get('source') || '';
        }
        return {
            carte,
            id: carte.dataset.mangaId || '',
            source: source || window.API?.sources?.current || '',
            titre: (carte.querySelector('.manga-card-title, .lib2-title')?.textContent || '').trim(),
            href,
        };
    }

    function langue() {
        return window.Storage?.getPref?.('readingLang') || 'fr,en';
    }

    // Le numéro de chapitre n'est pas un nombre : « 12.5 », « 12v2 », « Extra ».
    // On trie sur ce qu'on peut lire, et ce qu'on ne peut pas lire va à la fin —
    // un hors-série n'est pas « le prochain à lire ».
    function numero(c) {
        const n = parseFloat(String(c.chapter ?? '').replace(',', '.'));
        return Number.isFinite(n) ? n : Infinity;
    }

    async function chapitres(ctx) {
        const d = await API.mangas.chaptersFor(ctx.source, ctx.id, { lang: langue() });
        return (d.results || []).slice().sort((a, b) => numero(a) - numero(b));
    }

    async function dejaLus(mangaId) {
        try {
            const tout = await API.me.readChapters();
            return new Set((tout?.[mangaId] || []).map(c => c.chapterId));
        } catch (e) { window.MH?.err?.('cartes-gestes.js', e); return new Set(); }
    }

    function connecte() {
        if (window.API?.isLoggedIn?.()) return true;
        MH.bandeau('Connecte-toi pour utiliser ce geste.');
        return false;
    }

    // ── Balayage à droite : marquer la série lue ────────────
    async function marquerSerieLue(ctx) {
        if (!connecte()) return;
        const b = MH.bandeau(`« ${ctx.titre || 'Série'} » — lecture des chapitres…`, { duree: 60000 });
        try {
            const [liste, lus] = await Promise.all([chapitres(ctx), dejaLus(ctx.id)]);
            // L'ÉCART, pas la liste entière : sans ça, « Annuler » démarquerait
            // aussi ce qui était lu avant le geste.
            const nouveaux = liste.filter(c => !lus.has(c.id));
            b.fermer();
            if (!liste.length)   { MH.bandeau('Aucun chapitre trouvé pour cette série.'); return; }
            if (!nouveaux.length) { MH.bandeau('Cette série est déjà entièrement lue.'); return; }

            await API.me.markChaptersBulk(ctx.id, nouveaux.map(c => ({ chapterId: c.id, chapter: c.chapter })));
            majPastille(ctx.carte, 0);

            MH.bandeau(`${nouveaux.length} chapitre(s) marqué(s) lus`, {
                action: 'Annuler',
                duree: 5000,      // IX.6 : cinq secondes, le temps de réaliser
                onAction: async () => {
                    try {
                        await API.me.unmarkChaptersBulk(ctx.id, nouveaux.map(c => c.id));
                        MH.bandeau('Marquage annulé.');
                    } catch (e) { MH.bandeau('Annulation impossible : ' + e.message); }
                },
            });
        } catch (e) {
            b.fermer();
            window.MH?.err?.('cartes-gestes.js', e);
            MH.bandeau('Impossible de marquer la série : ' + e.message);
        }
    }

    // ── Balayage à gauche : télécharger ─────────────────────
    // Le PROCHAIN chapitre non lu, pas la série. Une série fait couramment
    // plusieurs gigaoctets ; la lancer d'un balayage — geste qu'on fait par
    // accident — remplirait l'appareil sans qu'on l'ait demandé. Et ce qu'on
    // veut avant le métro, c'est la suite, pas l'intégrale.
    async function telechargerProchain(ctx) {
        if (!window.Downloads) { MH.bandeau('Téléchargement indisponible sur cette page.'); return; }
        const b = MH.bandeau(`« ${ctx.titre || 'Série'} » — recherche du prochain chapitre…`, { duree: 60000 });
        try {
            const liste = await chapitres(ctx);
            if (!liste.length) { b.fermer(); MH.bandeau('Aucun chapitre trouvé pour cette série.'); return; }
            const lus = await dejaLus(ctx.id);
            let cible = liste.find(c => !lus.has(c.id));
            // Tout est lu : on propose le dernier paru, qui est ce qu'on
            // relirait — plutôt que de ne rien faire sans rien dire.
            if (!cible) cible = liste[liste.length - 1];

            if (await window.Downloads.has(cible.id)) {
                b.fermer();
                MH.bandeau(`Ch. ${cible.chapter ?? '?'} est déjà téléchargé.`);
                return;
            }

            const d = await API.mangas.pages(cible.id);
            const pages = d.pages || [];
            if (!pages.length) throw new Error('aucune page renvoyée par la source');

            await window.Downloads.download({
                mangaId: ctx.id, chapterId: cible.id, chapterNum: cible.chapter,
                mangaTitle: ctx.titre, cover: null, source: ctx.source,
            }, pages, (fait, total) => {
                const t = document.querySelector('#mh-bandeau .mh-bandeau-txt');
                if (t) t.textContent = `Ch. ${cible.chapter ?? '?'} — ${fait}/${total} planches`;
            });

            b.fermer();
            MH.bandeau(`Ch. ${cible.chapter ?? '?'} disponible hors ligne`, {
                action: 'Annuler',
                duree: 5000,
                onAction: async () => {
                    try {
                        await window.Downloads.remove(cible.id);
                        MH.bandeau('Téléchargement supprimé.');
                    } catch (e) { MH.bandeau('Suppression impossible : ' + e.message); }
                },
            });
        } catch (e) {
            b.fermer();
            window.MH?.err?.('cartes-gestes.js', e);
            MH.bandeau('Téléchargement impossible : ' + e.message);
        }
    }

    // La pastille « non lu » vit dans le CSS et se lit sur l'attribut : la
    // remettre à jour ici évite qu'elle contredise l'écran juste après le geste.
    function majPastille(carte, n) {
        if (!carte) return;
        if (n > 0) carte.setAttribute('data-non-lu', String(n));
        else carte.removeAttribute('data-non-lu');
    }

    // ── Appui long : le menu ────────────────────────────────
    function menu(ctx) {
        if (!window.MH?.feuille) return;     // page sans feuille.js : les balayages restent
        const boite = document.createElement('div');
        boite.className = 'mh-menu-carte';

        // Le favori passe par le BOUTON de la carte, pas par une seconde
        // implémentation : c'est déjà un point unique (global.js) qui gère
        // l'état, l'infobulle, `aria-pressed`, le cache et le retour arrière en
        // cas d'échec. Le dupliquer ici, c'est signer le prochain écart.
        const coeur = ctx.carte.querySelector('.card-fav-btn[data-fav]');
        const estFav = coeur?.classList.contains('is-fav');
        const listes = ctx.carte.querySelector('.card-list-btn[data-addlist]');

        const entrees = [
            ctx.href && { ico: '📖', libelle: 'Ouvrir la série', act: () => { window.location.href = ctx.href; } },
            coeur && {
                ico: estFav ? '💔' : '❤️',
                libelle: estFav ? 'Retirer des favoris' : 'Ajouter aux favoris',
                danger: estFav,
                act: () => coeur.click(),
            },
            listes && { ico: '➕', libelle: 'Ajouter à une liste', act: () => listes.click() },
            { ico: '⤓', libelle: 'Télécharger le prochain chapitre', act: () => telechargerProchain(ctx) },
            { ico: '✓', libelle: 'Marquer la série comme lue', act: () => marquerSerieLue(ctx) },
        ].filter(Boolean);

        const f = MH.feuille({
            titre: ctx.titre || 'Série',
            hauteur: 'rapide',
            contenu: boite,
        });

        for (const e of entrees) {
            const b = document.createElement('button');
            b.type = 'button';
            if (e.danger) b.className = 'mh-menu-danger';
            const i = document.createElement('span');
            i.className = 'mh-menu-ico';
            i.textContent = e.ico;
            const t = document.createElement('span');
            t.textContent = e.libelle;
            b.appendChild(i); b.appendChild(t);
            b.addEventListener('click', () => { f.fermer(); e.act(); });
            boite.appendChild(b);
        }
    }

    // ── La machine à gestes ─────────────────────────────────
    let g = null;

    function fondDe(carte) {
        let f = carte.querySelector(':scope > .mh-carte-fond');
        if (!f) {
            f = document.createElement('div');
            f.className = 'mh-carte-fond';
            f.setAttribute('aria-hidden', 'true');
            f.innerHTML = '<span></span>';
            carte.insertBefore(f, carte.firstChild);
        }
        return f;
    }

    function nettoyer(carte) {
        carte.classList.remove('mh-carte-glisse', 'mh-carte-retour');
        carte.style.removeProperty('--mh-dx');
        carte.querySelector(':scope > .mh-carte-fond')?.remove();
    }

    function surDebut(e) {
        if (g) return;
        if (e.touches && e.touches.length !== 1) return;
        const carte = e.target.closest ? e.target.closest(CARTES) : null;
        if (!carte) return;
        // Un geste commencé sur un vrai bouton lui appartient.
        if (e.target.closest('button, input, select, textarea')) return;

        const t = e.touches ? e.touches[0] : e;
        g = {
            carte, x0: t.clientX, y0: t.clientY, dx: 0,
            mode: null, arme: false,
            minuteur: setTimeout(() => {
                if (!g || g.mode) return;
                g.mode = 'long';
                // Vibration courte : sur un appui long, rien à l'écran ne
                // change avant que la feuille monte. Sans retour physique,
                // l'utilisateur relâche avant les 500 ms parce qu'il croit
                // que rien ne se passe.
                try { navigator.vibrate?.(15); } catch (err) { /* refusée : sans importance */ }
                menu(contexte(carte));
            }, APPUI_LONG),
        };
    }

    function surBouge(e) {
        if (!g) return;
        const t = e.touches ? e.touches[0] : e;
        const dx = t.clientX - g.x0, dy = t.clientY - g.y0;

        if (g.mode === null) {
            if (Math.abs(dx) > TOLERANCE || Math.abs(dy) > TOLERANCE) clearTimeout(g.minuteur);
            // Le doigt part plus verticalement qu'horizontalement : c'est un
            // défilement. On lâche définitivement — sans ce verrou, un
            // défilement légèrement oblique finirait par armer un balayage.
            if (Math.abs(dy) > Math.abs(dx)) { g.mode = 'abandon'; return; }
            if (Math.abs(dx) < ENGAGEMENT) return;
            g.mode = 'balaye';
            g.carte.classList.add('mh-carte-glisse');
            g.carte.classList.remove('mh-carte-retour');
        }
        if (g.mode !== 'balaye') return;

        g.dx = dx;
        const f = fondDe(g.carte);
        const droite = dx > 0;
        f.classList.toggle('droite', droite);
        f.classList.toggle('gauche', !droite);
        f.firstChild.textContent = droite ? '✓' : '⤓';

        const seuil = Math.max(SEUIL_MIN, g.carte.offsetWidth * 0.4);
        g.arme = Math.abs(dx) >= seuil;
        f.classList.toggle('arme', g.arme);
        g.carte.style.setProperty('--mh-dx', dx + 'px');
    }

    function surFin() {
        if (!g) return;
        clearTimeout(g.minuteur);
        const { carte, mode, arme, dx } = g;
        const gestePris = mode === 'balaye' || mode === 'long';
        g = null;

        if (mode === 'balaye') {
            // La carte revient TOUJOURS à sa place : elle n'est pas supprimée,
            // et la laisser décalée le temps d'une requête donnerait à croire
            // qu'elle va disparaître.
            carte.classList.add('mh-carte-retour');
            carte.style.setProperty('--mh-dx', '0px');
            setTimeout(() => nettoyer(carte), 260);

            if (arme) {
                try { navigator.vibrate?.(10); } catch (err) { /* refusée : sans importance */ }
                (dx > 0 ? marquerSerieLue : telechargerProchain)(contexte(carte));
            }
        }

        // Le `click` de fin de geste ouvrirait la série : sur un appui long
        // comme sur un balayage, c'est exactement ce qu'on ne veut pas.
        if (gestePris) {
            const bloquer = (ev) => { ev.preventDefault(); ev.stopPropagation(); };
            document.addEventListener('click', bloquer, true);
            setTimeout(() => document.removeEventListener('click', bloquer, true), 400);
        }
    }

    styles();
    document.addEventListener('touchstart', surDebut, { passive: true });
    document.addEventListener('touchmove', surBouge, { passive: true });
    document.addEventListener('touchend', surFin, { passive: true });
    document.addEventListener('touchcancel', surFin, { passive: true });

    window.MH = window.MH || {};
    window.MH.cartesGestes = { marquerSerieLue, telechargerProchain, menu, contexte };
})();
