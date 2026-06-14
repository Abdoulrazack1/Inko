// page_login.js — Connexion via API backend
(function () {
    'use strict';

    const toast = (msg) => { if (window.MH?.toast) MH.toast(msg); else alert(msg); };

    if (window.API?.isLoggedIn?.()) {
        toast('Déjà connecté !');
        setTimeout(() => { window.location.href = 'accueil.html'; }, 600);
    }

    // ── Toggle password ──
    const togglePwd = document.getElementById('toggleLoginPassword');
    const pwdInput  = document.getElementById('loginPassword');
    if (togglePwd && pwdInput) {
        togglePwd.addEventListener('click', () => {
            const t = pwdInput.type === 'password' ? 'text' : 'password';
            pwdInput.type = t;
            togglePwd.textContent = t === 'password' ? 'Voir' : 'Masquer';
        });
    }

    // ── Form ──
    const form = document.getElementById('loginForm');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email    = form.querySelector('input[type="email"]').value.trim();
            const password = pwdInput.value;

            if (!email || !password) { toast('Veuillez remplir tous les champs.'); return; }
            const btn = form.querySelector('button[type="submit"]');
            if (btn) { btn.disabled = true; btn.style.opacity = '0.7'; }

            try {
                const r = await API.auth.login({ email, password });
                toast(`Bienvenue ${r.user.username} ! `);
                setTimeout(() => { window.location.href = 'accueil.html'; }, 600);
            } catch (err) {
                toast(err.message || 'Erreur de connexion');
                if (btn) { btn.disabled = false; btn.style.opacity = ''; }
            }
        });
    }

    // ── Email blur ──
    const emailIn = document.querySelector('input[type="email"]');
    if (emailIn) {
        emailIn.addEventListener('blur', () => {
            const valid = API.auth.validateEmail(emailIn.value);
            emailIn.style.borderColor = (emailIn.value && !valid) ? '#ef4444' : '';
        });
        emailIn.addEventListener('input', () => { emailIn.style.borderColor = ''; });
    }

    // ── Connexion Google (réelle si configurée) ──
    window.MH?.setupGoogleSignin?.({ container: 'googleSignin', divider: 'ssoDivider' });

    // ── Compte démo ──
    if (form) {
        const demoHint = document.createElement('button');
        demoHint.type = 'button';
        demoHint.className = 'btn btn-ghost btn-sm';
        demoHint.style.cssText = 'width:100%;margin-top:10px;font-size:11.5px;opacity:.7';
        demoHint.textContent = 'Tester avec le compte démo';
        demoHint.addEventListener('click', () => {
            form.querySelector('input[type="email"]').value = 'demo@inko.app';
            pwdInput.value = 'demo1234';
            toast('Compte démo pré-rempli');
        });
        form.appendChild(demoHint);
    }
})();
