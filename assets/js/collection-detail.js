// collection-detail.js — Détail d'une liste de lecture réelle
(function () {
    'use strict';
    let list = null;
    const listId = new URLSearchParams(location.search).get('id');

    document.addEventListener('DOMContentLoaded', () => {
        MH.initPage('collections');
        load();
    });

    async function load() {
        if (!API.isLoggedIn()) return renderGuard('Connecte-toi pour voir cette liste.');
        if (!listId)          return renderGuard('Liste introuvable.');
        let lists = [];
        try { lists = await API.me.lists(); }
        catch (e) { return renderGuard('Erreur : ' + e.message); }
        list = lists.find(l => String(l.id) === String(listId));
        if (!list) return renderGuard('Liste introuvable ou supprimée.');
        document.getElementById('pageTitle').textContent = `Inko — ${list.name}`;
        render();
    }

    function renderGuard(msg) {
        document.getElementById('cdHero').innerHTML = '';
        document.getElementById('cdTabs').innerHTML = '';
        document.getElementById('cdSidebar').innerHTML = '';
        document.getElementById('cdContent').innerHTML = `
            <div class="card" style="padding:40px;text-align:center;color:var(--text2)">
                <div style="font-size:16px;font-weight:600;color:var(--text);margin-bottom:8px">${MH.esc(msg)}</div>
                <a href="collections.html" class="btn btn-primary btn-sm" style="margin-top:10px">← Mes listes</a>
            </div>`;
    }

    function render() {
        renderHero();
        document.getElementById('cdTabs').innerHTML = '';
        renderContent();
        renderSidebar();
    }

    function srcOf(m) { return m.source || API.sources.current; }

    function renderHero() {
        const el = document.getElementById('cdHero');
        const items = list.items || [];
        el.innerHTML = `
        <div class="cd-hero-inner">
            <div>
                <div class="cd-breadcrumb"><a href="collections.html">Mes listes</a> / <span>${MH.esc(list.name)}</span></div>
                <div class="cd-collection-type">${list.isPublic ? 'LISTE PUBLIQUE' : 'LISTE PRIVÉE'}</div>
                <h1 class="cd-title">${MH.esc(list.name)}</h1>
                ${list.description ? `<p class="cd-desc">${MH.esc(list.description)}</p>` : ''}
                <div class="cd-stats-row">
                    <div class="cd-stat"><div class="cd-stat-num">${items.length}</div><div class="cd-stat-label">Séries</div></div>
                </div>
                <div class="cd-actions">
                    ${items.length ? `<a href="serie.html?id=${encodeURIComponent(items[0].id)}&source=${encodeURIComponent(srcOf(items[0]))}" class="btn btn-primary">Commencer</a>` : ''}
                    <button class="btn btn-secondary" id="cdShare">Partager</button>
                    <button class="btn btn-ghost" id="cdDelete">Supprimer la liste</button>
                </div>
            </div>
        </div>`;
        document.getElementById('cdShare')?.addEventListener('click', async () => {
            // collection-detail.html?id= est authentifiée : la copier ne partage
            // rien d'ouvrable par autrui. On renvoyait donc vers le PROFIL du
            // propriétaire — un lien où la liste n'est qu'une entrée parmi
            // d'autres, et qui n'ouvre rien du tout si le profil est privé.
            //
            // Audit AMEL-36 : liste.html?id= est l'adresse de la liste
            // elle-même, ouverte à tous, servie par la route publique
            // /api/lists/:id qui existait déjà sans consommateur.
            if (!list.isPublic) {
                MH.toast?.('Cette liste est privée. Rends-la publique pour pouvoir la partager.');
                return;
            }
            // Le serveur refuse aussi une liste publique quand le PROFIL est
            // privé — c'est voulu (rendre une liste publique ne doit pas
            // contourner la confidentialité du compte). Mais sans cet
            // avertissement, on copie un lien qui affichera « cette liste
            // n'existe pas » à tout le monde, sans jamais comprendre pourquoi.
            try {
                const st = await API.me.settings();
                if (st?.privacy?.privateProfile) {
                    const ok = await MH.confirm(
                        'Ton profil est réglé sur « privé » : le lien affichera « liste introuvable » '
                        + 'pour les autres, même si la liste est publique.\n\n'
                        + 'Copier le lien quand même ?',
                        { okText: 'Copier quand même', cancelText: 'Annuler' });
                    if (!ok) return;
                }
            } catch (e) { /* réglages indisponibles : on n'empêche pas le partage */ }
            const url = `${location.origin}/liste.html?id=${encodeURIComponent(list.id)}`;
            if (navigator.clipboard) navigator.clipboard.writeText(url)
                .then(() => MH.toast?.('Lien de partage copié')).catch(() => MH.toast?.(url));
            else MH.toast?.(url);
        });
        document.getElementById('cdDelete')?.addEventListener('click', async () => {
            if (!await MH.confirm(`Supprimer la liste « ${list.name} » ?`, { danger: true, okText: 'Supprimer' })) return;
            try { await API.me.deleteList(list.id); MH.toast?.('Liste supprimée'); location.href = 'collections.html'; }
            catch (e) { MH.toast?.('Erreur : ' + e.message); }
        });
    }

    function renderContent() {
        const el = document.getElementById('cdContent');
        const items = list.items || [];
        if (!items.length) {
            el.innerHTML = `
                <div class="card" style="padding:40px;text-align:center;color:var(--text2)">
                    <div style="font-size:15px;font-weight:600;color:var(--text);margin-bottom:6px">Cette liste est vide</div>
                    <div style="font-size:13px">Ajoute des séries depuis leur page avec le bouton « Ajouter à une liste ».</div>
                    <a href="catalogue.html" class="btn btn-primary btn-sm" style="margin-top:14px">Explorer le catalogue</a>
                </div>`;
            return;
        }
        el.innerHTML = `
            <div style="font-size:13px;color:var(--text2);margin-bottom:14px"><strong style="color:var(--text)">${items.length}</strong> série(s)</div>
            <div class="cd-series-grid">
                ${items.map(m => `
                <div class="cd-serie-card" draggable="true" data-id="${MH.esc(m.id)}">
                    <a href="serie.html?id=${encodeURIComponent(m.id)}&source=${encodeURIComponent(srcOf(m))}" class="cd-serie-card-cover">
                        ${m.cover ? `<img src="${MH.esc(m.cover)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">` : '<div class="cd-serie-card-noimg"></div>'}
                    </a>
                    <div class="cd-serie-card-title">${MH.esc(m.title || 'Sans titre')}</div>
                    <div class="cd-serie-card-actions">
                        <a href="serie.html?id=${encodeURIComponent(m.id)}&source=${encodeURIComponent(srcOf(m))}" class="btn btn-secondary btn-sm" style="flex:1">Ouvrir</a>
                        <button class="list-icon-btn" data-remove="${MH.esc(m.id)}" title="Retirer de la liste">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="15" height="15"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                    </div>
                </div>`).join('')}
            </div>`;
        el.querySelectorAll('[data-remove]').forEach(b => b.addEventListener('click', () => removeItem(b.dataset.remove)));
        armerReordonnancement(el.querySelector('.cd-series-grid'));
    }

    // ── Réordonnancement (audit AMEL-37) ─────────────────────
    // `list_items.position` servait DÉJÀ au tri (ORDER BY position, added_at)
    // mais aucune route ne l'écrivait : elle valait 0 partout, si bien que
    // l'ordre affiché était en réalité l'ordre d'ajout, sans moyen de le
    // changer. On range une liste de lecture par priorité, pas par date.
    function armerReordonnancement(grille) {
        if (!grille || grille.dataset.dnd === '1') return;
        grille.dataset.dnd = '1';
        let source = null;

        grille.addEventListener('dragstart', (e) => {
            source = e.target.closest('.cd-serie-card');
            if (!source) return;
            source.classList.add('cd-dragging');
            e.dataTransfer.effectAllowed = 'move';
            // Firefox n'amorce pas le glissement sans données attachées.
            try { e.dataTransfer.setData('text/plain', source.dataset.id); } catch (err) { /* noop */ }
        });
        grille.addEventListener('dragend', () => {
            source?.classList.remove('cd-dragging');
            grille.querySelectorAll('.cd-drop-before').forEach(x => x.classList.remove('cd-drop-before'));
            source = null;
        });
        grille.addEventListener('dragover', (e) => {
            if (!source) return;
            e.preventDefault();                       // sans ça, le dépôt est refusé
            const cible = e.target.closest('.cd-serie-card');
            grille.querySelectorAll('.cd-drop-before').forEach(x => x.classList.remove('cd-drop-before'));
            if (cible && cible !== source) cible.classList.add('cd-drop-before');
        });
        grille.addEventListener('drop', async (e) => {
            if (!source) return;
            e.preventDefault();
            const cible = e.target.closest('.cd-serie-card');
            grille.querySelectorAll('.cd-drop-before').forEach(x => x.classList.remove('cd-drop-before'));
            if (!cible || cible === source) return;
            grille.insertBefore(source, cible);

            const ordre = [...grille.querySelectorAll('.cd-serie-card')].map(c => c.dataset.id);
            // L'ordre local est réaligné AVANT l'appel : un rendu ultérieur
            // repartirait sinon de l'ancien tableau et annulerait visuellement
            // le déplacement qu'on vient de faire.
            list.items = ordre.map(id => (list.items || []).find(it => String(it.id) === String(id)))
                .filter(Boolean);
            try {
                await API.me.reorderList(list.id, ordre);
            } catch (err) {
                MH.toast?.('Ordre non enregistré : ' + err.message);
            }
        });
    }

    async function removeItem(mangaId) {
        try {
            await API.me.removeFromList(list.id, mangaId);
            list.items = (list.items || []).filter(it => String(it.id) !== String(mangaId));
            MH.toast?.('Retiré de la liste');
            renderHero(); renderContent();
        } catch (e) { MH.toast?.('Erreur : ' + e.message); }
    }

    function renderSidebar() {
        const el = document.getElementById('cdSidebar');
        el.innerHTML = `
        <div class="cd-sidebar-block">
            <div class="cd-sidebar-title">À propos</div>
            <div style="font-size:13px;color:var(--text2);line-height:1.6">
                ${list.description ? MH.esc(list.description) : 'Aucune description.'}
            </div>
            <div style="margin-top:12px;font-size:12px;color:var(--text3)">
                ${list.isPublic ? 'Visible par tous' : 'Visible par toi seulement'}
                ${list.createdAt ? ` · créée le ${new Date(list.createdAt).toLocaleDateString('fr-FR')}` : ''}
            </div>
        </div>
        <div class="cd-sidebar-block">
            <a href="collections.html" class="btn btn-secondary btn-sm" style="width:100%">← Toutes mes listes</a>
        </div>`;
    }
})();
