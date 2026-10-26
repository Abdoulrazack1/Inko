// downloads-page.js — Page de gestion des téléchargements hors-ligne (audit §6.1)
(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', async () => {
        MH.initPage('bibliotheque');
        if (!window.Downloads) {
            document.getElementById('dlBody').innerHTML = `<div class="dl-empty">Téléchargements non supportés par ce navigateur.</div>`;
            return;
        }
        document.getElementById('dlClearAll').addEventListener('click', async () => {
            // Même raison qu'au-dessus, et le chiffre pèse davantage ici :
            // c'est le geste le plus destructeur de la page.
            const combien = poidsTotal
                ? `Cela libérera ${fmtSize(poidsTotal)}, et les chapitres devront être retéléchargés.`
                : 'Les chapitres devront être retéléchargés.';
            if (!await MH.confirm('Supprimer TOUS les chapitres téléchargés ?', {
                danger: true, okText: 'Tout supprimer', message: combien })) return;
            const all = await window.Downloads.list();
            await Promise.all(all.map(c => window.Downloads.remove(c.chapterId)));
            MH.toast?.('Téléchargements supprimés');
            render();
        });
        const pre = document.getElementById('dlPrechauffe');
        if (pre) {
            pre.checked = window.Storage?.getPref?.('prechauffe') === '1';
            pre.addEventListener('change', async () => {
                window.Storage?.setPref?.('prechauffe', pre.checked ? '1' : '0');
                if (!pre.checked) return;
                const r = await window.MH?.prechauffe?.lancer({ force: true }).catch(() => null);
                MH.toast?.(r?.lance
                    ? (r.ajoutes ? `${r.ajoutes} chapitre(s) mis en file` : 'Tes séries en cours sont déjà prêtes')
                    : 'Activé — les chapitres seront préparés la prochaine fois que l’appareil sera branché, en Wi-Fi');
            });
        }

        document.getElementById('dlPurge')?.addEventListener('click', purgerLus);
        const budget = document.getElementById('dlBudget');
        if (budget) {
            budget.value = String(window.Downloads.budget() || 0);
            if (!budget.value) budget.value = '0';
            budget.addEventListener('change', async () => {
                window.Storage?.setPref?.('dlBudget', budget.value);
                try {
                    const r = await window.Downloads.appliquerBudget();
                    if (r.evinces) render();
                    else if (+budget.value) MH.toast?.('Plafond enregistré');
                } catch (e) {
                    MH.toast?.('Plafond enregistré — il s’appliquera au prochain téléchargement en ligne');
                }
            });
        }
        // La file se redessine toute seule : elle avance sans que la page
        // soit touchee, et un ecran fige pendant un telechargement est
        // exactement ce qu'on vient verifier ici.
        window.DlFile?.surChangement(rendreFile);
        rendreFile();
        render();
    });

    // ── Libérer de la place : le déjà lu d'abord ─────────────
    // Le contexte vient du serveur (chapitres lus, position par série). Sans
    // lui — hors ligne — on ne sait pas ce qui a été lu : on ne supprime rien
    // plutôt que de risquer le chapitre qu'on gardait pour le train.
    async function contextePurge() {
        const [lus, prog] = await Promise.all([API.me.readChapters(), API.me.progress()]);
        const set = new Set();
        Object.values(lus || {}).forEach(l => (l || []).forEach(c => set.add(c.chapterId)));
        const position = {};
        Object.entries(prog || {}).forEach(([id, p]) => { const n = parseFloat(p.chapter); if (Number.isFinite(n)) position[id] = n; });
        return { lus: set, position };
    }
    async function purgerLus() {
        let contexte;
        try { contexte = await contextePurge(); } catch (e) {
            MH.toast?.('Impossible de savoir ce qui a été lu sans connexion : rien n’a été supprimé.');
            return;
        }
        const chapitres = await window.Downloads.list();
        const moyennes = new Map();
        try { (await window.Downloads.sizeByManga()).forEach(t => moyennes.set(t.mangaId, t.chapters ? t.bytes / t.chapters : 0)); } catch (e) { /* poids inconnus */ }
        const plan = window.Downloads.planPurge(chapitres, contexte, { poidsDe: (c) => moyennes.get(c.mangaId) || 0 });
        if (!plan.aSupprimer.length) {
            MH.toast?.('Aucun chapitre déjà lu à supprimer' + (plan.proteges ? ` — ${plan.proteges} chapitre(s) à lire gardé(s)` : ''));
            return;
        }
        const n = plan.aSupprimer.length;
        if (!await MH.confirm(`Supprimer ${n} chapitre${n > 1 ? 's' : ''} déjà lu${n > 1 ? 's' : ''} ?`, {
            okText: 'Supprimer',
            message: (plan.octets ? `Cela libérera environ ${fmtSize(plan.octets)}. ` : '')
                + (plan.proteges ? `Les ${plan.proteges} chapitre(s) qui te restent à lire sont gardés.` : 'Ce qui reste à lire est gardé.'),
        })) return;
        for (const c of plan.aSupprimer) await window.Downloads.remove(c.chapterId);
        MH.toast?.(`${n} chapitre(s) supprimé(s)`);
        render();
    }

    // ── La file d'attente (voir dl-file.js) ─────────────────
    //
    // Telecharger une plage de chapitres etait une boucle vivant dans la page
    // de la serie : elle mourait en silence des qu'on la quittait, et rien
    // n'a jamais montre ce qu'il restait a faire. La file est desormais un
    // etat persiste ; cette page est l'endroit ou on la voit et ou on la
    // range.
    //
    // Reordonner n'est pas un luxe : sur quarante chapitres en attente, celui
    // qu'on veut lire ce soir peut etre en trente-huitieme position, et la
    // seule facon de l'obtenir avant demain etait de tout annuler.
    function rendreFile() {
        const zone = document.getElementById('dlQueue');
        if (!zone || !window.DlFile) return;

        const items = window.DlFile.liste();
        if (!items.length) { zone.innerHTML = ''; return; }

        const enCours = window.DlFile.enCours();
        const pause = window.DlFile.enPause();
        const bloques = items.filter(it => it.bloque).length;

        zone.innerHTML = `<div class="dl-group">
            <div class="dl-ghead">
                <div class="dl-gtitle">File d'attente
                    <div class="dl-gcount">${items.length} chapitre(s) en attente${
                        bloques ? ` · ${bloques} en echec` : ''}${
                        pause ? ' · en pause' : ''}</div>
                </div>
                <button class="btn btn-sm" id="dlqPause">${pause ? '▶ Reprendre' : '⏸ Mettre en pause'}</button>
                <button class="btn btn-sm" id="dlqVider" style="color:#ef4444">Vider la file</button>
            </div>
            ${items.map((it, i) => {
                const actif = enCours && enCours.chapterId === it.chapterId;
                const pct = actif && enCours.total ? Math.round(enCours.fait / enCours.total * 100) : 0;
                const titre = `${it.mangaTitle || it.mangaId} — ${MH.unitLabel
                    ? MH.unitLabel(it.source, { short: true }) : 'Ch.'} ${MH.chapNum ? MH.chapNum(it.chapterNum) : it.chapterNum}`;
                return `
                <div class="dl-chap">
                    <span class="tag">${actif ? '↓' : i + 1}</span>
                    <span class="grow">${MH.esc(titre)}${
                        actif ? `<span style="color:var(--accent);font-size:11px;margin-left:6px">${
                            enCours.total ? `${pct}% · ${enCours.fait}/${enCours.total} pages` : 'demarrage…'}</span>` : ''}${
                        it.bloque ? `<span style="color:#f59e0b;font-size:11px;margin-left:6px" title="${
                            MH.esc(it.erreur || '')}">⚠ ${MH.esc(it.erreur || 'echec')}</span>` : ''}</span>
                    ${it.bloque ? `<button class="btn btn-sm" data-dlqretry="${MH.esc(it.chapterId)}" style="color:var(--accent)">Relancer</button>` : ''}
                    <button class="btn btn-sm" data-dlqup="${MH.esc(it.chapterId)}" aria-label="Monter dans la file" title="Monter"${i === 0 ? ' disabled' : ''}>↑</button>
                    <button class="btn btn-sm" data-dlqdown="${MH.esc(it.chapterId)}" aria-label="Descendre dans la file" title="Descendre"${i === items.length - 1 ? ' disabled' : ''}>↓</button>
                    <button class="btn btn-sm" data-dlqdel="${MH.esc(it.chapterId)}" aria-label="Retirer de la file" title="Retirer de la file">✕</button>
                </div>`;
            }).join('')}
        </div>`;

        document.getElementById('dlqPause').addEventListener('click', () => {
            const enPause = window.DlFile.basculerPause();
            // Dire ce qui arrive au chapitre EN COURS : l'abandonner jetterait
            // les pages deja prises, donc la pause s'applique au suivant. Sans
            // cette phrase, une barre qui continue de monter apres « pause »
            // passe pour un bouton casse.
            MH.toast?.(enPause ? 'En pause apres le chapitre en cours' : 'File reprise');
        });
        document.getElementById('dlqVider').addEventListener('click', async () => {
            if (!await MH.confirm('Vider la file d\'attente ?', {
                danger: true, okText: 'Vider',
                message: `${items.length} chapitre(s) ne seront pas telecharges. Les chapitres deja telecharges ne sont pas touches.` })) return;
            window.DlFile.vider();
            MH.toast?.('File videe');
        });
        zone.querySelectorAll('[data-dlqup]').forEach(b => b.addEventListener('click',
            () => window.DlFile.deplacer(b.dataset.dlqup, -1)));
        zone.querySelectorAll('[data-dlqdown]').forEach(b => b.addEventListener('click',
            () => window.DlFile.deplacer(b.dataset.dlqdown, 1)));
        zone.querySelectorAll('[data-dlqdel]').forEach(b => b.addEventListener('click',
            () => window.DlFile.retirer(b.dataset.dlqdel)));
        zone.querySelectorAll('[data-dlqretry]').forEach(b => b.addEventListener('click',
            () => window.DlFile.relancer(b.dataset.dlqretry)));
    }

    function fmtSize(n) {
        n = +n || 0;
        if (n < 1024) return n + ' o';
        if (n < 1048576) return (n / 1024).toFixed(0) + ' Ko';
        if (n < 1073741824) return (n / 1048576).toFixed(1) + ' Mo';
        return (n / 1073741824).toFixed(2) + ' Go';
    }

    // Audit AMEL-78 : « 6 Mo utilises » ne dit pas PAR QUOI. Sans repartition,
    // liberer de la place revient a supprimer au hasard. La mesure lit les
    // reponses en cache : elle est differee apres le rendu, la page ne doit pas
    // attendre pour s'afficher.
    // Les poids mesures, gardes pour les confirmations de suppression.
    //
    // Sans cette memoire il faudrait remesurer au moment du clic — c'est-a-dire
    // relire des centaines de blobs dans le cache, et figer l'onglet pile au
    // moment ou l'utilisateur attend une reponse. La mesure differee a deja
    // tout lu : autant s'en servir.
    const poidsConnus = new Map();   // mangaId -> { bytes, estimated }
    let poidsTotal = null;           // null tant que rien n'a ete mesure

    async function mesurerPoids() {
        if (!window.Downloads?.sizeByManga) return;
        let tailles;
        try { tailles = await window.Downloads.sizeByManga(); } catch (e) { return; }
        const total = tailles.reduce((n, t) => n + t.bytes, 0);
        poidsTotal = total;
        tailles.forEach(t => poidsConnus.set(t.mangaId, { bytes: t.bytes, estimated: t.estimated }));
        tailles.forEach(t => {
            const el = document.querySelector(`[data-poids="${CSS.escape(t.mangaId)}"]`);
            if (!el) return;
            const part = total ? Math.round((t.bytes / total) * 100) : 0;
            el.textContent = ` · ${fmtSize(t.bytes)}${t.estimated ? ' (estime)' : ''}`
                + (part >= 10 ? ` · ${part}% de tes telechargements` : '');
        });
        // La plus lourde d'abord : c'est celle qu'on veut voir quand on cherche
        // de la place. Sans ce tri, la liste reste chronologique et la serie a
        // supprimer peut etre en bas.
        const corps = document.getElementById('dlBody');
        const rang = new Map(tailles.map((t, i) => [t.mangaId, i]));
        [...corps.querySelectorAll('.dl-group')]
            .sort((a, b) => (rang.get(a.dataset.manga) ?? 1e9) - (rang.get(b.dataset.manga) ?? 1e9))
            .forEach(el => corps.appendChild(el));
    }

    /**
     * « il y a 3 jours », en petit, avec la date exacte en infobulle.
     *
     * Rien si la date manque : un chapitre téléchargé par une version
     * antérieure n'a pas de `savedAt`, et inventer une date serait pire que
     * n'en montrer aucune.
     */
    function dateTelechargement(c) {
        if (!c || !c.savedAt) return '';
        const d = new Date(c.savedAt);
        if (Number.isNaN(d.getTime())) return '';
        const iso = d.toISOString();
        return `<span class="dl-date" style="font-size:11px;color:var(--text3);white-space:nowrap"`
            + ` title="Téléchargé le ${MH.fullDate(iso)}">${MH.relTime(iso)}</span>`;
    }

    async function render() {
        const body = document.getElementById('dlBody');
        const groups = await window.Downloads.byManga();
        const total = await window.Downloads.count();
        document.getElementById('dlClearAll').style.display = total ? '' : 'none';
        const purge = document.getElementById('dlPurge');
        if (purge) purge.hidden = !total;

        // Estimation de l'espace (quota navigateur)
        try {
            const st = await window.Downloads.storage();
            if (st && st.quota) {
                const bar = document.getElementById('dlBar');
                bar.style.display = '';
                bar.firstElementChild.style.width = Math.min(100, (st.usage / st.quota) * 100) + '%';
                // P2.3 : dire si ces téléchargements SURVIVRONT. Le stockage
                // d'un WebView est effaçable par le système sous pression
                // mémoire — annoncer « disponibles hors-ligne » sans le
                // préciser serait une promesse qu'on ne tient pas, et qui se
                // casse au pire moment : dans le train, sans réseau pour
                // recommencer.
                const garantie = st.persistant
                    ? 'Conservés tant que tu ne les supprimes pas.'
                    : 'Le système peut les effacer s’il manque de place — retélécharge avant un trajet.';
                document.getElementById('dlStorage').textContent =
                    `${total} chapitre(s) · ${fmtSize(st.usage)} utilisés sur ${fmtSize(st.quota)} disponibles. ${garantie}`;
            } else {
                document.getElementById('dlStorage').textContent = `${total} chapitre(s) disponibles hors-ligne.`;
            }
            // Proposer la persistance quand elle manque ET qu'il y a quelque
            // chose à protéger. Un bouton qui apparaît sans raison est du bruit.
            if (total && st && !st.persistant && navigator.storage?.persist) {
                const z = document.getElementById('dlStorage');
                const b = document.createElement('button');
                b.className = 'btn btn-secondary btn-sm';
                b.style.cssText = 'margin-left:10px;min-height:44px';
                b.textContent = 'Protéger ces téléchargements';
                b.addEventListener('click', async () => {
                    b.disabled = true;
                    const ok = await window.Downloads.demanderPersistance();
                    window.MH?.toast?.(ok
                        ? 'Téléchargements protégés — le système ne les effacera plus.'
                        : 'Le système a refusé. Installer l’application (ou l’ouvrir plus souvent) rend la demande acceptable.');
                    if (ok) render();
                    else b.disabled = false;
                });
                z.appendChild(b);
            }
        } catch (e) { window.MH?.err?.('downloads-page.js', e); }

        if (!groups.length) {
            body.innerHTML = `<div class="dl-empty">
                <div style="font-size:15px;color:var(--text);font-weight:600;margin-bottom:8px">Aucun téléchargement</div>
                <div>Depuis un chapitre, clique sur l'icône de téléchargement pour le lire hors-ligne.</div></div>`;
            return;
        }

        body.innerHTML = groups.map(g => {
            const chaps = (g.chapters || []).sort((a, b) => (parseFloat(a.chapterNum) || 0) - (parseFloat(b.chapterNum) || 0));
            const cover = g.cover || (chaps[0] && chaps[0].cover) || '';
            return `<div class="dl-group" data-manga="${MH.esc(g.mangaId)}">
                <div class="dl-ghead">
                    <img class="dl-gcover" src="${MH.esc(cover)}" alt="" loading="lazy" decoding="async" onerror="this.style.visibility='hidden'">
                    <div class="dl-gtitle">${MH.esc(g.mangaTitle || g.mangaId)}
                        <div class="dl-gcount">${chaps.length} chapitre(s)<span data-poids="${MH.esc(g.mangaId)}"></span></div>
                    </div>
                    ${chaps.some(c => c.kind !== 'novel') ? `<button class="btn btn-sm" data-cbz="${MH.esc(g.mangaId)}" title="Une archive CBZ, lisible par toutes les liseuses de BD">Exporter en CBZ</button>` : ''}
                    <button class="btn btn-sm" data-delmanga="${MH.esc(g.mangaId)}" style="color:#ef4444">Supprimer la série</button>
                </div>
                ${chaps.map(c => {
                    const incomplete = c.kind !== 'novel' && c.incomplete && c.failed > 0;
                    return `
                    <div class="dl-chap">
                        <span class="tag">${c.kind === 'novel' ? 'texte' : 'manga'}</span>
                        <a class="grow" href="${MH.readerHref(c.mangaId, c.chapterId, c.source)}" style="text-decoration:none;color:inherit">
                            ${MH.esc(c.chapterTitle || ('Chapitre ' + c.chapterNum))}
                            ${incomplete ? `<span style="color:#f59e0b;font-size:11px;margin-left:6px" data-dlprog="${MH.esc(c.chapterId)}">⚠ ${c.failed} page(s) manquante(s)</span>` : ''}
                        </a>
                        <!-- Depuis quand cette copie dort ici.
                             « savedAt » était enregistré à chaque téléchargement
                             et n'était affiché nulle part. C'est pourtant ce
                             qui permet de choisir quoi supprimer quand la place
                             manque — et cette page prévient justement que le
                             système peut tout effacer. -->
                        ${dateTelechargement(c)}
                        ${incomplete ? `<button class="btn btn-sm" data-retry="${MH.esc(c.chapterId)}" style="color:var(--accent)">Relancer</button>` : ''}
                        <button class="btn btn-sm" data-delchap="${MH.esc(c.chapterId)}" aria-label="Supprimer le téléchargement de ${MH.esc(c.chapterTitle || ('Chapitre ' + c.chapterNum))}" title="Supprimer ce téléchargement">✕</button>
                    </div>`; }).join('')}
            </div>`;
        }).join('');

        body.querySelectorAll('[data-delmanga]').forEach(b => b.addEventListener('click', async () => {
            // On dit CE QUE ÇA REPREND avant de détruire : sans le chiffre,
            // « faire de la place » revient à supprimer au hasard — et à
            // recommencer parce qu'on n'en a pas repris assez.
            const p = poidsConnus.get(b.dataset.delmanga);
            const combien = p
                ? `Cela libérera ${p.estimated ? 'environ ' : ''}${fmtSize(p.bytes)}.`
                : 'Les chapitres devront être retéléchargés.';
            if (!await MH.confirm('Supprimer tous les chapitres de cette série ?', {
                danger: true, okText: 'Supprimer', message: combien })) return;
            await window.Downloads.removeManga(b.dataset.delmanga);
            MH.toast?.('Série supprimée des téléchargements'); render();
        }));
        body.querySelectorAll('[data-cbz]').forEach(b => b.addEventListener('click', async () => {
            const libelle = b.textContent;
            b.disabled = true;
            try {
                const r = await window.Downloads.exporterCbz(b.dataset.cbz, {
                    onProgress: (fait, total) => { b.textContent = `Archive… ${Math.round(fait / total * 100)} %`; },
                });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(r.blob);
                a.download = r.nom;
                document.body.appendChild(a); a.click(); a.remove();
                setTimeout(() => URL.revokeObjectURL(a.href), 60000);
                MH.toast?.(`${r.nom} : ${r.chapitres} chapitre(s), ${r.pages} page(s)`
                    + (r.manquantes ? ` — ${r.manquantes} page(s) absente(s) du cache, non incluses` : ''));
            } catch (e) {
                MH.toast?.(e.message || 'Export impossible');
            } finally { b.disabled = false; b.textContent = libelle; }
        }));
        body.querySelectorAll('[data-delchap]').forEach(b => b.addEventListener('click', async () => {
            await window.Downloads.remove(b.dataset.delchap);
            MH.toast?.('Chapitre supprimé'); render();
        }));
        // Relance d'un téléchargement incomplet : re-fetch UNIQUEMENT les pages
        // manquantes (les pages déjà en cache sont sautées par download()).
        body.querySelectorAll('[data-retry]').forEach(b => b.addEventListener('click', async () => {
            const id = b.dataset.retry;
            const meta = await window.Downloads.get(id);
            if (!meta || !(meta.pages || []).length) { MH.toast?.('Impossible de relancer ce chapitre'); return; }
            b.disabled = true; b.textContent = '…';
            const prog = body.querySelector(`[data-dlprog="${CSS.escape(id)}"]`);
            try {
                const r = await window.Downloads.download(
                    { mangaId: meta.mangaId, chapterId: id, chapterNum: meta.chapterNum,
                      mangaTitle: meta.mangaTitle, cover: meta.cover, source: meta.source },
                    meta.pages.map(u => ({ url: u })),
                    (d, n) => { if (prog) prog.textContent = `${Math.round(d / n * 100)}%`; }
                );
                MH.toast?.(r?.failed ? `Toujours ${r.failed} page(s) manquante(s)` : 'Chapitre complété ✓');
            } catch (e) {
                MH.toast?.(e.message === '__cancelled__' ? 'Relance annulée' : 'Erreur : ' + e.message);
            }
            render();
        }));

        mesurerPoids();
        verifierIntegrite(groups);
    }

    // Après l'affichage, et un chapitre à la fois : la vérification lit le
    // cache planche par planche, elle ne doit ni retarder la page ni la
    // saturer. Si elle trouve un écart avec ce qui est affiché, on redessine
    // — l'avertissement et « Relancer » sont alors ceux qui existaient déjà.
    let verificationEnCours = false;
    async function verifierIntegrite(groups) {
        if (verificationEnCours || !window.Downloads?.verifier) return;
        verificationEnCours = true;
        let ecart = false;
        try {
            for (const g of groups) {
                for (const c of g.chapters || []) {
                    if (c.kind === 'novel') continue;
                    const r = await window.Downloads.verifier(c.chapterId);
                    const affiche = c.incomplete ? (c.failed || 0) : 0;
                    if (r && r.manquantes !== affiche) ecart = true;
                }
            }
        } catch (e) { window.MH?.err?.('downloads-page.js', e); }
        verificationEnCours = false;
        if (ecart) {
            window.MH?.toast?.('Des planches ont disparu du stockage : relance les chapitres signalés.');
            render();
        }
    }
})();
