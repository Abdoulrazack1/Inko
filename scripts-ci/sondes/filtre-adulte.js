// filtre-adulte — le filtre des contenus +18 tient-il quand la source répond mal ?
// La source est jouée dans un processus à part, sans aucun accès réseau (curl est simulé)
// et avec un dossier temporaire neuf : le cache réel n'est jamais lu ni écrit.
'use strict';
const cp = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

module.exports = {
    nom: 'filtre-adulte',
    description: 'Filtre des contenus +18 quand la source répond mal (source jouée sans réseau, cache isolé)',
    async run(ctx) {
        const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'inko-filtre-'));
        const fichier = ctx.abs('extensions-community', 'sushiscan', 'index.js');
        const script = path.join(dossier, 'essai.js');
        fs.writeFileSync(script, `
'use strict';
const path = require('path'), fs = require('fs'), enfants = require('child_process'), Module = require('module');
// les dépendances de la source sont celles du serveur
process.env.NODE_PATH = ${JSON.stringify(ctx.abs('server', 'node_modules'))}; Module._initPaths();
const carte = (slug, titre) => '<div class="bs"><div class="bsx"><a href="https://sushiscan.net/catalogue/' + slug + '/" title="' + titre + '"><img src="https://sushiscan.net/' + slug + '.jpg"><div class="tt">' + titre + '</div></a></div></div>';
const page = (cartes) => '<html><body><div class="listupd">' + cartes + '</div><!--' + 'x'.repeat(2000) + '--></body></html>';
let panne = true; const appels = [];
enfants.execFile = (_c, args, _o, suite) => {
  const url = String(args[args.length - 1]); appels.push(url);
  const genre = url.includes('/genres/');
  const r = !genre ? [page(carte('titre-tout-public', 'Tout public') + carte('titre-pour-adultes', 'Reserve aux adultes')), 200]
    : panne ? ['refus', 403] : url.includes('/page/') ? ['absent', 404] : [page(carte('titre-pour-adultes', 'Reserve aux adultes')), 200];
  setImmediate(() => suite(null, r[0] + '\\n@@INKO_HTTP@@' + r[1]));
};
(async () => {
  const s = require(${JSON.stringify(fichier)});
  await new Promise((ok) => setTimeout(ok, 1500));
  let enPanne;
  try { enPanne = (await s.popular({ limit: 10 })).results.map((m) => m.id); }
  catch (e) { enPanne = ['(refusé : ' + e.message.slice(0, 60) + ')']; }
  await new Promise((ok) => setTimeout(ok, 61000));   // l'index incomplet n'est gardé qu'une minute
  const cache = path.join(require('os').tmpdir(), 'inko-sushiscan-adult-v1.json');
  const ecrit = fs.existsSync(cache) ? JSON.parse(fs.readFileSync(cache, 'utf8')) : null;
  panne = false;                         // la source repond de nouveau
  const apres = (await s.popular({ limit: 10 })).results.map((m) => m.id);
  process.stdout.write('@@' + JSON.stringify({ enPanne, apres, cache: ecrit && { titres: ecrit.list.length, heures: Math.round((ecrit.expires - Date.now()) / 360000) / 10 } }));
  process.exit(0);
})().catch((e) => { process.stdout.write('@@' + JSON.stringify({ erreur: e.message })); process.exit(0); });
`);
        try {
            const r = await new Promise((ok) => cp.execFile(process.execPath, [script], { env: { ...process.env, TEMP: dossier, TMP: dossier, TMPDIR: dossier }, timeout: 180000, windowsHide: true }, (e, out) => { const i = String(out).lastIndexOf('@@{'); ok(i >= 0 ? JSON.parse(String(out).slice(i + 2)) : { erreur: e ? e.message : 'sortie illisible' }); }));
            ctx.mesure('filtre_adulte', r);
            if (r.erreur) { ctx.trouver({ gravite: 'info', id: 'ADULTE-NON-EPROUVE', titre: 'Filtre +18 : essai impossible', detail: r.erreur, fichier: 'extensions-community/sushiscan/index.js' }); return; }
            if (r.enPanne.includes('titre-pour-adultes') || r.apres.includes('titre-pour-adultes')) ctx.trouver({
                gravite: 'critique', id: 'ADULTE-FILTRE-OUVERT', categorie: 'sécurité', effort: 'S', fichier: 'extensions-community/sushiscan/index.js',
                titre: 'SushiScan : quand les pages de genres ne répondent pas, le filtre des contenus pour adultes se désactive, et le reste désactivé',
                detail: `Pages de genres refusées, catalogue disponible : titres servis dans le catalogue normal = ${r.enPanne.join(', ')}.\nSource rétablie, même serveur : ${r.apres.join(', ')}.\nListe écrite sur disque : ${r.cache ? `${r.cache.titres} titre(s), gardée ${r.cache.heures} h, relue au redémarrage` : 'aucune'}.`,
                correctif: 'Ne jamais garder un index vide ou incomplet ; tant qu\'il n\'est pas complet, refuser le catalogue (ou n\'afficher que ce qui est vérifié).',
            });
            else if (!r.apres.includes('titre-tout-public')) ctx.trouver({
                gravite: 'haute', id: 'ADULTE-CATALOGUE-BLOQUE', categorie: 'bug', effort: 'S', fichier: 'extensions-community/sushiscan/index.js',
                titre: 'SushiScan : une fois la source rétablie, le catalogue reste suspendu',
                detail: `Pendant la panne : ${r.enPanne.join(', ')}. Après : ${r.apres.join(', ') || '(rien)'}.`,
                correctif: 'Reconstruire l’index à la demande suivante.',
            });
        } finally { fs.rmSync(dossier, { recursive: true, force: true }); }
    },
};
