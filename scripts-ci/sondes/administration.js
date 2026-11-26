// administration — la vie d'une instance partagée par l'API : rôles, bannissement,
// signalements, commentaires (fils, portées, spoilers, pagination), dernier administrateur.
'use strict';
const crypto = require('crypto');
const { demarrer } = require('./_jetable');
const { requete } = require('./_http');

module.exports = {
    nom: 'administration',
    description: 'Rôles, bannissement, modération, commentaires et leurs règles sur une instance à plusieurs comptes',
    async run(ctx) {
        const J = await demarrer(ctx, { base: 'inko_s_admin', port: 8152, local: false });
        if (!J) return;
        const T = (gravite, id, titre, detail, correctif, extra = {}) => ctx.trouver({ gravite, id, categorie: 'instance partagée', titre, detail, correctif, effort: 'S', ...extra });
        const verdicts = [];
        const essai = (nom, ok, info = '', g = 'moyenne', fichier = 'server/controllers/admin.controller.js') => { verdicts.push({ nom, ok, info: String(info).slice(0, 140) }); if (!ok) T(g, 'ADM-REGLE', `Règle non tenue : ${nom}`, String(info).slice(0, 300), 'Corriger et ajouter le cas aux tests.', { fichier }); };
        try {
            const appel = (jeton, m, p, corps) => requete(J.url, '/api' + p, { methode: m, corps, jeton });
            const creer = async (pseudo) => { const mdp = 'Zq7!' + crypto.randomBytes(8).toString('base64url'); const email = pseudo.toLowerCase() + '@exemple.test'; const r = await appel(null, 'POST', '/auth/register', { username: pseudo, email, password: mdp }); return { pseudo, email, mdp, jeton: r.json && r.json.token, id: r.json && r.json.user && r.json.user.id, role: r.json && r.json.user && r.json.user.role }; };
            const A = await creer('Premier'), B = await creer('Second'), C = await creer('Troisieme');
            essai('trois comptes créés', !!(A.jeton && B.jeton && C.jeton), `${A.id} ${B.id} ${C.id}`);
            if (A.role !== 'admin') T('haute', 'ADM-SANS-ADMIN', 'Sur une instance neuve à plusieurs comptes, personne n\'est administrateur', `Le premier compte inscrit a le rôle « ${A.role} ». Aucune commande ni variable ne permet de nommer un administrateur : la modération et la gestion des extensions sont hors d'atteinte.`, 'Premier compte administrateur, ou script « promouvoir » documenté.', { fichier: 'server/controllers/auth.controller.js' });
            await J.sql("UPDATE users SET role = 'admin' WHERE id = ?", [A.id]);
            const stats = await appel(A.jeton, 'GET', '/admin/stats'); essai('l’administrateur lit les statistiques', stats.statut === 200, stats.statut);
            const liste = await appel(A.jeton, 'GET', '/admin/users'); essai('la liste des comptes ne contient aucun secret', liste.statut === 200 && !/password_hash|\$2[aby]\$/.test(liste.texte), liste.texte.slice(0, 200), 'critique');
            essai('un administrateur ne se retire pas son rôle', (await appel(A.jeton, 'PUT', `/admin/users/${A.id}/role`, { role: 'user' })).statut === 400);
            essai('ni ne se bannit', (await appel(A.jeton, 'PUT', `/admin/users/${A.id}/ban`, { banned: true })).statut === 400);
            essai('rôle inconnu refusé', (await appel(A.jeton, 'PUT', `/admin/users/${B.id}/role`, { role: 'root' })).statut === 400);
            const fantome = await appel(A.jeton, 'PUT', '/admin/users/999999999/role', { role: 'user' });
            essai('compte inexistant signalé', fantome.statut === 404, `PUT rôle d'un compte inexistant → ${fantome.statut} ${fantome.texte.slice(0, 80)}`, 'basse');
            // commentaires
            const c1 = await appel(B.jeton, 'POST', '/comments/oeuvre', { text: 'racine publique', visibility: 'public' });
            await appel(B.jeton, 'POST', '/comments/oeuvre', { text: 'réservé à l’instance', visibility: 'instance' });
            await appel(B.jeton, 'POST', '/comments/oeuvre', { text: 'pour moi seul', visibility: 'private' });
            await appel(B.jeton, 'POST', '/comments/oeuvre', { text: 'la fin du chapitre', spoiler: true, chapterId: 'ch9' });
            const [r1] = await J.sql("SELECT id FROM comments WHERE text = 'racine publique'");
            await appel(C.jeton, 'POST', '/comments/oeuvre', { text: 'une réponse', parentId: r1.id });
            const vuAnon = (await appel(null, 'GET', '/comments/oeuvre')).texte, vuC = (await appel(C.jeton, 'GET', '/comments/oeuvre')).texte, vuB = (await appel(B.jeton, 'GET', '/comments/oeuvre')).texte;
            essai('un visiteur ne voit que le public', /racine publique/.test(vuAnon) && !/réservé à l|pour moi seul/.test(vuAnon), vuAnon.slice(0, 200), 'haute', 'server/controllers/user.controller.js');
            essai('un membre voit l’instance, pas le privé d’autrui', /réservé à l/.test(vuC) && !/pour moi seul/.test(vuC), vuC.slice(0, 200), 'haute', 'server/controllers/user.controller.js');
            essai('l’auteur voit son commentaire privé', /pour moi seul/.test(vuB), '', 'moyenne', 'server/controllers/user.controller.js');
            essai('le marqueur de spoiler est rendu', /"spoiler":\s*(true|1)/.test(vuC), vuC.slice(0, 300), 'moyenne', 'server/controllers/user.controller.js');
            essai('réponse à un commentaire d’une autre œuvre refusée', (await appel(C.jeton, 'POST', '/comments/autre', { text: 'x', parentId: r1.id })).statut >= 400, '', 'moyenne', 'server/controllers/user.controller.js');
            const recents = (await appel(C.jeton, 'GET', '/comments-recent')).texte;
            essai('les commentaires récents n’exposent pas le privé', !/pour moi seul/.test(recents), recents.slice(0, 200), 'haute', 'server/controllers/user.controller.js');
            // signalement et modération
            const sig = await appel(C.jeton, 'POST', `/comments/${r1.id}/report`, { reason: 'déplacé' });
            await appel(C.jeton, 'POST', `/comments/${r1.id}/report`, { reason: 'encore' });
            const [nb] = await J.sql('SELECT COUNT(*) AS n FROM reports WHERE comment_id = ?', [r1.id]);
            essai('un même lecteur ne signale qu’une fois', sig.statut === 200 && nb.n === 1, `${nb.n} signalement(s)`, 'basse', 'server/controllers/user.controller.js');
            const rapports = await appel(A.jeton, 'GET', '/admin/reports'); const rid = rapports.json && rapports.json[0] && rapports.json[0].id;
            essai('le signalement arrive à la modération', !!rid, rapports.statut);
            if (rid) { await appel(A.jeton, 'POST', `/admin/reports/${rid}/resolve`, { action: 'delete' }); const [reste] = await J.sql("SELECT COUNT(*) AS n FROM comments WHERE text IN ('racine publique', 'une réponse')"); essai('supprimer un commentaire signalé emporte ses réponses', reste.n === 0, reste.n); }
            const long = await appel(C.jeton, 'POST', '/comments/oeuvre', { text: 'x'.repeat(1001) }); essai('commentaire trop long refusé', long.statut === 400, long.statut, 'basse', 'server/controllers/user.controller.js');
            let freine = 0; for (let i = 0; i < 80 && !freine; i++) { const r = await appel(C.jeton, 'POST', '/comments/spam', { text: 'spam ' + i }); if (r.statut === 429) freine = i + 1; }
            ctx.mesure('admin_commentaires_avant_limite', freine || 'aucune limite en 80 envois');
            essai('rafale de commentaires freinée', !!freine, freine ? freine : 'aucun 429 en 80 envois', 'moyenne', 'server/middleware/security.js');
            // bannissement
            essai('bannissement accepté', (await appel(A.jeton, 'PUT', `/admin/users/${C.id}/ban`, { banned: true })).statut === 200);
            essai('compte banni : requêtes refusées', (await appel(C.jeton, 'GET', '/me/favorites')).statut === 403, '', 'haute', 'server/middleware/auth.js');
            const reco = await appel(null, 'POST', '/auth/login', { email: C.email, password: C.mdp });
            essai('compte banni : reconnexion refusée', reco.statut >= 400, `connexion → ${reco.statut} ; un jeton est délivré à un compte suspendu`, 'basse', 'server/controllers/auth.controller.js');
            const anonB = await appel(C.jeton, 'GET', '/comments/oeuvre');
            ctx.mesure('admin_banni_lecture_optionnelle', anonB.statut);
            // deux administrateurs peuvent se retirer mutuellement
            await appel(A.jeton, 'PUT', `/admin/users/${B.id}/role`, { role: 'admin' }); await appel(B.jeton, 'PUT', `/admin/users/${A.id}/role`, { role: 'user' });
            const [adm] = await J.sql("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND banned = 0"); essai('il reste toujours un administrateur', adm.n >= 1, adm.n, 'haute');
            await appel(B.jeton, 'POST', '/auth/delete', { password: B.mdp }); const [adm2] = await J.sql("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND banned = 0");
            essai('le dernier administrateur ne peut pas disparaître', adm2.n >= 1, 'Le dernier administrateur a supprimé son compte : l\'instance n\'en a plus aucun.', 'moyenne', 'server/controllers/auth.controller.js');
            ctx.mesure('admin_essais', verdicts.length); ctx.mesure('admin_essais_tenus', verdicts.filter(v => v.ok).length); ctx.mesure('admin_verdicts', verdicts);
        } finally { await J.arreter(); }
    },
};
