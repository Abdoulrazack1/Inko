// Password Toggle
const toggleLoginPassword = document.getElementById('toggleLoginPassword');
const loginPassword = document.getElementById('loginPassword');

if (toggleLoginPassword && loginPassword) {
    toggleLoginPassword.addEventListener('click', function() {
        const type = loginPassword.getAttribute('type') === 'password' ? 'text' : 'password';
        loginPassword.setAttribute('type', type);
        this.textContent = type === 'password' ? 'Voir' : 'Masquer';
    });
}

// Form Submission
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const email = this.querySelector('input[type="email"]').value;
        const password = loginPassword.value;
        
        if (!email || !password) {
            alert('Veuillez remplir tous les champs.');
            return;
        }
        
        // Simulate login 
        alert('Connexion réussie ! Bienvenue sur MangaHub');
        // Here you would normally send the login data to your server
    });
}

// Email validation
const emailInput = document.querySelector('input[type="email"]');
if (emailInput) {
    emailInput.addEventListener('blur', function(e) {
        const email = e.target.value;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        
        if (email && !emailRegex.test(email)) {
            this.style.borderColor = '#ef4444';
        } else {
            this.style.borderColor = '';
        }
    });
}