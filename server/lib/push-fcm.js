// ============================================================
// push-fcm.js — notifications vers les appareils appairés (P2.5)
// ------------------------------------------------------------
// Firebase Cloud Messaging, protocole HTTP v1. L'ancienne API « legacy » à
// clé serveur est arrêtée depuis 2024 : elle n'est donc pas une option, même
// si tous les tutoriels la montrent encore.
//
// ── Ce module marche SANS configuration ─────────────────────
//
// Tant qu'aucun compte de service n'est fourni, `envoyer()` ne fait rien et le
// dit une fois. C'est délibéré : le reste d'Inko ne doit pas dépendre d'un
// projet Firebase que l'utilisateur n'a peut-être pas créé. Un hub domestique
// qui marche parfaitement sans notifications ne doit pas refuser de démarrer
// parce qu'un fichier de clés manque.
//
// ── Pourquoi pas `firebase-admin` ───────────────────────────
//
// Le paquet officiel tire une cinquantaine de dépendances pour, ici, une
// signature RS256 et deux appels HTTPS. Sur un hub qu'on installe chez soi,
// chaque dépendance est une mise à jour de sécurité de plus à suivre.
'use strict';

const crypto = require('crypto');
const fs = require('fs');

const CHEMIN = process.env.FCM_SERVICE_ACCOUNT || '';
const PORTEE = 'https://www.googleapis.com/auth/firebase.messaging';

let _compte = null;      // contenu du compte de service
let _prevenu = false;    // on ne répète pas l'avertissement à chaque envoi
let _jeton = null;       // { valeur, expire }

function compte() {
    if (_compte) return _compte;
    if (!CHEMIN) return null;
    try {
        _compte = JSON.parse(fs.readFileSync(CHEMIN, 'utf8'));
        if (!_compte.client_email || !_compte.private_key || !_compte.project_id) {
            console.error('[push] le compte de service est incomplet (client_email, private_key, project_id attendus)');
            _compte = null;
        }
        return _compte;
    } catch (e) {
        console.error(`[push] compte de service illisible (${CHEMIN}) : ${e.message}`);
        return null;
    }
}

function b64url(buf) {
    return Buffer.from(buf).toString('base64')
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Jeton d'accès OAuth, obtenu contre un JWT signé par le compte de service.
 * Mémorisé jusqu'à une minute avant son échéance : les jetons Google durent
 * une heure, en redemander un à chaque notification serait un appel réseau de
 * plus pour rien — et un point de panne supplémentaire.
 */
async function jetonAcces() {
    const c = compte();
    if (!c) return null;
    if (_jeton && _jeton.expire > Date.now() + 60000) return _jeton.valeur;

    const maintenant = Math.floor(Date.now() / 1000);
    const entete = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const charge = b64url(JSON.stringify({
        iss: c.client_email,
        scope: PORTEE,
        aud: 'https://oauth2.googleapis.com/token',
        iat: maintenant,
        exp: maintenant + 3600,
    }));
    const signature = b64url(
        crypto.createSign('RSA-SHA256').update(`${entete}.${charge}`).sign(c.private_key));

    const r = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion: `${entete}.${charge}.${signature}`,
        }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.access_token) {
        console.error(`[push] jeton d'accès refusé : ${d.error_description || d.error || r.status}`);
        return null;
    }
    _jeton = { valeur: d.access_token, expire: Date.now() + (d.expires_in || 3600) * 1000 };
    return _jeton.valeur;
}

function configure() { return !!compte(); }

/**
 * Envoie une notification à un appareil.
 *
 * @returns {Promise<{ok: boolean, invalide?: boolean, raison?: string}>}
 *   `invalide` signale un jeton que Google ne reconnaît plus : l'appelant doit
 *   alors le SUPPRIMER. Sans ce nettoyage, la table grossit indéfiniment de
 *   jetons morts — un téléphone réinstallé en laisse un derrière lui à chaque
 *   fois — et chaque notification part vers des adresses qui n'existent plus.
 */
async function envoyer(token, { titre, corps, donnees = {} }) {
    const c = compte();
    if (!c) {
        if (!_prevenu) {
            _prevenu = true;
            console.log('[push] notifications désactivées : FCM_SERVICE_ACCOUNT non défini '
                + '(voir docs/notifications-push.md). Le reste d’Inko fonctionne normalement.');
        }
        return { ok: false, raison: 'non configuré' };
    }
    const acces = await jetonAcces();
    if (!acces) return { ok: false, raison: 'jeton d’accès indisponible' };

    const r = await fetch(
        `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(c.project_id)}/messages:send`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${acces}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: {
                    token,
                    notification: { title: titre, body: corps },
                    // Les données voyagent en chaînes : FCM refuse tout autre
                    // type, silencieusement pour certaines bibliothèques.
                    data: Object.fromEntries(
                        Object.entries(donnees).map(([k, v]) => [k, String(v)])),
                    android: {
                        priority: 'normal',   // un nouveau chapitre n'est pas une urgence
                        notification: { channel_id: 'chapitres' },
                    },
                },
            }),
        });

    if (r.ok) return { ok: true };
    const d = await r.json().catch(() => ({}));
    const statut = d?.error?.details?.[0]?.errorCode || d?.error?.status || String(r.status);
    // UNREGISTERED : l'application a été désinstallée, ou le jeton réattribué.
    // INVALID_ARGUMENT sur un jeton : il n'a jamais été valide.
    const invalide = statut === 'UNREGISTERED' || statut === 'NOT_FOUND'
        || (r.status === 400 && /token/i.test(JSON.stringify(d?.error || '')));
    return { ok: false, invalide, raison: d?.error?.message || statut };
}

module.exports = { envoyer, configure };
