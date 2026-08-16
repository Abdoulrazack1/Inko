#!/usr/bin/env node
// ============================================================
// build-mobile-www.js — prépare ce que l'APK embarque
// ------------------------------------------------------------
// Capacitor veut un dossier `webDir` autonome. Le frontend d'Inko vit à la
// RACINE du dépôt, mêlé au serveur, aux tests et à `node_modules` : pointer
// Capacitor dessus embarquerait tout ça dans l'APK — le code serveur, les
// extensions de scraping, les sauvegardes. On copie donc explicitement ce qui
// doit partir, et rien d'autre.
//
// ── Pourquoi embarquer le front plutôt que charger l'URL du hub ──
// Capacitor sait pointer sa WebView sur une URL distante (`server.url`), ce
// qui aurait été plus court. Mais l'app ne servirait alors à RIEN sans hub
// joignable : pas d'écran, pas même un message. En embarquant l'interface,
// l'app s'ouvre toujours, peut dire « hub introuvable », proposer d'en changer
// l'adresse, et — plus tard (P2.3) — afficher ce qui est déjà téléchargé.
// C'est l'option C de l'audit (VIII.2), livrée en commençant par B.
//
// L'interface embarquée appelle l'API du hub en CROSS-ORIGIN. `security.js`
// l'anticipe déjà : « compat desktop/PWA/mobile Capacitor, dont les origines
// varient : capacitor://, http://localhost, file:// ».
'use strict';

const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..');
const SORTIE = path.join(RACINE, 'mobile', 'www');

// Ce qui part dans l'APK. Liste EXPLICITE : un glob attraperait un jour un
// fichier qu'on ne voulait pas distribuer.
const DOSSIERS = ['assets/css', 'assets/js', 'assets/font', 'assets/img', 'assets/i18n', 'assets/vendor'];
const FICHIERS_RACINE = ['manifest.webmanifest', 'service-worker.js', 'favicon.ico', 'robots.txt'];

// Pages exclues : elles n'ont pas de sens dans l'app, ou exposent des écrans
// d'administration qui ne doivent pas voyager.
const PAGES_EXCLUES = new Set(['offline.html']);

function copierDossier(src, dst) {
    if (!fs.existsSync(src)) return 0;
    fs.mkdirSync(dst, { recursive: true });
    let n = 0;
    for (const e of fs.readdirSync(src, { withFileTypes: true })) {
        const s = path.join(src, e.name), d = path.join(dst, e.name);
        if (e.isDirectory()) n += copierDossier(s, d);
        else { fs.copyFileSync(s, d); n++; }
    }
    return n;
}

function construire() {
    fs.rmSync(SORTIE, { recursive: true, force: true });
    fs.mkdirSync(SORTIE, { recursive: true });

    let pages = 0;
    for (const f of fs.readdirSync(RACINE)) {
        if (!f.endsWith('.html') || PAGES_EXCLUES.has(f)) continue;
        fs.copyFileSync(path.join(RACINE, f), path.join(SORTIE, f));
        pages++;
    }
    if (!fs.existsSync(path.join(SORTIE, 'index.html'))) {
        console.error('::error::index.html manquant — Capacitor n’a pas de point d’entrée.');
        process.exit(1);
    }

    let actifs = 0;
    for (const d of DOSSIERS) actifs += copierDossier(path.join(RACINE, d), path.join(SORTIE, d));
    for (const f of FICHIERS_RACINE) {
        const s = path.join(RACINE, f);
        if (fs.existsSync(s)) { fs.copyFileSync(s, path.join(SORTIE, f)); actifs++; }
    }

    // Le script de configuration du hub doit être chargé AVANT `api.js` sur
    // chaque page : c'est lui qui décide vers quel serveur les appels partent.
    injecterHub(SORTIE);

    console.log(`✔ mobile/www : ${pages} page(s), ${actifs} fichier(s) d'actifs`);
}

// Insère `<script src="assets/js/hub.js">` juste avant `api.js` dans chaque
// page. On le fait ICI, sur la copie, plutôt que dans les 24 pages du dépôt :
// le hub n'existe que dans l'app, et le site web n'a rien à en savoir.
function injecterHub(dir) {
    const balise = '<script src="assets/js/hub.js"></script>';
    let touchees = 0;
    for (const f of fs.readdirSync(dir)) {
        if (!f.endsWith('.html')) continue;
        const p = path.join(dir, f);
        let html = fs.readFileSync(p, 'utf8');
        if (html.includes('assets/js/hub.js')) continue;
        const m = html.match(/\s*<script src="assets\/js\/api\.js"[^>]*><\/script>/);
        if (!m) continue;
        html = html.replace(m[0], `\n  ${balise}${m[0]}`);
        fs.writeFileSync(p, html);
        touchees++;
    }
    console.log(`  hub.js injecté dans ${touchees} page(s)`);
}

construire();
