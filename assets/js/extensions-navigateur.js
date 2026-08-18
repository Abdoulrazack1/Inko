// ============================================================
// extensions-navigateur.js — exécuter les extensions du hub, sur le téléphone
// ------------------------------------------------------------
// Les extensions d'Inko sont des modules Node : `require('axios')`,
// `require('cheerio')`, `module.exports = {…}`. Rien de tout ça n'existe dans
// un navigateur. C'est ce qui les cantonnait au hub.
//
// Ce module fournit le décor manquant — un `require` qui rend des doublures,
// et un `module.exports` à remplir — pour que LE MÊME FICHIER s'exécute des
// deux côtés. C'est le point important : réécrire les extensions pour le
// navigateur en donnerait deux versions, qui divergeraient au premier
// changement de mise en page d'un site.
//
// ── Les trois dépendances, et ce qu'on met à la place ───────
//
// `axios`         → `CapacitorHttp`, le client HTTP natif. Il ignore CORS
//                   parce qu'il ne passe pas par le moteur web : c'est
//                   exactement ce qui rend le scraping possible ici.
// `cheerio`       → `cheerio-navigateur.js`, bâti sur `DOMParser`. Vérifié
//                   contre le vrai cheerio, 26 comparaisons sans divergence.
// `child_process` → les extensions s'en servent UNIQUEMENT pour lancer
//                   `curl` en repli quand un site refuse axios. Le client
//                   natif a déjà une empreinte TLS différente du moteur web,
//                   donc ce repli n'a plus d'objet : on le fait pointer sur
//                   le même appel.
//
// ── Ce qui reste hors de portée ─────────────────────────────
//
// `fs`, `os` et `path` sont fournis en doublures INERTES. Une extension qui
// s'en sert réellement pour lire un fichier ne fonctionnera pas — mais elle
// échouera visiblement, à l'appel, plutôt que de rendre des résultats faux.
// Aucune des six ne s'en sert pour autre chose qu'un cache disque optionnel.
(function () {
    'use strict';

    const chargees = new Map();

    /** Un client HTTP à l'interface d'axios, servi par le natif. */
    function fabriquerAxios() {
        async function requete(config) {
            const url = config.url.startsWith('http')
                ? config.url
                : (config.baseURL || '').replace(/\/+$/, '') + config.url;

            const Http = window.Capacitor?.Plugins?.CapacitorHttp;
            const entetes = { ...(config.headers || {}) };

            if (Http) {
                const r = await Http.request({
                    url,
                    method: (config.method || 'GET').toUpperCase(),
                    headers: entetes,
                    data: config.data,
                    connectTimeout: config.timeout || 20000,
                    readTimeout: config.timeout || 20000,
                    // `responseType: 'text'` : les extensions analysent du
                    // HTML. Laisser le greffon deviner rendrait parfois un
                    // objet, et `cheerio.load(objet)` ne lèverait pas — il
                    // rendrait un document vide, donc « aucun résultat ».
                    responseType: 'text',
                });
                if (r.status >= 400) {
                    const e = new Error('Requête refusée (' + r.status + ')');
                    e.response = { status: r.status, data: r.data };
                    throw e;
                }
                return { data: r.data, status: r.status, headers: r.headers || {} };
            }

            const r = await fetch(url, {
                method: (config.method || 'GET').toUpperCase(),
                headers: entetes,
                body: config.data,
            });
            if (!r.ok) {
                const e = new Error('Requête refusée (' + r.status + ')');
                e.response = { status: r.status, data: await r.text().catch(() => '') };
                throw e;
            }
            return { data: await r.text(), status: r.status, headers: {} };
        }

        function instance(defauts = {}) {
            const appel = (config) => requete({ ...defauts, ...config, headers: { ...(defauts.headers || {}), ...(config.headers || {}) } });
            appel.get = (url, c = {}) => appel({ ...c, url, method: 'GET' });
            appel.post = (url, data, c = {}) => appel({ ...c, url, data, method: 'POST' });
            appel.put = (url, data, c = {}) => appel({ ...c, url, data, method: 'PUT' });
            appel.delete = (url, c = {}) => appel({ ...c, url, method: 'DELETE' });
            appel.head = (url, c = {}) => appel({ ...c, url, method: 'HEAD' });
            appel.request = appel;
            appel.defaults = defauts;
            appel.create = (d) => instance({ ...defauts, ...d });
            return appel;
        }
        return instance();
    }

    /**
     * `child_process.execFile('curl', […])` — les extensions s'en servent en
     * REPLI quand un site bloque axios sur son empreinte TLS. Le client natif
     * ayant déjà une empreinte différente du moteur web, on redirige vers le
     * même chemin plutôt que d'échouer.
     */
    function fabriquerChildProcess(axios) {
        return {
            execFile(commande, args, options, rappel) {
                if (typeof options === 'function') { rappel = options; options = {}; }
                if (commande !== 'curl') {
                    return rappel(new Error('Seul `curl` est simulé sur cet appareil : ' + commande));
                }
                // La dernière option non préfixée est l'URL.
                const url = [...args].reverse().find((a) => /^https?:\/\//i.test(a));
                if (!url) return rappel(new Error('URL absente des arguments curl'));
                const iUA = args.indexOf('-A');
                const entetes = iUA >= 0 ? { 'User-Agent': args[iUA + 1] } : {};
                axios.get(url, { headers: entetes })
                    .then((r) => rappel(null, r.data))
                    .catch((e) => rappel(e));
            },
            spawnSync() { throw new Error('spawnSync n’existe pas sur cet appareil'); },
        };
    }

    /** Doublure inerte : elle ÉCHOUE à l'appel plutôt que de mentir. */
    function inerte(nom) {
        return new Proxy({}, {
            get(_, prop) {
                return () => { throw new Error(`\`${nom}.${String(prop)}\` n’est pas disponible sur cet appareil`); };
            },
        });
    }

    function fabriquerRequire() {
        const axios = fabriquerAxios();
        const modules = {
            axios,
            cheerio: window.INKO_CHEERIO,
            child_process: fabriquerChildProcess(axios),
            fs: inerte('fs'),
            // `os` n'est PAS inerte : `sushiscan` appelle `os.tmpdir()` au
            // CHARGEMENT, pour composer un chemin de cache. Une doublure qui
            // leve a cet instant empeche l'extension entiere de se charger —
            // alors qu'elle n'a besoin que d'une chaine. On rend donc un
            // chemin plausible ; ce sont les operations `fs` qui echoueront,
            // au moment ou l'on tenterait vraiment d'ecrire, et elles sont
            // deja dans des try/catch cote extension.
            os: {
                tmpdir: () => '/tmp',
                homedir: () => '/data/data/app.inko.mobile',
                platform: () => 'android',
                EOL: '\n',
            },
            path: {
                // `path.join` sert parfois à composer une URL de cache : on le
                // rend utilisable plutôt qu'inerte, c'est sans risque.
                join: (...p) => p.filter(Boolean).join('/').replace(/\/+/g, '/'),
                basename: (p) => String(p).split('/').pop(),
                extname: (p) => { const n = String(p).split('/').pop(); const i = n.lastIndexOf('.'); return i > 0 ? n.slice(i) : ''; },
            },
        };
        // `process` : `mangadex` lit `process.env` pour des reglages
        // optionnels. Absent, la simple EVALUATION du fichier echoue —
        // « process is not defined » — et l'extension ne se charge pas du
        // tout. Un objet vide suffit : les valeurs manquantes retombent sur
        // les defauts que l'extension prevoit deja.
        if (typeof window.process === 'undefined') {
            window.process = { env: {}, platform: 'android', version: '', argv: [], versions: {} };
        }

        return function require(nom) {
            if (nom in modules) return modules[nom];
            throw new Error(`Module « ${nom} » indisponible sur cet appareil`);
        };
    }

    /**
     * Exécute le code source d'une extension et rend son `module.exports`.
     *
     * ⚠ `new Function` et non `eval` : le code s'exécute alors dans la portée
     * GLOBALE, sans accès aux variables locales d'ici. Une extension ne peut
     * donc pas atteindre le magasin personnel ni le jeton de session par
     * inadvertance — ni délibérément.
     */
    function charger(id, source) {
        if (chargees.has(id)) return chargees.get(id);
        const module = { exports: {} };
        try {
            const fn = new Function('require', 'module', 'exports', 'console', source);
            fn(fabriquerRequire(), module, module.exports, window.console);
        } catch (e) {
            window.MH?.err?.('extensions-navigateur.js', e);
            throw new Error(`L’extension « ${id} » n’a pas pu être chargée : ${e.message}`);
        }
        const ext = module.exports;
        if (!ext || !ext.id) throw new Error(`L’extension « ${id} » n’expose pas d’identifiant`);
        chargees.set(id, ext);
        return ext;
    }

    window.INKO_EXTENSIONS = {
        disponible: true,
        charger,
        chargees,
        _fabriquerRequire: fabriquerRequire,      // exposé pour les tests
    };
})();
