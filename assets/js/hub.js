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
    // VIII.44 : l'identite du hub auquel CET appareil s'est appaire. Le PC
    // recoit son adresse en DHCP ; au redemarrage de la box, `192.168.1.34`
    // devient `192.168.1.52`. Retenir une adresse, c'est retenir une place de
    // parking, pas une personne.
    const CLE_ID = 'inko_hub_id';
    function lireId() {
        try { return localStorage.getItem(CLE_ID) || null; } catch (e) { return null; }
    }
    function ecrireId(id) {
        try { if (id) localStorage.setItem(CLE_ID, id); } catch (e) { /* stockage refuse */ }
    }

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
    async function tester(origine, verifierIdentite) {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 6000);
        try {
            const r = await fetch(origine + '/api/health', { signal: ctrl.signal, cache: 'no-store' });
            if (!r.ok) return { ok: false, raison: `le serveur a répondu ${r.status}` };
            const j = await r.json().catch(() => ({}));

            // ── VIII.44 : est-ce bien LE hub de cet appareil ? ──
            // Une adresse locale n'appartient a personne. Le bail DHCP qui
            // designait le PC hier peut designer la console de quelqu'un
            // d'autre aujourd'hui, et un serveur qui repond `/api/health` a
            // l'adresse memorisee est, sans cette verification, indistinguable
            // du bon.
            //
            // Le refus est EXPLICITE : se rabattre en silence sur le mode hors
            // ligne cacherait un demenagement du hub derriere une panne
            // reseau, et l'utilisateur chercherait des heures du mauvais cote.
            const attendu = verifierIdentite === false ? null : lireId();
            if (attendu && j.hubId && j.hubId !== attendu) {
                return { ok: false, autreHub: true, raison:
                    'ce serveur n’est pas celui auquel ce téléphone est appairé '
                    + '— l’adresse a changé de main' };
            }
            // Un hub plus ancien ne renvoie pas d'identite : on ne bloque pas
            // pour autant. Refuser de fonctionner avec un serveur qui n'a pas
            // encore ete mis a jour transformerait une amelioration en panne.
            return { ok: true, version: j.version || null, hubId: j.hubId || null };
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
    async function appairer(origine, code, idAttendu) {
        // Le nom sert cote PC, dans « Appareils connectes », a decider lequel
        // revoquer quand on en perd un. `navigator.platform` rend « Linux
        // armv8l » : trois telephones de la maison porteraient le meme nom, et
        // revoquer reviendrait a tirer au sort. Le greffon Device rend le
        // constructeur et le modele.
        const nom = (window.INKO_NATIF && await window.INKO_NATIF.nomAppareil())
            || navigator.userAgentData?.platform || navigator.platform || 'Téléphone';
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

        // Le QR a ete lu devant le PC ; cette reponse est arrivee par le
        // reseau. Si les deux identites different, quelque chose s'est
        // interpose entre le telephone et le hub. On n'enregistre RIEN : un
        // appairage est un lien durable, et le nouer sur un doute reviendrait a
        // remettre la bibliotheque a l'intermediaire.
        if (idAttendu && j.hubId && j.hubId !== idAttendu) {
            return { ok: false, raison: 'le serveur qui a répondu n’est pas celui du QR '
                + '— appairage annulé par précaution' };
        }

        try {
            localStorage.setItem(CLE_JETON, j.token);
            ecrire(origine);
            // C'est ICI, et seulement ici, que le lien se noue : le QR ne
            // s'obtient que devant le PC. Tout controle ulterieur se compare a
            // cette valeur.
            ecrireId(j.hubId || null);
        } catch (e) { return { ok: false, raison: 'stockage local refusé' }; }
        return { ok: true, user: j.user };
    }

    /**
     * Y a-t-il des chapitres téléchargés sur cet appareil ?
     *
     * C'est la question qui décide si un hub injoignable est un CUL-DE-SAC ou
     * une simple gêne. `downloads.js` range ses métadonnées dans IndexedDB
     * ('inko-dl' > 'chapters') ; on les compte sans charger le module, qui
     * n'est pas présent sur toutes les pages.
     */
    function chapitresHorsLigne() {
        return new Promise((resolve) => {
            let fini = false;
            const repondre = (n) => { if (!fini) { fini = true; resolve(n); } };
            // Une base qui ne s'ouvre pas ne doit pas bloquer le démarrage :
            // au pire, on se comporte comme s'il n'y avait rien.
            setTimeout(() => repondre(0), 2500);
            try {
                // ⚠ `indexedDB.open(nom)` SANS version CRÉE la base si elle
                // n'existe pas — vide, en version 1. `downloads.js` l'ouvre
                // ensuite en version 1, ne déclenche donc aucune mise à
                // niveau, et son magasin `chapters` n'est JAMAIS créé : plus
                // aucun téléchargement possible, définitivement, sur une
                // installation neuve.
                //
                // Constaté ici même : `version=1 stores=` (aucun magasin).
                // On reprend donc la MÊME création que `downloads.js`, pour
                // que la base soit valide quel que soit celui qui l'ouvre en
                // premier. Une simple lecture ne doit jamais laisser la
                // structure dans un état que personne d'autre ne peut réparer.
                const req = indexedDB.open('inko-dl', 1);
                req.onupgradeneeded = () => {
                    const db = req.result;
                    if (!db.objectStoreNames.contains('chapters')) {
                        const os = db.createObjectStore('chapters', { keyPath: 'chapterId' });
                        os.createIndex('mangaId', 'mangaId', { unique: false });
                    }
                };
                req.onerror = () => repondre(0);
                req.onblocked = () => repondre(0);
                req.onsuccess = () => {
                    const db = req.result;
                    if (!db.objectStoreNames.contains('chapters')) { repondre(0); return; }
                    const c = db.transaction('chapters', 'readonly').objectStore('chapters').count();
                    c.onsuccess = () => repondre(c.result || 0);
                    c.onerror = () => repondre(0);
                };
            } catch (e) { repondre(0); }
        });
    }

    /** Le QR encode `{ v, hub, code }`. On accepte aussi un code seul. */
    // Identite annoncee par le QR qui vient d'etre scanne. Elle sert de
    // TEMOIN : elle a ete obtenue physiquement devant le PC, la reponse
    // d'appairage vient du reseau. Les deux doivent coincider.
    let _idDuQR = null;

    function lireCharge(texte) {
        const t = String(texte || '').trim();
        if (!t) return null;
        if (t.startsWith('{')) {
            try {
                const o = JSON.parse(t);
                if (o && o.code) return { hub: o.hub || null, code: String(o.code).toUpperCase(), hubId: o.hubId || null };
            } catch (e) { /* pas du JSON : on tente le code seul */ }
        }
        if (/^[A-Z0-9]{4}-?[A-Z0-9]{4}$/i.test(t)) return { hub: null, code: t.toUpperCase() };
        return null;
    }

    function ecran(messageInitial) {
        if (document.getElementById('inko-hub-config')) return;   // déjà affiché
        console.log('[inko-hub] ecran-configuration-affiche');
        const veil = document.createElement('div');
        veil.id = 'inko-hub-config';
        // Les propriétés qui font que ce voile COUVRE l'écran sont posées en
        // ligne, pas dans la feuille : mesuré, le voile sortait en 48×48 px —
        // présent, au-dessus de tout, et invisible. La page d'accueil
        // s'affichait derrière, et l'utilisateur n'avait aucun moyen de
        // connecter l'app.
        //
        // Un écran bloquant ne doit pas dépendre d'une feuille de style que la
        // page hôte peut contredire. Le reste de l'habillage reste en CSS.
        veil.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;'
            + 'z-index:2147483000;display:flex;align-items:center;justify-content:center;'
            + 'padding:24px;background:#0f0f12;color:#eee;overflow:auto;'
            + 'box-sizing:border-box;font-family:system-ui,-apple-system,sans-serif';
        veil.innerHTML = `
        <style>
          /* La géométrie du voile est posée en ligne (voir hub.js) : elle ne
             doit pas pouvoir être contredite par la feuille de la page. */
          #inko-hub-config .boite{width:100%;max-width:420px}
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

          <button id="hubChercher" style="background:#2a2a33;color:#eee">Rechercher mon hub sur le r&eacute;seau</button>
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
        const boutonChercher = veil.querySelector('#hubChercher');

        // ── P2.8 : « Rechercher mon hub sur le réseau » ──────
        //
        // Taper « 192.168.1.34:8088 » au doigt est l'endroit où l'on fait le
        // plus de fautes de frappe — et l'adresse change toute seule au
        // renouvellement du bail DHCP. La découverte évite les deux.
        //
        // Le bouton reste VISIBLE même hors de l'application : il explique
        // alors pourquoi il ne peut rien faire. Un bouton qui disparaît laisse
        // croire que la fonction n'existe pas.
        if (boutonChercher) {
            boutonChercher.addEventListener('click', async () => {
                if (!window.INKO_NATIF || !window.INKO_NATIF.decouvrirHubs) {
                    etat.className = 'etat ko';
                    etat.textContent = 'La recherche automatique n’existe que dans l’application '
                        + 'Android. Saisis l’adresse à la main — elle marche aussi bien.';
                    return;
                }
                boutonChercher.disabled = true;
                const libelle = boutonChercher.textContent;
                boutonChercher.textContent = 'Recherche…';
                etat.className = 'etat';
                etat.textContent = 'Recherche des hubs sur le réseau local…';
                try {
                    const r = await window.INKO_NATIF.decouvrirHubs(4000);
                    const hubs = (r && r.hubs) || [];
                    if (!hubs.length) {
                        etat.className = 'etat ko';
                        // Le multicast est filtré sur beaucoup de réseaux — Wi-Fi
                        // invité, isolation de points d'accès, réseaux
                        // d'entreprise. Dire « aucun hub » sans dire pourquoi
                        // ferait conclure que le PC est éteint.
                        etat.textContent = 'Aucun hub trouvé. Vérifie que le PC est allumé et sur le '
                            + 'même Wi-Fi. Certains réseaux (Wi-Fi invité, entreprise) bloquent la '
                            + 'recherche automatique : l’adresse saisie à la main fonctionne quand même.';
                        return;
                    }
                    // Un hub déjà connu passe devant : c'est presque toujours
                    // celui qu'on cherche, et son identité le prouve.
                    const connu = lireId();
                    const prefere = hubs.find(h => connu && h.hubId === connu) || hubs[0];
                    champ.value = prefere.url || ('http://' + prefere.hote + ':' + prefere.port);
                    etat.className = 'etat ok';
                    etat.textContent = hubs.length === 1
                        ? 'Trouvé : ' + (prefere.nom || champ.value)
                            + (connu && prefere.hubId === connu ? ' — c’est bien ton hub.' : '.')
                        : hubs.length + ' hubs trouvés. Le plus probable est ' + (prefere.nom || champ.value)
                            + ' — corrige l’adresse si ce n’est pas le bon.';
                } catch (e) {
                    etat.className = 'etat ko';
                    etat.textContent = 'Recherche impossible : ' + e.message;
                } finally {
                    boutonChercher.disabled = false;
                    boutonChercher.textContent = libelle;
                }
            });
        }

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
            const a = await appairer(origine, code, _idDuQR);
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
                video.style.cssText = 'position:fixed;top:0;right:0;bottom:0;left:0;width:100%;height:100%;object-fit:cover;z-index:2147483001';
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
                                _idDuQR = charge.hubId || null;
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

    // Trace lisible dans logcat (Capacitor y renvoie la console). Elle sert au
    // contrôle automatique de démarrage : sans elle, « l'écran de configuration
    // s'affiche-t-il ? » ne se vérifiait qu'à l'œil, sur une capture.
    console.log('[inko-hub] etat=' + (window.INKO_HUB ? 'configure:' + window.INKO_HUB : 'non-configure')
        + ' jeton=' + (window.INKO_TOKEN ? 'present' : 'absent'));

    /**
     * Le premier ecran, en mode autonome. Il PRESENTE, il ne barre pas :
     * un bouton pour continuer sans PC, un autre pour en connecter un.
     *
     * Il n'est montre qu'une fois. Reposer la question a chaque lancement
     * ferait de l'option un mur deguise — exactement ce qu'on retire.
     */
    function accueilAutonome() {
        // Trace lue par `scripts-ci/emulateur-demarrage.sh` : c'est elle qui
        // prouve, sur un vrai Android, que l'app ne laisse pas l'utilisateur
        // devant une page vide sans issue.
        console.log('[inko-hub] accueil-autonome-affiche');
        const v = document.createElement('div');
        v.id = 'inko-accueil-autonome';
        // Comme pour l'ecran d'appairage : les proprietes qui font que ce
        // panneau COUVRE l'ecran sont posees en ligne. Mesure par le passe,
        // le voile sortait en 48x48 px quand il dependait d'une feuille que
        // la page hote pouvait contredire.
        v.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;'
            + 'z-index:2147483000;display:flex;align-items:center;justify-content:center;'
            + 'padding:24px;background:#0f0f12;color:#eee;overflow:auto;'
            + 'box-sizing:border-box;font-family:system-ui,-apple-system,sans-serif';
        v.innerHTML = '<div style="max-width:420px;text-align:center">'
            + '<div style="font-size:56px;line-height:1;margin-bottom:14px">愛</div>'
            + '<h1 style="font-size:22px;margin:0 0 10px">Bienvenue dans Inko</h1>'
            + '<p style="color:#aaa;line-height:1.55;margin:0 0 22px">'
            + 'L’application fonctionne seule : elle interroge <b>MangaDex</b> '
            + 'directement, et tes lectures téléchargées, tes fichiers '
            + 'importés et tes notes vivent sur ce téléphone.<br><br>'
            + 'Connecter un ordinateur où tourne Inko ajoute <b>toutes les autres '
            + 'sources</b> et la synchronisation entre appareils — mais ce n’est '
            + 'pas obligatoire, et ça se fait plus tard.'
            + '</p>'
            + '<button id="iaSeul" style="width:100%;padding:14px;border-radius:12px;border:0;'
            + 'background:#c1531b;color:#fff;font-size:16px;font-weight:600;cursor:pointer">'
            + 'Commencer sans ordinateur</button>'
            + '<button id="iaLier" style="width:100%;margin-top:10px;padding:13px;border-radius:12px;'
            + 'border:1px solid #444;background:transparent;color:#ddd;font-size:15px;cursor:pointer">'
            + 'Connecter un ordinateur</button>'
            + '<p style="color:#666;font-size:12px;margin-top:16px">'
            + 'Tu pourras le faire à tout moment dans Paramètres → Connexion au hub.</p>'
            + '</div>';
        document.body.appendChild(v);

        const retenir = () => { try { localStorage.setItem('inko_autonome_vu', '1'); } catch (e) { /* stockage refuse */ } };
        v.querySelector('#iaSeul').addEventListener('click', () => { retenir(); v.remove(); });
        v.querySelector('#iaLier').addEventListener('click', () => { retenir(); v.remove(); ecran(''); });
    }

    // ── Rien de configuré : l'app s'ouvre QUAND MEME ────────
    //
    // Le mur d'appairage a longtemps ete presente comme legitime : « sans hub
    // et sans rien de telecharge, il n'y a rien a montrer ». C'etait vrai de
    // l'implementation, pas de l'utilisateur. Installer une application et
    // tomber sur « configure un serveur » avant d'avoir rien vu, c'est lui
    // demander de meriter son acces — et la plupart des gens desinstallent.
    //
    // Le rapport est inverse : l'application s'ouvre, et connecter un PC
    // devient une OPTION, dans les parametres, quand on en veut plus. C'est
    // ce que fait Discord avec son QR code : l'app marche, et le scan ajoute
    // quelque chose.
    //
    // `INKO_AUTONOME` dit aux pages qu'elles ne doivent RIEN attendre du
    // reseau. Sans ce drapeau, `api.js` se rabat sur `localhost:8088` — une
    // adresse qui n'existe pas sur un telephone : chaque appel partirait
    // attendre un delai d'expiration, et l'app aurait l'air cassee plutot que
    // simplement non connectee.
    if (!window.INKO_HUB) {
        window.INKO_AUTONOME = true;
        const ouvrir = () => chapitresHorsLigne().then((n) => {
            if (n) {
                // Appareil deja appaire, configuration effacee (nettoyage du
                // navigateur), chapitres restes : on le dit, sans bloquer.
                window.INKO_HORS_LIGNE = true;
                bandeauHorsLigne(n, 'aucun serveur configuré');
                return;
            }
            // Premiere ouverture : on presente le choix UNE fois, et on le
            // retient. Reposer la question a chaque lancement transformerait
            // l'option en mur deguise.
            // `localStorage` peut LEVER, pas seulement rendre null : navigation
            // privee, cookies bloques, certains WebView d'entreprise. Sans
            // cette garde, l'exception remontait dans la chaine de promesses
            // et l'ecran d'accueil ne s'affichait jamais — mesure faite dans
            // un navigateur qui refuse le stockage, ou l'appel a bien leve
            // « Access is denied for this document ».
            //
            // En cas de doute on MONTRE l'ecran : le revoir une fois de trop
            // est benin, ne jamais le voir laisse l'utilisateur devant une app
            // qui a l'air vide sans expliquer pourquoi.
            let dejaVu = false;
            try { dejaVu = !!localStorage.getItem('inko_autonome_vu'); } catch (e) { dejaVu = false; }
            if (!dejaVu) accueilAutonome();
        });
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ouvrir);
        else ouvrir();
        return;
    }

    // ── P2.3 : hub injoignable ≠ application inutile ────────
    // Première version : un hub qui ne répond plus rouvrait l'écran de
    // configuration, PAR-DESSUS tout. C'était un mur — et précisément dans le
    // métro, avec des chapitres téléchargés sur l'appareil, l'app devenait
    // inutilisable alors qu'elle avait tout ce qu'il fallait pour lire.
    //
    // La règle : on ne bloque QUE s'il n'y a rien à lire. Sinon on annonce le
    // mode hors ligne, on laisse la page ouverte, et on propose les deux
    // sorties utiles — les téléchargements, et la correction de l'adresse.
    /**
     * P2.8 / VIII.44, point 2 : « Re-découverte mDNS au démarrage : chercher
     * `_inko._tcp.local`, comparer le `hub_id` annoncé, mettre à jour
     * l'adresse EN SILENCE. »
     *
     * C'est le point qui rend le reste utile. Le bail DHCP change, le hub
     * déménage — et l'utilisateur n'a rien fait, ne comprend pas, et devrait
     * aller rescanner un QR devant le PC pour un événement dont il n'est pas
     * responsable.
     *
     * Le silence n'est possible QUE parce que l'identité existe : on ne
     * bascule que vers un hub dont le `hubId` annoncé est celui mémorisé à
     * l'appairage. Un hub inconnu, même seul sur le réseau, n'est jamais
     * adopté tout seul — c'est exactement le danger que l'audit signale.
     *
     * @returns {Promise<boolean>} true si l'adresse a été corrigée
     */
    async function retrouverParDecouverte() {
        const connu = lireId();
        if (!connu || !window.INKO_NATIF || !window.INKO_NATIF.decouvrirHubs) return false;
        const r = await window.INKO_NATIF.decouvrirHubs(4000);
        const cible = ((r && r.hubs) || []).find(h => h.hubId === connu);
        if (!cible || !cible.url || cible.url === window.INKO_HUB) return false;

        // On VERIFIE avant d'écrire : une annonce mDNS peut être périmée (le
        // hub vient de s'éteindre, l'annonce met des minutes à expirer).
        // Écrire une adresse morte remplacerait une panne par une autre.
        const essai = await tester(cible.url);
        if (!essai.ok) return false;

        ecrire(cible.url);
        window.INKO_HUB = cible.url;
        console.log('[inko-hub] adresse corrigée par découverte : ' + cible.url);
        return true;
    }

    window.addEventListener('load', async () => {
        const r = await tester(window.INKO_HUB);
        if (r.ok) return;

        // Avant de conclure à une panne : le hub a peut-être simplement changé
        // d'adresse. On recharge alors la page, parce que les appels partis
        // avant la correction ont déjà échoué — et remettre chaque état à jour
        // un par un serait dix fois le même travail, fait dix fois à moitié.
        if (!r.autreHub && await retrouverParDecouverte()) {
            window.location.reload();
            return;
        }

        // Un AUTRE hub a repris l'adresse : ce n'est pas une panne reseau, et
        // le mode hors ligne serait un mensonge. On le dit, et on renvoie vers
        // le seul geste qui repare — refaire l'appairage devant le PC.
        if (r.autreHub) {
            ecran('L’adresse ' + window.INKO_HUB + ' répond, mais ce n’est pas '
                + 'ton hub : une autre machine l’occupe désormais. Scanne un nouveau '
                + 'code depuis ton PC.');
            return;
        }

        const n = await chapitresHorsLigne();
        if (!n) {
            ecran('Le serveur configuré (' + window.INKO_HUB + ') ne répond plus : ' + r.raison + '.');
            return;
        }
        window.INKO_HORS_LIGNE = true;
        bandeauHorsLigne(n, r.raison);
    });

    /**
     * Bandeau de mode hors ligne. Fixe en bas — la barre du haut porte déjà la
     * navigation, et sur un téléphone le pouce atteint le bas.
     * Non bloquant, et refermable : il informe, il n'interrompt pas.
     */
    function bandeauHorsLigne(nb, raison) {
        if (document.getElementById('inko-hors-ligne')) return;
        const el = document.createElement('div');
        el.id = 'inko-hors-ligne';
        el.setAttribute('role', 'status');
        // `bottom` deux fois, et c'est indispensable : `env()` est du Chrome 69.
        // Le WebView d'Android 8 — la cible même de cette application — ne sait
        // pas lire la seconde et la jette. Sans la première, il n'aurait AUCUN
        // `bottom` et le bandeau « Hors ligne » irait se coller en haut de
        // l'écran, par-dessus l'en-tête.
        el.style.cssText = 'position:fixed;left:12px;right:12px;bottom:76px;'
            + 'bottom:calc(64px + env(safe-area-inset-bottom, 0px) + 12px);'
            + 'z-index:2147482000;display:flex;gap:10px;align-items:center;flex-wrap:wrap;'
            + 'padding:12px 14px;border-radius:12px;background:#2a2118;border:1px solid #6b4a22;'
            + 'color:#f0d9b8;font-size:13px;line-height:1.5;'
            + 'font-family:system-ui,-apple-system,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.4)';
        el.innerHTML = '<span style="flex:1 1 200px;min-width:0">'
            + '<b>Hors ligne</b> — le serveur ne répond pas (' + esc(raison) + ').<br>'
            + esc(String(nb)) + ' chapitre(s) téléchargé(s) restent lisibles.'
            + '</span>'
            + '<a href="downloads.html" style="min-height:44px;display:inline-flex;align-items:center;'
            + 'padding:0 14px;border-radius:9px;background:#ff8c42;color:#111;font-weight:700;'
            + 'text-decoration:none">Mes téléchargements</a>'
            + '<button type="button" data-hl="config" style="min-height:44px;padding:0 12px;border-radius:9px;'
            + 'background:transparent;border:1px solid #6b4a22;color:#f0d9b8;cursor:pointer">Changer d\'adresse</button>'
            + '<button type="button" data-hl="fermer" aria-label="Fermer" style="min-height:44px;min-width:44px;'
            + 'background:transparent;border:none;color:#f0d9b8;font-size:18px;cursor:pointer">×</button>';
        document.body.appendChild(el);
        el.querySelector('[data-hl="config"]').addEventListener('click', () => ecran(''));
        el.querySelector('[data-hl="fermer"]').addEventListener('click', () => el.remove());
    }

    function esc(t) {
        return String(t == null ? '' : t)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    // ── VIII.44 : le telephone change de Wi-Fi ──────────────
    // « Detection, bascule hors ligne, reprise au retour — sans
    // intervention. » Sans ca, on quitte la maison et l'app continue d'appeler
    // une adresse locale qui ne designe plus rien : trente secondes d'attente
    // par page, puis une erreur reseau qui n'explique pas qu'on a simplement
    // change de reseau.
    //
    // On ne bascule PAS a la moindre variation : un changement de reseau ne
    // dit pas que le hub est parti — il peut etre joignable depuis le nouveau.
    // On reteste, et c'est le resultat qui decide.
    if (window.INKO_NATIF) {
        let derniere = null;
        window.INKO_NATIF.surReseau(async (etat) => {
            const cle = etat.connecte ? etat.type : 'aucun';
            if (cle === derniere) return;           // meme etat : rien de neuf
            derniere = cle;

            if (!etat.connecte) {
                // Plus de reseau du tout : inutile de tester quoi que ce soit.
                if (!window.INKO_HORS_LIGNE) {
                    const n = await chapitresHorsLigne();
                    if (n) { window.INKO_HORS_LIGNE = true; bandeauHorsLigne(n, 'aucun réseau'); }
                }
                return;
            }

            const r = await tester(window.INKO_HUB);
            if (r.ok) {
                // Le hub est revenu. On recharge plutot que de lever le
                // drapeau en place : les pages ont deja rendu leurs etats
                // hors-ligne, et les remettre a jour une par une serait dix
                // fois le meme travail, fait dix fois a moitie.
                if (window.INKO_HORS_LIGNE) window.location.reload();
                return;
            }
            // Changer de réseau, c'est justement le moment où l'adresse du hub
            // n'est plus la bonne : on rentre chez soi, le PC a redémarré, la
            // box lui a donné un autre bail. La découverte le retrouve sans
            // rien demander.
            if (!r.autreHub && await retrouverParDecouverte()) {
                window.location.reload();
                return;
            }
            if (window.INKO_HORS_LIGNE) return;     // deja signale
            const n = await chapitresHorsLigne();
            if (n) { window.INKO_HORS_LIGNE = true; bandeauHorsLigne(n, r.raison); }
        });
    }

    // Permet de changer de hub depuis les réglages de l'app.
    window.INKO_changerHub = () => ecran('');
})();
