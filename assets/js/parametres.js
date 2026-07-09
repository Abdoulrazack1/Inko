// parametres.js — Page Paramètres
(function () {
    'use strict';

    const toast = (m) => window.MH?.toast(m) || alert(m);

    document.addEventListener('DOMContentLoaded', async () => {
        MH.initPage('parametres');
        await (window.API?.ready || Promise.resolve());
        renderAccount();
        initSegments();
        initAccent();
        bindData();
        bindConnections();
        // Charge les settings serveur si connecté (override le local)
        if (API.isLoggedIn()) {
            try {
                const s = await API.me.settings();
                Object.entries(s).forEach(([k, v]) => window.Storage.setPref(k, v));
                if (s.theme) window.Theme.apply(s.theme);
                initSegments(); // re-sync l'état actif
            } catch (e) {}
        }
    });

    // ── COULEUR D'ACCENT ──
    function initAccent() {
        const el = document.getElementById('accentSwatches');
        if (!el || !window.Theme) return;
        const presets = ['#ff6b1a','#3b82f6','#a855f7','#22c55e','#ec4899','#ef4444','#06b6d4','#f59e0b'];
        const cur = window.Theme.currentAccent();
        el.innerHTML = presets.map(c =>
            `<button class="accent-dot" data-accent="${c}" title="${c}" style="width:26px;height:26px;border-radius:50%;background:${c};border:2px solid ${c.toLowerCase()===cur.toLowerCase()?'var(--text)':'transparent'};cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,.3)"></button>`
        ).join('') +
        `<label title="Couleur personnalisée" style="width:26px;height:26px;border-radius:50%;overflow:hidden;cursor:pointer;border:2px dashed var(--border2);display:inline-flex;align-items:center;justify-content:center;color:var(--text2)"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><circle cx="8.5" cy="10" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="7.5" r="1" fill="currentColor" stroke="none"/><circle cx="15.5" cy="10" r="1" fill="currentColor" stroke="none"/></svg>
            <input type="color" id="accentCustom" value="${cur}" style="opacity:0;width:0;height:0;position:absolute">
        </label>`;
        const choose = (hex) => {
            window.Theme.setAccent(hex);
            savePref('accent', hex);
            initAccent(); // re-render pour la bordure active
        };
        el.querySelectorAll('.accent-dot').forEach(b => b.addEventListener('click', () => choose(b.dataset.accent)));
        el.querySelector('#accentCustom')?.addEventListener('input', (e) => choose(e.target.value));
    }

    // ── Sauvegarde d'une pref (locale + serveur si connecté) ──
    async function savePref(key, val) {
        window.Storage.setPref(key, val);
        if (API.isLoggedIn()) {
            try { await API.me.saveSettings({ [key]: val }); } catch (e) {}
        }
    }

    // ── COMPTE ──
    function renderAccount() {
        const body = document.getElementById('accountBody');
        const dangerCard = document.getElementById('dangerCard');
        const user = API.user;

        if (!user) {
            body.innerHTML = `
                <div style="text-align:center;padding:14px 0">
                    <p style="color:var(--text2);font-size:13px;margin-bottom:14px">
                        Serveur injoignable — impossible de charger ton profil local.
                    </p>
                    <button class="btn btn-primary btn-sm" onclick="location.reload()">Réessayer</button>
                </div>`;
            return;
        }

        // Mode local : plus de mot de passe ni de connexion — juste l'identité
        // du profil (nom affiché sur le profil public et les commentaires).
        if (dangerCard) dangerCard.style.display = 'none';
        body.innerHTML = `
            <div class="set-field">
                <label>Nom d'utilisateur</label>
                <div style="display:flex;gap:8px">
                    <input class="set-input" id="inpUsername" value="${MH.esc(user.username)}">
                    <button class="btn btn-secondary btn-sm" id="btnSaveUsername" style="flex-shrink:0">Enregistrer</button>
                </div>
            </div>`;

        document.getElementById('btnSaveUsername').addEventListener('click', async () => {
            const username = document.getElementById('inpUsername').value.trim();
            if (!username || username.length < 2) { toast('Nom trop court'); return; }
            try {
                await API.auth.updateProfile({ username });
                toast('Profil mis à jour ✓');
                window.dispatchEvent(new CustomEvent('auth:change', { detail: { user: API.user } }));
            } catch (e) { toast('Erreur : ' + e.message); }
        });
    }

    // ── SEGMENTS (lecteur + thème) ──
    function initSegments() {
        const map = [
            { id: 'segDir',     key: 'readingDir',  def: 'rtl' },
            { id: 'segMode',    key: 'readMode',    def: 'page' },
            { id: 'segQuality', key: 'quality',     def: 'high' },
            { id: 'segLang',    key: 'readingLang', def: 'fr,en' },
            { id: 'segTheme',   key: 'theme',       def: 'dark' },
        ];
        map.forEach(({ id, key, def }) => {
            const seg = document.getElementById(id);
            if (!seg) return;
            const cur = window.Storage.getPref(key) || def;
            seg.querySelectorAll('button').forEach(b => {
                b.classList.toggle('active', b.dataset.val === cur);
                b.onclick = async () => {
                    seg.querySelectorAll('button').forEach(x => x.classList.remove('active'));
                    b.classList.add('active');
                    await savePref(key, b.dataset.val);
                    if (key === 'theme') window.Theme.apply(b.dataset.val);
                    toast('Enregistré ✓', 1200);
                };
            });
        });
    }

    // ── DONNÉES ──
    function bindData() {
        document.getElementById('btnExport').addEventListener('click', async () => {
            if (!API.isLoggedIn()) { toast('Connecte-toi pour exporter'); return; }
            try {
                const data = await API.me.exportData();
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = `inko-export-${new Date().toISOString().slice(0,10)}.json`;
                a.click(); URL.revokeObjectURL(url);
                toast('Export téléchargé ✓');
            } catch (e) { toast('Erreur : ' + e.message); }
        });

        // Import d'une sauvegarde JSON
        const importFile = document.getElementById('importFile');
        document.getElementById('btnImport')?.addEventListener('click', () => {
            if (!API.isLoggedIn()) { toast('Connecte-toi pour importer'); return; }
            importFile?.click();
        });
        importFile?.addEventListener('change', async () => {
            const file = importFile.files?.[0];
            if (!file) return;
            try {
                const data = JSON.parse(await file.text());
                if (!data || (!data.favorites && !data.library && !data.progress)) {
                    toast('Fichier invalide'); return;
                }
                const r = await API.me.importData(data);
                const c = r.imported || {};
                toast(`Import : ${c.favorites || 0} favoris, ${c.progress || 0} progressions ✓`, 3500);
            } catch (e) { toast('Erreur : ' + e.message); }
            finally { importFile.value = ''; }
        });

        document.getElementById('btnClearHistory').addEventListener('click', async () => {
            if (!API.isLoggedIn()) { toast('Connecte-toi'); return; }
            if (!confirm('Effacer tout ton historique de lecture ? (favoris conservés)')) return;
            try { await API.me.clearHistory(); toast('Historique effacé ✓'); }
            catch (e) { toast('Erreur : ' + e.message); }
        });

        document.getElementById('btnDeleteAccount')?.addEventListener('click', async () => {
            const password = prompt('Action irréversible.\nEntre ton mot de passe pour confirmer la suppression :');
            if (password === null) return;
            try {
                await API.auth.deleteAccount(password);
                toast('Compte supprimé. À bientôt.');
                setTimeout(() => { window.location.href = 'accueil.html'; }, 1000);
            } catch (e) { toast('Erreur : ' + e.message); }
        });
    }

    // ── COMPTES LIÉS (Spotify + AniList) + Musique ──
    async function bindConnections() {
        // Bouton "Ouvrir le lecteur" de musique
        document.getElementById('btnOpenMusic')?.addEventListener('click', () => {
            if (window.MH?.openMusic) MH.openMusic();
            else window.open('player.html', 'inkoMusic', 'width=420,height=640');
        });

        // Si cette page est la popup d'auth Spotify → se fermer
        const params = new URLSearchParams(location.search);
        const sp = params.get('spotify');
        if (sp) {
            if (window.name === 'inkoSpotifyAuth' && window.opener) { window.close(); return; }
            const msgs = { linked: 'Compte Spotify lié ✓', denied: 'Autorisation Spotify refusée.',
                           error: 'Erreur lors du lien Spotify.', badstate: 'Session expirée, réessaie.' };
            toast(msgs[sp] || 'Spotify : ' + sp);
            history.replaceState({}, '', location.pathname);
        }
        if (params.get('anilist') === 'linked') {
            toast('Compte AniList lié ✓');
            history.replaceState({}, '', location.pathname);
        }

        // Composant unifié + ligne de synchro AniList contextuelle
        const el = document.getElementById('settingsConnections');
        if (el && MH.renderConnections) await MH.renderConnections(el, { onChange: renderAniListSyncRow });
        renderAniListSyncRow();
    }

    // Bouton "Synchroniser ma bibliothèque" visible uniquement si AniList est lié
    function renderAniListSyncRow() {
        const row = document.getElementById('anilistSyncRow');
        if (!row) return;
        if (window.AniList && AniList.isLinked()) {
            row.innerHTML = '';
            const sync = document.createElement('button');
            sync.className = 'btn btn-secondary btn-sm';
            sync.textContent = '↻ Synchroniser ma bibliothèque vers AniList';
            sync.addEventListener('click', () => syncLibraryToAniList(sync));
            row.appendChild(sync);
        } else {
            row.innerHTML = '';
        }
    }

    // Pousse la progression de la bibliothèque vers AniList (best-effort)
    // Synchro complète vers AniList — version robuste.
    // AniList limite à ~30 requêtes/min : on ESPACE les écritures (2,1 s) et on
    // ATTEND Retry-After en cas de 429 au lieu d'échouer en silence (avant, la
    // synchro « se bloquait » vers 8 œuvres : toutes les suivantes étaient des
    // 429 avalés par un catch muet).
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    async function syncLibraryToAniList(btn) {
        if (!API.isLoggedIn()) { toast('Connecte-toi à Inko'); return; }
        btn.disabled = true; const orig = btn.textContent;
        try {
            const [favs, prog] = await Promise.all([API.me.favorites(), API.me.progress()]);
            // Candidats : au moins une info à écrire (progression ou statut)
            const targets = favs.map(f => {
                const p = prog[f.mangaId];
                const opts = {};
                if (p?.chapter) opts.progress = Math.floor(p.chapter);
                if (f.status) opts.status = f.status;
                return (opts.progress || opts.status) ? { f, opts } : null;
            }).filter(Boolean);
            const skipped = favs.length - targets.length;

            let ok = 0, notFound = 0, failed = 0;
            for (let i = 0; i < targets.length; i++) {
                const { f, opts } = targets[i];
                btn.textContent = `Sync… ${i + 1}/${targets.length}`;
                let attempt = 0;
                while (attempt < 2) {
                    attempt++;
                    try {
                        const mid = await AniList.mediaId(f.title);
                        if (!mid) { notFound++; break; }
                        await AniList.syncEntry(mid, opts);
                        ok++; break;
                    } catch (e) {
                        if (e.status === 429 && attempt < 2) {
                            const waitS = Math.min(120, e.retryAfter || 60);
                            btn.textContent = `Limite AniList — pause ${waitS}s…`;
                            await sleep(waitS * 1000);
                        } else { failed++; break; }
                    }
                }
                await sleep(2100);   // ~28 écritures/min, sous la limite AniList
            }
            const bits = [`${ok} synchronisée(s)`];
            if (notFound) bits.push(`${notFound} introuvable(s) sur AniList`);
            if (failed)   bits.push(`${failed} échec(s)`);
            if (skipped)  bits.push(`${skipped} sans progression/statut (ignorées)`);
            toast(bits.join(' · '));
        } catch (e) { toast('Erreur : ' + e.message); }
        finally { btn.disabled = false; btn.textContent = orig; }
    }
})();
