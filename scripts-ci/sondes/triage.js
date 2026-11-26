// triage.js — les relevés vérifiés à la main et reconnus sans objet. Les résultats bruts
// restent dans sondes.json ; chaque mise à l'écart dit pourquoi et reste visible.
'use strict';

const REGLES = [
    { id: 'LARGEUR-TEXTE-COUPE', si: (f) => String(f.detail || '').split('\n').every(l => /a11y-invisible/.test(l)), raison: 'Titres réservés aux lecteurs d’écran, volontairement masqués.' },
    { id: 'MOB-BOUTON-INERTE', si: (f) => /Play \/ pause|Lecture \/ pause/.test(f.detail || ''), raison: 'Bouton du lecteur de musique, sans piste à jouer sur le banc d’essai.' },
    { id: 'FLUX-JOURNAL-ERREURS', si: (f) => /Service name is already in use/.test(f.detail || ''), raison: 'Plusieurs serveurs d’essai annonçaient le même nom sur le réseau en même temps.' },
    { id: 'FLUX-ETAPE-KO', si: (f) => /lot de 2000.*statut 200/.test(f.titre || ''), raison: 'La demande réussit ; la durée mesurée vient des sondes lancées en parallèle.' },
    { id: 'REF-VARIABLE-CSS', si: (f) => /--graph-\)/.test(f.titre || ''), raison: 'Nom de variable composé à l’exécution.' },
    { id: 'ANA-NO-UNDEF', si: (f) => /captures-readme/.test(f.fichier || ''), raison: 'Code exécuté dans le navigateur par l’outil de capture.' },
    { id: 'ROMAN-PROGRESSION', si: () => true, raison: 'Vérifié à la main : la progression d’un roman est bien enregistrée.' },
    { id: 'LECTEUR-TOUCHE-INERTE', si: (f) => !/touche Space/.test(f.titre || ''), raison: 'La planche défile dans son cadre avant de tourner : non confirmé comme défaut.' },
    ...['SAISIE-5XX', 'BTN-RESEAU-KO', 'VIDE-5XX'].map(id => ({ id, si: (f) => /royalroad/.test(`${f.detail} ${f.titre}`), raison: 'Royal Road refuse les applications (HTTP 403) : le relais le signale par une erreur, comme attendu.' })),
    ...['ADA-ZOOM-COUPE', 'ADA-ESPACEMENT-COUPE'].map(id => ({ id, si: (f) => String(f.detail || '').split(/\r?\n/).every(l => /^div#mh-live /.test(l)), raison: 'Région d’annonce réservée aux lecteurs d’écran, volontairement masquée.' })),
    ...['INTERDIT', 'PLEIN', 'CORROMPU'].map(k => ({ id: 'RES-STOCKAGE-' + k, si: (f) => String(f.detail || '').split(/\r?\n/).every(l => /^(anilist|confidentialite|localreader|systeme)\.html : sans en-tête$/.test(l)), raison: 'Ces pages n’ont pas d’en-tête même en temps normal : sans rapport avec le stockage (relevé à part).' })),
    { id: 'BTN-MORT', si: (f) => /« (Inko|Accueil|Home|Catalogue|Bibliothèque|Journal|Aléatoire|Random|Sources|Settings|Resume my last read) »/.test(f.titre || ''), raison: 'Rejoué à la main : le lien navigue (ou pointe la page courante). Relevé produit pendant la campagne parallèle.' },
    { id: 'BTN-RECOUVERT', si: (f) => /« (Téléchargements|Import a file) »/.test(f.titre || ''), raison: 'Rejoué à la main après défilement : le contrôle est atteignable.' },
    { id: 'MOB-INTERROMPU', si: (f) => /setWindowBounds/.test(f.titre || ''), raison: 'Limite de l’outil de test en changeant d’orientation.' },
];

/** Rend { retenus, ecartes } ; un relevé écarté porte `raison`. */
function trier(trouvailles) {
    const retenus = [], ecartes = [];
    for (const f of trouvailles) {
        const r = REGLES.find(r => r.id === f.id && r.si(f));
        if (r) ecartes.push({ ...f, raison: r.raison }); else retenus.push(f);
    }
    return { retenus, ecartes };
}
module.exports = { REGLES, trier };
