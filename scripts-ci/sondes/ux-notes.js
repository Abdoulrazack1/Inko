// ux-notes.js — le calcul de l'expérience : à quelle dimension appartient un relevé, quelle
// note il donne, quel chantier passe en premier. Fonctions pures, testées à part.
'use strict';

const DIMENSIONS = {
    efficacite: { nom: 'Efficacité des gestes', poids: 2, sondes: ['ux-parcours', 'lecteur'] },
    retour: { nom: 'Réponse et états', poids: 1.5, sondes: ['ux-retour', 'chaos', 'boutons'] },
    navigation: { nom: 'Se repérer et revenir', poids: 1.5, sondes: ['ux-navigation'] },
    accessibilite: { nom: 'Accessibilité', poids: 1.5, sondes: ['interaction', 'a11y-html', 'parcours', 'pages'] },
    adaptation: { nom: 'Téléphone et tailles d’écran', poids: 1.5, sondes: ['mobile', 'parcours'] },
    hierarchie: { nom: 'Hiérarchie et lisibilité', poids: 1, sondes: ['ux-ecrans'] },
    redaction: { nom: 'Mots et langue', poids: 1, sondes: ['ux-redaction', 'i18n', 'parcours'] },
    coherence: { nom: 'Cohérence du design', poids: 1, sondes: ['ux-coherence', 'css'] },
    fluidite: { nom: 'Fluidité ressentie', poids: 1, sondes: ['pages', 'charge', 'perf-statique'] },
    rendu: { nom: 'Rendu et images', poids: 0.5, sondes: ['ux-visuel', 'ux-ecrans'] },
};
const POIDS = { critique: 12, haute: 6, moyenne: 2, basse: 0.5, info: 0 };
const COUT = { S: 1, M: 3, L: 8, XL: 20 };
const RANG = { critique: 4, haute: 3, moyenne: 2, basse: 1, info: 0 };

/** La dimension d'un relevé, ou null s'il ne concerne pas l'expérience. */
function dimensionDe(f) {
    const id = f.id || '', s = f.sonde || '';
    if (f.dimension && DIMENSIONS[f.dimension]) return f.dimension;
    if (/INTERROMPU|SKIP|PLANTEE|SANS-SOURCE/.test(id)) return null;
    switch (s) {
        case 'css': return 'coherence';
        case 'a11y-html': return 'accessibilite';
        case 'interaction': return /SAISIE-(5XX|EXCEPTION)/.test(id) ? 'retour' : /HORS-ECRAN|DEBORDE/.test(id) ? 'adaptation' : 'accessibilite';
        case 'parcours': return /LARGEUR/.test(id) ? 'adaptation' : /CLAIR|ACCENT/.test(id) ? 'accessibilite' : /VIDE/.test(id) ? 'retour' : /ANGLAIS/.test(id) ? 'redaction' : null;
        case 'chaos': case 'boutons': case 'ecouteurs': return 'retour';
        case 'mobile': return 'adaptation';
        case 'i18n': return 'redaction';
        case 'lecteur': return 'efficacite';
        case 'pages': return /AXE|A11Y|CONTRASTE/.test(id) ? 'accessibilite' : /DEBORD|LARGE/.test(id) ? 'adaptation' : /CLS|LCP|LENT|LOURD|PERF/.test(id) ? 'fluidite' : /IMAGE/.test(id) ? 'rendu' : 'retour';
        case 'charge': return /^(VOL|NET|MEM)/.test(id) ? 'fluidite' : null;
        case 'perf-statique': return 'fluidite';
        case 'references': return /ARIA/.test(id) ? 'accessibilite' : /SANS-(CONNEXION|INSCRIPTION|MDP|OUBLI)|FONCTION-SANS-ECRAN|EFFACEMENT/.test(id) ? 'efficacite' : null;
        default: return null;
    }
}

const noteDe = (penalite, k) => Math.round(100 * Math.exp(-penalite / k));

/** Regroupe les relevés par famille (identifiant) : un chantier = une famille. */
function familles(trouvailles) {
    const m = new Map();
    for (const f of trouvailles) {
        const d = dimensionDe(f); if (!d || !POIDS[f.gravite]) continue;
        const cle = d + '|' + f.id;
        const x = m.get(cle) || { id: f.id, dimension: d, gravite: f.gravite, occurrences: new Set(), pages: new Set(), effort: f.effort || 'M', titre: f.titre, correctif: f.correctif || '', sonde: f.sonde };
        if (RANG[f.gravite] > RANG[x.gravite]) { x.gravite = f.gravite; x.titre = f.titre; }
        if (COUT[f.effort] > COUT[x.effort]) x.effort = f.effort;
        x.occurrences.add(f.titre);
        const page = /^[\w-]+\.html$/.test(f.fichier || '') ? f.fichier : (String(f.titre).match(/^([\w-]+\.html)/) || [])[1];
        if (page) x.pages.add(page);
        m.set(cle, x);
    }
    return [...m.values()].map(x => {
        const n = x.occurrences.size;
        const impact = POIDS[x.gravite] * (1 + Math.log2(n));
        return { ...x, occurrences: n, pages: [...x.pages].sort(), impact: Math.round(impact * 10) / 10, priorite: Math.round(impact / (COUT[x.effort] || 3) * 100) / 100 };
    });
}

/** Vague 1 : grave et peu coûteux. 2 : le reste du grave et les gains faciles. 3 : gros chantiers. 4 : finitions. */
function vague(c) {
    const grave = RANG[c.gravite] >= 3, facile = COUT[c.effort] <= 1;
    if (grave && COUT[c.effort] <= 3) return 1;
    if (grave || (c.gravite === 'moyenne' && facile)) return 2;
    if (c.gravite === 'moyenne') return 3;
    return 4;
}

/** Notes par dimension, par page, note globale et plan priorisé. */
function noter(trouvailles, sondesJouees) {
    const fam = familles(trouvailles);
    const dimensions = {};
    for (const [cle, d] of Object.entries(DIMENSIONS)) {
        const mesuree = d.sondes.some(s => sondesJouees.includes(s));
        const siennes = fam.filter(c => c.dimension === cle);
        const penalite = siennes.reduce((n, c) => n + c.impact, 0);
        dimensions[cle] = { nom: d.nom, poids: d.poids, mesuree, note: mesuree ? noteDe(penalite, 80) : null, chantiers: siennes.length, penalite: Math.round(penalite * 10) / 10, sondesAbsentes: d.sondes.filter(s => !sondesJouees.includes(s)) };
    }
    const mesurees = Object.values(dimensions).filter(d => d.mesuree);
    const globale = mesurees.length ? Math.round(mesurees.reduce((n, d) => n + d.note * d.poids, 0) / mesurees.reduce((n, d) => n + d.poids, 0)) : null;
    const pages = {};
    for (const c of fam) for (const p of c.pages) { pages[p] = pages[p] || { penalite: 0, chantiers: 0, graves: 0 }; pages[p].penalite += POIDS[c.gravite]; pages[p].chantiers++; if (RANG[c.gravite] >= 3) pages[p].graves++; }
    for (const p of Object.values(pages)) p.note = noteDe(p.penalite, 40);
    const plan = fam.map(c => ({ ...c, vague: vague(c) })).sort((a, b) => a.vague - b.vague || b.priorite - a.priorite || b.impact - a.impact);
    return { globale, dimensions, pages, plan };
}

/** Écart avec l'état accepté : notes, familles apparues, familles disparues. */
function comparer(actuel, reference) {
    if (!reference) return null;
    const notes = {};
    for (const [k, d] of Object.entries(actuel.dimensions)) { const r = reference.dimensions[k]; if (d.mesuree && r && r.mesuree) notes[k] = d.note - r.note; }
    const cle = (c) => c.dimension + '|' + c.id;
    const avant = new Map(reference.plan.map(c => [cle(c), c])), apres = new Map(actuel.plan.map(c => [cle(c), c]));
    return {
        globale: actuel.globale - reference.globale, notes,
        apparus: [...apres].filter(([k, c]) => !avant.has(k) && actuel.dimensions[c.dimension].mesuree).map(([, c]) => c),
        disparus: [...avant].filter(([k, c]) => !apres.has(k) && actuel.dimensions[c.dimension].mesuree).map(([, c]) => c),
    };
}

/** La barrière : ce qui interdit de publier. */
function barriere(ecart, seuil) {
    if (!ecart) return [];
    const motifs = Object.entries(ecart.notes).filter(([, v]) => v < -seuil).map(([k, v]) => `${DIMENSIONS[k].nom} : ${v} points`);
    for (const c of ecart.apparus) if (RANG[c.gravite] >= 3) motifs.push(`nouveau défaut ${c.gravite} : ${c.id} — ${c.titre}`);
    return motifs;
}

module.exports = { DIMENSIONS, POIDS, COUT, dimensionDe, familles, vague, noter, comparer, barriere };
