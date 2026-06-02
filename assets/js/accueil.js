// accueil.js — Page d'accueil dynamique (backend)
(function () {
    'use strict';

    let heroMangas = [];
    let heroIdx = 0;
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
        } catch(e) {
            showError('hero', "Impossible de charger les tendances. Le backend est-il lancé ?");
        }
    }

    function renderHero() {
        const bg      = document.getElementById('heroBg');
        const content = document.getElementById('heroContent');
        const dots    = document.getElementById('heroDots');
        if (!bg || !content || !heroMangas.length) return;

        function show(idx) {
            const m = heroMangas[idx];
            if (!m) return;
            bg.style.backgroundImage = `url('${m.coverLarge || m.cover || ''}')`;
            content.innerHTML = `
                <div class="hero-inner">
                    <div class="hero-badges">
                        ${(m.tags || []).slice(0, 3).map(g => `<span class="hero-badge">${MH.esc(g.toUpperCase())}</span>`).join('')}
                    </div>
                    <h1 class="hero-title">${MH.esc(m.title)}</h1>
                    <div class="hero-meta">
                        ${m.author ? `<span class="hero-meta-item">✍️ ${MH.esc(m.author)}</span>` : ''}
                        ${m.year ? `<span class="hero-meta-item">📅 ${m.year}</span>` : ''}
                        ${m.status ? `<span class="hero-meta-item">${MH.statusBadge(m.status)}</span>` : ''}
                    </div>
                    <p class="hero-desc">${MH.esc((m.description || '').slice(0, 240))}${m.description?.length > 240 ? '…' : ''}</p>
                    <div class="hero-actions">
                        <a href="serie.html?id=${encodeURIComponent(m.id)}" class="btn btn-primary">▶ Voir la fiche</a>
                        <button class="btn btn-secondary" data-fav="${m.id}">+ Suivre</button>
                    </div>
                </div>`;
            dots.innerHTML = heroMangas.map((_, i) =>
                `<div class="hero-dot ${i === idx ? 'active' : ''}" data-i="${i}"></div>`
            ).join('');
            dots.querySelectorAll('.hero-dot').forEach(d =>
                d.addEventListener('click', () => { heroIdx = +d.dataset.i; show(heroIdx); })
            );
        }

        show(0);
        setInterval(() => { heroIdx = (heroIdx + 1) % heroMangas.length; show(heroIdx); }, 6500);
    }

    function renderTrending(mangas) {
        const track = document.getElementById('trendingTrack');
        if (!track) return;
        track.innerHTML = mangas.map((m, i) => `
            <a href="serie.html?id=${encodeURIComponent(m.id)}" class="trending-card">
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

    // ── Reco (basé sur popular pour l'instant) ────────────
    function renderReco(mangas) {
        const el = document.getElementById('recoGrid');
        if (!el) return;
        el.innerHTML = mangas.map((m, i) => mangaCardHTML(m, [98, 94, 91][i])).join('');
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

    function renderLatest() {
        const el = document.getElementById('latestGrid');
        if (!el || !latestCache) return;
        el.innerHTML = latestCache.slice(0, latestCount).map(m => mangaCardHTML(m)).join('');
    }

    function bindLatestControls() {
        document.getElementById('btnMore')?.addEventListener('click', () => {
            latestCount = Math.min(latestCount + 4, latestCache?.length || 0);
            renderLatest();
        });
        document.getElementById('latestFilters')?.addEventListener('click', e => {
            const btn = e.target.closest('[data-filter]');
            if (!btn) return;
            document.querySelectorAll('#latestFilters [data-filter]')
                .forEach(b => b.classList.remove('tag-orange', 'active'));
            btn.classList.add('tag-orange', 'active');
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

            // Récupère les détails des mangas en parallèle
            const mangas = await Promise.allSettled(entries.map(e => API.mangas.get(e.mangaId)));
            el.innerHTML = entries.map((e, i) => {
                const r = mangas[i];
                if (r.status !== 'fulfilled') return '';
                const m = r.value;
                return `
                <a href="chapitre.html?manga=${encodeURIComponent(m.id)}&chapter=${encodeURIComponent(e.chapterId)}" class="resume-item">
                    <div class="resume-cover">
                        <img src="${m.coverThumb || m.cover || ''}" alt="${MH.esc(m.title)}" loading="lazy">
                    </div>
                    <div class="resume-info">
                        <div class="resume-title">${MH.esc(m.title)}</div>
                        <div class="resume-chap">Chapitre ${e.chapter} · Page ${e.page}</div>
                        <div class="resume-progress"><div class="resume-progress-fill" style="width:${Math.round((e.page / 20) * 100)}%"></div></div>
                    </div>
                    <div class="resume-action">▶</div>
                </a>`;
            }).join('');
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
                <a href="serie.html?id=${encodeURIComponent(m.id)}" class="top-manga-item">
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
    function mangaCardHTML(m, matchPct) {
        return `
        <a href="serie.html?id=${encodeURIComponent(m.id)}" class="manga-card" data-manga-id="${m.id}">
            <div class="manga-card-cover">
                <img src="${m.cover || ''}" alt="${MH.esc(m.title)}" loading="lazy"
                     onerror="this.src='${MH.placeholderCover(m.id)}'">
                <div class="manga-card-badges">
                    ${matchPct ? `<span class="badge badge-orange">${matchPct}% MATCH</span>` : ''}
                    ${m.status === 'completed' ? '<span class="badge badge-termine">TERMINÉ</span>' : ''}
                </div>
                <button class="card-fav-btn" data-fav="${m.id}" title="Ajouter aux favoris">♡</button>
                <div class="manga-card-overlay">
                    <div class="btn-read-overlay">▶ Lire</div>
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

    // ── Toggle favoris global (délégué) ────────────────────
    document.addEventListener('click', async e => {
        const btn = e.target.closest('[data-fav]');
        if (!btn) return;
        e.preventDefault();
        e.stopPropagation();
        if (!API.isLoggedIn()) {
            MH.toast('Connectez-vous pour ajouter des favoris');
            return;
        }
        const id = btn.dataset.fav;
        const card = btn.closest('.manga-card');
        const meta = {
            title: card?.querySelector('.manga-card-title')?.textContent?.trim(),
            cover: card?.querySelector('img')?.src,
        };
        const isFav = btn.classList.toggle('is-fav');
        btn.innerHTML = isFav ? '❤' : '♡';
        try {
            if (isFav) await API.me.addFavorite(id, meta);
            else       await API.me.removeFavorite(id);
            MH.toast(isFav ? 'Ajouté aux favoris' : 'Retiré des favoris');
        } catch(err) {
            MH.toast('Erreur : ' + err.message);
        }
    });

    // ── Helpers ──
    function showError(zone, msg) {
        const el = document.querySelector('#' + zone) || document.querySelector('.' + zone);
        if (!el) console.warn('[accueil]', msg);
    }
})();
