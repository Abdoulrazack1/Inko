// adaptabilite — les réglages d'affichage de ceux qui voient mal ou autrement : zoom à
// 200 %, espacement du texte imposé (WCAG 1.4.12), contraste forcé de Windows, et des
// contenus qui débordent (titres interminables, sans espaces, droite à gauche, vides).
'use strict';
const E = require('./_explore');
const U = require('./_ux');

const ESPACEMENT = '*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}';
const mesure = () => {
    const de = document.documentElement;
    const sel = (e) => e.tagName.toLowerCase() + (e.id ? '#' + e.id : (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/)[0] : ''));
    const vis = (e) => { const s = getComputedStyle(e); return s.display !== 'none' && s.visibility !== 'hidden' && e.getClientRects().length && +s.opacity > .05 && !e.closest('.a11y-invisible,#mh-live,#inko-music,[hidden]'); };
    const coupes = [...document.querySelectorAll('button,a,label,h1,h2,h3,p,li,span,div')].filter(e => { if (!vis(e) || ![...e.childNodes].some(n => n.nodeType === 3 && n.nodeValue.trim().length > 2)) return false; const s = getComputedStyle(e); if (s.textOverflow === 'ellipsis' || +s.webkitLineClamp > 0) return false; return (s.overflowX === 'hidden' && e.scrollWidth > e.clientWidth + 4) || (s.overflowY === 'hidden' && e.scrollHeight > e.clientHeight + 6 && e.clientHeight > 0); }).map(e => sel(e) + ' « ' + e.textContent.trim().slice(0, 28) + ' »');
    const larges = [...document.querySelectorAll('body *')].filter(e => { const r = e.getBoundingClientRect(); if (!r.width || r.right <= de.clientWidth + 3 || !vis(e)) return false; for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) if (getComputedStyle(a).overflowX !== 'visible') return false; return getComputedStyle(e).position !== 'fixed'; }).slice(0, 4).map(sel);
    return { deborde: de.scrollWidth - de.clientWidth, coupes: [...new Set(coupes)].slice(0, 6), larges };
};

module.exports = {
    nom: 'adaptabilite',
    description: 'Zoom 200 %, espacement de texte imposé, contraste forcé, contenus extrêmes',
    async run(ctx) {
        const o = await E.ouvrir(ctx, { base: 'inko_s_adapt', port: 8158 });
        if (!o) return;
        const { J, nav } = o;
        const T = (gravite, id, f, titre, detail, correctif, categorie = 'accessibilité') => ctx.trouver({ gravite, id, categorie, titre, detail, correctif, effort: 'S', fichier: f });
        const b = { J, nav };
        try {
            const d = await E.semer(J, { favoris: 12 });
            b.liste = E.adresses(ctx, d).filter(([f]) => f !== 'index.html');
            // ── zoom 200 % : la page vue comme sur 683 px de large avec des pixels doubles ──
            await U.visiter(b, 'bureau', async (f, p) => { const m = await p.evaluate(mesure); if (m.deborde > 3) T('haute', 'ADA-ZOOM-DEBORDE', f, `${f} à 200 % de zoom : défilement horizontal de ${m.deborde} px`, m.larges.join('\n'), 'Repli en une colonne (WCAG 1.4.10).'); if (m.coupes.length) T('moyenne', 'ADA-ZOOM-COUPE', f, `${f} à 200 % : texte coupé`, m.coupes.join('\n'), 'Hauteurs libres.'); }, { options: { largeur: 640, hauteur: 400 } });
            // ── espacement imposé ──
            await U.visiter(b, 'bureau', async (f, p) => { const avant = await p.evaluate(mesure); await p.addStyleTag({ content: ESPACEMENT }); await p.waitForTimeout(500); const m = await p.evaluate(mesure); const nouveaux = m.coupes.filter(x => !avant.coupes.includes(x)); if (nouveaux.length) T('moyenne', 'ADA-ESPACEMENT-COUPE', f, `${f} : avec l'espacement de texte imposé, ${nouveaux.length} texte(s) deviennent illisibles`, nouveaux.join('\n'), 'min-height au lieu de height ; pas de overflow hidden sur le texte (WCAG 1.4.12).'); if (m.deborde > avant.deborde + 3) T('moyenne', 'ADA-ESPACEMENT-DEBORDE', f, `${f} : l'espacement imposé élargit la page de ${m.deborde - avant.deborde} px`, m.larges.join('\n'), ''); });
            // ── contraste forcé ──
            const c = await nav.newContext({ viewport: { width: 1366, height: 800 }, serviceWorkers: 'block', forcedColors: 'active', locale: 'fr-FR' });
            await c.addInitScript(() => { try { for (const k of ['mh_eula_v2', 'inko_consent', 'inko_tour_done', 'mh_install_dismissed']) localStorage.setItem(k, '1'); } catch (e) { /* stockage */ } });
            await c.route('**/*', (r) => (r.request().url().startsWith(J.url) ? r.continue() : r.abort()));
            for (const [f, u] of b.liste) {
                const p = await c.newPage();
                try {
                    await p.goto(`${J.url}/${u}`, { waitUntil: 'load' }); await U.stabiliser(p);
                    const m = await p.evaluate(() => {
                        const vis = (e) => { const s = getComputedStyle(e); return s.display !== 'none' && s.visibility !== 'hidden' && e.getClientRects().length && +s.opacity > .05 && !e.closest('#inko-music,[hidden]'); };
                        const nom = (e) => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '.' + String(e.className).trim().split(/\s+/)[0]);
                        // un contrôle dont le dessin est fait d'un fond disparaît quand les fonds sont remplacés
                        const sansForme = [...document.querySelectorAll('button,input[type=checkbox],[role=switch],[role=tab],.accent-dot')].filter(vis).filter(e => { const s = getComputedStyle(e); const texte = e.textContent.trim() || e.querySelector('svg,img') || /checkbox/.test(e.type || ''); const bord = parseFloat(s.borderTopWidth) > 0 && s.borderTopStyle !== 'none'; return !texte && !bord && s.outlineStyle === 'none'; }).map(nom);
                        const actifs = [...document.querySelectorAll('[aria-selected="true"],[aria-pressed="true"],button.on,button.active')].filter(vis);
                        const indistincts = actifs.filter(e => { const f = e.parentElement && [...e.parentElement.children].find(x => x !== e && x.tagName === e.tagName && !x.matches('[aria-selected="true"],[aria-pressed="true"],.on,.active') && vis(x)); if (!f) return false; const a = getComputedStyle(e), z = getComputedStyle(f); return ['backgroundColor', 'color', 'borderTopColor', 'borderBottomWidth', 'fontWeight', 'textDecorationLine', 'outlineStyle'].every(k => a[k] === z[k]); }).map(nom);
                        return { sansForme: [...new Set(sansForme)].slice(0, 8), indistincts: [...new Set(indistincts)].slice(0, 8) };
                    });
                    if (m.sansForme.length) T('moyenne', 'ADA-FORCE-INVISIBLE', f, `${f} en contraste forcé : ${m.sansForme.length} contrôle(s) sans forme visible`, m.sansForme.join('\n'), 'Bordure transparente par défaut (elle devient visible en mode forcé).');
                    if (m.indistincts.length) T('moyenne', 'ADA-FORCE-ETAT', f, `${f} en contraste forcé : on ne voit plus quel choix est actif`, m.indistincts.join('\n'), '@media (forced-colors: active) avec contour ou soulignement sur l\'état actif.');
                } catch (e) { /* page lente */ }
                await p.close();
            }
            await c.close();
            // ── contenus extrêmes ──
            const extremes = ['A'.repeat(300), 'Rindfleischetikettierungsüberwachungsaufgabenübertragungsgesetz'.repeat(3), 'مرحبا بالعالم هذه سلسلة طويلة جدا من الكتب المصورة اليابانية المترجمة', 'שלום עולם '.repeat(8), '👨‍👩‍👧‍👦'.repeat(30), 'ｗｉｄｅ　ｆｕｌｌｗｉｄｔｈ　漫画の非常に長いタイトルです'.repeat(4), ' ', '‮envers', 'Zalgo ' + 'á̂̃̄̅̆̇'.repeat(12), '.'];
            for (let i = 0; i < extremes.length; i++) await J.api('POST', '/me/favorites', { mangaId: 'xt-' + i, source: 'mangadex', title: extremes[i] });
            await J.api('POST', '/me/lists', { name: 'L'.repeat(100), description: 'D'.repeat(2000), isPublic: true });
            await J.api('PUT', '/me/progress/xt-0', { chapterId: 'c'.repeat(150), chapter: 999999.99, page: 99999, source: 'mangadex' });
            await J.api('POST', '/me/notes', { mangaId: 'xt-1', mangaTitle: extremes[1], body: 'N'.repeat(3000) });
            const pages = b.liste.filter(([f]) => /accueil|bibliotheque|collections|notes|profil|stats|recherche|u\.html/.test(f));
            for (const profil of ['bureau', 'mobile']) {
                b.liste = pages;
                await U.visiter(b, profil, async (f, p, s) => {
                    const m = await p.evaluate(mesure);
                    if (m.deborde > 3) T('moyenne', 'ADA-EXTREME-DEBORDE', f, `${f} (${profil}) : un titre hors norme élargit la page de ${m.deborde} px`, m.larges.join('\n'), 'overflow-wrap: anywhere ; min-width: 0.', 'mise en page');
                    if (s.exceptions.length) T('moyenne', 'ADA-EXTREME-EXCEPTION', f, `${f} (${profil}) : un contenu hors norme lève une exception`, s.exceptions.slice(0, 3).join('\n'), '', 'bug');
                    const vide = await p.evaluate(() => [...document.querySelectorAll('.lib2-title')].filter(e => !e.textContent.trim()).length);
                    if (vide) T('basse', 'ADA-TITRE-VIDE', f, `${f} : ${vide} carte(s) sans titre lisible`, 'Titre fait d\'un espace.', 'Repli sur l\'identifiant ou « Sans titre ».', 'bug');
                });
            }
        } finally { await o.fermer(); }
    },
};
