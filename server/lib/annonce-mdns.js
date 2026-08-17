// ============================================================
// annonce-mdns.js — le hub se fait trouver tout seul (P2.8)
// ------------------------------------------------------------
// Audit VIII.44, point 2 : « Re-découverte mDNS au démarrage : chercher
// `_inko._tcp.local`, comparer le `hub_id` annoncé, mettre à jour l'adresse en
// silence. »
//
// Le problème qu'il résout : le PC reçoit son adresse en DHCP. Au redémarrage
// de la box, `192.168.1.34` devient `192.168.1.52`, et tout appareil qui avait
// mémorisé l'adresse perd le hub. Aujourd'hui il faut rescanner un QR devant
// le PC — pour un changement dont l'utilisateur n'est pas responsable et qu'il
// ne comprend pas.
//
// ── L'ORDRE compte, et l'audit le dit ───────────────────────
//
// « Sans le point 1, le point 2 est dangereux. » Le point 1 est l'identité du
// hub, faite précédemment. Sans elle, un téléphone qui découvre un service
// `_inko._tcp` sur le réseau se connecterait au PREMIER venu — sur un Wi-Fi
// partagé, il suffirait d'annoncer le bon service pour récupérer une
// bibliothèque et un jeton d'appareil.
//
// C'est pourquoi le `hubId` voyage dans l'enregistrement TXT : la découverte
// ne fait que PROPOSER une adresse. C'est l'identité, vérifiée à l'arrivée,
// qui décide si on lui parle.
//
// ── Ce que l'annonce n'est pas ──────────────────────────────
//
// Elle ne remplace pas l'appairage. Un appareil découvert n'est pas un
// appareil autorisé : il lui faut toujours un code obtenu devant le PC. La
// découverte sert à RETROUVER un hub déjà connu, pas à en adopter un nouveau.
//
// ── Pourquoi ça peut ne pas marcher, et pourquoi on continue ─
//
// mDNS est filtré sur beaucoup de réseaux — Wi-Fi invité, isolation de points
// d'accès, certains routeurs grand public, la plupart des réseaux d'entreprise.
// L'annonce est donc un CONFORT : elle échoue silencieusement là où elle est
// bloquée, et la saisie manuelle de l'adresse reste le chemin garanti.
// Un hub qui refuserait de démarrer parce que le multicast est filtré serait
// un hub inutilisable au bureau.
'use strict';

const os = require('os');

const SERVICE = 'inko';           // → _inko._tcp.local
const DESACTIVE = process.env.INKO_MDNS === '0';

let _bonjour = null;
let _service = null;

/** Un nom lisible dans la liste des hubs : « Inko sur PC-DE-KAITO ». */
function nomInstance() {
    const machine = (os.hostname() || 'PC').replace(/\.local$/i, '').slice(0, 40);
    return `Inko sur ${machine}`;
}

/**
 * Publie le service sur le réseau local.
 *
 * @param {number} port  le port RÉEL d'écoute — pas une constante : le hub
 *   peut tourner derrière un autre port (PORT, Docker, reverse proxy), et
 *   annoncer 8088 enverrait les téléphones sur une porte fermée.
 * @param {string|null} hubId
 */
async function demarrer(port, hubId) {
    if (DESACTIVE || _service) return false;
    // Sans identité, on n'annonce RIEN. Un service découvrable sans moyen de
    // vérifier à qui l'on parle est précisément le danger que l'audit signale.
    if (!hubId) {
        console.warn('[mdns] pas d’identité de hub — annonce non publiée (voir lib/identite-hub.js)');
        return false;
    }
    try {
        const { Bonjour } = require('bonjour-service');
        _bonjour = new Bonjour();
        _service = _bonjour.publish({
            name: nomInstance(),
            type: SERVICE,
            port,
            txt: {
                // Ce que le téléphone lit AVANT de faire confiance à l'adresse.
                hub: hubId,
                // La version du format d'annonce : si un jour le TXT change de
                // sens, un vieux téléphone doit pouvoir s'abstenir plutôt que
                // de mal l'interpréter.
                v: '1',
            },
        });
        console.log(`[mdns] « ${nomInstance()} » annoncé sur _${SERVICE}._tcp.local:${port}`);
        return true;
    } catch (e) {
        // Multicast filtré, socket refusée, pare-feu : rien de tout cela ne
        // doit empêcher le hub de servir. La saisie manuelle reste le chemin
        // garanti, et c'est celui que l'écran de configuration propose.
        console.warn(`[mdns] annonce impossible (${e.message}) — la saisie manuelle de l’adresse reste disponible`);
        _bonjour = null;
        _service = null;
        return false;
    }
}

/**
 * Retire l'annonce. Appelé à l'arrêt : un service qui reste annoncé après la
 * fermeture du hub envoie les téléphones sur une adresse morte, et le délai
 * d'expiration mDNS se compte en minutes.
 */
function arreter() {
    return new Promise((resolve) => {
        if (!_bonjour) return resolve();
        try {
            _bonjour.unpublishAll(() => {
                try { _bonjour.destroy(); } catch (e) { /* déjà fermé */ }
                _bonjour = null;
                _service = null;
                resolve();
            });
            // L'arrêt ne doit pas retenir le processus : si le retrait traîne,
            // on ferme quand même.
            setTimeout(resolve, 1200);
        } catch (e) { resolve(); }
    });
}

function actif() { return !!_service; }

module.exports = { demarrer, arreter, actif, nomInstance, SERVICE };
