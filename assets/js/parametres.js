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
        //
        // Sauf ce que l'utilisateur vient de changer. La page s'affiche
        // d'abord sur le stockage local, PUIS ce chargement écrasait TOUTES
        // les préférences et re-synchronisait les segments : un clic donné
        // avant l'arrivée de la réponse était annulé sous les doigts, sans
        // rien dire. Vérifié dans le navigateur — cliquer « Double » juste
        // après l'ouverture laissait « Défilement » actif et `readMode` à
        // « scroll » ; la même page posée, le bouton marche.
        //
        // En boucle locale la fenêtre dure quelques dizaines de millisecondes
        // — assez pour que l'audit des contrôles déclare « Double » INERTE.
        // Sur un hub distant elle dure le temps d'un aller-retour, et c'est
        // l'utilisateur qui perd son réglage.
        if (API.isLoggedIn()) {
            try {
                const s = await API.me.settings();
                Object.entries(s).forEach(([k, v]) => {
                    if (!TOUCHEES.has(k)) window.Storage.setPref(k, v);
                });
                if (s.theme && !TOUCHEES.has('theme')) window.Theme.apply(s.theme);
                initSegments(); // re-sync l'état actif
                if (!TOUCHEES.has('accent')) initAccent();
            } catch (e) { window.MH?.err?.('parametres.js', e); }
        }
    });

    // ── COULEUR D'ACCENT ──
    function initAccent() {
        const el = document.getElementById('accentSwatches');
        if (!el || !window.Theme) return;
        // Une couleur porte un NOM, pas son code.
        //
        // Le title valait « #3b82f6 » : un lecteur d'écran annonçait
        // « dièse trois b huit deux f six », et la pastille n'était qu'un
        // rond de couleur — donc muette pour qui ne voit pas la couleur.
        // Relevé par l'audit des contrôles, qui signale les noms
        // accessibles illisibles.
        //
        // aria-pressed dit EN PLUS laquelle est choisie : la bordure ne le
        // dit qu'à l'œil.
        const presets = [
            ['#ff6b1a', 'Orange'], ['#3b82f6', 'Bleu'], ['#a855f7', 'Violet'],
            ['#22c55e', 'Vert'], ['#ec4899', 'Rose'], ['#ef4444', 'Rouge'],
            ['#06b6d4', 'Cyan'], ['#f59e0b', 'Ambre'],
        ];
        const cur = window.Theme.currentAccent();
        el.innerHTML = presets.map(([c, nom]) =>
            `<button class="accent-dot" data-accent="${c}" title="${nom}" aria-label="Couleur d’accentuation ${nom}" aria-pressed="${c.toLowerCase() === cur.toLowerCase()}" style="width:26px;height:26px;border-radius:50%;background:${c};border:2px solid ${c.toLowerCase()===cur.toLowerCase()?'var(--text)':'transparent'};cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,.3)"></button>`
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
    //
    // Les clés touchées ici sont celles d'un GESTE, et le geste prime sur
    // toute réponse arrivant après lui. Voir le chargement des réglages
    // serveur, plus haut.
    const TOUCHEES = new Set();

    async function savePref(key, val) {
        TOUCHEES.add(key);
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
            } catch (e) { MH.toastErreur(e); }
        });

        renderSessions();
        renderBackups();
        renderFileSync();
        renderRaccourcis();
        renderDesktop();
        renderInstance();
    }

    // ── SANTE DE L'INSTANCE (audit AMEL-116) ────────────────
    async function renderInstance() {
        const carte = document.getElementById('instanceCard');
        const liste = document.getElementById('instanceList');
        const sous  = document.getElementById('instanceSub');
        if (!carte || !liste) return;
        let d;
        try { d = await API.instance(); } catch (e) { return; }
        carte.style.display = '';

        const mo = (o) => (o == null ? '—' : (o / 1073741824 >= 1
            ? (o / 1073741824).toFixed(1) + ' Go' : Math.round(o / 1048576) + ' Mo'));
        const duree = (s) => {
            if (s < 3600) return Math.round(s / 60) + ' min';
            if (s < 86400) return Math.round(s / 3600) + ' h';
            return Math.round(s / 86400) + ' j';
        };
        if (sous) {
            sous.textContent = `Version ${d.version || 'dev'} · Node ${d.node} · en ligne depuis ${duree(d.uptimeSec)}`
                + ` · ${d.memoireMo} Mo de memoire`;
        }

        // La sauvegarde est le seul poste ou l'AGE compte plus que l'etat :
        // « 12 fichiers » ne dit pas si le mecanisme tourne encore.
        const age = d.sauvegardes.derniere?.ageJours;
        const sauvEtat = !d.sauvegardes.derniere ? 'err'
            : age > 3 ? 'warn' : 'ok';
        const lignes = [
            [d.base.ok ? 'ok' : 'err', 'Base de donnees',
                d.base.ok ? `repond en ${d.base.latenceMs} ms` : (d.base.error || 'injoignable')],
            [d.volumes ? 'ok' : 'warn', 'Contenu',
                d.volumes ? `${MH.fmt(d.volumes.comptes)} compte(s) · ${MH.fmt(d.volumes.favoris)} favoris · ${MH.fmt(d.volumes.chapitresLus)} chapitres lus`
                    : 'non mesurable'],
            [d.extensions.total ? 'ok' : 'err', 'Extensions',
                d.extensions.total ? `${d.extensions.total} source(s) chargee(s)` : 'aucune — catalogue vide'],
            [sauvEtat, 'Sauvegardes',
                d.sauvegardes.derniere
                    ? `${d.sauvegardes.total} fichier(s) · derniere il y a ${age} j`
                        + (d.sauvegardes.chiffrees ? ' · chiffrees' : ' · EN CLAIR')
                    : 'aucune sauvegarde trouvee'],
            ...(d.disque ? [[d.disque.libre / d.disque.total < 0.1 ? 'warn' : 'ok', 'Disque',
                `${mo(d.disque.libre)} libres sur ${mo(d.disque.total)}`]] : []),
        ];
        const couleur = { ok: 'var(--green-text)', warn: 'var(--amber-text)', err: 'var(--red-text)' };
        const signe = { ok: '✓', warn: '!', err: '✕' };
        liste.innerHTML = lignes.map(([e, quoi, detail]) => `
            <div class="set-row">
                <div>
                    <div class="set-row-label"><span style="color:${couleur[e]}">${signe[e]}</span> ${MH.esc(quoi)}</div>
                    <div class="set-row-desc">${MH.esc(detail)}</div>
                </div>
            </div>`).join('');
    }

    // ── APP DE BUREAU (audit AMEL-93) ───────────────────────
    // Le plugin d'autostart est CHARGE mais l'option reste desactivee par
    // defaut : decider tout seul qu'un logiciel se lance a l'ouverture de
    // session n'est pas une amelioration, c'est une intrusion. C'est donc un
    // reglage, visible et reversible.
    async function renderDesktop() {
        const carte = document.getElementById('desktopCard');
        const tgl = document.getElementById('tglAutostart');
        const invoke = window.__TAURI__?.core?.invoke;
        if (!carte || !tgl || !invoke) return;   // hors app Tauri : rien a proposer
        carte.style.display = '';
        let actif = false;
        try { actif = await invoke('autostart_actif'); } catch (e) { return; }
        tgl.classList.toggle('on', !!actif);
        tgl.addEventListener('click', async () => {
            const veut = !tgl.classList.contains('on');
            tgl.classList.toggle('on', veut);
            try {
                // On relit l'etat REEL renvoye par le systeme plutot que de
                // supposer que l'appel a marche : une politique d'entreprise ou
                // un antivirus peuvent refuser l'entree de registre.
                const obtenu = await invoke('definir_autostart', { actif: veut });
                tgl.classList.toggle('on', !!obtenu);
                toast(obtenu ? 'Inko demarrera avec Windows' : 'Demarrage automatique desactive');
            } catch (e) {
                tgl.classList.toggle('on', !veut);
                toast('Impossible de modifier le demarrage automatique : ' + e);
            }
        });
    }

    // ── RACCOURCIS CLAVIER (audit AMEL-82) ──────────────────
    function renderRaccourcis() {
        const liste = document.getElementById('shortcutsList');
        if (!liste || !MH.raccourcis) return;
        liste.innerHTML = MH.raccourcis().map(r => `
            <div class="set-row">
                <div>
                    <div class="set-row-label">${MH.esc(r.label)}</div>
                    <div class="set-row-desc">${r.touche ? '' : 'Desactive'}</div>
                </div>
                <button class="btn btn-secondary btn-sm" data-sc="${MH.esc(r.id)}"
                    aria-label="Modifier le raccourci ${MH.esc(r.label)}"
                    style="font-family:monospace;min-width:64px">${r.touche ? MH.esc(r.touche) : '—'}</button>
            </div>`).join('');

        liste.querySelectorAll('[data-sc]').forEach(b => {
            b.addEventListener('click', () => {
                const prec = b.textContent;
                b.textContent = '…';
                b.disabled = false;
                // On capture la touche PHYSIQUEMENT plutot que de la faire
                // saisir : demander « tape la lettre » dans un champ texte
                // laisserait passer « Ctrl » ou une chaine de trois caracteres.
                const onKey = (e) => {
                    e.preventDefault(); e.stopPropagation();
                    document.removeEventListener('keydown', onKey, true);
                    if (e.key === 'Escape') { b.textContent = prec; return; }
                    // Retour arriere = desactiver, pas « touche Backspace ».
                    const touche = (e.key === 'Backspace' || e.key === 'Delete') ? '' : e.key;
                    if (touche && touche.length > 1) {   // F1, Tab, Enter…
                        toast('Choisis un caractere simple');
                        b.textContent = prec; return;
                    }
                    MH.setRaccourci(b.dataset.sc, touche);
                    toast(touche ? `Raccourci : ${touche}` : 'Raccourci desactive');
                    renderRaccourcis();
                };
                document.addEventListener('keydown', onKey, true);
            });
        });

        const reset = document.getElementById('btnResetShortcuts');
        if (reset && !reset.dataset.lie) {
            reset.dataset.lie = '1';
            reset.addEventListener('click', () => {
                MH.resetRaccourcis();
                toast('Raccourcis reinitialises');
                renderRaccourcis();
            });
        }
    }

    // ── FILE HORS-LIGNE (audit AMEL-79) ─────────────────────
    function renderFileSync() {
        const carte = document.getElementById('syncCard');
        const liste = document.getElementById('syncList');
        const sous  = document.getElementById('syncSub');
        if (!carte || !liste || !API.offlineQueue) return;
        const q = API.offlineQueue();
        // Rien en attente = rien a dire. Une carte « 0 action » ferait croire
        // a un probleme la ou tout va bien.
        if (!q.length) { carte.style.display = 'none'; return; }
        carte.style.display = '';
        if (sous) {
            sous.textContent = navigator.onLine
                ? `${q.length} action(s) en attente d'envoi.`
                : `${q.length} action(s) gardees hors-ligne — elles partiront au retour du reseau.`;
        }
        liste.innerHTML = q.slice(0, 20).map(e => `
            <div class="set-row">
                <div>
                    <div class="set-row-label">${MH.esc(e.label)}</div>
                    <div class="set-row-desc">${MH.esc(ilYA(e.at))}</div>
                </div>
            </div>`).join('');

        const b = document.getElementById('btnFlushSync');
        if (b && !b.dataset.lie) {
            b.dataset.lie = '1';
            b.addEventListener('click', async () => {
                if (!navigator.onLine) { toast('Toujours hors-ligne'); return; }
                b.disabled = true;
                try { await API.flushOffline(); } finally { b.disabled = false; renderFileSync(); }
            });
        }
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
                } catch (e) { MH.toastErreur(e); }
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
                } catch (e) { MH.toastErreur(e); }
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
                } catch (e) { MH.toastErreur(e); }
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
            } catch (e) { MH.toastErreur(e); }
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
            } catch (e) { MH.toastErreur(e); }
            finally { importFile.value = ''; }
        });

        document.getElementById('btnClearHistory').addEventListener('click', async () => {
            if (!API.isLoggedIn()) { toast('Connecte-toi'); return; }
            if (!await MH.confirm('Effacer tout ton historique de lecture ? (favoris conservés)', { danger: true, okText: 'Effacer' })) return;
            try { await API.me.clearHistory(); toast('Historique effacé ✓'); }
            catch (e) { MH.toastErreur(e); }
        });

        document.getElementById('btnDeleteAccount')?.addEventListener('click', async () => {
            const password = await MH.prompt('Supprimer le compte', { message: 'Action irréversible. Entre ton mot de passe pour confirmer.', placeholder: 'Mot de passe', okText: 'Supprimer' });
            if (password === null) return;
            try {
                await API.auth.deleteAccount(password);
                toast('Compte supprimé. À bientôt.');
                setTimeout(() => { window.location.href = 'accueil.html'; }, 1000);
            } catch (e) { MH.toastErreur(e); }
        });
    }

    // ── COMPTES LIÉS (AniList) + Musique ──
    async function bindConnections() {
        // Bouton "Ouvrir le lecteur" de musique
        document.getElementById('btnReplayTour')?.addEventListener('click', () => MH.startTour());
        document.getElementById('btnDiagVoir')?.addEventListener('click', afficherDiagnostic);
        document.getElementById('btnDiagCopier')?.addEventListener('click', copierDiagnostic);

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
                // Appuyer sur « Vérifier », c'est demander une réponse
                // FRAÎCHE : on court-circuite le cache de six heures. Le
                // chargement de page, lui, s'en contente.
                const r = await MH.appUpdates.check({ forcer: !!manual });
                vEl.textContent = r.current ? 'v' + r.current : '(développement)';
                if (r.hasUpdate) {
                    st.textContent = 'Nouvelle version disponible : v' + r.latest
                        + (r.echec ? ' (relevé daté)' : '');
                    btnDl.style.display = '';
                } else if (!r.current) {
                    st.textContent = 'Version de développement — mises à jour non applicables.';
                    btnDl.style.display = 'none';
                } else if (r.echec) {
                    // Ne PAS dire « tu as la dernière version ».
                    //
                    // C'est ce que cette page affichait dès que GitHub ne
                    // répondait pas : `hasUpdate` valait `false`, et rien ne
                    // distinguait « vérifié, rien de neuf » de « je n'ai pas
                    // pu regarder ». Un utilisateur repartait rassuré sur une
                    // vérification qui n'avait pas eu lieu.
                    st.textContent = 'Vérification impossible : ' + r.echec;
                    btnDl.style.display = r.latest ? '' : 'none';
                } else {
                    st.textContent = 'Tu as la dernière version ✓';
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
        } catch (e) { MH.toastErreur(e); }
        finally { btn.disabled = false; btn.textContent = orig; }
    }
    // ── Diagnostic ────────────────────────────────────────
    //
    // `MH.errors` retient les cent dernières erreurs JavaScript depuis
    // toujours. Rien ne les avait jamais montrées : elles vivaient dans une
    // variable qu'il fallait connaître et lire depuis la console du navigateur.
    //
    // Sur une application qu'on héberge soi-même, c'est la différence entre
    // « ça marche pas » — dont personne ne peut rien faire — et un rapport qui
    // dit la version, le mode, la source active et ce qui a échoué.
    //
    // Ce que le rapport ne contient PAS est aussi important que ce qu'il
    // contient : ni jeton, ni email, ni titre d'œuvre, ni adresse de hub. Un
    // rapport qu'on hésite à coller dans un ticket public ne sert à rien.

    /** Taille lisible : 4.8 Mo se lit, 5033164 non. */
    function taille(n) {
        if (!Number.isFinite(n)) return '—';
        const u = ['o', 'Ko', 'Mo', 'Go'];
        let i = 0;
        while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
        return `${n.toFixed(i ? 1 : 0)} ${u[i]}`;
    }

    async function construireDiagnostic() {
        const L = [];
        const ajout = (cle, val) => L.push(`${String(cle).padEnd(18)} ${val}`);

        L.push('── Inko · diagnostic ──');
        ajout('Date', new Date().toISOString());
        // La version n'est exposée nulle part côté page : `/api/health` ne la
        // rend qu'en production (`APP_VERSION`), et le dev n'en a pas. Elle est
        // pourtant DANS le nom du cache du service worker — `inko-2.6.1-…` —
        // que `gen-precache.js` fabrique depuis `package.json`. On la lit là :
        // ça marche hors ligne, et sans compte.
        let version = '—';
        try {
            const cle = (await caches.keys()).find((k) => /^inko-\d/.test(k));
            if (cle) version = (cle.match(/^inko-([\d.]+)/) || [, '—'])[1];
        } catch (e) { /* caches indisponible : on reste sur '—' */ }
        ajout('Version', version);
        // Le MODE explique la moitié des symptômes rapportés : sans hub, une
        // page qui « ne charge rien » est un comportement, pas une panne.
        ajout('Mode', window.INKO_AUTONOME ? 'autonome (sans hub)' : 'hub');
        ajout('Connecté', window.API?.isLoggedIn?.() ? 'oui' : 'non');
        ajout('Source active', window.API?.sources?.current || '—');
        ajout('Langue', window.MH?.lang || '—');
        ajout('Thème', window.Storage?.getPref?.('theme') || 'dark');
        // `innerWidth` vaut 0 quand la fenêtre est masquée (onglet en arrière-
        // plan, panneau replié) : on retombe alors sur la taille de l'écran,
        // qui reste un renseignement utile.
        const l = window.innerWidth || window.screen?.width || 0;
        const h = window.innerHeight || window.screen?.height || 0;
        ajout('Écran', `${l}×${h} @${window.devicePixelRatio || 1}x`);
        ajout('En ligne', navigator.onLine ? 'oui' : 'non');
        // L'agent utilisateur dit le WebView d'Android, dont la version
        // explique à elle seule plusieurs classes de pannes de mise en page.
        ajout('Navigateur', (navigator.userAgent || '').slice(0, 120));

        try {
            const sw = await navigator.serviceWorker?.getRegistration?.();
            ajout('Service worker', sw ? (sw.active ? 'actif' : 'enregistré') : 'absent');
        } catch (e) { ajout('Service worker', 'inconnu'); }

        try {
            const q = await navigator.storage?.estimate?.();
            if (q) ajout('Stockage', `${taille(q.usage)} utilisés sur ${taille(q.quota)}`);
        } catch (e) { /* estimate() n'existe pas partout */ }

        try {
            const n = (window.UserData?.file?.() || []).length;
            ajout('À lire ensuite', `${n} entrée(s)`);
        } catch (e) { /* UserData absent sur les pages sans global.js */ }

        // ── Les erreurs, de la plus récente à la plus ancienne ──
        const err = (window.MH?.errors || []).slice(-15).reverse();
        L.push('');
        L.push(`── ${err.length} dernière(s) erreur(s) sur ${(window.MH?.errors || []).length} retenue(s) ──`);
        if (!err.length) L.push('(aucune)');
        for (const e of err) {
            const quand = new Date(e.at || Date.now()).toISOString().slice(11, 19);
            L.push(`${quand}  ${e.ctx || '?'} : ${String(e.msg || '').slice(0, 160)}`);
        }
        return L.join('\n');
    }

    // Le bouton BASCULE : il affiche, puis il masque. Sans aria-expanded il
    // annonce « Afficher » dans les deux etats, et rien ne dit qu'un panneau
    // s'est ouvert plus bas. Meme defaut que la cloche de notifications.
    async function afficherDiagnostic() {
        const zone = document.getElementById('diagSortie');
        if (!zone) return;
        const bouton = document.getElementById('btnDiagVoir');
        const dire = (ouvert) => bouton?.setAttribute('aria-expanded', String(ouvert));
        if (!zone.hidden) { zone.hidden = true; dire(false); return; }
        zone.textContent = await construireDiagnostic();
        zone.hidden = false;
        dire(true);
        zone.focus();
    }

    async function copierDiagnostic() {
        const texte = await construireDiagnostic();
        try {
            await navigator.clipboard.writeText(texte);
            MH.toast?.('Rapport copié — colle-le dans ton signalement');
        } catch (e) {
            // Le presse-papiers demande un contexte sûr et une permission. Sans
            // lui, on AFFICHE le rapport et on le sélectionne : l'utilisateur
            // fait Ctrl+C. Un « impossible de copier » sans rien d'autre
            // laisserait la seule information utile hors de portée.
            const zone = document.getElementById('diagSortie');
            if (zone) {
                zone.textContent = texte;
                zone.hidden = false;
                document.getElementById('btnDiagVoir')?.setAttribute('aria-expanded', 'true');
                const r = document.createRange();
                r.selectNodeContents(zone);
                const sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(r);
            }
            MH.toast?.('Copie refusée par le navigateur — le rapport est sélectionné, fais Ctrl+C');
        }
    }

})();
