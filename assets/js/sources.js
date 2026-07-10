// sources.js — Liste / activation des extensions
(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', async () => {
        MH.initPage('sources');
        await render();
        wireUpdates();
    });

    // ── Mises à jour des extensions (modèle Mihon) ──
    function wireUpdates() {
        const btn = document.getElementById('btnCheckExt');
        const allBtn = document.getElementById('btnUpdateAll');
        const status = document.getElementById('extStatus');
        const box = document.getElementById('extUpdates');
        if (!btn) return;

        // Installer/mettre à jour une extension écrit un .js exécuté côté serveur pour
        // toute l'instance : réservé aux admins (audit §7.3, route /extensions/update).
        const isAdmin = API.user?.role === 'admin';
        if (!isAdmin) {
            btn.style.display = 'none';
            allBtn.style.display = 'none';
            if (status) status.textContent = 'La gestion des extensions est réservée aux administrateurs.';
            return;
        }

        async function check() {
            btn.disabled = true;
            status.innerHTML = '<span class="spinner-inline" style="width:12px;height:12px;border-width:1px"></span> Recherche de mises à jour…';
            box.innerHTML = ''; allBtn.style.display = 'none';
            try {
                const data = await API.sources.checkUpdates();
                const ups = (data.installed || []).filter(x => x.hasUpdate);
                const news = data.available || [];
                if (!ups.length && !news.length) {
                    status.textContent = `Toutes les extensions sont à jour ✓ (source : ${data.source === 'github' ? 'dépôt' : 'local'})`;
                    return;
                }
                status.textContent = `${ups.length} mise(s) à jour · ${news.length} nouvelle(s) source(s)`;
                allBtn.style.display = '';
                box.innerHTML = [...ups, ...news.map(n => ({ ...n, current: '—', name: n.id, isNew: true }))].map(u => `
                    <div class="source-card" style="padding:12px 16px">
                        <div class="source-meta">
                            <div class="source-name">${MH.esc(u.name || u.id)} ${u.isNew ? '<span class="source-type-badge" style="background:#22c55e">NOUVEAU</span>' : ''}</div>
                            <div class="source-desc">${u.isNew ? `Nouvelle source disponible · v${u.latest}` : `v${u.current} → <strong style="color:var(--orange)">v${u.latest}</strong>`}</div>
                        </div>
                        <div class="source-actions">
                            <button class="btn btn-secondary btn-sm" data-upd="${MH.esc(u.id)}">${u.isNew ? 'Installer' : 'Mettre à jour'}</button>
                        </div>
                    </div>`).join('');
                box.querySelectorAll('[data-upd]').forEach(b => b.addEventListener('click', () => doUpdate([b.dataset.upd], b)));
            } catch (e) {
                status.textContent = 'Erreur : ' + e.message;
            } finally { btn.disabled = false; }
        }

        async function doUpdate(ids, btnEl) {
            if (!API.isLoggedIn()) { MH.toast?.('Connecte-toi pour installer des mises à jour'); return; }
            if (btnEl) { btnEl.disabled = true; btnEl.textContent = '…'; }
            else { allBtn.disabled = true; allBtn.textContent = 'Installation…'; }
            try {
                const r = await API.sources.update(ids);
                MH.toast?.(`${(r.updated || []).length} extension(s) mise(s) à jour`);
                await render();      // recharge la liste (nouvelles versions)
                await check();       // rafraîchit l'état des MAJ
            } catch (e) { MH.toast?.('Erreur : ' + e.message); }
            finally { if (allBtn) { allBtn.disabled = false; allBtn.textContent = 'Tout mettre à jour'; } }
        }

        btn.addEventListener('click', check);
        allBtn.addEventListener('click', () => doUpdate(null, null));
        check();   // recherche automatique des mises à jour au chargement

        // Les extensions ne s'installent plus par URL : elles sont publiées
        // uniquement via les nouvelles versions de l'app (logique release-only).
    }

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

        const card = (s) => {
        const disabled = !MH.isSourceEnabled(s.id);
        return `
        <div class="source-card ${s.id === active ? 'active' : ''}" data-id="${MH.esc(s.id)}" style="${disabled ? 'opacity:.55' : ''}">
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
                ${disabled
                    ? `<span class="source-active-badge" style="background:var(--bg4);color:var(--text3)">DÉSACTIVÉE</span>`
                    : (s.id === active
                        ? '<span class="source-active-badge">✓ ACTIVE</span>'
                        : `<button class="btn btn-primary btn-sm" data-activate="${MH.esc(s.id)}">Activer</button>`)}
                <button class="btn btn-secondary btn-sm" data-test="${MH.esc(s.id)}" title="Vérifier que la source répond">Tester</button>
                <button class="btn btn-secondary btn-sm" data-toggle-src="${MH.esc(s.id)}" title="${disabled ? 'Réactiver cette source' : 'Ne plus utiliser cette source (masquée en recherche)'}">${disabled ? 'Réactiver' : 'Désactiver'}</button>
                <span class="source-test-result" data-test-result="${MH.esc(s.id)}" style="font-size:11px;margin-left:6px"></span>
            </div>
        </div>`;
        };

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

        // Activer / Désactiver une source (audit §9) : une source désactivée est
        // exclue de la recherche multi-sources et ne peut pas devenir la source active.
        el.querySelectorAll('[data-toggle-src]').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.toggleSrc;
                const nowDisabled = MH.setSourceDisabled(id, MH.isSourceEnabled(id));
                if (nowDisabled && API.sources.current === id) {
                    // On bascule la source active vers une autre source encore active.
                    const fallback = sources.find(s => s.id !== id && MH.isSourceEnabled(s.id));
                    if (fallback) API.sources.current = fallback.id;
                }
                MH.toast(nowDisabled ? 'Source désactivée' : 'Source réactivée');
                render();
            });
        });

        // Tester la connexion d'une source (audit §7.3 rec 2) : appel léger, on
        // affiche succès ✓ ou l'erreur brute à côté du bouton.
        el.querySelectorAll('[data-test]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.test;
                const out = el.querySelector(`[data-test-result="${CSS.escape(id)}"]`);
                btn.disabled = true; const prev = btn.textContent; btn.textContent = '…';
                if (out) { out.style.color = 'var(--text3)'; out.textContent = 'test en cours…'; }
                try {
                    const r = await API.sources.test(id);
                    if (out) {
                        out.style.color = r.ok ? '#22c55e' : '#ef4444';
                        out.textContent = r.ok ? `✓ répond (${r.count} résultat${r.count > 1 ? 's' : ''})` : `✗ ${r.error || 'échec'}`;
                    }
                } catch (e) {
                    if (out) { out.style.color = '#ef4444'; out.textContent = '✗ ' + (e.message || 'échec'); }
                } finally { btn.disabled = false; btn.textContent = prev; }
            });
        });
    }
})();
