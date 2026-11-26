// api-acces — la porte est-elle fermée ? (sans session, fichiers sensibles, en-têtes, CORS, corps malformés)
'use strict';
const { requete, routesDuServeur } = require('./_http');

module.exports = {
    nom: 'api-acces',
    description: 'Balayage sans authentification, fichiers sensibles, en-têtes de sécurité, CORS, corps malformés/énormes',
    async run(ctx) {
        const base = process.env.INKO_URL || 'http://localhost:8088';
        const sante = await requete(base, '/api/health');
        if (sante.erreur) { ctx.trouver({ gravite: 'info', id: 'ACCES-SKIP', titre: 'Serveur injoignable : sonde d\'accès ignorée' }); return; }

        // 1. chaque route déclarée « session/admin » doit refuser un appel anonyme
        const routes = routesDuServeur(ctx).filter(r => r.auth === 'session' || r.auth === 'admin');
        let testees = 0, ouvertes = 0, fuites = 0;
        const verdicts = [];
        for (const r of routes) {
            const chemin = '/api' + r.chemin.replace(/:\w+/g, 'x');
            const rep = await requete(base, chemin, { methode: r.methode, corps: r.methode === 'GET' || r.methode === 'DELETE' ? undefined : {}, delaiMs: 8000 });
            testees++;
            verdicts.push(`${r.methode} ${r.chemin} → ${rep.statut || rep.erreur}`);
            if (rep.statut && rep.statut < 400) { ouvertes++; ctx.trouver({ gravite: 'critique', id: 'ACCES-ROUTE-OUVERTE', categorie: 'sécurité', titre: `${r.methode} ${r.chemin} répond ${rep.statut} SANS session alors qu'elle est déclarée protégée`, fichier: 'server/routes/index.js', ligne: r.ligne, detail: String(rep.texte).slice(0, 200), correctif: 'Vérifier que le middleware est bien monté sur cette route et sur son préfixe /api/v1.', effort: 'S' }); }
            if (rep.texte && /at\s+\S+\s+\(.*:\d+:\d+\)|node_modules|C:\\\\|\/usr\/|ER_[A-Z_]+|SQLSTATE/.test(rep.texte)) { fuites++; ctx.trouver({ gravite: 'moyenne', id: 'ACCES-FUITE-TECHNIQUE', categorie: 'sécurité', titre: `${r.methode} ${r.chemin} : la réponse d'erreur expose du détail technique (chemin, SQL ou pile)`, detail: rep.texte.slice(0, 220), correctif: 'errorHandler : message générique + identifiant de corrélation, détail au journal seulement.', effort: 'S' }); }
        }
        ctx.mesure('acces_anonyme', { routes_protegees_testees: testees, ouvertes, fuites_techniques: fuites });

        // 2. fichiers qui ne doivent JAMAIS sortir
        const sensibles = ['/.env', '/server/.env', '/server/config/google.json', '/server/config/vapid.json', '/server/config/secret.key', '/server/backups/', '/server/uploads/', '/.git/config', '/package.json', '/server/package.json', '/node_modules/.package-lock.json', '/%2e%2e/%2e%2e/windows/win.ini', '/..%5c..%5cserver%5c.env', '/server%2f.env', '/SERVER/.ENV', '/server\\.env', '/docs/audit/sondes.json', '/AUDIT-INKO-2026-07-28.md', '/Dockerfile', '/scripts-ci/gen-openapi.js', '/test/unit/api.test.js'];
        const exposes = [];
        for (const p of sensibles) {
            const rep = await requete(base, p);
            const ct = (rep.entetes && rep.entetes['content-type']) || '';
            const estHtmlAccueil = /text\/html/.test(ct) && /<title>/i.test(rep.texte || '') && !/\.(json|md|js|key|env)$/.test(p) === false;
            if (rep.statut === 200 && !/text\/html/.test(ct)) exposes.push(`${p} → 200 ${ct}`);
        }
        ctx.mesure('fichiers_sensibles_testes', sensibles.length);
        for (const e of exposes) {
            const critique = /\.env|secret|vapid|google|backups|\.git/.test(e);
            ctx.trouver({ gravite: critique ? 'critique' : 'moyenne', id: 'ACCES-FICHIER-EXPOSE', categorie: 'sécurité', titre: `Fichier servi publiquement : ${e}`, correctif: 'BLOCKED_DIRS étendu à tout ce qui n\'est pas assets/ + pages (liste blanche plutôt que liste noire) ; ne servir qu\'un dossier public dédié.', effort: 'S' });
        }
        const autresExposes = ['/package.json', '/Dockerfile', '/scripts-ci/gen-openapi.js', '/test/unit/api.test.js', '/AUDIT-INKO-2026-07-28.md'].filter(p => exposes.some(e => e.startsWith(p)));
        if (autresExposes.length) ctx.trouver({ gravite: 'basse', id: 'ACCES-DEPOT-SERVI', categorie: 'sécurité', titre: 'Le serveur sert la racine du dépôt entière (code, tests, docs d\'audit)', detail: autresExposes.join('\n'), correctif: 'Liste blanche : pages *.html, assets/, manifest, service-worker.js uniquement.', effort: 'S' });

        // 3. en-têtes de sécurité
        const accueil = await requete(base, '/');
        const h = accueil.entetes || {};
        const attendus = { 'content-security-policy': 'CSP', 'x-content-type-options': 'nosniff', 'referrer-policy': 'Referrer-Policy', 'strict-transport-security': 'HSTS (inutile en http local)', 'x-frame-options': 'anti-clickjacking (ou frame-ancestors)', 'permissions-policy': 'Permissions-Policy', 'cross-origin-opener-policy': 'COOP' };
        const manquants = Object.entries(attendus).filter(([k]) => !h[k] && !(k === 'x-frame-options' && /frame-ancestors/.test(h['content-security-policy'] || '')) && k !== 'strict-transport-security').map(([, v]) => v);
        ctx.mesure('entetes_reponse_accueil', Object.keys(h));
        if (manquants.length) ctx.trouver({ gravite: 'basse', id: 'ACCES-ENTETES', categorie: 'sécurité', titre: `En-têtes de sécurité absents sur la page d'accueil : ${manquants.join(', ')}`, effort: 'S' });
        if (h['x-powered-by']) ctx.trouver({ gravite: 'basse', id: 'ACCES-X-POWERED-BY', categorie: 'sécurité', titre: 'X-Powered-By révèle Express', correctif: 'helmet() le retire normalement : vérifier l\'ordre des middlewares.', effort: 'S' });
        if (!h['content-encoding'] && Number(h['content-length'] || 0) > 2000) ctx.trouver({ gravite: 'basse', id: 'ACCES-SANS-COMPRESSION', categorie: 'performance', titre: 'Page d\'accueil servie sans compression malgré compression() (à vérifier avec Accept-Encoding)', effort: 'S' });
        const comp = await requete(base, '/assets/js/global.js', { entetes: { 'accept-encoding': 'gzip, br' } });
        ctx.mesure('global_js_compression', { encodage: comp.entetes && comp.entetes['content-encoding'], octets_recus: comp.octets, cache: comp.entetes && comp.entetes['cache-control'], etag: !!(comp.entetes && comp.entetes.etag) });

        // 4. CORS : une origine étrangère ne doit rien obtenir
        const cors = await requete(base, '/api/sources', { entetes: { origin: 'https://evil.example' } });
        const acao = cors.entetes && cors.entetes['access-control-allow-origin'];
        ctx.mesure('cors_origine_etrangere', acao || 'refusée');
        if (acao === '*' || acao === 'https://evil.example') ctx.trouver({ gravite: 'haute', id: 'ACCES-CORS-OUVERT', categorie: 'sécurité', titre: `CORS autorise une origine étrangère (${acao})`, correctif: 'Liste blanche (CORS_ORIGINS) ; jamais de réflexion de l\'Origin avec credentials.', effort: 'S' });
        const pre = await requete(base, '/api/me/favorites', { methode: 'OPTIONS', entetes: { origin: 'https://evil.example', 'access-control-request-method': 'DELETE' } });
        if (pre.entetes && /evil\.example|\*/.test(pre.entetes['access-control-allow-origin'] || '')) ctx.trouver({ gravite: 'haute', id: 'ACCES-CORS-PREFLIGHT', categorie: 'sécurité', titre: 'Le preflight CORS accepte une origine étrangère pour DELETE', effort: 'S' });

        // 5. corps malformés et énormes
        const json = await requete(base, '/api/auth/login', { methode: 'POST', brut: '{"email":', entetes: { 'content-type': 'application/json' } });
        ctx.mesure('json_invalide_statut', json.statut);
        if (json.statut >= 500) ctx.trouver({ gravite: 'moyenne', id: 'ACCES-JSON-INVALIDE-500', categorie: 'robustesse', titre: `JSON invalide → ${json.statut} (attendu 400)`, detail: String(json.texte).slice(0, 200), effort: 'S' });
        if (/SyntaxError|at JSON\.parse|node_modules/.test(json.texte || '')) ctx.trouver({ gravite: 'basse', id: 'ACCES-JSON-INVALIDE-FUITE', categorie: 'sécurité', titre: 'Le message d\'erreur de JSON invalide expose la pile', detail: json.texte.slice(0, 200), effort: 'S' });
        const gros = await requete(base, '/api/auth/login', { methode: 'POST', brut: '{"email":"' + 'a'.repeat(13 * 1024 * 1024) + '"}', delaiMs: 20000 });
        ctx.mesure('corps_13mo_login', gros.statut || gros.erreur);
        if (gros.statut && gros.statut !== 413) ctx.trouver({ gravite: 'moyenne', id: 'ACCES-CORPS-GEANT', categorie: 'robustesse', titre: `Un corps de 13 Mo sur /auth/login n'est pas refusé en 413 (${gros.statut})`, correctif: 'Plafond par route : 100 ko par défaut, 12 Mo seulement pour l\'import.', effort: 'S' });
        const moyen = await requete(base, '/api/auth/login', { methode: 'POST', brut: '{"email":"' + 'a'.repeat(2 * 1024 * 1024) + '","password":"x"}', delaiMs: 20000 });
        ctx.mesure('corps_2mo_login', moyen.statut || moyen.erreur);
        if (moyen.statut && moyen.statut !== 413 && moyen.statut !== 400 && moyen.statut !== 401) ctx.trouver({ gravite: 'basse', id: 'ACCES-CORPS-2MO', categorie: 'robustesse', titre: `Corps de 2 Mo accepté et traité sur /auth/login (${moyen.statut})`, effort: 'S' });

        // 6. injection basique dans un paramètre de chemin / requête
        for (const p of ["/api/manga/search?q=' OR 1=1 --", '/api/sources/<script>', '/api/users/profile/../../etc/passwd', '/api/img?url=file:///C:/Windows/win.ini', '/api/img?url=http://127.0.0.1:3306', '/api/img?url=http://169.254.169.254/latest/meta-data/']) {
            const rep = await requete(base, p);
            if (rep.statut >= 500 || (rep.texte && /root:|\[extensions\]|ami-id/.test(rep.texte))) ctx.trouver({ gravite: rep.statut >= 500 ? 'moyenne' : 'critique', id: 'ACCES-ENTREE-HOSTILE', categorie: 'sécurité', titre: `Entrée hostile « ${p} » → ${rep.statut}`, detail: String(rep.texte).slice(0, 160), correctif: 'Valider au bord ; le proxy d\'images doit refuser file:, boucle locale et métadonnées cloud (SSRF).', effort: 'S' });
        }
        // Le limiteur de débit se teste sur le serveur JETABLE (flux-ecriture) :
        // 40 connexions ratées verrouilleraient authLimiter, que /auth/local
        // partage, et l'app réelle ne pourrait plus s'authentifier.
    },
};
