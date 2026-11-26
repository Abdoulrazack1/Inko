// _jetable.js — démarre un serveur Inko sur une base JETABLE (créée puis détruite)
// Rien de la vraie base ni de server/config n'est touché : les routes qui écrivent
// des fichiers de configuration sont à bloquer côté navigateur (voir boutons.js).
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');
const { requete } = require('./_http');

/**
 * @param {*} ctx contexte de sonde
 * @param {{base?:string, port?:number, local?:boolean}} o
 * @returns {Promise<{url:string, jeton:string, api:Function, sql:Function, journal:()=>string, arreter:()=>Promise<void>}|null>}
 */
async function demarrer(ctx, o = {}) {
    const NOM = o.base || 'inko_sonde_b', PORT = o.port || 8096;
    const mysql = require(path.join(ctx.racine, 'server', 'node_modules', 'mysql2', 'promise'));
    require(path.join(ctx.racine, 'server', 'node_modules', 'dotenv')).config({ path: path.join(ctx.racine, 'server', '.env'), quiet: true });
    const admin = await mysql.createConnection({ host: process.env.DB_HOST || '127.0.0.1', port: +(process.env.DB_PORT || 3306), user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD || '', multipleStatements: true, connectTimeout: 4000 });
    const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'inko-sonde-'));
    let serveur, journal = '';
    const arreter = async () => {
        try { if (serveur) serveur.kill(); } catch (e) { /* déjà arrêté */ }
        try { await admin.query('DROP DATABASE IF EXISTS `' + NOM + '`'); await admin.end(); } catch (e) { /* idem */ }
        try { fs.rmSync(dossier, { recursive: true, force: true }); } catch (e) { /* idem */ }
        try { const u = ctx.abs('server', 'uploads'); for (const n of fs.readdirSync(u)) if (/^\d+$/.test(n) && +n >= PORT * 1000 && +n < PORT * 1000 + 1000) fs.rmSync(path.join(u, n), { recursive: true, force: true }); } catch (e) { /* aucun import */ }
    };
    try {
        await admin.query('DROP DATABASE IF EXISTS `' + NOM + '`');
        await admin.query('CREATE DATABASE `' + NOM + '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
        await admin.query('USE `' + NOM + '`');
        await admin.query(require('./_garde-sql').sansBaseImposee(fs.readFileSync(ctx.abs('server', 'db', 'schema.sql'), 'utf8'), NOM));
        // Les fichiers importés vivent dans server/uploads/<compte>, dossier réel : des
        // identifiants très hauts, propres à chaque banc, évitent d'y croiser un vrai compte
        // (la suppression d'un compte efface son dossier).
        await admin.query('ALTER TABLE users AUTO_INCREMENT = ' + PORT * 1000);
        // dossier temporaire isolé : les sources y écrivent des caches que la vraie application relirait
        const tmp = path.join(dossier, 'tmp'); fs.mkdirSync(tmp, { recursive: true });
        serveur = cp.spawn(process.execPath, [ctx.abs('server', 'server.js')], {
            cwd: ctx.abs('server'), windowsHide: true,
            // profil utilisateur isolé : ni les secrets, ni le cache d'images réels ne sont touchés
            env: { ...process.env, TEMP: tmp, TMP: tmp, TMPDIR: tmp, APPDATA: path.join(dossier, 'profil'), PORT: String(PORT), DB_NAME: NOM, LOCAL_MODE: o.local === false ? '0' : '1', DISABLE_BACKUPS: '1', INKO_MDNS: '0', BACKUP_DIR: dossier, IMG_RATE_MAX: '5000', SEARCH_RATE_MAX: '2000', LOCAL_RATE_FACTOR: '20', ...(o.env || {}) },
        });
        serveur.stdout.on('data', d => { journal += d; }); serveur.stderr.on('data', d => { journal += d; });
        const url = 'http://127.0.0.1:' + PORT;
        let pret = false;
        for (let i = 0; i < 80 && !pret; i++) { await new Promise(r => setTimeout(r, 500)); pret = (await requete(url, '/api/health', { delaiMs: 1500 })).statut === 200; }
        if (!pret) { ctx.trouver({ gravite: 'haute', id: 'JETABLE-DEMARRAGE', titre: 'Le serveur jetable ne démarre pas', detail: journal.slice(-500) }); await arreter(); return null; }
        const auth = await requete(url, '/api/auth/local', { methode: 'POST', corps: {} });
        const jeton = auth.json && auth.json.token;
        const api = (m, p, corps) => requete(url, '/api' + p, { methode: m, corps, jeton });
        const sql = async (q, p) => { const [r] = await admin.query(q, p); return r; };
        return { url, jeton, api, sql, journal: () => journal, arreter };
    } catch (e) { ctx.trouver({ gravite: 'info', id: 'JETABLE-ECHEC', titre: 'Serveur jetable impossible : ' + e.message }); await arreter(); return null; }
}
module.exports = { demarrer };
