// page_signup.js — Inscription via API
(function () {
    'use strict';
    const toast = (msg) => window.MH?.toast(msg) || alert(msg);

    if (window.API?.isLoggedIn?.()) {
        toast('Vous êtes déjà connecté.');
        setTimeout(() => { window.location.href = 'accueil.html'; }, 600);
    }

    const togglePwd = document.getElementById('togglePassword');
    const pwdInput  = document.getElementById('password');
    if (togglePwd && pwdInput) {
        togglePwd.addEventListener('click', () => {
            const t = pwdInput.type === 'password' ? 'text' : 'password';
            pwdInput.type = t;
            togglePwd.textContent = t === 'password' ? 'Voir' : 'Masquer';
        });
    }

    // Strength
    if (pwdInput && window.PasswordStrength) {
        const bars  = document.querySelectorAll('.strength-bars .bar');
        const label = document.getElementById('strengthText');
        pwdInput.addEventListener('input', () => {
            const r = window.PasswordStrength.evaluate(pwdInput.value);
            bars.forEach((b, i) => b.classList.toggle('active', i < Math.ceil(r.score * (bars.length / 5))));
            if (label) label.textContent = r.label;
        });
    }

    const form = document.getElementById('signupForm');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const inputs = form.querySelectorAll('input');
            const firstName = inputs[0]?.value.trim();
            const lastName  = inputs[1]?.value.trim();
            const email     = document.getElementById('email').value.trim();
            const username  = inputs[3]?.value.trim() || firstName;
            const password  = pwdInput.value;
            const confirm   = document.getElementById('confirmPassword').value;

            if (!firstName || !lastName || !email || !username || !password) {
                toast('Veuillez remplir tous les champs.'); return;
            }
            if (password !== confirm) { toast('Les mots de passe ne correspondent pas.'); return; }

            const btn = form.querySelector('button[type="submit"]');
            if (btn) { btn.disabled = true; btn.style.opacity = '0.7'; }

            try {
                const r = await API.auth.register({ username, email, password });
                toast(`Bienvenue ${r.user.username} ! `);
                setTimeout(() => { window.location.href = 'accueil.html'; }, 800);
            } catch (err) {
                toast(err.message || "Erreur lors de l'inscription");
                if (btn) { btn.disabled = false; btn.style.opacity = ''; }
            }
        });
    }

    const emailIn = document.getElementById('email');
    if (emailIn) {
        emailIn.addEventListener('blur', () => {
            const valid = API.auth.validateEmail(emailIn.value);
            emailIn.style.borderColor = (emailIn.value && !valid) ? '#ef4444' : '';
        });
        emailIn.addEventListener('input', () => { emailIn.style.borderColor = ''; });
    }

    document.querySelectorAll('.social-btn').forEach(b => {
        b.addEventListener('click', (e) => { e.preventDefault(); toast('Inscription SSO bientôt disponible'); });
    });
})();
