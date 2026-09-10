// ============================================================
// test/unit/a11y-reperes.test.js — titres, repères, étiquettes (A11Y-01/02/03)
// ------------------------------------------------------------
// L'audit relevait 4 pages sans `h1`, 3 sans `main`, 8 champs sans étiquette.
// Ces manques ne se voient jamais à l'écran : la page est parfaitement
// utilisable à la souris, et parfaitement opaque au clavier et à la voix.
//
// C'est aussi le genre de dette qui revient toute seule — il suffit d'ajouter
// une page. D'où ce test, qui échoue sur la page suivante.
//
// Deux subtilités que ma première mesure avait ratées, et qui sont donc
// encodées ici :
//   — un champ DANS un `<label>` est étiqueté implicitement (valide) ;
//   — un `h1` injecté par le script de la page compte : la page en a bien un.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const pages = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html')).sort();
const lire = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

// Les scripts communs : ils ne portent pas le titre d'une page précise.
const COMMUNS = new Set(['global', 'i18n', 'pwa', 'eula', 'api', 'hub', 'natif',
    'theme', 'feuille', 'une-main', 'tirer-rafraichir', 'storage', 'userdata']);

/** Le `h1` peut être écrit dans la page, ou posé par son script. */
function aUnTitre(page) {
    const html = lire(page);
    if (/<h1[\s>]/.test(html)) return true;

    const scripts = [...html.matchAll(/<script src="assets\/js\/([a-z0-9-]+)\.js"/g)]
        .map((m) => m[1]).filter((n) => !COMMUNS.has(n));
    return scripts.some((n) => {
        try { return /<h1[\s>]/.test(fs.readFileSync(path.join(ROOT, 'assets', 'js', n + '.js'), 'utf8')); }
        catch (e) { return false; }
    });
}

test('chaque page a un titre de niveau 1', () => {
    const sans = pages.filter((p) => !aUnTitre(p));
    assert.deepEqual(sans, [], `pages sans h1 : ${sans.join(', ')}`);
});

test('chaque page a un repère principal', () => {
    // Sans `<main>`, « aller au contenu » n'a pas de cible : le lecteur d'écran
    // repart de l'en-tête à chaque page, donc de la navigation entière.
    const sans = pages.filter((p) => !/<main[\s>]/.test(lire(p)));
    assert.deepEqual(sans, [], `pages sans main : ${sans.join(', ')}`);
});

test('chaque champ de saisie est étiqueté', () => {
    // Un `placeholder` N'EST PAS une étiquette : il disparaît dès qu'on tape,
    // et plusieurs lecteurs d'écran ne l'annoncent pas. Le champ devient alors
    // « zone de texte », sans plus.
    const nus = [];
    for (const p of pages) {
        const s = lire(p);
        for (const m of s.matchAll(/<(input|select|textarea)\b([^>]*)>/g)) {
            const attrs = m[2];
            if (/type=["'](hidden|submit|button|reset)["']/.test(attrs)) continue;
            if (/aria-label\s*=|aria-labelledby\s*=|title\s*=/.test(attrs)) continue;

            const id = /id=["']([^"']+)/.exec(attrs);
            if (id && new RegExp('<label[^>]*for=["\']' + id[1] + '["\']').test(s)) continue;

            // Étiquetage implicite : le `<label>` ouvert n'est pas refermé.
            const avant = s.slice(0, m.index);
            if (avant.lastIndexOf('<label') > avant.lastIndexOf('</label>')) continue;

            nus.push(`${p}:${avant.split('\n').length} ${id ? '#' + id[1] : m[1]}`);
        }
    }
    assert.deepEqual(nus, [], `champs sans étiquette :\n  ${nus.join('\n  ')}`);
});

test('aucun gestionnaire écrit en attribut (DESK-02)', () => {
    // Sous la CSP de l'app installée, `onclick="…"` est INERTE. L'audit en
    // comptait 52 ; le dernier survivant était le bouton « Réessayer » de la
    // page hors-ligne — c'est-à-dire le seul bouton d'une page qui ne sert
    // qu'à ça.
    const coupables = [];
    for (const p of pages) {
        const s = lire(p);
        for (const m of s.matchAll(/\son(click|change|input|submit|load|error|keydown)\s*=\s*["']/g)) {
            coupables.push(`${p}:${s.slice(0, m.index).split('\n').length}`);
        }
    }
    assert.deepEqual(coupables, [], `gestionnaires en attribut : ${coupables.join(', ')}`);
});

test('la classe qui cache aux yeux sans cacher aux lecteurs est correcte', () => {
    // `display:none` et `visibility:hidden` retirent l'élément de l'arbre
    // d'accessibilité AUSSI : un titre ainsi masqué ne sert plus à rien.
    const css = fs.readFileSync(path.join(ROOT, 'assets', 'css', 'global.css'), 'utf8');
    const bloc = /\.a11y-invisible\s*\{([^}]*)\}/.exec(css);
    assert.ok(bloc, '.a11y-invisible doit exister');
    assert.ok(!/display\s*:\s*none/.test(bloc[1]), 'display:none retirerait le titre des lecteurs d’écran');
    assert.ok(!/visibility\s*:\s*hidden/.test(bloc[1]), 'visibility:hidden aussi');
    assert.match(bloc[1], /position\s*:\s*absolute/);
});

// ── Les contrôles qui n'existent qu'une fois la page rendue ──
//
// Ce fichier lit le HTML. Or la moitié des contrôles d'Inko est fabriquée en
// JavaScript, et c'est là que se cachaient les pires : l'audit des contrôles,
// qui actionne une VRAIE page, en a relevé huit qui n'annonçaient qu'un
// pictogramme — « guillemet simple gauche » pour les flèches de chapitre,
// « 1 », « 2 » pour la pagination, « ▶ » pour le lien de reprise.
//
// Le cas des flèches de chapitre dit tout : `lecture.js` (romans) portait
// `title="Chapitre précédent (←)"` sur ces boutons, `chapitre.js` (images) ne
// portait rien. Mêmes ids, même gabarit d'origine, deux fichiers — un seul
// avait reçu le correctif. C'est cette dérive-là qu'on tient ici.
const lireJs = (f) => fs.readFileSync(path.join(ROOT, 'assets', 'js', f), 'utf8');

/** Un pictogramme entre `>` et `</…>` sans le moindre caractère lisible. */
// La liste de caracteres et la liste de fichiers etaient toutes les deux trop
// courtes, et se couvraient l'une l'autre : `serie.js` n'etait pas lu, et la
// fleche oblique n'etait pas reconnue. Deux croix passaient donc — dont une
// qui SUPPRIME un telechargement, annoncee « ✕ », sans dire quel chapitre
// elle efface.
const SANS_NOM = /<(button|a)\b([^>]*)>\s*([‹›▶◀✕✖×←→…↗↘↙↖⇄↻↺↑↓⋮⋯⬆⬇]|&[a-z]+;)\s*<\/\1>/gi;

// Le fichier est desormais choisi par le disque, pas a la main : le prochain
// script ajoute est couvert sans que personne y pense.
const SCRIPTS = fs.readdirSync(path.join(ROOT, 'assets', 'js'))
    .filter((f) => f.endsWith('.js')).sort();

for (const f of SCRIPTS) {
    test(`${f} : aucun contrôle réduit à un pictogramme`, () => {
        const src = lireJs(f);
        const nus = [];
        for (const m of src.matchAll(SANS_NOM)) {
            const attrs = m[2] || '';
            if (/aria-label=|aria-labelledby=|title=/.test(attrs)) continue;
            nus.push(m[0].replace(/\s+/g, ' ').slice(0, 90));
        }
        assert.deepEqual(nus, [],
            `ces contrôles n'annoncent qu'un caractère : ${nus.join(' | ')}`);
    });
}

// ── Un intertitre qui n'est pas un titre n'existe pas ───────
//
// Trouvé en listant les titres de l'accueil dans le navigateur : la page n'en
// rendait QUE DEUX. Les cinq intertitres — « Reprendre la lecture », « À lire
// ensuite », « Tendances », « Recommandé pour vous », « Dernières sorties » —
// étaient des `<div class="section-title">`. À l'œil, des titres ; pour la
// navigation par titres, qui est LE moyen de parcourir une page longue au
// lecteur d'écran, rien du tout. Le catalogue avait les deux mêmes.
//
// Et le seul `h1` était le titre du manga mis en avant, DANS le carrousel :
// il changeait toutes les quelques secondes, et ne nommait pas la page.
test('les intertitres de section sont de vrais titres', () => {
    const fautifs = [];
    for (const p of pages) {
        const s = lire(p);
        const m = s.match(/<div[^>]*class="[^"]*\bsection-title\b[^"]*"/g);
        if (m) fautifs.push(`${p} (${m.length})`);
    }
    assert.deepEqual(fautifs, [],
        `ces intertitres se voient mais ne se parcourent pas : ${fautifs.join(', ')}`);
});

test('le h1 de l’accueil nomme la page, pas le manga qui défile', () => {
    const html = lire('accueil.html');
    assert.match(html, /<h1 class="a11y-invisible">Accueil<\/h1>/,
        'la page doit porter un titre stable');
    const js = lireJs('accueil.js');
    assert.ok(!/<h1 class="hero-title">/.test(js),
        'le titre du carrousel ne peut pas être le titre de la page : il change tout seul');
    assert.match(js, /<h2 class="hero-title">/, 'il reste un titre, d’un cran plus bas');

    // La pastille « ● » est décorative. Dans un titre, elle est ANNONCÉE —
    // « cercle noir, Tendances ».
    for (const m of html.match(/<span class="section-title-icon"[^>]*>/g) || [])
        assert.match(m, /aria-hidden="true"/, 'la pastille décorative doit être muette');
});

// ── Hors écran n'est pas hors du parcours au clavier ────────
//
// L'audit clavier a relevé, sur DIX-HUIT pages, un contrôle « focalisé sans
// rien de visible » : `iframe#im-yt`, l'embarqué YouTube du lecteur d'ambiance.
// Son conteneur est posé à `left:-9999px`, en 1×1, `overflow:hidden` — hors
// écran, donc, mais toujours dans l'ordre de tabulation : ni `overflow:hidden`
// ni un décalage négatif n'en retirent quoi que ce soit (seuls `display:none`
// et `visibility:hidden` le font).
//
// On tabule, le focus part à -9999px, rien ne bouge à l'écran, et l'on
// continue à l'aveugle dans les commandes propres à l'embarqué. Le lecteur a
// ses propres boutons dans la page : cette iframe n'a rien à faire au clavier.
test('l’iframe du lecteur d’ambiance est hors du parcours au clavier', () => {
    const src = lireJs('music.js');

    // `aria-hidden` la cache aux lecteurs d'écran ; il ne la retire PAS de la
    // tabulation. Les deux sont nécessaires, et pour deux raisons différentes.
    const conteneur = /function mediaContainer\(\)([\s\S]*?)\n    \}/.exec(src);
    assert.ok(conteneur, 'mediaContainer doit rester lisible');
    assert.match(conteneur[1], /aria-hidden', 'true'/,
        'le conteneur hors écran doit être caché aux lecteurs d’écran');

    // C'est `tabindex="-1"` sur l'iframe qui la sort du parcours, et elle
    // n'existe qu'une fois le lecteur YouTube construit.
    assert.match(src, /getIframe\(\)\?\.setAttribute\('tabindex', '-1'\)/,
        'sans tabindex -1, l’iframe reste un arrêt de tabulation invisible');
});

// ── La cloche est une bascule, et elle doit le dire ─────────
//
// Trouvé en l'actionnant à la main sur le vrai hub, pas en lisant le code.
// Le panneau s'ouvrait et se fermait parfaitement à la souris, et n'annonçait
// rien : `aria-expanded` absent — donc ouvert ou fermé, même annonce, et rien
// n'indiquait qu'un panneau existait. Échap ne fermait pas, alors que TOUT le
// reste de l'application ferme sur Échap. Et le focus restait sur le `body` :
// le panneau tient jusqu'à trente lignes, qu'il fallait atteindre en
// traversant l'en-tête à l'aveugle.
test('la cloche de notifications annonce son panneau, et se ferme au clavier', () => {
    const src = lireJs('global.js');

    const bouton = /<button[^>]*id="btnNotif"[^>]*>/.exec(src);
    assert.ok(bouton, 'le bouton de notifications doit rester lisible');
    for (const attr of ['aria-haspopup', 'aria-expanded', 'aria-controls'])
        assert.match(bouton[0], new RegExp(attr),
            `sans ${attr}, la cloche ne dit pas qu'elle ouvre un panneau`);

    // `aria-expanded` ne vaut que s'il SUIT l'état. Posé une fois dans le
    // gabarit et jamais mis à jour, il ment à chaque ouverture.
    assert.match(src, /aria-expanded', 'true'/, 'l’ouverture doit le passer à true');
    assert.match(src, /aria-expanded', 'false'/, 'la fermeture doit le repasser à false');

    // Échap ferme, et rend le focus — sinon on ferme le panneau et le curseur
    // reste dans le vide.
    const init = /function initNotifications\(\)([\s\S]*?)\n    \}\n/.exec(src);
    assert.ok(init, 'initNotifications doit rester lisible');
    assert.match(init[1], /e\.key === 'Escape'/, 'Échap doit fermer le panneau');
    assert.match(init[1], /rendreFocus/, 'fermer au clavier doit rendre le focus au bouton');
});

test('les deux lecteurs nomment leurs flèches de chapitre de la même façon', () => {
    // La symétrie EST le test : dès que les deux vues divergent, l'une des
    // deux a été oubliée — c'est exactement ce qui était arrivé.
    for (const f of ['chapitre.js', 'lecture.js']) {
        const src = lireJs(f);
        for (const id of ['btnPrevChap', 'btnNextChap']) {
            const bouton = new RegExp(`<button[^>]*id="${id}"[^>]*>`).exec(src)
                || new RegExp(`<button[^>]*${id}[^>]*>`).exec(src);
            assert.ok(bouton, `${f} : le bouton ${id} doit rester lisible`);
            assert.match(bouton[0], /aria-label=|title=/,
                `${f} : ${id} n'annonce qu'un chevron — il lui faut un nom`);
        }
    }
});
