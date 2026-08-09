// notes.js — Journal de lecture : consultation de toutes les notes personnelles
(function () {
    'use strict';

    const MOOD_LABEL = { love: 'Coup de cœur', wow: 'Waouh', laugh: 'Drôle', cry: 'Émouvant', angry: 'Rageant', fear: 'Stressant', think: 'Réflexion', meh: 'Mitigé' };
    const MOOD_COLOR = { love: '#a83232', wow: '#c1531b', laugh: '#b5761b', cry: '#3d5170', angry: '#8a3a2a', fear: '#5a4a6a', think: '#3f7d4e', meh: '#6d685b' };
    let allNotes = [];
    let searchTimer = null;

    document.addEventListener('DOMContentLoaded', async () => {
        MH.initPage('notes');
        await (window.API?.ready || Promise.resolve());   // session locale auto
        if (!API.isLoggedIn()) { showLoggedOut(); return; }
        await MH.loadSourceTypes?.();
        await loadStats();
        await loadNotes();
        document.getElementById('jrExportMd')?.addEventListener('click', exporterMarkdown);
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
        el.innerHTML = `<div class="jr-moods-title">Humeurs au fil du temps</div>
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
        catch (e) { document.getElementById('jrBody').innerHTML = `<div class="jr-empty" style="color:#a83232">Erreur : ${MH.esc(e.message)}</div>`; return; }
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

    function render(q) {
        const body = document.getElementById('jrBody');
        let notes = allNotes;
        if (q) notes = notes.filter(n => (n.body || '').toLowerCase().includes(q) || (n.mangaTitle || '').toLowerCase().includes(q));
        if (!notes.length) {
            body.innerHTML = q
                ? `<div class="jr-empty">Aucune note ne correspond à « ${MH.esc(q)} ».</div>`
                : `<div class="jr-empty">
                    <div style="font-size:15px;color:var(--text);font-weight:600;margin-bottom:6px">Ton journal est vide</div>
                    <div style="margin-bottom:16px">Pendant que tu lis un chapitre, ouvre le bouton Notes (ou la touche J) pour noter ce que tu ressens.</div>
                    <a href="catalogue.html" class="btn btn-primary btn-sm">Commencer à lire →</a></div>`;
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
        body.innerHTML = [...groups.values()].map(renderGroup).join('');
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
                    <div class="jr-group-title"><a href="${serieHref}">${MH.esc(m.mangaTitle || m.mangaId)}</a></div>
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
        <article class="jr-note" data-id="${n.id}">
            <div class="jr-note-head">
                ${n.mood ? `<span class="jr-note-mood" style="color:${MOOD_COLOR[n.mood] || 'var(--accent)'}">${MOOD_LABEL[n.mood] || ''}</span>` : ''}
                ${loc ? `<a class="jr-note-loc" href="${read}">${MH.esc(loc)}</a>` : ''}
                <span class="jr-note-date">${MH.esc(when)}</span>
                <span class="jr-note-tools">
                    <button class="jr-note-tool" data-edit="${n.id}" title="Modifier" aria-label="Modifier"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>
                    <button class="jr-note-tool" data-del="${n.id}" title="Supprimer" aria-label="Supprimer"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
                </span>
            </div>
            <div class="jr-note-body" data-body="${n.id}">${MH.esc(n.body)}</div>
        </article>`;
    }

    async function editNote(id) {
        const n = allNotes.find(x => String(x.id) === String(id));
        if (!n) return;
        const next = await MH.prompt('Modifier la note', { value: n.body, okText: 'Enregistrer' });
        if (next == null || !next.trim() || next.trim() === n.body) return;
        try {
            await API.me.updateNote(id, { body: next.trim(), mood: n.mood });
            n.body = next.trim();
            const el = document.querySelector(`.jr-note-body[data-body="${id}"]`);
            if (el) el.textContent = n.body;
            MH.toast?.('Note mise à jour');
        } catch (e) { MH.toast?.('Erreur : ' + e.message); }
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
