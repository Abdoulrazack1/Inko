// ============================================================
// correcteurs/index.js — les correcteurs de sondes
// ------------------------------------------------------------
// Un correcteur traite UNE famille de trouvailles de façon mécanique.
// Contrat :
//
//   {
//     nom, description,
//     couvre: ['ID-DE-TROUVAILLE', …],     // ids des sondes qu'il sait traiter
//     risque: 'nul' | 'faible' | 'moyen',  // 'moyen' exige --risque=moyen
//     async plan(ctx)  -> [{ fichier, resume, avant?, apres? }]
//     async appliquer(ctx) -> [{ fichier, resume }]
//   }
//
// Règles non négociables :
//   · IDEMPOTENT : appliqué deux fois, il ne change rien la seconde fois ;
//   · il n'écrit que ce qu'il a prévu dans `plan` ;
//   · il ne touche jamais un fichier modifié dans l'arbre de travail
//     (l'orchestrateur le vérifie via git avant d'appeler appliquer) ;
//   · une erreur ne laisse pas de demi-écriture : écriture atomique
//     (fichier temporaire + renommage).
//
// Ce qui n'est PAS corrigeable mécaniquement (fusion de fichiers obèses,
// refonte d'écrans, nouveaux contenus) reste dans le document d'audit :
// un correcteur qui devine est un correcteur qui casse.
// ============================================================
'use strict';
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const RACINE = process.env.SONDES_RACINE ? path.resolve(process.env.SONDES_RACINE) : path.resolve(__dirname, '..', '..', '..');
const lire = (f) => fs.readFileSync(path.join(RACINE, f), 'utf8');
const rel = (p) => path.relative(RACINE, p).split(path.sep).join('/');

/** Écriture atomique en conservant les fins de ligne d'origine. */
function ecrire(f, texte) {
    const cible = path.join(RACINE, f);
    const tmp = cible + '.sonde-tmp';
    fs.writeFileSync(tmp, texte);
    fs.renameSync(tmp, cible);
}
const crlf = (t) => /\r\n/.test(t);
const versLF = (t) => t.replace(/\r\n/g, '\n');
const versOriginal = (t, original) => (crlf(original) ? t.replace(/\n/g, '\r\n') : t);

function lister(re, dossiers) {
    const out = [];
    const marche = (d) => {
        for (const e of fs.readdirSync(path.join(RACINE, d), { withFileTypes: true })) {
            if (['node_modules', '.git', 'promo', 'test-results', 'android', 'mobile', 'desktop-tauri'].includes(e.name)) continue;
            const p = d ? d + '/' + e.name : e.name;
            if (e.isDirectory()) marche(p); else if (re.test(e.name)) out.push(p);
        }
    };
    for (const d of dossiers) marche(d);
    return out;
}

const pagesRacine = () => fs.readdirSync(RACINE).filter(f => f.endsWith('.html'));

/** Fabrique un correcteur « transformation de texte » : f(texte, fichier) → texte. */
function parTransformation({ nom, description, couvre, risque, fichiers, transformer }) {
    const calculer = () => {
        const changements = [];
        for (const f of fichiers()) {
            const brut = lire(f), t = versLF(brut);
            const neuf = transformer(t, f);
            if (neuf !== t) changements.push({ fichier: f, resume: description, brut, neuf });
        }
        return changements;
    };
    return {
        nom, description, couvre, risque,
        async plan() { return calculer().map(({ fichier, resume }) => ({ fichier, resume })); },
        async appliquer() {
            const faits = [];
            for (const c of calculer()) { ecrire(c.fichier, versOriginal(c.neuf, c.brut)); faits.push({ fichier: c.fichier, resume: c.resume }); }
            return faits;
        },
    };
}

/** Correcteur « relancer un générateur » : le fichier généré est la sortie, le script la source. */
function parGenerateur({ nom, description, couvre, risque, commande, fichiersGeneres }) {
    return {
        nom, description, couvre, risque,
        async plan() {
            const r = cp.spawnSync(process.execPath, [...commande, '--check'], { cwd: RACINE, encoding: 'utf8', timeout: 120000 });
            return r.status === 0 ? [] : fichiersGeneres.map(f => ({ fichier: f, resume: 'régénéré par ' + commande.join(' ') }));
        },
        async appliquer() {
            const r = cp.spawnSync(process.execPath, commande, { cwd: RACINE, encoding: 'utf8', timeout: 180000 });
            if (r.status !== 0) throw new Error((r.stderr || r.stdout || '').split('\n').slice(-4).join(' '));
            return fichiersGeneres.map(f => ({ fichier: f, resume: 'régénéré' }));
        },
    };
}

const CORRECTEURS = [
    // ── nul : ne peut pas changer le comportement ─────────────
    parTransformation({
        nom: 'noopener', risque: 'nul', couvre: ['SEC-NOOPENER'],
        description: 'ajoute rel="noopener noreferrer" aux liens target="_blank"',
        fichiers: () => [...pagesRacine(), ...lister(/\.js$/, ['assets/js'])],
        transformer: (t) => t.replace(/<a\b([^>]*\btarget=["']_blank["'][^>]*)>/g, (m, a) => /\brel=/.test(a) ? m : `<a${a} rel="noopener noreferrer">`),
    }),
    parTransformation({
        nom: 'lang', risque: 'nul', couvre: ['A11Y-LANG'],
        description: 'ajoute lang="fr" sur <html>',
        fichiers: () => pagesRacine(),
        transformer: (t) => t.replace(/<html(?![^>]*\blang=)([^>]*)>/i, '<html lang="fr"$1>'),
    }),
    parGenerateur({ nom: 'openapi', risque: 'nul', couvre: ['RTE-OPENAPI-DERIVE'], description: 'régénère server/openapi.json', commande: ['scripts-ci/gen-openapi.js'], fichiersGeneres: ['server/openapi.json'] }),
    parGenerateur({ nom: 'precache', risque: 'nul', couvre: ['PERF-PRECACHE-DERIVE'], description: 'régénère la liste de précache du service worker', commande: ['scripts-ci/gen-precache.js'], fichiersGeneres: ['service-worker.js'] }),
    parGenerateur({ nom: 'meta', risque: 'nul', couvre: ['DOC-CHIFFRE-PERIME'], description: 'régénère les métadonnées dérivées', commande: ['scripts-ci/gen-meta.js'], fichiersGeneres: ['(voir gen-meta)'] }),

    // ── faible : change du CSS/JSON de façon bornée ───────────
    {
        nom: 'mouvement-reduit', risque: 'faible', couvre: ['A11Y-REDUCED-MOTION'],
        description: 'ajoute le bloc @media (prefers-reduced-motion: reduce) à global.css',
        _marque: '/* inko:mouvement-reduit */',
        _bloc() {
            return `\n${this._marque}\n/* Respect du réglage « réduire les animations » du système : on coupe les\n   transitions et animations décoratives sans toucher à la mise en page. */\n@media (prefers-reduced-motion: reduce) {\n    *, *::before, *::after {\n        animation-duration: 0.01ms !important;\n        animation-iteration-count: 1 !important;\n        transition-duration: 0.01ms !important;\n        scroll-behavior: auto !important;\n    }\n}\n`;
        },
        async plan() { return lire('assets/css/global.css').includes(this._marque) || /prefers-reduced-motion/.test(lire('assets/css/global.css')) ? [] : [{ fichier: 'assets/css/global.css', resume: this.description }]; },
        async appliquer() {
            const brut = lire('assets/css/global.css');
            if (brut.includes(this._marque) || /prefers-reduced-motion/.test(brut)) return [];
            ecrire('assets/css/global.css', brut.replace(/\s*$/, '\n') + (crlf(brut) ? this._bloc().replace(/\n/g, '\r\n') : this._bloc()));
            return [{ fichier: 'assets/css/global.css', resume: this.description }];
        },
    },
    parTransformation({
        nom: 'vh-dvh', risque: 'faible', couvre: ['CSS-100VH'],
        description: 'ajoute le repli 100dvh après 100vh (ignoré par Android 8, appliqué ailleurs)',
        fichiers: () => lister(/\.css$/, ['assets/css']),
        transformer: (t) => t.replace(/^(\s*)((?:min-|max-)?height)\s*:\s*100vh\s*;(?!\s*\n\s*\2\s*:\s*100dvh)/gm, (m, ind, prop) => `${ind}${prop}: 100vh;\n${ind}${prop}: 100dvh;`),
    }),
    {
        nom: 'versions', risque: 'faible', couvre: ['DEP-VERSION-DERIVE'],
        description: 'aligne server/package.json (et son verrou) sur la version de la racine',
        _cibles() {
            const v = JSON.parse(lire('package.json')).version;
            const sortie = [];
            for (const f of ['server/package.json', 'server/package-lock.json']) {
                if (!fs.existsSync(path.join(RACINE, f))) continue;
                const brut = lire(f); const j = JSON.parse(brut);
                if (j.version !== v || (j.packages && j.packages[''] && j.packages[''].version !== v)) sortie.push({ f, brut, v });
            }
            return sortie;
        },
        async plan() { return this._cibles().map(c => ({ fichier: c.f, resume: `version → ${c.v}` })); },
        async appliquer() {
            const faits = [];
            for (const { f, brut, v } of this._cibles()) {
                // remplacement ciblé (pas de JSON.stringify : on garde l'indentation et l'ordre des clés)
                let neuf = brut.replace(/("version"\s*:\s*")[^"]+(")/, `$1${v}$2`);
                if (f.endsWith('lock.json')) neuf = neuf.replace(/("packages"\s*:\s*\{\s*""\s*:\s*\{[^}]*?"version"\s*:\s*")[^"]+(")/, `$1${v}$2`);
                if (neuf !== brut) { ecrire(f, neuf); faits.push({ fichier: f, resume: `version → ${v}` }); }
            }
            return faits;
        },
    },

    {
        nom: 'versions-extensions', risque: 'faible', couvre: ['EXT-VERSIONS-JSON-PERIME'],
        description: 'aligne extensions-community/versions.json sur les `version:` des index.js',
        _diff() {
            const fichier = 'extensions-community/versions.json';
            if (!fs.existsSync(path.join(RACINE, fichier))) return null;
            const brut = lire(fichier); const cat = JSON.parse(brut); const neuf = { ...cat }; let change = false;
            for (const id of Object.keys(cat)) {
                const f = `extensions-community/${id}/index.js`;
                if (!fs.existsSync(path.join(RACINE, f))) continue;
                const v = (/\bversion\s*:\s*['"]([\d.]+)['"]/.exec(lire(f)) || [])[1];
                if (v && v !== cat[id]) { neuf[id] = v; change = true; }
            }
            return change ? { fichier, brut, neuf } : null;
        },
        async plan() { const d = this._diff(); return d ? [{ fichier: d.fichier, resume: this.description }] : []; },
        async appliquer() {
            const d = this._diff(); if (!d) return [];
            const indent = /\n( +)"/.exec(d.brut); const eol = crlf(d.brut) ? '\r\n' : '\n';
            ecrire(d.fichier, JSON.stringify(d.neuf, null, indent ? indent[1].length : 2).replace(/\n/g, eol) + (/\n$/.test(d.brut) ? eol : ''));
            return [{ fichier: d.fichier, resume: this.description }];
        },
    },

    // ── moyen : comportement ou configuration (opt-in) ────────
    parTransformation({
        nom: 'allowbackup', risque: 'moyen', couvre: ['PLT-ALLOWBACKUP'],
        description: 'android:allowBackup="false" : le jeton de session ne part plus dans les sauvegardes Google',
        fichiers: () => ['android/app/src/main/AndroidManifest.xml'].filter(f => fs.existsSync(path.join(RACINE, f))),
        transformer: (t) => t.replace(/android:allowBackup="true"/, 'android:allowBackup="false"'),
    }),
    parTransformation({
        nom: 'ci-permissions', risque: 'moyen', couvre: ['CI-PERMISSIONS'],
        description: 'permissions: contents: read sur les workflows qui n\'écrivent rien',
        fichiers: () => lister(/ci\.yml$/, ['.github/workflows']),
        transformer: (t) => (/^permissions:/m.test(t) || /gh release|create-release|git push|issues:\s*write|contents:\s*write/.test(t)) ? t : t.replace(/^(jobs:)/m, 'permissions:\n  contents: read\n\n$1'),
    }),
    parTransformation({
        nom: 'catch-muet', risque: 'moyen', couvre: ['ERR-CATCH-MUET'],
        description: 'trace les catch muets du front via MH.err (aucune erreur n\'est plus avalée en silence)',
        fichiers: () => lister(/\.js$/, ['assets/js']).filter(f => !/vendor|\.min\.|storage\.js|global\.js/.test(f)),
        transformer: (t, f) => t.replace(/catch\s*\((\w+)\)\s*\{\s*\}/g, (m, e) => `catch (${e}) { window.MH?.err?.('${path.basename(f)}', ${e}); }`),
    }),
];

module.exports = { CORRECTEURS, RACINE };
