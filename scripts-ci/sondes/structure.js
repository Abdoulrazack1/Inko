// structure — inventaire, fichiers obèses, fonctions géantes, marqueurs de dette
'use strict';
const path = require('path');
module.exports = {
    nom: 'structure',
    description: 'Taille des fichiers, fonctions géantes, TODO/FIXME, doublons de code',
    async run(ctx) {
        const fichiers = [...ctx.parcourir(ctx.racine, ctx.ext('.js', '.html', '.css'))]
            .filter(p => !/assets\/vendor|\.min\.|server\/extensions\/|extensions-community\/|mobile\/|desktop-tauri\/|android\/|scripts-ci\/sondes\/|docs\/audit\/|tools\/promo|test-results/.test(ctx.rel(p)));
        const parType = {};
        const gros = [];
        const marqueurs = [];
        const fonctions = [];
        const blocs = new Map();
        for (const p of fichiers) {
            const t = ctx.lire(p);
            const lignes = t.split('\n');
            const e = path.extname(p);
            (parType[e] = parType[e] || { fichiers: 0, lignes: 0 });
            parType[e].fichiers++; parType[e].lignes += lignes.length;
            const r = ctx.rel(p);
            if (lignes.length > 900 && e === '.js') gros.push([r, lignes.length]);
            ctx.chercher(t, /\b(TODO|FIXME|HACK|XXX)\b[:\s]?(.{0,90})/, (m, l) => marqueurs.push([r, l, m[1], m[2].trim()]));
            if (e === '.js') {
                const re = /^(\s*)(?:async\s+)?(?:function\s+([\w$]+)|(?:const|let)\s+([\w$]+)\s*=\s*(?:async\s*)?(?:function|\([^)]*\)\s*=>|[\w$]+\s*=>))/gm;
                let m;
                while ((m = re.exec(t))) {
                    const debut = ctx.ligneDe(t, m.index);
                    const indent = m[1].length;
                    let fin = debut;
                    for (let i = debut; i < lignes.length; i++) {
                        const L = lignes[i];
                        if (/^\s*\}[;)]*,?\s*$/.test(L) && (L.length - L.trimStart().length) === indent) { fin = i + 1; break; }
                    }
                    const long = fin - debut + 1;
                    if (fin > debut && long > 140) fonctions.push([r, debut, m[2] || m[3], long]);
                }
                const sig = lignes.map((L, i) => [L.trim(), i + 1]).filter(([L]) => L.length > 28 && !/^(\/\/|\*|\/\*)/.test(L));
                for (let i = 0; i + 8 <= sig.length; i += 4) {
                    const h = sig.slice(i, i + 8).map(x => x[0]).join('\n');
                    if (!blocs.has(h)) blocs.set(h, []);
                    blocs.get(h).push(`${r}:${sig[i][1]}`);
                }
            }
        }
        ctx.mesure('inventaire', parType);
        for (const [f, n] of gros.sort((a, b) => b[1] - a[1])) {
            ctx.trouver({ gravite: n > 2000 ? 'haute' : 'moyenne', id: 'STR-GROS', categorie: 'maintenabilité',
                titre: `Fichier obèse : ${f} (${n} lignes)`, fichier: f,
                detail: `${n} lignes dans un seul module vanilla-JS : relecture, revue et parse bloquant à chaque chargement.`,
                correctif: 'Découper par responsabilité (init / rendu / événements / réseau) sous window.MH.', effort: n > 2000 ? 'XL' : 'L' });
        }
        for (const [f, l, nom, long] of fonctions.sort((a, b) => b[3] - a[3]).slice(0, 25)) {
            ctx.trouver({ gravite: long > 300 ? 'haute' : 'moyenne', id: 'STR-FONCTION', categorie: 'maintenabilité',
                titre: `Fonction géante : ${nom}() — ${long} lignes`, fichier: f, ligne: l,
                detail: 'Cumule plusieurs responsabilités et ne se teste que de l\'extérieur.',
                correctif: 'Extraire des sous-fonctions nommées ; isoler la partie pure du rendu DOM.', effort: 'M' });
        }
        const dups = [...blocs.entries()].filter(([, v]) => v.length >= 3 && new Set(v.map(x => x.split(':')[0])).size >= 2)
            .sort((a, b) => b[1].length - a[1].length).slice(0, 15);
        for (const [h, v] of dups) {
            ctx.trouver({ gravite: 'basse', id: 'STR-DOUBLON', categorie: 'maintenabilité',
                titre: `Bloc de code répété ${v.length}× dans ${new Set(v.map(x => x.split(':')[0])).size} fichiers`,
                fichier: v[0].split(':')[0], ligne: +v[0].split(':')[1],
                detail: `Occurrences : ${v.slice(0, 6).join(', ')}${v.length > 6 ? '…' : ''}\nExtrait :\n${h.split('\n').slice(0, 3).join('\n')}`,
                correctif: 'Factoriser dans global.js ou un module partagé.', effort: 'S' });
        }
        ctx.mesure('marqueurs_dette', marqueurs.length);
        if (marqueurs.length) ctx.trouver({ gravite: 'basse', id: 'STR-MARQUEURS', categorie: 'dette',
            titre: `${marqueurs.length} marqueur(s) TODO/FIXME/HACK`,
            detail: marqueurs.slice(0, 40).map(m => `${m[0]}:${m[1]} ${m[2]} ${m[3]}`).join('\n'),
            correctif: 'Trier : ouvrir un ticket ou supprimer.', effort: 'S' });
    },
};
