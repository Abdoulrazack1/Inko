// parametres.js — Page Paramètres
(function () {
    'use strict';

    const toast = (m) => window.MH?.toast(m) || alert(m);

    document.addEventListener('DOMContentLoaded', async () => {
        MH.initPage('parametres');
        renderAccount();
        initSegments();
        renderNsfw();
        bindData();
        bindSpotify();
        bindAniList();
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
            { id: 'segDir',     key: 'readingDir', def: 'rtl' },
            { id: 'segMode',    key: 'readMode',   def: 'page' },
            { id: 'segQuality', key: 'quality',    def: 'high' },
            { id: 'segTheme',   key: 'theme',      def: 'dark' },
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

    // ── MUSIQUE / SPOTIFY ──
    async function bindSpotify() {
        // Bouton "Ouvrir le lecteur" (toujours dispo)
        document.getElementById('btnOpenMusic')?.addEventListener('click', () => {
            if (window.MH?.openMusic) MH.openMusic();
            else window.open('player.html', 'inkoMusic', 'width=420,height=640');
        });

        // Retour du callback OAuth (?spotify=linked|denied|error|badstate)
        const params = new URLSearchParams(location.search);
        const sp = params.get('spotify');
        if (sp) {
            // Si cette page est la popup d'auth → notifier l'ouvreur et se fermer
            if (window.name === 'inkoSpotifyAuth' && window.opener) {
                window.close();
                return;
            }
            const msgs = {
                linked:   'Compte Spotify lié ✓',
                denied:   'Autorisation Spotify refusée.',
                error:    'Erreur lors du lien Spotify.',
                badstate: 'Session expirée, réessaie.',
            };
            toast(msgs[sp] || 'Spotify : ' + sp);
            history.replaceState({}, '', location.pathname); // nettoie l'URL
        }

        renderSpotifyStatus();
    }

    async function renderSpotifyStatus() {
        const txt = document.getElementById('spotifyStatusText');
        const actions = document.getElementById('spotifyActions');
        if (!txt || !actions) return;

        // Garde le bouton "Ouvrir le lecteur", on ajoute le lien/délier devant
        const openBtn = document.getElementById('btnOpenMusic');
        cleanupSpotifyButtons(); // évite les doublons sur re-render

        if (!API.isLoggedIn()) {
            txt.textContent = 'Connecte-toi à Inko pour lier Spotify.';
            return;
        }
        try {
            const st = await API.spotify.status();
            if (!st.configured) {
                txt.innerHTML = 'Linking non configuré sur le serveur. ' +
                    '<span style="color:var(--text3)">(clés Spotify manquantes dans .env)</span>';
                return;
            }
            if (st.linked) {
                txt.innerHTML = 'Lié à <strong>' + MH.esc(st.profile.name || 'Spotify') + '</strong>' +
                    (st.profile.product === 'premium' ? ' · Premium' : '');
                const btn = document.createElement('button');
                btn.className = 'btn-danger';
                btn.textContent = 'Délier';
                btn.addEventListener('click', async () => {
                    try { await API.spotify.disconnect(); toast('Compte Spotify délié'); renderSpotifyStatus(); }
                    catch (e) { toast('Erreur : ' + e.message); }
                });
                actions.insertBefore(btn, openBtn);
            } else {
                txt.textContent = 'Aucun compte lié.';
                const btn = document.createElement('button');
                btn.className = 'btn btn-sm';
                btn.style.cssText = 'background:#1db954;color:#fff;display:inline-flex;align-items:center;gap:6px';
                btn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.559.3z"/></svg> Connecter Spotify';
                btn.addEventListener('click', () => {
                    window.open(API.spotify.loginUrl(), 'inkoSpotifyAuth', 'width=480,height=760');
                    // Re-vérifie périodiquement
                    let n = 0;
                    const iv = setInterval(async () => {
                        n++;
                        try { const s = await API.spotify.status(); if (s.linked) { clearInterval(iv); cleanupSpotifyButtons(); renderSpotifyStatus(); } } catch (e) {}
                        if (n > 90) clearInterval(iv);
                    }, 2000);
                });
                actions.insertBefore(btn, openBtn);
            }
        } catch (e) {
            txt.textContent = 'Statut Spotify indisponible.';
        }
    }

    function cleanupSpotifyButtons() {
        const actions = document.getElementById('spotifyActions');
        if (!actions) return;
        // Retire tout sauf le bouton "Ouvrir le lecteur"
        [...actions.children].forEach(c => { if (c.id !== 'btnOpenMusic') c.remove(); });
    }

    // ── SUIVI ANILIST ──
    async function bindAniList() {
        const params = new URLSearchParams(location.search);
        if (params.get('anilist') === 'linked') {
            toast('Compte AniList lié ✓');
            history.replaceState({}, '', location.pathname);
        }
        renderAniListStatus();
    }

    async function renderAniListStatus() {
        const txt = document.getElementById('anilistStatusText');
        const actions = document.getElementById('anilistActions');
        if (!txt || !actions || !window.AniList) return;
        actions.innerHTML = '';

        const cfg = await AniList.getConfig();
        if (!cfg.configured) {
            txt.innerHTML = 'Suivi non configuré sur le serveur. ' +
                '<span style="color:var(--text3)">(ANILIST_CLIENT_ID manquant dans .env)</span>';
            return;
        }
        if (AniList.isLinked()) {
            const u = AniList.user();
            txt.innerHTML = 'Lié à <strong>' + MH.esc(u?.name || 'AniList') + '</strong>';
            const sync = document.createElement('button');
            sync.className = 'btn btn-secondary btn-sm';
            sync.textContent = 'Synchroniser ma bibliothèque';
            sync.addEventListener('click', () => syncLibraryToAniList(sync));
            const unlink = document.createElement('button');
            unlink.className = 'btn-danger';
            unlink.textContent = 'Délier';
            unlink.addEventListener('click', () => { AniList.disconnect(); toast('Compte AniList délié'); renderAniListStatus(); });
            actions.append(sync, unlink);
        } else {
            txt.textContent = 'Aucun compte lié.';
            const btn = document.createElement('button');
            btn.className = 'btn btn-sm';
            btn.style.cssText = 'background:#02a9ff;color:#fff';
            btn.textContent = 'Connecter AniList';
            btn.addEventListener('click', async () => {
                btn.disabled = true;
                try { await AniList.connect(); toast('Compte AniList lié ✓'); renderAniListStatus(); }
                catch (e) { toast('Erreur : ' + e.message); btn.disabled = false; }
            });
            actions.appendChild(btn);
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
