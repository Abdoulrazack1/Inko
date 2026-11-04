// ============================================================
// test/unit/styles-hors-gabarit.test.js — un style que personne ne
// regarde n'est tenu par personne
// ------------------------------------------------------------
// Le test des réglages (#150) affirmait que `parametres.html` était
// « la seule page de l'application dans ce cas ». Mesuré : TREIZE autres
// portaient un bloc `<style>`, 407 lignes en tout.
//
// Ce n'est pas du rangement. Tout ce qui balaie `assets/css/*.css` est
// aveugle à un bloc `<style>` :
//
//   · le générateur du repli `aspect-ratio` pour Android 8 ;
//   · le test qui interdit une virgule traînante dans une liste de
//     sélecteurs ;
//   · les échelles de texte, de rayon et d'espacement ;
//   · tous les tests de composition.
//
// Ce que ça coûtait, concrètement : `liste.html` posait
// `aspect-ratio: var(--carte-ratio)` dans son bloc. Le générateur ne l'a
// jamais vu, donc la règle n'avait AUCUN repli, donc les couvertures de
// la liste partagée s'effondraient sur le WebView d'Android 8. Un bug
// qui partait dans l'APK, invisible pour 816 tests et cinq portillons.
//
// Sorties, les dix feuilles ont révélé huit violations déjà présentes :
// rayons littéraux, valeurs hors échelle, piles monospace en clair,
// blanc littéral en couleur de texte, et deux `.tag` qui redessinaient
// la famille des puces. Elles sont corrigées — mais le fait qu'elles
// aient pu vivre là des mois est le vrai sujet.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..', '..');
const lire = (...p) => fs.readFileSync(path.join(RACINE, ...p), 'utf8')
    .replace(/\r\n/g, '\n');

// Trois pages ne chargent AUCUNE feuille, et c'est voulu : elles doivent
// s'afficher sans rien attendre.
//   · anilist.html   — le retour d'OAuth, affiché une seconde ;
//   · index.html     — la page d'entrée ;
//   · offline.html   — servie par le service worker quand il n'y a plus
//                      de réseau : aller chercher une feuille serait
//                      exactement ce qui ne peut pas marcher.
const AUTONOMES = ['anilist.html', 'index.html', 'offline.html'];

test('seules les pages autonomes gardent un bloc <style>', () => {
    const pages = fs.readdirSync(RACINE).filter((f) => f.endsWith('.html'));
    assert.ok(pages.length > 20, `${pages.length} pages trouvées`);
    const fautives = pages.filter((p) => !AUTONOMES.includes(p)
        && /<style[\s>]/.test(lire(p)));
    assert.deepEqual(fautives, [],
        `styles à sortir vers assets/css/ :\n  ${fautives.join('\n  ')}`);
});

test('et une page autonome l’est vraiment', () => {
    // Si l'une d'elles se met à charger une feuille, elle n'a plus de
    // raison de garder son bloc — et l'exception ci-dessus devient un
    // trou par lequel tout repasse.
    for (const p of AUTONOMES) {
        const src = lire(p);
        assert.ok(!/<link rel="stylesheet"/.test(src),
            `${p} charge une feuille : son bloc <style> doit en sortir`);
    }
});

test('chaque page qui a sa feuille la charge', () => {
    const pages = fs.readdirSync(RACINE).filter((f) => f.endsWith('.html'));
    const manquants = [];
    for (const p of pages) {
        const nom = p.replace(/\.html$/, '');
        if (!fs.existsSync(path.join(RACINE, 'assets', 'css', `${nom}.css`))) continue;
        if (!lire(p).includes(`assets/css/${nom}.css`)) manquants.push(p);
    }
    assert.deepEqual(manquants, [],
        `feuille présente mais pas liée :\n  ${manquants.join('\n  ')}`);
});

test('le repli Android 8 se pose sur un conteneur, jamais sur l’image', () => {
    // Le repli écrit `height: 0; padding-top: …` sur l'élément qui porte
    // le ratio, puis positionne son enfant `> img` par-dessus. Posé sur
    // une BALISE IMG, il lui donne une boîte de contenu haute de zéro :
    // la couverture disparaît. C'est ce que `liste.html` allait produire.
    const css = lire('assets', 'css', 'global.css');
    const bloc = /@supports not \(aspect-ratio[^)]*\) \{([\s\S]*?)\n\}/.exec(css);
    assert.ok(bloc, 'le bloc de repli');
    const fautifs = [];
    for (const m of bloc[1].matchAll(/^\s{4}(\S[^{]*?) \{ height: 0;/gm)) {
        // Un sélecteur qui se termine par `img` vise l'image elle-même.
        if (/\bimg$/.test(m[1].trim())) fautifs.push(m[1].trim());
    }
    assert.deepEqual(fautifs, [],
        `ces replis effaceraient l’image au lieu de la cadrer :\n  ${fautifs.join('\n  ')}`);
});

test('la gouttière d’une page vient d’un jeton', () => {
    // Dix feuilles écrivaient le même bloc centré, chacune à sa façon :
    // 26, 28 ou 30 px en haut, 20 ou 22 sur les côtés, 80 ou 90 en bas.
    // Personne ne l'avait choisi — elles ne se voyaient pas les unes les
    // autres.
    const css = lire('assets', 'css', 'global.css');
    for (const j of ['--page-haut', '--page-cote', '--page-bas']) {
        assert.ok(new RegExp(`${j}:`).test(css), `${j} est défini`);
    }
    const fautives = [];
    for (const f of fs.readdirSync(path.join(RACINE, 'assets', 'css'))) {
        if (!f.endsWith('.css')) continue;
        const src = lire('assets', 'css', f);
        // Le motif exact qui divergeait : un bloc centré à largeur maximale
        // qui pose aussi sa marge VERTICALE. Un conteneur qui ne gère que
        // les côtés (`padding: 0 var(--sp-5)`) n'est pas une gouttière de
        // page : il n'y a rien à unifier là.
        for (const m of src.matchAll(/max-width: \d+px; margin: 0 auto; padding: ([^;}]+)/g)) {
            const v = m[1].trim();
            if (v.startsWith('0 ') && v.split(/\s+/).length === 2) continue;
            if (!v.includes('var(--page-')) fautives.push(`${f} — padding: ${v}`);
        }
    }
    assert.deepEqual(fautives, [],
        `gouttières écrites à la main :\n  ${fautives.join('\n  ')}`);
});

test('une panne de page ne laisse pas un panneau vide à côté d’elle', () => {
    // `comparer.html` est une comparaison en deux colonnes. Ses deux
    // pannes de DÉMARRAGE — adresse incomplète, chapitre illisible —
    // écrivaient leur message dans la colonne A et rendaient la main. La
    // colonne B restait un panneau gris de 123 px, vide, sans un mot.
    const js = lire('assets', 'js', 'comparer.js');
    assert.match(js, /function panneDePage\(message\)/);
    const f = /function panneDePage\(message\) \{([\s\S]*?)\n    \}/.exec(js);
    assert.ok(f, 'la fonction');
    assert.match(f[1], /\$\('cmpB'\)\.hidden = true/, 'la seconde colonne s’efface');
    assert.match(f[1], /cmp-colonnes--seule/, 'et la première prend la largeur');
    assert.match(lire('assets', 'css', 'comparer.css'),
        /\.cmp-colonnes--seule \{ grid-template-columns: 1fr; \}/);
    // Les deux pannes de démarrage y passent. Une panne par COLONNE
    // reste dans sa colonne, elle : là, l'autre a du contenu.
    const demarrages = js.match(/panneDePage\(/g) || [];
    assert.equal(demarrages.length, 3, '1 définition + 2 appels');
});

test('une page porte son titre même quand elle n’a rien à montrer', () => {
    // `liste.html` arrive par un lien partagé, sans compte : c'est la
    // page la plus susceptible d'être ouverte par quelqu'un qui ne
    // connaît pas Inko. Sur ses trois chemins qui n'aboutissent pas, elle
    // n'avait AUCUN `h1` — ses seuls titres étaient les trois colonnes du
    // pied de page.
    const js = lire('assets', 'js', 'liste.js');
    const f = /function etat\(wrap, message\) \{([\s\S]*?)\n    \}/.exec(js);
    assert.ok(f, 'la fonction d’état');
    assert.match(f[1], /<h1 class="pl-name pl-name--etat">/,
        'l’état porte le titre de la page');

    // Même mesure, même défaut sur `collection-detail.html` : ses deux
    // chemins qui n'aboutissent pas n'avaient pas de `h1` non plus.
    const cd = lire('assets', 'js', 'collection-detail.js');
    const g = /function renderGuard\(msg\) \{([\s\S]*?)\n    \}/.exec(cd);
    assert.ok(g, 'la fonction de garde');
    assert.match(g[1], /<h1 class="cd-garde-titre">/);
    // Et ses trois attributs `style` sont partis avec : un style en
    // ligne ne connaît ni le thème, ni les échelles, ni aucun test.
    assert.ok(!/style="/.test(g[1]),
        `encore des styles en ligne :\n${g[1]}`);
});
