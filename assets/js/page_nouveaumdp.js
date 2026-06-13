// page_nouveaumdp.js â€” Reset password via API
(function () {
    'use strict';
    const toast = (msg) => { if (window.MH?.toast) MH.toast(msg); else alert(msg); };
    const params = new URLSearchParams(location.search);
    const email  = params.get('email') || '';
    const token  = params.get('token') || '';

    const togglePwd  = document.getElementById('toggleNewPassword');
    const newPwd     = document.getElementById('newPassword');
    const confirmPwd = document.getElementById('confirmPassword');
    if (togglePwd && newPwd) {
        togglePwd.addEventListener('click', () => {
            const t = newPwd.type === 'password' ? 'text' : 'password';
            newPwd.type = t;
            togglePwd.textContent = t === 'password' ? 'Voir' : 'Masquer';
        });
    }

    if (newPwd && window.PasswordStrength) {
        const bars  = [1,2,3,4].map(i => document.getElementById('bar' + i));
        const label = document.getElementById('strengthValue');
        newPwd.addEventListener('input', () => {
            const r = window.PasswordStrength.evaluate(newPwd.value);
            const active = Math.ceil((r.score / 5) * bars.length);
            bars.forEach((b, i) => {
                if (!b) return;
                b.classList.toggle('active', i < active);
                b.style.background = i < active ? r.color : '';
            });
            if (label) { label.textContent = r.label; label.style.color = r.color; }
        });
    }

    if (confirmPwd && newPwd) {
        confirmPwd.addEventListener('input', () => {
            if (!confirmPwd.value) { confirmPwd.style.borderColor = ''; return; }
            confirmPwd.style.borderColor = confirmPwd.value === newPwd.value ? '#10b981' : '#ef4444';
        });
    }

    const form = document.getElementById('resetForm');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const pwd = newPwd.value, cfm = confirmPwd.value;
            if (!pwd || !cfm) { toast('Veuillez remplir tous les champs.'); return; }
            if (pwd.length < 6) { toast('Mot de passe trop court (6 caractÃ¨res min).'); newPwd.style.borderColor = '#ef4444'; return; }
            if (pwd !== cfm)    { toast('Les mots de passe ne correspondent pas.'); confirmPwd.style.borderColor = '#ef4444'; return; }
            if (!email || !token) {
                toast('Lien invalide â€” recommencez la procÃ©dure.');
                setTimeout(() => { window.location.href = 'page_mdpoublie.html'; }, 1000);
                return;
            }
            try {
                await API.auth.resetPassword({ email, token, newPassword: pwd });
                toast('Mot de passe rÃ©initialisÃ© ! ');
                setTimeout(() => { window.location.href = 'page_login.html'; }, 800);
            } catch(err) {
                toast(err.message || 'Erreur lors de la rÃ©initialisation');
            }
        });
    }
})();
