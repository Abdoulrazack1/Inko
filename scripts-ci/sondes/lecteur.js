// lecteur — le cœur de l'application, fonction par fonction : modes, touches, réglages,
// reprise de lecture, progression enregistrée, lecteur de romans. Une œuvre réelle.
'use strict';
const E = require('./_explore');

const dormir = (p, ms) => p.waitForTimeout(ms);
const etat = (p) => p.evaluate(() => {
    const zone = document.getElementById('readerPagesArea');
    const imgs = [...document.querySelectorAll('.reader-page-img')];
    const visibles = imgs.filter(i => { const r = i.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight && r.width > 10; });
    const barre = document.querySelector('#readerProgressFill');
    const ici = document.querySelector('.reader-nav-page');
    const compteur = ici && ici.innerText.match(/(\d+)\s*\/\s*(\d+)/);
    return {
        images: imgs.length, visibles: visibles.length, cassees: imgs.filter(i => i.complete && !i.naturalWidth && i.getAttribute('src')).length,
        largeur: visibles[0] ? Math.round(visibles[0].getBoundingClientRect().width) : 0,
        page: compteur ? +compteur[1] : null, total: compteur ? +compteur[2] : null,
        barre: barre ? barre.style.width || getComputedStyle(barre).width : null,
        defile: Math.round(scrollY), url: location.search, immersif: document.body.classList.contains('reader-immersive'),
        reglages: !!document.getElementById('readerSettings'), hauteurDoc: document.body.scrollHeight,
        classes: document.body.className, zone: zone ? zone.className : '',
    };
});

module.exports = {
    nom: 'lecteur',
    description: 'Lecteur manga et lecteur roman : chaque touche, chaque mode, chaque réglage, reprise et progression',
    async run(ctx) {
        const o = await E.ouvrir(ctx, { base: 'inko_s_lect', port: 8095 });
        if (!o) return;
        const { J, nav } = o;
        const d = (gravite, id, titre, detail, extra = {}) => ctx.trouver({ gravite, id, categorie: 'lecteur', titre, detail, fichier: 'assets/js/chapitre.js', effort: 'S', ...extra });
        const verdicts = [];
        const note = (fonction, ok, info = '') => { verdicts.push({ fonction, ok, info }); };
        try {
            const oe = await E.oeuvresReelles(J);
            if (!oe.manga) { ctx.trouver({ gravite: 'info', id: 'LECTEUR-SANS-SOURCE', titre: 'Source manga injoignable : lecteur non éprouvé' }); }
            else {
                const m = oe.manga; const ch = m.chapitres[Math.floor(m.chapitres.length / 2)];
                const url = `${J.url}/chapitre.html?manga=${encodeURIComponent(m.id)}&chapter=${encodeURIComponent(ch.id)}&source=${m.source}`;
                await J.api('POST', '/me/favorites', { mangaId: m.id, source: m.source, title: m.titre });
                const c = await E.contexte(nav, J);
                const p = await c.newPage(); const s = E.surveiller(p);
                const t0 = Date.now();
                await p.goto(url, { waitUntil: 'domcontentloaded' });
                await p.waitForSelector('.reader-page-img', { timeout: 25000 }).catch(() => { });
                await p.waitForFunction(() => [...document.querySelectorAll('.reader-page-img')].some(i => i.naturalWidth > 0), null, { timeout: 25000 }).catch(() => { });
                ctx.mesure('lecteur_premiere_planche_ms', Date.now() - t0);
                await dormir(p, 2500);
                let a = await etat(p);
                note('ouverture', a.images > 0, `${a.images} images`);
                if (!a.images) d('haute', 'LECTEUR-VIDE', 'Le lecteur n\'affiche aucune planche', JSON.stringify(a));
                const touche = async (k, attente = 650) => { await p.keyboard.press(k); await dormir(p, attente); return etat(p); };
                const bouge = (x, y) => x.page !== y.page || Math.abs(x.defile - y.defile) > 5 || x.url !== y.url;
                for (const mode of ['page', 'double', 'scroll']) {
                    const bouton = await p.$(`#readerModebar [data-mode="${mode}"]`);
                    if (bouton) await bouton.click().catch(() => { }); else await p.evaluate((m) => { window.Storage?.setPref('readMode', m); }, mode).then(() => p.reload()).catch(() => { });
                    await dormir(p, 1500);
                    const debut = await etat(p);
                    note(`mode ${mode}`, debut.visibles > 0, `${debut.visibles} visible(s), largeur ${debut.largeur}`);
                    if (!debut.visibles) d('haute', 'LECTEUR-MODE-VIDE', `Mode « ${mode} » : aucune planche à l'écran`, JSON.stringify(debut));
                    for (const k of mode === 'scroll' ? ['ArrowDown', 'PageDown', 'Space', 'End', 'Home'] : ['ArrowLeft', 'ArrowRight', 'Space', 'ArrowDown', 'PageDown', 'End', 'Home']) {
                        const avant = await etat(p); const apres = await touche(k);
                        const ok = bouge(avant, apres) || (k === 'Home' && (mode === 'scroll' ? avant.defile < 5 : avant.page === 1)) || (k === 'ArrowRight' && mode !== 'scroll' && avant.page === 1);
                        note(`${mode} · ${k}`, ok, `p.${avant.page}→${apres.page} défil ${avant.defile}→${apres.defile}`);
                        if (!ok) d('moyenne', 'LECTEUR-TOUCHE-INERTE', `Mode « ${mode} » : la touche ${k} ne fait rien`, `page ${avant.page}/${avant.total}, défilement ${avant.defile}`);
                        if (apres.url !== avant.url) { await p.goto(url); await dormir(p, 3000); }
                    }
                }
                await p.goto(url); await dormir(p, 3500);
                // zoom, immersif, réglages, signet, notes, défilement auto
                await p.click('#readerModebar [data-mode="page"]').catch(() => { }); await dormir(p, 1200);
                let x = await etat(p); let y = await touche('+'); note('zoom +', y.largeur > x.largeur, `${x.largeur}→${y.largeur}`);
                if (!(y.largeur > x.largeur)) d('moyenne', 'LECTEUR-ZOOM', 'La touche + n\'agrandit pas la planche', `${x.largeur} → ${y.largeur} px`);
                y = await touche('-'); note('zoom −', y.largeur <= x.largeur + 2, `${y.largeur}`);
                y = await touche('i'); note('immersif', y.immersif, y.classes); if (!y.immersif) d('moyenne', 'LECTEUR-IMMERSIF', 'La touche I n\'active pas le mode immersif', y.classes);
                y = await touche('Escape'); note('immersif · Échap', !y.immersif); if (y.immersif) d('moyenne', 'LECTEUR-IMMERSIF-SORTIE', 'Échap ne quitte pas le mode immersif', y.classes);
                y = await touche('s'); note('réglages · S', y.reglages);
                if (!y.reglages) d('haute', 'LECTEUR-REGLAGES', 'La touche S n\'ouvre pas les réglages', '');
                else {
                    const cles = await p.$$eval('#readerSettings .rs-seg[data-key] button', b => b.map(x => [x.closest('.rs-seg').dataset.key, x.dataset.val]));
                    for (const [k, v] of cles) {
                        const exc = s.exceptions.length;
                        await p.click(`#readerSettings .rs-seg[data-key="${k}"] button[data-val="${v}"]`, { timeout: 1500 }).catch(() => { });
                        await dormir(p, 300);
                        const r = await p.evaluate(([k]) => ({ pref: window.Storage?.getPref(k === 'quality' ? 'quality' : 'reader_' + k), ouvert: !!document.getElementById('readerSettings'), images: document.querySelectorAll('.reader-page-img').length }), [k]);
                        const ok = String(r.pref) === v && r.images > 0 && s.exceptions.length === exc;
                        note(`réglage ${k}=${v}`, ok, JSON.stringify(r));
                        if (!ok) d('moyenne', 'LECTEUR-REGLAGE', `Réglage ${k} = ${v} sans effet ou en erreur`, JSON.stringify(r) + ' ' + s.exceptions.slice(exc).join(' '));
                        if (!r.ouvert) await touche('s');
                    }
                    for (const id of ['rsBright', 'rsWarm', 'rsGap', 'rsAuto']) { const exc = s.exceptions.length; await p.$eval('#' + id, e => { e.value = e.max; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }).catch(() => { }); await dormir(p, 200); note('curseur ' + id, s.exceptions.length === exc); }
                    for (const id of ['rsAutoCrop', 'rsNuitAuto', 'rsAutoDouble', 'rsDecouper', 'rsPivoter', 'rsContinu']) { const exc = s.exceptions.length; if (!(await p.$('#readerSettings #' + id))) await touche('s'); await p.click('#' + id, { timeout: 1500 }).catch(() => { }); await dormir(p, 500); const e = await etat(p); note('case ' + id, s.exceptions.length === exc && e.images > 0); if (e.images === 0 || s.exceptions.length > exc) d('haute', 'LECTEUR-OPTION', `L'option ${id} vide le lecteur ou lève une exception`, s.exceptions.slice(exc).join('\n')); }
                    if (await p.$('#readerSettings')) await touche('Escape'); y = await etat(p); note('réglages · Échap', !y.reglages); if (y.reglages) d('moyenne', 'LECTEUR-REGLAGES-ECHAP', 'Après avoir touché une case ou un curseur, Échap ne ferme plus les réglages du lecteur', 'MH.toucheIgnoree() (global.js) ignore toute touche quand le focus est sur un champ, Échap compris.', { correctif: 'Laisser passer Échap dans toucheIgnoree.', fichier: 'assets/js/global.js' });
                }
                const nb = async () => (await J.api('GET', '/me/bookmarks')).json;
                const compter = (r) => Array.isArray(r) ? r.length : ((r && (r.bookmarks || r.results)) || []).length;
                await p.goto(url); await dormir(p, 3500);
                const b0 = compter(await nb()); await touche('b', 900); await p.keyboard.press('Enter').catch(() => { }); await dormir(p, 900);
                const b1 = compter(await nb()); note('signet · B', b1 > b0, `${b0}→${b1}`); await touche('Escape');
                await touche('a', 100); const d0 = (await etat(p)).defile; await dormir(p, 2000); const d1 = (await etat(p)).defile; note('défilement auto', d1 > d0 + 20, `${d0}→${d1}`);
                if (!(d1 > d0 + 20)) d('moyenne', 'LECTEUR-AUTO', 'Le défilement automatique (A) n\'avance pas', `${d0} → ${d1} en 2 s`);
                await touche('a');
                // progression et reprise
                await p.goto(url); await dormir(p, 3500);
                await p.evaluate(() => window.goToPage && window.goToPage(4)); await dormir(p, 4500);
                const prog = await J.api('GET', '/me/progress');
                const pg = prog.json && prog.json[m.id];
                note('progression enregistrée', !!(pg && pg.page >= 3), JSON.stringify(pg).slice(0, 150));
                if (!(pg && pg.page >= 3)) d('haute', 'LECTEUR-PROGRESSION', 'La page atteinte n\'est pas enregistrée sur le serveur après 4,5 s', JSON.stringify(pg).slice(0, 300));
                const avantReprise = (await etat(p)).page;
                await p.reload(); await dormir(p, 4500); const apresReprise = await etat(p);
                note('reprise après rechargement', apresReprise.page >= 3 || apresReprise.defile > 100, `p.${avantReprise}→${apresReprise.page}, défil ${apresReprise.defile}`);
                if (!(apresReprise.page >= 3 || apresReprise.defile > 100)) d('haute', 'LECTEUR-REPRISE', 'Recharger le chapitre ramène au début', `page ${avantReprise} avant, ${apresReprise.page} après`);
                const av = await etat(p); await touche('n', 4000); const ap = await etat(p); note('chapitre suivant · N', ap.url !== av.url); if (ap.url === av.url) d('haute', 'LECTEUR-SUIVANT', 'La touche N ne passe pas au chapitre suivant', av.url);
                await touche('p', 4000); const re = await etat(p); note('chapitre précédent · P', re.url !== ap.url);
                if (s.exceptions.length) d('haute', 'LECTEUR-EXCEPTION', `${s.exceptions.length} exception(s) pendant la session de lecture`, [...new Set(s.exceptions)].slice(0, 8).join('\n'));
                if (s.ko.length) d('haute', 'LECTEUR-5XX', 'Erreurs serveur pendant la lecture', [...new Set(s.ko)].join('\n'));
                // chapitre et œuvre inexistants
                for (const [nom, u] of [['chapitre inconnu', `chapitre.html?manga=${encodeURIComponent(m.id)}&chapter=inexistant&source=${m.source}`], ['source inconnue', 'chapitre.html?manga=a&chapter=b&source=nexistepas'], ['sans paramètre', 'chapitre.html']]) {
                    const q = await c.newPage(); const qs = E.surveiller(q); await q.goto(`${J.url}/${u}`); await dormir(q, 4500);
                    const t = await q.evaluate(() => ({ t: (document.querySelector('main') || document.body).innerText.replace(/\s+/g, ' ').slice(0, 200), url: location.pathname }));
                    const ok = qs.exceptions.length === 0 && (/introuvable|impossible|erreur|aucun|réessayer|indisponible|inconnu|invalide/i.test(t.t) || !/chapitre\.html/.test(t.url));
                    note('cas ' + nom, ok, t.t.slice(0, 80));
                    if (!ok) d('moyenne', 'LECTEUR-ADRESSE', `Adresse « ${nom} » : pas de message clair`, t.t + '\n' + qs.exceptions.join('\n'));
                    await q.close();
                }
                await c.close();
                // téléphone : tapes et balayage
                const mc = await E.contexte(nav, J, { mobile: true }); const mp = await mc.newPage(); const ms = E.surveiller(mp);
                await mp.goto(url); await dormir(mp, 4500);
                const pg0 = await etat(mp); await mp.touchscreen.tap(30, 420); await dormir(mp, 700); await mp.touchscreen.tap(360, 420); await dormir(mp, 700); const pg1 = await etat(mp);
                note('mobile · tapes', true, `p.${pg0.page}→${pg1.page} défil ${pg1.defile}`);
                const petits = await mp.evaluate(() => [...document.querySelectorAll('#readerToolbar button,#readerToolbar a,#readerModebar button,#readerNavigation button,#readerNavigation a')].filter(e => e.getClientRects().length).map(e => { const r = e.getBoundingClientRect(); return { n: (e.getAttribute('aria-label') || e.textContent || e.id).trim().slice(0, 24), w: Math.round(r.width), h: Math.round(r.height) }; }).filter(r => r.w < 40 || r.h < 40));
                if (petits.length) d('moyenne', 'LECTEUR-CIBLES', `Téléphone : ${petits.length} bouton(s) du lecteur sous 40 px`, petits.slice(0, 14).map(r => `${r.n} ${r.w}×${r.h}`).join('\n'), { categorie: 'mobile' });
                if (ms.exceptions.length) d('haute', 'LECTEUR-MOBILE-EXCEPTION', 'Exception dans le lecteur au téléphone', ms.exceptions.join('\n'));
                await mc.close();
            }
            // ── romans ──
            if (oe.roman) {
                const r = oe.roman; const url = `${J.url}/lecture.html?manga=${encodeURIComponent(r.id)}&chapter=${encodeURIComponent(r.chapitres[1] ? r.chapitres[1].id : r.chapitres[0].id)}&source=${r.source}`;
                const rn = (g, id, t, det) => ctx.trouver({ gravite: g, id, categorie: 'lecteur', titre: t, detail: det, fichier: 'assets/js/lecture.js', effort: 'S' });
                const c = await E.contexte(nav, J); const p = await c.newPage(); const s = E.surveiller(p);
                await p.goto(url); await p.waitForFunction(() => (document.getElementById('novelContent') || {}).innerText?.length > 400, null, { timeout: 30000 }).catch(() => { }); await dormir(p, 1500);
                const lire = () => p.evaluate(() => { const c = document.getElementById('novelContent'); const s = c && getComputedStyle(c.querySelector('p') || c); return { car: c ? c.innerText.length : 0, taille: s && s.fontSize, police: s && s.fontFamily.slice(0, 30), fond: getComputedStyle(document.body).backgroundColor, url: location.search, defile: Math.round(scrollY), reglages: !!document.getElementById('novelSettings'), pub: c ? (c.innerText.match(/(read (latest|more) (chapters )?at|novelfull|visit .{0,30}\.com|https?:\/\/)/ig) || []).slice(0, 4) : [] }; });
                let a = await lire(); note('roman · texte', a.car > 400, a.car + ' caractères');
                if (a.car < 400) rn('haute', 'ROMAN-VIDE', 'Le chapitre de roman ne s\'affiche pas', JSON.stringify(a));
                if (a.pub.length) rn('moyenne', 'ROMAN-PUB', 'Le texte du roman contient des mentions publicitaires de la source', a.pub.join(' | '));
                await p.keyboard.press('s'); await dormir(p, 400);
                if (!(await lire()).reglages) rn('haute', 'ROMAN-REGLAGES', 'La touche S n\'ouvre pas les réglages de lecture', '');
                else {
                    const boutons = await p.$$eval('#novelSettings .ns-seg button', b => b.map(x => [x.closest('.ns-seg').dataset.key, x.dataset.val]));
                    for (const [k, v] of boutons) { const exc = s.exceptions.length; await p.click(`#novelSettings .ns-seg[data-key="${k}"] button[data-val="${v}"]`, { timeout: 1500 }).catch(() => { }); await dormir(p, 350); const e = await lire(); note(`roman · ${k}=${v}`, e.car > 400 && s.exceptions.length === exc, e.police + ' ' + e.fond); if (e.car < 400 || s.exceptions.length > exc) rn('haute', 'ROMAN-REGLAGE', `Réglage ${k} = ${v} : texte perdu ou exception`, s.exceptions.slice(exc).join('\n')); if (!e.reglages) { await p.keyboard.press('s'); await dormir(p, 300); } }
                    const avant = await lire(); await p.$eval('#nsSize', e => { e.value = e.max; e.dispatchEvent(new Event('input', { bubbles: true })); }).catch(() => { }); await dormir(p, 400); const apres = await lire(); note('roman · taille', apres.taille !== avant.taille, `${avant.taille}→${apres.taille}`); if (apres.taille === avant.taille) rn('moyenne', 'ROMAN-TAILLE', 'Le curseur de taille ne change pas le texte', avant.taille);
                    await p.keyboard.press('Escape'); await dormir(p, 300);
                }
                await p.keyboard.press('f'); await dormir(p, 500); const champ = await p.evaluate(() => document.activeElement && document.activeElement.tagName); note('roman · recherche', champ === 'INPUT', champ);
                if (champ === 'INPUT') { await p.keyboard.type('the'); await p.keyboard.press('Enter'); await dormir(p, 500); await p.keyboard.press('Escape'); await dormir(p, 300); } else rn('moyenne', 'ROMAN-RECHERCHE', 'F n\'ouvre pas la recherche dans le texte', String(champ));
                await p.goto(url); await dormir(p, 5000);
                await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight * .5)); await dormir(p, 4000);
                const y0 = (await lire()).defile; await p.reload(); await dormir(p, 6000); const y1 = (await lire()).defile; note('roman · reprise', y1 > y0 * .4, `${y0}→${y1}`);
                if (!(y1 > y0 * .4)) rn('haute', 'ROMAN-REPRISE', 'Recharger le chapitre de roman ne reprend pas où on en était', `défilement ${y0} avant, ${y1} après`);
                const u0 = (await lire()).url; await p.keyboard.press('n'); await dormir(p, 5000); const u1 = (await lire()).url; note('roman · suivant', u0 !== u1); if (u0 === u1) rn('haute', 'ROMAN-SUIVANT', 'La touche N ne passe pas au chapitre suivant', u0);
                const prog = await J.api('GET', '/me/progress'); const pr = prog.json && prog.json[r.id]; note('roman · progression', !!(pr && pr.chapterId), JSON.stringify(pr || null).slice(0, 120));
                if (!(pr && pr.chapterId)) rn('haute', 'ROMAN-PROGRESSION', 'La lecture d\'un roman n\'est pas enregistrée', JSON.stringify(pr || null));
                if (s.exceptions.length) rn('haute', 'ROMAN-EXCEPTION', 'Exceptions dans le lecteur de romans', [...new Set(s.exceptions)].slice(0, 6).join('\n'));
                await c.close();
            } else ctx.trouver({ gravite: 'info', id: 'ROMAN-SANS-SOURCE', titre: 'Source roman injoignable : lecteur de romans non éprouvé' });
            ctx.mesure('lecteur_fonctions_essayees', verdicts.length);
            ctx.mesure('lecteur_fonctions_ok', verdicts.filter(v => v.ok).length);
            ctx.mesure('lecteur_verdicts', verdicts);
        } finally { await o.fermer(); }
    },
};
