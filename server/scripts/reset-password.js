#!/usr/bin/env node
// ============================================================
// reset-password.js — Filet de secours admin (audit F.10 / N19)
// ------------------------------------------------------------
// En production (multi-utilisateur, self-hosted), le flux « mot de
// passe oublié » ne renvoie jamais le token dans la réponse HTTP et
// l'envoi d'email n'est pas toujours configuré : un utilisateur qui a
// perdu son mot de passe serait bloqué sans recours. Ce script permet
// à l'admin de la machine de réinitialiser un compte directement.
//
// Usage :
//   node scripts/reset-password.js <email>                 → génère un mot de passe aléatoire
//   node scripts/reset-password.js <email> <mot_de_passe>  → applique ce mot de passe
// ============================================================
const path   = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');

(async () => {
    const [, , email, passwordArg] = process.argv;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        console.error('Usage : node scripts/reset-password.js <email> [nouveau_mot_de_passe]');
        process.exit(1);
    }
    if (passwordArg && passwordArg.length < 6) {
        console.error('Mot de passe trop court (6 caractères minimum).');
        process.exit(1);
    }

    const [[user]] = await pool.query(
        'SELECT id, username FROM users WHERE email = ?', [email.toLowerCase()]
    );
    if (!user) {
        console.error(`Aucun compte avec l'email ${email}.`);
        process.exit(1);
    }

    // Mot de passe fourni, sinon généré (lisible, sans caractères ambigus)
    const password = passwordArg ||
        crypto.randomBytes(9).toString('base64').replace(/[+/=]/g, '').slice(0, 12);
    const hash = await bcrypt.hash(password, 10);
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, user.id]);
    // Invalide les demandes de reset en cours pour ce compte
    try { await pool.query('UPDATE password_resets SET used = 1 WHERE email = ?', [email.toLowerCase()]); } catch (e) {}

    console.log(`✔ Mot de passe réinitialisé pour ${user.username} <${email}>.`);
    if (!passwordArg) console.log(`  Nouveau mot de passe : ${password}`);
    console.log('  Conseil : le changer depuis Profil → Sécurité après connexion.');
    process.exit(0);
})().catch(e => { console.error('Erreur :', e.message); process.exit(1); });
