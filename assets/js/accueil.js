// accueil.js — Page d'accueil dynamique (backend)
(function () {
    'use strict';

    let heroMangas = [];
    let heroIdx = 0;
    let heroTimer = null;
    let heroShow = null;        // référence module vers show() (pour rafraîchir après enrichissement)
    let latestCount = 8;
    let popularCache = null;
    let latestCache = null;

    document.addEventListener('DOMContentLoaded', async () => {
        MH.initPage('accueil');
        // Charger hero d'abord (la sidebar dépend de popularCache)
        await loadHeroAndTrending();
        await Promise.all([loadLatest(), loadResume(), loadSidebar()]);
        bindLatestControls();
    });

    // ── Hero + Tendances ────────────────────────────────────
    async function loadHeroAndTrending() {
        try {
            const data = await API.mangas.popular({ limit: 12 });
            popularCache = data.results || [];
            heroMangas = popularCache.slice(0, 4);
            renderHero();
            renderTrending(popularCache.slice(0, 10));
            renderReco(popularCache.slice(4, 7));
            // Illustration officielle (banner AniList) pour chaque série du hero
            heroMangas.forEach((m, i) => {
                API.art.get(m.title).then(a => {
                    if (a && a.banner) {
                        heroMangas[i] = Object.assign({}, heroMangas[i], { banner: a.banner });
                        if (heroIdx === i && heroShow) heroShow(i);   // révèle le banner sur le slide visible
                    }
                }).catch(() => {});
            });
        } catch(e) {
            showError('hero', "Impossible de charger les tendances. Le backend est-il lancé ?");
        }
    }

    function renderHero() {
        const bg      = document.getElementById('heroBg');
        const content = document.getElementById('heroContent');
        const dots    = document.getElementById('heroDots');
        const hero    = document.getElementById('hero');
        if (!bg || !content || !hero || !heroMangas.length) return;

        clearInterval(heroTimer);   // évite les intervalles cumulés sur re-render

        function slideHTML(m) {
            return `
                <div class="hero-inner">
                    <div class="hero-badges">
                        ${(m.tags || []).slice(0, 3).map(g => `<span class="hero-badge">${MH.esc(g.toUpperCase())}</span>`).join('')}
                    </div>
                    <h1 class="hero-title">${MH.esc(m.title)}</h1>
                    <div class="hero-meta">
                        ${m.author ? `<span class="hero-meta-item">${MH.esc(m.author)}</span>` : ''}
                        ${m.year ? `<span class="hero-meta-item">${m.year}</span>` : ''}
                        ${m.status ? `<span class="hero-meta-item">${MH.statusBadge(m.status)}</span>` : ''}
                    </div>
                    <p class="hero-desc">${MH.esc((m.description || '').slice(0, 240))}${m.description?.length > 240 ? '…' : ''}</p>
                    <div class="hero-actions">
                        <a href="serie.html?id=${encodeURIComponent(m.id)}" class="btn btn-primary">Voir la fiche</a>
                        <button class="btn btn-secondary" data-fav="${m.id}">+ Suivre</button>
                    </div>
                </div>`;
        }

        // Crossfade de l'arrière-plan via une couche temporaire
        function crossfadeBg(url) {
            const layer = document.createElement('div');
            layer.className = 'hero-bg hero-bg-fade';
            layer.style.backgroundImage = `url('${url}')`;
            bg.insertAdjacentElement('afterend', layer);
            requestAnimationFrame(() => layer.classList.add('show'));
            setTimeout(() => { bg.style.backgroundImage = `url('${url}')`; layer.remove(); }, 760);
        }

        // Poster net (cover en portrait, à droite) — créé une fois
        let poster = document.getElementById('heroPoster');
        if (!poster) {
            poster = document.createElement('img');
            poster.id = 'heroPoster'; poster.className = 'hero-poster'; poster.alt = '';
            poster.onerror = () => { poster.style.visibility = 'hidden'; };
            poster.onload  = () => { poster.style.visibility = 'visible'; };
            hero.appendChild(poster);
        }

        function show(idx, instant) {
            const m = heroMangas[idx]; if (!m) return;
            heroIdx = idx;
            const banner = m.banner || null;             // illustration large officielle
            const cover  = m.coverLarge || m.cover || '';
            const bgUrl  = banner || cover;
            hero.classList.toggle('has-banner', !!banner);
            poster.style.display = banner ? 'none' : '';  // banner = pas de poster ; sinon cover nette
            if (instant) {
                bg.style.backgroundImage = `url('${bgUrl}')`;
                if (!banner) poster.src = cover;
            } else {
                crossfadeBg(bgUrl);
                if (!banner) { poster.classList.add('swapping'); setTimeout(() => { poster.src = cover; poster.classList.remove('swapping'); }, 240); }
            }
            content.classList.add('hero-fading');
            setTimeout(() => {
                content.innerHTML = slideHTML(m);
                content.classList.remove('hero-fading');
            }, instant ? 0 : 260);
            dots.querySelectorAll('.hero-dot').forEach((d, i) => d.classList.toggle('active', i === idx));
        }

        function go(idx)   { show((idx + heroMangas.length) % heroMangas.length); restart(); }
        function start()   { heroTimer = setInterval(() => show((heroIdx + 1) % heroMangas.length), 6000); }
        function restart() { clearInterval(heroTimer); start(); }

        // Points de navigation
        dots.innerHTML = heroMangas.map((_, i) => `<div class="hero-dot ${i === 0 ? 'active' : ''}" data-i="${i}"></div>`).join('');
        dots.querySelectorAll('.hero-dot').forEach(d => d.addEventListener('click', () => go(+d.dataset.i)));

        // Flèches précédent / suivant
        if (!document.getElementById('heroPrev')) {
            const arrow = (id, side, d) => {
                const b = document.createElement('button');
                b.id = id; b.className = 'hero-arrow'; b.style[side] = '14px';
                b.setAttribute('aria-label', id === 'heroPrev' ? 'Précédent' : 'Suivant');
                b.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
                return b;
            };
            const prev = arrow('heroPrev', 'left',  'M15 18l-6-6 6-6');
            const next = arrow('heroNext', 'right', 'M9 18l6-6-6-6');
            prev.addEventListener('click', () => go(heroIdx - 1));
            next.addEventListener('click', () => go(heroIdx + 1));
            hero.append(prev, next);
        }

        heroShow = show;
        show(0, true);
        start();
        if (!hero.dataset.heroBound) {
            hero.dataset.heroBound = '1';
            hero.addEventListener('mouseenter', () => clearInterval(heroTimer));
            hero.addEventListener('mouseleave', restart);
        }
    }

    function renderTrending(mangas) {
        const track = document.getElementById('trendingTrack');
        if (!track) return;
        track.innerHTML = mangas.map((m, i) => `
            <a href="serie.html?id=${encodeURIComponent(m.id)}" class="trending-card" data-manga-id="${m.id}">
                <div class="trending-rank">${i + 1}</div>
                <div class="trending-cover">
                    <img src="${m.cover || ''}" alt="${MH.esc(m.title)}" loading="lazy" onerror="this.src='${MH.placeholderCover(m.id)}'">
                    <div class="trending-overlay">
                        <div class="trending-title">${MH.esc(m.title)}</div>
                        <div class="trending-meta">${m.year || ''} ${m.status ? '· ' + m.status : ''}</div>
                    </div>
                </div>
            </a>`).join('');

        let trendOffset = 0;
        const update = () => {
            const cardW = (track.firstElementChild?.offsetWidth || 0) + 12;
            track.style.transform = `translateX(-${trendOffset * cardW}px)`;
        };
        document.getElementById('trendPrev')?.addEventListener('click', () => {
            trendOffset = Math.max(0, trendOffset - 1); update();
        });
        document.getElementById('trendNext')?.addEventListener('click', () => {
            trendOffset = Math.min(mangas.length - 5, trendOffset + 1); update();
        });
    }

    // ── Reco personnalisée (tags des favoris) ─────────────
    // Connecté avec favoris → séries du genre préféré non suivies.
    // Sinon → repli sur les populaires.
    async function renderReco(fallback) {
        const el = document.getElementById('recoGrid');
        if (!el) return;
        const subEl = document.querySelector('.section-reco .section-subtitle');

        const showFallback = () => {
            if (subEl) subEl.textContent = 'Les séries les plus suivies en ce moment';
            el.innerHTML = (fallback || []).map(m => mangaCardHTML(m)).join('');
            MH.markFavorites(el);
        };

        if (!API.isLoggedIn()) return showFallback();
        try {
            const favs = await API.me.favorites();
            if (!favs.length) return showFallback();
            const favSet = new Set(favs.map(f => String(f.mangaId)));
            const mangas = (await Promise.allSettled(favs.slice(0, 8).map(f => API.mangas.get(f.mangaId))))
                .filter(r => r.status === 'fulfilled').map(r => r.value);
            const counts = {};
            mangas.forEach(m => (m.tags || []).slice(0, 5).forEach(t => { counts[t] = (counts[t] || 0) + 1; }));
            const topTags = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t]) => t);
            if (!topTags.length) return showFallback();

            const data = await API.mangas.search({ includedTags: [topTags[0]], limit: 12, sort: 'popularity' });
            const picks = (data.results || []).filter(m => !favSet.has(String(m.id))).slice(0, 3);
            if (!picks.length) return showFallback();

            if (subEl) subEl.textContent = `Parce que tu suis des séries ${topTags[0]}`;
            el.innerHTML = picks.map(m => mangaCardHTML(m, topTags.find(t => (m.tags || []).includes(t)))).join('');
            MH.markFavorites(el);
        } catch (e) { showFallback(); }
    }

    // ── Dernières sorties ────────────────────────────────
    async function loadLatest() {
        try {
            const data = await API.mangas.latest({ limit: 16 });
            latestCache = data.results || [];
            renderLatest();
        } catch(e) {
            showError('latest', 'Impossible de charger les nouveautés');
        }
    }

    let latestFilter = 'all';
    async function filteredLatest() {
        if (latestFilter === 'populaire') return popularCache || [];
        if (latestFilter === 'suivis') {
            const favSet = await MH.getFavSet();
            return (latestCache || []).filter(m => favSet.has(String(m.id)));
        }
        return latestCache || [];
    }

    async function renderLatest() {
        const el = document.getElementById('latestGrid');
        if (!el || !latestCache) return;
        const list = await filteredLatest();
        if (!list.length) {
            el.innerHTML = `<div style="grid-column:1/-1;padding:24px;text-align:center;color:var(--text3);font-size:13px">
                ${latestFilter === 'suivis' ? 'Aucune sortie récente parmi tes séries suivies.' : 'Rien à afficher.'}
            </div>`;
        } else {
            el.innerHTML = list.slice(0, latestCount).map(m => mangaCardHTML(m)).join('');
        }
        const more = document.getElementById('btnMore');
        if (more) more.style.display = latestCount >= list.length ? 'none' : '';
        MH.markFavorites(el);
    }

    function bindLatestControls() {
        document.getElementById('btnMore')?.addEventListener('click', () => {
            latestCount = Math.min(latestCount + 4, 16);
            renderLatest();
        });
        document.getElementById('latestFilters')?.addEventListener('click', e => {
            const btn = e.target.closest('[data-filter]');
            if (!btn) return;
            document.querySelectorAll('#latestFilters [data-filter]')
                .forEach(b => b.classList.remove('tag-orange', 'active'));
            btn.classList.add('tag-orange', 'active');
            latestFilter = btn.dataset.filter;
            latestCount = 8;
            renderLatest();
        });
    }

    // ── Reprendre la lecture ──────────────────────────────
    async function loadResume() {
        const el = document.getElementById('resumeList');
        if (!el) return;
        if (!API.isLoggedIn()) {
            el.innerHTML = `<div style="color:var(--text3);padding:14px;font-size:13px">
                <a href="page_login.html" class="link-orange">Connectez-vous</a> pour synchroniser votre lecture.
            </div>`;
            return;
        }
        try {
            const progress = await API.me.progress();
            const entries = Object.entries(progress)
                .map(([id, p]) => ({ mangaId: id, ...p }))
                .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
                .slice(0, 4);

            if (!entries.length) {
                el.innerHTML = `<div style="color:var(--text3);padding:14px;font-size:13px">
                    Aucune lecture en cours. <a href="catalogue.html" class="link-orange">Découvrir le catalogue →</a>
                </div>`;
                return;
            }

            await MH.loadSourceTypes();
            // Récupère les détails des mangas depuis LEUR source d'origine
            const mangas = await Promise.allSettled(entries.map(e => API.mangas.getFrom(e.source, e.mangaId)));
            el.innerHTML = entries.map((e, i) => {
                const r = mangas[i];
                if (r.status !== 'fulfilled' || !r.value || !r.value.title) return '';
                const m = r.value;
                const isNovel = MH.isNovelSource(e.source);
                // Pour un roman, "page" = % de défilement ; pour un manga, ~20 pages/chapitre
                const pct = isNovel ? Math.min(100, e.page || 0) : Math.min(100, Math.round((e.page / 20) * 100));
                const sub = isNovel ? `Chapitre ${MH.chapNum(e.chapter)} · ${pct}%` : `Chapitre ${MH.chapNum(e.chapter)} · Page ${e.page}`;
                return `
                <div class="resume-item" data-resume="${MH.esc(m.id)}" style="position:relative">
                    <a href="${MH.readerHref(m.id, e.chapterId, e.source)}" style="display:flex;align-items:center;gap:12px;flex:1;min-width:0">
                        <div class="resume-cover">
                            <img src="${m.coverThumb || m.cover || ''}" alt="${MH.esc(m.title)}" loading="lazy">
                        </div>
                        <div class="resume-info">
                            <div class="resume-title">${MH.esc(m.title)}</div>
                            <div class="resume-chap">${sub}</div>
                            <div class="resume-progress"><div class="resume-progress-fill" style="width:${pct}%"></div></div>
                        </div>
                    </a>
                    <button class="resume-remove" data-remove="${MH.esc(m.id)}" title="Retirer de la liste"
                        style="background:none;border:none;color:var(--text3);font-size:16px;cursor:pointer;padding:6px;flex-shrink:0">✕</button>
                </div>`;
            }).join('');

            // Suppression d'une œuvre de "reprendre la lecture"
            el.querySelectorAll('[data-remove]').forEach(btn => {
                btn.addEventListener('click', async (ev) => {
                    ev.preventDefault();
                    ev.stopPropagation();
                    const id = btn.dataset.remove;
                    try {
                        await API.me.removeProgress(id);
                        btn.closest('[data-resume]')?.remove();
                        MH.toast('Retiré de « Reprendre la lecture »');
                        if (!el.querySelector('[data-resume]')) {
                            el.innerHTML = `<div style="color:var(--text3);padding:14px;font-size:13px">Aucune lecture en cours. <a href="catalogue.html" class="link-orange">Découvrir →</a></div>`;
                        }
                    } catch (e2) { MH.toast('Erreur : ' + e2.message); }
                });
            });
        } catch(err) {
            el.innerHTML = `<div style="color:var(--text3);padding:14px;font-size:13px">Erreur de chargement</div>`;
        }
    }

    // ── Sidebar (top manga + genres) ──────────────────────
    async function loadSidebar() {
        const topEl = document.getElementById('topMangaList');
        if (topEl && popularCache) {
            const ranks = ['top-rank-1', 'top-rank-2', 'top-rank-3'];
            topEl.innerHTML = popularCache.slice(0, 10).map((m, i) => `
                <a href="serie.html?id=${encodeURIComponent(m.id)}" class="top-manga-item" data-manga-id="${m.id}">
                    <div class="top-rank ${ranks[i] || ''}">${i + 1}</div>
                    <div class="top-cover">
                        <img src="${m.coverThumb || m.cover || ''}" alt="${MH.esc(m.title)}" loading="lazy">
                    </div>
                    <div class="top-info">
                        <div class="top-title">${MH.esc(m.title)}</div>
                        <div class="top-meta">${m.year || ''} ${m.demographic ? '· ' + m.demographic : ''}</div>
                    </div>
                </a>`).join('');
        }

        // Genres populaires
        const genreEl = document.getElementById('genreCloud');
        if (genreEl) {
            const popular = ['Action','Adventure','Drama','Fantasy','Romance','Comedy','Slice of Life','Horror','Mystery','Sci-Fi'];
            genreEl.innerHTML = popular.map(g =>
                `<a href="catalogue.html?q=${encodeURIComponent(g)}" class="tag">${g}</a>`
            ).join('');
        }

        // Poll
        const pollEl = document.getElementById('pollBlock');
        if (pollEl) {
            pollEl.innerHTML = `
                <div class="sidebar-block-header">
                    <span class="sidebar-block-title">Sondage de la semaine</span>
                </div>
                <div class="poll-question">Quel genre préférez-vous lire ce mois-ci ?</div>
                ${[
                    ['Shōnen action', 45],
                    ['Seinen psychologique', 30],
                    ['Romance', 15],
                    ['Slice of life', 10],
                ].map(([l, p]) => `
                    <div class="poll-option">
                        <div class="poll-option-label"><span>${l}</span><span>${p}%</span></div>
                        <div class="poll-bar-wrap"><div class="poll-bar" style="width:${p}%"></div></div>
                    </div>`).join('')}`;
        }
    }

    // ── Card HTML ──
    // matchTag : tag favori de l'utilisateur présent sur cette série (reco perso)
    function mangaCardHTML(m, matchTag) {
        return `
        <a href="serie.html?id=${encodeURIComponent(m.id)}" class="manga-card" data-manga-id="${m.id}">
            <div class="manga-card-cover">
                <img src="${m.cover || ''}" alt="${MH.esc(m.title)}" loading="lazy" decoding="async"
                     onerror="this.src='${MH.placeholderCover(m.id)}'">
                <div class="manga-card-badges">
                    ${matchTag ? `<span class="badge badge-orange">${MH.esc(matchTag.toUpperCase())}</span>` : ''}
                    ${m.status === 'completed' ? '<span class="badge badge-termine">TERMINÉ</span>' : ''}
                </div>
                <button class="card-fav-btn" data-fav="${m.id}" title="Ajouter aux favoris">${MH.heartIcon(false)}</button>
                <div class="manga-card-overlay">
                    <div class="btn-read-overlay">Lire</div>
                </div>
            </div>
            <div class="manga-card-info">
                <div class="manga-card-title">${MH.esc(m.title)}</div>
                <div class="manga-card-author">${MH.esc(m.author || '')}</div>
                <div class="manga-card-meta">
                    <span class="manga-card-rating">${m.year || ''}</span>
                    ${m.demographic ? `<span>${m.demographic}</span>` : ''}
                </div>
            </div>
        </a>`;
    }

    // Le toggle des favoris (cœurs de cartes) est géré globalement dans global.js.

    // ── Helpers ──
    function showError(zone, msg) {
        const el = document.querySelector('#' + zone) || document.querySelector('.' + zone);
        if (!el) console.warn('[accueil]', msg);
    }
})();
