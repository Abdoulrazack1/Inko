// parametres.js — Page Paramètres
(function () {
    'use strict';

    const toast = (m) => window.MH?.toast(m);

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
            } catch (e) { window.MH?.err?.('parametres.js', e); }
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
            <!-- Audit QUAL-05 : le <label> qui l'entoure ne contient qu'une
                 icône SVG, donc aucun texte à annoncer — pour un lecteur
                 d'écran le champ n'a pas de nom. aria-label le donne. -->
            <input type="color" id="accentCustom" value="${cur}" aria-label="Couleur d’accentuation personnalisée"
                   style="opacity:0;width:0;height:0;position:absolute">
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
            try { await API.me.saveSettings({ [key]: val }); } catch (e) { window.MH?.err?.('parametres.js', e); }
        }
    }

    // ── COMPTE ──
    function renderAccount() {
        const body = document.getElementById('accountBody');
        const dangerCard = document.getElementById('dangerCard');
        const user = API.user;

        if (!user) {
            // Audit N1 : message honnête (non connecté ≠ serveur en panne)
            body.innerHTML = MH.guestNotice();
            return;
        }

        // Mode local : plus de mot de passe ni de connexion — juste l'identité
        // du profil (nom affiché sur le profil public et les commentaires).
        if (dangerCard) dangerCard.style.display = 'none';
        body.innerHTML = `
            <div class="set-field">
                <!-- Audit QUAL-05 : le libellé existait mais n'était RELIÉ à
                     rien — un label sans attribut "for" ne nomme aucun champ.
                     Il est lu comme du texte décoratif, et le champ reste
                     anonyme pour un lecteur d'écran. -->
                <label for="inpUsername">Nom d'utilisateur</label>
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

        renderSessions();
        renderBackups();
    }

    // ── SAUVEGARDES (audit AMEL-73) ─────────────────────────
    // Restauration en trois temps : voir ce qui existe, previsualiser CE QUI
    // VA ENTRER, puis confirmer. Un bouton « restaurer » sans apercu demande
    // de faire confiance a un nom de fichier.
    async function renderBackups() {
        const carte = document.getElementById('backupCard');
        const liste = document.getElementById('backupList');
        const sous  = document.getElementById('backupSub');
        if (!carte || !liste) return;
        let d;
        try { d = await API.me.backups(); } catch (e) { return; }
        if (!d.items.length) return;   // rien a montrer : une section vide n'informe pas
        carte.style.display = '';

        if (sous) {
            sous.textContent = `${d.items.length} sauvegarde(s) · ${d.encrypted ? 'chiffrees (AES-256-GCM)' : 'en clair sur le disque'}`
                + ` · dossier ${d.directory}`;
        }
        liste.innerHTML = d.items.map(b => `
            <div class="set-row" data-bk="${MH.esc(b.file)}">
                <div>
                    <div class="set-row-label">${MH.esc(new Date(b.at).toLocaleString('fr-FR'))}${b.encrypted ? ' · chiffree' : ''}</div>
                    <div class="set-row-desc">${MH.esc(b.file)} · ${(b.size / 1024).toFixed(0)} Ko</div>
                </div>
                <button class="btn btn-secondary btn-sm" data-bk-restore="${MH.esc(b.file)}" data-enc="${b.encrypted ? '1' : ''}">Restaurer</button>
            </div>`).join('');

        liste.querySelectorAll('[data-bk-restore]').forEach(b => {
            b.addEventListener('click', async () => {
                const file = b.dataset.bkRestore;
                let phrase = null;
                if (b.dataset.enc) {
                    phrase = await MH.prompt('Cette sauvegarde est chiffree.', {
                        title: 'Phrase secrete', placeholder: 'BACKUP_PASSPHRASE', okText: 'Continuer' });
                    if (phrase === null) return;
                }
                b.disabled = true;
                try {
                    const p = await API.me.backupPreview(file, phrase);
                    const ok = await MH.confirm(
                        `Restaurer ta sauvegarde du ${new Date(p.createdAt || Date.now()).toLocaleDateString('fr-FR')} ?`,
                        { okText: 'Restaurer',
                            message: `Elle contient ${p.mine.favorites} favori(s), ${p.mine.readChapters} chapitre(s) lu(s), `
                                + `${p.mine.progress} progression(s), ${p.mine.ratings} note(s), ${p.mine.lists} liste(s).`
                                + String.fromCharCode(10, 10)
                                + "La restauration FUSIONNE : rien de ce que tu as aujourd'hui ne sera supprime." });
                    if (!ok) return;
                    const r = await API.me.backupRestore(file, phrase);
                    const n = r.imported || {};
                    toast(`Restaure : ${n.favorites || 0} favoris, ${n.readChapters || 0} chapitres lus`);
                } catch (e) { toast('Erreur : ' + e.message); }
                finally { b.disabled = false; }
            });
        });
    }

    // ── SESSIONS ACTIVES (audit AMEL-69) ────────────────────
    // Avant : aucune visibilite ni controle. Le seul levier etait
    // `token_version`, qui deconnecte TOUT — y compris les appareils qu'on
    // voulait garder.
    async function renderSessions() {
        const carte = document.getElementById('sessionsCard');
        const liste = document.getElementById('sessionsList');
        if (!carte || !liste) return;
        let sessions;
        try { sessions = await API.auth.sessions(); }
        catch (e) { return; }   // carte masquee : mieux qu'une section vide et inerte
        if (!sessions.length) return;
        carte.style.display = '';

        liste.innerHTML = sessions.map(s => `
            <div class="set-row" data-sess="${MH.esc(s.id)}">
                <div>
                    <div class="set-row-label">${MH.esc(s.device)}${s.current ? ' <span style="color:var(--accent-text);font-size:11px">· cet appareil</span>' : ''}</div>
                    <div class="set-row-desc">${MH.esc(s.ip || 'adresse inconnue')} · vue ${ilYA(s.lastSeenAt)} · ouverte ${ilYA(s.createdAt)}</div>
                </div>
                <button class="btn btn-secondary btn-sm" data-revoke="${MH.esc(s.id)}">${s.current ? 'Me deconnecter' : 'Fermer'}</button>
            </div>`).join('');

        liste.querySelectorAll('[data-revoke]').forEach(b => {
            b.addEventListener('click', async () => {
                const id = b.dataset.revoke;
                const soi = sessions.find(x => x.id === id)?.current;
                if (soi && !await MH.confirm('Fermer cette session te deconnecte immediatement.', {
                    danger: true, okText: 'Me deconnecter' })) return;
                try {
                    const r = await API.auth.revokeSession(id);
                    if (r.self) { toast('Deconnecte'); setTimeout(() => location.reload(), 600); return; }
                    toast('Session fermee');
                    renderSessions();
                } catch (e) { toast('Erreur : ' + e.message); }
            });
        });

        const autres = document.getElementById('btnRevokeOthers');
        if (autres && !autres.dataset.lie) {
            autres.dataset.lie = '1';
            autres.addEventListener('click', async () => {
                if (!await MH.confirm('Fermer toutes les autres sessions ?', {
                    danger: true, okText: 'Fermer les autres',
                    message: 'Cet appareil reste connecte. Tous les autres devront se reconnecter.' })) return;
                try {
                    const r = await API.auth.revokeOthers();
                    toast(r.closed ? `${r.closed} session(s) fermee(s)` : 'Aucune autre session');
                    renderSessions();
                } catch (e) { toast('Erreur : ' + e.message); }
            });
        }
    }

    function ilYA(ts) {
        const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
        if (s < 60) return "a l'instant";
        if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
        if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
        return `le ${new Date(ts).toLocaleDateString('fr-FR')}`;
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

        // Contenu adulte (audit N20) — stocké à part (MH.nsfwAllowed, lu par
        // les cartes de l'accueil/catalogue/recherche), pas dans les prefs lecteur
        const segNsfw = document.getElementById('segNsfw');
        if (segNsfw) {
            const cur = window.MH.nsfwAllowed() ? '1' : '0';
            segNsfw.querySelectorAll('button').forEach(b => {
                b.classList.toggle('active', b.dataset.val === cur);
                b.onclick = () => {
                    segNsfw.querySelectorAll('button').forEach(x => x.classList.remove('active'));
                    b.classList.add('active');
                    window.MH.setNsfwAllowed(b.dataset.val === '1');
                    toast(b.dataset.val === '1'
                        ? 'Contenu adulte visible (flou retiré)'
                        : 'Contenu adulte flouté ✓', 1600);
                };
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
            if (!await MH.confirm('Effacer tout ton historique de lecture ? (favoris conservés)', { danger: true, okText: 'Effacer' })) return;
            try { await API.me.clearHistory(); toast('Historique effacé ✓'); }
            catch (e) { toast('Erreur : ' + e.message); }
        });

        document.getElementById('btnDeleteAccount')?.addEventListener('click', async () => {
            const password = await MH.prompt('Supprimer le compte', { message: 'Action irréversible. Entre ton mot de passe pour confirmer.', placeholder: 'Mot de passe', okText: 'Supprimer' });
            if (password === null) return;
            try {
                await API.auth.deleteAccount(password);
                toast('Compte supprimé. À bientôt.');
                setTimeout(() => { window.location.href = 'accueil.html'; }, 1000);
            } catch (e) { toast('Erreur : ' + e.message); }
        });
    }

    // ── COMPTES LIÉS (AniList) + Musique ──
    async function bindConnections() {
        // Bouton "Ouvrir le lecteur" de musique
        document.getElementById('btnReplayTour')?.addEventListener('click', () => MH.startTour());

    // ── Vider le cache ──
    // Après une mise à jour, la fenêtre desktop (ou la PWA) peut rester sur
    // d'anciens fichiers en cache et afficher un écran figé/incohérent. Ce
    // bouton remet l'app à neuf SANS toucher aux données : on préserve la
    // session, les réglages et le cache hors-ligne des chapitres téléchargés.
    (function () {
        const btn = document.getElementById('btnClearCache');
        const st  = document.getElementById('cacheStatus');
        if (!btn) return;
        btn.addEventListener('click', async () => {
            const ok = await MH.confirm(
                "L'app va se recharger à neuf. Ton compte, ta bibliothèque, ta progression et tes chapitres téléchargés hors-ligne sont conservés.",
                { title: 'Vider le cache ?', okText: 'Vider le cache' }
            );
            if (!ok) return;
            btn.disabled = true;
            const before = st.textContent;
            st.textContent = 'Nettoyage en cours…';
            try {
                let n = 0;
                if ('caches' in window) {
                    for (const k of await caches.keys()) {
                        // 'inko-offline' = chapitres téléchargés par l'utilisateur : on n'y touche pas
                        if (k === 'inko-offline') continue;
                        if (await caches.delete(k)) n++;
                    }
                }
                // Force le service worker à repartir sur la version courante
                if ('serviceWorker' in navigator) {
                    const regs = await navigator.serviceWorker.getRegistrations();
                    await Promise.all(regs.map(r => r.update().catch(() => r.unregister())));
                }
                st.textContent = `${n} cache(s) vidé(s) — rechargement…`;
                MH.toast('Cache vidé ✓');
                setTimeout(() => location.reload(true), 900);
            } catch (e) {
                window.MH?.err?.('parametres.js', e);
                st.textContent = before;
                btn.disabled = false;
                MH.toast('Impossible de vider le cache');
            }
        });
    })();

    // ── Carte Application : version + mises à jour ──
    (async function () {
        const vEl = document.getElementById('appVersion');
        const st = document.getElementById('appUpdateStatus');
        const btnDl = document.getElementById('btnDownloadUpdate');
        const btnCk = document.getElementById('btnCheckUpdate');
        if (!vEl) return;
        async function check(manual) {
            try {
                if (manual) { btnCk.disabled = true; st.textContent = 'Vérification…'; }
                const r = await MH.appUpdates.check();
                vEl.textContent = r.current ? 'v' + r.current : '(développement)';
                if (r.hasUpdate) {
                    st.textContent = 'Nouvelle version disponible : v' + r.latest;
                    btnDl.style.display = '';
                } else {
                    st.textContent = r.current ? 'Tu as la dernière version ✓' : 'Version de développement — mises à jour non applicables.';
                    btnDl.style.display = 'none';
                }
            } catch (e) { st.textContent = 'Vérification impossible (hors-ligne ?)'; }
            finally { btnCk.disabled = false; }
        }
        btnCk?.addEventListener('click', () => check(true));
        btnDl?.addEventListener('click', () => MH.appUpdates.install());
        check(false);
    })();

    document.getElementById('btnOpenMusic')?.addEventListener('click', () => {
            if (window.MH?.openMusic) MH.openMusic();
            
        });

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
            // TOUTE la bibliothèque est poussée vers AniList : chaque œuvre sans
            // statut explicite est marquée « planned » (À lire / Planning) pour
            // qu'elle apparaisse quand même sur AniList. Avant, seules les œuvres
            // avec progression OU statut partaient (→ la plupart étaient ignorées).
            const targets = favs.map(f => {
                const p = prog[f.mangaId];
                const opts = { status: f.status || 'planned' };
                if (p?.chapter) opts.progress = Math.floor(p.chapter);
                return { f, opts };
            });

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
            const bits = [`${ok} synchronisée(s) sur ${targets.length}`];
            if (notFound) bits.push(`${notFound} introuvable(s) sur AniList`);
            if (failed)   bits.push(`${failed} échec(s)`);
            toast(bits.join(' · '));
        } catch (e) { toast('Erreur : ' + e.message); }
        finally { btn.disabled = false; btn.textContent = orig; }
    }
})();
