// ============================================================
// migration.controller.js — migrer une œuvre d'une source à l'autre
// ------------------------------------------------------------
// Audit XIII.1. Trois sources ne répondent plus ou plus complètement, et 13
// séries en dépendent. Ce contrôleur expose le parcours en trois temps :
//
//   1. `candidats` — chercher l'œuvre sur les autres sources et les CLASSER.
//   2. `migrer`    — reporter ce que l'utilisateur a coché.
//   3. `annuler`   — revenir en arrière pendant sept jours.
//
// Le score n'est jamais appliqué : il est affiché. Une migration silencieuse
// vers la mauvaise œuvre détruirait la progression d'un lecteur sans qu'il
// puisse ni le voir ni le défaire — c'est précisément ce contre quoi la
// fenêtre d'annulation existe.
'use strict';

const extensions   = require('../extensions/loader');
const { planifier } = require('../lib/ordonnanceur');
const health       = require('../lib/source-health');
const appariement  = require('../lib/appariement');
const migrations   = require('../lib/migration-sources');
const { pool }     = require('../config/db');

// Une source lente ne doit pas retenir les autres : chacune a son propre
// délai, et celles qui expirent sont simplement absentes de la liste.
const DELAI_SOURCE_MS = 12_000;

const supporte = (s, quoi) => !s.capabilities || s.capabilities.includes(quoi);

function avecDelai(promesse, ms, quoi) {
    let t = null;
    return Promise.race([
        promesse,
        new Promise((_, rej) => { t = setTimeout(() => rej(new Error(`${quoi} : délai dépassé`)), ms); }),
    ]).finally(() => clearTimeout(t));
}

// Note chaque candidat contre CHAQUE variante du titre et garde la meilleure.
// Sans cela, un titre composite plafonne artificiellement tous les scores — ce
// qui était mesuré : 19/100 pour tous les candidats de « Crazy Detective｜狂探 ».
function classerAuMieux(trouves, variantes) {
    const refs = (variantes.length ? variantes : ['']).map(t => ({ titre: t, chapitres: null, annee: null }));
    return trouves
        .map(c => ({ ...c, score: Math.max(...refs.map(r => appariement.scoreCandidat(c, r))) }))
        .sort((a, b) => b.score - a.score);
}

/**
 * GET /api/me/migrate/candidats?source=<id>&mangaId=<id>[&titre=…]
 *
 * Cherche l'œuvre sur toutes les AUTRES sources installées et rend la liste
 * classée. Le titre de référence vient du favori quand il existe : la source
 * d'origine étant souvent morte, on ne peut pas le lui demander.
 */
async function candidats(req, res, next) {
    try {
        const source  = String(req.query.source || '').trim();
        const mangaId = String(req.query.mangaId || '').trim();
        if (!mangaId) return res.status(400).json({ error: 'mangaId requis' });

        // Référence : ce qu'on sait de l'œuvre AVANT de chercher ailleurs.
        const [[fav]] = await pool.query(
            'SELECT title, source, cover FROM favorites WHERE user_id = ? AND manga_id = ?',
            [req.user.id, mangaId]);
        const titre = String(req.query.titre || fav?.title || '').trim();
        if (!titre) {
            // Sans titre, la recherche n'a aucun point d'appui. Le dire est plus
            // utile que de rendre une liste au hasard.
            return res.status(400).json({
                error: 'Aucun titre connu pour cette œuvre : impossible de chercher ailleurs.',
                code: 'TITRE_INCONNU',
            });
        }

        const [nbLus] = await pool.query(
            'SELECT COUNT(*) AS n FROM read_chapters WHERE user_id = ? AND manga_id = ?',
            [req.user.id, mangaId]);
        const reference = { titre, chapitres: null, annee: null };

        // Même TYPE que l'origine : la progression d'un roman ne se reporte pas
        // sur son adaptation manga (« Shadow Slave » roman → manga WeebCentral
        // était proposé). Origine inconnue (source désinstallée) : on garde tout.
        const typeOrigine = extensions.get(source || fav?.source)?.type || null;
        const autres = extensions.getAll()
            .filter(s => s.id !== (source || fav?.source) && supporte(s, 'search'))
            .filter(s => !typeOrigine || (s.type || 'manga') === typeOrigine);

        // Les sources francophones et chinoises publient le titre en plusieurs
        // langues à la fois : « Crazy Detective｜狂探 ». Sur les 13 séries
        // orphelines d'Inko, 8 sont dans ce cas — et aucune autre source ne
        // nomme l'œuvre ainsi, donc chercher la chaîne entière ne donne RIEN.
        // Or ce sont précisément ces séries que la migration existe pour sauver.
        //
        // Trois variantes au plus : chaque variante coûte une requête PAR
        // source. Au-delà, on paie une rafale sortante pour des rendements
        // décroissants — et on risque de faire tomber les sources qui restent.
        // Trois et non deux parce qu'un titre trilingue est courant chez
        // chireads, et que c'est la variante ANGLAISE, en troisième position,
        // que les autres sources connaissent. C'est une action déclenchée par
        // l'utilisateur, pas un chargement de page : la rafale est bornée et
        // consentie.
        const variantes = appariement.variantesDeTitre(titre).slice(0, 3);

        const trouves = [];
        const dejaVu = new Set();          // source+id : une œuvre trouvée deux fois reste une œuvre
        await Promise.all(autres.map(async s => {
            for (const q of variantes) {
                try {
                    // Par l'ordonnanceur : une migration en masse enchaîne des
                    // dizaines de recherches, elles ne doivent pas bannir la
                    // source ni passer devant le lecteur.
                    const r = await planifier(s.id, 'normale',
                        () => avecDelai(s.search({ q, limit: 6 }), DELAI_SOURCE_MS, s.id), { patient: true });
                    health.recordOk(s.id);
                    for (const m of (r.results || []).slice(0, 6)) {
                        const cle = JSON.stringify([s.id, m.id]);   // clé composite lisible, sans séparateur invisible
                        if (dejaVu.has(cle)) continue;
                        dejaVu.add(cle);
                        trouves.push({
                            source: s.id, sourceNom: s.name || s.id,
                            id: m.id, titre: m.title,
                            cover: m.coverThumb || m.cover || null,
                            chapitres: m.chapters ?? null,
                            annee: m.year ?? null,
                        });
                    }
                } catch (e) {
                    // Une source qui ne répond pas est une source de moins, pas
                    // une erreur du parcours : l'utilisateur migre justement
                    // PARCE QUE des sources tombent. On n'insiste pas avec les
                    // variantes suivantes sur une source déjà en échec.
                    health.recordFail(s.id, e);
                    break;
                }
            }
        }));

        res.json({
            reference: { mangaId, source: source || fav?.source || null, titre, chapitresLus: nbLus[0]?.n || 0 },
            // Le score se calcule contre la variante la plus favorable : noter
            // « Crazy Detective » contre « Crazy Detective｜狂探 » le
            // pénaliserait pour une différence qui n'est pas la sienne.
            candidats: classerAuMieux(trouves, variantes),
            sourcesInterrogees: autres.length,
        });
    } catch (e) { next(e); }
}

/**
 * POST /api/me/migrate
 * { de: {source, mangaId}, vers: {source, mangaId, titre?, cover?},
 *   conserver: ["favori","progression","chapitres_lus","notes","notation","signets"] }
 */
async function migrer(req, res, next) {
    try {
        const { de, vers, conserver } = req.body || {};
        if (!de?.mangaId || !vers?.source || !vers?.mangaId) {
            return res.status(400).json({ error: 'de.mangaId, vers.source et vers.mangaId sont requis' });
        }

        // Les chapitres de la source d'ARRIVÉE : c'est contre eux que
        // s'apparient les chapitres lus. Sans eux, rien ne peut être reporté —
        // on refuse plutôt que de migrer un favori en abandonnant la lecture.
        const cible = extensions.get(vers.source);
        if (!cible) return res.status(404).json({ error: `Source inconnue : ${vers.source}` });

        let chapitresCible = [];
        try {
            const r = await planifier(cible.id, 'haute', () => avecDelai(cible.getChapters(vers.mangaId, {}), DELAI_SOURCE_MS, vers.source));
            chapitresCible = Array.isArray(r) ? r : (r?.chapters || r?.results || []);
            health.recordOk(cible.id);
        } catch (e) {
            health.recordFail(cible.id, e);
            return res.status(502).json({
                error: `La source d’arrivée n’a pas répondu (${e.message}) — réessaie dans un moment.`,
                code: 'CIBLE_INJOIGNABLE',
            });
        }

        const r = await migrations.migrer(req.user.id, de, vers, conserver, chapitresCible);
        res.json(r);
    } catch (e) {
        if (e.status) return res.status(e.status).json({ error: e.message });
        next(e);
    }
}

/** POST /api/me/migrate/:id/annuler */
async function annuler(req, res, next) {
    try {
        const r = await migrations.annuler(req.user.id, parseInt(req.params.id, 10));
        res.json(r);
    } catch (e) {
        if (e.status) return res.status(e.status).json({ error: e.message });
        next(e);
    }
}

/** GET /api/me/migrate — ce qui est encore annulable. */
async function liste(req, res, next) {
    try {
        res.json({
            fenetreJours: migrations.FENETRE_JOURS,
            migrations: await migrations.annulables(req.user.id),
        });
    } catch (e) { next(e); }
}

module.exports = { candidats, migrer, annuler, liste };
