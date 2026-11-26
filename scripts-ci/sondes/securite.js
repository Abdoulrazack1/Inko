// securite — failles probables par motifs statiques (candidats à trier)
'use strict';
const cp = require('child_process');
module.exports = {
    nom: 'securite',
    description: 'innerHTML non échappé, eval, SQL concaténé, secrets versionnés, CORS/cookies, commandes, redirections, npm audit',
    async run(ctx) {
        const front = [...ctx.parcourir(ctx.abs('assets', 'js'), ctx.ext('.js'))].filter(p => !/vendor|\.min\./.test(p));
        const serveur = [...ctx.parcourir(ctx.abs('server'), ctx.ext('.js'))].filter(p => !/node_modules|server\/test|server\/extensions|backups|uploads/.test(ctx.rel(p)));
        const pages = [...ctx.parcourir(ctx.racine, ctx.ext('.html'))].filter(p => ctx.rel(p).split('/').length <= 2);

        // 1. innerHTML avec interpolation non échappée
        let totalInner = 0;
        const nonEchappes = [];
        const sur = /^\s*(MH\.esc|esc|escapeHtml|MH\.escapeHtml|i18n|t|MH\.t|T|MH\.classeChiffre|MH\.fmt\w*)\(/;
        const inoffensif = /(\.length\b|Math\.|\.toFixed|\bpct\b|\bpercent\b|\bnum\b|\bindex\b|\bi\b|\bn\b|\.size\b|\.count\b|^\s*[\d.]+\s*$|^\s*['"][^'"]*['"]\s*$)/;
        for (const p of [...front, ...pages]) {
            const t = ctx.lire(p), r = ctx.rel(p);
            ctx.chercher(t, /(innerHTML|outerHTML)\s*(\+?=)\s*([^;]{0,400})/, (m, l) => {
                totalInner++;
                const interp = [...m[3].matchAll(/\$\{([^}]+)\}/g)].map(x => x[1]);
                const d = interp.filter(e => !sur.test(e) && !inoffensif.test(e));
                if (d.length) nonEchappes.push([r, l, d[0].trim().slice(0, 80)]);
            });
            ctx.chercher(t, /insertAdjacentHTML\([^,]+,\s*([^;]{0,300})/, (m, l) => {
                totalInner++;
                const interp = [...m[1].matchAll(/\$\{([^}]+)\}/g)].map(x => x[1]);
                const d = interp.filter(e => !sur.test(e) && !inoffensif.test(e));
                if (d.length) nonEchappes.push([r, l, d[0].trim().slice(0, 80)]);
            });
        }
        ctx.mesure('innerHTML_total', totalInner);
        ctx.mesure('innerHTML_interpolations_a_verifier', nonEchappes.length);
        const parFichier = {};
        nonEchappes.forEach(([f, l, e]) => (parFichier[f] = parFichier[f] || []).push([l, e]));
        for (const [f, liste] of Object.entries(parFichier)) {
            ctx.trouver({ gravite: liste.length > 8 ? 'haute' : 'moyenne', id: 'SEC-XSS-CANDIDAT', categorie: 'sécurité',
                titre: `${liste.length} injection(s) HTML à vérifier dans ${f}`, fichier: f, ligne: liste[0][0],
                detail: 'Interpolations dans innerHTML sans MH.esc visible (candidats, à confirmer à la main) :\n' + liste.slice(0, 12).map(([l, e]) => '  L' + l + ': ${' + e + '}').join('\n'),
                correctif: 'Passer chaque valeur venue du réseau ou de l\'utilisateur par MH.esc(), ou construire les nœuds avec textContent.', effort: liste.length > 8 ? 'M' : 'S' });
        }

        // 2. exécution dynamique
        for (const p of [...front, ...serveur]) {
            const t = ctx.lire(p), r = ctx.rel(p);
            if (/sources-embarquees|extensions-navigateur|loader\.js|bac-a-sable|cheerio-navigateur/.test(r)) continue;
            ctx.chercher(t, /\b(eval\s*\(|new Function\s*\(|document\.write\s*\()/, (m, l) => ctx.trouver({ gravite: 'haute', id: 'SEC-EVAL', categorie: 'sécurité',
                titre: 'Exécution dynamique de code : ' + m[1].replace(/\s*\($/, ''), fichier: r, ligne: l, correctif: 'Supprimer ou borner la provenance du code.', effort: 'S' }));
        }

        // 3. SQL par interpolation
        for (const p of serveur) {
            const t = ctx.lire(p), r = ctx.rel(p);
            ctx.chercher(t, /\.(query|execute)\(\s*(`[^`]*\$\{[^`]*`|['"][^'"]*['"]\s*\+)/, (m, l) => {
                const extrait = m[2].slice(0, 160).replace(/\n/g, ' ');
                const sain = /\$\{\s*(placeholders|ph|marks|qs|cols|set|sets|where|clauses?|order|orderBy|limit|ids\.map|fields|join|\w*(Sql|SQL|Clause|Cols|Order))\b/i.test(extrait);
                ctx.trouver({ gravite: sain ? 'basse' : 'haute', id: sain ? 'SEC-SQL-DYNAMIQUE' : 'SEC-SQL-INTERPOLE', categorie: 'sécurité',
                    titre: sain ? 'SQL construit dynamiquement (fragment de structure)' : 'SQL avec interpolation de valeur',
                    fichier: r, ligne: l, detail: extrait, correctif: 'Valeurs en paramètres ? ; liste blanche pour colonnes et ordre.', effort: 'S' });
            });
        }

        // 4. secrets versionnés
        let suivis = [];
        try { suivis = cp.execSync('git ls-files', { cwd: ctx.racine, encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n').filter(Boolean); } catch (e) { /* hors git */ }
        ctx.mesure('fichiers_suivis_git', suivis.length);
        for (const f of suivis) {
            if (/(^|\/)(\.env(\..*)?|.*\.(pem|key|p12|jks|keystore)|id_rsa|service-account.*\.json|google\.json|vapid\.json|secrets?\.json)$/i.test(f) && !/\.example$|\.sample$/.test(f)) {
                ctx.trouver({ gravite: 'critique', id: 'SEC-SECRET-VERSIONNE', categorie: 'sécurité',
                    titre: 'Fichier sensible suivi par git : ' + f, fichier: f,
                    detail: 'Un secret commité reste dans l\'historique même supprimé ensuite.',
                    correctif: 'git rm --cached, .gitignore, ROTATER la clé, purger l\'historique si elle était réelle.', effort: 'S' });
            }
        }
        const motifs = [
            [/AKIA[0-9A-Z]{16}/, 'clé AWS'], [/AIza[0-9A-Za-z_\-]{35}/, 'clé API Google'],
            [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, 'clé privée'],
            [/(?:secret|password|passwd|api[_-]?key)\s*[:=]\s*['"][A-Za-z0-9_\-\/+=]{20,}['"]/i, 'secret en dur'],
            [/ghp_[0-9A-Za-z]{36}/, 'token GitHub'], [/xox[baprs]-[0-9A-Za-z-]{10,}/, 'token Slack'],
        ];
        for (const f of suivis.filter(f => /\.(js|json|html|md|yml|yaml|gradle|kts|properties|toml|rs|sh|ps1)$/.test(f) && !/package-lock|hashes\.json|openapi\.json|\.min\.|vendor|test\//.test(f))) {
            const t = ctx.lire(ctx.abs(f));
            for (const [re, nom] of motifs) {
                const m = re.exec(t);
                if (m) ctx.trouver({ gravite: 'haute', id: 'SEC-SECRET-EN-DUR', categorie: 'sécurité', titre: 'Possible ' + nom + ' en dur',
                    fichier: f, ligne: ctx.ligneDe(t, m.index), detail: m[0].slice(0, 6) + '…(masqué)', correctif: 'Variable d\'environnement ou coffre local (secrets-locaux.js).', effort: 'S' });
            }
        }

        // 5. CORS, cookies, TLS, fuites d'erreur, commandes, redirections, aléa
        for (const p of serveur) {
            const t = ctx.lire(p), r = ctx.rel(p);
            ctx.chercher(t, /rejectUnauthorized\s*:\s*false|NODE_TLS_REJECT_UNAUTHORIZED/, (m, l) => ctx.trouver({ gravite: 'haute', id: 'SEC-TLS-DESACTIVE', categorie: 'sécurité', titre: 'Vérification TLS désactivée', fichier: r, ligne: l, correctif: 'Supprimer ; épingler le certificat si nécessaire.', effort: 'S' }));
            ctx.chercher(t, /res\.cookie\(([^)]*)\)/, (m, l) => { if (!/httpOnly/.test(m[1]) && !/sameSite/i.test(m[1])) ctx.trouver({ gravite: 'moyenne', id: 'SEC-COOKIE', categorie: 'sécurité', titre: 'Cookie sans httpOnly/sameSite visibles', fichier: r, ligne: l, detail: m[0].slice(0, 160), effort: 'S' }); });
            ctx.chercher(t, /res\.(?:status\(\d+\)\.)?(?:json|send)\(\s*\{[^}]*\b(?:e|err|error)\.(?:message|stack)/, (m, l) => ctx.trouver({ gravite: 'moyenne', id: 'SEC-FUITE-ERREUR', categorie: 'sécurité', titre: 'Message ou stack d\'exception renvoyé au client', fichier: r, ligne: l, detail: m[0].slice(0, 160), correctif: 'Journaliser côté serveur, renvoyer un message générique.', effort: 'S' }));
            ctx.chercher(t, /\b(exec|execSync)\(\s*(`[^`]*\$\{|['"][^'"]*['"]\s*\+)/, (m, l) => ctx.trouver({ gravite: 'haute', id: 'SEC-COMMANDE-INTERPOLEE', categorie: 'sécurité', titre: 'Commande shell construite par interpolation', fichier: r, ligne: l, detail: m[0].slice(0, 160), correctif: 'execFile/spawn avec tableau d\'arguments.', effort: 'S' }));
            ctx.chercher(t, /res\.redirect\(\s*req\.(query|body|params)/, (m, l) => ctx.trouver({ gravite: 'haute', id: 'SEC-REDIRECTION-OUVERTE', categorie: 'sécurité', titre: 'Redirection vers une valeur fournie par le client', fichier: r, ligne: l, correctif: 'Liste blanche de destinations.', effort: 'S' }));
            ctx.chercher(t, /Math\.random\(\)/, (m, l) => { const ligne = t.split('\n')[l - 1]; if (/token|secret|\bcode\b|otp|salt|password|nonce/i.test(ligne)) ctx.trouver({ gravite: 'moyenne', id: 'SEC-ALEA-FAIBLE', categorie: 'sécurité', titre: 'Math.random() pour une valeur sensible ?', fichier: r, ligne: l, detail: ligne.trim().slice(0, 140), correctif: 'crypto.randomBytes / randomUUID.', effort: 'S' }); });
            ctx.chercher(t, /origin\s*:\s*(true|['"]\*['"])/, (m, l) => ctx.trouver({ gravite: 'moyenne', id: 'SEC-CORS-LARGE', categorie: 'sécurité', titre: 'CORS très permissif', fichier: r, ligne: l, detail: m[0], correctif: 'Liste d\'origines explicite.', effort: 'S' }));
        }
        // 6. target=_blank sans noopener
        for (const p of [...front, ...pages]) {
            const t = ctx.lire(p), r = ctx.rel(p);
            ctx.chercher(t, /<a\b[^>]*target=["']_blank["'][^>]*>/, (m, l) => { if (!/noopener|noreferrer/.test(m[0])) ctx.trouver({ gravite: 'basse', id: 'SEC-NOOPENER', categorie: 'sécurité', titre: 'target=_blank sans rel=noopener', fichier: r, ligne: l, effort: 'S' }); });
        }
        // 7. jeton dans localStorage
        for (const p of front) {
            const t = ctx.lire(p), r = ctx.rel(p);
            ctx.chercher(t, /localStorage\.setItem\(\s*['"`][^'"`]*(token|jwt|password|passwd|secret)[^'"`]*['"`]/i, (m, l) => ctx.trouver({ gravite: 'moyenne', id: 'SEC-JETON-STOCKAGE', categorie: 'sécurité', titre: 'Jeton ou secret écrit dans localStorage (lisible par tout XSS)', fichier: r, ligne: l, detail: m[0], correctif: 'Cookie httpOnly, ou stockage natif sécurisé côté mobile.', effort: 'M' }));
        }
        // 8. npm audit (lecture seule, réseau)
        for (const dossier of ['.', 'server']) {
            try {
                const out = cp.spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['audit', '--json', '--omit=dev'], { cwd: ctx.abs(dossier), encoding: 'utf8', timeout: 60000, shell: process.platform === 'win32' });
                const j = JSON.parse(out.stdout || '{}');
                const v = j.metadata && j.metadata.vulnerabilities;
                if (v) {
                    ctx.mesure('npm_audit_' + (dossier === '.' ? 'racine' : 'serveur'), v);
                    if (v.critical || v.high) ctx.trouver({ gravite: v.critical ? 'critique' : 'haute', id: 'SEC-NPM-AUDIT', categorie: 'dépendances', titre: 'npm audit (' + dossier + ') : ' + (v.critical || 0) + ' critique(s), ' + (v.high || 0) + ' haute(s)', detail: Object.entries(j.vulnerabilities || {}).filter(([, x]) => ['high', 'critical'].includes(x.severity)).slice(0, 10).map(([n, x]) => n + ': ' + x.severity).join('\n'), correctif: 'npm audit fix ou montée de version ciblée.', effort: 'S' });
                }
            } catch (e) { ctx.mesure('npm_audit_' + dossier, 'indisponible : ' + e.message.slice(0, 80)); }
        }
    },
};
