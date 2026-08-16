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
            if (!await MH.confirm('Supprimer TOUS les chapitres téléchargés ?', { danger: true, okText: 'Tout supprimer' })) return;
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

    // Audit AMEL-78 : « 6 Mo utilises » ne dit pas PAR QUOI. Sans repartition,
    // liberer de la place revient a supprimer au hasard. La mesure lit les
    // reponses en cache : elle est differee apres le rendu, la page ne doit pas
    // attendre pour s'afficher.
    async function mesurerPoids() {
        if (!window.Downloads?.sizeByManga) return;
        let tailles;
        try { tailles = await window.Downloads.sizeByManga(); } catch (e) { return; }
        const total = tailles.reduce((n, t) => n + t.bytes, 0);
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
                        ${incomplete ? `<button class="btn btn-sm" data-retry="${MH.esc(c.chapterId)}" style="color:var(--accent)">Relancer</button>` : ''}
                        <button class="btn btn-sm" data-delchap="${MH.esc(c.chapterId)}">✕</button>
                    </div>`; }).join('')}
            </div>`;
        }).join('');

        body.querySelectorAll('[data-delmanga]').forEach(b => b.addEventListener('click', async () => {
            if (!await MH.confirm('Supprimer tous les chapitres de cette série ?', { danger: true, okText: 'Supprimer' })) return;
            await window.Downloads.removeManga(b.dataset.delmanga);
            MH.toast?.('Série supprimée des téléchargements'); render();
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
    }
})();
