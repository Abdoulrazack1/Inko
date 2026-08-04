#!/usr/bin/env node
// ============================================================
// gen-meta.js — Métadonnées de partage sur toutes les pages
// ------------------------------------------------------------
// Audit UX-01 : 0 page sur 22 déclarait une meta description ou des balises
// Open Graph. Sans conséquence pour une instance privée — SAUF que l'app
// expose des PROFILS PUBLICS (u.html) et des COLLECTIONS destinées au partage.
// Ces liens produisaient un aperçu vide sur Discord, WhatsApp, Slack, Signal…
// c'est-à-dire précisément là où ils sont partagés.
//
//   node scripts-ci/gen-meta.js           → applique
//   node scripts-ci/gen-meta.js --check   → échoue si une page n'est pas à jour
// ============================================================
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CHECK = process.argv.includes('--check');

// Description par page. Le ton reste celui du projet : factuel, pas commercial.
const DESCRIPTIONS = {
    'accueil.html':           'Ta bibliothèque de mangas et de romans : reprends ta lecture, suis les nouveaux chapitres, découvre de nouvelles séries.',
    'catalogue.html':         'Parcours le catalogue par genre, statut et source. Mangas, romans et livres du domaine public.',
    'recherche.html':         'Cherche une œuvre sur toutes tes sources à la fois, mangas comme romans.',
    'serie.html':             'Fiche de la série : chapitres, progression, notes et avis.',
    'chapitre.html':          'Lecteur de chapitres : page par page, double page ou défilement, avec lecture hors-ligne.',
    'lecture.html':           'Lecteur de romans et de livres, avec réglages de confort et reprise automatique.',
    'localreader.html':       'Lecteur pour tes fichiers importés (EPUB, PDF, CBZ).',
    'bibliotheque.html':      'Ta bibliothèque : séries suivies, mises à jour, signets et téléchargements.',
    'collections.html':       'Tes listes de lecture : organise tes séries comme tu veux.',
    'collection-detail.html': 'Une liste de lecture et les œuvres qu\'elle contient.',
    'profil.html':            'Ton profil : statistiques de lecture, historique, listes, avis et badges.',
    'u.html':                 'Profil public de lecture : séries lues, statistiques et badges.',
    'stats.html':             'Tes statistiques de lecture : rythme, objectifs, séries et accomplissements.',
    'notes.html':             'Ton journal de lecture : tes impressions, chapitre après chapitre.',
    'notifications.html':     'Tes notifications : nouveaux chapitres des séries que tu suis.',
    'downloads.html':         'Tes chapitres téléchargés, disponibles hors connexion.',
    'import.html':            'Importe tes propres fichiers EPUB, PDF ou CBZ dans ta bibliothèque.',
    'sources.html':           'Gère tes sources de contenu : extensions mangas et romans.',
    'parametres.html':        'Réglages de lecture, apparence, confidentialité et comptes liés.',
    'confidentialite.html':   'Ce qu\'Inko stocke, pourquoi, et ce qu\'il ne fait pas : aucune télémétrie, aucune publicité.',
    'anilist.html':           'Connexion du compte AniList pour synchroniser ta progression.',
    'offline.html':           'Tu es hors ligne — tes téléchargements restent accessibles.',
};

const SITE = 'Inko';
const OG_IMAGE = '/assets/img/icon-512.png';
const MARK = '<!-- meta:auto -->';   // borne le bloc généré

let changed = [];

for (const [page, desc] of Object.entries(DESCRIPTIONS)) {
    const abs = path.join(ROOT, page);
    if (!fs.existsSync(abs)) { console.warn(`  ⚠ page absente : ${page}`); continue; }
    let html = fs.readFileSync(abs, 'utf8');

    const title = (html.match(/<title>([^<]*)<\/title>/) || [, SITE])[1].trim();
    const esc = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

    const block = [
        MARK,
        `  <meta name="description" content="${esc(desc)}">`,
        `  <meta property="og:type" content="website">`,
        `  <meta property="og:site_name" content="${SITE}">`,
        `  <meta property="og:title" content="${esc(title)}">`,
        `  <meta property="og:description" content="${esc(desc)}">`,
        `  <meta property="og:image" content="${OG_IMAGE}">`,
        `  <meta name="twitter:card" content="summary">`,
        `  <meta name="twitter:title" content="${esc(title)}">`,
        `  <meta name="twitter:description" content="${esc(desc)}">`,
        `  ${MARK}`,
    ].join('\n  ');

    // Remplace un bloc existant, sinon insère juste après <title>
    const existing = new RegExp(`\\s*${MARK}[\\s\\S]*?${MARK}`);
    let next;
    if (existing.test(html)) {
        next = html.replace(existing, '\n  ' + block);
    } else {
        next = html.replace(/(<title>[^<]*<\/title>)/, `$1\n  ${block}`);
    }

    if (next !== html) {
        changed.push(page);
        if (!CHECK) fs.writeFileSync(abs, next);
    }
}

if (CHECK) {
    if (changed.length) {
        console.error('::error::Métadonnées de partage absentes ou périmées : ' + changed.join(', '));
        console.error("Lance 'npm run gen-meta' et committe le résultat.");
        process.exit(1);
    }
    console.log(`Métadonnées à jour — ${Object.keys(DESCRIPTIONS).length} pages.`);
} else {
    console.log(changed.length
        ? `✔ métadonnées écrites sur ${changed.length} page(s)`
        : 'Métadonnées déjà à jour.');
}
