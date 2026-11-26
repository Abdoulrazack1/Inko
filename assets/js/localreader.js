// localreader.js — Lecteur de fichiers locaux importés (CBZ/CBR images, EPUB texte)
// Décompresse côté client avec JSZip ; aucun contenu ne transite ailleurs.
(function () {
    'use strict';

    const params = new URLSearchParams(location.search);
    const id   = params.get('id');
    const type = (params.get('type') || '').toLowerCase();
    const body = document.getElementById('lrBody');
    const titleEl = document.getElementById('lrTitle');

    // A11Y-01 : le nom du fichier ouvert vit dans la barre, qui n'est pas un
    // titre. On le recopie dans le `h1` lu — sinon toute lecture d'un fichier
    // importe s'annonce pareil.
    function titrerPourLecteurs(texte) {
        const h = document.getElementById('lrTitreA11y');
        if (h && texte) h.textContent = texte;
    }

    const IMG_RE = /\.(jpe?g|png|webp|gif|avif|bmp)$/i;
    const blobUrls = [];
    const mkUrl = (blob) => { const u = URL.createObjectURL(blob); blobUrls.push(u); return u; };
    window.addEventListener('beforeunload', () => blobUrls.forEach(u => URL.revokeObjectURL(u)));

    // ── Sauvegarde de progression (audit) — les lecteurs réseau la gardent déjà,
    //    l'import local repartait toujours de zéro. Stockée par id de fichier. ──
    const PROG_KEY = 'inko_lr_progress_v1';
    function progAll() { try { return JSON.parse(localStorage.getItem(PROG_KEY) || '{}'); } catch (e) { return {}; } }
    function progLoad() { return (id && progAll()[id]) || null; }
    // Audit MD2 : le fichier importé vit déjà côté serveur, mais la position
    // de lecture restait purement locale — reprendre le même EPUB sur un
    // autre appareil repartait de zéro. On réplique désormais la progression
    // au compte via user_settings (clé localReaderProgress), comme les autres
    // réglages synchronisés. Fusion par fraîcheur (champ `at`).
    const PROG_SYNC_MAX = 100;   // borne le blob synchronisé aux 100 fichiers les plus récents
    let progPushTimer = null;
    function pruneProg(all) {
        const entries = Object.entries(all).sort((a, b) => (b[1].at || 0) - (a[1].at || 0)).slice(0, PROG_SYNC_MAX);
        return Object.fromEntries(entries);
    }
    function progSave(data) {
        if (!id) return;
        const all = progAll(); all[id] = Object.assign({ at: Date.now() }, data);
        try { localStorage.setItem(PROG_KEY, JSON.stringify(all)); } catch (e) { window.MH?.err?.('localreader.js', e); }
        if (window.API?.isLoggedIn?.()) {
            clearTimeout(progPushTimer);
            progPushTimer = setTimeout(() => {
                window.API.me.saveSettings({ localReaderProgress: pruneProg(all) })
                    .catch(e => window.MH?.err?.('localreader.js', e));
            }, 1200);
        }
    }
    async function progPull() {
        if (!window.API?.isLoggedIn?.()) return;
        try {
            const s = await window.API.me.settings();
            const remote = s && s.localReaderProgress;
            if (remote && typeof remote === 'object' && !Array.isArray(remote)) {
                const all = progAll();
                for (const [k, v] of Object.entries(remote)) {
                    if (v && typeof v === 'object' && (!all[k] || (v.at || 0) > (all[k].at || 0))) all[k] = v;
                }
                localStorage.setItem(PROG_KEY, JSON.stringify(all));
            }
        } catch (e) { /* hors-ligne : la position locale reste valable */ }
    }

    // Suit la page (image/canvas) en haut du viewport dans un conteneur empilé et
    // enregistre son index (débounce). Utilisé pour CBZ et PDF.
    function trackPages(cont, selector) {
        let timer;
        const io = new IntersectionObserver((entries) => {
            for (const e of entries) {
                if (!e.isIntersecting) continue;
                const idx = +e.target.dataset.idx || 0;
                clearTimeout(timer);
                timer = setTimeout(() => progSave({ mode: 'page', page: idx }), 400);
            }
        }, { rootMargin: '0px 0px -80% 0px' });   // « courante » = proche du haut
        cont.querySelectorAll(selector).forEach(el => io.observe(el));
    }

    // Ramène la vue sur l'enfant `index`. Comme les images se chargent en asynchrone
    // et décalent la mise en page, on re-scrolle à chaque chargement d'une image
    // précédente, jusqu'à ce que l'utilisateur bouge lui-même.
    function restoreToChild(cont, index) {
        const target = cont.children[index];
        if (!target) return;
        let userMoved = false;
        const scroll = () => { if (!userMoved) target.scrollIntoView({ block: 'start' }); };
        const before = [...cont.children].slice(0, index + 1)
            .filter(n => n.tagName === 'IMG' && !n.complete);
        const handlers = [];
        const cleanup = () => handlers.forEach(([im, h]) => { im.removeEventListener('load', h); im.removeEventListener('error', h); });
        const onUser = () => { userMoved = true; cleanup(); };
        let pending = before.length;
        before.forEach(im => {
            const h = () => { scroll(); if (--pending <= 0) cleanup(); };
            im.addEventListener('load', h); im.addEventListener('error', h);
            handlers.push([im, h]);
        });
        window.addEventListener('wheel', onUser, { once: true, passive: true });
        window.addEventListener('touchmove', onUser, { once: true, passive: true });
        window.addEventListener('keydown', onUser, { once: true });
        scroll();
    }

    document.addEventListener('DOMContentLoaded', init);

    async function init() {
        await (window.API?.ready || Promise.resolve());
        if (!window.API?.isLoggedIn?.()) {
            // Audit N1 : message honnête (le lecteur local exige une session)
            fail('Connexion requise — recharge la page pour rétablir la session.');
            return;
        }
        if (!id) {
            // Arriver ici sans identifiant n'est pas une erreur : c'est
            // l'écran ouvert directement, sans fichier. On explique à quoi il
            // sert plutôt que d'afficher un constat sec.
            fail('Cette page lit un fichier que tu as importé — un EPUB, un CBZ ou un PDF. '
                + 'Ouvre-le depuis tes fichiers importés, ou dépose-en un nouveau.',
            {
                titre: 'Aucun fichier ouvert',
                icone: '📖',
                actions: [
                    { libelle: 'Importer un fichier', href: 'import.html' },
                    { libelle: 'Mes fichiers importés', href: 'bibliotheque.html#downloads' },
                ],
            });
            return;
        }
        const FORMATS = { pdf: 'PDF', epub: 'EPUB', cbz: 'CBZ', cbr: 'CBR' };
        titrerPourLecteurs(`Lecture d'un fichier ${FORMATS[type] || 'importé'}`);

        try {
            await progPull();   // audit MD2 : reprend la position la plus récente du compte
            // Mode autonome : le fichier vit dans IndexedDB, pas derrière une
            // URL. `API.local.fileUrl()` désignerait le hub — une adresse qui
            // n'existe pas ici, et l'ouverture échouerait sur un « Fichier
            // introuvable » alors que le fichier est bien là.
            let buf;
            if (window.INKO_AUTONOME && window.INKO_FICHIERS_LOCAUX) {
                buf = await window.INKO_FICHIERS_LOCAUX.contenu(id);
            } else {
                const res = await fetch(API.local.fileUrl(id), { headers: { Authorization: 'Bearer ' + API.token } });
                if (!res.ok) throw new Error('Fichier introuvable (' + res.status + ')');
                buf = await res.arrayBuffer();
            }

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

    // Audit PERF-06 : pdf.min.js (313 Ko) était chargé par un <script> en dur
    // sur localreader.html, donc AUSSI pour ouvrir un CBZ ou un EPUB — qui
    // n'en ont aucun besoin. On ne le charge plus qu'au moment d'ouvrir un PDF.
    // (pdf.worker.min.js, 1 Mo, n'était déjà tiré qu'à l'exécution par pdf.js.)
    function loadPdfJs() {
        if (window.pdfjsLib) return Promise.resolve(true);
        return new Promise((resolve) => {
            const s = document.createElement('script');
            s.src = 'assets/vendor/pdf.min.js';
            s.async = true;
            s.onload  = () => resolve(!!window.pdfjsLib);
            s.onerror = () => resolve(false);
            document.head.appendChild(s);
        });
    }

    // ── PDF : rendu page par page sur canvas (pdf.js) ──
    async function renderPdf(buf) {
        if (!window.pdfjsLib) await loadPdfJs();
        const pdfjs = window.pdfjsLib;
        if (!pdfjs) {
            // PERF-03 : pdf.js (313 Ko) et son ouvrier (1 Mo) ne sont PAS
            // précachés — 1,4 Mo à l'installation pour une page que la plupart
            // n'ouvrent jamais. Le service worker les garde après le premier
            // usage, mais avant celui-ci, hors ligne, le chargement échoue.
            //
            // « Lecteur PDF non chargé » était exact et inutile : ça n'explique
            // ni pourquoi le CBZ d'à côté s'ouvre, ni ce qu'il faut faire.
            // C'est précisément l'échec silencieux que relève l'audit.
            return navigator.onLine === false
                ? fail('Il n’a pas encore été téléchargé, et tu es hors ligne. Ouvre un PDF '
                     + 'une fois connecté : le lecteur (1,4 Mo) sera alors conservé et '
                     + 'fonctionnera hors ligne. Les CBZ et les EPUB, eux, s’ouvrent sans lui.',
                { icone: '📄', titre: 'Lecteur PDF indisponible hors ligne' })
                : fail('Le lecteur PDF n’a pas pu être chargé — réessaie dans un instant.');
        }
        pdfjs.GlobalWorkerOptions.workerSrc = 'assets/vendor/pdf.worker.min.js';
        let doc;
        try { doc = await pdfjs.getDocument({ data: buf }).promise; }
        catch (e) { return fail('PDF illisible ou protégé.'); }
        titleEl.textContent = `${doc.numPages} page(s)`;
        body.innerHTML = `<div class="lr-images" id="lrPdf"></div>`;
        const cont = document.getElementById('lrPdf');
        const width = Math.min(900, (cont.clientWidth || 900));
        const saved = progLoad();
        const targetPage = (saved && saved.mode === 'page') ? saved.page : 0;
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
                canvas.dataset.idx = n - 1;
                cont.appendChild(canvas);
                await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
                // Les canvas ont une taille définie dès l'ajout : dès que la page cible
                // est rendue, on peut y ramener la vue de façon stable.
                if (targetPage && n - 1 === targetPage) canvas.scrollIntoView({ block: 'start' });
            } catch (e) { /* page ratée : on continue */ }
        }
        trackPages(cont, 'canvas');
    }

    // DESK-03 : cette page rendait 44 caractères — « Aucun fichier indiqué. »
    // et rien d'autre. Elle n'était pas cassée, mais elle en avait l'air, et
    // n'offrait aucune issue. Un message d'erreur doit dire quoi faire.
    function fail(msg, options) {
        titleEl.textContent = (options && options.titre) || 'Erreur';
        const actions = (options && options.actions) || [
            { libelle: 'Mes fichiers importés', href: 'import.html' },
            { libelle: 'Ma bibliothèque', href: 'bibliotheque.html' },
        ];
        // `global.js` n'est PAS chargé ici : cette page de lecture est
        // volontairement allégée, et l'y tirer pour un état vide serait un
        // mauvais échange. `global.css` l'est, en revanche — on écrit donc le
        // même balisage, qui hérite du même style.
        body.innerHTML = `
            <div class="mh-etat-vide">
                <div class="mh-vide-ico" aria-hidden="true">${escapeHtml((options && options.icone) || '⚠')}</div>
                <div class="mh-vide-titre">${escapeHtml((options && options.titre) || 'Lecture impossible')}</div>
                <div class="mh-vide-texte">${escapeHtml(msg)}</div>
                <div class="mh-vide-actions">${actions.map((a, i) =>
        `<a class="btn ${i === 0 ? 'btn-primary' : 'btn-ghost'} btn-sm" href="${escapeHtml(a.href)}">${escapeHtml(a.libelle)}</a>`
    ).join('')}</div>
            </div>`;
    }

    // ── CBZ / CBR : images empilées ──
    async function renderImages(zip) {
        const names = Object.keys(zip.files)
            // Les archives faites sur Mac embarquent `__MACOSX/._page.jpg` : des
            // fichiers de métadonnées qui portent une extension d'image et
            // comptaient comme des planches vides (5 pages pour 3, relevé).
            .filter(n => !zip.files[n].dir && IMG_RE.test(n) && !/(^|\/)(__MACOSX\/|\._|\.)/.test(n))
            .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
        if (!names.length) return fail('Aucune image trouvée dans cette archive.');
        titleEl.textContent = `${names.length} page(s)`;
        body.innerHTML = `<div class="lr-images" id="lrImages"></div>`;
        const cont = document.getElementById('lrImages');

        // 1) Structure affichée immédiatement : tous les <img> sont créés d'abord,
        //    avec une hauteur RÉSERVÉE (aspect-ratio) — la barre de défilement est
        //    juste dès le départ et la page n'attend aucune décompression.
        const imgs = names.map((_, i) => {
            const im = new Image();
            im.dataset.idx = i; im.alt = 'Page ' + (i + 1);
            im.style.width = '100%';
            im.style.aspectRatio = '1/1.45';   // affiné à la vraie valeur une fois décompressée
            cont.appendChild(im);
            return im;
        });

        // 2) Décompression VIRTUALISÉE : un volume complet (300-500 pages) ne tient
        //    pas en mémoire si on décompresse tout. Avant, chaque page était
        //    décompressée en blob et son objectURL n'était libéré qu'à la fermeture
        //    → ~400 Mo retenus sur un volume. Désormais : seules les pages proches
        //    sont décompressées, les lointaines sont libérées (revokeObjectURL).
        const NEAR = 3, KEEP = 10, CONCURRENCY = 4;
        const urls = new Map();                 // idx -> objectURL vivant
        let queue = [], active = 0;

        function unload(i) {
            const u = urls.get(i);
            if (!u) return;
            URL.revokeObjectURL(u);             // libère vraiment la mémoire
            urls.delete(i);
            imgs[i].removeAttribute('src');
            imgs[i].dataset.state = '';
        }
        function enqueue(i) {
            const im = imgs[i];
            if (!im || im.dataset.state) return;   // 'loading' ou 'loaded'
            im.dataset.state = 'loading';
            queue.push(i);
            pump();
        }
        function pump() {
            while (active < CONCURRENCY && queue.length) {
                const i = queue.shift();
                active++;
                zip.files[names[i]].async('blob')
                    .then(blob => {
                        if (imgs[i].dataset.state !== 'loading') return;   // déchargée entre-temps
                        const u = URL.createObjectURL(blob);
                        urls.set(i, u);
                        imgs[i].onload = () => {
                            if (imgs[i].naturalWidth) {
                                imgs[i].style.aspectRatio = `1/${imgs[i].naturalHeight / imgs[i].naturalWidth}`;
                            }
                        };
                        imgs[i].src = u;
                        imgs[i].dataset.state = 'loaded';
                    })
                    .catch(() => { imgs[i].alt = 'Page ' + (i + 1) + ' illisible'; imgs[i].dataset.state = ''; })
                    .finally(() => { active--; pump(); });
            }
        }
        function refresh(center) {
            for (let i = 0; i < imgs.length; i++) {
                const d = Math.abs(i - center);
                if (d <= NEAR) enqueue(i);
                else if (d > KEEP) unload(i);
            }
        }

        if ('IntersectionObserver' in window) {
            const io = new IntersectionObserver(ents => {
                ents.forEach(e => { if (e.isIntersecting) refresh(+e.target.dataset.idx); });
            }, { threshold: 0.1, rootMargin: '150% 0px' });
            imgs.forEach(im => io.observe(im));
        } else {
            imgs.forEach((_, i) => enqueue(i));
        }

        trackPages(cont, 'img');

        const saved = progLoad();
        if (saved && saved.mode === 'page' && saved.page) {
            restoreToChild(cont, saved.page);
            refresh(Math.max(0, saved.page - 1));
        } else {
            refresh(0);
        }
        // Libère tout ce qui reste à la fermeture du fichier
        window.addEventListener('beforeunload', () => urls.forEach(u => URL.revokeObjectURL(u)));
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
        if (titleMeta) titrerPourLecteurs(titleMeta);

        if (!spine.length) throw new Error('EPUB sans contenu lisible (spine vide).');

        // 3. Pré-charge les blobs d'images du livre (pour les <img>)
        const imgMap = {};
        for (const k in manifest) {
            const m = manifest[k];
            if (m.type && m.type.startsWith('image/')) {
                try { imgMap[normalize(opfDir + m.href)] = mkUrl(await zip.files[normalize(opfDir + m.href)].async('blob')); }
                catch (e) { window.MH?.err?.('localreader.js', e); }
            }
        }

        // 4. Sélecteur de chapitres
        const sel = document.getElementById('lrChapters');
        sel.style.display = '';
        sel.innerHTML = spine.map((m, i) => `<option value="${i}">Chapitre ${i + 1}</option>`).join('');
        sel.addEventListener('change', () => showChapter(+sel.value));

        const ttsSupported = 'speechSynthesis' in window;
        body.innerHTML = `<div class="lr-text" id="lrText"></div>
            <div class="lr-nav">
                <button class="btn" id="lrPrev">← Précédent</button>
                ${ttsSupported ? '<button class="btn" id="lrTTS" title="Lecture audio (synthèse vocale)">▶ Écouter</button>' : ''}
                <button class="btn" id="lrNext">Suivant →</button>
            </div>`;

        let current = 0;
        const showChapter = async (i) => {
            i = Math.max(0, Math.min(spine.length - 1, i));
            current = i;
            sel.value = i;
            const path = normalize(opfDir + spine[i].href);
            let html = '';
            try { html = await readText(zip, path); } catch (e) { html = '<p>Chapitre illisible.</p>'; }
            document.getElementById('lrText').replaceChildren(sanitizeChapter(html, path, imgMap));
            window.scrollTo(0, 0);
            document.getElementById('lrPrev').disabled = i === 0;
            document.getElementById('lrNext').disabled = i === spine.length - 1;
            document.getElementById('lrPrev').onclick = () => showChapter(i - 1);
            document.getElementById('lrNext').onclick = () => showChapter(i + 1);
            progSave({ mode: 'epub', chapter: i });
            TTS.stop();   // change de chapitre = on coupe la lecture audio en cours
        };

        // Navigation clavier (aligné sur chapitre.js/lecture.js) : ← / → changent
        // de chapitre. On ignore quand le focus est dans un champ.
        document.addEventListener('keydown', (e) => {
            // Cette page ne charge pas global.js (MH.toucheIgnoree) : même
            // règle écrite ici — une flèche avec Alt est le « retour » du
            // navigateur, pas un changement de chapitre.
            if (e.ctrlKey || e.metaKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable) return;
            if (e.key === 'ArrowRight') { e.preventDefault(); showChapter(current + 1); }
            else if (e.key === 'ArrowLeft') { e.preventDefault(); showChapter(current - 1); }
        });

        // ── TTS EPUB (synthèse vocale, même approche que lecture.js) ──
        const TTS = (function () {
            const synth = ttsSupported ? window.speechSynthesis : null;
            let paras = [], idx = 0, playing = false, keepAlive = null;
            function pickVoice() {
                const voices = (synth && synth.getVoices()) || [];
                return voices.find(v => v.lang && v.lang.toLowerCase().startsWith('fr')) || voices[0] || null;
            }
            function highlight(el) {
                paras.forEach(p => p.classList.remove('tts-reading'));
                if (el) { el.classList.add('tts-reading'); el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
            }
            function speakFrom(i) {
                if (!playing) return;
                if (i >= paras.length) {   // fin de chapitre → enchaîne le suivant si possible
                    if (current < spine.length - 1) { showChapter(current + 1).then(() => { playing = true; start(0); }); }
                    else stop();
                    return;
                }
                idx = i;
                const el = paras[i];
                highlight(el);
                const u = new SpeechSynthesisUtterance(el.textContent.trim());
                const v = pickVoice(); if (v) { u.voice = v; u.lang = v.lang; }
                u.onend = () => { if (playing) speakFrom(idx + 1); };
                u.onerror = () => { if (playing) speakFrom(idx + 1); };
                synth.speak(u);
            }
            function paint() {
                const b = document.getElementById('lrTTS');
                if (b) b.textContent = playing ? '⏸ Pause' : '▶ Écouter';
            }
            function start(at) {
                paras = [...document.querySelectorAll('#lrText p, #lrText h1, #lrText h2, #lrText h3')]
                    .filter(p => p.textContent.trim().length > 1);
                if (!paras.length) { window.MH?.toast?.('Rien à lire dans ce chapitre'); return; }
                playing = true; paint();
                keepAlive = setInterval(() => { if (playing && !synth.speaking) return; if (playing) { synth.pause(); synth.resume(); } }, 10000);
                speakFrom(at || 0);
            }
            function stop() {
                playing = false;
                if (synth) synth.cancel();
                clearInterval(keepAlive);
                highlight(null); paint();
            }
            function toggle() {
                if (!ttsSupported) { window.MH?.toast?.('Synthèse vocale non supportée'); return; }
                if (playing) stop(); else start(0);
            }
            return { toggle, stop };
        })();
        document.getElementById('lrTTS')?.addEventListener('click', TTS.toggle);

        const saved = progLoad();
        showChapter(saved && saved.mode === 'epub' ? saved.chapter : 0);
    }

    // Nettoie le XHTML d'un chapitre : garde le body, retire scripts, recâble les images
    // ── SEC-24 / SEC-25 : un livre est une donnée, pas une page ──
    // L'ancien nettoyage retirait une liste de balises dangereuses dans le XML,
    // puis réinjectait le résultat par innerHTML — qui le relit comme du HTML.
    // Quatre constructions changent de sens entre les deux lectures (section
    // CDATA, commentaire, instruction de traitement, animation SVG) : un EPUB
    // préparé pour l'essai exécutait du code par chacune d'elles. Un chapitre
    // pouvait aussi rediriger la page et contacter six adresses extérieures
    // (images de fond, vidéos, liens suivis) à la seule ouverture.
    //
    // On ne retire plus ce qui est interdit : on RECOPIE ce qui est permis,
    // nœud par nœud, dans un fragment qui n'est jamais relu comme du texte.
    // Ce qui n'est pas dans la liste n'existe pas : ni script, ni SVG, ni
    // média, ni formulaire, ni ressource extérieure.
    const BALISES_LIVRE = new Set(['p', 'div', 'span', 'section', 'article', 'aside', 'header', 'footer', 'main', 'nav',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'br', 'hr', 'em', 'strong', 'i', 'b', 'u', 's', 'small', 'big', 'sub', 'sup',
        'mark', 'cite', 'q', 'abbr', 'dfn', 'kbd', 'code', 'pre', 'samp', 'var', 'blockquote', 'center',
        'ul', 'ol', 'li', 'dl', 'dt', 'dd', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'caption', 'colgroup', 'col',
        'figure', 'figcaption', 'img', 'a', 'ruby', 'rt', 'rp', 'rb', 'del', 'ins', 'bdi', 'bdo', 'wbr', 'time']);
    // Sans « class » ni « id » bruts : ils rencontreraient ceux de l'interface
    // (un livre avec id="lrNext" aurait pris la place du bouton « Suivant »).
    const ATTRIBUTS_LIVRE = new Set(['title', 'lang', 'dir', 'colspan', 'rowspan', 'alt', 'start', 'reversed', 'scope', 'headers', 'datetime', 'width', 'height']);
    // Déclarations de style qui ne chargent rien et ne recouvrent rien.
    const STYLE_PERMIS = /^(text-align|text-indent|font-style|font-weight|font-variant|text-decoration|vertical-align|white-space|margin(-(top|bottom|left|right))?|padding(-(top|bottom|left|right))?|line-height|letter-spacing|word-spacing|text-transform|font-size|width|max-width|float|clear|display|list-style-type|border(-(top|bottom|left|right))?(-(width|style|color))?|color|background-color)$/i;

    function styleSur(brut) {
        return String(brut || '').split(';').map(d => d.trim()).filter(Boolean).filter(d => {
            const i = d.indexOf(':'); if (i < 1) return false;
            const prop = d.slice(0, i).trim(), val = d.slice(i + 1).trim();
            if (!STYLE_PERMIS.test(prop)) return false;
            if (/^display$/i.test(prop) && !/^(block|inline|inline-block|none|list-item|table|table-row|table-cell)$/i.test(val)) return false;
            return !/url\s*\(|expression|@import|\\|javascript:|var\s*\(/i.test(val);
        }).join('; ');
    }

    function sanitizeChapter(html, chapterPath, imgMap) {
        const dir = chapterPath.includes('/') ? chapterPath.slice(0, chapterPath.lastIndexOf('/') + 1) : '';
        let source = new DOMParser().parseFromString(html, 'application/xhtml+xml');
        // XHTML mal formé : le navigateur rend un document d'erreur. On relit
        // alors en HTML — le résultat passe par la même recopie.
        if (source.getElementsByTagName('parsererror').length) source = new DOMParser().parseFromString(html, 'text/html');
        const racine = source.body || source.documentElement;
        const sortie = document.createDocumentFragment();
        if (!racine) { sortie.append(Object.assign(document.createElement('p'), { textContent: '(vide)' })); return sortie; }

        const recopier = (noeud, parent, profondeur) => {
            if (profondeur > 60) return;
            for (const n of noeud.childNodes) {
                // texte et CDATA deviennent du TEXTE : rien n'y est interprété
                if (n.nodeType === 3 || n.nodeType === 4) { parent.append(document.createTextNode(n.nodeValue)); continue; }
                if (n.nodeType !== 1) continue;                         // commentaires, instructions : ignorés
                const nom = (n.localName || n.nodeName || '').toLowerCase();
                if (nom === 'image' && n.namespaceURI === 'http://www.w3.org/2000/svg') {
                    // couverture en SVG : on n'en garde que l'image
                    const src = n.getAttribute('href') || n.getAttributeNS('http://www.w3.org/1999/xlink', 'href') || '';
                    const url = imgMap[normalize(dir + src)];
                    if (url) { const img = document.createElement('img'); img.src = url; img.alt = ''; parent.append(img); }
                    continue;
                }
                if (nom === 'svg') { recopier(n, parent, profondeur + 1); continue; }
                if (!BALISES_LIVRE.has(nom)) {
                    // une balise inconnue garde son texte, sauf celles dont le contenu n'est pas du texte lisible
                    if (!/^(script|style|title|head|noscript|template|iframe|object|embed|audio|video|source|track|math|select|textarea|button|input|form|meta|link|base)$/.test(nom)) recopier(n, parent, profondeur + 1);
                    continue;
                }
                const el = document.createElement(nom);
                for (const a of n.attributes) {
                    const an = a.localName.toLowerCase();
                    if (ATTRIBUTS_LIVRE.has(an)) el.setAttribute(an, a.value);
                    else if (an === 'style') { const st = styleSur(a.value); if (st) el.setAttribute('style', st); }
                    else if (an === 'id') el.setAttribute('id', 'livre-' + a.value);
                }
                if (nom === 'img') {
                    const src = n.getAttribute('src') || '';
                    const url = imgMap[normalize(dir + src)];
                    if (!url) continue;                                 // image hors du livre : jamais chargée
                    el.src = url;
                }
                if (nom === 'a') {
                    const href = (n.getAttribute('href') || '').trim();
                    // Seuls les renvois DANS le chapitre restent des liens. Un lien
                    // vers l'extérieur reste lisible mais ne part nulle part.
                    if (/^#[\w\-.:]+$/.test(href)) el.setAttribute('href', '#livre-' + href.slice(1));
                    else if (/^https?:\/\//i.test(href)) el.setAttribute('title', href);
                }
                parent.append(el);
                recopier(n, el, profondeur + 1);
            }
        };
        recopier(racine, sortie, 0);
        return sortie;
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
