// ============================================================
// sauvegarde-chiffree.js — un fichier, une phrase de passe, restaurable ailleurs
// ------------------------------------------------------------
// L'export JSON contient toute la bibliothèque, la progression, les notes du
// journal — c'est-à-dire ce qu'on lit, et ce qu'on en pense. En clair, il
// suffit de tomber sur le fichier (clé USB, dossier partagé, sauvegarde dans
// le nuage) pour tout lire.
//
// Le fichier chiffré est une enveloppe JSON lisible PAR INKO SEULEMENT avec la
// phrase de passe :
//   · clé dérivée de la phrase par PBKDF2-SHA-256, 310 000 itérations (la
//     valeur recommandée par l'OWASP), sel aléatoire de 16 octets ;
//   · contenu chiffré par AES-GCM 256 bits, vecteur aléatoire de 12 octets —
//     GCM authentifie : une phrase fausse ou un fichier altéré échouent, on ne
//     restaure jamais des données corrompues.
// Tout est fait par WebCrypto, dans le navigateur : la phrase ne quitte pas
// l'appareil, et le serveur ne voit passer que les données déchiffrées, comme
// pour un import ordinaire. Une phrase perdue ne se récupère PAS.
(function () {
    'use strict';

    const FORMAT = 'inko-sauvegarde-chiffree';
    const ITERATIONS = 310000;
    const subtle = () => (globalThis.crypto && globalThis.crypto.subtle) || null;

    const enB64 = (buf) => {
        const o = new Uint8Array(buf);
        let s = '';
        for (let i = 0; i < o.length; i += 0x8000) s += String.fromCharCode.apply(null, o.subarray(i, i + 0x8000));
        return btoa(s);
    };
    const deB64 = (b64) => Uint8Array.from(atob(b64), c => c.charCodeAt(0));

    async function cle(phrase, sel, iterations) {
        const brute = await subtle().importKey('raw', new TextEncoder().encode(phrase), 'PBKDF2', false, ['deriveKey']);
        return subtle().deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: sel, iterations },
            brute, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    }

    function estChiffree(objet) { return !!objet && objet.format === FORMAT; }

    async function chiffrer(donnees, phrase) {
        if (!subtle()) throw new Error('Chiffrement indisponible sur ce navigateur');
        if (!phrase || phrase.length < 8) throw new Error('La phrase de passe doit faire au moins 8 caractères');
        const sel = globalThis.crypto.getRandomValues(new Uint8Array(16));
        const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
        const k = await cle(phrase, sel, ITERATIONS);
        const clair = new TextEncoder().encode(JSON.stringify(donnees));
        const chiffre = await subtle().encrypt({ name: 'AES-GCM', iv }, k, clair);
        return {
            format: FORMAT, version: 1, creeLe: new Date().toISOString(),
            kdf: { nom: 'PBKDF2-SHA-256', iterations: ITERATIONS, sel: enB64(sel) },
            chiffrement: { nom: 'AES-GCM-256', iv: enB64(iv) },
            donnees: enB64(chiffre),
        };
    }

    async function dechiffrer(enveloppe, phrase) {
        if (!estChiffree(enveloppe)) throw new Error('Ce fichier n’est pas une sauvegarde chiffrée Inko');
        if (enveloppe.version !== 1) throw new Error('Version de sauvegarde inconnue — mets Inko à jour');
        if (!subtle()) throw new Error('Chiffrement indisponible sur ce navigateur');
        const k = await cle(phrase || '', deB64(enveloppe.kdf.sel), enveloppe.kdf.iterations);
        let clair;
        try {
            clair = await subtle().decrypt({ name: 'AES-GCM', iv: deB64(enveloppe.chiffrement.iv) }, k, deB64(enveloppe.donnees));
        } catch (e) {
            // GCM ne distingue pas les deux, et c'est voulu.
            throw new Error('Phrase de passe incorrecte, ou fichier abîmé');
        }
        return JSON.parse(new TextDecoder().decode(clair));
    }

    // ── Saisie de la phrase (deux champs masqués) ───────────
    function demanderPhrase({ titre, confirmer }) {
        return new Promise((resolve) => {
            const veil = document.createElement('div');
            veil.className = 'mh-modal-veil';
            veil.innerHTML = `<form class="mh-modal" role="dialog" aria-modal="true" aria-labelledby="phraseTitre">
                <div class="mh-modal-title" id="phraseTitre">${titre}</div>
                <div class="mh-modal-msg">${confirmer
                    ? 'Choisis une phrase d’au moins 8 caractères. Sans elle, le fichier ne pourra pas être restauré — elle ne se récupère pas.'
                    : 'La phrase choisie au moment de l’export.'}</div>
                <input class="mh-modal-input" type="password" id="phrase1" autocomplete="new-password" placeholder="Phrase de passe" aria-label="Phrase de passe">
                ${confirmer ? '<input class="mh-modal-input" type="password" id="phrase2" autocomplete="new-password" placeholder="La même, une seconde fois" aria-label="Confirmer la phrase de passe">' : ''}
                <div class="mh-modal-msg" id="phraseErreur" role="alert" style="color:var(--hanko,#c0392b)"></div>
                <div class="mh-modal-actions">
                    <button type="button" class="mh-modal-btn ghost" data-annuler>Annuler</button>
                    <button type="submit" class="mh-modal-btn primary">${confirmer ? 'Chiffrer et exporter' : 'Déchiffrer'}</button>
                </div></form>`;
            document.body.appendChild(veil);
            const form = veil.querySelector('form');
            // Le clavier est tenu par le piège partagé : entrer, y rester, et
            // revenir d’où l’on venait. `aria-modal` ne le fait pas tout seul.
            const liberer = window.MH?.piegerFocus?.(form, { surEchap: () => fin(null) }) || (() => {});
            const fin = (v) => { liberer(); veil.remove(); resolve(v); };
            veil.querySelector('[data-annuler]').addEventListener('click', () => fin(null));
            // Échap passe désormais par le piège, avec le reste du clavier.
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const p1 = form.querySelector('#phrase1').value;
                const err = form.querySelector('#phraseErreur');
                if (confirmer && p1.length < 8) { err.textContent = 'Au moins 8 caractères.'; return; }
                if (confirmer && p1 !== form.querySelector('#phrase2').value) { err.textContent = 'Les deux phrases ne sont pas identiques.'; return; }
                fin(p1);
            });
            form.querySelector('#phrase1').focus();
        });
    }

    globalThis.MH = globalThis.MH || {};
    globalThis.MH.sauvegardeChiffree = { chiffrer, dechiffrer, estChiffree, demanderPhrase, FORMAT };
})();
