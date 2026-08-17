#!/usr/bin/env node
// ============================================================
// verifier-java-android.js — compiler le code Android sans le SDK
// ------------------------------------------------------------
// Le projet contient quatre classes Java (activité + trois greffons maison :
// touches de volume, découverte mDNS, raccourcis d'icône). Elles n'étaient
// vérifiées qu'en intégration continue — un retour de plusieurs minutes, après
// un `push`, pour une erreur de signature qui se voit en trois secondes.
//
// La raison de ce détour : compiler pour de vrai demande le SDK Android, dont
// l'installation suppose d'accepter les conditions de licence de Google. C'est
// un acte qui engage la personne qui l'accepte — il n'a pas à être automatisé.
//
// D'où cette vérification intermédiaire : un `javac` contre des stubs (voir
// `tools/java-stubs/`). Elle attrape la syntaxe, les types, les signatures
// d'`@Override`, les cibles d'annotation et les exceptions vérifiées — la
// catégorie exacte d'erreurs qu'on commet en écrivant du Java sans le
// compiler. Elle ne remplace pas la compilation réelle, faite en CI.
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const RACINE = path.join(__dirname, '..');
const STUBS = path.join(RACINE, 'tools', 'java-stubs');
const SOURCES = path.join(RACINE, 'android', 'app', 'src', 'main', 'java');

function echec(msg) {
    console.error(`::error::${msg}`);
    process.exit(1);
}

/**
 * Où est `javac` ? On regarde, dans l'ordre : JAVA_HOME, le PATH, puis les
 * emplacements où une JDK atterrit couramment sur cette machine.
 *
 * L'absence de JDK n'est PAS un échec : sur un poste qui n'en a pas, cette
 * vérification n'a simplement pas lieu. En faire une erreur bloquerait quelqu'un
 * qui ne touche pas du tout à la partie Android.
 */
function trouverJavac() {
    const exe = process.platform === 'win32' ? 'javac.exe' : 'javac';
    const candidats = [];
    if (process.env.JAVA_HOME) candidats.push(path.join(process.env.JAVA_HOME, 'bin', exe));
    for (const base of [
        path.join(os.homedir(), 'outils'),
        path.join(process.env.ProgramFiles || 'C:/Program Files', 'Eclipse Adoptium'),
        path.join(process.env.ProgramFiles || 'C:/Program Files', 'Java'),
        path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Android Studio', 'jbr'),
        path.join(process.env.ProgramFiles || 'C:/Program Files', 'Android', 'Android Studio', 'jbr'),
    ]) {
        try {
            if (!fs.existsSync(base)) continue;
            if (fs.existsSync(path.join(base, 'bin', exe))) { candidats.push(path.join(base, 'bin', exe)); continue; }
            for (const d of fs.readdirSync(base)) {
                const p = path.join(base, d, 'bin', exe);
                if (fs.existsSync(p)) candidats.push(p);
            }
        } catch (e) { /* dossier illisible : suivant */ }
    }
    for (const c of candidats) if (fs.existsSync(c)) return c;
    // Dernier recours : sur le PATH.
    try {
        execFileSync(exe, ['-version'], { stdio: 'ignore' });
        return exe;
    } catch (e) { return null; }
}

function javaSous(dossier) {
    const out = [];
    (function marcher(d) {
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
            const p = path.join(d, e.name);
            if (e.isDirectory()) marcher(p);
            else if (e.name.endsWith('.java')) out.push(p);
        }
    })(dossier);
    return out;
}

function main() {
    const javac = trouverJavac();
    if (!javac) {
        console.log('⚠ aucun JDK trouvé — vérification Java sautée.');
        console.log('  Pour l’activer : une JDK 17 dans ~/outils, ou JAVA_HOME défini.');
        return;   // volontairement PAS une erreur
    }
    if (!fs.existsSync(SOURCES)) {
        console.log('⚠ pas de sources Android — rien à vérifier.');
        return;
    }

    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'inko-java-'));
    const outStubs = path.join(tmp, 'stubs');
    const outApp = path.join(tmp, 'app');

    try {
        // 1. Les stubs. S'ils ne compilent pas, c'est eux qu'il faut corriger —
        //    et le dire distinctement évite de croire que le code de l'app est
        //    en cause.
        try {
            execFileSync(javac, ['-nowarn', '-d', outStubs, ...javaSous(STUBS)],
                { stdio: 'pipe', encoding: 'utf8' });
        } catch (e) {
            echec(`les stubs de tools/java-stubs ne compilent pas :\n${e.stdout || ''}${e.stderr || ''}`);
        }

        // 2. Le code de l'application, contre ces stubs.
        const fichiers = javaSous(SOURCES);
        try {
            execFileSync(javac, ['-cp', outStubs, '-d', outApp, '-Xlint:all', ...fichiers],
                { stdio: 'pipe', encoding: 'utf8' });
        } catch (e) {
            const sortie = `${e.stdout || ''}${e.stderr || ''}`;
            // Un symbole introuvable est presque toujours un stub manquant, pas
            // une faute dans l'app : le dire évite une demi-heure de recherche
            // au mauvais endroit.
            const manquant = /cannot find symbol[\s\S]*?symbol:\s+class (\w+)/.exec(sortie);
            if (manquant) {
                console.error(`::error::\`${manquant[1]}\` est absent des stubs. `
                    + 'Relever sa signature réelle et l’ajouter à tools/java-stubs/ '
                    + '(voir le README qui s’y trouve).');
            }
            echec(`compilation du code Android en échec :\n${sortie}`);
        }

        const n = javaSous(SOURCES).length;
        console.log(`✔ ${n} fichier(s) Java compilé(s) sans erreur ni avertissement `
            + `(stubs, hors SDK Android — la compilation réelle reste faite en CI)`);
    } finally {
        try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { /* laissé au système */ }
    }
}

main();
