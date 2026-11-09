// server.js — point d'entrée Inko
// Garantit une base de données joignable AVANT de charger l'app :
// MySQL externe s'il répond (dev/self-host), sinon la MariaDB embarquée
// dans l'app desktop (voir lib/embedded-db.js). Indispensable pour que
// l'app marche sur un PC sans environnement de dev.
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const { ensureDatabase } = require('./lib/embedded-db');

// Audit EXT-02 : `curl` est une dépendance RUNTIME non déclarée. Cinq
// extensions (gutenberg ×2, novelbin, novelfull, sushiscan) et le proxy
// d'images l'appellent via execFile — c'est ce qui permet de contourner les
// empreintes TLS anti-bot. Le Dockerfile l'installe et Windows 10+ le fournit,
// mais rien ne le VÉRIFIAIT : sur un hôte Linux ou macOS minimal, ces sources
// échouaient avec un « spawn curl ENOENT » incompréhensible. On le dit au
// démarrage, une fois, sans bloquer (le reste de l'app fonctionne).
//
// Et il le dit SANS BLOQUER. Mesuré : `execFileSync` coûtait 44 ms sur
// 590 de démarrage — 7 % — passés à attendre un sous-processus dont la
// réponse ne sert qu'à imprimer un avertissement. Rien, au démarrage,
// n'attend ce résultat : la première extension qui appellera `curl` est
// à des secondes de là. `execFile` rend la main tout de suite et
// l'avertissement sort quand il est prêt.
(function checkCurl() {
    require('child_process').execFile('curl', ['--version'],
        { timeout: 5000, windowsHide: true }, (e) => {
            if (!e) return;
            console.warn('[deps] ⚠ `curl` est introuvable sur cette machine.');
            console.warn('       Les sources Gutenberg, NovelBin, NovelFull et SushiScan, ainsi que');
            console.warn('       le proxy d\'images, en dépendent et échoueront.');
            console.warn('       Installe-le :  apt install curl  /  brew install curl');
        });
})();

ensureDatabase()
    .then(() => require('./app'))
    .catch((e) => {
        console.error('[db] impossible de préparer la base de données :', e.message);
        process.exit(1);
    });
