// chaos — chaque page quand l'API va mal : erreur 500, réponse vide, réponse illisible,
// réseau coupé, lenteur. La page doit le dire, sans planter ni tourner sans fin.
'use strict';
const E = require('./_explore');

const MODES = {
    erreur500: (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"panne simulée"}' }),
    vide: (route) => route.fulfill({ status: 200, contentType: 'application/json', body: /favorites|notes|events|lists|sources|bookmarks|chapters|read-chapters|notifications/.test(route.request().url()) ? '[]' : '{}' }),
    illisible: (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>portail</title><p>Connectez-vous au Wi-Fi' }),
    coupe: (route) => route.abort('internetdisconnected'),
    lent: async (route) => { await new Promise(r => setTimeout(r, 14000)); await route.continue().catch(() => { }); },
};
const NOMS = { erreur500: 'API en erreur 500', vide: 'réponses vides', illisible: 'réponses illisibles (portail captif)', coupe: 'réseau coupé', lent: 'API lente (14 s)' };

module.exports = {
    nom: 'chaos',
    description: 'Pannes simulées de l\'API sur chaque page : message, exception, chargement sans fin, page blanche',
    async run(ctx) {
        const o = await E.ouvrir(ctx, { base: 'inko_s_chaos', port: 8092 });
        if (!o) return;
        const { J, nav } = o;
        try {
            const d = await E.semer(J, { favoris: 12 });
            const liste = E.adresses(ctx, d).filter(([f]) => !/index|confidentialite|systeme|anilist/.test(f));
            const releve = [];
            await Promise.all(Object.keys(MODES).map(async (mode) => {
                const c = await E.contexte(nav, J);
                await c.route('**/api/**', (route) => (/\/api\/(v1\/)?(auth\/local|health)/.test(route.request().url()) ? route.continue() : MODES[mode](route)));
                for (const [f, u] of liste) {
                    const p = await c.newPage(); const s = E.surveiller(p);
                    try {
                        await p.goto(`${J.url}/${u}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
                        await p.waitForTimeout(mode === 'lent' ? 6000 : 4200);
                        const m = await p.evaluate(() => {
                            const vis = (e) => { const s = getComputedStyle(e); return s.display !== 'none' && s.visibility !== 'hidden' && e.getClientRects().length > 0; };
                            const principal = document.querySelector('main') || document.body;
                            const t = principal.innerText.replace(/\s+/g, ' ').trim();
                            return { longueur: t.length, message: /réessayer|erreur|impossible|indisponible|injoignable|hors[- ]ligne|ne répond pas|aucun|vide|patient|serveur/i.test(t), attente: [...document.querySelectorAll('[class*="spinner"],[class*="squelette"],[class*="skeleton"],[aria-busy="true"]')].filter(vis).length, extrait: t.slice(0, 140) };
                        });
                        const brutes = await E.lireValeursBrutes(p);
                        releve.push({ f, mode, ...m, exceptions: s.exceptions.length });
                        if (s.exceptions.length) ctx.trouver({ gravite: 'haute', id: 'CHAOS-EXCEPTION', categorie: 'robustesse', titre: `${f} : exception JavaScript quand ${NOMS[mode]}`, fichier: f, detail: [...new Set(s.exceptions)].slice(0, 3).join('\n'), correctif: 'Garder l\'appel (try/catch) et poser un état d\'erreur.', effort: 'S' });
                        if (brutes.length) ctx.trouver({ gravite: 'moyenne', id: 'CHAOS-VALEUR-BRUTE', categorie: 'bug', titre: `${f} : valeur manquante affichée telle quelle (${NOMS[mode]})`, fichier: f, detail: brutes.join('\n'), effort: 'S' });
                        if (mode !== 'lent' && m.attente > 0) ctx.trouver({ gravite: 'haute', id: 'CHAOS-ATTENTE-SANS-FIN', categorie: 'bug', titre: `${f} : chargement qui ne s'arrête pas quand ${NOMS[mode]}`, fichier: f, detail: `${m.attente} indicateur(s) d'attente encore visibles après 4 s. Texte : ${m.extrait}`, correctif: 'Remplacer le squelette par un état d\'erreur avec « Réessayer ».', effort: 'S' });
                        if (mode !== 'lent' && mode !== 'vide' && !m.message) ctx.trouver({ gravite: 'moyenne', id: 'CHAOS-SILENCE', categorie: 'bug', titre: `${f} : rien ne dit à l'utilisateur que ${NOMS[mode]}`, fichier: f, detail: m.extrait || '(zone principale vide)', correctif: 'MH.poserEtatErreur avec « Réessayer ».', effort: 'S' });
                        if (m.longueur < 25) ctx.trouver({ gravite: 'haute', id: 'CHAOS-PAGE-BLANCHE', categorie: 'bug', titre: `${f} : page quasi blanche quand ${NOMS[mode]}`, fichier: f, detail: m.extrait, effort: 'S' });
                    } catch (e) { ctx.trouver({ gravite: 'basse', id: 'CHAOS-INTERROMPU', titre: `${f} (${mode}) : ${e.message.slice(0, 80)}`, effort: 'S' }); }
                    await p.close();
                }
                await c.close();
            }));
            ctx.mesure('chaos_essais', releve.length);
            ctx.mesure('chaos_resume', Object.fromEntries(Object.keys(MODES).map(m => { const r = releve.filter(x => x.mode === m); return [m, `${r.length} pages · ${r.filter(x => x.exceptions).length} exceptions · ${r.filter(x => !x.message).length} sans message`]; })));
        } finally { await o.fermer(); }
    },
};
