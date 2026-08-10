// ============================================================
// serveur-sous-test.spec.js — on teste bien l'arbre de travail
// ------------------------------------------------------------
// `reuseExistingServer` (playwright.config.js) reprend tout serveur qui
// repond deja sur le port. C'est commode… jusqu'au jour ou ce n'est pas le
// bon serveur : l'application DESKTOP installee ecoute sur le meme port 8088
// et sert son frontend EMBARQUE, c'est-a-dire une version figee au dernier
// build.
//
// Constate : une modification de assets/js/catalogue.js verifiee « verte »
// alors que le fichier servi ne la contenait pas. Un test qui valide un autre
// code que celui qu'on vient d'ecrire est pire qu'un test absent — il donne
// une certitude fausse.
//
// Ce fichier compare donc, octet a octet, un asset servi avec celui du dépôt.
'use strict';

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// Un fichier qui change souvent : s'il correspond, le serveur sert bien d'ici.
const TEMOIN = 'assets/js/catalogue.js';

test('le serveur teste sert bien le code du depot', async ({ request }) => {
    const attendu = fs.readFileSync(path.join(__dirname, '..', '..', TEMOIN), 'utf8');
    const reponse = await request.get('/' + TEMOIN, { headers: { 'Cache-Control': 'no-store' } });
    expect(reponse.ok(), `GET /${TEMOIN} a repondu ${reponse.status()}`).toBe(true);
    const servi = await reponse.text();

    // Fins de ligne normalisees : git peut livrer du CRLF sur Windows, ce qui
    // n'est pas une divergence de contenu (meme lecon que gen-openapi --check).
    const nl = (v) => v.split('\r\n').join('\n');
    expect(nl(servi).length, [
        '',
        `Le serveur ne sert pas ${TEMOIN} depuis ce depot.`,
        'Cause la plus frequente : l’application Inko installee tourne et occupe',
        'le port — elle sert son frontend embarque, fige au dernier build.',
        'Ferme Inko (zone de notification) puis relance les tests.',
        '',
    ].join('\n')).toBe(nl(attendu).length);
    expect(nl(servi)).toBe(nl(attendu));
});
