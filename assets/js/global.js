// ============================================================
// global.js — Header, footer, search, toast, helpers
// ============================================================
(function () {
    'use strict';

    /* ── Helpers ─────────────────────────────────────────── */
    const $   = (sel, ctx = document) => ctx.querySelector(sel);
    const $$  = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
    const fmt = n => n >= 1000000 ? (n / 1000000).toFixed(1) + 'M' : n >= 1000 ? Math.round(n / 1000) + 'k' : n;
    const esc = s => (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    window.MH = { $, $$, fmt, esc };

    /* ── Toast ───────────────────────────────────────────── */
    window.MH.toast = function (msg, duration = 2500) {
        const el = document.createElement('div');
        el.className = 'toast';
        el.textContent = msg;
        Object.assign(el.style, {
            position: 'fixed', bottom: '24px', right: '24px', zIndex: '9999',
            background: '#ff6b1a', color: '#fff', padding: '10px 18px',
            borderRadius: '8px', fontSize: '13.5px', fontWeight: '500',
            boxShadow: '0 4px 16px rgba(255,107,26,.4)', opacity: '1',
            transition: 'opacity .3s', pointerEvents: 'none',
            fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        });
        document.body.appendChild(el);
        setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, duration);
    };

    /* ── Star renderer ───────────────────────────────────── */
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

    window.MH.statusBadge = function (status) {
        const map = {
            ongoing:   ['badge-cours', 'En cours'],
            completed: ['badge-termine', 'Terminé'],
            hiatus:    ['badge-pause', 'Pause'],
            cancelled: ['badge-pause', 'Annulé'],
            // Legacy / fr
            en_cours:  ['badge-cours', 'En cours'],
            termine:   ['badge-termine', 'Terminé'],
            pause:     ['badge-pause', 'Pause'],
        };
        const [cls, label] = map[status] || ['badge-termine', status || '—'];
        return `<span class="badge ${cls}">${label}</span>`;
    };

    window.MH.placeholderCover = function (seed) {
        return `https://picsum.photos/seed/${encodeURIComponent(seed || 'manga')}/300/420`;
    };

    /* ── Header HTML ─────────────────────────────────────── */
    const headerHTML = (activePage) => {
        const u = window.API?.user;
        const userBlock = u ? `
          <a href="profil.html" class="header-user" title="${esc(u.username)}">
            <div class="header-avatar">${esc(u.avatar || u.username[0].toUpperCase())}</div>
            <div class="user-label">${esc(u.username)}<span class="user-sublabel">Connecté</span></div>
          </a>
          <button class="btn-connect btn" id="btnLogout" title="Se déconnecter">↩ Déconnexion</button>` : `
          <a href="page_login.html" class="btn-connect btn">Se connecter</a>
          <a href="page_signup.html" class="btn btn-primary btn-sm" style="margin-left:6px">Inscription</a>`;

        return `
        <header class="site-header">
          <a href="accueil.html" class="header-logo">
            <div class="logo-icon">⚡</div>
            MangaHub
          </a>
          <nav class="header-nav">
            <a href="accueil.html" class="${activePage === 'accueil' ? 'active' : ''}">Accueil</a>
            <a href="catalogue.html" class="${['catalogue','serie','chapitre'].includes(activePage) ? 'active' : ''}">Catalogue</a>
            <a href="#" id="navRandom">Lecture aléatoire</a>
            <a href="profil.html" class="nav-mes-listes ${activePage === 'profil' ? 'active' : ''}">Mes listes</a>
          </nav>
          <div class="header-search">
            <span class="header-search-icon">🔍</span>
            <input type="text" id="headerSearch" placeholder="Rechercher un manga…" autocomplete="off">
            <div class="search-dropdown" id="searchDropdown"></div>
          </div>
          <div class="header-actions">
            <button class="header-icon-btn notif-dot" title="Notifications">🔔</button>
            ${userBlock}
          </div>
        </header>`;
    };

    /* ── Footer HTML ─────────────────────────────────────── */
    const footerHTML = `
    <footer class="site-footer">
      <div class="footer-inner">
        <div class="footer-brand">
          <div class="footer-logo"><div class="logo-icon">⚡</div>MangaHub</div>
          <p class="footer-desc">La plateforme ultime pour découvrir, lire et partager votre passion du manga. Propulsé par MangaDex.</p>
          <div class="footer-stay">
            <h4>Restez informé</h4>
            <div class="footer-email-form">
              <input type="email" id="footerEmailInput" placeholder="Votre email…">
              <button id="footerEmailBtn">S'inscrire</button>
            </div>
          </div>
        </div>
        <div class="footer-col">
          <h4>Explorer</h4>
          <ul>
            <li><a href="catalogue.html">Catalogue</a></li>
            <li><a href="catalogue.html?sort=latest">Nouveautés</a></li>
            <li><a href="catalogue.html?sort=rating">Top</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <h4>Communauté</h4>
          <ul>
            <li><a href="#" class="footer-coming">Forum</a></li>
            <li><a href="#" class="footer-coming">Discord</a></li>
            <li><a href="#" class="footer-coming">Contact</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <h4>Légal</h4>
          <ul>
            <li><a href="#" class="footer-coming">Confidentialité</a></li>
            <li><a href="#" class="footer-coming">Conditions</a></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <p>© 2026 MangaHub. Tous droits réservés. Données issues de MangaDex.</p>
      </div>
    </footer>`;

    /* ── Inject header & footer ──────────────────────────── */
    window.MH.initPage = function (activePage) {
        const headerSlot = document.getElementById('header-slot');
        const footerSlot = document.getElementById('footer-slot');
        if (headerSlot) headerSlot.outerHTML = headerHTML(activePage);
        if (footerSlot) footerSlot.innerHTML = footerHTML;
        initSearch();
        initFooterButtons();
        initHeaderButtons();

        // Re-render header au login/logout
        window.addEventListener('auth:change', () => {
            const oldHeader = document.querySelector('.site-header');
            if (!oldHeader) return;
            const wrapper = document.createElement('div');
            wrapper.innerHTML = headerHTML(activePage);
            oldHeader.replaceWith(wrapper.firstElementChild);
            initSearch();
        });
    };

    /* ── Live search ─────────────────────────────────────── */
    function initSearch() {
        const input    = document.getElementById('headerSearch');
        const dropdown = document.getElementById('searchDropdown');
        if (!input || !dropdown) return;

        function render(results, q) {
            if (!results.length) {
                dropdown.innerHTML = `<div style="padding:14px;text-align:center;color:var(--text3);font-size:13px">Aucun résultat${q ? ` pour « ${esc(q)} »` : ''}</div>`;
            } else {
                dropdown.innerHTML = results.map(m => `
                  <a href="serie.html?id=${encodeURIComponent(m.id)}" class="search-result-item">
                      <img src="${m.coverThumb || m.cover || ''}" alt="" loading="lazy" onerror="this.style.display='none'">
                      <div class="search-result-info">
                          <div class="title">${esc(m.title)}</div>
                          <div class="meta">${esc(m.author || '')} ${m.year ? `· ${m.year}` : ''}</div>
                      </div>
                  </a>`).join('');
            }
            if (q && q.length > 0) {
                dropdown.innerHTML += `<a href="catalogue.html?q=${encodeURIComponent(q)}" class="search-result-item" style="justify-content:center;color:var(--orange);font-size:12.5px;font-weight:500;border-top:1px solid var(--border);padding:10px">Voir tous les résultats →</a>`;
            }
            dropdown.classList.add('open');
        }

        let timeout, lastQ;
        async function go(q) {
            lastQ = q;
            try {
                const data = q
                    ? await API.mangas.search({ q, limit: 6 })
                    : await API.mangas.popular({ limit: 6 });
                if (q === lastQ) render(data.results || [], q);
            } catch(e) {
                dropdown.innerHTML = `<div style="padding:14px;text-align:center;color:#ef4444;font-size:12.5px">Erreur de recherche</div>`;
                dropdown.classList.add('open');
            }
        }

        input.addEventListener('focus', () => go(input.value.trim()));
        input.addEventListener('input', () => {
            clearTimeout(timeout);
            const q = input.value.trim();
            timeout = setTimeout(() => go(q), 250);
        });
        document.addEventListener('click', e => {
            if (!input.closest('.header-search').contains(e.target)) dropdown.classList.remove('open');
        });
        input.addEventListener('keydown', e => {
            if (e.key === 'Escape') { dropdown.classList.remove('open'); input.blur(); }
            if (e.key === 'Enter' && input.value.trim()) {
                dropdown.classList.remove('open');
                window.location.href = `catalogue.html?q=${encodeURIComponent(input.value.trim())}`;
            }
        });
    }

    /* ── Footer ──────────────────────────────────────────── */
    function initFooterButtons() {
        const emailBtn   = document.getElementById('footerEmailBtn');
        const emailInput = document.getElementById('footerEmailInput');
        if (emailBtn && emailInput) {
            emailBtn.addEventListener('click', () => {
                const v = emailInput.value.trim();
                if (!v) { MH.toast('Entrez votre adresse email.'); return; }
                if (!API.auth.validateEmail(v)) { MH.toast('Email invalide.'); return; }
                MH.toast('Inscription confirmée ! 🎉');
                emailInput.value = '';
            });
        }
        document.addEventListener('click', e => {
            const link = e.target.closest('.footer-coming');
            if (!link) return;
            e.preventDefault();
            MH.toast('Bientôt disponible !');
        });
    }

    /* ── Header buttons ──────────────────────────────────── */
    let headerButtonsBound = false;
    function initHeaderButtons() {
        if (headerButtonsBound) return;
        headerButtonsBound = true;

        document.addEventListener('click', e => {
            const btn = e.target.closest('.notif-dot');
            if (btn) MH.toast('Aucune nouvelle notification 🔔');
        });

        document.addEventListener('click', async e => {
            const btn = e.target.closest('#btnLogout');
            if (!btn) return;
            e.preventDefault();
            await API.auth.logout();
            MH.toast('Déconnecté avec succès');
            setTimeout(() => { window.location.href = 'accueil.html'; }, 400);
        });

        document.addEventListener('click', async e => {
            const btn = e.target.closest('#navRandom');
            if (!btn) return;
            e.preventDefault();
            try {
                const data = await API.mangas.popular({ limit: 50 });
                const list = data.results || [];
                if (!list.length) return;
                const m = list[Math.floor(Math.random() * list.length)];
                MH.toast(`Lecture aléatoire : ${m.title} 🎲`);
                setTimeout(() => { window.location.href = `serie.html?id=${encodeURIComponent(m.id)}`; }, 500);
            } catch(e) { MH.toast('Erreur de chargement'); }
        });
    }

})();
