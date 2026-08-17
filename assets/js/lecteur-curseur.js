// ============================================================
// lecteur-curseur.js — le curseur de page, avec la vignette
// ------------------------------------------------------------
// Audit IX.8 : « Le curseur doit permettre d'atteindre n'importe quelle page
// d'un glissé, avec une vignette de prévisualisation au-dessus du doigt. »
//
// Le curseur existait déjà et faisait la moitié du travail : il déplaçait bien,
// mais à l'aveugle. Sur un chapitre de 40 planches, chercher la page où la
// scène change revient alors à balayer au hasard, lâcher, regarder, recommencer
// — chaque essai déclenchant un vrai chargement de page. La vignette remplace
// cette boucle par un seul geste continu.
//
// ── Ce qui rend l'affaire délicate ──────────────────────────
//
// Le doigt COUVRE le curseur. Une vignette posée dessous serait cachée par la
// main ; elle va donc au-dessus, et elle suit horizontalement la position du
// pouce plutôt que de rester centrée — sinon, à la page 3 d'un chapitre de 40,
// on regarde à l'autre bout de l'écran ce qu'on est en train de désigner.
//
// Et en lecture DROITE → GAUCHE, le curseur est inversé (`direction: rtl`).
// La vignette doit suivre cette inversion : un lecteur de manga remarque
// immédiatement une prévisualisation qui part du mauvais côté.
//
// ── Le coût, et comment il est tenu ─────────────────────────
//
// Le proxy d'images ne sait pas redimensionner (il faudrait une bibliothèque
// native côté serveur — c'est le constat PERF-01, et un autre chantier). La
// vignette est donc la planche ENTIÈRE, réduite par le CSS.
//
// Une seule est chargée à la fois, et seulement après une pause de 90 ms sur
// une position : glisser d'un bout à l'autre du chapitre déclenche un
// chargement, pas quarante. Les planches déjà vues sortent du cache HTTP —
// ou du cache hors-ligne si le chapitre est téléchargé, auquel cas la
// prévisualisation marche sans réseau.
//
// Aucun gestionnaire en ligne : la CSP de l'app installée les bloque (DESK-01).
(function () {
    'use strict';
    if (window.MH?.lecteurCurseur) return;

    // Sous cette pause, on charge des planches qu'on ne regardera pas.
    const REPOS = 90;      // ms d'immobilité avant de charger
    const LARGEUR = 104;   // px — assez pour reconnaître une case, pas pour lire

    let bulle = null, img = null, etiquette = null;
    let minuteur = null, dernierNum = 0;

    function styles() {
        if (document.getElementById('mh-curseur-css')) return;
        const s = document.createElement('style');
        s.id = 'mh-curseur-css';
        s.textContent = `
        .mh-vignette{position:fixed;z-index:2147481500;
            width:${LARGEUR}px;
            background:var(--bg2,#1a1a1e);border:1px solid var(--border,#333);
            border-radius:10px;padding:5px;
            box-shadow:0 10px 30px rgba(0,0,0,.55);
            opacity:0;transform:translateY(6px);
            transition:opacity .12s ease,transform .12s ease;
            pointer-events:none}
        .mh-vignette.visible{opacity:1;transform:none}
        .mh-vignette img{display:block;width:100%;height:${Math.round(LARGEUR * 1.4)}px;
            object-fit:contain;background:#000;border-radius:6px}
        .mh-vignette .mh-vignette-num{
            text-align:center;font-size:11.5px;font-weight:700;
            color:var(--text,#eee);padding-top:4px;
            font-variant-numeric:tabular-nums}
        /* Pendant le chargement, la boîte garde sa taille : sans ça la bulle
           grandit sous le doigt à chaque planche et devient illisible. */
        .mh-vignette img.mh-vide{background:var(--bg4,#26262b)}`;
        document.head.appendChild(s);
    }

    function creer() {
        if (bulle) return;
        styles();
        bulle = document.createElement('div');
        bulle.className = 'mh-vignette';
        bulle.setAttribute('aria-hidden', 'true');   // le curseur s'annonce déjà
        img = document.createElement('img');
        img.className = 'mh-vide';
        img.alt = '';
        etiquette = document.createElement('div');
        etiquette.className = 'mh-vignette-num';
        bulle.appendChild(img);
        bulle.appendChild(etiquette);
        document.body.appendChild(bulle);
    }

    /**
     * Position horizontale du curseur pour la valeur `num`, en pixels écran.
     * La poignée d'un `input[type=range]` n'est pas atteignable en CSS : on
     * calcule sa place à partir de la géométrie. La marge d'une demi-poignée
     * aux deux bouts évite que la vignette dépasse quand on est à la première
     * ou à la dernière page.
     */
    function positionPoignee(input, num) {
        const r = input.getBoundingClientRect();
        const min = +input.min || 1, max = +input.max || 1;
        const etendue = Math.max(1, max - min);
        let t = (num - min) / etendue;
        // Lecture droite → gauche : le curseur est inversé, la vignette suit.
        if (getComputedStyle(input).direction === 'rtl') t = 1 - t;
        const poignee = 18;
        return r.left + poignee / 2 + t * (r.width - poignee);
    }

    function placer(input, num) {
        const x = positionPoignee(input, num);
        const r = input.getBoundingClientRect();
        const largeur = bulle.offsetWidth || LARGEUR + 12;
        // Bornée à l'écran : au bord, une vignette à moitié sortie ne montre
        // plus la moitié qui compte.
        const gauche = Math.max(8, Math.min(window.innerWidth - largeur - 8, x - largeur / 2));
        bulle.style.left = gauche + 'px';
        // AU-DESSUS du curseur, toujours : le doigt couvre ce qui est dessous.
        bulle.style.top = Math.max(8, r.top - (bulle.offsetHeight || 170) - 12) + 'px';
    }

    function montrer(input, num, pages) {
        creer();
        num = Math.max(1, Math.min(pages.length, Math.round(num)));
        etiquette.textContent = num + ' / ' + pages.length;
        placer(input, num);
        bulle.classList.add('visible');

        if (num === dernierNum) return;       // même page : rien à recharger
        dernierNum = num;
        clearTimeout(minuteur);
        // La pause : glisser d'un bout à l'autre ne doit pas déclencher
        // quarante chargements de planches pleine taille.
        minuteur = setTimeout(() => {
            const p = pages[num - 1];
            const url = p && (p.url || p.urlSaver);
            if (!url) return;
            img.classList.add('mh-vide');
            const chargeur = new Image();
            chargeur.onload = () => {
                // Le doigt a pu bouger pendant le chargement : on n'affiche
                // que si cette planche est toujours celle qu'on désigne.
                if (dernierNum !== num) return;
                img.src = url;
                img.classList.remove('mh-vide');
            };
            chargeur.src = url;
        }, REPOS);
    }

    function cacher() {
        clearTimeout(minuteur);
        dernierNum = 0;
        if (bulle) bulle.classList.remove('visible');
    }

    /**
     * Équipe un `input[type=range]` de sa vignette.
     * @param {HTMLInputElement} input
     * @param {Function} lirePages  rend le tableau des planches à l'instant T
     */
    function equiper(input, lirePages) {
        if (!input || input.dataset.mhVignette) return;
        input.dataset.mhVignette = '1';

        const suivre = () => {
            const pages = lirePages() || [];
            if (pages.length > 1) montrer(input, +input.value, pages);
        };

        // `pointerdown`/`input` couvrent le doigt, la souris et le clavier d'un
        // seul jeu d'écouteurs — un `input[type=range]` émet `input` quel que
        // soit le moyen employé.
        input.addEventListener('pointerdown', suivre);
        input.addEventListener('input', suivre);
        input.addEventListener('focus', suivre);

        for (const ev of ['pointerup', 'pointercancel', 'blur', 'touchend', 'touchcancel']) {
            input.addEventListener(ev, cacher);
        }
        // Un glissé qui se termine hors du curseur ne déclenche ni `pointerup`
        // sur lui, ni `blur` : sans ce filet, la vignette resterait à l'écran.
        window.addEventListener('pointerup', cacher);
        window.addEventListener('scroll', cacher, { passive: true });
    }

    window.MH = window.MH || {};
    window.MH.lecteurCurseur = { equiper, cacher };
})();
