// exposition — qui peut atteindre le serveur sans y être invité : par un relais installé sur
// la même machine (proxy, tunnel, Tailscale), par un nom de domaine qui pointe chez vous
// (« DNS rebinding »), ou depuis une page d'un autre port du même hôte (requêtes forgées).
'use strict';
const http = require('http');
const os = require('os');
const { demarrer } = require('./_jetable');
const { requete } = require('./_http');
const { lancerNavigateur } = require('./_navigateur');

const PORT = 8160, RELAIS = 8161, TIERS = 8162;

module.exports = {
    nom: 'exposition',
    description: 'Relais sur la même machine, en-tête d\'hôte non vérifié, requêtes forgées depuis un autre port',
    async run(ctx) {
        const T = (gravite, id, titre, detail, correctif, extra = {}) => ctx.trouver({ gravite, id, categorie: 'sécurité', titre, detail, correctif, effort: 'S', ...extra });
        const J = await demarrer(ctx, { base: 'inko_s_expo', port: PORT });
        if (!J) return;
        let relais, tiers, nav;
        const releves = {};
        try {
            const reseau = Object.values(os.networkInterfaces()).flat().find(i => i && i.family === 'IPv4' && !i.internal);
            // ── 1. un relais tout à fait ordinaire, sur la même machine ──
            relais = http.createServer((q, r) => {
                const h = { ...q.headers, 'x-forwarded-for': q.socket.remoteAddress, 'x-forwarded-proto': 'http' };
                const s = http.request({ host: '127.0.0.1', port: PORT, path: q.url, method: q.method, headers: h }, (x) => { r.writeHead(x.statusCode, x.headers); x.pipe(r); });
                s.on('error', () => { r.statusCode = 502; r.end(); }); q.pipe(s);
            });
            await new Promise(ok => relais.listen(RELAIS, '0.0.0.0', ok));
            if (reseau) {
                const direct = await requete(`http://${reseau.address}:${PORT}`, '/api/auth/local', { methode: 'POST', corps: {} });
                const via = await requete(`http://${reseau.address}:${RELAIS}`, '/api/auth/local', { methode: 'POST', corps: {} });
                const jeton = via.json && via.json.token;
                const moi = jeton ? await requete(`http://${reseau.address}:${RELAIS}`, '/api/auth/me', { jeton }) : null;
                releves.relais = { direct: direct.statut, parRelais: via.statut, role: moi && moi.json && moi.json.user && moi.json.user.role };
                if (jeton) T('critique', 'EXP-RELAIS-ADMIN', 'Derrière un relais installé sur la même machine, n\'importe qui devient administrateur sans mot de passe', `Depuis l'adresse réseau, en direct : HTTP ${direct.statut}. Par un relais installé sur la même machine (Caddy, nginx, tunnel…), même s'il transmet X-Forwarded-For : HTTP ${via.statut}, jeton ${releves.relais.role} sans mot de passe. Sans TRUST_PROXY, le serveur ne voit que la boucle locale et ignore l'en-tête. (La configuration Docker fournie pose TRUST_PROXY : elle n'est pas concernée.)`, 'Refuser la connexion automatique dès qu\'une requête porte un en-tête de relais non local.', { fichier: 'server/lib/reseau.js' });
            } else releves.relais = 'aucune interface réseau';
            // ── 2. le serveur accepte n'importe quel nom d'hôte ──
            const etranger = { host: `piege.exemple.test:${PORT}`, origin: `http://piege.exemple.test:${PORT}` };
            const page = await requete(J.url, '/accueil.html', { entetes: { host: etranger.host } });
            const auto = await requete(J.url, '/api/auth/local', { methode: 'POST', corps: {}, entetes: etranger });
            const oubli = await requete(J.url, '/api/auth/forgot', { methode: 'POST', corps: { email: 'owner@inko.local' }, entetes: etranger });
            releves.hote = { page: page.statut, connexionAuto: auto.statut, jetonDeReinitialisation: !!(oubli.json && oubli.json.token) };
            if (oubli.json && oubli.json.token) T('haute', 'EXP-REBINDING', 'Le serveur répond à n\'importe quel nom d\'hôte et rend alors le jeton de réinitialisation : un site visité pourrait prendre le compte', `Requête locale annonçant l'hôte et l'origine « piege.exemple.test » : page servie (HTTP ${page.statut}), connexion automatique refusée (HTTP ${auto.statut}), mais /api/auth/forgot rend le jeton. Un site dont le nom de domaine est redirigé vers 127.0.0.1 devient « la même origine » et lit la réponse. Non éprouvé contre la protection d'accès au réseau local de chaque navigateur.`, 'N\'accepter que les noms d\'hôte attendus et ne jamais rendre ce jeton à une origine inconnue.', { fichier: 'server/controllers/auth.controller.js' });
            // ── 3. une page d'un autre port du même hôte ──
            await J.api('POST', '/me/favorites', { mangaId: 'csrf-1', source: 'mangadex', title: 'Série' });
            await J.api('PUT', '/me/progress/csrf-1', { chapterId: 'c7', chapter: 7, page: 3, source: 'mangadex' });
            await J.api('POST', '/me/read-chapters', { mangaId: 'csrf-1', chapterId: 'c6', chapter: 6 });
            const compter = async () => (await J.sql('SELECT (SELECT COUNT(*) FROM progress) AS positions, (SELECT COUNT(*) FROM read_chapters) AS lus, (SELECT COUNT(*) FROM events) AS activite'))[0];
            const avant = await compter();
            tiers = http.createServer((q, r) => { r.setHeader('content-type', 'text/html; charset=utf-8'); r.end(`<!doctype html><form id="f" method="post" action="http://127.0.0.1:${PORT}/api/me/clear-history" target="cible"></form><iframe name="cible"></iframe><script>document.getElementById('f').submit()</script>`); });
            await new Promise(ok => tiers.listen(TIERS, '127.0.0.1', ok));
            nav = await lancerNavigateur();
            const c = await nav.newContext({ serviceWorkers: 'block' });
            await c.route('**/*', (r) => (/^http:\/\/127\.0\.0\.1:81(60|62)\//.test(r.request().url()) ? r.continue() : r.abort()));
            const p = await c.newPage();
            await p.goto(J.url + '/accueil.html'); await p.waitForTimeout(3500);
            const cookie = (await c.cookies(J.url)).find(k => k.name === 'inko_token');
            await p.goto(`http://127.0.0.1:${TIERS}/`); await p.waitForTimeout(2500);
            const apres = await compter();
            releves.autrePort = { cookie: !!cookie, avant, apres };
            if (Number(apres.lus) < Number(avant.lus) || Number(apres.positions) < Number(avant.positions)) T('haute', 'EXP-REQUETE-FORGEE', 'Une page d\'un autre port du même hôte peut effacer tout l\'historique de lecture', `Après une simple visite d'Inko, la page d'un autre serveur local envoie un formulaire vide à /api/me/clear-history : positions ${avant.positions} → ${apres.positions}, chapitres lus ${avant.lus} → ${apres.lus}, activité ${avant.activite} → ${apres.activite}. Le cookie « SameSite=Lax » accompagne la requête (les ports ne comptent pas), l'origine n'est pas vérifiée, et un corps absent signifie « tout effacer ».`, 'Exiger un corps JSON ou un en-tête propre à l\'application sur toute écriture authentifiée par cookie ; exiger une confirmation dans la requête.', { fichier: 'server/controllers/user.controller.js' });
            await c.close();
            ctx.mesure('exposition_releves', releves);
        } finally {
            if (nav) await nav.close().catch(() => { });
            for (const s of [relais, tiers]) if (s) { s.closeAllConnections && s.closeAllConnections(); s.close(); }
            await J.arreter();
        }
    },
};
