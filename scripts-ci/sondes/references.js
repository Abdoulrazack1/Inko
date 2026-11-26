// references — tout ce qui pointe vers quelque chose qui n'existe pas : fonctions appelées
// (le « ?.() » les rend muettes), routes, identifiants, fichiers, variables CSS, événements.
'use strict';
const fs = require('fs');
const path = require('path');
const E = require('./_explore');
const { routesDuServeur } = require('./_http');

module.exports = {
    nom: 'references',
    description: 'Appels à des membres inexistants, routes front/serveur, identifiants, fichiers, variables CSS, événements, clés de stockage',
    async run(ctx) {
        const T = (gravite, id, titre, detail, correctif, extra = {}) => ctx.trouver({ gravite, id, categorie: 'références', titre, detail, correctif, effort: 'S', ...extra });
        const js = [...ctx.parcourir(ctx.abs('assets', 'js'), ctx.ext('.js'))].concat([...ctx.parcourir(ctx.abs('mobile'), ctx.ext('.js'))].filter(f => !/[\\/](android|www)[\\/]/.test(f)));
        const html = fs.readdirSync(ctx.racine).filter(f => f.endsWith('.html')).map(f => ctx.abs(f));
        const css = [...ctx.parcourir(ctx.abs('assets'), ctx.ext('.css'))];
        const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
        const sources = new Map([...js, ...html].map(f => [f, ctx.lire(f)]));
        const code = new Map([...sources].map(([f, s]) => [f, sansCommentaires(s)]));
        const tout = [...code.values()].join('\n');

        // ── 1. membres appelés qui n'existent nulle part ──
        const o = await E.ouvrir(ctx, { base: 'inko_s_refs', port: 8102 });
        if (o) try {
            const d = await E.semer(o.J, { favoris: 6 });
            const c = await E.contexte(o.nav, o.J);
            const membres = new Set(); const dup = new Map(); const ariaKo = new Map(); const globaux = ['API', 'MH', 'Storage', 'UserData', 'INKO_HUB', 'I18N', 'MHTheme', 'Downloads', 'DL'];
            for (const [f, u] of E.adresses(ctx, d)) {
                const p = await c.newPage();
                try {
                    await p.goto(`${o.J.url}/${u}`, { waitUntil: 'load', timeout: 25000 }); await p.waitForTimeout(2200);
                    const r = await p.evaluate((globaux) => {
                        const out = [];
                        const voir = (obj, chemin, n) => { if (!obj || (typeof obj !== 'object' && typeof obj !== 'function') || n > 3) return; let cles = Object.keys(obj); const proto = Object.getPrototypeOf(obj); if (proto && proto !== Object.prototype && proto !== Function.prototype) cles = cles.concat(Object.getOwnPropertyNames(proto)); for (const k of cles) { out.push(chemin + '.' + k); let v; try { v = obj[k]; } catch (e) { continue; } if (v && typeof v === 'object' && !(v instanceof Node) && v !== window) voir(v, chemin + '.' + k, n + 1); } };
                        for (const g of globaux) if (window[g]) { out.push(g); voir(window[g], g, 1); }
                        const ids = {}; for (const e of document.querySelectorAll('[id]')) ids[e.id] = (ids[e.id] || 0) + 1;
                        const ko = []; for (const a of ['aria-controls', 'aria-labelledby', 'aria-describedby', 'aria-owns', 'for', 'list']) for (const e of document.querySelectorAll(`[${a}]`)) for (const id of e.getAttribute(a).split(/\s+/).filter(Boolean)) if (!document.getElementById(id)) ko.push(`${a}="${id}" sur ${e.tagName.toLowerCase()}`);
                        return { out, dup: Object.entries(ids).filter(([, n]) => n > 1), ko };
                    }, globaux);
                    r.out.forEach(x => membres.add(x));
                    if (r.dup.length) dup.set(f, r.dup);
                    if (r.ko.length) ariaKo.set(f, [...new Set(r.ko)]);
                } catch (e) { /* page injoignable : les autres sondes le disent */ }
                await p.close();
            }
            for (const [f, l] of dup) T('moyenne', 'REF-ID-DOUBLE', `${f} : identifiant(s) en double dans la page rendue`, l.map(([id, n]) => `#${id} × ${n}`).join('\n'), 'Un identifiant unique par page.', { fichier: f });
            for (const [f, l] of ariaKo) T('moyenne', 'REF-ARIA', `${f} : ${l.length} référence(s) d'accessibilité vers un élément absent`, l.slice(0, 12).join('\n'), 'Corriger l\'identifiant ou retirer l\'attribut (aria-controls peut désigner un panneau créé à l\'ouverture).', { fichier: f, categorie: 'accessibilité' });
            // fonctions de l'API cliente qu'aucun écran n'appelle : des fonctions sans interface
            const hors = [...code].filter(([f]) => !/[\\/](api|moi-local)\.js$/.test(f)).map(([, s]) => s).join('\n');
            const sansEcran = [...membres].filter(m => !m.startsWith('API.ready.') && !m.startsWith('API.user.') && m !== 'API.auth.local' && m !== 'API.auth.validateEmail').filter(m => /^API\.[a-zA-Z]+\.[a-zA-Z]+$/.test(m)).filter(m => { const [, g, n] = m.split('.'); return !new RegExp('\\b' + g + '\\??\\.' + n + '\\b').test(hors) && !new RegExp('\\.' + n + '\\s*(\\?\\.)?\\(').test(hors); }).sort();
            if (sansEcran.length) T('moyenne', 'REF-FONCTION-SANS-ECRAN', sansEcran.length + ' fonction(s) de l’API cliente qu’aucun écran n’appelle', sansEcran.join(String.fromCharCode(10)), 'Brancher chaque fonction à un écran, ou la retirer.', { fichier: 'assets/js/api.js' });
            ctx.mesure('references_membres_exposes', membres.size);
            const definis = (ch) => membres.has(ch) || new RegExp(`(?:${ch.split('.').slice(0, -1).join('\\??\\.')}\\??\\.${ch.split('.').pop()}\\s*=[^=])|\\b${ch.split('.').pop()}\\s*(?::|\\([^)]*\\)\\s*\\{)|\\bfunction\\s+${ch.split('.').pop()}\\b|[{,]\\s*${ch.split('.').pop()}\\s*[,}]`).test(tout);
            const manquants = new Map();
            for (const [f, s] of code) ctx.chercher(s, /\b(?:window\??\.)?(API|MH|Storage|UserData)((?:\??\.[a-zA-Z_$][\w$]*){1,3})\s*(\?\.)?\(/g, (m, ligne) => {
                const chemin = m[1] + m[2].replace(/\?/g, '');
                const parts = chemin.split('.');
                if (m[1] === 'Storage' && ['getItem', 'setItem', 'removeItem', 'clear', 'key'].includes(parts[1])) return;
                for (let i = 2; i <= parts.length; i++) {
                    const ch = parts.slice(0, i).join('.');
                    if (!definis(ch)) { if (!manquants.has(ch)) manquants.set(ch, { ou: [], muet: false }); const x = manquants.get(ch); x.ou.push(ctx.rel(f) + ':' + ligne); if (m[3] || m[0].includes('?.')) x.muet = true; break; }
                }
            });
            for (const [ch, x] of manquants) T(x.muet ? 'moyenne' : 'haute', 'REF-MEMBRE-ABSENT', `${ch}() est appelé mais n'existe sur aucune page`, `${x.ou.slice(0, 8).join('\n')}${x.muet ? '\n\nL\'appel est protégé par « ?. » : il ne fait rien, sans message.' : ''}`, 'Écrire la fonction, corriger son nom, ou retirer l\'appel.', { fichier: x.ou[0].split(':')[0], ligne: +x.ou[0].split(':')[1] });
        } finally { await o.fermer(); }

        const sansApi = (re) => ![...code].some(([f, s]) => !/[\\/](api|moi-local)\.js$/.test(f) && re.test(s));
        for (const [id, re, titre, detail, g] of [
            ['REF-SANS-CONNEXION', /auth\??\.login\s*(\?\.)?\(/, 'Aucun écran ne permet de se connecter', 'API.auth.login n’est appelée nulle part. En mode multi-comptes (LOCAL_MODE=0, le profil Docker documenté), personne ne peut entrer par l’interface.', 'haute'],
            ['REF-SANS-INSCRIPTION', /auth\??\.register\s*(\?\.)?\(/, 'Aucun écran ne permet de créer un compte', 'API.auth.register n’est appelée nulle part.', 'haute'],
            ['REF-SANS-MDP', /auth\??\.changePassword\s*(\?\.)?\(/, 'Aucun écran ne permet de changer son mot de passe', 'API.auth.changePassword n’est appelée nulle part.', 'haute'],
            ['REF-SANS-OUBLI', /auth\??\.requestReset\s*(\?\.)?\(/, 'Aucun écran « mot de passe oublié »', 'API.auth.requestReset n’est appelée nulle part — la route, elle, est ouverte au réseau.', 'moyenne'],
        ]) if (sansApi(re)) T(g, id, titre, detail, 'Écran de connexion, d’inscription et de récupération.', { fichier: 'assets/js/api.js', categorie: 'fonction absente' });
        const reglages = ctx.lire(ctx.abs('server', 'controllers', 'auth.controller.js'));
        if (/randomBytes\(24\)/.test(reglages) &&/Mot de passe requis pour confirmer/.test(reglages)) T('haute', 'REF-EFFACEMENT-IMPOSSIBLE', 'Le propriétaire d’une installation locale ne peut pas supprimer son compte', 'resolveOwner() crée le compte avec un mot de passe aléatoire que personne ne connaît ; deleteAccount exige ce mot de passe ; aucun écran ne permet d’en définir un.', 'En mode local, confirmer par une phrase tapée (« SUPPRIMER ») sur la boucle locale.', { fichier: 'server/controllers/auth.controller.js', ligne: ctx.ligneDe(reglages, reglages.indexOf('Mot de passe requis pour confirmer')), categorie: 'bug' });

        // ── 2. routes appelées par le front ↔ routes du serveur ──
        const routes = routesDuServeur(ctx);
        const motifs = routes.map(r => ({ ...r, re: new RegExp('^' + r.chemin.replace(/:[a-zA-Z]+/g, '[^/]+') + '$'), vu: false }));
        const appels = [];
        for (const [f, s] of code) {
            const lignes = s.split('\n');
            lignes.forEach((l, i) => {
                const re = /(?:\b(get|post|put|del|request|getWithRetry|partage|lire)\s*\(\s*(?:'(GET|POST|PUT|DELETE)'\s*,\s*)?|(?:API_BASE|BASE|base|\/api(?:\/v1)?)\s*\+\s*|fetch\(\s*)((?:[`'"]\/[^`'"]*[`'"])(?:\s*\+\s*(?:encodeURIComponent\([^()]*(?:\([^()]*\))?[^()]*\)|[\w.$[\]]+|[`'"][^`'"]*[`'"]|\([^()]*\)))*)/g;
                let m;
                while ((m = re.exec(l))) {
                    let ex = m[3];
                    let chemin = ex.replace(/\s*\+\s*/g, '+').split(/\+(?=(?:[^'"`]*['"`][^'"`]*['"`])*[^'"`]*$)/).map(x => /^[`'"]/.test(x) ? x.slice(1, -1) : '§').join('').replace(/\$\{[^}]*\}/g, '§').replace(/^\/api(\/v1)?/, '').split('?')[0].replace(/§+$/, (z) => (/\/§+$/.test(ex) ? z : z));
                    if (!/^\/[a-z]/i.test(chemin) || /\.(html|js|css|json|png|jpg|svg|webp)/.test(chemin) || /^\/assets/.test(chemin)) continue;
                    const methode = m[2] || ({ post: 'POST', put: 'PUT', del: 'DELETE' }[m[1]] || null);
                    appels.push({ chemin, methode, ou: ctx.rel(f) + ':' + (i + 1), api: /api\.js|moi-local|synchro|natif|hub|appairage|telecommande|storage\.js|userdata/.test(f) || /\/api/.test(l) });
                }
            });
        }
        const correspond = (a) => {
            const essais = [a.chemin, a.chemin.replace(/§/g, 'x'), a.chemin.replace(/([^/])§+$/, '$1'), a.chemin.replace(/\/$/, '/x')];
            return motifs.filter(r => (!a.methode || r.methode === a.methode) && essais.some(c => r.re.test(c) || r.re.test(c.replace(/§/g, 'x'))));
        };
        const orphelins = new Map();
        for (const a of appels) { const c = correspond(a); c.forEach(r => { r.vu = true; }); if (!c.length && a.api && /^\/(me|auth|sources|extensions|devices|comments|ratings|lists|users|library|admin|mangas|chapters|img|health|artwork|anilist|push|app|instance|search-all)\b/.test(a.chemin)) orphelins.set((a.methode || '?') + ' ' + a.chemin, a.ou); }
        for (const [k, ou] of orphelins) T('haute', 'REF-ROUTE-ABSENTE', `Le front appelle ${k.replace(/§/g, '…')} : aucune route ne correspond`, ou, 'Créer la route ou corriger le chemin.', { fichier: ou.split(':')[0], ligne: +ou.split(':')[1] });
        // une route est « utilisée » si son squelette apparaît quelque part côté client
        const clients = tout + ctx.lire(ctx.abs('service-worker.js')) + [...ctx.parcourir(ctx.abs('desktop-tauri', 'src-tauri', 'src'), ctx.ext('.rs'))].map(ctx.lire).join('\n');
        const inutilisees = motifs.filter(r => !r.vu).filter(r => { const bouts = r.chemin.split('/').filter(x => x && !x.startsWith(':')); const dernier = bouts[bouts.length - 1]; return !new RegExp(`['"\`/]${dernier}(?=['"\`/?]|\\b)`).test(clients.replace(/\.html/g, '')); });
        if (inutilisees.length) T('basse', 'REF-ROUTE-INUTILISEE', `${inutilisees.length} route(s) du serveur qu'aucun écran n'appelle`, inutilisees.map(r => `${r.methode} ${r.chemin} (routes/index.js:${r.ligne})`).join('\n'), 'Les brancher à un écran (fonction invisible aujourd\'hui) ou les retirer.', { fichier: 'server/routes/index.js' });
        ctx.mesure('references_appels_front', appels.length);
        ctx.mesure('references_routes_vues', motifs.filter(r => r.vu).length + '/' + motifs.length);

        // ── 3. identifiants cherchés mais jamais créés ──
        const crees = new Set();
        for (const s of sources.values()) { ctx.chercher(s, /\bid\s*=\s*\\?["']([A-Za-z][\w-]*)\\?["']/g, m => crees.add(m[1])); ctx.chercher(s, /\.id\s*=\s*['"`]([A-Za-z][\w-]*)['"`]/g, m => crees.add(m[1])); ctx.chercher(s, /\bid:\s*['"`]([A-Za-z][\w-]*)['"`]/g, m => crees.add(m[1])); ctx.chercher(s, /setAttribute\(\s*['"]id['"]\s*,\s*['"`]([\w-]+)/g, m => crees.add(m[1])); }
        const prefixes = []; for (const s of sources.values()) ctx.chercher(s, /\bid\s*=\s*\\?["'`]?([A-Za-z][\w-]*)(?:\$\{|["']\s*\+)/g, m => prefixes.push(m[1]));
        const idsAbsents = new Map();
        for (const [f, s] of code) ctx.chercher(s, /(?:getElementById\(\s*['"]([\w-]+)['"]\s*\)|querySelector(?:All)?\(\s*['"]#([\w-]+)['"]\s*\))/g, (m, ligne) => { const id = m[1] || m[2]; if (!crees.has(id) && !prefixes.some(p => id.startsWith(p))) { if (!idsAbsents.has(id)) idsAbsents.set(id, []); idsAbsents.get(id).push(ctx.rel(f) + ':' + ligne); } });
        for (const [id, ou] of idsAbsents) if (tout.split("'" + id + "'").length - 1 <= ou.length) T('moyenne', 'REF-ID-ABSENT', `#${id} est cherché mais aucun élément ne porte cet identifiant`, ou.slice(0, 6).join('\n'), 'Code mort ou fonction débranchée : créer l\'élément ou retirer le code.', { fichier: ou[0].split(':')[0], ligne: +ou[0].split(':')[1] });

        // ── 4. fichiers cités qui n'existent pas ──
        const fichiersKo = new Map();
        const verifier = (cible, de, ligne, base) => { const net = cible.split(/[?#]/)[0]; if (!net || /^(https?:|data:|blob:|mailto:|tel:|#|\/api|javascript:|\$|\{)/.test(cible) || /[${}<>*]/.test(net)) return; const p = net.startsWith('/') ? ctx.abs(net.slice(1)) : path.resolve(base, net); if (!fs.existsSync(p)) { if (!fichiersKo.has(net)) fichiersKo.set(net, []); fichiersKo.get(net).push(ctx.rel(de) + ':' + ligne); } };
        for (const f of html) ctx.chercher(code.get(f), /\s(?:src|href|data-src|poster)\s*=\s*["']([^"']+\.(?:html|js|css|png|jpe?g|svg|webp|ico|woff2?|webmanifest|json))(?:[?#][^"']*)?["']/g, (m, l) => verifier(m[1], f, l, ctx.racine));
        for (const f of css) ctx.chercher(ctx.lire(f), /url\(\s*['"]?([^'")]+)['"]?\s*\)/g, (m, l) => verifier(m[1], f, l, path.dirname(f)));
        for (const f of js) ctx.chercher(code.get(f), /['"`](\/?(?:assets\/[\w./-]+\.(?:js|css|png|jpe?g|svg|webp|json|woff2?)|[a-z][\w-]*\.html))(?:[?#][^'"`]*)?['"`]/g, (m, l) => verifier(m[1].replace(/^\//, '/'), f, l, ctx.racine));
        for (const [c2, ou] of fichiersKo) T('moyenne', 'REF-FICHIER-ABSENT', `Fichier cité mais absent : ${c2}`, ou.slice(0, 6).join('\n'), 'Ajouter le fichier ou corriger le chemin.', { fichier: ou[0].split(':')[0] });
        // manifeste et cache hors ligne
        try { const man = JSON.parse(ctx.lire(ctx.abs('manifest.webmanifest'))); for (const i of [...(man.icons || []), ...(man.screenshots || []), ...((man.shortcuts || []).flatMap(s => s.icons || []))]) if (!/^data:|^https?:/.test(i.src) && !fs.existsSync(ctx.abs(i.src.replace(/^\//, '')))) T('moyenne', 'REF-MANIFESTE', `Manifeste : fichier absent ${i.src}`, '', ''); for (const s of man.shortcuts || []) if (!fs.existsSync(ctx.abs(s.url.split(/[?#]/)[0].replace(/^[./]+/, '')))) T('moyenne', 'REF-MANIFESTE', `Manifeste : raccourci vers une page absente ${s.url}`, '', ''); if (!(man.screenshots || []).length) T('basse', 'REF-MANIFESTE-CAPTURES', 'Le manifeste n\'a pas de captures : l\'installation Android reste en bandeau minimal', '', 'Ajouter screenshots (étroit et large).', { fichier: 'manifest.webmanifest' }); } catch (e) { T('haute', 'REF-MANIFESTE', 'Manifeste illisible', e.message, ''); }
        const sw = ctx.lire(ctx.abs('service-worker.js'));
        const pre = new Set(); ctx.chercher(sw, /['"`]\.?\/?((?:assets\/[^'"`?]+|[\w-]+\.(?:html|webmanifest|js|css)))(?:\?[^'"`]*)?['"`]/g, m => pre.add(m[1]));
        const preKo = [...pre].filter(p => !/\$\{|\*/.test(p) && !fs.existsSync(ctx.abs(p)));
        if (preKo.length) T('haute', 'REF-CACHE-ABSENT', `Le cache hors ligne cite ${preKo.length} fichier(s) absent(s)`, preKo.join('\n'), 'Relancer gen-precache.', { fichier: 'service-worker.js' });
        const liés = new Set(); for (const f of html) ctx.chercher(code.get(f), /(?:src|href)\s*=\s*["']\/?(assets\/[^"'?]+\.(?:js|css))/g, m => liés.add(m[1]));
        const hors = [...liés].filter(x => !pre.has(x));
        if (hors.length) T('moyenne', 'REF-CACHE-MANQUANT', `${hors.length} script(s) ou style(s) chargés par une page mais absents du cache hors ligne`, hors.join('\n'), 'Les ajouter au pré-cache.', { fichier: 'service-worker.js' });
        const orphelinsJs = [...js, ...css].map(ctx.rel).filter(r => r.startsWith('assets/') && !tout.includes(path.basename(r)) && !sw.includes(path.basename(r)) && ![...css].some(c2 => ctx.lire(c2).includes(path.basename(r))));
        if (orphelinsJs.length) T('basse', 'REF-FICHIER-ORPHELIN', `${orphelinsJs.length} fichier(s) que rien ne charge`, orphelinsJs.join('\n'), 'Retirer ou brancher.');

        // ── 5. variables CSS utilisées sans définition ──
        const texteCss = css.map(ctx.lire).join('\n') + [...sources.values()].join('\n');
        const posees = new Set(); ctx.chercher(texteCss, /(--[\w-]+)\s*:/g, m => posees.add(m[1])); ctx.chercher(texteCss, /setProperty\(\s*['"`](--[\w-]+)/g, m => posees.add(m[1])); const dyn = []; ctx.chercher(texteCss, /setProperty\(\s*['"`](--[\w-]*?)(?:\$\{|['"`]\s*\+)/g, m => dyn.push(m[1]));
        const vars = new Map();
        for (const f of [...css, ...html, ...js]) ctx.chercher(ctx.lire(f), /var\(\s*(--[\w-]+)\s*(,)?/g, (m, l) => { if (!m[1].endsWith('-') && !posees.has(m[1]) && !m[2] && !dyn.some(d => m[1].startsWith(d))) { if (!vars.has(m[1])) vars.set(m[1], []); vars.get(m[1]).push(ctx.rel(f) + ':' + l); } });
        for (const [v, ou] of vars) T('moyenne', 'REF-VARIABLE-CSS', `var(${v}) est utilisée mais jamais définie (${ou.length} endroit(s))`, ou.slice(0, 8).join('\n'), 'La règle est ignorée par le navigateur : définir la variable ou corriger le nom.', { fichier: ou[0].split(':')[0], ligne: +ou[0].split(':')[1], categorie: 'mise en page' });

        // ── 6. événements maison et clés de stockage ──
        const emis = new Map(), ecoutes = new Map();
        const noter = (map, k, ou) => { if (!map.has(k)) map.set(k, []); map.get(k).push(ou); };
        for (const [f, s] of code) { ctx.chercher(s, /new (?:Custom)?Event\(\s*['"`]([\w-]+:[\w:-]+)['"`]/g, (m, l) => noter(emis, m[1], ctx.rel(f) + ':' + l)); ctx.chercher(s, /\b(?:emit|signaler|dispatch)\(\s*['"`]([\w-]+:[\w:-]+)['"`]/g, (m, l) => noter(emis, m[1], ctx.rel(f) + ':' + l)); ctx.chercher(s, /(?:addEventListener|\.on)\(\s*['"`]([\w-]+:[\w:-]+)['"`]/g, (m, l) => noter(ecoutes, m[1], ctx.rel(f) + ':' + l)); }
        for (const [k, ou] of emis) if (!ecoutes.has(k) && !new RegExp(`['"\`]${k}['"\`]`, 'g').test([...code.values()].join('\n').split(ou[0]).join('').replace(new RegExp(`(?:Event|emit|signaler|dispatch)\\(\\s*['"\`]${k}['"\`]`, 'g'), ''))) T('basse', 'REF-EVENEMENT-SANS-ECOUTEUR', `L'événement « ${k} » est émis mais personne ne l'écoute`, ou.join('\n'), 'Brancher la réaction attendue ou retirer l\'émission.', { fichier: ou[0].split(':')[0] });
        for (const [k, ou] of ecoutes) if (!emis.has(k) && (tout.match(new RegExp(`['"\`]${k}['"\`]`, 'g')) || []).length <= ou.length) T('moyenne', 'REF-EVENEMENT-JAMAIS-EMIS', `L'événement « ${k} » est écouté mais jamais émis`, ou.join('\n'), 'Réaction qui ne se produit jamais.', { fichier: ou[0].split(':')[0] });
        const lues = new Map(), ecrites = new Set();
        for (const [f, s] of code) { ctx.chercher(s, /(?:localStorage|sessionStorage)\.getItem\(\s*['"`]([\w:.-]+)['"`]\s*\)/g, (m, l) => noter(lues, m[1], ctx.rel(f) + ':' + l)); ctx.chercher(s, /(?:localStorage|sessionStorage)\.setItem\(\s*['"`]([\w:.-]+)['"`]/g, m => ecrites.add(m[1])); }
        for (const [k, ou] of lues) if (!ecrites.has(k) && (tout.split(k).length - 1) <= ou.length) T('basse', 'REF-CLE-JAMAIS-ECRITE', `La clé « ${k} » est lue mais jamais écrite`, ou.join('\n'), 'Réglage sans interface, ou nom erroné.', { fichier: ou[0].split(':')[0] });
    },
};
