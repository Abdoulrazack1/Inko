// _enfant.js — exécute un scénario avec les modules du serveur, dans un processus à part,
// sur une base JETABLE (jamais la vraie : le nom est vérifié avant tout chargement).
'use strict';
const cp = require('child_process');
const path = require('path');
const crypto = require('crypto');

/** Joue `scenario` (fichier voisin) et rend le JSON qu'il écrit après « @@ ». */
function jouer(ctx, scenario, base, args = {}, env = {}) {
    if (!/^inko_s_/.test(base)) throw new Error(`base non jetable : ${base}`);
    const ecdh = crypto.createECDH('prime256v1'); ecdh.generateKeys();
    return new Promise((ok) => {
        cp.execFile(process.execPath, [path.join(__dirname, scenario), ctx.racine, base, JSON.stringify(args)], {
            cwd: ctx.abs('server'), timeout: 120000, windowsHide: true, maxBuffer: 8e6,
            // des clés de notification éphémères : rien n'est écrit dans server/config
            env: { ...process.env, DB_NAME: base, INKO_MDNS: '0', VAPID_PUBLIC_KEY: ecdh.getPublicKey('base64url'), VAPID_PRIVATE_KEY: ecdh.getPrivateKey('base64url'), ...env },
        }, (e, sortie, erreur) => {
            const i = String(sortie).lastIndexOf('@@{');
            if (i >= 0) return ok(JSON.parse(String(sortie).slice(i + 2)));
            ok({ erreur: String(erreur || (e && e.message) || 'sortie illisible').slice(-700) });
        });
    });
}

/** Côté enfant : charge l'environnement du serveur en gardant la base jetable. */
function preparer() {
    const [racine, base, args] = process.argv.slice(2);
    if (!/^inko_s_/.test(base)) throw new Error('base non jetable');
    require(path.join(racine, 'server', 'node_modules', 'dotenv')).config({ path: path.join(racine, 'server', '.env'), quiet: true });
    process.env.DB_NAME = base;
    const dire = (o) => { process.stdout.write('@@' + JSON.stringify(o)); };
    return { racine, base, args: JSON.parse(args), dire, srv: (...p) => require(path.join(racine, 'server', ...p)) };
}

module.exports = { jouer, preparer };
