// sources.js — Liste / activation des extensions
(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', async () => {
        MH.initPage('sources');
        await render();
    });

    async function render() {
        const el = document.getElementById('sourcesGrid');
        if (!el) return;

        let sources;
        try { sources = await API.sources.list(); }
        catch (e) {
            el.innerHTML = `<div class="empty-state" style="color:#ef4444">Erreur : ${MH.esc(e.message)}</div>`;
            return;
        }

        if (!sources.length) {
            el.innerHTML = `
            <div class="empty-state">
                <div style="font-size:36px;margin-bottom:8px"></div>
                <div style="font-size:15px;color:var(--text);font-weight:500;margin-bottom:6px">Aucune extension installée</div>
                <div style="font-size:12.5px">Place une source dans <code>server/extensions/&lt;id&gt;/index.js</code> et redémarre le backend.</div>
            </div>`;
            return;
        }

        const active = API.sources.current || sources[0].id;

        const card = (s) => `
        <div class="source-card ${s.id === active ? 'active' : ''}" data-id="${MH.esc(s.id)}">
            <div class="source-icon">${MH.esc((s.name || '?')[0])}</div>
            <div class="source-meta">
                <div class="source-name">
                    ${MH.esc(s.name)}
                    <span class="source-version">v${MH.esc(s.version)}</span>
                    <span class="source-lang">${MH.esc(s.lang || '—')}</span>
                    ${s.type === 'novel' ? '<span class="source-type-badge">ROMAN</span>' : ''}
                    ${s.nsfw ? '<span class="source-nsfw">NSFW</span>' : ''}
                </div>
                <div class="source-desc">${MH.esc(s.description || '')}</div>
                <div class="source-caps">
                    ${(s.capabilities || []).map(c => `<span class="source-cap">${MH.esc(c)}</span>`).join('')}
                </div>
                <div style="font-size:10.5px;color:var(--text3);margin-top:4px">
                    ${MH.esc(s.baseUrl || '')}
                </div>
            </div>
            <div class="source-actions">
                ${s.id === active
                    ? '<span class="source-active-badge">✓ ACTIVE</span>'
                    : `<button class="btn btn-primary btn-sm" data-activate="${MH.esc(s.id)}">Activer</button>`}
            </div>
        </div>`;

        // Séparation claire : mangas d'un côté, romans de l'autre
        const mangas = sources.filter(s => (s.type || 'manga') !== 'novel');
        const novels = sources.filter(s => s.type === 'novel');
        const group = (title, sub, list) => list.length ? `
            <div class="sources-group">
                <div class="sources-group-head">
                    <h2 class="sources-group-title">${title}</h2>
                    <span class="sources-group-sub">${sub}</span>
                    <span class="sources-group-count">${list.length}</span>
                </div>
                ${list.map(card).join('')}
            </div>` : '';

        el.innerHTML =
            group('Mangas', 'Lecture en images', mangas) +
            group('Romans', 'Light novels & web novels — lecture en texte', novels);

        el.querySelectorAll('[data-activate]').forEach(btn => {
            btn.addEventListener('click', () => {
                API.sources.current = btn.dataset.activate;
                MH.toast('Source activée : ' + btn.dataset.activate);
                render();
            });
        });
    }
})();
