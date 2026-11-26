// imports — les fichiers du lecteur : EPUB, CBZ et PDF fabriqués pour l'occasion, sains et
// piégés, envoyés puis réellement lus. Refus attendus, quota, isolement, suppression.
'use strict';
const path = require('path');
const E = require('./_explore');

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAADCAIAAAA2iEnWAAAAEklEQVR4nGN0cHBgYGBgYoADAA1EAKN0X0bSAAAAAElFTkSuQmCC', 'base64');
const pdfMinimal = () => {
    const objets = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 300] /Contents 4 0 R >>', '<< /Length 44 >>\nstream\n0.2 0.4 0.8 rg 20 20 160 260 re f\n0 0 0 rg\nendstream'];
    let s = '%PDF-1.4\n'; const pos = [];
    objets.forEach((o, i) => { pos.push(s.length); s += `${i + 1} 0 obj\n${o}\nendobj\n`; });
    const x = s.length; s += `xref\n0 ${objets.length + 1}\n0000000000 65535 f \n` + pos.map(p => String(p).padStart(10, '0') + ' 00000 n \n').join('') + `trailer\n<< /Size ${objets.length + 1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF\n`;
    return Buffer.from(s, 'latin1');
};

/** Chaque charge vit dans son chapitre : on sait laquelle a passé le nettoyage. */
const CHARGES = {
    'script': '<script>window.__xss.push("script")</script>',
    'attribut': '<p onclick="1" onmouseover="window.__xss.push(\'attribut\')">a</p><img src="x.png" onerror="window.__xss.push(\'attribut\')"/>',
    'cdata': '<p><![CDATA[x><img src="nul" onerror="window.__xss.push(\'cdata\')">]]></p>',
    'commentaire': '<!--><img src="nul" onerror="window.__xss.push(\'commentaire\')">-->',
    'instruction': '<?x ><img src="nul" onerror="window.__xss.push(\'instruction\')">?>',
    'svg-animate': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40" width="200" height="80"><a id="lien-anime"><animate attributeName="href" values="javascript:window.__xss.push(\'svg-animate\')"/><text x="2" y="20">ouvrir</text></a></svg>',
    'svg-lien': '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 100 40" width="200" height="80"><a xlink:href="javascript:window.__xss.push(\'svg-lien\')"><text x="2" y="20">ouvrir</text></a></svg>',
    'lien': '<p><a href="JaVaScRiPt:window.__xss.push(\'lien\')" id="lien">ouvrir</a></p>',
    'bouton': '<p><button formaction="javascript:window.__xss.push(\'bouton\')">ouvrir</button></p>',
    'pistage-style': '<p style="background-image:url(https://pistage.exemple.test/style.png);min-height:40px">style</p>',
    'pistage-media': '<video poster="https://pistage.exemple.test/affiche.png" src="https://pistage.exemple.test/v.mp4" controls="controls"></video><audio src="https://pistage.exemple.test/a.mp3" preload="auto"></audio><input type="image" src="https://pistage.exemple.test/i.png"/>',
    'pistage-lien': '<p><a href="https://pistage.exemple.test/clic" ping="https://pistage.exemple.test/ping">site</a></p>',
    // en dernier : elle fait quitter la page
    'rafraichir': '<meta http-equiv="refresh" content="0;url=https://piege.exemple.test/vol"/><p>redirection</p>',
};

module.exports = {
    nom: 'imports',
    description: 'EPUB, CBZ et PDF sains et piégés : injection à la lecture, pistage, refus, quota, isolement, reprise, suppression',
    async run(ctx) {
        const JSZip = require(ctx.abs('assets', 'vendor', 'jszip.min.js'));
        const o = await E.ouvrir(ctx, { base: 'inko_s_imp', port: 8140 });
        if (!o) return;
        const { J, nav } = o;
        const T = (gravite, id, titre, detail, correctif, extra = {}) => ctx.trouver({ gravite, id, categorie: 'fichiers importés', titre, detail, correctif, effort: 'S', ...extra });
        const verdicts = [];
        const essai = (nom, ok, info = '') => verdicts.push({ nom, ok, info: String(info).slice(0, 140) });
        const epub = async (chapitres, { titre = 'Livre d’essai', sansManifeste = false } = {}) => {
            const z = new JSZip();
            z.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
            z.file('META-INF/container.xml', '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/c.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
            const noms = chapitres.map((_, i) => `c${i}.xhtml`);
            if (!sansManifeste) z.file('OEBPS/c.opf', `<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${titre}</dc:title></metadata><manifest>${noms.map((n, i) => `<item id="c${i}" href="${n}" media-type="application/xhtml+xml"/>`).join('')}<item id="img" href="img.png" media-type="image/png"/></manifest><spine>${noms.map((_, i) => `<itemref idref="c${i}"/>`).join('')}</spine></package>`);
            chapitres.forEach((c, i) => z.file('OEBPS/' + noms[i], `<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>c</title></head><body><h1>Chapitre ${i + 1}</h1>${c}</body></html>`));
            z.file('OEBPS/img.png', PNG);
            return z.generateAsync({ type: 'nodebuffer' });
        };
        const cbz = async (fichiers) => { const z = new JSZip(); for (const [n, c] of fichiers) z.file(n, c); return z.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }); };
        const envoyer = async (nom, contenu, champs = {}, jeton = J.jeton) => {
            const f = new FormData(); f.append('file', new Blob([contenu]), nom); for (const [k, v] of Object.entries(champs)) f.append(k, v);
            const r = await fetch(J.url + '/api/library/import/local', { method: 'POST', headers: { authorization: 'Bearer ' + jeton }, body: f });
            return { statut: r.status, json: await r.json().catch(() => null) };
        };
        try {
            // ── refus attendus ──
            for (const [nom, contenu, quoi] of [['faux.cbz', Buffer.from('pas une archive'), 'texte renommé en .cbz'], ['faux.epub', Buffer.from('%PDF-1.4'), 'PDF renommé en .epub'], ['faux.pdf', await cbz([['a.png', PNG]]), 'archive renommée en .pdf'], ['a.cbr', Buffer.from('Rar!\x1a\x07\x00'), 'archive RAR'], ['a.html', Buffer.from('<script>1</script>'), 'page web'], ['a.svg', Buffer.from('<svg/>'), 'image vectorielle'], ['vide.cbz', Buffer.alloc(0), 'fichier vide']]) {
                const r = await envoyer(nom, contenu); essai('refus : ' + quoi, r.statut >= 400 && r.statut < 500, r.statut + ' ' + (r.json && r.json.error));
                if (r.statut < 300) T('moyenne', 'IMP-TYPE-ACCEPTE', `L'import accepte un fichier invalide : ${quoi}`, `${nom} → ${r.statut}`, 'Vérifier le contenu.', { fichier: 'server/controllers/local.controller.js' });
                if (r.statut >= 500) T('moyenne', 'IMP-5XX', `L'import répond ${r.statut} pour : ${quoi}`, JSON.stringify(r.json), 'Répondre 400 avec la raison.', { fichier: 'server/controllers/local.controller.js' });
            }
            const long = await envoyer('a'.repeat(180) + '.cbz', await cbz([['a.png', PNG]]), { title: '<img src=x onerror=window.__xss.push("titre")>' + 'T'.repeat(900), cover: 'https://pistage.exemple.test/c.png' });
            essai('titre très long et couverture distante', long.statut === 200 && !(long.json.cover), long.statut);
            if (long.json && long.json.cover) T('moyenne', 'IMP-COUVERTURE-DISTANTE', 'L\'import accepte une couverture distante', long.json.cover, 'Data-URI uniquement.');
            if (long.statut >= 500) T('moyenne', 'IMP-TITRE-LONG', 'Un titre très long fait échouer l\'import', JSON.stringify(long.json), 'Tronquer à la taille de la colonne.');
            const cb = await envoyer('volume.cbz', await cbz([['01.png', PNG], ['02.png', PNG], ['10.png', PNG], ['../../hors.png', PNG], ['notes.txt', 'x'], ['__MACOSX/._01.png', 'junk']]));
            const pd = await envoyer('doc.pdf', pdfMinimal());
            const sain = await envoyer('sain.epub', await epub(['<p>' + 'Un paragraphe de lecture. '.repeat(40) + '</p><img src="img.png" alt="i"/>', '<p>Deuxième.</p>']));
            const casse = await envoyer('casse.epub', await epub(['<p>x</p>'], { sansManifeste: true }));
            const mal = await envoyer('mal-forme.epub', await epub(['<p>Une balise <br> non fermée et un & seul</p>']));
            const vide = await envoyer('sans-image.cbz', await cbz([['lisez-moi.txt', 'rien']]));
            const gros = await envoyer('gonfle.cbz', await cbz([['01.png', Buffer.alloc(60 * 1024 * 1024)]]));
            const noms = Object.keys(CHARGES);
            const piege = await envoyer('piege.epub', await epub(Object.values(CHARGES), { titre: 'Piège' }));
            for (const [k, r] of Object.entries({ cbz: cb, pdf: pd, epub: sain, piege })) essai('envoi ' + k, r.statut === 200, r.statut);
            if (sain.statut !== 200 || piege.statut !== 200) { T('haute', 'IMP-ENVOI', 'Un EPUB valide ne s\'importe pas', JSON.stringify(sain.json), ''); return; }

            // ── lecture ──
            const externes = new Map(), urlsExternes = new Set();
            const c = await E.contexte(nav, J, { externes });
            await c.addInitScript(() => { window.__xss = []; });
            c.on('request', (q) => { if (/exemple\.test/.test(q.url())) urlsExternes.add(q.url()); });
            const ouvrir = async (id, type) => { const p = await c.newPage(); const s = E.surveiller(p); await p.goto(`${J.url}/localreader.html?id=${id}&type=${type}`, { waitUntil: 'load' }); await p.waitForTimeout(2500); return { p, s }; };
            const texte = (p) => p.evaluate(() => (document.querySelector('main') || document.body).innerText.replace(/\s+/g, ' ').slice(0, 200));
            for (const [nom, r, type, attendu] of [['EPUB sain', sain, 'epub', (x) => x.lettres > 200], ['CBZ', cb, 'cbz', (x) => x.images >= 3], ['PDF', pd, 'pdf', (x) => x.toiles >= 1], ['EPUB sans manifeste', casse, 'epub', (x) => /impossible|illisible|erreur/i.test(x.t)], ['EPUB mal formé', mal, 'epub', (x) => x.lettres > 20], ['CBZ sans image', vide, 'cbz', (x) => /aucune image/i.test(x.t)], ['CBZ gonflé (60 Mo décompressés)', gros, 'cbz', () => true]]) {
                if (r.statut !== 200) { essai(nom, true, 'refusé à l\'envoi'); continue; }
                const { p, s } = await ouvrir(r.json.id, type);
                const x = await p.evaluate(() => ({ t: (document.querySelector('main') || document.body).innerText.replace(/\s+/g, ' '), lettres: (document.getElementById('lrText') || {}).innerText?.length || 0, images: [...document.querySelectorAll('#lrImages img')].filter(i => i.naturalWidth > 0).length, toiles: document.querySelectorAll('canvas').length, brut: /parsererror|This page contains the following errors|error on line/i.test(document.body.innerText) }));
                essai(nom + ' lisible', attendu(x) && !s.exceptions.length, JSON.stringify({ ...x, t: x.t.slice(0, 60) }));
                if (!attendu(x)) T('moyenne', 'IMP-LECTURE', `${nom} : résultat inattendu à la lecture`, x.t.slice(0, 200), 'Afficher le contenu ou dire clairement pourquoi c\'est impossible.', { fichier: 'assets/js/localreader.js' });
                if (x.brut) T('moyenne', 'IMP-EPUB-MAL-FORME', `${nom} : l'erreur brute de l'analyseur XML est affichée au lecteur`, x.t.slice(0, 200), 'Repli sur l\'analyse HTML quand le XHTML est invalide.', { fichier: 'assets/js/localreader.js' });
                if (s.exceptions.length) T('moyenne', 'IMP-EXCEPTION', `${nom} : exception à la lecture`, s.exceptions.slice(0, 3).join('\n'), '', { fichier: 'assets/js/localreader.js' });
                if (nom === 'CBZ') {
                    const ordre = await p.evaluate(() => [...document.querySelectorAll('#lrImages img')].map(i => i.alt));
                    essai('CBZ : ordre naturel et fichiers parasites écartés', ordre.length <= 4, ordre.length + ' pages');
                    if (ordre.length > 4) T('basse', 'IMP-CBZ-PARASITES', `Le lecteur CBZ compte ${ordre.length} pages pour 3 planches (fichiers __MACOSX ou hors dossier)`, '', 'Écarter __MACOSX et les noms commençant par « ._ ».', { fichier: 'assets/js/localreader.js' });
                }
                if (nom === 'EPUB sain') {
                    await p.keyboard.press('ArrowRight'); await p.waitForTimeout(600); await p.reload(); await p.waitForTimeout(2200);
                    const apres = await texte(p); essai('EPUB : reprise au chapitre', /Deuxième/.test(apres), apres.slice(0, 80));
                    if (!/Deuxième/.test(apres)) T('moyenne', 'IMP-REPRISE', 'L\'EPUB ne reprend pas au dernier chapitre', apres, '', { fichier: 'assets/js/localreader.js' });
                    const prog = await J.api('GET', '/me/progress'); const suivi = JSON.stringify(prog.json || {}).includes(String(r.json.id));
                    if (!suivi) T('basse', 'IMP-PROGRESSION-LOCALE', 'La position dans un fichier importé n\'est pas enregistrée sur le compte', 'GET /api/me/progress ne mentionne pas le fichier. Le README annonce que la reprise suit le compte.', 'Vérifier le mécanisme annoncé ou corriger le texte.', { fichier: 'assets/js/localreader.js' });
                }
                await p.close();
            }
            // ── le livre piégé, chapitre par chapitre ──
            const { p, s } = await ouvrir(piege.json.id, 'epub');
            const executes = new Set();
            for (let i = 0; i < noms.length; i++) {
                const sel = await p.$('#lrChapters'); if (!sel) break;
                await p.selectOption('#lrChapters', String(i)).catch(() => { }); await p.waitForTimeout(700);
                for (const h of await p.$$('#lrText a, #lrText button, #lrText svg text')) { await h.hover({ timeout: 400 }).catch(() => { }); await h.click({ timeout: 600 }).catch(() => { }); await p.waitForTimeout(250); }
                await p.waitForTimeout(300);
                for (const x of await p.evaluate(() => window.__xss || []).catch(() => [])) executes.add(x);
                if (!/localreader\.html/.test(p.url())) { executes.add('__quitte:' + noms[i]); await p.goto(`${J.url}/localreader.html?id=${piege.json.id}&type=epub`); await p.waitForTimeout(2000); }
            }
            await p.waitForTimeout(800);
            for (const n of noms.filter(n => !n.startsWith('pistage') && n !== 'rafraichir')) essai('livre piégé : ' + n + ' neutralisé', !executes.has(n));
            const passes = [...executes].filter(x => !x.startsWith('__'));
            if (passes.length) T('critique', 'IMP-EPUB-INJECTION', `Un livre EPUB piégé exécute du code dans l'application (${passes.length} technique(s) : ${passes.join(', ')})`, 'Chapitres piégés ouverts dans localreader.html ; chaque technique citée a exécuté du JavaScript avec la session ouverte.\nCause : sanitizeChapter analyse le chapitre en XML puis réinjecte le résultat avec innerHTML (analyseur HTML) : les sections CDATA, commentaires et instructions changent de sens entre les deux, et la liste de balises retirées est incomplète.', 'Assainir avec une liste blanche de balises et d\'attributs, en reconstruisant des nœuds (ou une bibliothèque éprouvée comme DOMPurify), puis afficher dans un cadre isolé sans script.', { fichier: 'assets/js/localreader.js', effort: 'M' });
            const quitte = [...executes].filter(x => x.startsWith('__quitte'));
            if (quitte.length) T('haute', 'IMP-EPUB-REDIRECTION', 'Un livre peut emmener le lecteur vers une autre adresse', quitte.map(x => x.slice(9)).join(', '), 'Retirer meta, neutraliser les liens externes.', { fichier: 'assets/js/localreader.js' });
            const sortants = [...urlsExternes].filter(u => !/\/(vol|clic)$/.test(u));
            essai('livre piégé : aucune requête vers l\'extérieur', !sortants.length, sortants.join(' '));
            if (sortants.length) T('moyenne', 'IMP-EPUB-PISTAGE', `Ouvrir un livre contacte des serveurs extérieurs (${sortants.length} adresse(s))`, sortants.slice(0, 10).join('\n') + '\n\nL\'auteur du fichier apprend quand et d\'où il est lu.', 'Ne garder que les ressources contenues dans le livre ; retirer style, media et attributs ping.', { fichier: 'assets/js/localreader.js' });
            const titre = await p.evaluate(() => (window.__xss || []).includes('titre'));
            await p.close();
            const q = await c.newPage(); await q.goto(`${J.url}/import.html`); await q.waitForTimeout(2500);
            const t2 = await q.evaluate(() => (window.__xss || []));
            if (titre || t2.includes('titre')) T('critique', 'IMP-TITRE-INJECTION', 'Le titre d\'un fichier importé est exécuté', '', 'Échapper.', { fichier: 'assets/js/import.js' });
            essai('titre hostile échappé', !titre && !t2.includes('titre'));
            await q.close(); await c.close();

            // ── isolement, quota, suppression ──
            const reg = await J.api('POST', '/auth/register', { username: 'Autre', email: 'autre@exemple.test', password: 'Zq7!' + Math.random().toString(36).slice(2, 12) });
            const k = reg.json && reg.json.token;
            if (k) {
                const lire = await fetch(`${J.url}/api/library/local/${sain.json.id}/file`, { headers: { authorization: 'Bearer ' + k } });
                const sup = await fetch(`${J.url}/api/library/local/${sain.json.id}`, { method: 'DELETE', headers: { authorization: 'Bearer ' + k } });
                essai('un autre compte ne lit ni ne supprime mon fichier', lire.status === 404 && sup.status === 404, `${lire.status}/${sup.status}`);
                if (lire.status === 200 || sup.status < 300) T('critique', 'IMP-IDOR', 'Un autre compte accède à un fichier importé', `${lire.status}/${sup.status}`, 'Filtrer par propriétaire.');
            }
            const suppr = await J.api('DELETE', '/library/local/' + cb.json.id);
            const apres = await fetch(`${J.url}/api/library/local/${cb.json.id}/file`, { headers: { authorization: 'Bearer ' + J.jeton } });
            essai('suppression', suppr.statut === 200 && apres.status === 404, `${suppr.statut}/${apres.status}`);
            const [moi] = await J.sql('SELECT id FROM users ORDER BY id LIMIT 1');
            await J.sql("INSERT INTO local_imports (user_id, title, type, filename, size) VALUES (?, 'plein', 'cbz', 'x', ?)", [moi.id, 3000 * 1024 * 1024]);
            const plein = await envoyer('de-trop.cbz', await cbz([['a.png', PNG]]));
            essai('quota respecté', plein.statut === 413, plein.statut);
            if (plein.statut !== 413) T('moyenne', 'IMP-QUOTA', 'Le quota de stockage n\'est pas appliqué', String(plein.statut), '', { fichier: 'server/controllers/local.controller.js' });
            const sauvegarde = ctx.lire(ctx.abs('server', 'lib', 'backup.js'));
            if (!/local_imports|uploads/.test(sauvegarde)) T('haute', 'IMP-HORS-SAUVEGARDE', 'Les fichiers importés ne sont dans aucune sauvegarde', 'server/lib/backup.js ne mentionne ni la table local_imports ni le dossier uploads, et l\'export de compte non plus.', 'Archive séparée des fichiers, ou le dire clairement dans l\'interface.', { fichier: 'server/lib/backup.js', effort: 'M' });
            ctx.mesure('imports_essais', verdicts.length);
            ctx.mesure('imports_essais_tenus', verdicts.filter(v => v.ok).length);
            ctx.mesure('imports_verdicts', verdicts);
        } finally { await o.fermer(); }
    },
};
