// collections.js — Gestionnaire de listes de lecture (réel, via API)
(function () {
    'use strict';

    let lists = [];
    let editId = null;   // id de la liste en cours d'édition (null = création)

    document.addEventListener('DOMContentLoaded', () => {
        MH.initPage('collections');
        wireModal();
        document.getElementById('btnNewList')?.addEventListener('click', () => openModal());
        load();
        window.addEventListener('auth:change', load);
    });

    async function load() {
        const state = document.getElementById('listsState');
        const grid = document.getElementById('listsGrid');
        if (!grid || !state) return;

        if (!API.isLoggedIn()) {
            grid.innerHTML = '';
            state.innerHTML = `
                <div class="lists-empty">
                    <div class="lists-empty-title">Connecte-toi pour créer tes listes</div>
                    <div class="lists-empty-desc">Garde tes séries organisées en collections personnalisées, synchronisées sur tous tes appareils.</div>
                    <a href="connexion.html" class="btn btn-primary" style="padding:0 22px;margin-top:14px">Se connecter</a>
                </div>`;
            return;
        }

        state.innerHTML = '<div style="text-align:center;padding:40px"><div class="spinner-inline"></div></div>';
        grid.innerHTML = '';
        try {
            lists = await API.me.lists();
        } catch (e) {
            state.innerHTML = `<div class="lists-empty"><div class="lists-empty-title">Erreur de chargement</div><div class="lists-empty-desc">${MH.esc(e.message)}</div></div>`;
            return;
        }

        if (!lists.length) {
            state.innerHTML = `
                <div class="lists-empty">
                    <div class="lists-empty-title">Aucune liste pour l'instant</div>
                    <div class="lists-empty-desc">Crée ta première collection pour ranger tes séries comme tu veux.</div>
                    <button class="btn btn-primary" id="emptyCreate" style="padding:0 22px;margin-top:14px">+ Créer une liste</button>
                </div>`;
            document.getElementById('emptyCreate')?.addEventListener('click', () => openModal());
            return;
        }

        state.innerHTML = '';
        renderGrid();
    }

    function renderGrid() {
        const grid = document.getElementById('listsGrid');
        if (!grid) return;
        grid.innerHTML = lists.map(l => {
            const items = l.items || [];
            const covers = items.filter(it => it.cover).slice(0, 4);
            const mosaic = covers.length
                ? covers.map(it => `<img src="${MH.esc(it.cover)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">`).join('')
                : `<div class="list-cover-empty">Liste vide</div>`;
            return `
            <div class="list-card">
                <a href="collection-detail.html?id=${l.id}" class="list-card-cover ${covers.length ? 'has-' + covers.length : 'is-empty'}">
                    ${mosaic}
                    <span class="list-card-count">${items.length}</span>
                </a>
                <div class="list-card-body">
                    <a href="collection-detail.html?id=${l.id}" class="list-card-title">${MH.esc(l.name)}</a>
                    ${l.description ? `<div class="list-card-desc">${MH.esc(l.description)}</div>` : ''}
                    <div class="list-card-footer">
                        <span class="list-card-vis">${l.isPublic ? 'Publique' : 'Privée'}</span>
                        <div class="list-card-actions">
                            <button class="list-icon-btn" data-edit="${l.id}" title="Modifier">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="15" height="15"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                            </button>
                            <button class="list-icon-btn" data-del="${l.id}" title="Supprimer">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="15" height="15"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>`;
        }).join('');

        grid.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => {
            const l = lists.find(x => String(x.id) === b.dataset.edit);
            if (l) openModal(l);
        }));
        grid.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => deleteList(b.dataset.del)));
    }

    async function deleteList(id) {
        const l = lists.find(x => String(x.id) === String(id));
        if (!l) return;
        if (!confirm(`Supprimer la liste « ${l.name} » ? Cette action est définitive.`)) return;
        try {
            await API.me.deleteList(id);
            MH.toast?.('Liste supprimée');
            load();
        } catch (e) { MH.toast?.('Erreur : ' + e.message); }
    }

    // ── Modale ──
    function openModal(list) {
        editId = list ? list.id : null;
        document.getElementById('listModalTitle').textContent = list ? 'Modifier la liste' : 'Nouvelle liste';
        document.getElementById('listName').value = list ? (list.name || '') : '';
        document.getElementById('listDesc').value = list ? (list.description || '') : '';
        document.getElementById('listPublic').checked = list ? !!list.isPublic : false;
        const modal = document.getElementById('listModal');
        modal.style.display = 'flex';
        setTimeout(() => document.getElementById('listName')?.focus(), 50);
    }
    function closeModal() {
        document.getElementById('listModal').style.display = 'none';
        editId = null;
    }
    function wireModal() {
        document.getElementById('listModalClose')?.addEventListener('click', closeModal);
        document.getElementById('listCancel')?.addEventListener('click', closeModal);
        document.getElementById('listModal')?.addEventListener('click', e => {
            if (e.target.id === 'listModal') closeModal();
        });
        document.getElementById('listSave')?.addEventListener('click', save);
    }
    async function save() {
        const name = document.getElementById('listName').value.trim();
        if (!name) { MH.toast?.('Donne un nom à ta liste'); return; }
        const payload = {
            name,
            description: document.getElementById('listDesc').value.trim() || null,
            isPublic: document.getElementById('listPublic').checked,
        };
        const btn = document.getElementById('listSave');
        btn.disabled = true;
        try {
            if (editId) { await API.me.updateList(editId, payload); MH.toast?.('Liste mise à jour'); }
            else        { await API.me.createList(payload);        MH.toast?.('Liste créée'); }
            closeModal();
            load();
        } catch (e) { MH.toast?.('Erreur : ' + e.message); }
        finally { btn.disabled = false; }
    }
})();
