// Mise à jour des extensions : notes de version et empreinte, montrées AVANT
// d'installer (page Sources). checkUpdates est exécuté pour de vrai, avec un
// versions.json temporaire qui annonce une version plus récente.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const Ext = require('../controllers/extensions.controller');
const { notesEntre } = Ext._internes;
const DIR = path.join(__dirname, '..', '..', 'extensions-community');

test('notesEntre : les versions après l’installée, jusqu’à la dernière, la plus récente d’abord', () => {
    const entrees = [
        { version: '1.4.1', notes: ['a'] }, { version: '1.5.0', date: '2026-11-01', notes: ['b'] },
        { version: '1.4.2', notes: ['c'] }, { version: '1.6.0', notes: ['trop récente'] },
    ];
    assert.deepStrictEqual(notesEntre(entrees, '1.4.1', '1.5.0').map(n => n.version), ['1.5.0', '1.4.2']);
    assert.deepStrictEqual(notesEntre(entrees, null, '1.4.1').map(n => n.version), ['1.4.1'], 'nouvelle source : jusqu’à la dernière');
    assert.deepStrictEqual(notesEntre(undefined, '1.0.0', '2.0.0'), []);
});

test('checkUpdates : notes et empreinte attendue pour chaque mise à jour', async () => {
    const fichier = path.join(DIR, 'versions.json');
    const fichierNotes = path.join(DIR, 'changelog.json');
    const avant = fs.readFileSync(fichier);
    const notesAvant = fs.readFileSync(fichierNotes);
    const id = fs.readdirSync(DIR).find(d => fs.existsSync(path.join(DIR, d, 'index.js')));
    fs.writeFileSync(fichier, JSON.stringify({ [id]: '99.0.0' }));
    const notes = JSON.parse(notesAvant);
    notes[id] = [...(notes[id] || []), { version: '99.0.0', date: '2030-01-01', notes: ['Nouvelle façon de lire les chapitres.'] }];
    fs.writeFileSync(fichierNotes, JSON.stringify(notes));
    try {
        const res = { json(o) { this.body = o; } };
        await Ext.checkUpdates({}, res, (e) => { throw e; });
        const u = (res.body.installed || []).find(x => x.id === id) || (res.body.available || []).find(x => x.id === id);
        assert.ok(u, `l’extension ${id} est listée`);
        const hashes = JSON.parse(fs.readFileSync(path.join(DIR, 'hashes.json'), 'utf8'));
        assert.equal(u.empreinte, hashes[id], 'l’empreinte attendue est montrée');
        assert.deepStrictEqual(u.notes.map(n => n.version), ['99.0.0'], 'seulement les versions à venir, pas l’installée');
        assert.deepStrictEqual(u.notes[0].notes, ['Nouvelle façon de lire les chapitres.']);
    } finally {
        fs.writeFileSync(fichier, avant);
        fs.writeFileSync(fichierNotes, notesAvant);
    }
});
