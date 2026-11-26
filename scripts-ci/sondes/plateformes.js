// plateformes — Android (manifest, Capacitor), Tauri (CSP, capacités), Docker
'use strict';
module.exports = {
    nom: 'plateformes',
    description: 'AndroidManifest, capacitor.config, tauri.conf (CSP, permissions), Dockerfile, Caddyfile',
    async run(ctx) {
        const man = ctx.lire(ctx.abs('android/app/src/main/AndroidManifest.xml'));
        if (man) {
            if (/allowBackup=["']true/.test(man)) ctx.trouver({ gravite: 'moyenne', id: 'PLT-ALLOWBACKUP', categorie: 'sécurité', titre: 'android:allowBackup="true" : les données de l\'app (jeton de session, miroir de bibliothèque) partent dans les sauvegardes Google', fichier: 'android/app/src/main/AndroidManifest.xml', correctif: 'allowBackup="false" ou règles dataExtractionRules excluant le stockage de session.', effort: 'S' });
            if (/usesCleartextTraffic=["']true/.test(man)) ctx.trouver({ gravite: 'basse', id: 'PLT-CLEARTEXT', categorie: 'sécurité', titre: 'Trafic HTTP en clair autorisé (usesCleartextTraffic)', fichier: 'android/app/src/main/AndroidManifest.xml', detail: 'Nécessaire pour parler au hub local en HTTP ; à restreindre par network-security-config aux plages privées.', correctif: 'network_security_config.xml : cleartext limité à 192.168.x / 10.x / .local.', effort: 'M' });
            const perms = [...man.matchAll(/uses-permission[^>]*name=["']([^"']+)/g)].map(m => m[1]);
            ctx.mesure('android_permissions', perms);
            for (const p of perms) if (/READ_EXTERNAL_STORAGE|WRITE_EXTERNAL_STORAGE|MANAGE_EXTERNAL|ACCESS_FINE_LOCATION|READ_CONTACTS|RECORD_AUDIO|CAMERA/.test(p)) ctx.trouver({ gravite: 'basse', id: 'PLT-PERMISSION-SENSIBLE', categorie: 'confidentialité', titre: `Permission sensible : ${p}`, fichier: 'android/app/src/main/AndroidManifest.xml', correctif: 'Vérifier la nécessité réelle ; Play Console et la page confidentialité doivent la justifier.', effort: 'S' });
            ctx.chercher(man, /<(activity|service|receiver|provider)\b[^>]*>/, (m, l) => { if (!/android:exported/.test(m[0])) ctx.trouver({ gravite: 'haute', id: 'PLT-EXPORTED-MANQUANT', categorie: 'sécurité', titre: `<${m[1]}> sans android:exported (refusé dès Android 12)`, fichier: 'android/app/src/main/AndroidManifest.xml', ligne: l, effort: 'S' }); });
        }
        const g = ctx.lire(ctx.abs('android/variables.gradle'));
        const sdk = { min: +(/minSdkVersion\s*=\s*(\d+)/.exec(g) || [])[1], target: +(/targetSdkVersion\s*=\s*(\d+)/.exec(g) || [])[1], compile: +(/compileSdkVersion\s*=\s*(\d+)/.exec(g) || [])[1] };
        ctx.mesure('android_sdk', sdk);
        if (sdk.target && sdk.target < 35) ctx.trouver({ gravite: 'moyenne', id: 'PLT-TARGET-SDK', categorie: 'plateforme', titre: `targetSdkVersion ${sdk.target} : Google Play exige le niveau 35 pour les nouvelles publications`, fichier: 'android/variables.gradle', correctif: 'Monter à 35 ; tester l\'edge-to-edge (insets) — déjà sensible sur cette app.', effort: 'M' });
        // Capacitor
        const cap = (() => { try { return JSON.parse(ctx.lire(ctx.abs('capacitor.config.json'))); } catch (e) { return {}; } })();
        if (cap.android && cap.android.allowMixedContent) ctx.trouver({ gravite: 'basse', id: 'PLT-MIXED-CONTENT', categorie: 'sécurité', titre: 'Capacitor allowMixedContent: true', fichier: 'capacitor.config.json', correctif: 'Utile pour les couvertures http:// ; passer par le proxy d\'images du hub (https non requis) et retirer.', effort: 'M' });
        // Tauri
        let conf = {}; try { conf = JSON.parse(ctx.lire(ctx.abs('desktop-tauri/src-tauri/tauri.conf.json'))); } catch (e) { /* absent */ }
        const csp = JSON.stringify((conf.app && conf.app.security && conf.app.security.csp) || (conf.tauri && conf.tauri.security && conf.tauri.security.csp) || '');
        ctx.mesure('tauri_csp', csp.slice(0, 400));
        if (!csp || csp === '""' || csp === 'null') ctx.trouver({ gravite: 'haute', id: 'PLT-TAURI-CSP-ABSENTE', categorie: 'sécurité', titre: 'Aucune CSP configurée pour la fenêtre Tauri', fichier: 'desktop-tauri/src-tauri/tauri.conf.json', correctif: 'default-src \'self\' http://localhost:* ; img-src \'self\' data: blob: http://localhost:*.', effort: 'S' });
        else if (/unsafe-eval/.test(csp)) ctx.trouver({ gravite: 'moyenne', id: 'PLT-TAURI-UNSAFE-EVAL', categorie: 'sécurité', titre: 'CSP Tauri avec unsafe-eval', fichier: 'desktop-tauri/src-tauri/tauri.conf.json', effort: 'M' });
        // CSP du serveur
        const sec = ctx.lire(ctx.abs('server', 'middleware', 'security.js'));
        const unsafeInline = (sec.match(/unsafe-inline/g) || []).length;
        ctx.mesure('csp_serveur_unsafe_inline', unsafeInline);
        if (unsafeInline) ctx.trouver({ gravite: 'moyenne', id: 'PLT-CSP-UNSAFE-INLINE', categorie: 'sécurité', titre: `CSP du serveur : 'unsafe-inline' présent ${unsafeInline}×`, fichier: 'server/middleware/security.js', detail: 'Il annule l\'essentiel de la protection contre le XSS.', correctif: 'Sortir les <script> inline des pages (ou nonce/hash par page) ; les 26 pages ont des blocs inline.', effort: 'L' });
        // Docker
        const dk = ctx.lire(ctx.abs('Dockerfile'));
        if (dk) {
            if (!/^USER\s+(?!root)/m.test(dk)) ctx.trouver({ gravite: 'moyenne', id: 'PLT-DOCKER-ROOT', categorie: 'sécurité', titre: 'Conteneur exécuté en root (pas de USER)', fichier: 'Dockerfile', effort: 'S' });
            if (!/HEALTHCHECK/.test(dk)) ctx.trouver({ gravite: 'basse', id: 'PLT-DOCKER-HEALTHCHECK', categorie: 'robustesse', titre: 'Dockerfile sans HEALTHCHECK', fichier: 'Dockerfile', effort: 'S' });
            if (/FROM\s+node:\d+(?!\.)/.test(dk) && !/@sha256/.test(dk)) ctx.trouver({ gravite: 'basse', id: 'PLT-DOCKER-TAG-FLOTTANT', categorie: 'reproductibilité', titre: 'Image de base non épinglée (tag flottant)', fichier: 'Dockerfile', effort: 'S' });
        }
        // service worker
        const sw = ctx.lire(ctx.abs('service-worker.js'));
        if (!/skipWaiting|clients\.claim/.test(sw)) ctx.trouver({ gravite: 'basse', id: 'PLT-SW-ACTIVATION', categorie: 'robustesse', titre: 'Service worker sans stratégie d\'activation explicite', fichier: 'service-worker.js', effort: 'S' });
        if (/ignoreSearch:\s*true/.test(sw)) ctx.trouver({ gravite: 'info', id: 'PLT-SW-IGNORESEARCH', categorie: 'robustesse', titre: 'SW : ignoreSearch:true (déjà connu : peut rejouer d\'anciennes réponses de /api)', fichier: 'service-worker.js', effort: 'S' });
        const nCache = /CACHE(?:_NAME|_VERSION)?\s*=\s*['"`]([^'"`]+)/.exec(sw);
        ctx.mesure('sw_cache', nCache && nCache[1]);
    },
};
