// pwa.js — Enregistre le service worker et propose l'installation
(function () {
    'use strict';
    if (!('serviceWorker' in navigator)) return;

    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then(reg => {
                // Vérifie les mises à jour toutes les heures
                setInterval(() => reg.update().catch(() => {}), 3600_000);
            })
            .catch(() => { /* silencieux */ });
    });

    // ── Prompt d'installation ──
    let deferredPrompt;
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        // Affiche un toast incitatif (1 seule fois)
        try {
            if (localStorage.getItem('mh_install_dismissed')) return;
            const t = document.createElement('div');
            t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#ff6b1a;color:#fff;padding:12px 16px;border-radius:10px;font-size:13px;font-weight:500;z-index:9999;box-shadow:0 6px 24px rgba(0,0,0,.3);display:flex;gap:10px;align-items:center';
            t.innerHTML = `📲 Installer Inko comme appli ?
                <button id="pwaInstallBtn" style="background:#fff;color:#ff6b1a;border:none;padding:6px 12px;border-radius:6px;font-weight:600;cursor:pointer">Installer</button>
                <button id="pwaDismissBtn" style="background:transparent;color:#fff;border:1px solid rgba(255,255,255,.4);padding:6px 12px;border-radius:6px;cursor:pointer">Plus tard</button>`;
            document.body.appendChild(t);
            document.getElementById('pwaInstallBtn').addEventListener('click', async () => {
                deferredPrompt.prompt();
                await deferredPrompt.userChoice;
                deferredPrompt = null;
                t.remove();
            });
            document.getElementById('pwaDismissBtn').addEventListener('click', () => {
                localStorage.setItem('mh_install_dismissed', '1');
                t.remove();
            });
        } catch (e) {}
    });
})();
