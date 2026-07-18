// recherche.js — Recherche globale multi-sources (refonte audit §11)
//  · recherche live (débounce + garde anti-concurrence)
//  · regroupement PAR TITRE plutôt que par source (dédup multi-sources)
//  · badge « déjà dans ma bibliothèque »
//  · cartes enrichies (statut) + suggestions personnalisées à vide
(function () {
    'use strict';

    let favSet = new Set();
    let lastMerged = [];
    let typeFilter = 'all';   // 'all' | 'manga' | 'novel'
    let reqSeq = 0;           // garde anti-concurrence (une réponse tardive ne remplace pas une plus récente)
    let liveTimer = null;

    document.addEventListener('DOMContentLoaded', async () => {
        MH.initPage('recherche');
        MH.loadSourceTypes();
        await window.UserData?.ready?.();
        try { favSet = await MH.getFavSet(); } catch (e) { window.MH?.err?.('recherche.js', e); }

        const input = document.getElementById('seInput');
        const q = new URLSearchParams(location.search).get('q') || '';
        if (q) { input.value = q; submit(q); } else { renderHistory(); renderSuggestions(); }
        input.focus();

        document.getElementById('seGo').addEventListener('click', () => submit(input.value));
        // Recherche live : débounce 300 ms dès 2 caractères (audit §11)
        input.addEventListener('input', () => {
            const v = input.value.trim();
            clearTimeout(liveTimer);
            if (v.length < 2) { reqSeq++; renderHistory(); renderSuggestions(); return; }
            liveTimer = setTimeout(() => run(v), 300);
        });
        input.addEventListener('keydown', e => {
            if (e.key === 'Enter') { clearTimeout(liveTimer); submit(input.value); }
            else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { moveHistoryHighlight(e.key === 'ArrowDown' ? 1 : -1, e); }
        });
    });

    // ── Historique (UserData) — navigable au clavier (audit §11) ──
    let histIdx = -1;
    function historyChips() { return [...document.querySelectorAll('#seHist .se-chip')]; }
    function moveHistoryHighlight(dir, e) {
        const chips = historyChips();
        if (!chips.length) return;
        e.preventDefault();
        histIdx = (histIdx + dir + chips.length) % chips.length;
        chips.forEach((c, i) => c.classList.toggle('kbd', i === histIdx));
        const active = chips[histIdx];
        if (active) {
            const input = document.getElementById('seInput');
            input.value = active.dataset.q;
        }
    }
    function renderHistory() {
        const el = document.getElementById('seHist');
        if (!el || !window.UserData) return;
        histIdx = -1;
        const items = UserData.getSearchHistory();
        if (!items.length) { el.style.display = 'none'; return; }
        el.style.display = 'flex';
        el.innerHTML = `<span class="se-hist-label">Recherches récentes :</span>` +
            items.map(q => `<span class="se-chip" data-q="${MH.esc(q)}">${MH.esc(q)}<span class="x" data-del="${MH.esc(q)}" title="Retirer">×</span></span>`).join('') +
            `<button class="se-hist-clear" id="seHistClear">tout effacer</button>`;
        el.querySelectorAll('.se-chip').forEach(c => c.addEventListener('click', (e) => {
            if (e.target.dataset.del != null) {
                const rest = UserData.getSearchHistory().filter(x => x !== e.target.dataset.del);
                UserData.clearSearchHistory(); rest.reverse().forEach(x => UserData.pushSearch(x));
                renderHistory();
                return;
            }
            const q = c.dataset.q;
            document.getElementById('seInput').value = q;
            submit(q);
        }));
        document.getElementById('seHistClear')?.addEventListener('click', () => { UserData.clearSearchHistory(); renderHistory(); });
    }

    // ── Suggestions à vide : Populaires + rappel personnalisé de la bibliothèque ──
    async function renderSuggestions() {
        const out = document.getElementById('seResults');
        const sub = document.getElementById('seSub');
        if (!out) return;
        out.innerHTML = `<div class="se-loading"><div class="spinner-inline"></div> Suggestions…</div>`;
        let persoHtml = '';
        // « Depuis ta bibliothèque » : accès rapide personnalisé (audit §11)
        if (API.isLoggedIn()) {
            try {
                const favs = (await API.me.favorites()).slice(0, 12);
                if (favs.length) {
                    persoHtml = `<div class="se-group"><div class="se-ghead"><span class="se-gname">Depuis ta bibliothèque</span></div>
                        <div class="se-perso-row">${favs.map(f => `
                            <a class="se-card se-perso-card" href="serie.html?id=${encodeURIComponent(f.mangaId)}&source=${encodeURIComponent(f.source || '')}">
                                <div class="se-cover"><img src="${f.cover || MH.placeholderCover(f.mangaId)}" alt="${MH.esc(f.title || '')}" loading="lazy" onerror="this.src='${MH.placeholderCover(f.mangaId)}'"></div>
                                <div class="se-title">${MH.esc(f.title || f.mangaId)}</div>
                            </a>`).join('')}</div></div>`;
                }
            } catch (e) { window.MH?.err?.('recherche.js', e); }
        }
        try {
            const data = await API.mangas.popular({ limit: 18 });
            const list = data.results || [];
            if (sub) sub.textContent = 'Populaires en ce moment — ou tape un titre ci-dessus.';
            const popHtml = list.length ? `<div class="se-group"><div class="se-ghead"><span class="se-gname">Populaires</span></div>
                <div class="se-grid">${list.map(m => `
                    <a class="se-card" href="serie.html?id=${encodeURIComponent(m.id)}&source=${encodeURIComponent(API.sources.current)}">
                        <div class="se-cover"><img src="${m.cover || m.coverThumb || MH.placeholderCover(m.id)}" alt="${MH.esc(m.title||'')}" loading="lazy" onerror="this.src='${MH.placeholderCover(m.id)}'"></div>
                        <div class="se-title">${MH.esc(m.title || m.id)}</div>
                    </a>`).join('')}</div></div>` : '';
            out.innerHTML = persoHtml + popHtml;
        } catch (e) { out.innerHTML = persoHtml; }
    }

    // Recherche explicite : mémorise dans l'historique + URL, puis lance.
    function submit(q) {
        q = (q || '').trim();
        if (!q) return;
        clearTimeout(liveTimer);
        window.UserData?.pushSearch?.(q);
        history.replaceState({}, '', 'recherche.html?q=' + encodeURIComponent(q));
        renderHistory();
        run(q);
    }

    async function run(q) {
        q = (q || '').trim();
        if (!q) return;
        const out = document.getElementById('seResults');
        const sub = document.getElementById('seSub');
        const my = ++reqSeq;
        history.replaceState({}, '', 'recherche.html?q=' + encodeURIComponent(q));
        sub.textContent = `Recherche de « ${q} »…`;
        out.innerHTML = `<div class="se-loading"><div class="spinner-inline"></div> Recherche en cours…</div>`;
        try {
            // Page dédiée : plafond relevé à 36/source (audit N38 — le défaut de
            // 12 tronquait silencieusement les recherches sur mots courants)
            const data = await API.mangas.searchAll(q, 36);
            if (my !== reqSeq) return;   // une frappe plus récente a pris le relais
            lastMerged = mergeByTitle(data.groups || []);
            renderResults(q);
        } catch (e) {
            if (my !== reqSeq) return;
            sub.textContent = '';
            out.innerHTML = `<div class="se-err">Erreur : ${MH.esc(e.message)}</div>`;
        }
    }

    // Normalise un titre pour le rapprochement (minuscules, sans accents ni ponctuation).
    function normTitle(t) {
        return (t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '');
    }

    // Regroupe les résultats de toutes les sources PAR TITRE (audit §11) : une œuvre
    // présente sur plusieurs sources = une seule carte avec un sélecteur de source.
    function mergeByTitle(groups) {
        const map = new Map();
        const disabled = MH.disabledSources?.() || new Set();
        groups.forEach(g => {
            if (g.error || !g.items) return;
            if (disabled.has(g.source)) return;   // source désactivée : exclue (audit §9)
            const isNovel = MH.isNovelSource(g.source);
            g.items.forEach(m => {
                const key = normTitle(m.title);
                if (!key) return;
                if (!map.has(key)) {
                    map.set(key, {
                        title: m.title, cover: m.cover || m.coverThumb || '',
                        status: m.status || null, year: m.year || null,
                        adult: false,   // contenu adulte (audit N20)
                        sources: [], inLibrary: false, libSource: null,
                    });
                }
                const w = map.get(key);
                if (MH.isAdultManga?.(m)) w.adult = true;
                if (!w.cover && (m.cover || m.coverThumb)) w.cover = m.cover || m.coverThumb;
                if (!w.status && m.status) w.status = m.status;
                w.sources.push({ source: g.source, sourceName: g.sourceName, id: m.id, isNovel });
                if (favSet.has(String(m.id))) { w.inLibrary = true; w.libSource = { source: g.source, id: m.id }; }
            });
        });
        // Multi-sources d'abord (plus pertinent), puis ordre d'apparition.
        return [...map.values()].sort((a, b) => b.sources.length - a.sources.length);
    }

    const STATUS_LABEL = { ongoing: 'En cours', completed: 'Terminé', hiatus: 'En pause', cancelled: 'Annulé' };
    const STATUS_COLOR = { ongoing: '#22c55e', completed: '#3b82f6', hiatus: '#f59e0b', cancelled: '#ef4444' };

    function renderResults(q) {
        const out = document.getElementById('seResults');
        const sub = document.getElementById('seSub');
        // Filtrage par type (une œuvre matche si au moins une de ses sources correspond)
        const works = lastMerged.filter(w =>
            typeFilter === 'all' ? true :
            typeFilter === 'novel' ? w.sources.some(s => s.isNovel) : w.sources.some(s => !s.isNovel));
        const nManga = lastMerged.filter(w => w.sources.some(s => !s.isNovel)).length;
        const nNovel = lastMerged.filter(w => w.sources.some(s => s.isNovel)).length;

        let chips = '';
        if (nManga && nNovel) {
            const c = (val, label, count) => `<button class="se-chip ${typeFilter === val ? 'on' : ''}" data-type="${val}">${label}${count != null ? ` · ${count}` : ''}</button>`;
            chips = `<div class="se-types">${c('all', 'Tout', lastMerged.length)}${c('manga', 'Mangas', nManga)}${c('novel', 'Romans', nNovel)}</div>`;
        }

        sub.textContent = `${works.length} œuvre(s) pour « ${q} »${lastMerged.length !== works.length ? '' : ''}.`;
        if (!works.length) {
            out.innerHTML = chips + `<div class="se-empty">Aucun résultat ${typeFilter !== 'all' ? 'dans cette catégorie' : '. Essaie un autre titre ou vérifie tes sources'}.</div>`;
        } else {
            out.innerHTML = chips + `<div class="se-grid">${works.map(renderWorkCard).join('')}</div>`;
        }

        out.querySelectorAll('.se-chip[data-type]').forEach(b => b.addEventListener('click', () => {
            typeFilter = b.dataset.type; renderResults(q);
        }));
        // Navigation : clic sur une puce de source → cette source ; sinon → source principale.
        out.querySelectorAll('.se-card[data-href]').forEach(card => card.addEventListener('click', async (e) => {
            const chip = e.target.closest('.se-src-chip');
            const href = chip ? chip.dataset.href : card.dataset.href;
            if (!href) return;
            e.preventDefault();
            // Confirmation contenu adulte (audit N20)
            if (card.dataset.nsfw && !MH.nsfwAllowed?.()) {
                const ok = await MH.confirm('Cette œuvre est classée contenu adulte (+18). L\'ouvrir quand même ?',
                    { okText: 'Ouvrir', danger: true, title: 'Contenu adulte' });
                if (!ok) return;
            }
            window.location.href = href;
        }));
    }

    function serieHref(source, id) {
        return `serie.html?id=${encodeURIComponent(id)}&source=${encodeURIComponent(source || '')}`;
    }

    function renderWorkCard(w) {
        // Source principale : celle en bibliothèque si dispo, sinon la première.
        const primary = w.libSource ? w.sources.find(s => s.source === w.libSource.source && s.id === w.libSource.id) || w.sources[0] : w.sources[0];
        const primaryHref = serieHref(primary.source, primary.id);
        const st = w.status && STATUS_LABEL[w.status]
            ? `<div class="se-status" style="background:${STATUS_COLOR[w.status] || '#666'}">${STATUS_LABEL[w.status]}</div>` : '';
        const lib = w.inLibrary ? `<div class="se-lib-badge">✓ Dans ma biblio</div>` : '';
        const multi = w.sources.length > 1 ? `<div class="se-multi">${w.sources.length} sources</div>` : '';
        const meta = [w.year, w.status && STATUS_LABEL[w.status]].filter(Boolean).join(' · ');
        const srcChips = w.sources.map(s =>
            `<span class="se-src-chip ${s.isNovel ? 'novel' : ''}" data-href="${serieHref(s.source, s.id)}">${MH.esc(s.sourceName || s.source)}</span>`).join('');
        const nsfw = w.adult && !MH.nsfwAllowed?.() ? ' data-nsfw="1"' : '';
        return `
        <div class="se-card" data-href="${primaryHref}"${nsfw}>
            <div class="se-cover">
                <img src="${w.cover || MH.placeholderCover(primary.id)}" alt="${MH.esc(w.title || '')}" loading="lazy" onerror="this.src='${MH.placeholderCover(primary.id)}'">
                ${st}${lib}${multi}
            </div>
            <div class="se-title">${MH.esc(w.title || primary.id)}</div>
            ${meta ? `<div class="se-meta">${MH.esc(meta)}</div>` : ''}
            <div class="se-sources">${srcChips}</div>
        </div>`;
    }
})();
