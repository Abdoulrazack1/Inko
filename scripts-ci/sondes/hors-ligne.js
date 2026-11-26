// hors-ligne — la promesse « lire sans réseau » : installation et cache de l'application,
// chaque page rouverte sans réseau, un chapitre réellement téléchargé puis relu coupé,
// les gestes faits hors ligne et leur arrivée au retour.
'use strict';
const E = require('./_explore');

module.exports = {
    nom: 'hors-ligne',
    description: 'Service worker, pages rouvertes sans réseau, chapitre téléchargé relu coupé, écritures hors ligne puis rejouées, installabilité',
    async run(ctx) {
        const o = await E.ouvrir(ctx, { base: 'inko_s_hl', port: 8143 });
        if (!o) return;
        const { J, nav } = o;
        const T = (gravite, id, titre, detail, correctif, extra = {}) => ctx.trouver({ gravite, id, categorie: 'hors-ligne', titre, detail, correctif, effort: 'M', ...extra });
        const releves = {};
        try {
            const d = await E.semer(J, { favoris: 8 });
            const oe = await E.oeuvresReelles(J);
            const m = oe.manga, r = oe.roman;
            if (m) await J.api('POST', '/me/favorites', { mangaId: m.id, source: m.source, title: m.titre });
            const c = await nav.newContext({ viewport: { width: 1366, height: 800 }, serviceWorkers: 'allow', locale: 'fr-FR' });
            await c.addInitScript(() => { try { for (const k of ['mh_eula_v2', 'inko_consent', 'inko_tour_done', 'mh_install_dismissed']) localStorage.setItem(k, '1'); localStorage.setItem('inko_lib_lastcheck', String(Date.now())); } catch (e) { /* stockage */ } });
            // les planches viennent du site source, comme dans l'usage réel : lecture seule autorisée
            await c.route('**/*', (q) => { const r = q.request(); return r.url().startsWith(J.url) || /^(data|blob):/.test(r.url()) || (r.method() === 'GET' && ['image', 'fetch', 'xhr'].includes(r.resourceType())) ? q.continue() : q.abort(); });
            const p = await c.newPage(); const s = E.surveiller(p);
            await p.goto(J.url + '/accueil.html', { waitUntil: 'load' });
            const sw = await p.evaluate(async () => { if (!('serviceWorker' in navigator)) return { absent: true }; const attente = new Promise((ok) => setTimeout(() => ok(null), 20000)); const reg = await Promise.race([navigator.serviceWorker.ready, attente]); await new Promise(r => setTimeout(r, 2500)); const noms = await caches.keys(); let n = 0; const urls = []; for (const k of noms) { const l = await (await caches.open(k)).keys(); n += l.length; urls.push(...l.map(x => new URL(x.url).pathname)); } return { pret: !!reg, noms, n, urls }; });
            releves.serviceWorker = { pret: sw.pret, caches: sw.noms, fichiers: sw.n };
            if (!sw.pret) T('haute', 'HL-SANS-SW', 'Le service worker ne s\'installe pas', JSON.stringify(sw), '');
            const attendus = (ctx.lire(ctx.abs('service-worker.js')).match(/const STATIC_ASSETS = \[([\s\S]*?)\];/) || [, ''])[1].match(/'([^']+)'/g) || [];
            const manquants = attendus.map(x => x.slice(1, -1)).filter(x => !(sw.urls || []).includes(x.split('?')[0]));
            releves.precache = { attendus: attendus.length, manquants: manquants.length };
            if (manquants.length) T('moyenne', 'HL-PRECACHE-INCOMPLET', `${manquants.length} fichier(s) du pré-cache ne sont pas en cache après l'installation`, manquants.slice(0, 15).join('\n'), 'Vérifier cache.addAll et les chemins.', { fichier: 'service-worker.js' });
            // installabilité
            try { const cdp = await c.newCDPSession(p); const i = await cdp.send('Page.getInstallabilityErrors'); releves.installabilite = (i.installabilityErrors || []).map(x => x.errorId); const vraies = releves.installabilite.filter(x => !/in-incognito/.test(x)); if (vraies.length) T('basse', 'HL-INSTALLABILITE', `Le navigateur refuse ou limite l'installation : ${vraies.join(', ')}`, '', 'Corriger le manifeste.', { fichier: 'manifest.webmanifest', effort: 'S' }); } catch (e) { releves.installabilite = 'non mesurable'; }
            // visiter en ligne, télécharger un chapitre et un roman
            for (const u of ['bibliotheque.html', 'catalogue.html', 'parametres.html', 'notes.html', 'stats.html', 'downloads.html']) { await p.goto(`${J.url}/${u}`, { waitUntil: 'load' }).catch(() => { }); await p.waitForTimeout(1500); }
            const telecharger = async (url, selecteurPret) => { await p.goto(url, { waitUntil: 'load' }); await p.waitForSelector(selecteurPret, { timeout: 30000 }); await p.waitForTimeout(2500); await p.click('#btnDownload', { timeout: 4000 }).catch(() => p.click('[title*="hors-ligne"]', { timeout: 4000 })); await p.waitForFunction(() => { const b = document.getElementById('btnDownload'); return b && (/22c55e/.test(b.innerHTML) || /Téléchargé/.test(b.title)); }, null, { timeout: 120000 }); await p.waitForTimeout(500); const titre = await p.evaluate(() => document.getElementById('btnDownload').title); if (!/Téléchargé/.test(titre)) T('haute', 'HL-BOUTON-MENT', 'Après un téléchargement réussi, le bouton propose encore « Télécharger » — et le toucher efface le chapitre', `Icône « réussi » affichée, infobulle et nom accessible : « ${titre} ». Un appui supprime alors le téléchargement, sans confirmation ni annulation.\nCause : chapitre.js, le bloc finally remet l'ancien titre après setDlIcon(true).`, 'Ne remettre le titre initial qu\'en cas d\'échec ; demander confirmation ou proposer « Annuler » à la suppression.', { fichier: 'assets/js/chapitre.js', effort: 'S' }); };
            let urlChap = null, urlRoman = null;
            if (m) { const ch = m.chapitres[m.chapitres.length - 1]; urlChap = `${J.url}/chapitre.html?manga=${encodeURIComponent(m.id)}&chapter=${encodeURIComponent(ch.id)}&source=${m.source}`; try { const t0 = Date.now(); await telecharger(urlChap, '.reader-page-img'); releves.telechargementChapitreMs = Date.now() - t0; } catch (e) { const etatBouton = await p.evaluate(() => [...document.querySelectorAll('#btnDownload,[class*=toast]')].map(x => (x.title || '') + ' ' + x.textContent.trim()).join(' | ')).catch(() => ''); T('haute', 'HL-TELECHARGEMENT', 'Le téléchargement d\'un chapitre n\'aboutit pas en deux minutes', e.message.split('\n')[0].slice(0, 120) + '\nÉtat à l\'écran : ' + etatBouton.slice(0, 200), '', { fichier: 'assets/js/downloads.js' }); urlChap = null; } }
            if (r) { urlRoman = `${J.url}/lecture.html?manga=${encodeURIComponent(r.id)}&chapter=${encodeURIComponent(r.chapitres[0].id)}&source=${r.source}`; try { await p.goto(urlRoman); await p.waitForFunction(() => (document.getElementById('novelContent') || {}).innerText?.length > 400, null, { timeout: 30000 }); const h = await p.$('#btnDownload, [title*="hors-ligne"]'); if (h) { await h.click(); await p.waitForTimeout(4000); } else urlRoman = null; } catch (e) { urlRoman = null; } }
            await p.goto(`${J.url}/accueil.html`); await p.waitForTimeout(2500);
            // ── réseau coupé ──
            await c.setOffline(true);
            const pages = {};
            const liste = E.adresses(ctx, { ...d, ...oe }).filter(([f]) => !/index|chapitre|lecture/.test(f));
            if (urlChap) liste.push(['chapitre.html (téléchargé)', urlChap.slice(J.url.length + 1)]);
            if (urlRoman) liste.push(['lecture.html (téléchargé)', urlRoman.slice(J.url.length + 1)]);
            for (const [f, u] of liste) {
                const q = await c.newPage(); const qs = E.surveiller(q);
                try {
                    await q.goto(`${J.url}/${u}`, { waitUntil: 'load', timeout: 15000 }); await q.waitForTimeout(3500);
                    const x = await q.evaluate(() => ({ repli: !!document.querySelector('.offline-page, [data-offline-page]') || /offline\.html/.test(location.pathname) || /Tu es hors ligne|Vous êtes hors ligne/i.test(document.title + document.body.innerText.slice(0, 300)), texte: (document.querySelector('main') || document.body).innerText.replace(/\s+/g, ' ').trim(), dit: /hors[- ]ligne|connexion|réseau|injoignable|miroir|sans réseau/i.test(document.body.innerText), images: [...document.querySelectorAll('.reader-page-img')].filter(i => i.naturalWidth > 0).length, styles: document.styleSheets.length, attente: [...document.querySelectorAll('[class*=spinner],[class*=squelette],[class*=skeleton]')].filter(e => e.getClientRects().length && getComputedStyle(e).display !== 'none').length }));
                    pages[f] = { repli: x.repli, longueur: x.texte.length, ditHorsLigne: x.dit, images: x.images, attente: x.attente, exceptions: qs.exceptions.length };
                    if (/téléchargé/.test(f)) {
                        const ok = /chapitre/.test(f) ? x.images > 0 : x.texte.length > 400;
                        if (!ok) T('critique', 'HL-LECTURE-IMPOSSIBLE', `Un chapitre téléchargé ne se relit pas sans réseau (${f.split(' ')[0]})`, `${x.images} planche(s) affichée(s). ${x.texte.slice(0, 200)}${qs.exceptions.length ? '\n' + qs.exceptions.slice(0, 3).join('\n') : ''}`, 'Servir fiche, liste des pages et images depuis le cache hors ligne.', { fichier: /chapitre/.test(f) ? 'assets/js/chapitre.js' : 'assets/js/lecture.js' });
                    } else {
                        if (!x.styles) T('haute', 'HL-PAGE-NUE', `${f} : sans réseau, la page s'ouvre sans style`, x.texte.slice(0, 150), 'Pré-cache complet.', { fichier: f });
                        if (!x.dit && !x.repli) T('moyenne', 'HL-SILENCE', `${f} : rien ne dit qu'on est hors ligne`, x.texte.slice(0, 160), 'Bandeau « hors ligne » commun à toutes les pages.', { fichier: f, effort: 'S' });
                        if (x.attente) T('moyenne', 'HL-ATTENTE', `${f} : sans réseau, un chargement tourne encore après 3,5 s`, `${x.attente} indicateur(s).`, 'État hors ligne à la place du squelette.', { fichier: f, effort: 'S' });
                        if (x.texte.length < 25) T('haute', 'HL-PAGE-VIDE', `${f} : page vide sans réseau`, '', '', { fichier: f });
                    }
                    if (qs.exceptions.length) T('moyenne', 'HL-EXCEPTION', `${f} : exception sans réseau`, [...new Set(qs.exceptions)].slice(0, 3).join('\n'), '', { fichier: f.split(' ')[0], effort: 'S' });
                } catch (e) { pages[f] = { echec: e.message.split('\n')[0].slice(0, 100) }; T('haute', 'HL-PAGE-INACCESSIBLE', `${f} : impossible à ouvrir sans réseau`, e.message.split('\n')[0].slice(0, 200), 'La mettre en cache à la visite.', { fichier: f.split(' ')[0] }); }
                await q.close();
            }
            releves.pagesSansReseau = pages;
            // ── gestes faits hors ligne ──
            const q = await c.newPage(); await q.goto(`${J.url}/accueil.html`).catch(() => { }); await q.waitForTimeout(2000);
            const gestes = await q.evaluate(async () => {
                const essayer = async (nom, f) => { try { await f(); return [nom, 'accepté']; } catch (e) { return [nom, 'refusé : ' + e.message.slice(0, 60)]; } };
                const A = window.API; if (!A) return [['api', 'absente']];
                return [
                    await essayer('progression', () => A.me.setProgress ? A.me.setProgress('hl-1', { chapterId: 'c9', chapter: 9, page: 3, source: 'mangadex' }) : A.me.saveProgress('hl-1', { chapterId: 'c9', chapter: 9, page: 3, source: 'mangadex' })),
                    await essayer('chapitre lu', () => A.me.markChapter({ mangaId: 'hl-1', chapterId: 'c9', chapter: 9 })),
                    await essayer('favori', () => A.me.addFavorite('hl-fav', { title: 'Ajouté hors ligne', source: 'mangadex' })),
                    await essayer('note', () => A.notes ? A.notes.create({ mangaId: 'hl-1', body: 'hors ligne' }) : A.me.addNote({ mangaId: 'hl-1', body: 'hors ligne' })),
                    await essayer('signet', () => A.me.addBookmark({ mangaId: 'hl-1', chapterId: 'c9', source: 'mangadex', page: 3 })),
                ];
            });
            const file = await q.evaluate(() => { try { return JSON.parse(localStorage.getItem('inko_offline_queue_v1') || '[]').map(e => e.method + ' ' + e.path); } catch (e) { return []; } });
            await c.setOffline(false); await q.waitForTimeout(500); await q.evaluate(() => window.dispatchEvent(new Event('online'))); await q.waitForTimeout(8000);
            const etat = {
                progression: !!((await J.api('GET', '/me/progress')).json || {})['hl-1'],
                'chapitre lu': JSON.stringify((await J.api('GET', '/me/read-chapters')).json || '').includes('c9'),
                favori: JSON.stringify((await J.api('GET', '/me/favorites')).json || '').includes('hl-fav'),
                note: JSON.stringify((await J.api('GET', '/me/notes')).json || '').includes('hors ligne'),
                signet: JSON.stringify((await J.api('GET', '/me/bookmarks')).json || '').includes('hl-1'),
            };
            releves.gestes = { essais: Object.fromEntries(gestes), file, arrives: etat };
            const perdus = Object.entries(etat).filter(([k, v]) => !v).map(([k]) => k);
            if (perdus.length) T(perdus.some(x => /progression|chapitre/.test(x)) ? 'critique' : 'haute', 'HL-GESTES-PERDUS', `Gestes faits sans réseau et perdus au retour : ${perdus.join(', ')}`, gestes.map(([n, v]) => `${n} : ${v}${etat[n] ? ' → arrivé' : ' → perdu'}`).join('\n') + `\nFile d'attente : ${file.join(', ') || 'vide'}\n\nSeules la progression et les chapitres lus sont mis en file (api.js, OFFLINE_OK).`, 'Mettre en file toutes les écritures de lecture (favoris, signets, notes), ou dire clairement qu\'elles sont impossibles.', { fichier: 'assets/js/api.js' });
            if (s.exceptions.length) T('moyenne', 'HL-EXCEPTION-EN-LIGNE', 'Exceptions pendant l\'installation et le téléchargement', [...new Set(s.exceptions)].slice(0, 4).join('\n'), '', { effort: 'S' });
            await q.close(); await c.close();
            const code = ctx.lire(ctx.abs('assets', 'js', 'pwa.js')) + ctx.lire(ctx.abs('assets', 'js', 'global.js'));
            if (!/updatefound|controllerchange/.test(code)) T('moyenne', 'HL-MAJ-SILENCIEUSE', 'Aucune invitation à recharger quand une nouvelle version de l\'application est installée', 'Ni updatefound ni controllerchange dans pwa.js et global.js ; le service worker prend la main immédiatement (skipWaiting).', '« Nouvelle version prête — Recharger ».', { fichier: 'assets/js/pwa.js', effort: 'S' });
            ctx.mesure('hors_ligne_releves', releves);
        } finally { await o.fermer(); }
    },
};
