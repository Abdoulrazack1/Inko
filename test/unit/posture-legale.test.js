// ============================================================
// test/unit/posture-legale.test.js — les textes disent-ils encore vrai ?
// ------------------------------------------------------------
// Une notice légale ou une politique de confidentialité inexacte est PIRE
// qu'absente : elle ressemble à une déclaration trompeuse, et c'est
// précisément ce dont elle est censée protéger.
//
// Deux dérives réelles ont motivé ce fichier, toutes deux nées d'un
// changement de code que les textes n'ont pas suivi :
//
//   · `network_security_config.xml` justifiait l'autorisation du trafic en
//     clair par « l'application ne contacte QUE le hub » — devenu faux avec
//     le mode autonome ;
//   · `NOTICE.md` affirmait que la distribution « ne contient aucune source
//     par défaut », alors que l'installeur et l'APK embarquent les neuf
//     extensions.
//
// Ces tests ne relisent pas les textes : ils confrontent leurs AFFIRMATIONS
// VÉRIFIABLES au code. Un document qui ne peut pas se périmer en silence.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const lire = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

/** Le code seul, débarrassé des commentaires qui citent souvent des URL. */
function codeSeul(src) {
    return src.replace(/\/\*[\s\S]*?\*\//g, '')
        .split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
}

/** Tous les domaines que le client peut contacter, extensions comprises. */
function domainesContactes() {
    const hotes = new Set();
    const ajoute = (src) => {
        for (const m of codeSeul(src).matchAll(/['"`]https:\/\/([a-z0-9.-]+)/gi)) hotes.add(m[1]);
    };
    for (const f of fs.readdirSync(path.join(ROOT, 'assets', 'js'))) {
        if (f.endsWith('.js')) ajoute(lire(path.join('assets', 'js', f)));
    }
    const ext = path.join(ROOT, 'extensions-community');
    for (const d of fs.readdirSync(ext)) {
        const p = path.join(ext, d, 'index.js');
        if (fs.existsSync(p)) ajoute(fs.readFileSync(p, 'utf8'));
    }
    return hotes;
}

test('aucune télémétrie n’est introduite', () => {
    // La politique de confidentialité l'affirme sans réserve. C'est l'une des
    // rares promesses absolues du projet : une seule dépendance d'analytique
    // la rendrait fausse.
    // ⚠ On cherche des DOMAINES, pas des mots. Ma première version listait
    // « plausible » (l'outil de mesure) et mordait sur le mot français dans un
    // commentaire — un contrôle qui crie au loup finit désactivé.
    const pisteurs = /(google-analytics|googletagmanager|sentry|mixpanel|amplitude|segment|hotjar|matomo|plausible)\.(io|com|net|sh)/i;
    const fautifs = [];
    for (const f of fs.readdirSync(path.join(ROOT, 'assets', 'js'))) {
        if (!f.endsWith('.js')) continue;
        if (pisteurs.test(codeSeul(lire(path.join('assets', 'js', f))))) fautifs.push(f);
    }
    assert.deepEqual(fautifs, [], `mesure d’audience détectée : ${fautifs.join(', ')}`);
});

test('la page de confidentialité liste les domaines réellement contactés', () => {
    // Sans ce contrôle, ajouter une source ferait silencieusement partir
    // l'adresse IP de l'utilisateur vers un domaine que rien n'annonce.
    const page = lire('confidentialite.html');
    // Ceux qui ne relèvent pas de la lecture (mises à jour, aide) sont hors
    // du périmètre de cette section, qui décrit les SOURCES.
    const horsPerimetre = new Set(['api.github.com', 'github.com', 'youtube.com', 'www.youtube.com',
        'all.api.radio-browser.info']);

    const manquants = [...domainesContactes()]
        .filter((h) => !horsPerimetre.has(h))
        .filter((h) => !page.includes(h));

    assert.deepEqual(manquants, [],
        `domaines contactés mais absents de la page de confidentialité : ${manquants.join(', ')}`);
});

test('la page annonce l’exposition d’adresse IP du mode autonome', () => {
    // C'est le changement matériel apporté par l'autonomie : avec un hub, les
    // sites ne voient que SON adresse ; sans hub, ils voient celle de
    // l'utilisateur et peuvent y associer un historique de lecture.
    const page = lire('confidentialite.html');
    assert.match(page, /adresse IP/i, 'l’exposition d’IP doit être annoncée');
    assert.match(page, /Mode autonome/i);
    assert.match(page, /Connexion au hub/i, 'la sortie doit être indiquée');
});

test('la notice ne prétend plus que la distribution est sans extensions', () => {
    // L'installeur et l'APK les embarquent. L'affirmation inverse ressemblait
    // à une déclaration trompeuse.
    const notice = lire('NOTICE.md');
    assert.ok(!/ne contient\s+\*\*aucune source de contenu\*\* par défaut/.test(notice),
        'l’affirmation périmée doit avoir disparu');
    assert.match(notice, /embarquent le code\s+des extensions/,
        'la notice doit décrire ce que la distribution contient vraiment');
});

test('les extensions sont bien embarquées — la notice dit vrai', () => {
    // Le contrôle inverse du précédent : si un jour on cessait de les
    // embarquer, la notice redeviendrait fausse dans l'autre sens.
    const build = lire('scripts-ci/build-mobile-www.js');
    assert.match(build, /EXTENSIONS_SRC/, 'le paquet mobile doit embarquer les extensions');
    const tauri = lire('desktop-tauri/src-tauri/tauri.conf.json');
    assert.match(tauri, /extensions-community/, 'l’installeur aussi');
});

test('la vérification d’empreinte annoncée existe des DEUX côtés', () => {
    // La notice s'en prévaut : « ce qui s'exécute est exactement ce qui a été
    // publié ». Une promesse vérifiable doit être vérifiée.
    assert.match(lire('NOTICE.md'), /SHA-256/);
    assert.ok(fs.existsSync(path.join(ROOT, 'extensions-community', 'hashes.json')));
    assert.match(lire('assets/js/sources-embarquees.js'), /vue !== empreintes\[id\]/,
        'le téléphone doit refuser une empreinte qui ne correspond pas');
});

test('aucune œuvre n’est distribuée avec le code', () => {
    // Le cœur de la posture : Inko décrit COMMENT accéder, il ne redistribue
    // rien. Une planche ou un chapitre qui atterrirait dans le dépôt la
    // détruirait — et ça arrive par un simple fichier de test oublié.
    const suspects = [];
    const parcourir = (dir, prof = 0) => {
        if (prof > 3) return;
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            if (/node_modules|\.git|target|build|mobile[\\/]www/.test(e.name)) continue;
            const p = path.join(dir, e.name);
            if (e.isDirectory()) { parcourir(p, prof + 1); continue; }
            // Une archive de chapitre ou une planche nommée sans ambiguïté.
            if (/\.(cbz|cbr|epub)$/i.test(e.name)) suspects.push(path.relative(ROOT, p));
        }
    };
    parcourir(ROOT);
    assert.deepEqual(suspects, [], `fichiers d’œuvre dans le dépôt : ${suspects.join(', ')}`);
});

test('la licence déclarée et le fichier LICENSE concordent', () => {
    const pkg = JSON.parse(lire('package.json'));
    const licence = lire('LICENSE');
    assert.ok(pkg.license, 'package.json doit déclarer une licence');
    if (/apache/i.test(pkg.license)) assert.match(licence, /Apache License/);
    else if (/mit/i.test(pkg.license)) assert.match(licence, /MIT License/);
});
