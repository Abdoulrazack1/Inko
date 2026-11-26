// coquille — l'écran de démarrage de l'application de bureau : vérifie-t-il qu'il parle bien
// à Inko avant de lui ouvrir sa fenêtre ? Où l'application range-t-elle ses données ?
'use strict';
const http = require('http');
const path = require('path');
const { pathToFileURL } = require('url');
const { lancerNavigateur } = require('./_navigateur');

module.exports = {
    nom: 'coquille',
    description: 'Écran de démarrage face à un autre programme sur le port ; emplacement des sauvegardes et fichiers',
    async run(ctx) {
        const T = (gravite, id, titre, detail, correctif, fichier, extra = {}) => ctx.trouver({ gravite, id, categorie: 'application de bureau', titre, detail, correctif, fichier, effort: 'S', ...extra });
        // ── un autre programme occupe le port d'Inko ──
        const faux = http.createServer((q, r) => { r.setHeader('access-control-allow-origin', '*'); if (q.url.startsWith('/api/health')) return r.end('{}'); r.setHeader('content-type', 'text/html; charset=utf-8'); r.end('<!doctype html><title>autre</title><h1>Ceci n\'est pas Inko</h1>'); });
        const libre = await new Promise((ok) => { faux.once('error', () => ok(false)); faux.listen(8088, '127.0.0.1', () => ok(true)); });
        if (!libre) ctx.trouver({ gravite: 'info', id: 'COQ-PORT-PRIS', titre: 'Écran de démarrage non éprouvé : le port 8088 est occupé sur cette machine' });
        else {
            const nav = await lancerNavigateur();
            try {
                const p = await nav.newPage();
                await p.route('**/*', (r) => (/^(file:|http:\/\/127\.0\.0\.1:8088\/)/.test(r.request().url()) ? r.continue() : r.abort()));
                await p.goto(pathToFileURL(ctx.abs('desktop-tauri', 'ui', 'index.html')).href);
                await p.waitForTimeout(3500);
                const vu = { adresse: p.url(), texte: await p.evaluate(() => document.body.innerText.slice(0, 80)) };
                ctx.mesure('coquille_demarrage', vu);
                const capacites = ctx.lire(ctx.abs('desktop-tauri', 'src-tauri', 'capabilities', 'default.json'));
                if (/Ceci n'est pas Inko/.test(vu.texte)) T('haute', 'COQ-AUTRE-PROGRAMME', 'Application Windows : n\'importe quel programme qui occupe le port 8088 s\'affiche dans la fenêtre d\'Inko', `L'écran de démarrage accepte toute réponse « réussie » sur /api/health (ici un corps vide « {} ») puis ouvre la page servie.${/127\.0\.0\.1:8088/.test(capacites) ? ' Les droits de fenêtre de l\'application sont accordés à tout ce qui répond à cette adresse.' : ''} Un second serveur Inko, un autre projet local ou un programme malveillant prend ainsi la place, avec son propre contenu.`, 'Vérifier une identité propre à ce lancement (jeton partagé avec le serveur démarré) avant d\'ouvrir.', 'desktop-tauri/ui/index.html', { categorie: 'sécurité' });
                if (/msSmartScreenProtection/.test(ctx.lire(ctx.abs('desktop-tauri', 'src-tauri', 'tauri.conf.json')))) T('moyenne', 'COQ-PROTECTION-DESACTIVEE', 'La protection SmartScreen du moteur d\'affichage est désactivée', '"--disable-features=…,msSmartScreenProtection" dans la configuration de la fenêtre, alors que des contenus de sites tiers y sont affichés.', 'Retirer cette désactivation, ou en écrire la raison.', 'desktop-tauri/src-tauri/tauri.conf.json', { categorie: 'sécurité' });
            } finally { await nav.close().catch(() => { }); }
            faux.closeAllConnections && faux.closeAllConnections(); faux.close();
        }
        // ── où vivent les données ──
        const lanceur = ctx.lire(ctx.abs('desktop-tauri', 'src-tauri', 'src', 'main.rs'));
        const sauvegardes = ctx.lire(ctx.abs('server', 'lib', 'backup.js'));
        const imports = ctx.lire(ctx.abs('server', 'controllers', 'local.controller.js'));
        if (!/BACKUP_DIR/.test(lanceur) && /BACKUP_DIR\s*\|\|\s*path\.join\(__dirname, '\.\.', 'backups'\)/.test(sauvegardes)) T('haute', 'COQ-DONNEES-DANS-INSTALLATION', 'Application Windows : sauvegardes et fichiers importés sont rangés dans le dossier d\'installation', 'Le lanceur ne fixe pas BACKUP_DIR : les sauvegardes vont dans resources\\server\\backups, à côté du programme (constaté sur l\'application installée)' + (/path\.join\(__dirname, '\.\.', 'uploads'\)/.test(imports) ? ', et les fichiers importés dans resources\\server\\uploads' : '') + '. Le code de la base annonce pourtant que les données de l\'utilisateur ne vivent jamais dans ce dossier. Leur sort à la désinstallation n\'a pas été éprouvé.', 'Les placer sous %APPDATA%\\Inko et déplacer l\'existant.', 'desktop-tauri/src-tauri/src/main.rs', { categorie: 'données', effort: 'M' });
        const restauration = ctx.lire(ctx.abs('server', 'scripts', 'restore-backup.js'));
        if (/IS_DESKTOP \? \(require\('\.\/secrets-locaux'\)/.test(sauvegardes) && !/secrets-locaux/.test(restauration)) T('moyenne', 'COQ-RESTAURATION-SANS-CLE', 'La restauration en ligne de commande ne sait pas lire les sauvegardes de l\'application de bureau', 'L\'application chiffre avec une phrase tirée au sort, gardée dans %APPDATA%\\Inko ; le script de restauration ne lit que la variable BACKUP_PASSPHRASE.', 'Lire la même phrase que l\'application, et expliquer comment la mettre à l\'abri.', 'server/scripts/restore-backup.js', { categorie: 'données' });
        const compose = ctx.lire(ctx.abs('docker-compose.yml'));
        const service = compose.slice(compose.indexOf('inko-app:'), compose.indexOf('\nvolumes:'));
        if (service && !/^\s{4}volumes:/m.test(service)) T('haute', 'COQ-DOCKER-SANS-VOLUME', 'Avec Docker, les fichiers importés et les sauvegardes disparaissent à chaque mise à jour', 'Le service de l\'application n\'a aucun volume : uploads, backups et config vivent dans le conteneur, remplacé par « docker compose up --build ». Déduit de la configuration (Docker absent de cette machine).', 'Monter uploads, backups et config sur des volumes.', 'docker-compose.yml', { categorie: 'données' });
    },
};
