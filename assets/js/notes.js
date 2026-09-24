// notes.js — Journal de lecture : consultation de toutes les notes personnelles
(function () {
    'use strict';

    const MOOD_LABEL = { love: 'Coup de cœur', wow: 'Waouh', laugh: 'Drôle', cry: 'Émouvant', angry: 'Rageant', fear: 'Stressant', think: 'Réflexion', meh: 'Mitigé' };
    const MOOD_COLOR = { love: '#a83232', wow: '#c1531b', laugh: '#b5761b', cry: '#3d5170', angry: '#8a3a2a', fear: '#5a4a6a', think: '#3f7d4e', meh: '#6d685b' };
    let allNotes = [];
    let searchTimer = null;
    // Vue du journal : « carnet » (jour par jour) ou « series ».
    let vue = 'carnet';
    try { vue = window.Storage?.getPref?.('journal_vue') === 'series' ? 'series' : 'carnet'; } catch (e) { /* défaut */ }
    let activiteJours = [];      // [{ jour, series: [...] }] — ce qu'on a lu, par jour
    let filtreType = '';
    let filtreTag = '';
    const KINDS = { note: 'Note', citation: 'Citation', reflexion: 'Réflexion' };

    document.addEventListener('DOMContentLoaded', async () => {
        MH.initPage('notes');
        await (window.API?.ready || Promise.resolve());   // session locale auto
        if (!API.isLoggedIn()) { showLoggedOut(); return; }
        await MH.loadSourceTypes?.();
        await loadStats();
        API.me.journalActivite(90).then(async r => {
            activiteJours = r.jours || [];
            if (vue === 'carnet') render(requete());
            // Séries lues mais absentes de la bibliothèque : titre et couverture
            // demandés à leur source, une fois (10 au plus).
            const manquantes = new Map();
            activiteJours.forEach(j => j.series.forEach(s => { if (!s.titre && s.source) manquantes.set(s.mangaId, s); }));
            const liste = [...manquantes.values()].slice(0, 10);
            if (!liste.length) return;
            const res = await Promise.allSettled(liste.map(s => API.mangas.getFrom(s.source, s.mangaId)));
            const infos = new Map();
            res.forEach((x, i) => { if (x.status === 'fulfilled' && x.value?.title) infos.set(liste[i].mangaId, x.value); });
            activiteJours.forEach(j => j.series.forEach(s => {
                const m = infos.get(s.mangaId);
                if (m) { s.titre = m.title; s.cover = s.cover || m.coverThumb || m.cover; }
            }));
            if (vue === 'carnet') render(requete());
        }).catch(e => window.MH?.err?.('notes.js', e));
        await loadNotes();
        brancherJournal();
        document.getElementById('jrExportMd')?.addEventListener('click', exporterMarkdown);
        brancherFiltres();
        const btnRecit = document.getElementById('jrRecit');
        if (btnRecit) {
            const peindre = () => {
                btnRecit.classList.toggle('btn-primary', modeRecit);
                btnRecit.setAttribute('aria-pressed', String(modeRecit));
            };
            peindre();
            btnRecit.addEventListener('click', () => {
                modeRecit = !modeRecit;
                window.Storage?.setPref('journal_recit', modeRecit ? '1' : '0');
                peindre();
                render(document.getElementById('jrSearch').value.trim().toLowerCase());
            });
        }
        document.getElementById('jrSearch').addEventListener('input', (e) => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => render(e.target.value.trim().toLowerCase()), 200);
        });
    });

    function showLoggedOut() {
        // Audit N1 : message honnête (non connecté ≠ serveur en panne)
        document.getElementById('jrBody').innerHTML = `<div class="jr-empty">${MH.guestNotice()}</div>`;
    }

    async function loadStats() {
        try {
            const s = await API.me.notesStats();
            const topMood = Object.entries(s.moods || {}).sort((a, b) => b[1] - a[1])[0];
            document.getElementById('jrStats').innerHTML = `
                <div class="jr-stat"><b>${s.total}</b><span>note${s.total > 1 ? 's' : ''}</span></div>
                <div class="jr-stat"><b>${s.series}</b><span>série${s.series > 1 ? 's' : ''} annotée${s.series > 1 ? 's' : ''}</span></div>
                ${topMood ? `<div class="jr-stat"><b style="color:${MOOD_COLOR[topMood[0]] || 'var(--accent)'};font-size:14px">${MOOD_LABEL[topMood[0]] || ''}</b><span>humeur dominante</span></div>` : ''}`;
        } catch (e) { window.MH?.err?.('notes.js', e); }
    }

    // ── Humeurs dans le temps (audit AMEL-46) ────────────────
    // Le champ `mood` était collecté à chaque note et restitué sous la forme
    // d'UNE seule valeur : « humeur dominante ». Toute l'évolution — le moment
    // où une série devient pesante, celui où elle décolle — était perdue.
    //
    // Une frise par mois, construite à partir des notes déjà chargées : aucune
    // requête supplémentaire, et elle se met à jour avec la pagination.
    function renderMoodTimeline(notes) {
        const el = document.getElementById('jrMoods');
        if (!el) return;
        const avecHumeur = notes.filter(n => n.mood);
        if (avecHumeur.length < 3) { el.hidden = true; return; }

        const parMois = new Map();
        avecHumeur.forEach(n => {
            const d = new Date(n.createdAt || n.created_at || Date.now());
            const cle = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            if (!parMois.has(cle)) parMois.set(cle, {});
            const m = parMois.get(cle);
            m[n.mood] = (m[n.mood] || 0) + 1;
        });
        const mois = [...parMois.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-12);

        el.hidden = false;
        el.innerHTML = `<h2 class="jr-moods-title">Humeurs au fil du temps</h2>
            <div class="jr-moods-row">${mois.map(([cle, compte]) => {
        const total = Object.values(compte).reduce((a, b) => a + b, 0);
        const label = new Date(cle + '-01').toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
        // Barre empilée : chaque humeur occupe sa part du mois. Les nombres
        // sont dans le title, la couleur ne portant pas seule l'information.
        const segments = Object.entries(compte).sort((a, b) => b[1] - a[1]).map(([m, n]) =>
            `<span style="height:${(n / total * 100).toFixed(1)}%;background:${MOOD_COLOR[m] || 'var(--accent)'}"></span>`).join('');
        const detail = Object.entries(compte).map(([m, n]) => `${MOOD_LABEL[m] || m} : ${n}`).join(', ');
        return `<div class="jr-mood-col" title="${MH.esc(label + ' — ' + detail)}">
                        <div class="jr-mood-bar">${segments}</div>
                        <div class="jr-mood-label">${MH.esc(label)}</div>
                    </div>`;
    }).join('')}</div>`;
    }

    // ── Export Markdown (audit AMEL-43) ──────────────────────
    // `/me/export` couvre tout, en JSON — un format fait pour être réimporté,
    // pas pour être LU. Or une note de lecture n'a d'intérêt qu'ouverte, et
    // son usage naturel est un carnet (Obsidian, Logseq, un simple éditeur).
    function exporterMarkdown() {
        if (!allNotes.length) { MH.toast?.('Aucune note à exporter'); return; }
        // Groupé par série, chronologique à l'intérieur : c'est l'ordre dans
        // lequel on relit un carnet, pas l'ordre d'écriture toutes séries
        // mêlées.
        const parSerie = new Map();
        allNotes.forEach(n => {
            const cle = n.mangaTitle || n.mangaId || 'Sans série';
            if (!parSerie.has(cle)) parSerie.set(cle, []);
            parSerie.get(cle).push(n);
        });

        const lignes = ['# Journal de lecture Inko', '',
            `Export du ${new Date().toLocaleDateString('fr-FR')} — ${allNotes.length} note(s).`, ''];
        [...parSerie.entries()].sort((a, b) => a[0].localeCompare(b[0])).forEach(([serie, notes]) => {
            lignes.push(`## ${serie}`, '');
            notes.slice().sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)).forEach(n => {
                const d = new Date(n.createdAt).toLocaleDateString('fr-FR');
                const contexte = [n.chapterNum != null ? `Ch. ${n.chapterNum}` : null,
                    n.page ? `p. ${n.page}` : null].filter(Boolean).join(' · ');
                lignes.push(`### ${d}${contexte ? ' — ' + contexte : ''}`);
                if (n.mood) lignes.push(`*Humeur : ${MOOD_LABEL[n.mood] || n.mood}*`, '');
                // `>` : le corps est cité, ce qui le distingue des en-têtes
                // qu'on vient d'ajouter et rend le fichier lisible tel quel.
                lignes.push(String(n.body || '').split('\n').map(l => '> ' + l).join('\n'), '');
            });
        });

        const blob = new Blob([lignes.join('\n')], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `inko-journal-${new Date().toISOString().slice(0, 10)}.md`;
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
        MH.toast?.(`${allNotes.length} note(s) exportée(s) en Markdown`);
    }

    let notesTotal = 0;   // total serveur (pagination, audit J2)
    // Audit AMEL-45 : lecture « en recit » (chronologique) ou consultation
    // (recent d'abord). Persiste, comme tout reglage de lecture.
    let modeRecit = false;
    try { modeRecit = window.Storage?.getPref('journal_recit') === '1'; } catch (e) { modeRecit = false; }

    async function loadNotes() {
        try {
            const r = await API.me.notes();
            allNotes = r.notes || [];
            notesTotal = r.total ?? allNotes.length;
        }
        catch (e) {
            // Taxonomie P1.6 : « Erreur : <message> » ne disait rien d'utile et
            // ne proposait rien. Le journal se recharge d'un bouton.
            MH.poserEtatErreur('jrBody', e, { onRetry: () => loadNotes() });
            return;
        }
        render('');
    }

    // Audit J2 : « charger plus » — les notes au-delà des 500 plus récentes
    // disparaissaient silencieusement du Journal (et de sa recherche, J3).
    async function loadMoreNotes() {
        try {
            const r = await API.me.notes({ offset: allNotes.length });
            allNotes = allNotes.concat(r.notes || []);
            notesTotal = r.total ?? notesTotal;
            render((document.getElementById('jrSearch')?.value || '').trim().toLowerCase());
        } catch (e) { MH.toast?.('Erreur : ' + e.message); }
    }

    // ── Filtrer le journal : humeur et série ────────────────
    //
    // Le journal savait chercher dans le TEXTE des notes. Deux questions
    // courantes n'avaient pourtant aucune réponse :
    //
    //   · « montre-moi ce qui m'a ému » — la frise affichait « 3 notes
    //     émouvantes en mars » sans qu'on puisse les ouvrir ;
    //   · « qu'est-ce que j'ai écrit sur cette série » — il fallait taper son
    //     titre, en espérant l'orthographier comme la source.
    //
    // Les deux listes sont construites à partir des notes RÉELLES. Proposer
    // une humeur que personne n'a jamais posée, ou une série absente du
    // journal, reviendrait à offrir un filtre qui ne rend jamais rien.
    let filtreHumeur = '';
    let filtreSerie = '';

    /** La recherche en cours, quel que soit l'endroit d'où l'on relance. */
    const requete = () => (document.getElementById('jrSearch')?.value || '').trim().toLowerCase();

    function construireFiltres() {
        const zone = document.getElementById('jrFiltres');
        const hZone = document.getElementById('jrFiltreHumeurs');
        const sel = document.getElementById('jrFiltreSerie');
        if (!zone || !hZone || !sel) return;

        // Sous trois notes, filtrer n'a pas de sens : la barre serait plus
        // grande que ce qu'elle trie.
        if (allNotes.length < 3 && !allNotes.some(n => tagsDe(n.body).length)) { zone.hidden = true; return; }
        zone.hidden = false;

        const MOODS = window.NotesUI?.MOODS || [];
        const compte = new Map();
        const series = new Map();
        for (const n of allNotes) {
            if (n.mood) compte.set(n.mood, (compte.get(n.mood) || 0) + 1);
            const cle = n.mangaId;
            if (cle && !series.has(cle)) series.set(cle, n.mangaTitle || cle);
        }

        hZone.innerHTML = MOODS
            .filter(([id]) => compte.has(id))
            .map(([id, libelle, couleur]) => `
                <button type="button" class="jr-humeur${filtreHumeur === id ? ' on' : ''}"
                        data-humeur="${MH.esc(id)}" aria-pressed="${filtreHumeur === id}"
                        style="--h:${couleur}" title="${MH.esc(libelle)} — ${compte.get(id)} note(s)">
                    ${MH.esc(libelle)} <span class="jr-humeur-n">${compte.get(id)}</span>
                </button>`).join('');

        const triees = [...series.entries()].sort((a, b) => a[1].localeCompare(b[1], 'fr'));
        sel.innerHTML = `<option value="">Toutes les séries (${triees.length})</option>`
            + triees.map(([id, titre]) =>
                `<option value="${MH.esc(id)}"${filtreSerie === id ? ' selected' : ''}>${MH.esc(titre)}</option>`).join('');

        // Types présents, et #tags réellement écrits.
        const tZone = document.getElementById('jrTypes');
        const kinds = new Map();
        allNotes.forEach(n => { const k = n.kind || 'note'; kinds.set(k, (kinds.get(k) || 0) + 1); });
        if (tZone) tZone.innerHTML = kinds.size > 1 ? Object.entries(KINDS).filter(([k]) => kinds.has(k)).map(([k, l]) =>
            `<button type="button" class="jr-chip${filtreType === k ? ' on' : ''}" data-type="${k}" aria-pressed="${filtreType === k}">${l} <span>${kinds.get(k)}</span></button>`).join('') : '';
        const gZone = document.getElementById('jrTags');
        const tags = new Map();
        allNotes.forEach(n => tagsDe(n.body).forEach(t => tags.set(t, (tags.get(t) || 0) + 1)));
        if (gZone) gZone.innerHTML = [...tags.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([t, c]) =>
            `<button type="button" class="jr-chip jr-chip-tag${filtreTag === t ? ' on' : ''}" data-tag="${MH.esc(t)}" aria-pressed="${filtreTag === t}">#${MH.esc(t)} <span>${c}</span></button>`).join('');

        const raz = document.getElementById('jrFiltresRaz');
        if (raz) raz.hidden = !filtreHumeur && !filtreSerie && !filtreType && !filtreTag;
    }

    function brancherFiltres() {
        const hZone = document.getElementById('jrFiltreHumeurs');
        const sel = document.getElementById('jrFiltreSerie');
        const raz = document.getElementById('jrFiltresRaz');

        // Délégation : la barre est reconstruite à chaque rendu, et rebrancher
        // chaque puce à chaque fois empilerait les écouteurs.
        hZone?.addEventListener('click', (e) => {
            const b = e.target.closest('.jr-humeur');
            if (!b) return;
            // Recliquer la même humeur la retire : sans ça, on ne peut plus
            // revenir à « tout » sans chercher un bouton dédié.
            filtreHumeur = filtreHumeur === b.dataset.humeur ? '' : b.dataset.humeur;
            render(requete());
        });
        sel?.addEventListener('change', () => { filtreSerie = sel.value; render(requete()); });
        document.getElementById('jrTypes')?.addEventListener('click', (e) => {
            const b = e.target.closest('[data-type]'); if (!b) return;
            filtreType = filtreType === b.dataset.type ? '' : b.dataset.type; render(requete());
        });
        document.getElementById('jrTags')?.addEventListener('click', (e) => {
            const b = e.target.closest('[data-tag]'); if (!b) return;
            filtreTag = filtreTag === b.dataset.tag ? '' : b.dataset.tag; render(requete());
        });
        raz?.addEventListener('click', () => {
            filtreHumeur = ''; filtreSerie = ''; filtreType = ''; filtreTag = '';
            const champ = document.getElementById('jrSearch');
            if (champ) champ.value = '';
            render('');
        });
    }

    /** Applique les filtres de la barre, avant la recherche plein texte. */
    function filtrer(notes) {
        let out = notes;
        if (filtreType) out = out.filter((n) => (n.kind || 'note') === filtreType);
        if (filtreTag) out = out.filter((n) => tagsDe(n.body).includes(filtreTag));
        if (filtreHumeur) out = out.filter((n) => n.mood === filtreHumeur);
        if (filtreSerie) out = out.filter((n) => String(n.mangaId) === String(filtreSerie));
        return out;
    }

    function render(q) {
        const body = document.getElementById('jrBody');
        construireFiltres();
        let notes = filtrer(allNotes);
        if (q && q.startsWith('#') && q.length > 1) notes = notes.filter(n => tagsDe(n.body).some(t => t.startsWith(q.slice(1))));
        else if (q) notes = notes.filter(n => (n.body || '').toLowerCase().includes(q) || (n.mangaTitle || '').toLowerCase().includes(q));
        // Carnet sans note mais avec des lectures : c'est justement là qu'il sert
        // (« le carnet se remplit tout seul »). On ne montre le vide que s'il n'y
        // a VRAIMENT rien à raconter.
        const filtreActif = !!(filtreHumeur || filtreSerie || filtreType || filtreTag || q);
        if (!notes.length && vue === 'carnet' && !filtreActif && activiteJours.length) {
            body.innerHTML = `<div class="jr-astuce">Tu n'as encore rien écrit : voici ce que tu as lu. Ajoute une entrée pour garder une impression, une réplique, une théorie.</div>`
                + renderCarnet([]);
            return;
        }
        if (!notes.length) {
            // Trois vides différents : rien pour ce texte, rien pour ces
            // filtres, ou journal réellement vide. Le premier se corrige en
            // changeant de mot, le deuxième en élargissant, le troisième en
            // écrivant une note. Les confondre envoie chercher au mauvais
            // endroit.
            const filtre = !!(filtreHumeur || filtreSerie);
            body.innerHTML = q
                ? `<div class="jr-empty">Aucune note ne correspond à « ${MH.esc(q)} »${filtre ? ' avec ces filtres' : ''}.</div>`
                : filtre
                    ? `<div class="jr-empty">Aucune note ne correspond à ces filtres.
                        <button type="button" id="jrVideRaz" class="link-orange"
                            style="background:none;border:none;padding:0;font:inherit;cursor:pointer;text-decoration:underline">Tout afficher</button></div>`
                : `<div class="jr-empty">
                    <div style="font-size:15px;color:var(--text);font-weight:600;margin-bottom:6px">Ton journal est vide</div>
                    <div style="margin-bottom:16px">Écris une entrée ici, ou pendant ta lecture avec le bouton Notes (touche J).</div>
                    <button type="button" class="btn btn-primary btn-sm" id="jrVideNew">＋ Nouvelle entrée</button></div>`;
            document.getElementById('jrVideNew')?.addEventListener('click', () => ouvrirEditeur());
            document.getElementById('jrVideRaz')?.addEventListener('click', () => {
                filtreHumeur = ''; filtreSerie = ''; render(requete());
            });
            return;
        }
        // Regroupe par série, en conservant l'ordre chronologique (récent d'abord)
        const groups = new Map();
        notes.forEach(n => {
            if (!groups.has(n.mangaId)) groups.set(n.mangaId, { manga: n, notes: [] });
            groups.get(n.mangaId).notes.push(n);
        });
        // Audit AMEL-45 : en mode « recit », chaque serie se lit du debut a la
        // fin — c'est ainsi qu'on relit un carnet. Par defaut on garde le plus
        // recent en tete, qui est ce qu'on veut en consultation courante.
        if (modeRecit) {
            groups.forEach(g => g.notes.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)));
        }
        const epinglees = notes.filter(n => n.pinned);
        const blocEpingle = epinglees.length && !filtreSerie
            ? `<section class="jr-pinned"><h2 class="jr-day-title">Épinglées</h2>${epinglees.map(renderNote).join('')}</section>` : '';
        body.innerHTML = blocEpingle + (vue === 'carnet' ? renderCarnet(notes) : [...groups.values()].map(renderGroup).join(''));
        renderMoodTimeline(allNotes);   // audit AMEL-46

        // Pagination (audit J2) : indicateur honnête + « charger plus ».
        // En recherche (J3), rappelle que seules les notes chargées sont filtrées.
        if (allNotes.length < notesTotal) {
            body.innerHTML += `<div style="text-align:center;padding:16px">
                <div style="font-size:11.5px;color:var(--text3);margin-bottom:8px">
                    ${allNotes.length} note${allNotes.length > 1 ? 's' : ''} chargée${allNotes.length > 1 ? 's' : ''} sur ${notesTotal}${q ? ' — la recherche ne porte que sur les notes chargées' : ''}
                </div>
                <button class="btn btn-secondary btn-sm" id="jrMore">Charger plus</button></div>`;
            body.querySelector('#jrMore')?.addEventListener('click', loadMoreNotes);
        }

        body.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => removeNote(b.dataset.del)));
        body.querySelectorAll('[data-pin]').forEach(b => b.addEventListener('click', () => basculerEpingle(b.dataset.pin)));
        body.querySelectorAll('.jr-note-body [data-tag]').forEach(a => a.addEventListener('click', (e) => {
            e.preventDefault(); filtreTag = a.dataset.tag; render(requete());
            document.getElementById('jrFiltres')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }));
        body.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => editNote(b.dataset.edit)));
    }

    function renderGroup(g) {
        const m = g.manga;
        const serieHref = `serie.html?id=${encodeURIComponent(m.mangaId)}&source=${encodeURIComponent(m.source || '')}`;
        return `
        <section class="jr-group">
            <div class="jr-group-head">
                <a class="jr-group-cover" href="${serieHref}">
                    <img src="${MH.cover(m.cover, MH.placeholderCover(m.mangaId))}" alt="" loading="lazy" onerror="this.src='${MH.placeholderCover(m.mangaId)}'">
                </a>
                <div>
                    <h3 class="jr-group-title"><a href="${serieHref}">${MH.esc(m.mangaTitle || m.mangaId)}</a></h3>
                    <div class="jr-group-meta">${g.notes.length} note${g.notes.length > 1 ? 's' : ''}</div>
                </div>
            </div>
            <div class="jr-timeline">${g.notes.map(renderNote).join('')}</div>
        </section>`;
    }

    function renderNote(n) {
        const unit = MH.unitLabel ? MH.unitLabel(n.source, { short: true }) : 'Chap.';
        const loc = [n.chapterNum != null ? `${unit} ${n.chapterNum}` : null, n.page != null ? `page ${n.page}` : null].filter(Boolean).join(' · ');
        const read = (n.chapterId)
            ? (MH.readerHref ? MH.readerHref(n.mangaId, n.chapterId, n.source) : '#')
            : `serie.html?id=${encodeURIComponent(n.mangaId)}&source=${encodeURIComponent(n.source || '')}`;
        const when = MH.fullDate ? MH.fullDate(n.createdAt) : new Date(n.createdAt).toLocaleString('fr-FR');
        return `
        <article class="jr-note${n.pinned ? ' is-pinned' : ''}" data-id="${n.id}">
            <div class="jr-note-head">
                ${n.kind && n.kind !== 'note' ? `<span class="jr-note-kind jr-kind-${n.kind}">${KINDS[n.kind] || ''}</span>` : ''}
                ${vue === 'carnet' || n.pinned ? `<a class="jr-note-serie" href="serie.html?id=${encodeURIComponent(n.mangaId)}&source=${encodeURIComponent(n.source || '')}">${MH.esc(n.mangaTitle || '')}</a>` : ''}
                ${n.mood ? `<span class="jr-note-mood" style="color:${MOOD_COLOR[n.mood] || 'var(--accent)'}">${MOOD_LABEL[n.mood] || ''}</span>` : ''}
                ${loc ? `<a class="jr-note-loc" href="${read}">${MH.esc(loc)}</a>` : ''}
                <span class="jr-note-date">${MH.esc(when)}</span>
                <span class="jr-note-tools">
                    <button class="jr-note-tool${n.pinned ? ' on' : ''}" data-pin="${n.id}" title="${n.pinned ? 'Désépingler' : 'Épingler en haut du journal'}" aria-label="${n.pinned ? 'Désépingler' : 'Épingler'}" aria-pressed="${!!n.pinned}"><svg viewBox="0 0 24 24" width="14" height="14" fill="${n.pinned ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5"/><path d="M9 10.76V6h6v4.76l2 3.24H7z"/><path d="M8 3h8"/></svg></button>
                    <button class="jr-note-tool" data-edit="${n.id}" title="Modifier" aria-label="Modifier"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>
                    <button class="jr-note-tool" data-del="${n.id}" title="Supprimer" aria-label="Supprimer"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
                </span>
            </div>
            <div class="jr-note-body${n.kind === 'citation' ? ' jr-citation' : ''}" data-body="${n.id}">${corpsAvecTags(n.body)}</div>
        </article>`;
    }

    async function editNote(id) {
        const n = allNotes.find(x => String(x.id) === String(id));
        if (n) ouvrirEditeur(n);
    }

    // ── #tags ──────────────────────────────────────────────
    function tagsDe(texte) {
        const out = new Set();
        for (const m of String(texte || '').matchAll(/(^|[\s(])#([\p{L}\p{N}_-]{2,30})/gu)) out.add(m[2].toLowerCase());
        return [...out];
    }
    function corpsAvecTags(texte) {
        return MH.esc(texte).replace(/(^|[\s(])#([\p{L}\p{N}_-]{2,30})/gu,
            (_, avant, t) => `${avant}<a href="#" class="jr-tag" data-tag="${t.toLowerCase()}">#${t}</a>`);
    }

    async function basculerEpingle(id) {
        const n = allNotes.find(x => String(x.id) === String(id));
        if (!n) return;
        try {
            await API.me.updateNote(id, { pinned: !n.pinned });
            n.pinned = !n.pinned;
            render(requete());
            MH.toast?.(n.pinned ? 'Épinglée en haut du journal' : 'Désépinglée');
        } catch (e) { MH.toastErreur?.(e); }
    }

    // ── Carnet : un jour = ce qu'on a lu + ce qu'on a écrit ──
    const jourLocal = (d) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
    function titreJour(j) {
        const d = new Date(j + 'T12:00:00');
        const auj = jourLocal(new Date()), hier = jourLocal(Date.now() - 864e5);
        if (j === auj) return "Aujourd'hui";
        if (j === hier) return 'Hier';
        const s = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
        return s.charAt(0).toUpperCase() + s.slice(1);
    }
    function renderCarnet(notes) {
        const filtre = !!(filtreHumeur || filtreSerie || filtreType || filtreTag || requete());
        const jours = new Map();
        notes.filter(n => !n.pinned || filtreSerie).forEach(n => {
            const j = jourLocal(n.createdAt);
            if (!jours.has(j)) jours.set(j, { notes: [], lu: [] });
            jours.get(j).notes.push(n);
        });
        // L'activité de lecture n'apparaît que sans filtre : filtrer « citations »
        // et voir « lu 5 chapitres » brouillerait la réponse.
        if (!filtre) activiteJours.forEach(a => {
            if (!jours.has(a.jour)) jours.set(a.jour, { notes: [], lu: [] });
            jours.get(a.jour).lu = a.series;
        });
        const ordre = [...jours.keys()].sort((a, b) => b.localeCompare(a));
        return ordre.map(j => {
            const { notes: ns, lu } = jours.get(j);
            const unite = (s) => MH.unitLabel ? MH.unitLabel(s.source, { short: true }) : 'Chap.';
            const ligneLu = lu.length ? `<div class="jr-lu">${lu.slice(0, 6).map(s => `
                <a class="jr-lu-item" href="serie.html?id=${encodeURIComponent(s.mangaId)}&source=${encodeURIComponent(s.source || '')}">
                    <img src="${MH.cover(s.cover, MH.placeholderCover(s.mangaId))}" alt="" loading="lazy">
                    <span><b>${MH.esc(s.titre || 'Série')}</b>${s.chapitres ? `${unite(s)} ${s.de === s.a || s.a == null ? s.de : `${s.de} → ${s.a}`}` : ''}</span>
                </a>`).join('')}${lu.length > 6 ? `<span class="jr-lu-plus">+${lu.length - 6}</span>` : ''}</div>` : '';
            return `<section class="jr-day">
                <h2 class="jr-day-title">${titreJour(j)}</h2>
                ${ligneLu}
                ${ns.map(renderNote).join('')}
            </section>`;
        }).join('');
    }

    // ── Écrire une entrée (ou la modifier) ──────────────────
    let favorisCache = null;
    async function ouvrirEditeur(existante = null) {
        if (!favorisCache) {
            try {
                const [favs, prog] = await Promise.all([API.me.favorites(), API.me.progress().catch(() => ({}))]);
                favorisCache = favs.map(f => ({ ...f, lu: prog[f.mangaId]?.updatedAt || 0, ch: prog[f.mangaId]?.chapter ?? null }))
                    .sort((a, b) => new Date(b.lu || 0) - new Date(a.lu || 0));
            } catch (e) { favorisCache = []; }
        }
        const MOODS = window.NotesUI?.MOODS || [];
        const corps = document.createElement('form');
        corps.className = 'jr-editeur';
        const e = existante || {};
        corps.innerHTML = `
            ${existante ? `<div class="jr-ed-serie-fixe">${MH.esc(e.mangaTitle || '')}</div>` : `
            <label class="jr-ed-l">Série
                <input list="jrSeries" id="jrEdSerie" placeholder="Commence à taper un titre…" autocomplete="off" required>
                <datalist id="jrSeries">${favorisCache.slice(0, 400).map(f => `<option value="${MH.esc(f.title || f.mangaId)}"></option>`).join('')}</datalist>
            </label>
            <label class="jr-ed-l jr-ed-court">Chapitre <input id="jrEdChap" inputmode="decimal" placeholder="optionnel"></label>`}
            <div class="jr-ed-l">Type
                <div class="jr-ed-seg" role="radiogroup">${Object.entries(KINDS).map(([k, l]) =>
                    `<label><input type="radio" name="kind" value="${k}" ${(e.kind || 'note') === k ? 'checked' : ''}> ${l}</label>`).join('')}</div>
            </div>
            <div class="jr-ed-l">Humeur
                <div class="jr-ed-moods">${MOODS.map(([id, l, c]) =>
                    `<label style="--h:${c}"><input type="radio" name="mood" value="${id}" ${e.mood === id ? 'checked' : ''}> ${l}</label>`).join('')}
                    <label><input type="radio" name="mood" value="" ${!e.mood ? 'checked' : ''}> Aucune</label></div>
            </div>
            <label class="jr-ed-l">Texte
                <textarea id="jrEdTexte" rows="7" maxlength="5000" placeholder="Ce que tu as ressenti, une réplique qui t'a marqué, une théorie… Les #tags sont cliquables dans le journal." required>${MH.esc(e.body || '')}</textarea>
            </label>`;
        // Pré-remplit le chapitre en cours quand on choisit une série.
        corps.querySelector('#jrEdSerie')?.addEventListener('change', (ev) => {
            const f = favorisCache.find(x => (x.title || x.mangaId) === ev.target.value);
            const ch = corps.querySelector('#jrEdChap');
            if (f && ch && !ch.value && f.ch != null) ch.value = f.ch;
        });
        const enregistrer = async ({ fermer }) => {
            const texte = corps.querySelector('#jrEdTexte').value.trim();
            if (!texte) { MH.toast?.('Écris quelque chose'); return; }
            const kind = corps.querySelector('input[name="kind"]:checked')?.value || 'note';
            const mood = corps.querySelector('input[name="mood"]:checked')?.value || null;
            try {
                if (existante) {
                    const r = await API.me.updateNote(existante.id, { body: texte, mood, kind });
                    Object.assign(existante, r.note || { body: texte, mood, kind });
                } else {
                    const nom = corps.querySelector('#jrEdSerie').value.trim();
                    const f = favorisCache.find(x => (x.title || x.mangaId) === nom);
                    if (!f) { MH.toast?.('Choisis une série de ta bibliothèque dans la liste'); return; }
                    const ch = corps.querySelector('#jrEdChap').value.trim().replace(',', '.');
                    const r = await API.me.addNote({ mangaId: f.mangaId, source: f.source, mangaTitle: f.title, cover: f.cover,
                        chapterNum: ch && !Number.isNaN(Number(ch)) ? Number(ch) : null, body: texte, mood, kind });
                    if (r.note) allNotes.unshift(r.note);
                    notesTotal++;
                }
                fermer();
                await loadStats();
                render(requete());
                MH.toast?.(existante ? 'Entrée mise à jour' : 'Ajouté au journal');
            } catch (err) { MH.toastErreur?.(err); }
        };
        MH.feuille({ titre: existante ? 'Modifier l’entrée' : 'Nouvelle entrée', hauteur: 'edition', contenu: corps,
            actions: [{ libelle: existante ? 'Enregistrer' : 'Ajouter au journal', principal: true, onClick: enregistrer }] });
        setTimeout(() => (corps.querySelector('#jrEdSerie') || corps.querySelector('#jrEdTexte'))?.focus(), 80);
    }

    function brancherJournal() {
        document.getElementById('jrNew')?.addEventListener('click', () => ouvrirEditeur());
        const vues = document.querySelectorAll('.jr-vue');
        const peindre = () => vues.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.vue === vue)));
        peindre();
        vues.forEach(b => b.addEventListener('click', () => {
            vue = b.dataset.vue;
            try { window.Storage?.setPref?.('journal_vue', vue); } catch (e) { /* stockage indisponible */ }
            peindre(); render(requete());
        }));
    }

    async function removeNote(id) {
        if (!await MH.confirm('Supprimer cette note ?', { danger: true, okText: 'Supprimer' })) return;
        try {
            await API.me.removeNote(id);
            allNotes = allNotes.filter(x => String(x.id) !== String(id));
            await loadStats();
            render((document.getElementById('jrSearch').value || '').trim().toLowerCase());
            MH.toast?.('Note supprimée');
        } catch (e) { MH.toast?.('Erreur : ' + e.message); }
    }
})();
