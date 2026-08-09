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
                        <span class="list-card-vis">${l.isPublic ? 'Publique' : 'Privée'}${
    /* Audit AMEL-38 : une liste intelligente doit se distinguer d'une liste
       ordinaire — on n'y ajoute pas de titre à la main, son contenu change
       tout seul. Sans marqueur, on croirait à une liste qui se vide. */
    l.smart ? ' · <span class="list-card-smart">Intelligente</span>' : ''}</span>
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
        if (!await MH.confirm(`Supprimer la liste « ${l.name} » ? Cette action est définitive.`, { danger: true, okText: 'Supprimer' })) return;
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
        // Audit AMEL-38 : etat des regles, si la liste en a.
        const regles = list?.rules || null;
        document.getElementById('listSmart').checked = !!regles;
        document.getElementById('listRules').hidden = !regles;
        document.querySelectorAll('#listRuleStatus input').forEach(i => {
            i.checked = !!(regles?.status || []).includes(i.value);
        });
        document.getElementById('listRuleCategory').value = regles?.category || '';
        document.getElementById('listRuleRating').value = regles?.minRating ? String(regles.minRating) : '';
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
        document.getElementById('listSmart')?.addEventListener('change', (e) => {
            document.getElementById('listRules').hidden = !e.target.checked;
        });
    }
    async function save() {
        const name = document.getElementById('listName').value.trim();
        if (!name) { MH.toast?.('Donne un nom à ta liste'); return; }
        const payload = {
            name,
            description: document.getElementById('listDesc').value.trim() || null,
            isPublic: document.getElementById('listPublic').checked,
        };
        // Audit AMEL-38 : `rules: null` retire les regles et rend la liste
        // ordinaire — le champ est donc TOUJOURS envoye, sinon decocher la case
        // n'aurait aucun effet.
        if (document.getElementById('listSmart').checked) {
            const statuts = [...document.querySelectorAll('#listRuleStatus input:checked')].map(i => i.value);
            const cat = document.getElementById('listRuleCategory').value.trim();
            const note = document.getElementById('listRuleRating').value;
            const regles = {};
            if (statuts.length) regles.status = statuts;
            if (cat) regles.category = cat;
            if (note) regles.minRating = +note;
            if (!Object.keys(regles).length) {
                MH.toast?.('Choisis au moins un critere, sinon la liste prendrait toute ta bibliotheque');
                return;
            }
            payload.rules = regles;
        } else {
            payload.rules = null;
        }
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
