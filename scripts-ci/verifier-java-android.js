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
// `scripts-ci/java-stubs/`). Elle attrape la syntaxe, les types, les signatures
// d'`@Override`, les cibles d'annotation et les exceptions vérifiées — la
// catégorie exacte d'erreurs qu'on commet en écrivant du Java sans le
// compiler. Elle ne remplace pas la compilation réelle, faite en CI.
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const RACINE = path.join(__dirname, '..');
// Dans `scripts-ci/` et NON `tools/` : ce dernier est ignoré par git en
// ENTIER (.gitignore). Les stubs y avaient d'abord été posés sans que je le
// vérifie — 38 fichiers jamais poussés, et la vérification échouait en
// intégration continue contre un dossier vide.
const STUBS = path.join(RACINE, 'scripts-ci', 'java-stubs');
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

const RES = path.join(RACINE, 'android', 'app', 'src', 'main', 'res');

/**
 * Fabrique un `R.java` a partir des ressources REELLES.
 *
 * Le README de `java-stubs/` disait que `R.*` echappait a cette verification —
 * c'etait vrai tant qu'aucune classe n'en avait besoin. Une `RemoteViews`, elle,
 * ne peut PAS s'en passer : elle designe son gabarit et ses vues par
 * identifiant numerique.
 *
 * Or c'est exactement la ou une faute ne se voit pas. `R.id.widget_titre` ecrit
 * pour un `@+id/widget_titre` qui n'existe pas ne produit aucune erreur a
 * l'execution : le widget se pose, et reste vide ou inerte. En derivant `R` du
 * contenu de `res/`, la faute redevient une erreur de compilation.
 *
 * Ce n'est pas le vrai `R` d'aapt — les valeurs sont arbitraires. Seuls les
 * NOMS comptent ici, et ce sont eux qu'on se trompe a ecrire.
 */
function genererR(dossier) {
    const noms = { id: new Set(), layout: new Set(), drawable: new Set(), string: new Set(), xml: new Set(), mipmap: new Set(), color: new Set() };
    if (!fs.existsSync(RES)) return null;

    for (const sousDossier of fs.readdirSync(RES)) {
        const type = sousDossier.split('-')[0];         // « values-night » → « values »
        const chemin = path.join(RES, sousDossier);
        if (!fs.statSync(chemin).isDirectory()) continue;

        for (const f of fs.readdirSync(chemin)) {
            const base = f.replace(/\.[^.]+$/, '');
            if (noms[type]) noms[type].add(base);

            if (!f.endsWith('.xml')) continue;
            const contenu = fs.readFileSync(path.join(chemin, f), 'utf8');
            // Les identifiants de vues sont DECLARES par `@+id/...`.
            for (const m of contenu.matchAll(/@\+id\/([A-Za-z0-9_]+)/g)) noms.id.add(m[1]);
            // Dans `values/`, chaque ressource est nommee par son element.
            if (type === 'values') {
                for (const m of contenu.matchAll(/<(string|color|dimen|style)\s+name="([A-Za-z0-9_.]+)"/g)) {
                    if (noms[m[1]]) noms[m[1]].add(m[2]);
                }
            }
        }
    }

    let n = 0;
    const classe = Object.entries(noms).map(([type, set]) => {
        const champs = [...set].sort().map((nom) => {
            n++;
            return `        public static final int ${nom.replace(/\./g, '_')} = 0x7f${String(n).padStart(6, '0')};`;
        }).join('\n');
        return `    public static final class ${type} {\n${champs}\n    }`;
    }).join('\n');

    const paquet = path.join(dossier, 'app', 'inko', 'mobile');
    fs.mkdirSync(paquet, { recursive: true });
    fs.writeFileSync(path.join(paquet, 'R.java'),
        `package app.inko.mobile;
// Genere depuis res/ par verifier-java-android.js — ne pas versionner.
public final class R {
${classe}
}
`);
    return n;
}

/**
 * Les pieges d'aapt que `javac` ne peut PAS voir.
 *
 * Le compilateur Java ignore tout de `res/` : une chaine mal echappee passe
 * ici et fait echouer la construction REELLE, plusieurs minutes plus tard, en
 * integration continue. C'est arrive : une apostrophe nue dans
 * `widget_description` a fait tomber tout le `mergeDebugResources` avec un
 * message qui ne parle meme pas d'apostrophe (« Invalid unicode escape
 * sequence in string »).
 *
 * Trois secondes ici valent mieux que six minutes la-bas.
 */
function verifierRessources() {
    if (!fs.existsSync(RES)) return 0;
    const soucis = [];
    let n = 0;

    for (const sousDossier of fs.readdirSync(RES)) {
        if (!sousDossier.startsWith('values')) continue;
        const dir = path.join(RES, sousDossier);
        if (!fs.statSync(dir).isDirectory()) continue;

        for (const f of fs.readdirSync(dir)) {
            if (!f.endsWith('.xml')) continue;
            const contenu = fs.readFileSync(path.join(dir, f), 'utf8');
            for (const m of contenu.matchAll(/<string\s+name="([^"]+)"[^>]*>([\s\S]*?)<\/string>/g)) {
                n++;
                const [, nom, valeur] = m;
                const ligne = contenu.slice(0, m.index).split('\n').length;
                // Apostrophe et guillemet doivent etre echappes dans une
                // ressource `string` : aapt refuse la chaine, et son message
                // ne parle meme pas d'apostrophe.
                if (/(^|[^\\])'/.test(valeur)) {
                    soucis.push(`${sousDossier}/${f}:${ligne} — « ${nom} » contient une apostrophe `
                        + `non echappee (ecrire \\' ou reformuler)`);
                }
                if (/(^|[^\\])"/.test(valeur)) {
                    soucis.push(`${sousDossier}/${f}:${ligne} — « ${nom} » contient un guillemet non echappe`);
                }
            }
        }
    }

    if (soucis.length) {
        echec('ressources refusees par aapt (la construction de l’APK echouerait) :\n  '
            + soucis.join('\n  '));
    }
    return n;
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
            echec(`les stubs de scripts-ci/java-stubs ne compilent pas :\n${e.stdout || ''}${e.stderr || ''}`);
        }

        // 2. Le `R` derive des ressources, compile avec les stubs.
        const genere = path.join(tmp, 'genere');
        const nbRes = genererR(genere);
        if (nbRes) {
            try {
                execFileSync(javac, ['-nowarn', '-cp', outStubs, '-d', outStubs, ...javaSous(genere)],
                    { stdio: 'pipe', encoding: 'utf8' });
            } catch (e) {
                echec(`le R genere depuis res/ ne compile pas :
${e.stdout || ''}${e.stderr || ''}`);
            }
        }

        // 3. Le code de l'application, contre ces stubs.
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
                    + 'Relever sa signature réelle et l’ajouter à scripts-ci/java-stubs/ '
                    + '(voir le README qui s’y trouve).');
            }
            echec(`compilation du code Android en échec :\n${sortie}`);
        }

        const nbChaines = verifierRessources();

        const n = javaSous(SOURCES).length;
        console.log(`✔ ${n} fichier(s) Java compilé(s) sans erreur ni avertissement `
            + `(stubs${nbRes ? ` + ${nbRes} ressources dérivées de res/` : ''}, hors SDK Android `
            + `— la compilation réelle reste faite en CI)`);
        if (nbChaines) console.log(`✔ ${nbChaines} chaîne(s) de res/values acceptables par aapt`);
    } finally {
        try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { /* laissé au système */ }
    }
}

main();
