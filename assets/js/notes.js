// notes.js — Journal de lecture : consultation de toutes les notes personnelles
(function () {
    'use strict';

    const MOOD_EMOJI = { love: '❤️', wow: '😮', laugh: '😂', cry: '😢', angry: '😠', fear: '😱', think: '🤔', meh: '😐' };
    let allNotes = [];
    let searchTimer = null;

    document.addEventListener('DOMContentLoaded', async () => {
        MH.initPage('notes');
        if (!API.isLoggedIn()) { showLoggedOut(); return; }
        await MH.loadSourceTypes?.();
        await loadStats();
        await loadNotes();
        document.getElementById('jrSearch').addEventListener('input', (e) => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => render(e.target.value.trim().toLowerCase()), 200);
        });
    });

    function showLoggedOut() {
        document.getElementById('jrBody').innerHTML = `
            <div class="jr-empty">
                <div class="ico">📔</div>
                <div style="font-size:16px;color:var(--text);font-weight:600;margin-bottom:6px">Connexion requise</div>
                <div style="margin-bottom:18px">Connecte-toi pour retrouver ton journal de lecture.</div>
                <a href="page_login.html" class="btn btn-primary">Se connecter</a>
            </div>`;
    }

    async function loadStats() {
        try {
            const s = await API.me.notesStats();
            const topMood = Object.entries(s.moods || {}).sort((a, b) => b[1] - a[1])[0];
            document.getElementById('jrStats').innerHTML = `
                <div class="jr-stat"><b>${s.total}</b><span>note${s.total > 1 ? 's' : ''}</span></div>
                <div class="jr-stat"><b>${s.series}</b><span>série${s.series > 1 ? 's' : ''} annotée${s.series > 1 ? 's' : ''}</span></div>
                ${topMood ? `<div class="jr-stat"><b>${MOOD_EMOJI[topMood[0]] || ''}</b><span>humeur dominante</span></div>` : ''}`;
        } catch (e) {}
    }

    async function loadNotes() {
        try { allNotes = (await API.me.notes()).notes || []; }
        catch (e) { document.getElementById('jrBody').innerHTML = `<div class="jr-empty" style="color:#a83232">Erreur : ${MH.esc(e.message)}</div>`; return; }
        render('');
    }

    function render(q) {
        const body = document.getElementById('jrBody');
        let notes = allNotes;
        if (q) notes = notes.filter(n => (n.body || '').toLowerCase().includes(q) || (n.mangaTitle || '').toLowerCase().includes(q));
        if (!notes.length) {
            body.innerHTML = q
                ? `<div class="jr-empty">Aucune note ne correspond à « ${MH.esc(q)} ».</div>`
                : `<div class="jr-empty"><div class="ico">✍️</div>
                    <div style="font-size:15px;color:var(--text);font-weight:600;margin-bottom:6px">Ton journal est vide</div>
                    <div style="margin-bottom:16px">Pendant que tu lis un chapitre, appuie sur l'icône ✎ (ou la touche J) pour noter ce que tu ressens.</div>
                    <a href="catalogue.html" class="btn btn-primary btn-sm">Commencer à lire →</a></div>`;
            return;
        }
        // Regroupe par série, en conservant l'ordre chronologique (récent d'abord)
        const groups = new Map();
        notes.forEach(n => {
            if (!groups.has(n.mangaId)) groups.set(n.mangaId, { manga: n, notes: [] });
            groups.get(n.mangaId).notes.push(n);
        });
        body.innerHTML = [...groups.values()].map(renderGroup).join('');

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
                    <img src="${m.cover || MH.placeholderCover(m.mangaId)}" alt="" loading="lazy" onerror="this.src='${MH.placeholderCover(m.mangaId)}'">
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
                ${n.mood ? `<span class="jr-note-mood">${MOOD_EMOJI[n.mood] || ''}</span>` : ''}
                ${loc ? `<a class="jr-note-loc" href="${read}">${MH.esc(loc)}</a>` : ''}
                <span class="jr-note-date">${MH.esc(when)}</span>
                <span class="jr-note-tools">
                    <button class="jr-note-tool" data-edit="${n.id}" title="Modifier">✎</button>
                    <button class="jr-note-tool" data-del="${n.id}" title="Supprimer">🗑</button>
                </span>
            </div>
            <div class="jr-note-body" data-body="${n.id}">${MH.esc(n.body)}</div>
        </article>`;
    }

    async function editNote(id) {
        const n = allNotes.find(x => String(x.id) === String(id));
        if (!n) return;
        const next = prompt('Modifier la note :', n.body);
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
        if (!confirm('Supprimer cette note ?')) return;
        try {
            await API.me.removeNote(id);
            allNotes = allNotes.filter(x => String(x.id) !== String(id));
            await loadStats();
            render((document.getElementById('jrSearch').value || '').trim().toLowerCase());
            MH.toast?.('Note supprimée');
        } catch (e) { MH.toast?.('Erreur : ' + e.message); }
    }
})();
