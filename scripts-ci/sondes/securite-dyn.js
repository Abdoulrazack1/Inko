// securite-dyn — attaques réellement jouées contre un serveur jetable : prise de compte,
// isolement entre comptes, jetons, rôles, relais d'images, saisies de mauvais type.
'use strict';
const os = require('os');
const crypto = require('crypto');
const { demarrer } = require('./_jetable');
const { requete, routesDuServeur } = require('./_http');

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const forger = (corps, secret, alg = 'HS256') => { const t = b64({ alg, typ: 'JWT' }) + '.' + b64(corps); return t + '.' + (alg === 'none' ? '' : crypto.createHmac('sha256', secret).update(t).digest('base64url')); };
const adresseReseau = () => (Object.values(os.networkInterfaces()).flat().find(i => i && i.family === 'IPv4' && !i.internal && !i.address.startsWith('169.254')) || {}).address;
const MDP = () => 'Zq7!' + crypto.randomBytes(9).toString('base64url');

module.exports = {
    nom: 'securite-dyn',
    description: 'Attaques jouées : prise de compte, isolement entre comptes, jetons forgés, rôles, SSRF, saisies de mauvais type',
    async run(ctx) {
        const T = (gravite, id, titre, detail, correctif, extra = {}) => ctx.trouver({ gravite, id, categorie: 'sécurité', titre, detail, correctif, effort: 'S', ...extra });
        const essais = [];
        const essai = (nom, ok, info = '') => essais.push({ nom, ok, info: String(info).slice(0, 120) });

        // ══ A. Installation « bureau » : mode local, pas de NODE_ENV=production ══
        const avant = process.env.APP_VERSION; process.env.APP_VERSION = process.env.APP_VERSION || '2.9.0';
        let J = await demarrer(ctx, { base: 'inko_s_sec_a', port: 8097 + 2 });
        if (avant === undefined) delete process.env.APP_VERSION;
        if (J) try {
            const lan = adresseReseau();
            if (lan) {
                const B = J.url.replace('127.0.0.1', lan);
                const a = await requete(B, '/api/auth/local', { methode: 'POST', corps: {} });
                essai('connexion automatique refusée depuis le réseau', a.statut === 403, a.statut);
                if (a.statut === 200) T('critique', 'SD-LOCAL-RESEAU', 'La connexion sans mot de passe répond depuis le réseau', `POST /api/auth/local depuis l'adresse réseau → ${a.statut}`, 'Restaurer le garde localOnly.');
                const f = await requete(B, '/api/auth/forgot', { methode: 'POST', corps: { email: 'owner@inko.local' } });
                let prise = false, etapes = [`POST /api/auth/forgot (depuis le réseau) → ${f.statut}, jeton dans la réponse : ${!!(f.json && f.json.token)}`];
                if (f.json && f.json.token) {
                    const mdp = MDP();
                    const r = await requete(B, '/api/auth/reset', { methode: 'POST', corps: { email: 'owner@inko.local', token: f.json.token, newPassword: mdp } });
                    const l = await requete(B, '/api/auth/login', { methode: 'POST', corps: { email: 'owner@inko.local', password: mdp } });
                    const adm = l.json && l.json.token ? await requete(B, '/api/admin/users', { jeton: l.json.token }) : { statut: 0 };
                    etapes.push(`POST /api/auth/reset → ${r.statut}`, `POST /api/auth/login → ${l.statut}, rôle ${l.json && l.json.user && l.json.user.role}`, `GET /api/admin/users → ${adm.statut}`);
                    prise = adm.statut === 200;
                }
                essai('réinitialisation de mot de passe impossible depuis le réseau', !prise, etapes[0]);
                if (prise) T('critique', 'SD-PRISE-DE-COMPTE', 'Tout appareil du réseau local peut prendre le compte propriétaire (administrateur)', etapes.join('\n') + '\n\nAdresse utilisée : owner@inko.local, l\'adresse par défaut du compte propriétaire, lisible dans le code source.\nCause : auth.controller.js requestReset renvoie le jeton dans la réponse dès que NODE_ENV n\'est pas « production » et qu\'aucun serveur mail n\'est configuré. C\'est le cas de l\'application de bureau (lanceur Tauri sans NODE_ENV) et d\'une installation depuis les sources (.env.example : NODE_ENV=development). Le serveur écoute sur toutes les interfaces.', 'Ne renvoyer le jeton qu\'à la boucle locale (estLocale + origine admise), sinon répondre 503. Ajouter le test.', { fichier: 'server/controllers/auth.controller.js' });
                let bloque = 0; for (let i = 0; i < 60; i++) { const r = await requete(B, '/api/auth/login', { methode: 'POST', corps: { email: 'owner@inko.local', password: 'faux' + i } }); if (r.statut === 429) { bloque = i + 1; break; } }
                essai('force brute freinée depuis le réseau', !!bloque, bloque ? '429 au ' + bloque + 'e essai' : 'aucun 429 en 60 essais');
                ctx.mesure('securite_limite_connexion', bloque || 'aucune en 60 essais');
                if (!bloque) T('haute', 'SD-FORCE-BRUTE', 'La connexion n’est pas freinée depuis le réseau', '60 essais sans 429.', 'authLimiter plus strict par adresse et par compte.');
            } else T('info', 'SD-SANS-RESEAU', 'Aucune interface réseau : scénarios « depuis le réseau » non joués', '', '');
        } finally { await J.arreter(); }

        // ══ B. Instance à plusieurs comptes ══
        J = await demarrer(ctx, { base: 'inko_s_sec_b', port: 8100, local: false });
        if (!J) return;
        try {
            const B = J.url;
            const appel = (jeton, methode, chemin, corps, extra = {}) => requete(B, '/api' + chemin, { methode, corps, jeton, ...extra });
            const creer = async (pseudo) => { const mdp = MDP(), email = pseudo.toLowerCase() + '@exemple.test'; const r = await appel(null, 'POST', '/auth/register', { username: pseudo, email, password: mdp }); return { email, mdp, jeton: r.json && r.json.token, id: r.json && r.json.user && r.json.user.id, statut: r.statut }; };
            const A = await creer('Alice'), Bo = await creer('Bruno');
            if (!A.jeton || !Bo.jeton) return T('info', 'SD-INSCRIPTION', `Inscription impossible (${A.statut}) : isolement non joué`, '', '');
            T('basse', 'SD-INSCRIPTION-OUVERTE', 'L\'inscription est ouverte à tous sur une instance partagée, sans réglage pour la fermer', 'POST /api/auth/register accepté sans invitation.', 'Variable REGISTRATION=closed|invite et codes d\'invitation.');

            // ── ce que possède Alice ──
            const j = A.jeton;
            await appel(j, 'POST', '/me/favorites', { mangaId: 'a-1', source: 'mangadex', title: 'Secret d\'Alice' });
            const liste = (await appel(j, 'POST', '/me/lists', { name: 'Privée', isPublic: false })).json || {};
            const lid = liste.id;
            await appel(j, 'POST', `/me/lists/${lid}/items`, { mangaId: 'a-1', source: 'mangadex', title: 'x' });
            await appel(j, 'POST', '/me/notes', { mangaId: 'a-1', mangaTitle: 'x', body: 'note privée' });
            await appel(j, 'POST', '/comments/a-1', { text: 'commentaire privé', visibility: 'private' });
            await appel(j, 'PUT', '/me/progress/a-1', { chapterId: 'c1', chapter: 3, page: 2, source: 'mangadex' });
            const [note] = await J.sql('SELECT id FROM reading_notes WHERE user_id = ?', [A.id]);
            const [com] = await J.sql('SELECT id FROM comments WHERE user_id = ?', [A.id]);
            const [sess] = await J.sql('SELECT id FROM sessions WHERE user_id = ? LIMIT 1', [A.id]);
            const empreinte = async () => JSON.stringify(await Promise.all(['favorites', 'lists', 'reading_notes', 'comments', 'progress', 'sessions'].map(async t => { try { return (await J.sql(`SELECT * FROM ${t} WHERE user_id = ?`, [A.id])).map(r => { delete r.last_seen_at; return r; }); } catch (e) { return t; } })));
            const e0 = await empreinte();
            const k = Bo.jeton;
            const tentatives = [
                ['lire la liste privée', 'GET', `/lists/${lid}`],
                ['renommer la liste', 'PUT', `/me/lists/${lid}`, { name: 'volée' }],
                ['rendre la liste publique', 'PUT', `/me/lists/${lid}`, { isPublic: true }],
                ['ajouter à la liste', 'POST', `/me/lists/${lid}/items`, { mangaId: 'b-1' }],
                ['retirer de la liste', 'DELETE', `/me/lists/${lid}/items/a-1`],
                ['réordonner la liste', 'PUT', `/me/lists/${lid}/order`, { mangaIds: ['a-1'] }],
                ['supprimer la liste', 'DELETE', `/me/lists/${lid}`],
                ['modifier la note', 'PUT', `/me/notes/${note && note.id}`, { body: 'volée' }],
                ['supprimer la note', 'DELETE', `/me/notes/${note && note.id}`],
                ['supprimer le commentaire', 'DELETE', `/comments/${com && com.id}`],
                ['fermer la session', 'DELETE', `/auth/sessions/${sess && sess.id}`],
                ['retirer le favori', 'DELETE', '/me/favorites/a-1'],
                ['effacer la progression', 'DELETE', '/me/progress/a-1'],
                ['retirer l\'appareil 1', 'DELETE', '/devices/1'],
                ['annuler la migration 1', 'POST', '/me/migrate/1/annuler', {}],
            ];
            for (const [nom, m, c, corps] of tentatives) {
                const r = await appel(k, m, c, corps);
                const fuite = m === 'GET' && r.statut === 200;
                essai('Bruno ne peut pas ' + nom, !fuite, r.statut);
                if (fuite) T('haute', 'SD-IDOR-LECTURE', `Un autre compte peut ${nom} d'autrui`, `${m} /api${c} → ${r.statut}`, 'Filtrer par user_id.');
                if (r.statut >= 500) T('moyenne', 'SD-5XX', `${m} ${c} répond ${r.statut}`, r.texte.slice(0, 200), 'Valider puis répondre 4xx.');
            }
            const e1 = await empreinte();
            essai('les données d\'Alice sont intactes après les tentatives', e0 === e1);
            if (e0 !== e1) T('critique', 'SD-IDOR-ECRITURE', 'Un compte a modifié les données d\'un autre', 'Empreinte des tables différente avant et après.', 'Filtrer chaque écriture par user_id.');
            const vue = await appel(k, 'GET', '/comments/a-1');
            const voit = /commentaire privé/.test(vue.texte), anon = await appel(null, 'GET', '/comments/a-1');
            essai('commentaire privé invisible pour les autres', !voit && !/commentaire privé/.test(anon.texte));
            if (voit || /commentaire privé/.test(anon.texte)) T('haute', 'SD-COMMENTAIRE-PRIVE', 'Un commentaire « privé » est lisible par un autre', vue.texte.slice(0, 200), 'Filtrer sur visibility et user_id.');
            const profil = await appel(null, 'GET', '/users/profile/Alice');
            if (profil.statut === 200) { const fuite = (profil.texte.match(/alice@exemple\.test|Secret d.Alice|note privée|password|"ip"/g) || []); essai('profil public sans donnée privée', !fuite.some(x => /@|note|password|ip/.test(x))); if (fuite.some(x => /@|note|password|ip/.test(x))) T('haute', 'SD-PROFIL-FUITE', 'Le profil public expose une donnée privée', fuite.join(', '), 'Liste blanche des champs.'); if (fuite.some(x => /Secret/.test(x))) T('moyenne', 'SD-PROFIL-BIBLIOTHEQUE', 'La bibliothèque est visible sur le profil public par défaut, sans réglage de confidentialité visible', 'GET /api/users/profile/Alice (anonyme) renvoie les titres suivis.', 'Profil privé par défaut, réglage explicite.'); }

            // ── rôles ──
            for (const [m, c, corps] of [['GET', '/admin/stats'], ['GET', '/admin/users'], ['PUT', `/admin/users/${A.id}/role`, { role: 'admin' }], ['PUT', `/admin/users/${A.id}/ban`, { banned: true }], ['GET', '/admin/reports'], ['POST', '/admin/reports/1/resolve', {}], ['POST', '/extensions/update', {}], ['POST', '/extensions/mangadex/uninstall', {}], ['POST', '/extensions/mangadex/reinstall', {}], ['POST', '/app/update', {}], ['GET', '/auth/google-config'], ['PUT', '/auth/google-config', { clientId: '' }], ['PUT', '/anilist/config', { clientId: '' }]]) {
                if (c === '/app/update' || /google-config|anilist\/config/.test(c) && m === 'PUT') {
                    // jamais jouées (effets sur la machine) : on vérifie seulement le refus sans session
                    const r = await appel(null, m, c, corps); essai(`${m} ${c} exige une session`, r.statut === 401 || r.statut === 403, r.statut);
                    if (![401, 403].includes(r.statut)) T('haute', 'SD-SANS-SESSION', `${m} /api${c} répond sans session`, String(r.statut), 'authRequired + adminRequired.');
                    T('haute', 'SD-ROLE-CONFIG', `${m} /api${c} n'exige qu'une session, pas le rôle administrateur`, 'Lu dans routes/index.js : authRequired sans adminRequired sur une route qui agit sur toute l\'instance.', 'Ajouter adminRequired.', { fichier: 'server/routes/index.js' });
                    continue;
                }
                const r = await appel(k, m, c, corps); const ok = r.statut === 403 || r.statut === 401;
                essai(`compte ordinaire refusé : ${m} ${c}`, ok, r.statut);
                if (!ok && r.statut < 300 && !(m === 'GET' && /google-config/.test(c))) T('haute', 'SD-ROLE', `Un compte ordinaire obtient ${r.statut} sur ${m} /api${c}`, r.texte.slice(0, 160), 'adminRequired.');
            }

            // ── jetons ──
            const decod = JSON.parse(Buffer.from(Bo.jeton.split('.')[1], 'base64url'));
            const faux = { 'alg none': forger({ ...decod, uid: A.id }, '', 'none'), 'secret « change-me »': forger({ ...decod, uid: A.id }, 'change-me'), 'identifiant modifié, signature gardée': Bo.jeton.split('.')[0] + '.' + b64({ ...decod, uid: A.id }) + '.' + Bo.jeton.split('.')[2], 'jeton tronqué': Bo.jeton.slice(0, -6), 'vide': 'x.y.z' };
            for (const [nom, t] of Object.entries(faux)) { const r = await appel(t, 'GET', '/auth/me'); essai('jeton refusé : ' + nom, r.statut === 401, r.statut); if (r.statut === 200) T('critique', 'SD-JETON', `Jeton accepté : ${nom}`, r.texte.slice(0, 120), 'Vérifier signature et algorithme.'); }
            const devinable = forger({ uid: A.id, email: A.email, tv: 0 }, 'inko-dev-secret-change-me');
            const rd = await appel(devinable, 'GET', '/auth/me');
            essai('secret de repli public refusé', rd.statut !== 200, rd.statut);
            if (rd.statut === 200) T('critique', 'SD-JETON-SECRET-PUBLIC', 'Un jeton signé avec le secret écrit dans le code source est accepté', 'JWT_SECRET faible → repli « inko-dev-secret-change-me » (lib/secret.js) hors production et hors bureau. Jeton forgé sans « jti » : accepté sans session.', 'Secret tiré au sort et conservé dans tous les cas ; refuser les jetons sans jti.', { fichier: 'server/lib/secret.js' });
            const sansJti = forger({ ...decod, jti: undefined }, process.env.JWT_SECRET || 'inko-dev-secret-change-me');
            const rj = await appel(sansJti, 'GET', '/auth/me');
            if (rj.statut === 200) T('moyenne', 'SD-JETON-SANS-SESSION', 'Un jeton sans identifiant de session est accepté et ne peut pas être révoqué', 'Compatibilité d\'avant la migration 16 (middleware/auth.js).', 'Mettre fin à la tolérance : tout jeton sans jti est refusé.', { fichier: 'server/middleware/auth.js' });
            // déconnexion
            const l2 = await appel(null, 'POST', '/auth/login', { email: Bo.email, password: Bo.mdp });
            const t2 = l2.json && l2.json.token;
            await appel(t2, 'POST', '/auth/logout', {});
            const apres = await appel(t2, 'GET', '/auth/me');
            essai('le jeton ne vaut plus rien après déconnexion', apres.statut === 401, apres.statut);
            if (apres.statut === 200) T('haute', 'SD-DECONNEXION', 'Se déconnecter ne ferme pas la session : le jeton reste valable 30 jours', 'POST /api/auth/logout efface seulement le cookie ; le même jeton obtient toujours 200 sur /api/auth/me.', 'logout : supprimer la ligne sessions du jti présenté.', { fichier: 'server/controllers/auth.controller.js' });
            // changement de mot de passe
            const nouveau = MDP();
            const ch = await appel(Bo.jeton, 'PUT', '/auth/password', { currentPassword: Bo.mdp, newPassword: nouveau });
            const vieux = await appel(Bo.jeton, 'GET', '/auth/me'); essai('ancien jeton refusé après changement de mot de passe', ch.statut === 200 && vieux.statut === 401, `${ch.statut}/${vieux.statut}`);
            if (ch.statut === 200 && vieux.statut === 200) T('haute', 'SD-REVOCATION', 'Changer de mot de passe ne ferme pas les anciennes sessions', '', 'revokeTokens.');
            if (ch.json && ch.json.token) Bo.jeton = ch.json.token;
            // énumération
            const ex = await appel(null, 'POST', '/auth/register', { username: 'Autre', email: A.email, password: MDP() });
            if (ex.statut === 409) T('basse', 'SD-ENUMERATION', 'L\'inscription révèle si une adresse a un compte', '409 « Un compte existe déjà avec cet email ».', 'Message neutre sur une instance exposée.');
            const reset = await appel(null, 'POST', '/auth/forgot', { email: A.email });
            const resetInc = await appel(null, 'POST', '/auth/forgot', { email: 'personne@exemple.test' });
            if (reset.json && reset.json.token && !(resetInc.json && resetInc.json.token)) T('critique', 'SD-RESET-JETON', 'La réinitialisation rend le jeton dans la réponse sur une instance partagée sans NODE_ENV=production', 'N\'importe qui connaissant une adresse prend le compte. La différence de réponse révèle en plus les adresses inscrites.', 'Ne jamais rendre le jeton à un client distant.', { fichier: 'server/controllers/auth.controller.js' });

            // ── relais d'images (SSRF) ──
            const cibles = ['http://127.0.0.1:8100/api/health', 'http://localhost/', 'http://[::1]/', 'http://[::ffff:7f00:1]/', 'http://0.0.0.0/', 'http://2130706433/', 'http://0x7f000001/', 'http://127.1/', 'http://017700000001/', 'http://169.254.169.254/latest/meta-data/', 'http://[::ffff:a9fe:a9fe]/', 'http://192.168.1.1/', 'http://10.0.0.1/', 'http://user:pw@127.0.0.1/', 'http://mangadex.org@127.0.0.1/', 'http://127.0.0.1#@mangadex.org/', 'http://mangadex.org.evil.test/x.jpg', 'file:///etc/passwd', 'gopher://127.0.0.1/', 'ftp://mangadex.org/', '//mangadex.org/x', 'http://[fd00::1]/', 'http://[fe80::1]/'];
            for (const u of cibles) { const r = await requete(B, '/api/img?u=' + encodeURIComponent(u), { delaiMs: 8000 }); const ok = r.statut >= 400; essai('relais refuse ' + u, ok, r.statut); if (!ok) T('critique', 'SD-SSRF', `Le relais d'images atteint ${u}`, `${r.statut}`, 'Refuser avant tout appel.'); }
            const double = await requete(B, '/api/img?u=http://a.test/&u=http://b.test/', { delaiMs: 5000 });
            if (double.statut >= 500) T('moyenne', 'SD-IMG-TABLEAU', `/api/img avec deux paramètres u répond ${double.statut}`, '', 'Exiger une chaîne.');
            const src = ctx.lire(ctx.abs('server', 'controllers', 'image.controller.js'));
            if (/'-L'/.test(src) && !/--proto-redir|max-redirs', '0'|redirect_url/.test(src)) T('haute', 'SD-SSRF-REDIRECTION', 'Le relais d\'images suit les redirections sans revérifier la destination', 'curl -L --max-redirs 4 : seul le premier hôte passe par hostAllowed et resolveSafeHost. Un domaine autorisé qui redirige (redirection ouverte, CDN compromis) fait atteindre une adresse interne. Vérifié à la main sur la fonction de téléchargement (redirection vers 127.0.0.1 suivie) ; la sonde le constate dans le code.', 'Suivre les redirections à la main en revalidant chaque saut, ou --max-redirs 0 puis boucle.', { fichier: 'server/controllers/image.controller.js', ligne: ctx.ligneDe(src, src.indexOf("'-L'")) });

            // ── saisies de mauvais type sur chaque route d'écriture ──
            const l3 = await appel(null, 'POST', '/auth/login', { email: Bo.email, password: nouveau });
            const jf = (l3.json && l3.json.token) || Bo.jeton;
            const routes = ((await routesDuServeur(ctx)) || []).filter(r => /post|put|delete|patch/i.test(r.methode || r.method || ''));
            const EXCLUES = /app\/update|google-config|anilist\/config|extensions\/update|extensions\/:id\/(uninstall|reinstall)|auth\/(logout|delete|password|sessions)|bac-a-sable|updates\/scan|reparer-couvertures|migrate\/candidats/;
            const champs = ['mangaId', 'chapterId', 'source', 'title', 'cover', 'name', 'description', 'isPublic', 'rules', 'text', 'body', 'rating', 'status', 'category', 'chapter', 'chapters', 'page', 'totalPages', 'mangaIds', 'ids', 'email', 'password', 'username', 'avatar', 'token', 'newPassword', 'credential', 'clientId', 'minutes', 'seconds', 'from', 'to', 'files', 'data', 'favorites', 'settings', 'label', 'note', 'mood', 'kind', 'reason', 'role', 'banned', 'subscription', 'endpoint', 'code', 'nom', 'visibility', 'parentId', 'spoiler', 'enabled', 'prefs', 'links', 'confirm', 'lot', 'clientAt', 'mangaTitle', 'chapterNum'];
            const plein = (v) => Object.fromEntries(champs.map(c => [c, v]));
            const charges = { 'corps vide': {}, 'tableau': [1, 2], 'tout en nombre': plein(12345), 'tout en objet': plein({ a: { b: 1 } }), 'tout en tableau': plein(['x', 'y']), 'tout en booléen': plein(true), 'tout à null': plein(null), 'chaînes énormes': plein('A'.repeat(70000)), 'nombres extrêmes': plein(1e308), 'négatifs': plein(-1), 'prototype': JSON.parse('{"__proto__":{"admin":true},"constructor":{"prototype":{"x":1}},"mangaId":"__proto__"}'), 'caractères nuls et emoji': plein('\u0000\uD800😀‮') };
            const casses = new Map(); let n = 0;
            for (const r of routes) {
                const methode = String(r.methode || r.method).toUpperCase(); const motif = r.chemin || r.path;
                if (!motif || EXCLUES.test(motif)) continue;
                const chemins = motif.includes(':') ? [motif.replace(/:\w+/g, '1'), motif.replace(/:\w+/g, 'abc%27%22'), motif.replace(/:\w+/g, 'x'.repeat(600))] : [motif];
                for (const chemin of chemins) for (const [nom, corps] of Object.entries(charges)) {
                    if (casses.has(methode + ' ' + motif)) break;
                    const rep = await appel(jf, methode, chemin.replace(/^\/api/, ''), corps, { delaiMs: 8000 }); n++;
                    if (rep.statut >= 500 && rep.statut !== 502 && rep.statut !== 503) casses.set(methode + ' ' + motif, `${nom} → ${rep.statut} ${rep.texte.slice(0, 160)}`);
                    if (rep.statut === 0) casses.set(methode + ' ' + motif, `${nom} → pas de réponse (${rep.erreur})`);
                }
            }
            // les adresses publiques, avec des types inattendus
            for (const [chemin, corps] of [['/auth/login', { email: ['a@b.co'], password: 'x' }], ['/auth/login', { email: 'a@b.co', password: { a: 1 } }], ['/auth/register', { username: 12, email: 'z@exemple.test', password: 'x' }], ['/auth/register', { username: 'Zed', email: ['z@exemple.test'], password: MDP() }], ['/auth/forgot', { email: ['a@b.co'] }], ['/auth/reset', { email: ['a@b.co'], token: 'x', newPassword: MDP() }], ['/auth/password-strength', { password: 12 }], ['/devices/pair', { code: 12 }], ['/auth/google', { credential: { a: 1 } }]]) {
                const rep = await appel(null, 'POST', chemin, corps); n++;
                if (rep.statut >= 500 && rep.statut !== 503) casses.set('POST ' + chemin, `${JSON.stringify(corps).slice(0, 70)} → ${rep.statut} ${rep.texte.slice(0, 160)}`);
            }
            // lectures avec des paramètres absurdes
            for (const c of ['/me/events', '/me/notifications', '/me/notes', '/me/progress', '/me/favorites', '/me/stats', '/me/temps-lecture', '/me/journal/activite', '/comments-recent', '/me/read-chapters', '/me/history/export', '/me/export', '/me/updates', '/comments/a-1']) {
                for (const q of ['limit=-1', 'limit=abc', 'limit=999999999', 'offset=-5', 'page=1e9', 'limit[]=1&limit[]=2', 'q[a]=1', 'mangaId[]=a&mangaId[]=b', 'from=abc&to=def', 'days=-1', 'sort=;DROP', 'format=zzz']) {
                    const rep = await appel(jf, 'GET', `${c}?${q}`, undefined, { delaiMs: 8000 }); n++;
                    if (rep.statut >= 500) casses.set(`GET ${c}`, `?${q} → ${rep.statut} ${rep.texte.slice(0, 160)}`);
                }
            }
            for (const [route, preuve] of casses) T('moyenne', 'SD-SAISIE-5XX', `${route} : une saisie inattendue provoque une erreur serveur`, preuve, 'Valider le type et la taille, répondre 400.', { fichier: 'server/routes/index.js', categorie: 'robustesse' });
            ctx.mesure('securite_requetes_de_fuzz', n);
            ctx.mesure('securite_routes_cassees', casses.size);
            const mal = await requete(B, '/api/me/favorites', { methode: 'POST', brut: '{"mangaId":', entetes: { 'content-type': 'application/json' }, jeton: jf });
            if (mal.statut !== 400) T('basse', 'SD-JSON-INVALIDE', `Un JSON illisible reçoit ${mal.statut} au lieu de 400`, mal.texte.slice(0, 160), 'Traiter l\'erreur de lecture du corps.');
            const gros = await requete(B, '/api/auth/login', { methode: 'POST', brut: JSON.stringify({ email: 'a@b.co', password: 'x'.repeat(11 * 1024 * 1024) }), entetes: { 'content-type': 'application/json' }, delaiMs: 15000 });
            if (gros.statut !== 413) T('moyenne', 'SD-CORPS-ANONYME', 'Une route publique accepte un corps de plus de 10 Mo', `POST /api/auth/login, 11 Mo, sans session → ${gros.statut} : le corps est lu et décodé en entier avant tout limiteur et toute authentification (express.json global à 12 Mo, posé pour l'import).`, 'Limite de 100 ko par défaut, 12 Mo seulement sur /me/import.', { fichier: 'server/app.js' });
            const sante = await requete(B, '/api/health'); essai('le serveur tient après tous les essais', sante.statut === 200, sante.statut);
            if (sante.statut !== 200) T('critique', 'SD-SERVEUR-TOMBE', 'Le serveur ne répond plus après les essais', J.journal().slice(-600), 'Voir le journal.');
            const journal = J.journal();
            const non = journal.split('\n').filter(l => /Unhandled|uncaught|TypeError|Cannot read prop/i.test(l)).slice(0, 8);
            if (non.length) T('moyenne', 'SD-JOURNAL-ERREURS', `${non.length} erreur(s) JavaScript non prévues dans le journal du serveur`, non.join('\n'), 'Traiter chaque cas.', { categorie: 'robustesse' });
        } finally {
            await J.arreter();
            ctx.mesure('securite_essais', essais.length);
            ctx.mesure('securite_essais_tenus', essais.filter(e => e.ok).length);
            ctx.mesure('securite_verdicts', essais);
        }
    },
};
