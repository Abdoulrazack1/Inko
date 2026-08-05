// import.js — Import de fichiers locaux (EPUB / PDF / CBZ)
(function () {
    'use strict';

    const TYPE_ICON = { epub: 'book', cbz: 'layers', cbr: 'layers', pdf: 'fileText' };

    document.addEventListener('DOMContentLoaded', async () => {
        MH.initPage('bibliotheque');
        const body = document.getElementById('imBody');
        await (window.API?.ready || Promise.resolve());
        if (!API.isLoggedIn()) {
            // Audit N1 : message honnête (non connecté ≠ serveur en panne)
            body.innerHTML = `<div class="im-empty">${MH.guestNotice()}</div>`;
            return;
        }
        body.innerHTML = `
            <div class="im-drop" id="imDrop">
                <div class="ic" style="color:var(--accent)">${MH.icon('upload', 34)}</div>
                <div style="font-size:15px;color:var(--text);font-weight:600">Glisse un fichier ici, ou clique pour choisir</div>
                <div class="hint">EPUB · PDF · CBZ — jusqu'à 300 Mo (CBR non supporté : convertis-le en CBZ)</div>
                <input type="file" id="imFile" accept=".epub,.pdf,.cbz,.zip" multiple hidden>
            </div>
            <!-- Audit AMEL-105 : le quota n'était connu qu'au moment du REFUS,
                 après le téléversement complet d'un fichier pouvant peser
                 300 Mo. Il est désormais affiché avant. -->
            <div class="im-quota" id="imQuota" hidden>
                <div class="im-quota-head">
                    <span id="imQuotaTxt"></span>
                    <span id="imQuotaPct" class="im-quota-pct"></span>
                </div>
                <div class="im-quota-bar"><div id="imQuotaFill"></div></div>
            </div>
            <!-- Audit AMEL-103 : file d'attente, un état par fichier -->
            <div class="im-queue" id="imQueue" hidden></div>
            <div class="im-list" id="imList"></div>`;

        const drop = document.getElementById('imDrop');
        const input = document.getElementById('imFile');
        drop.addEventListener('click', () => input.click());
        input.addEventListener('change', () => { handleFiles(input.files); input.value = ''; });
        ['dragover', 'dragenter'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('drag'); }));
        ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('drag'); }));
        drop.addEventListener('drop', e => handleFiles(e.dataTransfer.files));

        loadList();
    });

    // ── Quota (audit AMEL-105) ───────────────────────────────
    let quota = null;

    function renderQuota() {
        const box = document.getElementById('imQuota');
        if (!box || !quota) return;
        box.hidden = false;
        const pct = quota.total ? Math.min(100, Math.round((quota.utilise / quota.total) * 100)) : 0;
        document.getElementById('imQuotaTxt').textContent =
            `${fmtSize(quota.utilise)} utilisés sur ${fmtSize(quota.total)}`;
        document.getElementById('imQuotaPct').textContent = pct + ' %';
        const fill = document.getElementById('imQuotaFill');
        fill.style.width = pct + '%';
        // Au-delà de 85 %, l'information devient un avertissement : c'est là
        // qu'un import de 300 Mo risque d'être refusé après coup.
        box.classList.toggle('im-quota-warn', pct >= 85);
    }

    function placeRestante() {
        return quota ? Math.max(0, quota.total - quota.utilise) : Infinity;
    }

    // ── File d'attente d'import (audit AMEL-103) ─────────────
    // `multiple` était activé mais l'interface n'affichait qu'une barre unique,
    // sans dire quel fichier était en cours ni ce qui restait. Sur un lot de
    // vingt tomes, on ne savait ni où on en était, ni lequel avait échoué.
    function renderQueue(entrees) {
        const q = document.getElementById('imQueue');
        if (!q) return;
        q.hidden = entrees.length === 0;
        q.innerHTML = entrees.map(e => `
            <div class="im-q-item ${e.etat}">
                <div class="im-q-name" title="${MH.esc(e.nom)}">${MH.esc(e.nom)}</div>
                <div class="im-q-state">${MH.esc(e.message)}</div>
                <div class="im-q-bar"><div style="width:${Math.round(e.pct * 100)}%"></div></div>
            </div>`).join('');
    }

    async function handleFiles(files) {
        const entrees = [...files].map(f => ({
            fichier: f, nom: f.name, pct: 0, etat: 'attente', message: 'En attente',
        }));
        if (!entrees.length) return;

        // Refus AVANT téléversement quand c'est déjà décidable : inutile
        // d'envoyer 300 Mo pour se voir refuser à l'arrivée.
        let prevu = 0;
        for (const e of entrees) {
            if (/\.cbr$/i.test(e.nom)) {
                e.etat = 'echec';
                e.message = 'CBR (archive RAR) non lisible — convertis-le en CBZ';
                continue;
            }
            if (e.fichier.size > (quota?.maxFichier || Infinity)) {
                e.etat = 'echec';
                e.message = `Trop volumineux (${fmtSize(e.fichier.size)} > ${fmtSize(quota.maxFichier)})`;
                continue;
            }
            if (prevu + e.fichier.size > placeRestante()) {
                e.etat = 'echec';
                e.message = `Quota insuffisant — ${fmtSize(placeRestante() - prevu)} restants`;
                continue;
            }
            prevu += e.fichier.size;
        }
        renderQueue(entrees);

        for (const e of entrees) {
            if (e.etat === 'echec') continue;
            e.etat = 'encours'; e.message = 'Import…'; renderQueue(entrees);
            try {
                await API.local.upload(e.fichier, '', (p) => {
                    e.pct = p;
                    e.message = `Import… ${Math.round(p * 100)} %`;
                    renderQueue(entrees);
                });
                e.etat = 'ok'; e.pct = 1; e.message = 'Importé';
                if (quota) { quota.utilise += e.fichier.size; renderQuota(); }
            } catch (err) {
                e.etat = 'echec';
                e.message = err.message || 'Échec';
            }
            renderQueue(entrees);
        }

        const ok = entrees.filter(e => e.etat === 'ok').length;
        const ko = entrees.filter(e => e.etat === 'echec').length;
        MH.toast?.(ko ? `${ok} importé(s), ${ko} en échec` : `${ok} fichier(s) importé(s)`);
        loadList();
    }

    // ── Regroupement en séries (audit AMEL-104) ──────────────
    // Chaque fichier devenait une entrée isolée : importer 18 tomes donnait
    // 18 lignes sans lien entre elles. Les noms de fichiers portent pourtant
    // l'information — « Berserk - Tome 03 », « Naruto Vol. 12 », « One Piece T5 ».
    //
    // On regroupe à l'AFFICHAGE seulement : le stockage reste un fichier = une
    // entrée. Un mauvais regroupement n'abîme donc rien, il se corrige en
    // rechargeant la page — au lieu de fusionner des données qu'on ne saurait
    // plus séparer.
    const RE_TOME = /[\s._-]*(?:tome|tomes|vol\.?|volume|t|v|#)\s*0*(\d{1,4})\s*$/i;

    function cleSerie(titre) {
        const base = String(titre || '').replace(/\.[a-z0-9]{2,4}$/i, '').trim();
        const m = base.match(RE_TOME);
        if (!m) return null;
        const nom = base.slice(0, m.index).replace(/[\s._-]+$/, '').trim();
        // Un « nom de série » d'un seul caractère vient presque toujours d'une
        // fausse détection (« 1 - 2 »). On préfère ne pas regrouper.
        if (nom.length < 2) return null;
        return { nom, tome: parseInt(m[1], 10) };
    }

    function grouper(items) {
        const series = new Map();
        const seuls = [];
        for (const it of items) {
            const c = cleSerie(it.title);
            if (!c) { seuls.push(it); continue; }
            const k = c.nom.toLowerCase();
            if (!series.has(k)) series.set(k, { nom: c.nom, tomes: [] });
            series.get(k).tomes.push({ ...it, tome: c.tome });
        }
        // Un seul tome ne fait pas une série : on le laisse en entrée simple,
        // sinon on créerait un groupe pliable pour un unique fichier.
        for (const [k, s] of [...series]) {
            if (s.tomes.length < 2) { seuls.push(...s.tomes); series.delete(k); }
            else s.tomes.sort((a, b) => a.tome - b.tome);
        }
        return { series: [...series.values()], seuls };
    }

    function itemHTML(it, compact) {
        return `
            <div class="im-item ${compact ? 'im-item-sub' : ''}" data-id="${it.id}">
                <div class="im-cover" style="color:var(--accent)">${MH.icon(TYPE_ICON[it.type] || 'fileText', compact ? 20 : 26)}</div>
                <div class="im-meta">
                    <div class="im-title">${MH.esc(compact && it.tome != null ? `Tome ${it.tome}` : it.title)}</div>
                    <div class="im-sub"><span class="tag">${MH.esc(it.type)}</span> · ${fmtSize(it.size)} · importé le ${new Date(it.createdAt).toLocaleDateString('fr-FR')}</div>
                </div>
                <a class="btn btn-primary btn-sm" href="localreader.html?id=${it.id}&type=${MH.esc(it.type)}">Lire</a>
                <button class="btn btn-sm" data-del="${it.id}" style="color:var(--red-text)">Supprimer</button>
            </div>`;
    }

    async function loadList() {
        const list = document.getElementById('imList');
        list.innerHTML = `<div class="im-empty"><div class="spinner-inline"></div></div>`;
        let items = [];
        try {
            const r = await API.local.list();
            // La réponse porte désormais { items, quota } (audit AMEL-105).
            // On accepte encore le tableau nu : un client ouvert avant une mise
            // à jour du serveur ne doit pas se retrouver avec une page vide.
            items = Array.isArray(r) ? r : (r.items || []);
            quota = Array.isArray(r) ? null : (r.quota || null);
        } catch (e) { window.MH?.err?.('import.js', e); }
        renderQuota();

        if (!items.length) {
            list.innerHTML = `<div class="im-empty">Aucun fichier importé pour l'instant.</div>`;
            return;
        }

        const { series, seuls } = grouper(items);
        list.innerHTML =
            series.map(s => `
                <details class="im-serie" open>
                    <summary class="im-serie-head">
                        <span class="im-serie-nom">${MH.esc(s.nom)}</span>
                        <span class="im-serie-count">${s.tomes.length} tomes</span>
                    </summary>
                    ${s.tomes.map(t => itemHTML(t, true)).join('')}
                </details>`).join('')
            + seuls.map(it => itemHTML(it, false)).join('');

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
        if (n < 1073741824) return (n / 1048576).toFixed(1) + ' Mo';
        return (n / 1073741824).toFixed(2) + ' Go';
    }
})();
