// Password Toggle
const togglePassword = document.getElementById('togglePassword');
const passwordInput = document.getElementById('password');

if (togglePassword && passwordInput) {
    togglePassword.addEventListener('click', function () {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        this.textContent = type === 'password' ? 'Voir' : 'Masquer';
    });
}

// Password Strength Indicator
if (passwordInput) {
    passwordInput.addEventListener('input', function () {
        const password = this.value;
        const strengthText = document.getElementById('strengthText');
        const bars = document.querySelectorAll('.strength-bars .bar');

        if (!strengthText || !bars.length) return;

        bars.forEach(b => b.classList.remove('active'));

        if (!password.length) { strengthText.textContent = ''; return; }

        const checks = [/[A-Z]/, /[a-z]/, /\d/, /[!@#$%^&*(),.?":{}|<>]/].filter(r => r.test(password)).length;
        let label = 'Faible', active = 1;

        if (checks >= 3 && password.length >= 12)     { label = 'Fort';  active = 4; }
        else if (checks >= 2 && password.length >= 8) { label = 'Moyen'; active = 2; }

        strengthText.textContent = label;
        bars.forEach((b, i) => { if (i < active) b.classList.add('active'); });
    });
}

// Form Validation & Submit
const signupForm = document.getElementById('signupForm');
if (signupForm) {
    signupForm.addEventListener('submit', function (e) {
        e.preventDefault();

        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (password.length < 8) {
            window.MH?.toast('Le mot de passe doit contenir au moins 8 caractères.');
            return;
        }
        if (password !== confirmPassword) {
            window.MH?.toast('Les mots de passe ne correspondent pas.');
            return;
        }

        window.MH?.toast('Compte créé avec succès ! Bienvenue sur MangaHub 🎉');
        setTimeout(() => { window.location.href = 'accueil.html'; }, 1200);
    });
}

// Email validation on blur
const emailInput = document.getElementById('email');
if (emailInput) {
    emailInput.addEventListener('blur', function () {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        this.style.borderColor = (this.value && !emailRegex.test(this.value)) ? '#ef4444' : '';
    });
}