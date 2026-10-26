// ============================================================
// zoom-case.js — trouver la case qu'on désigne sur une planche
// ------------------------------------------------------------
// Le double-clic zoomait à 150 % depuis le HAUT de la planche, et le double
// appui à 170 % autour du doigt : dans les deux cas on agrandissait une
// zone, pas la case qu'on voulait lire. Il fallait ensuite la recadrer à la
// main. Ce module cherche la case sous le pointeur ; `chapitre.js` la cadre.
//
// ── Comment ──────────────────────────────────────────────────
// Une case est bordée de GOUTTIÈRES : des bandes unies, blanches ou noires,
// qui traversent la planche. On analyse une vignette (comme le recadrage des
// marges, AMEL-17 : 240 px suffisent à voir une bande unie), on cherche la
// gouttière horizontale la plus proche au-dessus et au-dessous du point, puis
// — dans cette rangée seulement — les gouttières verticales de part et
// d'autre.
//
// ── Ce qu'on refuse ──────────────────────────────────────────
// Une case de moins de 4 % de la planche est un artefact (une bulle, un
// cadre de texte) ; une « case » de plus de 85 % n'en est pas une (planche
// pleine page, fond uni). Dans les deux cas on rend `null`, et le lecteur
// retombe sur le zoom ancré existant : mieux vaut un zoom moins malin qu'un
// recadrage faux.
(function () {
    'use strict';

    const FOND_CLAIR = 225, FOND_SOMBRE = 30;   // luminance d'une gouttière
    const PART_GOUTTIERE = 0.97;                // pixels « fond » requis sur la ligne

    /**
     * @param {Uint8ClampedArray} px  RGBA de la vignette
     * @param {number} w, h           taille de la vignette
     * @param {number} x, y           point désigné, en pixels de la vignette
     * @returns {{ x: number, y: number, w: number, h: number } | null}  en fractions [0, 1]
     */
    function detecterCase(px, w, h, x, y) {
        if (!px || !w || !h) return null;
        x = Math.min(w - 1, Math.max(0, Math.round(x)));
        y = Math.min(h - 1, Math.max(0, Math.round(y)));
        const fond = (i) => {
            const l = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
            return l >= FOND_CLAIR || l <= FOND_SOMBRE;
        };
        const ligneVide = (row, x0, x1) => {
            let n = 0;
            for (let c = x0; c < x1; c++) if (fond((row * w + c) * 4)) n++;
            return n / Math.max(1, x1 - x0) >= PART_GOUTTIERE;
        };
        const colonneVide = (col, y0, y1) => {
            let n = 0;
            for (let r = y0; r < y1; r++) if (fond((r * w + col) * 4)) n++;
            return n / Math.max(1, y1 - y0) >= PART_GOUTTIERE;
        };
        // Le point lui-même tombe dans une gouttière : rien à cadrer.
        if (ligneVide(y, 0, w) && colonneVide(x, 0, h)) return null;

        let haut = y, bas = y;
        while (haut > 0 && !ligneVide(haut, 0, w)) haut--;
        while (bas < h - 1 && !ligneVide(bas, 0, w)) bas++;
        let gauche = x, droite = x;
        while (gauche > 0 && !colonneVide(gauche, haut, bas + 1)) gauche--;
        while (droite < w - 1 && !colonneVide(droite, haut, bas + 1)) droite++;

        const r = { x: gauche / w, y: haut / h, w: (droite - gauche + 1) / w, h: (bas - haut + 1) / h };
        const aire = r.w * r.h;
        if (aire < 0.04 || aire > 0.85 || r.w < 0.08 || r.h < 0.08) return null;
        return r;
    }

    /** Lit une vignette de l'image (même origine via /api/img, donc lisible). */
    function vignette(img, largeur = 240) {
        if (!img || !img.naturalWidth) return null;
        const w = largeur, h = Math.max(1, Math.round(largeur * img.naturalHeight / img.naturalWidth));
        try {
            const c = document.createElement('canvas');
            c.width = w; c.height = h;
            const ctx = c.getContext('2d', { willReadFrequently: true });
            ctx.drawImage(img, 0, 0, w, h);
            return { px: ctx.getImageData(0, 0, w, h).data, w, h };
        } catch (e) {
            // Canvas « teinté » (image hors proxy) : on ne peut pas lire, on
            // laisse le lecteur retomber sur le zoom ancré.
            return null;
        }
    }

    window.MH = window.MH || {};
    window.MH.zoomCase = { detecterCase, vignette };
})();
