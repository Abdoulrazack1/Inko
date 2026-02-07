// Form Submission
const forgotForm = document.getElementById('forgotForm');

if (forgotForm) {
    forgotForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const emailInput = this.querySelector('input[type="email"]');
        const email = emailInput.value;
        
        if (!email) {
            alert('Veuillez entrer votre adresse email.');
            return;
        }
        
        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            alert('Veuillez entrer une adresse email valide.');
            emailInput.style.borderColor = '#ef4444';
            return;
        }
        
        // Simulate sending recovery email
        alert(`Un lien de récupération a été envoyé à ${email} 📧`);
        
        // Reset form
        this.reset();
        emailInput.style.borderColor = '';
    });
}

// Email validation on blur
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
    
    // Clear error on input
    emailInput.addEventListener('input', function() {
        this.style.borderColor = '';
    });
}