// parcours — chaque page dans les situations qu'on n'essaie jamais : compte tout neuf,
// largeurs extrêmes, thème clair, chaque couleur d'accent, interface anglaise.
'use strict';
const fs = require('fs');
const path = require('path');
const E = require('./_explore');

const ACCENTS = ['#22c55e', '#ec4899', '#ef4444', '#06b6d4', '#f59e0b', '#8b5cf6', '#3b82f6'];

async function inspecter(p) {
    return p.evaluate(() => {
        const de = document.documentElement;
        const sel = (e) => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
        const larges = [...document.querySelectorAll('body *')].filter(e => { const r = e.getBoundingClientRect(); if (!r.width || r.right <= de.clientWidth + 2) return false; const s = getComputedStyle(e); if (s.position === 'fixed' || s.visibility === 'hidden') return false; for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) { const o = getComputedStyle(a).overflowX; if (o !== 'visible') return false; } return true; }).slice(0, 4).map(sel);
        // texte coupé net : débordement masqué sans points de suspension
        const coupes = [...document.querySelectorAll('button,a,h1,h2,h3,label,th,.btn')].filter(e => { const s = getComputedStyle(e); return !e.closest('.a11y-invisible') && e.getClientRects().length && e.scrollWidth > e.clientWidth + 3 && s.overflowX === 'hidden' && s.textOverflow !== 'ellipsis' && (e.textContent || '').trim().length > 2; }).slice(0, 5).map(e => sel(e) + ' « ' + e.textContent.trim().slice(0, 30) + ' »');
        // boutons ou liens qui se chevauchent
        const c = [...document.querySelectorAll('button,a.btn,input,select')].filter(e => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 4 && r.height > 4 && r.top >= 0 && r.top < innerHeight && s.visibility !== 'hidden' && +s.opacity > .1 && !e.closest('[hidden],#inko-music,[class*=toast],[class*=astuce]'); });
        const chevauche = [];
        for (let i = 0; i < c.length && chevauche.length < 4; i++) for (let j = i + 1; j < c.length; j++) { const a = c[i], b = c[j]; if (a.contains(b) || b.contains(a)) continue; const x = a.getBoundingClientRect(), y = b.getBoundingClientRect(); const w = Math.min(x.right, y.right) - Math.max(x.left, y.left), h = Math.min(x.bottom, y.bottom) - Math.max(x.top, y.top); if (w > 6 && h > 6 && w * h > 0.3 * Math.min(x.width * x.height, y.width * y.height)) { const top = document.elementFromPoint(Math.max(x.left, y.left) + w / 2, Math.max(x.top, y.top) + h / 2); if (top && (a === top || a.contains(top) || b === top || b.contains(top))) chevauche.push(sel(a) + ' ✕ ' + sel(b)); } }
        return { deborde: de.scrollWidth - de.clientWidth, larges, coupes, chevauche, texte: document.body.innerText.trim().length };
    });
}

module.exports = {
    nom: 'parcours',
    description: 'Compte vide, 5 largeurs, thème clair (axe), 7 couleurs d\'accent, interface anglaise',
    async run(ctx) {
        const o = await E.ouvrir(ctx, { base: 'inko_s_parc', port: 8093 });
        if (!o) return;
        const { J, nav } = o;
        const axe = fs.readFileSync(path.join(ctx.racine, 'node_modules', 'axe-core', 'axe.min.js'), 'utf8');
        const passer = async (c, liste, faire) => { for (const [f, u] of liste) { const p = await c.newPage(); const s = E.surveiller(p); try { await p.goto(`${J.url}/${u}`, { waitUntil: 'load', timeout: 25000 }); await p.waitForTimeout(1800); await faire(f, p, s); } catch (e) { ctx.trouver({ gravite: 'basse', id: 'PARCOURS-INTERROMPU', titre: `${f} : ${e.message.slice(0, 80)}`, effort: 'S' }); } await p.close(); } await c.close(); };
        try {
            // 1. compte tout neuf
            await passer(await E.contexte(nav, J), E.adresses(ctx, {}), async (f, p, s) => {
                const brutes = await E.lireValeursBrutes(p);
                const m = await inspecter(p);
                if (s.exceptions.length) ctx.trouver({ gravite: 'haute', id: 'VIDE-EXCEPTION', categorie: 'bug', titre: `${f} : exception sur un compte tout neuf`, fichier: f, detail: [...new Set(s.exceptions)].slice(0, 3).join('\n'), effort: 'S' });
                if (s.ko.length) ctx.trouver({ gravite: 'haute', id: 'VIDE-5XX', categorie: 'bug', titre: `${f} : erreur serveur sur un compte tout neuf`, fichier: f, detail: [...new Set(s.ko)].join('\n'), effort: 'S' });
                if (brutes.length) ctx.trouver({ gravite: 'moyenne', id: 'VIDE-VALEUR-BRUTE', categorie: 'bug', titre: `${f} : valeur manquante affichée sur un compte vide`, fichier: f, detail: brutes.join('\n'), effort: 'S' });
                if (m.texte < 60) ctx.trouver({ gravite: 'moyenne', id: 'VIDE-ETAT', categorie: 'bug', titre: `${f} : aucun état vide explicite (${m.texte} caractères)`, fichier: f, effort: 'S' });
            });
            const d = await E.semer(J);
            const liste = E.adresses(ctx, d);
            // 2. largeurs
            for (const largeur of [320, 360, 768, 1024, 1920]) {
                await passer(await E.contexte(nav, J, { largeur, hauteur: largeur < 500 ? 700 : 900, mobile: largeur < 500 }), liste, async (f, p) => {
                    const m = await inspecter(p);
                    if (m.deborde > 2) ctx.trouver({ gravite: largeur < 500 ? 'haute' : 'moyenne', id: 'LARGEUR-DEBORDE', categorie: 'mise en page', titre: `${f} à ${largeur} px : défilement horizontal de ${m.deborde} px`, fichier: f, detail: m.larges.join('\n'), correctif: 'min-width:0, flex-wrap, max-width:100% sur les éléments listés.', effort: 'S' });
                    if (m.coupes.length) ctx.trouver({ gravite: 'basse', id: 'LARGEUR-TEXTE-COUPE', categorie: 'mise en page', titre: `${f} à ${largeur} px : texte coupé sans points de suspension`, fichier: f, detail: m.coupes.join('\n'), effort: 'S' });
                    if (m.chevauche.length) ctx.trouver({ gravite: 'moyenne', id: 'LARGEUR-CHEVAUCHEMENT', categorie: 'mise en page', titre: `${f} à ${largeur} px : des contrôles se chevauchent`, fichier: f, detail: m.chevauche.join('\n'), effort: 'S' });
                });
            }
            // 3. thème clair
            await passer(await E.contexte(nav, J, { theme: 'light', sombre: false }), liste, async (f, p, s) => {
                if (s.exceptions.length) ctx.trouver({ gravite: 'haute', id: 'CLAIR-EXCEPTION', titre: `${f} : exception en thème clair`, fichier: f, detail: s.exceptions[0], effort: 'S' });
                await p.evaluate(axe);
                const v = await p.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } })).violations.map(v => ({ id: v.id, impact: v.impact, n: v.nodes.length, ex: v.nodes.slice(0, 3).map(n => n.target.join(' ') + ' — ' + ((n.any[0] && n.any[0].message) || '').slice(0, 110)) })));
                for (const x of v) ctx.trouver({ gravite: x.impact === 'serious' || x.impact === 'critical' ? 'haute' : 'moyenne', id: 'CLAIR-AXE-' + x.id.toUpperCase(), categorie: 'accessibilité', titre: `${f} (thème clair) : ${x.id} × ${x.n}`, fichier: f, detail: x.ex.join('\n'), effort: 'S' });
            });
            // 4. chaque couleur d'accent, sur les pages qui s'en servent le plus
            for (const accent of ACCENTS) {
                for (const theme of ['dark', 'light']) {
                    await passer(await E.contexte(nav, J, { accent, theme, sombre: theme === 'dark' }), liste.filter(([f]) => /bibliotheque|serie|sources|stats/.test(f)), async (f, p) => {
                        await p.evaluate(axe);
                        const v = await p.evaluate(async () => (await window.axe.run(document, { runOnly: ['color-contrast'] })).violations.reduce((n, v) => n + v.nodes.length, 0));
                        if (v) ctx.trouver({ gravite: 'moyenne', id: 'ACCENT-CONTRASTE', categorie: 'accessibilité', titre: `${f} : ${v} texte(s) peu lisible(s) avec l'accent ${accent} (${theme === 'dark' ? 'sombre' : 'clair'})`, fichier: f, effort: 'S' });
                    });
                }
            }
            // 5. interface anglaise : ce qui reste en français à l'écran
            const restes = new Map();
            await passer(await E.contexte(nav, J, { langue: 'en' }), liste.filter(([f]) => f !== 'confidentialite.html'), async (f, p) => {
                const fr = await p.evaluate(() => {
                    const out = new Set(); const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
                    const FR = /[éèêàçùûîïôœ]|\b(le|la|les|des|une|avec|sans|pour|dans|sur|tes|ton|ta|vos|votre|aucune?|pas|plus|chapitres?|séries?|lecture|réglages|ajouter|retirer|voir)\b/i;
                    // les titres d'œuvres et le contenu venant des sources ne se traduisent pas
                    while ((n = w.nextNode())) { const t = n.nodeValue.trim(); const e = n.parentElement; if (!t || t.length < 4 || !e || !e.getClientRects().length || e.closest('script,style,.sy-v,[data-seed],.manga-card-title,.lib2-title,.shelf-card-title,.se-card-title,.chapter-row,.sim-card')) continue; if (FR.test(t) && !/^(Naruto|Berserk|Vagabond|Monster|Akira|Blame|Gantz|Pluto|Planetes|Vinland|Dorohedoro|Gon|Une note|Une description|Un commentaire|Ma liste|À relire)/.test(t)) out.add(t.slice(0, 90)); }
                    for (const e of document.querySelectorAll('[title],[aria-label],[placeholder]')) for (const a of ['title', 'aria-label', 'placeholder']) { const t = (e.getAttribute(a) || '').trim(); if (t.length > 3 && FR.test(t)) out.add(a + ' : ' + t.slice(0, 80)); }
                    return [...out];
                });
                if (fr.length) { restes.set(f, fr.length); ctx.trouver({ gravite: fr.length > 10 ? 'haute' : 'moyenne', id: 'ANGLAIS-RESTE-FRANCAIS', categorie: 'i18n', titre: `${f} en anglais : ${fr.length} texte(s) encore en français`, fichier: f, detail: fr.slice(0, 18).join('\n'), correctif: 'Ajouter les entrées à assets/i18n/en.json ; traduire aussi title, aria-label et placeholder.', effort: 'S' }); }
            });
            ctx.mesure('anglais_restes_par_page', Object.fromEntries(restes));
        } finally { await o.fermer(); }
    },
};
