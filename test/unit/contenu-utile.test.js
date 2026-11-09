// ============================================================
// test/unit/contenu-utile.test.js — mesurer le premier contenu UTILE
// ------------------------------------------------------------
// `load` ne dit rien de ce qu'on attendait. Il se declenche quand la
// derniere image decorative est arrivee, et il s'est deja declenche sur
// une page qui n'affiche qu'un squelette. Entre les deux il y a le seul
// instant qui compte : celui ou la page montre ce qu'on est venu voir.
//
// AUCUNE MESURE AUTOMATIQUE NE SAIT LEQUEL C'EST.
// `largest-contentful-paint` designe le plus GROS element peint, pas le
// plus utile : sur l'accueil c'est une couverture de l'etagere, qui
// arrive avant la liste des chapitres. C'est donc la page qui le
// declare, en une ligne, a l'endroit exact ou son contenu est pose.
//
// Releve dans le navigateur, serveur local, cache chaud :
//
//     accueil        169 et 190 ms   (deux chargements)
//     bibliotheque   203 ms          (495 cartes)
//     catalogue    2 775 ms          (il interroge une source distante)
//
// ── DEUX PIEGES, tous les deux rencontres ──
//
// 1. Un premier relevé donnait 37 402 ms pour l'accueil. Le navigateur
//    avait REUTILISE le document deja ouvert au lieu de le recharger :
//    `performance.now()` comptait depuis un chargement bien anterieur.
//    Rechargé pour de bon, c'est 169 ms. Un chiffre invraisemblable est
//    presque toujours un defaut de la mesure, pas du code.
//
// 2. L'accueil ne relevait RIEN quand il n'y avait rien a reprendre :
//    seule l'etagere etait marquee. La mesure disparaissait donc
//    exactement pour les comptes neufs — les plus interessants a
//    mesurer. L'etat vide EST le contenu utile pour qui n'a rien
//    commence.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..', '..');
const lire = (...p) => fs.readFileSync(path.join(RACINE, ...p), 'utf8').replace(/\r\n/g, '\n');
const GLOBAL = lire('assets', 'js', 'global.js');

/** Charge les deux aides depuis la source reelle, avec un stockage en memoire. */
function charger() {
    const i = GLOBAL.indexOf("    const CLE_CONTENU = 'mesuresContenu';");
    assert.notEqual(i, -1, 'le bloc doit rester reperable');
    const j = GLOBAL.indexOf('\n    };', GLOBAL.indexOf('window.MH.mesuresContenu = function')) + 7;
    const bloc = GLOBAL.slice(i, j);

    const sac = new Map();
    const localStorage = {
        getItem: (k) => (sac.has(k) ? sac.get(k) : null),
        setItem: (k, v) => sac.set(k, String(v)),
        removeItem: (k) => sac.delete(k),
    };
    let horloge = 0;
    const performance = {
        now: () => horloge,
        measure: () => {},
    };
    const window = { MH: {} };
    // eslint-disable-next-line no-new-func
    new Function('window', 'document', 'localStorage', 'performance', bloc)(
        window, { title: 'page' }, localStorage, performance);
    return { MH: window.MH, avancer: (ms) => { horloge += ms; }, sac };
}

test('le premier appel gagne : une page qui se re-rend ne s’ecrase pas', () => {
    // Une grille rendue trois fois (donnees locales, puis serveur, puis
    // enrichissement) ne doit pas remplacer 200 ms par 4 000.
    const { MH, avancer } = charger();
    avancer(200);
    const a = MH.contenuPret('bibliotheque');
    avancer(3800);
    const b = MH.contenuPret('bibliotheque');
    assert.equal(a.ms, 200);
    assert.equal(b.ms, 200, 'le second appel rend la premiere mesure');
    assert.equal(MH.mesuresContenu().length, 1, 'et n’en enregistre pas une seconde');
});

test('le relevé garde la page, le temps et la date', () => {
    const { MH, avancer } = charger();
    avancer(169);
    MH.contenuPret('accueil');
    const [m] = MH.mesuresContenu();
    assert.equal(m.page, 'accueil');
    assert.equal(m.ms, 169);
    assert.ok(m.le > 0, 'la date, sans quoi un releve ne se situe pas');
});

test('l’historique est borne a vingt', () => {
    // Un journal qui grossit sans fin dans le stockage du navigateur
    // finit par couter plus cher que ce qu'il mesure.
    // Le stockage survit d'une page a l'autre : on simule trente relevés
    // deja en place, puis un trente-et-unieme.
    const d = charger();
    const faux = Array.from({ length: 30 }, (_, i) => ({ page: 'p' + i, ms: i, le: i }));
    d.sac.set('mesuresContenu', JSON.stringify(faux));
    d.avancer(5);
    d.MH.contenuPret('nouveau');
    const l = d.MH.mesuresContenu();
    assert.equal(l.length, 20, 'vingt au plus');
    assert.equal(l[l.length - 1].page, 'nouveau', 'et le dernier est le plus recent');
});

test('un stockage refusé ne fait pas tomber la page', () => {
    // Fenetre privee, donnees de site bloquees : la mesure n’est pas une
    // fonctionnalite dont l’echec doit se voir.
    const i = GLOBAL.indexOf("    const CLE_CONTENU = 'mesuresContenu';");
    const j = GLOBAL.indexOf('\n    };', GLOBAL.indexOf('window.MH.mesuresContenu = function')) + 7;
    const bloc = GLOBAL.slice(i, j);
    const casse = { getItem: () => { throw new Error('refusé'); },
        setItem: () => { throw new Error('refusé'); }, removeItem: () => {} };
    const window = { MH: {} };
    // eslint-disable-next-line no-new-func
    new Function('window', 'document', 'localStorage', 'performance', bloc)(
        window, { title: 'p' }, casse, { now: () => 42, measure: () => {} });
    let r;
    assert.doesNotThrow(() => { r = window.MH.contenuPret('x'); });
    assert.equal(r.ms, 42, 'la mesure existe meme sans stockage');
    assert.deepEqual(window.MH.mesuresContenu(), [], 'et la lecture rend une liste vide');
});

test('chaque page qui compte declare son contenu', () => {
    const ATTENDU = {
        'accueil.js': 2,        // l’etagere ET l’etat vide
        'bibliotheque.js': 1,
        'catalogue.js': 1,
        'recherche.js': 1,
        'lecture.js': 1,
    };
    for (const [f, n] of Object.entries(ATTENDU)) {
        const src = lire('assets', 'js', f);
        const trouve = (src.match(/contenuPret\?\.\(|accueilPret\(\);/g) || []).length;
        assert.ok(trouve >= n, f + ' : ' + trouve + ' marque(s), ' + n + ' attendu(s)');
    }
});

test('le relevé est dans le diagnostic copiable, pas seulement en memoire', () => {
    // Un « c’est lent chez moi » accompagne de dix chiffres se repare ;
    // l’autre, non.
    const src = lire('assets', 'js', 'parametres.js');
    assert.match(src, /MH\?\.mesuresContenu\?\.\(\)/);
    assert.match(src, /temps au premier contenu utile/);
    assert.ok(src.indexOf('mesuresContenu') < src.indexOf('dernière(s) erreur(s)'),
        'avant les erreurs : on lit un diagnostic du haut vers le bas');
});
