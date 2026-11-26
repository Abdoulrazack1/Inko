// ============================================================
// test/fermeture.test.js — ce que le serveur refuse (audit SEC-01, SEC-02, SEC-04)
// ------------------------------------------------------------
// Démontré le 24 novembre sur un serveur de développement : une page tierce
// obtenait le jeton du propriétaire par /auth/local, et le dépôt entier
// (tests, scripts, documents d'audit) était servi.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { spawnSync } = require('child_process');

const { corsOptions, origineAdmiseEnLocal } = require('../middleware/security');
const { localOnly } = require('../middleware/auth');
const { estPublic, pagesDe } = require('../lib/fichiers-publics');
const { brute, adresseSure } = require('../lib/couverture');

const cors = (origine) => { let r; corsOptions().origin(origine, (_e, ok) => { r = ok; }); return r; };

test('hors production, une origine tierce n’obtient rien ; la boucle locale oui', () => {
    for (const o of ['https://evil.example', 'http://localhost.evil.example', 'http://127.0.0.1.evil.example', 'null', 'http://192.168.1.20:8088']) {
        assert.equal(cors(o), false, o);
    }
    for (const o of ['http://localhost:8088', 'http://127.0.0.1:3000', 'http://[::1]:8088', 'http://localhost', 'capacitor://localhost', undefined]) {
        assert.equal(cors(o), true, String(o));
    }
});

test('CORS_ALLOW_ANY=1 reste la seule porte ouverte, et elle est explicite', () => {
    const r = spawnSync(process.execPath, ['-e', "require('./middleware/security').corsOptions().origin('https://evil.example', (e, ok) => process.stdout.write(String(ok)))"],
        { cwd: path.join(__dirname, '..'), env: { ...process.env, CORS_ALLOW_ANY: '1', NODE_ENV: '', APP_VERSION: '', CORS_ORIGINS: '' }, encoding: 'utf8' });
    assert.equal(r.stdout.trim().split('\n').pop(), 'true');
});

test('/auth/local : une page tierce dans le navigateur de la machine est refusée', () => {
    const essai = (origin) => {
        let statut = 200, passe = false;
        const req = { headers: origin ? { origin } : {}, socket: { remoteAddress: '127.0.0.1' }, ip: '127.0.0.1' };
        const res = { status(c) { statut = c; return this; }, json() { return this; } };
        localOnly(req, res, () => { passe = true; });
        return passe ? 200 : statut;
    };
    assert.equal(essai('https://evil.example'), 403);
    assert.equal(essai('null'), 403);
    assert.equal(essai('http://attaquant.test:8088'), 403, 'DNS rebinding : même port, nom tiers');
    assert.equal(essai(undefined), 200, 'client natif ou outil local');
    assert.equal(essai('http://localhost:8088'), 200);
    assert.equal(essai('tauri://localhost'), 200);
    assert.equal(essai('http://tauri.localhost'), 200);
    assert.equal(origineAdmiseEnLocal('http://localhost'), true, 'l’app Android');
});

test('seuls les fichiers publics sont servis', () => {
    const racine = path.join(__dirname, '..', '..');
    const pages = pagesDe(racine);
    assert.ok(pages.has('bibliotheque') && pages.has('accueil'));
    for (const p of ['/', '/accueil.html', '/bibliotheque', '/assets/js/global.js', '/assets/css/global.css', '/manifest.webmanifest', '/service-worker.js']) {
        assert.equal(estPublic(p, pages), true, p);
    }
    for (const p of ['/package.json', '/Dockerfile', '/server', '/server/.env', '/server%2f.env', '/scripts-ci/gen-openapi.js', '/test/unit/api.test.js',
        '/docs/audit/sondes.json', '/AUDIT-INKO-2026-07-28.md', '/.git/config', '/assets/../server/.env', '/assets/..%2fserver%2f.env',
        '/assets/%2e%2e/server/.env', '/assets/..%5cserver%5c.env', '/inconnue.html', '//server/.env', '/%00']) {
        assert.equal(estPublic(p, pages), false, p);
    }
});

test('une couverture n’est conservée que si son adresse est sûre', () => {
    for (const u of ['https://a.test/c.jpg', 'http://a.test/c.jpg', '/assets/img/icon.svg', 'assets/x.png', '//cdn.test/c.jpg', 'data:image/png;base64,AAAA', 'blob:http://localhost/x']) {
        assert.equal(adresseSure(u), true, u);
    }
    for (const u of ['javascript:alert(1)', 'JavaScript:alert(1)', 'java\tscript:alert(1)', ' javascript:x', 'vbscript:x', 'data:text/html,<script>1</script>', 'file:///C:/x']) {
        assert.equal(brute(u), null, JSON.stringify(u));
    }
    assert.equal(brute('http://127.0.0.1:8088/api/img?u=' + encodeURIComponent('javascript:alert(1)')), null, 'y compris emballée dans le proxy');
});
