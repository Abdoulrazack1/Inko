// Password Toggle
const toggleLoginPassword = document.getElementById('toggleLoginPassword');
const loginPassword = document.getElementById('loginPassword');

if (toggleLoginPassword && loginPassword) {
    toggleLoginPassword.addEventListener('click', function () {
        const type = loginPassword.getAttribute('type') === 'password' ? 'text' : 'password';
        loginPassword.setAttribute('type', type);
        this.textContent = type === 'password' ? 'Voir' : 'Masquer';
    });
}

// Form Submission
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', function (e) {
        e.preventDefault();

        const email = this.querySelector('input[type="email"]').value;
        const password = loginPassword.value;

        if (!email || !password) {
            window.MH?.toast('Veuillez remplir tous les champs.');
            return;
        }

        window.MH?.toast('Connexion réussie ! Bienvenue sur MangaHub 👋');
        setTimeout(() => { window.location.href = 'accueil.html'; }, 1200);
    });
}

// Email validation on blur
const emailInput = document.querySelector('input[type="email"]');
if (emailInput) {
    emailInput.addEventListener('blur', function () {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        this.style.borderColor = (this.value && !emailRegex.test(this.value)) ? '#ef4444' : '';
    });
}

// Lien "Mot de passe oublié"
const forgotLink = document.querySelector('.forgot-link');
if (forgotLink) {
    forgotLink.addEventListener('click', function (e) {
        e.preventDefault();
        window.location.href = 'page_mdpoublie.html';
    });
}