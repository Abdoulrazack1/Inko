// Inventaire EXHAUSTIF : que demande chaque page, et que survit-il sans PC ?
//
// On ne devine pas. Pour chaque page du paquet mobile, on relève tous les
// appels `API.<famille>.<methode>(...)` de ses scripts, puis on confronte
// chacun au routeur de `api.js` : servi par le moteur embarqué, ou refusé.
const fs = require('fs');
const path = require('path');
const R = 'C:/laragon/www/Inko';

const COMMUNS = new Set(['global', 'i18n', 'pwa', 'eula', 'api', 'hub', 'natif',
    'theme', 'feuille', 'une-main', 'tirer-rafraichir', 'storage', 'userdata',
    'sources-embarquees', 'telecommande', 'lecteur-gestes', 'lecteur-curseur',
    'cartes-gestes', 'card-hover']);

// Ce que le moteur embarqué sait servir (lu dans api.js, pas supposé).
const api = fs.readFileSync(path.join(R, 'assets/js/api.js'), 'utf8');
const routeur = /async function viaSourcesEmbarquees[\s\S]*?\n    \}\n/.exec(api)[0];

// Les méthodes de API.mangas / API.sources et le chemin qu'elles appellent.
const chemins = new Map();
for (const m of api.matchAll(/^\s{12}([a-zA-Z]+):\s*\(([^)]*)\)\s*=>\s*(?:get|post|put|del)\(([^;]+?)\)(?:\.then|,|$)/gm)) {
    chemins.set(m[1], m[3].replace(/\s+/g, ' ').slice(0, 90));
}

function servi(famille, methode) {
    if (famille === 'mangas') {
        const table = {
            popular: 'popular', latest: 'latest', search: 'search', searchAll: '/search-all',
            popularFor: 'popular', searchFor: 'search', tags: 'tags',
            get: 'fiche', getFrom: 'fiche',
            chapters: 'chapters', chaptersFor: 'chapters', pages: 'pages',
        };
        const cle = table[methode];
        if (!cle) return 'inconnu';
        if (cle === 'fiche') return routeur.includes('src.get(') ? 'oui' : 'non';
        return routeur.includes(cle) ? 'oui' : 'non';
    }
    if (famille === 'sources') return routeur.includes("'/sources'") ? 'oui' : 'partiel';

    // Le magasin local repond aux chemins /me/* : on lit les `case` qu'il
    // traite reellement, plutot que de supposer.
    if (famille === 'me') {
        const moi = fs.readFileSync(path.join(R, 'assets/js/moi-local.js'), 'utf8');
        const cas = [...moi.matchAll(/case '([a-z-]+)':/g)].map((m) => m[1]);
        const table = {
            favorites:'favorites', addFavorite:'favorites', removeFavorite:'favorites', setCategory:'favorites',
            progress:'progress', setProgress:'progress', removeProgress:'progress', progressHistory:'progress',
            readChapters:'read-chapters', markChapter:'read-chapters', markChaptersBulk:'read-chapters',
            unmarkChaptersBulk:'read-chapters',
            notes:'notes', notesStats:'notes', addNote:'notes', updateNote:'notes', removeNote:'notes',
            lists:'lists', createList:'lists', updateList:'lists', deleteList:'lists',
            addToList:'lists', removeFromList:'lists', reorderList:'lists',
            library:'library', setLibrary:'library',
            bookmarks:'bookmarks', addBookmark:'bookmarks', removeBookmark:'bookmarks',
            settings:'settings', saveSettings:'settings',
            anilistLinks:'anilist-links', saveAnilistLinks:'anilist-links',
            events:'events', stats:'stats', distribution:'stats', myRatings:'ratings',
            updates:'updates', clearHistory:'clear-history',
            exportData:'export', importData:'import',
        };
        const cle = table[methode];
        return cle && cas.includes(cle) ? 'oui' : 'non';
    }
    return 'non';         // auth, devices, local, anilist, migrate, admin…
}

const pages = fs.readdirSync(R).filter((f) => f.endsWith('.html')).sort();
const parPage = [];
const manquantes = new Map();

for (const page of pages) {
    const html = fs.readFileSync(path.join(R, page), 'utf8');
    const scripts = [...html.matchAll(/<script src="assets\/js\/([a-z0-9-]+)\.js"/g)]
        .map((m) => m[1]).filter((n) => !COMMUNS.has(n));

    const appels = new Set();
    for (const s of scripts) {
        const p = path.join(R, 'assets/js', s + '.js');
        if (!fs.existsSync(p)) continue;
        const code = fs.readFileSync(p, 'utf8');
        for (const m of code.matchAll(/\bAPI\.([a-zA-Z]+)\.([a-zA-Z]+)\s*\(/g)) {
            if (m[2] === 'current' || m[1] === 'sources' && m[2] === 'current') continue;
            appels.add(m[1] + '.' + m[2]);
        }
    }
    const detail = [...appels].sort().map((a) => {
        const [f, me] = a.split('.');
        const etat = servi(f, me);
        if (etat !== 'oui') {
            if (!manquantes.has(a)) manquantes.set(a, new Set());
            manquantes.get(a).add(page);
        }
        return { appel: a, etat };
    });
    parPage.push({ page, total: detail.length, ok: detail.filter((d) => d.etat === 'oui').length, detail });
}

console.log('PAGE'.padEnd(24) + 'APPELS  SANS PC  ETAT');
console.log('-'.repeat(70));
for (const p of parPage) {
    const casse = p.total - p.ok;
    const etat = p.total === 0 ? 'autonome (aucun appel)'
        : p.ok === p.total ? 'FONCTIONNE seule'
            : p.ok === 0 ? 'INUTILISABLE sans PC'
                : 'partielle (' + casse + ' appel(s) en echec)';
    console.log(p.page.padEnd(24) + String(p.total).padStart(4) + String(p.ok).padStart(8) + '   ' + etat);
}

console.log('\n\nAPPELS NON SERVIS SANS PC (par frequence)');
console.log('-'.repeat(70));
const tri = [...manquantes].sort((a, b) => b[1].size - a[1].size);
for (const [appel, pagesQui] of tri) {
    console.log('  ' + appel.padEnd(30) + pagesQui.size + ' page(s) : ' + [...pagesQui].slice(0, 4).join(', '));
}
console.log('\n' + tri.length + ' methodes d API a couvrir pour une app vraiment autonome.');
