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

    // ── Hero (dernières sorties) + Tendances ─────────────────
    const HERO_MS = 7000;
    let heroLatestChap = {};   // mangaId -> { id, chapter } (dernier chapitre, lazy)

    async function loadHeroAndTrending() {
        // Tendances/reco s'appuient sur le populaire ; le hero sur les dernières sorties
        try {
            const [pop, latest] = await Promise.all([
                API.mangas.popular({ limit: 12 }),
                API.mangas.latest({ limit: 8 }),
            ]);
            popularCache = pop.results || [];
            const hasCover = m => m.banner || m.coverLarge || m.cover || m.coverThumb;
            const fresh = (latest.results || []).filter(hasCover);
            const pool  = fresh.length ? fresh : popularCache.filter(hasCover);
            heroMangas = (pool.length ? pool : popularCache).slice(0, 6);
            renderTrending(popularCache.slice(0, 10));
            renderReco(popularCache.slice(4, 7));
            await MH.loadSourceTypes();
            renderHero();
            // Illustration large officielle (banner AniList) en arrière-plan
            heroMangas.forEach((m, i) => {
                API.art.get(m.title).then(a => {
                    if (a && a.banner) {
                        heroMangas[i] = Object.assign({}, heroMangas[i], { banner: a.banner });
                        if (heroIdx === i && heroShow) heroShow(i, true);
                    }
                }).catch(() => {});
            });
        } catch (e) {
            showError('hero', "Impossible de charger l'accueil. Le backend est-il lancé ?");
        }
    }

    // Récupère (et cache) le dernier chapitre d'une série pour le CTA de lecture
    async function fetchLatestChapter(m) {
        if (heroLatestChap[m.id] !== undefined) return heroLatestChap[m.id];
        try {
            const data = await API.mangas.chaptersFor(API.sources.current, m.id,
                { lang: window.Storage?.getPref('readingLang') || 'fr,en', limit: 1 });
            const c = (data.results || [])[0] || null;
            heroLatestChap[m.id] = c;
            return c;
        } catch (e) { heroLatestChap[m.id] = null; return null; }
    }

    function renderHero() {
        const bg    = document.getElementById('heroBg');
        const bgN   = document.getElementById('heroBgNext');
        const content = document.getElementById('heroContent');
        const rail  = document.getElementById('heroRail');
        const prog  = document.getElementById('heroProgress');
        const hero  = document.getElementById('hero');
        if (!bg || !content || !hero || !heroMangas.length) return;

        clearInterval(heroTimer);
        const src = API.sources.current;
        const isNovel = MH.isNovelSource(src);

        function slideHTML(m) {
            const genres = (m.tags || []).filter(Boolean).slice(0, 4);
            const metaBits = [];
            if (m.year) metaBits.push(`<span>${m.year}</span>`);
            if (m.demographic) metaBits.push(`<span class="hero-demo">${MH.esc(m.demographic)}</span>`);
            if (m.status) metaBits.push(MH.statusBadge(m.status));
            const desc = (m.description || '').replace(/\s+/g, ' ').trim();
            return `
                <div class="hero-inner">
                    <a class="hero-poster-link" href="serie.html?id=${encodeURIComponent(m.id)}&source=${encodeURIComponent(src)}">
                        <img class="hero-poster" src="${m.coverLarge || m.cover || ''}" alt="${MH.esc(m.title)}"
                             onerror="this.style.visibility='hidden'">
                        ${isNovel ? '<span class="hero-poster-tag">ROMAN</span>' : ''}
                    </a>
                    <div class="hero-text">
                        <div class="hero-eyebrow"><span class="hero-eyebrow-dot"></span> ${isNovel ? 'Nouveau chapitre · Roman' : 'Dernière sortie'}</div>
                        <a class="hero-title-link" href="serie.html?id=${encodeURIComponent(m.id)}&source=${encodeURIComponent(src)}"><h1 class="hero-title">${MH.esc(m.title)}</h1></a>
                        ${genres.length ? `<div class="hero-genres">${genres.map(g => `<a class="hero-genre" href="catalogue.html?tag=${encodeURIComponent(g)}">${MH.esc(g)}</a>`).join('')}</div>` : ''}
                        ${metaBits.length ? `<div class="hero-meta">${metaBits.join('<span class="hero-dot-sep">·</span>')}</div>` : ''}
                        ${desc ? `<p class="hero-desc">${MH.esc(desc.slice(0, 230))}${desc.length > 230 ? '…' : ''}</p>` : ''}
                        <div class="hero-actions">
                            <a class="btn btn-primary hero-read" id="heroRead" href="serie.html?id=${encodeURIComponent(m.id)}&source=${encodeURIComponent(src)}">
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                                <span id="heroReadLabel">${isNovel ? 'Lire' : 'Lire le dernier chapitre'}</span>
                            </a>
                            <a class="btn btn-secondary" href="serie.html?id=${encodeURIComponent(m.id)}&source=${encodeURIComponent(src)}">Voir la fiche</a>
                            <button class="btn btn-ghost hero-fav-btn" data-fav="${m.id}" title="Ajouter aux favoris">${MH.heartIcon(false)}</button>
                        </div>
                    </div>
                </div>`;
        }

        // Met à jour le CTA "Lire le dernier chapitre" pour le slide visible
        async function wireReadCTA(m) {
            if (isNovel) return; // pour les romans : reste sur la fiche (chapitrage variable)
            const c = await fetchLatestChapter(m);
            if (heroIdx !== heroMangas.indexOf(m)) return; // slide changé entre-temps
            const read = document.getElementById('heroRead');
            const label = document.getElementById('heroReadLabel');
            if (c && read) {
                read.href = MH.readerHref(m.id, c.id, src);
                if (label) label.textContent = `Lire le Ch. ${MH.chapNum(c.chapter)}`;
            }
        }

        // Dégradé déterministe (repli quand aucune image / image protégée)
        function heroGradient(m) {
            const s = ((m.id || '') + (m.title || '')).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
            const h = s % 360;
            return `linear-gradient(135deg, hsl(${h},48%,20%) 0%, hsl(${(h + 45) % 360},52%,9%) 100%)`;
        }
        // backgroundImage = image puis dégradé : si l'image manque/échoue, le dégradé reste peint
        function heroBgValue(m) {
            const url = m.banner || m.coverLarge || m.cover || m.coverThumb || '';
            const grad = heroGradient(m);
            return url ? `url('${url}'), ${grad}` : grad;
        }
        function show(idx, instant) {
            const m = heroMangas[idx]; if (!m) return;
            heroIdx = idx;
            const bgVal = heroBgValue(m);
            hero.classList.toggle('has-banner', !!m.banner);
            // Crossfade du fond via la couche "next"
            if (instant) {
                bg.style.backgroundImage = bgVal;
                bgN.style.opacity = '0';
            } else {
                bgN.style.backgroundImage = bgVal;
                bgN.style.opacity = '1';
                setTimeout(() => { bg.style.backgroundImage = bgVal; bgN.style.opacity = '0'; }, 700);
            }
            content.classList.add('hero-fading');
            setTimeout(() => {
                content.innerHTML = slideHTML(m);
                content.classList.remove('hero-fading');
                if (window.MH?.markFavorites) MH.markFavorites(content);
                wireReadCTA(m);
            }, instant ? 0 : 240);
            rail.querySelectorAll('.hero-thumb').forEach((d, i) => d.classList.toggle('active', i === idx));
            restartProgress();
        }

        function go(idx) { show((idx + heroMangas.length) % heroMangas.length); restart(); }
        function start() { heroTimer = setInterval(() => show((heroIdx + 1) % heroMangas.length), HERO_MS); restartProgress(); }
        function restart() { clearInterval(heroTimer); start(); }
        function restartProgress() {
            if (!prog) return;
            prog.style.transition = 'none'; prog.style.width = '0%';
            // force reflow puis lance l'animation
            void prog.offsetWidth;
            prog.style.transition = `width ${HERO_MS}ms linear`; prog.style.width = '100%';
        }

        // Rail de vignettes (carrousel visuel)
        rail.innerHTML = heroMangas.map((m, i) => `
            <button class="hero-thumb ${i === 0 ? 'active' : ''}" data-i="${i}" aria-label="${MH.esc(m.title)}">
                <img src="${m.coverThumb || m.cover || ''}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">
            </button>`).join('');
        rail.querySelectorAll('.hero-thumb').forEach(t => t.addEventListener('click', () => go(+t.dataset.i)));

        // Flèches
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
            // Pause au survol
            hero.addEventListener('mouseenter', () => { clearInterval(heroTimer); if (prog) { prog.style.transition = 'none'; } });
            hero.addEventListener('mouseleave', restart);
            // Clavier
            hero.setAttribute('tabindex', '0');
            hero.addEventListener('keydown', e => {
                if (e.key === 'ArrowLeft') go(heroIdx - 1);
                else if (e.key === 'ArrowRight') go(heroIdx + 1);
            });
            // Swipe tactile
            let sx = 0;
            hero.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true });
            hero.addEventListener('touchend', e => {
                const dx = e.changedTouches[0].clientX - sx;
                if (Math.abs(dx) > 50) go(heroIdx + (dx < 0 ? 1 : -1));
            }, { passive: true });
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

        // Genres populaires (lien vers le filtre par tag du catalogue)
        const genreEl = document.getElementById('genreCloud');
        if (genreEl) {
            const popular = ['Action','Adventure','Drama','Fantasy','Romance','Comedy','Slice of Life','Horror','Mystery','Sci-Fi'];
            genreEl.innerHTML = popular.map(g =>
                `<a href="catalogue.html?tag=${encodeURIComponent(g)}" class="tag">${g}</a>`
            ).join('');
        }

        renderStatsMini();
        wireInstallButton();
    }

    // Bouton "Installer l'application" : visible seulement si la PWA est installable
    function wireInstallButton() {
        const btn = document.getElementById('btnInstallApp');
        if (!btn) return;
        const show = () => { if (window.MH?.canInstall?.()) { btn.style.display = ''; } };
        show();
        window.addEventListener('pwa:installable', show);
        if (!btn.dataset.bound) {
            btn.dataset.bound = '1';
            btn.addEventListener('click', () => window.MH.pwaInstall());
        }
    }

    // Bloc stats réel (remplace l'ancien faux sondage)
    async function renderStatsMini() {
        const el = document.getElementById('pollBlock');
        if (!el) return;
        if (!API.isLoggedIn()) {
            el.innerHTML = `<div class="sidebar-block-header"><span class="sidebar-block-title">Ta progression</span></div>
                <div style="font-size:12.5px;color:var(--text3);padding:4px 0 2px">
                    <a href="page_login.html" class="link-orange">Connecte-toi</a> pour suivre ta lecture.</div>`;
            return;
        }
        try {
            const stats = await API.me.stats();
            const t = stats.totals || {};
            const streak = stats.streak?.current || 0;
            const item = (num, label) => `<div class="stat-mini2"><div class="stat-mini2-num">${MH.fmt(num || 0)}</div><div class="stat-mini2-label">${label}</div></div>`;
            el.innerHTML = `
                <div class="sidebar-block-header"><span class="sidebar-block-title">Ta progression</span>
                    <a href="stats.html" class="section-link" style="font-size:11px">Détails →</a></div>
                <div class="stats-mini-grid">
                    ${item(t.chapters_read, 'Chapitres')}
                    ${item(t.series_read, 'Séries')}
                    ${item(streak, 'Jours d\'affilée')}
                    ${item(t.favorites, 'Favoris')}
                </div>`;
        } catch (e) { el.innerHTML = ''; }
    }

    // ── Card HTML ──
    // matchTag : tag favori de l'utilisateur présent sur cette série (reco perso)
    const STATUS_LABELS = { ongoing: 'En cours', completed: 'Terminé', hiatus: 'En pause', cancelled: 'Annulé' };
    const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
    function mangaCardHTML(m, matchTag) {
        const isNovel = MH.isNovelSource(API.sources.current);
        const tags = (m.tags || []).filter(Boolean).slice(0, 3);
        const statusLabel = STATUS_LABELS[m.status] || '';
        const sub = m.author || (tags.length ? tags.join(' · ') : (isNovel ? 'Roman' : ''));
        const metaBits = [];
        if (m.year) metaBits.push(`<span class="mc-year">${m.year}</span>`);
        if (m.demographic) metaBits.push(`<span class="mc-demo">${MH.esc(cap(m.demographic))}</span>`);
        if (statusLabel) metaBits.push(`<span class="mc-status mc-${m.status}">${statusLabel}</span>`);
        return `
        <a href="serie.html?id=${encodeURIComponent(m.id)}&source=${encodeURIComponent(API.sources.current)}" class="manga-card" data-manga-id="${m.id}">
            <div class="manga-card-cover">
                <img src="${m.cover || ''}" alt="${MH.esc(m.title)}" loading="lazy" decoding="async"
                     onerror="this.src='${MH.placeholderCover(m.id)}'">
                <div class="manga-card-badges">
                    ${matchTag ? `<span class="badge badge-orange">${MH.esc(matchTag.toUpperCase())}</span>` : ''}
                    ${isNovel ? '<span class="badge" style="background:var(--ai);color:#fff">ROMAN</span>' : ''}
                    ${m.status === 'completed' ? '<span class="badge badge-termine">TERMINÉ</span>' : ''}
                </div>
                <button class="card-fav-btn" data-fav="${m.id}" title="Ajouter aux favoris">${MH.heartIcon(false)}</button>
                <div class="manga-card-overlay">
                    <div class="btn-read-overlay">Lire</div>
                </div>
            </div>
            <div class="manga-card-info">
                <div class="manga-card-title">${MH.esc(m.title)}</div>
                ${sub ? `<div class="manga-card-author">${MH.esc(sub)}</div>` : ''}
                ${metaBits.length ? `<div class="manga-card-meta">${metaBits.join('')}</div>` : ''}
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
