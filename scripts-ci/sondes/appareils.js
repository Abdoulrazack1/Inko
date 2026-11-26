// appareils — vivre à plusieurs écrans : appairer, ce qu'un téléphone appairé a le droit de
// faire, le révoquer, piloter un lecteur à distance, et voir un changement fait ailleurs.
'use strict';
const E = require('./_explore');
const { requete } = require('./_http');

module.exports = {
    nom: 'appareils',
    description: 'Appairage de bout en bout, droits et révocation d\'un appareil, télécommande en direct, cohérence entre écrans',
    async run(ctx) {
        const o = await E.ouvrir(ctx, { base: 'inko_s_app', port: 8151 });
        if (!o) return;
        const { J, nav } = o;
        const T = (gravite, id, titre, detail, correctif, extra = {}) => ctx.trouver({ gravite, id, categorie: 'multi-appareils', titre, detail, correctif, effort: 'S', ...extra });
        const verdicts = [];
        const essai = (nom, ok, info = '') => verdicts.push({ nom, ok, info: String(info).slice(0, 140) });
        try {
            await E.semer(J, { favoris: 6 });
            const pc = await J.api('POST', '/devices/pair-code', {});
            const code = pc.json && pc.json.code;
            essai('code d’appairage émis', !!code, pc.statut);
            if (!code) { T('haute', 'APP-CODE', 'Impossible d\'émettre un code d\'appairage', JSON.stringify(pc.json), ''); return; }
            for (let i = 0; i < 3; i++) { const r = await requete(J.url, '/api/devices/pair', { methode: 'POST', corps: { code: 'ZZZZ-ZZZ' + i } }); essai('code inventé refusé', r.statut === 404, r.statut); }
            const ap = await requete(J.url, '/api/devices/pair', { methode: 'POST', corps: { code: code.replace('-', '').toLowerCase(), nom: 'Téléphone d’essai', plateforme: 'android' } });
            const jt = ap.json && ap.json.token, dev = ap.json && ap.json.deviceId;
            essai('appairage (saisie sans tiret, en minuscules)', ap.statut === 201 && !!jt, ap.statut);
            if (!jt) return;
            const tel = (m, p, corps) => requete(J.url, '/api' + p, { methode: m, corps, jeton: jt });
            const droits = [];
            for (const [nom, m, c, corps, attendu] of [
                ['lire la bibliothèque', 'GET', '/me/favorites', null, 200], ['écrire une progression', 'PUT', '/me/progress/fixture-1', { chapterId: 'c5', chapter: 5, page: 1 }, 200],
                ['statistiques d’administration', 'GET', '/admin/stats', null, 403], ['changer un rôle', 'PUT', '/admin/users/1/role', { role: 'user' }, 403], ['installer des extensions', 'POST', '/extensions/update', {}, 403],
                ['émettre un code d’appairage', 'POST', '/devices/pair-code', {}, 403], ['lister les appareils', 'GET', '/devices', null, 200], ['changer le mot de passe', 'PUT', '/auth/password', { currentPassword: 'x', newPassword: 'y' }, 400],
                ['exporter tout le compte', 'GET', '/me/export', null, 200], ['restaurer une sauvegarde', 'POST', '/me/backups/x/restore', {}, 403], ['lister les sauvegardes', 'GET', '/me/backups', null, 403],
            ]) { const r = await tel(m, c, corps || undefined); droits.push({ nom, statut: r.statut, attendu }); essai('téléphone : ' + nom, attendu === 403 ? [401, 403].includes(r.statut) : r.statut === attendu || (attendu === 400 && r.statut < 500), r.statut);
                if (attendu === 403 && r.statut < 400) T(/code/.test(nom) ? 'haute' : /sauvegarde/.test(nom) ? 'moyenne' : 'haute', 'APP-DROIT', `Un téléphone appairé peut ${nom}`, `${m} /api${c} → ${r.statut}. L'appairage donne le rôle « lecteur », sans administration.` + (/code/.test(nom) ? '\nUn téléphone volé peut ainsi appairer d\'autres appareils avant d\'être révoqué.' : ''), /code/.test(nom) ? 'Réserver l\'émission de codes aux sessions qui ne viennent pas d\'un appareil.' : 'Refuser aux jetons d\'appareil.', { fichier: 'server/routes/index.js' }); }
            ctx.mesure('appareils_droits', droits);
            // ── télécommande : un lecteur ouvert, le téléphone commande ──
            const oe = await E.oeuvresReelles(J);
            if (oe.manga) {
                const ch = oe.manga.chapitres[Math.floor(oe.manga.chapitres.length / 2)];
                const c = await E.contexte(nav, J); const p = await c.newPage(); const s = E.surveiller(p);
                await p.goto(`${J.url}/chapitre.html?manga=${encodeURIComponent(oe.manga.id)}&chapter=${encodeURIComponent(ch.id)}&source=${oe.manga.source}`);
                await p.waitForSelector('.reader-page-img', { timeout: 25000 }); await p.waitForTimeout(3000);
                const ecrans = await tel('GET', '/me/remote/ecrans');
                const nEcrans = ecrans.json && (Array.isArray(ecrans.json.ecrans) ? ecrans.json.ecrans.length : ecrans.json.ecrans);
                essai('télécommande : l’écran est vu', !!nEcrans, JSON.stringify(ecrans.json));
                if (!nEcrans) T('haute', 'APP-ECRAN-INVISIBLE', 'La télécommande ne voit pas un lecteur pourtant ouvert', JSON.stringify(ecrans.json), 'Vérifier l\'abonnement du lecteur au flux.', { fichier: 'assets/js/telecommande.js' });
                const page = () => p.evaluate(() => { const m = /(\d+)\s*\/\s*(\d+)/.exec((document.querySelector('.reader-nav-page') || {}).innerText || ''); return m ? +m[1] : scrollY; });
                await p.evaluate(() => window.goToPage && window.goToPage(1)); await p.waitForTimeout(600);
                for (const [action, valeur, verif] of [['page-suivante', null, (a, z) => z > a], ['page-precedente', null, (a, z) => z < a], ['aller-a-la-page', 3, (a, z) => z === 3]]) {
                    const a = await page(); const t0 = Date.now(); await tel('POST', '/me/remote', valeur ? { action, valeur } : { action }); await p.waitForTimeout(900); const z = await page();
                    essai('télécommande : ' + action, verif(a, z), `${a} → ${z}`);
                    if (!verif(a, z)) T('moyenne', 'APP-COMMANDE', `La commande « ${action} » n'a pas l'effet attendu`, `Page ${a} avant, ${z} après ${Date.now() - t0} ms.`, '', { fichier: 'assets/js/chapitre.js' });
                }
                const url0 = p.url(); await tel('POST', '/me/remote', { action: 'chapitre-suivant' }); await p.waitForTimeout(4000); essai('télécommande : chapitre suivant', p.url() !== url0);
                const inconnue = await tel('POST', '/me/remote', { action: 'effacer-tout' }); essai('commande inconnue refusée', inconnue.statut === 400, inconnue.statut);
                if (s.exceptions.length) T('moyenne', 'APP-EXCEPTION', 'Exception dans le lecteur piloté', s.exceptions.slice(0, 3).join('\n'), '', { fichier: 'assets/js/telecommande.js' });
                await c.close();
            }
            // ── cohérence entre deux écrans ouverts ──
            const c = await E.contexte(nav, J); const a = await c.newPage(); const z = await c.newPage();
            await a.goto(J.url + '/bibliotheque.html'); await z.goto(J.url + '/bibliotheque.html'); await a.waitForTimeout(3500);
            const n = () => z.evaluate(() => document.querySelectorAll('#libGrid .lib2-card').length);
            const n0 = await n();
            await tel('POST', '/me/favorites', { mangaId: 'depuis-le-tel', source: 'mangadex', title: 'Ajouté depuis le téléphone' });
            await z.bringToFront(); await z.evaluate(() => { window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); }); await z.waitForTimeout(5000);
            const n1 = await n(); essai('un ajout fait ailleurs apparaît au retour sur l’écran', n1 > n0, `${n0} → ${n1}`);
            if (!(n1 > n0)) T('moyenne', 'APP-ECRAN-PERIME', 'Un changement fait sur un autre appareil n\'apparaît pas tant qu\'on ne recharge pas', `Bibliothèque ouverte, série ajoutée depuis le téléphone, retour sur l'écran : ${n0} carte(s) avant, ${n1} après 5 s.`, 'Revalider au retour de visibilité (visibilitychange) ou pousser les changements par le flux existant.', { fichier: 'assets/js/bibliotheque.js', effort: 'M' });
            await c.close();
            // ── révocation ──
            const rv = await J.api('DELETE', '/devices/' + dev);
            const apres = await tel('GET', '/me/favorites');
            essai('appareil révoqué : accès coupé immédiatement', rv.statut === 200 && apres.statut === 401 && /APPAREIL_REVOQUE/.test(apres.texte), `${rv.statut} / ${apres.statut} ${apres.json && apres.json.code}`);
            if (apres.statut === 200) T('critique', 'APP-REVOCATION', 'Un appareil révoqué garde l\'accès', apres.texte.slice(0, 160), 'Fermer la session avec l\'appareil.', { fichier: 'server/controllers/devices.controller.js' });
            const flux = await requete(J.url, '/api/me/remote/ecrans', { jeton: jt }); essai('appareil révoqué : télécommande refusée', flux.statut === 401, flux.statut);
            ctx.mesure('appareils_essais', verdicts.length); ctx.mesure('appareils_essais_tenus', verdicts.filter(v => v.ok).length); ctx.mesure('appareils_verdicts', verdicts);
        } finally { await o.fermer(); }
    },
};
