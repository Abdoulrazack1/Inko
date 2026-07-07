// ============================================================
// lib/mailer.js — Envoi d'emails transactionnels (SMTP via nodemailer)
//   Corrige l'audit S1 : sans service mail, « mot de passe oublié » était
//   fonctionnellement mort en production (le token n'était jamais transmis).
//
// Configuration (server/.env) :
//   SMTP_HOST, SMTP_PORT (587 STARTTLS / 465 SSL), SMTP_SECURE (true pour 465),
//   SMTP_USER, SMTP_PASS, MAIL_FROM ("Inko <no-reply@exemple.com>"),
//   APP_URL (base publique des liens, ex. https://inko.exemple.com).
//
// Si SMTP_HOST n'est pas défini, isConfigured() renvoie false et l'appelant
// retombe sur le mode dev (token renvoyé au client), voir auth.controller.
// ============================================================
let nodemailer;
try { nodemailer = require('nodemailer'); } catch (_) { nodemailer = null; }

let _transport;   // créé à la demande, réutilisé ensuite

function isConfigured() {
    return !!(nodemailer && process.env.SMTP_HOST);
}

function transport() {
    if (_transport) return _transport;
    if (!isConfigured()) return null;
    _transport = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: String(process.env.SMTP_SECURE).toLowerCase() === 'true', // true = 465/SSL
        auth: (process.env.SMTP_USER || process.env.SMTP_PASS)
            ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
            : undefined,
    });
    return _transport;
}

function fromAddress() {
    return process.env.MAIL_FROM || process.env.SMTP_USER || 'no-reply@inko.local';
}

// Base publique pour construire les liens. APP_URL prime ; sinon on déduit de
// la requête (utile en dev/local), avec un dernier repli localhost.
function baseUrl(req) {
    if (process.env.APP_URL) return process.env.APP_URL.replace(/\/+$/, '');
    if (req) {
        const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
        const host = req.get && req.get('host');
        if (host) return `${proto}://${host}`;
    }
    return 'http://127.0.0.1:' + (process.env.PORT || 8088);
}

async function send({ to, subject, text, html }) {
    const t = transport();
    if (!t) throw new Error('SMTP non configuré');
    return t.sendMail({ from: fromAddress(), to, subject, text, html });
}

// ── Email de réinitialisation de mot de passe ──
async function sendPasswordReset(email, token, req) {
    const link = `${baseUrl(req)}/page_nouveaumdp.html?email=${encodeURIComponent(email)}&token=${token}`;
    const subject = 'Réinitialisation de ton mot de passe Inko';
    const text =
        `Tu as demandé à réinitialiser ton mot de passe Inko.\n\n` +
        `Ouvre ce lien (valable 1 heure) :\n${link}\n\n` +
        `Si tu n'es pas à l'origine de cette demande, ignore cet email.`;
    const html =
        `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto;color:#1c1b19">
            <h2 style="margin:0 0 12px">Réinitialisation de mot de passe</h2>
            <p>Tu as demandé à réinitialiser ton mot de passe <strong>Inko</strong>.</p>
            <p><a href="${link}" style="display:inline-block;padding:12px 20px;background:#ff6b1a;color:#fff;text-decoration:none;border-radius:8px">Choisir un nouveau mot de passe</a></p>
            <p style="font-size:13px;color:#666">Ce lien est valable 1 heure. Si tu n'es pas à l'origine de cette demande, ignore cet email.</p>
            <p style="font-size:12px;color:#999;word-break:break-all">${link}</p>
        </div>`;
    return send({ to: email, subject, text, html });
}

module.exports = { isConfigured, send, sendPasswordReset, baseUrl };
