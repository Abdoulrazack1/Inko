// ============================================================
// migration.js — déménager une série vers une autre source
// ------------------------------------------------------------
// Audit XIII.1. Trois sources ne répondent plus et 13 séries en dépendent :
// leur progression, leurs notes et leurs signets existent toujours, mais
// l'œuvre est devenue inatteignable. Sans ce parcours, une source qui casse
// est une perte sèche.
//
// ── Deux partis pris d'interface ────────────────────────────
//
// 1. LE SCORE EST AFFICHÉ, JAMAIS APPLIQUÉ. Aucune sélection par défaut :
//    l'utilisateur choisit, en voyant le titre, le nombre de chapitres et
//    l'écart. Présélectionner « le meilleur » ferait valider sans lire — et
//    une migration vers la mauvaise œuvre est invisible une fois faite.
//
// 2. L'ANNULATION EST DANS LE MESSAGE DE SUCCÈS. Elle vit sept jours côté
//    serveur, mais c'est dans les secondes qui suivent qu'on s'aperçoit de
//    l'erreur. La proposer plus tard, dans un écran de réglages, revient à ne
//    pas la proposer.
//
// Aucun gestionnaire en ligne (`onclick=`) : la CSP de l'application installée
// les bloque, et c'est exactement ce qui rendait le lecteur inutilisable en
// 2.5.7 (DESK-01). Tout passe par `addEventListener`.
(function () {
    'use strict';
    if (window.MH?.ouvrirMigration) return;      // déjà chargé

    const esc = (s) => window.MH?.esc ? window.MH.esc(s) : String(s ?? '');

    // Ce que la migration sait transporter. L'ordre est celui de l'écran ;
    // `defaut` dit ce qui est coché à l'ouverture — tout, sauf rien.
    const ELEMENTS = [
        { cle: 'favori',        label: 'Favori' },
        { cle: 'progression',   label: 'Progression' },
        { cle: 'chapitres_lus', label: 'Chapitres lus' },
        { cle: 'notes',         label: 'Notes' },
        { cle: 'notation',      label: 'Notation' },
        { cle: 'signets',       label: 'Signets' },
    ];

    function styles() {
        if (document.getElementById('mh-migr-css')) return;
        const s = document.createElement('style');
        s.id = 'mh-migr-css';
        s.textContent = `
        .migr-modal{width:min(560px,95vw);max-height:88vh;overflow:auto}
        .migr-sub{font-size:12.5px;color:var(--text3,#888);margin:-2px 0 14px}
        .migr-liste{display:flex;flex-direction:column;gap:7px;margin:6px 0 4px}
        .migr-cand{display:flex;gap:11px;align-items:center;padding:9px 11px;border-radius:11px;cursor:pointer;
            border:1px solid var(--border,#333);background:var(--bg3,#202024);text-align:left;width:100%}
        .migr-cand:hover{border-color:var(--accent,#c1531b)}
        .migr-cand[aria-pressed="true"]{border-color:var(--accent,#c1531b);background:var(--bg2,#1a1a1e)}
        .migr-cand img{width:34px;height:48px;object-fit:cover;border-radius:5px;flex:0 0 auto;background:var(--bg2,#222)}
        .migr-cand-txt{flex:1 1 auto;min-width:0}
        .migr-cand-titre{font-size:13.5px;font-weight:600;color:var(--text,#eee);
            overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .migr-cand-meta{font-size:11.5px;color:var(--text3,#888);margin-top:2px}
        .migr-score{flex:0 0 auto;font-size:11.5px;font-weight:700;padding:3px 8px;border-radius:20px;
            background:var(--bg2,#26262b);color:var(--text2,#bbb)}
        .migr-score.bon{background:rgba(34,160,90,.16);color:#3ec27e}
        .migr-score.moyen{background:rgba(200,150,30,.16);color:#e0a83a}
        .migr-garder{display:flex;flex-wrap:wrap;gap:8px 16px;margin:14px 0 4px}
        .migr-garder label{display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--text2,#bbb);cursor:pointer}
        .migr-sect{font-size:11.5px;text-transform:uppercase;letter-spacing:.06em;color:var(--text3,#888);margin:16px 0 6px}
        .migr-avert{font-size:12px;line-height:1.5;color:#e0a83a;background:rgba(200,150,30,.10);
            border-radius:9px;padding:9px 11px;margin-top:12px}
        .migr-vide{font-size:13px;color:var(--text2,#bbb);line-height:1.55;padding:6px 0}`;
        document.head.appendChild(s);
    }

    function veiler() {
        styles();
        const veil = document.createElement('div');
        veil.className = 'mh-modal-veil';
        const boite = document.createElement('div');
        boite.className = 'mh-modal migr-modal';
        boite.setAttribute('role', 'dialog');
        boite.setAttribute('aria-modal', 'true');
        boite.setAttribute('aria-label', 'Migrer vers une autre source');
        veil.appendChild(boite);
        document.body.appendChild(veil);

        const fermer = () => {
            veil.classList.add('closing');
            setTimeout(() => veil.remove(), 160);
            document.removeEventListener('keydown', surTouche);
        };
        function surTouche(e) { if (e.key === 'Escape') { e.preventDefault(); fermer(); } }
        document.addEventListener('keydown', surTouche);
        veil.addEventListener('click', (e) => { if (e.target === veil) fermer(); });
        return { veil, boite, fermer };
    }

    /**
     * Ouvre le parcours de migration.
     * @param {string} source   source actuelle (souvent celle qui ne répond plus)
     * @param {string} mangaId  identifiant sur cette source
     * @param {string} [titre]  titre connu — sert de point d'appui à la recherche
     */
    async function ouvrirMigration(source, mangaId, titre) {
        if (!window.API?.isLoggedIn?.()) {
            window.MH?.toast?.('Connecte-toi pour migrer une série');
            return;
        }
        const { boite, fermer } = veiler();
        boite.innerHTML = `<div class="mh-modal-title">Migrer vers une autre source</div>
            <div class="migr-sub">Recherche en cours sur les autres sources…</div>`;

        let data;
        try {
            data = await window.API.migrate.candidats(source, mangaId, titre);
        } catch (e) {
            boite.innerHTML = `<div class="mh-modal-title">Migration impossible</div>
                <div class="migr-vide">${esc(e.message || 'Recherche impossible.')}</div>
                <div class="mh-modal-actions"><button class="mh-modal-btn primary" data-act="close">Fermer</button></div>`;
            boite.querySelector('[data-act="close"]').addEventListener('click', fermer);
            return;
        }

        const candidats = data.candidats || [];
        if (!candidats.length) {
            // Dire QUE rien n'a été trouvé, et sur combien de sources : sans le
            // second chiffre, l'utilisateur ne sait pas si la recherche a eu lieu.
            boite.innerHTML = `<div class="mh-modal-title">Aucune correspondance</div>
                <div class="migr-vide">« ${esc(data.reference?.titre || mangaId)} » n'a été trouvée sur
                    aucune des ${data.sourcesInterrogees || 0} autres sources installées.<br>
                    Tu peux réessayer plus tard : une source injoignable au moment de la recherche
                    n'apparaît pas ici.</div>
                <div class="mh-modal-actions"><button class="mh-modal-btn primary" data-act="close">Fermer</button></div>`;
            boite.querySelector('[data-act="close"]').addEventListener('click', fermer);
            return;
        }

        const ref = data.reference || {};
        const classeScore = (s) => s >= 80 ? 'bon' : s >= 55 ? 'moyen' : '';
        boite.innerHTML = `
            <div class="mh-modal-title">Migrer « ${esc(ref.titre || mangaId)} »</div>
            <div class="migr-sub">Depuis ${esc(ref.source || source || 'source inconnue')}
                · ${ref.chapitresLus || 0} chapitre(s) lu(s)</div>

            <div class="migr-sect">Trouvé sur</div>
            <div class="migr-liste" role="group" aria-label="Sources candidates">
                ${candidats.map((c, i) => `
                    <button type="button" class="migr-cand" data-i="${i}" aria-pressed="false">
                        ${c.cover ? `<img src="${esc(window.MH?.cover?.(c.cover) || c.cover)}" alt="" loading="lazy">` : '<img alt="">'}
                        <span class="migr-cand-txt">
                            <span class="migr-cand-titre">${esc(c.titre)}</span>
                            <span class="migr-cand-meta">${esc(c.sourceNom || c.source)}${
    c.chapitres ? ` · ${c.chapitres} ch.` : ''}${c.annee ? ` · ${c.annee}` : ''}</span>
                        </span>
                        <span class="migr-score ${classeScore(c.score)}">${c.score}</span>
                    </button>`).join('')}
            </div>

            <div class="migr-sect">À conserver</div>
            <div class="migr-garder">
                ${ELEMENTS.map(e => `<label><input type="checkbox" value="${e.cle}" checked> ${esc(e.label)}</label>`).join('')}
            </div>

            <div class="mh-modal-actions">
                <button class="mh-modal-btn ghost" data-act="cancel">Annuler</button>
                <button class="mh-modal-btn primary" data-act="ok" disabled>Migrer</button>
            </div>`;

        // Aucun candidat n'est présélectionné : le bouton reste inerte tant
        // qu'un choix n'a pas été fait, à dessein.
        let choisi = null;
        const btnOk = boite.querySelector('[data-act="ok"]');
        boite.querySelectorAll('.migr-cand').forEach(btn => {
            btn.addEventListener('click', () => {
                boite.querySelectorAll('.migr-cand').forEach(b => b.setAttribute('aria-pressed', 'false'));
                btn.setAttribute('aria-pressed', 'true');
                choisi = candidats[Number(btn.dataset.i)];
                btnOk.disabled = false;
            });
        });

        boite.querySelector('[data-act="cancel"]').addEventListener('click', fermer);
        btnOk.addEventListener('click', async () => {
            if (!choisi) return;
            const conserver = [...boite.querySelectorAll('.migr-garder input:checked')].map(i => i.value);
            if (!conserver.length) { window.MH?.toast?.('Coche au moins un élément à conserver'); return; }

            btnOk.disabled = true;
            btnOk.textContent = 'Migration…';
            try {
                const r = await window.API.migrate.lancer({
                    de: { source: ref.source || source, mangaId },
                    vers: { source: choisi.source, mangaId: choisi.id, titre: choisi.titre, cover: choisi.cover },
                    conserver,
                });
                fermer();
                annoncerSucces(r, choisi);
            } catch (e) {
                btnOk.disabled = false;
                btnOk.textContent = 'Migrer';
                const av = boite.querySelector('.migr-avert') || document.createElement('div');
                av.className = 'migr-avert';
                av.textContent = e.message || 'La migration a échoué.';
                boite.querySelector('.mh-modal-actions').before(av);
            }
        });
    }

    // Le compte rendu porte ce qui n'a PAS pu être reporté, et le moyen de
    // revenir en arrière. Un simple « migré ✓ » cacherait les deux.
    function annoncerSucces(r, choisi) {
        const { boite, fermer } = veiler();
        const absents = r.chapitresAbsents || [];
        boite.innerHTML = `
            <div class="mh-modal-title">Migration effectuée</div>
            <div class="migr-vide">
                « ${esc(choisi.titre)} » est désormais suivie sur ${esc(choisi.sourceNom || choisi.source)}.<br>
                ${r.chapitresReportes} chapitre(s) lu(s) reporté(s).
            </div>
            ${absents.length ? `<div class="migr-avert">
                ${absents.length} chapitre(s) lu(s) n'existent pas sur cette source
                (${esc(absents.slice(0, 8).join(', '))}${absents.length > 8 ? '…' : ''}).
                Ils n'ont pas été reportés — les rapprocher d'un chapitre voisin
                aurait faussé ta progression.</div>` : ''}
            ${r.signetsPerdus ? `<div class="migr-avert">${r.signetsPerdus} signet(s) portaient sur un
                chapitre absent de la nouvelle source et n'ont pas suivi.</div>` : ''}
            <div class="mh-modal-actions">
                <button class="mh-modal-btn ghost" data-act="annuler">Annuler la migration</button>
                <button class="mh-modal-btn primary" data-act="close">Terminé</button>
            </div>`;

        boite.querySelector('[data-act="close"]').addEventListener('click', () => {
            fermer();
            setTimeout(() => window.location.reload(), 180);
        });
        boite.querySelector('[data-act="annuler"]').addEventListener('click', async (e) => {
            e.target.disabled = true;
            try {
                await window.API.migrate.annuler(r.id);
                window.MH?.toast?.('Migration annulée — tout est revenu à sa place');
                fermer();
                setTimeout(() => window.location.reload(), 180);
            } catch (err) {
                e.target.disabled = false;
                window.MH?.toast?.('Annulation impossible : ' + (err.message || ''));
            }
        });
    }

    window.MH = window.MH || {};
    window.MH.ouvrirMigration = ouvrirMigration;

    // Point d'entrée déclaratif : n'importe quelle page peut poser
    // `data-migrer="<mangaId>" data-migrer-source="<source>"` sur un bouton.
    // Délégué au document pour couvrir aussi les cartes créées après coup.
    document.addEventListener('click', (e) => {
        const btn = e.target.closest?.('[data-migrer]');
        if (!btn) return;
        e.preventDefault();
        ouvrirMigration(btn.dataset.migrerSource || '', btn.dataset.migrer, btn.dataset.migrerTitre || '');
    });
})();
