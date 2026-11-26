// certificats — chaque hôte externe dont l'application dépend : nom résolu, certificat TLS
// et date d'expiration, réponse HTTP, redirection vers un autre domaine, liens morts.
// Une expiration de certificat avait cassé SushiScan le 21 novembre sans que rien ne le dise.
'use strict';
const tls = require('tls');
const dns = require('dns').promises;
const https = require('https');

const IGNORES = /^(127\.|192\.168\.|10\.|localhost|www\.w3\.org|.*\.exemple\.com|.*\.example\.com|.*\.test$|tauri\.localhost|schemas\.|json\.schemastore)/;
const certificat = (hote, port) => new Promise((ok) => {
    const s = tls.connect({ host: hote, port, servername: hote, rejectUnauthorized: false, timeout: 9000 }, () => {
        const c = s.getPeerCertificate();
        ok({ valide: s.authorized, raison: s.authorizationError ? String(s.authorizationError) : '', fin: c && c.valid_to ? new Date(c.valid_to) : null, emetteur: c && c.issuer && c.issuer.O, protocole: s.getProtocol() });
        s.end();
    });
    s.on('timeout', () => { s.destroy(); ok({ erreur: 'délai dépassé' }); });
    s.on('error', (e) => ok({ erreur: e.code || e.message }));
});
const tete = (url) => new Promise((ok) => {
    let fini = false; const rendre = (v) => { if (!fini) { fini = true; ok(v); } };
    const r = https.request(url, { method: 'GET', timeout: 9000, rejectUnauthorized: false, headers: { 'user-agent': 'Mozilla/5.0 (compatible; controle-liens/1.0)', accept: '*/*', range: 'bytes=0-0' } }, (res) => { rendre({ statut: res.statusCode, vers: res.headers.location || '', type: res.headers['content-type'] || '' }); res.destroy(); });
    r.on('timeout', () => { r.destroy(); rendre({ erreur: 'délai dépassé' }); });
    r.on('error', (e) => rendre({ erreur: e.code || e.message }));
    r.end();
});

module.exports = {
    nom: 'certificats',
    description: 'Certificats TLS, résolution et réponse de chaque hôte externe ; liens cités dans l\'application',
    async run(ctx) {
        const urls = new Map(); // url -> fichiers
        const fichiers = [];
        for (const d of ['assets/js', 'server/controllers', 'server/lib', 'server/middleware', 'extensions-community', 'mobile', 'desktop-tauri/src-tauri/src']) fichiers.push(...ctx.parcourir(ctx.abs(d), ctx.ext('.js', '.rs', '.json')));
        fichiers.push(...require('fs').readdirSync(ctx.racine).filter(f => /\.(html|webmanifest)$/.test(f)).map(f => ctx.abs(f)));
        fichiers.push(ctx.abs('server', 'app.js'), ctx.abs('desktop-tauri', 'src-tauri', 'tauri.conf.json'));
        for (const f of fichiers) {
            if (/changelog\.json|hashes\.json|package-lock|[\\/](resources|target|vendor)[\\/]|\.min\.js$/.test(f)) continue;
            ctx.chercher(ctx.lire(f), /https?:\/\/[a-zA-Z0-9][a-zA-Z0-9.-]*\.[a-z]{2,}(?::\d+)?(?:\/[^\s'"`<>)\\]*)?/g, (m, ligne) => {
                const u = m[0].replace(/[.,;:]+$/, '');
                if (!urls.has(u)) urls.set(u, []);
                urls.get(u).push(ctx.rel(f) + ':' + ligne);
            });
        }
        const hotes = new Map();
        for (const [u, ou] of urls) {
            let h; try { h = new URL(u).hostname; } catch (e) { continue; }
            if (IGNORES.test(h)) continue;
            if (!hotes.has(h)) hotes.set(h, { ou: [], urls: [], clair: [] });
            const x = hotes.get(h); x.ou.push(...ou); x.urls.push(u);
            if (u.startsWith('http://')) x.clair.push(u + ' ← ' + ou[0]);
        }
        const liste = [...hotes.keys()].sort();
        const resultats = {};
        for (let i = 0; i < liste.length; i += 8) await Promise.all(liste.slice(i, i + 8).map(async (h) => {
            const x = hotes.get(h); const ou = [...new Set(x.ou)].slice(0, 5).join('\n'); const source = x.ou.some(o => /extensions-community/.test(o));
            const T = (gravite, id, titre, detail, correctif) => ctx.trouver({ gravite, id, categorie: 'dépendances externes', titre, detail: detail + '\n\nCité dans :\n' + ou, correctif, effort: 'S', fichier: x.ou[0].split(':')[0] });
            try { await dns.lookup(h); } catch (e) { resultats[h] = 'introuvable'; if (!/^(inko|ton|votre|mon)[.-]/.test(h)) T('haute', 'CERT-DNS', `${h} : le nom ne se résout plus`, String(e.code), 'Retirer ou remplacer cette adresse.'); return; }
            const ports = [...new Set(x.urls.map(u => +(new URL(u).port || 443)))];
            const c = await certificat(h, ports.includes(443) ? 443 : ports[0]);
            if (c.erreur) { resultats[h] = c.erreur; T(source ? 'haute' : 'moyenne', 'CERT-INJOIGNABLE', `${h} : connexion sécurisée impossible (${c.erreur})`, c.erreur, 'Vérifier l\'adresse ; prévoir un repli.'); return; }
            const jours = c.fin ? Math.round((c.fin - Date.now()) / 86400000) : null;
            if (!c.valide) T('haute', 'CERT-INVALIDE', `${h} : certificat refusé (${c.raison})`, `Expire le ${c.fin && c.fin.toISOString().slice(0, 10)}`, 'Changer de domaine ; afficher l\'état de la source.');
            else if (jours !== null && jours < 15) T('moyenne', 'CERT-BIENTOT', `${h} : certificat qui expire dans ${jours} jour(s)`, `Émetteur ${c.emetteur}`, 'Surveiller ; alerter dans la page Système.');
            const r = await tete(`https://${h}${ports.includes(443) ? '' : ':' + ports[0]}/`);
            resultats[h] = `${c.valide ? 'valide' : 'refusé'} · ${jours} j · HTTP ${r.statut || r.erreur}`;
            if (r.vers && h !== 'raw.githubusercontent.com') { try { const v = new URL(r.vers, 'https://' + h + '/'); const racine = (n) => n.split('.').slice(-2).join('.'); if (racine(v.hostname) !== racine(h)) T(source ? 'haute' : 'basse', 'CERT-REDIRECTION', `${h} redirige vers un autre domaine : ${v.hostname}`, `HTTP ${r.statut} → ${v.href.slice(0, 120)}`, 'Mettre à jour l\'adresse.'); } catch (e) { /* adresse relative */ } }
            if (source && r.statut >= 400) T('moyenne', 'CERT-HTTP', `${h} répond ${r.statut} à la racine`, 'https://' + h + '/', 'Vérifier la source (défi anti-robot, panne, fermeture).');
        }));
        for (const [h, x] of hotes) if (x.clair.length) ctx.trouver({ gravite: 'moyenne', id: 'CERT-HTTP-CLAIR', categorie: 'sécurité', titre: `${h} : adresse en clair (http://) dans le code`, detail: x.clair.slice(0, 4).join('\n'), correctif: 'https://', effort: 'S' });
        // les adresses précises que l'utilisateur peut cliquer ou que l'app télécharge
        const GABARIT = /[$`{]/;
        // Les adresses du dépôt du projet portent le nom de son propriétaire : aucune requête
        // sortante ne doit le contenir.
        const proprietaires = new Set([...urls.keys()].map(u => (/github(?:usercontent)?\.com\/(?:repos\/)?([^/]+)\/inko\b/i.exec(u) || [])[1]).filter(Boolean).map(s => s.toLowerCase()));
        const liens = [...urls.keys()]
            .filter(u => ![...proprietaires].some(p => u.toLowerCase().includes('/' + p)))
            .filter(u => !GABARIT.test(u) && !/radio-browser\.info\/json$/.test(u))
            .filter(u => /^https:\/\/(github\.com|raw\.githubusercontent\.com|api\.github\.com)\/./.test(u) || /radio|stream|listen\./.test(u));
        for (const u of liens.slice(0, 40)) {
            let r = await tete(u); let n = 0; let courant = u;
            while (r.vers && n++ < 4) { courant = new URL(r.vers, courant).href; r = await tete(courant); }
            if (r.erreur || r.statut >= 400) ctx.trouver({ gravite: 'moyenne', id: 'CERT-LIEN-MORT', categorie: 'dépendances externes', titre: `Lien mort : ${u.slice(0, 90)}`, detail: `${r.statut || r.erreur}\nCité dans :\n${[...new Set(urls.get(u))].slice(0, 4).join('\n')}`, fichier: urls.get(u)[0].split(':')[0], effort: 'S' });
        }
        ctx.mesure('certificats_hotes', liste.length);
        ctx.mesure('certificats_liens_verifies', Math.min(liens.length, 40));
        ctx.mesure('certificats_releve', resultats);
    },
};
