// exactitude — les chiffres et les listes disent-ils vrai ? Données posées à des dates
// connues, puis comparées à ce que rendent l'API et les écrans ; exports relus case par case.
'use strict';
const E = require('./_explore');

const jour = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
/** Lecteur CSV minimal (séparateur ;, guillemets doublés). */
const lireCsv = (t) => { const l = [[]]; let c = '', q = false; for (let i = 0; i < t.length; i++) { const x = t[i]; if (q) { if (x === '"') { if (t[i + 1] === '"') { c += '"'; i++; } else q = false; } else c += x; } else if (x === '"') q = true; else if (x === ';') { l[l.length - 1].push(c); c = ''; } else if (x === '\n' || (x === '\r' && t[i + 1] === '\n')) { if (x === '\r') i++; l[l.length - 1].push(c); c = ''; l.push([]); } else c += x; } l[l.length - 1].push(c); return l.filter(r => r.length > 1); };

module.exports = {
    nom: 'exactitude',
    description: 'Statistiques, séries de jours, fuseaux, listes intelligentes, compteurs affichés, exports CSV et Markdown',
    async run(ctx) {
        const o = await E.ouvrir(ctx, { base: 'inko_s_exact', port: 8147 });
        if (!o) return;
        const { J, nav } = o;
        const T = (gravite, id, titre, detail, correctif, extra = {}) => ctx.trouver({ gravite, id, categorie: 'exactitude', titre, detail, correctif, effort: 'S', fichier: 'server/controllers/user.controller.js', ...extra });
        const verdicts = [];
        const verifier = (nom, attendu, obtenu, g = 'moyenne', id = 'EX-CHIFFRE', detail = '') => { const ok = JSON.stringify(attendu) === JSON.stringify(obtenu); verdicts.push({ nom, ok, attendu, obtenu }); if (!ok) T(g, id, `${nom} : ${JSON.stringify(obtenu).slice(0, 60)} au lieu de ${JSON.stringify(attendu).slice(0, 60)}`, detail, 'Corriger le calcul et garder ce cas en test.'); };
        try {
            const [u] = await J.sql('SELECT id FROM users ORDER BY id LIMIT 1'); const uid = u.id;
            const titres = ['=HYPERLINK("http://piege.exemple.test","clic")', '+33 1 23 45 67 89', '-2+3*cmd', '@SUM(A1:A9)', 'Point; virgule "guillemets"', 'Ligne\ncoupée', 'Éléphant à l’Œil 漫画 😀', 'Ordinaire'];
            for (let i = 0; i < titres.length; i++) await J.api('POST', '/me/favorites', { mangaId: 'ex-' + i, source: i % 2 ? 'mangadex' : 'weebcentral', title: titres[i] });
            // lectures à des instants connus (heure de Paris), dont une à 0 h 30 et une à 23 h 30
            const base = new Date(); base.setUTCHours(11, 0, 0, 0);
            const instants = [];
            const le = (nbJours, h, m) => { const d = new Date(base.getTime() - nbJours * 86400000); const [a, mo, j] = jour(d).split('-').map(Number); const essai = new Date(Date.UTC(a, mo - 1, j, h, m)); const decal = +new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', hourCycle: 'h23' }).format(essai) - essai.getUTCHours(); return new Date(essai.getTime() - ((decal + 24) % 24) * 3600000); };
            instants.push(le(1, 0, 30), le(2, 23, 30), le(3, 12, 0), le(4, 12, 0), le(4, 13, 0), le(10, 9, 0), le(11, 9, 0), le(12, 9, 0), le(13, 9, 0), le(14, 9, 0), le(15, 9, 0), le(40, 9, 0), le(400, 9, 0));
            let n = 0;
            for (const d of instants) await J.sql('INSERT INTO read_chapters (user_id, manga_id, chapter_id, chapter_number, read_at) VALUES (?, ?, ?, ?, FROM_UNIXTIME(?))', [uid, 'ex-' + (n % 3), 'x' + (++n), n, Math.floor(d.getTime() / 1000)]);
            const s = (await J.api('GET', '/me/stats')).json || {};
            verifier('nombre de favoris', titres.length, s.totals && Number(s.totals.favorites));
            verifier('chapitres lus au total', instants.length, s.totals && Number(s.totals.chapters_read));
            verifier('chapitres des 30 derniers jours', instants.filter(d => Date.now() - d < 30 * 86400000).length, s.totals && Number(s.totals.chapters_this_month));
            verifier('séries lues', 3, s.totals && Number(s.totals.series_read));
            const cles = {}; for (const d of instants.filter(d => Date.now() - d < 365 * 86400000)) cles[jour(d)] = (cles[jour(d)] || 0) + 1;
            const trie = (o) => Object.fromEntries(Object.entries(o || {}).sort());
            verifier('carte de chaleur (jours à l’heure de Paris)', trie(cles), trie(s.heatmap), 'haute', 'EX-FUSEAU', 'Une lecture à 0 h 30 ou 23 h 30 doit compter le bon jour, quel que soit le fuseau de la base.');
            verifier('série de jours en cours', 4, s.streak && s.streak.current);
            verifier('plus longue série', 6, s.streak && s.streak.longest);
            // temps de lecture
            await J.api('POST', '/me/temps-lecture', { secondes: 90 }); await J.api('POST', '/me/temps-lecture', { secondes: 999999 }); await J.api('POST', '/me/temps-lecture', { secondes: -5 });
            const [tl] = await J.sql('SELECT SUM(seconds) AS s FROM reading_time WHERE user_id = ?', [uid]);
            verifier('temps de lecture (tranches bornées à une heure)', 90 + 3600, Number(tl.s));
            // listes intelligentes
            await J.api('PUT', '/me/library/ex-0', { status: 'completed' }); await J.api('PUT', '/me/library/ex-1', { status: 'reading' });
            await J.api('PUT', '/me/favorites/ex-2/category', { category: 'Pépites' });
            await J.api('PUT', '/ratings/ex-0', { rating: 9 }); await J.api('PUT', '/ratings/ex-1', { rating: 4 }); await J.api('PUT', '/ratings/ex-2', { rating: 2 });
            const creer = async (nom, rules) => { await J.api('POST', '/me/lists', { name: nom, rules }); const l = (await J.api('GET', '/me/lists')).json || []; return l.find(x => x.name === nom); };
            const ids = (l) => ((l && l.mangaIds) || []).slice().sort();
            verifier('liste « terminées »', ['ex-0'], ids(await creer('R1', { status: ['completed'] })));
            verifier('liste « catégorie Pépites »', ['ex-2'], ids(await creer('R2', { category: 'Pépites' })));
            verifier('liste « source mangadex »', ['ex-1', 'ex-3', 'ex-5', 'ex-7'], ids(await creer('R3', { source: 'mangadex' })));
            // la règle parle en étoiles (1 à 5), les notes sont sur 10
            verifier('liste « au moins 3 étoiles »', ['ex-0'], ids(await creer('R4', { minRating: 3 })));
            verifier('liste « au moins 2 étoiles »', ['ex-0', 'ex-1'], ids(await creer('R5', { minRating: 2 })));
            const vide = await J.api('POST', '/me/lists', { name: 'R6', rules: { inconnu: 1 } });
            if (vide.statut === 200 && vide.json && vide.json.smart === false) T('basse', 'EX-REGLE-IGNOREE', 'Une règle inconnue crée en silence une liste ordinaire vide', 'POST /me/lists { rules: { inconnu: 1 } } → 200, smart: false.', 'Répondre 400 en disant quelle règle n\'est pas comprise.');
            // exports
            const hist = await fetch(J.url + '/api/me/history/export?format=csv', { headers: { authorization: 'Bearer ' + J.jeton } });
            const texte = (await hist.text()).replace(/^﻿/, ''); const lignes = lireCsv(texte);
            verifier('export historique : une ligne par lecture', instants.length, lignes.length - 1, 'moyenne', 'EX-EXPORT');
            const formules = lignes.slice(1).map(l => l[0]).filter(x => /^[=+\-@\t\r]/.test(x || ''));
            const c = await E.contexte(nav, J); const p = await c.newPage();
            await p.goto(J.url + '/bibliotheque.html'); await p.waitForTimeout(3500);
            const recevoir = async (declencher) => { const attente = p.waitForEvent('download', { timeout: 8000 }); await declencher(); const dl = await attente; const chemin = await dl.path(); return require('fs').readFileSync(chemin, 'utf8').replace(/^﻿/, ''); };
            try {
                const csv = await recevoir(async () => { await p.click('#btnLibMore'); await p.click('#btnLibExportCsv'); });
                const l = lireCsv(csv);
                verifier('export bibliothèque : une ligne par série', titres.length, l.length - 1, 'moyenne', 'EX-EXPORT');
                const exacts = titres.every(t => l.some(r => r[0] === t));
                verifier('export bibliothèque : titres restitués à l’identique', true, exacts, 'moyenne', 'EX-EXPORT');
                formules.push(...l.slice(1).map(r => r[0]).filter(x => /^[=+\-@\t\r]/.test(x || '')));
            } catch (e) { T('moyenne', 'EX-EXPORT-ECHEC', 'L\'export CSV de la bibliothèque n\'aboutit pas', e.message.split('\n')[0], '', { fichier: 'assets/js/bibliotheque.js' }); }
            if (formules.length) T('haute', 'EX-CSV-FORMULE', 'Les exports CSV laissent des titres s\'exécuter comme des formules dans un tableur', `Cellules commençant par = + - @ : ${[...new Set(formules)].slice(0, 5).join(' · ')}\nUn titre venu d'une source ou d'un fichier importé devient une formule à l'ouverture dans Excel (les guillemets ne protègent pas).`, 'Préfixer ces cellules d\'une apostrophe dans les deux exports.', { fichier: 'assets/js/bibliotheque.js' });
            await J.api('POST', '/me/notes', { mangaId: 'ex-4', mangaTitle: titres[4], body: '# titre\n<script>x</script> | tableau |' });
            await p.goto(J.url + '/notes.html'); await p.waitForTimeout(2500);
            try { const md = await recevoir(async () => { await p.click('#jrExportMd'); }); verifier('export du carnet : la note est dans le fichier', true, md.includes('tableau'), 'moyenne', 'EX-EXPORT'); } catch (e) { T('basse', 'EX-EXPORT-ECHEC', 'L\'export du carnet n\'aboutit pas', e.message.split('\n')[0], '', { fichier: 'assets/js/notes.js' }); }
            // ce que montrent les écrans
            const nombres = async (url) => { await p.goto(J.url + '/' + url); await p.waitForTimeout(3500); return p.evaluate(() => (document.querySelector('main') || document.body).innerText.replace(/[  ]/g, ' ')); };
            const accueil = await nombres('accueil.html'), profil = await nombres('profil.html'), stats = await nombres('stats.html');
            const present = (t, re) => { const m = re.exec(t); return m ? Number(m[1].replace(/\s/g, '')) : null; };
            verifier('accueil : séries suivies', titres.length, present(accueil, /(\d[\d ]*)\s*s[ée]ries? suivies?/i), 'moyenne', 'EX-ECRAN');
            verifier('accueil : chapitres lus', instants.length, present(accueil, /(\d[\d ]*)\s*chapitres? lus?/i), 'moyenne', 'EX-ECRAN');
            verifier('accueil : jours d’affilée', 4, present(accueil, /(\d+)\s*jours? d.affil/i), 'moyenne', 'EX-ECRAN');
            ctx.mesure('exactitude_extraits', { accueil: accueil.slice(0, 220), profil: profil.slice(0, 400), stats: stats.slice(0, 400) });
            await c.close();
            ctx.mesure('exactitude_verifications', verdicts.length);
            ctx.mesure('exactitude_justes', verdicts.filter(v => v.ok).length);
            ctx.mesure('exactitude_verdicts', verdicts);
        } finally { await o.fermer(); }
    },
};
