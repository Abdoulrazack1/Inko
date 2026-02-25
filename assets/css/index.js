// index.js — Page d'accueil
(function () {
    'use strict';
    document.addEventListener('DOMContentLoaded', () => {
        MH.initPage('accueil');
        renderHero();
        renderResume();
        renderTrending();
        renderReco();
        renderCollectionBanners();
        renderLatest();
        renderSidebar();
    });

    // ── Hero carousel ────────────────────────────────────────
    let heroIdx = 0;
    const heroMangas = DB.mangas.filter(m => m.isFeatured || m.trendingRank <= 3).slice(0, 4);

    function renderHero() {
        const bg = document.getElementById('heroBg');
        const content = document.getElementById('heroContent');
        const dots = document.getElementById('heroDots');
        if (!bg || !content) return;

        function showHero(idx) {
            const m = heroMangas[idx];
            if (!m) return;
            bg.style.backgroundImage = `url('${m.bannerFallback}')`;
            content.innerHTML = `
                <div class="hero-inner">
                    <div class="hero-badges">
                        ${m.genres.slice(0, 3).map(g => `<span class="hero-badge">${g.toUpperCase()}</span>`).join('')}
                    </div>
                    <h1 class="hero-title">${MH.esc(m.title)}</h1>
                    <div class="hero-meta">
                        <span class="hero-meta-item">✍️ ${MH.esc(m.author)}</span>
                        <span class="hero-meta-item">⭐ ${m.rating} (${MH.fmt(m.reviewCount)} avis)</span>
                        <span class="hero-meta-item">🕐 Màj il y a ${m.lastUpdate}</span>
                    </div>
                    <p class="hero-desc">${MH.esc(m.description)}</p>
                    <div class="hero-actions">
                        <a href="serie.html?id=${m.id}" class="btn btn-primary">▶ Lire le chapitre 1</a>
                        <button class="btn btn-secondary" onclick="MH.toast('Ajouté à vos listes !')">+ Suivre</button>
                    </div>
                </div>`;
            dots.innerHTML = heroMangas.map((_, i) =>
                `<div class="hero-dot ${i === idx ? 'active' : ''}" data-i="${i}"></div>`
            ).join('');
            dots.querySelectorAll('.hero-dot').forEach(d =>
                d.addEventListener('click', () => { heroIdx = +d.dataset.i; showHero(heroIdx); })
            );
        }

        showHero(0);
        setInterval(() => { heroIdx = (heroIdx + 1) % heroMangas.length; showHero(heroIdx); }, 5500);
    }

    // ── Resume reading ───────────────────────────────────────
    function renderResume() {
        const el = document.getElementById('resumeList');
        if (!el) return;
        el.innerHTML = DB.readingHistory.map(h => {
            const m = DB.getManga(h.mangaId);
            if (!m) return '';
            const pct = Math.round((h.chapter / m.chapters) * 100);
            return `
            <a href="chapitre.html?manga=${m.id}&chapter=${h.chapter}" class="resume-item">
                <div class="resume-cover">
                    <img src="${m.coverFallback}" alt="${MH.esc(m.title)}"
                         onerror="this.src='${m.coverFallback}'">
                </div>
                <div class="resume-info">
                    <div class="resume-title">${MH.esc(m.title)}</div>
                    <div class="resume-chap">
                        ${h.page ? `Chapitre ${h.chapter} · Page ${h.page}` : h.chapter}
                    </div>
                    <div class="resume-progress">
                        <div class="resume-progress-fill" style="width:${pct}%"></div>
                    </div>
                </div>
                <div class="resume-action">▶</div>
            </a>`;
        }).join('');
    }

    // ── Trending ─────────────────────────────────────────────
    let trendOffset = 0;
    function renderTrending() {
        const track = document.getElementById('trendingTrack');
        if (!track) return;
        const mangas = DB.getTrending().slice(0, 10);
        track.innerHTML = mangas.map((m, i) => `
            <a href="serie.html?id=${m.id}" class="trending-card">
                <div class="trending-rank">${i + 1}</div>
                <div class="trending-cover">
                    <img src="${m.coverFallback}" alt="${MH.esc(m.title)}"
                         onerror="this.src='${m.coverFallback}'">
                    <div class="trending-overlay">
                        <div class="trending-title">${MH.esc(m.title)}</div>
                        <div class="trending-meta">${m.demographic} · ${MH.fmt(m.readers)} lectures</div>
                    </div>
                </div>
            </a>`).join('');

        document.getElementById('trendPrev')?.addEventListener('click', () => {
            trendOffset = Math.max(0, trendOffset - 1);
            updateTrendScroll();
        });
        document.getElementById('trendNext')?.addEventListener('click', () => {
            trendOffset = Math.min(mangas.length - 5, trendOffset + 1);
            updateTrendScroll();
        });
    }
    function updateTrendScroll() {
        const track = document.getElementById('trendingTrack');
        if (!track) return;
        const cardW = track.firstChild?.offsetWidth + 12 || 0;
        track.style.transform = `translateX(-${trendOffset * cardW}px)`;
    }

    // ── Recommended ──────────────────────────────────────────
    function renderReco() {
        const el = document.getElementById('recoGrid');
        if (!el) return;
        const reco = DB.getRecommended().slice(0, 3);
        el.innerHTML = reco.map(m => mangaCardHTML(m, m.matchPercent)).join('');
    }

    // ── Collection banners ───────────────────────────────────
    function renderCollectionBanners() {
        const el = document.getElementById('collectionBanners');
        if (!el) return;
        const cols = DB.collections.slice(0, 2);
        const gradients = [
            'linear-gradient(135deg,#1a1040,#2d1b69)',
            'linear-gradient(135deg,#1a2040,#1b3069)',
        ];
        el.innerHTML = cols.map((c, i) => `
            <a href="collection-detail.html?id=${c.id}" class="collection-banner">
                <div class="collection-banner-bg" style="background:${gradients[i]}"></div>
                <div class="collection-banner-overlay"></div>
                <div class="collection-banner-content">
                    <div class="collection-banner-type">${c.genre}</div>
                    <div class="collection-banner-title">${MH.esc(c.title)}</div>
                    <div class="collection-banner-link">Explorer →</div>
                </div>
            </a>`).join('');
    }

    // ── Latest releases ──────────────────────────────────────
    let latestCount = 8;
    function renderLatest() {
        const el = document.getElementById('latestGrid');
        if (!el) return;
        const latest = DB.getLatest().slice(0, latestCount);
        el.innerHTML = latest.map(m => mangaCardHTML(m)).join('');
    }

    document.getElementById('btnMore')?.addEventListener('click', () => {
        latestCount += 4;
        renderLatest();
    });

    MH.$('#latestFilters')?.addEventListener('click', e => {
        const btn = e.target.closest('[data-filter]');
        if (!btn) return;
        MH.$$('#latestFilters [data-filter]').forEach(b => b.classList.remove('tag-orange', 'active'));
        btn.classList.add('tag-orange', 'active');
    });

    // ── Sidebar ──────────────────────────────────────────────
    function renderSidebar() {
        // Top Manga
        const topEl = document.getElementById('topMangaList');
        if (topEl) {
            const rankColors = ['top-rank-1', 'top-rank-2', 'top-rank-3'];
            topEl.innerHTML = DB.getTopManga().map((m, i) => `
                <a href="serie.html?id=${m.id}" class="top-manga-item">
                    <div class="top-rank ${rankColors[i] || ''}">${i + 1}</div>
                    <div class="top-cover">
                        <img src="${m.coverFallback}" alt="${MH.esc(m.title)}"
                             onerror="this.src='${m.coverFallback}'">
                    </div>
                    <div class="top-info">
                        <div class="top-title">${MH.esc(m.title)}</div>
                        <div class="top-meta">⭐ ${m.rating} · ${m.demographic}</div>
                    </div>
                </a>`).join('');
        }

        // Poll
        const pollEl = document.getElementById('pollBlock');
        if (pollEl) {
            const p = DB.weeklyPoll;
            pollEl.innerHTML = `
                <div class="sidebar-block-header">
                    <span class="sidebar-block-title">Sondage de la semaine</span>
                </div>
                <div class="poll-question">${MH.esc(p.question)}</div>
                ${p.options.map(o => `
                    <div class="poll-option">
                        <div class="poll-option-label">
                            <span>${MH.esc(o.label)}</span>
                            <span>${o.percent}%</span>
                        </div>
                        <div class="poll-bar-wrap">
                            <div class="poll-bar" style="width:${o.percent}%"></div>
                        </div>
                    </div>`).join('')}`;
        }

        // Comments
        const comEl = document.getElementById('recentComments');
        if (comEl) {
            comEl.innerHTML = DB.recentComments.map(c => {
                const m = DB.getManga(c.mangaId);
                return `
                    <div class="comment-item">
                        <div class="comment-manga">${m ? MH.esc(m.title) : ''}</div>
                        <div class="comment-user">${MH.esc(c.user)} · ${c.time}</div>
                        <div class="comment-text">${MH.esc(c.text)}</div>
                    </div>`;
            }).join('');
        }

        // Genre cloud
        const genreEl = document.getElementById('genreCloud');
        if (genreEl) {
            genreEl.innerHTML = DB.popularGenres.map(g =>
                `<a href="catalogue.html?genre=${encodeURIComponent(g)}" class="tag">${DB.genreIcons[g] || ''} ${g}</a>`
            ).join('');
        }
    }

    // ── Manga card HTML ──────────────────────────────────────
    function mangaCardHTML(m, matchPct) {
        return `
        <a href="serie.html?id=${m.id}" class="manga-card">
            <div class="manga-card-cover">
                <img src="${m.coverFallback}" alt="${MH.esc(m.title)}"
                     onerror="this.src='${m.coverFallback}'">
                <div class="manga-card-badges">
                    ${matchPct ? `<span class="badge badge-orange">${matchPct}% MATCH</span>` : ''}
                    ${m.isHot ? '<span class="badge badge-hot">HOT</span>' : ''}
                    ${m.isNew ? '<span class="badge badge-new">NEW</span>' : ''}
                </div>
                <div class="manga-card-overlay">
                    <div class="btn-read-overlay">▶ Lire</div>
                    <div class="btn-add-overlay">+ Liste</div>
                </div>
            </div>
            <div class="manga-card-info">
                <div class="manga-card-title">${MH.esc(m.title)}</div>
                <div class="manga-card-author">${MH.esc(m.author)}</div>
                <div class="manga-card-meta">
                    <span class="manga-card-rating">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="#f59e0b"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                        ${m.rating}
                    </span>
                    <span class="manga-card-chapter">Chap. ${m.chapters}</span>
                </div>
            </div>
        </a>`;
    }
})();
