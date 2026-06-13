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

        el.innerHTML = sources.map(s => `
        <div class="source-card ${s.id === active ? 'active' : ''}" data-id="${MH.esc(s.id)}">
            <div class="source-icon">${MH.esc((s.name || '?')[0])}</div>
            <div class="source-meta">
                <div class="source-name">
                    ${MH.esc(s.name)}
                    <span class="source-version">v${MH.esc(s.version)}</span>
                    <span class="source-lang">${MH.esc(s.lang || '—')}</span>
                    ${s.type === 'novel' ? '<span class="source-lang" style="background:#7c3aed;color:#fff" title="Source de romans — lecture en texte">ROMANS</span>' : ''}
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
        </div>
        `).join('');

        el.querySelectorAll('[data-activate]').forEach(btn => {
            btn.addEventListener('click', () => {
                API.sources.current = btn.dataset.activate;
                MH.toast('Source activée : ' + btn.dataset.activate);
                render();
            });
        });
    }
})();
