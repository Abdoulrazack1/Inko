// ============================================================
// auth.js — Authentification mock (localStorage)
// ============================================================
// Pas de backend. Les comptes sont stockés en clair côté client
// (uniquement pour démo / portfolio). NE PAS utiliser en prod.
// Doit être chargé après storage.js.
// ============================================================
(function () {
    'use strict';

    const ACCOUNTS_KEY = 'mh_accounts';

    function getAccounts() {
        try { return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '{}'); }
        catch (e) { return {}; }
    }
    function saveAccounts(accs) {
        try { localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accs)); }
        catch (e) {}
    }

    // Hash léger (NON sécurisé, juste pour ne pas stocker en clair)
    function hash(str) {
        let h = 0;
        for (let i = 0; i < str.length; i++) {
            h = ((h << 5) - h) + str.charCodeAt(i);
            h |= 0;
        }
        return h.toString(36) + '_' + str.length;
    }

    function validEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
    }

    function avatarLetter(username) {
        return (username || '?').trim().charAt(0).toUpperCase() || '?';
    }

    const Auth = {
        validateEmail: validEmail,

        register({ username, email, password }) {
            if (!username || username.length < 2)
                return { ok:false, error:"Nom d'utilisateur trop court (2 caractères min)" };
            if (!validEmail(email))
                return { ok:false, error:'Email invalide' };
            if (!password || password.length < 6)
                return { ok:false, error:'Mot de passe trop court (6 caractères min)' };

            const accs = getAccounts();
            const emailKey = email.toLowerCase();
            if (accs[emailKey])
                return { ok:false, error:'Un compte existe déjà avec cet email' };

            accs[emailKey] = {
                id: 'u_' + Date.now(),
                username,
                email: emailKey,
                pwd: hash(password),
                createdAt: Date.now(),
            };
            saveAccounts(accs);

            const user = {
                id: accs[emailKey].id,
                username,
                email: emailKey,
                avatar: avatarLetter(username),
                createdAt: accs[emailKey].createdAt,
            };
            window.Storage?.setUser(user);
            return { ok:true, user };
        },

        login({ email, password, remember = true }) {
            if (!validEmail(email))
                return { ok:false, error:'Email invalide' };
            const accs = getAccounts();
            const emailKey = email.toLowerCase();
            const acc = accs[emailKey];
            if (!acc)
                return { ok:false, error:'Aucun compte trouvé pour cet email' };
            if (acc.pwd !== hash(password))
                return { ok:false, error:'Mot de passe incorrect' };

            const user = {
                id: acc.id,
                username: acc.username,
                email: acc.email,
                avatar: avatarLetter(acc.username),
                createdAt: acc.createdAt,
                remember,
            };
            window.Storage?.setUser(user);
            return { ok:true, user };
        },

        logout() {
            window.Storage?.clearUser();
        },

        // Reset password : marque un token (mock — accepte tout)
        requestReset(email) {
            if (!validEmail(email))
                return { ok:false, error:'Email invalide' };
            const accs = getAccounts();
            if (!accs[email.toLowerCase()])
                return { ok:false, error:'Aucun compte trouvé pour cet email' };
            return { ok:true, token: 'mock_' + Date.now() };
        },

        resetPassword({ email, newPassword }) {
            if (!validEmail(email))
                return { ok:false, error:'Email invalide' };
            if (!newPassword || newPassword.length < 6)
                return { ok:false, error:'Mot de passe trop court (6 caractères min)' };
            const accs = getAccounts();
            const acc  = accs[email.toLowerCase()];
            if (!acc) return { ok:false, error:'Aucun compte trouvé' };
            acc.pwd = hash(newPassword);
            saveAccounts(accs);
            return { ok:true };
        },

        // Compte démo (créé silencieusement la première fois)
        ensureDemoAccount() {
            const accs = getAccounts();
            if (accs['demo@mangahub.app']) return;
            accs['demo@mangahub.app'] = {
                id: 'u_demo',
                username: 'Kaito',
                email: 'demo@mangahub.app',
                pwd: hash('demo1234'),
                createdAt: Date.now(),
            };
            saveAccounts(accs);
        },
    };

    Auth.ensureDemoAccount();
    window.Auth = Auth;
})();
