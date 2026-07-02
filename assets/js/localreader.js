// localreader.js — Lecteur de fichiers locaux importés (CBZ/CBR images, EPUB texte)
// Décompresse côté client avec JSZip ; aucun contenu ne transite ailleurs.
(function () {
    'use strict';

    const params = new URLSearchParams(location.search);
    const id   = params.get('id');
    const type = (params.get('type') || '').toLowerCase();
    const body = document.getElementById('lrBody');
    const titleEl = document.getElementById('lrTitle');

    const IMG_RE = /\.(jpe?g|png|webp|gif|avif|bmp)$/i;
    const blobUrls = [];
    const mkUrl = (blob) => { const u = URL.createObjectURL(blob); blobUrls.push(u); return u; };
    window.addEventListener('beforeunload', () => blobUrls.forEach(u => URL.revokeObjectURL(u)));

    document.addEventListener('DOMContentLoaded', init);

    async function init() {
        if (!window.API?.isLoggedIn?.()) { location.href = 'page_login.html'; return; }
        if (!id) { fail('Aucun fichier indiqué.'); return; }
        try {
            const res = await fetch(API.local.fileUrl(id), { headers: { Authorization: 'Bearer ' + API.token } });
            if (!res.ok) throw new Error('Fichier introuvable (' + res.status + ')');
            const buf = await res.arrayBuffer();

            if (type === 'pdf') { await renderPdf(buf); return; }

            if (typeof JSZip === 'undefined') { fail('Décompresseur (JSZip) non chargé.'); return; }
            let zip;
            try { zip = await JSZip.loadAsync(buf); }
            catch (e) {
                if (type === 'cbr') return fail("Ce CBR est au format RAR, non lisible par le lecteur intégré. Convertis-le en CBZ (ZIP).");
                throw new Error('Archive illisible ou corrompue.');
            }
            if (type === 'epub') await renderEpub(zip);
            else await renderImages(zip);
        } catch (e) { fail(e.message); }
    }

    // ── PDF : rendu page par page sur canvas (pdf.js) ──
    async function renderPdf(buf) {
        const pdfjs = window.pdfjsLib;
        if (!pdfjs) return fail('Lecteur PDF (pdf.js) non chargé.');
        pdfjs.GlobalWorkerOptions.workerSrc = 'assets/vendor/pdf.worker.min.js';
        let doc;
        try { doc = await pdfjs.getDocument({ data: buf }).promise; }
        catch (e) { return fail('PDF illisible ou protégé.'); }
        titleEl.textContent = `${doc.numPages} page(s)`;
        body.innerHTML = `<div class="lr-images" id="lrPdf"></div>`;
        const cont = document.getElementById('lrPdf');
        const width = Math.min(900, (cont.clientWidth || 900));
        for (let n = 1; n <= doc.numPages; n++) {
            try {
                const page = await doc.getPage(n);
                const vp0 = page.getViewport({ scale: 1 });
                const scale = width / vp0.width;
                const vp = page.getViewport({ scale });
                const canvas = document.createElement('canvas');
                canvas.width = Math.floor(vp.width);
                canvas.height = Math.floor(vp.height);
                canvas.style.width = '100%';
                canvas.style.maxWidth = '900px';
                canvas.style.display = 'block';
                canvas.style.margin = '0 auto 4px';
                cont.appendChild(canvas);
                await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
            } catch (e) { /* page ratée : on continue */ }
        }
    }

    function fail(msg) {
        titleEl.textContent = 'Erreur';
        body.innerHTML = `<div class="lr-msg">${escapeHtml(msg)}</div>`;
    }

    // ── CBZ / CBR : images empilées ──
    async function renderImages(zip) {
        const names = Object.keys(zip.files)
            .filter(n => !zip.files[n].dir && IMG_RE.test(n))
            .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
        if (!names.length) return fail('Aucune image trouvée dans cette archive.');
        titleEl.textContent = `${names.length} page(s)`;
        body.innerHTML = `<div class="lr-images" id="lrImages"></div>`;
        const cont = document.getElementById('lrImages');
        // Chargement progressif (évite de tout décompresser d'un coup)
        for (let i = 0; i < names.length; i++) {
            const blob = await zip.files[names[i]].async('blob');
            const img = new Image();
            img.loading = 'lazy';
            img.src = mkUrl(blob);
            cont.appendChild(img);
        }
    }

    // ── EPUB : texte (spine OPF) ──
    async function renderEpub(zip) {
        // 1. container.xml → chemin de l'OPF
        const containerXml = await readText(zip, 'META-INF/container.xml');
        const opfPath = (containerXml.match(/full-path="([^"]+)"/) || [])[1];
        if (!opfPath) throw new Error('EPUB invalide (container.xml).');
        const opfDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';

        // 2. OPF → manifest (id→href) + spine (ordre)
        const opf = await readText(zip, opfPath);
        const doc = new DOMParser().parseFromString(opf, 'application/xml');
        const manifest = {};
        doc.querySelectorAll('manifest > item').forEach(it => {
            manifest[it.getAttribute('id')] = { href: it.getAttribute('href'), type: it.getAttribute('media-type') };
        });
        const spine = [...doc.querySelectorAll('spine > itemref')]
            .map(ir => manifest[ir.getAttribute('idref')]).filter(m => m && m.href);
        const titleMeta = (opf.match(/<dc:title[^>]*>([^<]+)</) || [])[1];
        titleEl.textContent = titleMeta || 'EPUB';

        if (!spine.length) throw new Error('EPUB sans contenu lisible (spine vide).');

        // 3. Pré-charge les blobs d'images du livre (pour les <img>)
        const imgMap = {};
        for (const k in manifest) {
            const m = manifest[k];
            if (m.type && m.type.startsWith('image/')) {
                try { imgMap[normalize(opfDir + m.href)] = mkUrl(await zip.files[normalize(opfDir + m.href)].async('blob')); }
                catch (e) {}
            }
        }

        // 4. Sélecteur de chapitres
        const sel = document.getElementById('lrChapters');
        sel.style.display = '';
        sel.innerHTML = spine.map((m, i) => `<option value="${i}">Chapitre ${i + 1}</option>`).join('');
        sel.addEventListener('change', () => showChapter(+sel.value));

        body.innerHTML = `<div class="lr-text" id="lrText"></div>
            <div class="lr-nav"><button class="btn" id="lrPrev">← Précédent</button><button class="btn" id="lrNext">Suivant →</button></div>`;

        const showChapter = async (i) => {
            i = Math.max(0, Math.min(spine.length - 1, i));
            sel.value = i;
            const path = normalize(opfDir + spine[i].href);
            let html = '';
            try { html = await readText(zip, path); } catch (e) { html = '<p>Chapitre illisible.</p>'; }
            document.getElementById('lrText').innerHTML = sanitizeChapter(html, path, imgMap);
            window.scrollTo(0, 0);
            document.getElementById('lrPrev').disabled = i === 0;
            document.getElementById('lrNext').disabled = i === spine.length - 1;
            document.getElementById('lrPrev').onclick = () => showChapter(i - 1);
            document.getElementById('lrNext').onclick = () => showChapter(i + 1);
        };
        showChapter(0);
    }

    // Nettoie le XHTML d'un chapitre : garde le body, retire scripts, recâble les images
    function sanitizeChapter(html, chapterPath, imgMap) {
        const dir = chapterPath.includes('/') ? chapterPath.slice(0, chapterPath.lastIndexOf('/') + 1) : '';
        const doc = new DOMParser().parseFromString(html, 'application/xhtml+xml');
        const root = doc.body || doc.documentElement;
        if (!root) return '<p>(vide)</p>';
        root.querySelectorAll('script, style, link, iframe').forEach(n => n.remove());
        root.querySelectorAll('img, image').forEach(img => {
            const src = img.getAttribute('src') || img.getAttribute('xlink:href') || '';
            const resolved = normalize(dir + src);
            if (imgMap[resolved]) img.setAttribute('src', imgMap[resolved]);
            else img.remove();
        });
        root.querySelectorAll('*').forEach(el => {
            [...el.attributes].forEach(a => { if (/^on/i.test(a.name)) el.removeAttribute(a.name); });
        });
        return root.innerHTML;
    }

    async function readText(zip, path) {
        const f = zip.files[path] || zip.files[path.replace(/^\//, '')];
        if (!f) throw new Error('Fichier manquant : ' + path);
        return f.async('string');
    }

    // Résout "a/b/../c" → "a/c" (chemins relatifs EPUB)
    function normalize(p) {
        const parts = [];
        p.split('/').forEach(seg => {
            if (seg === '..') parts.pop();
            else if (seg !== '.' && seg !== '') parts.push(seg);
        });
        return parts.join('/');
    }

    function escapeHtml(s) { const d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; }
})();
