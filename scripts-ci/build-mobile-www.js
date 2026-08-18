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

// Les extensions embarquees. Les MEMES fichiers que le hub execute : c'est le
// point de tout l'adaptateur (`extensions-navigateur.js`). En copier une
// version modifiee pour le mobile reintroduirait la divergence qu'on evite.
//
// `hashes.json` part avec elles : le telephone verifie l'empreinte avant
// d'executer, comme le fait le serveur (audit S-2). Sans ca, on executerait
// du code non verifie — et c'est du code qui parle au reseau.
const EXTENSIONS_SRC = path.join(RACINE, 'extensions-community');

// Pages exclues : elles n'ont pas de sens dans l'app, ou exposent des écrans
// d'administration qui ne doivent pas voyager.
const PAGES_EXCLUES = new Set(['offline.html']);

// ── Le WebView d'Android 8 ne lit pas l'ES2020 ──────────────
// Constaté sur émulateur API 26, après que l'app se soit installée, lancée et
// que le WebView se soit construit : CHAQUE fichier JavaScript échouait sur
// « Uncaught SyntaxError: Unexpected token . ». C'est l'opérateur `?.`, utilisé
// 1 035 fois dans ce code. L'application se serait ouverte sur un écran mort,
// sans rien pour l'expliquer.
//
// Le WebView d'Android est mis à jour par le Play Store indépendamment du
// système, donc un téléphone entretenu n'aurait sans doute rien vu. Mais faire
// dépendre le démarrage de l'app d'une mise à jour que l'utilisateur ne
// contrôle pas, c'est choisir de ne pas savoir qui échoue.
//
// On transpile donc le bundle MOBILE, et lui seul : le web et le desktop
// tournent sur des moteurs récents et n'ont aucune raison de payer ça.
const CIBLE = 'chrome61';   // le WebView livré avec Android 8.0

let esbuild = null;
try { esbuild = require('esbuild'); } catch (e) { /* absent : on copiera tel quel */ }

function transpiler(src, dst) {
    if (!esbuild) { fs.copyFileSync(src, dst); return false; }
    const code = fs.readFileSync(src, 'utf8');
    const r = esbuild.transformSync(code, {
        target: CIBLE,
        format: 'iife',       // ces fichiers sont déjà des IIFE : on préserve la forme
        loader: 'js',
        legalComments: 'inline',
    });
    fs.writeFileSync(dst, r.code);
    return true;
}

// ── Le CSS aussi : `inset` est une propriété de Chrome 87 ───
// 38 usages dans ces feuilles, dont `position: fixed; inset: 0` sur le lecteur
// plein écran et sur toutes les modales. Sur le WebView d'Android 8, la
// déclaration est ignorée SANS ERREUR : l'élément garde des décalages `auto`,
// se pose n'importe où et ne couvre rien. Repéré sur l'écran de configuration
// du hub, qui apparaissait dans le DOM sans jamais se voir.
//
// esbuild abaisse `inset` en `top/right/bottom/left`, comme il abaisse `?.`.
function transpilerCss(src, dst) {
    if (!esbuild) { fs.copyFileSync(src, dst); return false; }
    const r = esbuild.transformSync(fs.readFileSync(src, 'utf8'), {
        target: CIBLE,
        loader: 'css',
        legalComments: 'inline',
    });
    fs.writeFileSync(dst, r.code);
    return true;
}

function copierDossier(src, dst) {
    if (!fs.existsSync(src)) return 0;
    fs.mkdirSync(dst, { recursive: true });
    let n = 0;
    for (const e of fs.readdirSync(src, { withFileTypes: true })) {
        const s = path.join(src, e.name), d = path.join(dst, e.name);
        if (e.isDirectory()) { n += copierDossier(s, d); continue; }
        // Les vendors sont déjà distribués en ES5 : les retoucher n'apporte
        // rien et risquerait de casser un minifieur tiers.
        if (e.name.endsWith('.js') && !s.includes('vendor')) { transpiler(s, d); transpiles++; }
        else if (e.name.endsWith('.css')) { transpilerCss(s, d); transpilesCss++; }
        else fs.copyFileSync(s, d);
        n++;
    }
    return n;
}

let transpiles = 0;
let transpilesCss = 0;

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
    // ── Extensions ──────────────────────────────────────────
    let nbExt = 0;
    if (fs.existsSync(EXTENSIONS_SRC)) {
        const dest = path.join(SORTIE, 'extensions');
        fs.mkdirSync(dest, { recursive: true });
        for (const nom of fs.readdirSync(EXTENSIONS_SRC)) {
            const idx = path.join(EXTENSIONS_SRC, nom, 'index.js');
            if (!fs.existsSync(idx)) continue;
            fs.mkdirSync(path.join(dest, nom), { recursive: true });
            fs.copyFileSync(idx, path.join(dest, nom, 'index.js'));
            nbExt++;
        }
        const h = path.join(EXTENSIONS_SRC, 'hashes.json');
        if (fs.existsSync(h)) fs.copyFileSync(h, path.join(dest, 'hashes.json'));
        console.log(`  ${nbExt} extension(s) embarquee(s) + leurs empreintes`);
    }

    for (const f of FICHIERS_RACINE) {
        const s = path.join(RACINE, f);
        if (fs.existsSync(s)) { fs.copyFileSync(s, path.join(SORTIE, f)); actifs++; }
    }

    // Le script de configuration du hub doit être chargé AVANT `api.js` sur
    // chaque page : c'est lui qui décide vers quel serveur les appels partent.
    injecterHub(SORTIE);

    console.log(`✔ mobile/www : ${pages} page(s), ${actifs} fichier(s) d'actifs`);
    if (esbuild) console.log(`  ${transpiles} script(s) et ${transpilesCss} feuille(s) transpilé(s) vers ${CIBLE}`);
    else console.warn('  ⚠ esbuild absent : scripts copiés tels quels — l’app échouera sur un WebView ancien.');
}

// Insère `<script src="assets/js/hub.js">` juste avant `api.js` dans chaque
// page. On le fait ICI, sur la copie, plutôt que dans les 24 pages du dépôt :
// le hub n'existe que dans l'app, et le site web n'a rien à en savoir.
function injecterHub(dir) {
    // `natif.js` AVANT `hub.js` : l'écran d'appairage nomme l'appareil, et ce
    // nom vient du greffon Device. « Inko sur Linux armv8l » — ce que rend le
    // navigateur — ne désigne rien quand trois téléphones de la maison sont
    // appairés au même hub.
    //
    // `sources-embarquees.js` AVANT `api.js` aussi : c'est `api.js` qui
    // consulte `window.INKO_SOURCES_EMBARQUEES` pour savoir s'il peut
    // repondre sans hub. Charge apres, le moteur existerait — mais trop tard
    // pour le premier appel de la page, celui qui remplit l'accueil.
    //
    // ⚠ L'ORDRE COMPTE, et une erreur ici ne se voit nulle part ailleurs.
    // `sources-embarquees.js` teste `window.INKO_EXTENSIONS` en fin de fichier
    // pour charger les neuf extensions. Injecte AVANT l'adaptateur, ce test
    // etait toujours faux : AUCUNE extension n'a jamais ete chargee sur
    // l'appareil, et la page des sources restait vide.
    //
    // L'adaptateur (cheerio puis extensions) vient donc AVANT ceux qui s'en
    // servent, et `api.js` reste bon dernier.
    const balises = [
        '<script src="assets/js/natif.js"></script>',
        '<script src="assets/js/hub.js"></script>',
        '<script src="assets/js/cheerio-navigateur.js"></script>',
        '<script src="assets/js/extensions-navigateur.js"></script>',
        '<script src="assets/js/sources-embarquees.js"></script>',
        '<script src="assets/js/moi-local.js"></script>',
        '<script src="assets/js/fichiers-locaux.js"></script>',
    ];
    let touchees = 0;
    for (const f of fs.readdirSync(dir)) {
        if (!f.endsWith('.html')) continue;
        const p = path.join(dir, f);
        let html = fs.readFileSync(p, 'utf8');
        if (html.includes('assets/js/hub.js')) continue;
        const m = html.match(/\s*<script src="assets\/js\/api\.js"[^>]*><\/script>/);
        if (!m) continue;
        html = html.replace(m[0], `\n  ${balises.join('\n  ')}${m[0]}`);
        fs.writeFileSync(p, html);
        touchees++;
    }
    console.log(`  modules du mode autonome injectés dans ${touchees} page(s)`);
}

construire();
