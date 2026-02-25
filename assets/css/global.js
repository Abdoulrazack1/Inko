// ============================================================
// global.js — Fonctions partagées MangaHub
// Header, footer injection, search, toast, helpers
// ============================================================
(function () {
    'use strict';

    /* ── Helpers ─────────────────────────────────────────── */
    const $ = (sel, ctx = document) => ctx.querySelector(sel);
    const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
    const fmt = n => n >= 1000000 ? (n / 1000000).toFixed(1) + 'M' : n >= 1000 ? Math.round(n / 1000) + 'k' : n;
    const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const slugParam = () => new URLSearchParams(location.search).get('id') || new URLSearchParams(location.search).get('slug');

    window.MH = { $, $$, fmt, esc, slugParam };

    /* ── Toast ───────────────────────────────────────────── */
    window.MH.toast = function (msg, duration = 2500) {
        const el = document.createElement('div');
        el.className = 'toast';
        el.textContent = msg;
        document.body.appendChild(el);
        setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 300); }, duration);
    };

    /* ── Cover image fallback ────────────────────────────── */
    window.MH.coverImg = function (manga, w = 300, h = 420) {
        return `<img src="${manga.cover || manga.coverFallback}" alt="${esc(manga.title)}"
            onerror="this.src='${manga.coverFallback || `https://picsum.photos/seed/${manga.slug}/${w}/${h}`}'"
            loading="lazy">`;
    };

    /* ── Stars renderer ──────────────────────────────────── */
    window.MH.stars = function (rating) {
        const full = Math.floor(rating);
        const half = (rating % 1) >= 0.5;
        let html = '<span class="stars">';
        for (let i = 0; i < 5; i++) {
            if (i < full) html += '★';
            else if (i === full && half) html += '½';
            else html += '<span style="opacity:.25">★</span>';
        }
        return html + '</span>';
    };

    /* ── Render badge (statut) ───────────────────────────── */
    window.MH.statusBadge = function (status) {
        const map = { en_cours: ['badge-cours', 'En cours'], termine: ['badge-termine', 'Terminé'], pause: ['badge-pause', 'Pause'] };
        const [cls, label] = map[status] || ['badge-termine', status];
        return `<span class="badge ${cls}">${label}</span>`;
    };

    /* ── Header HTML ─────────────────────────────────────── */
    const headerHTML = (activePage) => `
    <header class="site-header">
      <a href="index.html" class="header-logo">
        <div class="logo-icon">⚡</div>
        MangaHub
      </a>
      <nav class="header-nav">
        <a href="index.html" class="${activePage === 'accueil' ? 'active' : ''}">Accueil</a>
        <a href="catalogue.html" class="${activePage === 'catalogue' ? 'active' : ''}">Catalogue</a>
        <a href="#" class="${activePage === 'aleatoire' ? 'active' : ''}">Lecture aléatoire</a>
        <a href="collections.html" class="${activePage === 'collections' ? 'active' : ''}">Collection</a>
        <a href="#" class="nav-mes-listes ${activePage === 'listes' ? 'active' : ''}">Mes listes</a>
      </nav>
      <div class="header-search">
        <span class="header-search-icon">🔍</span>
        <input type="text" id="headerSearch" placeholder="Rechercher...">
        <div class="search-dropdown" id="searchDropdown"></div>
      </div>
      <div class="header-actions">
        <button class="header-icon-btn notif-dot" title="Notifications">🔔</button>
        <a href="#" class="header-user">
          <div class="header-avatar">K</div>
          <div class="user-label">Kaito<span class="user-sublabel">Pro</span></div>
        </a>
        <button class="btn-connect btn">Se connecter</button>
      </div>
    </header>`;

    /* ── Footer HTML ─────────────────────────────────────── */
    const footerHTML = `
    <footer class="site-footer">
      <div class="footer-inner">
        <div class="footer-brand">
          <div class="footer-logo"><div class="logo-icon">⚡</div>MangaHub</div>
          <p class="footer-desc">La plateforme ultime pour découvrir, lire et partager votre passion du manga. Rejoignez notre communauté grandissante.</p>
          <div class="footer-stay">
            <h4>Restez informé</h4>
            <div class="footer-email-form">
              <input type="email" placeholder="Votre email...">
              <button>S'inscrire</button>
            </div>
          </div>
        </div>
        <div class="footer-col">
          <h4>Explorer</h4>
          <ul>
            <li><a href="catalogue.html">Catalogue</a></li>
            <li><a href="#">Nouveautés</a></li>
            <li><a href="#">Calendrier</a></li>
            <li><a href="collections.html">Collections</a></li>
            <li><a href="#">Top 100</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <h4>Communauté</h4>
          <ul>
            <li><a href="#">Forum</a></li>
            <li><a href="#">Discord</a></li>
            <li><a href="#">Événements</a></li>
            <li><a href="#">Devenir Modérateur</a></li>
            <li><a href="#">Guide Curateur</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <h4>Légal</h4>
          <ul>
            <li><a href="#">Confidentialité</a></li>
            <li><a href="#">Conditions</a></li>
            <li><a href="#">DMCA</a></li>
            <li><a href="#">Contact</a></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <p>© 2024 MangaHub. Tous droits réservés.</p>
        <div class="footer-socials">
          <a href="#" title="Twitter">𝕏</a>
          <a href="#" title="Instagram">📷</a>
          <a href="#" title="YouTube">▶</a>
        </div>
      </div>
    </footer>`;

    /* ── Inject header & footer ──────────────────────────── */
    window.MH.initPage = function (activePage) {
        const headerSlot = document.getElementById('header-slot');
        const footerSlot = document.getElementById('footer-slot');
        if (headerSlot) headerSlot.outerHTML = headerHTML(activePage);
        if (footerSlot) footerSlot.innerHTML = footerHTML;
        initSearch();
    };

    /* ── Live search ─────────────────────────────────────── */
    function initSearch() {
        const input = document.getElementById('headerSearch');
        const dropdown = document.getElementById('searchDropdown');
        if (!input || !dropdown) return;

        let timeout;
        input.addEventListener('input', () => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                const q = input.value.trim();
                if (q.length < 2) { dropdown.classList.remove('open'); return; }
                if (!window.DB) return;
                const results = DB.searchMangas(q).slice(0, 5);
                if (!results.length) { dropdown.classList.remove('open'); return; }
                dropdown.innerHTML = results.map(m => `
                    <a href="serie.html?id=${m.id}" class="search-result-item">
                        <img src="${m.cover || m.coverFallback}"
                             onerror="this.src='${m.coverFallback}'"
                             alt="">
                        <div class="search-result-info">
                            <div class="title">${esc(m.title)}</div>
                            <div class="meta">${m.author} · ${m.chapters} chap.</div>
                        </div>
                    </a>`).join('');
                dropdown.classList.add('open');
            }, 200);
        });

        document.addEventListener('click', e => {
            if (!input.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.classList.remove('open');
            }
        });

        input.addEventListener('keydown', e => {
            if (e.key === 'Escape') dropdown.classList.remove('open');
            if (e.key === 'Enter') {
                dropdown.classList.remove('open');
                window.location.href = `catalogue.html?q=${encodeURIComponent(input.value.trim())}`;
            }
        });
    }

    /* ── Random lecture ──────────────────────────────────── */
    document.addEventListener('click', e => {
        if (e.target.textContent === 'Lecture aléatoire') {
            e.preventDefault();
            if (!window.DB) return;
            const all = DB.mangas;
            const m = all[Math.floor(Math.random() * all.length)];
            window.location.href = `serie.html?id=${m.id}`;
        }
    });

})();
