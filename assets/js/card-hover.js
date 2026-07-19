// ============================================================
// card-hover.js — Aperçu riche au survol d'une card manga
// ============================================================
// Au survol d'une `.manga-card[data-manga-id]`, affiche une infobulle
// flottante avec couverture, titre, auteur, statut, genres et synopsis.
// Les détails sont chargés à la volée (API.mangas.get) puis mis en cache.
// Désactivé sur écrans tactiles.
// ============================================================
(function () {
    'use strict';

    // Pas de hover sur tactile
    if (window.matchMedia && window.matchMedia('(hover: none)').matches) return;

    const detailCache = new Map();   // id → manga
    let tip, currentId, showTimer, hideTimer;

    function ensureTip() {
        if (tip) return tip;
        tip = document.createElement('div');
        tip.id = 'card-hover-tip';
        tip.style.cssText = `
            position: fixed; z-index: 9998; width: 320px; max-width: 86vw;
            background: var(--bg2, #141417); border: 1px solid var(--border2, rgba(255,255,255,.12));
            border-radius: 12px; box-shadow: 0 16px 50px rgba(0,0,0,.55);
            opacity: 0; transform: translateY(6px); pointer-events: none;
            transition: opacity .15s ease, transform .15s ease; overflow: hidden;
            font-family: var(--font-body, sans-serif);
        `;
        document.body.appendChild(tip);
        // Garde la tooltip ouverte si on la survole
        tip.addEventListener('mouseenter', () => { clearTimeout(hideTimer); tip.style.pointerEvents = 'auto'; });
        tip.addEventListener('mouseleave', hide);
        return tip;
    }

    const statusMap = {
        ongoing: ['#22c55e', 'En cours'], completed: ['#9ca3af', 'Terminé'],
        hiatus: ['#f59e0b', 'En pause'], cancelled: ['#ef4444', 'Annulé'],
    };

    function renderLoading(card) {
        const t = ensureTip();
        const title = card.querySelector('.manga-card-title, .lib2-title, .trending-title, .top-title')?.textContent?.trim() || '';
        t.innerHTML = `
            <div style="padding:16px">
                <div style="font-weight:600;font-size:14px;margin-bottom:8px">${esc(title)}</div>
                <div style="display:flex;align-items:center;gap:8px;color:var(--text3,#6b6b78);font-size:12px">
                    <span class="spinner-inline" style="width:13px;height:13px;border-width:1px"></span> Chargement…
                </div>
            </div>`;
    }

    function renderManga(m) {
        const t = ensureTip();
        const [col, label] = statusMap[m.status] || ['#a8a8b3', m.status || '—'];
        const desc = (m.description || '').slice(0, 260);
        t.innerHTML = `
            <div style="display:flex;gap:0">
                <img src="${m.cover || m.coverThumb || ''}" alt=""
                     style="width:96px;height:140px;object-fit:cover;flex-shrink:0;background:var(--bg4,#1f1f26)"
                     onerror="this.style.visibility='hidden'">
                <div style="padding:12px 14px;min-width:0">
                    <div style="font-weight:700;font-size:14.5px;line-height:1.25;margin-bottom:5px">${esc(m.title)}</div>
                    ${m.author ? `<div style="font-size:11.5px;color:var(--text2,#a8a8b3);margin-bottom:6px">${esc(m.author)}</div>` : ''}
                    <div style="display:flex;gap:8px;align-items:center;font-size:11px;color:var(--text3,#6b6b78);margin-bottom:7px">
                        <span style="color:${col};font-weight:600">● ${esc(label)}</span>
                        ${m.year ? `<span>${m.year}</span>` : ''}
                        ${m.lastChapter ? `<span>Ch. ${m.lastChapter}</span>` : ''}
                    </div>
                    <div style="display:flex;flex-wrap:wrap;gap:4px">
                        ${(m.tags || []).slice(0, 4).map(g => `<span style="font-size:9.5px;padding:1px 6px;background:var(--bg4,#1f1f26);border-radius:4px;color:var(--text2,#a8a8b3)">${esc(g)}</span>`).join('')}
                    </div>
                </div>
            </div>
            ${desc ? `<div style="padding:0 14px 14px;font-size:12px;line-height:1.5;color:var(--text2,#a8a8b3)">${esc(desc)}${m.description.length > 260 ? '…' : ''}</div>` : ''}
        `;
    }

    function position(card) {
        if (!tip) return;
        const r = card.getBoundingClientRect();
        const tw = 320, th = tip.offsetHeight || 220;
        let left = r.right + 10;
        if (left + tw > window.innerWidth - 8) left = r.left - tw - 10;   // bascule à gauche
        if (left < 8) left = Math.max(8, (window.innerWidth - tw) / 2);
        let top = r.top + r.height / 2 - th / 2;
        top = Math.max(8, Math.min(top, window.innerHeight - th - 8));
        tip.style.left = left + 'px';
        tip.style.top  = top + 'px';
    }

    function show() { if (!tip) return; tip.style.opacity = '1'; tip.style.transform = 'translateY(0)'; }
    function hide() {
        clearTimeout(showTimer);
        hideTimer = setTimeout(() => {
            if (tip) { tip.style.opacity = '0'; tip.style.transform = 'translateY(6px)'; tip.style.pointerEvents = 'none'; }
            currentId = null;
        }, 120);
    }

    async function onEnter(card) {
        const id = card.dataset.mangaId;
        if (!id) return;
        clearTimeout(hideTimer);
        clearTimeout(showTimer);
        showTimer = setTimeout(async () => {
            currentId = id;
            renderLoading(card);
            position(card);
            show();
            let m = detailCache.get(id);
            if (!m) {
                try {
                    m = await window.API.mangas.get(id);
                    // Borne le cache (optimisation mémoire) : le survol de
                    // centaines de cartes ne doit pas faire grossir la Map sans fin.
                    if (detailCache.size >= 200) detailCache.delete(detailCache.keys().next().value);
                    detailCache.set(id, m);
                }
                catch (e) { m = null; }
            }
            if (currentId !== id) return;   // l'utilisateur est passé à une autre card
            if (m) { renderManga(m); position(card); }
        }, 320);
    }

    function esc(s) { return (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

    // Délégation : couvre toutes les cards présentes et futures
    document.addEventListener('mouseover', e => {
        const card = e.target.closest('.manga-card[data-manga-id], .lib2-card[data-manga-id], .trending-card[data-manga-id], .top-manga-item[data-manga-id]');
        if (card && card.dataset.mangaId !== currentId) onEnter(card);
    });
    document.addEventListener('mouseout', e => {
        const card = e.target.closest('.manga-card, .lib2-card, .trending-card, .top-manga-item');
        const to = e.relatedTarget;
        if (card && (!to || (!card.contains(to) && to !== tip && !(tip && tip.contains(to))))) hide();
    });
    window.addEventListener('scroll', () => { if (tip && tip.style.opacity === '1') hide(); }, { passive: true });
})();
