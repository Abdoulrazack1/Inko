// Password Toggle
const toggleNewPassword = document.getElementById('toggleNewPassword');
const newPassword = document.getElementById('newPassword');

if (toggleNewPassword && newPassword) {
    toggleNewPassword.addEventListener('click', function () {
        const type = newPassword.getAttribute('type') === 'password' ? 'text' : 'password';
        newPassword.setAttribute('type', type);
        this.textContent = type === 'password' ? 'Voir' : 'Masquer';
    });
}

// Password Strength Indicator
if (newPassword) {
    newPassword.addEventListener('input', function () {
        const password = this.value;
        const strengthValue = document.getElementById('strengthValue');
        const bars = [
            document.getElementById('bar1'),
            document.getElementById('bar2'),
            document.getElementById('bar3'),
            document.getElementById('bar4'),
        ];

        bars.forEach(b => b?.classList.remove('active'));

        if (!password.length) { if (strengthValue) strengthValue.textContent = 'Faible'; return; }

        const checks = [/[A-Z]/, /[a-z]/, /\d/, /[!@#$%^&*(),.?":{}|<>]/].filter(r => r.test(password)).length;
        let label = 'Faible', active = 1;

        if (checks >= 4 && password.length >= 12)      { label = 'Très fort'; active = 4; }
        else if (checks >= 3 && password.length >= 10) { label = 'Fort';      active = 3; }
        else if (checks >= 2 && password.length >= 8)  { label = 'Moyen';     active = 2; }

        if (strengthValue) strengthValue.textContent = label;
        bars.slice(0, active).forEach(b => b?.classList.add('active'));
    });
}

// Confirm password match
const confirmPasswordInput = document.getElementById('confirmPassword');
if (confirmPasswordInput && newPassword) {
    confirmPasswordInput.addEventListener('input', function () {
        if (this.value && newPassword.value) {
            this.style.borderColor = this.value === newPassword.value ? '#10b981' : '#ef4444';
        } else {
            this.style.borderColor = '';
        }
    });
}

// Form Submission
const resetForm = document.getElementById('resetForm');
if (resetForm) {
    resetForm.addEventListener('submit', function (e) {
        e.preventDefault();

        const password = newPassword.value;
        const confirm = confirmPasswordInput.value;

        if (!password || !confirm) {
            window.MH?.toast('Veuillez remplir tous les champs.');
            return;
        }
        if (password.length < 8) {
            window.MH?.toast('Le mot de passe doit contenir au moins 8 caractères.');
            newPassword.style.borderColor = '#ef4444';
            return;
        }
        if (password !== confirm) {
            window.MH?.toast('Les mots de passe ne correspondent pas.');
            confirmPasswordInput.style.borderColor = '#ef4444';
            return;
        }

        window.MH?.toast('Mot de passe réinitialisé avec succès ! 🎉');
        setTimeout(() => { window.location.href = 'page_login.html'; }, 1200);
    });
}