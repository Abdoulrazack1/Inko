// recherche.js — Recherche globale multi-sources
(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', async () => {
        MH.initPage('recherche');
        MH.loadSourceTypes();   // pour badger les groupes Romans
        await window.UserData?.ready?.();
        const input = document.getElementById('seInput');
        const q = new URLSearchParams(location.search).get('q') || '';
        if (q) { input.value = q; run(q); } else { renderHistory(); renderSuggestions(); }
        input.focus();

        document.getElementById('seGo').addEventListener('click', () => go(input.value));
        input.addEventListener('keydown', e => { if (e.key === 'Enter') go(input.value); });
    });

    // ── Historique de recherche (UserData) ──
    function renderHistory() {
        const el = document.getElementById('seHist');
        if (!el || !window.UserData) return;
        const items = UserData.getSearchHistory();
        if (!items.length) { el.style.display = 'none'; return; }
        el.style.display = 'flex';
        el.innerHTML = `<span class="se-hist-label">Recherches récentes :</span>` +
            items.map(q => `<span class="se-chip" data-q="${MH.esc(q)}">${MH.esc(q)}<span class="x" data-del="${MH.esc(q)}" title="Retirer">×</span></span>`).join('') +
            `<button class="se-hist-clear" id="seHistClear">tout effacer</button>`;
        el.querySelectorAll('.se-chip').forEach(c => c.addEventListener('click', (e) => {
            if (e.target.dataset.del != null) {
                UserData.pushSearch(''); // no-op guard
                const rest = UserData.getSearchHistory().filter(x => x !== e.target.dataset.del);
                UserData.clearSearchHistory(); rest.reverse().forEach(x => UserData.pushSearch(x));
                renderHistory();
                return;
            }
            const q = c.dataset.q;
            document.getElementById('seInput').value = q;
            go(q);
        }));
        document.getElementById('seHistClear')?.addEventListener('click', () => { UserData.clearSearchHistory(); renderHistory(); });
    }

    // ── Suggestions populaires quand la barre est vide ──
    async function renderSuggestions() {
        const out = document.getElementById('seResults');
        const sub = document.getElementById('seSub');
        if (!out) return;
        out.innerHTML = `<div class="se-loading"><div class="spinner-inline"></div> Suggestions…</div>`;
        try {
            const data = await API.mangas.popular({ limit: 18 });
            const list = data.results || [];
            if (!list.length) { out.innerHTML = ''; return; }
            if (sub) sub.textContent = 'Populaires en ce moment — ou tape un titre ci-dessus.';
            out.innerHTML = `<div class="se-group"><div class="se-ghead"><span class="se-gname">Populaires</span></div>
                <div class="se-grid">${list.map(m => `
                    <a class="se-card manga-card" href="serie.html?id=${encodeURIComponent(m.id)}&source=${encodeURIComponent(API.sources.current)}" data-manga-id="${m.id}">
                        <div class="se-cover"><img src="${m.cover || m.coverThumb || MH.placeholderCover(m.id)}" alt="${MH.esc(m.title||'')}" loading="lazy" onerror="this.src='${MH.placeholderCover(m.id)}'"></div>
                        <div class="se-title">${MH.esc(m.title || m.id)}</div>
                    </a>`).join('')}</div></div>`;
        } catch (e) { out.innerHTML = ''; }
    }

    function go(q) {
        q = (q || '').trim();
        if (!q) return;
        window.UserData?.pushSearch?.(q);
        history.replaceState({}, '', 'recherche.html?q=' + encodeURIComponent(q));
        run(q);
    }

    let lastGroups = [];
    let typeFilter = 'all';   // 'all' | 'manga' | 'novel'

    async function run(q) {
        const out = document.getElementById('seResults');
        const sub = document.getElementById('seSub');
        window.UserData?.pushSearch?.(q);
        renderHistory();
        sub.textContent = `Recherche de « ${q} » sur toutes les sources…`;
        out.innerHTML = `<div class="se-loading"><div class="spinner-inline"></div> Recherche en cours…</div>`;
        try {
            const data = await API.mangas.searchAll(q);
            lastGroups = data.groups || [];
            renderResults(q);
        } catch (e) {
            sub.textContent = '';
            out.innerHTML = `<div class="se-err">Erreur : ${MH.esc(e.message)}</div>`;
        }
    }

    function renderResults(q) {
        const out = document.getElementById('seResults');
        const sub = document.getElementById('seSub');
        const groups = lastGroups.filter(g =>
            typeFilter === 'all' ? true :
            typeFilter === 'novel' ? MH.isNovelSource(g.source) : !MH.isNovelSource(g.source));
        const nManga = lastGroups.filter(g => !MH.isNovelSource(g.source)).reduce((n, g) => n + (g.items?.length || 0), 0);
        const nNovel = lastGroups.filter(g => MH.isNovelSource(g.source)).reduce((n, g) => n + (g.items?.length || 0), 0);
        const totalItems = groups.reduce((n, g) => n + (g.items?.length || 0), 0);

        // Puces de filtre par type (n'apparaissent que s'il y a des deux)
        let chips = '';
        if (nManga && nNovel) {
            const c = (val, label, count) => `<button class="se-chip ${typeFilter === val ? 'on' : ''}" data-type="${val}">${label}${count != null ? ` · ${count}` : ''}</button>`;
            chips = `<div class="se-types" style="display:flex;gap:8px;margin-bottom:16px">${c('all', 'Tout', nManga + nNovel)}${c('manga', 'Mangas', nManga)}${c('novel', 'Romans', nNovel)}</div>`;
        }

        sub.textContent = `${totalItems} résultat(s) pour « ${q} » sur ${groups.length} source(s).`;
        if (!totalItems) {
            out.innerHTML = chips + `<div class="se-empty">Aucun résultat ${typeFilter !== 'all' ? 'dans cette catégorie' : '. Essaie un autre titre ou vérifie tes sources'}.</div>`;
        } else {
            out.innerHTML = chips + groups.map(g => renderGroup(g)).join('');
        }
        out.querySelectorAll('.se-chip[data-type]').forEach(b => b.addEventListener('click', () => {
            typeFilter = b.dataset.type; renderResults(q);
        }));
    }

    function renderGroup(g) {
        const head = `
            <div class="se-ghead">
                <span class="se-gname">${MH.esc(g.sourceName)}</span>
                ${MH.isNovelSource(g.source) ? '<span class="se-gtag" style="background:#7c3aed;color:#fff">ROMAN</span>' : '<span class="se-gtag">MANGA</span>'}
                ${g.lang ? `<span class="se-gtag">${MH.esc(g.lang)}</span>` : ''}
                <span class="se-gcount">${g.error ? '' : (g.items.length + ' résultat(s)')}</span>
            </div>`;
        if (g.error) return `<div class="se-group">${head}<div class="se-err">Indisponible : ${MH.esc(g.error)}</div></div>`;
        if (!g.items.length) return `<div class="se-group">${head}<div class="se-empty">Aucun résultat ici.</div></div>`;
        const cards = g.items.map(m => `
            <a class="se-card manga-card" href="serie.html?id=${encodeURIComponent(m.id)}&source=${encodeURIComponent(g.source)}" data-manga-id="${m.id}">
                <div class="se-cover">
                    <img src="${m.cover || m.coverThumb || MH.placeholderCover(m.id)}" alt="${MH.esc(m.title || '')}" loading="lazy"
                         onerror="this.src='${MH.placeholderCover(m.id)}'">
                </div>
                <div class="se-title">${MH.esc(m.title || m.id)}</div>
            </a>`).join('');
        return `<div class="se-group">${head}<div class="se-grid">${cards}</div></div>`;
    }
})();
