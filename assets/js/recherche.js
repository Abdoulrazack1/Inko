// recherche.js — Recherche globale multi-sources
(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', async () => {
        MH.initPage('recherche');
        MH.loadSourceTypes();   // pour badger les groupes Romans
        await window.UserData?.ready?.();
        const input = document.getElementById('seInput');
        const q = new URLSearchParams(location.search).get('q') || '';
        if (q) { input.value = q; run(q); } else { renderHistory(); }
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

    function go(q) {
        q = (q || '').trim();
        if (!q) return;
        window.UserData?.pushSearch?.(q);
        history.replaceState({}, '', 'recherche.html?q=' + encodeURIComponent(q));
        run(q);
    }

    async function run(q) {
        const out = document.getElementById('seResults');
        const sub = document.getElementById('seSub');
        window.UserData?.pushSearch?.(q);
        renderHistory();
        sub.textContent = `Recherche de « ${q} » sur toutes les sources…`;
        out.innerHTML = `<div class="se-loading"><div class="spinner-inline"></div> Recherche en cours…</div>`;
        try {
            const data = await API.mangas.searchAll(q);
            const groups = data.groups || [];
            const totalItems = groups.reduce((n, g) => n + (g.items?.length || 0), 0);
            sub.textContent = `${totalItems} résultat(s) pour « ${q} » sur ${groups.length} source(s).`;
            if (!totalItems) {
                out.innerHTML = `<div class="se-empty">Aucun résultat. Essaie un autre titre ou vérifie tes sources.</div>`;
                return;
            }
            out.innerHTML = groups.map(g => renderGroup(g)).join('');
        } catch (e) {
            sub.textContent = '';
            out.innerHTML = `<div class="se-err">Erreur : ${MH.esc(e.message)}</div>`;
        }
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
