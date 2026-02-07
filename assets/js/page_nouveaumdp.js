// Password Toggle
const toggleNewPassword = document.getElementById('toggleNewPassword');
const newPassword = document.getElementById('newPassword');

if (toggleNewPassword && newPassword) {
    toggleNewPassword.addEventListener('click', function() {
        const type = newPassword.getAttribute('type') === 'password' ? 'text' : 'password';
        newPassword.setAttribute('type', type);
        this.textContent = type === 'password' ? 'Voir' : 'Masquer';
    });
}

// Password Strength Indicator
if (newPassword) {
    newPassword.addEventListener('input', function(e) {
        const password = e.target.value;
        const strengthValue = document.getElementById('strengthValue');
        const bar1 = document.getElementById('bar1');
        const bar2 = document.getElementById('bar2');
        const bar3 = document.getElementById('bar3');
        const bar4 = document.getElementById('bar4');
        
        // Reset bars
        [bar1, bar2, bar3, bar4].forEach(bar => bar.classList.remove('active'));
        
        if (password.length === 0) {
            strengthValue.textContent = 'Faible';
            return;
        }
        
        let strength = 'Faible';
        let activeBars = 1;
        
        if (password.length >= 8) {
            const hasUpperCase = /[A-Z]/.test(password);
            const hasLowerCase = /[a-z]/.test(password);
            const hasNumbers = /\d/.test(password);
            const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
            
            const criteriasMet = [hasUpperCase, hasLowerCase, hasNumbers, hasSpecialChar].filter(Boolean).length;
            
            if (criteriasMet >= 4 && password.length >= 12) {
                strength = 'Très fort';
                activeBars = 4;
            } else if (criteriasMet >= 3 && password.length >= 10) {
                strength = 'Fort';
                activeBars = 3;
            } else if (criteriasMet >= 2 && password.length >= 8) {
                strength = 'Moyen';
                activeBars = 2;
            } else {
                strength = 'Faible';
                activeBars = 1;
            }
        }
        
        strengthValue.textContent = strength;
        
        // Activate bars
        const bars = [bar1, bar2, bar3, bar4];
        for (let i = 0; i < activeBars; i++) {
            bars[i].classList.add('active');
        }
    });
}

// Form Submission
const resetForm = document.getElementById('resetForm');
if (resetForm) {
    resetForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const password = newPassword.value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        
        if (!password || !confirmPassword) {
            alert('Veuillez remplir tous les champs.');
            return;
        }
        
        if (password !== confirmPassword) {
            alert('Les mots de passe ne correspondent pas.');
            document.getElementById('confirmPassword').style.borderColor = '#ef4444';
            return;
        }
        
        if (password.length < 8) {
            alert('Le mot de passe doit contenir au moins 8 caractères.');
            newPassword.style.borderColor = '#ef4444';
            return;
        }
        
        // Simulate password reset
        alert('Mot de passe réinitialisé avec succès ! 🎉\nVous pouvez maintenant vous connecter avec votre nouveau mot de passe.');
        
        // Redirect to login page
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1000);
    });
}

// Confirm password match validation
const confirmPasswordInput = document.getElementById('confirmPassword');
if (confirmPasswordInput && newPassword) {
    confirmPasswordInput.addEventListener('input', function() {
        if (this.value && newPassword.value) {
            if (this.value === newPassword.value) {
                this.style.borderColor = '#10b981';
            } else {
                this.style.borderColor = '#ef4444';
            }
        } else {
            this.style.borderColor = '';
        }
    });
}