// Form Submission
const forgotForm = document.getElementById('forgotForm');

if (forgotForm) {
    forgotForm.addEventListener('submit', function (e) {
        e.preventDefault();

        const emailInput = this.querySelector('input[type="email"]');
        const email = emailInput.value;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!email) {
            window.MH?.toast('Veuillez entrer votre adresse email.');
            return;
        }

        if (!emailRegex.test(email)) {
            window.MH?.toast('Veuillez entrer une adresse email valide.');
            emailInput.style.borderColor = '#ef4444';
            return;
        }

        window.MH?.toast(`Lien envoyé à ${email} 📧`);
        this.reset();
        emailInput.style.borderColor = '';
    });
}

// Email validation on blur
const emailInput = document.querySelector('input[type="email"]');
if (emailInput) {
    emailInput.addEventListener('blur', function () {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        this.style.borderColor = (this.value && !emailRegex.test(this.value)) ? '#ef4444' : '';
    });

    emailInput.addEventListener('input', function () {
        this.style.borderColor = '';
    });
}