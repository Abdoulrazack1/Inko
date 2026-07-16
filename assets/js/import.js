// import.js — Import de fichiers locaux (EPUB / CBZ / CBR)
(function () {
    'use strict';

    const TYPE_ICON = { epub: 'book', cbz: 'layers', cbr: 'layers', pdf: 'fileText' };

    document.addEventListener('DOMContentLoaded', async () => {
        MH.initPage('bibliotheque');
        const body = document.getElementById('imBody');
        await (window.API?.ready || Promise.resolve());
        if (!API.isLoggedIn()) {
            body.innerHTML = `<div class="im-empty">
                <div style="font-size:15px;color:var(--text);font-weight:600;margin-bottom:8px">Serveur injoignable</div>
                <div style="margin-bottom:16px">Impossible de joindre le serveur Inko.</div>
                <button class="btn btn-primary" onclick="location.reload()">Réessayer</button></div>`;
            return;
        }
        body.innerHTML = `
            <div class="im-drop" id="imDrop">
                <div class="ic" style="color:var(--accent)">${MH.icon('upload', 34)}</div>
                <div style="font-size:15px;color:var(--text);font-weight:600">Glisse un fichier ici, ou clique pour choisir</div>
                <div class="hint">EPUB · PDF · CBZ — jusqu'à 300 Mo (CBR non supporté : convertis-le en CBZ)</div>
                <input type="file" id="imFile" accept=".epub,.pdf,.cbz,.zip" multiple hidden>
            </div>
            <div class="im-bar" id="imBar"><div></div></div>
            <div class="im-list" id="imList"></div>`;

        const drop = document.getElementById('imDrop');
        const input = document.getElementById('imFile');
        drop.addEventListener('click', () => input.click());
        input.addEventListener('change', () => handleFiles(input.files));
        ['dragover', 'dragenter'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('drag'); }));
        ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('drag'); }));
        drop.addEventListener('drop', e => handleFiles(e.dataTransfer.files));

        loadList();
    });

    async function handleFiles(files) {
        const bar = document.getElementById('imBar');
        const fill = bar.firstElementChild;
        for (const file of files) {
            // CBR (RAR) : refus clair AU CHOIX du fichier, pas à la lecture (audit N9)
            if (/\.cbr$/i.test(file.name)) {
                MH.toast?.(`« ${file.name} » est un CBR (archive RAR), non lisible par le lecteur intégré. Convertis-le en CBZ (ZIP).`);
                continue;
            }
            bar.style.display = 'block'; fill.style.width = '0';
            try {
                await API.local.upload(file, '', (p) => { fill.style.width = Math.round(p * 100) + '%'; });
                MH.toast?.(`« ${file.name} » importé`);
            } catch (e) { MH.toast?.('Erreur : ' + e.message); }
        }
        bar.style.display = 'none';
        loadList();
    }

    async function loadList() {
        const list = document.getElementById('imList');
        list.innerHTML = `<div class="im-empty"><div class="spinner-inline"></div></div>`;
        let items = [];
        try { items = await API.local.list(); } catch (e) {}
        if (!items.length) {
            list.innerHTML = `<div class="im-empty">Aucun fichier importé pour l'instant.</div>`;
            return;
        }
        list.innerHTML = items.map(it => `
            <div class="im-item" data-id="${it.id}">
                <div class="im-cover" style="color:var(--accent)">${MH.icon(TYPE_ICON[it.type] || 'fileText', 26)}</div>
                <div class="im-meta">
                    <div class="im-title">${MH.esc(it.title)}</div>
                    <div class="im-sub"><span class="tag">${it.type}</span> · ${fmtSize(it.size)} · importé le ${new Date(it.createdAt).toLocaleDateString('fr-FR')}</div>
                </div>
                <a class="btn btn-primary btn-sm" href="localreader.html?id=${it.id}&type=${it.type}">Lire</a>
                <button class="btn btn-sm" data-del="${it.id}" style="color:#ef4444">Supprimer</button>
            </div>`).join('');
        list.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => {
            if (!await MH.confirm('Supprimer ce fichier importé ?', { danger: true, okText: 'Supprimer' })) return;
            try { await API.local.remove(b.dataset.del); MH.toast?.('Supprimé'); loadList(); }
            catch (e) { MH.toast?.('Erreur : ' + e.message); }
        }));
    }

    function fmtSize(n) {
        n = +n || 0;
        if (n < 1024) return n + ' o';
        if (n < 1048576) return (n / 1024).toFixed(0) + ' Ko';
        return (n / 1048576).toFixed(1) + ' Mo';
    }
})();
