// parametres.js — Page Paramètres
(function () {
    'use strict';

    const toast = (m) => window.MH?.toast(m) || alert(m);

    document.addEventListener('DOMContentLoaded', async () => {
        MH.initPage('parametres');
        renderAccount();
        initSegments();
        initAccent();
        bindData();
        bindConnections();
        bindGoogleConfig();
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
        `<label title="Couleur personnalisée" style="width:26px;height:26px;border-radius:50%;overflow:hidden;cursor:pointer;border:2px dashed var(--border2);display:inline-flex;align-items:center;justify-content:center;font-size:13px">🎨
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

    // ── CONNEXION GOOGLE (config du Client ID dans l'app) ──
    async function bindGoogleConfig() {
        const input = document.getElementById('googleClientId');
        const pill  = document.getElementById('googlePill');
        const hint  = document.getElementById('googleHint');
        const save  = document.getElementById('btnGoogleSave');
        const clear = document.getElementById('btnGoogleClear');
        const origin = document.getElementById('googleOrigin');
        if (!input) return;

        if (!API.isLoggedIn()) {
            hint.textContent = 'Connecte-toi pour configurer la connexion Google.';
            input.disabled = save.disabled = clear.disabled = true;
            return;
        }
        const paint = (cfg) => {
            const on = !!cfg.configured;
            pill.textContent = on ? 'Configurée' : 'Non configurée';
            pill.className = 'pill ' + (on ? 'pill-on' : 'pill-off');
            input.value = cfg.clientId || '';
            if (origin && cfg.origin) origin.textContent = cfg.origin;
            if (cfg.viaEnv) {
                hint.textContent = 'Défini par variable d’environnement (GOOGLE_CLIENT_ID) — modifie le .env pour changer.';
                input.disabled = save.disabled = clear.disabled = true;
            } else {
                hint.textContent = on ? 'Google est actif sur les pages de connexion et d’inscription.' : '';
            }
        };
        try { paint(await API.auth.googleConfig()); } catch (e) { hint.textContent = 'Erreur : ' + e.message; }

        save.addEventListener('click', async () => {
            const v = input.value.trim();
            if (v && !/\.apps\.googleusercontent\.com$/.test(v)) { MH.toast('Client ID invalide (doit finir par .apps.googleusercontent.com)'); return; }
            save.disabled = true;
            try { await API.auth.setGoogleConfig(v); MH.toast('Connexion Google ' + (v ? 'activée' : 'retirée')); paint(await API.auth.googleConfig()); }
            catch (e) { MH.toast('Erreur : ' + e.message); }
            finally { save.disabled = false; }
        });
        clear.addEventListener('click', async () => {
            try { await API.auth.setGoogleConfig(''); MH.toast('Connexion Google retirée'); paint(await API.auth.googleConfig()); }
            catch (e) { MH.toast('Erreur : ' + e.message); }
        });
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
                        Connecte-toi pour synchroniser tes réglages, favoris et progression.
                    </p>
                    <a href="page_login.html" class="btn btn-primary btn-sm">Se connecter</a>
                    <a href="page_signup.html" class="btn btn-ghost btn-sm" style="margin-left:6px">S'inscrire</a>
                </div>`;
            return;
        }

        dangerCard.style.display = '';
        body.innerHTML = `
            <div class="set-field">
                <label>Nom d'utilisateur</label>
                <div style="display:flex;gap:8px">
                    <input class="set-input" id="inpUsername" value="${MH.esc(user.username)}">
                    <button class="btn btn-secondary btn-sm" id="btnSaveUsername" style="flex-shrink:0">Enregistrer</button>
                </div>
            </div>
            <div class="set-field">
                <label>Email</label>
                <input class="set-input" value="${MH.esc(user.email)}" disabled style="opacity:.6">
            </div>

            <div style="border-top:1px solid var(--border);margin:14px 0;padding-top:16px">
                <div class="set-row-label" style="margin-bottom:12px">Changer le mot de passe</div>
                <div class="set-field">
                    <label>Mot de passe actuel</label>
                    <input type="password" class="set-input" id="inpCurPwd" placeholder="••••••••">
                </div>
                <div class="set-field">
                    <label>Nouveau mot de passe</label>
                    <input type="password" class="set-input" id="inpNewPwd" placeholder="6 caractères min">
                </div>
                <button class="btn btn-primary btn-sm" id="btnChangePwd">Mettre à jour</button>
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

        document.getElementById('btnChangePwd').addEventListener('click', async () => {
            const currentPassword = document.getElementById('inpCurPwd').value;
            const newPassword     = document.getElementById('inpNewPwd').value;
            if (!currentPassword || !newPassword) { toast('Remplis les deux champs'); return; }
            try {
                await API.auth.changePassword({ currentPassword, newPassword });
                toast('Mot de passe modifié ✓');
                document.getElementById('inpCurPwd').value = '';
                document.getElementById('inpNewPwd').value = '';
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

    // ── ESPACE +18 ──
    function renderNsfw() {
        const body = document.getElementById('nsfwBody');
        const pill = document.getElementById('nsfwPill');
        const enabled = window.NSFW.isEnabled();

        pill.textContent = enabled ? 'Activé' : 'Désactivé';
        pill.className = 'pill ' + (enabled ? 'pill-on' : 'pill-off');

        if (!enabled) {
            body.innerHTML = `
                <div class="set-field">
                    <label>Définir un code (4 à 8 chiffres)</label>
                    <input type="password" inputmode="numeric" class="set-input" id="nsfwPin" placeholder="••••" maxlength="8">
                </div>
                <button class="btn btn-primary btn-sm" id="btnNsfwEnable" style="background:#ec4899">
                    Activer l'espace +18
                </button>
                <div style="font-size:11px;color:var(--text3);margin-top:10px;line-height:1.5">
                    Une fois activé, une entrée discrète apparaît dans le menu. Le contenu adulte
                    reste totalement masqué tant que tu n'as pas saisi ton code.
                </div>`;
            document.getElementById('btnNsfwEnable').addEventListener('click', async () => {
                const pin = document.getElementById('nsfwPin').value;
                try {
                    await window.NSFW.enable(pin);
                    toast('Espace +18 activé ');
                    renderNsfw();
                    window.dispatchEvent(new CustomEvent('auth:change', { detail: { user: API.user } })); // refresh header
                } catch (e) { toast(e.message); }
            });
        } else {
            body.innerHTML = `
                <div class="set-row" style="border-top:none">
                    <div>
                        <div class="set-row-label">Accéder à l'espace +18</div>
                        <div class="set-row-desc">Ouvre le catalogue adulte (code requis)</div>
                    </div>
                    <a href="secret.html" class="btn btn-sm" style="background:#ec4899;color:#fff">Ouvrir</a>
                </div>
                <div class="set-row">
                    <div>
                        <div class="set-row-label">Changer le code</div>
                    </div>
                    <button class="btn btn-secondary btn-sm" id="btnNsfwChange">Modifier</button>
                </div>
                <div class="set-row">
                    <div>
                        <div class="set-row-label">Désactiver l'espace +18</div>
                        <div class="set-row-desc">Masque à nouveau tout le contenu adulte</div>
                    </div>
                    <button class="btn-danger" id="btnNsfwDisable">Désactiver</button>
                </div>`;

            document.getElementById('btnNsfwChange').addEventListener('click', async () => {
                const oldPin = prompt('Code actuel :');
                if (oldPin === null) return;
                const newPin = prompt('Nouveau code (4 à 8 chiffres) :');
                if (newPin === null) return;
                try { await window.NSFW.changePin(oldPin, newPin); toast('Code modifié ✓'); }
                catch (e) { toast(e.message); }
            });
            document.getElementById('btnNsfwDisable').addEventListener('click', async () => {
                const pin = prompt('Confirme avec ton code pour désactiver :');
                if (pin === null) return;
                try { await window.NSFW.disable(pin); toast('Espace +18 désactivé'); renderNsfw();
                    window.dispatchEvent(new CustomEvent('auth:change', { detail: { user: API.user } }));
                } catch (e) { toast(e.message); }
            });
        }
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
    async function syncLibraryToAniList(btn) {
        if (!API.isLoggedIn()) { toast('Connecte-toi à Inko'); return; }
        btn.disabled = true; const orig = btn.textContent;
        try {
            const [favs, prog] = await Promise.all([API.me.favorites(), API.me.progress()]);
            let ok = 0;
            for (const f of favs) {
                const p = prog[f.mangaId];
                const opts = {};
                if (p?.chapter) opts.progress = Math.floor(p.chapter);
                if (f.status) opts.status = f.status;
                if (!opts.progress && !opts.status) continue;
                btn.textContent = `Sync… ${ok + 1}/${favs.length}`;
                if (await AniList.syncByTitle(f.title, opts)) ok++;
            }
            toast(`${ok} série(s) synchronisée(s) sur AniList`);
        } catch (e) { toast('Erreur : ' + e.message); }
        finally { btn.disabled = false; btn.textContent = orig; }
    }
})();
