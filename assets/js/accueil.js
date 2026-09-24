// accueil.js — Page d'accueil : ce que je lis, ce qui est sorti, puis la découverte
// ------------------------------------------------------------
// L'accueil répond d'abord à « qu'est-ce que je lis maintenant ? » :
//   1. la lecture la plus récente, en grand, et les suivantes ;
//   2. les nouveaux chapitres des séries suivies (non-lus exacts, migration 22) ;
//   3. « À lire ensuite » (local, sans réseau) ;
//   4. une recommandation dont on comprend l'origine ;
//   5. populaire et dernières sorties de la source, en rayons.
//
// Chaque section se remplit seule et indépendamment : une source lente ne
// retarde plus la reprise de lecture, qui ne dépend que du hub.
(function () {
    'use strict';

    const STATUTS = { ongoing: 'En cours', completed: 'Terminé', hiatus: 'En pause', cancelled: 'Annulé' };
    let favoris = [];
    let favorisPret = Promise.resolve();
    let favSet = new Set();

    document.addEventListener('DOMContentLoaded', async () => {
        MH.initPage('accueil');
        await (window.API?.ready || Promise.resolve());
        await MH.loadSourceTypes();
        saluer();
        loadFile();                      // local : immédiat
        brancherRayons();

        const connecte = API.isLoggedIn();
        // Tout part en même temps : la reprise ne doit pas attendre la liste
        // complète des favoris (491 séries) avant de demander la progression.
        favorisPret = connecte
            ? API.me.favorites().then(f => { favoris = f; favSet = new Set(f.map(x => String(x.mangaId))); }).catch(() => {})
            : Promise.resolve();
        chargerReprise();
        chargerDecouverte();
        if (connecte) favorisPret.then(() => { rendreNouveautes(); rendreStats(); });
        window.addEventListener('updates:checked', () => rechargerFavorisPuisNouveautes());
    });

    // ── En-tête ────────────────────────────────────────────
    function saluer() {
        const h = new Date().getHours();
        const moment = h < 5 ? 'Bonne nuit' : h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir';
        const nom = API.user?.username || '';
        const el = document.getElementById('homeHello');
        if (el) el.textContent = nom ? `${moment}, ${nom}` : moment;
    }

    async function rendreStats() {
        const el = document.getElementById('homeStats');
        if (!el) return;
        try {
            const st = await API.me.stats();
            const t = st.totals || {};
            const serie = st.streak?.current || 0;
            const bloc = (n, l, href) => `<a class="home-stat" href="${href}"><strong>${MH.fmt(n || 0)}</strong><span>${l}</span></a>`;
            el.innerHTML = bloc(t.chapters_read, 'chapitres lus', 'stats.html')
                + bloc(serie, serie > 1 ? 'jours d’affilée' : 'jour d’affilée', 'stats.html')
                + bloc(favoris.length, 'séries suivies', 'bibliotheque.html');
        } catch (e) { el.innerHTML = ''; }
    }

    // ── 1. Reprendre ───────────────────────────────────────
    async function chargerReprise() {
        const zone = document.getElementById('homeContinue');
        if (!zone) return;
        if (!API.isLoggedIn()) { zone.innerHTML = MH.guestNotice({ compact: true }); return; }
        zone.innerHTML = `<div class="cont-skel"></div>`;
        let entrees = [];
        try {
            const [prog] = await Promise.all([API.me.progress(), favorisPret]);
            entrees = Object.entries(prog).map(([id, p]) => ({ mangaId: id, ...p }))
                .filter(e => e.chapterId)
                .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
                .slice(0, 7);
        } catch (e) {
            zone.innerHTML = '';
            MH.poserEtatErreur?.(zone, e, { onRetry: chargerReprise });
            return;
        }
        if (!entrees.length) { rendreAccueilVide(zone); return; }

        // Titre et couverture : d'abord ceux de la bibliothèque (aucun appel
        // réseau), la source seulement pour ce qui manque.
        const parId = new Map(favoris.map(f => [String(f.mangaId), f]));
        await Promise.allSettled(entrees.map(async e => {
            const f = parId.get(String(e.mangaId));
            e.title = e.title || f?.title;
            e.cover = e.cover || f?.cover;
            e.unread = f?.unreadCount;
            if (!e.title || !e.cover) {
                try {
                    const m = await API.mangas.getFrom(e.source, e.mangaId);
                    e.title = e.title || m.title; e.cover = e.cover || m.coverThumb || m.cover;
                } catch (er) { window.MH?.err?.('accueil.js', er); }
            }
        }));
        const visibles = entrees.filter(e => e.title);
        if (!visibles.length) { rendreAccueilVide(zone); return; }

        const [une, ...autres] = visibles;
        const pct = (e) => MH.isNovelSource(e.source)
            ? Math.min(100, e.page || 0)
            : (e.totalPages > 0 ? Math.min(100, Math.round((e.page / e.totalPages) * 100)) : 0);
        const unite = (e) => MH.unitLabel(e.source, { short: true });
        const ou = (e) => MH.isNovelSource(e.source)
            ? `${unite(e)} ${MH.chapNum(e.chapter)} · ${pct(e)} %`
            : `${unite(e)} ${MH.chapNum(e.chapter)}${e.totalPages ? ` · page ${e.page} / ${e.totalPages}` : e.page ? ` · page ${e.page}` : ''}`;
        const lien = (e) => MH.readerHref(e.mangaId, e.chapterId, e.source);
        const fiche = (e) => `serie.html?id=${encodeURIComponent(e.mangaId)}&source=${encodeURIComponent(e.source || '')}`;
        const couv = (e) => MH.cover(e.cover, MH.placeholderCover(e.mangaId));

        zone.innerHTML = `
            <article class="cont-hero">
                <div class="cont-hero-bg" style="background-image:url('${couv(une)}')" aria-hidden="true"></div>
                <a class="cont-hero-cover" href="${lien(une)}" tabindex="-1" aria-hidden="true"><img src="${couv(une)}" alt=""></a>
                <div class="cont-hero-body">
                    <div class="cont-hero-kicker">Reprendre · ${MH.esc(MH.relTime(une.updatedAt))}</div>
                    <h2 class="cont-hero-title"><a href="${fiche(une)}">${MH.esc(une.title)}</a></h2>
                    <div class="cont-hero-where">${MH.esc(ou(une))}${typeof une.unread === 'number' && une.unread > 1 ? ` · <span class="cont-hero-left">${une.unread} chapitres non lus</span>` : ''}</div>
                    <div class="cont-bar"><span style="width:${pct(une)}%"></span></div>
                    <div class="cont-hero-actions">
                        <a class="btn btn-primary cont-hero-cta" href="${lien(une)}">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>
                            Reprendre la lecture</a>
                        <a class="btn btn-ghost" href="${fiche(une)}">Voir la fiche</a>
                    </div>
                </div>
            </article>
            ${autres.length ? `<div class="cont-row">${autres.map(e => `
                <div class="cont-item" data-id="${MH.esc(e.mangaId)}">
                    <a class="cont-item-link" href="${lien(e)}">
                        <img src="${couv(e)}" alt="" loading="lazy">
                        <span class="cont-item-text">
                            <span class="cont-item-title">${MH.esc(e.title)}</span>
                            <span class="cont-item-where">${MH.esc(ou(e))}</span>
                            <span class="cont-bar cont-bar--small"><span style="width:${pct(e)}%"></span></span>
                        </span>
                    </a>
                    <button class="cont-item-x" type="button" data-retirer="${MH.esc(e.mangaId)}"
                        title="Retirer de « Reprendre »" aria-label="Retirer « ${MH.esc(e.title)} » de « Reprendre »">✕</button>
                </div>`).join('')}</div>` : ''}`;

        zone.querySelectorAll('[data-retirer]').forEach(b => b.addEventListener('click', async (ev) => {
            ev.preventDefault();
            try {
                await API.me.removeProgress(b.dataset.retirer);
                b.closest('.cont-item')?.remove();
                MH.toast('Retiré de « Reprendre »');
            } catch (e) { MH.toastErreur(e); }
        }));
    }

    // Premier lancement, rien de lu : on dit par où commencer.
    function rendreAccueilVide(zone) {
        zone.innerHTML = `
            <div class="cont-empty">
                <div class="cont-empty-kanji" aria-hidden="true">愛</div>
                <div>
                    <h2>Par où commencer ?</h2>
                    <p>Cherche une série que tu connais, parcours le catalogue de tes sources, ou ouvre tes propres fichiers EPUB, CBZ ou PDF.</p>
                    <div class="cont-empty-actions">
                        <a class="btn btn-primary" href="catalogue.html">Parcourir le catalogue</a>
                        <a class="btn btn-ghost" href="recherche.html">Rechercher</a>
                        <a class="btn btn-ghost" href="import.html">Importer un fichier</a>
                    </div>
                </div>
            </div>`;
    }

    // ── 2. Nouveaux chapitres des séries suivies ───────────
    async function rechargerFavorisPuisNouveautes() {
        try { favoris = await API.me.favorites(); } catch (e) { return; }
        rendreNouveautes();
    }

    // Seulement les séries COMMENCÉES (une progression, ou le statut « en
    // cours ») : 1 167 chapitres d'une série jamais ouverte ne sont pas des
    // « nouveaux chapitres », c'est une série à découvrir.
    let commencees = null;
    async function rendreNouveautes() {
        const section = document.getElementById('shelfNew');
        const track = document.getElementById('shelfNewTrack');
        if (!section || !track) return;
        if (!commencees) {
            try { commencees = new Set(Object.keys(await API.me.progress()).map(String)); }
            catch (e) { commencees = new Set(); }
        }
        const avec = favoris
            .filter(f => commencees.has(String(f.mangaId)) || f.status === 'reading')
            .filter(f => typeof f.unreadCount === 'number' && f.unreadCount > 0)
            .sort((a, b) => (new Date(b.latestAt || 0) - new Date(a.latestAt || 0)) || (b.unreadCount - a.unreadCount))
            .slice(0, 24);
        const jamais = favoris.filter(f => typeof f.unreadCount !== 'number').length;
        section.hidden = !favoris.length;
        const sub = document.getElementById('shelfNewSub');
        if (sub) {
            const total = avec.reduce((n, f) => n + f.unreadCount, 0);
            sub.textContent = avec.length
                ? `${avec.length} série${avec.length > 1 ? 's' : ''} · ${total.toLocaleString('fr-FR')} chapitre${total > 1 ? 's' : ''} à lire`
                : jamais ? 'Pas encore vérifié — lance une vérification pour voir ce qui est sorti' : 'Tout est lu. Rien de nouveau pour l’instant.';
        }
        if (!avec.length) { track.innerHTML = ''; track.hidden = true; return; }
        track.hidden = false;
        track.innerHTML = avec.map(f => carte({
            id: f.mangaId, source: f.source, title: f.title, cover: f.cover,
            badge: `${f.unreadCount} à lire`,
            sous: f.latestAt ? MH.relTime(new Date(f.latestAt).toISOString()) : '',
        })).join('');
        MH.markFavorites?.(track);
    }

    function brancherVerification() {
        const b = document.getElementById('homeCheck');
        if (!b || b.dataset.ok) return;
        b.dataset.ok = '1';
        b.addEventListener('click', async () => {
            b.disabled = true;
            b.textContent = 'Vérification…';
            const suivi = (ev) => { const d = ev.detail || {}; if (d.total) b.textContent = `Vérification… ${d.faits} / ${d.total}`; };
            window.addEventListener('updates:progress', suivi);
            try { await MH.checkUpdates({ force: true }); }
            finally {
                window.removeEventListener('updates:progress', suivi);
                b.disabled = false; b.textContent = 'Vérifier maintenant';
            }
        });
    }

    // ── 3. À lire ensuite (local) ──────────────────────────
    function loadFile() {
        const section = document.getElementById('shelfFile');
        const track = document.getElementById('shelfFileTrack');
        if (!section || !track) return;
        const entrees = window.UserData?.file?.() || [];
        // Une section vide sur l'accueil est du bruit, pas une invitation.
        section.hidden = entrees.length === 0;
        if (!entrees.length) { track.innerHTML = ''; return; }
        track.innerHTML = entrees.slice(0, 20).map(e => carte({
            id: e.id, source: e.source, title: e.title || e.id, cover: e.cover,
            sous: MH.sourceName?.(e.source) || e.source || '',
            retirer: `data-defile="${MH.esc(e.id)}" data-src="${MH.esc(e.source || '')}"`,
        })).join('');
        track.querySelectorAll('[data-defile]').forEach(b => b.addEventListener('click', (ev) => {
            ev.preventDefault(); ev.stopPropagation();
            window.UserData?.retirerDeLaFile?.(b.dataset.defile, b.dataset.src);
            loadFile();
            MH.toast?.('Retiré de « À lire ensuite »');
        }));
    }

    // ── 4 & 5. Découverte : populaire, dernières sorties, recommandation ──
    async function chargerDecouverte() {
        const nomSrc = MH.sourceName?.(API.sources.current) || API.sources.current || '';
        const pSub = document.getElementById('shelfPopularSub');
        const lSub = document.getElementById('shelfLatestSub');
        if (pSub) pSub.textContent = `Les séries les plus suivies sur ${nomSrc}`;
        if (lSub) lSub.textContent = `Chapitres fraîchement publiés sur ${nomSrc}`;
        squelette('shelfPopularTrack'); squelette('shelfLatestTrack');

        const [pop, lat] = await Promise.allSettled([
            API.mangas.popular({ limit: 20 }),
            API.mangas.latest({ limit: 20 }),
        ]);
        const rendre = (id, r, secours) => {
            const track = document.getElementById(id);
            if (!track) return [];
            if (r.status !== 'fulfilled') { showError(track, `${nomSrc} ne répond pas`, chargerDecouverte); return []; }
            const items = (r.value.results || []).filter(visible);
            track.innerHTML = items.map(m => carte({
                id: m.id, source: API.sources.current, title: m.title, cover: m.cover || m.coverThumb, manga: m,
                sous: secours(m),
            })).join('');
            MH.markFavorites?.(track);
            return items;
        };
        const populaires = rendre('shelfPopularTrack', pop, m => [m.year, STATUTS[m.status]].filter(Boolean).join(' · '));
        rendre('shelfLatestTrack', lat, m => m.updatedAt ? MH.relTime(m.updatedAt) : (STATUTS[m.status] || ''));
        rendreReco(populaires);
    }

    // Recommandation nommée : « Parce que tu as lu X ». Même source que X,
    // pour que la recherche par genre porte sur le bon catalogue.
    async function rendreReco(populaires) {
        const section = document.getElementById('shelfReco');
        const track = document.getElementById('shelfRecoTrack');
        const sub = document.getElementById('shelfRecoSub');
        if (!section || !track || !API.isLoggedIn()) return;
        try {
            const prog = await API.me.progress();
            const derniere = Object.entries(prog).map(([id, p]) => ({ mangaId: id, ...p }))
                .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0];
            let origine = null, source = API.sources.current;
            if (derniere) {
                const m = await API.mangas.getFrom(derniere.source, derniere.mangaId);
                if (m?.title && (m.tags || []).length) { origine = m; source = derniere.source || source; }
            }
            if (!origine) return;
            const tags = origine.tags.slice(0, 2);
            const r = await API.mangas.searchFor(source, { includedTags: [tags[0]], limit: 24, sort: 'popularity' });
            const picks = (r.results || [])
                .filter(m => !favSet.has(String(m.id)) && String(m.id) !== String(origine.id) && visible(m))
                .slice(0, 16);
            if (picks.length < 4) return;
            section.hidden = false;
            if (sub) sub.textContent = `Parce que tu as lu « ${origine.title} »`;
            track.innerHTML = picks.map(m => carte({
                id: m.id, source, title: m.title, cover: m.cover || m.coverThumb, manga: m,
                sous: (m.tags || []).find(t => tags.includes(t)) || m.year || '',
            })).join('');
            MH.markFavorites?.(track);
        } catch (e) { void populaires; window.MH?.err?.('accueil.js', e); }
    }

    /**
     * L'échec d'une section : on l'AFFICHE, avec une sortie. (L'ancienne
     * version de cette fonction ne peignait rien et laissait une section vide
     * sans un mot, sur le premier écran de l'application.)
     */
    function showError(el, titre, onRetry) {
        if (!el) return;
        MH.poserEtatVide?.(el, {
            icone: '⚠',
            titre,
            texte: 'Réessaie dans un instant, ou change de source depuis le catalogue. Ta bibliothèque, elle, reste disponible.',
            actions: [
                ...(onRetry ? [{ libelle: 'Réessayer', onClick: onRetry }] : []),
                { libelle: 'Sources', href: 'sources.html' },
            ],
        });
    }

    // ── Rayons ─────────────────────────────────────────────
    // Contenu adulte : exclu de l'accueil tant qu'il n'est pas autorisé
    // (flouté ailleurs, mais une page d'accueil ne se floute pas à moitié).
    const visible = (m) => MH.nsfwAllowed?.() || !MH.isAdultManga?.(m);

    function carte({ id, source, title, cover, sous, badge, retirer, manga }) {
        const href = `serie.html?id=${encodeURIComponent(id)}&source=${encodeURIComponent(source || '')}`;
        return `
        <div class="shelf-card manga-card" data-manga-id="${MH.esc(id)}">
            <a href="${href}" class="manga-card-link" aria-label="${MH.esc(title || '')}"${manga ? MH.nsfwCardAttrs?.(manga) || '' : ''}></a>
            <div class="shelf-cover">
                <img src="${MH.cover(cover, MH.placeholderCover(id))}" alt="" loading="lazy" decoding="async">
                ${badge ? `<span class="shelf-badge">${MH.esc(badge)}</span>` : ''}
                ${retirer ? `<button class="shelf-x" type="button" ${retirer} aria-label="Retirer">✕</button>`
                    : `<button class="card-fav-btn" data-fav="${MH.esc(id)}" title="Ajouter à ma bibliothèque">${MH.heartIcon(favSet.has(String(id)))}</button>`}
            </div>
            <div class="shelf-name">${MH.esc(title || '')}</div>
            ${sous ? `<div class="shelf-meta">${MH.esc(String(sous))}</div>` : ''}
        </div>`;
    }

    function squelette(id) {
        const t = document.getElementById(id);
        if (t) t.innerHTML = Array.from({ length: 8 }, () => '<div class="shelf-card shelf-card--skel"><div class="shelf-cover"></div><div class="shelf-name"></div></div>').join('');
    }

    // Flèches de défilement : ajoutées à chaque rayon, visibles au survol, et
    // masquées aux extrémités.
    function brancherRayons() {
        brancherVerification();
        document.querySelectorAll('.shelf').forEach(sec => {
            const track = sec.querySelector('.shelf-track');
            if (!track || sec.querySelector('.shelf-arrow')) return;
            const fl = (sens) => {
                const b = document.createElement('button');
                b.type = 'button';
                b.className = `shelf-arrow shelf-arrow--${sens < 0 ? 'prev' : 'next'}`;
                b.setAttribute('aria-label', sens < 0 ? 'Précédents' : 'Suivants');
                b.textContent = sens < 0 ? '‹' : '›';
                b.addEventListener('click', () => track.scrollBy({ left: sens * track.clientWidth * 0.85, behavior: 'smooth' }));
                sec.appendChild(b);
                return b;
            };
            const prev = fl(-1), next = fl(1);
            const maj = () => {
                prev.hidden = track.scrollLeft < 8;
                next.hidden = track.scrollLeft + track.clientWidth >= track.scrollWidth - 8;
            };
            track.addEventListener('scroll', maj, { passive: true });
            new MutationObserver(maj).observe(track, { childList: true });
            window.addEventListener('resize', maj);
            maj();
        });
    }
})();
