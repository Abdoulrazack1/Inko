// ============================================================
// global.js — Header, footer, search, toast, helpers
// ============================================================
(function () {
    'use strict';

    /* ── Helpers ─────────────────────────────────────────── */
    const $   = (sel, ctx = document) => ctx.querySelector(sel);
    const $$  = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
    const fmt = n => n >= 1000000 ? (n / 1000000).toFixed(1) + 'M' : n >= 1000 ? Math.round(n / 1000) + 'k' : n;
    // Audit SEC-01 : le guillemet double DOIT être échappé. esc() est utilisé
    // dans des attributs (`src="${esc(n.image)}"`, `href="${esc(n.link)}"`) —
    // sans lui, une couverture piégée renvoyée par une source referme
    // l'attribut et injecte `onerror=` : XSS stocké dans la cloche de
    // notifications, présente sur toutes les pages. L'apostrophe est incluse
    // pour couvrir aussi les attributs délimités par des quotes simples.
    const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    const esc = s => (s == null ? '' : String(s)).replace(/[&<>"']/g, c => ESC_MAP[c]);

    // Audit BUG-14 : `<img src="">` est résolu par le navigateur vers l'URL de
    // la PAGE COURANTE, qu'il re-télécharge comme image (3 images cassées
    // relevées sur profil.html, src = ".../profil.html"). Ce helper renvoie le
    // premier candidat non vide — échappé — ou un GIF 1×1 transparent.
    const BLANK_IMG = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';

    // Audit PERF-08 : les couvertures partaient EN DIRECT vers les CDN des
    // sources — 326 des 367 images de la bibliothèque. L'IP de l'utilisateur
    // était donc exposée aux sites scrapés à chaque page, et le proxy
    // /api/img (liste blanche, cache borné, rate-limit) ne servait qu'à une
    // minorité d'images. On y route désormais toute URL externe.
    // Les PAGES DE CHAPITRE restent en direct : proxifier un volume de 326
    // planches ferait transiter des centaines de Mo par le serveur, ce qui
    // pénaliserait un hub modeste (Raspberry Pi, NAS) pour un gain marginal.
    const proxify = (u) => {
        if (!u || typeof u !== 'string') return u;
        if (u.startsWith('data:') || u.startsWith('blob:')) return u;
        if (u.startsWith('/') || u.includes('/api/img?')) return u;   // déjà local ou proxifié
        if (!/^https?:\/\//i.test(u)) return u;
        try {
            if (new URL(u).origin === location.origin) return u;
        } catch (e) { return u; }
        const base = (window.API && window.API.base) ? window.API.base : '/api';
        return base + '/img?u=' + encodeURIComponent(u);
    };
    const cover = (...candidates) => {
        for (const c of candidates) if (c) return esc(proxify(c));
        return BLANK_IMG;
    };

    // Fusion (pas remplacement) : i18n.js se charge AVANT et pose déjà
    // MH.t / MH.loadI18n / MH.setLang sur window.MH (audit N40 v2).
    window.MH = Object.assign(window.MH || {}, { $, $$, fmt, esc, cover, proxify, BLANK_IMG });

    // Journal d'erreurs non fatales (audit B-3) : les nombreux catch qui
    // avalaient silencieusement une erreur passent désormais par ici. Rien
    // d'intrusif pour l'utilisateur (pas de toast), mais l'erreur est visible
    // en console (verbeux) et gardée dans un petit tampon inspectable via
    // `MH.errors` — de quoi diagnostiquer « l'action ne fait rien » sans
    // deviner. `window.MH?.err?.(...)` est appelable même avant global.js.
    const _errRing = [];
    window.MH.errors = _errRing;
    window.MH.err = function (ctx, e) {
        try {
            _errRing.push({ at: Date.now(), ctx, msg: e && e.message ? e.message : String(e) });
            if (_errRing.length > 100) _errRing.shift();
            if (console && console.debug) console.debug('[inko]', ctx, e);
        } catch (_) { /* le logger ne doit jamais lever */ }
    };

    // Gabarit partagé « non connecté » (audit N1) : 8 pages affichaient
    // « Serveur injoignable » alors que le serveur répondait très bien —
    // la vraie cause était l'absence de session (mode hub, session expirée).
    // Message honnête + action adaptée, factorisé pour ne plus dériver.
    // Audit BUG-04 : le front assimilait TOUT échec d'authentification à une
    // session expirée. Quand la base de données tombe, /api/auth/local répond
    // 503 et l'utilisateur lisait « Ta session a expiré, recharge la page » —
    // il se reconnecte en boucle pour un problème qui n'a rien à voir.
    // On distingue désormais l'indisponibilité serveur de l'absence de session.
    // MH.lastApiError est renseigné par api.js à chaque erreur.
    window.MH.serverIsDown = function () {
        const e = window.MH.lastApiError;
        return !!e && (e.network || (e.status >= 500 && e.status <= 599));
    };
    window.MH.guestNotice = function ({ compact = false } = {}) {
        const down  = window.MH.serverIsDown();
        const title = down ? 'Serveur indisponible' : 'Connexion requise';
        const body  = down
            ? 'Le serveur ne répond pas (base de données injoignable ou service arrêté). Tes données sont intactes — réessaie dans un instant.'
            : 'Ta session a expiré ou tu n\'es pas connecté. Recharge la page pour rétablir la session.';
        const cta   = down ? 'Réessayer' : 'Se reconnecter';
        if (compact) {
            return `<div style="font-size:12.5px;color:var(--text3);padding:4px 0 2px">
                ${title} — <a href="#" class="link-orange" onclick="location.reload();return false">${cta.toLowerCase()}</a>.</div>`;
        }
        return `<div style="text-align:center;padding:34px 16px">
            <div style="font-size:16px;color:var(--text);font-weight:600;margin-bottom:6px">${title}</div>
            <div style="color:var(--text3);margin-bottom:18px">${body}</div>
            <button class="btn btn-primary" onclick="location.reload()">${cta}</button>
        </div>`;
    };

    /* ── Icônes SVG (remplace les emojis d'interface) ──────── */
    const ICON_PATHS = {
        home:      '<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h14V10"/>',
        catalogue: '<path d="M4 5a2 2 0 0 1 2-2h7v18H6a2 2 0 0 0-2 2z"/><path d="M13 3h5a2 2 0 0 1 2 2v16a2 2 0 0 0-2-2h-5"/>',
        book:      '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
        search:    '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
        chart:     '<path d="M3 3v18h18"/><rect x="7" y="11" width="3" height="6"/><rect x="12" y="7" width="3" height="10"/><rect x="17" y="13" width="3" height="4"/>',
        folder:    '<path d="M4 5h5l2 3h9v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/>',
        puzzle:    '<path d="M10 3h4v3a2 2 0 1 0 4 0V6h3v4h-1a2 2 0 1 0 0 4h1v4h-4v-1a2 2 0 1 0-4 0v1H6v-4h1a2 2 0 1 0 0-4H6V6h4z"/>',
        gear:      '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
        dice:      '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.3" fill="currentColor" stroke="none"/><circle cx="16" cy="16" r="1.3" fill="currentColor" stroke="none"/><circle cx="16" cy="8" r="1.3" fill="currentColor" stroke="none"/><circle cx="8" cy="16" r="1.3" fill="currentColor" stroke="none"/>',
        play:      '<polygon points="6 4 20 12 6 20 6 4" fill="currentColor" stroke="none"/>',
        bell:      '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
        pin:       '<path d="M9 4h6l-1 7 4 3v2H6v-2l4-3z"/><path d="M12 16v4"/>',
        upload:    '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 9l5-5 5 5"/><path d="M12 4v12"/>',
        download:  '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>',
        grid:      '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
        bookmark:  '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
        moon:      '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
        incognito: '<path d="M2 12h20"/><path d="M5 12l1.5-5a2 2 0 0 1 1.9-1.4h7.2A2 2 0 0 1 19 7l1.5 5"/><circle cx="7.5" cy="15.5" r="2.5"/><circle cx="16.5" cy="15.5" r="2.5"/><path d="M10 15.5c1-0.7 3-0.7 4 0"/>',
        /* `book` était déclaré deux fois à l'identique (l. 106 et ici) — sans
           conséquence, la seconde écrasant la première, mais c'est le genre de
           doublon qui devient un vrai bug le jour où les deux valeurs diffèrent.
           Attrapé par no-dupe-keys, réactivé (audit QUAL-04). */
        comment:   '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
        award:     '<circle cx="12" cy="8" r="6"/><path d="M15.5 13 17 22l-5-3-5 3 1.5-9"/>',
        trophy:    '<path d="M6 9a6 6 0 0 0 12 0V3H6z"/><path d="M6 5H3v2a4 4 0 0 0 4 4"/><path d="M18 5h3v2a4 4 0 0 1-4 4"/><path d="M12 15v3"/><path d="M8 21h8"/>',
        flame:     '<path d="M12 22c4.4 0 7-2.8 7-7 0-3-2-5.5-3.5-7C15 9.5 14 10 14 8c0-2.5-1-5-3.5-6C11 5 9 6 7.5 8.5 6 11 5 12.6 5 15c0 4.2 2.6 7 7 7z"/>',
        heart:     '<path d="M20.8 6.6a5.5 5.5 0 0 0-7.8 0L12 7.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 22l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/>',
        star:      '<polygon points="12 2 15.1 8.3 22 9.3 17 14.1 18.2 21 12 17.8 5.8 21 7 14.1 2 9.3 8.9 8.3 12 2"/>',
        calendar:  '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
        zap:       '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
        layers:    '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
        fileText:  '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8M16 17H8M10 9H8"/>',
        target:    '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/>',
    };
    window.MH.icon = function (name, size = 18) {
        const p = ICON_PATHS[name]; if (!p) return '';
        return `<svg class="mh-icon" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
    };

    /* ── Mode incognito (lecture privée : ni progression, ni historique) ──
       Persisté par session (comme un navigateur). Les lecteurs vérifient
       MH.isIncognito() avant de sauver la progression / marquer comme lu. */
    // Audit AMEL-108 : le besoin réel est presque toujours de masquer UNE
    // lecture, pas toute une session. Couper globalement pour une série oblige
    // à penser à le rallumer — et à perdre la trace de tout ce qu'on lit
    // ensuite si on oublie. La portée par série est mémorisée pour la session.
    const CLE_SERIES = 'inko_incognito_series';
    function seriesPrivees() {
        try { return new Set(JSON.parse(sessionStorage.getItem(CLE_SERIES) || '[]')); }
        catch (e) { return new Set(); }
    }
    function ecrireSeries(s) {
        try { sessionStorage.setItem(CLE_SERIES, JSON.stringify([...s])); }
        catch (e) { window.MH?.err?.('global.js', e); }
    }
    // `mangaId` optionnel : sans lui, on interroge le mode GLOBAL. Les appelants
    // qui connaissent l'œuvre doivent le passer, sinon la portée par série
    // n'aurait aucun effet.
    window.MH.isIncognito = function (mangaId) {
        let global = false;
        try { global = sessionStorage.getItem('inko_incognito') === '1'; } catch (e) { global = false; }
        if (global) return true;
        return mangaId ? seriesPrivees().has(String(mangaId)) : false;
    };
    window.MH.isSeriePrivee = (mangaId) => seriesPrivees().has(String(mangaId));
    window.MH.toggleSeriePrivee = function (mangaId) {
        const s = seriesPrivees();
        const k = String(mangaId);
        const on = !s.has(k);
        if (on) s.add(k); else s.delete(k);
        ecrireSeries(s);
        window.MH.majBandeauIncognito();
        return on;
    };
    window.MH.setIncognito = function (on) {
        try { sessionStorage.setItem('inko_incognito', on ? '1' : '0'); } catch (e) { window.MH?.err?.('global.js', e); }
        document.body.classList.toggle('incognito-on', !!on);
        document.querySelectorAll('#btnIncognito').forEach(b => b.classList.toggle('on', !!on));
        window.MH.majBandeauIncognito();
    };
    window.MH.toggleIncognito = function () {
        const on = !window.MH.isIncognito();
        window.MH.setIncognito(on);
        window.MH.toast?.(on ? 'Mode incognito activé — lecture non enregistrée' : 'Mode incognito désactivé');
        return on;
    };

    /* Audit AMEL-106 : un liseré de 3 px en haut de page ne DIT rien — on peut
       lire une heure sans savoir ce qui est en cours ni comment en sortir. Le
       bandeau nomme l'état, dit ce qui n'est pas enregistré, et se coupe d'un
       clic depuis n'importe quelle page. */
    window.MH.majBandeauIncognito = function () {
        const globalOn = window.MH.isIncognito();
        const series = seriesPrivees();
        const actif = globalOn || series.size > 0;
        let el = document.getElementById('incognitoBar');
        if (!actif) { el?.remove(); return; }
        if (!el) {
            el = document.createElement('div');
            el.id = 'incognitoBar';
            el.setAttribute('role', 'status');
            document.body.appendChild(el);
            el.addEventListener('click', (e) => {
                if (!e.target.closest('[data-inco-off]')) return;
                if (globalOn) window.MH.setIncognito(false);
                ecrireSeries(new Set());
                window.MH.majBandeauIncognito();
                window.MH.toast?.('Lecture privée désactivée');
            });
        }
        const quoi = globalOn
            ? 'Lecture privée — toute cette session'
            : `Lecture privée — ${series.size} série${series.size > 1 ? 's' : ''}`;
        el.innerHTML = `<span class="inco-pastille"></span>
            <span class="inco-texte">${quoi}</span>
            <span class="inco-detail">progression, chapitres lus, activité et recherches ne sont pas enregistrés</span>
            <button type="button" class="inco-off" data-inco-off>Désactiver</button>`;
    };

    /* ── Annonces aux lecteurs d'écran (audit A11Y-06) ─────────
       Aucune des 22 pages n'avait de région aria-live : un utilisateur non
       voyant filtrait le catalogue ou la bibliothèque sans jamais savoir que
       le résultat avait changé, ni combien d'éléments s'affichaient.
       On n'annote PAS les grilles elles-mêmes — une liste de 358 séries en
       aria-live serait insupportable. À la place, une région discrète unique
       où les pages poussent un résumé ("24 résultats"). */
    let _liveRegion = null;
    window.MH.announce = function (msg) {
        if (!msg) return;
        if (!_liveRegion) {
            _liveRegion = document.createElement('div');
            _liveRegion.id = 'mh-live';
            _liveRegion.setAttribute('role', 'status');
            _liveRegion.setAttribute('aria-live', 'polite');
            _liveRegion.setAttribute('aria-atomic', 'true');
            // Masqué visuellement, lisible par les lecteurs d'écran
            _liveRegion.style.cssText = 'position:absolute;width:1px;height:1px;margin:-1px;' +
                'padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0';
            document.body.appendChild(_liveRegion);
        }
        // Réécrire la même chaîne ne déclenche pas d'annonce : on force le
        // changement en vidant d'abord.
        _liveRegion.textContent = '';
        setTimeout(() => { if (_liveRegion) _liveRegion.textContent = msg; }, 60);
    };

    // Numéro de chapitre lisible (gère prologue/null sans afficher "null")
    window.MH.chapNum = (n) => (n != null && n !== '') ? n : '?';

    // Date relative ("il y a 3 j", "il y a 2 mois") + titre = date complète
    window.MH.relTime = function (dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr); if (isNaN(d)) return '';
        const s = Math.floor((Date.now() - d.getTime()) / 1000);
        if (s < 0) return d.toLocaleDateString('fr-FR');
        if (s < 60) return "à l'instant";
        if (s < 3600) return 'il y a ' + Math.floor(s / 60) + ' min';
        if (s < 86400) return 'il y a ' + Math.floor(s / 3600) + ' h';
        const days = Math.floor(s / 86400);
        if (days < 7) return 'il y a ' + days + ' j';
        if (days < 31) return 'il y a ' + Math.floor(days / 7) + ' sem';
        if (days < 365) return 'il y a ' + Math.floor(days / 30) + ' mois';
        return 'il y a ' + Math.floor(days / 365) + ' an' + (days >= 730 ? 's' : '');
    };
    window.MH.fullDate = function (dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr); if (isNaN(d)) return '';
        return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    };

    /* ── Type de source (manga vs novel) ─────────────────────
       Cache du manifest pour router vers le bon lecteur.
       TTL 5 min + invalidation sur source:change : évite un cache
       périmé pour toujours si les sources évoluent (audit DF7). */
    window.MH._sourceTypes = null;
    let _sourceTypesAt = 0;
    const SOURCE_TYPES_TTL = 5 * 60 * 1000;
    window.MH.loadSourceTypes = async function () {
        if (window.MH._sourceTypes && (Date.now() - _sourceTypesAt) < SOURCE_TYPES_TTL)
            return window.MH._sourceTypes;
        try {
            const list = await window.API.sources.list();
            const map = {}, units = {}, noms = {};
            (list || []).forEach(s => {
                map[s.id] = s.type || 'manga';
                units[s.id] = s.unit || 'chapter';
                // SRC-02 : dire « WeebCentral ne répond pas » et non
                // « weebcentral ». On lit le nom au même endroit et au même
                // moment que le type — un second cache divergerait.
                if (s.name) noms[s.id] = s.name;
            });
            window.MH._sourceTypes = map;
            window.MH._sourceUnits = units;
            window.MH._sourceNoms = noms;
            _sourceTypesAt = Date.now();
        } catch (e) { window.MH._sourceTypes = window.MH._sourceTypes || {}; }
        return window.MH._sourceTypes;
    };
    window.addEventListener('source:change', () => { _sourceTypesAt = 0; });
    // Nom lisible d'une source. Retombe sur l'identifiant, qui reste
    // compréhensible (« sushiscan »), plutôt que sur un vide.
    window.MH.sourceName = function (id) {
        return (window.MH._sourceNoms && window.MH._sourceNoms[id]) || id || '';
    };

    window.MH.isNovelSource = function (id) {
        const t = window.MH._sourceTypes && window.MH._sourceTypes[id];
        return t === 'novel' || t === 'book';   // les deux ouvrent le lecteur de texte
    };
    window.MH.isTextSource = window.MH.isNovelSource;   // alias sémantique (audit §15)

    // ── Unité d'affichage : « Chapitre » vs « Tome » (audit §6) ──
    // Point de vérité unique, au lieu des « Chap. » codés en dur un peu partout.
    // Une source ne bascule en 'volume' que si son manifeste le déclare ; on ne
    // déduit PAS du type novel/manga (un roman web reste sérialisé en chapitres).
    window.MH.sourceUnit = function (id) {
        const u = window.MH._sourceUnits && window.MH._sourceUnits[id];
        return u === 'volume' ? 'volume' : 'chapter';
    };
    window.MH.unitLabel = function (source, opts) {
        const o = opts || {};
        if (window.MH.sourceUnit(source) === 'volume')
            return o.short ? 'T.' : (o.plural ? 'Tomes' : 'Tome');
        return o.short ? 'Chap.' : (o.plural ? 'Chapitres' : 'Chapitre');
    };

    // ── Sources désactivées (audit §7.2/§9) ──────────────────
    // Préférence locale (comme la source « courante ») : une source désactivée
    // est exclue des résultats de recherche multi-sources et ne peut pas être
    // la source active. Persisté dans localStorage.
    const DISABLED_KEY = 'inko_disabled_sources';
    function readDisabled() {
        try { return new Set(JSON.parse(localStorage.getItem(DISABLED_KEY) || '[]')); }
        catch (e) { return new Set(); }
    }
    window.MH.disabledSources = function () { return readDisabled(); };
    window.MH.isSourceEnabled = function (id) { return !readDisabled().has(id); };
    window.MH.setSourceDisabled = function (id, disabled) {
        const set = readDisabled();
        if (disabled) set.add(id); else set.delete(id);
        try { localStorage.setItem(DISABLED_KEY, JSON.stringify([...set])); } catch (e) { window.MH?.err?.('global.js', e); }
        try { window.dispatchEvent(new CustomEvent('source:change', { detail: { id } })); } catch (e) { window.MH?.err?.('global.js', e); }
        // Audit MD1 : réplique l'état au compte (user_settings) — désactiver
        // une source sur le téléphone la désactive aussi sur le desktop du
        // même compte en mode hub, comme les autres réglages synchronisés.
        try {
            if (window.API?.isLoggedIn?.()) {
                window.API.me.saveSettings({ disabledSources: [...set] })
                    .catch(e => window.MH?.err?.('global.js', e));
            }
        } catch (e) { window.MH?.err?.('global.js', e); }
        return set.has(id);
    };
    // Rapatrie l'état serveur au chargement (fusion simple : le compte fait foi)
    window.MH.syncDisabledSources = async function () {
        if (!window.API?.isLoggedIn?.()) return;
        try {
            const s = await window.API.me.settings();
            if (Array.isArray(s.disabledSources)) {
                const local = JSON.stringify([...readDisabled()].sort());
                const remote = JSON.stringify([...s.disabledSources].sort());
                if (local !== remote) {
                    localStorage.setItem(DISABLED_KEY, JSON.stringify(s.disabledSources));
                    window.dispatchEvent(new CustomEvent('source:change', { detail: {} }));
                }
            }
        } catch (e) { /* hors-ligne : l'état local reste valable */ }
    };
    // URL du lecteur adapté au type de la source (texte pour les romans)
    // Audit AMEL-114 : `page` optionnel. Le lecteur ne reprenait la position
    // que si la progression enregistrée portait SUR LE MÊME chapitre — ouvrir
    // une ligne d'historique plus ancienne repartait donc de la page 1. Quand
    // l'appelant connaît la position (l'historique la stocke), il la passe.
    window.MH.readerHref = function (mangaId, chapterId, source, page) {
        const src = source || window.API?.sources?.current || '';
        const fichier = window.MH.isNovelSource(src) ? 'lecture.html' : 'chapitre.html';
        const pos = Number(page) > 1 ? `&page=${Math.floor(Number(page))}` : '';
        return `${fichier}?manga=${encodeURIComponent(mangaId)}&chapter=${encodeURIComponent(chapterId)}&source=${encodeURIComponent(src)}${pos}`;
    };

    /* ── Lecteur musique intégré (dock en bas de page) ────── */
    window.MH.openMusic = function () {
        if (window.Music) { window.Music.toggle(); return; }
        // music.js pas encore chargé : on réessaie brièvement
        let n = 0;
        const iv = setInterval(() => { n++; if (window.Music) { clearInterval(iv); window.Music.open(); } if (n > 20) clearInterval(iv); }, 100);
    };
    // Injecte le lecteur de musique sur toutes les pages
    (function loadMusicDock() {
        if (window.Music || document.getElementById('inko-music-js')) return;   // évite le double-chargement (audit §8)
        const s = document.createElement('script');
        s.id = 'inko-music-js'; s.src = '/assets/js/music.js'; s.defer = true;
        (document.body || document.documentElement).appendChild(s);
    })();

    // Injecte les animations (GSAP) sur toutes les pages — décoratif, non bloquant.
    // Sauté si l'utilisateur préfère les mouvements réduits.
    (function loadMotion() {
        if (document.getElementById('inko-motion-js')) return;
        if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

        // IX.14 : GSAP et ScrollTrigger — 114 Ko et du temps de calcul — pour
        // des animations d'apparition au défilement. Sur un téléphone, ce
        // temps de calcul se prend sur le défilement lui-même, c'est-à-dire
        // sur le seul geste qui compte. Les TRANSITIONS CSS restent : elles
        // sont gratuites et portent l'essentiel du retour visuel.
        if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return;
        const add = (src, id, onload) => {
            const s = document.createElement('script');
            s.src = src; if (id) s.id = id; s.defer = true; if (onload) s.onload = onload;
            (document.body || document.documentElement).appendChild(s);
            return s;
        };
        add('/assets/vendor/gsap.min.js', 'inko-gsap-js', () => {
            add('/assets/vendor/ScrollTrigger.min.js', 'inko-st-js', () => {
                add('/assets/js/motion.js', 'inko-motion-js');
            });
        });
    })();

    /* ── Toast ───────────────────────────────────────────── */
    window.MH.toast = function (msg, duration = 2500) {
        const el = document.createElement('div');
        el.className = 'toast';
        el.setAttribute('role', 'alert');          // lecteurs d'écran (audit A12)
        el.setAttribute('aria-live', 'assertive');
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

    /* ── Modales premium (remplacent alert/confirm/prompt natifs) ────
       Aucune fenêtre système : overlay glass, animé, clavier (Entrée/Échap),
       promesses. MH.confirm → bool, MH.prompt → string|null, MH.alert → void. */
    if (!document.getElementById('mhModalStyles')) {
        const st = document.createElement('style');
        st.id = 'mhModalStyles';
        st.textContent = `
        @keyframes mhVeilIn{from{opacity:0}to{opacity:1}}
        @keyframes mhModalIn{from{opacity:0;transform:translateY(10px) scale(.98)}to{opacity:1;transform:none}}
        /* Affichage instantané et garanti (aucune animation d'entrée dont
           dépend la visibilité). Fondu de sortie via .closing uniquement. */
        .mh-modal-veil{position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;padding:20px;
          background:color-mix(in srgb, var(--bg,#111) 55%, transparent);-webkit-backdrop-filter:blur(16px) saturate(1.4);backdrop-filter:blur(16px) saturate(1.4);
          opacity:1}
        .mh-modal-veil.closing{opacity:0;transition:opacity .15s ease}
        .mh-modal{width:min(420px,94vw);background:var(--bg2,#1a1a1e);border:1px solid var(--border,#333);border-radius:18px;
          padding:24px 24px 20px;box-shadow:0 24px 70px -18px rgba(0,0,0,.55)}
        .mh-modal-title{font-family:var(--font-head,inherit);font-size:17px;font-weight:700;color:var(--text,#eee);margin-bottom:8px}
        .mh-modal-msg{font-size:13.5px;line-height:1.55;color:var(--text2,#bbb);white-space:pre-line}
        .mh-modal-input{width:100%;margin-top:14px;background:var(--bg3,#222);border:1px solid var(--border2,#3a3a3a);color:var(--text,#eee);
          border-radius:10px;padding:11px 13px;font-size:14px;outline:none;transition:border-color .15s}
        .mh-modal-input:focus{border-color:var(--accent,#c1531b)}
        .mh-modal-actions{display:flex;gap:9px;justify-content:flex-end;margin-top:20px}
        .mh-modal-btn{border:none;cursor:pointer;border-radius:10px;padding:9px 18px;font-size:13px;font-weight:600;transition:filter .15s,background .15s}
        .mh-modal-btn.ghost{background:var(--bg3,#222);color:var(--text2,#bbb)}
        .mh-modal-btn.ghost:hover{color:var(--text,#eee)}
        .mh-modal-btn.primary{background:var(--accent,#c1531b);color:#fff}
        .mh-modal-btn.primary:hover{filter:brightness(1.08)}
        .mh-modal-btn.danger{background:var(--hanko,#a83232);color:#fff}
        .mh-modal-btn.danger:hover{filter:brightness(1.1)}`;
        document.head.appendChild(st);
    }
    function mhModal({ title, message, input, value, placeholder, okText, cancelText, danger, showCancel }) {
        return new Promise((resolve) => {
            const veil = document.createElement('div');
            veil.className = 'mh-modal-veil';
            const inputHtml = input
                ? `<input class="mh-modal-input" type="text" value="${(value || '').replace(/"/g, '&quot;')}" placeholder="${(placeholder || '').replace(/"/g, '&quot;')}">`
                : '';
            veil.innerHTML = `
                <div class="mh-modal" role="dialog" aria-modal="true">
                    ${title ? `<div class="mh-modal-title">${esc(title)}</div>` : ''}
                    ${message ? `<div class="mh-modal-msg">${esc(message)}</div>` : ''}
                    ${inputHtml}
                    <div class="mh-modal-actions">
                        ${showCancel ? `<button class="mh-modal-btn ghost" data-act="cancel">${esc(cancelText || 'Annuler')}</button>` : ''}
                        <button class="mh-modal-btn ${danger ? 'danger' : 'primary'}" data-act="ok">${esc(okText || 'OK')}</button>
                    </div>
                </div>`;
            document.body.appendChild(veil);
            const inp = veil.querySelector('.mh-modal-input');
            // L'animation CSS (mhVeilIn / mhModalIn) joue seule à l'insertion :
            // pas de toggle de classe ni de rAF → affichage garanti.
            if (inp) { inp.focus(); inp.select(); }
            const close = (result) => {
                veil.classList.add('closing');
                setTimeout(() => veil.remove(), 160);
                document.removeEventListener('keydown', onKey);
                resolve(result);
            };
            const onOk = () => close(input ? (inp ? inp.value : '') : true);
            const onCancel = () => close(input ? null : false);
            function onKey(e) {
                if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
                else if (e.key === 'Enter' && (input || !showCancel)) { e.preventDefault(); onOk(); }
            }
            document.addEventListener('keydown', onKey);
            veil.querySelector('[data-act="ok"]').onclick = onOk;
            veil.querySelector('[data-act="cancel"]')?.addEventListener('click', onCancel);
            veil.addEventListener('click', (e) => { if (e.target === veil) onCancel(); });
        });
    }
    window.MH.confirm = (message, opts = {}) => mhModal({ message, showCancel: true, okText: opts.okText || 'Confirmer', cancelText: opts.cancelText, danger: opts.danger, title: opts.title });
    window.MH.prompt  = (message, opts = {}) => mhModal({ message, input: true, showCancel: true, value: opts.value, placeholder: opts.placeholder, okText: opts.okText || 'Valider', cancelText: opts.cancelText, title: opts.title });
    window.MH.alert   = (message, opts = {}) => mhModal({ message, showCancel: false, okText: opts.okText || 'OK', title: opts.title });

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

    // ── Contenu adulte (audit N20) ──────────────────────────────
    // Réglage global (désactivé par défaut, parametres.html) : tant qu'il est
    // désactivé, les œuvres classées adultes sont floutées et l'ouverture
    // demande une confirmation — avant, rien ne filtrait côté interface.
    window.MH.nsfwAllowed = function () {
        try { return localStorage.getItem('inko_nsfw_show') === '1'; } catch (e) { return false; }
    };
    window.MH.setNsfwAllowed = function (on) {
        try { localStorage.setItem('inko_nsfw_show', on ? '1' : '0'); } catch (e) { window.MH?.err?.('global.js', e); }
    };
    window.MH.isAdultManga = function (m, srcNsfw) {
        return !!srcNsfw || /^(erotica|pornographic|adult|hentai|nsfw|smut)$/i.test((m && m.contentRating) || '');
    };
    // Attributs à poser sur la carte (<a>) d'une œuvre adulte quand le filtre est actif
    window.MH.nsfwCardAttrs = function (m, srcNsfw) {
        return (!window.MH.nsfwAllowed() && window.MH.isAdultManga(m, srcNsfw)) ? ' data-nsfw="1"' : '';
    };
    // Confirmation d'ouverture (délégué global, une seule fois par page)
    document.addEventListener('click', async (e) => {
        const card = e.target.closest('a[data-nsfw]');
        if (!card) return;
        e.preventDefault();
        const ok = await window.MH.confirm(
            'Cette œuvre est classée contenu adulte (+18). L\'ouvrir quand même ?',
            { okText: 'Ouvrir', danger: true, title: 'Contenu adulte' });
        if (ok) window.location.href = card.href;
    });

    // Placeholder local (SVG data URL) — pas de requête réseau, déterministe par seed
    window.MH.placeholderCover = function (seed) {
        const s = String(seed || 'manga');
        let h = 0;
        for (let i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i);
        const hue = Math.abs(h) % 360;
        const c1 = `hsl(${hue}, 35%, 12%)`;
        const c2 = `hsl(${(hue + 40) % 360}, 60%, 28%)`;
        const initial = s[0].toUpperCase();
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 420">
            <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/></linearGradient></defs>
            <rect width="300" height="420" fill="url(#g)"/>
            <text x="150" y="225" font-family="-apple-system,sans-serif" font-size="120" font-weight="800" fill="rgba(255,255,255,.85)" text-anchor="middle" dominant-baseline="middle">${initial}</text>
        </svg>`;
        return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
    };

    /* ── Favoris : icône cœur SVG + état partagé ─────────── */
    window.MH.heartIcon = function (filled) {
        const d = 'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z';
        return `<svg viewBox="0 0 24 24" width="17" height="17" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
    };

    // Cache du jeu d'IDs favoris de l'utilisateur connecté
    window.MH._favSet = null;
    window.MH.getFavSet = async function (force) {
        if (!window.API?.isLoggedIn()) return new Set();
        if (window.MH._favSet && !force) return window.MH._favSet;
        try {
            const favs = await API.me.favorites();
            window.MH._favSet = new Set((favs || []).map(f => String(f.mangaId)));
        } catch (e) { window.MH._favSet = new Set(); }
        return window.MH._favSet;
    };
    // Audit A11Y-08 / BUG-21 : l'état du bouton favori n'existait QUE par la
    // classe `is-fav` et l'icône. L'infobulle restait « Ajouter aux favoris »
    // sur une œuvre déjà en favori, et aucun `aria-pressed` n'exposait l'état —
    // un lecteur d'écran ne pouvait pas savoir si l'action avait pris. La fiche
    // série faisait déjà correctement ce travail (« Non lu » → « Lu »,
    // « Ajouter un signet » → « Retirer le signet ») : le catalogue était
    // l'exception. Point unique pour que les deux restent synchronisés.
    window.MH.setFavButtonState = function (btn, fav) {
        btn.classList.toggle('is-fav', !!fav);
        btn.innerHTML = window.MH.heartIcon(!!fav);
        btn.title = fav ? 'Retirer des favoris' : 'Ajouter aux favoris';
        btn.setAttribute('aria-pressed', String(!!fav));
        btn.setAttribute('aria-label', btn.title);
    };
    // Marque dans le DOM les cœurs déjà en favori (état initial)
    /* ── SRC-02 : une source en panne se DIT en panne ────────
     * Une source dont le site a changé de balisage ne lève aucune erreur :
     * elle analyse une page qu'elle ne comprend plus et rend une liste vide.
     * À l'écran, c'était donc indistinguable d'un catalogue sans contenu — et
     * le message « Modifiez les filtres » accusait le geste de l'utilisateur
     * d'une panne qui ne lui appartenait pas.
     *
     * Trois règles tenues ici :
     *   · jamais de code technique à l'écran ;
     *   · jamais « une erreur est survenue » — on dit QUOI et on propose QUOI FAIRE ;
     *   · une action réelle, pas seulement un constat.
     */
    window.MH.blocSourceMuette = function (sourceId, opts = {}) {
        const nom = window.MH.sourceName?.(sourceId) || sourceId || 'Cette source';
        const quoi = opts.quoi || 'série';
        return `
        <div class="src-muette" style="grid-column:1/-1;text-align:center;padding:38px 20px;color:var(--text2)">
            <div style="font-size:15px;font-weight:600;color:var(--text);margin-bottom:6px">
                ${window.MH.esc(nom)} n'a renvoyé aucune ${window.MH.esc(quoi)}
            </div>
            <div style="font-size:13px;line-height:1.6;max-width:440px;margin:0 auto 16px">
                Aucun filtre n'est actif : ce n'est donc pas ta recherche. Le site est
                peut-être momentanément indisponible, ou il a changé et la source doit
                être mise à jour.
            </div>
            <div style="display:flex;gap:9px;justify-content:center;flex-wrap:wrap">
                <button class="btn btn-ghost btn-sm" data-src-action="reessayer">Réessayer</button>
                <a class="btn btn-ghost btn-sm" href="sources.html">Voir l'état des sources</a>
            </div>
        </div>`;
    };

    // Délégué au document : le bloc est réinséré à chaque rendu, et un
    // gestionnaire posé sur le bouton disparaîtrait avec lui.
    document.addEventListener('click', (e) => {
        if (e.target.closest?.('[data-src-action="reessayer"]')) window.location.reload();
    });

    /* ── Couvertures de notification : proxy à l'AFFICHAGE ───
     * La migration 17 (audit) a retiré le proxy des couvertures STOCKÉES —
     * c'était le bon geste : une URL proxifiée figée casse dès que le port du
     * hub change, et depuis un téléphone `127.0.0.1` désigne le téléphone.
     * Mais le rendu des notifications, lui, écrivait `src="${n.image}"` tel
     * quel : les couvertures partaient donc DIRECTEMENT vers les hôtes tiers,
     * étaient bloquées par la CSP, et 40 cadres vides restaient à l'écran.
     *
     * Le `onerror=` qui devait les masquer était un gestionnaire EN LIGNE :
     * inerte sous la CSP de l'application installée (DESK-01). Il est remplacé
     * par une écoute en phase de CAPTURE — `error` ne remonte pas dans l'arbre,
     * et cela couvre aussi les images insérées après coup.
     */
    document.addEventListener('error', (e) => {
        const t = e.target;
        if (t && t.tagName === 'IMG' && t.classList.contains('nt-cover')) t.style.display = 'none';
    }, true);

    window.MH.markFavorites = async function (root) {
        if (!window.API?.isLoggedIn()) return;
        const set = await window.MH.getFavSet();
        (root || document).querySelectorAll('.card-fav-btn[data-fav]').forEach(btn => {
            if (btn.dataset.favTouched) return; // ne pas écraser une action en cours de l'utilisateur
            window.MH.setFavButtonState(btn, set.has(String(btn.dataset.fav)));
        });
    };

    // Badge "nouveaux chapitres" sur les liens Bibliothèque (header + nav mobile)
    window.MH.updateLibBadge = function () {
        let n = 0; try { n = +localStorage.getItem('inko_lib_newcount') || 0; } catch (e) { window.MH?.err?.('global.js', e); }
        document.querySelectorAll('#navLibBadge, #navLibBadgeM').forEach(b => {
            if (n > 0) { b.textContent = n > 99 ? '99+' : String(n); b.style.display = ''; }
            else { b.style.display = 'none'; }
        });
    };

    /* ── Navigation mobile (bottom bar, ≤1024px) ─────────────
       Le header masque sa nav sous 1024px : cette barre app-like
       prend le relais. Masquée pendant la lecture (immersion). */
    function renderMobileNav(activePage) {
        if (activePage === 'chapitre') return;            // lecture : plein écran
        if (document.getElementById('inkoMobileNav')) return;
        const I = {
            home:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></svg>',
            book:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>',
            lib:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 6 4 14"/><path d="M12 6v14"/><path d="M8 8v12"/><path d="M4 4v16"/></svg>',
            search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>',
            user:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
            menu:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>',
        };
        const item = (href, id, label, svg, extra = '') =>
            `<a href="${href}" class="mnav-item ${activePage === id ? 'active' : ''}" aria-label="${label}">
                <span class="mnav-icon">${svg}${extra}</span><span class="mnav-label">${label}</span>
            </a>`;
        const nav = document.createElement('nav');
        nav.id = 'inkoMobileNav';
        nav.className = 'mobile-nav';
        // Audit NAV1/M2 : « Plus » = déclencheur tactile de la palette de
        // commandes — sans lui, Journal, Sources, Statistiques et Collections
        // étaient injoignables sur mobile/tablette (la palette n'était
        // accessible que par Ctrl/Cmd+K, inexistant au toucher).
        nav.innerHTML =
            item('accueil.html', 'accueil', 'Accueil', I.home) +
            item('catalogue.html', 'catalogue', 'Catalogue', I.book) +
            item('bibliotheque.html', 'bibliotheque', 'Bibliothèque', I.lib,
                 '<span class="nav-badge" id="navLibBadgeM" style="display:none"></span>') +
            item('recherche.html', 'recherche', 'Recherche', I.search) +
            item('profil.html', 'profil', 'Profil', I.user) +
            `<button type="button" class="mnav-item" id="mnavMore" aria-label="Plus de sections" aria-haspopup="dialog"
                style="background:none;border:none;font:inherit;color:inherit;cursor:pointer">
                <span class="mnav-icon">${I.menu}</span><span class="mnav-label">Plus</span>
            </button>`;
        document.body.appendChild(nav);
        nav.querySelector('#mnavMore')?.addEventListener('click', () => window.MH.openCommandPalette());
    }

    // ── Vérification des nouveaux chapitres ──
    // Interroge toutes les œuvres suivies, met à jour le badge et notifie.
    // { force } ignore le throttle ; { silent } supprime les toasts.
    let _checkInFlight = false;
    window.MH.checkUpdates = async function ({ force = false, silent = false } = {}) {
        if (!window.API?.isLoggedIn()) { if (!silent) MH.toast('Connecte-toi pour suivre tes séries'); return null; }
        if (_checkInFlight) return null;
        _checkInFlight = true;
        setRefreshSpinning(true);
        // Retour immédiat au clic manuel : le scan peut durer (toutes les sources).
        if (!silent && force) MH.toast('Recherche de nouveaux chapitres…');
        try {
            const lang = window.Storage?.getPref('readingLang') || 'fr,en';
            const data = await API.me.updates(lang);
            const ups = data.updates || [];
            const newCount = ups.filter(u => u.unreadCount > 0).length;
            const fresh    = ups.filter(u => u.hasNew);
            try {
                localStorage.setItem('inko_lib_newcount', String(newCount));
                localStorage.setItem('inko_lib_lastcheck', String(Date.now()));
            } catch (e) { window.MH?.err?.('global.js', e); }
            window.MH.updateLibBadge();
            try { window.dispatchEvent(new CustomEvent('updates:checked', { detail: data })); } catch (e) { window.MH?.err?.('global.js', e); }
            if (!silent) {
                if (fresh.length) {
                    const names = fresh.slice(0, 2).map(u => u.title).filter(Boolean).join(', ');
                    MH.toast(`Nouveaux chapitres : ${names}${fresh.length > 2 ? ` (+${fresh.length - 2})` : ''}`);
                } else if (newCount > 0) {
                    MH.toast(`${newCount} série(s) avec des chapitres non lus`);
                } else if (force) {
                    // BUG-13 : le serveur garde 15 min entre deux scans complets
                    // et rend alors le DERNIER résultat connu (`frais: false`).
                    // Annoncer « Tout est à jour ✓ » serait faux : rien n'a été
                    // vérifié à l'instant. On dit ce qui s'est réellement passé.
                    if (data && data.frais === false) {
                        const min = Math.ceil((data.prochainScanDansMs || 0) / 60000);
                        MH.toast(`Déjà vérifié récemment — nouvelle recherche possible dans ${min} min`);
                    } else {
                        MH.toast('Tout est à jour ✓');
                    }
                }
            }
            return data;
        } catch (e) {
            if (!silent && force) {
                // Message clair selon la cause réelle (le scan est long par nature)
                const msg = e.network || /délai|too long|met trop de temps/i.test(e.message || '')
                    ? 'Certaines sources sont lentes — réessaie dans un moment.'
                    : 'Actualisation impossible : ' + (e.message || 'erreur');
                MH.toast(msg);
            }
            return null;
        } finally {
            _checkInFlight = false;
            setRefreshSpinning(false);
        }
    };

    function setRefreshSpinning(on) {
        document.querySelectorAll('#btnRefresh').forEach(b => {
            b.classList.toggle('spinning', on);
            b.disabled = on;
        });
    }

    // Au lancement : une fois par session, en silence.
    async function launchUpdateCheck() {
        try { if (sessionStorage.getItem('inko_launch_checked')) return; } catch (e) { window.MH?.err?.('global.js', e); }
        if (!window.API?.isLoggedIn()) return;
        try { sessionStorage.setItem('inko_launch_checked', '1'); } catch (e) { window.MH?.err?.('global.js', e); }
        window.MH.checkUpdates({ silent: false });
    }

    /* ── Comptes connectés (AniList) ───────────────
       Composant unifié, partagé par profil et paramètres. */
    function ensureAniList() {
        return new Promise((resolve) => {
            if (window.AniList) return resolve();
            const s = document.createElement('script');
            s.src = '/assets/js/anilist.js'; s.defer = true;
            s.onload = () => resolve(); s.onerror = () => resolve();
            document.body.appendChild(s);
        });
    }

    const CONN_LOGOS = {
        anilist: '<svg viewBox="0 0 24 24" fill="#02a9ff" width="22" height="22"><path d="M6.361 2.943 0 21.056h4.942l1.077-3.133H11.4l1.052 3.133H22.9c.71 0 1.1-.392 1.1-1.101V17.53c0-.71-.39-1.101-1.1-1.101h-6.483V4.045c0-.71-.392-1.102-1.101-1.102h-2.422c-.71 0-1.101.392-1.101 1.102v1.064l-.758-2.166zm2.324 5.948 1.688 5.018H7.144z"/></svg>',
    };

    // Rend les cartes de comptes connectés dans `el`. opts.onChange() après lien/délier.
    window.MH.renderConnections = async function (el, opts = {}) {
        if (!el) return;
        await ensureAniList();
        el.classList.add('conn-list');
        el.innerHTML = `
            <div class="conn-card" id="conn-anilist">
                <div class="conn-logo">${CONN_LOGOS.anilist}</div>
                <div class="conn-body">
                    <div class="conn-name">AniList <span class="conn-pill" id="conn-al-pill">…</span></div>
                    <div class="conn-desc" id="conn-al-desc">Synchronise automatiquement ta progression de lecture.</div>
                </div>
                <div class="conn-action" id="conn-al-action"></div>
            </div>`;
        const changed = () => { try { opts.onChange && opts.onChange(); } catch (e) { window.MH?.err?.('global.js', e); } };
        renderAniListConn(el, changed);
    };

    function pill(elId, label, kind) {
        const p = document.getElementById(elId);
        if (!p) return;
        p.textContent = label;
        p.className = 'conn-pill ' + (kind || '');
    }

    async function renderAniListConn(root, changed) {
        const action = document.getElementById('conn-al-action');
        const desc   = document.getElementById('conn-al-desc');
        if (!action || !window.AniList) { pill('conn-al-pill', 'Indisponible', 'muted'); return; }
        action.innerHTML = '';
        const cfg = await AniList.getConfig();
        if (!cfg.configured) {
            pill('conn-al-pill', 'À configurer', 'muted');
            const canConfig = window.API?.isLoggedIn?.() && !cfg.viaEnv;
            desc.innerHTML = canConfig
                ? `Crée un client sur <a href="https://anilist.co/settings/developer" target="_blank" rel="noopener" class="link-orange">anilist.co/settings/developer</a> ` +
                  `(Redirect URL : <code>${esc(cfg.redirectUri)}</code>), puis colle l'<strong>ID client</strong> :`
                : 'Client AniList non configuré.' + (cfg.viaEnv ? ' (défini par variable d’environnement)' : '');
            if (canConfig) {
                const wrap = document.createElement('div');
                wrap.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;width:100%';
                wrap.innerHTML = `<input type="text" id="al-cid" placeholder="ex: 12345" inputmode="numeric"
                    style="flex:1;min-width:140px;background:var(--bg3);border:1px solid var(--border2);color:var(--text);border-radius:8px;padding:8px 10px;font-size:13px">
                    <button class="btn btn-primary btn-sm" id="al-cid-save">Activer</button>`;
                action.appendChild(wrap);
                wrap.querySelector('#al-cid-save').onclick = async () => {
                    const v = wrap.querySelector('#al-cid').value.trim();
                    try { await API.anilist.setConfig(v); MH.toast('AniList configuré ✓'); AniList.clearConfigCache?.(); renderAniListConn(root, changed); }
                    catch (e) { MH.toast('Erreur : ' + e.message); }
                };
            }
            return;
        }
        if (AniList.isLinked()) {
            const u = AniList.user();
            pill('conn-al-pill', 'Connecté', 'ok');
            desc.textContent = 'Lié à ' + (u?.name || 'ton compte AniList');
            if (!u) AniList.me().then(() => renderAniListConn(root, changed)).catch(() => {});
            const btn = document.createElement('button');
            btn.className = 'btn btn-ghost btn-sm conn-btn-danger';
            btn.textContent = 'Délier';
            btn.onclick = () => { AniList.disconnect(); MH.toast('AniList délié'); renderAniListConn(root, changed); changed(); };
            action.appendChild(btn);
        } else {
            pill('conn-al-pill', 'Non connecté', '');
            const btn = document.createElement('button');
            btn.className = 'btn btn-sm conn-btn-anilist';
            btn.textContent = 'Connecter';
            btn.onclick = async () => {
                btn.disabled = true; btn.textContent = 'Redirection vers AniList…';
                try { await AniList.connect(); }   // redirige la page ; ne revient pas
                catch (e) { btn.disabled = false; btn.textContent = 'Connecter'; MH.toast('Erreur : ' + e.message); }
            };
            action.appendChild(btn);
        }
    }

    /* ── Connexion Google (Google Identity Services) ─────────
       Bouton « Sign in with Google » sur login/signup. */

    /* ── Reprendre la lecture (bouton « Continuer » du header) ── */
    let _lastReadPromise = null;
    window.MH.lastReadTarget = function () {
        if (_lastReadPromise) return _lastReadPromise;
        _lastReadPromise = (async () => {
            if (!window.API?.isLoggedIn?.()) return null;
            try {
                const progress = await API.me.progress();
                // BUG-11 : sans source, `readerHref` retombait sur la source
                // COURANTE — et c'est elle qui décide du LECTEUR. Un roman
                // Gutenberg repris depuis une session ouverte sur WeebCentral
                // ouvrait donc le lecteur d'images :
                //   501 /api/sources/gutenberg/chapters/2701%3Afull/pages
                // Relevé depuis `parametres`, `notifications` et `import` : ce
                // bouton est dans l'en-tête commun, le défaut était global.
                //
                // On saute les entrées sans source plutôt que d'en inventer
                // une. Reprendre la lecture précédente est plus utile que
                // d'ouvrir la mauvaise ; aucune entrée exploitable = bouton
                // masqué, ce que `refreshContinueButton` fait déjà.
                const entries = Object.entries(progress)
                    .map(([id, p]) => ({ mangaId: id, ...p }))
                    .filter(e => e.chapterId && e.source)
                    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
                if (!entries.length) return null;
                const e = entries[0];
                return { href: window.MH.readerHref(e.mangaId, e.chapterId, e.source), mangaId: e.mangaId };
            } catch (err) { return null; }
        })();
        return _lastReadPromise;
    };
    window.MH.refreshContinueButton = async function () {
        const btn = document.getElementById('btnContinue');
        if (!btn) return;
        const last = await window.MH.lastReadTarget();
        btn.style.display = last ? '' : 'none';
        if (last) btn.title = 'Reprendre ma dernière lecture (clic droit : choisir)';
    };

    // ── Ajout à une liste depuis une carte (audit AMEL-39) ───
    // L'ajout n'était possible que depuis la fiche série : constituer une liste
    // en parcourant le catalogue demandait d'ouvrir chaque titre puis de
    // revenir. Le geste est délégué ICI (et non dans catalogue.js) pour que
    // n'importe quelle page affichant des cartes en bénéficie sans y penser.
    document.addEventListener('click', async (e) => {
        const btn = e.target.closest('[data-addlist]');
        if (!btn) return;
        e.preventDefault(); e.stopPropagation();
        if (!window.API?.isLoggedIn?.()) { MH.toast('Connecte-toi pour utiliser les listes'); return; }

        let listes = [];
        try { listes = await API.me.lists(); } catch (err) { MH.toast('Listes indisponibles'); return; }

        const meta = {
            source: btn.dataset.src || undefined,
            title:  btn.dataset.title || undefined,
            cover:  btn.dataset.cover || undefined,
        };
        const id = btn.dataset.addlist;

        // Aucune liste : on propose d'en créer une plutôt que d'annoncer un
        // vide — c'est le premier usage, et il ne doit pas être un cul-de-sac.
        if (!listes.length) {
            const nom = await MH.prompt('Tu n’as pas encore de liste. Nom de la première ?',
                { placeholder: 'ex. À lire', okText: 'Créer et ajouter' });
            if (!nom || !nom.trim()) return;
            try {
                const l = await API.me.createList({ name: nom.trim() });
                await API.me.addToList(l.id, id, meta);
                MH.toast(`Ajouté à « ${nom.trim()} »`);
            } catch (err) { MH.toast('Erreur : ' + err.message); }
            return;
        }

        const choix = await MH.prompt(`Ajouter « ${btn.dataset.title || id} » à une liste`, {
            message: listes.map((l, i) => `${i + 1}. ${l.name}`).join('\n') + `\n${listes.length + 1}. Nouvelle liste…`,
            value: '1', okText: 'Ajouter',
        });
        const n = parseInt(choix, 10);
        if (!(n >= 1 && n <= listes.length + 1)) return;

        try {
            let cible = listes[n - 1];
            if (n === listes.length + 1) {
                const nom = await MH.prompt('Nom de la nouvelle liste', { placeholder: 'ex. Pépites', okText: 'Créer' });
                if (!nom || !nom.trim()) return;
                cible = await API.me.createList({ name: nom.trim() });
            }
            await API.me.addToList(cible.id, id, meta);
            MH.toast(`Ajouté à « ${cible.name} »`);
        } catch (err) { MH.toast('Erreur : ' + err.message); }
    });

    // ── Choix parmi les lectures récentes (audit AMEL-30) ────
    // Les entrées sont enrichies en parallèle avec leur titre : un menu qui
    // n'afficherait que des identifiants n'aiderait pas à choisir.
    function fermerMenuReprise() { document.getElementById('mhContinueMenu')?.remove(); }

    async function ouvrirMenuReprise(btn) {
        fermerMenuReprise();
        if (!window.API?.isLoggedIn?.()) { MH.toast('Connecte-toi pour retrouver tes lectures'); return; }
        let entrees = [];
        try {
            const progress = await API.me.progress();
            // Même filtre que `lastReadTarget` (BUG-11) : une entrée sans
            // source ouvrirait le mauvais lecteur, et `getFrom` refuse de
            // toute façon de la résoudre depuis BUG-01.
            entrees = Object.entries(progress)
                .map(([id, p]) => ({ mangaId: id, ...p }))
                .filter(e => e.chapterId && e.source)
                .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
                .slice(0, 6);
        } catch (e) { MH.toast('Lectures récentes indisponibles'); return; }
        if (!entrees.length) { MH.toast('Aucune lecture en cours pour le moment'); return; }

        const fiches = await Promise.allSettled(
            entrees.map(e => API.mangas.getFrom(e.source, e.mangaId)));

        // Repli sur le miroir local de la bibliothèque quand la source ne
        // répond pas : afficher « 01J76XYD7E91K8QP6CY0Y53900 » dans un menu de
        // reprise n'aide personne à choisir, alors que le titre est déjà connu
        // hors-ligne.
        let cache = [];
        try { cache = window.Storage?.getCachedLibrary?.()?.favs || []; } catch (e) { cache = []; }
        const titreDeSecours = (id) => cache.find(f => String(f.mangaId) === String(id));

        const menu = document.createElement('div');
        menu.id = 'mhContinueMenu';
        menu.className = 'mh-continue-menu';
        menu.setAttribute('role', 'menu');
        menu.innerHTML = entrees.map((e, i) => {
            const m = fiches[i].status === 'fulfilled' ? fiches[i].value : null;
            const secours = m ? null : titreDeSecours(e.mangaId);
            const titre = m?.title || secours?.title || e.mangaId;
            const unite = MH.unitLabel(e.source, { short: true });
            return `<a role="menuitem" class="mh-cm-item" href="${MH.readerHref(e.mangaId, e.chapterId, e.source)}">
                <img src="${MH.cover(m?.coverThumb, m?.cover, secours?.cover, MH.placeholderCover(e.mangaId))}" alt="" loading="lazy">
                <span class="mh-cm-txt">
                    <span class="mh-cm-title">${MH.esc(titre)}</span>
                    <span class="mh-cm-sub">${unite} ${MH.chapNum(e.chapter)} · ${MH.relTime(e.updatedAt)}</span>
                </span>
            </a>`;
        }).join('');

        const r = btn.getBoundingClientRect();
        menu.style.top  = (r.bottom + 8) + 'px';
        // Aligné à droite du bouton, borné à la fenêtre : près du bord droit,
        // un menu ancré à gauche déborderait hors de l'écran.
        menu.style.right = Math.max(8, window.innerWidth - r.right) + 'px';
        document.body.appendChild(menu);

        // Fermeture au clic extérieur ou à Échap — enregistrées APRÈS coup pour
        // que le clic qui vient d'ouvrir le menu ne le referme pas aussitôt.
        setTimeout(() => {
            const dehors = (ev) => { if (!ev.target.closest('#mhContinueMenu')) { fermerMenuReprise(); nettoyer(); } };
            const echap  = (ev) => { if (ev.key === 'Escape') { fermerMenuReprise(); nettoyer(); } };
            const nettoyer = () => {
                document.removeEventListener('click', dehors);
                document.removeEventListener('keydown', echap);
            };
            document.addEventListener('click', dehors);
            document.addEventListener('keydown', echap);
        }, 0);
    }

    /* ── Header HTML ─────────────────────────────────────── */
    const headerHTML = (activePage) => {
        const u = window.API?.user;
        // Mode local : plus de connexion/déconnexion — juste le profil.
        const userBlock = u ? `
          <a href="profil.html" class="header-user" title="${esc(u.username)}">
            <div class="header-avatar">${esc(u.avatar || u.username[0].toUpperCase())}</div>
            <div class="user-label">${esc(u.username)}<span class="user-sublabel">Ma bibliothèque</span></div>
          </a>` : '';

        // Cloche de notifications (connecté) + accès admin (role admin)
        const bell = u ? `
          <div class="notif-wrap" style="position:relative;display:inline-flex">
            <button class="header-icon-btn" id="btnNotif" title="Notifications"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18" style="vertical-align:middle"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg><span id="notifBadge" style="display:none;position:absolute;top:1px;right:1px;min-width:15px;height:15px;padding:0 3px;border-radius:8px;background:#b91c1c;color:#fff;font-size:9px;font-weight:700;line-height:15px;text-align:center"></span></button>
            <div id="notifDropdown" style="display:none;position:absolute;right:0;top:44px;width:330px;max-height:440px;overflow-y:auto;background:var(--bg2);border:1px solid var(--border);border-radius:14px;box-shadow:0 10px 40px rgba(0,0,0,.45);z-index:200"></div>
          </div>` : '';
        // L'administration vivra dans une app dédiée (Inko Admin) — pas de
        // page admin dans l'app de lecture.
        const adminBtn = '';

        return `
        <header class="site-header">
          <a href="accueil.html" class="header-logo">
            <img src="/assets/img/icon.svg" alt="Inko" class="logo-icon" style="width:28px;height:28px;border-radius:7px">
            Inko
          </a>
          <nav class="header-nav">
            <a href="accueil.html" class="${activePage === 'accueil' ? 'active' : ''}" data-i18n="nav.home">Accueil</a>
            <a href="catalogue.html" class="${['catalogue','serie','chapitre'].includes(activePage) ? 'active' : ''}" data-i18n="nav.catalog">Catalogue</a>
            <a href="bibliotheque.html" class="${activePage === 'bibliotheque' ? 'active' : ''}" style="position:relative"><span data-i18n="nav.library">Bibliothèque</span><span class="nav-badge" id="navLibBadge" style="display:none"></span></a>
            <a href="notes.html" class="${activePage === 'notes' ? 'active' : ''}">Journal</a>
            <a href="#" id="navRandom" data-i18n="nav.random">Aléatoire</a>
            <a href="sources.html" class="${activePage === 'sources' ? 'active' : ''}" data-i18n="nav.sources">Sources</a>
          </nav>
          <div class="header-search">
            <span class="header-search-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14" style="vertical-align:middle"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg></span>
            <input type="text" id="headerSearch" placeholder="Rechercher un manga…" data-i18n-ph="nav.search_ph" autocomplete="off">
            <div class="search-dropdown" id="searchDropdown"></div>
          </div>
          <div class="header-actions">
            <button class="header-icon-btn" id="btnIncognito" title="Mode incognito (lecture privée)">${window.MH.icon('incognito', 17)}</button>
            <button class="header-icon-btn" id="btnContinue" title="Reprendre ma dernière lecture" style="display:none"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="17" height="17" style="vertical-align:middle"><polygon points="6 4 20 12 6 20 6 4" fill="currentColor" stroke="none"/></svg></button>
            <button class="header-icon-btn" id="btnRefresh" title="Actualiser mes séries (nouveaux chapitres)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="17" height="17" style="vertical-align:middle"><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></svg></button>
            <button class="header-icon-btn" id="btnMusic" title="Musique (s'ouvre dans une fenêtre qui reste en lecture)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18" style="vertical-align:middle"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg></button>
            ${bell}
            ${adminBtn}
            <a href="parametres.html" class="header-icon-btn ${activePage === 'parametres' ? 'active' : ''}" title="Paramètres" style="text-decoration:none"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18" style="vertical-align:middle"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></a>
            ${userBlock}
          </div>
        </header>`;
    };

    /* ── Footer HTML ─────────────────────────────────────── */
    const footerHTML = `
    <footer class="site-footer">
      <div class="footer-inner">
        <div class="footer-brand">
          <div class="footer-logo"><img src="/assets/img/icon.svg" alt="Inko" style="width:24px;height:24px;border-radius:6px;vertical-align:middle;margin-right:6px">Inko</div>
          <p class="footer-desc">Lecteur de mangas open-source. Découvre, lis et organise ta bibliothèque, sur toutes tes plateformes.</p>
          <!-- Audit S15 : formulaire newsletter retiré — il affichait
               « Inscription confirmée ! » sans jamais envoyer la donnée
               nulle part (aucune route serveur, aucun appel réseau). -->
        </div>
        <div class="footer-col">
          <h4>Explorer</h4>
          <ul>
            <li><a href="catalogue.html">Catalogue</a></li>
            <li><a href="catalogue.html?sort=latest">Nouveautés</a></li>
            <li><a href="catalogue.html?sort=rating">Top</a></li>
            <li><a href="import.html">Importer un fichier</a></li>
            <li><a href="downloads.html">Téléchargements</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <h4>Projet</h4>
          <ul>
            <!-- Audit UX-03 : « Forum », « Discord » et « Contact » pointaient
                 vers href="#" et affichaient « Bientôt disponible » — trois
                 liens morts sur les 22 pages, pour des espaces qui n'existent
                 pas. Remplacés par les seuls canaux réels du projet. -->
            <li><a href="https://github.com/Abdoulrazack1/Inko" target="_blank" rel="noopener noreferrer">Code source</a></li>
            <li><a href="https://github.com/Abdoulrazack1/Inko/issues" target="_blank" rel="noopener noreferrer">Signaler un bug</a></li>
            <li><a href="https://github.com/Abdoulrazack1/Inko/releases" target="_blank" rel="noopener noreferrer">Versions</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <h4>Légal</h4>
          <ul>
            <!-- Audit UX-04 : « Conditions » pointait vers la politique de
                 confidentialité. Deux libellés, une seule page : la licence
                 (Apache-2.0) est le vrai texte qui régit l'usage du logiciel. -->
            <li><a href="confidentialite.html">Confidentialité</a></li>
            <li><a href="https://github.com/Abdoulrazack1/Inko/blob/main/LICENSE" target="_blank" rel="noopener noreferrer">Licence</a></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <p>© 2026 Inko. Tous droits réservés. Données issues des sources installées (MangaDex, RoyalRoad, Gutenberg…).</p>
        <!-- Sélecteur restauré (audit N40 v2) : la traduction runtime par texte
             source (i18n.js) couvre désormais toute l'interface. -->
        <div class="footer-lang" style="display:flex;gap:8px;align-items:center;font-size:12px;color:var(--text3)">
          <span data-i18n="common.language">Langue</span>
          <button type="button" data-setlang="fr" class="footer-lang-btn" style="background:none;border:1px solid var(--border2);color:var(--text2);border-radius:6px;padding:3px 8px;cursor:pointer">FR</button>
          <button type="button" data-setlang="en" class="footer-lang-btn" style="background:none;border:1px solid var(--border2);color:var(--text2);border-radius:6px;padding:3px 8px;cursor:pointer">EN</button>
        </div>
      </div>
    </footer>`;

    /* ── i18n : moteur complet déplacé dans assets/js/i18n.js (audit N40 v2) ──
       Traduction runtime par texte source (dictionnaire exact + motifs +
       MutationObserver) — chargé par toutes les pages, y compris celles sans
       global.js. MH.t / MH.applyI18n / MH.loadI18n / MH.setLang y sont définis. */

    /* ── Inject header & footer ──────────────────────────── */
    // ── Barre de titre custom (app desktop premium, fenêtre sans bordure OS) ──
    // Ne s'affiche QUE dans l'app Tauri (window.__TAURI__ présent). Dans le
    // navigateur, rien n'est injecté. Filet de sécurité : si l'IPC Tauri
    // n'était pas disponible, Alt+F4 ferme toujours et les bords restent
    // redimensionnables — la fenêtre ne peut pas devenir « bloquée ».
    function tauriWindow() {
        const T = window.__TAURI__;
        if (!T || !T.window) return null;
        try { return (T.window.getCurrentWindow || T.window.getCurrent)?.call(T.window) || null; }
        catch (e) { return null; }
    }
    function injectTitlebar() {
        if (!window.__TAURI__ || document.getElementById('inko-titlebar')) return;
        document.documentElement.classList.add('tauri-app');
        const bar = document.createElement('div');
        bar.id = 'inko-titlebar';
        bar.setAttribute('data-tauri-drag-region', '');
        bar.innerHTML = `
            <div class="tb-brand" data-tauri-drag-region>
                <img src="/assets/img/icon.svg" alt="" class="tb-logo" draggable="false">
                <span class="tb-title">Inko</span>
            </div>
            <div class="tb-controls">
                <button class="tb-btn" id="tbMin" title="Réduire" aria-label="Réduire">
                    <svg viewBox="0 0 12 12" width="11" height="11"><line x1="2" y1="6" x2="10" y2="6" stroke="currentColor" stroke-width="1.2"/></svg>
                </button>
                <button class="tb-btn" id="tbMax" title="Agrandir" aria-label="Agrandir">
                    <svg viewBox="0 0 12 12" width="11" height="11"><rect x="2.5" y="2.5" width="7" height="7" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>
                </button>
                <button class="tb-btn tb-close" id="tbClose" title="Fermer" aria-label="Fermer">
                    <svg viewBox="0 0 12 12" width="11" height="11"><line x1="3" y1="3" x2="9" y2="9" stroke="currentColor" stroke-width="1.3"/><line x1="9" y1="3" x2="3" y2="9" stroke="currentColor" stroke-width="1.3"/></svg>
                </button>
            </div>`;
        document.body.prepend(bar);
        const w = () => tauriWindow();
        bar.querySelector('#tbMin').onclick = () => { try { w()?.minimize(); } catch (e) { window.MH?.err?.('titlebar', e); } };
        bar.querySelector('#tbMax').onclick = () => { try { w()?.toggleMaximize(); } catch (e) { window.MH?.err?.('titlebar', e); } };
        bar.querySelector('#tbClose').onclick = () => { try { w()?.close(); } catch (e) { window.MH?.err?.('titlebar', e); } };
        // Double-clic sur la barre = agrandir/restaurer (comportement natif attendu)
        bar.addEventListener('dblclick', (e) => { if (e.target.closest('.tb-controls')) return; try { w()?.toggleMaximize(); } catch (err) { window.MH?.err?.('titlebar', err); } });
    }

    window.MH.initPage = function (activePage) {
        injectTitlebar();
        const headerSlot = document.getElementById('header-slot');
        const footerSlot = document.getElementById('footer-slot');
        if (headerSlot) headerSlot.outerHTML = headerHTML(activePage);
        if (footerSlot) footerSlot.innerHTML = footerHTML;
        injectSkipLink();
        applyAriaLabels();
        initSearch();
        initFooterButtons();
        initHeaderButtons();
        initNotifications();
        showConsentBanner();
        if (window.MH.lang && window.MH.lang !== 'fr') window.MH.loadI18n();  // applique la traduction si ≠ FR
        bindGlobalShortcuts();
        initBackToTop();
        renderMobileNav(activePage);
        window.MH.updateLibBadge();
        window.MH.loadSourceTypes();   // pré-charge les types pour le routage lecteur
        // Audit AMEL-111 : astuce contextuelle a la premiere visite de cette
        // page. Differee : elle ne doit pas concurrencer le chargement, ni
        // s'afficher pendant la visite guidee (que InkoTour ecarte lui-meme).
        if (activePage) setTimeout(() => window.InkoTour?.astuce?.(activePage), 2200);
        window.MH.syncDisabledSources();   // audit MD1 : état des sources suivi par compte
        // Check des nouveautés au lancement (pas pendant la lecture : priorité aux pages)
        if (activePage !== 'chapitre') launchUpdateCheck();

        // Re-render header au login/logout.
        // Un seul listener conservé : initPage() peut être rappelé (re-render),
        // on retire l'ancien avant d'attacher pour éviter l'accumulation (audit DF2).
        if (window.MH._authChangeHandler) {
            window.removeEventListener('auth:change', window.MH._authChangeHandler);
        }
        window.MH._authChangeHandler = () => {
            const oldHeader = document.querySelector('.site-header');
            if (!oldHeader) return;
            const wrapper = document.createElement('div');
            wrapper.innerHTML = headerHTML(activePage);
            oldHeader.replaceWith(wrapper.firstElementChild);
            initSearch();
            initNotifications();
            applyAriaLabels();                  // ré-applique les aria-label au header reconstruit (audit A2)
            _lastReadPromise = null;            // recalcule selon le nouveau compte
            window.MH.refreshContinueButton();
        };
        window.addEventListener('auth:change', window.MH._authChangeHandler);
    };

    /* ── Notifications (cloche header) ───────────────────── */
    function notifTimeAgo(d) {
        const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
        if (s < 60) return "à l'instant";
        const m = Math.floor(s / 60); if (m < 60) return `${m} min`;
        const h = Math.floor(m / 60); if (h < 24) return `${h} h`;
        const j = Math.floor(h / 24); if (j < 30) return `${j} j`;
        return new Date(d).toLocaleDateString('fr-FR');
    }
    function setNotifBadge(n) {
        const b = document.getElementById('notifBadge');
        if (!b) return;
        if (n > 0) { b.textContent = n > 99 ? '99+' : n; b.style.display = ''; }
        else b.style.display = 'none';
    }
    /* Rendu partagé d'une notification (audit N2) : la cloche déroulante et
       la page notifications.html dupliquaient le même gabarit (icône par
       type, image, titre, corps, horodatage) — toute évolution devait être
       répliquée aux deux endroits. Source unique désormais. */
    window.MH.notifIconName = t => ({
        reply: 'comment', mention: 'comment',
        chapter: 'book', new_chapter: 'book', badge: 'award',
    }[t] || 'bell');
    window.MH.notifItemHTML = function (n, { variant = 'page', timeAgo } = {}) {
        const ago = (timeAgo || notifTimeAgo)(n.at);
        const iconName = window.MH.notifIconName(n.type);
        /* Audit AMEL-53 : une série qui publie trois fois entre deux visites
           occupait trois lignes. Elle n'en occupe plus qu'une, et la pastille
           dit combien de parutions elle recouvre — l'information perdue par le
           regroupement est ainsi rendue, sans reprendre la place. */
        // `aria-label` et pas seulement `title` : un lecteur d'écran annoncerait
        // sinon « Nouveau chapitre 8 », qui ne veut rien dire.
        const pastille = n.count > 1
            ? `<span class="nt-count" title="${n.count} parutions regroupées" aria-label="${n.count} parutions regroupées">${n.count}</span>` : '';
        if (variant === 'dropdown') {
            return `
                <a href="${esc(n.link || '#')}" data-nid="${n.id}" style="display:flex;gap:10px;padding:11px 14px;border-bottom:1px solid var(--border);text-decoration:none;color:inherit;background:${n.read ? 'transparent' : 'rgba(255,140,66,.07)'}">
                    ${n.image
                        ? `<img class="nt-cover" src="${cover(n.image)}" alt="" loading="lazy" style="flex:0 0 auto;width:34px;height:46px;object-fit:cover;border-radius:6px;background:var(--bg3)">`
                        : `<div style="flex:0 0 auto;color:var(--accent)">${window.MH.icon(iconName, 16)}</div>`}
                    <div style="min-width:0">
                        <div style="font-size:12.5px;font-weight:600;line-height:1.3">${esc(n.title || '')}${pastille}</div>
                        ${n.body ? `<div style="font-size:11.5px;color:var(--text2);line-height:1.35;margin-top:2px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${esc(n.body)}</div>` : ''}
                        <div style="font-size:10.5px;color:var(--text3);margin-top:3px">${ago}</div>
                    </div>
                </a>`;
        }
        // variant 'page' (notifications.html)
        return `
            <a class="nt-item ${n.read ? '' : 'unread'}" href="${esc(n.link || '#')}" data-nid="${n.id}">
                ${n.image
                    ? `<img class="nt-cover" src="${cover(n.image)}" alt="" loading="lazy" style="width:38px;height:52px;object-fit:cover;border-radius:7px;background:var(--bg3);flex:0 0 auto">`
                    : `<div class="nt-ico" style="color:var(--accent)">${window.MH.icon(iconName, 18)}</div>`}
                <div class="nt-body">
                    <div class="nt-title">${esc(n.title || '')}${pastille}</div>
                    ${n.body ? `<div class="nt-text">${esc(n.body)}</div>` : ''}
                    <div class="nt-when">${ago}</div>
                </div>
            </a>`;
    };

    async function renderNotifDropdown() {
        const dd = document.getElementById('notifDropdown');
        if (!dd) return;
        dd.innerHTML = `<div style="padding:18px;text-align:center;color:var(--text3);font-size:13px">Chargement…</div>`;
        let data = { items: [], unread: 0 };
        try { data = await window.API.notifications.list(30); } catch (e) { window.MH?.err?.('global.js', e); }
        setNotifBadge(data.unread || 0);
        const head = `<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid var(--border)">
            <strong style="font-size:13.5px">Notifications</strong>
            <span style="display:flex;gap:12px;align-items:center">
                <button id="notifRefresh" title="Actualiser" aria-label="Actualiser les notifications" style="background:none;border:none;color:var(--text3);font-size:11.5px;cursor:pointer;display:inline-flex;align-items:center;gap:4px">↻ Actualiser</button>
                ${data.items.length ? `<button id="notifMarkAll" style="background:none;border:none;color:var(--orange);font-size:11.5px;cursor:pointer">Tout marquer lu</button>` : ''}
                <a href="notifications.html" style="color:var(--text3);font-size:11.5px;text-decoration:none">Voir tout →</a>
            </span></div>`;
        if (!data.items.length) {
            dd.innerHTML = head + `<div style="padding:26px 16px;text-align:center;color:var(--text3);font-size:13px">Aucune notification.</div>`;
        } else {
            dd.innerHTML = head + data.items.map(n => window.MH.notifItemHTML(n, { variant: 'dropdown' })).join('');
            dd.querySelector('#notifMarkAll')?.addEventListener('click', async (e) => {
                e.preventDefault(); e.stopPropagation();
                try { await window.API.notifications.markAll(); } catch (_) { window.MH?.err?.('global.js', _); }
                setNotifBadge(0); renderNotifDropdown();
            });
            dd.querySelectorAll('[data-nid]').forEach(a => {
                a.addEventListener('click', () => { window.API.notifications.markRead(a.dataset.nid).catch(() => {}); });
            });
        }
        // Bouton Actualiser (refonte notifications, audit G.2) — présent aussi à vide
        dd.querySelector('#notifRefresh')?.addEventListener('click', (e) => {
            e.preventDefault(); e.stopPropagation();
            renderNotifDropdown();
        });
    }
    function initNotifications() {
        const btn = document.getElementById('btnNotif');
        if (!btn || !window.API?.isLoggedIn?.()) return;
        const refreshBadge = () =>
            window.API.notifications.unread().then(d => setNotifBadge(d.unread || 0)).catch(() => {});
        refreshBadge();
        window.MH.refreshNotifBadge = refreshBadge;
        // Refonte notifications (audit G.1/G.4) : avant, le badge n'était requêté
        // qu'une fois par chargement de page. Sondage léger UNIQUEMENT onglet
        // visible + rafraîchissement immédiat quand l'onglet redevient actif ou
        // qu'un push arrive (message du Service Worker). Les listeners globaux ne
        // sont posés qu'une fois, même si le header est reconstruit (auth:change).
        if (!window.MH._notifPollBound) {
            window.MH._notifPollBound = true;
            setInterval(() => {
                if (document.visibilityState === 'visible' && window.API?.isLoggedIn?.()) window.MH.refreshNotifBadge?.();
            }, 75_000);
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible' && window.API?.isLoggedIn?.()) window.MH.refreshNotifBadge?.();
            });
            try {
                navigator.serviceWorker?.addEventListener('message', (e) => {
                    if (e.data && e.data.type === 'notif:new') window.MH.refreshNotifBadge?.();
                });
            } catch (e) { window.MH?.err?.('global.js', e); }
        }
        const dd = document.getElementById('notifDropdown');
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const open = dd.style.display !== 'none';
            if (open) { dd.style.display = 'none'; return; }
            dd.style.display = 'block';
            renderNotifDropdown();
        });
        document.addEventListener('click', (e) => {
            if (dd && dd.style.display === 'block' && !e.target.closest('.notif-wrap')) dd.style.display = 'none';
        });
    }

    /* ── Accessibilité : skip link + aria-labels (audit A1/A2) ── */
    function injectSkipLink() {
        if (document.querySelector('.skip-link')) return;
        const a = document.createElement('a');
        a.className = 'skip-link';
        // Audit A11Y-07 : la cible était `header.nextElementSibling`, une
        // heuristique de position — sur l'accueil elle déposait l'utilisateur
        // sur le carrousel, pas sur le contenu. Et href="#" laissait un lien
        // mort si le JS échouait. On vise désormais le vrai landmark <main>,
        // ajouté sur toutes les pages (audit A11Y-01), avec repli sur l'ancien
        // comportement pour les pages qui n'en auraient pas.
        a.href = '#main';
        a.textContent = 'Aller au contenu';
        a.addEventListener('click', (e) => {
            const target = document.getElementById('main')
                || document.querySelector('main')
                || document.querySelector('.site-header')?.nextElementSibling;
            if (!target) return;              // laisse l'ancre native opérer
            e.preventDefault();
            if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
            target.focus();
            target.scrollIntoView({ block: 'start' });
        });
        document.body.insertBefore(a, document.body.firstChild);
    }
    function applyAriaLabels() {
        // Les boutons-icônes du header ont un title : on le reflète en aria-label
        document.querySelectorAll('.header-icon-btn[title]:not([aria-label])').forEach(b => {
            b.setAttribute('aria-label', b.getAttribute('title'));
        });
        const search = document.getElementById('headerSearch');
        if (search && !search.getAttribute('aria-label')) search.setAttribute('aria-label', 'Rechercher un manga');
    }

    /* ── Bandeau de consentement (RGPD, audit P1/P6) ─────── */
    function showConsentBanner() {
        try { if (localStorage.getItem('inko_consent')) return; } catch (e) { return; }
        if (document.getElementById('inkoConsent')) return;
        const bar = document.createElement('div');
        bar.id = 'inkoConsent';
        bar.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;z-index:9999;max-width:760px;margin:0 auto;background:var(--bg2);border:1px solid var(--border);border-radius:14px;box-shadow:0 10px 40px rgba(0,0,0,.45);padding:14px 16px;display:flex;align-items:center;gap:14px;flex-wrap:wrap';
        bar.innerHTML = `
            <div style="flex:1;min-width:220px;font-size:13px;color:var(--text2);line-height:1.5">
                Inko stocke des données locales (session, préférences) pour fonctionner et synchroniser ta bibliothèque.
                Aucune télémétrie, aucune publicité. <a href="confidentialite.html" style="color:var(--accent-text);text-decoration:underline">En savoir plus</a>.
            </div>
            <button id="inkoConsentOk" class="btn btn-primary btn-sm">J'ai compris</button>`;
        document.body.appendChild(bar);
        bar.querySelector('#inkoConsentOk').addEventListener('click', () => {
            try { localStorage.setItem('inko_consent', '1'); } catch (e) { window.MH?.err?.('global.js', e); }
            bar.remove();
        });
    }

    /* ── Web Push : abonnement navigateur (audit §6.3) ───── */
    function urlB64ToUint8(base64) {
        const pad = '='.repeat((4 - base64.length % 4) % 4);
        const b64 = (base64 + pad).replace(/-/g, '+').replace(/_/g, '/');
        const raw = atob(b64);
        const arr = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
        return arr;
    }
    window.MH.enablePush = async function () {
        try {
            if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
                window.MH.toast?.('Push non supporté par ce navigateur'); return false;
            }
            const perm = await Notification.requestPermission();
            if (perm !== 'granted') { window.MH.toast?.('Notifications refusées'); return false; }
            const reg = await navigator.serviceWorker.ready;
            const { publicKey } = await window.API.notifications.vapid();
            if (!publicKey) { window.MH.toast?.('Push non configuré côté serveur'); return false; }
            const sub = await reg.pushManager.getSubscription()
                || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8(publicKey) });
            const j = sub.toJSON();
            await window.API.notifications.subscribe({ endpoint: j.endpoint, keys: j.keys });
            window.MH.toast?.('Notifications push activées ✓');
            return true;
        } catch (e) { window.MH.toast?.('Push : ' + e.message); return false; }
    };

    /* ── Live search ─────────────────────────────────────── */
    function initSearch() {
        const input    = document.getElementById('headerSearch');
        const dropdown = document.getElementById('searchDropdown');
        if (!input || !dropdown) return;

        // Audit R2 : sémantique ARIA combobox — le champ est annoncé comme
        // « recherche avec suggestions », le dropdown comme listbox, et
        // l'option active est suivie via aria-activedescendant.
        input.setAttribute('role', 'combobox');
        input.setAttribute('aria-expanded', 'false');
        input.setAttribute('aria-controls', 'searchDropdown');
        input.setAttribute('aria-autocomplete', 'list');
        dropdown.setAttribute('role', 'listbox');

        let selIdx = -1;   // option surlignée au clavier (audit R1)

        function openDropdown()  { dropdown.classList.add('open');    input.setAttribute('aria-expanded', 'true'); }
        function closeDropdown() { dropdown.classList.remove('open'); input.setAttribute('aria-expanded', 'false'); selIdx = -1; input.removeAttribute('aria-activedescendant'); }

        function options() { return [...dropdown.querySelectorAll('a.search-result-item')]; }
        function highlight() {
            const opts = options();
            opts.forEach((o, i) => {
                o.classList.toggle('kbd-active', i === selIdx);
                o.style.background = i === selIdx ? 'var(--bg4)' : '';
                o.setAttribute('aria-selected', i === selIdx ? 'true' : 'false');
            });
            if (selIdx >= 0 && opts[selIdx]) {
                input.setAttribute('aria-activedescendant', opts[selIdx].id);
                opts[selIdx].scrollIntoView({ block: 'nearest' });
            } else input.removeAttribute('aria-activedescendant');
        }

        function render(results, q) {
            selIdx = -1;
            if (!results.length) {
                dropdown.innerHTML = `<div style="padding:14px;text-align:center;color:var(--text3);font-size:13px">Aucun résultat${q ? ` pour « ${esc(q)} »` : ''}</div>`;
            } else {
                dropdown.innerHTML = results.map((m, i) => `
                  <a href="serie.html?id=${encodeURIComponent(m.id)}" class="search-result-item" role="option" id="searchOpt${i}" aria-selected="false">
                      <img src="${cover(m.coverThumb, m.cover)}" alt="" loading="lazy" onerror="this.style.display='none'">
                      <div class="search-result-info">
                          <div class="title">${esc(m.title)}</div>
                          <div class="meta">${esc(m.author || '')} ${m.year ? `· ${m.year}` : ''}</div>
                      </div>
                  </a>`).join('');
            }
            if (q && q.length > 0) {
                dropdown.innerHTML += `<a href="catalogue.html?q=${encodeURIComponent(q)}" class="search-result-item" role="option" id="searchOptAll" aria-selected="false" style="justify-content:center;color:var(--orange);font-size:12.5px;font-weight:500;border-top:1px solid var(--border);padding:10px">Voir tous les résultats →</a>`;
            }
            openDropdown();
        }

        let timeout, lastQ;
        let popularCache = null;   // audit R4 : les suggestions « populaires » du focus ne sont chargées qu'une fois
        // Audit R3 : quand le catalogue est en mode « Toutes les sources »,
        // la recherche rapide interroge l'agrégat multi-sources — fini le
        // « Aucun résultat » sur un titre présent sur une autre source.
        function allSourcesMode() {
            try { return localStorage.getItem('inko_cat_allsrc') === '1'; } catch (e) { return false; }
        }
        async function go(q) {
            lastQ = q;
            try {
                let results;
                if (q && allSourcesMode() && API.mangas.searchAll) {
                    const data = await API.mangas.searchAll(q, 4);
                    // Dédoublonne par titre normalisé, 6 suggestions max
                    const seen = new Set();
                    results = (data.results || []).filter(m => {
                        const k = (m.title || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
                        if (!k || seen.has(k)) return false;
                        seen.add(k); return true;
                    }).slice(0, 6);
                } else if (q) {
                    const data = await API.mangas.search({ q, limit: 6 });
                    results = data.results || [];
                } else {
                    if (!popularCache) popularCache = (await API.mangas.popular({ limit: 6 })).results || [];
                    results = popularCache;
                }
                if (q === lastQ) render(results, q);
            } catch(e) {
                dropdown.innerHTML = `<div style="padding:14px;text-align:center;color:#ef4444;font-size:12.5px">Erreur de recherche</div>`;
                openDropdown();
            }
        }

        input.addEventListener('focus', () => go(input.value.trim()));
        input.addEventListener('input', () => {
            clearTimeout(timeout);
            const q = input.value.trim();
            timeout = setTimeout(() => go(q), 250);
        });
        document.addEventListener('click', e => {
            if (!input.closest('.header-search').contains(e.target)) closeDropdown();
        });
        input.addEventListener('keydown', e => {
            const open = dropdown.classList.contains('open');
            // Audit R1 : navigation clavier dans les suggestions
            if (e.key === 'ArrowDown' && open) {
                e.preventDefault();
                selIdx = Math.min(options().length - 1, selIdx + 1);
                highlight(); return;
            }
            if (e.key === 'ArrowUp' && open) {
                e.preventDefault();
                selIdx = Math.max(-1, selIdx - 1);
                highlight(); return;
            }
            if (e.key === 'Escape') { closeDropdown(); input.blur(); return; }
            if (e.key === 'Enter') {
                const opts = options();
                if (open && selIdx >= 0 && opts[selIdx]) {
                    closeDropdown();
                    window.location.href = opts[selIdx].href;   // suggestion choisie au clavier
                    return;
                }
                if (input.value.trim()) {
                    closeDropdown();
                    window.location.href = `recherche.html?q=${encodeURIComponent(input.value.trim())}`;
                }
            }
        });
    }

    /* ── Footer ──────────────────────────────────────────── */
    function initFooterButtons() {
        // (audit S15) handler newsletter retiré avec le formulaire — il
        // confirmait un succès sans jamais envoyer l'email nulle part.
        // (audit UX-03) handler `.footer-coming` retiré avec les trois liens
        // morts qu'il servait : le pied de page ne pointe plus que vers des
        // destinations réelles.
    }

    /* ── Header buttons ──────────────────────────────────── */
    let headerButtonsBound = false;
    function initHeaderButtons() {
        if (headerButtonsBound) return;
        headerButtonsBound = true;

        // (résidu .notif-dot retiré — audit N11/F.4 : gestionnaire mort d'une
        //  ancienne UI de notifications, la classe n'existait dans aucun DOM)

        // Bouton musique : ouvre/refocus la fenêtre popout (reste en lecture pendant la nav)
        document.addEventListener('click', e => {
            const btn = e.target.closest('#btnMusic');
            if (!btn) return;
            e.preventDefault();
            try { window.MH.openMusic?.(); } catch (err) { window.MH?.err?.('global.js:music', err); }
        });

        // Bouton actualiser : relance la vérification des nouveaux chapitres à la demande
        document.addEventListener('click', e => {
            const btn = e.target.closest('#btnRefresh');
            if (!btn) return;
            e.preventDefault();
            window.MH.checkUpdates({ force: true });
        });

        // Bouton « Continuer » (audit AMEL-30) : il n'ouvrait QUE la dernière
        // série lue. Or on lit souvent plusieurs séries en parallèle, et la
        // dernière ouverte n'est pas forcément celle qu'on veut reprendre —
        // parfois on l'a juste effleurée. Clic simple : la dernière, comme
        // avant. Clic maintenu ou clic droit : le choix parmi les récentes.
        document.addEventListener('click', async e => {
            const btn = e.target.closest('#btnContinue');
            if (!btn) return;
            e.preventDefault();
            if (document.getElementById('mhContinueMenu')) { fermerMenuReprise(); return; }
            const last = await window.MH.lastReadTarget();
            if (last) window.location.href = last.href;
            else MH.toast('Aucune lecture en cours pour le moment');
        });
        document.addEventListener('contextmenu', async e => {
            const btn = e.target.closest('#btnContinue');
            if (!btn) return;
            e.preventDefault();
            ouvrirMenuReprise(btn);
        });
        // Appui long au toucher : même geste, là où le clic droit n'existe pas.
        let appuiLong = null;
        document.addEventListener('touchstart', (e) => {
            const btn = e.target.closest('#btnContinue');
            if (!btn) return;
            appuiLong = setTimeout(() => ouvrirMenuReprise(btn), 480);
        }, { passive: true });
        ['touchend', 'touchmove', 'touchcancel'].forEach(ev =>
            document.addEventListener(ev, () => clearTimeout(appuiLong), { passive: true }));

        // Bouton incognito (lecture privée)
        document.addEventListener('click', e => {
            const btn = e.target.closest('#btnIncognito');
            if (!btn) return;
            e.preventDefault();
            window.MH.toggleIncognito();
        });
        window.MH.setIncognito(window.MH.isIncognito());   // applique l'état au chargement
        // Révèle le bouton si une lecture est en cours
        window.MH.refreshContinueButton();

        document.addEventListener('click', async e => {
            const btn = e.target.closest('#navRandom');
            if (!btn) return;
            e.preventDefault();
            try {
                const data = await API.mangas.popular({ limit: 50 });
                const list = data.results || [];
                if (!list.length) return;
                const m = list[Math.floor(Math.random() * list.length)];
                MH.toast(`Lecture aléatoire : ${m.title} `);
                setTimeout(() => { window.location.href = `serie.html?id=${encodeURIComponent(m.id)}&source=${encodeURIComponent(API.sources.current)}`; }, 500);
            } catch(e) { MH.toast('Erreur de chargement'); }
        });

        // ── Favoris : handler délégué unique (cœurs de cartes + bouton « + Suivre ») ──
        document.addEventListener('click', async e => {
            const btn = e.target.closest('[data-fav]');
            if (!btn) return;
            e.preventDefault();
            e.stopPropagation();
            if (!window.API?.isLoggedIn()) { MH.toast('Connecte-toi pour ajouter des favoris'); return; }
            const id = btn.dataset.fav;
            // Bouton icône (cœur) sur les cartes ET le hero ; bouton texte ailleurs
            const isIcon = btn.classList.contains('card-fav-btn') || btn.classList.contains('hero-fav-btn');
            const ctx = btn.closest('.manga-card') || btn.closest('.hero-inner');
            // La couverture enregistrée doit être l'URL DE LA SOURCE, jamais
            // celle du proxy. Lire `img.src` rend deux défauts d'un coup :
            //   · l'URL est déjà proxifiée (`/api/img?u=…`) ;
            //   · `.src` la résout en ABSOLU, donc figée sur l'origine du
            //     moment — `http://127.0.0.1:8088/api/img?u=…`.
            // Relevé en base avant correction : 83 favoris avec une couverture
            // proxifiée, dont 67 en absolu vers 127.0.0.1. Conséquences : les
            // couvertures cassent si le port change, et depuis un autre
            // appareil `127.0.0.1` désigne CET appareil, pas le hub.
            // Le bouton porte déjà l'URL brute dans `data-cover` (c'est ce que
            // fait le menu « ajouter à une liste », plus haut) : on la préfère,
            // et on ne retombe sur le `src` qu'en la dé-proxifiant.
            const brute = (u) => {
                if (!u) return null;
                const m = /\/api\/img\?u=([^&]+)/.exec(u);
                return m ? decodeURIComponent(m[1]) : u;
            };
            const meta = {
                title: ctx?.querySelector('.manga-card-title, .hero-title')?.textContent?.trim() || null,
                cover: btn.dataset.cover
                    || brute(ctx?.querySelector('.hero-poster, img')?.getAttribute('src'))
                    || null,
                source: API.sources.current,
            };
            const willFav = !btn.classList.contains('is-fav');
            btn.dataset.favTouched = '1';
            // Audit A11Y-08 : passe par le point unique, qui met aussi à jour
            // l'infobulle et aria-pressed (le clic ne le faisait pas non plus).
            if (isIcon) {
                MH.setFavButtonState(btn, willFav);
            } else {
                btn.classList.toggle('is-fav', willFav);
                btn.textContent = willFav ? 'Suivi' : '+ Suivre';
                btn.setAttribute('aria-pressed', String(willFav));
            }
            try {
                if (willFav) await API.me.addFavorite(id, meta);
                else         await API.me.removeFavorite(id);
                // Met à jour le cache partagé
                const set = await MH.getFavSet();
                if (willFav) set.add(String(id)); else set.delete(String(id));
                MH.toast(willFav ? 'Ajouté aux favoris' : 'Retiré des favoris');
            } catch (err) {
                // Rollback visuel en cas d'échec
                btn.classList.toggle('is-fav', !willFav);
                if (isIcon) btn.innerHTML = MH.heartIcon(!willFav);
                else        btn.textContent = !willFav ? 'Suivi' : '+ Suivre';
                MH.toast('Erreur : ' + err.message);
            }
        });
    }

    /* ── Bouton flottant « Retour en haut » ─────────────── */
    let backTopBound = false;
    function initBackToTop() {
        if (backTopBound) return; backTopBound = true;
        const btn = document.createElement('button');
        btn.id = 'btnBackTop';
        btn.title = 'Retour en haut';
        btn.setAttribute('aria-label', 'Retour en haut');
        btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><polyline points="18 15 12 9 6 15"/></svg>';
        btn.style.cssText = 'position:fixed;right:20px;bottom:22px;z-index:900;width:42px;height:42px;border-radius:50%;border:1px solid var(--border);background:var(--orange);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 18px rgba(0,0,0,.35);opacity:0;transform:translateY(12px);pointer-events:none;transition:opacity .2s,transform .2s';
        btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
        document.body.appendChild(btn);
        const onScroll = () => {
            const show = window.scrollY > 600;
            btn.style.opacity = show ? '1' : '0';
            btn.style.transform = show ? 'translateY(0)' : 'translateY(12px)';
            btn.style.pointerEvents = show ? 'auto' : 'none';
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
    }

    /* ── Palette de commandes (Ctrl/Cmd+K) ──────────────── */
    window.MH.openCommandPalette = function () {
        if (document.getElementById('cmdPalette')) return;
        const I = window.MH.icon;
        const nav = [
            { label: 'Accueil', icon: I('home'), go: 'accueil.html' },
            { label: 'Catalogue', icon: I('catalogue'), go: 'catalogue.html' },
            { label: 'Ma bibliothèque', icon: I('book'), go: 'bibliotheque.html' },
            { label: 'Journal de lecture', icon: I('bookmark'), go: 'notes.html' },
            { label: 'Recherche globale', icon: I('search'), go: 'recherche.html' },
            { label: 'Statistiques', icon: I('chart'), go: 'stats.html' },
            { label: 'Collections', icon: I('folder'), go: 'collections.html' },
            { label: 'Sources', icon: I('puzzle'), go: 'sources.html' },
            { label: 'Paramètres', icon: I('gear'), go: 'parametres.html' },
            { label: 'Lecture aléatoire', icon: I('dice'), act: () => document.getElementById('navRandom')?.click() },
            { label: 'Reprendre ma lecture', icon: I('play'), act: async () => { const t = await window.MH.lastReadTarget?.(); if (t) location.href = t.href; else MH.toast('Aucune lecture en cours'); } },
        ];
        const ov = document.createElement('div');
        ov.id = 'cmdPalette';
        ov.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.55);backdrop-filter:blur(3px);display:flex;align-items:flex-start;justify-content:center;padding-top:12vh';
        ov.innerHTML = `<div style="width:560px;max-width:92vw;background:var(--bg2);border:1px solid var(--border);border-radius:14px;box-shadow:0 24px 70px rgba(0,0,0,.55);overflow:hidden">
            <input id="cmdInput" type="text" placeholder="Rechercher un manga, aller à une page…" autocomplete="off"
                style="width:100%;box-sizing:border-box;background:var(--bg3);border:none;border-bottom:1px solid var(--border);color:var(--text);font-size:15px;padding:16px 18px;outline:none">
            <div id="cmdList" style="max-height:52vh;overflow-y:auto"></div>
            <div style="padding:8px 14px;font-size:11px;color:var(--text3);border-top:1px solid var(--border);display:flex;gap:14px">
                <span><kbd>↑↓</kbd> naviguer</span><span><kbd>↵</kbd> ouvrir</span><span><kbd>Échap</kbd> fermer</span></div>
        </div>`;
        document.body.appendChild(ov);
        const input = ov.querySelector('#cmdInput');
        const list = ov.querySelector('#cmdList');
        let items = [], sel = 0, seq = 0;
        const close = () => ov.remove();
        ov.addEventListener('click', e => { if (e.target === ov) close(); });

        const rowHTML = (it, i) => `<div class="cmd-row" data-i="${i}" style="display:flex;align-items:center;gap:12px;padding:11px 16px;cursor:pointer;${i===sel?'background:var(--bg4)':''}">
            ${it.cover ? `<img src="${esc(it.cover)}" style="width:30px;height:40px;object-fit:cover;border-radius:4px" onerror="this.style.visibility='hidden'">` : `<span style="width:30px;text-align:center;font-size:17px">${it.icon||'•'}</span>`}
            <span style="flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:13.5px">${esc(it.label)}</span>
            ${it.tag ? `<span style="font-size:10.5px;color:var(--text3)">${esc(it.tag)}</span>` : ''}</div>`;
        const paint = () => {
            list.innerHTML = items.map(rowHTML).join('') || `<div style="padding:18px;color:var(--text3);font-size:13px;text-align:center">Aucun résultat</div>`;
            list.querySelectorAll('.cmd-row').forEach(r => {
                r.addEventListener('mouseenter', () => { sel = +r.dataset.i; highlight(); });
                r.addEventListener('click', () => run(items[+r.dataset.i]));
            });
        };
        const highlight = () => list.querySelectorAll('.cmd-row').forEach((r,i) => r.style.background = i===sel ? 'var(--bg4)' : '');
        const run = (it) => { if (!it) return; close(); if (it.act) it.act(); else if (it.go) location.href = it.go; };
        const filterNav = (q) => nav.filter(n => n.label.toLowerCase().includes(q.toLowerCase()));

        async function update() {
            const q = input.value.trim();
            if (!q) { items = nav.slice(); sel = 0; paint(); return; }
            items = filterNav(q); sel = 0; paint();
            const my = ++seq;
            try {
                const data = await API.mangas.search({ q, limit: 6 });
                if (my !== seq) return;
                const results = (data.results || []).map(m => ({
                    label: m.title, tag: m.author || '', cover: m.coverThumb || m.cover,
                    go: `serie.html?id=${encodeURIComponent(m.id)}&source=${encodeURIComponent(API.sources.current||'')}`,
                }));
                items = filterNav(q).concat(results); paint();
            } catch (e) { window.MH?.err?.('global.js', e); }
        }
        let t; input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(update, 220); });
        ov.addEventListener('keydown', e => {
            if (e.key === 'Escape') { e.preventDefault(); close(); }
            else if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(items.length-1, sel+1); highlight(); list.querySelector(`[data-i="${sel}"]`)?.scrollIntoView({block:'nearest'}); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel-1); highlight(); list.querySelector(`[data-i="${sel}"]`)?.scrollIntoView({block:'nearest'}); }
            else if (e.key === 'Enter') { e.preventDefault(); run(items[sel]); }
        });
        update();
        setTimeout(() => input.focus(), 30);
    };

    /* ── Raccourcis clavier globaux ──────────────────────── */
    let shortcutsBound = false;
    function bindGlobalShortcuts() {
        if (shortcutsBound) return;
        shortcutsBound = true;

        document.addEventListener('keydown', async (e) => {
            // Palette de commandes : Ctrl/Cmd + K (avant le filtre des modificateurs)
            if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
                e.preventDefault();
                window.MH.openCommandPalette();
                return;
            }
            // Ignore si saisie en cours ou combinaison avec modificateur
            const tag = (e.target.tagName || '').toUpperCase();
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || e.target.isContentEditable) {
                if (e.key === 'Escape') e.target.blur();
                return;
            }
            // Audit AMEL-82 : les touches sont remappables. Les raccourcis
            // etaient codes en dur dans ce switch — une lettre qui tombe mal
            // sur un clavier non-AZERTY, ou qui entre en conflit avec une
            // habitude, ne pouvait pas etre changee.
            if (e.key === 'Escape') { document.getElementById('mhShortcuts')?.remove(); return; }
            const action = MH.actionRaccourci(e.key);
            if (!action) return;
            e.preventDefault();
            await MH.executerRaccourci(action);
        });
    }
    /* ── Raccourcis remappables (audit AMEL-82) ──────────────
       Les touches vivaient en dur dans le `switch`. Sur un clavier non-AZERTY,
       ou face a une habitude prise ailleurs, aucune n'etait modifiable — et
       l'aide `?` les presentait comme immuables. */
    const RACCOURCIS = [
        { id: 'recherche',  defaut: '/', label: 'Rechercher' },
        { id: 'aleatoire',  defaut: 'r', label: 'Lecture aleatoire' },
        { id: 'reprendre',  defaut: 'c', label: 'Reprendre la lecture' },
        { id: 'bibliotheque', defaut: 'b', label: 'Ma bibliotheque' },
        { id: 'accueil',    defaut: 'h', label: 'Accueil' },
        { id: 'aide',       defaut: '?', label: 'Afficher cette aide' },
    ];
    const CLE_RACCOURCIS = 'raccourcis';
    function mapRaccourcis() {
        let perso = {};
        try { perso = JSON.parse(window.Storage?.getPref(CLE_RACCOURCIS) || '{}'); } catch (e) { perso = {}; }
        const m = {};
        for (const r of RACCOURCIS) {
            const touche = typeof perso[r.id] === 'string' ? perso[r.id] : r.defaut;
            if (touche) m[touche] = r.id;   // une touche vide desactive le raccourci
        }
        return m;
    }
    window.MH.raccourcis = () => RACCOURCIS.map(r => ({ ...r, touche: toucheDe(r.id) }));
    function toucheDe(id) {
        let perso = {};
        try { perso = JSON.parse(window.Storage?.getPref(CLE_RACCOURCIS) || '{}'); } catch (e) { perso = {}; }
        const r = RACCOURCIS.find(x => x.id === id);
        return typeof perso[id] === 'string' ? perso[id] : (r ? r.defaut : '');
    }
    window.MH.setRaccourci = function (id, touche) {
        let perso = {};
        try { perso = JSON.parse(window.Storage?.getPref(CLE_RACCOURCIS) || '{}'); } catch (e) { perso = {}; }
        // Une touche deja prise par une AUTRE action est liberee : deux actions
        // sur la meme touche rendraient l'une des deux inatteignable, en
        // silence.
        if (touche) {
            for (const k of Object.keys(perso)) if (k !== id && perso[k] === touche) perso[k] = '';
            for (const r of RACCOURCIS) if (r.id !== id && perso[r.id] === undefined && r.defaut === touche) perso[r.id] = '';
        }
        perso[id] = touche || '';
        window.Storage?.setPref(CLE_RACCOURCIS, JSON.stringify(perso));
    };
    window.MH.resetRaccourcis = function () {
        window.Storage?.setPref(CLE_RACCOURCIS, '{}');
    };
    window.MH.actionRaccourci = (touche) => mapRaccourcis()[touche] || null;
    window.MH.executerRaccourci = async function (action) {
        switch (action) {
            case 'recherche':    document.getElementById('headerSearch')?.focus(); break;
            case 'aleatoire':    document.getElementById('navRandom')?.click(); break;
            case 'bibliotheque': window.location.href = 'bibliotheque.html'; break;
            case 'accueil':      window.location.href = 'accueil.html'; break;
            case 'reprendre': {
                const last = await window.MH.lastReadTarget?.();
                if (last) window.location.href = last.href; else MH.toast('Aucune lecture en cours');
                break;
            }
            case 'aide': toggleShortcutsHelp(); break;
        }
    };

    function toggleShortcutsHelp() {
        const ex = document.getElementById('mhShortcuts');
        if (ex) { ex.remove(); return; }
        // L'aide lit la configuration REELLE : la presenter en dur la ferait
        // mentir des la premiere personnalisation.
        const rows = window.MH.raccourcis()
            .filter(r => r.touche)
            .map(r => [r.touche, r.label])
            .concat([['Ctrl+K', 'Palette de commandes'], ['Echap', 'Fermer']]);
        const ov = document.createElement('div');
        ov.id = 'mhShortcuts';
        ov.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.55);backdrop-filter:blur(2px)';
        ov.innerHTML = `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:14px;padding:22px 24px;min-width:300px;max-width:90vw;box-shadow:0 20px 60px rgba(0,0,0,.5)">
            <div style="font-family:var(--font-head);font-size:17px;font-weight:700;margin-bottom:14px">Raccourcis clavier</div>
            ${rows.map(([k, l]) => `<div style="display:flex;justify-content:space-between;align-items:center;gap:24px;padding:6px 0;font-size:13.5px;color:var(--text2)"><span>${l}</span><kbd style="background:var(--bg4);border:1px solid var(--border2);border-radius:6px;padding:2px 9px;font-family:monospace;color:var(--text)">${k}</kbd></div>`).join('')}
            <div style="text-align:right;margin-top:14px"><button class="btn btn-primary btn-sm" id="mhShortcutsClose">Fermer</button></div>
        </div>`;
        ov.addEventListener('click', (e) => { if (e.target === ov) ov.remove(); });
        document.body.appendChild(ov);
        document.getElementById('mhShortcutsClose')?.addEventListener('click', () => ov.remove());
    }

    /* ── Mises à jour de l'app (releases GitHub publiées par l'admin) ── */
    const UPDATE_EXE = 'https://github.com/Abdoulrazack1/Inko/releases/latest/download/Inko-Setup.exe';
    function cmpVer(a, b) {
        const pa = String(a || '0').replace(/^v/, '').split('.'), pb = String(b || '0').replace(/^v/, '').split('.');
        for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
            const d = (parseInt(pa[i], 10) || 0) - (parseInt(pb[i], 10) || 0);
            if (d) return d;
        }
        return 0;
    }
    window.MH.appUpdates = {
        exeUrl: UPDATE_EXE,
        // → { current, latest, hasUpdate } ; current absent en dev (pas d'APP_VERSION)
        async check() {
            const h = await window.API.health();
            if (!h.version) return { current: null, latest: null, hasUpdate: false };
            // Timeout sur l'API GitHub (peut être lente/dégradée) : on renvoie au
            // moins la version courante plutôt que de faire tourner le bouton.
            let latest = '';
            try {
                const ctrl = new AbortController();
                const t = setTimeout(() => ctrl.abort(), 12000);
                const rel = await fetch('https://api.github.com/repos/Abdoulrazack1/Inko/releases/latest',
                    { headers: { Accept: 'application/vnd.github+json' }, signal: ctrl.signal }).then(r => r.json());
                clearTimeout(t);
                latest = (rel.tag_name || '').replace(/^v/, '');
            } catch (e) { window.MH?.err?.('appUpdates.check', e); }
            return { current: h.version, latest, hasUpdate: !!latest && cmpVer(latest, h.version) > 0 };
        },
        download() { window.open(UPDATE_EXE, '_blank'); },
        // Télécharge ET installe directement (app desktop) : le backend récupère
        // l'installeur et le lance ; NSIS ferme Inko, met à jour, relance.
        // Repli navigateur si l'endpoint n'est pas dispo (hors app installée).
        async install() {
            const ok = await MH.confirm('Installer la mise à jour maintenant ?', {
                message: 'Inko va se fermer quelques secondes pour installer la nouvelle version, puis rouvrir automatiquement.',
                okText: 'Installer maintenant',
            });
            if (!ok) return;
            try {
                const r = await fetch((window.API?.base || '/api') + '/app/update', { method: 'POST' })
                    .then(x => x.json());
                if (r.ok) { MH.toast('Téléchargement de la mise à jour… Inko va redémarrer.', 6000); return; }
                throw new Error(r.error || 'échec');
            } catch (e) {
                // Pas d'app desktop (ou erreur) → téléchargement navigateur
                MH.toast('Téléchargement de l’installeur dans ton navigateur…');
                window.open(UPDATE_EXE, '_blank');
            }
        },
    };
    // Vérification À CHAQUE lancement (l'app desktop redémarre à chaque
    // ouverture ; l'appel GitHub est léger). Le bandeau reste tant que la
    // nouvelle version n'est pas installée ; « Plus tard » ne masque que
    // CETTE version — une version encore plus récente ré-affiche le bandeau.
    window.MH._maybeShowUpdateBar = async function () {
        try {
            if (document.getElementById('appUpdateBar')) return;
            const r = await MH.appUpdates.check();
            if (!r.hasUpdate) return;
            let dismissed = '';
            try { dismissed = localStorage.getItem('inko_upd_dismissed') || ''; } catch (e) { window.MH?.err?.('global.js', e); }
            if (dismissed && cmpVer(dismissed, r.latest) >= 0) return;   // déjà refusé cette version
            const bar = document.createElement('div');
            bar.id = 'appUpdateBar';
            bar.style.cssText = 'position:sticky;top:0;z-index:9997;background:var(--accent,#c1531b);color:#fff;padding:10px 16px;font-size:13.5px;display:flex;gap:12px;align-items:center;justify-content:center;flex-wrap:wrap';
            bar.innerHTML = '<span>🎉 Une nouvelle version d’Inko est disponible — <strong>v' + esc(r.latest) + '</strong> (tu as la v' + esc(r.current) + ')</span>' +
                '<button id="updDl" style="background:#fff;border:none;color:var(--accent,#c1531b);border-radius:8px;padding:6px 16px;cursor:pointer;font-size:12.5px;font-weight:700">⬇ Télécharger</button>' +
                '<button id="updLater" style="background:none;border:none;color:rgba(255,255,255,.8);cursor:pointer;font-size:12px">Plus tard</button>';
            bar.querySelector('#updDl').onclick = () => MH.appUpdates.install();
            bar.querySelector('#updLater').onclick = () => { bar.remove(); try { localStorage.setItem('inko_upd_dismissed', r.latest); } catch (e) { window.MH?.err?.('global.js', e); } };
            document.body.prepend(bar);
        } catch (e) { /* hors-ligne : au prochain lancement */ }
    };
    MH._maybeShowUpdateBar();

    /* ── Bandeau : base habituelle injoignable (repli embarqué) ── */
    (async function () {
        try {
            if (sessionStorage.getItem('inko_dbfb_seen')) return;
            const h = await window.API.health();
            if (!h.dbFallback || document.getElementById('dbFallbackBar')) return;
            const bar = document.createElement('div');
            bar.id = 'dbFallbackBar';
            bar.style.cssText = 'position:sticky;top:0;z-index:9998;background:#a83232;color:#fff;padding:10px 16px;font-size:13px;display:flex;gap:12px;align-items:center;justify-content:center;text-align:center';
            bar.innerHTML = '<span>Ta base de données habituelle est injoignable — Inko tourne sur une base temporaire (ta bibliothèque n’est pas perdue). Redémarre MySQL puis relance Inko pour la retrouver.</span>' +
                '<button style="background:rgba(255,255,255,.18);border:none;color:#fff;border-radius:8px;padding:5px 12px;cursor:pointer;font-size:12px">OK</button>';
            bar.querySelector('button').onclick = () => { bar.remove(); try { sessionStorage.setItem('inko_dbfb_seen', '1'); } catch (e) { window.MH?.err?.('global.js', e); } };
            document.body.prepend(bar);
        } catch (e) { window.MH?.err?.('global.js', e); }
    })();

    /* ── Retour de connexion AniList (redirection pleine page) ── */
    (function () {
        try {
            const q = new URLSearchParams(location.search);
            if (q.get('anilist') !== 'linked') return;
            q.delete('anilist');
            history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : ''));
            (async () => {
                await ensureAniList();
                if (!window.AniList?.isLinked()) return;
                try { await AniList.me(); } catch (e) { window.MH?.err?.('global.js', e); }
                MH.toast('AniList connecté ✓');
                document.querySelectorAll('.conn-list').forEach(el => MH.renderConnections(el));
            })();
        } catch (e) { window.MH?.err?.('global.js', e); }
    })();

    /* ── Visite guidée (première ouverture) ─────────────────
       Chargée dynamiquement pour ne rien coûter aux lancements
       suivants. MH.startTour() la rejoue (Paramètres). */
    function loadTour(autostart) {
        return new Promise((resolve) => {
            if (window.InkoTour) return resolve();
            const sc = document.createElement('script');
            sc.src = 'assets/js/onboarding.js';
            sc.onload = resolve;
            document.head.appendChild(sc);
        });
    }
    window.MH.startTour = async function () { await loadTour(); window.InkoTour?.start(); };
    try {
        if (!localStorage.getItem('inko_tour_done')) loadTour(true); // autostart interne
        else {
            // Audit AMEL-111 : le module portait UNIQUEMENT la visite, il
            // n'etait donc jamais charge pour qui l'avait deja faite — et les
            // astuces contextuelles n'auraient existe pour personne. On le
            // charge aussi tant qu'il reste une page dont l'astuce n'a pas ete
            // vue, puis plus jamais.
            const vues = JSON.parse(localStorage.getItem('inko_astuces_vues') || '[]');
            const PAGES = ['catalogue', 'bibliotheque', 'serie', 'chapitre', 'stats', 'profil', 'notifications'];
            if (PAGES.some(p => !vues.includes(p))) loadTour(false);
        }
    } catch (e) { window.MH?.err?.('global.js', e); }

})();
