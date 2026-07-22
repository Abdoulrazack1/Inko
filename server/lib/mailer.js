// ============================================================
// lib/mailer.js — Email transactionnel (audit S8)
// ------------------------------------------------------------
// Consomme enfin les variables SMTP_* documentées depuis longtemps
// dans .env.example mais jamais câblées : sans ce module, le flux
// « mot de passe oublié » répondait {ok:true} en production sans
// jamais rien envoyer.
//
// Config (.env) :
//   SMTP_HOST=smtp.exemple.com     ← requis pour activer l'envoi
//   SMTP_PORT=587                  ← 465 = SSL implicite, sinon STARTTLS
//   SMTP_SECURE=false              ← true pour le port 465
//   SMTP_USER= / SMTP_PASS=        ← identifiants (optionnels selon serveur)
//   MAIL_FROM=Inko <no-reply@exemple.com>
//   APP_URL=https://inko.exemple.com   ← base publique des liens envoyés
// ============================================================
let nodemailer = null;
try { nodemailer = require('nodemailer'); }
catch (e) { /* dépendance absente : isConfigured() restera false */ }

let _transport = null;

function isConfigured() {
    return Boolean(nodemailer && (process.env.SMTP_HOST || '').trim());
}

function getTransport() {
    if (_transport) return _transport;
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    _transport = nodemailer.createTransport({
        host:   process.env.SMTP_HOST.trim(),
        port,
        secure: process.env.SMTP_SECURE === 'true' || port === 465,
        ...(process.env.SMTP_USER ? {
            auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || '' },
        } : {}),
    });
    return _transport;
}

/**
 * Envoie l'email de réinitialisation de mot de passe.
 * Lien basé sur APP_URL ; le token reste aussi utilisable via
 * l'API `/auth/reset` (email + token + nouveau mot de passe).
 */
async function sendPasswordReset(email, token) {
    const base = (process.env.APP_URL || '').trim().replace(/\/+$/, '');
    const link = base ? `${base}/parametres.html?resetToken=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}` : null;
    const from = process.env.MAIL_FROM || 'Inko <no-reply@localhost>';

    const textLines = [
        'Bonjour,',
        '',
        'Une réinitialisation de mot de passe a été demandée pour ton compte Inko.',
        link ? `Ouvre ce lien pour continuer : ${link}` : `Ton code de réinitialisation : ${token}`,
        '',
        'Ce code expire dans 1 heure. Si tu n\'es pas à l\'origine de cette demande, ignore cet email.',
    ];

    await getTransport().sendMail({
        from,
        to: email,
        subject: 'Inko — Réinitialisation de ton mot de passe',
        text: textLines.join('\n'),
    });
}

module.exports = { isConfigured, sendPasswordReset };
