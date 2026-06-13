// lecture.js — Lecteur de romans (light novels / web novels, sources type 'novel')
(function () {
    'use strict';

    let manga       = null;
    let chapters    = [];      // triés desc (comme le lecteur manga)
    let currentChap = null;

    // ── Réglages typo (persistés, préfixe novel_) ──
    const ns = { size: 17, lh: 1.85, width: 720, font: 'serif', theme: 'dark' };
    const FONTS = {
        serif: "Georgia, 'Times New Roman', serif",
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
        ['size', 'lh', 'width', 'font', 'theme'].forEach(k => {
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
    }

    document.addEventListener('DOMContentLoaded', async () => {
        MH.initPage('chapitre');
        loadSettings();
        applySettings();

        const params    = new URLSearchParams(location.search);
        const mangaId   = params.get('manga');
        const chapterId = params.get('chapter');
        const src       = params.get('source');
        if (src && API.sources.current !== src) API.sources.current = src;

        if (!mangaId || !chapterId) { showError('Lien invalide.'); return; }

        try {
            const [m, chapsData, textData] = await Promise.all([
                API.mangas.get(mangaId),
                API.mangas.chapters(mangaId, {}),
                API.mangas.text(chapterId),
            ]);
            manga    = m;
            chapters = chapsData.results || [];
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
            <button class="reader-icon-btn" id="btnMarkRead" title="Marquer ce chapitre (et les précédents) comme lus">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M20 6 9 17l-5-5"/></svg>
            </button>
            <button class="reader-icon-btn" id="btnNovelSettings" title="Réglages de lecture (S)">Aa</button>
        </div>`;
        el.querySelector('#chapSelect').addEventListener('change', e => { location.href = chapURL(e.target.value); });
        el.querySelector('#btnPrevChap')?.addEventListener('click', () => goChapter(-1));
        el.querySelector('#btnNextChap')?.addEventListener('click', () => goChapter(1));
        el.querySelector('#btnNovelSettings').addEventListener('click', toggleSettings);
        el.querySelector('#btnMarkRead').addEventListener('click', markUpToHere);
    }

    // ── Contenu ──
    function renderContent(textData) {
        const el = document.getElementById('novelContent');
        if (!el) return;
        const title = textData.title || currentChap.title || ('Chapitre ' + currentChap.chapter);
        el.innerHTML = `<h1 class="novel-chap-title">${MH.esc(title)}</h1>` + (textData.content || '');
        // Sécurité : retire tout script résiduel (le serveur assainit déjà)
        el.querySelectorAll('script, iframe, object, embed').forEach(n => n.remove());
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
    function scrollPct() {
        const h = document.documentElement;
        const max = h.scrollHeight - h.clientHeight;
        return max > 0 ? Math.min(100, Math.round((h.scrollTop / max) * 100)) : 100;
    }
    function bindScrollProgress() {
        const fill = document.getElementById('novelProgressFill');
        window.addEventListener('scroll', () => {
            const pct = scrollPct();
            if (fill) fill.style.width = pct + '%';
            if (pct >= 96 && !readMarked) { readMarked = true; markChapterRead(); }
            clearTimeout(saveTimer);
            saveTimer = setTimeout(() => saveProgress(pct), 600);
        }, { passive: true });
    }
    async function saveProgress(pct) {
        if (!API.isLoggedIn() || !manga || !currentChap) return;
        try {
            await API.me.setProgress(manga.id, {
                chapterId: currentChap.id,
                chapter:   currentChap.chapter,
                page:      Math.max(1, pct),   // % de défilement (1–100)
            });
        } catch (e) {}
    }
    async function restoreScroll() {
        if (!API.isLoggedIn()) return;
        try {
            const allProg = await API.me.progress();
            const prog = allProg[manga.id];
            if (prog && prog.chapterId === currentChap.id && prog.page > 2 && prog.page < 96) {
                const h = document.documentElement;
                const max = h.scrollHeight - h.clientHeight;
                window.scrollTo({ top: (prog.page / 100) * max, behavior: 'instant' in window ? 'instant' : 'auto' });
            }
        } catch (e) {}
    }
    async function markChapterRead() {
        if (!API.isLoggedIn()) return;
        try {
            await API.me.markChapter({
                mangaId: manga.id, chapterId: currentChap.id,
                chapter: currentChap.chapter, read: true,
            });
        } catch (e) {}
    }
    function markUpToHere() {
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

    // ── Raccourcis clavier ──
    function bindKeyboard() {
        document.addEventListener('keydown', e => {
            if (['TEXTAREA', 'INPUT', 'SELECT'].includes(e.target.tagName)) return;
            switch (e.key) {
                case 'ArrowRight': case 'n': case 'N': goChapter(1); break;
                case 'ArrowLeft':  case 'p': case 'P': goChapter(-1); break;
                case 's': case 'S': toggleSettings(); break;
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
            ${seg('theme', [{v:'dark',l:'Sombre'},{v:'black',l:'Noir'},{v:'sepia',l:'Sépia'},{v:'light',l:'Clair'}], ns.theme)}`;
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
