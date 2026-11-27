// mobile — au doigt : taille réelle des cibles, contenu masqué par la barre du bas, zoom
// forcé à la saisie, gestes, orientation paysage, et chaque contrôle touché une fois.
'use strict';
const E = require('./_explore');

module.exports = {
    nom: 'mobile',
    description: 'Téléphone : cibles tactiles, barre du bas, saisie, paysage, appui sur chaque contrôle, mode application Android',
    async run(ctx) {
        const o = await E.ouvrir(ctx, { base: 'inko_s_mob', port: 8104 });
        if (!o) return;
        const { J, nav } = o;
        const T = (gravite, id, titre, detail, correctif, extra = {}) => ctx.trouver({ gravite, id, categorie: 'mobile', titre, detail, correctif, effort: 'S', ...extra });
        const totaux = { cibles: 0, appuis: 0, appuisSansEffet: 0, pages: 0 };
        try {
            const d = await E.semer(J);
            const oe = await E.oeuvresReelles(J);
            const liste = E.adresses(ctx, { ...d, ...oe }).filter(([f]) => f !== 'index.html');
            const c = await E.contexte(nav, J, { mobile: true });
            for (const [f, u] of liste) {
                const p = await c.newPage(); const s = E.surveiller(p); totaux.pages++;
                const aller = async () => { await p.goto(`${J.url}/${u}`, { waitUntil: 'load', timeout: 25000 }); await p.waitForTimeout(2000); };
                try {
                    await aller();
                    const m = await p.evaluate(() => {
                        const nom = (e) => ((e.getAttribute('aria-label') || e.textContent || e.getAttribute('placeholder') || '').trim().replace(/\s+/g, ' ').slice(0, 26) || e.tagName.toLowerCase() + (e.id ? '#' + e.id : '.' + String(e.className).split(/\s+/)[0]));
                        const vis = (e) => { const s = getComputedStyle(e); return e.getClientRects().length && s.visibility !== 'hidden' && +s.opacity > .05; };
                        // le dock musical et les astuces flottantes sont mesurés à part (boutons.js)
                        const cibles = [...document.querySelectorAll('button,a[href],input,select,[role=button],[role=tab],summary')].filter(vis).filter(e => !e.closest('#inko-music,[class*=astuce]'));
                        const dansTexte = (e) => e.tagName === 'A' && e.parentElement && /^(P|LI|SPAN|SMALL|TD)$/.test(e.parentElement.tagName) && e.parentElement.textContent.trim().length > e.textContent.trim().length + 12;
                        // MOB-09 : global.css étend la zone d'appui par un ::after invisible
                        // (« agrandir la zone, pas le dessin »). C'est cette zone que le doigt
                        // atteint : la mesurer, et pas seulement le dessin.
                        const zone = (z, r) => {
                            if (z.tagName === 'INPUT') return { w: r.width, h: r.height };   // pas de ::after sur un champ
                            const a = getComputedStyle(z, '::after');
                            if (!a || a.content === 'none' || a.position !== 'absolute' || a.pointerEvents === 'none') return { w: r.width, h: r.height };
                            return { w: Math.max(r.width, parseFloat(a.minWidth) || 0, parseFloat(a.width) || 0), h: Math.max(r.height, parseFloat(a.minHeight) || 0, parseFloat(a.height) || 0) };
                        };
                        const tailles = cibles.filter(e => !dansTexte(e)).map(e => { const z = e.type === 'checkbox' || e.type === 'radio' ? (e.closest('label') || e) : e; const r = zone(z, z.getBoundingClientRect()); return { n: nom(e), w: Math.round(r.w), h: Math.round(r.h) }; }).filter(r => r.w > 0);
                        const police = [...document.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color]),select,textarea')].filter(vis).filter(e => parseFloat(getComputedStyle(e).fontSize) < 16).map(e => nom(e) + ' ' + getComputedStyle(e).fontSize);
                        const petits = [...document.querySelectorAll('body *')].filter(e => e.childElementCount === 0 && e.textContent.trim().length > 3 && vis(e) && parseFloat(getComputedStyle(e).fontSize) < 11).map(e => e.textContent.trim().slice(0, 24) + ' ' + getComputedStyle(e).fontSize);
                        window.scrollTo(0, document.body.scrollHeight);
                        const fixes = [...document.querySelectorAll('body *')].filter(e => { const s = getComputedStyle(e); if (s.position !== 'fixed' || !vis(e)) return false; const r = e.getBoundingClientRect(); return r.width > innerWidth * .6 && r.bottom > innerHeight - 4 && r.height > 30 && r.height < 200; });
                        const haut = fixes.length ? Math.min(...fixes.map(e => e.getBoundingClientRect().top)) : innerHeight;
                        const masques = cibles.filter(e => !fixes.some(x => x.contains(e))).filter(e => { const r = e.getBoundingClientRect(); return r.top < innerHeight && r.bottom > haut + 8 && r.top > haut - r.height / 2; }).map(nom);
                        const viewport = (document.querySelector('meta[name=viewport]') || {}).content || '';
                        return { tailles, police, petits: [...new Set(petits)].slice(0, 8), masques: [...new Set(masques)].slice(0, 6), viewport };
                    });
                    totaux.cibles += m.tailles.length;
                    const mini = m.tailles.filter(r => r.w < 24 || r.h < 24), faibles = m.tailles.filter(r => (r.w < 40 || r.h < 40) && !(r.w < 24 || r.h < 24));
                    const fmt = (l) => [...new Map(l.map(r => [r.n, r])).values()].slice(0, 14).map(r => `${r.n} — ${r.w}×${r.h}`).join('\n');
                    if (mini.length) T('haute', 'MOB-CIBLE-24', `${f} : ${mini.length} cible(s) tactile(s) sous 24 px (minimum WCAG 2.2)`, fmt(mini), 'min-width et min-height à 44 px (zone d\'appui, pas forcément le dessin).', { fichier: f, categorie: 'accessibilité' });
                    if (faibles.length > 3) T('moyenne', 'MOB-CIBLE-40', `${f} : ${faibles.length} cible(s) entre 24 et 40 px`, fmt(faibles), 'Viser 44 × 44.', { fichier: f });
                    if (m.police.length) T('moyenne', 'MOB-ZOOM-SAISIE', `${f} : ${m.police.length} champ(s) sous 16 px, qui font zoomer l'écran sur iOS`, m.police.slice(0, 8).join('\n'), 'font-size: 16px sur les champs sous 600 px.', { fichier: f });
                    if (m.petits.length) T('basse', 'MOB-TEXTE-MINUSCULE', `${f} : texte sous 11 px`, m.petits.join('\n'), 'Plancher à 12 px.', { fichier: f });
                    if (m.masques.length) T('haute', 'MOB-BARRE-MASQUE', `${f} : en bas de page, des contrôles restent sous la barre fixe`, m.masques.join('\n'), 'padding-bottom égal à la hauteur de la barre et à env(safe-area-inset-bottom).', { fichier: f });
                    if (/user-scalable\s*=\s*no|maximum-scale\s*=\s*1(\.0)?\b/.test(m.viewport)) T('moyenne', 'MOB-ZOOM-BLOQUE', `${f} : le zoom est interdit`, m.viewport, 'Retirer maximum-scale et user-scalable.', { fichier: f, categorie: 'accessibilité' });
                    // appuyer sur chaque contrôle une fois
                    await aller();
                    // les boutons de langue sont écartés : les toucher ferait passer toute la suite en anglais
                    const marquer = () => p.evaluate(() => [...document.querySelectorAll('button:not([disabled]),[role=button],[role=tab],summary')].filter(e => e.getClientRects().length && !e.closest('#inko-music') && !/^(FR|EN)$/.test(e.textContent.trim())).map((e, k) => e.setAttribute('data-sonde', k)).length);
                    const total = await marquer();
                    const inertes = [];
                    for (let i = 0; i < Math.min(total, 28); i++) {
                        const h = await p.$(`[data-sonde="${i}"]`); if (!h || !(await h.isVisible().catch(() => false))) continue;
                        const nom = await h.evaluate(e => (e.getAttribute('aria-label') || e.textContent || e.id || '').trim().replace(/\s+/g, ' ').slice(0, 40));
                        if (/installer|mise à jour|quitter|déconnex|supprimer|effacer|vider|réinitialiser|désinstall|importer|exporter|fichier|parcourir/i.test(nom)) continue;
                        const avant = await p.evaluate(() => { window.__mut = 0; if (!window.__obs) { window.__obs = new MutationObserver(l => { window.__mut += l.length; }); window.__obs.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true }); } return { u: location.href, y: scrollY }; }).catch(() => null);
                        if (!avant) { await aller(); continue; }
                        const exc = s.exceptions.length; let requetes = 0; const compte = () => requetes++; p.on('request', compte);
                        const touche = await h.tap({ timeout: 800 }).then(() => true).catch(() => false);
                        await p.waitForTimeout(420); p.off('request', compte);
                        if (!touche) continue;
                        totaux.appuis++;
                        if (s.exceptions.length > exc) T('haute', 'MOB-APPUI-EXCEPTION', `${f} : toucher « ${nom} » lève une exception`, s.exceptions.slice(exc).join('\n'), '', { fichier: f, categorie: 'bug' });
                        const apres = await p.evaluate(() => ({ u: location.href, y: scrollY, mut: window.__mut, actif: document.activeElement && document.activeElement.tagName })).catch(() => null);
                        if (!apres || apres.u !== avant.u) { await aller(); await marquer(); continue; }
                        if (!apres.mut && !requetes && Math.abs(apres.y - avant.y) < 3 && !/INPUT|TEXTAREA|SELECT/.test(apres.actif || '')) { const deja = await h.evaluate(e => e.matches('[aria-selected="true"],[aria-pressed="true"],.on,.active')).catch(() => false); if (!deja) { inertes.push(nom || `bouton ${i}`); totaux.appuisSansEffet++; } }
                        await p.keyboard.press('Escape').catch(() => { });
                    }
                    if (inertes.length) T('moyenne', 'MOB-BOUTON-INERTE', `${f} : ${inertes.length} bouton(s) sans aucun effet visible au toucher`, [...new Set(inertes)].join('\n'), 'Retour immédiat (état, message) sur chaque appui ; retirer les boutons morts.', { fichier: f, categorie: 'bug' });
                    // paysage
                    await p.setViewportSize({ width: 844, height: 390 }); await aller();
                    const pay = await p.evaluate(() => ({ deb: document.documentElement.scrollWidth - innerWidth, fixes: [...document.querySelectorAll('body *')].filter(e => { const s = getComputedStyle(e); return (s.position === 'fixed' || s.position === 'sticky') && s.visibility !== 'hidden' && +s.opacity > .1 && e.getBoundingClientRect().width > innerWidth * .6; }).reduce((n, e) => { const r = e.getBoundingClientRect(); return n + (r.height < innerHeight ? Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0)) : 0); }, 0) }));
                    if (pay.deb > 2) T('moyenne', 'MOB-PAYSAGE-DEBORDE', `${f} en paysage : défilement horizontal de ${pay.deb} px`, '', '', { fichier: f, categorie: 'mise en page' });
                    if (pay.fixes > 390 * .4) T('moyenne', 'MOB-PAYSAGE-BARRES', `${f} en paysage : les barres fixes prennent ${Math.round(pay.fixes)} px sur 390`, '', 'Réduire ou escamoter les barres quand la hauteur manque.', { fichier: f });
                    await p.setViewportSize({ width: 390, height: 844 });
                } catch (e) { T('basse', 'MOB-INTERROMPU', `${f} : ${e.message.slice(0, 90)}`, '', ''); }
                await p.close();
            }
            await c.close();
            ctx.mesure('mobile_totaux', totaux);
        } finally { await o.fermer(); }
    },
};
