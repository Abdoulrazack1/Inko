// player.js — Mini lecteur de musique (popout persistant)
(function () {
    'use strict';

    // ── Tabs ──
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(t => t.addEventListener('click', () => {
        tabs.forEach(x => x.classList.remove('active'));
        document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
        t.classList.add('active');
        document.getElementById('p-' + t.dataset.tab).classList.add('active');
        try { localStorage.setItem('mh_music_tab', t.dataset.tab); } catch(e) {}
    }));
    // Restore last tab
    try {
        const last = localStorage.getItem('mh_music_tab');
        if (last) document.querySelector(`.tab[data-tab="${last}"]`)?.click();
    } catch(e) {}

    // ════════════════════ LOCAL FILES ════════════════════
    const audio = document.getElementById('audio');
    const pickBtn = document.getElementById('pickBtn');
    const fileInput = document.getElementById('fileInput');
    const localPlayer = document.getElementById('localPlayer');
    let queue = [];      // { name, url }
    let idx = -1;
    let looping = false;

    const PLAY_SVG  = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
    const PAUSE_SVG = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>';
    function setPlayIcon(isPlaying) {
        const p = document.getElementById('play');
        if (p) p.innerHTML = isPlaying ? PAUSE_SVG : PLAY_SVG;
    }

    pickBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
        const files = [...fileInput.files];
        if (!files.length) return;
        queue = files.map(f => ({ name: f.name.replace(/\.[^.]+$/, ''), url: URL.createObjectURL(f) }));
        localPlayer.style.display = 'block';
        renderPlaylist();
        playAt(0);
    });

    function renderPlaylist() {
        const el = document.getElementById('playlist');
        el.innerHTML = queue.map((t, i) =>
            `<div class="pl-item ${i === idx ? 'cur' : ''}" data-i="${i}"><span>${i === idx ? '▸' : ''}</span><span class="n">${esc(t.name)}</span></div>`
        ).join('');
        el.querySelectorAll('.pl-item').forEach(it =>
            it.addEventListener('click', () => playAt(+it.dataset.i)));
    }

    function playAt(i) {
        if (i < 0 || i >= queue.length) return;
        idx = i;
        audio.src = queue[i].url;
        audio.play().catch(() => {});
        document.getElementById('npTitle').textContent = queue[i].name;
        document.getElementById('npSub').textContent = `${i + 1} / ${queue.length}`;
        setPlayIcon(true);
        renderPlaylist();
    }

    const play = document.getElementById('play');
    play.addEventListener('click', () => {
        if (!queue.length) return;
        if (audio.paused) { audio.play(); setPlayIcon(true); }
        else { audio.pause(); setPlayIcon(false); }
    });
    document.getElementById('prev').addEventListener('click', () => { if (queue.length) playAt(idx - 1 < 0 ? queue.length - 1 : idx - 1); });
    document.getElementById('next').addEventListener('click', () => { if (queue.length) playAt((idx + 1) % queue.length); });
    const loopBtn = document.getElementById('loop');
    loopBtn.addEventListener('click', () => {
        looping = !looping;
        loopBtn.classList.toggle('on', looping);
    });

    audio.addEventListener('ended', () => {
        if (looping) playAt(idx);
        else if (idx + 1 < queue.length) playAt(idx + 1);
        else setPlayIcon(false);
    });
    audio.addEventListener('play',  () => setPlayIcon(true));
    audio.addEventListener('pause', () => setPlayIcon(false));

    const seek = document.getElementById('seek');
    audio.addEventListener('timeupdate', () => {
        if (audio.duration) {
            seek.value = (audio.currentTime / audio.duration) * 100;
            document.getElementById('tCur').textContent = fmt(audio.currentTime);
            document.getElementById('tDur').textContent = fmt(audio.duration);
        }
    });
    seek.addEventListener('input', () => { if (audio.duration) audio.currentTime = (seek.value / 100) * audio.duration; });
    const vol = document.getElementById('vol');
    vol.addEventListener('input', () => audio.volume = vol.value);
    audio.volume = 0.8;

    function fmt(s) { s = Math.floor(s || 0); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }

    // ════════════════════ SPOTIFY — linking de compte ════════════════════
    const hasSpotifyAPI = !!(window.API && window.API.spotify);

    function spShow(id) {
        ['spotifyNotConfig', 'spotifyConnect', 'spotifyLinked'].forEach(x => {
            const e = document.getElementById(x);
            if (e) e.style.display = (x === id) ? 'block' : 'none';
        });
    }

    async function initSpotify() {
        if (!hasSpotifyAPI) { spShow('spotifyNotConfig'); return; }
        try {
            const st = await API.spotify.status();
            if (!st.configured) { spShow('spotifyNotConfig'); return; }
            if (st.linked) renderSpotifyLinked(st);
            else spShow('spotifyConnect');
        } catch (e) { spShow('spotifyConnect'); }
    }

    function renderSpotifyLinked(st) {
        spShow('spotifyLinked');
        const p = st.profile || {};
        document.getElementById('spName').textContent = p.name || 'Compte Spotify';
        document.getElementById('spProduct').innerHTML = (p.product === 'premium')
            ? 'Compte <span class="sp-badge">PREMIUM</span>'
            : 'Compte gratuit';
        const av = document.getElementById('spAvatar');
        if (p.avatar) { av.src = p.avatar; av.style.display = ''; }
        else av.style.display = 'none';
        loadSpotifyPlaylists();
    }

    async function loadSpotifyPlaylists() {
        const box = document.getElementById('spPlaylists');
        box.innerHTML = '<div class="hint">Chargement de tes playlists…</div>';
        try {
            const pls = await API.spotify.playlists();
            if (!pls.length) { box.innerHTML = '<div class="hint">Aucune playlist trouvée sur ton compte.</div>'; return; }
            box.innerHTML = pls.map(p =>
                `<div class="pl-item" data-id="${esc(p.id)}">
                    <img class="pl-cover" src="${esc(p.image || '')}" alt="" onerror="this.style.visibility='hidden'">
                    <span class="n">${esc(p.name)}</span>
                    <span class="np-sub">${p.tracks}</span>
                 </div>`).join('');
            box.querySelectorAll('.pl-item').forEach(it => it.addEventListener('click', () => {
                loadSpotify('https://open.spotify.com/playlist/' + it.dataset.id);
                box.querySelectorAll('.pl-item').forEach(x => x.classList.remove('cur'));
                it.classList.add('cur');
            }));
        } catch (e) {
            box.innerHTML = '<div class="hint" style="color:#ef4444">Impossible de charger les playlists (reconnecte ton compte).</div>';
        }
    }

    let spPoll = null;
    // Cleanup du polling Spotify si la page est fermée (audit B4)
    window.addEventListener('beforeunload', () => { clearInterval(spPoll); });
    document.getElementById('spotifyLoginBtn')?.addEventListener('click', () => {
        const w = window.open(API.spotify.loginUrl(), 'inkoSpotifyAuth', 'width=480,height=760');
        const status = document.getElementById('spotifyConnectStatus');
        status.textContent = 'Autorise Inko dans la fenêtre Spotify qui vient de s\'ouvrir…';
        clearInterval(spPoll);
        let tries = 0;
        spPoll = setInterval(async () => {
            tries++;
            try {
                const st = await API.spotify.status();
                if (st.linked) {
                    clearInterval(spPoll);
                    try { w && w.close(); } catch (e) {}
                    status.textContent = '';
                    renderSpotifyLinked(st);
                }
            } catch (e) {}
            if (tries > 90) { clearInterval(spPoll); status.textContent = ''; } // ~3 min
        }, 2000);
    });

    document.getElementById('spotifyLogout')?.addEventListener('click', async () => {
        try { await API.spotify.disconnect(); } catch (e) {}
        document.getElementById('spotifyEmbed').innerHTML = '';
        spShow('spotifyConnect');
    });

    initSpotify();

    // ════════════════════ SPOTIFY — lien manuel (embed) ════════════════════
    function spotifyEmbedUrl(url) {
        // open.spotify.com/<type>/<id> → open.spotify.com/embed/<type>/<id>
        const m = url.match(/open\.spotify\.com\/(intl-\w+\/)?(playlist|album|track|artist|show|episode)\/([A-Za-z0-9]+)/);
        if (!m) return null;
        return `https://open.spotify.com/embed/${m[2]}/${m[3]}?utm_source=inko`;
    }
    function loadSpotify(url) {
        const embed = spotifyEmbedUrl(url);
        const box = document.getElementById('spotifyEmbed');
        if (!embed) { box.innerHTML = '<div class="hint" style="color:#ef4444">Lien Spotify invalide.</div>'; return; }
        box.innerHTML = `<iframe src="${embed}" height="380" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>`;
        try { localStorage.setItem('mh_music_spotify', url); } catch(e) {}
    }
    document.getElementById('spotifyLoad').addEventListener('click', () =>
        loadSpotify(document.getElementById('spotifyUrl').value.trim()));
    document.getElementById('spotifyUrl').addEventListener('keydown', e => {
        if (e.key === 'Enter') loadSpotify(e.target.value.trim());
    });
    try {
        const saved = localStorage.getItem('mh_music_spotify');
        if (saved) { document.getElementById('spotifyUrl').value = saved; loadSpotify(saved); }
    } catch(e) {}
    // Presets Spotify (écoute immédiate sans login)
    document.querySelectorAll('#spPresets .preset').forEach(b =>
        b.addEventListener('click', () => loadSpotify('https://open.spotify.com/playlist/' + b.dataset.sp)));

    // ════════════════════ YOUTUBE ════════════════════
    function ytEmbedUrl(url) {
        let id = null, list = null;
        const v = url.match(/[?&]v=([A-Za-z0-9_-]{11})/) || url.match(/youtu\.be\/([A-Za-z0-9_-]{11})/);
        if (v) id = v[1];
        const l = url.match(/[?&]list=([A-Za-z0-9_-]+)/);
        if (l) list = l[1];
        if (list) return `https://www.youtube.com/embed/videoseries?list=${list}&autoplay=1`;
        if (id)   return `https://www.youtube.com/embed/${id}?autoplay=1`;
        return null;
    }
    function loadYt(url) {
        const embed = ytEmbedUrl(url);
        const box = document.getElementById('ytEmbed');
        if (!embed) { box.innerHTML = '<div class="hint" style="color:#ef4444">Lien YouTube invalide.</div>'; return; }
        box.innerHTML = `<iframe src="${embed}" height="200" allow="autoplay; encrypted-media; picture-in-picture" loading="lazy" allowfullscreen></iframe>`;
        try { localStorage.setItem('mh_music_yt', url); } catch(e) {}
    }
    document.getElementById('ytLoad').addEventListener('click', () =>
        loadYt(document.getElementById('ytUrl').value.trim()));
    document.getElementById('ytUrl').addEventListener('keydown', e => {
        if (e.key === 'Enter') loadYt(e.target.value.trim());
    });
    try {
        const saved = localStorage.getItem('mh_music_yt');
        if (saved) document.getElementById('ytUrl').value = saved;
    } catch(e) {}
    // Presets YouTube (écoute immédiate)
    document.querySelectorAll('#ytPresets .preset').forEach(b =>
        b.addEventListener('click', () => loadYt('https://www.youtube.com/watch?v=' + b.dataset.yt)));

    function esc(s) { return (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
})();
