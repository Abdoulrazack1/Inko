// ============================================================
// lib/password-policy.js — Politique de mot de passe (audit AMEL-70)
// ------------------------------------------------------------
// Avant : un minimum de 6 caractères, et rien d'autre. « azerty » et
// « 123456 » passaient, alors que ce sont littéralement les deux mots de
// passe les plus utilisés au monde — les essayer coûte deux tentatives.
//
// La règle retenue privilégie la LONGUEUR sur la composition. Imposer
// majuscule + chiffre + symbole produit surtout des « Motdepasse1! » :
// conforme à la règle, trivial à deviner. Une phrase longue résiste mieux et
// se retient. On refuse donc :
//   · moins de 8 caractères
//   · les mots de passe notoirement communs (liste courte, ciblée)
//   · un mot de passe qui n'est que le pseudo ou l'email
//   · une répétition d'un seul caractère ou une suite du clavier
// ============================================================

const MIN = 8;

// Liste courte et assumée : elle vise les essais évidents, pas l'exhaustivité.
// Une vraie protection contre le bourrinage est le rate-limit, déjà en place.
const COMMUNS = new Set([
    '12345678', '123456789', '1234567890', 'password', 'motdepasse', 'azertyui',
    'qwertyui', 'azerty123', 'qwerty123', 'iloveyou', 'princess', 'admin123',
    'welcome1', 'sunshine', 'football', 'baseball', 'superman', 'trustno1',
    'passw0rd', 'p@ssword', 'motdepasse1', 'abc12345', '11111111', '00000000',
    'inko1234', 'manga123', 'chapitre',
]);

const SUITES = ['abcdefghijklmnopqrstuvwxyz', '01234567890', 'azertyuiop', 'qwertyuiop'];

function normaliser(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * @returns {{ok: boolean, error?: string, score: number}}
 *   `score` 0-4 : sert aussi à l'indicateur visuel côté client.
 */
function verifier(motDePasse, { username, email } = {}) {
    const mdp = String(motDePasse || '');
    if (mdp.length < MIN) {
        return { ok: false, score: 0, error: `Mot de passe trop court (${MIN} caractères minimum)` };
    }
    const bas = normaliser(mdp);

    if (COMMUNS.has(bas)) {
        return { ok: false, score: 0, error: 'Ce mot de passe est parmi les plus utilisés au monde — choisis-en un autre' };
    }
    // Un seul caractère répété : « aaaaaaaa » fait 8 caractères et zéro entropie.
    if (/^(.)\1+$/.test(mdp)) {
        return { ok: false, score: 0, error: 'Un seul caractère répété n\'est pas un mot de passe' };
    }
    for (const suite of SUITES) {
        if (suite.includes(bas) || [...suite].reverse().join('').includes(bas)) {
            return { ok: false, score: 0, error: 'Une suite du clavier se devine en quelques essais' };
        }
    }
    // Le pseudo ou l'email comme mot de passe : le premier essai d'un attaquant
    // qui connaît le compte — et il le connaît, il est dans l'URL du profil.
    for (const perso of [username, (email || '').split('@')[0]]) {
        const p = normaliser(perso);
        if (p && p.length >= 3 && bas.includes(p)) {
            return { ok: false, score: 0, error: 'Ton mot de passe ne doit pas contenir ton pseudo ni ton email' };
        }
    }
    return { ok: true, score: scorer(mdp) };
}

// Score indicatif, volontairement simple : la longueur pèse le plus, la
// variété ajoute la marge. Il sert à INFORMER, jamais à bloquer — un score
// bas sur un mot de passe valide reste accepté.
function scorer(mdp) {
    let s = 0;
    if (mdp.length >= 8)  s++;
    if (mdp.length >= 12) s++;
    if (mdp.length >= 16) s++;
    const familles = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter(r => r.test(mdp)).length;
    if (familles >= 3) s++;
    return Math.min(4, s);
}

module.exports = { verifier, scorer, MIN };
