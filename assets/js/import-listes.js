// ============================================================
// import-listes.js — reprendre sa liste MyAnimeList ou AniList
// ------------------------------------------------------------
// Arriver sur Inko avec trois cents séries suivies ailleurs voulait dire les
// rechercher une par une. Et le jour où l'API d'AniList est coupée (la
// synchronisation existante en dépend), il ne reste que le fichier d'export.
//
// Formats lus :
//   · MyAnimeList : l'export « Manga List » (XML, souvent gzippé : .xml.gz) ;
//   · AniList : la collection de listes au format de son API
//     (`MediaListCollection` : lists[].entries[], celui que rendent les outils
//     d'export courants).
//
// Pour chaque entrée, la série est cherchée sur la source choisie et retenue
// seulement si un titre (principal ou alternatif) correspond EXACTEMENT une
// fois normalisé. On ne devine pas : une série mal rapprochée irait
// encombrer la bibliothèque et fausser la progression, sans qu'on s'en
// aperçoive. Les entrées non retrouvées sont listées à la fin.
(function () {
    'use strict';

    const norm = (t) => (t || '').toLowerCase().normalize('NFD')
        .replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '');

    const STATUT_MAL = { reading: 'reading', completed: 'completed', 'on-hold': 'paused', dropped: 'dropped', 'plan to read': 'planned' };
    const STATUT_ANILIST = { CURRENT: 'reading', REPEATING: 'reading', COMPLETED: 'completed', PAUSED: 'paused', DROPPED: 'dropped', PLANNING: 'planned' };

    /** Note de l'export → échelle d'Inko (1 à 10), ou null. */
    function noteSurDix(n) {
        const v = Number(n);
        if (!Number.isFinite(v) || v <= 0) return null;
        return Math.max(1, Math.min(10, Math.round(v > 10 ? v / 10 : v)));   // AniList peut noter sur 100
    }

    function lireMal(xml) {
        const doc = new DOMParser().parseFromString(xml, 'application/xml');
        if (doc.querySelector('parsererror')) throw new Error('Fichier XML illisible');
        const txt = (el, sel) => (el.querySelector(sel)?.textContent || '').trim();
        return [...doc.querySelectorAll('myanimelist > manga')].map(m => ({
            titre: txt(m, 'series_title'),
            titresAlt: [],
            statut: STATUT_MAL[txt(m, 'my_status').toLowerCase()] || null,
            chapitres: parseInt(txt(m, 'my_read_chapters'), 10) || 0,
            note: noteSurDix(txt(m, 'my_score')),
        })).filter(e => e.titre);
    }

    function lireAnilist(json) {
        const coll = json?.data?.MediaListCollection || json?.MediaListCollection || json;
        const listes = Array.isArray(coll?.lists) ? coll.lists : [];
        const entrees = [];
        for (const l of listes) {
            for (const e of l.entries || []) {
                const t = e.media?.title || {};
                const titres = [t.romaji, t.english, t.native, t.userPreferred, ...(e.media?.synonyms || [])].filter(Boolean);
                if (!titres.length) continue;
                entrees.push({
                    titre: titres[0],
                    titresAlt: [...new Set(titres.slice(1))],
                    statut: STATUT_ANILIST[e.status] || null,
                    chapitres: parseInt(e.progress, 10) || 0,
                    note: noteSurDix(e.score),
                });
            }
        }
        return entrees;
    }

    /** Reconnaît le format et rend { format, entrees }. */
    function lireExport(texte) {
        const debut = String(texte || '').trimStart();
        if (debut.startsWith('<')) return { format: 'MyAnimeList', entrees: lireMal(debut) };
        let json;
        try { json = JSON.parse(debut); } catch (e) { throw new Error('Ni un export MyAnimeList (XML) ni un export AniList (JSON)'); }
        return { format: 'AniList', entrees: lireAnilist(json) };
    }

    /** Le résultat de recherche qui porte EXACTEMENT un des titres, ou null. */
    function correspondance(entree, resultats) {
        const voulus = new Set([entree.titre, ...(entree.titresAlt || [])].map(norm).filter(Boolean));
        return (resultats || []).find(m => [m.title, ...(m.altTitles || [])].some(t => voulus.has(norm(t)))) || null;
    }

    /** Lit un fichier, gzippé ou non. */
    async function lireFichier(fichier) {
        const brut = new Uint8Array(await fichier.arrayBuffer());
        if (brut[0] === 0x1f && brut[1] === 0x8b) {
            if (typeof window.DecompressionStream === 'undefined') throw new Error('Ce navigateur ne sait pas ouvrir un .gz : décompresse le fichier d’abord');
            const flux = new Blob([brut]).stream().pipeThrough(new window.DecompressionStream('gzip'));
            return await new Response(flux).text();
        }
        return new TextDecoder().decode(brut);
    }

    /**
     * Importe les entrées sur `source`. Deux à la fois : une source de
     * scraping n'aime pas qu'on lui envoie trois cents recherches d'un coup.
     */
    async function importer(entrees, source, { onProgress } = {}) {
        const bilan = { importees: 0, introuvables: [], erreurs: [] };
        let faits = 0, i = 0;
        async function une(e) {
            let m = null;
            for (const q of [e.titre, ...(e.titresAlt || [])].slice(0, 2)) {
                const r = await window.API.mangas.searchFor(source, { q, limit: 8 });
                m = correspondance(e, r.results);
                if (m) break;
            }
            if (!m) { bilan.introuvables.push(e.titre); return; }
            await window.API.me.addFavorite(m.id, { source, title: m.title, cover: m.cover || m.coverThumb });
            if (e.statut) await window.API.me.setLibrary(m.id, e.statut);
            if (e.note) await window.API.ratings.set(m.id, { rating: e.note });
            if (e.chapitres > 0) {
                const c = await window.API.mangas.chaptersFor(source, m.id, {});
                const tous = (Array.isArray(c) ? c : (c.results || c.chapters || [])).filter(x => Number.isFinite(parseFloat(x.chapter)));
                const lus = tous.filter(x => parseFloat(x.chapter) <= e.chapitres);
                if (lus.length) {
                    await window.API.me.markChaptersBulk(m.id, lus.map(x => ({ chapterId: x.id, chapter: x.chapter })));
                    const dernier = lus.reduce((a, b) => (parseFloat(a.chapter) >= parseFloat(b.chapter) ? a : b));
                    await window.API.me.setProgress(m.id, { chapterId: dernier.id, chapter: dernier.chapter, page: 1, source });
                }
            }
            bilan.importees++;
        }
        const ouvrier = async () => {
            while (i < entrees.length) {
                const e = entrees[i++];
                try { await une(e); } catch (err) { bilan.erreurs.push({ titre: e.titre, message: err.message }); }
                faits++;
                onProgress?.({ faits, total: entrees.length, importees: bilan.importees });
            }
        };
        await Promise.all([ouvrier(), ouvrier()]);
        return bilan;
    }

    // ── Page Paramètres ─────────────────────────────────────
    function brancher() {
        const btn = document.getElementById('btnImportListe');
        const champ = document.getElementById('importListeFichier');
        const zone = document.getElementById('importListeZone');
        if (!btn || !champ || !zone) return;
        const esc = (t) => (window.MH?.esc ? window.MH.esc(t) : String(t));
        btn.addEventListener('click', () => champ.click());
        champ.addEventListener('change', async () => {
            const f = champ.files?.[0];
            champ.value = '';
            if (!f) return;
            let lu;
            try { lu = lireExport(await lireFichier(f)); } catch (e) {
                zone.hidden = false; zone.textContent = e.message; return;
            }
            if (!lu.entrees.length) { zone.hidden = false; zone.textContent = `Aucune série dans cet export ${lu.format}.`; return; }
            let sources = [];
            try { sources = ((await window.API.sources.list()) || []).filter(s => (s.capabilities || []).includes('search') && !window.MH?.isNovelSource?.(s.id)); } catch (e) { /* liste vide */ }
            zone.hidden = false;
            zone.innerHTML = `<p><strong>${lu.entrees.length}</strong> séries dans l’export ${esc(lu.format)}.</p>
                <label class="import-liste-source">Les retrouver sur
                    <select id="importListeSource">${sources.map(s => `<option value="${esc(s.id)}" ${s.id === window.API.sources.current ? 'selected' : ''}>${esc(s.name || s.id)}</option>`).join('')}</select>
                </label>
                <p class="set-row-desc">Une série n’est ajoutée que si son titre correspond exactement. Statut, note et chapitres lus suivent.</p>
                <button type="button" class="btn btn-primary btn-sm" id="importListeGo" ${sources.length ? '' : 'disabled'}>Importer</button>
                <div id="importListeEtat" role="status" aria-live="polite"></div>`;
            zone.querySelector('#importListeGo').addEventListener('click', async (ev) => {
                ev.target.disabled = true;
                const etat = zone.querySelector('#importListeEtat');
                const bilan = await importer(lu.entrees, zone.querySelector('#importListeSource').value, {
                    onProgress: (p) => { etat.textContent = `${p.faits} / ${p.total} · ${p.importees} retrouvée(s)`; },
                });
                etat.innerHTML = `<p><strong>${bilan.importees}</strong> série(s) ajoutée(s) à ta bibliothèque.</p>`
                    + (bilan.introuvables.length ? `<details><summary>${bilan.introuvables.length} introuvable(s) sur cette source</summary><ul>${bilan.introuvables.map(t => `<li>${esc(t)}</li>`).join('')}</ul></details>` : '')
                    + (bilan.erreurs.length ? `<details><summary>${bilan.erreurs.length} erreur(s)</summary><ul>${bilan.erreurs.map(e => `<li>${esc(e.titre)} : ${esc(e.message)}</li>`).join('')}</ul></details>` : '');
            });
        });
    }
    if (typeof document !== 'undefined' && document.addEventListener) {
        document.addEventListener('DOMContentLoaded', brancher);
    }

    window.MH = window.MH || {};
    window.MH.importListes = { lireExport, correspondance, noteSurDix, lireFichier, importer, norm };
})();
