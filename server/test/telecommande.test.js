// ============================================================
// server/test/telecommande.test.js — le relais de télécommande (P3.1)
// ------------------------------------------------------------
// Le relais est court, mais il porte trois responsabilités qu'on ne voit pas
// en s'en servant :
//
//   1. il ne laisse passer QUE des actions connues (sinon l'appareil appairé
//      dicterait au lecteur ce qu'il exécute) ;
//   2. il ne traverse JAMAIS les comptes (hub familial) ;
//   3. il ne garde RIEN — une commande non délivrée est perdue, exprès.
//
// Ces tests n'ont pas besoin de base : le registre est en mémoire, et le
// contrôleur se teste avec de fausses réponses HTTP. C'est aussi ce qui les
// rend utiles — ils s'exécutent partout, y compris là où MySQL est absent.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { EventEmitter } = require('node:events');

const tc = require('../lib/telecommande');
const ctrl = require('../controllers/remote.controller');

/** Une paire requête/réponse minimale, qui retient ce qu'on lui écrit. */
function paire({ user = 1, query = {}, body = {} } = {}) {
    const req = new EventEmitter();
    req.user = { id: user };
    req.query = query;
    req.body = body;

    const res = {
        ecrit: [],
        statut: 200,
        charge: null,
        entetes: null,
        writeHead(code, h) { this.statut = code; this.entetes = h; return this; },
        write(s) { this.ecrit.push(s); return true; },
        status(c) { this.statut = c; return this; },
        json(o) { this.charge = o; return this; },
        end() { this.fini = true; },
    };
    return { req, res };
}

/** Les commandes réellement reçues sur un flux, décodées. */
function recues(res) {
    return res.ecrit
        .filter((l) => l.startsWith('event: commande'))
        .map((l) => JSON.parse(/data: (.*)/.exec(l)[1]));
}

test('un abonné reçoit les commandes de SON compte', () => {
    const a = paire({ user: 101, query: { nom: 'PC du salon' } });
    ctrl.flux(a.req, a.res);
    assert.equal(a.res.statut, 200);
    assert.match(a.res.entetes['Content-Type'], /text\/event-stream/);

    const p = paire({ user: 101, body: { action: 'page-suivante' } });
    ctrl.commander(p.req, p.res, (e) => { throw e; });
    assert.deepEqual(p.res.charge, { envoye: true, ecrans: 1 });
    assert.equal(recues(a.res)[0].action, 'page-suivante');
    a.req.emit('close');
});

test('une commande ne traverse jamais vers un autre compte', () => {
    // Sur un hub familial, c'est la garantie qui compte le plus : personne ne
    // doit pouvoir tourner les pages de quelqu'un d'autre.
    const moi = paire({ user: 201, query: { nom: 'mon écran' } });
    const toi = paire({ user: 202, query: { nom: 'son écran' } });
    ctrl.flux(moi.req, moi.res);
    ctrl.flux(toi.req, toi.res);

    const p = paire({ user: 201, body: { action: 'page-suivante' } });
    ctrl.commander(p.req, p.res, (e) => { throw e; });

    assert.equal(p.res.charge.ecrans, 1, 'un seul écran touché');
    assert.equal(recues(moi.res).length, 1);
    assert.equal(recues(toi.res).length, 0, 'l’autre compte ne doit RIEN recevoir');
    moi.req.emit('close'); toi.req.emit('close');
});

test('une action hors liste est refusée, et le refus dit ce qui est accepté', () => {
    const p = paire({ user: 301, body: { action: 'supprimer-la-bibliotheque' } });
    ctrl.commander(p.req, p.res, (e) => { throw e; });
    assert.equal(p.res.statut, 400);
    assert.equal(p.res.charge.code, 'ACTION_INCONNUE');
    assert.ok(p.res.charge.acceptees.includes('page-suivante'));
});

test('« aller à la page » SANS numéro est refusé, pas ramené à la page 1', () => {
    // Le piège : `Number(null)` vaut 0, pas NaN. La borne basse le remontait
    // donc à 1, et une commande mal formée renvoyait le lecteur au DÉBUT du
    // chapitre — silencieusement. Mesuré avant correction : `valeur: 1`.
    const e = paire({ user: 401, query: { nom: 'écran' } });
    ctrl.flux(e.req, e.res);

    for (const valeur of [null, undefined, '', 'abc']) {
        const p = paire({ user: 401, body: { action: 'aller-a-la-page', valeur } });
        ctrl.commander(p.req, p.res, (err) => { throw err; });
        assert.equal(p.res.statut, 400, `valeur ${JSON.stringify(valeur)} devrait être refusée`);
        assert.equal(p.res.charge.code, 'VALEUR_REQUISE');
    }
    assert.equal(recues(e.res).length, 0, 'rien ne doit partir sur le flux');
    e.req.emit('close');
});

test('les actions sans valeur passent avec valeur nulle', () => {
    const e = paire({ user: 402, query: { nom: 'écran' } });
    ctrl.flux(e.req, e.res);
    const p = paire({ user: 402, body: { action: 'plein-ecran' } });
    ctrl.commander(p.req, p.res, (err) => { throw err; });
    assert.equal(p.res.statut, 200);
    assert.equal(recues(e.res)[0].valeur, null, 'pas de 1 fantôme');
    e.req.emit('close');
});

test('le numéro de page est borné des deux côtés', () => {
    const e = paire({ user: 501, query: { nom: 'écran' } });
    ctrl.flux(e.req, e.res);
    for (const v of [99999, -5, 12.7]) {
        const p = paire({ user: 501, body: { action: 'aller-a-la-page', valeur: v } });
        ctrl.commander(p.req, p.res, (err) => { throw err; });
    }
    assert.deepEqual(recues(e.res).map((c) => c.valeur), [9999, 1, 13]);
    e.req.emit('close');
});

test('sans écran à l’écoute, ce n’est pas une erreur — c’est zéro', () => {
    // La distinction porte toute l'interface : « ouvre un chapitre sur le PC »
    // plutôt que « échec ».
    const p = paire({ user: 601, body: { action: 'page-suivante' } });
    ctrl.commander(p.req, p.res, (e) => { throw e; });
    assert.deepEqual(p.res.charge, { envoye: true, ecrans: 0 });
});

test('un onglet oublié ne fait pas grossir le hub indéfiniment', () => {
    const avant = tc._etat().flux;
    const ouverts = [];
    for (let i = 0; i < tc.MAX_PAR_UTILISATEUR + 4; i++) {
        const p = paire({ user: 701, query: { nom: 'onglet ' + i } });
        ctrl.flux(p.req, p.res);
        ouverts.push(p);
    }
    assert.equal(tc.ecoutes(701).length, tc.MAX_PAR_UTILISATEUR);
    // C'est le PLUS ANCIEN qui saute : le dernier arrivé est celui qu'on
    // regarde, et le voir cesser de répondre serait incompréhensible.
    assert.equal(tc.ecoutes(701)[tc.MAX_PAR_UTILISATEUR - 1], 'onglet 11');
    ouverts.forEach((p) => p.req.emit('close'));
    assert.equal(tc._etat().flux, avant, 'tout doit être libéré à la fermeture');
});

test('une commande n’est pas rejouée à un écran qui arrive après', () => {
    // Le relais ne stocke rien, et c'est voulu : « page suivante » rejouée
    // trois minutes plus tard ferait sauter des pages sans qu'on comprenne.
    const p = paire({ user: 801, body: { action: 'page-suivante' } });
    ctrl.commander(p.req, p.res, (e) => { throw e; });

    const tard = paire({ user: 801, query: { nom: 'arrivé après' } });
    ctrl.flux(tard.req, tard.res);
    assert.equal(recues(tard.res).length, 0);
    tard.req.emit('close');
});

test('la liste des écrans ne montre que les siens', () => {
    const a = paire({ user: 901, query: { nom: 'salon' } });
    const b = paire({ user: 902, query: { nom: 'chambre' } });
    ctrl.flux(a.req, a.res); ctrl.flux(b.req, b.res);

    const q = paire({ user: 901 });
    ctrl.ecrans(q.req, q.res, (e) => { throw e; });
    assert.deepEqual(q.res.charge, { ecrans: ['salon'] });
    a.req.emit('close'); b.req.emit('close');
});
