// ============================================================
// test/unit/serie-composition.test.js — la page qui parle d'une œuvre
// ------------------------------------------------------------
// Elle en donnait une vignette de 160 px, posée sur une bande grise, à
// côté d'une fiche encadrée. Et elle portait cent dix lignes de CSS qui
// ne s'appliquaient à rien — dont une copie locale complète de la carte
// de série globale, calque de survol compris, c'est-à-dire une seconde
// copie de ce que la PR du catalogue vient de retirer.
//
// Les quinze rayons distincts de cette page ne sont PAS traités ici :
// la PR #133 (« cinq rayons au lieu de vingt-deux ») les remplace déjà
// tous par l'échelle. Les refaire produirait un conflit, pas une
// correction. Même raison pour .badge-new et .status-badge, que la PR
// des pastilles (#149) tient, et pour .progress-bar-big (#145).
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const lire = (...p) => fs.readFileSync(path.join(__dirname, '..', '..', ...p), 'utf8');
const CSS = lire('assets', 'css', 'serie.css').replace(/\r\n/g, '\n');
const JS = lire('assets', 'js', 'serie.js').replace(/\r\n/g, '\n');
const HTML = lire('serie.html').replace(/\r\n/g, '\n');

const regle = (sel) => {
    const m = new RegExp('\\n' + sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' \\{([^}]*)\\}').exec(CSS);
    return m ? m[1] : null;
};

test('plus une ligne de CSS qui ne s’applique à rien', () => {
    // Aucune de ces classes n'est rendue : ni serie.js, ni serie.html.
    const mortes = ['similar-block', 'similar-grid', 'similar-card', 'similar-cover',
        'similar-title', 'similar-meta', 'manga-card', 'manga-grid-3',
        'fiche-subtitle', 'serie-cover-status'];
    for (const c of mortes) {
        assert.ok(!JS.includes(c) && !HTML.includes(c), `${c} n’est rendu nulle part`);
        // On tolère le nom dans un commentaire, jamais dans un sélecteur.
        const sansCommentaires = CSS.replace(/\/\*[\s\S]*?\*\//g, '');
        assert.ok(!new RegExp('\\.' + c + '\\b').test(sansCommentaires),
            `${c} n’a plus de règle non plus`);
    }
    // Et avec .manga-card partait une SECONDE copie du calque de survol.
    assert.ok(!/manga-card-overlay|btn-read-overlay/.test(CSS));
});

test('l’œuvre est la page', () => {
    const hero = regle('.serie-hero');
    assert.ok(hero && !/var\(--bg2\)/.test(hero),
        'la bande grise partie, la couverture est le seul objet éclairé de l’écran');
    assert.ok(!/border-bottom/.test(hero));
    const cov = regle('.serie-cover');
    assert.ok(!/border-radius/.test(cov), 'une couverture est une image imprimée');
    assert.ok(!/box-shadow/.test(cov), 'sans ombre portée de 32 px');
    assert.match(cov, /width: clamp\(170px, 16vw, 230px\)/, 'et elle grandit : 230 px au lieu de 160');
    assert.match(regle('.serie-title'), /font-size: clamp\(30px, 3\.4vw, 46px\)/,
        'le titre suit');
    // Sur téléphone il retombait à 18 px : ce n'était plus un hero.
    assert.ok(!/\.serie-title \{ font-size: 1\dpx/.test(CSS));
});

test('le statut n’est plus dit deux fois dans le hero', () => {
    // Une pastille posée sur la couverture, et le même mot dans la ligne
    // de méta juste à côté.
    assert.ok(!/MH\.statusBadge/.test(JS), 'la pastille a quitté l’œuvre');
    assert.match(JS, /class="status-badge status-\$\{manga\.status\}"/,
        'le statut reste, dans la ligne de méta');
});

test('« En bref » n’a pas besoin d’un cadre', () => {
    const f = regle('.serie-fiche');
    assert.ok(f && !/background/.test(f), 'six lignes de faits, pas un panneau');
    assert.ok(!/border: 1px solid/.test(f));
    assert.match(f, /border-left: 1px solid var\(--border\)/, 'un filet vertical les rassemble');
});

test('mille cent quatre-vingt-quatorze rangées, une seule liste', () => {
    const r = regle('.chapter-row');
    assert.ok(r && !/border-radius/.test(r),
        '1 194 rangées arrondies font 1 194 objets');
    assert.match(r, /border-bottom: 1px solid var\(--border\)/, 'le cheveu sépare');
    assert.match(CSS, /\.chapter-row:hover \{ background: var\(--bg4\); \}/, 'la clarté répond');
});

test('un panneau est un fond OU un filet, pas les deux', () => {
    for (const sel of ['.chapters-block', '.characters-block', '.sidebar-progress',
        '.sidebar-stats,\n.sidebar-tags,\n.sidebar-reviews', '.character-card']) {
        const r = regle(sel);
        assert.ok(r, sel);
        assert.ok(!/border: 1px solid/.test(r), `${sel} portait les deux`);
        assert.match(r, /background: var\(--bg[234]\)/, `${sel} : un pas de clarté`);
    }
});

test('la couleur de marque ne va pas sur le mobilier', () => {
    const onglet = regle('.serie-tab.active');
    assert.ok(onglet && !/var\(--orange\)/.test(onglet),
        'un onglet actif se marque par son encre et un filet');
    assert.match(onglet, /color: var\(--text\)/);
    const filtre = regle('.chap-filter.on');
    assert.ok(filtre && !/background: var\(--orange\)/.test(filtre),
        'cinquième écran où un filtre actif était un aplat d’accent');
    assert.match(filtre, /background: var\(--bg4\)/);
    // Un avatar de personnage ne porte aucune donnée : pas de dégradé orange.
    assert.ok(!/linear-gradient\(135deg, var\(--bg3\), rgba\(255,107,26/.test(CSS));
});

test('« Tu aimeras aussi » a quitté les styles en ligne', () => {
    // La rangée entière était écrite en attributs style dans le JS, avec
    // une pastille de score en #3f7d4e codé en dur — aveugle au thème
    // clair — posée sur la couverture, avec son ombre, en 9 px.
    assert.ok(!/#3f7d4e/.test(JS), 'plus de vert codé en dur');
    const bloc = /row\.innerHTML = items\.map\([\s\S]*?\.join\(''\);/.exec(JS);
    assert.ok(bloc, 'le gabarit de la rangée');
    assert.ok(!/style="/.test(bloc[0].replace(/this\.style\.visibility[^"]*/g, '')),
        `encore des styles en ligne :\n${bloc[0]}`);
    for (const sel of ['.sim-card', '.sim-vignette', '.sim-nom', '.sim-badge']) {
        assert.ok(regle(sel), `${sel} a une vraie règle`);
    }
    // Le score descend sous la couverture.
    const b = regle('.sim-badge');
    assert.ok(!/position: absolute/.test(b) && !/box-shadow/.test(b),
        'rien ne se pose sur l’œuvre');
});

test('plus de petite capitale espacée sur la fiche', () => {
    // .badge-new reste : la PR des pastilles (#149) le tient.
    const fautes = [];
    for (const m of CSS.matchAll(/([^\n{}]*)\{([^}]*)\}/g)) {
        if (/text-transform:\s*uppercase/.test(m[2])) fautes.push(m[1].trim());
    }
    assert.deepEqual(fautes, ['.badge-new'],
        `à passer en bas de casse :\n  ${fautes.join('\n  ')}`);
});

test('rien ne descend sous onze pixels sur la fiche', () => {
    const fautes = [];
    for (const m of CSS.matchAll(/([^\n{}]*)\{([^}]*font-size:\s*([\d.]+)px[^}]*)\}/g)) {
        // .badge-new (9px) appartient à #149, qui le passe au jeton de pastille.
        if (Number(m[3]) < 11 && !/badge-new/.test(m[1])) fautes.push(`${m[1].trim()} — ${m[3]}px`);
    }
    assert.deepEqual(fautes, [], `sous le plancher :\n  ${fautes.join('\n  ')}`);
});
