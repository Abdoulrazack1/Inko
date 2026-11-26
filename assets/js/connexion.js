// ============================================================
// connexion.js — se connecter, créer un compte, retrouver son mot de passe
// ------------------------------------------------------------
// FON-03 / OPS-08 : le serveur savait tout cela depuis longtemps, mais aucun
// écran ne l'exposait. Sur un hub à plusieurs comptes, ou servi par Docker,
// PERSONNE ne pouvait entrer : la connexion automatique n'accepte que la
// machine elle-même, et rien d'autre n'existait. Des liens « Se connecter »
// pointaient déjà vers cette page, qui n'existait pas.
// ============================================================
(function () {
    'use strict';
    const $ = (id) => document.getElementById(id);
    const param = (k) => new URLSearchParams(location.search).get(k);

    // Retour : seulement une page de l'application, jamais une autre adresse.
    function destination() {
        const r = param('retour') || '';
        return /^[a-z0-9-]+\.html(\?[^#]*)?$/i.test(r) && !/^connexion\.html/i.test(r) ? r : 'accueil.html';
    }

    const FORMULAIRES = ['cxConnexion', 'cxInscription', 'cxOubli', 'cxReinit'];
    function montrer(id, titre) {
        for (const f of FORMULAIRES) $(f).hidden = f !== id;
        const onglets = id === 'cxConnexion' || id === 'cxInscription';
        document.querySelector('.cx-onglets').hidden = !onglets;
        $('cxOngletConnexion').setAttribute('aria-selected', String(id === 'cxConnexion'));
        $('cxOngletInscription').setAttribute('aria-selected', String(id === 'cxInscription'));
        $('cxTitre').textContent = titre || (id === 'cxInscription' ? 'Créer un compte' : 'Connexion');
        const premier = $(id).querySelector('input:not([type=hidden]):not([readonly])');
        if (premier) setTimeout(() => premier.focus(), 0);
    }

    function erreur(form, message) {
        const p = form.querySelector('.cx-erreur');
        p.textContent = message || '';
        p.hidden = !message;
    }

    // Un bouton désactivé pendant l'envoi : deux clics ne font pas deux comptes.
    async function envoyer(form, action) {
        const bouton = form.querySelector('button[type=submit]');
        erreur(form, '');
        bouton.disabled = true;
        try { await action(Object.fromEntries(new FormData(form))); }
        catch (e) {
            const msg = e && e.network ? 'Le serveur ne répond pas. Vérifie que le hub est allumé.'
                : (e && e.data && e.data.error) || (e && e.message) || 'Une erreur est survenue.';
            erreur(form, msg);
        } finally { bouton.disabled = false; }
    }

    const entrer = () => { location.replace(destination()); };

    function brancher() {
        $('cxOngletConnexion').addEventListener('click', () => montrer('cxConnexion'));
        $('cxOngletInscription').addEventListener('click', () => montrer('cxInscription'));
        $('cxVersOubli').addEventListener('click', () => montrer('cxOubli', 'Mot de passe oublié'));
        document.querySelectorAll('[data-retour]').forEach((b) => b.addEventListener('click', () => montrer('cxConnexion')));

        $('cxConnexion').addEventListener('submit', (ev) => {
            ev.preventDefault();
            envoyer(ev.target, async (d) => {
                if (!API.auth.validateEmail(d.email)) throw new Error('Adresse e-mail invalide.');
                if (!d.password) throw new Error('Mot de passe requis.');
                await API.auth.login({ email: d.email.trim(), password: d.password });
                entrer();
            });
        });

        $('cxInscription').addEventListener('submit', (ev) => {
            ev.preventDefault();
            envoyer(ev.target, async (d) => {
                if (!d.username || d.username.trim().length < 2) throw new Error('Nom d’utilisateur trop court (2 caractères au moins).');
                if (!API.auth.validateEmail(d.email)) throw new Error('Adresse e-mail invalide.');
                await API.auth.register({ username: d.username.trim(), email: d.email.trim(), password: d.password });
                entrer();
            });
        });

        $('cxOubli').addEventListener('submit', (ev) => {
            ev.preventDefault();
            const form = ev.target;
            envoyer(form, async (d) => {
                if (!API.auth.validateEmail(d.email)) throw new Error('Adresse e-mail invalide.');
                const r = await API.auth.requestReset(d.email.trim());
                // Sur l'ordinateur qui héberge Inko, sans serveur de messagerie,
                // le code est rendu directement : on passe à l'étape suivante.
                if (r && r.token) {
                    preparerReinit(d.email.trim(), r.token);
                    return;
                }
                const ok = form.querySelector('.cx-ok');
                ok.textContent = 'Si un compte existe avec cette adresse, un lien vient d’être envoyé.';
                ok.hidden = false;
            });
        });

        $('cxReinit').addEventListener('submit', (ev) => {
            ev.preventDefault();
            envoyer(ev.target, async (d) => {
                await API.auth.resetPassword({ email: d.email.trim(), token: d.token.trim(), newPassword: d.newPassword });
                montrer('cxConnexion');
                $('cxConnexion').querySelector('input[name=email]').value = d.email.trim();
                const p = $('cxConnexion').querySelector('.cx-ok');
                p.textContent = 'Mot de passe changé. Tu peux te connecter.';
                p.hidden = false;
            });
        });
    }

    function preparerReinit(email, jeton) {
        const f = $('cxReinit');
        f.querySelector('input[name=email]').value = email || '';
        f.querySelector('input[name=token]').value = jeton || '';
        // Code déjà connu (lien reçu, ou réponse locale) : inutile de l'afficher.
        $('cxCodeLigne').hidden = !!jeton;
        montrer('cxReinit', 'Nouveau mot de passe');
    }

    async function demarrer() {
        brancher();
        // Lien reçu par e-mail : connexion.html?reset=<code>&email=<adresse>
        if (param('reset')) { preparerReinit(param('email'), param('reset')); return; }
        montrer(location.hash === '#inscription' ? 'cxInscription' : 'cxConnexion');
        // Déjà connecté (connexion automatique sur l'ordinateur, ou session
        // valide) : on le dit plutôt que de réafficher un formulaire.
        try { await API.ready; } catch (e) { /* le formulaire reste */ }
        const u = API.user;
        if (u) {
            for (const f of FORMULAIRES) $(f).hidden = true;
            document.querySelector('.cx-onglets').hidden = true;
            $('cxChapeau').hidden = true;
            $('cxTitre').textContent = 'Tu es connecté';
            $('cxConnecteTexte').textContent = `Compte : ${u.username}.`;
            $('cxContinuer').href = destination();
            $('cxConnecte').hidden = false;
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        if (window.MH && MH.initPage) MH.initPage('');
        demarrer();
    });
})();
