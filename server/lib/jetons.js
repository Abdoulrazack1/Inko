// ============================================================
// lib/jetons.js — Un compteur de jetons, pour borner ce qui part vers l'amont
// ------------------------------------------------------------
// Rien ne bornait le nombre de telechargements SIMULTANES vers une source.
// La protection existait seulement cote client, sous forme de constantes qui
// supposent chacune etre seule : le lecteur s'autorise trois pages en
// parallele, la file de telechargement une de plus, et un second onglet
// recommence le compte a zero. Le hub, lui, est le point par lequel tout
// passe — c'est donc la seule place ou la borne veut dire quelque chose.
//
// Deux raisons de la poser, toutes deux deja mesurees et ecrites ailleurs
// dans ce depot :
//
//   · la latence se degrade avec le parallelisme. Sur une planche de 225 Ko :
//     3 700 a 9 000 ms une par une, 17 000 a 25 000 ms quand plusieurs
//     partent ensemble. Lancer plus de requetes rend chacune plus lente, et
//     au-dela d'un certain point la page entiere arrive PLUS TARD ;
//   · une rafale de requetes simultanees est ce qui fait bannir une adresse
//     IP. C'est la raison pour laquelle les telechargements sont deja en
//     serie, et elle vaut tout autant ici.
//
// Ce n'est PAS une adaptation a la latence. Celle-ci varie d'un facteur trois
// d'un moment a l'autre : un reglage asservi a cette mesure poursuivrait du
// bruit, et la decision de ne pas le faire est deja ecrite, mesures a l'appui,
// dans `image.controller.js`. Une borne fixe ne pretend rien deviner — elle
// empeche seulement le pire cas.
// ============================================================
'use strict';

/**
 * Cree un compteur de `max` jetons.
 *
 * `prendre()` rend une promesse resolue quand un jeton est libre ; l'appelant
 * DOIT appeler la fonction rendue pour le relacher. La forme « la promesse
 * rend son propre liberateur » evite l'erreur classique du verrou relache
 * deux fois : chaque liberateur n'agit qu'une fois.
 */
function creerJetons(max) {
    const plafond = Math.max(1, parseInt(max, 10) || 1);
    let actifs = 0;
    const attente = [];

    function liberateur() {
        let rendu = false;
        return () => {
            if (rendu) return;            // un double appel ne doit pas ouvrir un jeton de plus
            rendu = true;
            const suivant = attente.shift();
            // Le jeton passe directement au suivant : le decrementer puis le
            // reincrementer laisserait une fenetre ou un troisieme appelant
            // se glisse au-dessus du plafond.
            if (suivant) suivant(liberateur());
            else actifs--;
        };
    }

    return {
        prendre() {
            if (actifs < plafond) { actifs++; return Promise.resolve(liberateur()); }
            return new Promise(resoudre => attente.push(resoudre));
        },
        /** Pour les tests et le diagnostic : ce qui tourne, ce qui attend. */
        etat() { return { actifs, enAttente: attente.length, plafond }; },
    };
}

module.exports = { creerJetons };
