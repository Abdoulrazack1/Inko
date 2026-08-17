// ============================================================
// test/unit/telecommande.test.js — le côté client de la télécommande (P3.1)
// ------------------------------------------------------------
// La télécommande a une propriété désagréable : quand elle ne marche pas, il
// n'y a RIEN à voir. Pas d'erreur, pas de message — on appuie, et l'autre écran
// ne bouge pas. Impossible de dire si c'est le réseau, le flux, l'action non
// reconnue, ou un branchement mort côté lecteur.
//
// Ces tests couvrent donc ce qui est invisible à l'œil :
//   — une commande reçue APPELLE bien l'action correspondante ;
//   — une action inconnue ne fait pas tomber le module ;
//   — une action qui lève ne coupe pas le flux (la suivante passe encore) ;
//   — le téléphone, lui, n'ouvre PAS de flux (il n'a pas de cookie, il
//     réessaierait toutes les trois secondes contre un 401) ;
//   — l'obstination est bornée : un hub éteint finit par faire lâcher prise.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..', '..');
const SRC = fs.readFileSync(path.join(ROOT, 'assets', 'js', 'telecommande.js'), 'utf8');

/**
 * Charge le module dans un DOM neuf, avec un `EventSource` factice dont on
 * garde la main : c'est lui qui nous laissera livrer un message comme le
 * ferait le serveur.
 */
function charger({ hub = false } = {}) {
    const dom = new JSDOM('<!doctype html><html><body></body></html>',
        { url: 'http://localhost/chapitre.html', runScripts: 'outside-only' });
    const w = dom.window;

    const flux = [];
    class FauxEventSource {
        constructor(url) {
            this.url = url;
            this.ecoutes = {};
            this.ferme = false;
            flux.push(this);
        }
        addEventListener(t, fn) { (this.ecoutes[t] = this.ecoutes[t] || []).push(fn); }
        close() { this.ferme = true; }
        // Ce que ferait le serveur.
        livrer(objet) { (this.ecoutes.commande || []).forEach((f) => f({ data: JSON.stringify(objet) })); }
        casser() { (this.ecoutes.error || []).forEach((f) => f({})); }
    }
    w.EventSource = FauxEventSource;
    if (hub) w.INKO_HUB = true;
    w.API = { base: '/api' };

    w.eval(SRC);
    return { w, flux, MH: w.MH };
}

test('une commande reçue déclenche l’action, avec sa valeur', () => {
    const { MH, flux } = charger();
    const vus = [];
    MH.telecommande.ecouter({
        'page-suivante': () => vus.push(['suivante', undefined]),
        'aller-a-la-page': (n) => vus.push(['aller', n]),
    });
    assert.equal(flux.length, 1, 'un flux doit être ouvert');
    assert.match(flux[0].url, /^\/api\/me\/remote\/stream\?nom=/);

    flux[0].livrer({ action: 'page-suivante' });
    flux[0].livrer({ action: 'aller-a-la-page', valeur: 42 });
    assert.deepEqual(vus, [['suivante', undefined], ['aller', 42]]);
});

test('une action que CE lecteur ne connaît pas est ignorée sans casser', () => {
    const { MH, flux } = charger();
    let n = 0;
    MH.telecommande.ecouter({ 'page-suivante': () => n++ });

    flux[0].livrer({ action: 'defilement-auto' });   // pas branchée ici
    flux[0].livrer({ action: 'page-suivante' });
    assert.equal(n, 1, 'la commande connue passe encore après une inconnue');
});

test('une action qui lève ne coupe pas le flux', () => {
    // Le vrai risque : une exception dans `goToPage` remonterait dans le
    // gestionnaire, et la télécommande cesserait de répondre pour de bon —
    // sans que rien ne le signale.
    const { MH, flux } = charger();
    let apres = 0;
    MH.telecommande.ecouter({
        'chapitre-suivant': () => { throw new Error('page absente'); },
        'page-suivante': () => apres++,
    });
    flux[0].livrer({ action: 'chapitre-suivant' });
    flux[0].livrer({ action: 'page-suivante' });
    assert.equal(apres, 1);
});

test('des données illisibles ne font pas tomber le module', () => {
    const { MH, flux } = charger();
    let n = 0;
    MH.telecommande.ecouter({ 'page-suivante': () => n++ });
    (flux[0].ecoutes.commande || []).forEach((f) => f({ data: '{pas du json' }));
    flux[0].livrer({ action: 'page-suivante' });
    assert.equal(n, 1);
});

test('sur le téléphone (app native), aucun flux n’est ouvert', () => {
    // `EventSource` ne porte pas d'en-tête `Authorization` : le hub répondrait
    // 401, et le navigateur réessaierait indéfiniment. Sur mobile, la seule
    // conséquence visible serait la batterie.
    const { MH, flux } = charger({ hub: true });
    const ouvert = MH.telecommande.ecouter({ 'page-suivante': () => {} });
    assert.equal(ouvert, false);
    assert.equal(flux.length, 0, 'aucune connexion ne doit être tentée');
});

test('un hub injoignable finit par faire lâcher prise', () => {
    const { MH, flux } = charger();
    MH.telecommande.ecouter({ 'page-suivante': () => {} });
    for (let i = 0; i < 8; i++) flux[0].casser();
    assert.equal(flux[0].ferme, true, 'le flux doit être refermé');
    assert.equal(MH.telecommande.ecoute(), false);
});

test('deux appels à ecouter n’ouvrent qu’un seul flux', () => {
    const { MH, flux } = charger();
    MH.telecommande.ecouter({ 'page-suivante': () => {} });
    MH.telecommande.ecouter({ 'page-suivante': () => {} });
    assert.equal(flux.length, 1);
});

test('le lecteur branche les huit actions du serveur, et rien d’autre', () => {
    // Le contrat vit à DEUX endroits : la liste blanche du serveur et le
    // branchement du lecteur. S'ils divergent, une commande part et n'arrive
    // nulle part — c'est exactement le genre de panne muette qu'on cherche.
    const ctrl = fs.readFileSync(
        path.join(ROOT, 'server', 'controllers', 'remote.controller.js'), 'utf8');
    const bloc = /ACTIONS = new Set\(\[([\s\S]*?)\]\)/.exec(ctrl);
    assert.ok(bloc, 'la liste blanche du serveur doit être lisible');
    const serveur = [...bloc[1].matchAll(/'([a-z-]+)'/g)].map((m) => m[1]);

    const lecteur = fs.readFileSync(path.join(ROOT, 'assets', 'js', 'chapitre.js'), 'utf8');
    const branche = /telecommande\?\.ecouter\(\{([\s\S]*?)\n {8}\}\)/.exec(lecteur);
    assert.ok(branche, 'le lecteur doit s’abonner');
    const cotePage = [...branche[1].matchAll(/'([a-z-]+)'\s*:/g)].map((m) => m[1]);

    for (const a of serveur) {
        assert.ok(cotePage.includes(a), `le serveur accepte « ${a} » mais le lecteur ne le branche pas`);
    }
    for (const a of cotePage) {
        assert.ok(serveur.includes(a), `le lecteur branche « ${a} » que le serveur refusera`);
    }
});
