// licences — a-t-on le droit de distribuer ce qu'on distribue, et le dit-on ? Licences des
// dépendances livrées, bibliothèques et polices copiées dans le dépôt, mentions obligatoires.
'use strict';
const fs = require('fs');
const path = require('path');

const COPYLEFT = /\b(A?GPL|LGPL|SSPL|CC-BY-NC|CC-BY-SA|EUPL|OSL)\b/i;

module.exports = {
    nom: 'licences',
    description: 'Licences des dépendances livrées, bibliothèques et polices copiées, mentions dans NOTICE',
    async run(ctx) {
        const T = (gravite, id, titre, detail, correctif, extra = {}) => ctx.trouver({ gravite, id, categorie: 'droit', titre, detail, correctif, effort: 'S', fichier: 'NOTICE.md', ...extra });
        const compte = {}; const probleme = [];
        for (const racine of ['server', '.']) {
            const pkg = JSON.parse(ctx.lire(ctx.abs(racine, 'package.json')) || '{}');
            const file = Object.keys(pkg.dependencies || {}); const vus = new Set();
            while (file.length) {
                const nom = file.shift(); if (vus.has(nom)) continue; vus.add(nom);
                let p; for (const base of [ctx.abs(racine, 'node_modules', nom, 'package.json'), ctx.abs('node_modules', nom, 'package.json')]) { if (fs.existsSync(base)) { p = JSON.parse(fs.readFileSync(base, 'utf8')); break; } }
                if (!p) continue;
                const l = typeof p.license === 'string' ? p.license : (p.license && p.license.type) || (p.licenses || []).map(x => x.type).join(' OR ') || '(absente)';
                compte[l] = (compte[l] || 0) + 1;
                if (COPYLEFT.test(l) && !/\bOR\b.*(MIT|Apache|BSD)|(MIT|Apache|BSD).*\bOR\b/i.test(l)) probleme.push(`${nom}@${p.version} : ${l}`);
                if (l === '(absente)') probleme.push(`${nom}@${p.version} : aucune licence déclarée`);
                file.push(...Object.keys(p.dependencies || {}));
            }
        }
        ctx.mesure('licences_dependances', compte);
        const maLicence = (ctx.lire(ctx.abs('LICENSE')).split('\n').slice(0, 4).join(' ').trim() || 'absente').slice(0, 120);
        ctx.mesure('licence_du_projet', maLicence);
        if (maLicence === 'absente') T('haute', 'LIC-PROJET', 'Le projet n\'a pas de licence', '', 'Ajouter LICENSE.');
        if (probleme.length) T('moyenne', 'LIC-DEPENDANCE', `${probleme.length} dépendance(s) livrée(s) à licence contraignante ou absente`, probleme.slice(0, 30).join('\n'), 'Vérifier la compatibilité avec la licence du projet et reproduire les mentions demandées.');
        const notice = (ctx.lire(ctx.abs('NOTICE.md')) + ctx.lire(ctx.abs('README.md'))).toLowerCase();
        const copies = [];
        for (const d of ['assets/vendor', 'assets/fonts']) if (fs.existsSync(ctx.abs(d))) for (const f of fs.readdirSync(ctx.abs(d))) { if (/\.(js|woff2?|ttf|otf)$/.test(f)) copies.push(d + '/' + f); }
        const familles = [...new Set(copies.map(f => path.basename(f).replace(/\.(min|worker)\b|\.(js|woff2?|ttf|otf)$/g, '').split(/[-_.]/)[0].toLowerCase()))];
        const alias = { pdf: ['pdf.js', 'pdfjs', 'mozilla'], gsap: ['gsap', 'greensock'], scrolltrigger: ['scrolltrigger', 'gsap'], jszip: ['jszip'], qrcode: ['qrcode'], three: ['three.js', 'three'], ibm: ['ibm plex'], archivo: ['archivo'], bitter: ['bitter'] };
        const nonCitees = familles.filter(f => !(alias[f] || [f]).some(a => notice.includes(a)));
        ctx.mesure('licences_fichiers_copies', copies.length);
        if (nonCitees.length) T('moyenne', 'LIC-NOTICE', `${nonCitees.length} bibliothèque(s) ou police(s) copiée(s) sans mention dans NOTICE ou README`, nonCitees.join(', ') + '\n\n' + copies.slice(0, 30).join('\n'), 'Citer chaque composant, sa licence et son auteur ; joindre les textes (OFL pour les polices).');
        const sansEntete = copies.filter(f => f.endsWith('.js')).filter(f => !/@license|copyright|\(c\)|MIT|Apache/i.test(ctx.lire(ctx.abs(f)).slice(0, 3000)));
        if (sansEntete.length) T('basse', 'LIC-ENTETE', `${sansEntete.length} bibliothèque(s) copiée(s) sans en-tête de licence`, sansEntete.join('\n'), 'Garder l\'en-tête d\'origine.');
        if (/gsap/i.test(familles.join(' '))) ctx.trouver({ gravite: 'info', id: 'LIC-GSAP', categorie: 'droit', titre: 'GSAP a une licence propre à son éditeur : vérifier les conditions pour une application distribuée', fichier: 'assets/vendor/gsap.min.js', effort: 'S' });
    },
};
