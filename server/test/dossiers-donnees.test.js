// DAT-24 : les données de l'app Windows quittent le dossier d'installation.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const dossiers = require('../lib/dossiers');

function avecEnv(vars, fn) {
    const avant = {};
    for (const k of Object.keys(vars)) { avant[k] = process.env[k]; if (vars[k] == null) delete process.env[k]; else process.env[k] = vars[k]; }
    try { return fn(); } finally {
        for (const k of Object.keys(avant)) { if (avant[k] === undefined) delete process.env[k]; else process.env[k] = avant[k]; }
    }
}

test('installée : sauvegardes et imports vont dans %APPDATA%\\Inko', () => {
    const appdata = fs.mkdtempSync(path.join(os.tmpdir(), 'inko-dossiers-'));
    avecEnv({ APP_VERSION: '9.9.9', APPDATA: appdata, BACKUP_DIR: null, INKO_UPLOADS_DIR: null }, () => {
        assert.strictEqual(dossiers.dossierDonnees('backups', 'BACKUP_DIR'), path.join(appdata, 'Inko', 'backups'));
        assert.strictEqual(dossiers.dossierDonnees('uploads', 'INKO_UPLOADS_DIR'), path.join(appdata, 'Inko', 'uploads'));
    });
    fs.rmSync(appdata, { recursive: true, force: true });
});

test('depuis les sources : rien ne change, et la variable explicite garde la main', () => {
    avecEnv({ APP_VERSION: null, BACKUP_DIR: null }, () => {
        assert.strictEqual(dossiers.dossierDonnees('backups', 'BACKUP_DIR'), path.join(__dirname, '..', 'backups'));
    });
    avecEnv({ APP_VERSION: '9.9.9', BACKUP_DIR: '/ailleurs' }, () => {
        assert.strictEqual(dossiers.dossierDonnees('backups', 'BACKUP_DIR'), '/ailleurs');
    });
});

test("le déplacement n'écrase rien et vide l'ancien dossier", () => {
    const racine = fs.mkdtempSync(path.join(os.tmpdir(), 'inko-deplacer-'));
    const ancien = path.join(racine, 'ancien'), cible = path.join(racine, 'cible');
    fs.mkdirSync(path.join(ancien, '26'), { recursive: true });
    fs.writeFileSync(path.join(ancien, 'inko-backup-1.json'), 'vieux');
    fs.writeFileSync(path.join(ancien, 'deja.json'), 'vieux');
    fs.writeFileSync(path.join(ancien, '26', 'livre.epub'), 'epub');
    fs.mkdirSync(cible);
    fs.writeFileSync(path.join(cible, 'deja.json'), 'neuf');

    const n = dossiers._internes.deplacer(ancien, cible);
    assert.strictEqual(n, 2);
    assert.strictEqual(fs.readFileSync(path.join(cible, 'inko-backup-1.json'), 'utf8'), 'vieux');
    assert.strictEqual(fs.readFileSync(path.join(cible, '26', 'livre.epub'), 'utf8'), 'epub');
    assert.strictEqual(fs.readFileSync(path.join(cible, 'deja.json'), 'utf8'), 'neuf', 'le fichier déjà présent est gardé');
    assert.ok(fs.existsSync(path.join(ancien, 'deja.json')), "le doublon reste à l'ancien endroit plutôt que d'être perdu");
    assert.strictEqual(dossiers._internes.deplacer(ancien, ancien), 0);
    fs.rmSync(racine, { recursive: true, force: true });
});
