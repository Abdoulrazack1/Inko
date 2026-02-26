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
      <a href="accueil.html" class="header-logo">
        <div class="logo-icon">⚡</div>
        MangaHub
      </a>
      <nav class="header-nav">
        <a href="accueil.html" class="${activePage === 'accueil' ? 'active' : ''}">Accueil</a>
        <a href="catalogue.html" class="${['catalogue','serie','chapitre'].includes(activePage) ? 'active' : ''}">Catalogue</a>
        <a href="#" id="navRandom" class="${activePage === 'aleatoire' ? 'active' : ''}">Lecture aléatoire</a>
        <a href="collections.html" class="${['collections','collection-detail'].includes(activePage) ? 'active' : ''}">Collections</a>
        <a href="profil.html" class="nav-mes-listes ${activePage === 'profil' ? 'active' : ''}">Mes listes</a>
      </nav>
      <div class="header-search">
        <span class="header-search-icon">🔍</span>
        <input type="text" id="headerSearch" placeholder="Rechercher un manga, un auteur…" autocomplete="off">
        <div class="search-dropdown" id="searchDropdown"></div>
      </div>
      <div class="header-actions">
        <button class="header-icon-btn notif-dot" title="Notifications">🔔</button>
        <a href="profil.html" class="header-user">
          <div class="header-avatar">K</div>
          <div class="user-label">Kaito<span class="user-sublabel">Pro</span></div>
        </a>
        <a href="page_login.html" class="btn-connect btn">Se connecter</a>
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
              <input type="email" id="footerEmailInput" placeholder="Votre email...">
              <button id="footerEmailBtn">S'inscrire</button>
            </div>
          </div>
        </div>
        <div class="footer-col">
          <h4>Explorer</h4>
          <ul>
            <li><a href="catalogue.html">Catalogue</a></li>
            <li><a href="catalogue.html?sort=latest">Nouveautés</a></li>
            <li><a href="catalogue.html?view=calendar">Calendrier</a></li>
            <li><a href="collections.html">Collections</a></li>
            <li><a href="catalogue.html?sort=rating">Top 100</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <h4>Communauté</h4>
          <ul>
            <li><a href="#" class="footer-coming">Forum</a></li>
            <li><a href="#" class="footer-coming">Discord</a></li>
            <li><a href="#" class="footer-coming">Événements</a></li>
            <li><a href="#" class="footer-coming">Devenir Modérateur</a></li>
            <li><a href="#" class="footer-coming">Guide Curateur</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <h4>Légal</h4>
          <ul>
            <li><a href="#" class="footer-coming">Confidentialité</a></li>
            <li><a href="#" class="footer-coming">Conditions</a></li>
            <li><a href="#" class="footer-coming">DMCA</a></li>
            <li><a href="#" class="footer-coming">Contact</a></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <p>© 2025 MangaHub. Tous droits réservés.</p>
        <div class="footer-socials">
          <a href="#" class="footer-coming" title="Twitter">𝕏</a>
          <a href="#" class="footer-coming" title="Instagram">📷</a>
          <a href="#" class="footer-coming" title="YouTube">▶</a>
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
        initFooterButtons();
        initHeaderButtons();
    };

    /* ── Live search ─────────────────────────────────────── */
    function initSearch() {
        const input    = document.getElementById('headerSearch');
        const dropdown = document.getElementById('searchDropdown');
        if (!input || !dropdown) return;

        function renderDropdown(results, q) {
            if (!results.length) {
                dropdown.innerHTML = `<div style="padding:14px;text-align:center;color:var(--text3);font-size:13px">Aucun résultat pour « ${esc(q)} »</div>`;
            } else {
                dropdown.innerHTML = results.map(m => `
                <a href="serie.html?id=${m.id}" class="search-result-item">
                    <img src="${m.coverFallback}" alt="" loading="lazy">
                    <div class="search-result-info">
                        <div class="title">${esc(m.title)}</div>
                        <div class="meta">${esc(m.author)} · ${m.chapters} chap. · ⭐ ${m.rating}</div>
                    </div>
                </a>`).join('');
            }
            if (q.length > 0) {
                dropdown.innerHTML += `<a href="catalogue.html?q=${encodeURIComponent(q)}" class="search-result-item" style="justify-content:center;color:var(--orange);font-size:12.5px;font-weight:500;border-top:1px solid var(--border);padding:10px">Voir tous les résultats pour « ${esc(q)} » →</a>`;
            } else {
                dropdown.innerHTML = `<div style="padding:8px 14px 4px;font-size:10px;font-weight:700;color:var(--text3);letter-spacing:.07em">TENDANCES</div>` + dropdown.innerHTML;
            }
            dropdown.classList.add('open');
        }

        function showResults(q) {
            if (!window.DB) { setTimeout(() => showResults(q), 100); return; }
            const results = q.length === 0 ? DB.getTrending(6) : DB.searchMangas(q).slice(0, 7);
            renderDropdown(results, q);
        }

        let timeout;
        input.addEventListener('focus', () => { showResults(input.value.trim()); });
        input.addEventListener('input', () => {
            clearTimeout(timeout);
            const q = input.value.trim();
            if (q.length <= 1) { showResults(q); }
            else { timeout = setTimeout(() => showResults(q), 80); }
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

    /* ── Footer buttons ──────────────────────────────────── */
    function initFooterButtons() {
        // Email newsletter
        const emailBtn = document.getElementById('footerEmailBtn');
        const emailInput = document.getElementById('footerEmailInput');
        if (emailBtn && emailInput) {
            emailBtn.addEventListener('click', () => {
                const v = emailInput.value.trim();
                const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!v) { MH.toast('Entrez votre adresse email.'); return; }
                if (!re.test(v)) { MH.toast('Email invalide.'); emailInput.style.borderColor = '#ef4444'; return; }
                emailInput.style.borderColor = '';
                MH.toast('Inscription confirmée ! 🎉');
                emailInput.value = '';
            });
        }

        // Liens "bientôt disponible" dans footer
        document.addEventListener('click', e => {
            const link = e.target.closest('.footer-coming');
            if (!link) return;
            e.preventDefault();
            MH.toast('Bientôt disponible !');
        });
    }

    /* ── Header buttons ──────────────────────────────────── */
    function initHeaderButtons() {
        // Bouton notifications
        document.addEventListener('click', e => {
            const btn = e.target.closest('.notif-dot');
            if (!btn) return;
            MH.toast('Aucune nouvelle notification 🔔');
        });

        // Bouton "Se connecter" → page login
        document.addEventListener('click', e => {
            const btn = e.target.closest('.btn-connect');
            if (!btn) return;
            // laisse le href fonctionner normalement
        });
    }

    /* ── Premium button (délégation globale) ─────────────── */
    document.addEventListener('click', e => {
        const btn = e.target.closest('.btn-premium, [data-premium]');
        if (btn) {
            e.preventDefault();
            MH.toast('MangaHub Premium — Bientôt disponible ! ⚡');
        }
        // Bouton "Essayer gratuitement" dans sidebar premium
        if (e.target.closest('.sidebar-premium .btn-primary')) {
            MH.toast('MangaHub Premium — Bientôt disponible ! ⚡');
        }
        // Bouton "Commencer maintenant" CTA collections
        if (e.target.closest('.create-cta .btn-primary')) {
            MH.toast('Créateur de collections — Bientôt disponible !');
        }
    });

    /* ── Random lecture ──────────────────────────────────── */
    // Utilise la délégation sur document pour capturer le bouton même après injection HTML
    document.addEventListener('click', e => {
        const btn = e.target.closest('#navRandom');
        if (!btn) return;
        e.preventDefault();

        // Attendre que DB soit disponible (data.js chargé après global.js)
        function tryRandom() {
            if (!window.DB || !DB.mangas || !DB.mangas.length) {
                setTimeout(tryRandom, 50);
                return;
            }
            const m = DB.mangas[Math.floor(Math.random() * DB.mangas.length)];
            MH.toast(`Lecture aléatoire : ${m.title} 🎲`);
            setTimeout(() => { window.location.href = `serie.html?id=${m.id}`; }, 600);
        }
        tryRandom();
    });

})();