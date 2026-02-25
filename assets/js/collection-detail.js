// collection-detail.js
(function () {
    'use strict';
    let col = null; let activeTab = 'series';

    document.addEventListener('DOMContentLoaded', () => {
        MH.initPage('collections');
        const id = parseInt(new URLSearchParams(location.search).get('id'));
        col = DB.getCollection(id) || DB.collections[0];
        document.getElementById('pageTitle').textContent = `MangaHub — ${col.title}`;
        renderHero(); renderTabs(); renderContent(); renderSidebar();
    });

    function renderHero() {
        const el = document.getElementById('cdHero');
        if (!el) return;
        const curator = col.curator;
        el.innerHTML = `
        <div class="cd-hero-inner">
            <div>
                <div class="cd-breadcrumb">
                    <a href="collections.html">Collections</a> / <span>${MH.esc(col.title)}</span>
                </div>
                <div class="cd-collection-type">COLLECTION THÉMATIQUE</div>
                <h1 class="cd-title">${MH.esc(col.title)}</h1>
                <p class="cd-desc">${MH.esc(col.description)}</p>
                <div class="cd-stats-row">
                    ${[
                        [col.seriesCount, 'Séries'],
                        [col.chaptersTotal, 'Chapitres'],
                        [MH.fmt(col.readers), 'Lecteurs'],
                        [col.avgRating, 'Note moy.'],
                        [col.completion + '%', 'Complétion'],
                    ].map(([n, l]) => `
                        <div class="cd-stat">
                            <div class="cd-stat-num">${n}</div>
                            <div class="cd-stat-label">${l}</div>
                        </div>`).join('')}
                </div>
                <div class="cd-actions">
                    <button class="btn btn-primary" onclick="MH.toast('Lecture de la collection démarrée !')">▶ Lancer la lecture</button>
                    <button class="btn btn-secondary" onclick="MH.toast('Collection suivie !')">+ Suivre</button>
                    <button class="btn btn-ghost" onclick="MH.toast('Lien copié !')">↗</button>
                    <button class="btn btn-ghost">•••</button>
                </div>
            </div>
            <div class="cd-curator-card">
                <div class="cd-curator-header">
                    <div class="cd-curator-avatar">${curator.name[0]}</div>
                    <div>
                        <div class="cd-curator-name">${MH.esc(curator.name)}</div>
                        <div class="cd-curator-handle">${MH.esc(curator.handle)}</div>
                    </div>
                </div>
                <div class="cd-curator-quote">"J'ai voulu capturer ce sentiment spécifique de solitude et de puissance. Le silence entre la résidence des donjons est parfois plus tendu que les combats eux-mêmes. Bonne lecture !"</div>
                <div class="cd-curator-stats">
                    <div><div class="cd-curator-stat-num">13</div><div class="cd-curator-stat-label">Collections</div></div>
                    <div><div class="cd-curator-stat-num">${MH.fmt(col.likes)}</div><div class="cd-curator-stat-label">Likes</div></div>
                    <div><div class="cd-curator-stat-num">${col.comments}</div><div class="cd-curator-stat-label">Discussions</div></div>
                </div>
            </div>
        </div>`;
    }

    function renderTabs() {
        const el = document.getElementById('cdTabs');
        if (!el) return;
        const tabs = [
            { k: 'series', l: `Séries (${col.seriesCount})` },
            { k: 'discussions', l: `Discussions (${col.comments})` },
            { k: 'journal', l: 'Journal de bord' },
            { k: 'stats', l: 'Statistiques' },
        ];
        el.innerHTML = tabs.map(t =>
            `<button class="cd-tab ${t.k === activeTab ? 'active' : ''}" data-tab="${t.k}">${t.l}</button>`
        ).join('');
        el.addEventListener('click', e => {
            const btn = e.target.closest('[data-tab]');
            if (!btn) return;
            activeTab = btn.dataset.tab;
            el.querySelectorAll('.cd-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === activeTab));
            renderContent();
        });
    }

    function renderContent() {
        const el = document.getElementById('cdContent');
        if (!el) return;
        if (activeTab === 'series') renderSeries(el);
        else if (activeTab === 'discussions') renderDiscussions(el);
        else el.innerHTML = `<div class="card" style="padding:24px;text-align:center;color:var(--text2)">Section en cours de développement.</div>`;
    }

    function renderSeries(el) {
        const mangas = col.mangaIds.map(id => DB.getManga(id)).filter(Boolean);
        const notes = [
            'La pièce de collection. C\'est l\'œuvre qui définit le trope "Dungeon System". Le style artistique évolue de manière spectaculaire à partir du chapitre 60.',
            'C\'est l\'avis d\'Elena. À lire avant ou après Shadow Monarch. Attention, certaines scènes sont très graphiques. La fin est un chef-d\'œuvre de narration.',
            'Top construction de monde (world building) incroyable. Les règles de chaque étage sont fascinantes. Idéal pour les fans de stratégie.',
            'L\'originalité absolue. Si tu y arrives à la fin tu le mérites. Shōnen. Attention : le roman peut te faire douter si tu y la vie et le mort. Shōnen...',
            'Il ne parle pas, mais il est incroyable. Il ne parle pas, mais il est incroyable. Il ne parle pas mais il vaut 3 mois de niveau pour protéger un inoffensif.',
            'Un mercenaire solitaire contre tous les démons décidées. La seule arme contre ses démons qui la traquent chaque jour.',
            'Aussi bien valorisé par le temps des derniers décideurs. Il s\'est révolté dans un monde qui a changé, mais son cœur reste vrai.',
            'Aussi bien valorisé par le temps des derniers décideurs. Il s\'est révolté dans un monde qui a changé, mais son cœur reste vrai.',
        ];
        el.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
            <div style="font-size:13px;color:var(--text2)">Affichage de <strong style="color:var(--text)">${mangas.length}</strong> séries</div>
            <select class="sort-select" style="height:30px;font-size:12px">
                <option>Ordre recommandé</option>
                <option>Alphabétique</option>
                <option>Note</option>
            </select>
        </div>
        ${mangas.map((m, i) => `
        <div class="cd-serie-item">
            <a href="serie.html?id=${m.id}" class="cd-serie-cover">
                <img src="${m.coverFallback}" alt="${MH.esc(m.title)}"
                     onerror="this.src='${m.coverFallback}'">
                <div class="cd-serie-cover-badge">
                    ${m.isHot ? '<span class="badge badge-hot">HOT</span>' : ''}
                    ${m.status === 'termine' ? '<span class="badge badge-termine">TERMINÉ</span>' : ''}
                </div>
            </a>
            <div class="cd-serie-info">
                <div class="cd-serie-title-row">
                    <div class="cd-serie-title">${MH.esc(m.title)}</div>
                    <span>${MH.stars(m.rating)}</span>
                    <span style="font-size:12px;color:var(--text2)">${m.rating}</span>
                </div>
                <div class="cd-serie-meta">
                    <span>✍️ ${MH.esc(m.author)}</span>
                    <span>•</span>
                    <span>${MH.statusBadge(m.status)}</span>
                    <span>•</span>
                    <span>${m.chapters} Chapitres</span>
                </div>
                <div class="cd-serie-tags">
                    ${m.tags.map(t => `<span class="tag" style="font-size:10.5px;padding:2px 8px">${t}</span>`).join('')}
                </div>
                ${notes[i] ? `
                <div class="cd-serie-note">
                    <div class="cd-serie-note-icon">💬 Note d'Elena :</div>
                    ${MH.esc(notes[i])}
                </div>` : ''}
                <div style="display:flex;gap:8px;margin-top:10px">
                    <a href="chapitre.html?manga=${m.id}&chapter=1" class="btn btn-primary btn-sm">▶ Lire le chapitre 1</a>
                    <a href="serie.html?id=${m.id}" class="btn btn-ghost btn-sm">› Détails</a>
                </div>
            </div>
            <div class="cd-serie-actions">
                <div class="cd-serie-order">+</div>
                <div class="cd-serie-order">↑</div>
            </div>
        </div>`).join('')}`;
    }

    function renderDiscussions(el) {
        const polls = [
            { q: 'Quel système de pouvoir préférez-vous ?', opts: [['Incrémentale (Solo Leveling)', 45], ['Constellations (Omniscient)', 30], ['Tour / Étimo (Tower of God)', 25]] },
            { q: 'Théorie sur la fin des Ombres', text: 'Je pense que l\'histoire se résout mais la véritable finale représente la monarque... finit plus !' },
        ];
        el.innerHTML = polls.map(p => `
        <div class="discussion-item">
            ${p.opts ? `
                <div class="discussion-type">🗳️ SONDAGE DE LA SEMAINE</div>
                <div class="discussion-question">${MH.esc(p.q)}</div>
                ${p.opts.map(([l, pct]) => `
                    <div class="discussion-poll-option">
                        <div class="discussion-poll-label"><span>${l}</span><span>${pct}%</span></div>
                        <div class="discussion-bar-wrap"><div class="discussion-bar" style="width:${pct}%"></div></div>
                    </div>`).join('')}
            ` : `
                <div class="discussion-type">💬 DISCUSSION</div>
                <div class="discussion-question">${MH.esc(p.q)}</div>
                <div style="font-size:12.5px;color:var(--text2);margin-top:6px">${MH.esc(p.text)}</div>
            `}
        </div>`).join('');
    }

    function renderSidebar() {
        const el = document.getElementById('cdSidebar');
        if (!el) return;
        el.innerHTML = `
        <!-- Challenge -->
        <div class="cd-sidebar-block challenge-block">
            <div class="challenge-title">🏆 Challenge Commandaurios</div>
            <div class="challenge-desc">Lisez les 5 premiers titres de la collection pour débloquer le badge exclusif "Donjon Expert".</div>
            <div class="progress-bar"><div class="progress-fill" style="width:40%"></div></div>
            <div class="challenge-progress-text">2 / 5 terminés · En répondre</div>
        </div>

        <!-- Critères de sélection -->
        <div class="cd-sidebar-block">
            <div class="cd-sidebar-title">🎯 Critères de sélection</div>
            ${[['Progression donjons', 4.9], ['World-building', 4.8], ['Puissance', 4.6], ['Système', 4.3], ['Completed', 4.2]].map(([l, s]) => `
                <div class="criteria-item">
                    <span class="criteria-label">${l}</span>
                    <span class="criteria-score ${s >= 4.6 ? 'high' : ''}">${s}</span>
                </div>`).join('')}
        </div>

        <!-- Tags -->
        <div class="cd-sidebar-block">
            <div class="cd-sidebar-title">🏷️ Tags associés</div>
            <div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:6px">
                ${col.tags.map(t => `<span class="tag" style="font-size:10.5px">${t}</span>`).join('')}
            </div>
        </div>

        <!-- Collections similaires -->
        <div class="cd-sidebar-block">
            <div class="cd-sidebar-title">📚 Collections similaires</div>
            ${DB.collections.filter(c => c.id !== col.id).slice(0, 3).map(c => {
                const m = DB.getManga(c.mangaIds[0]);
                return `
                <a href="collection-detail.html?id=${c.id}" class="similar-col-item">
                    <div class="similar-col-cover">
                        <img src="${m ? m.coverFallback : ''}" alt="" onerror="this.style.background='var(--bg4)'">
                    </div>
                    <div class="similar-col-info">
                        <div class="similar-col-title">${MH.esc(c.title)}</div>
                        <div class="similar-col-meta">⭐ ${c.avgRating} · ${c.seriesCount} séries</div>
                    </div>
                </a>`;
            }).join('')}
        </div>`;
    }
})();
