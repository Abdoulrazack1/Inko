    window.toggleFullscreen = function () {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
        else document.exitFullscreen();
    };

    function renderTranslatorNote() {
        const el = document.getElementById('translatorNote');
        if (!el) return;
        el.innerHTML = `
        <div class="translator-note">
            <div class="translator-note-icon">⚠️</div>
            <div>
                <div class="translator-note-title">Note du traducteur</div>
                <div class="translator-note-text">Ce chapitre contient des références au folklore coréen concernant les gardiens de temples. Les statues représentent des divinités oubliées. La phrase "Adorez le Seigneur" est une clé importante.</div>
            </div>
            <button class="translator-note-close" onclick="this.closest('.translator-note').remove()">✕</button>
        </div>`;
    }

    function renderPagesArea() {
        const el = document.getElementById('readerPagesArea');
        if (!el) return;
        // Simulated manga page panels (placeholder since no real images)
        el.innerHTML = `
        <div style="width:100%;padding:8px;position:relative">
            <div class="reader-manga-page-demo">
                <div class="reader-manga-demo-grid">
                    <div class="reader-manga-panel large">
                        <div style="color:#2d2d3d;text-align:center">
                            <div style="font-size:12px;color:#3a3a50;margin-bottom:8px">Page ${currentPage} / ${totalPages}</div>
                            <div style="font-size:36px">📖</div>
                            <div style="font-size:12px;color:#3a3a50;margin-top:8px">${MH.esc(manga.title)}</div>
                            <div style="font-size:11px;color:#2a2a40;margin-top:4px">Chapitre ${chapterNum}</div>
                        </div>
                    </div>
                    <div class="reader-manga-panel tall">⬛</div>
                    <div class="reader-manga-panel">⬛</div>
                    <div class="reader-manga-panel">⬛</div>
                    <div class="reader-manga-panel">⬛</div>
                    <div class="reader-manga-panel">⬛</div>
                </div>
            </div>
            <div class="reader-reference">
                <div class="reader-reference-label">📎 Référence</div>
                Statue du Dieu Inconnu
            </div>
        </div>`;
    }

    function renderThumbnails() {
        const el = document.getElementById('readerThumbnails');
        if (!el) return;
        el.innerHTML = Array.from({ length: PAGES_COUNT }, (_, i) => `
            <div class="reader-thumb ${i + 1 === currentPage ? 'active' : ''}" data-page="${i + 1}" onclick="goToPage(${i + 1})">
                <div style="width:100%;height:100%;background:#111;display:flex;align-items:center;justify-content:center;font-size:10px;color:#333">${i + 1}</div>
            </div>`).join('');
    }

    function renderNavigation() {
        const el = document.getElementById('readerNavigation');
        if (!el) return;
        el.innerHTML = `
        <button class="reader-nav-btn" onclick="goToPage(${currentPage - 1})" ${currentPage <= 1 ? 'disabled' : ''}>
            ← Précédent
        </button>
        <div style="text-align:center">
            <div class="reader-nav-page">Page <strong>${currentPage}</strong> / ${totalPages}</div>
            <div class="reader-shortcuts">
                <span class="shortcut-key">← →</span> pages
                <span class="shortcut-key">F</span> plein écran
                <span class="shortcut-key">+/-</span> zoom
            </div>
        </div>
        <button class="reader-nav-btn" onclick="goToPage(${currentPage + 1})" ${currentPage >= totalPages ? 'disabled' : ''}>
            Suivant →
        </button>`;
    }

    window.goToPage = function (p) {
        if (p < 1 || p > totalPages) return;
        currentPage = p;
        renderPagesArea();
        renderThumbnails();
        renderNavigation();
        document.querySelector('.reader-pages-area')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };

    function renderNextChapter() {
        const el = document.getElementById('readerNextChapter');
        if (!el) return;
        const nextChap = chapterNum + 1;
        el.innerHTML = `
        <div class="reader-next-chapter">
            <div class="next-chapter-cover">
                <img src="${manga.coverFallback}" alt="" onerror="this.src='${manga.coverFallback}'" style="filter:brightness(.7)">
            </div>
            <div class="next-chapter-info">
                <div class="next-chapter-label">À suivre</div>
                <div class="next-chapter-title">Chapitre ${nextChap} : L'Éveil</div>
                <div class="next-chapter-desc">Jin-Woo découvre sa nouvelle quête quotidienne...</div>
                <div class="next-chapter-meta">⏱ J-2 · Chargement automatique dans 15s</div>
            </div>
            <a href="chapitre.html?manga=${manga.id}&chapter=${nextChap}" class="btn btn-primary">
                Lecture Suivante →
            </a>
        </div>`;
    }

    function renderDetails() {
        const el = document.getElementById('readerDetails');
        if (!el) return;
        el.innerHTML = `
        <div class="reader-details-block">
            <div class="reader-block-title">Détails & Statistiques</div>
            <div style="font-size:11px;color:var(--text3);margin-bottom:10px">Publié le 14 Octobre 2024 &nbsp;·&nbsp;
                <span style="color:var(--orange)">ShadowScans ⚙</span>
            </div>
            <div class="detail-stats">
                <div class="detail-stat"><div class="detail-stat-num">245k</div><div class="detail-stat-label">VUES</div></div>
                <div class="detail-stat"><div class="detail-stat-num">12.4k</div><div class="detail-stat-label">LIKES</div></div>
                <div class="detail-stat"><div class="detail-stat-num">4.92</div><div class="detail-stat-label">NOTE</div></div>
                <div class="detail-stat"><div class="detail-stat-num">8.9k</div><div class="detail-stat-label">FAVORIS</div></div>
            </div>
            <div class="detail-tags">
                ${manga.genres.map(g => `<span class="tag" style="font-size:10.5px;padding:2px 8px">${g}</span>`).join('')}
            </div>
            <div class="detail-summary">
                <strong>Résumé du chapitre :</strong><br>
                Jin-Woo se retrouve face à une énigme mortelle. Les statues de la salle du trône commencent à bouger une par une, et chaque erreur se paie de sa vie. Le "commandement" du donjon est la seule clé de survie, mais le temps presse alors que ses compagnons tombent un par un.
            </div>
        </div>
        <div class="reader-comments-block">
            <div class="reader-block-title">328 Commentaires
                <span style="float:right;font-size:11px;color:var(--text2)">
                    <a href="#" style="margin-right:8px;color:var(--orange)">Top</a>
                    <a href="#" style="color:var(--text2)">Nouveau</a>
                </span>
            </div>
            <p class="comments-count">Discussion très active (12j/sem)</p>
            <div style="display:flex;gap:6px;margin-bottom:8px">
                ${['B','I','🔗','📷'].map(b => `<button class="reader-icon-btn" style="border-radius:4px">${b}</button>`).join('')}
                <div style="margin-left:auto">
                    <button class="reader-icon-btn" style="border-radius:4px">?</button>
                </div>
            </div>
            <textarea class="comment-input-area" placeholder="Rejoignez la discussion (SPOIL = BAN)"></textarea>
            <div class="comment-warning">⚠ Pas de spoilers du Light Novel dans les commentaires</div>
            <div class="comment-send">
                <button class="btn btn-primary btn-sm" onclick="MH.toast('Commentaire publié !')">Envoyer</button>
            </div>
            <div class="poll-mini">
                <div class="poll-mini-title">🗳 Sondage : Qui va survivre ?</div>
                <div class="poll-mini-q">Jin-Woo seulement</div>
                ${[['Jin-Woo seulement', 85], ['Tout le monde', 10], ['Personne', 5]].map(([l, p]) => `
                    <div class="poll-option">
                        <div class="poll-option-label"><span>${l}</span><span>${p}%</span></div>
                        <div class="poll-bar-wrap"><div class="poll-bar" style="width:${p}%"></div></div>
                    </div>`).join('')}
            </div>
            <div class="staff-comment">
                <div class="staff-name">
                    ShadowScans Admin <span class="staff-badge">STAFF</span>
                    <span style="font-size:11px;color:var(--text3);margin-left:auto">Épinglé</span>
                </div>
                <div class="staff-text">Merci de respecter les règles :</div>
                <div class="staff-rules">
                    <div class="staff-rule">Pas de spoilers du Light Novel</div>
                    <div class="staff-rule">Pas de liens externes</div>
                    <div class="staff-rule">Novel dans les commentaires</div>
                </div>
            </div>
        </div>`;
    }

    function renderPanel() {
        const el = document.getElementById('readerPanel');
        if (!el) return;
        const readPct = Math.round((currentPage / totalPages) * 100);

        el.innerHTML = `
        <!-- Ambiance sonore -->
        <div class="reader-panel-block ambiance-block">
            <div class="panel-block-title">
                <span>AMBIANCE SONORE</span>
                <span class="panel-block-title-icon">🎵</span>
            </div>
            <div class="ambiance-track">Dark Dungeon OST</div>
            <div class="ambiance-controls">
                <button class="ambiance-btn" onclick="MH.toast('Musique en pause')">⏸</button>
                <button class="ambiance-btn" onclick="MH.toast('Piste suivante')">↷</button>
            </div>
        </div>

        <!-- Lore & Encyclopédie -->
        <div class="reader-panel-block">
            <div class="panel-block-title">
                <span>LORE & ENCYCLOPÉDIE</span>
                <span class="panel-block-title-icon">📘</span>
            </div>
            <div class="lore-subject">SUJET : STATUE DE PIERRE</div>
            <div class="lore-text">Ces golems antiques servaient de gardiens dans les temples pré-éveil. Leur sourire est un signe d'activation du protocole d'exécution.</div>
        </div>

        <!-- Casting -->
        <div class="reader-panel-block">
            <div class="panel-block-title">
                <span>CASTING (Chap. ${chapterNum})</span>
                <span style="font-size:11px;color:var(--text2)">4 présents</span>
            </div>
            <div class="casting-grid">
                ${['Jin-Woo', 'Joohee', 'Mr. Song', 'Statue'].map(n => `
                <div class="casting-char">
                    <div class="casting-avatar">${n[0]}</div>
                    <div class="casting-name">${n}</div>
                </div>`).join('')}
            </div>
        </div>

        <!-- Crédits traduction -->
        <div class="reader-panel-block">
            <div class="panel-block-title">
                <span>CRÉDITS TRADUCTION</span>
                <span style="font-size:10px;color:var(--text3)">SHADOWSCANS</span>
            </div>
            ${[['Alex', 'Traducteur'], ['Mina', 'Dessin/Édit'], ['Jay', 'Q-Check']].map(([n, r]) => `
                <div class="credits-row">
                    <div>
                        <div class="credits-name">${n}</div>
                        <div class="credits-role">${r}</div>
                    </div>
                </div>`).join('')}
            <button class="credits-cafe-btn" onclick="MH.toast('Merci pour votre soutien ! ☕')">☕ Leur offrir un café</button>
        </div>

        <!-- Progression de l'arc -->
        <div class="reader-panel-block">
            <div class="panel-block-title">
                <span>PROGRESSION DE L'ARC</span>
                <span class="badge badge-hot" style="font-size:9px">CLIMAX</span>
            </div>
            ${[
                { chap: 'Chap 1–5', title: 'Entrée du Donjon', state: 'done' },
                { chap: `Chap ${chapterNum} (Actuel)`, title: 'Le sourire de la Statue', state: 'current' },
                { chap: 'Chap 13–15', title: 'Le sacrifice', state: 'upcoming' },
            ].map(s => `
                <div class="arc-step">
                    <div class="arc-dot ${s.state === 'current' ? 'current' : s.state === 'done' ? 'done' : ''}"></div>
                    <div>
                        <div class="arc-step-chap">${s.chap}</div>
                        <div class="arc-step-title ${s.state === 'current' ? 'current' : ''}">${s.title}</div>
                    </div>
                </div>`).join('')}
        </div>

        <!-- Ma progression -->
        <div class="reader-panel-block">
            <div class="panel-block-title">
                <span>MA PROGRESSION</span>
                <span style="font-size:11px;color:var(--orange)">${readPct}% Complété</span>
            </div>
            <div class="progress-bar-big"><div class="progress-fill" style="width:${readPct}%"></div></div>
            <div style="display:flex;align-items:center;gap:10px;margin-top:10px">
                <div class="next-chapter-cover" style="width:40px;height:56px">
                    <img src="${manga.coverFallback}" alt="" onerror="this.src='${manga.coverFallback}'">
                </div>
                <div>
                    <div style="font-size:11px;color:var(--text3)">PROCHAINEMENT</div>
                    <div style="font-size:13px;font-weight:600">Chap. ${chapterNum + 1} : L'Éveil</div>
                    <button class="btn btn-ghost btn-xs" style="margin-top:4px" onclick="MH.toast('Rappel activé !')">⏰ M\'alerter</button>
                </div>
            </div>
        </div>

        <!-- Partager -->
        <div class="reader-panel-block">
            <div class="panel-block-title">PARTAGER LE CHAPITRE</div>
            <div class="share-icons">
                ${['🔁', '📋', '🔗', '↗'].map(icon => `
                    <button class="share-icon-btn" onclick="MH.toast('Partagé !')">${icon}</button>`).join('')}
            </div>
        </div>`;
    }

    function bindKeyboard() {
        document.addEventListener('keydown', e => {
            if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') goToPage(currentPage + 1);
            if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') goToPage(currentPage - 1);
            if (e.key === 'f' || e.key === 'F') toggleFullscreen();
            if (e.key === '+' || e.key === '=') changeZoom(10);
            if (e.key === '-') changeZoom(-10);
        });
    }
})();
