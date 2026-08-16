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

    window.INKO_HUB = lire();

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
          <h1>À quel Inko se connecter&nbsp;?</h1>
          <p>Cette application lit ta bibliothèque depuis l'Inko qui tourne sur ton
             ordinateur. Indique son adresse sur le réseau local.</p>
          <label for="hubAddr">Adresse du serveur</label>
          <input id="hubAddr" type="url" inputmode="url" autocapitalize="off" autocorrect="off"
                 spellcheck="false" placeholder="192.168.1.34:8088" value="${(lire() || '').replace(/"/g, '&quot;')}">
          <button id="hubGo">Se connecter</button>
          <div class="etat" id="hubEtat">${messageInitial || ''}</div>
          <div class="aide">
            L'adresse s'affiche dans la fenêtre d'Inko sur ton ordinateur, au démarrage.
            Le téléphone et l'ordinateur doivent être sur le même réseau Wi-Fi.
          </div>
        </div>`;
        document.documentElement.appendChild(veil);

        const champ = veil.querySelector('#hubAddr');
        const bouton = veil.querySelector('#hubGo');
        const etat = veil.querySelector('#hubEtat');

        const valider = async () => {
            const origine = normaliser(champ.value);
            if (!origine) { etat.className = 'etat ko'; etat.textContent = 'Adresse illisible.'; return; }
            bouton.disabled = true;
            etat.className = 'etat';
            etat.textContent = 'Connexion à ' + origine + '…';
            const r = await tester(origine);
            if (!r.ok) {
                bouton.disabled = false;
                etat.className = 'etat ko';
                etat.textContent = 'Échec : ' + r.raison;
                return;
            }
            etat.className = 'etat ok';
            etat.textContent = 'Connecté' + (r.version ? ' — Inko ' + r.version : '') + '. Chargement…';
            ecrire(origine);
            setTimeout(() => window.location.reload(), 400);
        };

        bouton.addEventListener('click', valider);
        champ.addEventListener('keydown', (e) => { if (e.key === 'Enter') valider(); });
        champ.focus();
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
