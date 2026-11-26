// ux-retour — l'application répond-elle ? Délai avant le premier signe à l'écran, attente
// annoncée quand le serveur est lent, double envoi, filet sur les actions destructrices.
'use strict';
const U = require('./_ux');
const E = require('./_explore');

const DESTRUCTEUR = /supprimer|retirer|effacer|vider|désinstaller|révoquer|réinitialiser|oublier|✕ tout|tout effacer/i;
const INTERDIT = /^(FR|EN)$|installer|mise à jour de l|quitter|déconnex|supprimer le compte|plein écran|choisir un fichier/i;

module.exports = {
    nom: 'ux-retour',
    description: 'Délai du premier retour visuel, attente annoncée serveur lent, double envoi, filet des actions destructrices',
    async run(ctx) {
        const b = await U.banc(ctx, { base: 'inko_ux_ret', port: 8134, reel: false });
        if (!b) return;
        const T = (gravite, id, titre, detail, correctif, extra = {}) => ctx.trouver({ gravite, id, dimension: 'retour', categorie: 'ux', titre, detail, correctif, effort: 'S', ...extra });
        const releves = [];
        try {
            await b.J.api('POST', '/me/notes', { mangaId: 'fixture-2', mangaTitle: 'Vagabond 3', body: 'Seconde note.' });
            const pages = b.liste.filter(([f]) => /^(accueil|bibliotheque|catalogue|collections|collection-detail|downloads|notes|notifications|parametres|profil|recherche|serie|sources|stats)\.html$/.test(f));
            for (const [f, url] of pages) {
                const c = await E.contexte(b.nav, b.J, { calme: true });
                // serveur lent sur les écritures : c'est là que l'attente doit se voir
                let ecritures = [];
                await c.route('**/api/**', async (route) => { const q = route.request(); if (q.method() === 'GET') return route.fallback(); ecritures.push({ m: q.method(), u: new URL(q.url()).pathname, c: q.postData() || '', t: Date.now() }); await new Promise(r => setTimeout(r, 1500)); return route.fallback(); });
                const p = await c.newPage(); const s = E.surveiller(p);
                const aller = async () => { await p.goto(`${b.J.url}/${url}`, { waitUntil: 'load', timeout: 25000 }); await U.stabiliser(p); await U.outiller(p); await p.evaluate(() => [...document.querySelectorAll('button:not([disabled]),[role=button],[role=tab],input[type=submit]')].filter(e => window.__ux.vis(e) && !window.__ux.hors(e)).forEach((e, i) => e.setAttribute('data-ux', i))); };
                try {
                    await aller();
                    const boutons = await p.$$eval('[data-ux]', l => l.map(e => ({ i: e.getAttribute('data-ux'), nom: ((e.getAttribute('aria-label') || '') || e.textContent || e.getAttribute('title') || '').trim().replace(/\s+/g, ' ').slice(0, 44) })));
                    const uniques = [...new Map(boutons.map(x => [x.nom.replace(/«.*»|\d+/g, ''), x])).values()].slice(0, 22);
                    for (const x of uniques) {
                        if (!x.nom || INTERDIT.test(x.nom)) continue;
                        let h = await p.$(`[data-ux="${x.i}"]`);
                        if (!h || !(await h.isVisible().catch(() => false))) { await aller(); h = await p.$(`[data-ux="${x.i}"]`); if (!h || !(await h.isVisible().catch(() => false))) continue; }
                        const ici = p.url(); ecritures = [];
                        await h.evaluate((e) => {
                            window.__r = { premier: null, t0: 0, occupe: false };
                            window.__obs?.disconnect();
                            window.__obs = new MutationObserver((l) => { if (!window.__r.t0) return; if (window.__r.premier === null) window.__r.premier = performance.now() - window.__r.t0; });
                            window.__obs.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
                            e.addEventListener('click', () => { window.__r.t0 = performance.now(); }, { capture: true, once: true });
                        }).catch(() => { });
                        const ok = await h.click({ timeout: 900 }).then(() => true).catch(() => false);
                        if (!ok) continue;
                        await p.waitForTimeout(650);
                        const r = await p.evaluate((i) => { const e = document.querySelector(`[data-ux="${i}"]`); const attente = [...document.querySelectorAll('[aria-busy="true"],[class*=spinner],[class*=loading],[class*=chargement]')].some(x => x.getClientRects().length); const confirme = [...document.querySelectorAll('.mh-modal,[role=alertdialog],[aria-modal="true"]')].some(x => x.getClientRects().length && getComputedStyle(x).visibility !== 'hidden'); const annulable = !!document.querySelector('.undo-bar'); const message = [...document.querySelectorAll('[class*=toast],[role=status],[role=alert]')].filter(x => x.getClientRects().length).map(x => x.textContent.trim()).filter(Boolean).join(' | ').slice(0, 120); return { premier: window.__r && window.__r.premier, occupe: !!e && (e.disabled || e.getAttribute('aria-busy') === 'true' || /…|\.\.\./.test(e.textContent)) || attente, confirme, annulable, message }; }, x.i).catch(() => null);
                        if (!r) { await aller(); continue; }
                        const envois = ecritures.slice();
                        releves.push({ page: f, bouton: x.nom, delai: r.premier === null ? null : Math.round(r.premier), envois: envois.length, occupe: r.occupe, confirme: r.confirme, annulable: r.annulable });
                        if (r.premier !== null && r.premier > 200) T(r.premier > 450 ? 'moyenne' : 'basse', 'UX-RET-LENT', `${f} : « ${x.nom} » met ${Math.round(r.premier)} ms à répondre à l'écran`, '', 'Changer l\'état du bouton avant tout travail ou appel.', { fichier: f });
                        if (envois.length && !r.occupe && !r.confirme && !r.message && !r.annulable) T('moyenne', 'UX-RET-SANS-ATTENTE', `${f} : « ${x.nom} » envoie au serveur sans rien annoncer pendant l'attente`, `${envois[0].m} ${envois[0].u} — 1,5 s de latence simulée, 650 ms après l'appui : bouton actif, aucun indicateur, aucun message.`, 'Bouton occupé (disabled, aria-busy) ou mise à jour immédiate de l\'écran.', { fichier: f });
                        if (DESTRUCTEUR.test(x.nom) && envois.some(e => e.m === 'DELETE' || /delete|remove|clear|uninstall|revoke/.test(e.u)) && !r.confirme && !r.annulable) T('haute', 'UX-RET-SANS-FILET', `${f} : « ${x.nom} » détruit sans confirmation ni annulation`, envois.map(e => `${e.m} ${e.u}`).join('\n'), 'Annulation de quelques secondes (préférable) ou confirmation explicite.', { fichier: f });
                        // second appui immédiat : l'envoi part-il deux fois ?
                        if (envois.length && !r.confirme) {
                            const h2 = await p.$(`[data-ux="${x.i}"]`);
                            if (h2 && await h2.isVisible().catch(() => false)) {
                                await h2.click({ timeout: 500 }).catch(() => { }); await p.waitForTimeout(250);
                                const memes = ecritures.filter(e => e.m === envois[0].m && e.u === envois[0].u && e.c === envois[0].c);
                                if (memes.length > 1) T('moyenne', 'UX-RET-DOUBLE-ENVOI', `${f} : deux appuis sur « ${x.nom} » envoient deux fois la même demande`, `${memes[0].m} ${memes[0].u} × ${memes.length}`, 'Désactiver le contrôle tant que la réponse n\'est pas arrivée.', { fichier: f });
                            }
                        }
                        await p.keyboard.press('Escape').catch(() => { });
                        if (p.url() !== ici || r.confirme || envois.length) await aller();
                    }
                    if (s.exceptions.length) T('haute', 'UX-RET-EXCEPTION', `${f} : exception pendant les appuis, serveur lent`, [...new Set(s.exceptions)].slice(0, 4).join('\n'), 'Gérer l\'état intermédiaire.', { fichier: f });
                } catch (e) { T('info', 'UX-RET-INTERROMPU', `${f} : ${e.message.slice(0, 90)}`, '', ''); }
                await c.close();
            }
            const delais = releves.map(r => r.delai).filter(x => x !== null).sort((a, z) => a - z);
            ctx.mesure('retour_boutons_essayes', releves.length);
            ctx.mesure('retour_delai_ms', { median: delais[Math.floor(delais.length / 2)] || 0, p95: delais[Math.floor(delais.length * .95)] || 0 });
            ctx.mesure('retour_releves', releves);
        } finally { await b.fermer(); }
    },
};
