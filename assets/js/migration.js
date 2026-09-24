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

    function stylesMasse() {
        if (document.getElementById('migr-masse-css')) return;
        const st = document.createElement('style');
        st.id = 'migr-masse-css';
        st.textContent = `
        .migr-masse{width:min(760px,94vw)!important;max-width:none!important}
        .migr-cible{display:flex;align-items:center;gap:10px;margin:14px 0;font-size:13.5px}
        .migr-cible select,.migr-ligne select{flex:1;min-width:0;height:34px;border-radius:8px;border:1px solid var(--border2);background:var(--bg3);color:var(--text);padding:0 8px}
        .migr-barre{height:6px;border-radius:6px;background:var(--bg4);overflow:hidden;margin:12px 0 4px}
        .migr-barre span{display:block;height:100%;width:0;background:var(--accent);transition:width .3s}
        .migr-revue{max-height:52vh;overflow:auto;margin:10px 0;border:1px solid var(--border);border-radius:10px}
        .migr-ligne{display:grid;grid-template-columns:22px minmax(0,1fr) minmax(0,1.3fr);gap:10px;align-items:center;padding:8px 10px;border-bottom:1px solid var(--border)}
        .migr-ligne:last-child{border-bottom:0}
        .migr-ligne.vide{opacity:.6}
        .migr-ligne-titre{font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .migr-ligne-titre small{display:block;font-weight:400;color:var(--text3);font-size:11.5px}
        .migr-rien{font-size:12px;color:var(--text3)}
        @media (max-width:560px){.migr-ligne{grid-template-columns:22px 1fr}.migr-ligne select,.migr-rien{grid-column:2}}`;
        document.head.appendChild(st);
    }

    function styles() {
        stylesMasse();
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

    // ── Migration en masse ─────────────────────────────────
    // Quand une source meurt, ce sont des dizaines de séries à déménager : les
    // faire une par une n'est pas une option. On cherche la correspondance de
    // chacune, on présente TOUT dans une liste relue par l'utilisateur, puis on
    // migre. Fidèle au parti pris n°1 : seules les correspondances quasi
    // certaines (score ≥ 85, même titre) arrivent cochées ; les autres
    // attendent un choix explicite dans leur liste déroulante.
    const SEUIL_AUTO = 85;

    async function migrerEnMasse(series, { sourceCible = '' } = {}) {
        if (!series?.length) return;
        const { boite, fermer } = veiler();
        boite.classList.add('migr-masse');
        const sources = await window.API.sources.list().catch(() => []);
        boite.innerHTML = `
            <div class="mh-modal-title">Migrer ${series.length} série${series.length > 1 ? 's' : ''}</div>
            <div class="migr-sub">Choisis où les chercher, puis relis les correspondances avant de lancer.</div>
            <label class="migr-cible">Vers
                <select id="migrCible">
                    <option value="">la meilleure correspondance, toutes sources</option>
                    ${sources.map(x => `<option value="${esc(x.id)}" ${x.id === sourceCible ? 'selected' : ''}>${esc(x.name || x.id)}</option>`).join('')}
                </select>
            </label>
            <div class="mh-modal-actions">
                <button class="mh-modal-btn ghost" data-act="cancel">Annuler</button>
                <button class="mh-modal-btn primary" data-act="go">Chercher les correspondances</button>
            </div>`;
        boite.querySelector('[data-act="cancel"]').addEventListener('click', fermer);
        boite.querySelector('[data-act="go"]').addEventListener('click', () => chercher(boite.querySelector('#migrCible').value));

        async function chercher(cible) {
            boite.innerHTML = `<div class="mh-modal-title">Recherche des correspondances</div>
                <div class="migr-sub" id="migrAvance">0 / ${series.length}</div>
                <div class="migr-barre"><span id="migrBarre"></span></div>`;
            const lignes = new Array(series.length);
            let faits = 0, i = 0;
            const travail = async () => {
                while (i < series.length) {
                    const k = i++;
                    const x = series[k];
                    try {
                        const d = await window.API.migrate.candidats(x.source, x.mangaId, x.titre);
                        let c = (d.candidats || []);
                        if (cible) c = c.filter(y => y.source === cible);
                        lignes[k] = { x, candidats: c.slice(0, 6) };
                    } catch (e) { lignes[k] = { x, candidats: [], erreur: e.message }; }
                    faits++;
                    const av = boite.querySelector('#migrAvance'); if (av) av.textContent = `${faits} / ${series.length}`;
                    const b = boite.querySelector('#migrBarre'); if (b) b.style.width = (faits / series.length * 100) + '%';
                }
            };
            // Deux à la fois : chaque recherche interroge toutes les sources.
            await Promise.all([travail(), travail()]);
            relire(lignes);
        }

        function relire(lignes) {
            const auto = (l) => l.candidats[0] && l.candidats[0].score >= SEUIL_AUTO;
            boite.innerHTML = `
                <div class="mh-modal-title">Relis avant de migrer</div>
                <div class="migr-sub">${lignes.filter(auto).length} correspondance(s) sûre(s) cochée(s).
                    Les autres sont à choisir ou à laisser de côté.</div>
                <div class="migr-revue">${lignes.map((l, k) => `
                    <div class="migr-ligne${l.candidats.length ? '' : ' vide'}">
                        <input type="checkbox" data-k="${k}" ${auto(l) ? 'checked' : ''} ${l.candidats.length ? '' : 'disabled'} aria-label="Migrer ${esc(l.x.titre)}">
                        <span class="migr-ligne-titre" title="${esc(l.x.titre)}">${esc(l.x.titre)}<small>${esc(window.MH?.sourceName?.(l.x.source) || l.x.source || '')}</small></span>
                        ${l.candidats.length ? `<select data-sel="${k}" aria-label="Correspondance pour ${esc(l.x.titre)}">
                            ${auto(l) ? '' : '<option value="">— choisir —</option>'}
                            ${l.candidats.map((c, j) => `<option value="${j}">${esc(c.sourceNom || c.source)} · ${esc(c.titre)} (${c.score})</option>`).join('')}
                        </select>` : `<span class="migr-rien">${esc(l.erreur || 'Introuvable ailleurs')}</span>`}
                    </div>`).join('')}</div>
                <div class="migr-garder">${ELEMENTS.map(e => `<label><input type="checkbox" value="${e.cle}" checked> ${esc(e.label)}</label>`).join('')}</div>
                <div class="mh-modal-actions">
                    <button class="mh-modal-btn ghost" data-act="cancel">Annuler</button>
                    <button class="mh-modal-btn primary" data-act="ok">Migrer</button>
                </div>`;
            const btnOk = boite.querySelector('[data-act="ok"]');
            const compter = () => {
                const n = [...boite.querySelectorAll('.migr-ligne input[data-k]:checked')]
                    .filter(cb => boite.querySelector(`[data-sel="${cb.dataset.k}"]`)?.value !== '').length;
                btnOk.textContent = n ? `Migrer ${n} série${n > 1 ? 's' : ''}` : 'Migrer';
                btnOk.disabled = !n;
            };
            boite.querySelectorAll('[data-sel]').forEach(sel => sel.addEventListener('change', () => {
                const cb = boite.querySelector(`input[data-k="${sel.dataset.sel}"]`);
                if (cb && sel.value !== '') cb.checked = true;
                compter();
            }));
            boite.querySelectorAll('.migr-ligne input[data-k]').forEach(cb => cb.addEventListener('change', compter));
            boite.querySelector('[data-act="cancel"]').addEventListener('click', fermer);
            compter();
            btnOk.addEventListener('click', () => lancer(lignes));
        }

        async function lancer(lignes) {
            const conserver = [...boite.querySelectorAll('.migr-garder input:checked')].map(x => x.value);
            if (!conserver.length) { window.MH?.toast?.('Coche au moins un élément à conserver'); return; }
            const aFaire = [...boite.querySelectorAll('.migr-ligne input[data-k]:checked')].map(cb => {
                const k = +cb.dataset.k, v = boite.querySelector(`[data-sel="${k}"]`)?.value;
                return v === '' || v == null ? null : { l: lignes[k], c: lignes[k].candidats[+v] };
            }).filter(Boolean);
            boite.innerHTML = `<div class="mh-modal-title">Migration en cours</div>
                <div class="migr-sub" id="migrAvance">0 / ${aFaire.length}</div>
                <div class="migr-barre"><span id="migrBarre"></span></div>`;
            const ok = [], ko = [];
            for (const [n, { l, c }] of aFaire.entries()) {
                try {
                    await window.API.migrate.lancer({
                        de: { source: l.x.source, mangaId: l.x.mangaId },
                        vers: { source: c.source, mangaId: c.id, titre: c.titre, cover: c.cover },
                        conserver,
                    });
                    ok.push(l.x.titre);
                } catch (e) { ko.push(`${l.x.titre} — ${e.message || 'échec'}`); }
                const av = boite.querySelector('#migrAvance'); if (av) av.textContent = `${n + 1} / ${aFaire.length}`;
                const b = boite.querySelector('#migrBarre'); if (b) b.style.width = ((n + 1) / aFaire.length * 100) + '%';
            }
            boite.innerHTML = `<div class="mh-modal-title">${ok.length} série${ok.length > 1 ? 's' : ''} migrée${ok.length > 1 ? 's' : ''}</div>
                ${ko.length ? `<div class="migr-avert">${ko.length} échec(s) :<br>${ko.slice(0, 8).map(esc).join('<br>')}</div>` : ''}
                <div class="migr-vide">Chaque migration reste annulable pendant sept jours depuis la fiche de la série.</div>
                <div class="mh-modal-actions"><button class="mh-modal-btn primary" data-act="close">Terminé</button></div>`;
            boite.querySelector('[data-act="close"]').addEventListener('click', () => { fermer(); setTimeout(() => window.location.reload(), 150); });
        }
    }

    window.MH = window.MH || {};
    window.MH.ouvrirMigration = ouvrirMigration;
    window.MH.migrerEnMasse = migrerEnMasse;

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
