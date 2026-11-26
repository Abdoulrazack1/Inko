#!/usr/bin/env node
// campagne.js — la passe complète : toutes les sondes, par couloirs parallèles, puis un seul
// fichier de résultats. Les mesures de vitesse tournent seules, à la fin.
//   node scripts-ci/sondes/campagne.js                  # tout (≈ 35 min)
//   node scripts-ci/sondes/campagne.js xss,lecteur      # rejoue ces sondes et les refond
'use strict';
const cp = require('child_process');
const fs = require('fs');
const path = require('path');
const C = require('./_commun');
const { SONDES, ORDRE, executerSondes } = require('./lancer');

const AUDIT = path.join(C.RACINE, 'docs', 'audit');
const SORTIE = path.join(AUDIT, 'sondes.json');
const TRAVAIL = fs.mkdtempSync(path.join(require('os').tmpdir(), 'inko-campagne-'));
// les sondes qui lisent INKO_URL partagent un serveur jetable préparé ici
const SUR_SERVEUR = ['extensions', 'couvertures', 'api-acces', 'api-contrat', 'pages'];
const COULOIRS = [
    ['structure', 'ecouteurs', 'securite', 'routes', 'sql', 'erreurs', 'a11y-html', 'css', 'i18n', 'perf-statique', 'code-mort', 'dependances', 'plateformes', 'docs', 'ci', 'analyse', 'certificats', 'donnees', 'integrite', 'securite-dyn'],
    ['boutons'],
    ['parcours', 'xss'],
    ['interaction', 'references'],
    ['chaos', 'lecteur', 'mobile'],
    ['imports', 'licences', 'exactitude', 'appareils', 'administration', 'mise-a-niveau', 'livraison'],
    ['modes', 'hors-ligne', 'autonome'],
    ['vie-privee', 'adaptabilite', 'filtre-adulte'],
    ['exposition', 'nouveautes', 'migration', 'base-embarquee'],
    ['flux-ecriture', '@serveur:extensions,couvertures,api-acces,api-contrat'],
    ['ux-coherence', 'ux-ecrans', 'ux-navigation', 'ux-redaction', 'ux-visuel'],
];
const SEULES = ['tests', '@serveur:pages', 'charge', 'ux-parcours', 'ux-retour', 'resilience', 'coquille'];   // sensibles au temps : sans concurrence

function lancer(groupe, n) {
    const fichier = path.join(TRAVAIL, `g${n}.json`);
    const noms = groupe.startsWith('@serveur:') ? groupe.slice(9) : groupe;
    return new Promise((ok) => {
        const args = groupe.startsWith('@serveur:') ? [__filename, '--serveur', noms, fichier] : [__filename, '--seul', noms, fichier];
        const p = cp.spawn(process.execPath, args, { cwd: C.RACINE, windowsHide: true, env: process.env });
        p.stdout.on('data', d => process.stdout.write(d)); p.stderr.on('data', d => process.stdout.write('[err] ' + d));
        const garde = setTimeout(() => { console.log(`✗ ${noms} : abandon après 50 min`); p.kill(); }, 50 * 60000);
        p.on('exit', () => { clearTimeout(garde); try { ok(JSON.parse(fs.readFileSync(fichier, 'utf8'))); } catch (e) { console.log(`✗ ${noms} : aucun résultat`); ok(null); } });
    });
}

function fondre(resultats) {
    let base = { date: new Date().toISOString(), sondes: {}, trouvailles: [] };
    try { base = JSON.parse(fs.readFileSync(SORTIE, 'utf8')); } catch (e) { /* première passe */ }
    for (const r of resultats.filter(Boolean)) {
        for (const nom of Object.keys(r.sondes)) {
            base.sondes[nom] = r.sondes[nom];
            base.trouvailles = base.trouvailles.filter(f => f.sonde !== nom).concat(r.trouvailles.filter(f => f.sonde === nom));
        }
    }
    base.date = new Date().toISOString();
    base.trouvailles.sort((a, b) => ORDRE[a.gravite] - ORDRE[b.gravite]);
    fs.mkdirSync(AUDIT, { recursive: true });
    fs.writeFileSync(SORTIE, JSON.stringify(require('./_propre').nettoyer(base), null, 1));
    return base;
}

(async () => {
    const [mode, noms, fichier] = process.argv.slice(2);
    if (mode === '--seul') { const r = await executerSondes(noms.split(',')); fs.writeFileSync(fichier, JSON.stringify(r)); process.exit(0); }
    if (mode === '--serveur') {
        const { demarrer } = require('./_jetable');
        const E = require('./_explore');
        const J = await demarrer(C.creerContexte('campagne'), { base: 'inko_s_ancien_' + noms.split(',')[0].replace(/\W/g, ''), port: noms.includes('pages') ? 8111 : 8110 });
        if (!J) process.exit(1);
        try { await E.semer(J); process.env.INKO_URL = J.url; const r = await executerSondes(noms.split(',')); fs.writeFileSync(fichier, JSON.stringify(r)); }
        finally { await J.arreter(); }
        process.exit(0);
    }
    const choix = mode ? mode.split(',') : null;
    const filtrer = (g) => {
        if (!choix) return g;
        const serveur = g.startsWith('@serveur:'); const l = (serveur ? g.slice(9) : g).split(',').filter(x => choix.includes(x));
        return l.length ? (serveur ? '@serveur:' : '') + l.join(',') : null;
    };
    if (!choix) { try { fs.copyFileSync(SORTIE, path.join(AUDIT, 'sondes-precedente.json')); } catch (e) { /* rien avant */ } }
    const t0 = Date.now(); let n = 0;
    // un couloir = des sondes (ou groupes) l'une après l'autre ; les couloirs en parallèle
    const couloir = async (liste) => { for (const element of liste) { const g = filtrer(element); if (g) for (const un of (g.startsWith('@serveur:') ? [g] : g.split(','))) fondre([await lancer(un, n++)]); } };
    await Promise.all(COULOIRS.map(couloir));
    console.log(`— couloirs parallèles terminés en ${Math.round((Date.now() - t0) / 60000)} min ; sondes sensibles au temps —`);
    for (const s of SEULES) await couloir([s]);
    const base = JSON.parse(fs.readFileSync(SORTIE, 'utf8'));
    const manquantes = SONDES.filter(s => !base.sondes[s]);
    const total = {}; base.trouvailles.forEach(f => { total[f.gravite] = (total[f.gravite] || 0) + 1; });
    console.log(`\nCampagne : ${base.trouvailles.length} trouvaille(s)`, total, `· ${Object.keys(base.sondes).length} sondes · ${Math.round((Date.now() - t0) / 60000)} min`, manquantes.length ? '· MANQUANTES : ' + manquantes.join(', ') : '');
    fs.rmSync(TRAVAIL, { recursive: true, force: true });
})();
