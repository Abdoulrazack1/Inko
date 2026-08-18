// ============================================================
// sources-embarquees.js — le téléphone interroge les sources LUI-MÊME
// ------------------------------------------------------------
// Jusqu'ici le téléphone ne savait rien faire seul : le hub scrapait, il
// affichait. Sans ordinateur allumé, l'application s'ouvrait sur un catalogue
// vide. Ce module lui donne une source qu'il peut interroger directement.
//
// ── Pourquoi ça n'était pas possible avant ──────────────────
//
// Deux obstacles, et un seul était réel.
//
// Le premier, le vrai : **CORS**. Un `fetch()` depuis le WebView part avec
// l'origine `http://localhost`, et `api.mangadex.org` ne l'autorise pas — la
// requête est refusée par le navigateur avant même de partir. C'est ce qui
// rendait le scraping côté téléphone « impossible ».
//
// Or Capacitor fournit `CapacitorHttp` : la requête est faite par le code
// NATIF, hors du moteur web. Il n'y a donc pas d'origine, donc pas de CORS.
// L'obstacle n'existe que dans le navigateur.
//
// Le second, supposé : « il faudrait réécrire les extensions ». Vrai pour
// celles qui scrapent du HTML (elles dépendent de cheerio), faux pour
// MangaDex — c'est une API JSON. D'où le choix de commencer par elle : elle
// donne un catalogue complet, une recherche et des pages, sans une ligne
// d'analyse HTML.
//
// ── Ce que ce module N'EST PAS ──────────────────────────────
//
// Ce n'est pas un remplacement du hub. Le hub reste supérieur : il a toutes
// les sources, il mutualise le cache, il ne montre qu'une adresse IP aux
// sites, et il synchronise entre appareils. Ce module est le SOCLE — ce qui
// rend l'application utilisable seule, pas ce qui rend le hub inutile.
//
// ── Les formes de données sont celles du serveur, à l'identique ──
//
// Chaque page (`accueil.js`, `serie.js`, `chapitre.js`…) lit des champs
// précis : `results[]`, `id`, `title`, `coverThumb`… Rendre autre chose ici
// obligerait à écrire un second affichage, qui divergerait. Les fonctions de
// normalisation ci-dessous reproduisent donc EXACTEMENT celles de
// `extensions-community/mangadex/index.js`.
(function () {
    'use strict';

    const BASE = 'https://api.mangadex.org';
    const COVERS = 'https://uploads.mangadex.org/covers';

    // MangaDex limite à 5 requêtes/seconde par IP. Un cache court évite de
    // s'en approcher en naviguant, et rend le retour arrière instantané.
    const cache = new Map();
    const MAX_CACHE = 120;

    function duCache(cle) {
        const e = cache.get(cle);
        if (!e) return null;
        if (e.expire < Date.now()) { cache.delete(cle); return null; }
        return e.valeur;
    }
    function auCache(cle, valeur, ms) {
        // Plafond : sans lui, une session de navigation longue ferait grossir
        // la carte indéfiniment. On évince le plus ancien inséré.
        if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value);
        cache.set(cle, { valeur, expire: Date.now() + ms });
    }

    /**
     * Un appel HTTP qui traverse CORS, parce qu'il ne passe pas par le
     * navigateur.
     *
     * `CapacitorHttp` est absent hors de l'app native (site, bureau) : on
     * retombe alors sur `fetch`, qui marchera partout où l'origine est
     * autorisée — c'est le cas en développement derrière le hub.
     */
    async function appel(chemin, params = {}, ttl = 60000) {
        const sp = new URLSearchParams();
        for (const [k, v] of Object.entries(params)) {
            if (Array.isArray(v)) v.forEach((x) => { if (x != null && x !== '') sp.append(k, x); });
            else if (v != null && v !== '') sp.append(k, v);
        }
        const url = BASE + chemin + (sp.toString() ? '?' + sp : '');

        const enCache = duCache(url);
        if (enCache) return enCache;

        const Http = window.Capacitor?.Plugins?.CapacitorHttp;
        let data;
        if (Http) {
            const r = await Http.request({
                url,
                method: 'GET',
                headers: { Accept: 'application/json' },
                connectTimeout: 20000,
                readTimeout: 20000,
            });
            // Le greffon natif rend le corps DÉJÀ analysé quand le type est
            // JSON, et une chaîne sinon. Traiter les deux évite un plantage
            // sur une réponse d'erreur en HTML (page de maintenance, portail
            // Wi-Fi captif).
            data = typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
            if (r.status >= 400) throw erreurLisible(r.status);
        } else {
            const r = await fetch(url, { headers: { Accept: 'application/json' } });
            if (!r.ok) throw erreurLisible(r.status);
            data = await r.json();
        }
        auCache(url, data, ttl);
        return data;
    }

    // Un code HTTP brut ne dit rien à qui lit un manga. Ces messages-là sont
    // ce que l'utilisateur verra si la source refuse.
    function erreurLisible(statut) {
        const e = new Error(
            statut === 429 ? 'MangaDex limite les requêtes — patiente quelques secondes.'
                : statut === 503 ? 'MangaDex est momentanément indisponible.'
                    : statut === 404 ? 'Introuvable sur MangaDex.'
                        : `MangaDex a répondu ${statut}.`);
        e.network = true; e.statut = statut;
        return e;
    }

    // ── Normalisation : copie conforme du serveur ───────────
    const titre = (t) => !t ? '' : (t.en || t.fr || t['ja-ro'] || t.ja || Object.values(t)[0] || '');
    const relsDe = (rels, type) => (rels || []).filter((r) => r.type === type);
    const fichierCouv = (rels) => relsDe(rels, 'cover_art')[0]?.attributes?.fileName || null;
    const auteur = (rels) => (relsDe(rels, 'author')[0] || relsDe(rels, 'artist')[0])?.attributes?.name || '';

    function versManga(m) {
        const a = m.attributes || {};
        const couv = fichierCouv(m.relationships);
        return {
            id: m.id,
            title: titre(a.title),
            titleAlt: titre(a.altTitles?.[0]),
            author: auteur(m.relationships),
            description: titre(a.description) || '',
            status: a.status,
            year: a.year,
            contentRating: a.contentRating,
            demographic: a.publicationDemographic,
            tags: (a.tags || []).map((t) => titre(t.attributes?.name)).filter(Boolean),
            cover: couv ? `${COVERS}/${m.id}/${couv}.512.jpg` : null,
            coverLarge: couv ? `${COVERS}/${m.id}/${couv}` : null,
            coverThumb: couv ? `${COVERS}/${m.id}/${couv}.256.jpg` : null,
            rating: a.rating,
            lastChapter: a.lastChapter,
            langs: a.availableTranslatedLanguages || [],
        };
    }

    function versChapitre(c) {
        const a = c.attributes || {};
        return {
            id: c.id,
            chapter: a.chapter ? parseFloat(a.chapter) : null,
            volume: a.volume,
            title: a.title || null,
            lang: a.translatedLanguage,
            pages: a.pages || 0,
            publishedAt: a.publishAt || a.publishedAt,
            externalUrl: a.externalUrl || null,
        };
    }

    const INCLUS = ['cover_art', 'author', 'artist'];
    const RATINGS = ['safe', 'suggestive'];

    const mangadex = {
        id: 'mangadex',
        name: 'MangaDex',
        lang: 'multi',
        unit: 'chapter',
        embarquee: true,
        description: 'Interrogée directement par le téléphone, sans ordinateur.',

        async popular({ limit = 20, offset = 0 } = {}) {
            const d = await appel('/manga', {
                limit: Math.min(+limit || 20, 100), offset: +offset || 0,
                'includes[]': INCLUS, 'order[followedCount]': 'desc', 'contentRating[]': RATINGS,
            }, 600000);
            return { total: d.total, results: (d.data || []).map(versManga) };
        },

        async latest({ limit = 20, offset = 0 } = {}) {
            const d = await appel('/manga', {
                limit: Math.min(+limit || 20, 100), offset: +offset || 0,
                'includes[]': INCLUS, 'order[latestUploadedChapter]': 'desc', 'contentRating[]': RATINGS,
            }, 300000);
            return { total: d.total, results: (d.data || []).map(versManga) };
        },

        async search({ q, title, limit = 20, offset = 0 } = {}) {
            const recherche = q || title || '';
            const d = await appel('/manga', {
                title: recherche,
                limit: Math.min(+limit || 20, 100), offset: +offset || 0,
                'includes[]': INCLUS, 'contentRating[]': RATINGS,
                'order[relevance]': 'desc',
            }, 120000);
            return { total: d.total, results: (d.data || []).map(versManga) };
        },

        async get(id) {
            const d = await appel(`/manga/${encodeURIComponent(id)}`, { 'includes[]': INCLUS }, 600000);
            return versManga(d.data);
        },

        async chapters(mangaId, { lang = 'fr,en' } = {}) {
            // MangaDex pagine par 500 au maximum. Une série longue en compte
            // plus : on boucle, sinon la fin du catalogue manque en silence —
            // et c'est précisément la partie qu'on veut lire quand on revient.
            const langues = String(lang).split(',').map((s) => s.trim()).filter(Boolean);
            const out = [];
            let offset = 0;
            for (let tour = 0; tour < 10; tour++) {
                const d = await appel(`/manga/${encodeURIComponent(mangaId)}/feed`, {
                    limit: 500, offset,
                    'translatedLanguage[]': langues,
                    'order[chapter]': 'asc',
                    'contentRating[]': RATINGS,
                    includeExternalUrl: 0,
                }, 60000);
                const lot = (d.data || []).map(versChapitre);
                out.push(...lot);
                offset += 500;
                if (out.length >= (d.total || 0) || !lot.length) break;
            }
            return { total: out.length, chapters: out };
        },

        async pages(chapterId) {
            const d = await appel(`/at-home/server/${encodeURIComponent(chapterId)}`, {}, 300000);
            const hash = d.chapter?.hash;
            const fichiers = d.chapter?.data || [];
            const legers = d.chapter?.dataSaver || [];
            return {
                baseUrl: d.baseUrl,
                hash,
                pages: fichiers.map((f, i) => ({
                    page: i + 1,
                    url: `${d.baseUrl}/data/${hash}/${f}`,
                    urlSaver: legers[i] ? `${d.baseUrl}/data-saver/${hash}/${legers[i]}` : null,
                })),
            };
        },

        async tags() {
            const d = await appel('/manga/tag', {}, 24 * 3600000);
            return { tags: (d.data || []).map((t) => ({ id: t.id, name: titre(t.attributes?.name) })) };
        },
    };

    // ── Les extensions du hub, executees ici ────────────────
    //
    // `mangadex` ci-dessus est ecrite pour ce module : c'est une API JSON, et
    // la reimplementer coutait moins que de charger un fichier pour ca. Les
    // AUTRES sources scrapent du HTML — leurs fichiers sont ceux du hub, joues
    // par `extensions-navigateur.js`. Une reecriture en donnerait deux
    // versions, qui divergeraient au premier changement de mise en page.
    const parId = new Map([['mangadex', mangadex]]);
    const liste = [mangadex];

    /**
     * Adapte le contrat d'une extension a celui qu'attend `api.js`.
     *
     * Les extensions exposent `getManga` / `getChapters` / `getPages` ; le
     * routeur appelle `get` / `chapters` / `pages`. Traduire ICI evite de
     * toucher aux extensions — c'est tout l'interet de les partager.
     */
    function adapter(ext) {
        return {
            id: ext.id, name: ext.name, lang: ext.lang, unit: ext.unit || 'chapter',
            embarquee: true,
            description: ext.description || '',
            capabilities: ext.capabilities || [],
            popular: (p) => ext.popular(p),
            latest: (p) => (ext.latest ? ext.latest(p) : ext.popular(p)),
            search: (p) => ext.search({ ...p, q: p.q || p.title || '' }),
            get: (id) => ext.getManga(id),
            chapters: (id, p) => ext.getChapters(id, p).then(
                (r) => (Array.isArray(r) ? { total: r.length, chapters: r } : r)),
            pages: (id) => ext.getPages(id),
            tags: () => (ext.getTags ? ext.getTags() : Promise.resolve({ tags: [] })),
        };
    }

    /** SHA-256 d'un texte, avec l'API du navigateur. */
    async function empreinte(texte) {
        const octets = new TextEncoder().encode(texte);
        const buf = await crypto.subtle.digest('SHA-256', octets);
        return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Charge les extensions embarquees dans le paquet.
     *
     * ⚠ L'empreinte est verifiee AVANT execution, comme le fait le serveur
     * (audit S-2). C'est du code qui parle au reseau : l'executer sans
     * controle reviendrait a faire confiance a tout ce qui a pu atterrir dans
     * le paquet. Une empreinte qui ne correspond pas = extension ignoree, et
     * on le DIT plutot que de la charger « au cas ou ».
     */
    async function chargerExtensions() {
        const moteur = window.INKO_EXTENSIONS;
        if (!moteur) return { chargees: 0, refusees: [] };

        let empreintes = {};
        try {
            const r = await fetch('extensions/hashes.json');
            if (r.ok) empreintes = await r.json();
        } catch (e) {
            // Sans le fichier d'empreintes, on ne charge RIEN : mieux vaut le
            // seul MangaDex que du code non verifie.
            window.MH?.err?.('sources-embarquees.js', e);
            return { chargees: 0, refusees: ['(empreintes introuvables)'] };
        }

        const refusees = [];
        let n = 0;
        for (const id of Object.keys(empreintes)) {
            if (parId.has(id)) continue;                 // deja servie nativement
            try {
                const r = await fetch(`extensions/${id}/index.js`);
                if (!r.ok) { refusees.push(id + ' (absente)'); continue; }
                const source = await r.text();
                const vue = await empreinte(source);
                if (vue !== empreintes[id]) { refusees.push(id + ' (empreinte)'); continue; }

                const ext = adapter(moteur.charger(id, source));
                parId.set(id, ext);
                liste.push(ext);
                n++;
            } catch (e) {
                refusees.push(id + ' (' + (e.message || 'erreur') + ')');
            }
        }
        if (refusees.length) console.warn('[inko-sources] extensions ecartees :', refusees.join(', '));
        return { chargees: n, refusees };
    }

    window.INKO_SOURCES_EMBARQUEES = {
        disponible: true,
        get liste() { return liste.slice(); },
        parId: (id) => parId.get(id) || null,
        defaut: mangadex,
        chargerExtensions,
        adapter,                // exposé pour les tests
        _empreinte: empreinte,
        _cache: cache,
    };

    // Au chargement de la page : on ne bloque rien, les extensions arrivent
    // quand elles arrivent. MangaDex repond deja pendant ce temps.
    if (window.INKO_EXTENSIONS) {
        chargerExtensions().catch((e) => window.MH?.err?.('sources-embarquees.js', e));
    }
})();
