// page_mdpoublie.js — Demande de reset via API
(function () {
    'use strict';
    const toast = (msg) => window.MH?.toast(msg) || alert(msg);
    const form  = document.getElementById('forgotForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const emailInput = form.querySelector('input[type="email"]');
        const email = emailInput.value.trim();
        if (!email) { toast('Veuillez entrer votre adresse email.'); return; }
        if (!API.auth.validateEmail(email)) {
            toast('Email invalide.'); emailInput.style.borderColor = '#ef4444'; return;
        }
        try {
            const r = await API.auth.requestReset(email);
            toast(`Lien de réinitialisation envoyé`);
            emailInput.style.borderColor = '';
            // Mode mock : on a le token immédiatement
            if (r.token) {
                setTimeout(() => {
                    window.location.href = `page_nouveaumdp.html?email=${encodeURIComponent(email)}&token=${r.token}`;
                }, 800);
            }
        } catch(err) {
            toast(err.message || 'Erreur');
            emailInput.style.borderColor = '#ef4444';
        }
    });

    const emailInput = form.querySelector('input[type="email"]');
    if (emailInput) emailInput.addEventListener('input', () => { emailInput.style.borderColor = ''; });
})();
