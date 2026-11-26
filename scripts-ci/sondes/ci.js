// ci — workflows GitHub Actions : permissions, épinglage, caches, couverture des jobs
'use strict';
module.exports = {
    nom: 'ci',
    description: 'Actions non épinglées, permissions larges, secrets, caches, jobs manquants',
    async run(ctx) {
        const wf = [...ctx.parcourir(ctx.abs('.github', 'workflows'), ctx.ext('.yml', '.yaml'))];
        ctx.mesure('workflows', wf.map(p => ctx.rel(p)));
        const tout = wf.map(p => ctx.lire(p)).join('\n');
        for (const p of wf) {
            const t = ctx.lire(p), r = ctx.rel(p);
            if (!/^permissions:/m.test(t)) ctx.trouver({ gravite: 'moyenne', id: 'CI-PERMISSIONS', categorie: 'sécurité', titre: 'Workflow sans bloc permissions (jeton en écriture par défaut)', fichier: r, correctif: 'permissions: contents: read au niveau racine, élever par job.', effort: 'S' });
            ctx.chercher(t, /uses:\s*([\w.-]+\/[\w.-]+)@(v?\d[\w.]*|main|master)\b/, (m, l) => { if (!/^actions\//.test(m[1]) && !/^[0-9a-f]{40}$/.test(m[2])) ctx.trouver({ gravite: 'basse', id: 'CI-ACTION-NON-EPINGLEE', categorie: 'sécurité', titre: `Action tierce ${m[1]}@${m[2]} non épinglée par SHA`, fichier: r, ligne: l, correctif: 'Épingler au SHA complet (dependabot sait les mettre à jour).', effort: 'S' }); });
            ctx.chercher(t, /\$\{\{\s*github\.event\.(?:issue|pull_request|comment)\.(?:title|body)/, (m, l) => ctx.trouver({ gravite: 'haute', id: 'CI-INJECTION', categorie: 'sécurité', titre: 'Contenu d\'issue/PR interpolé dans un script (injection de commande)', fichier: r, ligne: l, effort: 'S' }));
            if (!/timeout-minutes/.test(t)) ctx.trouver({ gravite: 'basse', id: 'CI-TIMEOUT', categorie: 'robustesse', titre: 'Aucun timeout-minutes (un job bloqué consomme 6 h)', fichier: r, effort: 'S' });
            if (/npm (ci|install)/.test(t) && !/cache:\s*['"]?npm|actions\/cache/.test(t)) ctx.trouver({ gravite: 'basse', id: 'CI-CACHE', categorie: 'performance', titre: 'npm sans cache de dépendances', fichier: r, effort: 'S' });
        }
        const manque = [];
        if (!/npm test|npm run test|run-unit-tests/.test(tout)) manque.push('tests unitaires');
        if (!/playwright|test:e2e/.test(tout)) manque.push('tests e2e');
        if (!/eslint|npm run lint/.test(tout)) manque.push('lint');
        if (!/npm audit|codeql|dependency-review/i.test(tout)) manque.push('audit de dépendances / CodeQL');
        if (!/check-i18n/.test(tout)) manque.push('check-i18n');
        if (!/verifier-android8/.test(tout)) manque.push('garde-fou Android 8');
        if (!/gen-openapi.*--check|gen-precache.*--check|gen-meta.*--check/.test(tout)) manque.push('contrôles de dérive générés');
        for (const x of manque) ctx.trouver({ gravite: x.includes('audit') ? 'moyenne' : 'basse', id: 'CI-JOB-MANQUANT', categorie: 'ci', titre: `Pas de job CI pour : ${x}`, effort: 'S' });
        const dep = ctx.lire(ctx.abs('.github', 'dependabot.yml'));
        for (const eco of ['npm', 'github-actions', 'gradle', 'cargo', 'docker']) if (!new RegExp(`package-ecosystem:\\s*["']?${eco}`).test(dep)) ctx.trouver({ gravite: 'basse', id: 'CI-DEPENDABOT-ECOSYSTEME', categorie: 'ci', titre: `dependabot ne surveille pas « ${eco} »`, fichier: '.github/dependabot.yml', effort: 'S' });
        // lint : la portée
        const eslint = ctx.lire(ctx.abs('eslint.config.js'));
        if (!/server/.test(eslint) && !/lint.*server/.test(ctx.lire(ctx.abs('package.json')))) ctx.trouver({ gravite: 'moyenne', id: 'CI-LINT-SERVEUR', categorie: 'ci', titre: 'ESLint ne couvre que assets/js et service-worker.js : le serveur (≈10 000 lignes) n\'est pas linté', fichier: 'package.json', correctif: 'Étendre le script lint à server/ (+ règles node), en commençant par no-unused-vars et no-undef.', effort: 'M' });
    },
};
