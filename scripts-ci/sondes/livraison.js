// livraison — ce que reçoit vraiment un utilisateur : l'image Docker construite depuis un
// dépôt propre, l'application installée et ses mises à jour, et les commandes Windows du
// programme de mise à jour (rejouées sur un fichier système inoffensif).
'use strict';
const cp = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { demarrer } = require('./_jetable');
const { requete } = require('./_http');

module.exports = {
    nom: 'livraison',
    description: 'Image Docker depuis un dépôt propre, mises à jour de l\'application installée, commandes de vérification de l\'installeur',
    async run(ctx) {
        const T = (gravite, id, titre, detail, correctif, extra = {}) => ctx.trouver({ gravite, id, categorie: 'livraison', titre, detail, correctif, effort: 'S', ...extra });
        const releves = {};
        // ── 1. les deux appels PowerShell du programme de mise à jour ──
        const maj = ctx.lire(ctx.abs('server', 'controllers', 'update.controller.js'));
        const appels = [...maj.matchAll(/execFile\('powershell', \['-NoProfile', '-NonInteractive', '-Command',\s*'([^']+)',\s*'(-\w)'/g)].map(m => ({ commande: m[1], drapeau: m[2], ligne: ctx.ligneDe(maj, m.index) }));
        releves.appelsPowerShell = appels.length;
        if (process.platform === 'win32') {
            for (const a of appels) {
                const signature = /Authenticode/.test(a.commande);
                // essai inoffensif : signature d'un fichier système, ou téléchargement d'une adresse locale fermée
                const args = signature ? ['-p', path.join(process.env.WINDIR || 'C:\\Windows', 'System32', 'notepad.exe')] : ['-u', 'http://127.0.0.1:1/rien', '-o', path.join(os.tmpdir(), 'inko-sonde-rien')];
                const r = cp.spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', a.commande, ...args], { encoding: 'latin1', timeout: 60000, windowsHide: true });
                const erreur = String(r.stderr || '').replace(/\s+/g, ' ').trim();
                const syntaxe = /Jeton inattendu|Unexpected token|ParserError|ParameterAlreadyBound|ParameterBindingException|AmbiguousParameter|paramètre.*plus d'une fois/i.test(erreur);
                releves[signature ? 'verificationSignature' : 'telechargementDeSecours'] = syntaxe ? 'commande invalide' : 'commande acceptée';
                if (syntaxe) T('haute', signature ? 'LIV-SIGNATURE-CASSEE' : 'LIV-SECOURS-CASSE', signature ? 'La vérification de signature de l\'installeur échoue toujours : la commande PowerShell est invalide' : 'Le téléchargement de secours de la mise à jour est inutilisable : la commande PowerShell est invalide', `Rejouée à l'identique (update.controller.js:${a.ligne}) sur un fichier inoffensif :\n${erreur.slice(0, 400)}\n\nAvec -Command, les arguments qui suivent sont recollés au texte de la commande au lieu d'être passés au bloc param().`, 'Passer par -File avec un script .ps1, ou par des variables d\'environnement lues dans la commande ; ajouter un test sous Windows.', { fichier: 'server/controllers/update.controller.js', ligne: a.ligne });
            }
        }
        // ── 2. mises à jour de sources dans l'application installée ──
        const conf = ctx.lire(ctx.abs('desktop-tauri', 'src-tauri', 'tauri.conf.json'));
        const ext = ctx.lire(ctx.abs('server', 'controllers', 'extensions.controller.js'));
        if (/resources\/extensions-community/.test(conf) && /if \(fs\.existsSync\(local\)\)/.test(ext)) T('haute', 'LIV-SOURCES-FIGEES', 'L\'application installée ne reçoit jamais de correctif de source entre deux versions', 'L\'installeur embarque extensions-community/ ; getLatestManifest, getExpectedHashes et getLatestSource lisent ce dossier dès qu\'il existe et n\'interrogent GitHub que sinon. Le bouton « Mettre à jour » compare donc la version installée à la copie livrée avec elle. La réparation de SushiScan, par exemple, exigera une nouvelle version complète. Déduit du code et de la configuration du paquet.', 'Interroger d\'abord la dernière version publiée, ne se rabattre sur la copie livrée qu\'hors ligne.', { fichier: 'server/controllers/extensions.controller.js', effort: 'M' });
        // ── 3. l'image Docker construite depuis un dépôt propre ──
        const dockerfile = ctx.lire(ctx.abs('Dockerfile'));
        const copie = fs.mkdtempSync(path.join(os.tmpdir(), 'inko-image-'));
        try {
            const suivis = cp.spawnSync('git', ['ls-files', '-z', 'server'], { cwd: ctx.racine, encoding: 'utf8', maxBuffer: 64e6 }).stdout.split('\0').filter(Boolean);
            // les fichiers suivis par git, pris dans l'arbre de travail : ce que contiendrait un dépôt propre à jour
            const aCopier = [...suivis, ...cp.spawnSync('git', ['ls-files', '-z', '--others', '--exclude-standard', 'server'], { cwd: ctx.racine, encoding: 'utf8' }).stdout.split('\0').filter(Boolean)];
            for (const f of aCopier) { const src = ctx.abs(f); if (!fs.existsSync(src)) continue; const dst = path.join(copie, f); fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.copyFileSync(src, dst); }
            releves.dockerfileCopieSources = /COPY[^\n]*extensions-community/.test(dockerfile);
            fs.symlinkSync(ctx.abs('server', 'node_modules'), path.join(copie, 'server', 'node_modules'), 'junction');
            const propre = { ...ctx, abs: (...p) => (p[0] === 'server' ? path.join(copie, ...p) : ctx.abs(...p)), lire: ctx.lire, trouver: ctx.trouver, racine: ctx.racine };
            const J = await demarrer(propre, { base: 'inko_s_image', port: 8146, env: { FRONTEND_DIR: ctx.racine, APP_VERSION: '' } });
            if (J) try {
                const r = await J.api('GET', '/sources');
                const n = Array.isArray(r.json) ? r.json.length : -1;
                releves.sourcesDansImagePropre = n;
                if (n === 0 && !releves.dockerfileCopieSources) T('critique', 'LIV-DOCKER-SANS-SOURCE', 'L\'image Docker construite depuis un dépôt propre ne contient aucune source', `Serveur démarré avec les seuls fichiers qu'aurait un clone (server/extensions/*/ est ignoré par git) : GET /api/sources renvoie ${n} source. Le Dockerfile ne copie pas extensions-community/, d'où le serveur les installerait. Docker lui-même n'a pas été lancé : il n'est pas installé sur cette machine.`, 'COPY extensions-community/ dans l\'image et la vérifier en CI (GET /api/sources non vide).', { fichier: 'Dockerfile' });
            } finally { await J.arreter(); }
        } catch (e) { T('info', 'LIV-IMAGE-NON-EPROUVEE', 'Simulation de l\'image impossible : ' + e.message.slice(0, 120), '', ''); }
        finally { try { fs.rmSync(path.join(copie, 'server', 'node_modules'), { recursive: false, force: true }); } catch (e) { try { fs.unlinkSync(path.join(copie, 'server', 'node_modules')); } catch (x) { /* jonction */ } } if (!fs.existsSync(path.join(copie, 'server', 'node_modules'))) fs.rmSync(copie, { recursive: true, force: true }); }
        // ── 4. entrer dans un hub Docker ──
        const compose = ctx.lire(ctx.abs('docker-compose.yml'));
        if (!/LOCAL_MODE/.test(compose) && !/LOCAL_MODE=0/.test(dockerfile)) T('critique', 'LIV-DOCKER-SANS-ENTREE', 'Avec le fichier Docker fourni, personne ne peut entrer', 'docker-compose.yml ne pose pas LOCAL_MODE : la connexion automatique reste active, mais elle est réservée à la boucle locale, et une requête qui traverse le port publié arrive avec l\'adresse du pont Docker (refus 403 LOCAL_ONLY, comme rejoué depuis le réseau par securite-dyn). Avec LOCAL_MODE=0, il n\'existe aucun écran de connexion. Déduit du code ; Docker non installé sur cette machine.', 'Écran de connexion (FON-03), puis LOCAL_MODE=0 dans le fichier fourni avec création du premier compte au démarrage.', { fichier: 'docker-compose.yml', effort: 'L' });
        ctx.mesure('livraison_releves', releves);
    },
};
