// ============================================================
// password-strength.js — Indicateur de force partagé
// ============================================================
// Utilisé par page_signup et page_nouveaumdp.
// API : window.PasswordStrength.evaluate(pwd) → { score, label, color }
// Et   PasswordStrength.bind({ input, bar, label }) pour live update
// ============================================================
(function () {
    'use strict';

    function evaluate(pwd) {
        if (!pwd) return { score: 0, label: '—', color: '#444', percent: 0 };
        let score = 0;
        if (pwd.length >= 6)  score++;
        if (pwd.length >= 10) score++;
        if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
        if (/[0-9]/.test(pwd)) score++;
        if (/[^a-zA-Z0-9]/.test(pwd)) score++;

        const levels = [
            { label: 'Trop court',  color: '#ef4444', percent: 10 },
            { label: 'Faible',      color: '#ef4444', percent: 25 },
            { label: 'Moyen',       color: '#f59e0b', percent: 50 },
            { label: 'Bon',         color: '#eab308', percent: 70 },
            { label: 'Solide',      color: '#22c55e', percent: 85 },
            { label: 'Très solide', color: '#16a34a', percent: 100 },
        ];
        return { score, ...levels[Math.min(score, levels.length - 1)] };
    }

    function bind({ input, bar, label }) {
        if (!input) return;
        const update = () => {
            const r = evaluate(input.value);
            if (bar) {
                bar.style.width = r.percent + '%';
                bar.style.background = r.color;
            }
            if (label) {
                label.textContent = r.label;
                label.style.color = r.color;
            }
        };
        input.addEventListener('input', update);
        update();
    }

    window.PasswordStrength = { evaluate, bind };
})();
