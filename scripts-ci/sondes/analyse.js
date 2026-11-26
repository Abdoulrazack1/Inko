// analyse — ESLint avec des règles bien plus strictes que la CI, sur TOUT le code
// (serveur, scripts et extensions compris), plus quelques mesures de forme.
'use strict';
const path = require('path');

const REGLES = {
    'no-undef': 'error', 'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }], 'no-use-before-define': ['error', { functions: false, classes: false, variables: false }],
    'no-unreachable': 'error', 'no-constant-condition': ['error', { checkLoops: false }], 'no-dupe-keys': 'error', 'no-dupe-else-if': 'error', 'no-duplicate-case': 'error', 'no-self-assign': 'error', 'no-self-compare': 'error', 'no-unsafe-finally': 'error', 'no-fallthrough': 'error', 'no-loss-of-precision': 'error', 'no-prototype-builtins': 'error', 'no-useless-escape': 'error', 'no-shadow-restricted-names': 'error', 'valid-typeof': 'error', 'use-isnan': 'error', 'no-useless-catch': 'error', 'no-useless-backreference': 'error', 'array-callback-return': 'error', 'no-template-curly-in-string': 'error', 'no-unreachable-loop': 'error', 'require-atomic-updates': 'error', 'no-promise-executor-return': 'error', 'no-async-promise-executor': 'error', 'no-await-in-loop': 'error', 'eqeqeq': ['error', 'smart'], 'no-eval': 'error', 'no-implied-eval': 'error', 'no-new-func': 'error', 'no-redeclare': 'error', 'no-var': 'error', 'default-case-last': 'error', 'no-constructor-return': 'error',
    'complexity': ['error', 30], 'max-depth': ['error', 5], 'max-lines-per-function': ['error', { max: 150, skipBlankLines: true, skipComments: true }], 'max-lines': ['error', { max: 1200, skipBlankLines: true, skipComments: true }], 'max-params': ['error', 6],
};
const SENS = {
    'no-undef': ['haute', 'Nom jamais défini'], 'no-use-before-define': ['moyenne', 'Utilisé avant d\'être défini'], 'require-atomic-updates': ['basse', 'Écriture après un await qui peut écraser une autre'], 'array-callback-return': ['moyenne', 'Fonction de tableau sans retour'], 'no-template-curly-in-string': ['moyenne', 'Gabarit écrit entre guillemets simples : la variable n\'est pas remplacée'], 'no-promise-executor-return': ['basse', 'Valeur rendue par un exécuteur de promesse'], 'no-unused-vars': ['basse', 'Variable ou fonction jamais utilisée'], 'no-await-in-loop': ['basse', 'Attente en série dans une boucle'], 'eqeqeq': ['basse', 'Comparaison lâche'], 'complexity': ['moyenne', 'Fonction trop ramifiée'], 'max-lines-per-function': ['basse', 'Fonction de plus de 150 lignes'], 'max-lines': ['moyenne', 'Fichier de plus de 1 200 lignes'], 'max-depth': ['basse', 'Imbrication au-delà de 5'], 'max-params': ['basse', 'Plus de 6 paramètres'], 'no-unmodified-loop-condition': ['moyenne', 'Condition de boucle jamais modifiée'], 'no-unreachable-loop': ['moyenne', 'Boucle qui ne tourne qu\'une fois'], 'no-unreachable': ['moyenne', 'Code inatteignable'], 'no-useless-escape': ['basse', 'Échappement inutile'], 'no-prototype-builtins': ['basse', 'hasOwnProperty appelé sur l\'objet'], 'no-constant-condition': ['moyenne', 'Condition constante'], 'no-redeclare': ['moyenne', 'Redéclaration'], 'no-var': ['basse', 'var'], 'no-eval': ['haute', 'eval'], 'no-new-func': ['moyenne', 'new Function'],
};

module.exports = {
    nom: 'analyse',
    description: 'ESLint strict sur tout le code (bugs probables, fonctions démesurées, code mort local)',
    async run(ctx) {
        let ESLint;
        // les globales du projet viennent de sa configuration ; on complète avec celles du moteur
        const noms = (o) => Object.fromEntries(o.map(k => [k, 'readonly']));
        const projet = {};
        try { for (const bloc of require(ctx.abs('eslint.config.js'))) Object.assign(projet, (bloc.languageOptions || {}).globals || {}); } catch (e) { /* configuration absente */ }
        const moteur = noms(Object.getOwnPropertyNames(globalThis).filter(k => /^[A-Za-z]/.test(k)));
        const globals = { node: { ...moteur, ...noms(['require', 'module', 'exports', '__dirname', '__filename']) }, browser: { ...moteur, ...projet, ...noms(['window', 'document', 'navigator', 'location', 'localStorage', 'sessionStorage', 'indexedDB', 'caches', 'self', 'clients', 'skipWaiting', 'importScripts', 'registration', 'IntersectionObserver', 'MutationObserver', 'ResizeObserver', 'PerformanceObserver', 'requestAnimationFrame', 'cancelAnimationFrame', 'requestIdleCallback', 'cancelIdleCallback', 'getComputedStyle', 'matchMedia', 'HTMLElement', 'Element', 'Node', 'NodeFilter', 'Image', 'Audio', 'FileReader', 'DOMParser', 'XMLSerializer', 'Notification', 'EventSource', 'MutationRecord', 'KeyboardEvent', 'MouseEvent', 'PointerEvent', 'TouchEvent', 'HTMLInputElement', 'HTMLImageElement', 'createImageBitmap', 'OffscreenCanvas', 'Worker', 'BroadcastChannel', 'speechSynthesis', 'SpeechSynthesisUtterance', 'MediaMetadata', 'history', 'screen', 'innerWidth', 'innerHeight', 'scrollX', 'scrollY', 'scrollTo', 'scrollBy', 'addEventListener', 'removeEventListener', 'dispatchEvent', 'alert', 'confirm', 'prompt', 'open', 'close', 'print', 'getSelection', 'devicePixelRatio', 'isSecureContext', 'XMLHttpRequest', 'IDBKeyRange', 'CSS', 'MH', 'API', 'Storage', 'UserData', 'I18N', 'module', 'require', 'Capacitor', 'google', 'cheerio']) } };
        try { ({ ESLint } = require(path.join(ctx.racine, 'node_modules', 'eslint'))); }
        catch (e) { ctx.trouver({ gravite: 'info', id: 'ANA-SANS-ESLINT', titre: 'ESLint indisponible : ' + e.message.split('\n')[0] }); return; }
        const lot = async (motifs, sourceType, env) => {
            const es = new ESLint({ cwd: ctx.racine, overrideConfigFile: true, errorOnUnmatchedPattern: false, overrideConfig: [{ ignores: ['**/node_modules/**', '**/*.min.js', '**/vendor/**', 'desktop-tauri/**', 'android/**', 'mobile/www/**', 'promo/**'] }, { files: ['**/*.js'], languageOptions: { ecmaVersion: 2024, sourceType, globals: env }, rules: REGLES, linterOptions: { noInlineConfig: true, reportUnusedDisableDirectives: 'off' } }] });
            return es.lintFiles(motifs);
        };
        const navigateur = globals.browser;
        const resultats = [
            ...await lot(['assets/js/**/*.js', 'service-worker.js'], 'script', navigateur),
            ...await lot(['server/**/*.js', 'scripts-ci/*.js', 'extensions-community/**/*.js', 'mobile/*.js'], 'commonjs', globals.node),
        ];
        const parRegle = new Map(); let total = 0, fichiers = 0;
        for (const r of resultats) {
            fichiers++;
            const pilote = /page.evaluate|$eval|addInitScript/.test(ctx.lire(r.filePath));
            for (const m of r.messages) {
                if (/noInlineConfig/.test(m.message)) continue;
                if (m.ruleId === 'no-undef' && pilote) continue;               // code évalué dans le navigateur
                if (m.ruleId === 'no-new-func' && /[\\/]test[\\/]/.test(r.filePath)) continue;
                total++;
                const regle = m.ruleId || 'syntaxe';
                if (!parRegle.has(regle)) parRegle.set(regle, []);
                parRegle.get(regle).push({ f: ctx.rel(r.filePath), l: m.line, t: m.message });
            }
        }
        ctx.mesure('analyse_fichiers', fichiers);
        ctx.mesure('analyse_signalements', total);
        ctx.mesure('analyse_par_regle', Object.fromEntries([...parRegle].map(([k, v]) => [k, v.length]).sort((a, b) => b[1] - a[1])));
        for (const [regle, liste] of parRegle) {
            const [gravite, sens] = SENS[regle] || ['moyenne', regle];
            // les règles à fort signal : une trouvaille par fichier ; les autres : une par règle
            if (['no-undef', 'no-template-curly-in-string', 'array-callback-return', 'no-use-before-define', 'syntaxe', 'complexity', 'max-lines'].includes(regle)) {
                const parF = new Map(); for (const x of liste) { if (!parF.has(x.f)) parF.set(x.f, []); parF.get(x.f).push(x); }
                for (const [f, l] of parF) ctx.trouver({ gravite, id: 'ANA-' + regle.toUpperCase(), categorie: 'analyse du code', titre: `${f} : ${sens.toLowerCase()} (${l.length})`, fichier: f, ligne: l[0].l, detail: l.slice(0, 12).map(x => `ligne ${x.l} — ${x.t}`).join('\n'), effort: regle === 'complexity' || regle === 'max-lines' ? 'L' : 'S' });
            } else ctx.trouver({ gravite, id: 'ANA-' + regle.toUpperCase(), categorie: 'analyse du code', titre: `${sens} : ${liste.length} occurrence(s) dans ${new Set(liste.map(x => x.f)).size} fichier(s)`, fichier: liste[0].f, ligne: liste[0].l, detail: liste.slice(0, 25).map(x => `${x.f}:${x.l} — ${x.t}`).join('\n'), effort: liste.length > 40 ? 'L' : 'S' });
        }
    },
};
