// ============================================================
// eula.js — Modal d'acceptation au premier lancement
// ============================================================
// Affiché une seule fois, stocké dans localStorage. À charger sur
// toutes les pages publiques après global.js.
// ============================================================
(function () {
    'use strict';

    const KEY = 'mh_eula_v2';
    // Audit AMEL-110 : « Refuser » redirigeait vers un README sur GitHub sans
    // RIEN enregistrer. Deux problemes : l'app envoyait l'utilisateur hors
    // d'elle-meme sans le lui demander, et il suffisait de recharger la page
    // pour passer outre — le refus n'avait donc aucun effet. Il est desormais
    // memorise et respecte.
    const KEY_REFUS = 'mh_eula_refused';
    try {
        if (localStorage.getItem(KEY)) return;
        if (localStorage.getItem(KEY_REFUS)) {
            if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ecranRefus);
            else ecranRefus();
            return;
        }
    } catch (e) { return; }

    // Ecran de refus : explicite, DANS l'app, et reversible. Rediriger vers un
    // site externe n'est pas un parcours de refus, c'est un abandon — et ca
    // fait sortir l'utilisateur sans qu'il l'ait demande.
    function ecranRefus() {
        const o = document.createElement('div');
        o.id = 'mh-eula-refus';
        o.style.cssText = `position:fixed;top:0;right:0;bottom:0;left:0;background:#0d0d0f;z-index:99999;display:flex;
            align-items:center;justify-content:center;padding:20px;font-family:-apple-system,sans-serif`;
        o.innerHTML = `
        <div style="max-width:520px;width:100%;background:#141417;border:1px solid rgba(255,255,255,.1);
                    border-radius:14px;padding:28px 30px;color:#f0f0f2;box-shadow:0 24px 80px rgba(0,0,0,.6)">
            <div style="font-size:19px;font-weight:700;margin-bottom:10px">Conditions non acceptees</div>
            <div style="font-size:13.5px;line-height:1.65;color:#a8a8b3">
                Tu as refuse les conditions d'utilisation. Inko ne s'ouvrira pas tant que ce choix
                n'aura pas change — c'est ce que « refuser » veut dire.
                <br><br>
                Rien n'a ete supprime : ta bibliotheque, ta progression et tes reglages sont intacts
                sur cet appareil et te seront rendus si tu reviens sur ta decision.
            </div>
            <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:20px;flex-wrap:wrap">
                <a href="https://github.com/Abdoulrazack1/Inko#readme" target="_blank" rel="noopener noreferrer"
                   style="background:transparent;border:1px solid rgba(255,255,255,.15);color:#a8a8b3;
                          padding:9px 16px;border-radius:8px;font-size:13px;text-decoration:none">Lire les conditions</a>
                <button id="mh-eula-revenir"
                        style="background:#ff6b1a;border:none;color:#fff;padding:12px 18px;border-radius:8px;min-height:44px;
                               font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">
                    Revenir sur ma decision
                </button>
            </div>
        </div>`;
        document.body.appendChild(o);
        // Le lien externe n'est PLUS une navigation imposee : c'est un choix,
        // et il s'ouvre dans un onglet a part pour ne pas fermer l'app.
        o.querySelector('#mh-eula-revenir').addEventListener('click', () => {
            try { localStorage.removeItem(KEY_REFUS); } catch (e) { /* stockage indisponible */ }
            o.remove();
            open();
        });
    }

    function open() {
        const overlay = document.createElement('div');
        overlay.id = 'mh-eula';
        // ⚠ Sur telephone, ce contenu est PLUS HAUT que l'ecran. La premiere
        // version centrait une carte sans hauteur maximale ni defilement : le
        // titre passait sous la barre d'etat, et les boutons « Refuser /
        // Continuer » tombaient hors de l'ecran. On ne pouvait donc pas
        // accepter les conditions — et sans les accepter, pas d'application.
        // Constate sur emulateur, capture a l'appui.
        //
        // `padding-top`/`bottom` sont DOUBLES : le WebView d'Android 8 jette
        // la declaration ENTIERE des qu'elle contient `env()`, et l'element se
        // retrouverait colle aux bords.
        overlay.style.cssText = `
            position: fixed; top: 0; right: 0; bottom: 0; left: 0; background: rgba(0,0,0,.78);
            z-index: 99999; display: flex; align-items: center; justify-content: center;
            padding: 20px; backdrop-filter: blur(6px);
            padding-top: 20px;
            padding-top: calc(20px + env(safe-area-inset-top));
            padding-bottom: 20px;
            padding-bottom: calc(20px + env(safe-area-inset-bottom));
        `;
        // ⚠ Hauteur bornee en `vh`, pas en pourcentage.
        //
        // `max-height:100%` ne bornait RIEN : le parent est un conteneur flex
        // dont la hauteur depend de son contenu, et le pourcentage se
        // resolvait donc sur une hauteur libre. Mesure sur emulateur : le
        // panneau depassait le bas de l'ecran, la case a cocher et le bouton
        // d'acceptation etaient hors d'atteinte, et TOUTE l'application
        // restait bloquee derriere ce voile — sur chaque page.
        //
        // `vh` est une unite absolue : elle borne pour de bon.
        //
        // (Et ce commentaire vit ICI, pas dans le gabarit : des backticks a
        // l'interieur d'un litteral de gabarit le referment. Piege rencontre
        // quatre fois maintenant.)
        overlay.innerHTML = `
        <div style="max-width:560px;width:100%;
                    max-height: calc(100vh - 40px);
                    overflow-y:auto;
                    -webkit-overflow-scrolling:touch;
                    background:#141417;border:1px solid rgba(255,255,255,.1);
                    border-radius:14px;padding:28px 30px;color:#f0f0f2;font-family:-apple-system,sans-serif;
                    box-shadow:0 24px 80px rgba(0,0,0,.6)">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
                <div style="width:36px;height:36px;border-radius:9px;background:linear-gradient(135deg,#ff8c42,#ff6b1a);
                            display:flex;align-items:center;justify-content:center;
                            font-size:20px;line-height:1;color:#fff;font-weight:700;flex:0 0 auto">愛</div>
                <h2 style="font-size:18px;font-weight:700;margin:0">Bienvenue dans Inko</h2>
            </div>

            <p style="font-size:13.5px;line-height:1.55;color:#a8a8b3;margin-bottom:14px">
                <strong style="color:#ff6b1a">Inko est un framework de lecture neutre.</strong>
                Le projet n’héberge <strong>aucune œuvre</strong> : ni planche, ni chapitre. Les extensions
                que tu choisis d'installer accèdent à des sites tiers et sont
                <em>entièrement sous ta responsabilité</em>.
            </p>

            <ul style="font-size:12.5px;line-height:1.7;color:#a8a8b3;margin:0 0 12px 18px;padding:0">
                <li>Usage <strong>strictement personnel</strong>, jamais commercial.</li>
                <li>Tu dois <strong>vérifier la légalité dans ton pays</strong> avant d'installer une source.</li>
                <li>Tu dois respecter les <strong>CGU des sites tiers</strong> accédés par les extensions.</li>
                <li>Inko ne stocke <strong>aucune image</strong> de contenu côté serveur.</li>
                <li>Aucune <strong>télémétrie</strong>, aucun envoi d'analytics, aucun tracker.</li>
                <li>Les auteurs déclinent <strong>toute responsabilité</strong> liée à ton usage.</li>
                <li>Voir <a href="LICENSE" target="_blank" style="color:#ff6b1a;text-decoration:underline">LICENSE</a> (Apache 2.0) et <a href="NOTICE.md" target="_blank" style="color:#ff6b1a;text-decoration:underline">NOTICE.md</a>.</li>
            </ul>

            <div style="background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.25);
                        border-radius:8px;padding:10px 12px;font-size:11.5px;color:#a8a8b3;line-height:1.5;margin-bottom:14px">
                <strong style="color:#ef4444">Avertissement</strong> — Certaines extensions communautaires accèdent
                à des sites qui peuvent héberger du contenu protégé par le droit d'auteur sans
                autorisation. L'utilisation de telles extensions peut violer la loi de ton pays.
                <strong>Tu seras tenu·e seul·e responsable.</strong>
            </div>

            <label style="display:flex;align-items:flex-start;gap:9px;font-size:12.5px;color:#a8a8b3;
                          padding:10px 12px;background:rgba(255,255,255,.03);border-radius:8px;
                          border:1px solid rgba(255,255,255,.08);cursor:pointer;user-select:none">
                <input type="checkbox" id="mh-eula-check" style="margin-top:2px;flex-shrink:0">
                <span>J'ai lu, je comprends et j'accepte ces conditions. Je suis majeur·e selon la loi
                      de mon pays et je suis <strong>seul·e responsable</strong> de l'usage que je fais de
                      Inko et de toute extension tierce que je choisis d'installer.</span>
            </label>

            <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:18px">
                <button id="mh-eula-no"
                        style="background:transparent;border:1px solid rgba(255,255,255,.15);color:#a8a8b3;
                               padding:9px 16px;border-radius:8px;font-size:13px;cursor:pointer;font-family:inherit">
                    Refuser
                </button>
                <button id="mh-eula-yes" disabled
                        style="background:#ff6b1a;border:none;color:#fff;padding:12px 18px;border-radius:8px;min-height:44px;
                               font-size:13px;font-weight:600;cursor:pointer;opacity:.4;font-family:inherit;
                               transition:opacity .2s">
                    Continuer
                </button>
            </div>
        </div>`;

        document.body.appendChild(overlay);

        const check = document.getElementById('mh-eula-check');
        const yes   = document.getElementById('mh-eula-yes');
        const no    = document.getElementById('mh-eula-no');

        check.addEventListener('change', () => {
            yes.disabled    = !check.checked;
            yes.style.opacity = check.checked ? '1' : '.4';
        });

        yes.addEventListener('click', () => {
            try { localStorage.setItem(KEY, JSON.stringify({ acceptedAt: Date.now(), version: 1 })); }
            catch (e) { window.MH?.err?.('eula.js', e); }
            overlay.remove();
        });

        no.addEventListener('click', () => {
            // Audit AMEL-110 : le refus est memorise et respecte, au lieu
            // d'envoyer ailleurs et de laisser un simple rechargement le
            // contourner.
            try { localStorage.setItem(KEY_REFUS, String(Date.now())); }
            catch (e) { window.MH?.err?.('eula.js', e); }
            overlay.remove();
            ecranRefus();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', open);
    } else {
        open();
    }
})();
