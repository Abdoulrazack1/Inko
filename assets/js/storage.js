// ============================================================
// storage.js — Préférences UI locales (mode lecture, zoom, etc.)
// ============================================================
// La source de vérité pour favoris/progression/etc. est désormais
// l'API backend (cf api.js). Storage ne garde que ce qui est
// strictement local : préférences d'affichage et cache court.
// ============================================================
(function () {
    'use strict';

    // ── Migrations localStorage versionnées (audit DF10) ─────
    // Chaque entrée transforme le stockage local d'une version à la suivante.
    // Ajouter une fonction ici quand un schéma de clé change ; elle ne
    // s'exécute qu'une fois par navigateur.
    const SCHEMA_KEY = 'inko_schema_version';
    const MIGRATIONS = [
        // v1 : état de référence (aucune transformation)
        function v1() {},
        // v2 (exemple futur) : function v2() { renommer/convertir des clés ici }
    ];
    (function runMigrations() {
        try {
            let v = parseInt(localStorage.getItem(SCHEMA_KEY) || '0', 10) || 0;
            while (v < MIGRATIONS.length) {
                try { MIGRATIONS[v](); } catch (e) { /* une migration ratée ne bloque pas l'app */ }
                v++;
            }
            localStorage.setItem(SCHEMA_KEY, String(v));
        } catch (e) { window.MH?.err?.('storage.js', e); }
    })();

    const PREF_KEY = 'mh_prefs';
    const DEFAULT_PREFS = {
        readMode:        'page',    // 'page' | 'scroll' | 'double'
        zoom:            100,
        quality:         'high',    // 'high' | 'saver'
        theme:           'dark',
        readingDir:      'rtl',     // right-to-left default for manga
        autoMarkRead:    true,
        notifications:   true,
    };

    function get(key, fb) {
        try { const r = localStorage.getItem(key); return r === null ? fb : JSON.parse(r); }
        catch(e) { return fb; }
    }
    function set(key, val) {
        try { localStorage.setItem(key, JSON.stringify(val)); }
        catch (e) { window.MH?.err?.('storage.js', e); }
    }

    // Miroir local de la bibliothèque : permet de continuer à voir ses séries
    // même hors-ligne ou déconnecté (la source de vérité reste le serveur).
    const LIB_KEY = 'inko_lib_mirror';

    window.Storage = {
        getPrefs()       { return { ...DEFAULT_PREFS, ...get(PREF_KEY, {}) }; },
        setPref(k, v)    { const p = window.Storage.getPrefs(); p[k] = v; set(PREF_KEY, p); },
        getPref(k)       { return window.Storage.getPrefs()[k]; },

        // ── Cache bibliothèque (favoris) ──
        // Un miroir NE SE VIDE PAS tout seul.
        //
        // Ce cache existe pour que la bibliothèque ne disparaisse jamais :
        // serveur éteint, session perdue, réseau coupé, on affiche la
        // dernière copie connue. Or il était réécrit avec TOUT ce que le
        // serveur renvoyait — y compris une liste vide.
        //
        // Le 9 novembre, le serveur a répondu 200 avec zéro favori. La
        // bibliothèque s'est affichée vide, et dans la foulée le miroir
        // de 495 entrées a été remplacé par une liste vide : le filet de
        // sécurité s'est effacé au moment précis où il servait. Les
        // favoris ont été retrouvés dans la sauvegarde de la veille,
        // mais le miroir, lui, n'était récupérable nulle part.
        //
        // Donc : on n'écrase jamais un miroir garni par du vide. Vider
        // vraiment sa bibliothèque reste possible — `clearLibraryCache`
        // existe pour ça, et la déconnexion l'appelle. Ce qu'on refuse,
        // c'est de le faire SANS QUE PERSONNE NE L'AIT DEMANDÉ.
        cacheLibrary(favs) {
            try {
                const slim = (favs || []).map(f => ({
                    mangaId: f.mangaId, title: f.title, cover: f.cover,
                    source: f.source, status: f.status, category: f.category,
                    lastChapter: f.lastChapter,
                }));
                if (!slim.length) {
                    const avant = this.getCachedLibrary();
                    if (avant && avant.favs.length) {
                        window.MH?.err?.('storage.js',
                            new Error(`miroir conservé : réponse vide contre ${avant.favs.length} entrée(s) gardées`));
                        return;
                    }
                }
                set(LIB_KEY, { at: Date.now(), favs: slim });
            } catch (e) { window.MH?.err?.('storage.js', e); }
        },
        getCachedLibrary() {
            const c = get(LIB_KEY, null);
            return c && Array.isArray(c.favs) ? c : null;
        },
        clearLibraryCache() { try { localStorage.removeItem(LIB_KEY); } catch (e) { window.MH?.err?.('storage.js', e); } },
    };
})();
