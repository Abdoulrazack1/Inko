// modes — les configurations réellement livrées, qu'aucune autre sonde n'essaie :
// l'application de bureau (politique de contenu active) et le hub « Docker » (production),
// vus depuis la machine puis depuis le réseau, en http comme chez la plupart des gens.
'use strict';
const os = require('os');
const crypto = require('crypto');
const { demarrer } = require('./_jetable');
const { lancerNavigateur } = require('./_navigateur');
const { requete } = require('./_http');
const E = require('./_explore');

const adresseReseau = () => (Object.values(os.networkInterfaces()).flat().find(i => i && i.family === 'IPv4' && !i.internal && !i.address.startsWith('169.254')) || {}).address;

module.exports = {
    nom: 'modes',
    description: 'Application de bureau et hub de production : politique de contenu, rendu et connexion depuis la machine et depuis le réseau',
    async run(ctx) {
        const T = (gravite, id, titre, detail, correctif, extra = {}) => ctx.trouver({ gravite, id, categorie: 'configurations livrées', titre, detail, correctif, effort: 'S', ...extra });
        const lan = adresseReseau();
        const nav = await lancerNavigateur();
        const releves = {};
        try {
            for (const config of [
                { cle: 'bureau', nom: 'application de bureau', port: 8141, local: true, env: { APP_VERSION: '2.9.0' } },
                { cle: 'production', nom: 'hub en production (Docker)', port: 8142, local: false, env: { NODE_ENV: 'production', JWT_SECRET: crypto.randomBytes(32).toString('hex'), CORS_ALLOW_ANY: '', APP_VERSION: '' } },
            ]) {
                const J = await demarrer(ctx, { base: 'inko_s_mode_' + config.cle, port: config.port, local: config.local, env: config.env });
                if (!J) continue;
                try {
                    const entetes = (await requete(J.url, '/accueil.html')).entetes || {};
                    const csp = entetes['content-security-policy'] || '';
                    releves[config.cle] = { csp: csp.slice(0, 700), hsts: entetes['strict-transport-security'] || '', pages: {} };
                    if (!csp) T('haute', 'MODE-SANS-CSP', `${config.nom} : aucune politique de contenu`, '', 'Activer la CSP.');
                    if (/'unsafe-inline'/.test(csp)) T('moyenne', 'MODE-CSP-INLINE', `${config.nom} : la politique autorise le script en ligne`, csp.split(';').filter(d => /script/.test(d)).join(' ; '), 'Retirer les gestionnaires en attribut puis unsafe-inline : c\'est ce qui rend les injections SEC-15 et EPUB exécutables.', { effort: 'L', fichier: 'server/middleware/security.js' });
                    if (/upgrade-insecure-requests/.test(csp)) releves[config.cle].miseANiveau = true;
                    let semis = {};
                    if (config.local) semis = await E.semer(J, { favoris: 8 });
                    const origines = [['la machine', J.url], ...(lan ? [['le réseau', J.url.replace('127.0.0.1', lan)]] : [])];
                    for (const [d, base] of origines) {
                        const c = await nav.newContext({ viewport: { width: 1366, height: 800 }, serviceWorkers: 'block', locale: 'fr-FR' });
                        await c.addInitScript(() => { try { for (const k of ['mh_eula_v2', 'inko_consent', 'inko_tour_done', 'mh_install_dismissed']) localStorage.setItem(k, '1'); } catch (e) { /* stockage */ } window.__viol = []; document.addEventListener('securitypolicyviolation', (e) => window.__viol.push(e.violatedDirective + ' ← ' + String(e.blockedURI).slice(0, 90) + (e.sourceFile ? ' (' + e.sourceFile.split('/').pop() + ':' + e.lineNumber + ')' : ''))); });
                        await c.route('**/*', (r) => { const u = r.request().url(); return u.startsWith(base) || u.startsWith(base.replace('http:', 'https:')) || /^(data|blob):/.test(u) ? r.continue() : r.abort(); });
                        const viol = new Map(); let cassees = [];
                        const liste = E.adresses(ctx, semis).filter(([f]) => config.local || true);
                        for (const [f, u] of liste) {
                            const p = await c.newPage(); const s = E.surveiller(p); const https = new Set();
                            p.on('request', (q) => { if (q.url().startsWith('https://' + base.slice(7))) https.add(q.url()); });
                            try {
                                await p.goto(`${base}/${u}`, { waitUntil: 'load', timeout: 15000 }); await p.waitForTimeout(1300);
                                const r = await p.evaluate(() => ({ viol: window.__viol, styles: [...document.styleSheets].filter(x => { try { return x.cssRules.length; } catch (e) { return true; } }).length, mh: !!window.MH || !!window.API, texte: document.body.innerText.trim().length }));
                                for (const v of r.viol) { const k = v; if (!viol.has(k)) viol.set(k, new Set()); viol.get(k).add(f); }
                                if (!r.styles || !r.mh || https.size) cassees.push(`${f} : ${r.styles} feuille(s) de style, scripts ${r.mh ? 'chargés' : 'NON chargés'}${https.size ? ', ' + https.size + ' demande(s) forcées en https' : ''}`);
                                if (s.exceptions.length) T('moyenne', 'MODE-EXCEPTION', `${config.nom}, depuis ${d} : exception sur ${f}`, [...new Set(s.exceptions)].slice(0, 3).join('\n'), '', { fichier: f });
                            } catch (e) { cassees.push(`${f} : ${e.message.split('\n')[0].slice(0, 90)}`); }
                            await p.close();
                            if (cassees.length >= 4 && d === 'le réseau') break;
                        }
                        releves[config.cle].pages[d] = { violations: viol.size, cassees: cassees.length };
                        if (cassees.length >= 3) T('critique', 'MODE-RESEAU-PAGE-MORTE', `${config.nom}, depuis ${d} en http : l'interface ne se charge pas`, cassees.slice(0, 6).join('\n') + (releves[config.cle].miseANiveau ? '\n\nLa politique de contenu contient « upgrade-insecure-requests » (ajoutée par défaut par helmet) : le navigateur réclame chaque fichier en https, que ce serveur ne sert pas.' : ''), 'upgradeInsecureRequests: null quand le serveur n\'est pas derrière HTTPS ; documenter le cas du reverse proxy.', { fichier: 'server/middleware/security.js' });
                        else if (cassees.length) T('haute', 'MODE-PAGE-DEGRADEE', `${config.nom}, depuis ${d} : ${cassees.length} page(s) mal chargée(s)`, cassees.join('\n'), '');
                        for (const [v, pages] of viol) T(/script|connect|style|img|media|frame/.test(v) ? 'haute' : 'moyenne', 'MODE-CSP-VIOLATION', `${config.nom} : la politique de contenu bloque « ${v.split(' ← ')[0]} » (${pages.size} page(s))`, v + '\n' + [...pages].slice(0, 8).join(', '), 'Autoriser l\'origine nécessaire ou changer le code : ce défaut n\'apparaît que dans cette configuration.', { fichier: 'server/middleware/security.js' });
                        // rester connecté : le cas d'un hub partagé ouvert depuis un autre appareil
                        if (!config.local) {
                            const p = await c.newPage();
                            try {
                                await p.goto(`${base}/accueil.html`, { waitUntil: 'load', timeout: 15000 }); await p.waitForTimeout(800);
                                const inscrit = await p.evaluate(async () => { const r = await fetch('/api/auth/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'Reseau' + Math.floor(Math.random() * 1e6), email: 'r' + Date.now() + '@exemple.test', password: 'Zq7!' + Math.random().toString(36).slice(2, 12) }) }); return r.status; });
                                const biscuits = (await c.cookies()).map(k => k.name);
                                const moi = await p.evaluate(async () => (await fetch('/api/auth/me')).status);
                                releves[config.cle]['session depuis ' + d] = { inscription: inscrit, cookies: biscuits, moi };
                                if (inscrit === 200 && moi !== 200) T('haute', 'MODE-SESSION-HTTP', `${config.nom}, depuis ${d} en http : la connexion ne tient pas`, `Inscription ${inscrit}, puis /api/auth/me ${moi}. Cookies enregistrés : ${biscuits.join(', ') || 'aucun'}.\nLe cookie est marqué « Secure » dès NODE_ENV=production : en http le navigateur le refuse, et le jeton n'est pas gardé ailleurs.`, 'Marquer Secure selon le protocole réel de la requête, ou refuser de démarrer sans HTTPS avec un message clair.', { fichier: 'server/controllers/auth.controller.js' });
                            } catch (e) { releves[config.cle]['session depuis ' + d] = 'non éprouvée : ' + e.message.split('\n')[0].slice(0, 100); }
                            await p.close();
                        }
                        await c.close();
                    }
                } finally { await J.arreter(); }
            }
            if (!lan) T('info', 'MODE-SANS-RESEAU', 'Aucune interface réseau : cas « depuis le réseau » non éprouvés', '', '');
            ctx.mesure('modes_releves', releves);
        } finally { await nav.close().catch(() => { }); }
    },
};
