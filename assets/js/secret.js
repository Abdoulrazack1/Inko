// secret.js — Catalogue +18 verrouillé
(function () {
    'use strict';

    const PER_PAGE = 24;
    let currentPage = 1;
    let lastQuery   = '';
    let mode        = 'popular'; // popular | search
    let total       = 0;

    document.addEventListener('DOMContentLoaded', () => {
        MH.initPage('secret');

        // Pas activé du tout → renvoyer aux paramètres
        if (!window.NSFW.isEnabled()) {
            window.location.replace('parametres.html');
            return;
        }

        if (window.NSFW.isUnlocked()) {
            showContent();
        } else {
            bindLock();
        }
    });

    function bindLock() {
        const input = document.getElementById('pinInput');
        const btn   = document.getElementById('btnUnlock');
        input?.focus();

        async function attempt() {
            const ok = await window.NSFW.unlock(input.value);
            if (ok) { showContent(); }
            else {
                input.value = '';
                input.style.borderColor = 'var(--red)';
                MH.toast('Code incorrect');
                setTimeout(() => input.style.borderColor = '', 800);
            }
        }
        btn?.addEventListener('click', attempt);
        input?.addEventListener('keydown', e => { if (e.key === 'Enter') attempt(); });
    }

    function showContent() {
        document.getElementById('lockScreen').style.display = 'none';
        document.getElementById('secretContent').style.display = '';

        document.getElementById('lockNow')?.addEventListener('click', e => {
            e.preventDefault();
            window.NSFW.lock();
            window.location.reload();
        });

        renderQuickFilters();
        run();
    }

    function renderQuickFilters() {
        const el = document.getElementById('quickFilters');
        if (!el) return;
        el.innerHTML = `
            <input type="text" id="secSearch" class="set-input" placeholder="🔍 Rechercher…"
                   style="background:var(--bg3);border:1px solid var(--border2);color:var(--text);padding:9px 12px;border-radius:8px;font-size:13px;max-width:320px;width:100%">`;
        const inp = document.getElementById('secSearch');
        let t;
        inp.addEventListener('input', () => {
            clearTimeout(t);
            t = setTimeout(() => {
                lastQuery = inp.value.trim();
                mode = lastQuery ? 'search' : 'popular';
                currentPage = 1;
                run();
            }, 350);
        });
    }

    async function run() {
        const grid = document.getElementById('resultsGrid');
        const count = document.getElementById('resultsCount');
        grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text3)"><div class="spinner-inline"></div></div>`;

        try {
            const params = { limit: PER_PAGE, offset: (currentPage - 1) * PER_PAGE, adult: 'only' };
            let data;
            if (mode === 'search') { params.q = lastQuery; data = await API.mangas.search(params); }
            else                   { data = await API.mangas.popular(params); }

            total = data.total || 0;
            const results = data.results || [];
            count.innerHTML = `<strong>${results.length}</strong> sur <strong>${MH.fmt(total)}</strong> titres`;

            if (!results.length) {
                grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text2)">Aucun résultat.</div>`;
            } else {
                grid.innerHTML = results.map(cardHTML).join('');
            }
            renderPagination();
        } catch (e) {
            grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:#ef4444">Erreur : ${MH.esc(e.message)}</div>`;
        }
    }

    function cardHTML(m) {
        return `
        <a href="serie.html?id=${encodeURIComponent(m.id)}" class="manga-card" data-manga-id="${m.id}">
            <div class="manga-card-cover">
                <img src="${m.cover || ''}" alt="${MH.esc(m.title)}" loading="lazy"
                     onerror="this.src='${MH.placeholderCover(m.id)}'">
                <div class="manga-card-badges">
                    <span class="badge" style="background:rgba(236,72,153,.85);color:#fff">+18</span>
                </div>
            </div>
            <div class="manga-card-info">
                <div class="manga-card-title">${MH.esc(m.title)}</div>
                <div class="manga-card-author">${MH.esc(m.author || '—')}</div>
                <div class="manga-card-tags">
                    ${(m.tags || []).slice(0, 2).map(t => `<span class="manga-card-tag">${MH.esc(t)}</span>`).join('')}
                </div>
            </div>
        </a>`;
    }

    function renderPagination() {
        const el = document.getElementById('pagination');
        if (!el) return;
        const pages = Math.ceil(total / PER_PAGE);
        if (pages <= 1) { el.innerHTML = ''; return; }
        let html = `<button class="page-btn" data-p="${currentPage-1}" ${currentPage===1?'disabled':''}>‹</button>`;
        for (let i = Math.max(1, currentPage-2); i <= Math.min(pages, currentPage+2); i++)
            html += `<button class="page-btn ${i===currentPage?'active':''}" data-p="${i}">${i}</button>`;
        html += `<button class="page-btn" data-p="${currentPage+1}" ${currentPage>=pages?'disabled':''}>›</button>`;
        el.innerHTML = html;
        el.querySelectorAll('[data-p]').forEach(b => b.addEventListener('click', () => {
            const p = +b.dataset.p;
            if (p < 1 || p > pages) return;
            currentPage = p;
            window.scrollTo({ top: 0, behavior: 'smooth' });
            run();
        }));
    }
})();
