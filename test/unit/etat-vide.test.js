// ============================================================
// test/unit/etat-vide.test.js — un seul état vide
// ------------------------------------------------------------
// Le composant existait — `MH.etatVide` / `MH.poserEtatVide`, avec son
// titre, son texte et ses actions — mais seuls deux fichiers s'en
// servaient. Quinze autres endroits écrivaient le leur à la main, en
// style en ligne. Rien que dans `profil.js`, sept états vides :
//
//     rembourrage   30px · 24px · 12px · 20px · 20px · 8px 4px · 30px
//     taille        13 · 13 · 12,5 · 13 · 13 · 11,5 · (héritée)
//     alignement    centre, centre, gauche, centre, centre, gauche, centre
//
// Six rembourrages, quatre tailles, deux alignements — pour le même type
// de message, sur la même page.
//
// Deux choses manquaient au composant, et c'est pour ça qu'on l'évitait :
//   · il ne savait faire QUE le grand format (220 px de haut, centré),
//     inutilisable pour un creux de 8 px dans une colonne ;
//   · son icône était échappée, donc un SVG s'y affichait en code source.
// D'où `densite: 'compact'`, `grille: true`, et une icône passée par NOM.
//
// Et deux états vides n'offraient aucune issue : « Aucun favori » portait
// un `onclick=` en attribut, que la CSP de l'application installée bloque
// (DESK-01) — le bouton « + » ne faisait rien là où ça compte.
//
// Vérifié dans les pages : profil rend trois états compacts à 16px 12px,
// deux avec une action réelle ; téléchargements rend le grand format avec
// sa vraie icône SVG.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const JS = path.join(__dirname, '..', '..', 'assets', 'js');
const lire = (f) => fs.readFileSync(path.join(JS, f), 'utf8');
const GLOBAL = lire('global.js');

// `music.js` vit dans un panneau sombre dans les quatre thèmes, comme la
// chrome d'un lecteur vidéo : son vocabulaire visuel est à lui, et le
// composant y jurerait. Même raison que `.im-input` et `.im-panel`.
// `notes.js` est un cas à part, pas un oubli : son message n'est pas un
// état vide mais une ASTUCE posée AU-DESSUS d'un repli — « tu n'as encore
// rien écrit : voici ce que tu as lu ». Le composant remplace le contenu
// du conteneur ; ici il effacerait justement ce qu'on veut montrer.
const HORS_CONTRAT = new Set(['music.js', 'notes.js']);

test('aucun état vide n\'est plus écrit à la main', () => {
    const fautes = [];
    for (const f of fs.readdirSync(JS).filter(n => n.endsWith('.js'))) {
        if (HORS_CONTRAT.has(f)) continue;
        const src = lire(f);
        const re = /(innerHTML\s*=\s*)([`'"])((?:(?!\2).){0,400})\2/gs;
        let m;
        while ((m = re.exec(src))) {
            const corps = m[3];
            // Un `<option>Aucune autre source</option>` n'est pas un état
            // vide : c'est un choix dans une liste déroulante.
            if (corps.includes('<option')) continue;
            if (!/(Aucun|Aucune|Rien\b|Pas de )/i.test(corps)) continue;
            fautes.push(`${f}:${src.slice(0, m.index).split('\n').length} — ${corps.replace(/\s+/g, ' ').slice(0, 56)}`);
        }
    }
    assert.deepEqual(fautes, [],
        `à passer par MH.poserEtatVide :\n  ${fautes.join('\n  ')}`);
});

test('le composant sait faire autre chose qu\'un écran entier', () => {
    assert.match(GLOBAL, /densite === 'compact' \? ' mh-etat-vide--compact'/,
        'sans densité compacte, un creux de huit pixels ne peut pas l’employer');
    assert.match(GLOBAL, /grille \? ' mh-etat-vide--grille'/,
        'et il doit savoir occuper la largeur d’une grille qu’il remplace');
    const css = fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'css', 'global.css'), 'utf8');
    assert.match(css, /\.mh-etat-vide--compact \{[^}]*min-height: 0/,
        'la hauteur minimale de 220 px est ce qui le rendait inutilisable en petit');
    assert.match(css, /\.mh-etat-vide--grille \{[^}]*grid-column: 1 \/ -1/);
});

test('l\'icône se passe par son nom, pas en balisage', () => {
    // `esc(icone)` transformait un SVG en son propre code source, visible
    // à l'écran. Deux états vides de la bibliothèque portaient donc leur
    // icône à la main, hors composant.
    assert.match(GLOBAL, /window\.MH\.icon\(icone, 40\) \|\| esc\(icone\)/,
        'un nom connu devient une icône ; le reste (un emoji) reste du texte');
});

test('les états vides sans issue en ont une', () => {
    const profil = lire('profil.js');
    // L'ancien « Aucun favori » posait un `onclick=` en attribut : bloqué
    // par la CSP de l'app installée, donc sans effet là où ça compte.
    assert.ok(!/class="fav-add" onclick=/.test(profil),
        'plus de gestionnaire en attribut');
    assert.match(profil, /titre: 'Aucun favori'[\s\S]{0,220}actions: \[\{ libelle: 'Explorer le catalogue'/,
        'un état vide de favoris doit mener au catalogue');
    assert.match(profil, /Aucune lecture ne correspond à ces filtres'[\s\S]{0,200}libelle: 'Tout afficher'/,
        'et un filtre qui ne rend rien doit pouvoir être relâché');
});
