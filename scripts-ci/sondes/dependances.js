// dependances — dérive de versions, paquets périmés, engines, doublons
'use strict';
const cp = require('child_process');
module.exports = {
    nom: 'dependances',
    description: 'Versions divergentes entre manifestes, npm outdated, engines, dépendances non utilisées',
    async run(ctx) {
        const J = (f) => { try { return JSON.parse(ctx.lire(ctx.abs(f))); } catch (e) { return null; } };
        const racine = J('package.json'), serveur = J('server/package.json'), tauri = J('desktop-tauri/package.json');
        const tconf = (() => { try { return JSON.parse(ctx.lire(ctx.abs('desktop-tauri/src-tauri/tauri.conf.json'))); } catch (e) { return null; } })();
        const cargo = ctx.lire(ctx.abs('desktop-tauri/src-tauri/Cargo.toml'));
        const versions = { racine: racine && racine.version, serveur: serveur && serveur.version, tauri_package: tauri && tauri.version, tauri_conf: tconf && tconf.version, cargo: (/^version\s*=\s*"([^"]+)"/m.exec(cargo) || [])[1], mobile: racine && racine.versionMobile };
        ctx.mesure('versions', versions);
        const attendue = versions.racine;
        for (const [k, v] of Object.entries(versions)) {
            if (k === 'mobile' || !v || v === attendue) continue;
            ctx.trouver({ gravite: 'moyenne', id: 'DEP-VERSION-DERIVE', categorie: 'versions', titre: `Version ${k} = ${v} alors que la racine est en ${attendue}`, fichier: k === 'serveur' ? 'server/package.json' : undefined,
                detail: 'Le serveur annonce sa version dans /api/health et dans les journaux : une valeur périmée trompe le diagnostic.', correctif: 'Aligner (le script de release devrait l\'imposer).', effort: 'S', _corrigeable: 'versions' });
        }
        // engines incohérents
        if (serveur && serveur.engines && serveur.engines.node && racine.engines && racine.engines.node !== serveur.engines.node)
            ctx.trouver({ gravite: 'basse', id: 'DEP-ENGINES-DIVERGENT', categorie: 'versions', titre: `engines.node : racine ${racine.engines.node} / serveur ${serveur.engines.node}`, fichier: 'server/package.json', correctif: 'Le serveur embarque Node 22 ; imposer >=22.22.2 partout.', effort: 'S' });
        // dépendances jamais requises
        for (const [nom, pkg, dossier] of [['racine', racine, 'assets'], ['serveur', serveur, 'server']]) {
            if (!pkg) continue;
            const src = [...ctx.parcourir(ctx.abs(dossier), ctx.ext('.js'))].filter(p => !/node_modules|vendor|\.min\./.test(p)).map(p => ctx.lire(p)).join('\n') + (nom === 'racine' ? [...ctx.parcourir(ctx.abs('scripts-ci'), ctx.ext('.js'))].map(p => ctx.lire(p)).join('\n') + ctx.lire(ctx.abs('eslint.config.js')) + ctx.lire(ctx.abs('playwright.config.js')) : '');
            for (const d of Object.keys({ ...(pkg.dependencies || {}) })) {
                if (!new RegExp(`['"\`/]${d.replace(/[/@.]/g, (c) => '\\' + c)}['"\`/]`).test(src) && !src.includes(d)) ctx.trouver({ gravite: 'basse', id: 'DEP-INUTILISEE', categorie: 'dépendances', titre: `Dépendance « ${d} » (${nom}) jamais requise`, fichier: nom === 'serveur' ? 'server/package.json' : 'package.json', correctif: 'npm uninstall — poids d\'installeur et surface d\'attaque.', effort: 'S' });
            }
        }
        // npm outdated (réseau, lecture seule)
        for (const dossier of ['.', 'server']) {
            try {
                const r = cp.spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['outdated', '--json'], { cwd: ctx.abs(dossier), encoding: 'utf8', timeout: 60000, shell: process.platform === 'win32' });
                const j = JSON.parse(r.stdout || '{}');
                const majeures = Object.entries(j).filter(([, x]) => x.current && x.latest && x.current.split('.')[0] !== x.latest.split('.')[0]);
                ctx.mesure('npm_outdated_' + (dossier === '.' ? 'racine' : 'serveur'), { total: Object.keys(j).length, majeures: majeures.length });
                if (majeures.length) ctx.trouver({ gravite: 'basse', id: 'DEP-MAJEURES', categorie: 'dépendances', titre: `${majeures.length} dépendance(s) en retard d'une version majeure (${dossier})`, detail: majeures.map(([n, x]) => `${n}: ${x.current} → ${x.latest}`).join('\n'), correctif: 'dependabot gère les mineures ; planifier les majeures une à une avec la suite de tests.', effort: 'M' });
            } catch (e) { ctx.mesure('npm_outdated_' + dossier, 'indisponible'); }
        }
        // Rust / Gradle
        const gradle = ctx.lire(ctx.abs('android/app/build.gradle'));
        const vc = /versionCode\s+(\d+)/.exec(gradle), vn = /versionName\s+["']([^"']+)/.exec(gradle);
        ctx.mesure('android', { versionCode: vc && +vc[1], versionName: vn && vn[1] });
        if (racine && vn && vn[1] !== racine.versionMobile) ctx.trouver({ gravite: 'moyenne', id: 'DEP-ANDROID-VERSION', categorie: 'versions', titre: `build.gradle versionName=${vn[1]} ≠ package.json versionMobile=${racine.versionMobile}`, fichier: 'android/app/build.gradle', effort: 'S' });
        if (vc && racine && +vc[1] !== racine.versionCodeMobile) ctx.trouver({ gravite: 'moyenne', id: 'DEP-ANDROID-CODE', categorie: 'versions', titre: `build.gradle versionCode=${vc[1]} ≠ versionCodeMobile=${racine.versionCodeMobile}`, fichier: 'android/app/build.gradle', effort: 'S' });
        // lockfile
        for (const d of ['.', 'server', 'desktop-tauri']) { try { require('fs').statSync(ctx.abs(d, 'package-lock.json')); } catch (e) { ctx.trouver({ gravite: 'moyenne', id: 'DEP-PAS-DE-LOCK', categorie: 'dépendances', titre: `Pas de package-lock.json dans ${d}`, effort: 'S' }); } }
    },
};
