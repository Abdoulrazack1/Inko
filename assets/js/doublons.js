// ============================================================
// doublons.js — la même œuvre suivie sur deux sources
// ------------------------------------------------------------
// Suivre « One Piece » chez deux sources arrive tout seul : une source qui
// tombe, une recherche « toutes sources » qui ouvre l'autre fiche, un favori
// posé des deux côtés. On se retrouve avec deux cartes, deux progressions qui
// divergent, deux alertes de nouveaux chapitres. Rien ne le signalait.
//
// La bibliothèque repère les titres identiques (même normalisation que
// « Disponible ailleurs », AMEL-102) suivis sur des sources DIFFÉRENTES, et
// propose de fusionner. La fusion, c'est la migration de source (XIII.1) :
// report par numéro de chapitre, la progression la plus avancée gagne,
// annulable sept jours.
(function () {
    'use strict';

    const norm = (t) => (t || '').toLowerCase().normalize('NFD')
        .replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '');

    /**
     * Groupes de favoris de même titre sur des sources différentes, le plus
     * avancé en premier dans chaque groupe (c'est lui qu'on propose de garder).
     * @param {Array<{mangaId, source, title}>} favoris
     * @param {Object<string, {chapter}>} progression  par mangaId
     */
    function detecterDoublons(favoris, progression = {}) {
        const groupes = new Map();
        for (const f of favoris || []) {
            const cle = norm(f.title);
            if (cle.length < 3) continue;   // « 1 », « X » : trop court pour rapprocher
            if (!groupes.has(cle)) groupes.set(cle, []);
            groupes.get(cle).push(f);
        }
        const avance = (f) => parseFloat(progression[f.mangaId]?.chapter) || 0;
        return [...groupes.values()]
            .filter(g => new Set(g.map(f => f.source)).size > 1)
            .map(g => g.slice().sort((a, b) => avance(b) - avance(a)))
            .map(g => ({ titre: g[0].title, entrees: g.map(f => ({ ...f, chapitre: avance(f) || null })) }));
    }

    function esc(s) { return window.MH?.esc ? window.MH.esc(s) : String(s ?? ''); }

    /** Le bandeau dans la bibliothèque, puis la liste des doublons. */
    function signaler(conteneur, favoris, progression) {
        if (!conteneur) return;
        const groupes = detecterDoublons(favoris, progression);
        if (!groupes.length) { conteneur.hidden = true; return; }
        const n = groupes.length;
        conteneur.hidden = false;
        conteneur.innerHTML = `<span>${n} série${n > 1 ? 's' : ''} suivie${n > 1 ? 's' : ''} sur deux sources à la fois.</span>
            <button type="button" class="btn btn-ghost btn-sm" data-doublons>Voir et fusionner</button>`;
        conteneur.querySelector('[data-doublons]').addEventListener('click', () => ouvrir(groupes));
    }

    function ouvrir(groupes) {
        const veil = document.createElement('div');
        veil.className = 'mh-modal-veil';
        veil.innerHTML = `<div class="mh-modal doublons-modal" role="dialog" aria-modal="true" aria-labelledby="doublonsTitre">
            <div class="mh-modal-title" id="doublonsTitre">Séries suivies en double</div>
            <p class="doublons-intro">Garder une source reporte la progression, les chapitres lus, les notes et les signets de l'autre, par numéro de chapitre. La progression la plus avancée gagne. Annulable pendant sept jours.</p>
            ${groupes.map((g, gi) => `<div class="doublons-groupe">
                <div class="doublons-titre">${esc(g.titre)}</div>
                ${g.entrees.map((e, ei) => `<div class="doublons-ligne">
                    <span>${esc(e.source)}${e.chapitre ? ` · chap. ${esc(String(e.chapitre))} lu` : ' · pas commencée'}</span>
                    <button type="button" class="btn ${ei === 0 ? 'btn-primary' : 'btn-ghost'} btn-sm" data-garder="${gi}:${ei}">Garder celle-ci</button>
                </div>`).join('')}
            </div>`).join('')}
            <div class="mh-modal-actions"><button type="button" class="btn btn-ghost" data-fermer>Fermer</button></div>
        </div>`;
        document.body.appendChild(veil);
        // Le clavier est tenu par le piège partagé : entrer, y rester, et
        // revenir d’où l’on venait. `aria-modal` ne le fait pas tout seul.
        const liberer = window.MH?.piegerFocus?.(veil.querySelector('[role="dialog"]'),
            { surEchap: () => fermer() }) || (() => {});
        const fermer = () => { liberer(); veil.remove(); };
        veil.addEventListener('click', (e) => { if (e.target === veil) fermer(); });
        veil.querySelector('[data-fermer]').addEventListener('click', fermer);
        veil.querySelectorAll('[data-garder]').forEach(b => b.addEventListener('click', async () => {
            const [gi, ei] = b.dataset.garder.split(':').map(Number);
            const g = groupes[gi];
            const garder = g.entrees[ei];
            const retirer = g.entrees.filter((_, i) => i !== ei);
            b.disabled = true;
            b.textContent = 'Fusion…';
            try {
                for (const r of retirer) {
                    await window.API.migrate.lancer({
                        de: { source: r.source, mangaId: r.mangaId },
                        vers: { source: garder.source, mangaId: garder.mangaId, titre: garder.title, cover: garder.cover },
                        conserver: ['favori', 'progression', 'chapitres_lus', 'notes', 'notation', 'signets'],
                    });
                }
                window.MH?.toast?.(`« ${g.titre} » est désormais suivie sur ${garder.source} — annulable 7 jours`);
                fermer();
                setTimeout(() => location.reload(), 600);
            } catch (e) {
                b.disabled = false;
                b.textContent = 'Garder celle-ci';
                window.MH?.toast?.(e.message || 'La fusion a échoué');
            }
        }));
        veil.querySelector('[data-garder]')?.focus();
    }

    window.MH = window.MH || {};
    window.MH.doublons = { detecterDoublons, signaler, norm };
})();
