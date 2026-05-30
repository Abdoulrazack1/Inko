// ============================================================
// eula.js — Modal d'acceptation au premier lancement
// ============================================================
// Affiché une seule fois, stocké dans localStorage. À charger sur
// toutes les pages publiques après global.js.
// ============================================================
(function () {
    'use strict';

    const KEY = 'mh_eula_v2';
    try { if (localStorage.getItem(KEY)) return; }
    catch (e) { return; }

    function open() {
        const overlay = document.createElement('div');
        overlay.id = 'mh-eula';
        overlay.style.cssText = `
            position: fixed; inset: 0; background: rgba(0,0,0,.78);
            z-index: 99999; display: flex; align-items: center; justify-content: center;
            padding: 20px; backdrop-filter: blur(6px);
        `;
        overlay.innerHTML = `
        <div style="max-width:560px;width:100%;background:#141417;border:1px solid rgba(255,255,255,.1);
                    border-radius:14px;padding:28px 30px;color:#f0f0f2;font-family:-apple-system,sans-serif;
                    box-shadow:0 24px 80px rgba(0,0,0,.6)">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
                <div style="width:36px;height:36px;border-radius:9px;background:linear-gradient(135deg,#ff8c42,#ff6b1a);
                            display:flex;align-items:center;justify-content:center;font-size:18px">⚡</div>
                <h2 style="font-size:18px;font-weight:700;margin:0">Bienvenue dans Inko</h2>
            </div>

            <p style="font-size:13.5px;line-height:1.55;color:#a8a8b3;margin-bottom:14px">
                <strong style="color:#ff6b1a">Inko est un framework de lecture neutre.</strong>
                Le projet ne distribue <strong>aucune source de contenu</strong>. Les extensions
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
                ⚠ <strong style="color:#ef4444">Avertissement</strong> — Certaines extensions communautaires accèdent
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
                        style="background:#ff6b1a;border:none;color:#fff;padding:9px 18px;border-radius:8px;
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
            catch (e) {}
            overlay.remove();
        });

        no.addEventListener('click', () => {
            // Redirige vers une page explicative (le LICENSE par exemple)
            window.location.href = 'https://github.com/Abdoulrazack1/Inko#readme';
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', open);
    } else {
        open();
    }
})();
