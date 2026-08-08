// lecture.js — Lecteur de romans (light novels / web novels, sources type 'novel')
(function () {
    'use strict';

    let manga       = null;
    let chapters    = [];      // triés desc (comme le lecteur manga)
    let currentChap = null;
    let currentText = null;    // { title, content } du chapitre affiché

    // ── Réglages typo (persistés, préfixe novel_) ──
    // `mode` : 'scroll' (defilement continu, defaut) | 'pages' (audit AMEL-21)
    const ns = { size: 17, lh: 1.85, width: 720, font: 'serif', theme: 'dark', mode: 'scroll' };
    const FONTS = {
        serif: "'Bitter', Georgia, 'Times New Roman', serif",   // §13 : serif à faible contraste, pensée écran
        sans:  "'Segoe UI', system-ui, -apple-system, sans-serif",
        mono:  "'Cascadia Code', Consolas, monospace",
    };
    const THEMES = {
        dark:  { bg: '#0d0d0f', fg: '#d8d8de' },
        black: { bg: '#000000', fg: '#c9c9cf' },
        sepia: { bg: '#f1e7d0', fg: '#3b2f1d' },
        light: { bg: '#ffffff', fg: '#24242a' },
    };
    function loadSettings() {
        ['size', 'lh', 'width', 'font', 'theme', 'mode'].forEach(k => {
            const v = window.Storage?.getPref('novel_' + k);
            if (v !== undefined && v !== null && v !== '') ns[k] = v;
        });
        ns.size  = +ns.size  || 17;
        ns.lh    = +ns.lh    || 1.85;
        ns.width = +ns.width || 720;
    }
    function saveSetting(k, v) {
        ns[k] = v;
        window.Storage?.setPref('novel_' + k, v);
        applySettings();
    }
    function applySettings() {
        const w = document.getElementById('novelWrap');
        if (!w) return;
        const t = THEMES[ns.theme] || THEMES.dark;
        w.style.setProperty('--novel-bg', t.bg);
        w.style.setProperty('--novel-fg', t.fg);
        w.style.setProperty('--novel-size', ns.size + 'px');
        w.style.setProperty('--novel-lh', String(ns.lh));
        w.style.setProperty('--novel-width', ns.width + 'px');
        w.style.setProperty('--novel-font', FONTS[ns.font] || FONTS.serif);
        // Audit AMEL-21 : le mode pages est porté par une classe, la mise en
        // colonnes étant entièrement CSS. Le JS ne s'occupe que de la mesure de
        // progression et du changement d'axe.
        w.classList.toggle('novel-paged', ns.mode === 'pages');
    }

    document.addEventListener('DOMContentLoaded', async () => {
        MH.initPage('chapitre');
        document.body.dataset.content = 'novel';   // §13 : lecteur de romans → accent Ai
        loadSettings();
        applySettings();

        const params    = new URLSearchParams(location.search);
        const mangaId   = params.get('manga');
        const chapterId = params.get('chapter');
        const src       = params.get('source');
        if (src && API.sources.current !== src) API.sources.current = src;

        if (!mangaId || !chapterId) { showError('Lien invalide.'); return; }

        try {
            let m, chapsData, textData;
            try {
                [m, chapsData, textData] = await Promise.all([
                    API.mangas.get(mangaId),
                    API.mangas.chapters(mangaId, {}),
                    API.mangas.text(chapterId),
                ]);
            } catch (netErr) {
                // Repli hors-ligne : chapitre téléchargé ?
                const dl = window.Downloads ? await window.Downloads.get(chapterId) : null;
                if (!dl || dl.kind !== 'novel') throw netErr;
                m = { id: mangaId, title: dl.mangaTitle || 'Roman', cover: dl.cover, coverThumb: dl.cover, tags: [], description: '', status: null, langs: [] };
                chapsData = { results: [{ id: chapterId, chapter: dl.chapterNum, title: dl.chapterTitle }] };
                textData = { title: dl.chapterTitle, content: dl.text };
                MH.toast?.('Lecture hors-ligne');
            }
            manga    = m;
            chapters = chapsData.results || [];
            currentText = textData;
            currentChap = chapters.find(c => c.id === chapterId)
                || { id: chapterId, chapter: '?', title: textData.title || '' };

            document.getElementById('pageTitle').textContent =
                `${manga.title} — ${currentChap.title || 'Chapitre ' + currentChap.chapter}`;

            renderToolbar();
            renderContent(textData);
            renderEnd();
            bindScrollProgress();
            bindKeyboard();
            await restoreScroll();
        } catch (e) {
            showError('Impossible de charger le chapitre : ' + e.message);
        }
    });

    function showError(msg) {
        const el = document.getElementById('novelContent');
        if (el) el.innerHTML = `<div class="novel-loading" style="color:#ef4444">${MH.esc(msg)}
            <a href="javascript:history.back()" class="btn btn-ghost btn-sm">↩ Retour</a></div>`;
    }

    function neighborChapter(delta) {
        const asc = [...chapters].sort((a, b) => a.chapter - b.chapter);
        const idx = asc.findIndex(c => c.id === currentChap.id);
        const t = idx + delta;
        return (t >= 0 && t < asc.length) ? asc[t] : null;
    }
    function chapURL(id) {
        return `lecture.html?manga=${encodeURIComponent(manga.id)}&chapter=${encodeURIComponent(id)}&source=${encodeURIComponent(API.sources.current)}`;
    }
    function goChapter(delta) {
        const c = neighborChapter(delta);
        if (c) location.href = chapURL(c.id);
    }

    // ── Toolbar ──
    function renderToolbar() {
        const el = document.getElementById('novelToolbar');
        if (!el) return;
        const prev = neighborChapter(-1);
        const next = neighborChapter(1);
        const asc  = [...chapters].sort((a, b) => a.chapter - b.chapter);
        el.innerHTML = `
        <div class="toolbar-left">
            <a href="serie.html?id=${encodeURIComponent(manga.id)}&source=${encodeURIComponent(API.sources.current)}" class="toolbar-back">← ${MH.esc(manga.title)}</a>
            <span class="toolbar-sep">/</span>
            <span class="toolbar-chap">${MH.esc(currentChap.title || ('Chapitre ' + currentChap.chapter))}</span>
        </div>
        <div class="toolbar-center">
            <button class="reader-icon-btn" id="btnPrevChap" ${!prev ? 'disabled' : ''} title="Chapitre précédent (←)">‹</button>
            <select class="reader-chap-select" id="chapSelect">
                ${asc.slice().reverse().map(c =>
                    `<option value="${MH.esc(c.id)}" ${c.id === currentChap.id ? 'selected' : ''}>${MH.esc(c.title || ('Chapitre ' + c.chapter))}</option>`
                ).join('')}
            </select>
            <button class="reader-icon-btn" id="btnNextChap" ${!next ? 'disabled' : ''} title="Chapitre suivant (→)">›</button>
        </div>
        <div class="toolbar-right">
            <!-- Audit AMEL-23 : le lecteur d'images annonce le temps restant,
                 pas celui de texte — alors que c'est là que la question se
                 pose, sur des chapitres qui peuvent faire un livre entier. -->
            <span class="novel-timeleft" id="novelTimeLeft" aria-live="polite"></span>
            <!-- Audit AMEL-20 : sommaire des sections détectées dans le texte -->
            <button class="reader-icon-btn" id="btnNovelToc" title="Sommaire du chapitre" hidden>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
            </button>
            <button class="reader-icon-btn" id="btnNotes" title="Mes notes de lecture (J)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
            </button>
            <button class="reader-icon-btn" id="btnMarkRead" title="Marquer ce chapitre (et les précédents) comme lus">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M20 6 9 17l-5-5"/></svg>
            </button>
            <button class="reader-icon-btn" id="btnNovelTTS" title="Lecture audio (synthèse vocale)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a9 9 0 0 1 0 14"/></svg>
            </button>
            <button class="reader-icon-btn" id="btnNovelDl" title="Télécharger pour lire hors-ligne"></button>
            <button class="reader-icon-btn" id="btnNovelSettings" title="Réglages de lecture (S)">Aa</button>
        </div>`;
        el.querySelector('#chapSelect').addEventListener('change', e => { location.href = chapURL(e.target.value); });
        el.querySelector('#btnPrevChap')?.addEventListener('click', () => goChapter(-1));
        el.querySelector('#btnNextChap')?.addEventListener('click', () => goChapter(1));
        el.querySelector('#btnNovelSettings').addEventListener('click', toggleSettings);
        el.querySelector('#btnMarkRead').addEventListener('click', markUpToHere);
        el.querySelector('#btnNovelTTS').addEventListener('click', TTS.toggle);
        el.querySelector('#btnNotes')?.addEventListener('click', openNotes);
        window.NotesUI?.updateBadge?.(notesContext());
        wireDownload();
    }

    // ── Notes de lecture (journal) ──
    function notesContext() {
        return {
            mangaId: manga.id, source: API.sources.current,
            mangaTitle: manga.title, cover: manga.cover || manga.coverThumb,
            chapterId: currentChap.id, chapterNum: currentChap.chapter, page: null,
        };
    }
    function openNotes() { window.NotesUI?.open(notesContext()); }

    // ── Citer un passage (audit AMEL-44) ─────────────────────
    // Prendre une note sur un roman demandait de retaper le passage, ou de
    // décrire de mémoire ce qu'on venait de lire. Le champ `page` existait
    // pourtant déjà pour l'ancrage — il n'était simplement jamais rempli
    // depuis le texte.
    //
    // Un bouton flottant apparaît sur toute sélection d'une longueur
    // significative, à l'endroit de la sélection. Il disparaît dès qu'on
    // désélectionne : une action contextuelle qui reste à l'écran devient un
    // encombrement.
    const CITATION_MIN = 12;
    const CITATION_MAX = 600;

    function armerCitation() {
        const zone = document.getElementById('novelContent');
        if (!zone || zone.dataset.citeArme === '1') return;
        zone.dataset.citeArme = '1';

        const retirer = () => document.getElementById('novelQuoteBtn')?.remove();

        const proposer = () => {
            const sel = window.getSelection();
            const texte = String(sel || '').replace(/\s+/g, ' ').trim();
            if (!texte || texte.length < CITATION_MIN || !sel.rangeCount) { retirer(); return; }
            // La sélection doit être DANS le texte du chapitre : sélectionner le
            // titre de la page ou un bouton n'a rien d'une citation.
            if (!zone.contains(sel.anchorNode)) { retirer(); return; }

            retirer();
            const r = sel.getRangeAt(0).getBoundingClientRect();
            const btn = document.createElement('button');
            btn.id = 'novelQuoteBtn';
            btn.type = 'button';
            btn.className = 'novel-quote-btn';
            btn.textContent = 'Citer dans le journal';
            btn.style.top  = Math.max(8, r.top - 42) + 'px';
            btn.style.left = Math.min(window.innerWidth - 190, Math.max(8, r.left)) + 'px';
            btn.onclick = () => {
                const extrait = texte.length > CITATION_MAX
                    ? texte.slice(0, CITATION_MAX) + '…' : texte;
                retirer();
                window.NotesUI?.open(Object.assign(notesContext(), {
                    page: scrollPct(),                       // ancrage : % de progression
                    prefill: `« ${extrait} »\n\n`,
                }));
            };
            document.body.appendChild(btn);
        };

        // `selectionchange` plutôt que `mouseup` : couvre aussi la sélection au
        // clavier (Maj+flèches) et au toucher, où `mouseup` n'existe pas.
        document.addEventListener('selectionchange', () => {
            clearTimeout(armerCitation._t);
            armerCitation._t = setTimeout(proposer, 180);
        });
        window.addEventListener('scroll', retirer, { passive: true });
    }

    // ── Synthèse vocale (Text-to-Speech, Web Speech API) ──
    const TTS = (function () {
        const synth = window.speechSynthesis;
        let paras = [];          // <p>/<h1> à lire
        let idx = -1;
        let playing = false;
        let keepAlive = null;

        function collect() {
            const root = document.getElementById('novelContent');
            paras = root ? [...root.querySelectorAll('h1, p, li')].filter(p => p.textContent.trim().length > 1) : [];
        }
        function pickVoice() {
            const voices = synth.getVoices() || [];
            const lang = (manga && manga.langs && manga.langs[0]) || (document.documentElement.lang || 'fr');
            return voices.find(v => v.lang && v.lang.toLowerCase().startsWith(lang.toLowerCase()))
                || voices.find(v => v.lang && v.lang.toLowerCase().startsWith('fr'))
                || voices[0] || null;
        }
        function highlight(el) {
            paras.forEach(p => p.classList.remove('tts-reading'));
            if (el) { el.classList.add('tts-reading'); el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
        }
        function speakFrom(i) {
            if (i >= paras.length) { stop(); return; }
            idx = i;
            const el = paras[i];
            highlight(el);
            const u = new SpeechSynthesisUtterance(el.textContent.trim());
            const v = pickVoice(); if (v) { u.voice = v; u.lang = v.lang; }
            u.rate = 1; u.pitch = 1;
            u.onend = () => { if (playing) speakFrom(idx + 1); };
            u.onerror = () => { if (playing) speakFrom(idx + 1); };
            synth.speak(u);
        }
        function setBtn(on) {
            const b = document.getElementById('btnNovelTTS');
            if (b) b.classList.toggle('active', on);
        }
        function start() {
            if (!('speechSynthesis' in window)) { MH.toast?.('Synthèse vocale non supportée'); return; }
            collect();
            if (!paras.length) { MH.toast?.('Rien à lire'); return; }
            playing = true; setBtn(true);
            // Reprend au paragraphe le plus proche du centre de l'écran
            let startAt = 0;
            const mid = window.scrollY + window.innerHeight / 2;
            for (let i = 0; i < paras.length; i++) { if (paras[i].offsetTop <= mid) startAt = i; }
            speakFrom(startAt);
            // Certains navigateurs suspendent la synthèse après ~15 s : keep-alive.
            clearInterval(keepAlive);
            keepAlive = setInterval(() => { if (playing && !synth.speaking) return; if (playing) { synth.pause(); synth.resume(); } }, 10000);
            MH.toast?.('Lecture audio ▶');
        }
        function stop() {
            playing = false; setBtn(false);
            clearInterval(keepAlive);
            try { synth.cancel(); } catch (e) { window.MH?.err?.('lecture.js', e); }
            highlight(null);
        }
        function toggle() { playing ? stop() : start(); }

        window.addEventListener('beforeunload', () => { try { synth.cancel(); } catch (e) { window.MH?.err?.('lecture.js', e); } });
        return { toggle, stop };
    })();

    // ── Contenu ──
    function renderContent(textData) {
        const el = document.getElementById('novelContent');
        if (!el) return;
        const title = textData.title || currentChap.title || ('Chapitre ' + currentChap.chapter);
        el.innerHTML = `<h1 class="novel-chap-title">${MH.esc(title)}</h1>` + (textData.content || '');
        // Sécurité : retire tout script résiduel (le serveur assainit déjà)
        el.querySelectorAll('script, iframe, object, embed, base, form').forEach(n => n.remove());
        // Audit S4 (défense en profondeur, en plus du serveur) : neutralise
        // les URLs javascript:/data:/vbscript: et les handlers on* résiduels —
        // une source scrapée compromise ne doit pas pouvoir exécuter du JS
        // via un lien cliqué dans le texte du chapitre.
        el.querySelectorAll('*').forEach(n => {
            for (const at of Array.from(n.attributes)) {
                const name = at.name.toLowerCase();
                if (name.startsWith('on')) { n.removeAttribute(at.name); continue; }
                if (['href', 'src', 'action', 'formaction', 'xlink:href'].includes(name)) {
                    const v = String(at.value).split('').filter(ch => ch.charCodeAt(0) > 32).join('');
                    if (/^(javascript|data|vbscript):/i.test(v)) n.removeAttribute(at.name);
                }
            }
        });
        indexerSections(el);
        majTempsRestant();
        armerCitation();   // audit AMEL-44
    }

    // ── Sommaire du texte (audit AMEL-20) ────────────────────
    // Gutenberg renvoie le LIVRE ENTIER comme un seul « chapitre » (Moby Dick :
    // 19 222 nœuds, id `2701:full`). Le sommaire existe pourtant dans le
    // contenu, sous forme de titres — il n'était simplement pas exploité, si
    // bien qu'un défilement de bout en bout était la seule navigation possible.
    //
    // On ne DÉCOUPE pas le document en chapitres séparés : cela casserait la
    // progression déjà enregistrée (un pourcentage de défilement sur le tout),
    // la recherche du navigateur et la synthèse vocale. On l'INDEXE, ce qui
    // donne la même navigation sans rien invalider.
    let sections = [];

    // Reconnaît un intitulé de chapitre : « CHAPTER 12. », « Chapitre IV — »,
    // « Chapitre 3 : ... ». Volontairement strict — un faux positif place une
    // entrée absurde dans le sommaire, ce qui décrédibilise l'ensemble.
    const RE_CHAPITRE = /^(chapter|chapitre|chap\.)\s+([0-9]{1,4}|[ivxlcdm]{1,7})\b/i;

    function indexerSections(root) {
        sections = [];
        const bouton = document.getElementById('btnNovelToc');
        const masquer = () => { if (bouton) bouton.hidden = true; };

        // 1) Vrais titres, quand la source en fournit (certaines le font).
        let candidats = [...root.querySelectorAll('h1, h2, h3')]
            .filter(h => !h.classList.contains('novel-chap-title'))
            .map(h => ({ el: h, texte: (h.textContent || '').replace(/\s+/g, ' ').trim(),
                niveau: +h.tagName.slice(1) }));

        // 2) Sinon — cas de Gutenberg, qui ne renvoie QUE des <p> et des <br> —
        //    on lit les intitulés dans le texte des paragraphes.
        if (candidats.length < 3) {
            const paras = [...root.querySelectorAll('p')];
            const correspond = (p) => RE_CHAPITRE.test((p.textContent || '').trim());
            // Le livre commence par sa TABLE DES MATIÈRES, qui liste les mêmes
            // intitulés : sans filtre, chaque chapitre apparaîtrait deux fois
            // et le premier lien mènerait au sommaire, pas au texte.
            //
            // Règle retenue : garder la DERNIÈRE occurrence de chaque intitulé.
            // Le sommaire précède toujours le corps du livre, donc la dernière
            // occurrence est le vrai début de chapitre. Une règle plus fine —
            // « un intitulé suivi d'un autre intitulé appartient au sommaire » —
            // a été essayée et laissait passer la DERNIÈRE ligne du sommaire,
            // qui est suivie de prose : le sommaire s'ouvrait alors sur
            // « CHAPTER 135 » en première position.
            // Sans table des matières, chaque intitulé n'apparaît qu'une fois
            // et la règle est sans effet.
            const derniere = new Map();
            paras.forEach(p => {
                if (!correspond(p)) return;
                derniere.set((p.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase(), p);
            });
            candidats = [...derniere.values()]
                .map(p => ({ el: p, texte: (p.textContent || '').replace(/\s+/g, ' ').trim(), niveau: 2 }));
        }

        // Sous 3 entrées, un sommaire n'apporte rien et encombre la barre.
        if (candidats.length < 3) { masquer(); return; }

        candidats.forEach((c, i) => {
            if (!c.texte || c.texte.length > 120) return;
            if (!c.el.id) c.el.id = 'sec-' + i;
            sections.push({ id: c.el.id, texte: c.texte, niveau: c.niveau });
        });
        if (sections.length < 3) { masquer(); return; }
        if (bouton) {
            bouton.hidden = false;
            bouton.title = `Sommaire — ${sections.length} sections`;
            if (bouton.dataset.arme !== '1') {
                bouton.dataset.arme = '1';
                bouton.addEventListener('click', basculerSommaire);
            }
        }
    }

    function basculerSommaire() {
        const ex = document.getElementById('novelToc');
        if (ex) { ex.remove(); return; }
        const pop = document.createElement('div');
        pop.id = 'novelToc';
        pop.className = 'novel-toc-pop';
        pop.innerHTML = `<div class="ns-head"><span>Sommaire · ${sections.length} sections</span>
            <button class="ns-close" id="tocClose">✕</button></div>
            <div class="novel-toc-list">${sections.map(s =>
        `<button class="novel-toc-item lvl${s.niveau}" data-sec="${MH.esc(s.id)}">${MH.esc(s.texte)}</button>`).join('')}</div>`;
        document.body.appendChild(pop);
        pop.querySelector('#tocClose').addEventListener('click', () => pop.remove());
        pop.querySelectorAll('[data-sec]').forEach(b => b.addEventListener('click', () => {
            document.getElementById(b.dataset.sec)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            pop.remove();
        }));
    }

    // ── Temps de lecture restant (audit AMEL-23) ─────────────
    // Le lecteur d'images affiche « ~43 min » ; le lecteur de texte, rien —
    // alors que c'est justement là que la question se pose, sur des chapitres
    // qui peuvent faire un livre entier.
    //
    // 200 mots/minute : moyenne admise pour de la lecture de loisir en prose.
    // On compte les mots UNE fois (le texte ne change pas) et on applique le
    // pourcentage déjà calculé pour la barre de progression.
    const MOTS_PAR_MIN = 200;
    let motsTotal = 0;

    function compterMots(el) {
        const t = (el.textContent || '').trim();
        motsTotal = t ? t.split(/\s+/).length : 0;
    }

    function majTempsRestant() {
        const el = document.getElementById('novelContent');
        if (!el) return;
        if (!motsTotal) compterMots(el);
        const cible = document.getElementById('novelTimeLeft');
        if (!cible || !motsTotal) return;
        const restantPct = Math.max(0, 100 - scrollPct());
        const mins = Math.round((motsTotal * restantPct / 100) / MOTS_PAR_MIN);
        cible.textContent = restantPct <= 2 ? 'terminé'
            : mins < 1 ? '< 1 min restante'
                : mins < 60 ? `~${mins} min restantes`
                    : `~${Math.floor(mins / 60)} h ${String(mins % 60).padStart(2, '0')} restantes`;
    }

    function renderEnd() {
        const el = document.getElementById('novelEnd');
        if (!el) return;
        const next = neighborChapter(1);
        el.innerHTML = `
        <div class="novel-next-card">
            <div class="novel-next-info">
                <div class="novel-next-label">${next ? 'À suivre' : 'Fin'}</div>
                <div class="novel-next-title">${next
                    ? MH.esc(next.title || ('Chapitre ' + next.chapter))
                    : 'Tu as atteint le dernier chapitre disponible.'}</div>
            </div>
            ${next
                ? `<a class="btn btn-primary" href="${chapURL(next.id)}">Chapitre suivant →</a>`
                : `<a class="btn btn-primary" href="serie.html?id=${encodeURIComponent(manga.id)}&source=${encodeURIComponent(API.sources.current)}">Retour à la fiche</a>`}
        </div>`;
    }

    // ── Progression : % de défilement ──
    let saveTimer = null;
    let readMarked = false;
    // ── Mode « pages » façon liseuse (audit AMEL-21) ─────────
    // Un défilement continu de 19 000 nœuds n'est pas une expérience de lecture
    // longue : on perd la ligne en cours, et la barre de progression est le
    // seul repère.
    //
    // Réalisé avec des COLONNES CSS dans un conteneur à hauteur d'écran, plutôt
    // qu'en redécoupant le texte en pages. C'est ce qui permet à tout le reste
    // de continuer à fonctionner sans y toucher : la recherche du navigateur,
    // la synthèse vocale et le saut depuis le sommaire utilisent
    // `scrollIntoView`, qui opère aussi bien sur l'axe horizontal.
    // Seule la mesure de progression doit changer d'axe — d'où cette fonction.
    function estPagine() {
        return ns.mode === 'pages';
    }
    function conteneurPagine() {
        return document.getElementById('novelContent');
    }
    function scrollPct() {
        if (estPagine()) {
            const c = conteneurPagine();
            if (!c) return 0;
            const max = c.scrollWidth - c.clientWidth;
            return max > 0 ? Math.min(100, Math.round((c.scrollLeft / max) * 100)) : 100;
        }
        const h = document.documentElement;
        const max = h.scrollHeight - h.clientHeight;
        return max > 0 ? Math.min(100, Math.round((h.scrollTop / max) * 100)) : 100;
    }

    // Tourne d'un écran. `scrollBy` sur la largeur visible fait exactement une
    // « page » puisque les colonnes font la largeur du conteneur.
    function tournerPage(sens) {
        const c = conteneurPagine();
        if (!c) return;
        c.scrollBy({ left: sens * c.clientWidth, behavior: 'smooth' });
    }
    function bindScrollProgress() {
        const fill = document.getElementById('novelProgressFill');
        // En mode pages, c'est le CONTENEUR qui défile, pas la fenêtre : sans
        // cet écouteur la barre de progression resterait figée à 0 %.
        const c = conteneurPagine();
        if (c && c.dataset.progBound !== '1') {
            c.dataset.progBound = '1';
            c.addEventListener('scroll', () => {
                if (!estPagine()) return;
                const pct = scrollPct();
                if (fill) fill.style.width = pct + '%';
                majTempsRestant();
                if (pct >= 96 && !readMarked) { readMarked = true; markChapterRead(); }
                clearTimeout(saveTimer);
                saveTimer = setTimeout(() => saveProgress(pct), 600);
            }, { passive: true });
        }
        window.addEventListener('scroll', () => {
            if (estPagine()) return;   // la fenêtre ne défile plus dans ce mode
            const pct = scrollPct();
            if (fill) fill.style.width = pct + '%';
            majTempsRestant();   // audit AMEL-23
            if (pct >= 96 && !readMarked) { readMarked = true; markChapterRead(); }
            clearTimeout(saveTimer);
            saveTimer = setTimeout(() => saveProgress(pct), 600);
        }, { passive: true });
    }
    async function saveProgress(pct) {
        if (window.MH?.isIncognito?.()) return;   // lecture privée
        if (!API.isLoggedIn() || !manga || !currentChap) return;
        try {
            await API.me.setProgress(manga.id, {
                chapterId: currentChap.id,
                chapter:   currentChap.chapter,
                page:      Math.max(1, pct),   // % de défilement (1–100)
            });
        } catch (e) { window.MH?.err?.('lecture.js', e); }
    }
    async function restoreScroll() {
        // Audit AMEL-114 : une position explicite dans l'URL prime sur la
        // progression enregistrée — c'est ce qui permet à une ligne
        // d'historique de rouvrir un chapitre ANCIEN là où on l'avait laissé.
        // Ici la « page » est un pourcentage de défilement, pas un numéro.
        const demandee = parseInt(new URLSearchParams(location.search).get('page') || '', 10);
        if (demandee > 2 && demandee < 96) { positionner(demandee); return; }
        if (!API.isLoggedIn()) return;
        try {
            const allProg = await API.me.progress();
            const prog = allProg[manga.id];
            if (prog && prog.chapterId === currentChap.id && prog.page > 2 && prog.page < 96) {
                positionner(prog.page);
            }
        } catch (e) { window.MH?.err?.('lecture.js', e); }
    }

    // Extrait de restoreScroll : les deux chemins (URL, progression) doivent
    // positionner de la MEME facon, sinon ils finiront par diverger.
    function positionner(pct) {
        if (estPagine()) {
            // Audit AMEL-21 : en mode pages la position vit sur l'axe
            // horizontal du conteneur. Sans ce cas, reprendre une
            // lecture ramenait au tout debut.
            const c = conteneurPagine();
            if (c) c.scrollLeft = (pct / 100) * (c.scrollWidth - c.clientWidth);
        } else {
            const h = document.documentElement;
            const max = h.scrollHeight - h.clientHeight;
            window.scrollTo({ top: (pct / 100) * max, behavior: 'instant' in window ? 'instant' : 'auto' });
        }
    }
    async function markChapterRead() {
        if (window.MH?.isIncognito?.()) return;   // lecture privée
        if (!API.isLoggedIn()) return;
        try {
            await API.me.markChapter({
                mangaId: manga.id, chapterId: currentChap.id,
                chapter: currentChap.chapter, read: true,
            });
        } catch (e) { window.MH?.err?.('lecture.js', e); }
    }
    function markUpToHere() {
        // Audit BUG-22 : même défaut que le lecteur d'images — la progression
        // respectait le mode incognito, pas le marquage en masse.
        if (window.MH?.isIncognito?.()) {
            MH.toast?.('Mode incognito : rien n\'a été enregistré');
            return;
        }
        if (!API.isLoggedIn()) { MH.toast?.('Connecte-toi pour suivre ta lecture'); return; }
        const cur = parseFloat(currentChap.chapter);
        const items = chapters
            .filter(c => !isNaN(parseFloat(c.chapter)) && parseFloat(c.chapter) <= cur)
            .map(c => ({ chapterId: c.id, chapter: c.chapter }));
        if (!items.length) return;
        API.me.markChaptersBulk(manga.id, items)
            .then(() => MH.toast?.(`${items.length} chapitre(s) marqué(s) comme lus`))
            .catch(e => MH.toast?.('Erreur : ' + e.message));
    }

    // ── Téléchargement hors-ligne (texte) ──
    function dlIcon(done) {
        return done
            ? '<svg viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M21.8 10A10 10 0 1 1 17 3.3"/><path d="m9 11 3 3L22 4"/></svg>'
            : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg>';
    }
    async function wireDownload() {
        const btn = document.getElementById('btnNovelDl');
        if (!btn) return;
        if (!window.Downloads) { btn.style.display = 'none'; return; }
        const has = await window.Downloads.has(currentChap.id);
        btn.innerHTML = dlIcon(has);
        btn.title = has ? 'Téléchargé — cliquer pour supprimer' : 'Télécharger pour lire hors-ligne';
        btn.onclick = async () => {
            if (await window.Downloads.has(currentChap.id)) {
                await window.Downloads.remove(currentChap.id);
                btn.innerHTML = dlIcon(false); btn.title = 'Télécharger pour lire hors-ligne';
                MH.toast?.('Téléchargement supprimé');
                return;
            }
            if (!currentText || !currentText.content) { MH.toast?.('Rien à télécharger'); return; }
            try {
                await window.Downloads.downloadText({
                    mangaId: manga.id, chapterId: currentChap.id,
                    chapterNum: currentChap.chapter, chapterTitle: currentChap.title,
                    mangaTitle: manga.title, cover: manga.cover || manga.coverThumb,
                    source: API.sources.current,
                }, currentText.content);
                btn.innerHTML = dlIcon(true); btn.title = 'Téléchargé — cliquer pour supprimer';
                MH.toast?.('Chapitre disponible hors-ligne');
            } catch (e) { MH.toast?.('Erreur : ' + e.message); }
        };
    }

    // ── Raccourcis clavier ──
    function bindKeyboard() {
        document.addEventListener('keydown', e => {
            if (['TEXTAREA', 'INPUT', 'SELECT'].includes(e.target.tagName)) return;
            switch (e.key) {
                // Audit AMEL-21 : en mode pages, les flèches tournent la PAGE.
                // Les faire changer de chapitre y serait déroutant — c'est le
                // geste de lecture le plus courant, et il n'existait pas.
                // `n`/`p` gardent le changement de chapitre dans les deux modes.
                case 'ArrowRight': estPagine() ? tournerPage(1)  : goChapter(1);  break;
                case 'ArrowLeft':  estPagine() ? tournerPage(-1) : goChapter(-1); break;
                case 'PageDown': if (estPagine()) { e.preventDefault(); tournerPage(1); } break;
                case 'PageUp':   if (estPagine()) { e.preventDefault(); tournerPage(-1); } break;
                case 'n': case 'N': goChapter(1); break;
                case 'p': case 'P': goChapter(-1); break;
                case 's': case 'S': toggleSettings(); break;
                case 'j': case 'J': openNotes(); break;
                case 'Escape': document.getElementById('novelSettings')?.remove(); break;
            }
        });
    }

    // ── Panneau de réglages typo ──
    function toggleSettings() {
        const ex = document.getElementById('novelSettings');
        if (ex) { ex.remove(); return; }
        const panel = document.createElement('div');
        panel.id = 'novelSettings';
        panel.className = 'novel-settings-pop';
        const seg = (key, opts, cur) => `<div class="ns-seg" data-key="${key}">` +
            opts.map(o => `<button data-val="${o.v}" class="${cur == o.v ? 'on' : ''}">${o.l}</button>`).join('') + `</div>`;
        panel.innerHTML = `
            <div class="ns-head"><span>Réglages de lecture</span><button class="ns-close" id="nsClose">✕</button></div>
            <div class="ns-label"><span>Taille du texte</span><span id="nsSizeVal">${ns.size}px</span></div>
            <input type="range" id="nsSize" class="ns-range" min="13" max="26" step="1" value="${ns.size}">
            <div class="ns-label"><span>Interligne</span><span id="nsLhVal">${ns.lh}</span></div>
            <input type="range" id="nsLh" class="ns-range" min="1.4" max="2.4" step="0.05" value="${ns.lh}">
            <div class="ns-label"><span>Largeur de colonne</span><span id="nsWidthVal">${ns.width}px</span></div>
            <input type="range" id="nsWidth" class="ns-range" min="540" max="980" step="20" value="${ns.width}">
            <div class="ns-label"><span>Police</span></div>
            ${seg('font', [{v:'serif',l:'Serif'},{v:'sans',l:'Sans'},{v:'mono',l:'Mono'}], ns.font)}
            <div class="ns-label"><span>Thème</span></div>
            ${seg('theme', [{v:'dark',l:'Sombre'},{v:'black',l:'Noir'},{v:'sepia',l:'Sépia'},{v:'light',l:'Clair'}], ns.theme)}
            <div class="ns-label"><span>Mode de lecture</span></div>
            ${seg('mode', [{v:'scroll',l:'Défilement'},{v:'pages',l:'Pages'}], ns.mode)}`;
        document.body.appendChild(panel);

        panel.querySelector('#nsClose').addEventListener('click', () => panel.remove());
        panel.querySelector('#nsSize').addEventListener('input', e => {
            document.getElementById('nsSizeVal').textContent = e.target.value + 'px';
            saveSetting('size', +e.target.value);
        });
        panel.querySelector('#nsLh').addEventListener('input', e => {
            document.getElementById('nsLhVal').textContent = e.target.value;
            saveSetting('lh', +e.target.value);
        });
        panel.querySelector('#nsWidth').addEventListener('input', e => {
            document.getElementById('nsWidthVal').textContent = e.target.value + 'px';
            saveSetting('width', +e.target.value);
        });
        panel.querySelectorAll('.ns-seg').forEach(sg => {
            const key = sg.dataset.key;
            sg.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
                sg.querySelectorAll('button').forEach(x => x.classList.remove('on'));
                b.classList.add('on');
                saveSetting(key, b.dataset.val);
            }));
        });
    }
})();
