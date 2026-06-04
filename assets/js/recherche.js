// recherche.js — Recherche globale multi-sources
(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', () => {
        MH.initPage('recherche');
        const input = document.getElementById('seInput');
        const q = new URLSearchParams(location.search).get('q') || '';
        if (q) { input.value = q; run(q); }
        input.focus();

        document.getElementById('seGo').addEventListener('click', () => go(input.value));
        input.addEventListener('keydown', e => { if (e.key === 'Enter') go(input.value); });
    });

    function go(q) {
        q = (q || '').trim();
        if (!q) return;
        history.replaceState({}, '', 'recherche.html?q=' + encodeURIComponent(q));
        run(q);
    }

    async function run(q) {
        const out = document.getElementById('seResults');
        const sub = document.getElementById('seSub');
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
