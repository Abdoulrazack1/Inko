// ux-visuel — une photo de chaque écran (bureau et téléphone, sombre et clair) comparée à
// la référence : tout changement d'apparence devient visible avant d'être publié.
//   docs/ux/captures/   la passe en cours
//   docs/ux/reference/  l'état accepté (strategie-ux.js --reference)
'use strict';
const fs = require('fs');
const path = require('path');
const U = require('./_ux');

module.exports = {
    nom: 'ux-visuel',
    description: 'Capture de chaque page (2 formats × 2 thèmes), comparaison point à point avec la référence, écrans vides',
    async run(ctx) {
        const b = await U.banc(ctx, { base: 'inko_ux_vis', port: 8136, reel: false });
        if (!b) return;
        const T = (gravite, id, titre, detail, correctif, extra = {}) => ctx.trouver({ gravite, id, dimension: 'rendu', categorie: 'ux', titre, detail, correctif, effort: 'S', ...extra });
        const ici = process.env.UX_CAPTURES || ctx.abs('docs', 'ux', 'captures'), ref = process.env.UX_REFERENCE || ctx.abs('docs', 'ux', 'reference');
        fs.mkdirSync(ici, { recursive: true });
        const releves = {};
        const comparateur = await b.nav.newPage();
        const lireImage = (f) => 'data:image/jpeg;base64,' + fs.readFileSync(f).toString('base64');
        const analyser = (a, z) => comparateur.evaluate(async ([a, z]) => {
            const charger = (src) => new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = src; });
            const pixels = (i) => { const c = new OffscreenCanvas(i.width, i.height); const x = c.getContext('2d'); x.drawImage(i, 0, 0); return x.getImageData(0, 0, i.width, i.height).data; };
            const ia = await charger(a); const pa = pixels(ia);
            const teintes = new Map(); for (let k = 0; k < pa.length; k += 4 * 7) { const t = (pa[k] >> 4) * 256 + (pa[k + 1] >> 4) * 16 + (pa[k + 2] >> 4); teintes.set(t, (teintes.get(t) || 0) + 1); }
            const uni = Math.max(...teintes.values()) / (pa.length / 28);
            if (!z) return { uni };
            const iz = await charger(z); if (iz.width !== ia.width || iz.height !== ia.height) return { uni, ecart: 1, taille: true };
            const pz = pixels(iz); let n = 0;
            for (let k = 0; k < pa.length; k += 4) if (Math.abs(pa[k] - pz[k]) + Math.abs(pa[k + 1] - pz[k + 1]) + Math.abs(pa[k + 2] - pz[k + 2]) > 60) n++;
            return { uni, ecart: n / (pa.length / 4) };
        }, [a, z]);
        try {
            for (const profil of ['bureau', 'mobile']) {
                for (const theme of ['dark', 'light']) {
                    await U.visiter(b, profil, async (f, p) => {
                        // fige ce qui change d'une heure à l'autre
                        await p.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}#inko-music,[class*=toast],[class*=astuce],.mh-astuce{display:none!important}' });
                        await p.evaluate(() => { for (const e of document.querySelectorAll('h1,.accueil-salut,[data-date],time,.nt-date,.history-entry-date')) e.textContent = e.textContent.replace(/Bonjour|Bonsoir|Bonne nuit/g, 'Bonjour'); window.scrollTo(0, 0); });
                        await p.waitForTimeout(350);
                        const nom = `${f.replace('.html', '')}--${profil}-${theme === 'dark' ? 'sombre' : 'clair'}.jpg`;
                        const cible = path.join(ici, nom);
                        await p.screenshot({ path: cible, type: 'jpeg', quality: 55, scale: 'css', animations: 'disabled' });
                        const reference = path.join(ref, nom);
                        const a = await analyser(lireImage(cible), fs.existsSync(reference) ? lireImage(reference) : null);
                        releves[nom] = { uniforme: Math.round(a.uni * 100), ecart: a.ecart === undefined ? null : Math.round(a.ecart * 1000) / 10 };
                        if (a.uni > .975) T('moyenne', 'UX-VIS-VIDE', `${f} (${profil}, ${theme === 'dark' ? 'sombre' : 'clair'}) : écran presque entièrement vide`, `${Math.round(a.uni * 100)} % d'une seule teinte — docs/ux/captures/${nom}`, 'État vide explicite avec une action.', { fichier: f });
                        if (a.ecart > .02) T(a.ecart > .15 ? 'moyenne' : 'basse', 'UX-VIS-CHANGEMENT', `${f} (${profil}, ${theme === 'dark' ? 'sombre' : 'clair'}) : ${(a.ecart * 100).toFixed(1)} % de l'écran a changé depuis la référence`, `docs/ux/captures/${nom} ↔ docs/ux/reference/${nom}${a.taille ? '\nDimensions différentes.' : ''}`, 'Vérifier que le changement est voulu, puis actualiser la référence.', { fichier: f });
                    }, { options: { theme, sombre: theme === 'dark' } });
                }
            }
            ctx.mesure('visuel_captures', Object.keys(releves).length);
            ctx.mesure('visuel_avec_reference', Object.values(releves).filter(r => r.ecart !== null).length);
            ctx.mesure('visuel_releves', releves);
        } finally { await comparateur.close().catch(() => { }); await b.fermer(); }
    },
};
