// serie.js — MangaHub  (version complète avec tous les éléments cliquables)
(function () {
    'use strict';
    let manga = null;
    let activeTab = 'apercu';
    let chapSortAsc = false;
    let chapFilter = '';

    document.addEventListener('DOMContentLoaded', () => {
        MH.initPage('serie');
        const id = parseInt(new URLSearchParams(location.search).get('id'));
        manga = DB.getManga(id) || DB.mangas[0];
        document.getElementById('pageTitle').textContent = 'MangaHub — ' + manga.title;
        renderHero();
        renderTabs();
        renderTab('apercu');
        renderSidebar();
    });

    // ══ HERO ══════════════════════════════════════════════════
    function renderHero() {
        const el = document.getElementById('serieHero');
        if (!el) return;
        const statusLabel = { en_cours:'En cours', termine:'Terminé', pause:'En pause' }[manga.status] || manga.status;
        el.innerHTML = `
        <div class="serie-hero-inner">
            <div class="serie-cover-wrap">
                <div class="serie-cover-status">${MH.statusBadge(manga.status)}</div>
                <div class="serie-cover">
                    <img src="${manga.coverFallback}" alt="${MH.esc(manga.title)}"
                         onerror="this.src='${manga.coverFallback}'">
                </div>
                <div class="serie-cover-rating">⭐ ${manga.rating} · ${MH.fmt(manga.reviewCount)} avis</div>
            </div>
            <div class="serie-info">
                <div class="serie-title-tags">
                    ${manga.genres.map(g => `<a href="catalogue.html?genre=${encodeURIComponent(g)}" class="tag tag-link">${g}</a>`).join('')}
                </div>
                <h1 class="serie-title">${MH.esc(manga.title)}</h1>
                <div class="serie-title-jp">${MH.esc(manga.titleJP)} · ${MH.esc(manga.title)}</div>
                <div class="serie-meta-row">
                    <span class="serie-meta-item"><span class="serie-meta-icon">✍️</span> ${MH.esc(manga.author)}</span>
                    <span class="serie-meta-item"><span class="serie-meta-icon">📖</span> ${manga.chapters} chapitres</span>
                    <span class="serie-meta-item"><span class="serie-meta-icon">⏱️</span> ~${Math.round(manga.chapters * 0.35)}h</span>
                    <span class="serie-meta-item"><span class="serie-meta-icon">📅</span> ${manga.firstYear}</span>
                    <span class="serie-meta-item">
                        <span class="serie-meta-icon">🔵</span>
                        <span class="status-badge status-${manga.status}">${statusLabel}</span>
                    </span>
                </div>
                <p class="serie-desc-short">${MH.esc(manga.description)}</p>
                <div class="serie-actions">
                    <a href="chapitre.html?manga=${manga.id}&chapter=1" class="btn btn-primary">▶ Lire depuis le début</a>
                    ${manga.progress > 0 ? `<a href="chapitre.html?manga=${manga.id}&chapter=${Math.round((manga.progress/100)*manga.chapters)||1}" class="btn btn-secondary">↻ Reprendre</a>` : ''}
                    <button class="btn btn-ghost" onclick="toggleFavorite(this)">♡ Ajouter à ma liste</button>
                    <button class="btn btn-ghost btn-icon" onclick="MH.toast('Lien copié !')" title="Partager">↗</button>
                </div>
            </div>
            <div class="serie-fiche">
                <div class="serie-fiche-title">Fiche rapide</div>
                <div class="fiche-subtitle">Informations principales</div>
                ${[
                    ['Statut', statusLabel],
                    ['Type', manga.type || 'Manga'],
                    ['Plateforme', manga.platform],
                    ['Fréquence', manga.frequency],
                    ['1er chapitre', manga.firstYear],
                    ['Démographie', manga.demographic],
                    ['Mise à jour', manga.lastUpdate],
                ].map(([k, v]) => `
                    <div class="fiche-row">
                        <span class="fiche-key">${k}</span>
                        <span class="fiche-val">${v}</span>
                    </div>`).join('')}
                <div class="fiche-langs">
                    ${(manga.language || []).map(l => `<span class="lang-badge">${l}</span>`).join('')}
                </div>
            </div>
        </div>`;
    }

    window.toggleFavorite = function(btn) {
        const isFav = btn.classList.toggle('is-fav');
        btn.textContent = isFav ? '❤ Dans ma liste' : '♡ Ajouter à ma liste';
        MH.toast(isFav ? 'Ajouté à votre liste !' : 'Retiré de votre liste');
    };

    // ══ TABS ══════════════════════════════════════════════════
    function renderTabs() {
        const tabs = document.getElementById('serieTabs');
        const right = document.getElementById('serieTabsRight');
        if (!tabs) return;

        const tabDefs = [
            { key: 'apercu',      label: 'Aperçu' },
            { key: 'chapitres',   label: `Chapitres (${manga.chapters})` },
            { key: 'personnages', label: 'Personnages' },
            { key: 'similaires',  label: 'Similaires' },
        ];

        tabs.innerHTML = tabDefs.map(t =>
            `<button class="serie-tab ${activeTab === t.key ? 'active' : ''}" data-tab="${t.key}">${t.label}</button>`
        ).join('');

        tabs.addEventListener('click', e => {
            const btn = e.target.closest('[data-tab]');
            if (!btn) return;
            activeTab = btn.dataset.tab;
            MH.$$('.serie-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === activeTab));
            renderTab(activeTab);
        });

        if (right) {
            const chaps = DB.getChapters(manga.id);
            const lastRead = chaps.find(c => c.isRead);
            right.innerHTML = lastRead
                ? `Dernière lecture : <a href="chapitre.html?manga=${manga.id}&chapter=${lastRead.number}" class="link-orange">Chap. ${lastRead.number}</a> · Màj ${manga.lastUpdate}`
                : `${manga.chapters} chapitres · Màj ${manga.lastUpdate}`;
        }
    }

    function renderTab(tab) {
        const main = document.getElementById('serieMain');
        if (!main) return;
        const map = {
            apercu: renderApercu,
            chapitres: renderChapitres,
            personnages: renderPersonnages,
            similaires: renderSimilaires,
        };
        (map[tab] || renderApercu)(main);
    }

    // ══ APERÇU ════════════════════════════════════════════════
    function renderApercu(el) {
        const chaps = DB.getChapters(manga.id);
        const recent = chaps.slice(0, 5);
        const similar = DB.getSimilar(manga.id).slice(0, 3);

        el.innerHTML = `
        <div class="synopsis-block">
            <div class="synopsis-block-header">
                <div class="synopsis-block-title">Synopsis</div>
            </div>
            <div class="synopsis-text">${MH.esc(manga.synopsis || manga.description)}</div>
        </div>

        <div class="chapters-block">
            <div class="chapters-block-header">
                <div class="chapters-block-title">Derniers chapitres</div>
                <button class="section-link" data-goto="chapitres">Voir tous →</button>
            </div>
            <div class="chapters-list">
                ${recent.map(c => renderChapterRow(c)).join('') || renderFakeChapters()}
            </div>
            <div class="chapters-see-all">
                <a class="link-orange" data-goto="chapitres" href="#">Voir tous les ${manga.chapters} chapitres</a>
            </div>
        </div>

        <div class="characters-block">
            <div class="synopsis-block-header">
                <div class="synopsis-block-title">Personnages principaux</div>
            </div>
            <div class="characters-grid">
                ${(manga.characters || []).map(c => renderCharCard(c)).join('')}
            </div>
        </div>

        <div class="similar-block">
            <div class="synopsis-block-header">
                <div class="synopsis-block-title">Similaires</div>
            </div>
            <div class="similar-grid">
                ${similar.map(m => renderSimilarCard(m)).join('')}
            </div>
        </div>`;

        // Déléguer les clics "Voir tous"
        el.querySelectorAll('[data-goto="chapitres"]').forEach(btn => {
            btn.addEventListener('click', e => {
                e.preventDefault();
                activeTab = 'chapitres';
                MH.$$('.serie-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === 'chapitres'));
                renderTab('chapitres');
                document.getElementById('serieTabsBar')?.scrollIntoView({ behavior: 'smooth' });
            });
        });
    }

    function renderChapterRow(c) {
        return `
        <a href="chapitre.html?manga=${manga.id}&chapter=${c.number}" class="chapter-row${c.isNew ? ' chapter-row--new' : ''}${c.isRead ? ' chapter-row--read' : ''}">
            <div class="chapter-num">Chap. ${c.number}</div>
            <div class="chapter-title-text">${MH.esc(c.title)}</div>
            <div class="chapter-meta">
                ${c.isNew ? '<span class="badge-new">NOUVEAU</span>' : ''}
                <span class="chapter-date">Il y a ${c.publishDate}</span>
                <span class="chapter-time">${c.readTime} min</span>
                <span class="chapter-read-dot ${c.isRead ? 'is-read' : ''}" title="${c.isRead ? 'Lu' : 'Non lu'}"></span>
            </div>
        </a>`;
    }

    function renderFakeChapters() {
        return Array.from({ length: 5 }, (_, i) => {
            const n = manga.chapters - i;
            return `<a href="chapitre.html?manga=${manga.id}&chapter=${n}" class="chapter-row">
                <div class="chapter-num">Chap. ${n}</div>
                <div class="chapter-title-text">Chapitre ${n}</div>
                <div class="chapter-meta">
                    <span class="chapter-date">Il y a ${i + 1} semaine${i ? 's' : ''}</span>
                    <span class="chapter-time">~15 min</span>
                </div>
            </a>`;
        }).join('');
    }

    // ══ LISTE COMPLÈTE DES CHAPITRES ══════════════════════════
    function renderChapitres(el) {
        const allChaps = DB.getChapters(manga.id);

        // Générer des chapitres fictifs si la DB en a trop peu
        let chaps = allChaps.length ? allChaps : generateAllChapters();

        el.innerHTML = `
        <div class="chapters-block">
            <div class="chapters-block-header">
                <div class="chapters-block-title">Tous les chapitres · <span id="chapCount">${chaps.length}</span></div>
                <div class="chapters-controls">
                    <input type="text" id="chapSearch" class="chap-search-input" placeholder="Chercher un chapitre…">
                    <button class="chap-sort-btn" id="chapSortBtn" title="Inverser l'ordre">
                        ${chapSortAsc ? '↑ Ancien' : '↓ Récent'}
                    </button>
                </div>
            </div>
            <div class="chapters-list" id="chapsList"></div>
        </div>`;

        // Bind recherche & tri
        const input = el.querySelector('#chapSearch');
        const sortBtn = el.querySelector('#chapSortBtn');
        const list = el.querySelector('#chapsList');
        const countEl = el.querySelector('#chapCount');

        function renderList() {
            let filtered = chaps.filter(c =>
                !chapFilter ||
                c.number.toString().includes(chapFilter) ||
                c.title.toLowerCase().includes(chapFilter.toLowerCase())
            );
            if (chapSortAsc) filtered = [...filtered].reverse();
            countEl.textContent = filtered.length;
            list.innerHTML = filtered.map(c => renderChapterRow(c)).join('') || '<div class="chapters-empty">Aucun chapitre trouvé</div>';
        }

        input.value = chapFilter;
        input.addEventListener('input', () => { chapFilter = input.value; renderList(); });
        sortBtn.addEventListener('click', () => {
            chapSortAsc = !chapSortAsc;
            sortBtn.textContent = chapSortAsc ? '↑ Ancien' : '↓ Récent';
            renderList();
        });

        renderList();
    }

    function generateAllChapters() {
        const total = manga.chapters;
        return Array.from({ length: Math.min(total, 200) }, (_, i) => {
            const n = total - i;
            return {
                id: manga.id * 10000 + n, mangaId: manga.id, number: n,
                title: 'Chapitre ' + n,
                publishDate: i === 0 ? '2 jours' : i < 4 ? (i * 7 + ' jours') : (Math.round(i * 1.5) + ' semaines'),
                readTime: Math.floor(Math.random() * 10) + 8,
                isRead: n <= Math.floor(total * 0.3),
                pages: 20, isNew: i === 0,
            };
        });
    }

    // ══ PERSONNAGES ═══════════════════════════════════════════
    function renderPersonnages(el) {
        el.innerHTML = `
        <div class="characters-block">
            <div class="synopsis-block-header">
                <div class="synopsis-block-title">Personnages principaux</div>
            </div>
            <div class="characters-grid characters-grid--full">
                ${(manga.characters || []).map(c => renderCharCard(c, true)).join('')}
            </div>
        </div>`;
    }

    function renderCharCard(c, large) {
        return `
        <div class="character-card${large ? ' character-card--lg' : ''}">
            <div class="character-avatar${large ? ' character-avatar--lg' : ''}">${c.name[0]}</div>
            <div>
                <div class="character-name">${MH.esc(c.name)}</div>
                <div class="character-role">${MH.esc(c.role)}</div>
            </div>
        </div>`;
    }

    // ══ SIMILAIRES ════════════════════════════════════════════
    function renderSimilaires(el) {
        const similar = DB.getSimilar(manga.id);
        el.innerHTML = `
        <div class="similar-block">
            <div class="synopsis-block-header">
                <div class="synopsis-block-title">Séries similaires</div>
            </div>
            <div class="manga-grid-3">
                ${similar.map(m => `
                <a href="serie.html?id=${m.id}" class="manga-card">
                    <div class="manga-card-cover">
                        <img src="${m.coverFallback}" alt="${MH.esc(m.title)}"
                             onerror="this.src='${m.coverFallback}'">
                        <div class="manga-card-overlay"><div class="btn-read-overlay">▶ Lire</div></div>
                    </div>
                    <div class="manga-card-info">
                        <div class="manga-card-title">${MH.esc(m.title)}</div>
                        <div class="manga-card-author">${MH.esc(m.author)}</div>
                        <div class="manga-card-meta">
                            <span class="manga-card-rating">⭐ ${m.rating}</span>
                            <span>${m.chapters} chap.</span>
                        </div>
                    </div>
                </a>`).join('')}
            </div>
        </div>`;
    }

    function renderSimilarCard(m) {
        return `
        <a href="serie.html?id=${m.id}" class="similar-card">
            <div class="similar-cover">
                <img src="${m.coverFallback}" alt="${MH.esc(m.title)}" onerror="this.src='${m.coverFallback}'">
            </div>
            <div class="similar-title">${MH.esc(m.title)}</div>
            <div class="similar-meta">${(m.genres || []).slice(0,2).join(' · ')}</div>
        </a>`;
    }

    // ══ SIDEBAR ═══════════════════════════════════════════════
    function renderSidebar() {
        const el = document.getElementById('serieSidebar');
        if (!el) return;
        const readPct = manga.progress || 0;
        const chapRead = Math.round((readPct / 100) * manga.chapters);
        const resumeChap = Math.min(chapRead + 1, manga.chapters);

        el.innerHTML = `
        <!-- Progression -->
        <div class="sidebar-progress">
            <div class="sidebar-progress-header">
                <div class="sidebar-progress-title">Ma progression</div>
            </div>
            <div class="progress-stat">
                <span class="progress-label">Chapitres lus</span>
                <span class="progress-val">${chapRead} / ${manga.chapters}</span>
            </div>
            <div class="progress-bar-big"><div class="progress-fill" style="width:${readPct}%"></div></div>
            <div class="progress-stat">
                <span class="progress-label">Temps estimé</span>
                <span class="progress-val">~${Math.round(chapRead * 0.35)}h</span>
            </div>
            <a href="chapitre.html?manga=${manga.id}&chapter=${resumeChap}" class="btn btn-primary sidebar-resume-btn">
                ${chapRead > 0 ? '↻ Reprendre — Chap. ' + resumeChap : '▶ Commencer — Chap. 1'}
            </a>
        </div>

        <!-- Stats globales -->
        <div class="sidebar-stats card" style="padding:14px">
            <div class="sidebar-block-header">
                <span class="sidebar-block-title">Statistiques</span>
            </div>
            ${[
                ['Abonnés', MH.fmt(manga.subscribers)],
                ['Lectures totales', MH.fmt(manga.totalReads)],
                ['Note', manga.rating + ' / 5 ⭐'],
                ['Recommandation', manga.completionRate + '%'],
            ].map(([l, v]) => `
                <div class="progress-stat">
                    <span class="progress-label">${l}</span>
                    <span class="progress-val">${v}</span>
                </div>`).join('')}
        </div>

        <!-- Tags -->
        <div class="sidebar-tags card" style="padding:14px">
            <div class="sidebar-block-header">
                <span class="sidebar-block-title">Tags</span>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">
                ${(manga.tags2 || manga.tags || []).map(t =>
                    `<a href="catalogue.html?q=${encodeURIComponent(t.replace('#',''))}" class="tag tag-link">${t}</a>`
                ).join('')}
            </div>
        </div>

        <!-- Avis rapides -->
        ${manga.quickReviews && manga.quickReviews.length ? `
        <div class="sidebar-reviews card" style="padding:14px">
            <div class="sidebar-block-header">
                <span class="sidebar-block-title">Avis de la communauté</span>
            </div>
            ${manga.quickReviews.map(r => `
                <div class="quick-review">
                    ${MH.esc(r.text)}
                    <div class="quick-review-user">— ${r.user}</div>
                </div>`).join('')}
        </div>` : ''}`;
    }
})();