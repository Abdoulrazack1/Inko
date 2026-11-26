// nouveautes — la détection des nouveaux chapitres et la progression entre appareils :
// toutes les séries sont-elles annoncées, une horloge déréglée bloque-t-elle la position,
// et vers quelles adresses le serveur accepte-t-il d'envoyer des notifications ?
'use strict';
const net = require('net');
const crypto = require('crypto');
const { demarrer } = require('./_jetable');
const { jouer } = require('./_enfant');

const SERIES = 12, SENTINELLE = 8163;

module.exports = {
    nom: 'nouveautes',
    description: 'Notifications de nouveaux chapitres (source simulée), horloge d\'un appareil, adresses de notification',
    async run(ctx) {
        const T = (gravite, id, titre, detail, correctif, fichier, extra = {}) => ctx.trouver({ gravite, id, categorie: 'fonctionnement', titre, detail, correctif, fichier, effort: 'S', ...extra });
        const J = await demarrer(ctx, { base: 'inko_s_nouv', port: 8164 });
        if (!J) return;
        let connexions = 0;
        const sentinelle = net.createServer((s) => { connexions++; s.on('error', () => { }); s.destroy(); });
        const releves = {};
        try {
            await new Promise(ok => sentinelle.listen(SENTINELLE, '127.0.0.1', ok));
            // ── une adresse interne comme destination de notification ──
            const ecdh = crypto.createECDH('prime256v1'); ecdh.generateKeys();
            const abo = await J.api('POST', '/me/push/subscribe', { endpoint: `https://127.0.0.1:${SENTINELLE}/service-interne`, keys: { p256dh: ecdh.getPublicKey('base64url'), auth: crypto.randomBytes(16).toString('base64url') } });
            // ── douze séries suivies, un chapitre de retard chacune ──
            for (let i = 1; i <= SERIES; i++) await J.api('POST', '/me/favorites', { mangaId: 'suivi-' + i, source: 'fausse', title: 'Série ' + i });
            await J.sql('UPDATE favorites SET last_chapter = 10, notify = 1');
            for (let i = 1; i <= SERIES; i++) await J.api('PUT', '/me/progress/suivi-' + i, { chapterId: 'ch-10', chapter: 10, page: 1, source: 'fausse' });
            const r = await jouer(ctx, '_enfant-nouveautes.js', 'inko_s_nouv', { series: SERIES }, { UPDATES_MEMO_MS: '1' });
            releves.nouveautes = r; releves.abonnement = abo.statut; releves.connexionsVersLAdresseInterne = connexions;
            if (r.erreur) T('info', 'NOUV-NON-EPROUVE', 'Tâche de fond : essai impossible', r.erreur, '', 'server/lib/updates.js');
            else if (r.passages[r.passages.length - 1] < SERIES) T('haute', 'NOUV-ANNONCES-PERDUES', `Nouveaux chapitres : seules ${r.passages[0]} séries sur ${SERIES} sont annoncées, les autres ne le seront jamais`, `Trois passages de la tâche de fond, ${SERIES} séries avec un chapitre de plus : séries annoncées après chaque passage = ${r.passages.join(', ')}. Le code garde au plus cinq annonces par passage « le reste au cycle suivant », mais le même passage enregistre le dernier chapitre de toutes les séries (${r.aJour} sur ${SERIES}) : au suivant, plus aucune n'est considérée comme nouvelle.`, 'N\'enregistrer le dernier chapitre annoncé qu\'après l\'annonce, ou regrouper en une notification « et N autres ».', 'server/lib/updates.js');
            if (connexions) T('moyenne', 'NOUV-DESTINATION-LIBRE', 'Un compte peut faire envoyer des requêtes du serveur vers n\'importe quelle adresse, interne comprise', `Abonnement de notification accepté (HTTP ${abo.statut}) avec une adresse de la machine elle-même ; au scan suivant le serveur s'y est connecté ${connexions} fois. Le contenu est chiffré et la réponse n'est pas rendue, mais c'est un moyen d'atteindre le réseau interne.`, 'N\'accepter que les services de notification connus (HTTPS, adresses publiques).', 'server/controllers/notif.controller.js', { categorie: 'sécurité' });
            // ── un appareil dont l'horloge avance d'un an ──
            const futur = new Date(Date.now() + 365 * 86400000).toISOString();
            await J.api('PUT', '/me/progress/horloge', { chapterId: 'c3', chapter: 3, page: 1, source: 'fausse', clientAt: futur });
            const apres = await J.api('PUT', '/me/progress/horloge', { chapterId: 'c8', chapter: 8, page: 4, source: 'fausse', clientAt: new Date().toISOString() });
            const [pos] = await J.sql("SELECT chapter_number AS n, updated_at AS le FROM progress WHERE manga_id = 'horloge'");
            const lointain = await J.api('PUT', '/me/progress/horloge2', { chapterId: 'c1', chapter: 1, page: 1, source: 'fausse', clientAt: '2150-01-01T00:00:00.000Z' });
            await J.api('PUT', '/me/progress/prologue', { chapterId: 'c0', chapter: 0, page: 2, source: 'fausse' });
            const [zero] = await J.sql("SELECT chapter_number AS n FROM progress WHERE manga_id = 'prologue'");
            releves.horloge = { reponse: apres.statut, enBase: pos && Number(pos.n), date: pos && pos.le, annee2150: lointain.statut, chapitreZero: zero ? zero.n : 'absent' };
            if (pos && Number(pos.n) === 3) T('haute', 'NOUV-HORLOGE-BLOQUE', 'Un appareil à l\'heure fausse fige la position de lecture sur tous les autres', `Un enregistrement daté d'un an dans le futur (chapitre 3), puis un enregistrement normal (chapitre 8) : le serveur répond ${apres.statut} « réussi », la base garde le chapitre 3. La position reste figée jusqu'à ce que la date rattrape celle du premier appareil. Une date très lointaine (2150) provoque une erreur ${lointain.statut}.`, 'Borner la date du client à l\'heure du serveur (quelques minutes de tolérance).', 'server/controllers/user.controller.js');
            if (zero && zero.n === null) T('moyenne', 'NOUV-CHAPITRE-ZERO', 'La position au chapitre 0 (prologue) est enregistrée sans numéro', 'Envoyé : chapitre 0. En base : numéro vide (`chapter || null`).', 'Tester `chapter ?? null`.', 'server/controllers/user.controller.js');
            ctx.mesure('nouveautes_releves', releves);
        } finally { sentinelle.close(); await J.arreter(); }
    },
};
