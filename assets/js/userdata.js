// ============================================================
// userdata.js — Données utilisateur légères, jamais perdues.
// ------------------------------------------------------------
// Stocke signets, notes personnelles, épingles, objectif de
// lecture et historique de recherche. Double persistance :
//   1) miroir localStorage (instantané, hors-ligne)
//   2) synchro serveur via /me/settings (clé "userdata")
// La source de vérité reste le compte ; le local évite toute
// perte visuelle entre deux sessions ou hors connexion.
// ============================================================
(function () {
    'use strict';

    const LKEY = 'inko_userdata_v1';
    const DEFAULTS = { notes: {}, pins: [], goal: {}, searchHistory: [], bookmarks: [], file: [] };

    let data = load();
    let pulled = false;
    let saveTimer = null;

    function load() {
        try { return Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(LKEY)) || {}); }
        catch (e) { return Object.assign({}, DEFAULTS); }
    }
    function persistLocal() { try { localStorage.setItem(LKEY, JSON.stringify(data)); } catch (e) { window.MH?.err?.('userdata.js', e); } }

    function scheduleSync() {
        persistLocal();
        if (!window.API?.isLoggedIn?.()) return;
        clearTimeout(saveTimer);
        saveTimer = setTimeout(async () => {
            try { await API.me.saveSettings({ userdata: data }); } catch (e) { window.MH?.err?.('userdata.js', e); }
        }, 700);
    }

    // Envoi d'un signet, sans bloquer l'interface : la pose d'un signet doit
    // être instantanée à l'écran, le serveur suit.
    function envoyerSignet(b) {
        if (!window.API?.isLoggedIn?.()) return;
        API.me.addBookmark(b).catch(e => window.MH?.err?.('userdata.js', e));
    }

    // À appeler tôt sur les pages qui lisent les données utilisateur.
    async function ready() {
        if (pulled) return data;
        if (window.API?.isLoggedIn?.()) {
            try {
                const s = await API.me.settings();
                if (s && s.userdata && typeof s.userdata === 'object') {
                    // `bookmarks` ne vient plus des réglages (audit AMEL-41) :
                    // on garde ceux déjà en mémoire pour ne pas les écraser
                    // avec un blob qui, après migration, ne les contient plus.
                    const { bookmarks: _ignore, ...reste } = s.userdata;
                    const local = data;
                    data = Object.assign({}, DEFAULTS, reste, { bookmarks: data.bookmarks || [] });

                    // FUSION, et non remplacement.
                    //
                    // `bookmarks` avait droit à une exception écrite à la main.
                    // Le problème qu'elle règle n'a pourtant rien de particulier
                    // à `bookmarks` : il se pose pour TOUTE clé que le serveur
                    // ne connaît pas encore.
                    //
                    // Constaté en ajoutant la file « à lire ensuite » : on met
                    // une série de côté, `scheduleSync` écrit en local puis
                    // pousse au serveur 700 ms plus tard, on change de page
                    // avant — et `ready()` réécrit tout avec une copie serveur
                    // où `file` n'existe pas. La série disparaît sans un mot.
                    // Le même sort attendait la clé suivante, et celle d'après.
                    //
                    // Une clé absente du serveur garde donc sa valeur locale.
                    // Le revers est assumé : une clé RETIRÉE côté serveur
                    // ressuscite. Perdre ce que l'utilisateur vient de faire
                    // coûte plus cher que garder ce qu'il avait déjà.
                    for (const [k, v] of Object.entries(local)) {
                        if (k === 'bookmarks') continue;
                        if (reste[k] === undefined && v !== undefined) data[k] = v;
                    }
                    persistLocal();
                }
            } catch (e) { /* hors-ligne : on garde le miroir local */ }
            try {
                const liste = await API.me.bookmarks();
                if (Array.isArray(liste)) { data.bookmarks = liste; persistLocal(); }
            } catch (e) { /* hors-ligne : le miroir local fait foi */ }
        }
        pulled = true;
        return data;
    }

    const keyOf = (mangaId, source) => `${source || ''}:${mangaId}`;

    window.UserData = {
        ready,
        all() { return data; },

        // ── Notes personnelles par série ──
        getNote(mangaId, source) { return data.notes[keyOf(mangaId, source)] || ''; },
        setNote(mangaId, source, text) {
            const k = keyOf(mangaId, source);
            if (text && text.trim()) data.notes[k] = text.trim();
            else delete data.notes[k];
            scheduleSync();
        },

        // ── Épingles (séries en haut de la bibliothèque) ──
        isPinned(mangaId, source) { return data.pins.includes(keyOf(mangaId, source)); },
        togglePin(mangaId, source) {
            const k = keyOf(mangaId, source);
            const i = data.pins.indexOf(k);
            if (i >= 0) data.pins.splice(i, 1); else data.pins.unshift(k);
            scheduleSync();
            return i < 0; // true si désormais épinglé
        },
        pinKey: keyOf,

        // ── Objectif de lecture ──
        getGoal() { return data.goal || {}; },
        setGoal(g) { data.goal = Object.assign({}, data.goal, g); scheduleSync(); },

        // ── File d'attente : « à lire ensuite » ──────────────
        //
        // Une collection sert à RANGER ce qu'on a déjà ; la file sert à décider
        // quoi ouvrir maintenant. Les deux se confondaient : on créait une liste
        // « à lire » qu'il fallait ouvrir, parcourir, puis nettoyer à la main —
        // et rien, sur l'accueil, ne rappelait ce qu'on s'était promis de lire.
        //
        // Elle vit dans `UserData` et non côté serveur : comme les épingles,
        // c'est une préférence, elle doit exister sans compte et suivre
        // l'appareil hors ligne. La synchronisation vient en plus.
        //
        // On stocke le titre et la couverture AVEC l'entrée. Une file qui ne
        // garderait que des identifiants exigerait un appel réseau par ligne
        // pour s'afficher — donc une file invisible hors ligne, c'est-à-dire
        // précisément quand on cherche quoi lire.
        file() { return (data.file || []).slice(); },
        dansLaFile(mangaId, source) {
            const k = keyOf(mangaId, source);
            return (data.file || []).some((e) => e.k === k);
        },
        /** Ajoute en tête, ou retire. Rend `true` si l'œuvre y est désormais. */
        basculerFile(entree) {
            const k = keyOf(entree.id, entree.source);
            data.file = data.file || [];
            const i = data.file.findIndex((e) => e.k === k);
            if (i >= 0) { data.file.splice(i, 1); scheduleSync(); return false; }
            data.file.unshift({
                k,
                id: entree.id,
                source: entree.source || '',
                title: String(entree.title || '').slice(0, 200),
                cover: entree.cover || '',
                at: new Date().toISOString(),
            });
            // Un garde-fou, pas une limite de confort : `userdata` part entier
            // dans les réglages à chaque synchronisation, et une file sans
            // borne finirait par peser sur chaque écriture.
            if (data.file.length > 100) data.file.length = 100;
            scheduleSync();
            return true;
        },
        retirerDeLaFile(mangaId, source) {
            const k = keyOf(mangaId, source);
            const avant = (data.file || []).length;
            data.file = (data.file || []).filter((e) => e.k !== k);
            if (data.file.length !== avant) scheduleSync();
        },

        // ── Historique de recherche ──
        getSearchHistory() { return data.searchHistory || []; },
        pushSearch(q) {
            q = (q || '').trim();
            if (!q) return;
            // Audit AMEL-107 : le mode privé ne couvrait que la progression.
            // Une recherche récente est pourtant la trace la plus visible qui
            // soit — elle s'affiche sous la barre de recherche à la vue de
            // quiconque ouvre l'app ensuite.
            if (window.MH?.isIncognito?.()) return;
            data.searchHistory = [q, ...data.searchHistory.filter(x => x.toLowerCase() !== q.toLowerCase())].slice(0, 12);
            scheduleSync();
        },
        clearSearchHistory() { data.searchHistory = []; scheduleSync(); },

        // ── Signets de lecture (chapitre + position) ──
        // Audit AMEL-41 : ils vivaient dans le blob de réglages, rechargé à
        // chaque page et réécrit EN ENTIER au moindre ajout — avec un plafond
        // arbitraire de 200. Ils ont désormais leur table.
        //
        // La surface reste SYNCHRONE (`getBookmarks()` rend un tableau) : une
        // douzaine d'appelants la lisent en plein rendu, et la rendre async
        // aurait demandé de réécrire chacun d'eux pour un gain nul. Le miroir
        // local sert de source de lecture, le serveur de source de vérité.
        getBookmarks() { return data.bookmarks || []; },
        addBookmark(b) {
            // b: { mangaId, source, title, cover, chapterId, chapterNum, page, label }
            data.bookmarks = data.bookmarks.filter(x => !(x.chapterId === b.chapterId && x.mangaId === b.mangaId));
            data.bookmarks.unshift(Object.assign({ at: Date.now() }, b));
            persistLocal();
            envoyerSignet(b);
        },
        removeBookmark(mangaId, chapterId) {
            data.bookmarks = data.bookmarks.filter(x => !(x.chapterId === chapterId && x.mangaId === mangaId));
            persistLocal();
            if (window.API?.isLoggedIn?.()) {
                API.me.removeBookmark(mangaId, chapterId)
                    .catch(e => window.MH?.err?.('userdata.js', e));
            }
        },
        hasBookmark(mangaId, chapterId) {
            return data.bookmarks.some(x => x.chapterId === chapterId && x.mangaId === mangaId);
        },
    };
})();
