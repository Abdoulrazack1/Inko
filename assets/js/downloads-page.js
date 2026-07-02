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
            if (!confirm('Supprimer TOUS les chapitres téléchargés ?')) return;
            const all = await window.Downloads.list();
            await Promise.all(all.map(c => window.Downloads.remove(c.chapterId)));
            MH.toast?.('Téléchargements supprimés');
            render();
        });
        render();
    });

    function fmtSize(n) {
        n = +n || 0;
        if (n < 1024) return n + ' o';
        if (n < 1048576) return (n / 1024).toFixed(0) + ' Ko';
        if (n < 1073741824) return (n / 1048576).toFixed(1) + ' Mo';
        return (n / 1073741824).toFixed(2) + ' Go';
    }

    async function render() {
        const body = document.getElementById('dlBody');
        const groups = await window.Downloads.byManga();
        const total = await window.Downloads.count();
        document.getElementById('dlClearAll').style.display = total ? '' : 'none';

        // Estimation de l'espace (quota navigateur)
        try {
            const st = await window.Downloads.storage();
            if (st && st.quota) {
                const bar = document.getElementById('dlBar');
                bar.style.display = '';
                bar.firstElementChild.style.width = Math.min(100, (st.usage / st.quota) * 100) + '%';
                document.getElementById('dlStorage').textContent =
                    `${total} chapitre(s) · ${fmtSize(st.usage)} utilisés sur ${fmtSize(st.quota)} disponibles sur cet appareil.`;
            } else {
                document.getElementById('dlStorage').textContent = `${total} chapitre(s) disponibles hors-ligne.`;
            }
        } catch (e) {}

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
                    <img class="dl-gcover" src="${MH.esc(cover)}" alt="" onerror="this.style.visibility='hidden'">
                    <div class="dl-gtitle">${MH.esc(g.mangaTitle || g.mangaId)}
                        <div class="dl-gcount">${chaps.length} chapitre(s)</div>
                    </div>
                    <button class="btn btn-sm" data-delmanga="${MH.esc(g.mangaId)}" style="color:#ef4444">Supprimer la série</button>
                </div>
                ${chaps.map(c => `
                    <div class="dl-chap">
                        <span class="tag">${c.kind === 'novel' ? 'texte' : 'manga'}</span>
                        <a class="grow" href="${MH.readerHref(c.mangaId, c.chapterId, c.source)}" style="text-decoration:none;color:inherit">
                            ${MH.esc(c.chapterTitle || ('Chapitre ' + c.chapterNum))}
                        </a>
                        <button class="btn btn-sm" data-delchap="${MH.esc(c.chapterId)}">✕</button>
                    </div>`).join('')}
            </div>`;
        }).join('');

        body.querySelectorAll('[data-delmanga]').forEach(b => b.addEventListener('click', async () => {
            if (!confirm('Supprimer tous les chapitres de cette série ?')) return;
            await window.Downloads.removeManga(b.dataset.delmanga);
            MH.toast?.('Série supprimée des téléchargements'); render();
        }));
        body.querySelectorAll('[data-delchap]').forEach(b => b.addEventListener('click', async () => {
            await window.Downloads.remove(b.dataset.delchap);
            MH.toast?.('Chapitre supprimé'); render();
        }));
    }
})();
