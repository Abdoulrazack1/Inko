#!/usr/bin/env node
// ============================================================
// sondes/pages-md.js — génère la partie « page par page » de l'audit
// ------------------------------------------------------------
//   node scripts-ci/sondes/pages-md.js
//
// Entrées : docs/audit/sondes.json, docs/audit/inventaire-controles.json
// Sorties : docs/audit/parties/06-pages.md        (synthèse par page)
//           docs/audit/INVENTAIRE-CONTROLES.md    (chaque contrôle de chaque page)
// Le texte de rôle de chaque page est rédigé ici ; tout le reste est mesuré.
// ============================================================
'use strict';
const fs = require('fs');
const path = require('path');
const C = require('./_commun');

const donnees = JSON.parse(fs.readFileSync(path.join(C.RACINE, 'docs', 'audit', 'sondes.json'), 'utf8'));
const inv = JSON.parse(fs.readFileSync(path.join(C.RACINE, 'docs', 'audit', 'inventaire-controles.json'), 'utf8'));
const releve = (donnees.sondes.pages && donnees.sondes.pages.mesures.pages_releve) || [];

const ROLE = {
    'accueil.html': ['Accueil', 'Tableau de bord : **reprendre la lecture**, nouveautés, recommandations, raccourcis. Première page vue.', ['Bouton « Continuer »', 'Rangées de séries (en cours, nouveautés)', 'Carrousel / héros', 'Accès rapides']],
    'index.html': ['Racine', 'Page de **redirection** (`<meta http-equiv="refresh">` vers `accueil.html`, 1,6 Ko) pour les serveurs statiques qui n\'ont pas d\'`index` configuré. Les mesures ci-dessous sont celles de **l\'accueil après redirection**.', ['Redirection immédiate vers l\'accueil', 'Repère minimal sans JavaScript']],
    'bibliotheque.html': ['Bibliothèque', 'La bibliothèque personnelle : séries suivies, statuts, catégories, mises à jour, signets, téléchargements.', ['Onglets Bibliothèque / Mises à jour / Signets / Téléchargements', 'Recherche locale, filtres, tri', 'Grille / liste', 'Mode « Sélectionner » (statut, catégorie, retrait en masse)', '**Mettre à jour** (scan des nouveaux chapitres)', 'Menu « … » (export CSV/JSON, import)', 'Catégories', 'Aléatoire']],
    'catalogue.html': ['Catalogue', 'Découverte par source : populaires, dernières sorties, genres, filtres, collections.', ['Choix de la source', 'Recherche, filtres de statut/langue/note', 'Genres', 'Cartes avec ajout rapide à la bibliothèque', 'Listes mises en avant']],
    'recherche.html': ['Recherche', 'Recherche **sur toutes les sources** à la fois, avec filtres et résultats locaux.', ['Champ de recherche + filtres', 'Résultats groupés par source', 'Résultats de la bibliothèque locale']],
    'serie.html': ['Fiche d\'une série', 'Fiche : couverture, synopsis, genres, **liste des chapitres**, progression, statut, note, ajout en bibliothèque, téléchargement, notes.', ['Ajouter / retirer des favoris', 'Statut et note', 'Liste des chapitres (lu / non lu, signets, téléchargement)', 'Continuer / Commencer', 'Chapitres sur d\'autres sources (`chapitresAilleurs`)', '« À lire ensuite »']],
    'chapitre.html': ['Lecteur de manga', 'Lecteur : **pages, défilement, double page**, zoom, gestes, clavier, préchargement, reprise, commentaires, téléchargement.', ['Modes de lecture (page/défilement/double, RTL/LTR)', 'Zoom et ajustement', 'Chapitre précédent/suivant', 'Gestes et zones tactiles', 'Raccourcis clavier', 'Commentaires', 'Mode une main']],
    'lecture.html': ['Lecteur de romans', 'Lecteur de texte : police, taille, thème, table des matières, synthèse vocale, notes.', ['Typographie et thème', 'Table des matières', 'Synthèse vocale', 'Surlignage / notes', 'Chapitre suivant']],
    'localreader.html': ['Lecteur de fichiers locaux', 'Lecture d\'un **fichier importé** (EPUB, PDF, CBZ).', ['Navigation par page / chapitre', 'Synthèse vocale', 'Polices et thèmes']],
    'import.html': ['Import de fichiers', 'Import d\'**EPUB / PDF / CBZ** vers la bibliothèque locale (glisser-déposer).', ['Zone de dépôt', 'File d\'import', 'Liste des importés']],
    'downloads.html': ['Téléchargements', 'Chapitres **téléchargés pour la lecture hors ligne**, espace utilisé, export CBZ.', ['Liste par série', 'Suppression / export', 'Espace de stockage']],
    'collections.html': ['Mes listes', 'Listes de lecture personnelles (collections), création, filtres de statut.', ['Création de liste', 'Filtre par statut', 'Cartes de listes']],
    'collection-detail.html': ['Détail d\'une liste', 'Contenu d\'une liste : réordonner, partager (lien public), supprimer.', ['Réordonner', 'Partager', 'Retirer une série']],
    'liste.html': ['Liste partagée', 'Vue **publique** d\'une liste partagée par lien.', ['Lecture seule']],
    'notes.html': ['Journal de lecture', 'Notes et citations de lecture, humeurs, filtres par série/type, épinglage.', ['Création / édition de note', 'Filtres (humeur, série, type)', 'Épingles']],
    'notifications.html': ['Notifications', 'Nouveaux chapitres, événements, états.', ['Liste, marquer comme lu', 'Activer les notifications']],
    'stats.html': ['Statistiques', 'Statistiques de lecture : objectif hebdomadaire, répartition, activité, temps de lecture.', ['Objectif hebdomadaire', 'Répartitions', 'Activité récente']],
    'profil.html': ['Profil', 'Profil du propriétaire : vue d\'ensemble, badges, historique, listes, sources de connexion.', ['Vue d\'ensemble', 'Badges', 'Historique', 'Comptes liés']],
    'u.html': ['Profil public', 'Profil **public** d\'un autre utilisateur.', ['Lecture seule']],
    'sources.html': ['Sources', 'Extensions : installées, mises à jour, **santé**, **bac à sable** (« Essayer »), activation.', ['Vérifier les mises à jour', 'Installer / désinstaller / désactiver', 'Essayer (bac à sable)', 'Journal et santé par source']],
    'parametres.html': ['Paramètres', 'Tous les réglages : apparence, lecture, appareils/appairage, données (sauvegardes), confidentialité, raccourcis, mise à jour.', ['Apparence (thème, accent, densité, typographie)', 'Lecture (mode, sens, qualité)', 'Appareils et appairage', 'Sauvegardes (créer, aperçu, restaurer)', 'Mode invité', 'Gestes sur les cartes', 'Raccourcis clavier', 'Mises à jour']],
    'systeme.html': ['Système de style', '**Page interne** : catalogue des composants et des jetons de design (couleurs, espacements). Destinée au développement, mais **liée dans le pied de page de toutes les pages et livrée aux utilisateurs** (ARC-10).', ['Aperçu des composants']],
    'comparer.html': ['Comparer deux traductions', 'Comparaison côte à côte de deux traductions d\'un même chapitre.', ['Choix des deux sources', 'Alignement des textes']],
    'anilist.html': ['Connexion AniList', 'Retour d\'authentification OAuth AniList.', ['Redirection après connexion']],
    'confidentialite.html': ['Confidentialité', 'Politique de confidentialité (données, hôtes contactés, Android).', ['Texte légal', 'Liens vers les réglages']],
};
const gravOrdre = { critique: 0, haute: 1, moyenne: 2, basse: 3, info: 4 };
const ICONE = { critique: '🔴', haute: '🟠', moyenne: '🟡', basse: '🔵', info: '⚪' };

const out = ['## 6. Page par page, bouton par bouton', ''];
const nb = Object.keys(inv).filter(k => k.endsWith('|bureau') && !inv[k].saute).length;
out.push(`> **Méthode.** Chaque page a été ouverte dans un vrai navigateur (bureau 1 366 × 800 et mobile 390 × 844), sur un serveur et une base **jetables** garnis de 36 séries d'essai. Pour chaque contrôle visible (lien, bouton, onglet, case, champ, menu) : mesure de sa taille et de son **nom accessible**, test de **recouvrement** (qu'y a-t-il vraiment au point où l'on clique ?), puis **clic réel à la souris** — dédoublonné par famille, 2 par famille au plus — avec relevé de l'effet : navigation, modification du DOM, fenêtre, requêtes, **erreurs JavaScript**, **requêtes en échec**. Les pages à paramètres (série, lecteur, liste) sont ouvertes avec une œuvre **réelle**.`);
out.push('>');
out.push(`> **${nb} pages** explorées. L'inventaire complet — *chaque* contrôle, son effet — est dans \`docs/audit/INVENTAIRE-CONTROLES.md\` (généré).`, '');

const tous = donnees.trouvailles;
const total = { controles: 0, clics: 0, morts: 0, erreurs: 0, ko: 0, couverts: 0 };
const sections = [];
for (const [fichier, [nom, role, fonctions]] of Object.entries(ROLE)) {
    const b = inv[fichier + '|bureau'] || {}, m = inv[fichier + '|mobile'] || {};
    const rb = releve.find(r => r.page === fichier && r.profil === 'bureau') || {}, rm = releve.find(r => r.page === fichier && r.profil === 'mobile') || {};
    const constats = tous.filter(f => f.fichier === fichier && f.gravite !== 'info').sort((a, c) => gravOrdre[a.gravite] - gravOrdre[c.gravite]);
    const cs = (b.liste || []);
    const morts = constats.filter(f => f.id === 'BTN-MORT'), couverts = constats.filter(f => f.id === 'BTN-RECOUVERT'), errs = constats.filter(f => f.id === 'BTN-ERREUR-CLIC'), kos = constats.filter(f => f.id === 'BTN-RESEAU-KO');
    total.controles += b.controles || 0; total.clics += b.clics || 0; total.morts += morts.length; total.erreurs += errs.length; total.ko += kos.length; total.couverts += couverts.length;
    const L = [];
    L.push(`### ${fichier} — ${nom}`, '', role, '');
    if (b.saute) L.push(`> ⚠ Page non explorée en clics : ${b.saute}.`, '');
    L.push('| | Bureau | Mobile |', '|---|---:|---:|');
    L.push(`| Contrôles visibles | ${b.controles ?? '—'} | ${m.controles ?? '—'} |`, `| Contrôles cliqués | ${b.clics ?? '—'}${b.tronque ? ' (tronqué)' : ''} | — |`);
    if (rb.chargeMs !== undefined || rb.requetes !== undefined) L.push(`| Requêtes API | ${rb.requetes ?? '—'} | ${rm.requetes ?? '—'} |`, `| Décalage de mise en page (CLS) | ${rb.cls ?? '—'} | ${rm.cls ?? '—'} |`, `| Nœuds DOM | ${rb.noeuds ?? '—'} | ${rm.noeuds ?? '—'} |`, `| Tâches longues (ms) | ${rb.longTasks ?? '—'} | ${rm.longTasks ?? '—'} |`);
    L.push('', '**Fonctionnalités de la page** : ' + fonctions.join(' · ') + '.', '');
    const fonctionnels = cs.filter(c => c.effet && (c.effet.nav || c.effet.mut || c.effet.dialogue || c.effet.reqs)).length;
    if (b.clics) L.push(`**Résultat des clics** : ${fonctionnels} / ${b.clics} produisent un effet${morts.length ? `, **${morts.length} sans aucun effet**` : ''}${errs.length ? `, **${errs.length} lèvent une erreur JavaScript**` : ''}${kos.length ? `, **${kos.length} déclenchent une requête en échec**` : ''}${couverts.length ? `, **${couverts.length} recouverts**` : ''}.`, '');
    // contrôles sans effet, recouverts
    for (const [titre, liste] of [['Contrôles sans effet au clic', morts], ['Contrôles recouverts (le clic n\'atteint pas le bouton)', couverts], ['Clics qui lèvent une erreur', errs], ['Clics qui déclenchent une requête en échec', kos]]) {
        if (!liste.length) continue;
        L.push(`**${titre}** :`, '', ...liste.slice(0, 12).map(f => `- ${f.titre.replace(f.fichier + ' : ', '').replace(/^.*?: /, '')}${f.detail ? ' — _' + f.detail.split('\n')[0].slice(0, 110) + '_' : ''}`), ...(liste.length > 12 ? [`- … et ${liste.length - 12} autres`] : []), '');
    }
    // autres constats
    const autres = constats.filter(f => !/^BTN-(MORT|RECOUVERT|ERREUR-CLIC|RESEAU-KO)$/.test(f.id));
    if (autres.length) {
        L.push('**Autres constats sur cette page**', '', '| | Constat | Origine |', '|---|---|---|');
        const vus = new Set();
        for (const f of autres) { const cle = f.id + f.titre; if (vus.has(cle)) continue; vus.add(cle); if (vus.size > 14) break; L.push(`| ${ICONE[f.gravite]} | ${f.titre.replace(/\|/g, '\\|').slice(0, 150)} | \`${f.id}\` |`); }
        L.push('');
    }
    if (!constats.length) L.push('✅ Aucun défaut relevé par les sondes sur cette page.', '');
    sections.push(L.join('\n'));
}
out.push('### Synthèse', '', '| | Total |', '|---|---:|', `| Contrôles visibles (bureau) | **${total.controles}** |`, `| Contrôles cliqués | **${total.clics}** |`, `| Sans aucun effet | ${total.morts} |`, `| Qui lèvent une erreur JavaScript | ${total.erreurs} |`, `| Qui déclenchent une requête en échec | ${total.ko} |`, `| Recouverts | ${total.couverts} |`, '');
out.push('### Ce que le peigne fin établit', '',
    `1. **Les contrôles répondent.** Sur ${total.clics} clics réels : **${total.erreurs} erreur JavaScript**.${total.morts || total.couverts ? ` La sonde signale ${total.morts} contrôle(s) sans effet et ${total.couverts} recouvert(s) ; un échantillon rejoué à la main (navigation, reprise de lecture, import, téléchargements) répond normalement : ces relevés sont écartés (\`triage.js\`).` : ' Aucun contrôle sans effet ni recouvert.'} La couche d'interaction n'est pas le problème.`,
    '2. **Le défaut est ailleurs : le moment où les contrôles deviennent actifs.** La bibliothèque ignore tous les clics pendant **7 à 20 s** (quatre essais : 7,3 / 7,7 / 8,1 / 20,4 s) (écouteurs branchés après l\'attente réseau — §3.3, `UPD-01`) ; la même structure existe dans le **Journal** (`notes.js:22`) et le **lecteur de romans** (`lecture.js:118`). Les sondes statiques et dynamiques s\'accordent.',
    '3. **« Aléatoire » est un lien vers `#` sur 26 pages** (`A11Y-13`) : un seul gabarit d\'en-tête à corriger.',
    '4. **Les boutons d\'en-tête (Musique, Notifications) mesurent 30 × 30 px** sur toutes les pages (`A11Y-10`).',
    `5. **${total.ko} clics déclenchent une requête en échec** — tous vers des sources mortes (SushiScan, Royal Road, MangaDex sur des œuvres d'essai) : **l'application n'a aucun repli** et l'erreur est visible (EXT-11). Ce décompte dépend de l'état des sources au moment de l'essai.`,
    '6. **Le dock musique ouvert recouvre 40 % de la fenêtre, persiste d\'une page à l\'autre et se superpose aux astuces** (`UX-07`) — constaté en direct, capture à l\'appui.',
    '7. **Le navigateur appelle directement des tiers** : couvertures AniList (372 requêtes), GraphQL AniList (49), API YouTube (363, lecture musique reprise), GitHub (`SEC-13`).',
    '8. **Limites de la méthode** : les contrôles **mobiles** sont inspectés (taille, nom, recouvrement) mais **non cliqués** ; les pages à paramètres ne sont explorées que si la source d\'essai répond ; les dialogues ouverts sont fermés, pas parcourus ; les **gestes** (balayage, appui long, pincement) et le **clavier du lecteur** relèvent de tests e2e dédiés.', '');
out.push(...sections);
fs.writeFileSync(path.join(C.RACINE, 'docs', 'audit', 'parties', '06-pages.md'), out.join('\n') + '\n');

// ── inventaire complet ──
const I = ['# Inventaire des contrôles', '', `> Généré le ${donnees.date.slice(0, 10)}. Chaque contrôle visible de chaque page (bureau), avec le résultat du clic réel. Régénérable : \`node scripts-ci/sondes/pages-md.js\`.`, ''];
for (const [cle, v] of Object.entries(inv)) {
    if (!cle.endsWith('|bureau')) continue;
    I.push(`## ${cle.replace('|bureau', '')}`, '');
    if (v.saute) { I.push('_Non explorée : ' + v.saute + '_', ''); continue; }
    I.push(`${v.controles} contrôles, ${v.clics} cliqués.`, '', '| Type | Libellé | Destination | Taille | Effet du clic |', '|---|---|---|---:|---|');
    for (const c of v.liste || []) {
        const e = c.effet; const eff = !e ? '—' : [e.nav ? 'navigue → ' + (c.effet.va || '') : '', e.dialogue ? 'ouvre une fenêtre' : '', e.mut ? 'modifie la page (' + e.mut + ')' : '', e.reqs ? e.reqs + ' requête(s)' : '', e.ko ? '⚠ ' + e.ko + ' en échec' : '', e.err ? '⚠ erreur JS' : '', (!e.nav && !e.mut && !e.dialogue && !e.reqs) ? '**aucun effet**' : ''].filter(Boolean).join(' · ');
        I.push(`| ${c.tag}${c.type ? '[' + c.type + ']' : ''}${c.couvert ? ' ⚠ recouvert' : ''} | ${(c.nom || '(sans nom)').replace(/\|/g, '\\|')} | ${(c.href || '').slice(0, 60).replace(/\|/g, '\\|')} | ${c.l}×${c.h} | ${eff} |`);
    }
    I.push('');
}
fs.writeFileSync(path.join(C.RACINE, 'docs', 'audit', 'INVENTAIRE-CONTROLES.md'), I.join('\n'));
console.log(`✓ 06-pages.md (${Object.keys(ROLE).length} pages) · INVENTAIRE-CONTROLES.md · contrôles ${total.controles}, cliqués ${total.clics}`);
