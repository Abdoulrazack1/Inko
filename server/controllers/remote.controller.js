// ============================================================
// remote.controller.js — la télécommande (P3.1)
// ------------------------------------------------------------
// Trois routes, et un principe : le hub ne fait que RELAYER. Il ne sait pas ce
// qu'affiche l'écran piloté, il ne garde aucune commande, et il ne décide de
// rien. Toute l'intelligence est dans le lecteur qui reçoit.
//
// C'est ce qui rend la fonction sûre à ajouter : elle ne peut pas désynchroniser
// un état qu'elle ne détient pas.
'use strict';

const tc = require('../lib/telecommande');

// La liste FERMÉE des commandes acceptées. Un relais qui transmettrait
// n'importe quoi confierait au premier appareil appairé le soin de dire au
// lecteur quoi exécuter — ce serait une porte ouverte, pas une télécommande.
const ACTIONS = new Set([
    'page-suivante', 'page-precedente',
    'chapitre-suivant', 'chapitre-precedent',
    'aller-a-la-page',
    'plein-ecran', 'reglages',
    'defilement-auto',
]);

/** GET /api/me/remote/stream — l'écran qui lit s'abonne. */
function flux(req, res) {
    const etiquette = String(req.query.nom || '').slice(0, 40);
    tc.abonner(req.user.id, req, res, etiquette);
}

/** POST /api/me/remote — l'appareil qui pilote envoie une commande. */
function commander(req, res, next) {
    try {
        const action = String(req.body?.action || '');
        if (!ACTIONS.has(action)) {
            return res.status(400).json({
                error: 'Commande inconnue',
                code: 'ACTION_INCONNUE',
                // On DIT ce qui est accepté : une télécommande qui répond
                // « non » sans expliquer est indébogable depuis un téléphone.
                acceptees: [...ACTIONS],
            });
        }
        // Une seule donnée passe, et elle est bornée : le numéro de page. Tout
        // le reste de la charge est ignoré — le relais ne transmet pas ce
        // qu'il ne comprend pas.
        //
        // ⚠ `Number(null)` vaut 0, PAS NaN. Sans le test d'absence ci-dessous,
        // une commande sans valeur passait le contrôle de finitude et se
        // faisait ramener à 1 par la borne basse — c'est-à-dire qu'un
        // « aller-a-la-page » mal formé renvoyait le lecteur au DÉBUT du
        // chapitre. Mesuré : `{action:'aller-a-la-page'}` → `valeur: 1`.
        const donnee = req.body?.valeur;
        const absente = donnee === null || donnee === undefined || donnee === '';
        const brut = Number(donnee);
        const valeur = (!absente && Number.isFinite(brut))
            ? Math.max(1, Math.min(9999, Math.round(brut)))
            : null;

        // Cette action-là n'a aucun sens sans son numéro. La refuser au relais
        // vaut mieux que laisser chaque lecteur deviner quoi faire d'un `null`.
        if (action === 'aller-a-la-page' && valeur === null) {
            return res.status(400).json({
                error: 'Cette commande demande un numéro de page',
                code: 'VALEUR_REQUISE',
            });
        }

        const touches = tc.envoyer(req.user.id, {
            action,
            valeur,
            a: Date.now(),
        });
        // `0` n'est pas une erreur : c'est « aucun écran n'écoute ». La
        // distinction compte pour l'interface, qui doit dire « ouvre un
        // chapitre sur le PC » plutôt que « échec ».
        res.json({ envoye: true, ecrans: touches });
    } catch (e) { next(e); }
}

/** GET /api/me/remote/ecrans — y a-t-il quelque chose à piloter ? */
function ecrans(req, res, next) {
    try {
        res.json({ ecrans: tc.ecoutes(req.user.id) });
    } catch (e) { next(e); }
}

module.exports = { flux, commander, ecrans };
