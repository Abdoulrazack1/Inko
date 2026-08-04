// ============================================================
// music.js — Lecteur de musique intégré (dock en bas de page)
// ============================================================
// Barre persistante + panneau dépliable. Stations un-clic
// (YouTube IFrame API) et fichiers locaux (audio natif)
// (embed). Injecté sur toutes les pages par global.js.
// État conservé dans localStorage → reprend en changeant de page.
// Expose window.Music.
// ============================================================
(function () {
    'use strict';
    if (window.Music) return;

    const SKEY = 'inko_music_v2';
    const ICON = {
        play:  '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
        pause: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>',
        prev:  '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zM9.5 12l8.5 6V6z"/></svg>',
        next:  '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 6h2v12h-2zM6 6v12l8.5-6z"/></svg>',
        vol:   '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.5-4.03v8.05A4.5 4.5 0 0 0 16.5 12z"/></svg>',
        chevron:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
        minus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M5 18h14"/></svg>',
        close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
        note:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
        folder:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>',
        youtube:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1C24 15.9 24 12 24 12s0-3.9-.5-5.8zM9.5 15.6V8.4l6.3 3.6-6.3 3.6z"/></svg>',
        radio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.9 19.1A10 10 0 0 1 4.9 4.9M19.1 4.9a10 10 0 0 1 0 14.2M7.8 16.2a6 6 0 0 1 0-8.4M16.2 7.8a6 6 0 0 1 0 8.4"/><circle cx="12" cy="12" r="2"/></svg>',
        timer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/><path d="M9 2h6"/></svg>',
        shuffle:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5"/><path d="M4 20 21 3"/><path d="M21 16v5h-5"/><path d="m15 15 6 6"/><path d="M4 4l5 5"/></svg>',
        repeat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>',
    };

    // Stations (live, un clic) — YouTube IFrame API.
    const STATIONS = [
        { id: 'lofi',  name: 'Lofi Hip-Hop', sub: 'Détente & lecture', g: ['#fc5c7d', '#6a82fb'], yt: 'jfKfPfyJRdk' },
        { id: 'anime', name: 'Anime Lofi',   sub: 'Vibes asiatiques',  g: ['#f857a6', '#ff5858'], yt: 'Na0w3Mz46GA' },
        { id: 'chill', name: 'Chillhop',     sub: 'Jazzy beats',       g: ['#43cea2', '#185a9d'], yt: '5yx6BWlEVcY' },
        { id: 'jazz',  name: 'Jazz Café',    sub: 'Piano lent',        g: ['#c79081', '#dfa579'], yt: 'Dx5qFachd3A' },
        { id: 'synth', name: 'Synthwave',    sub: 'Rétro nocturne',    g: ['#7028e4', '#e5b2ca'], yt: '4xDzrJKXOOY' },
        { id: 'rain',  name: 'Pluie',        sub: 'Ambiance nature',   g: ['#2c3e50', '#3f5efb'], yt: 'yIQd2Ya0Ziw' },
        // Ex-stations Spotify (résidu audit F.1) : re-câblées sur de vrais flux
        // YouTube — un champ `sp:` seul faisait playYouTube(undefined) (aucun son,
        // UI « en lecture » quand même).
        { id: 'focus', name: 'Deep Focus',   sub: 'Concentration',     g: ['#11998e', '#38ef7d'], yt: 'lTRiuFIWV54' },
        { id: 'piano', name: 'Piano',        sub: 'Piano paisible',    g: ['#2c3e50', '#4ca1af'], yt: '4oStw0r33so' },
    ];

    // ── État ──
    let S = { mode: null, ytId: null, spId: null, label: '', sub: '', art: null, vol: 0.7, expanded: false, tab: 'stations', visible: false, min: false, repeat: 'off' };
    try { Object.assign(S, JSON.parse(localStorage.getItem(SKEY) || '{}')); } catch (e) { window.MH?.err?.('music.js', e); }
    S.expanded = false; // toujours replié au chargement
    function save() { try { localStorage.setItem(SKEY, JSON.stringify(S)); } catch (e) { window.MH?.err?.('music.js', e); } }

    let root, bar, panel, mediaHost, ytPlayer, ytReadyCb = [], localAudio, localQueue = [], localIdx = -1, playing = false;

    // ══════════════════════ STYLES ══════════════════════

    function injectCSS() { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'assets/css/music.css'; document.head.appendChild(l); }

    // ══════════════════════ DOM ══════════════════════
    function build() {
        root = document.createElement('div');
        root.id = 'inko-music';
        root.innerHTML = `
            <div class="im-panel">
                <div class="im-tabs">
                    <button class="im-tab" data-tab="stations">${ICON.radio}<span>Stations</span></button>
                    <button class="im-tab" data-tab="radio">${ICON.radio}<span>Radio</span></button>
                    <button class="im-tab" data-tab="youtube">${ICON.youtube}<span>YouTube</span></button>
                    <button class="im-tab" data-tab="local">${ICON.folder}<span>Fichiers</span></button>
                </div>
                <div class="im-content" id="im-content"></div>
            </div>
            <div class="im-bar">
                <div class="im-art" id="im-art">${ICON.note}</div>
                <div class="im-meta"><div class="t" id="im-t">Choisis une ambiance</div><div class="s" id="im-s">Lecteur Inko</div></div>
                <div class="im-ctr">
                    <button class="im-ico" id="im-prev" title="Précédent" aria-label="Piste ou station précédente">${ICON.prev}</button>
                    <button class="im-ico pp" id="im-pp" title="Lecture/Pause" aria-label="Lecture / pause">${ICON.play}</button>
                    <button class="im-ico" id="im-next" title="Suivant" aria-label="Piste ou station suivante">${ICON.next}</button>
                </div>
                <div class="im-vol">${ICON.vol}<input type="range" id="im-vol" min="0" max="1" step="0.01" value="${S.vol}" aria-label="Volume"></div>
                <button class="im-ico" id="im-repeat" title="Répéter" aria-label="Mode répétition">${ICON.repeat}</button>
                <button class="im-ico" id="im-timer" title="Minuterie de sommeil" aria-label="Minuterie de sommeil">${ICON.timer}</button>
                <button class="im-ico im-chev" id="im-exp" title="Agrandir" aria-label="Agrandir le lecteur">${ICON.chevron}</button>
                <button class="im-ico" id="im-min" title="Réduire en pastille" aria-label="Réduire le lecteur en pastille">${ICON.minus}</button>
                <button class="im-ico im-x" id="im-close" title="Fermer et arrêter" aria-label="Fermer le lecteur et arrêter la musique">${ICON.close}</button>
                <div class="im-progress" id="im-prog" style="display:none"><i></i></div>
            </div>
            <button class="im-pill" id="im-pill" title="Rouvrir le lecteur" aria-label="Rouvrir le lecteur musique">${ICON.note}<span class="peq" style="display:none"><i></i><i></i><i></i></span></button>`;
        document.body.appendChild(root);
        bar = root.querySelector('.im-bar');
        panel = root.querySelector('.im-panel');
        mediaHost = null; // créé à la volée dans le contenu

        root.querySelector('#im-exp').onclick = () => setExpanded(!root.classList.contains('open'));
        root.querySelector('#im-min').onclick = minimize;
        root.querySelector('#im-pill').onclick = restore;
        root.querySelector('#im-close').onclick = close;
        root.querySelector('#im-pp').onclick = togglePlay;
        root.querySelector('#im-prev').onclick = () => skip(-1);
        root.querySelector('#im-next').onclick = () => skip(1);
        root.querySelector('#im-vol').oninput = e => setVolume(+e.target.value);
        root.querySelector('#im-timer').onclick = cycleSleep;
        root.querySelector('#im-repeat').onclick = cycleRepeat;
        root.querySelectorAll('.im-tab').forEach(t => t.onclick = () => { S.tab = t.dataset.tab; save(); renderContent(); });
        updateRepeatBtn();
        localAudio = new Audio(); localAudio.volume = S.vol;
        localAudio.addEventListener('timeupdate', updateProgress);
        localAudio.addEventListener('ended', onTrackEnded);
        localAudio.addEventListener('play', () => setPlaying(true));
        localAudio.addEventListener('pause', () => setPlaying(false));
    }

    // ══════════════════════ AFFICHAGE ══════════════════════
    function setExpanded(v) {
        root.classList.toggle('open', v);
        root.querySelector('#im-exp').title = v ? 'Réduire' : 'Agrandir';
        if (v) renderContent();
    }
    // Réserve la place du dock sous le contenu (audit A15 : le dock fixe
    // cachait le bas de page, surtout en mobile).
    function setBodyPad(on) { try { document.body.style.paddingBottom = on ? '84px' : ''; } catch (e) { window.MH?.err?.('music.js', e); } }
    function open()  { S.visible = true; S.min = false; root.classList.remove('min'); root.style.display = 'flex'; setExpanded(true); setBodyPad(true); save(); }
    function show()  { S.visible = true; if (!S.min) root.style.display = 'flex'; save(); }
    function close() { stopAll(); S.visible = false; S.min = false; root.classList.remove('min'); root.style.display = 'none'; setBodyPad(false); save(); }
    function toggle() { if (root.style.display === 'none') open(); else if (root.classList.contains('min')) restore(); else setExpanded(!root.classList.contains('open')); }
    // Réduit en pastille (la musique continue) ↔ rouvre la barre
    function minimize() { root.classList.add('min'); root.classList.remove('open'); S.min = true; updatePill(); setBodyPad(false); save(); }
    function restore()  { root.classList.remove('min'); S.min = false; S.visible = true; root.style.display = 'flex'; setBodyPad(true); save(); }
    function updatePill() { const eq = root.querySelector('#im-pill .peq'); if (eq) eq.style.display = playing ? 'flex' : 'none'; }

    function setMeta(t, s, artHtml) {
        root.querySelector('#im-t').textContent = t || '';
        root.querySelector('#im-s').textContent = s || '';
        const art = root.querySelector('#im-art');
        if (artHtml) art.innerHTML = artHtml;
    }
    function setPlaying(v) { playing = v; root.querySelector('#im-pp').innerHTML = v ? ICON.pause : ICON.play; markStation(); updatePill(); }
    function markStation() {
        document.querySelectorAll('.im-station').forEach(el => {
            const on = (S.mode === 'yt' && el.dataset.yt === S.ytId);
            el.classList.toggle('on', !!on);
            const eq = el.querySelector('.eq');
            if (eq) eq.style.display = on && playing ? 'flex' : 'none';
        });
    }
    function updateProgress() {
        const prog = root.querySelector('#im-prog');
        if (S.mode === 'local' && localAudio.duration) {
            prog.style.display = ''; prog.querySelector('i').style.width = (localAudio.currentTime / localAudio.duration * 100) + '%';
        } else { prog.style.display = 'none'; }
    }

    // ══════════════════════ CONTENU (onglets) ══════════════════════
    function renderContent() {
        const c = root.querySelector('#im-content');
        root.querySelectorAll('.im-tab').forEach(t => t.classList.toggle('on', t.dataset.tab === S.tab));
        if (S.tab === 'stations') return renderStations(c);
        if (S.tab === 'radio')    return renderRadio(c);
        if (S.tab === 'youtube')  return renderYouTube(c);
        if (S.tab === 'local')    return renderLocal(c);
    }

    // ══════════════════════ RADIO — Radio Browser API ══════════════════════
    // Audit §5 : la bibliothèque était limitée à 8 flux YouTube codés en dur.
    // Radio Browser (radio-browser.info) = annuaire communautaire libre, zéro
    // inscription/clé — identifié comme la meilleure option depuis la v2.1.0.
    // Flux https uniquement (compatibles CSP media-src en production).
    const RB_BASE = 'https://all.api.radio-browser.info/json';
    const RB_TAGS = ['lofi', 'jazz', 'anime', 'jpop', 'chill', 'classical', 'electronic', 'ambient'];
    let radioResults = [];   // derniers résultats (pour next/prev)

    async function rbSearch(params) {
        const qs = new URLSearchParams(Object.assign({
            limit: '24', hidebroken: 'true', order: 'clickcount', reverse: 'true', is_https: 'true',
        }, params));
        const r = await fetch(`${RB_BASE}/stations/search?${qs}`, { headers: { 'User-Agent': 'Inko' } });
        if (!r.ok) throw new Error('Radio Browser indisponible (' + r.status + ')');
        return r.json();
    }

    function renderRadio(c) {
        c.innerHTML = `
            <div class="im-row"><input class="im-input" id="im-rbq" placeholder="Rechercher une radio (nom)…"><button class="im-btn" id="im-rbgo">Chercher</button></div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;margin:8px 0">
                ${RB_TAGS.map(t => `<button class="im-btn" data-rbtag="${t}" style="padding:4px 10px;font-size:11.5px">${t}</button>`).join('')}
            </div>
            <div id="im-rblist"><div class="im-hint">Choisis un genre ou cherche une radio — annuaire libre Radio Browser, des milliers de stations.</div></div>`;
        const listEl = c.querySelector('#im-rblist');
        const paint = () => {
            if (!radioResults.length) { listEl.innerHTML = '<div class="im-hint">Aucune station trouvée.</div>'; return; }
            listEl.innerHTML = radioResults.map((st, i) => `
                <button class="im-station im-rb" data-rbi="${i}" style="width:100%;text-align:left;margin-bottom:5px">
                    <span style="font-weight:600">${MH.esc(st.name || 'Sans nom')}</span>
                    <span style="font-size:10.5px;color:var(--text3);display:block">${MH.esc([st.country, (st.tags || '').split(',').slice(0, 3).join(', ')].filter(Boolean).join(' · '))}</span>
                </button>`).join('');
            listEl.querySelectorAll('[data-rbi]').forEach(b => b.onclick = () => playRadio(radioResults[+b.dataset.rbi]));
        };
        const search = async (params) => {
            listEl.innerHTML = '<div class="im-hint">Recherche…</div>';
            try { radioResults = await rbSearch(params); paint(); }
            catch (e) { listEl.innerHTML = `<div class="im-hint" style="color:#ef4444">${MH.esc(e.message)}</div>`; }
        };
        c.querySelector('#im-rbgo').onclick = () => { const q = c.querySelector('#im-rbq').value.trim(); if (q) search({ name: q }); };
        c.querySelector('#im-rbq').onkeydown = e => { if (e.key === 'Enter') c.querySelector('#im-rbgo').click(); };
        c.querySelectorAll('[data-rbtag]').forEach(b => b.onclick = () => search({ tag: b.dataset.rbtag }));
        if (radioResults.length) paint();   // restaure la dernière recherche
    }

    function playRadio(st) {
        if (!st || !(st.url_resolved || st.url)) return;
        stopYouTube();
        S.mode = 'radio'; S.label = st.name || 'Radio'; S.sub = 'Radio · ' + (st.country || 'Radio Browser'); save();
        localAudio.src = st.url_resolved || st.url;
        localAudio.volume = S.vol;
        localAudio.play().catch(() => window.MH?.toast?.('Flux injoignable — essaie une autre station'));
        setMeta(S.label, S.sub, ICON.radio);
        root.querySelector('#im-art').style.background = 'linear-gradient(135deg,#134e5e,#71b280)';
        show();
    }

    function renderStations(c) {
        c.innerHTML = `<div class="im-grid">` + STATIONS.map(st => `
            <button class="im-station" data-id="${st.id}" ${st.yt ? `data-yt="${st.yt}"` : ''}
                style="background:linear-gradient(135deg,${st.g[0]},${st.g[1]})">
                <span class="rd">${ICON.radio}</span>
                <span class="eq" style="display:none"><i></i><i></i><i></i></span>
                <span class="nm">${st.name}</span><span class="sb">${st.sub}</span>
            </button>`).join('') + `</div>`;
        c.querySelectorAll('.im-station').forEach(el => el.onclick = () => {
            const st = STATIONS.find(s => s.id === el.dataset.id);
            if (st && st.yt) playYouTube(st.yt, st.name, 'Station · ' + st.sub, st.g);
        });
        markStation();
    }

    function renderYouTube(c) {
        c.innerHTML = `
            <div class="im-hint">Colle un lien YouTube (vidéo ou live) ou choisis une station dans l'onglet Stations.</div>
            <div class="im-row"><input class="im-input" id="im-yturl" placeholder="https://youtube.com/watch?v=..."><button class="im-btn" id="im-ytgo">Lire</button></div>`;
        const go = () => { const id = parseYT(c.querySelector('#im-yturl').value); if (id) playYouTube(id, 'YouTube', 'Lien personnalisé', ['#ff0000', '#8b0000']); };
        c.querySelector('#im-ytgo').onclick = go;
        c.querySelector('#im-yturl').onkeydown = e => { if (e.key === 'Enter') go(); };
    }

    function renderLocal(c) {
        c.innerHTML = `
            <div class="im-row">
                <button class="im-btn" id="im-pick" style="flex:1">${ICON.folder} Choisir des fichiers audio</button>
                <button class="im-btn" id="im-shuffle" title="Mélanger" style="background:rgba(255,255,255,.1)">${ICON.shuffle}</button>
            </div>
            <input type="file" id="im-file" accept="audio/*" multiple style="display:none">
            <div class="im-list" id="im-queue"></div>`;
        c.querySelector('#im-pick').onclick = () => c.querySelector('#im-file').click();
        c.querySelector('#im-file').onchange = e => {
            const files = [...e.target.files]; if (!files.length) return;
            // Libère les blob URLs de l'ancienne file avant d'en créer une
            // nouvelle (audit F.2 : fuite mémoire cumulative à chaque import)
            localQueue.forEach(t => { try { URL.revokeObjectURL(t.url); } catch (err) { window.MH?.err?.('music.js', err); } });
            localQueue = files.map(f => ({ name: f.name.replace(/\.[^.]+$/, ''), url: URL.createObjectURL(f) }));
            playLocal(0); renderQueue();
        };
        c.querySelector('#im-shuffle').onclick = () => {
            if (!localQueue.length) { window.MH?.toast?.('Aucun fichier à mélanger'); return; }
            const cur = localQueue[localIdx];
            for (let i = localQueue.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [localQueue[i], localQueue[j]] = [localQueue[j], localQueue[i]]; }
            localIdx = cur ? localQueue.indexOf(cur) : -1;
            renderQueue(); window.MH?.toast?.('File mélangée');
        };
        renderQueue();
    }
    function renderQueue() {
        const q = root.querySelector('#im-queue'); if (!q) return;
        q.innerHTML = localQueue.length ? localQueue.map((t, i) =>
            `<div class="im-li ${i === localIdx ? 'cur' : ''}" data-i="${i}">${ICON.note}<span class="n">${esc(t.name)}</span></div>`).join('')
            : `<div class="im-hint">Aucun fichier. Tes morceaux locaux restent privés (rien n'est envoyé).</div>`;
        q.querySelectorAll('.im-li').forEach(el => el.onclick = () => playLocal(+el.dataset.i));
    }

    // ══════════════════════ LECTURE — YouTube (IFrame API) ══════════════════════
    function ensureYT(cb) {
        if (window.YT && window.YT.Player) return cb();
        ytReadyCb.push(cb);
        if (!document.getElementById('im-ytapi')) {
            window.onYouTubeIframeAPIReady = () => { const q = ytReadyCb.slice(); ytReadyCb = []; q.forEach(f => f()); };
            const s = document.createElement('script'); s.id = 'im-ytapi'; s.src = 'https://www.youtube.com/iframe_api'; document.head.appendChild(s);
        }
    }
    function mediaContainer() {
        // un hôte média persistant, hors-flux mais vivant quand replié
        let h = document.getElementById('im-media');
        if (!h) { h = document.createElement('div'); h.id = 'im-media'; h.style.cssText = 'position:fixed;left:-9999px;bottom:0;width:1px;height:1px;overflow:hidden'; document.body.appendChild(h); }
        return h;
    }
    function playYouTube(id, label, sub, g) {
        stopLocal();
        S.mode = 'yt'; S.ytId = id; S.label = label; S.sub = sub; save();
        setMeta(label, sub, ICON.youtube);
        if (g) root.querySelector('#im-art').style.background = `linear-gradient(135deg,${g[0]},${g[1]})`;
        ensureYT(() => {
            const host = mediaContainer();
            let mount = document.getElementById('im-yt'); if (!mount) { mount = document.createElement('div'); mount.id = 'im-yt'; host.appendChild(mount); }
            if (ytPlayer && ytPlayer.loadVideoById) { ytPlayer.loadVideoById(id); ytPlayer.setVolume(S.vol * 100); }
            else {
                ytPlayer = new YT.Player('im-yt', {
                    width: '320', height: '180', videoId: id,
                    playerVars: { autoplay: 1, playsinline: 1 },
                    events: {
                        onReady: e => { e.target.setVolume(S.vol * 100); e.target.playVideo(); },
                        onStateChange: e => setPlaying(e.data === 1),
                    },
                });
            }
        });
        show();
    }

    // ══════════════════════ LECTURE — Fichiers locaux ══════════════════════
    function playLocal(i) {
        if (i < 0 || i >= localQueue.length) return;
        stopYouTube();
        S.mode = 'local'; localIdx = i; save();
        localAudio.src = localQueue[i].url; localAudio.volume = S.vol; localAudio.play().catch(() => {});
        setMeta(localQueue[i].name, `${i + 1} / ${localQueue.length} · fichier local`, ICON.note);
        root.querySelector('#im-art').style.background = 'linear-gradient(135deg,#ff6b1a,#ff9a3c)';
        renderQueue(); show();
    }

    // ══════════════════════ CONTRÔLES UNIFIÉS ══════════════════════
    function togglePlay() {
        if (S.mode === 'local' || S.mode === 'radio') { localAudio.paused ? localAudio.play() : localAudio.pause(); }
        else if (S.mode === 'yt' && ytPlayer) { playing ? ytPlayer.pauseVideo() : ytPlayer.playVideo(); }
        else if (!S.mode) { S.tab = 'stations'; open(); }
    }
    function skip(d) {
        if (S.mode === 'local') { if (localQueue.length) playLocal((localIdx + d + localQueue.length) % localQueue.length); return; }
        if (S.mode === 'radio') {
            // radio : navigue dans les derniers résultats Radio Browser
            if (!radioResults.length) return;
            let idx = radioResults.findIndex(st => (st.url_resolved || st.url) === localAudio.src);
            if (idx < 0) idx = 0;
            playRadio(radioResults[(idx + d + radioResults.length) % radioResults.length]);
            return;
        }
        // stations : passe à la station suivante/précédente
        const list = STATIONS;
        let idx = list.findIndex(s => s.yt === S.ytId);
        if (idx < 0) idx = 0; const st = list[(idx + d + list.length) % list.length];
        playYouTube(st.yt, st.name, 'Station · ' + st.sub, st.g);
    }
    function setVolume(v) {
        S.vol = v; save(); localAudio.volume = v;
        if (ytPlayer && ytPlayer.setVolume) ytPlayer.setVolume(v * 100);
        const sl = root.querySelector('#im-vol'); if (sl && +sl.value !== v) sl.value = v;
    }
    function stopYouTube() { try { if (ytPlayer) ytPlayer.stopVideo?.(); } catch (e) { window.MH?.err?.('music.js', e); } }
    function stopLocal()   { try { localAudio.pause(); } catch (e) { window.MH?.err?.('music.js', e); } }
    function stopAll() { stopYouTube(); stopLocal(); setPlaying(false); }

    // ══════════════════════ Minuterie de sommeil ══════════════════════
    let sleepMin = 0, sleepHandle = null;
    function updateTimerBtn() {
        const btn = root.querySelector('#im-timer'); if (!btn) return;
        btn.classList.toggle('on', sleepMin > 0);
        btn.title = sleepMin > 0 ? `Minuterie : arrêt dans ${sleepMin} min (cliquer pour changer)` : 'Minuterie de sommeil';
    }
    function cycleSleep() {
        const steps = [0, 15, 30, 60, 90];
        sleepMin = steps[(steps.indexOf(sleepMin) + 1) % steps.length];
        if (sleepHandle) { clearTimeout(sleepHandle); sleepHandle = null; }
        if (sleepMin > 0) {
            sleepHandle = setTimeout(() => { stopAll(); sleepMin = 0; updateTimerBtn(); window.MH?.toast?.('Musique arrêtée (minuterie)'); }, sleepMin * 60000);
            window.MH?.toast?.(`Minuterie : arrêt dans ${sleepMin} min`);
        } else { window.MH?.toast?.('Minuterie désactivée'); }
        updateTimerBtn();
    }

    // ══════════════════════ Répétition ══════════════════════
    function cycleRepeat() {
        const modes = ['off', 'all', 'one'];
        S.repeat = modes[(modes.indexOf(S.repeat) + 1) % modes.length]; save();
        updateRepeatBtn();
        window.MH?.toast?.(S.repeat === 'off' ? 'Répétition désactivée' : S.repeat === 'all' ? 'Répéter tout' : 'Répéter le titre');
    }
    function updateRepeatBtn() {
        const b = root.querySelector('#im-repeat'); if (!b) return;
        b.classList.toggle('on', S.repeat !== 'off');
        b.innerHTML = ICON.repeat + (S.repeat === 'one' ? '<span class="im-rep1">1</span>' : '');
        b.title = S.repeat === 'off' ? 'Répéter' : S.repeat === 'all' ? 'Répéter tout' : 'Répéter le titre';
    }
    function onTrackEnded() {
        if (S.mode !== 'local') return;
        if (S.repeat === 'one') { localAudio.currentTime = 0; localAudio.play().catch(() => {}); return; }
        if (localIdx + 1 >= localQueue.length && S.repeat !== 'all') { setPlaying(false); return; }
        if (localQueue.length) playLocal((localIdx + 1) % localQueue.length);
    }

    // ══════════════════════ Utilitaires ══════════════════════
    function parseYT(url) { const m = (url || '').match(/[?&]v=([A-Za-z0-9_-]{11})/) || (url || '').match(/youtu\.be\/([A-Za-z0-9_-]{11})/) || (url || '').match(/^([A-Za-z0-9_-]{11})$/); return m ? m[1] : null; }
    // Audit SEC-01 : plus de copie locale de l'échappement (celle-ci n'échappait
    // ni " ni ') — point de vérité unique dans global.js. Repli complet au cas
    // où music.js serait chargé seul.
    const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    function esc(s) {
        if (window.MH && window.MH.esc) return window.MH.esc(s);
        return (s == null ? '' : String(s)).replace(/[&<>"']/g, c => ESC_MAP[c]);
    }

    // ══════════════════════ Init ══════════════════════
    function init() {
        injectCSS(); build();
        root.style.display = S.visible ? 'flex' : 'none';
        if (S.visible && S.min) root.classList.add('min');
        // Reprise inter-pages : recharge la dernière station (les flux live reprennent)
        if (S.visible && S.mode === 'yt' && S.ytId) playYouTube(S.ytId, S.label, S.sub);
    }

    window.Music = { open, close, toggle, show, playStationId: id => { const s = STATIONS.find(x => x.id === id); if (s && s.yt) playYouTube(s.yt, s.name, 'Station · ' + s.sub, s.g); } };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
