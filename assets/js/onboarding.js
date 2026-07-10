// ============================================================
// onboarding.js — Visite guidée de première ouverture
// ------------------------------------------------------------
// S'affiche UNE fois, au premier lancement après installation
// (drapeau localStorage `inko_tour_done`), comme les grandes apps.
// Présente chaque page et le fonctionnement d'Inko en 7 étapes.
// Rejouable depuis Paramètres → « Revoir la visite guidée ».
// Chargé dynamiquement par global.js ; expose window.InkoTour.start().
// ============================================================
(function () {
    'use strict';

    const FLAG = 'inko_tour_done';

    const S = (p, size = 44) =>
        `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;

    const ART = {
        logo:    `<div class="itr-kanji">愛</div>`,
        explore: S('<path d="M4 5a2 2 0 0 1 2-2h7v18H6a2 2 0 0 0-2 2z"/><path d="M13 3h5a2 2 0 0 1 2 2v16a2 2 0 0 0-2-2h-5"/>'),
        library: S('<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>'),
        reader:  S('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>'),
        journal: S('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8M16 17H8M10 9H8"/>'),
        bell:    S('<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>'),
        rocket:  S('<path d="M12 2c4 2 6 6 6 10l3 4-5-1a7 7 0 0 1-8 0l-5 1 3-4c0-4 2-8 6-10z"/><circle cx="12" cy="10" r="2"/>'),
    };

    const SLIDES = [
        {
            art: 'logo', accent: 'var(--accent, #c1531b)',
            title: 'Bienvenue sur Inko',
            text: 'Ton sanctuaire de lecture : <strong>mangas, light novels et livres</strong>, dans une app qui t’appartient. Pas de compte, pas de pub — ta bibliothèque et ta progression restent chez toi.',
        },
        {
            art: 'explore', accent: '#c1531b',
            title: 'Explore le catalogue',
            text: '<strong>Catalogue</strong> et <strong>Recherche</strong> puisent dans les extensions intégrées (MangaDex, Weeb Central, novels, classiques…). Active le mode « Toutes les sources » dans <strong>Sources</strong> pour chercher partout à la fois.',
        },
        {
            art: 'library', accent: '#3d5170',
            title: 'Construis ta bibliothèque',
            text: 'Sur une œuvre : <strong>« Ajouter à ma liste »</strong>, un statut (en cours, terminé, à lire…) et des catégories. Le bouton <strong>« Mettre à jour »</strong> de la bibliothèque vérifie les nouveaux chapitres de toutes tes séries.',
        },
        {
            art: 'reader', accent: '#c1531b',
            title: 'Un lecteur à ta main',
            text: 'Sens de lecture <strong>manga (RTL)</strong>, page simple, double ou défilement webtoon, gestes tactiles, mode nuit. Tout se règle depuis le lecteur lui-même ou dans <strong>Paramètres</strong>.',
        },
        {
            art: 'journal', accent: '#3d5170',
            title: 'Ton journal de lecture',
            text: 'Prends des <strong>notes pendant ta lecture</strong>, donne ton avis, suis tes <strong>statistiques</strong> et débloque des badges sur ton <strong>Profil</strong>. Comme un carnet, mais qui se remplit tout seul.',
        },
        {
            art: 'bell', accent: '#a83232',
            title: 'Ne rate aucun chapitre',
            text: 'La <strong>cloche</strong> te notifie quand une série de ta bibliothèque a un nouveau chapitre — avec sa couverture. Et connecte <strong>AniList</strong> en un clic (Paramètres → Comptes liés) pour synchroniser ta progression.',
        },
        {
            art: 'rocket', accent: 'var(--accent, #c1531b)',
            title: 'C’est parti !',
            text: 'Commence par le <strong>Catalogue</strong> pour trouver ta première série, ou importe tes propres fichiers <strong>EPUB / CBZ / PDF</strong>. Tu peux revoir cette visite depuis les Paramètres. Bonne lecture !',
            cta: 'Commencer à lire',
        },
    ];

    const CSS = `
    .itr-veil{position:fixed;inset:0;z-index:99990;background:color-mix(in srgb, var(--bg, #111) 55%, transparent);
      -webkit-backdrop-filter:blur(18px) saturate(1.4);backdrop-filter:blur(18px) saturate(1.4);
      display:flex;align-items:center;justify-content:center;padding:20px;opacity:0;transition:opacity .35s ease}
    .itr-veil.on{opacity:1}
    .itr-card{position:relative;width:min(520px,94vw);background:var(--bg2,#1a1a1e);border:1px solid var(--border,#333);
      border-radius:22px;padding:44px 38px 30px;text-align:center;overflow:hidden;
      box-shadow:0 30px 80px -20px rgba(0,0,0,.5);transform:translateY(14px) scale(.98);transition:transform .35s cubic-bezier(.2,.9,.3,1.2)}
    .itr-veil.on .itr-card{transform:none}
    .itr-card::after{content:'';position:absolute;top:0;right:0;width:34px;height:34px;
      background:linear-gradient(225deg, var(--bg,#111) 50%, transparent 50.5%);opacity:.9}
    .itr-skip{position:absolute;top:14px;left:16px;background:none;border:none;color:var(--text3,#888);
      font-size:12px;cursor:pointer;padding:6px 8px;border-radius:8px}
    .itr-skip:hover{color:var(--text,#eee);background:var(--bg3,#222)}
    .itr-art{width:96px;height:96px;margin:6px auto 20px;border-radius:28px;display:flex;align-items:center;justify-content:center;
      background:color-mix(in srgb, currentColor 12%, transparent);transition:color .3s}
    .itr-kanji{font-size:52px;line-height:1;font-weight:700}
    .itr-step{font-size:10.5px;font-weight:700;letter-spacing:.14em;color:var(--text3,#888);margin-bottom:8px}
    .itr-title{font-family:var(--font-head,inherit);font-size:24px;font-weight:700;margin-bottom:12px;color:var(--text,#eee)}
    .itr-text{font-size:14px;line-height:1.65;color:var(--text2,#bbb);min-height:92px}
    .itr-text strong{color:var(--text,#eee);font-weight:600}
    .itr-dots{display:flex;gap:7px;justify-content:center;margin:22px 0 20px}
    .itr-dot{width:7px;height:7px;border-radius:99px;background:var(--bg4,#333);border:none;padding:0;cursor:pointer;transition:all .3s}
    .itr-dot.on{width:22px;background:var(--accent,#c1531b)}
    .itr-nav{display:flex;gap:10px;justify-content:center;align-items:center}
    .itr-btn{border:none;cursor:pointer;border-radius:12px;padding:12px 26px;font-size:13.5px;font-weight:600;transition:all .2s}
    .itr-next{background:var(--accent,#c1531b);color:#fff;min-width:150px}
    .itr-next:hover{filter:brightness(1.08);transform:translateY(-1px)}
    .itr-prev{background:var(--bg3,#222);color:var(--text2,#bbb)}
    .itr-prev:hover{color:var(--text,#eee)}
    .itr-anim{animation:itrIn .32s ease both}
    @keyframes itrIn{from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:none}}
    @media (max-width:480px){.itr-card{padding:38px 22px 24px}.itr-title{font-size:20px}.itr-text{font-size:13px}}
    `;

    let idx = 0, veil = null;

    function done() {
        try { localStorage.setItem(FLAG, '1'); } catch (e) {}
        if (!veil) return;
        veil.style.opacity = '';   // rend la main à la transition de sortie
        veil.classList.remove('on');
        setTimeout(() => { veil.remove(); veil = null; }, 380);
        document.removeEventListener('keydown', onKey);
    }

    function onKey(e) {
        if (e.key === 'Escape') done();
        else if (e.key === 'ArrowRight' || e.key === 'Enter') go(idx + 1);
        else if (e.key === 'ArrowLeft') go(idx - 1);
    }

    function go(n) {
        if (n >= SLIDES.length) return done();
        idx = Math.max(0, Math.min(SLIDES.length - 1, n));
        render();
    }

    function render() {
        const s = SLIDES[idx];
        const last = idx === SLIDES.length - 1;
        veil.querySelector('.itr-card').innerHTML = `
            <button class="itr-skip">Passer la visite</button>
            <div class="itr-anim">
                <div class="itr-art" style="color:${s.accent}">${ART[s.art]}</div>
                <div class="itr-step">${idx + 1} / ${SLIDES.length}</div>
                <div class="itr-title">${s.title}</div>
                <div class="itr-text">${s.text}</div>
            </div>
            <div class="itr-dots">${SLIDES.map((_, i) =>
                `<button class="itr-dot ${i === idx ? 'on' : ''}" data-i="${i}" aria-label="Étape ${i + 1}"></button>`).join('')}</div>
            <div class="itr-nav">
                ${idx > 0 ? '<button class="itr-btn itr-prev">← Retour</button>' : ''}
                <button class="itr-btn itr-next">${s.cta || 'Suivant →'}</button>
            </div>`;
        veil.querySelector('.itr-skip').onclick = done;
        veil.querySelector('.itr-next').onclick = () => go(idx + 1);
        const prev = veil.querySelector('.itr-prev');
        if (prev) prev.onclick = () => go(idx - 1);
        veil.querySelectorAll('.itr-dot').forEach(d => { d.onclick = () => go(+d.dataset.i); });
    }

    function start() {
        if (veil) return;
        if (!document.getElementById('itrStyles')) {
            const st = document.createElement('style');
            st.id = 'itrStyles';
            st.textContent = CSS;
            document.head.appendChild(st);
        }
        idx = 0;
        veil = document.createElement('div');
        veil.className = 'itr-veil';
        veil.innerHTML = '<div class="itr-card" role="dialog" aria-modal="true" aria-label="Visite guidée"></div>';
        document.body.appendChild(veil);
        render();
        // Reflow forcé puis classe : la transition joue même si l'onglet
        // n'a pas le focus (requestAnimationFrame y est suspendu). Et si un
        // environnement gèle les transitions, l'état final est garanti.
        void veil.offsetWidth;
        veil.classList.add('on');
        setTimeout(() => {
            if (!veil) return;
            veil.style.opacity = '1';
            const c = veil.querySelector('.itr-card');
            if (c) c.style.transform = 'none';
        }, 450);
        document.addEventListener('keydown', onKey);
    }

    window.InkoTour = { start, seen: () => { try { return !!localStorage.getItem(FLAG); } catch (e) { return true; } } };

    // Premier lancement : démarre tout seul (une seule fois)
    if (!window.InkoTour.seen()) {
        const boot = () => setTimeout(start, 600);   // laisse la page se poser
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
        else boot();
    }
})();
