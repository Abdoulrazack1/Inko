#!/usr/bin/env node
// ============================================================
// setup-env.js — Assistant de première configuration (audit AMEL-115)
// ------------------------------------------------------------
// Mettre Inko en ligne supposait de lire l'en-tête du docker-compose.yml ET le
// README, puis de composer un `.env` à la main. Un secret oublié fait refuser
// le démarrage ; un secret FAIBLE, lui, laisse démarrer — c'est le pire des
// deux cas, parce que rien ne le signale ensuite.
//
// Ce script écrit un `.env` complet, avec un secret réellement aléatoire, et
// explique chaque variable EN COMMENTAIRE dans le fichier produit : la
// documentation qu'on lit est celle qu'on a sous les yeux au moment de
// modifier, pas celle d'un README ouvert dans un autre onglet.
//
//   node scripts-ci/setup-env.js                  # crée .env (refuse d'écraser)
//   node scripts-ci/setup-env.js --force          # régénère (garde les valeurs déjà posées)
//   node scripts-ci/setup-env.js --check          # audite un .env existant
//   node scripts-ci/setup-env.js --domain=x.fr    # pré-remplit CORS_ORIGINS
// ============================================================
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const RACINE = path.join(__dirname, '..');
// Le .env de la RACINE : c'est celui que lit docker-compose pour substituer
// ses variables. Le serveur en developpement lit `server/.env` — deux fichiers
// distincts, pour deux usages distincts. Ce script vise le DEPLOIEMENT.
const CIBLE = path.join(RACINE, '.env');
const args = process.argv.slice(2);
const FORCE = args.includes('--force');
const CHECK = args.includes('--check');
const DOMAINE = (args.find(a => a.startsWith('--domain=')) || '').split('=')[1] || '';

const secret = () => crypto.randomBytes(32).toString('hex');

// Chaque entrée porte sa raison d'être. `critique` = l'absence ou une valeur
// faible a une conséquence de sécurité, pas seulement de confort.
const VARIABLES = [
    {
        cle: 'JWT_SECRET', valeur: secret, critique: true,
        aide: 'Signe les jetons de session. Sans lui le serveur refuse de démarrer en production.\n'
            + '# Un secret FAIBLE, lui, laisse démarrer : c\'est le cas dangereux, rien ne le signale.\n'
            + '# Le changer déconnecte toutes les sessions en cours — c\'est voulu.',
    },
    {
        cle: 'DB_PASSWORD', valeur: () => crypto.randomBytes(18).toString('base64url'), critique: true,
        aide: 'Mot de passe root de MySQL. Utilisé par le conteneur de base ET par l\'app.',
    },
    {
        cle: 'DB_NAME', valeur: () => 'inko',
        aide: 'Nom de la base. Changez-le pour héberger deux instances sur le même serveur.',
    },
    {
        cle: 'CORS_ORIGINS', valeur: () => (DOMAINE ? `https://${DOMAINE}` : ''), critique: true,
        aide: 'Origines autorisées à appeler l\'API, séparées par des virgules.\n'
            + '# À LAISSER VIDE tant que l\'instance n\'est accessible que depuis la machine :\n'
            + '# vide = même origine seulement, ce qui est le réglage le plus fermé.\n'
            + '# Dès que vous exposez en ligne : CORS_ORIGINS=https://inko.exemple.fr',
    },
    {
        cle: 'TRUST_PROXY', valeur: () => '0',
        aide: 'Mettre à 1 UNIQUEMENT derrière un reverse-proxy (Caddy, nginx, Cloudflare Tunnel).\n'
            + '# À 1 sans proxy, n\'importe qui peut usurper son IP via X-Forwarded-For\n'
            + '# et contourner les limites de débit.',
    },
    {
        cle: 'BACKUP_PASSPHRASE', valeur: () => '', critique: true,
        aide: 'Chiffre les sauvegardes nocturnes (AES-256-GCM). Vide = dumps EN CLAIR sur le disque,\n'
            + '# contenant l\'email et la bibliothèque de chaque compte.\n'
            + '# ⚠ Perdre cette phrase rend les sauvegardes irrécupérables : gardez-la ailleurs.',
    },
    {
        cle: 'BACKUP_DIR', valeur: () => '',
        aide: 'Dossier des sauvegardes. Vide = server/backups. Pointez-le vers un disque réseau\n'
            + '# ou un dossier synchronisé pour qu\'une panne du serveur n\'emporte pas les dumps.',
    },
    {
        cle: 'BACKUP_KEEP', valeur: () => '14',
        aide: 'Nombre de sauvegardes conservées (rotation).',
    },
    {
        cle: 'SMTP_HOST', valeur: () => '',
        aide: 'Envoi des emails de réinitialisation de mot de passe. Vide = fonction désactivée,\n'
            + '# et le message le dit à l\'utilisateur au lieu de faire semblant.',
    },
    { cle: 'SMTP_PORT', valeur: () => '587', aide: null },
    { cle: 'SMTP_USER', valeur: () => '', aide: null },
    { cle: 'SMTP_PASS', valeur: () => '', aide: null },
    {
        cle: 'STATS_TZ', valeur: () => 'Europe/Paris',
        aide: 'Fuseau des statistiques. Un chapitre lu à 0h30 doit compter pour le bon jour.',
    },
];

function lireExistant() {
    if (!fs.existsSync(CIBLE)) return {};
    const out = {};
    for (const l of fs.readFileSync(CIBLE, 'utf8').split(/\r?\n/)) {
        const m = /^([A-Z0-9_]+)\s*=\s*(.*)$/.exec(l.trim());
        if (m) out[m[1]] = m[2];
    }
    return out;
}

// Un secret est « faible » s'il est court, s'il ressemble à un placeholder, ou
// s'il n'a presque pas de variété — les trois cas qu'on rencontre vraiment.
function secretFaible(v) {
    if (!v || v.length < 32) return true;
    if (/change|secret|password|placeholder|exemple|example|todo/i.test(v)) return true;
    return new Set(v).size < 8;
}

function auditer(vals) {
    const pbs = [];
    if (secretFaible(vals.JWT_SECRET)) {
        pbs.push({ niveau: 'critique', cle: 'JWT_SECRET',
            msg: 'absent, trop court ou devinable — les jetons de session sont forgeables' });
    }
    if (!vals.DB_PASSWORD || vals.DB_PASSWORD.length < 12) {
        pbs.push({ niveau: 'critique', cle: 'DB_PASSWORD', msg: 'absent ou trop court' });
    }
    if (!vals.BACKUP_PASSPHRASE) {
        pbs.push({ niveau: 'important', cle: 'BACKUP_PASSPHRASE',
            msg: 'vide — les sauvegardes contiennent emails et bibliothèques EN CLAIR sur le disque' });
    }
    if (vals.TRUST_PROXY === '1' && !vals.CORS_ORIGINS) {
        pbs.push({ niveau: 'important', cle: 'TRUST_PROXY',
            msg: 'à 1 sans CORS_ORIGINS : configuration de reverse-proxy incomplète' });
    }
    if (vals.CORS_ORIGINS && /\*/.test(vals.CORS_ORIGINS)) {
        pbs.push({ niveau: 'critique', cle: 'CORS_ORIGINS',
            msg: 'contient un joker — n\'importe quel site pourrait appeler l\'API avec les cookies' });
    }
    return pbs;
}

if (CHECK) {
    if (!fs.existsSync(CIBLE)) {
        console.error('::error::Aucun .env. Lance `node scripts-ci/setup-env.js`.');
        process.exit(1);
    }
    const pbs = auditer(lireExistant());
    if (!pbs.length) { console.log('✔ .env : rien à signaler.'); process.exit(0); }
    for (const p of pbs) console.log(`  ${p.niveau === 'critique' ? '✕' : '!'} ${p.cle} — ${p.msg}`);
    const bloquant = pbs.some(p => p.niveau === 'critique');
    if (bloquant) { console.error('\n::error::Configuration critique incomplète.'); process.exit(1); }
    console.log('\nAucun problème critique ; les points ci-dessus restent à traiter avant une mise en ligne.');
    process.exit(0);
}

if (fs.existsSync(CIBLE) && !FORCE) {
    console.error('Un .env existe déjà. `--check` pour l\'auditer, `--force` pour le régénérer.');
    console.error('(--force GARDE les valeurs déjà posées : rien n\'est écrasé en silence.)');
    process.exit(1);
}

// Les valeurs déjà présentes gagnent : régénérer ne doit pas faire perdre un
// mot de passe de base ou une phrase de sauvegarde.
const existant = lireExistant();
const lignes = [
    '# ============================================================',
    '# Inko — configuration d\'instance',
    '# Généré par : node scripts-ci/setup-env.js',
    '# Audite ce fichier avec : node scripts-ci/setup-env.js --check',
    '# ============================================================',
    '',
];
for (const v of VARIABLES) {
    if (v.aide) lignes.push(...('# ' + v.aide).split('\n'));
    const valeur = existant[v.cle] !== undefined ? existant[v.cle] : v.valeur();
    lignes.push(`${v.cle}=${valeur}`, '');
}
fs.writeFileSync(CIBLE, lignes.join('\n'), 'utf8');
try { fs.chmodSync(CIBLE, 0o600); } catch (e) { /* système de fichiers sans permissions */ }

const pbs = auditer(lireExistant());
console.log(`✔ .env écrit (${VARIABLES.length} variables, secret aléatoire de 64 caractères)`);
if (pbs.length) {
    console.log('\nÀ compléter avant une mise en ligne :');
    for (const p of pbs) console.log(`  ${p.niveau === 'critique' ? '✕' : '!'} ${p.cle} — ${p.msg}`);
}
