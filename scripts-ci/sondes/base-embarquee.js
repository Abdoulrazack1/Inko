// base-embarquee — la base de données livrée avec l'application de bureau : comptes, mots de
// passe, adresses d'écoute. Jouée avec les binaires du paquet, dans un profil jetable.
'use strict';
const cp = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PORT = 3499;

module.exports = {
    nom: 'base-embarquee',
    description: 'MariaDB livrée avec l\'application, démarrée dans un profil jetable : comptes, accès, écoute',
    async run(ctx) {
        const binaires = ctx.abs('desktop-tauri', 'src-tauri', 'resources', 'mariadb');
        if (process.platform !== 'win32' || !fs.existsSync(path.join(binaires, 'bin', 'mariadbd.exe'))) { ctx.trouver({ gravite: 'info', id: 'BDE-ABSENTE', titre: 'Base embarquée non éprouvée : binaires absents' }); return; }
        const profil = fs.mkdtempSync(path.join(os.tmpdir(), 'inko-embarquee-'));
        const T = (gravite, id, titre, detail, correctif) => ctx.trouver({ gravite, id, categorie: 'sécurité', titre, detail, correctif, effort: 'S', fichier: 'server/lib/embedded-db.js' });
        try {
            const r = await new Promise((ok) => cp.execFile(process.execPath, [path.join(__dirname, '_enfant-embarquee.js'), ctx.racine], {
                cwd: ctx.abs('server'), timeout: 200000, windowsHide: true,
                env: { ...process.env, APPDATA: profil, TEMP: profil, TMP: profil, INKO_MARIADB_DIR: binaires, INKO_EMBEDDED_DB_PORT: String(PORT), DB_HOST: '127.0.0.1', DB_PORT: '1', DB_USER: 'root', DB_PASSWORD: '', DB_NAME: 'inko_s_embarquee' },
            }, (e, sortie, erreur) => { const t = String(sortie), i = t.lastIndexOf('@@{'), j = t.indexOf('@@fin', i); ok(i >= 0 && j > i ? JSON.parse(t.slice(i + 2, j)) : { erreur: String(erreur || (e && e.message)).slice(-600) }); }));
            ctx.mesure('base_embarquee', r);
            if (r.erreur) { T('info', 'BDE-NON-EPROUVE', 'Base embarquée : essai impossible', r.erreur, ''); return; }
            if (r.installationNeuve) ctx.trouver({ gravite: 'critique', id: 'BDE-INSTALLATION-NEUVE', categorie: 'bug', effort: 'S', fichier: 'server/lib/embedded-db.js', titre: 'Installation neuve : la base de données ne se crée pas, l’application ne démarre jamais', detail: `Premier démarrage de la base livrée avec l'application, dans un profil vierge : « ${r.installationNeuve} ». La connexion qui joue schema.sql ne choisit aucune base, et le fichier n'en choisit plus depuis la version 2.5.0. Les installations déjà initialisées, ou reliées à un MySQL existant et rempli, ne le voient pas.`, correctif: 'Passer database: DB_NAME à la connexion qui applique le schéma, et jouer une installation neuve avant chaque publication.' });
            const refus = [r.secondDemarrage, r.connexionAvecMotDePasse].find(x => typeof x === 'string' && /Access denied/.test(x));
            if (refus) ctx.trouver({ gravite: 'critique', id: 'BDE-MOT-DE-PASSE-REFUSE', categorie: 'bug', effort: 'S', fichier: 'server/lib/embedded-db.js', titre: 'Base embarquée neuve : l’application se voit refuser la connexion avec le mot de passe qu’elle vient de poser', detail: `Même une fois la structure en place (posée à la main pour l’essai), le démarrage suivant échoue : « ${refus} ». Le mot de passe n’est posé que sur root@localhost, alors que la connexion arrive comme root@127.0.0.1, resté sans mot de passe.`, correctif: 'Poser le mot de passe sur tous les comptes root (ou n’en garder qu’un), puis vérifier par une vraie reconnexion.' });
            const vides = (r.comptes || []).filter(c => !c.motDePasse);
            const table = (r.comptes || []).map(c => `${c.utilisateur || '(anonyme)'}@${c.hote} : ${c.motDePasse ? 'avec' : 'SANS'} mot de passe`).join('\n');
            if (r.rootSansMotDePasse) T('haute', 'BDE-ROOT-SANS-MOT-DE-PASSE', 'Base embarquée : le compte administrateur reste ouvert sans mot de passe', `Après le démarrage et la pose annoncée du mot de passe, une connexion « root » sans mot de passe réussit.\n${table}`, 'Protéger ou supprimer tous les comptes root, pas seulement root@localhost.');
            else if (vides.some(c => c.utilisateur === 'root')) T('moyenne', 'BDE-COMPTE-VIDE', 'Base embarquée : des comptes administrateur sans mot de passe subsistent', table, 'Supprimer les comptes inutilisés.');
            if (r.anonyme) T('moyenne', 'BDE-ANONYME', 'Base embarquée : une connexion anonyme est acceptée', `Compte obtenu : ${r.anonyme}. Bases visibles : ${(r.basesVuesParAnonyme || []).join(', ')}.\n${table}`, 'Supprimer les comptes anonymes et la base « test ».');
            if ((r.ecoute || []).some(a => !/^(127\.0\.0\.1|\[::1\])/.test(a))) T('haute', 'BDE-RESEAU', 'Base embarquée : elle écoute au-delà de la machine', r.ecoute.join(', '), 'bind-address=127.0.0.1');
        } finally {
            for (let i = 0; i < 10; i++) { try { fs.rmSync(profil, { recursive: true, force: true }); break; } catch (e) { await new Promise(ok => setTimeout(ok, 700)); } }
        }
    },
};
