// ============================================================
// server/test/temps-lecture.test.js — la mesure partait dans le vide
// ------------------------------------------------------------
// `chapitre.js` compte le temps de lecture par tranches de 30 s, en ne
// créditant que l'onglet VISIBLE — un téléphone posé écran allumé sur une
// planche n'est pas de la lecture — puis verse à `POST /me/temps-lecture`.
//
// **Cette route n'existait pas.** Vérifié en direct avant d'écrire une ligne :
//
//     POST /api/me/temps-lecture  → 404
//     GET  /api/me/temps-lecture  → 404
//     GET  /api/me/stats          → 200   (témoin : le serveur répond bien)
//
// Les mesures partaient donc en 404 depuis toujours, avalées par le
// `.catch(() => {})` de l'appelant, pendant que le profil affichait
// `chapitres_lus × 8` — une multiplication là où un fait était disponible.
//
// Le libellé disait « estimé », ce qui était honnête. Montrer une estimation
// quand on dispose d'une mesure ne l'est plus.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const lire = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8')
    .replace(/\r\n/g, '\n');

const CTRL = lire('controllers', 'user.controller.js');
const ROUTES = lire('routes', 'index.js');
const MIGRATE = lire('db', 'migrate.js');

test('les deux routes existent, et l’écriture est limitée', () => {
    assert.match(ROUTES, /router\.post\s*\('\/me\/temps-lecture',\s*auth\.authRequired, writeLimiter, User\.ajouterTempsLecture\)/,
        'l’écriture doit être authentifiée ET limitée');
    assert.match(ROUTES, /router\.get\s*\('\/me\/temps-lecture',\s*auth\.authRequired, User\.getTempsLecture\)/);
});

test('une valeur aberrante ne peut pas inscrire des années de lecture', () => {
    // Une tranche fait 30 s. On accepte large pour un rattrapage apres veille,
    // mais un client fautif — ou un appel forge — ne doit pas pouvoir ecrire
    // n'importe quoi dans les statistiques de quelqu'un.
    const f = /async function ajouterTempsLecture\(req, res, next\) \{([\s\S]*?)\n\}/.exec(CTRL);
    assert.ok(f, 'ajouterTempsLecture doit rester repérable');
    assert.match(f[1], /Number\.isFinite\(brut\)/, 'une valeur illisible doit être rejetée');
    assert.match(f[1], /Math\.min\(Math\.max\(Math\.round\(brut\), 0\), 3600\)/,
        'bornée des deux côtés, plafond à une heure par versement');
});

test('les tranches s’additionnent dans la journée', () => {
    // Une ligne par tranche de 30 s ferait des milliers d'enregistrements pour
    // la meme information. Le grain est le JOUR, parce que c'est ce qu'on
    // affiche : un total, et une carte de chaleur.
    const f = /async function ajouterTempsLecture\(req, res, next\) \{([\s\S]*?)\n\}/.exec(CTRL);
    assert.match(f[1], /ON DUPLICATE KEY UPDATE seconds = seconds \+ VALUES\(seconds\)/,
        'un second versement le même jour doit s’ajouter, pas écraser');
    assert.match(f[1], /CURDATE\(\)/, 'la journée est celle du serveur');
});

test('le serveur DIT s’il a mesuré quelque chose', () => {
    // C'est le champ qui permet a l'interface de ne pas mentir : sans lui,
    // elle ne pourrait pas distinguer « zero seconde lues » de « rien n'a
    // jamais ete mesure », et presenterait un zero comme un fait.
    const f = /async function getTempsLecture\(req, res, next\) \{([\s\S]*?)\n\}/.exec(CTRL);
    assert.ok(f, 'getTempsLecture doit rester repérable');
    assert.match(f[1], /mesure: Number\(tout\.total\) > 0/,
        'un drapeau explicite doit accompagner le total');
    assert.match(f[1], /Math\.min\(Math\.max\(parseInt\(req\.query\.jours, 10\) \|\| 30, 1\), 365\)/,
        'la fenêtre doit être bornée comme le reste des paramètres relayés');
});

test('la table est créée par migration, avec sa clé et sa cascade', () => {
    assert.match(MIGRATE, /version: 24/, 'une migration versionnée, pas un CREATE au démarrage');
    const m = /version: 24[\s\S]*?\} \},/.exec(MIGRATE);
    assert.match(m[0], /CREATE TABLE IF NOT EXISTS reading_time/, 'rejouable sans dégât');
    assert.match(m[0], /PRIMARY KEY \(user_id, day\)/,
        'la clé porte le grain : un jour, un utilisateur, une ligne');
    assert.match(m[0], /ON DELETE CASCADE/,
        'un compte supprimé n’abandonne pas ses mesures derrière lui');
});
