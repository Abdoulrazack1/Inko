#!/usr/bin/env node
// ============================================================
// verifier-apk.js — l'APK contient-il vraiment l'application ?
// ------------------------------------------------------------
// Deux installeurs desktop sont sortis avec ZÉRO source dedans (2.5.1 puis
// 2.5.2). Le build passait, la CI était verte, et le défaut n'a été vu qu'à
// l'installation — parce que rien ne regardait le PRODUIT, seulement le
// processus qui le fabrique.
//
// Ce script regarde le produit. Il vérifie ce qu'une coque Capacitor peut
// perdre en silence :
//
//   · le contenu embarqué a-t-il été copié dans le projet Android ?
//   · l'APK produit contient-il ce contenu, ou est-ce une coque vide ?
//
// Un APK est un ZIP : on l'ouvre sans dépendance native, avec le seul module
// Node seul, sans dépendance — pas d'outil Android requis, donc exécutable
// partout, y compris sur une machine qui n'a pas le SDK.
'use strict';

const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..');
const PUBLIC_ANDROID = path.join(RACINE, 'android', 'app', 'src', 'main', 'assets', 'public');
const DOSSIER_DEBUG   = path.join(RACINE, 'android', 'app', 'build', 'outputs', 'apk', 'debug');
const DOSSIER_RELEASE = path.join(RACINE, 'android', 'app', 'build', 'outputs', 'apk', 'release');
const DOSSIER_APK = fs.existsSync(DOSSIER_RELEASE) && fs.readdirSync(DOSSIER_RELEASE).some(f => f.endsWith('.apk'))
    ? DOSSIER_RELEASE : DOSSIER_DEBUG;

// Ce qui doit ABSOLUMENT s'y trouver. Liste courte et significative : le point
// d'entrée, le client d'API, le module qui sait à quel hub parler, et une
// feuille de style — si l'un manque, l'app ne démarre pas ou s'ouvre nue.
const INDISPENSABLES = [
    'index.html',
    'assets/js/api.js',
    'assets/js/hub.js',
    'assets/js/global.js',
    'assets/css/global.css',
];

const MIN_FICHIERS = 80;   // 123 au moment de l'écriture ; on alerte bien avant

function echec(msg) {
    console.error(`::error::${msg}`);
    process.exit(1);
}

// ── 1. Le contenu copié dans le projet Android ──────────────
function verifierAssets() {
    if (!fs.existsSync(PUBLIC_ANDROID)) {
        echec(`Contenu embarqué absent : ${PUBLIC_ANDROID}. « npx cap sync android » n'a pas tourné ?`);
    }
    const manquants = INDISPENSABLES.filter(f => !fs.existsSync(path.join(PUBLIC_ANDROID, f)));
    if (manquants.length) {
        echec(`Fichiers indispensables absents du contenu embarqué : ${manquants.join(', ')}`);
    }
    const n = compter(PUBLIC_ANDROID);
    if (n < MIN_FICHIERS) {
        echec(`Seulement ${n} fichier(s) embarqué(s), moins que le minimum attendu (${MIN_FICHIERS}). L'app serait incomplète.`);
    }

    // `hub.js` doit être RÉFÉRENCÉ par les pages, pas seulement présent :
    // copié sans être injecté, il ne s'exécuterait jamais et l'app pointerait
    // sur `/api` — c'est-à-dire sur elle-même, où il n'y a pas de serveur.
    const accueil = fs.readFileSync(path.join(PUBLIC_ANDROID, 'accueil.html'), 'utf8');
    if (!accueil.includes('assets/js/hub.js')) {
        echec('hub.js est présent mais n’est référencé par aucune page : l’app ne saurait pas à quel serveur parler.');
    }
    const iHub = accueil.indexOf('assets/js/hub.js');
    const iApi = accueil.indexOf('assets/js/api.js');
    if (iApi !== -1 && iHub > iApi) {
        echec('hub.js est chargé APRÈS api.js : l’adresse du hub serait lue trop tard, et l’API viserait la mauvaise origine.');
    }

    // ── Le JavaScript est-il lisible par un WebView ancien ? ──
    // Constaté sur émulateur API 26 : chaque script échouait sur « Unexpected
    // token . » — l'opérateur `?.`, présent 1 035 fois dans ce code. L'app se
    // lançait sur un écran mort. Le contrôle est ici parce qu'il ne coûte rien
    // et attrape le défaut AVANT de payer dix minutes d'émulateur.
    const modernes = [];
    for (const f of fs.readdirSync(path.join(PUBLIC_ANDROID, 'assets', 'js'))) {
        if (!f.endsWith('.js')) continue;
        const code = fs.readFileSync(path.join(PUBLIC_ANDROID, 'assets', 'js', f), 'utf8');
        // `?.` et `??` sont les deux formes ES2020 réellement utilisées ici.
        if (/\?\.[a-zA-Z_$([]/.test(code) || /\?\?/.test(code)) modernes.push(f);
    }
    if (modernes.length) {
        echec(`Syntaxe ES2020 non transpilée dans ${modernes.length} script(s) — `
            + `le WebView d'Android 8 ne les lira pas : ${modernes.slice(0, 5).join(', ')}`);
    }

    // Même raison pour le CSS : `inset` est une propriété de Chrome 87, ignorée
    // SANS ERREUR par le WebView d'Android 8. Toutes les modales et le lecteur
    // plein écran s'en servent — ignorée, la surcouche ne couvre rien.
    const cssModerne = [];
    const dirCss = path.join(PUBLIC_ANDROID, 'assets', 'css');
    if (fs.existsSync(dirCss)) {
        for (const f of fs.readdirSync(dirCss)) {
            if (!f.endsWith('.css')) continue;
            const code = fs.readFileSync(path.join(dirCss, f), 'utf8');
            if (/[^-]inset\s*:/.test(code)) cssModerne.push(f);
        }
    }
    if (cssModerne.length) {
        echec(`Propriété \`inset\` non abaissée dans ${cssModerne.length} feuille(s) — `
            + `le WebView d'Android 8 l'ignore et les surcouches ne couvriront rien : ${cssModerne.slice(0, 5).join(', ')}`);
    }

    console.log(`✔ contenu embarqué : ${n} fichier(s), indispensables présents, hub.js avant api.js, `
        + 'aucune syntaxe ES2020, aucun `inset` non abaissé');
}

function compter(dir) {
    let n = 0;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.isDirectory()) n += compter(path.join(dir, e.name));
        else n++;
    }
    return n;
}

// ── 2. L'APK produit ────────────────────────────────────────
// Lecture du répertoire central d'un ZIP : on ne décompresse rien, on lit la
// LISTE des entrées. Suffisant pour répondre à « est-ce que c'est dedans ? ».
function listerZip(fichier) {
    const buf = fs.readFileSync(fichier);
    // Fin du répertoire central (EOCD) : signature 0x06054b50, cherchée depuis
    // la fin car un commentaire de longueur variable peut la suivre.
    let eocd = -1;
    for (let i = buf.length - 22; i >= 0 && i > buf.length - 66000; i--) {
        if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('archive illisible : fin de répertoire central introuvable');
    const nbEntrees = buf.readUInt16LE(eocd + 10);
    let p = buf.readUInt32LE(eocd + 16);
    const noms = [];
    for (let i = 0; i < nbEntrees; i++) {
        if (buf.readUInt32LE(p) !== 0x02014b50) break;
        const lNom = buf.readUInt16LE(p + 28);
        const lExtra = buf.readUInt16LE(p + 30);
        const lComm = buf.readUInt16LE(p + 32);
        noms.push(buf.toString('utf8', p + 46, p + 46 + lNom));
        p += 46 + lNom + lExtra + lComm;
    }
    return noms;
}

function verifierApk() {
    if (!fs.existsSync(DOSSIER_APK)) echec(`Aucun APK produit : ${DOSSIER_APK} n'existe pas.`);
    const apks = fs.readdirSync(DOSSIER_APK).filter(f => f.endsWith('.apk'));
    if (!apks.length) echec(`Aucun fichier .apk dans ${DOSSIER_APK}.`);

    const chemin = path.join(DOSSIER_APK, apks[0]);
    const taille = fs.statSync(chemin).size;
    const noms = listerZip(chemin);

    const dedans = (f) => noms.includes('assets/public/' + f);
    const manquants = INDISPENSABLES.filter(f => !dedans(f));
    if (manquants.length) {
        echec(`L'APK ne contient pas : ${manquants.join(', ')}. Coque vide — c'est le défaut des installeurs 2.5.1 et 2.5.2.`);
    }
    const nPublic = noms.filter(n => n.startsWith('assets/public/')).length;
    if (nPublic < MIN_FICHIERS) {
        echec(`L'APK ne contient que ${nPublic} fichier(s) d'application (minimum ${MIN_FICHIERS}).`);
    }
    // ── La configuration réseau est-elle dans l'APK ? ───────
    // Premier essai : chercher l'entrée `res/xml/network_security_config.xml`.
    // Elle existe en DEBUG et disparaît en RELEASE — AAPT2 compile les
    // ressources dans `resources.arsc` et renomme les fichiers. Le contrôle
    // aurait donc bloqué toutes les publications, en annonçant un défaut qui
    // n'existait pas.
    //
    // Le NOM de la ressource, lui, survit dans la table compilée : on le
    // cherche dans les octets. Vrai pour les deux variantes.
    const octets = fs.readFileSync(chemin);
    if (!octets.includes(Buffer.from('network_security_config', 'utf8'))) {
        echec('La configuration réseau est absente de l’APK : le hub en clair serait refusé par Android 9+.');
    }

    // ── VIII.19 : un APK de publication doit être SIGNÉ ──────
    // Android identifie une application par sa signature. Un APK non signé ne
    // s'installe pas, et un APK signé avec une AUTRE clé est vu comme une
    // autre application : la mise à jour d'une installation existante devient
    // impossible. Le vérifier ici, c'est éviter de publier un fichier que
    // personne ne pourra installer par-dessus le précédent.
    const signe = noms.some(n => /^META-INF\/.*\.(RSA|DSA|EC)$/i.test(n))
        || noms.some(n => n === 'META-INF/BNDLTOOL.SF')
        || buf_a_signature_v2(chemin);
    // Signature EXIGÉE seulement quand l'appelant dit qu'une clé était
    // disponible (`--signature-requise`). Sans clé, un APK non signé est le
    // résultat attendu — il permet d'éprouver la chaîne sur un dépôt
    // fraîchement cloné. Le distinguer d'un oubli est le rôle de l'appelant :
    // ce script constate, il ne devine pas l'intention.
    const exigee = process.argv.includes('--signature-requise');
    if (!signe) {
        if (exigee) {
            echec('APK de publication NON SIGNÉ alors qu’une clé était fournie : '
                + 'il ne s’installera pas, et aucune installation existante ne pourra être mise à jour.');
        }
        console.warn('::warning::APK non signé — utilisable pour éprouver la chaîne, '
            + 'mais il ne s’installera pas sur un téléphone.');
    }
    const estRelease = DOSSIER_APK === DOSSIER_RELEASE;

    console.log(`✔ ${apks[0]} — ${(taille / 1048576).toFixed(1)} Mo, ${nPublic} fichier(s) d'application embarqués`);
    console.log(`  entrées totales : ${noms.length}`);
    console.log(`  variante : ${estRelease ? 'publication' : 'debug'} · signature : ${signe ? 'présente' : 'absente'}`);
}

// Signature v2/v3 : elle ne vit pas dans META-INF mais dans un bloc inséré
// juste avant le répertoire central du ZIP, identifié par ce marqueur.
// Chercher le marqueur suffit — on vérifie qu'une signature EXISTE, pas
// qu'elle est valide : c'est `apksigner` qui sait faire ça, et Android le
// refera à l'installation.
function buf_a_signature_v2(fichier) {
    const buf = fs.readFileSync(fichier);
    return buf.includes(Buffer.from('APK Sig Block 42', 'utf8'));
}

// ── Entrée ──────────────────────────────────────────────────
const args = process.argv.slice(2);
if (args.includes('--assets')) verifierAssets();
else if (args.includes('--apk')) verifierApk();
else { verifierAssets(); verifierApk(); }
