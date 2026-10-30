// ============================================================
// systeme.js — le système de style, lu dans la feuille, pas récité
// ------------------------------------------------------------
// Une page de documentation qui liste des valeurs à la main ment au premier
// changement, et personne ne s'en aperçoit : c'est précisément ce qui est
// arrivé au monospace. « notes.css » appelait var(--font-mono, …) pour un
// jeton que personne n'avait jamais défini — le repli masquait le trou, et
// quatre piles monospace différentes cohabitaient sans que rien ne le dise.
//
// Donc cette page ne récite rien. Elle DÉCOUVRE :
//   · les jetons, en relisant les feuilles de style réellement servies ;
//   · leurs valeurs, en les demandant au navigateur dans le thème courant ;
//   · les trous, en comparant ce qui est appelé à ce qui est défini.
//
// Conséquence recherchée : supprimer un jeton fait disparaître sa vignette,
// en ajouter un le fait apparaître, et en appeler un qui n'existe pas
// l'affiche en rouge. La page ne peut pas se périmer sans qu'on le voie.
(function () {
    'use strict';

    const $ = (s, r) => (r || document).querySelector(s);
    const racine = document.documentElement;
    const val = (j) => getComputedStyle(racine).getPropertyValue(j).trim();

    // ── Les familles qu'on sait présenter ───────────────────
    // L'ordre est celui du raisonnement : d'abord ce qui porte (surfaces,
    // texte), ensuite ce qui structure (type, rayons, espace), enfin ce qui
    // décore. Un préfixe absent ne produit PAS de section vide : la page
    // n'affiche que ce que la feuille contient vraiment.
    const FAMILLES = [
        {
            titre: 'Surfaces et texte',
            quoi: 'Les fonds empilés du plus bas au plus haut, et les trois niveaux de texte qui se posent dessus.',
            jetons: ['--bg', '--bg2', '--bg3', '--bg4', '--border', '--border2', '--text', '--text2', '--text3'],
        },
        {
            titre: 'Accents',
            quoi: 'La couleur de marque et les quatre couleurs d’état. Les variantes « -text » existent parce qu’une couleur lisible en aplat ne l’est pas forcément en texte sur le fond.',
            jetons: ['--accent', '--accent-text', '--orange', '--orange2', '--green', '--green-text', '--blue', '--blue-text', '--amber', '--amber-text', '--red', '--red-text', '--badge-grey', '--sur-couleur'],
        },
        {
            titre: 'Typographie',
            quoi: 'Les rôles. Chaque spécimen est écrit DANS sa police : si elle ne se charge pas, la ligne change de forme sous les yeux.',
            jetons: ['--font-head', '--font-body', '--font-read', '--font-mono'],
        },
        { titre: 'Échelle de texte', prefixe: '--t-', quoi: 'Les tailles autorisées. Chaque ligne est rendue à sa vraie taille.' },
        { titre: 'Rayons', prefixe: '--r-', quoi: 'Du trait de progression à la feuille. Chaque boîte porte son propre rayon.' },
        { titre: 'Élévations', prefixe: '--e-', quoi: 'Les hauteurs au-dessus du fond. Chaque carte projette son ombre réelle.' },
        { titre: 'Espacement', prefixe: '--sp-', quoi: 'Les écarts autorisés, dessinés à leur vraie largeur.' },
        { titre: 'Graphiques', prefixe: '--graph-', quoi: 'Les aplats de série : ils doivent se distinguer entre eux ET rester lisibles sous du texte.' },
        { titre: 'Assiduité', prefixe: '--hm', quoi: 'Les degrés du calendrier de lecture, du vide au plus dense.' },
        {
            titre: 'Mouvement',
            quoi: 'Les durées et les courbes. Survole une vignette : elle parcourt la courbe qu’elle décrit.',
            jetons: ['--transition', '--ease', '--ease-out', '--ease-spring'],
        },
        {
            titre: 'Palette d’origine',
            quoi: 'Les cinq couleurs nommées dont tout le reste descend — papier, encre, kaki, indigo, sceau. Elles ne s’emploient presque jamais telles quelles : elles servent de source aux jetons du dessus.',
            jetons: ['--washi', '--sumi', '--kakishibu', '--ai', '--hanko'],
        },
        {
            titre: 'Verre',
            quoi: 'Les barres translucides. Le flou se mesure, lui aussi : c’est ce qui décide si le texte derrière gêne ou non.',
            jetons: ['--glass-bg', '--glass-border', '--glass-inner', '--glass-blur', '--orange-glow', '--ring'],
        },
        {
            titre: 'Mesures d’interface',
            quoi: 'Les hauteurs que plusieurs pages doivent connaître pour se caler les unes sur les autres.',
            jetons: ['--header-h', '--titlebar-h', '--reader-chrome', '--reader-tb', '--mh-barre-onglets'],
        },
        {
            titre: 'Lecture de roman',
            quoi: 'Posés à l’exécution d’après les réglages du lecteur : ils n’ont pas de valeur ici, et c’est normal.',
            jetons: ['--novel-bg', '--novel-fg', '--novel-size', '--novel-lh', '--novel-width', '--novel-font'],
        },
    ];

    // Les anciens noms restent pour ne rien casser ; ils ne méritent pas une
    // vignette à eux, mais ils ne sont pas « morts » non plus.
    const ALIAS = {
        '--radius': '--r-carte', '--radius2': '--r-controle', '--radius3': '--r-feuille',
        '--shadow-1': '--e-pose', '--shadow-2': '--e-souleve', '--shadow-3': '--e-flottant',
    };

    // ── Lire les feuilles réellement servies ────────────────
    // La liste vient du précache du service worker : c'est le seul endroit du
    // dépôt qui connaisse TOUTES les feuilles, et il est régénéré à chaque
    // build. Coder la liste ici la ferait mentir dès la prochaine feuille.
    async function sources() {
        const lire = async (n) => {
            try { const r = await fetch(n); return r.ok ? { nom: n, texte: await r.text() } : null; }
            catch (e) { return null; }
        };
        try {
            const sw = await (await fetch('/service-worker.js', { cache: 'no-store' })).text();
            const tries = (ext) => [...new Set((sw.match(new RegExp(`['"][^'"]*\\.${ext}['"]`, 'g')) || [])
                .map(s => s.slice(1, -1))
                .filter(s => !/^https?:/.test(s)))];
            const [css, js] = await Promise.all([
                Promise.all(tries('css').map(lire)),
                Promise.all(tries('js').map(lire)),
            ]);
            return { css: css.filter(Boolean), js: js.filter(Boolean) };
        } catch (e) { return { css: [], js: [] }; }
    }

    // ── Ce qui est défini, ce qui est appelé ────────────────
    // Un jeton ne vit pas forcément dans une feuille. Sept des huit premiers
    // « trous » que cette page a signalés étaient en fait posés à l'exécution
    // — `setProperty('--pivot-l', …)` dans le lecteur, `style="--mc:…"` dans
    // le journal. Les compter comme des manques, c'était crier au loup sept
    // fois pour un vrai loup : plus personne ne regarde la huitième.
    function depouiller({ css, js }) {
        const definis = new Map(), appeles = new Map(), poses = new Map();
        for (const { nom, texte } of css) {
            for (const m of texte.matchAll(/(--[a-z0-9-]+)\s*:/gi)) {
                if (!definis.has(m[1])) definis.set(m[1], nom);
            }
            for (const m of texte.matchAll(/var\(\s*(--[a-z0-9-]+)\s*(,?)/gi)) {
                if (!appeles.has(m[1])) appeles.set(m[1], { ou: nom, repli: m[2] === ',' });
            }
        }
        for (const { nom, texte } of js) {
            // Les deux façons dont le script POSE une variable : l'API, et la
            // déclaration écrite dans un attribut `style` qu'il fabrique.
            for (const m of texte.matchAll(/setProperty\(\s*['"`](--[a-z0-9-]+)/gi)) {
                if (!poses.has(m[1])) poses.set(m[1], nom);
            }
            for (const m of texte.matchAll(/style\s*=\s*["'`][^"'`]*?(--[a-z0-9-]+)\s*:/gi)) {
                if (!poses.has(m[1])) poses.set(m[1], nom);
            }
            // Et les deux façons dont il les LIT. Sans ça, la page déclarait
            // morts les huit `--graph-*` et les quatre `--hm*`, qui sont
            // pourtant appelés — depuis les graphiques, en JavaScript.
            for (const m of texte.matchAll(/var\(\s*(--[a-z0-9-]+)\s*(,?)/gi)) {
                if (!appeles.has(m[1])) appeles.set(m[1], { ou: nom, repli: m[2] === ',' });
            }
            for (const m of texte.matchAll(/getPropertyValue\(\s*['"`](--[a-z0-9-]+)/gi)) {
                if (!appeles.has(m[1])) appeles.set(m[1], { ou: nom, repli: false });
            }
        }
        return { definis, appeles, poses };
    }

    // ── Contraste : calculé, pas supposé ────────────────────
    const canal = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    const sonde = document.createElement('span');
    function lum(couleur) {
        sonde.style.color = '';
        sonde.style.color = couleur;
        if (!sonde.style.color) return null;          // valeur que le navigateur refuse
        document.body.appendChild(sonde);
        const rgb = getComputedStyle(sonde).color.match(/[\d.]+/g);
        sonde.remove();
        if (!rgb) return null;
        const [r, g, b] = rgb.slice(0, 3).map(v => canal(v / 255));
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }
    function rapport(a, b) {
        const la = lum(a), lb = lum(b);
        if (la === null || lb === null) return null;
        return Math.round(((Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)) * 100) / 100;
    }

    const estCouleur = (v) => /^(#|rgb|hsl|color-mix|oklch)/i.test(v);
    const estOmbre = (v) => /\d+px\s+[-\d]/.test(v) && /rgba?\(/.test(v);
    const estPolice = (v) => /serif|sans-serif|monospace/.test(v) && !/px|rgba?\(/.test(v);
    const estDuree = (v) => /^[\d.]+m?s$/.test(v);
    const estCourbe = (v) => /^(cubic-bezier|ease|linear|steps)/.test(v);
    const estLongueur = (v) => /^-?[\d.]+(px|rem|ch|em)$/.test(v);

    const echapper = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // ── Rendu : chaque jeton se montre en FAISANT son travail ──
    // Un tableau de codes hexadécimaux ne dit rien de ce qu'on a entre les
    // mains. Une pastille peinte avec la vraie valeur, une boîte portant son
    // vrai rayon, une carte projetant sa vraie ombre, si.
    function vignette(nom, valeur, famille) {
        const el = document.createElement('div');
        el.className = 'sy-v';
        let apercu, note = '';

        if (estPolice(valeur)) {
            apercu = `<div class="sy-ap sy-specimen" style="font-family:${echapper(valeur)}">Aa Gg — 0123</div>`;
        } else if (estOmbre(valeur)) {
            apercu = `<div class="sy-ap"><div class="sy-carte" style="box-shadow:${echapper(valeur)}"></div></div>`;
        } else if (estCouleur(valeur)) {
            const surFond = rapport(valeur, val('--bg'));
            const dessus = rapport(val('--text'), valeur);
            // L'encre posée SUR l'aplat. Si le jeton prévu pour ça n'existe
            // pas, on ne se rabat pas sur un blanc écrit en dur — la page
            // n'a pas le droit de porter une valeur. On prend celui des deux
            // jetons de texte qui ressort le mieux sur cette couleur-là.
            const encre = val('--sur-couleur')
                || ((rapport(val('--text'), valeur) || 0) >= (rapport(val('--bg'), valeur) || 0)
                    ? val('--text') : val('--bg'));
            apercu = `<div class="sy-ap sy-aplat" style="background:${echapper(valeur)}"><span style="color:${echapper(encre)}">Aa</span></div>`;
            // Le seuil n'est pas le même selon le travail que fait la couleur :
            // 4,5:1 pour du texte (WCAG 1.4.3), 3:1 pour un objet graphique
            // qu'on doit seulement distinguer (1.4.11).
            const seuil = /Graphiques|Assiduité/.test(famille) ? 3 : 4.5;
            if (surFond !== null) note = `${surFond}:1 sur le fond${surFond < seuil ? ` — sous ${seuil}` : ''}`;
            if (dessus !== null) note += `${note ? ' · ' : ''}texte dessus ${dessus}:1`;
        } else if (estDuree(valeur) || estCourbe(valeur)) {
            const duree = estDuree(valeur) ? valeur : (val('--transition') || '.25s');
            const courbe = estCourbe(valeur) ? valeur : 'linear';
            apercu = `<div class="sy-ap sy-piste"><i style="transition:transform ${echapper(duree)} ${echapper(courbe)}"></i></div>`;
            note = 'au survol';
        } else if (estLongueur(valeur)) {
            if (famille === 'Échelle de texte') {
                apercu = `<div class="sy-ap sy-specimen" style="font-size:${echapper(valeur)};line-height:1.15">Le poids d’un titre</div>`;
            } else if (famille === 'Rayons') {
                apercu = `<div class="sy-ap"><div class="sy-boite" style="border-radius:${echapper(valeur)}"></div></div>`;
            } else {
                apercu = `<div class="sy-ap"><div class="sy-ecart" style="width:${echapper(valeur)}"></div></div>`;
            }
        } else {
            apercu = `<div class="sy-ap sy-brut">${echapper(valeur) || '—'}</div>`;
        }

        el.innerHTML = apercu
            + `<div class="sy-nom">${echapper(nom)}</div>`
            + `<div class="sy-val">${valeur ? echapper(valeur) : '<em>vide</em>'}</div>`
            + (note ? `<div class="sy-note">${echapper(note)}</div>` : '');
        return el;
    }

    function rendre(definis) {
        const hote = $('#sy-familles');
        hote.innerHTML = '';
        const montres = new Set();

        for (const f of FAMILLES) {
            const noms = f.prefixe
                ? [...definis.keys()].filter(j => j.startsWith(f.prefixe)).sort()
                : f.jetons.filter(j => definis.has(j));
            if (!noms.length) continue;

            const sec = document.createElement('section');
            sec.className = 'sy-fam';
            sec.innerHTML = `<h2>${f.titre}</h2><p class="sy-quoi">${f.quoi}</p>`;
            const grille = document.createElement('div');
            grille.className = 'sy-grille';
            for (const n of noms) { grille.appendChild(vignette(n, val(n), f.titre)); montres.add(n); }
            sec.appendChild(grille);
            hote.appendChild(sec);
        }
        return montres;
    }

    // ── Le contrôle : ce que la page ne sait PAS montrer ────
    // La partie la plus utile de la page, et la seule qui se plaigne.
    function controler({ definis, appeles, poses }, montres) {
        // Certains noms se fabriquent : `'var(--graph-' + n + ')'` dans les
        // statistiques. Ce qu'on lit alors, c'est un PRÉFIXE, pas un jeton —
        // la page le comptait comme un appel vers le vide, et déclarait morts
        // les deux `--graph-*` que ce code est seul à employer.
        const prefixes = [...appeles.keys()].filter(j => j.endsWith('-'));
        const estAppele = (j) => appeles.has(j) || prefixes.some(p => j.startsWith(p));
        const reels = [...appeles.entries()].filter(([j]) => !j.endsWith('-'));

        const trous = reels.filter(([j]) => !definis.has(j) && !poses.has(j));
        const vivants = reels.filter(([j]) => !definis.has(j) && poses.has(j));
        const muets = [...definis.keys()].filter(j => !estAppele(j) && !ALIAS[j]);
        const hors = [...definis.keys()].filter(j => !montres.has(j) && !ALIAS[j]);

        const bloc = (titre, quoi, items, ton) => (items.length
            ? `<div class="sy-ctl ${ton}"><h3>${titre} — ${items.length}</h3>`
              + `<p class="sy-quoi">${quoi}</p><ul>${items.map(i => `<li>${i}</li>`).join('')}</ul></div>`
            : `<div class="sy-ctl ok"><h3>${titre} — aucun</h3><p class="sy-quoi">${quoi}</p></div>`);

        $('#sy-controle').innerHTML =
            bloc('Appelés mais définis nulle part',
                'Un var() sans définition tombe sur son repli, ou sur rien. C’est exactement le défaut qui a tenu le jeton monospace invisible : référencé par une feuille, défini par aucune.',
                trous.map(([j, d]) => `<code>${echapper(j)}</code> — appelé dans ${echapper(d.ou)}${d.repli ? ', avec un repli qui masque le trou' : ''}`), 'mal')
            + bloc('Posés à l’exécution',
                'Appelés par une feuille, mais c’est le script qui leur donne une valeur, élément par élément. Normal — la feuille ne peut pas connaître l’angle d’une page ni la couleur d’une humeur. Listés pour qu’on sache où les chercher.',
                vivants.map(([j, d]) => `<code>${echapper(j)}</code> — appelé dans ${echapper(d.ou)}, posé par ${echapper((poses.get(j) || '').split('/').pop())}`), 'info')
            + bloc('Définis mais jamais appelés',
                'Pas forcément un défaut : un jeton peut être prévu pour l’extérieur, ou pour un thème seul. Mais la liste mérite d’être relue.',
                muets.map(j => `<code>${echapper(j)}</code>`), 'tiede')
            + bloc('Définis mais absents de cette page',
                'Cette page ne les range dans aucune famille. Si l’un compte, il lui faut une famille — sinon il n’est documenté nulle part.',
                hors.map(j => `<code>${echapper(j)}</code>`), 'tiede');
    }

    async function demarrer() {
        const brut = await sources();
        if (!brut.css.length) {
            $('#sy-familles').innerHTML = '<p class="sy-quoi">Feuilles de style illisibles : la page ne peut rien affirmer, donc elle n’affirme rien.</p>';
            return;
        }
        $('#sy-source').textContent = `${brut.css.length} feuille${brut.css.length > 1 ? 's' : ''} de style`
            + ` et ${brut.js.length} script${brut.js.length > 1 ? 's' : ''} relus — `
            + brut.css.map(s => s.nom.split('/').pop()).join(', ');

        const releve = depouiller(brut);
        const passe = () => controler(releve, rendre(releve.definis));
        passe();
        // Le thème change les valeurs, pas la liste des jetons : on redessine.
        new MutationObserver(passe).observe(racine, { attributes: true, attributeFilter: ['data-theme'] });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer);
    else demarrer();
})();
