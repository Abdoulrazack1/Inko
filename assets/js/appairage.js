// ============================================================
// appairage.js — connecter un téléphone, et le déconnecter
// ------------------------------------------------------------
// Audit VIII.5.1. Deux écrans, dans les réglages du PC :
//
//   · « Connecter un appareil » — un QR à scanner, et le même code en clair
//     dessous, parce qu'une caméra refuse parfois de coopérer et qu'on ne
//     doit pas se retrouver bloqué pour autant.
//   · La liste des appareils appairés, chacun révocable d'un geste. C'est le
//     geste « j'ai perdu mon téléphone » : il coupe l'accès immédiatement.
//
// Le QR encode `{ v, hub, code }`. `hub` est l'adresse que le TÉLÉPHONE devra
// joindre — jamais 127.0.0.1, qui désignerait le téléphone lui-même. Le
// serveur la calcule depuis ses interfaces réseau ; le client ne la devine
// pas.
//
// Aucun gestionnaire en ligne : la CSP de l'app installée les bloque
// (DESK-01).
(function () {
    'use strict';
    if (window.MH?.ouvrirAppairage) return;

    const esc = (s) => window.MH?.esc ? window.MH.esc(s) : String(s ?? '');

    function styles() {
        if (document.getElementById('mh-appairage-css')) return;
        const s = document.createElement('style');
        s.id = 'mh-appairage-css';
        s.textContent = `
        .appr-modal{width:min(460px,95vw)}
        .appr-qr{display:flex;justify-content:center;padding:18px;background:#fff;border-radius:14px;margin:14px 0}
        .appr-qr img,.appr-qr canvas{display:block;image-rendering:pixelated}
        .appr-code{font-family:ui-monospace,'Cascadia Code',Consolas,monospace;font-size:26px;font-weight:700;
            letter-spacing:.10em;text-align:center;color:var(--text,#eee);margin:4px 0 2px}
        .appr-exp{font-size:12px;color:var(--text3,#888);text-align:center;margin-bottom:12px}
        .appr-exp.court{color:#e0a83a}
        .appr-etapes{font-size:13px;line-height:1.65;color:var(--text2,#bbb);margin:0;padding-left:18px}
        .appr-adr{font-size:12px;color:var(--text3,#888);text-align:center;margin-top:10px;
            font-family:ui-monospace,Consolas,monospace}
        .appr-liste{display:flex;flex-direction:column;gap:8px;margin-top:6px}
        .appr-item{display:flex;align-items:center;gap:12px;padding:11px 13px;border-radius:11px;
            border:1px solid var(--border,#333);background:var(--bg3,#202024)}
        .appr-item.revoque{opacity:.5}
        .appr-item-txt{flex:1 1 auto;min-width:0}
        .appr-item-nom{font-size:13.5px;font-weight:600;color:var(--text,#eee)}
        .appr-item-meta{font-size:11.5px;color:var(--text3,#888);margin-top:2px}
        .appr-vide{font-size:13px;color:var(--text2,#bbb);line-height:1.6;padding:10px 0}`;
        document.head.appendChild(s);
    }

    function veiler(largeurClasse) {
        styles();
        const veil = document.createElement('div');
        veil.className = 'mh-modal-veil';
        const boite = document.createElement('div');
        boite.className = 'mh-modal ' + (largeurClasse || 'appr-modal');
        boite.setAttribute('role', 'dialog');
        boite.setAttribute('aria-modal', 'true');
        veil.appendChild(boite);
        document.body.appendChild(veil);
        let minuteur = null;
        const fermer = () => {
            if (minuteur) clearInterval(minuteur);
            veil.classList.add('closing');
            setTimeout(() => veil.remove(), 160);
            document.removeEventListener('keydown', surTouche);
        };
        function surTouche(e) { if (e.key === 'Escape') { e.preventDefault(); fermer(); } }
        document.addEventListener('keydown', surTouche);
        veil.addEventListener('click', (e) => { if (e.target === veil) fermer(); });
        return { boite, fermer, poserMinuteur: (f) => { minuteur = f; } };
    }

    // Le générateur est vendorisé (`assets/vendor/qrcode.min.js`) : la CSP de
    // l'app installée interdit les scripts externes, et l'APK doit marcher
    // sans réseau. Chargé à la demande — il ne sert qu'ici.
    function chargerQR() {
        if (window.qrcode) return Promise.resolve(window.qrcode);
        return new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = '/assets/vendor/qrcode.min.js';
            s.onload = () => resolve(window.qrcode);
            s.onerror = () => reject(new Error('générateur de QR indisponible'));
            document.head.appendChild(s);
        });
    }

    async function ouvrirAppairage() {
        const { boite, fermer, poserMinuteur } = veiler();
        boite.innerHTML = `<div class="mh-modal-title">Connecter un appareil</div>
            <div class="appr-vide">Préparation du code…</div>`;

        let d;
        try {
            d = await window.API.devices.emettreCode();
        } catch (e) {
            boite.innerHTML = `<div class="mh-modal-title">Appairage impossible</div>
                <div class="appr-vide">${esc(e.message || 'Le serveur n’a pas répondu.')}</div>
                <div class="mh-modal-actions"><button class="mh-modal-btn primary" data-act="close">Fermer</button></div>`;
            boite.querySelector('[data-act="close"]').addEventListener('click', fermer);
            return;
        }

        // Sans adresse réseau, le QR ne servirait à rien : le téléphone ne
        // saurait pas qui joindre. On le dit plutôt que d'afficher un QR qui
        // mène nulle part.
        const sansReseau = !d.adresses || !d.adresses.length;

        boite.innerHTML = `
            <div class="mh-modal-title">Connecter un appareil</div>
            <ol class="appr-etapes">
              <li>Installe Inko sur ton téléphone et ouvre l'application.</li>
              <li>Scanne ce code, ou saisis-le à la main.</li>
            </ol>
            <div class="appr-qr" id="apprQr"></div>
            <div class="appr-code">${esc(d.code)}</div>
            <div class="appr-exp" id="apprExp"></div>
            ${sansReseau
        ? `<div class="appr-vide">⚠ Aucune adresse réseau détectée sur cet ordinateur.
                 Le téléphone ne pourra pas joindre ce hub tant qu'il n'est pas sur un
                 réseau — vérifie le Wi-Fi ou le câble.</div>`
        : `<div class="appr-adr">${d.adresses.map(a => esc(a)).join('<br>')}</div>`}
            <div class="mh-modal-actions">
              <button class="mh-modal-btn ghost" data-act="close">Fermer</button>
              <button class="mh-modal-btn primary" data-act="refaire">Nouveau code</button>
            </div>`;

        // Compte à rebours : un code qui expire sans le dire laisse
        // l'utilisateur essayer un code mort et conclure que l'app est cassée.
        const exp = new Date(d.expiresAt).getTime();
        const zoneExp = boite.querySelector('#apprExp');
        const tic = () => {
            const reste = Math.max(0, Math.round((exp - Date.now()) / 1000));
            if (reste === 0) {
                zoneExp.className = 'appr-exp court';
                zoneExp.textContent = 'Code expiré — demande un nouveau code.';
                return;
            }
            zoneExp.className = 'appr-exp' + (reste < 30 ? ' court' : '');
            zoneExp.textContent = `Valable encore ${reste} seconde${reste > 1 ? 's' : ''} · usage unique`;
        };
        tic();
        poserMinuteur(setInterval(tic, 1000));

        try {
            const qrcode = await chargerQR();
            // Type 0 = version choisie automatiquement selon la charge ;
            // correction 'M' = compromis habituel taille/robustesse pour un
            // code lu de près, sur écran.
            const q = qrcode(0, 'M');
            q.addData(d.qr);
            q.make();
            boite.querySelector('#apprQr').innerHTML = q.createImgTag(5, 8);
        } catch (e) {
            boite.querySelector('#apprQr').outerHTML =
                `<div class="appr-vide">Le QR n'a pas pu être affiché (${esc(e.message)}).
                 Saisis le code ci-dessous à la main — il fonctionne aussi bien.</div>`;
        }

        boite.querySelector('[data-act="close"]').addEventListener('click', fermer);
        boite.querySelector('[data-act="refaire"]').addEventListener('click', () => { fermer(); ouvrirAppairage(); });
    }

    async function ouvrirAppareils() {
        const { boite, fermer } = veiler();
        boite.innerHTML = `<div class="mh-modal-title">Appareils connectés</div>
            <div class="appr-vide">Chargement…</div>`;

        const rendre = async () => {
            let liste;
            try { liste = await window.API.devices.lister(); }
            catch (e) {
                boite.innerHTML = `<div class="mh-modal-title">Appareils connectés</div>
                    <div class="appr-vide">${esc(e.message)}</div>
                    <div class="mh-modal-actions"><button class="mh-modal-btn primary" data-act="close">Fermer</button></div>`;
                boite.querySelector('[data-act="close"]').addEventListener('click', fermer);
                return;
            }
            const ico = { android: '🤖', ios: '', desktop: '🖥', web: '🌐' };
            boite.innerHTML = `
                <div class="mh-modal-title">Appareils connectés</div>
                ${liste.length ? `<div class="appr-liste">${liste.map(d => `
                  <div class="appr-item ${d.revoked_at ? 'revoque' : ''}">
                    <span style="font-size:20px">${ico[d.plateforme] || '📱'}</span>
                    <span class="appr-item-txt">
                      <span class="appr-item-nom">${esc(d.nom)}</span>
                      <span class="appr-item-meta">${esc(d.plateforme)}${d.app_version ? ' · v' + esc(d.app_version) : ''}
                        ${d.revoked_at ? ' · déconnecté'
        : ` · ${d.sessionsActives} session${d.sessionsActives > 1 ? 's' : ''} active${d.sessionsActives > 1 ? 's' : ''}`}</span>
                    </span>
                    ${d.revoked_at ? '' : `<button class="mh-modal-btn ghost" data-revoquer="${esc(d.id)}">Déconnecter</button>`}
                  </div>`).join('')}</div>`
        : `<div class="appr-vide">Aucun appareil connecté pour l'instant.<br>
                     Utilise « Connecter un appareil » pour en ajouter un.</div>`}
                <div class="mh-modal-actions">
                  <button class="mh-modal-btn ghost" data-act="close">Fermer</button>
                  <button class="mh-modal-btn primary" data-act="ajouter">Connecter un appareil</button>
                </div>`;

            boite.querySelector('[data-act="close"]').addEventListener('click', fermer);
            boite.querySelector('[data-act="ajouter"]').addEventListener('click', () => { fermer(); ouvrirAppairage(); });
            boite.querySelectorAll('[data-revoquer]').forEach(b => {
                b.addEventListener('click', async () => {
                    // La déconnexion est irréversible côté appareil : il devra
                    // être réappairé. On le dit avant, pas après.
                    const ok = await window.MH.confirm(
                        'Cet appareil perdra immédiatement l’accès à ta bibliothèque et devra être reconnecté.',
                        { danger: true, okText: 'Déconnecter', title: 'Déconnecter cet appareil ?' });
                    if (!ok) return;
                    b.disabled = true;
                    try {
                        const r = await window.API.devices.revoquer(b.dataset.revoquer);
                        window.MH.toast(`Appareil déconnecté${r.sessionsFermees ? ` — ${r.sessionsFermees} session(s) fermée(s)` : ''}`);
                        rendre();
                    } catch (e) { b.disabled = false; window.MH.toast('Échec : ' + e.message); }
                });
            });
        };
        rendre();
    }

    window.MH = window.MH || {};
    window.MH.ouvrirAppairage = ouvrirAppairage;
    window.MH.ouvrirAppareils = ouvrirAppareils;

    document.addEventListener('click', (e) => {
        if (e.target.closest?.('[data-appairer]')) { e.preventDefault(); ouvrirAppairage(); }
        else if (e.target.closest?.('[data-appareils]')) { e.preventDefault(); ouvrirAppareils(); }
    });

    // ── P2.5 : activer les notifications, depuis les réglages ──
    //
    // La ligne reste CACHÉE hors de l'application mobile. Sur le PC, les
    // notifications de nouveaux chapitres passent déjà par le navigateur : en
    // proposer une seconde ici donnerait deux interrupteurs pour la même
    // chose, dont un sans le moindre effet.
    //
    // Et l'autorisation est demandée ICI, sur un geste explicite. Une demande
    // au premier lancement se refuse d'un réflexe — et Android ne la repose
    // JAMAIS. On aurait perdu la fonction pour toujours, en échange de rien.
    (function notificationsMobiles() {
        const ligne = document.getElementById('rowNotifsMobiles');
        const bouton = document.getElementById('btnNotifsMobiles');
        const etat = document.getElementById('notifsMobilesEtat');
        if (!ligne || !bouton || !window.INKO_NATIF?.demanderNotifications) return;
        ligne.hidden = false;

        bouton.addEventListener('click', async () => {
            bouton.disabled = true;
            const libelle = bouton.textContent;
            bouton.textContent = 'Activation…';
            try {
                // Deux transports, essayés dans cet ordre.
                //
                // FCM d'abord parce qu'il est plus RAPIDE : la notification
                // part du hub et arrive dans la seconde. Mais il exige un
                // projet Firebase, donc un compte Google — et sans ces clés il
                // n'existe tout simplement pas.
                //
                // La veille ensuite : le téléphone interroge lui-même le hub,
                // au plus toutes les quinze minutes. Plus lent, mais il marche
                // sans rien demander à personne — ce qui convient mieux à un
                // lecteur auto-hébergé.
                let r = await window.INKO_NATIF.demanderNotifications();
                if (!r.ok && window.INKO_NATIF.activerVeille) {
                    const v = await window.INKO_NATIF.activerVeille();
                    if (v.ok) r = v;
                }
                if (r.ok) {
                    bouton.textContent = 'Activées ✓';
                    etat.textContent = r.transport === 'veille'
                        ? 'Ce téléphone vérifie lui-même auprès du hub, au plus toutes les '
                          + (r.intervalleMinutes || 15) + ' minutes. Aucun service tiers n’est utilisé.'
                        : 'Ce téléphone sera prévenu des nouveaux chapitres des séries suivies.';
                    return;
                }
                bouton.disabled = false;
                bouton.textContent = libelle;
                // VIII.47 : dire la CONSÉQUENCE, pas le code. « Permission
                // denied » n'apprend rien ; savoir que la vérification manuelle
                // continue de marcher évite de croire la fonction perdue.
                etat.textContent = r.consequence
                    || ('Activation impossible : ' + (r.raison || 'raison inconnue')
                        + '. La vérification manuelle depuis la bibliothèque continue de marcher.');
            } catch (e) {
                bouton.disabled = false;
                bouton.textContent = libelle;
                etat.textContent = 'Activation impossible : ' + e.message;
            }
        });
    })();
})();

// ── P3.4 : réglage du mode une main ─────────────────────────
// Il n'apparaît qu'au doigt : à la souris, tout l'écran est déjà à portée du
// curseur, et proposer le réglage y serait du bruit.
//
// La case ARME le geste, elle n'active pas le mode en permanence — lire avec un
// tiers d'écran en moins serait absurde.
(function reglageUneMain() {
    const ligne = document.getElementById('rowUneMain');
    const cases = document.getElementById('chkUneMain');
    if (!ligne || !cases || !window.MH?.uneMain) return;
    ligne.hidden = false;
    cases.checked = window.MH.uneMain.arme();
    cases.addEventListener('change', () => {
        window.MH.uneMain.armer(cases.checked);
        if (cases.checked) window.MH.bandeau?.(
            'Balaie vers le bas depuis le bord inférieur de l’écran pour faire descendre la page.');
    });
})();
