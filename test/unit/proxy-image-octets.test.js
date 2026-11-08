// ============================================================
// test/unit/proxy-image-octets.test.js — le proxy sert ce qu'il a recu,
// pas ce que l'URL promettait
// ------------------------------------------------------------
// Mesure, sur le serveur de developpement, avec une URL de couverture
// MangaDex invalide :
//
//     GET /api/img?u=https://uploads.mangadex.org/covers/.../c0a
//     200 OK   Content-Type: image/jpeg
//     corps    <!doctype html>\n<html lang="en">...
//
// Deux causes qui s'additionnent. `curl -s -L` n'a pas `-f` : un 404
// amont rend un code de sortie 0 et un corps — la page d'erreur. Et le
// `Content-Type` etait deduit de l'EXTENSION de l'URL distante, jamais
// des octets. Le corps faisait plus de 64 octets, il passait.
//
// La seconde consequence est pire que la premiere : la page d'erreur
// partait dans le CACHE DISQUE sous un nom en `.jpg`, pour toute la duree
// du TTL. La couverture restait donc cassee longtemps apres le retour de
// la source — et c'est le genre de panne qu'on attribue a l'application.
//
// Le raisonnement existait deja dans ce depot. `sniffType` dans
// `local.controller.js`, pose par l'audit SEC-14 : « le type etait decide
// sur la SEULE extension du nom de fichier ». Meme erreur, autre porte —
// c'est le defaut qui revient depuis l'etape 2.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..', '..');
const { typeImage, apercu } = require(path.join(RACINE, 'server', 'lib', 'type-image.js'));
const lire = (...p) => fs.readFileSync(path.join(RACINE, ...p), 'utf8').replace(/\r\n/g, '\n');

const remplir = (tete, n = 64) => Buffer.concat([Buffer.from(tete), Buffer.alloc(n)]);

test('chaque format d’image est reconnu par ses octets', () => {
    const CAS = [
        ['image/jpeg', Buffer.from([0xFF, 0xD8, 0xFF, 0xE0])],
        ['image/png', Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])],
        ['image/gif', Buffer.from('GIF89a')],
        ['image/gif', Buffer.from('GIF87a')],
        ['image/webp', Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP')])],
        ['image/bmp', Buffer.from('BM')],
        ['image/avif', Buffer.concat([Buffer.alloc(4), Buffer.from('ftypavif')])],
        ['image/heic', Buffer.concat([Buffer.alloc(4), Buffer.from('ftypheic')])],
        ['image/svg+xml', Buffer.from('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"/>')],
        ['image/svg+xml', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1"/>')],
    ];
    for (const [attendu, tete] of CAS) {
        assert.equal(typeImage(remplir(tete)), attendu, JSON.stringify(tete.slice(0, 12).toString('latin1')));
    }
});

test('une page d’erreur n’est pas une image, quoi qu’elle soit nommee', () => {
    // Le corps exact mesure sur la vraie reponse.
    const html = Buffer.from('<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="utf-8">\n'
        + '  <meta name="viewport" content="width=device-width, initial-scale=1">\n');
    assert.equal(typeImage(html), null);

    for (const corps of [
        '<html><body>404 Not Found</body></html>',
        '{"error":"not found"}',
        'Access denied',
        '<?xml version="1.0"?><Error><Code>NoSuchKey</Code></Error>',   // S3
        '<!-- un commentaire, puis rien -->',
    ]) {
        assert.equal(typeImage(remplir(Buffer.from(corps), 200)), null, corps.slice(0, 30));
    }

    // Trop court pour trancher : on refuse plutot que de deviner.
    assert.equal(typeImage(Buffer.from([0xFF, 0xD8, 0xFF])), null);
    assert.equal(typeImage(Buffer.alloc(0)), null);
    assert.equal(typeImage(null), null);

    // Un conteneur RIFF qui n'est pas du WEBP (du son, par exemple).
    assert.equal(typeImage(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WAVE'), Buffer.alloc(64)])), null);
});

test('l’apercu dit ce qui est arrive, au lieu de « non-image »', () => {
    assert.match(apercu(Buffer.from('<!doctype html><html lang="en"><head>')), /doctype html/);
    assert.match(apercu(Buffer.from([0x1F, 0x8B, 0x08, 0x00, 0x00, 0x00])), /octets, binaire inconnu/);
    assert.equal(apercu(Buffer.alloc(0)), 'réponse vide');
});

test('le proxy ne deduit plus le type de l’URL', () => {
    const src = lire('server', 'controllers', 'image.controller.js');
    assert.ok(!/function contentTypeFor/.test(src),
        'la deduction par extension ne doit plus exister');
    assert.match(src, /const type = typeImage\(stdout\);/,
        'le type vient des octets recus');
    assert.match(src, /if \(!type\) \{[\s\S]{0,200}reject\(new Error\('reponse non-image/,
        'une reponse non-image doit echouer, pas etre servie ni mise en cache');
    // L'extension reste lue, mais seulement pour le message : savoir ce
    // qu'on attendait aide a comprendre ce qu'on a eu.
    assert.match(src, /function extensionAnnoncee\(url\)/);
});

test('le cache disque deja empoisonne est refuse a la lecture', () => {
    // Sans ceci, le correctif ne vaudrait que pour les telechargements a
    // VENIR : les pages d'erreur deja ecrites resteraient servies pendant
    // tout le TTL, et le bug survivrait a sa correction.
    const src = lire('server', 'controllers', 'image.controller.js');
    const i = src.indexOf('const surD = await surDisque(url);');
    assert.notEqual(i, -1, 'la lecture du cache disque doit rester reperable');
    const bloc = src.slice(i, i + 1200);
    assert.match(bloc, /const reel = typeImage\(buf\);/);
    assert.match(bloc, /fsp\.unlink\(surD\.chemin\)/, 'le fichier fautif part');
    assert.match(bloc, /res\.set\('Content-Type', reel\);/,
        'ce qui est servi doit etre etiquete d’apres ses octets');
});

test('une reponse non-image est signalee, une fois par hote', () => {
    // Le navigateur recoit le meme 502 qu'en cas de source muette — il n'a
    // qu'une chose a savoir. Mais ce sont deux pannes differentes a
    // reparer, et sans trace on repartirait de zero a chaque fois.
    const src = lire('server', 'controllers', 'image.controller.js');
    assert.match(src, /if \(!proxy\._nonImage\) proxy\._nonImage = new Set\(\);/);
    assert.match(src, /proxy\._nonImage\.has\(host\)/, 'une fois par hote, pas par image');
    assert.match(src, /a repondu autre chose qu'une image/);
});
