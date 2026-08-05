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
    // Audit AMEL-13 : filtre de statut, en plus du type.
    let statutFiltre = 'all';   // 'all' | ongoing | completed | hiatus | cancelled
    let reqSeq = 0;           // garde anti-concurrence (une réponse tardive ne remplace pas une plus récente)
    let liveTimer = null;

    document.addEventListener('DOMContentLoaded', async () => {
        MH.initPage('recherche');
        MH.loadSourceTypes();

        // Audit AMEL-12 : la bibliothèque est lue depuis le cache LOCAL, donc
        // avant tout `await`. Placée après `UserData.ready()` et `getFavSet()`
        // — deux appels réseau — elle n'apparaissait qu'à 1,6 s : mesurée, elle
        // n'avait plus rien d'« instantanée ni hors-ligne ».
        const qInitial = new URLSearchParams(location.search).get('q') || '';
        if (qInitial) rechercheLocale(qInitial, reqSeq);

        await window.UserData?.ready?.();
        try { favSet = await MH.getFavSet(); } catch (e) { window.MH?.err?.('recherche.js', e); }

        const input = document.getElementById('seInput');
        const q = qInitial;
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
                                <div class="se-cover"><img src="${MH.cover(f.cover, MH.placeholderCover(f.mangaId))}" alt="${MH.esc(f.title || '')}" loading="lazy" onerror="this.src='${MH.placeholderCover(f.mangaId)}'"></div>
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
                        <div class="se-cover"><img src="${MH.cover(m.cover, m.coverThumb, MH.placeholderCover(m.id))}" alt="${MH.esc(m.title||'')}" loading="lazy" onerror="this.src='${MH.placeholderCover(m.id)}'"></div>
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

    // Sources en échec pour la recherche en cours (audit AMEL-11) et groupes
    // reçus jusqu'ici (audit AMEL-10).
    let sourcesEnEchec = [];
    let groupesRecus = [];

    async function run(q) {
        q = (q || '').trim();
        if (!q) return;
        const out = document.getElementById('seResults');
        const sub = document.getElementById('seSub');
        const my = ++reqSeq;
        history.replaceState({}, '', 'recherche.html?q=' + encodeURIComponent(q));
        sub.textContent = `Recherche de « ${q} »…`;
        out.innerHTML = `<div class="se-loading"><div class="spinner-inline"></div> Recherche en cours…</div>`;
        sourcesEnEchec = [];
        groupesRecus = [];

        // Audit AMEL-12 : la bibliothèque est déjà en cache côté client. On
        // l'affiche IMMÉDIATEMENT, avant tout appel réseau — c'est souvent ce
        // qu'on cherche, et cela fonctionne hors-ligne.
        rechercheLocale(q, my);

        let sources = [];
        try { sources = (await API.sources.list()) || []; } catch (e) { /* voir repli */ }
        if (my !== reqSeq) return;
        const actives = sources.filter(s => (MH.isSourceEnabled ? MH.isSourceEnabled(s.id) : true)
            && (s.capabilities || []).includes('search'));

        if (!actives.length) {
            // Repli sur l'appel agrégé si la liste des sources est indisponible :
            // mieux vaut une recherche non progressive que pas de recherche.
            try {
                const data = await API.mangas.searchAll(q, 36);
                if (my !== reqSeq) return;
                groupesRecus = data.groups || [];
                sourcesEnEchec = groupesRecus.filter(g => g.error)
                    .map(g => ({ nom: g.sourceName || g.source, raison: g.error }));
                lastMerged = mergeByTitle(groupesRecus);
                renderResults(q);
            } catch (e) {
                if (my !== reqSeq) return;
                sub.textContent = '';
                out.innerHTML = `<div class="se-err">Erreur : ${MH.esc(e.message)}</div>`;
            }
            return;
        }

        // Audit AMEL-10 : `searchAll` fait un Promise.all — on attendait donc la
        // source la PLUS LENTE (jusqu'à 15 s de délai) avant d'afficher quoi que
        // ce soit, alors que la première répond souvent en moins d'une seconde.
        // Chaque source est désormais interrogée séparément et ses résultats
        // rejoignent l'affichage dès qu'ils arrivent.
        let repondues = 0;
        await Promise.all(actives.map(async (s) => {
            try {
                const r = await API.mangas.searchFor(s.id, { q, limit: 36 });
                if (my !== reqSeq) return;
                groupesRecus.push({ source: s.id, sourceName: s.name, items: r.results || [] });
            } catch (e) {
                if (my !== reqSeq) return;
                // Audit AMEL-11 : une source en échec était simplement ignorée.
                // La recherche paraissait juste incomplète, sans jamais dire
                // qu'il manquait un catalogue entier.
                sourcesEnEchec.push({ nom: s.name || s.id, raison: e.message || 'indisponible' });
            } finally {
                if (my !== reqSeq) return;
                repondues++;
                lastMerged = mergeByTitle(groupesRecus);
                renderResults(q, { enCours: repondues < actives.length });
            }
        }));
    }

    // ── Recherche dans la bibliothèque (audit AMEL-12) ───────
    // Tout passait par le réseau, alors que les favoris sont déjà en cache :
    // chercher un titre qu'on possède déjà demandait d'attendre quatre sources
    // distantes, et ne marchait pas du tout hors-ligne.
    function rechercheLocale(q, my) {
        const zone = document.getElementById('seLocal');
        if (!zone) return;
        const n = (t) => (t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
        const termes = n(q).split(/\s+/).filter(Boolean);
        // `getCachedLibrary()` renvoie { at, favs } et non un tableau : le lire
        // comme une liste échouait silencieusement dans le catch, et la
        // recherche locale ne rendait donc jamais rien.
        let favs = [];
        try { favs = window.Storage?.getCachedLibrary?.()?.favs || []; } catch (e) { favs = []; }
        const trouves = favs.filter(f => {
            const hay = n(f.title) + ' ' + n(f.mangaId);
            return termes.every(t => hay.includes(t));
        }).slice(0, 12);

        if (my !== reqSeq) return;
        zone.hidden = trouves.length === 0;
        if (!trouves.length) { zone.innerHTML = ''; return; }
        zone.innerHTML = `
            <div class="se-local-head">Dans ta bibliothèque · ${trouves.length}</div>
            <div class="se-local-grid">${trouves.map(f => `
                <a class="se-local-item" href="serie.html?id=${encodeURIComponent(f.mangaId)}&source=${encodeURIComponent(f.source || '')}">
                    <img src="${MH.cover(f.cover, MH.placeholderCover(f.mangaId))}" alt="" loading="lazy">
                    <span>${MH.esc(f.title || f.mangaId)}</span>
                </a>`).join('')}</div>`;
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

    function renderResults(q, opts = {}) {
        const out = document.getElementById('seResults');
        const sub = document.getElementById('seSub');
        // Filtrage par type (une œuvre matche si au moins une de ses sources correspond)
        let works = lastMerged.filter(w =>
            typeFilter === 'all' ? true :
            typeFilter === 'novel' ? w.sources.some(s => s.isNovel) : w.sources.some(s => !s.isNovel));
        // Audit AMEL-13 : 119 résultats sur 4 sources sans moyen d'affiner. Le
        // statut est la coupe la plus demandée (« que du terminé »), et il est
        // déjà porté par les résultats — il n'était simplement pas exploité.
        if (statutFiltre !== 'all') works = works.filter(w => w.status === statutFiltre);
        const nManga = lastMerged.filter(w => w.sources.some(s => !s.isNovel)).length;
        const nNovel = lastMerged.filter(w => w.sources.some(s => s.isNovel)).length;
        // Audit BUG-16 : « Tout · 119 » avec « Mangas · 45 » et « Romans · 75 »
        // (= 120) donnait l'impression d'un compte faux. En réalité une œuvre
        // disponible À LA FOIS en manga et en roman est comptée des deux côtés —
        // ce sont des disponibilités, pas une partition. On l'explicite au lieu
        // de laisser l'utilisateur constater une addition qui ne tombe pas juste.
        const nBoth = lastMerged.filter(w =>
            w.sources.some(s => !s.isNovel) && w.sources.some(s => s.isNovel)).length;

        let chips = '';
        if (nManga && nNovel) {
            const c = (val, label, count, title) =>
                `<button class="se-chip ${typeFilter === val ? 'on' : ''}" data-type="${val}"` +
                `${title ? ` title="${MH.esc(title)}"` : ''}` +
                ` aria-pressed="${typeFilter === val}">${label}${count != null ? ` · ${count}` : ''}</button>`;
            const note = nBoth
                ? `${nBoth} œuvre(s) sont disponibles à la fois en manga et en roman, et comptent donc dans les deux catégories`
                : '';
            chips = `<div class="se-types">${c('all', 'Tout', lastMerged.length)}` +
                    `${c('manga', 'Mangas', nManga, note)}${c('novel', 'Romans', nNovel, note)}</div>` +
                    (nBoth ? `<div class="se-note" style="font-size:11.5px;color:var(--text3);margin:2px 0 8px">
                        Dont ${nBoth} disponible(s) dans les deux formats.</div>` : '');
        }

        // Audit AMEL-13 : puces de statut, construites a partir de ce que les
        // resultats contiennent reellement — proposer « Termine » quand aucun
        // resultat ne l'est serait un filtre qui ne rend jamais rien.
        const parStatut = {};
        lastMerged.forEach(w => { if (w.status) parStatut[w.status] = (parStatut[w.status] || 0) + 1; });
        const statuts = Object.keys(parStatut);
        if (statuts.length > 1) {
            const c = (val, label, n) =>
                `<button class="se-chip ${statutFiltre === val ? 'on' : ''}" data-statut="${val}" ` +
                `aria-pressed="${statutFiltre === val}">${label}${n != null ? ` · ${n}` : ''}</button>`;
            chips += `<div class="se-types se-statuts">${c('all', 'Tous statuts', lastMerged.length)}` +
                statuts.map(st => c(st, STATUS_LABEL[st] || st, parStatut[st])).join('') + `</div>`;
        }

        // Audit AMEL-11 : une source en echec etait ignoree en silence, la
        // recherche paraissant seulement incomplete. On dit ce qui manque.
        const bandeauEchec = sourcesEnEchec.length
            ? `<div class="se-fail" role="status">${MH.icon ? MH.icon('alert', 15) : '!'}
                 <span>${sourcesEnEchec.length === 1 ? 'Une source n’a pas répondu' : `${sourcesEnEchec.length} sources n’ont pas répondu`} :
                 ${sourcesEnEchec.map(s => `<strong>${MH.esc(s.nom)}</strong> (${MH.esc(s.raison)})`).join(', ')}.
                 Les résultats ci-dessous sont donc incomplets.</span>
               </div>`
            : '';
        // Audit AMEL-10 : etat d'avancement, les resultats arrivant source par source.
        const bandeauEnCours = opts.enCours
            ? `<div class="se-loading se-partiel"><div class="spinner-inline"></div> D’autres sources répondent encore…</div>`
            : '';

        sub.textContent = `${works.length} œuvre(s) pour « ${q} »${opts.enCours ? ' (recherche en cours)' : ''}.`;
        if (!opts.enCours) MH.announce?.(`${works.length} résultat(s) pour ${q}`);   // audit A11Y-06
        if (!works.length) {
            out.innerHTML = chips + bandeauEchec + bandeauEnCours
                + (opts.enCours ? '' : `<div class="se-empty">Aucun résultat ${typeFilter !== 'all' || statutFiltre !== 'all' ? 'avec ces filtres' : '. Essaie un autre titre ou vérifie tes sources'}.</div>`);
        } else {
            out.innerHTML = chips + bandeauEchec
                + `<div class="se-grid">${works.map(renderWorkCard).join('')}</div>` + bandeauEnCours;
        }

        out.querySelectorAll('.se-chip[data-type]').forEach(b => b.addEventListener('click', () => {
            typeFilter = b.dataset.type; renderResults(q, opts);
        }));
        out.querySelectorAll('.se-chip[data-statut]').forEach(b => b.addEventListener('click', () => {
            statutFiltre = b.dataset.statut; renderResults(q, opts);
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
                <img src="${MH.cover(w.cover, MH.placeholderCover(primary.id))}" alt="${MH.esc(w.title || '')}" loading="lazy" onerror="this.src='${MH.placeholderCover(primary.id)}'">
                ${st}${lib}${multi}
            </div>
            <div class="se-title">${MH.esc(w.title || primary.id)}</div>
            ${meta ? `<div class="se-meta">${MH.esc(meta)}</div>` : ''}
            <div class="se-sources">${srcChips}</div>
        </div>`;
    }
})();
