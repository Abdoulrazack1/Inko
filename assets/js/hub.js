// ============================================================
// hub.js — à quel serveur ce téléphone parle-t-il ?
// ------------------------------------------------------------
// Chargé UNIQUEMENT dans l'APK (injecté par `scripts-ci/build-mobile-www.js`),
// et AVANT `api.js`, qui lit `window.INKO_HUB` pour décider où partent ses
// appels.
//
// ── Le modèle, rappelé ──────────────────────────────────────
// L'app ne scrape rien. Les 9 extensions d'Inko utilisent `cheerio`, un repli
// `curl` pour contourner l'empreinte TLS bloquée par Cloudflare, et des
// en-têtes `Referer`/`User-Agent` qu'un navigateur INTERDIT de définir : un
// WebView ne peut structurellement pas les exécuter (audit VIII.2). Le
// téléphone est donc un client du hub — le PC, le NAS ou le VPS où tourne
// déjà Inko.
//
// ── Pourquoi aucune adresse par défaut ──────────────────────
// Une adresse de hub ne se devine pas. Pointer au hasard sur
// `192.168.1.1:8088` produirait un échec réseau que l'utilisateur ne saurait
// pas interpréter — il conclurait que l'app est cassée. Tant que rien n'est
// configuré, on affiche un écran qui DEMANDE l'adresse, et aucune requête ne
// part.
(function () {
    'use strict';

    const CLE = 'inko_hub_url';

    function lire() {
        try { return localStorage.getItem(CLE) || null; } catch (e) { return null; }
    }
    function ecrire(url) {
        try { localStorage.setItem(CLE, url); } catch (e) { /* stockage refusé */ }
    }

    /**
     * Normalise ce que l'utilisateur tape. On accepte large — « 192.168.1.34 »,
     * « 192.168.1.34:8088 », « http://192.168.1.34:8088/ » — parce qu'une
     * adresse saisie au doigt sur un téléphone est l'endroit où l'on fait le
     * plus de fautes de frappe, et refuser sur un slash final serait hostile.
     */
    function normaliser(saisie) {
        let s = String(saisie || '').trim();
        if (!s) return null;
        if (!/^https?:\/\//i.test(s)) s = 'http://' + s;
        let u;
        try { u = new URL(s); } catch (e) { return null; }
        if (!u.hostname) return null;
        // Port par défaut d'Inko quand l'utilisateur n'en donne pas : c'est
        // celui qu'affiche le serveur au démarrage.
        if (!u.port && u.protocol === 'http:') u.port = '8088';
        return u.origin;
    }

    const CLE_JETON = 'inko_device_token';

    window.INKO_HUB = lire();
    // Le jeton d'appareil est posé sur `window` avant `api.js`, qui s'en sert
    // comme Bearer : l'app n'a pas de cookie, l'origine du WebView n'étant pas
    // celle du hub.
    try { window.INKO_TOKEN = localStorage.getItem(CLE_JETON) || null; } catch (e) { window.INKO_TOKEN = null; }

    /**
     * Vérifie qu'un hub répond VRAIMENT, avant de l'enregistrer. Sans ce
     * contrôle, une adresse mal tapée serait acceptée en silence et toutes les
     * pages échoueraient ensuite, sans que rien ne désigne la cause.
     */
    async function tester(origine) {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 6000);
        try {
            const r = await fetch(origine + '/api/health', { signal: ctrl.signal, cache: 'no-store' });
            if (!r.ok) return { ok: false, raison: `le serveur a répondu ${r.status}` };
            const j = await r.json().catch(() => ({}));
            return { ok: true, version: j.version || null };
        } catch (e) {
            return { ok: false, raison: e.name === 'AbortError'
                ? 'pas de réponse en 6 secondes'
                : 'injoignable — vérifie que le PC est allumé et sur le même réseau' };
        } finally { clearTimeout(t); }
    }

    /**
     * Appaire ce téléphone avec un code affiché sur le PC (audit VIII.5.1).
     * Le code fait foi : aucune authentification préalable n'est nécessaire,
     * et c'est LUI qui désigne le compte — treize comptes ont une
     * bibliothèque dans cette base, en supposer un ferait lire la mauvaise.
     */
    async function appairer(origine, code) {
        const nom = (navigator.userAgentData?.platform || navigator.platform || 'Téléphone');
        const r = await fetch(origine + '/api/devices/pair', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                code,
                nom: 'Inko sur ' + nom,
                plateforme: 'android',
                appVersion: '1.0.0',
            }),
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) return { ok: false, raison: j.error || `le serveur a répondu ${r.status}` };
        try {
            localStorage.setItem(CLE_JETON, j.token);
            ecrire(origine);
        } catch (e) { return { ok: false, raison: 'stockage local refusé' }; }
        return { ok: true, user: j.user };
    }

    /** Le QR encode `{ v, hub, code }`. On accepte aussi un code seul. */
    function lireCharge(texte) {
        const t = String(texte || '').trim();
        if (!t) return null;
        if (t.startsWith('{')) {
            try {
                const o = JSON.parse(t);
                if (o && o.code) return { hub: o.hub || null, code: String(o.code).toUpperCase() };
            } catch (e) { /* pas du JSON : on tente le code seul */ }
        }
        if (/^[A-Z0-9]{4}-?[A-Z0-9]{4}$/i.test(t)) return { hub: null, code: t.toUpperCase() };
        return null;
    }

    function ecran(messageInitial) {
        const veil = document.createElement('div');
        veil.id = 'inko-hub-config';
        veil.innerHTML = `
        <style>
          #inko-hub-config{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;
            justify-content:center;padding:24px;background:#0f0f12;color:#eee;
            font-family:system-ui,-apple-system,'Segoe UI',sans-serif}
          #inko-hub-config .boite{width:min(420px,100%)}
          #inko-hub-config h1{font-size:21px;font-weight:700;margin:0 0 6px}
          #inko-hub-config p{font-size:13.5px;line-height:1.6;color:#aaa;margin:0 0 18px}
          #inko-hub-config label{display:block;font-size:12px;color:#bbb;margin-bottom:6px}
          #inko-hub-config input{width:100%;background:#1c1c22;border:1px solid #3a3a44;color:#eee;
            padding:14px;border-radius:10px;font-size:16px;min-height:48px}
          #inko-hub-config input:focus{outline:none;border-color:#ff8c42}
          #inko-hub-config button{width:100%;margin-top:12px;min-height:48px;border:none;border-radius:10px;
            background:#ff8c42;color:#111;font-size:15px;font-weight:700;cursor:pointer}
          #inko-hub-config button[disabled]{opacity:.55}
          #inko-hub-config .etat{font-size:13px;margin-top:14px;line-height:1.5;min-height:20px}
          #inko-hub-config .ko{color:#ff9d9d}
          #inko-hub-config .ok{color:#7ee2a8}
          #inko-hub-config .aide{font-size:12px;color:#888;margin-top:18px;line-height:1.6}
        </style>
        <div class="boite">
          <h1>Connecter cette application</h1>
          <p>Inko lit ta biblioth&egrave;que depuis l'ordinateur o&ugrave; il tourne.
             Sur le PC&nbsp;: <b>Param&egrave;tres &rarr; Appareils &rarr; Afficher le code</b>.</p>

          <label for="hubAddr">Adresse du serveur</label>
          <input id="hubAddr" type="url" inputmode="url" autocapitalize="off" autocorrect="off"
                 spellcheck="false" placeholder="192.168.1.34:8088" value="${(lire() || '').replace(/"/g, '&quot;')}">

          <label for="hubCode" style="margin-top:14px">Code d'appairage</label>
          <input id="hubCode" type="text" inputmode="text" autocapitalize="characters" autocorrect="off"
                 spellcheck="false" placeholder="7F3A-92B1" maxlength="9">

          <button id="hubScan" style="background:#2a2a33;color:#eee">Scanner le QR code</button>
          <button id="hubGo">Connecter</button>
          <div class="etat" id="hubEtat">${messageInitial || ''}</div>
          <div class="aide">
            Le code est valable 2 minutes et ne sert qu'une fois. Le t&eacute;l&eacute;phone et
            l'ordinateur doivent &ecirc;tre sur le m&ecirc;me r&eacute;seau Wi-Fi.
          </div>
        </div>`;
        document.documentElement.appendChild(veil);

        const champ = veil.querySelector('#hubAddr');
        const bouton = veil.querySelector('#hubGo');
        const etat = veil.querySelector('#hubEtat');

        const champCode = veil.querySelector('#hubCode');
        const boutonScan = veil.querySelector('#hubScan');

        const valider = async () => {
            const origine = normaliser(champ.value);
            if (!origine) { etat.className = 'etat ko'; etat.textContent = 'Adresse illisible.'; return; }
            bouton.disabled = true;
            etat.className = 'etat';
            etat.textContent = 'Connexion à ' + origine + '…';

            // 1. Le serveur répond-il ? Sans ce contrôle, une adresse mal tapée
            //    serait acceptée en silence et toutes les pages échoueraient
            //    ensuite, sans que rien ne désigne la cause.
            const r = await tester(origine);
            if (!r.ok) {
                bouton.disabled = false;
                etat.className = 'etat ko';
                etat.textContent = 'Échec : ' + r.raison;
                return;
            }

            // 2. Le code d’appairage désigne le COMPTE. Sans lui, on ne saurait
            //    pas quelle bibliothèque lire — et en supposer une ferait lire
            //    celle de quelqu’un d’autre (audit XVI.1).
            const code = String(champCode.value || '').trim().toUpperCase();
            if (!code) {
                bouton.disabled = false;
                etat.className = 'etat ko';
                etat.textContent = 'Serveur joignable, mais il manque le code d’appairage. '
                    + 'Sur le PC : Paramètres → Appareils → Afficher le code.';
                return;
            }
            etat.textContent = 'Appairage…';
            const a = await appairer(origine, code);
            if (!a.ok) {
                bouton.disabled = false;
                etat.className = 'etat ko';
                etat.textContent = a.raison;
                return;
            }
            etat.className = 'etat ok';
            etat.textContent = 'Connecté' + (a.user && a.user.username ? ' en tant que ' + a.user.username : '')
                + '. Chargement…';
            setTimeout(() => window.location.reload(), 500);
        };

        // Scan du QR — `BarcodeDetector` est présent dans le WebView Android
        // récent. Absent, on ne masque PAS le bouton : on explique, et la saisie
        // manuelle reste là. Un bouton qui disparaît laisse croire que la
        // fonction n’existe pas, là où un message dit quoi faire.
        boutonScan.addEventListener('click', async () => {
            if (!('BarcodeDetector' in window)) {
                etat.className = 'etat ko';
                etat.textContent = 'Cet appareil ne sait pas lire les QR codes depuis le navigateur. '
                    + 'Saisis le code à la main — il fonctionne aussi bien.';
                return;
            }
            try {
                const flux = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
                const video = document.createElement('video');
                video.setAttribute('playsinline', '');
                video.srcObject = flux;
                video.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;object-fit:cover;z-index:2147483001';
                document.documentElement.appendChild(video);
                await video.play();

                const detecteur = new window.BarcodeDetector({ formats: ['qr_code'] });
                const arreter = () => { flux.getTracks().forEach(t => t.stop()); video.remove(); };
                const boucle = async () => {
                    if (!video.isConnected) return;
                    try {
                        const codes = await detecteur.detect(video);
                        if (codes.length) {
                            const charge = lireCharge(codes[0].rawValue);
                            if (charge) {
                                arreter();
                                if (charge.hub) champ.value = charge.hub;
                                champCode.value = charge.code;
                                valider();
                                return;
                            }
                        }
                    } catch (e) { /* image illisible : on retente */ }
                    requestAnimationFrame(boucle);
                };
                video.addEventListener('click', arreter);   // toucher l’image annule
                boucle();
            } catch (e) {
                etat.className = 'etat ko';
                etat.textContent = 'Caméra indisponible ('
                    + (e.name === 'NotAllowedError' ? 'accès refusé' : e.message)
                    + '). Saisis le code à la main.';
            }
        });

        bouton.addEventListener('click', valider);
        champCode.addEventListener('keydown', (e) => { if (e.key === 'Enter') valider(); });
        champ.addEventListener('keydown', (e) => { if (e.key === 'Enter') champCode.focus(); });
        (lire() ? champCode : champ).focus();
    }

    // Rien de configuré : on demande, et on n'exécute pas le reste de la page.
    if (!window.INKO_HUB) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => ecran(''));
        } else { ecran(''); }
        return;
    }

    // Un hub est configuré, mais il peut avoir changé d'adresse (DHCP), être
    // éteint, ou être resté sur un autre réseau. On le vérifie une fois par
    // lancement, sans bloquer l'affichage : si la vérification échoue, on
    // propose de corriger l'adresse plutôt que de laisser chaque page échouer
    // une par une.
    window.addEventListener('load', async () => {
        const r = await tester(window.INKO_HUB);
        if (!r.ok) ecran('Le serveur configuré (' + window.INKO_HUB + ') ne répond plus : ' + r.raison + '.');
    });

    // Permet de changer de hub depuis les réglages de l'app.
    window.INKO_changerHub = () => ecran('');
})();
