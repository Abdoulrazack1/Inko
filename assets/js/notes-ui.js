// ============================================================
// notes-ui.js — Composeur de notes de lecture (journal)
// ------------------------------------------------------------
// Panneau réutilisable ouvert depuis les lecteurs (manga & roman).
// Capture le contexte (série / chapitre / page), liste les notes du
// chapitre courant, permet d'ajouter / éditer / supprimer.
// Expose window.NotesUI.
// ============================================================
(function () {
    'use strict';

    const MOODS = [
        ['love', '❤️', 'Coup de cœur'],
        ['wow', '😮', 'Waouh'],
        ['laugh', '😂', 'Drôle'],
        ['cry', '😢', 'Émouvant'],
        ['angry', '😠', 'Rageant'],
        ['fear', '😱', 'Stressant'],
        ['think', '🤔', 'Réflexion'],
        ['meh', '😐', 'Mitigé'],
    ];
    const moodEmoji = (m) => (MOODS.find(x => x[0] === m) || [])[1] || '';

    const esc = (s) => window.MH?.esc ? MH.esc(s) : String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

    let root = null, ctx = null, editingId = null, selectedMood = null;

    function ensureRoot() {
        if (root) return root;
        root = document.createElement('div');
        root.className = 'notes-ui';
        root.innerHTML = `
            <div class="notes-backdrop" data-close></div>
            <aside class="notes-panel" role="dialog" aria-label="Notes de lecture">
                <header class="notes-head">
                    <div>
                        <div class="notes-title">Notes de lecture</div>
                        <div class="notes-ctx" id="notesCtx"></div>
                    </div>
                    <button class="notes-x" data-close aria-label="Fermer">✕</button>
                </header>
                <div class="notes-list" id="notesList"></div>
                <form class="notes-composer" id="notesComposer">
                    <div class="notes-moods" id="notesMoods">
                        ${MOODS.map(m => `<button type="button" class="notes-mood" data-mood="${m[0]}" title="${m[2]}">${m[1]}</button>`).join('')}
                    </div>
                    <textarea id="notesText" class="notes-text" rows="3" maxlength="5000" placeholder="Qu'est-ce que tu ressens à cet instant de l'histoire ?"></textarea>
                    <div class="notes-actions">
                        <span class="notes-count" id="notesCharCount"></span>
                        <button type="button" class="btn btn-ghost btn-sm" id="notesCancelEdit" style="display:none">Annuler</button>
                        <button type="submit" class="btn btn-primary btn-sm" id="notesSave">Enregistrer</button>
                    </div>
                </form>
            </aside>`;
        document.body.appendChild(root);

        root.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', close));
        root.querySelector('#notesMoods').addEventListener('click', (e) => {
            const b = e.target.closest('.notes-mood'); if (!b) return;
            const m = b.dataset.mood;
            selectedMood = selectedMood === m ? null : m;
            paintMoods();
        });
        const ta = root.querySelector('#notesText');
        ta.addEventListener('input', () => {
            const n = ta.value.length;
            root.querySelector('#notesCharCount').textContent = n ? `${n}/5000` : '';
        });
        root.querySelector('#notesComposer').addEventListener('submit', onSubmit);
        root.querySelector('#notesCancelEdit').addEventListener('click', resetComposer);
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && root.classList.contains('open')) close(); });
        return root;
    }

    function paintMoods() {
        root.querySelectorAll('.notes-mood').forEach(b => b.classList.toggle('on', b.dataset.mood === selectedMood));
    }

    function ctxLabel() {
        if (!ctx) return '';
        const parts = [];
        if (ctx.mangaTitle) parts.push(ctx.mangaTitle);
        if (ctx.chapterNum != null) {
            const unit = window.MH?.unitLabel ? MH.unitLabel(ctx.source, { short: true }) : 'Chap.';
            parts.push(`${unit} ${ctx.chapterNum}`);
        }
        if (ctx.page != null) parts.push(`page ${ctx.page}`);
        return parts.join(' · ');
    }

    async function loadList() {
        const el = root.querySelector('#notesList');
        el.innerHTML = `<div class="notes-empty"><span class="spinner-inline"></span></div>`;
        let notes = [];
        try { notes = (await API.me.notes({ manga: ctx.mangaId })).notes || []; }
        catch (e) { el.innerHTML = `<div class="notes-empty" style="color:#a83232">Erreur : ${esc(e.message)}</div>`; return; }
        // Notes de CE chapitre en tête, puis le reste de la série
        const here = notes.filter(n => ctx.chapterId && n.chapterId === ctx.chapterId);
        const rest = notes.filter(n => !ctx.chapterId || n.chapterId !== ctx.chapterId);
        if (!notes.length) {
            el.innerHTML = `<div class="notes-empty">Aucune note pour cette série pour l'instant.<br>Écris ta première impression ci-dessous ✍️</div>`;
            return;
        }
        el.innerHTML =
            (here.length ? `<div class="notes-sec">Ce chapitre</div>${here.map(noteCard).join('')}` : '') +
            (rest.length ? `<div class="notes-sec">Ailleurs dans la série</div>${rest.map(noteCard).join('')}` : '');
        el.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => startEdit(notes.find(n => String(n.id) === b.dataset.edit))));
        el.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => removeNote(b.dataset.del)));
    }

    function noteCard(n) {
        const unit = window.MH?.unitLabel ? MH.unitLabel(n.source, { short: true }) : 'Chap.';
        const loc = [n.chapterNum != null ? `${unit} ${n.chapterNum}` : null, n.page != null ? `p.${n.page}` : null].filter(Boolean).join(' · ');
        const when = window.MH?.relTime ? MH.relTime(n.createdAt) : '';
        return `
        <article class="note-item" data-id="${n.id}">
            <div class="note-item-head">
                ${n.mood ? `<span class="note-mood">${moodEmoji(n.mood)}</span>` : ''}
                <span class="note-loc">${esc(loc || 'Série')}</span>
                <span class="note-when">${esc(when)}</span>
                <span class="note-tools">
                    <button class="note-tool" data-edit="${n.id}" title="Modifier">✎</button>
                    <button class="note-tool" data-del="${n.id}" title="Supprimer">🗑</button>
                </span>
            </div>
            <div class="note-body">${esc(n.body).replace(/\n/g, '<br>')}</div>
        </article>`;
    }

    function startEdit(n) {
        if (!n) return;
        editingId = n.id;
        selectedMood = n.mood || null;
        const ta = root.querySelector('#notesText');
        ta.value = n.body; ta.focus();
        root.querySelector('#notesCharCount').textContent = `${n.body.length}/5000`;
        root.querySelector('#notesCancelEdit').style.display = '';
        root.querySelector('#notesSave').textContent = 'Mettre à jour';
        paintMoods();
    }

    function resetComposer() {
        editingId = null; selectedMood = null;
        const ta = root.querySelector('#notesText');
        ta.value = '';
        root.querySelector('#notesCharCount').textContent = '';
        root.querySelector('#notesCancelEdit').style.display = 'none';
        root.querySelector('#notesSave').textContent = 'Enregistrer';
        paintMoods();
    }

    async function onSubmit(e) {
        e.preventDefault();
        const ta = root.querySelector('#notesText');
        const body = ta.value.trim();
        if (!body) { ta.focus(); return; }
        const save = root.querySelector('#notesSave');
        save.disabled = true;
        try {
            if (editingId) {
                await API.me.updateNote(editingId, { body, mood: selectedMood });
                MH.toast?.('Note mise à jour');
            } else {
                await API.me.addNote({
                    mangaId: ctx.mangaId, source: ctx.source, mangaTitle: ctx.mangaTitle, cover: ctx.cover,
                    chapterId: ctx.chapterId, chapterNum: ctx.chapterNum, page: ctx.page,
                    body, mood: selectedMood,
                });
                MH.toast?.('Note enregistrée dans ton journal');
            }
            resetComposer();
            await loadList();
            updateBadge();
        } catch (err) { MH.toast?.('Erreur : ' + err.message); }
        finally { save.disabled = false; }
    }

    async function removeNote(id) {
        if (!confirm('Supprimer cette note ?')) return;
        try { await API.me.removeNote(id); await loadList(); updateBadge(); MH.toast?.('Note supprimée'); }
        catch (e) { MH.toast?.('Erreur : ' + e.message); }
    }

    // Badge (compteur) sur le bouton Notes du lecteur, si présent.
    // Accepte un contexte explicite pour fonctionner sans avoir ouvert le panneau.
    async function updateBadge(context) {
        const btn = document.getElementById('btnNotes');
        const c = context || ctx;
        if (!btn || !c || !window.API?.isLoggedIn?.()) return;
        try {
            const notes = (await API.me.notes({ manga: c.mangaId })).notes || [];
            const n = c.chapterId ? notes.filter(x => x.chapterId === c.chapterId).length : notes.length;
            let dot = btn.querySelector('.notes-dot');
            if (n > 0) {
                if (!dot) { dot = document.createElement('span'); dot.className = 'notes-dot'; btn.appendChild(dot); }
                dot.textContent = n > 9 ? '9+' : n;
            } else if (dot) dot.remove();
        } catch (e) {}
    }

    function open(context) {
        if (!window.API?.isLoggedIn?.()) { window.MH?.toast?.('Connecte-toi pour prendre des notes'); return; }
        ctx = context || {};
        ensureRoot();
        root.querySelector('#notesCtx').textContent = ctxLabel();
        resetComposer();
        root.classList.add('open');
        document.body.classList.add('notes-open');
        loadList();
    }
    function close() {
        if (!root) return;
        root.classList.remove('open');
        document.body.classList.remove('notes-open');
    }

    window.NotesUI = { open, close, updateBadge };
})();
