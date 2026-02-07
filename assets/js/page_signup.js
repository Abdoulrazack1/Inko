// Password Toggle Functionality
const togglePassword = document.getElementById('togglePassword');
const passwordInput = document.getElementById('password');

if (togglePassword && passwordInput) {
    togglePassword.addEventListener('click', function() {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        this.textContent = type === 'password' ? 'Voir' : 'Masquer';
    });
}

// Password Strength Indicator
if (passwordInput) {
    passwordInput.addEventListener('input', function(e) {
        const password = e.target.value;
        const strengthText = document.getElementById('strengthText');
        const bars = document.querySelectorAll('.strength-bars .bar');
        
        if (!strengthText || !bars.length) return;
        
        let strength = 'Faible';
        let activeBars = 1;
        
        if (password.length === 0) {
            strengthText.textContent = '';
            bars.forEach(bar => bar.classList.remove('active'));
            return;
        }
        
        if (password.length >= 8) {
            const hasUpperCase = /[A-Z]/.test(password);
            const hasLowerCase = /[a-z]/.test(password);
            const hasNumbers = /\d/.test(password);
            const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
            
            const criteriasMet = [hasUpperCase, hasLowerCase, hasNumbers, hasSpecialChar].filter(Boolean).length;
            
            if (criteriasMet >= 3 && password.length >= 12) {
                strength = 'Fort';
                activeBars = 4;
            } else if (criteriasMet >= 2 && password.length >= 8) {
                strength = 'Moyen';
                activeBars = 2;
            } else {
                activeBars = 1;
            }
        }
        
        strengthText.textContent = strength;
        
        bars.forEach((bar, index) => {
            if (index < activeBars) {
                bar.classList.add('active');
            } else {
                bar.classList.remove('active');
            }
        });
    });
}

// Form Validation
const signupForm = document.getElementById('signupForm');
if (signupForm) {
    signupForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        
        if (password !== confirmPassword) {
            alert('Les mots de passe ne correspondent pas.');
            return;
        }
        
        if (password.length < 8) {
            alert('Le mot de passe doit contenir au moins 8 caractères.');
            return;
        }
        
        // If validation passes
        alert('Compte créé avec succès ! Bienvenue sur MangaHub 🎉');
        // Here you would normally send the form data to your server
    });
}

// Email validation
const emailInput = document.getElementById('email');
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