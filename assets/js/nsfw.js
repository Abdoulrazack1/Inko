// ============================================================
// nsfw.js — Section adulte cachée (+18)
// ============================================================
// Modèle : le contenu adulte (erotica / pornographic / hentai / ecchi)
// est INVISIBLE par défaut. L'utilisateur active un « Espace +18 »
// protégé par un code PIN dans les Paramètres. Une fois activé, l'accès
// se fait via la page cachée secret.html après saisie du PIN.
//
// Sécurité (volontairement légère, c'est un gate de confort, pas un
// coffre-fort) :
//   - PIN haché en SHA-256 base64 dans les prefs locales.
//   - Déverrouillage stocké en sessionStorage → re-verrouille à la
//     fermeture de l'onglet.
// ============================================================
(function () {
    'use strict';

    const PIN_KEY      = 'nsfwPinHash';   // pref (persistant)
    const ENABLED_KEY  = 'nsfwEnabled';   // pref (persistant)
    const UNLOCK_KEY   = 'mh_nsfw_unlocked'; // sessionStorage

    async function sha256(str) {
        try {
            const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
            return btoa(String.fromCharCode(...new Uint8Array(buf)));
        } catch (e) {
            // Fallback ultra-simple si crypto.subtle indispo (http non sécurisé)
            let h = 0; for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
            return 'f' + h;
        }
    }

    const NSFW = {
        // ── État ──
        isEnabled() { return !!window.Storage?.getPref(ENABLED_KEY); },
        isUnlocked() {
            try { return sessionStorage.getItem(UNLOCK_KEY) === '1'; } catch (e) { return false; }
        },
        hasPin() { return !!window.Storage?.getPref(PIN_KEY); },

        // ── Activation / PIN ──
        async enable(pin) {
            if (!/^\d{4,8}$/.test(pin || '')) throw new Error('Le code doit faire 4 à 8 chiffres');
            const hash = await sha256(pin);
            window.Storage?.setPref(PIN_KEY, hash);
            window.Storage?.setPref(ENABLED_KEY, true);
        },
        async disable(pin) {
            // Pour désactiver il faut le bon PIN
            if (!await this.verify(pin)) throw new Error('Code incorrect');
            window.Storage?.setPref(ENABLED_KEY, false);
            window.Storage?.setPref(PIN_KEY, '');
            this.lock();
        },
        async changePin(oldPin, newPin) {
            if (!await this.verify(oldPin)) throw new Error('Ancien code incorrect');
            await this.enable(newPin);
        },

        // ── Verrouillage ──
        async verify(pin) {
            const stored = window.Storage?.getPref(PIN_KEY);
            if (!stored) return false;
            return (await sha256(pin || '')) === stored;
        },
        async unlock(pin) {
            if (!await this.verify(pin)) return false;
            try { sessionStorage.setItem(UNLOCK_KEY, '1'); } catch (e) {}
            return true;
        },
        lock() {
            try { sessionStorage.removeItem(UNLOCK_KEY); } catch (e) {}
        },
    };

    window.NSFW = NSFW;
})();
