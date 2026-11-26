// _ux.js — socle des sondes d'expérience : un serveur jetable garni, des pages stabilisées,
// et les échelles de design du projet (jetons de assets/css/global.css).
'use strict';
const E = require('./_explore');

/** Les échelles du projet. Elles sont lues dans global.js pour ne pas diverger. */
function echelles(ctx) {
    const css = ctx.lire(ctx.abs('assets', 'css', 'global.css'));
    const px = (prefixe) => [...new Set([...css.matchAll(new RegExp('^\\s*--' + prefixe + '[\\w-]*:\\s*([\\d.]+)px', 'gm'))].map(m => +m[1]))].sort((a, b) => a - b);
    return {
        textes: px('t-'), rayons: [0, ...px('r-')], espaces: [0, 1, ...px('sp-'), +((/--page-bas:\s*(\d+)px/.exec(css) || [])[1] || 72)],
        durees: [0, ...[...css.matchAll(/^\s*--transition\d?:\s*(\d+)ms/gm)].map(m => +m[1])],
        polices: [...css.matchAll(/^\s*--font-[\w-]+:\s*'?([^',;]+)'?/gm)].map(m => m[1].trim().toLowerCase()),
    };
}

/** Attend que le nombre d'éléments cesse de bouger. */
async function stabiliser(p, { pas = 300, tours = 3, max = 40 } = {}) {
    let avant = -1, calme = 0;
    for (let i = 0; i < max && calme < tours; i++) {
        await p.waitForTimeout(pas);
        const n = await p.evaluate(() => document.getElementsByTagName('*').length).catch(() => -1);
        calme = n === avant ? calme + 1 : 0; avant = n;
    }
}

const PROFILS = { bureau: { largeur: 1366, hauteur: 800 }, mobile: { mobile: true } };

/** Ouvre le banc d'essai. `reel` ajoute une œuvre et un roman lus sur leurs sources. */
async function banc(ctx, { base, port, reel = true } = {}) {
    const o = await E.ouvrir(ctx, { base, port });
    if (!o) return null;
    const d = await E.semer(o.J, { favoris: 36 });
    const oe = reel ? await E.oeuvresReelles(o.J) : {};
    if (oe.manga) await o.J.api('POST', '/me/favorites', { mangaId: oe.manga.id, source: oe.manga.source, title: oe.manga.titre });
    if (oe.manga) await o.J.api('PUT', '/me/progress/' + encodeURIComponent(oe.manga.id), { chapterId: oe.manga.chapitres[0].id, chapter: 1, page: 2, source: oe.manga.source });
    const donnees = { ...d, ...oe };
    return { ...o, donnees, liste: E.adresses(ctx, donnees).filter(([f]) => f !== 'index.html') };
}

/** Visite chaque page dans un profil et rend ce que `faire` observe. */
async function visiter(b, profil, faire, { filtre, options = {} } = {}) {
    const c = await E.contexte(b.nav, b.J, { ...PROFILS[profil], calme: true, ...options });
    const sortie = [];
    for (const [f, url] of b.liste) {
        if (filtre && !filtre(f)) continue;
        const p = await c.newPage(); const s = E.surveiller(p);
        try {
            await p.goto(`${b.J.url}/${url}`, { waitUntil: 'load', timeout: 25000 });
            await stabiliser(p);
            const r = await faire(f, p, s, url);
            if (r !== undefined) sortie.push([f, r]);
        } catch (e) { sortie.push([f, { erreur: e.message.slice(0, 120) }]); }
        await p.close();
    }
    await c.close();
    return sortie;
}

/** Fonctions utiles côté page, injectées en texte. */
const OUTILS = `
  window.__ux = {
    vis(e) { const s = getComputedStyle(e); if (s.display === 'none' || s.visibility === 'hidden' || !e.getClientRects().length) return false;
      let o = 1; for (let a = e; a && a !== document.documentElement; a = a.parentElement) o *= +getComputedStyle(a).opacity; return o > .05; },
    nom(e) { return e.tagName.toLowerCase() + (e.id ? '#' + e.id : (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\\s+/).slice(0, 2).join('.') : '')); },
    texte(e) { return [...e.childNodes].some(n => n.nodeType === 3 && n.nodeValue.trim().length > 1); },
    hors(e) { return !!e.closest('#inko-music,.a11y-invisible,.skip-link,[hidden]'); },
  };
`;
const outiller = (p) => p.evaluate(OUTILS);

module.exports = { echelles, stabiliser, banc, visiter, outiller, PROFILS };
