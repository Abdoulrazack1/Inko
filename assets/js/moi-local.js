// ============================================================
// moi-local.js — les données personnelles, sur le téléphone
// ------------------------------------------------------------
// Un inventaire page par page l'a montré sans ambiguïté : sept pages étaient
// INUTILISABLES sans ordinateur, et l'écrasante majorité des appels en échec
// visaient `me.*` — favoris, progression, notes, listes, réglages, chapitres
// lus, statistiques.
//
// Donner une source au téléphone (`sources-embarquees.js`) lui permet de
// TROUVER des œuvres. Ce module lui permet d'en GARDER quelque chose. Sans
// lui, on peut parcourir MangaDex mais rien mettre en favori, rien reprendre
// où on s'était arrêté, rien annoter : une liseuse sans mémoire.
//
// ── Ce que ça n'est pas ─────────────────────────────────────
//
// Ce n'est PAS une synchronisation. Ces données vivent sur cet appareil, et
// nulle part ailleurs. Connecter un hub reste ce qui les fait suivre d'un
// écran à l'autre — et l'interface doit le dire, sous peine de laisser croire
// à une sauvegarde qui n'existe pas.
//
// ── Pourquoi localStorage, et ce que ça coûte ───────────────
//
// Le volume attendu est petit : quelques centaines de séries, quelques
// milliers de chapitres lus, soit des dizaines de kilo-octets. localStorage
// est synchrone, simple, et déjà utilisé par le reste de l'application.
//
// Sa limite (≈5 Mo) est réelle mais lointaine ; `place()` la surveille et
// `ecrire()` refuse proprement plutôt que de lever un `QuotaExceededError` au
// milieu d'un enregistrement. IndexedDB serait le pas suivant, si un jour un
// utilisateur atteint ce plafond.
(function () {
    'use strict';

    const CLE = 'inko_moi_local';
    const VERSION = 1;

    // ── Le magasin ──────────────────────────────────────────
    function vide() {
        return {
            version: VERSION,
            favorites: [],        // [{ mangaId, title, cover, source, category, addedAt }]
            progress: {},         // mangaId → { chapterId, chapter, page, totalPages, source, updatedAt }
            readChapters: {},     // mangaId → [chapterId]
            notes: [],            // [{ id, mangaId, chapterId, chapter, page, text, createdAt }]
            lists: [],            // [{ id, name, items[], public, smart, createdAt }]
            bookmarks: [],
            library: {},          // mangaId → { status, rating }
            settings: {},
            events: [],           // journal local, borné
            anilistLinks: {},
        };
    }

    let etat = null;

    function lire() {
        if (etat) return etat;
        try {
            const brut = localStorage.getItem(CLE);
            etat = brut ? JSON.parse(brut) : vide();
        } catch (e) {
            // Stockage refusé (navigation privée) ou JSON corrompu : on repart
            // d'un magasin vide plutôt que de faire tomber toute l'application.
            // Perdre des favoris est grave ; ne plus démarrer l'est plus.
            etat = vide();
        }
        // Un magasin écrit par une version plus ancienne peut manquer des
        // sections. On complète plutôt que d'échouer à la première lecture.
        for (const [k, v] of Object.entries(vide())) if (etat[k] === undefined) etat[k] = v;
        return etat;
    }

    function ecrire() {
        try {
            localStorage.setItem(CLE, JSON.stringify(etat));
            return true;
        } catch (e) {
            // `QuotaExceededError` : on le DIT, plutôt que de laisser croire
            // que c'est enregistré. Une donnée perdue en silence est pire
            // qu'un message d'erreur.
            window.MH?.toast?.('Stockage plein — cette modification n’a pas pu être gardée.');
            window.MH?.err?.('moi-local.js', e);
            return false;
        }
    }

    /** Taille approximative, pour le panneau des réglages. */
    function place() {
        try { return (localStorage.getItem(CLE) || '').length; } catch (e) { return 0; }
    }

    const maintenant = () => new Date().toISOString();
    const id = () => 'l' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

    // Journal local : c'est lui qui alimente l'historique et les statistiques.
    // Borné, parce qu'un journal sans plafond finit par occuper toute la place
    // disponible — et l'audit avait déjà relevé ce défaut côté serveur (DB-06).
    const MAX_EVENEMENTS = 2000;
    function journal(type, donnees) {
        const s = lire();
        s.events.unshift({ id: id(), type, at: maintenant(), ...donnees });
        if (s.events.length > MAX_EVENEMENTS) s.events.length = MAX_EVENEMENTS;
    }

    // ── Les routes, telles que `api.js` les appelle ─────────
    //
    // On répond aux CHEMINS plutôt qu'à des noms de méthodes : `api.js`
    // construit déjà les URL, et dupliquer sa table ferait deux définitions à
    // maintenir — celle du hub et celle du téléphone.
    const ABSENT = Symbol('absent');

    // L'identifiant d'application AniList par défaut, le même que celui du
    // serveur. Le declarer ici permet a AniList de fonctionner sans hub —
    // c'etait sa SEULE dependance : `anilist.js` parle deja directement a
    // graphql.anilist.co, ou CORS est autorise.
    const ANILIST_CLIENT_ID_DEFAUT = '43908';

    function repondre(method, chemin, corps) {
        const s = lire();
        const [p, requete] = String(chemin).split('?');
        const q = new URLSearchParams(requete || '');
        const seg = p.split('/').filter(Boolean);      // ['me', 'favorites', …]

        // ── AniList : la configuration vit sur l'appareil ──
        //
        // ⚠ La redirection OAuth est le point delicat. Dans l'app installee,
        // l'origine est `http://localhost` — pas l'adresse du hub. AniList
        // renvoie le jeton vers l'URI enregistree dans SON application, qui
        // doit donc inclure celle-ci. D'ou `redirectUri` calcule a partir de
        // l'origine reelle, et non recopie du serveur.
        if (seg[0] === 'anilist' && seg[1] === 'config') {
            if (method === 'GET') {
                const cid = (s.settings.anilistClientId || '').trim() || ANILIST_CLIENT_ID_DEFAUT;
                return {
                    configured: !!cid,
                    clientId: cid,
                    redirectUri: location.origin + '/anilist.html',
                    viaEnv: false,
                    builtin: cid === ANILIST_CLIENT_ID_DEFAUT,
                    authorizeBase: 'https://anilist.co/api/v2/oauth/authorize',
                    local: true,
                };
            }
            if (method === 'PUT') {
                s.settings.anilistClientId = ((corps || {}).clientId || '').trim();
                ecrire();
                return { ok: true };
            }
            return ABSENT;
        }

        if (seg[0] !== 'me') return ABSENT;
        const quoi = seg[1];
        const arg = seg[2] ? decodeURIComponent(seg[2]) : null;
        const sous = seg[3] || null;

        switch (quoi) {

        // ── Favoris ────────────────────────────────────────
        case 'favorites': {
            if (method === 'GET') return s.favorites.slice();
            if (method === 'POST') {
                const f = corps || {};
                if (!f.mangaId) return { ok: false };
                const dejaLa = s.favorites.find((x) => String(x.mangaId) === String(f.mangaId));
                if (dejaLa) Object.assign(dejaLa, f);
                else s.favorites.unshift({ ...f, addedAt: maintenant() });
                journal('favorite', { mangaId: f.mangaId, title: f.title });
                ecrire();
                return { ok: true };
            }
            if (method === 'DELETE' && arg) {
                s.favorites = s.favorites.filter((x) => String(x.mangaId) !== String(arg));
                ecrire();
                return { ok: true };
            }
            if (method === 'PUT' && sous === 'category') {
                const f = s.favorites.find((x) => String(x.mangaId) === String(arg));
                if (f) { f.category = (corps || {}).category || null; ecrire(); }
                return { ok: true };
            }
            return ABSENT;
        }

        // ── Progression de lecture ─────────────────────────
        case 'progress': {
            if (method === 'GET' && !arg) return { ...s.progress };
            if (method === 'GET' && sous === 'history') return { history: [] };
            if (method === 'PUT' && arg) {
                const d = corps || {};
                s.progress[arg] = {
                    chapterId: d.chapterId, chapter: d.chapter, page: d.page,
                    totalPages: d.totalPages ?? null, source: d.source ?? null,
                    updatedAt: d.clientAt || maintenant(),
                };
                journal('read', { mangaId: arg, chapter: d.chapter, page: d.page });
                ecrire();
                return { ok: true };
            }
            if (method === 'DELETE' && arg) { delete s.progress[arg]; ecrire(); return { ok: true }; }
            return ABSENT;
        }

        // ── Chapitres lus ──────────────────────────────────
        case 'read-chapters': {
            if (method === 'GET') return { ...s.readChapters };
            if (method === 'POST' && !arg) {
                const d = corps || {};
                const liste = s.readChapters[d.mangaId] || (s.readChapters[d.mangaId] = []);
                const cid = String(d.chapterId);
                if (d.read === false) s.readChapters[d.mangaId] = liste.filter((x) => x !== cid);
                else if (!liste.includes(cid)) liste.push(cid);
                journal('chapter', { mangaId: d.mangaId, chapter: d.chapter });
                ecrire();
                return { ok: true };
            }
            if (method === 'POST' && arg === 'bulk') {
                const d = corps || {};
                const liste = s.readChapters[d.mangaId] || (s.readChapters[d.mangaId] = []);
                for (const c of (d.chapters || [])) {
                    const cid = String(c.chapterId ?? c.id ?? c);
                    if (!liste.includes(cid)) liste.push(cid);
                }
                ecrire();
                return { ok: true, count: (d.chapters || []).length };
            }
            if (method === 'POST' && arg === 'unmark-bulk') {
                const d = corps || {};
                const retirer = new Set((d.chapterIds || []).map(String));
                s.readChapters[d.mangaId] = (s.readChapters[d.mangaId] || []).filter((x) => !retirer.has(x));
                ecrire();
                return { ok: true };
            }
            return ABSENT;
        }

        // ── Notes de lecture ───────────────────────────────
        case 'notes': {
            if (method === 'GET' && arg === 'stats') {
                return { total: s.notes.length, series: new Set(s.notes.map((n) => n.mangaId)).size };
            }
            if (method === 'GET') {
                const m = q.get('mangaId');
                const l = m ? s.notes.filter((n) => String(n.mangaId) === String(m)) : s.notes;
                return { notes: l.slice(), total: l.length };
            }
            if (method === 'POST') {
                const n = { id: id(), createdAt: maintenant(), ...(corps || {}) };
                s.notes.unshift(n);
                ecrire();
                return n;
            }
            if (method === 'PUT' && arg) {
                const n = s.notes.find((x) => x.id === arg);
                if (n) { Object.assign(n, corps || {}, { updatedAt: maintenant() }); ecrire(); }
                return { ok: !!n };
            }
            if (method === 'DELETE' && arg) {
                s.notes = s.notes.filter((x) => x.id !== arg);
                ecrire();
                return { ok: true };
            }
            return ABSENT;
        }

        // ── Listes / collections ───────────────────────────
        case 'lists': {
            if (method === 'GET') return s.lists.slice();
            if (method === 'POST' && !arg) {
                const l = { id: id(), items: [], createdAt: maintenant(), ...(corps || {}) };
                s.lists.unshift(l);
                ecrire();
                return l;
            }
            const liste = arg ? s.lists.find((x) => String(x.id) === String(arg)) : null;
            if (method === 'PUT' && liste && !sous) { Object.assign(liste, corps || {}); ecrire(); return liste; }
            if (method === 'DELETE' && arg && !sous) {
                s.lists = s.lists.filter((x) => String(x.id) !== String(arg));
                ecrire();
                return { ok: true };
            }
            if (method === 'POST' && liste && sous === 'items') {
                const it = corps || {};
                if (!liste.items.some((x) => String(x.mangaId) === String(it.mangaId))) liste.items.push(it);
                ecrire();
                return { ok: true };
            }
            if (method === 'DELETE' && liste && sous === 'items') {
                const cible = seg[4] ? decodeURIComponent(seg[4]) : null;
                liste.items = liste.items.filter((x) => String(x.mangaId) !== String(cible));
                ecrire();
                return { ok: true };
            }
            if (method === 'PUT' && liste && sous === 'order') {
                const ordre = (corps || {}).mangaIds || [];
                liste.items.sort((a, b) => ordre.indexOf(String(a.mangaId)) - ordre.indexOf(String(b.mangaId)));
                ecrire();
                return { ok: true };
            }
            return ABSENT;
        }

        // ── Bibliothèque (statut / note personnelle) ───────
        case 'library': {
            if (method === 'GET') return { ...s.library };
            if (method === 'PUT' && arg) {
                s.library[arg] = { ...(s.library[arg] || {}), ...(corps || {}) };
                ecrire();
                return { ok: true };
            }
            return ABSENT;
        }

        // ── Marque-pages ───────────────────────────────────
        case 'bookmarks': {
            if (method === 'GET') return { bookmarks: s.bookmarks.slice() };
            if (method === 'POST') { s.bookmarks.unshift({ id: id(), at: maintenant(), ...(corps || {}) }); ecrire(); return { ok: true }; }
            if (method === 'DELETE' && arg) { s.bookmarks = s.bookmarks.filter((b) => b.id !== arg); ecrire(); return { ok: true }; }
            return ABSENT;
        }

        // ── Réglages ───────────────────────────────────────
        case 'settings': {
            if (method === 'GET') return { ...s.settings };
            if (method === 'PUT') { s.settings = { ...s.settings, ...(corps || {}) }; ecrire(); return { ok: true }; }
            return ABSENT;
        }

        // ── Liens AniList ──────────────────────────────────
        case 'anilist-links': {
            if (method === 'GET') return { ...s.anilistLinks };
            if (method === 'PUT') { s.anilistLinks = { ...s.anilistLinks, ...(corps || {}) }; ecrire(); return { ok: true }; }
            return ABSENT;
        }

        // ── Journal, statistiques ──────────────────────────
        case 'events': {
            if (method !== 'GET') return ABSENT;
            const limite = +q.get('limit') || 50;
            return { events: s.events.slice(0, limite) };
        }

        case 'stats': {
            if (method !== 'GET') return ABSENT;
            if (arg === 'distribution') return { distribution: [] };
            const lus = Object.values(s.readChapters).reduce((n, l) => n + l.length, 0);
            return {
                chaptersRead: lus,
                mangasRead: Object.keys(s.progress).length,
                favorites: s.favorites.length,
                notes: s.notes.length,
                lists: s.lists.length,
                // Le hub calcule bien plus (temps de lecture, séries terminées,
                // séries par mois). Rendre zéro serait FAUX ; on rend ce qu'on
                // sait, et l'interface doit dire d'où ça vient.
                local: true,
            };
        }

        case 'ratings':
            return method === 'GET' ? { ratings: [] } : ABSENT;

        // ── Mises à jour des séries suivies ────────────────
        case 'updates':
            // Le scan de toutes les sources appartient au hub. Répondre « rien
            // de neuf » serait un mensonge ; on dit que ce n'est pas fait ici.
            return method === 'GET'
                ? { updates: [], frais: false, local: true, raison: 'sans-hub' }
                : ABSENT;

        // ── Historique ─────────────────────────────────────
        case 'clear-history': {
            if (method !== 'POST') return ABSENT;
            const jours = (corps || {}).days;
            if (!jours) s.events = [];
            else {
                const limite = Date.now() - jours * 86400000;
                s.events = s.events.filter((e) => new Date(e.at).getTime() > limite);
            }
            ecrire();
            return { ok: true };
        }

        // ── Export / import ────────────────────────────────
        case 'export':
            return method === 'GET'
                ? { version: VERSION, exporte: maintenant(), source: 'local', donnees: JSON.parse(JSON.stringify(s)) }
                : ABSENT;

        case 'import': {
            if (method !== 'POST') return ABSENT;
            const d = (corps || {}).donnees || corps || {};
            // On FUSIONNE plutôt que d'écraser : importer une sauvegarde ne
            // doit pas effacer ce qui a été lu depuis.
            for (const cle of ['favorites', 'notes', 'lists', 'bookmarks']) {
                if (Array.isArray(d[cle])) {
                    const vus = new Set(s[cle].map((x) => String(x.id ?? x.mangaId)));
                    for (const x of d[cle]) if (!vus.has(String(x.id ?? x.mangaId))) s[cle].push(x);
                }
            }
            for (const cle of ['progress', 'readChapters', 'library', 'settings', 'anilistLinks']) {
                if (d[cle] && typeof d[cle] === 'object') s[cle] = { ...s[cle], ...d[cle] };
            }
            ecrire();
            return { ok: true, fusionne: true };
        }

        default:
            return ABSENT;
        }
    }

    window.INKO_MOI_LOCAL = {
        disponible: true,
        repondre,
        ABSENT,
        place,
        _etat: lire,
        _reinitialiser() { etat = vide(); ecrire(); },
    };
})();
