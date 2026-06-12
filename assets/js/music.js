// ============================================================
// music.js — Lecteur de musique intégré (dock en bas de page)
// ============================================================
// Barre persistante + panneau dépliable. Stations un-clic
// (YouTube IFrame API), fichiers locaux (audio natif) et Spotify
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
        spotify:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.559.3z"/></svg>',
        youtube:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1C24 15.9 24 12 24 12s0-3.9-.5-5.8zM9.5 15.6V8.4l6.3 3.6-6.3 3.6z"/></svg>',
        radio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.9 19.1A10 10 0 0 1 4.9 4.9M19.1 4.9a10 10 0 0 1 0 14.2M7.8 16.2a6 6 0 0 1 0-8.4M16.2 7.8a6 6 0 0 1 0 8.4"/><circle cx="12" cy="12" r="2"/></svg>',
        timer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/><path d="M9 2h6"/></svg>',
        shuffle:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5"/><path d="M4 20 21 3"/><path d="M21 16v5h-5"/><path d="m15 15 6 6"/><path d="M4 4l5 5"/></svg>',
        repeat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>',
    };

    // Stations (live, un clic). yt = YouTube IFrame API ; sp = embed Spotify.
    const STATIONS = [
        { id: 'lofi',  name: 'Lofi Hip-Hop', sub: 'Détente & lecture', g: ['#fc5c7d', '#6a82fb'], yt: 'jfKfPfyJRdk' },
        { id: 'anime', name: 'Anime Lofi',   sub: 'Vibes asiatiques',  g: ['#f857a6', '#ff5858'], yt: 'Na0w3Mz46GA' },
        { id: 'chill', name: 'Chillhop',     sub: 'Jazzy beats',       g: ['#43cea2', '#185a9d'], yt: '5yx6BWlEVcY' },
        { id: 'jazz',  name: 'Jazz Café',    sub: 'Piano lent',        g: ['#c79081', '#dfa579'], yt: 'Dx5qFachd3A' },
        { id: 'synth', name: 'Synthwave',    sub: 'Rétro nocturne',    g: ['#7028e4', '#e5b2ca'], yt: '4xDzrJKXOOY' },
        { id: 'rain',  name: 'Pluie',        sub: 'Ambiance nature',   g: ['#2c3e50', '#3f5efb'], yt: 'yIQd2Ya0Ziw' },
        { id: 'focus', name: 'Deep Focus',   sub: 'Concentration',     g: ['#11998e', '#38ef7d'], sp: '37i9dQZF1DWZeKCadgRdKQ' },
        { id: 'piano', name: 'Piano',        sub: 'Classique doux',    g: ['#2c3e50', '#4ca1af'], sp: '37i9dQZF1DX4sWSpwq3LiO' },
    ];

    // ── État ──
    let S = { mode: null, ytId: null, spId: null, label: '', sub: '', art: null, vol: 0.7, expanded: false, tab: 'stations', visible: false, min: false, repeat: 'off' };
    try { Object.assign(S, JSON.parse(localStorage.getItem(SKEY) || '{}')); } catch (e) {}
    S.expanded = false; // toujours replié au chargement
    function save() { try { localStorage.setItem(SKEY, JSON.stringify(S)); } catch (e) {} }

    let root, bar, panel, mediaHost, ytPlayer, ytReadyCb = [], localAudio, localQueue = [], localIdx = -1, playing = false;

    // ══════════════════════ STYLES ══════════════════════
    const css = `
    #inko-music{position:fixed;left:0;right:0;bottom:0;z-index:9000;display:flex;flex-direction:column;align-items:center;pointer-events:none;font-family:var(--font-body,-apple-system,'Segoe UI',sans-serif)}
    #inko-music *{box-sizing:border-box}
    .im-panel{pointer-events:auto;width:min(960px,calc(100vw - 24px));background:rgba(18,18,22,.86);backdrop-filter:blur(22px);-webkit-backdrop-filter:blur(22px);border:1px solid rgba(255,255,255,.1);border-bottom:none;border-radius:18px 18px 0 0;box-shadow:0 -10px 50px rgba(0,0,0,.5);overflow:hidden;max-height:0;opacity:0;transition:max-height .32s cubic-bezier(.2,.8,.2,1),opacity .25s}
    #inko-music.open .im-panel{max-height:460px;opacity:1}
    .im-tabs{display:flex;gap:4px;padding:12px 14px 0}
    .im-tab{flex:0 0 auto;display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border:none;background:transparent;color:var(--text2,#a8a8b3);border-radius:9px;font-size:12.5px;font-weight:600;cursor:pointer}
    .im-tab svg{width:15px;height:15px}
    .im-tab.on{background:rgba(255,255,255,.09);color:#fff}
    .im-content{padding:14px;max-height:380px;overflow:auto}
    .im-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
    .im-station{position:relative;height:78px;border-radius:13px;border:none;cursor:pointer;overflow:hidden;text-align:left;padding:11px 12px;color:#fff;display:flex;flex-direction:column;justify-content:flex-end;box-shadow:0 4px 16px rgba(0,0,0,.3)}
    .im-station .nm{font-weight:700;font-size:13.5px;text-shadow:0 1px 4px rgba(0,0,0,.5)}
    .im-station .sb{font-size:10.5px;opacity:.92;text-shadow:0 1px 3px rgba(0,0,0,.5)}
    .im-station .rd{position:absolute;top:9px;right:9px;width:18px;height:18px;opacity:.85}
    .im-station.on{outline:2px solid #fff;outline-offset:-2px}
    .im-station .eq{position:absolute;top:10px;right:10px;display:flex;gap:2px;align-items:flex-end;height:14px}
    .im-station .eq i{width:3px;background:#fff;border-radius:2px;animation:imEq .9s ease-in-out infinite}
    .im-station .eq i:nth-child(2){animation-delay:.2s}.im-station .eq i:nth-child(3){animation-delay:.4s}
    @keyframes imEq{0%,100%{height:4px}50%{height:14px}}
    .im-embed{margin-top:12px;border-radius:12px;overflow:hidden}
    .im-embed iframe{width:100%;border:none;display:block}
    .im-row{display:flex;gap:8px;margin-bottom:10px}
    .im-input{flex:1;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:#fff;padding:9px 12px;border-radius:9px;font-size:12.5px}
    .im-input:focus{outline:none;border-color:var(--orange,#ff6b1a)}
    .im-btn{background:var(--orange,#ff6b1a);color:#fff;border:none;padding:9px 14px;border-radius:9px;font-size:12.5px;font-weight:600;cursor:pointer}
    .im-btn.green{background:#1db954}
    .im-hint{font-size:11.5px;color:var(--text3,#7a7a86);line-height:1.5;margin-bottom:10px}
    .im-list{margin-top:4px}
    .im-li{display:flex;align-items:center;gap:9px;padding:8px 10px;border-radius:9px;cursor:pointer;font-size:12.5px;color:var(--text,#f0f0f2)}
    .im-li:hover{background:rgba(255,255,255,.06)}
    .im-li.cur{background:rgba(255,107,26,.14);color:var(--orange,#ff6b1a);font-weight:600}
    .im-li img{width:34px;height:34px;border-radius:6px;object-fit:cover;flex-shrink:0;background:rgba(255,255,255,.06)}
    .im-li .n{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .im-spprof{display:flex;align-items:center;gap:10px;padding:8px 4px 12px;margin-bottom:6px;border-bottom:1px solid rgba(255,255,255,.08)}
    .im-spprof img{width:40px;height:40px;border-radius:50%;object-fit:cover}
    .im-spprof-ph{width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#1db954;color:#fff}
    .im-spprof-ph svg{width:22px;height:22px}
    .im-spprof-meta{flex:1;min-width:0}
    .im-spprof-meta .nm{font-size:13.5px;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .im-spprof-meta .sb{font-size:11px;color:#1db954;font-weight:600}
    .im-spprof-x{background:rgba(255,255,255,.08);border:none;color:#cfcfd6;font-size:11.5px;padding:6px 11px;border-radius:8px;cursor:pointer}
    .im-spprof-x:hover{background:rgba(255,255,255,.16);color:#fff}
    /* Barre */
    .im-bar{pointer-events:auto;width:min(960px,calc(100vw - 24px));height:64px;display:flex;align-items:center;gap:12px;padding:0 14px;background:rgba(18,18,22,.92);backdrop-filter:blur(22px);-webkit-backdrop-filter:blur(22px);border:1px solid rgba(255,255,255,.1);border-radius:14px;margin:0 0 12px;box-shadow:0 8px 40px rgba(0,0,0,.5)}
    #inko-music.open .im-bar{border-radius:0 0 14px 14px;margin-top:0}
    .im-art{width:42px;height:42px;border-radius:9px;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#fff;background:linear-gradient(135deg,#fc5c7d,#6a82fb)}
    .im-art svg{width:20px;height:20px}
    .im-art img{width:100%;height:100%;object-fit:cover;border-radius:9px}
    .im-meta{flex:1;min-width:0}
    .im-meta .t{font-size:13px;font-weight:600;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .im-meta .s{font-size:11px;color:var(--text3,#8a8a94);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .im-ctr{display:flex;align-items:center;gap:4px}
    .im-ico{background:none;border:none;color:#e8e8ee;cursor:pointer;width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;transition:background .15s}
    .im-ico:hover{background:rgba(255,255,255,.1)}
    .im-ico.on{color:var(--orange,#ff6b1a)}
    #im-repeat{position:relative}
    .im-rep1{position:absolute;top:2px;right:2px;font-size:8px;font-weight:800;background:var(--orange,#ff6b1a);color:#fff;border-radius:6px;min-width:11px;height:11px;display:flex;align-items:center;justify-content:center;line-height:1;padding:0 1px}
    .im-ico svg{width:18px;height:18px}
    .im-ico.pp{background:#fff;color:#111;width:40px;height:40px}
    .im-ico.pp:hover{background:#fff;transform:scale(1.05)}
    .im-ico.pp svg{width:20px;height:20px}
    .im-vol{display:flex;align-items:center;gap:6px;color:#9a9aa6}
    .im-vol input{width:74px;accent-color:var(--orange,#ff6b1a)}
    .im-x{color:#9a9aa6}
    #inko-music.open .im-chev svg{transform:rotate(180deg)}
    .im-chev svg{transition:transform .3s}
    .im-progress{position:absolute;left:14px;right:14px;bottom:4px;height:3px;border-radius:2px;background:rgba(255,255,255,.12);overflow:hidden}
    .im-progress i{display:block;height:100%;width:0;background:var(--orange,#ff6b1a)}
    @media(max-width:640px){ .im-vol{display:none} .im-bar{height:60px} }
    /* Pastille minimale */
    .im-pill{pointer-events:auto;position:fixed;right:18px;bottom:18px;width:54px;height:54px;border-radius:50%;border:none;cursor:pointer;color:#fff;display:none;align-items:center;justify-content:center;background:linear-gradient(135deg,#ff6b1a,#ff9a3c);box-shadow:0 10px 30px rgba(255,107,26,.45);transition:transform .15s}
    .im-pill:hover{transform:scale(1.07)}
    .im-pill svg{width:24px;height:24px}
    .im-pill .peq{position:absolute;bottom:8px;display:flex;gap:2px;align-items:flex-end;height:9px}
    .im-pill .peq i{width:2.5px;background:#fff;border-radius:2px;animation:imEq .9s ease-in-out infinite}
    .im-pill .peq i:nth-child(2){animation-delay:.2s}.im-pill .peq i:nth-child(3){animation-delay:.4s}
    #inko-music.min .im-bar,#inko-music.min .im-panel{display:none}
    #inko-music.min .im-pill{display:flex}
    `;

    function injectCSS() { const s = document.createElement('style'); s.id = 'im-css'; s.textContent = css; document.head.appendChild(s); }

    // ══════════════════════ DOM ══════════════════════
    function build() {
        root = document.createElement('div');
        root.id = 'inko-music';
        root.innerHTML = `
            <div class="im-panel">
                <div class="im-tabs">
                    <button class="im-tab" data-tab="stations">${ICON.radio}<span>Stations</span></button>
                    <button class="im-tab" data-tab="spotify">${ICON.spotify}<span>Spotify</span></button>
                    <button class="im-tab" data-tab="youtube">${ICON.youtube}<span>YouTube</span></button>
                    <button class="im-tab" data-tab="local">${ICON.folder}<span>Fichiers</span></button>
                </div>
                <div class="im-content" id="im-content"></div>
            </div>
            <div class="im-bar">
                <div class="im-art" id="im-art">${ICON.note}</div>
                <div class="im-meta"><div class="t" id="im-t">Choisis une ambiance</div><div class="s" id="im-s">Lecteur Inko</div></div>
                <div class="im-ctr">
                    <button class="im-ico" id="im-prev" title="Précédent">${ICON.prev}</button>
                    <button class="im-ico pp" id="im-pp" title="Lecture/Pause">${ICON.play}</button>
                    <button class="im-ico" id="im-next" title="Suivant">${ICON.next}</button>
                </div>
                <div class="im-vol">${ICON.vol}<input type="range" id="im-vol" min="0" max="1" step="0.01" value="${S.vol}"></div>
                <button class="im-ico" id="im-repeat" title="Répéter">${ICON.repeat}</button>
                <button class="im-ico" id="im-timer" title="Minuterie de sommeil">${ICON.timer}</button>
                <button class="im-ico im-chev" id="im-exp" title="Agrandir">${ICON.chevron}</button>
                <button class="im-ico" id="im-min" title="Réduire en pastille">${ICON.minus}</button>
                <button class="im-ico im-x" id="im-close" title="Fermer et arrêter">${ICON.close}</button>
                <div class="im-progress" id="im-prog" style="display:none"><i></i></div>
            </div>
            <button class="im-pill" id="im-pill" title="Rouvrir le lecteur">${ICON.note}<span class="peq" style="display:none"><i></i><i></i><i></i></span></button>`;
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
    function open()  { S.visible = true; S.min = false; root.classList.remove('min'); root.style.display = 'flex'; setExpanded(true); save(); }
    function show()  { S.visible = true; if (!S.min) root.style.display = 'flex'; save(); }
    function close() { stopAll(); S.visible = false; S.min = false; root.classList.remove('min'); root.style.display = 'none'; save(); }
    function toggle() { if (root.style.display === 'none') open(); else if (root.classList.contains('min')) restore(); else setExpanded(!root.classList.contains('open')); }
    // Réduit en pastille (la musique continue) ↔ rouvre la barre
    function minimize() { root.classList.add('min'); root.classList.remove('open'); S.min = true; updatePill(); save(); }
    function restore()  { root.classList.remove('min'); S.min = false; S.visible = true; root.style.display = 'flex'; save(); }
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
            const on = (S.mode === 'yt' && el.dataset.yt === S.ytId) || (S.mode === 'sp' && el.dataset.sp === S.spId);
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
        if (S.tab === 'spotify')  return renderSpotify(c);
        if (S.tab === 'youtube')  return renderYouTube(c);
        if (S.tab === 'local')    return renderLocal(c);
    }

    function renderStations(c) {
        c.innerHTML = `<div class="im-grid">` + STATIONS.map(st => `
            <button class="im-station" data-id="${st.id}" ${st.yt ? `data-yt="${st.yt}"` : ''} ${st.sp ? `data-sp="${st.sp}"` : ''}
                style="background:linear-gradient(135deg,${st.g[0]},${st.g[1]})">
                <span class="rd">${ICON.radio}</span>
                <span class="eq" style="display:none"><i></i><i></i><i></i></span>
                <span class="nm">${st.name}</span><span class="sb">${st.sub}</span>
            </button>`).join('') + `</div>`;
        c.querySelectorAll('.im-station').forEach(el => el.onclick = () => {
            const st = STATIONS.find(s => s.id === el.dataset.id);
            if (st.yt) playYouTube(st.yt, st.name, 'Station · ' + st.sub, st.g);
            else playSpotify('playlist', st.sp, st.name, 'Spotify · ' + st.sub, st.g);
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

    function renderSpotify(c) {
        c.innerHTML = `
            <div id="im-spprofile"></div>
            <div class="im-hint">Écoute immédiate (sans connexion) :</div>
            <div class="im-grid" id="im-sppre"></div>
            <div id="im-spconnected" style="margin-top:12px"></div>`;
        const pres = [
            ['37i9dQZF1DWWQRwui0ExPn', 'Lo-Fi Beats', ['#1db954', '#1ed760']],
            ['37i9dQZF1DWYoYGBbGKurt', 'Lofi Chill', ['#643cc6', '#a445b2']],
            ['37i9dQZF1DX4sWSpwq3LiO', 'Peaceful Piano', ['#2c3e50', '#4ca1af']],
            ['37i9dQZF1DWZeKCadgRdKQ', 'Deep Focus', ['#11998e', '#38ef7d']],
        ];
        c.querySelector('#im-sppre').innerHTML = pres.map(([id, nm, g]) => `
            <button class="im-station" data-sp="${id}" style="height:62px;background:linear-gradient(135deg,${g[0]},${g[1]})">
                <span class="nm">${nm}</span><span class="sb">Spotify</span></button>`).join('');
        c.querySelectorAll('#im-sppre .im-station').forEach(el => el.onclick = () =>
            playSpotify('playlist', el.dataset.sp, el.querySelector('.nm').textContent, 'Spotify', ['#1db954', '#1ed760']));
        renderSpotifyConnected();
    }

    function connectSpotify() {
        window.open(API.spotify.loginUrl(), 'inkoSpotifyAuth', 'width=480,height=760');
        let n = 0; const iv = setInterval(async () => { n++; try { const s = await API.spotify.status(); if (s.linked) { clearInterval(iv); renderSpotify(root.querySelector('#im-content')); } } catch (e) {} if (n > 90) clearInterval(iv); }, 2000);
    }
    function spTrackRows(tracks) {
        return (tracks || []).map(t =>
            `<div class="im-li" data-sp="${t.id}" data-sptype="track" data-nm="${esc(t.name)}">
                <img src="${t.image || ''}" alt="" onerror="this.style.visibility='hidden'">
                <span class="n">${esc(t.name)}${t.artists ? ` · <span style="color:var(--text3,#7a7a86)">${esc(t.artists)}</span>` : ''}</span>
            </div>`).join('');
    }
    function spPlRows(pls) {
        return (pls || []).map(p =>
            `<div class="im-li" data-sp="${p.id}" data-sptype="playlist" data-nm="${esc(p.name)}">
                <img src="${p.image || ''}" alt="" onerror="this.style.visibility='hidden'">
                <span class="n">${esc(p.name)}</span><span style="font-size:10.5px;color:var(--text3,#7a7a86)">${p.tracks || ''}</span>
            </div>`).join('');
    }
    function bindSpRows(scope) {
        if (!scope) return;
        scope.querySelectorAll('.im-li[data-sp]').forEach(el => el.onclick = () =>
            playSpotify(el.dataset.sptype, el.dataset.sp, el.dataset.nm,
                el.dataset.sptype === 'track' ? 'Titre Spotify' : 'Playlist Spotify', ['#1db954', '#1ed760']));
    }
    async function renderSpotifyConnected() {
        const box = root.querySelector('#im-spconnected');
        const prof = root.querySelector('#im-spprofile');
        if (!box || !window.API || !API.spotify) return;
        let st;
        try { st = await API.spotify.status(); } catch (e) { return; }
        if (!st.configured) {
            if (prof) prof.innerHTML = '';
            box.innerHTML = `<div class="im-hint">Pour lier ton compte Spotify, configure SPOTIFY_CLIENT_ID/SECRET côté serveur puis reviens ici.</div>`;
            return;
        }
        if (!st.linked) {
            if (prof) prof.innerHTML = '';
            box.innerHTML = `<button class="im-btn green" id="im-splink" style="width:100%">${ICON.spotify} Connecter mon compte Spotify</button>
                <div class="im-hint" style="margin-top:8px">Accède à tes playlists, ta recherche et tes écoutes récentes.</div>`;
            box.querySelector('#im-splink').onclick = connectSpotify;
            return;
        }
        // Bandeau profil
        if (prof) {
            prof.innerHTML = `
                <div class="im-spprof">
                    ${st.profile?.avatar ? `<img src="${st.profile.avatar}" alt="">` : `<div class="im-spprof-ph">${ICON.spotify}</div>`}
                    <div class="im-spprof-meta"><div class="nm">${esc(st.profile?.name || 'Spotify')}</div><div class="sb">${st.profile?.product === 'premium' ? 'Premium' : 'Connecté'}</div></div>
                    <button class="im-spprof-x" id="im-spunlink">Déconnecter</button>
                </div>`;
            prof.querySelector('#im-spunlink').onclick = async () => {
                try { await API.spotify.disconnect(); } catch (e) {}
                renderSpotify(root.querySelector('#im-content'));
            };
        }
        // Recherche + sections
        box.innerHTML = `
            <div class="im-row"><input class="im-input" id="im-spq" placeholder="Rechercher un titre, une playlist…"><button class="im-btn green" id="im-spgo">Chercher</button></div>
            <div id="im-spresults"></div>
            <div class="im-hint" style="margin-top:10px">Tes titres du moment</div>
            <div class="im-list" id="im-sptop"><div class="im-hint">Chargement…</div></div>
            <div class="im-hint" style="margin-top:8px">Titres aimés</div>
            <div class="im-list" id="im-spsaved"><div class="im-hint">Chargement…</div></div>
            <div class="im-hint" style="margin-top:8px">Écoutés récemment</div>
            <div class="im-list" id="im-sprecent"><div class="im-hint">Chargement…</div></div>
            <div class="im-hint" style="margin-top:8px">Tes playlists</div>
            <div class="im-list" id="im-sppl"><div class="im-hint">Chargement…</div></div>`;
        const doSearch = async () => {
            const q = box.querySelector('#im-spq').value.trim();
            const res = box.querySelector('#im-spresults');
            if (!q) { res.innerHTML = ''; return; }
            res.innerHTML = `<div class="im-hint">Recherche…</div>`;
            try {
                const { tracks, playlists } = await API.spotify.search(q);
                res.innerHTML = (tracks.length || playlists.length)
                    ? spTrackRows(tracks) + spPlRows(playlists)
                    : `<div class="im-hint">Aucun résultat.</div>`;
                bindSpRows(res);
            } catch (e) { res.innerHTML = `<div class="im-hint">Erreur de recherche.</div>`; }
        };
        box.querySelector('#im-spgo').onclick = doSearch;
        box.querySelector('#im-spq').onkeydown = e => { if (e.key === 'Enter') doSearch(); };
        // Chargeur générique de section "titres"
        const loadTracks = async (sel, fn, emptyMsg) => {
            const el = box.querySelector(sel); if (!el) return;
            try {
                const { tracks } = await fn();
                el.innerHTML = (tracks && tracks.length) ? spTrackRows(tracks) : `<div class="im-hint">${emptyMsg}</div>`;
                bindSpRows(el);
            } catch (e) { el.innerHTML = `<div class="im-hint">${emptyMsg}</div>`; }
        };
        loadTracks('#im-sptop', () => API.spotify.top(), 'Pas encore de statistiques.');
        loadTracks('#im-spsaved', () => API.spotify.saved(), 'Aucun titre aimé.');
        loadTracks('#im-sprecent', () => API.spotify.recent(), "Rien pour l'instant.");
        // Playlists
        try {
            const pls = await API.spotify.playlists();
            const el = box.querySelector('#im-sppl');
            el.innerHTML = pls.length ? spPlRows(pls) : `<div class="im-hint">Aucune playlist.</div>`;
            bindSpRows(el);
        } catch (e) { const el = box.querySelector('#im-sppl'); if (el) el.innerHTML = ''; }
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
    function showEmbedInPanel(node) {
        // Affiche l'embed dans le panneau (Spotify) ; pour YouTube on garde l'audio en fond
        const c = root.querySelector('#im-content');
        let slot = c.querySelector('.im-embed');
        if (!slot) { slot = document.createElement('div'); slot.className = 'im-embed'; c.appendChild(slot); }
        slot.appendChild(node);
    }
    function playYouTube(id, label, sub, g) {
        stopLocal(); stopSpotify();
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

    // ══════════════════════ LECTURE — Spotify (IFrame API) ══════════════════════
    let spCtrl = null, spApi = null;
    function ensureSpotify(cb) {
        if (spApi) return cb(spApi);
        window.onSpotifyIframeApiReady = (api) => { spApi = api; cb(api); };
        if (!document.getElementById('im-spapi')) { const s = document.createElement('script'); s.id = 'im-spapi'; s.src = 'https://open.spotify.com/embed/iframe-api/v1'; document.head.appendChild(s); }
    }
    function playSpotify(type, id, label, sub, g) {
        stopLocal(); stopYouTube();
        S.mode = 'sp'; S.spId = id; S.label = label; S.sub = sub; save();
        setMeta(label, sub, ICON.spotify);
        if (g) root.querySelector('#im-art').style.background = `linear-gradient(135deg,${g[0]},${g[1]})`;
        const uri = `spotify:${type}:${id}`;
        ensureSpotify(api => {
            // Contrôleur monté hors-écran : la musique continue même barre réduite
            const host = mediaContainer();
            let slot = document.getElementById('im-spembed');
            if (!slot) { slot = document.createElement('div'); slot.id = 'im-spembed'; host.appendChild(slot); }
            slot.innerHTML = '';
            api.createController(slot, { uri, width: '300', height: '80' }, ctrl => {
                spCtrl = ctrl;
                ctrl.addListener('playback_update', e => { if (e.data) setPlaying(!e.data.isPaused); });
                ctrl.play();
            });
        });
        show();
    }

    // ══════════════════════ LECTURE — Fichiers locaux ══════════════════════
    function playLocal(i) {
        if (i < 0 || i >= localQueue.length) return;
        stopYouTube(); stopSpotify();
        S.mode = 'local'; localIdx = i; save();
        localAudio.src = localQueue[i].url; localAudio.volume = S.vol; localAudio.play().catch(() => {});
        setMeta(localQueue[i].name, `${i + 1} / ${localQueue.length} · fichier local`, ICON.note);
        root.querySelector('#im-art').style.background = 'linear-gradient(135deg,#ff6b1a,#ff9a3c)';
        renderQueue(); show();
    }

    // ══════════════════════ CONTRÔLES UNIFIÉS ══════════════════════
    function togglePlay() {
        if (S.mode === 'local') { localAudio.paused ? localAudio.play() : localAudio.pause(); }
        else if (S.mode === 'yt' && ytPlayer) { playing ? ytPlayer.pauseVideo() : ytPlayer.playVideo(); }
        else if (S.mode === 'sp' && spCtrl) { spCtrl.togglePlay(); }
        else if (!S.mode) { S.tab = 'stations'; open(); }
    }
    function skip(d) {
        if (S.mode === 'local') { if (localQueue.length) playLocal((localIdx + d + localQueue.length) % localQueue.length); return; }
        // stations : passe à la station suivante/précédente
        const list = STATIONS;
        let idx = list.findIndex(s => (s.yt && s.yt === S.ytId) || (s.sp && s.sp === S.spId));
        if (idx < 0) idx = 0; const st = list[(idx + d + list.length) % list.length];
        if (st.yt) playYouTube(st.yt, st.name, 'Station · ' + st.sub, st.g);
        else playSpotify('playlist', st.sp, st.name, 'Spotify · ' + st.sub, st.g);
    }
    function setVolume(v) {
        S.vol = v; save(); localAudio.volume = v;
        if (ytPlayer && ytPlayer.setVolume) ytPlayer.setVolume(v * 100);
        if (spCtrl && spCtrl.setVolume) try { spCtrl.setVolume(v); } catch (e) {}
        const sl = root.querySelector('#im-vol'); if (sl && +sl.value !== v) sl.value = v;
    }
    function stopYouTube() { try { if (ytPlayer) ytPlayer.stopVideo?.(); } catch (e) {} }
    function stopSpotify() { try { if (spCtrl) spCtrl.pause?.(); } catch (e) {} const e = document.getElementById('im-spembed'); if (e) e.innerHTML = ''; }
    function stopLocal()   { try { localAudio.pause(); } catch (e) {} }
    function stopAll() { stopYouTube(); stopSpotify(); stopLocal(); setPlaying(false); }

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
    function esc(s) { return (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

    // ══════════════════════ Init ══════════════════════
    function init() {
        injectCSS(); build();
        root.style.display = S.visible ? 'flex' : 'none';
        if (S.visible && S.min) root.classList.add('min');
        // Reprise inter-pages : recharge la dernière station (les flux live reprennent)
        if (S.visible && S.mode === 'yt' && S.ytId) playYouTube(S.ytId, S.label, S.sub);
        else if (S.visible && S.mode === 'sp' && S.spId) playSpotify('playlist', S.spId, S.label, S.sub);
    }

    window.Music = { open, close, toggle, show, playStationId: id => { const s = STATIONS.find(x => x.id === id); if (s) { s.yt ? playYouTube(s.yt, s.name, 'Station · ' + s.sub, s.g) : playSpotify('playlist', s.sp, s.name, 'Spotify · ' + s.sub, s.g); } } };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
