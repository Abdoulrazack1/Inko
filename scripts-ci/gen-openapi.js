#!/usr/bin/env node
// ============================================================
// gen-openapi.js — Documentation d'API générée depuis le routeur (audit AMEL-119)
// ------------------------------------------------------------
// 96 routes, aucune référence : le README en décrivait une poignée. Une
// documentation écrite à la main diverge du code au premier ajout de route —
// c'est déjà ce qui était arrivé ici. Elle est donc DÉRIVÉE de
// `server/routes/index.js`, et la CI échoue si le fichier publié est périmé
// (même mécanique que gen-precache et gen-ext-hashes).
//
// On ne charge pas Express pour introspecter la pile : le routeur exige une
// base de données au require. On lit le SOURCE, qui est la seule chose dont on
// ait besoin — la liste des routes, leur méthode et leur middleware d'auth.
//
// Usage :
//   node scripts-ci/gen-openapi.js            # écrit server/openapi.json
//   node scripts-ci/gen-openapi.js --check    # échoue si le fichier a dérivé
// ============================================================
'use strict';

const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..');
const SOURCE = path.join(RACINE, 'server', 'routes', 'index.js');
const SORTIE = path.join(RACINE, 'server', 'openapi.json');
const CHECK = process.argv.includes('--check');

const pkg = JSON.parse(fs.readFileSync(path.join(RACINE, 'package.json'), 'utf8'));

// `router.get   ('/chemin', middleware..., Controleur.methode);`
const RE_ROUTE = /router\.(get|post|put|delete|patch)\s*\(\s*'([^']+)'\s*,?\s*([^)]*)\)/g;

// Commentaires de bloc qui precedent une route : ils portent le POURQUOI, qui
// est justement ce qu'une reference d'API ne sait jamais dire.
function commentaireAvant(src, index) {
    const avant = src.slice(0, index);
    const lignes = avant.split('\n');
    const bloc = [];
    for (let i = lignes.length - 2; i >= 0; i--) {
        const l = lignes[i].trim();
        if (l.startsWith('//')) bloc.unshift(l.replace(/^\/\/\s?/, ''));
        else break;
    }
    // Les separateurs decoratifs (── ══) ne documentent rien.
    return bloc.filter(l => !/^[─═\-= ]*$/.test(l)).join(' ').trim() || null;
}

function analyser() {
    const src = fs.readFileSync(SOURCE, 'utf8');
    const routes = [];
    let m;
    while ((m = RE_ROUTE.exec(src))) {
        const [, methode, chemin, reste] = m;
        const auth = /adminRequired/.test(reste) ? 'admin'
            : /authRequired/.test(reste) ? 'session'
                : /authOptional/.test(reste) ? 'optionnelle' : 'aucune';
        const limite = (reste.match(/(\w*Limiter)/) || [])[1] || null;
        // SEC-01 : `localOnly` restreint la route a la boucle locale. Sans
        // cette marque, la reference decrit `/auth/local` comme ouverte a
        // tous (`security: []`) — ce qui etait vrai, et ne l'est plus.
        const localeSeule = /localOnly/.test(reste);
        const handler = (reste.match(/([A-Z]\w*)\.(\w+)/) || []).slice(1).join('.') || null;
        routes.push({ methode, chemin, auth, limite, localeSeule, handler, resume: commentaireAvant(src, m.index) });
    }
    return routes;
}

// Les segments `:param` deviennent des parametres de chemin OpenAPI.
function parametres(chemin) {
    return (chemin.match(/:(\w+)/g) || []).map(p => ({
        name: p.slice(1), in: 'path', required: true, schema: { type: 'string' },
    }));
}
const versOpenApiPath = (c) => c.replace(/:(\w+)/g, '{$1}');

// Collections qui acceptent limit/offset (audit AMEL-121). Liste explicite
// plutot que devinee : marquer une route comme paginable alors qu'elle ne
// l'est pas ferait mentir la reference, ce qui est pire que de l'omettre.
const PAGINABLES = new Set(['/me/favorites', '/me/library', '/me/notifications', '/comments/:mangaId']);
const paginables = (r) => r.methode === 'get' && PAGINABLES.has(r.chemin);

function construire() {
    const routes = analyser();
    const paths = {};
    for (const r of routes) {
        const p = versOpenApiPath(r.chemin);
        paths[p] = paths[p] || {};
        paths[p][r.methode] = {
            summary: r.resume || r.handler || `${r.methode.toUpperCase()} ${r.chemin}`,
            operationId: r.handler ? r.handler.replace('.', '_') : undefined,
            tags: [r.chemin.split('/')[1] || 'racine'],
            security: r.auth === 'aucune' ? [] : [{ cookieAuth: [] }, { bearerAuth: [] }],
            // Ces deux-la ne sont pas dans le vocabulaire OpenAPI : ce sont des
            // faits du code qu'un client a besoin de connaitre, et les inventer
            // en description les rendrait illisibles a la machine.
            'x-auth': r.auth,
            'x-rate-limit': r.limite || undefined,
            // Joignable uniquement depuis la machine qui heberge le serveur.
            // Un client distant recoit 403 (code `LOCAL_ONLY`).
            'x-local-only': r.localeSeule || undefined,
            parameters: parametres(r.chemin).concat(paginables(r) ? [
                { name: 'limit', in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: 500 },
                    description: 'Taille de page. Fournir limit ou offset fait passer la reponse de tableau brut a { items, total, limit, offset } (audit AMEL-121).' },
                { name: 'offset', in: 'query', required: false, schema: { type: 'integer', minimum: 0 } },
            ] : []),
            responses: {
                200: { description: 'Succès' },
                ...(r.auth !== 'aucune' ? { 401: { description: 'Non authentifié' } } : {}),
                ...(r.auth === 'admin' ? { 403: { description: 'Réservé à l’administrateur' } } : {}),
            },
        };
    }
    return {
        openapi: '3.0.3',
        info: {
            title: 'API Inko',
            version: pkg.version || '0.0.0',
            description: 'Référence générée depuis server/routes/index.js. '
                + 'Ne pas éditer à la main : régénérer avec `npm run gen-openapi`.',
        },
        servers: [
            { url: '/api/v1', description: 'Version figée — à utiliser depuis un client tiers' },
            { url: '/api', description: 'Alias non versionné — suit toujours la dernière version' },
        ],
        components: {
            securitySchemes: {
                cookieAuth: { type: 'apiKey', in: 'cookie', name: 'inko_token' },
                bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
            },
        },
        paths,
    };
}

const spec = construire();
const json = JSON.stringify(spec, null, 2) + '\n';
const nb = Object.values(spec.paths).reduce((n, o) => n + Object.keys(o).length, 0);

if (CHECK) {
    // Comparaison a fins de ligne NORMALISEES. Git convertit en CRLF a la
    // sortie sur Windows : compare octet a octet, ce controle echouait dans
    // tout clone Windows alors que le contenu etait identique — un controle
    // qui echoue sans raison est un controle qu'on desactive.
    const nl = (v) => String(v).split(String.fromCharCode(13) + String.fromCharCode(10)).join(String.fromCharCode(10));
    const actuel = fs.existsSync(SORTIE) ? fs.readFileSync(SORTIE, 'utf8') : '';
    if (nl(actuel) !== nl(json)) {
        console.error('::error::server/openapi.json a dérivé du routeur.');
        console.error("Lance 'npm run gen-openapi' et committe le résultat.");
        process.exit(1);
    }
    console.log(`Référence d'API à jour — ${nb} opération(s).`);
} else {
    fs.writeFileSync(SORTIE, json, 'utf8');
    console.log(`✔ server/openapi.json : ${nb} opération(s) sur ${Object.keys(spec.paths).length} chemin(s)`);
}
