// ux-redaction — les mots : une seule façon de s'adresser au lecteur, un mot par chose,
// pas de jargon, des erreurs qui disent quoi faire, la typographie française.
'use strict';
const U = require('./_ux');

const JARGON = { 'API': /\bAPI\b/, 'JSON': /\bJSON\b/, 'HTTP': /\bHTTP\b/, 'endpoint': /\bendpoint/i, 'backend': /\bback-?end\b/i, 'jeton / token': /\b(jetons?|tokens?)\b/i, 'cache': /\bcache\b/i, 'CORS': /\bCORS\b/, 'SMTP': /\bSMTP\b/, 'npm': /\bnpm\b/, 'MySQL / MariaDB': /\b(mysql|mariadb)\b/i, 'variable d’environnement': /\.env\b|NODE_ENV|\b[A-Z]{3,}_[A-Z_]{3,}\b/, 'proxy': /\bprox(y|ifi)/i, 'bac à sable / sandbox': /sandbox|bac à sable/i, 'scraping': /scrap(e|ing|per)/i, 'empreinte SHA': /\bSHA-?\d+/, 'localhost': /localhost|127\.0\.0\.1/, 'SSE / WebSocket': /\b(SSE|WebSocket)\b/ };
const CONCEPTS = { 'retirer une chose': ['retirer', 'supprimer', 'effacer', 'enlever'], 'une œuvre': ['série', 'œuvre', 'manga', 'titre'], 'sa collection': ['bibliothèque', 'étagère'], 'un regroupement': ['liste', 'collection', 'catégorie'], 'garder un endroit': ['signet', 'marque-page'], 'la machine hôte': ['serveur', 'hub', 'PC', 'instance'], 'un fournisseur': ['source', 'extension', 'catalogue'], 'vérifier les nouveautés': ['actualiser', 'rafraîchir', 'vérifier', 'mettre à jour'] };
const VOUS = /\b(vous|votre|vos)\b|\b(Cliquez|Choisissez|Veuillez|Saisissez|Entrez|Sélectionnez|Appuyez|Ouvrez|Ajoutez|Vérifiez|Essayez|Réessayez|Consultez|Définissez|Activez|Importez|Créez)\b/;
const TU = /\b(tu|ton|ta|tes|toi)\b|\bt’|\bt'/i;

module.exports = {
    nom: 'ux-redaction',
    description: 'Tutoiement et vouvoiement, vocabulaire, jargon, messages d\'erreur, typographie française — à l\'écran et dans les messages',
    async run(ctx) {
        const b = await U.banc(ctx, { base: 'inko_ux_red', port: 8135, reel: true });
        if (!b) return;
        const T = (gravite, id, titre, detail, correctif, extra = {}) => ctx.trouver({ gravite, id, dimension: 'redaction', categorie: 'ux', titre, detail, correctif, effort: 'S', ...extra });
        const textes = []; // { t, ou, genre }
        try {
            await U.visiter(b, 'bureau', async (f, p) => {
                if (f === 'confidentialite.html') return;
                for (const h of await p.$$('header [aria-haspopup], main [aria-haspopup]')) { await h.click({ timeout: 500 }).catch(() => { }); await p.waitForTimeout(120); await p.keyboard.press('Escape').catch(() => { }); }
                await U.outiller(p);
                const r = await p.evaluate(() => {
                    const out = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
                    const donnees = '.manga-card-title,.lib2-title,.manga-card,.lib2-card,.chapter-row,.sim-card,.serie-synopsis,#novelContent,.note-corps,.se-card,.shelf-card,pre,code,script,style,.sy-v,#inko-music,.comment-item,.history-entry';
                    while ((n = w.nextNode())) { const t = n.nodeValue.replace(/[ \t\n]+/g, ' ').trim(); const e = n.parentElement; if (!t || t.length < 2 || !e || e.closest(donnees)) continue; out.push([t, e.closest('button,a,[role=button]') ? 'action' : 'texte']); }
                    for (const e of document.querySelectorAll('[title],[aria-label],[placeholder]')) { if (e.closest(donnees)) continue; for (const a of ['title', 'aria-label', 'placeholder']) { const t = (e.getAttribute(a) || '').trim(); if (t.length > 2) out.push([t, a]); } }
                    return out;
                });
                for (const [t, genre] of r) textes.push({ t, ou: f, genre });
            });
            // les messages qui n'apparaissent qu'après une action : lus dans le code
            const MESSAGE = /(?:toast|toastErreur|confirm|prompt|annuler|alert)\??\.?\(\s*(['"`])((?:\\.|(?!\1).){4,260})\1/g;
            for (const f of ctx.parcourir(ctx.abs('assets', 'js'), ctx.ext('.js'))) {
                const s = ctx.lire(f);
                ctx.chercher(s, MESSAGE, (m, ligne) => textes.push({ t: m[2].replace(/\\'/g, '’').replace(/\$\{[^}]*\}/g, '…'), ou: ctx.rel(f) + ':' + ligne, genre: 'message' }));
                ctx.chercher(s, /['"`]((?:Erreur|Échec|Impossible)[^'"`]{0,60}?)['"`]\s*\+\s*(?:e|err|error)(?:\?)?\.message/g, (m, ligne) => textes.push({ t: m[1], ou: ctx.rel(f) + ':' + ligne, genre: 'erreur-brute' }));
            }
            const uniques = [...new Map(textes.map(x => [x.t, x])).values()];
            ctx.mesure('redaction_textes_examines', uniques.length);
            const liste = (l, n = 20) => l.slice(0, n).map(x => `« ${x.t.slice(0, 110)} » — ${x.ou}`).join('\n') + (l.length > n ? `\n… et ${l.length - n} autres` : '');

            const vous = uniques.filter(x => VOUS.test(x.t) && !/rendez-vous/i.test(x.t)), tu = uniques.filter(x => TU.test(x.t));
            ctx.mesure('redaction_adresse', { tutoiement: tu.length, vouvoiement: vous.length });
            if (vous.length && tu.length) T(Math.min(vous.length, tu.length) > 10 ? 'haute' : 'moyenne', 'UX-RED-TU-VOUS', `L'application tutoie (${tu.length} textes) et vouvoie (${vous.length} textes)`, 'Textes de la forme minoritaire :\n' + liste(vous.length < tu.length ? vous : tu, 30), 'Choisir une adresse — le tutoiement est majoritaire — et la tenir partout, serveur compris.', { effort: 'M' });
            for (const [terme, re] of Object.entries(JARGON)) {
                const l = uniques.filter(x => re.test(x.t) && !/systeme\.html|sources\.html/.test(x.ou));
                if (l.length) T(l.length > 6 ? 'moyenne' : 'basse', 'UX-RED-JARGON', `Jargon à l'écran : « ${terme} » (${l.length})`, liste(l, 10), 'Dire ce que cela change pour le lecteur ; garder le terme technique pour la page Système.');
            }
            const vocab = {};
            for (const [concept, mots] of Object.entries(CONCEPTS)) {
                const n = Object.fromEntries(mots.map(m => [m, uniques.filter(x => new RegExp(`(^|[^\\p{L}])${m}(s)?($|[^\\p{L}])`, 'iu').test(x.t)).length]));
                vocab[concept] = n;
                const forts = Object.entries(n).filter(([, v]) => v >= 4).sort((a, z) => z[1] - a[1]);
                if (forts.length >= 3) T('basse', 'UX-RED-VOCABULAIRE', `Plusieurs mots pour ${concept} : ${forts.map(([m, v]) => `${m} (${v})`).join(', ')}`, '', 'Fixer un mot par chose dans un lexique, et préciser la nuance quand deux mots sont nécessaires.', { effort: 'M' });
            }
            ctx.mesure('redaction_vocabulaire', vocab);
            const francais = uniques.filter(x => /[éèàçêù]|\b(le|la|les|des|une|pour|dans|sur|pas|ton|ta|tes)\b/i.test(x.t));
            const points = francais.filter(x => /\p{L}\.\.\.(\s|$)/u.test(x.t));
            if (points.length) T('basse', 'UX-RED-POINTS', `${points.length} texte(s) avec trois points au lieu du caractère « … »`, liste(points, 12), 'Utiliser « … ».');
            const droites = francais.filter(x => /\p{L}'\p{L}/u.test(x.t)), courbes = francais.filter(x => /\p{L}’\p{L}/u.test(x.t));
            if (droites.length > 5 && courbes.length > 5) T('basse', 'UX-RED-APOSTROPHE', `Deux apostrophes se mélangent : ${droites.length} droites, ${courbes.length} typographiques`, liste(droites.length < courbes.length ? droites : courbes, 12), 'Choisir « ’ ».');
            const colles = francais.filter(x => /\p{L}[?!;](\s|$)|\p{L}:(\s|$)/u.test(x.t) && !/https?:|\d:\d/.test(x.t));
            if (colles.length > 3) T('basse', 'UX-RED-ESPACE', `${colles.length} texte(s) sans espace avant « : ; ! ? »`, liste(colles, 14), 'Espace fine insécable (U+202F).');
            const brutes = textes.filter(x => x.genre === 'erreur-brute');
            if (brutes.length) T('moyenne', 'UX-RED-ERREUR-BRUTE', `${brutes.length} message(s) collent l'erreur technique derrière « Erreur : »`, liste(brutes, 20), 'MH.toastErreur : dire ce qui s\'est passé, ce que ça change et quoi faire.', { effort: 'M' });
            const sansIssue = uniques.filter(x => x.genre === 'message' && /^(erreur|échec|impossible|invalide|introuvable)/i.test(x.t) && !/réessa|vérifi|ouvre|choisi|convert|connect|reviens|attends|—|:/i.test(x.t));
            if (sansIssue.length > 2) T('basse', 'UX-RED-ERREUR-SANS-ISSUE', `${sansIssue.length} message(s) d'erreur sans geste proposé`, liste(sansIssue, 16), 'Terminer chaque erreur par ce que le lecteur peut faire.');
            const anglais = francais.length ? uniques.filter(x => /^(Home|Settings|Loading|Search|Download|Error|Cancel|Save|Delete|Back|Next|Previous|Library|Sort|Filter)\b/.test(x.t)) : [];
            if (anglais.length) T('moyenne', 'UX-RED-ANGLAIS', `${anglais.length} mot(s) anglais dans l'interface française`, liste(anglais, 12), 'Traduire.');
            const longs = uniques.filter(x => x.genre === 'action' && x.t.split(/\s+/).length > 6);
            if (longs.length > 2) T('basse', 'UX-RED-BOUTON-BAVARD', `${longs.length} libellé(s) d'action de plus de six mots`, liste(longs, 12), 'Un verbe et son objet.');
            const infobulles = uniques.filter(x => (x.genre === 'title' || x.genre === 'aria-label') && x.t.length > 90);
            if (infobulles.length > 3) T('basse', 'UX-RED-INFOBULLE', `${infobulles.length} infobulle(s) de plus de 90 signes`, liste(infobulles, 10), 'Une infobulle n\'est pas lisible au doigt : mettre l\'explication à l\'écran.');
        } finally { await b.fermer(); }
    },
};
