// ============================================================
// telecommande.js — piloter la lecture d'un appareil depuis un autre (P3.1)
// ------------------------------------------------------------
// Le cas d'usage tient en une phrase : on lit sur l'écran du salon, et on
// tourne les pages depuis le téléphone qu'on a déjà en main. Sans ça, il faut
// se lever, ou garder un clavier sur les genoux.
//
// ── Pourquoi SSE, et pas WebSocket ──────────────────────────
//
// Le trafic est ASYMÉTRIQUE et minuscule : quelques octets du téléphone vers
// le PC, rien dans l'autre sens. SSE fait exactement ça, sur du HTTP ordinaire
// — il traverse les proxys, se reconnecte tout seul (`EventSource` réessaie),
// et n'ajoute aucune dépendance. Un WebSocket demanderait une bibliothèque,
// une négociation de protocole et une gestion de reconnexion écrite à la main,
// pour transporter « page suivante ».
//
// ── Ce que ce module refuse de faire ────────────────────────
//
// Il ne stocke RIEN. Une commande non délivrée est perdue, et c'est voulu :
// « page suivante » rejouée trois minutes plus tard, quand l'écran affiche
// autre chose, ferait sauter des pages sans qu'on comprenne pourquoi. Une
// télécommande qui garde une mémoire est une télécommande qu'on n'ose plus
// utiliser.
//
// Il ne traverse JAMAIS les comptes. Les flux sont indexés par utilisateur, et
// une commande ne part que vers les appareils du même compte — sur un hub
// familial, personne ne tourne les pages de quelqu'un d'autre.
'use strict';

// userId → Set de réponses HTTP ouvertes.
const flux = new Map();

// Un navigateur laissé ouvert des jours rouvrirait un flux à chaque
// rechargement. Sans plafond, la mémoire du hub suit le nombre d'onglets
// jamais fermés — et personne ne relie jamais ces deux choses.
const MAX_PAR_UTILISATEUR = 8;

// Les proxys et les pare-feu coupent une connexion inactive, souvent vers
// 30-60 secondes. Un commentaire SSE périodique la garde ouverte sans rien
// signifier pour le client.
const BATTEMENT_MS = 25000;

/**
 * Ouvre un flux pour cet utilisateur.
 * @returns {Function} à appeler pour fermer proprement
 */
function abonner(userId, req, res, etiquette) {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        // Sans ça, un reverse proxy nginx met le flux en tampon et rien
        // n'arrive avant plusieurs kilo-octets — c'est-à-dire jamais, pour des
        // messages de trente octets.
        'X-Accel-Buffering': 'no',
    });
    res.write(': connecte\n\n');
    if (res.flushHeaders) res.flushHeaders();

    let ouverts = flux.get(userId);
    if (!ouverts) { ouverts = new Set(); flux.set(userId, ouverts); }

    // Au-delà du plafond, on ferme le PLUS ANCIEN plutôt que de refuser le
    // nouveau : c'est celui-là qui a le plus de chances d'être un onglet
    // oublié, et refuser le dernier arrivé donnerait une télécommande qui
    // cesse de marcher sans raison visible.
    while (ouverts.size >= MAX_PAR_UTILISATEUR) {
        const plusAncien = ouverts.values().next().value;
        ouverts.delete(plusAncien);
        try { plusAncien.end(); } catch (e) { /* déjà fermé */ }
    }

    res._inkoEtiquette = String(etiquette || '').slice(0, 40) || 'appareil';
    ouverts.add(res);

    const battement = setInterval(() => {
        try { res.write(': battement\n\n'); } catch (e) { fermer(); }
    }, BATTEMENT_MS);
    if (battement.unref) battement.unref();

    let ferme = false;
    function fermer() {
        if (ferme) return;
        ferme = true;
        clearInterval(battement);
        const s = flux.get(userId);
        if (s) { s.delete(res); if (!s.size) flux.delete(userId); }
        try { res.end(); } catch (e) { /* déjà fermé */ }
    }

    // `close` sur la REQUÊTE : c'est lui qui se déclenche quand le client
    // disparaît sans prévenir — onglet fermé, Wi-Fi coupé, veille. S'appuyer
    // seulement sur une déconnexion propre laisserait des flux fantômes.
    req.on('close', fermer);
    req.on('error', fermer);
    return fermer;
}

/**
 * Envoie une commande aux appareils de cet utilisateur.
 * @param {number} userId
 * @param {object} commande  { action, valeur?, de? }
 * @returns {number} nombre d'appareils touchés
 */
function envoyer(userId, commande) {
    const ouverts = flux.get(userId);
    if (!ouverts || !ouverts.size) return 0;
    const charge = JSON.stringify(commande);
    let n = 0;
    for (const res of [...ouverts]) {
        try {
            res.write(`event: commande\ndata: ${charge}\n\n`);
            n++;
        } catch (e) {
            // Un flux mort ne doit pas empêcher les autres de recevoir.
            ouverts.delete(res);
        }
    }
    if (!ouverts.size) flux.delete(userId);
    return n;
}

/** Ce que l'utilisateur peut piloter, et rien d'autre. */
function ecoutes(userId) {
    const ouverts = flux.get(userId);
    if (!ouverts) return [];
    return [...ouverts].map((r) => r._inkoEtiquette);
}

function _etat() {
    let total = 0;
    for (const s of flux.values()) total += s.size;
    return { utilisateurs: flux.size, flux: total };
}

module.exports = { abonner, envoyer, ecoutes, _etat, MAX_PAR_UTILISATEUR };
