// ============================================================
// fichiers-locaux.js — les EPUB/CBZ/PDF importés, sur le téléphone
// ------------------------------------------------------------
// `import.html` et `localreader.html` téléversaient vers le hub, qui gardait
// le fichier et le resservait. Sans ordinateur, importer était donc
// impossible — alors que c'est précisément le cas où l'on en a le plus besoin :
// un EPUB qu'on a déjà, à lire dans le train.
//
// ── Pourquoi IndexedDB et pas localStorage ──────────────────
//
// `moi-local.js` garde des données personnelles : quelques dizaines de
// kilo-octets, du texte, un accès synchrone commode. Ici on parle de fichiers
// binaires de plusieurs mégaoctets. localStorage ne stocke que des chaînes —
// il faudrait encoder en base64, ce qui gonfle de 33 % et fait exploser la
// limite de 5 Mo dès le premier livre.
//
// IndexedDB stocke des `Blob` tels quels, sans limite pratique, et
// `downloads.js` l'utilise déjà pour les chapitres hors-ligne : c'est le même
// mécanisme, éprouvé sur ce même WebView.
//
// ── Le piège de la version de base ──────────────────────────
//
// ⚠ `indexedDB.open(nom)` SANS numéro de version CRÉE la base si elle
// n'existe pas, vide, en version 1 — et `onupgradeneeded` ne se déclenche
// alors jamais pour un code qui l'ouvre ensuite en version 1. Le magasin
// d'objets n'est JAMAIS créé, et l'import devient définitivement impossible
// sur une installation neuve, sans la moindre erreur. Le même défaut a déjà
// été rencontré sur la base des téléchargements. On ouvre donc toujours avec
// un numéro explicite.
(function () {
    'use strict';

    const BASE = 'inko_fichiers';
    const VERSION = 1;
    const MAGASIN = 'fichiers';

    let bd = null;

    function ouvrir() {
        if (bd) return Promise.resolve(bd);
        return new Promise((ok, ko) => {
            let r;
            try { r = indexedDB.open(BASE, VERSION); }
            catch (e) { return ko(e); }
            r.onupgradeneeded = () => {
                const d = r.result;
                if (!d.objectStoreNames.contains(MAGASIN)) {
                    d.createObjectStore(MAGASIN, { keyPath: 'id' });
                }
            };
            r.onsuccess = () => { bd = r.result; ok(bd); };
            r.onerror = () => ko(r.error || new Error('base indisponible'));
        });
    }

    function transaction(mode) {
        return ouvrir().then((d) => d.transaction(MAGASIN, mode).objectStore(MAGASIN));
    }

    const promesse = (req) => new Promise((ok, ko) => {
        req.onsuccess = () => ok(req.result);
        req.onerror = () => ko(req.error);
    });

    const id = () => 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

    // Le format se déduit de l'extension : c'est ce que fait déjà le serveur,
    // et `localreader.js` s'en sert pour choisir son moteur de rendu.
    function typeDe(nom) {
        const ext = String(nom || '').toLowerCase().split('.').pop();
        return ['epub', 'cbz', 'cbr', 'pdf'].includes(ext) ? ext : null;
    }

    /** La fiche d'un fichier, SANS son contenu — c'est ce que liste la page. */
    function fiche(e) {
        return {
            id: e.id, title: e.title, type: e.type, size: e.size,
            cover: e.cover || null, addedAt: e.addedAt, local: true,
        };
    }

    async function lister() {
        try {
            const m = await transaction('readonly');
            const tout = await promesse(m.getAll());
            return tout.sort((a, b) => (b.addedAt || '').localeCompare(a.addedAt || '')).map(fiche);
        } catch (e) {
            // Une base qui ne s'ouvre pas ne doit pas empêcher la page de
            // s'afficher : on rend une liste vide, l'utilisateur voit un écran
            // « aucun fichier » plutôt qu'une page morte.
            window.MH?.err?.('fichiers-locaux.js', e);
            return [];
        }
    }

    async function ajouter(fichier, meta = {}) {
        const type = typeDe(fichier.name);
        if (!type) throw new Error('Format non pris en charge — EPUB, CBZ, CBR ou PDF.');

        const entree = {
            id: id(),
            title: (meta.title || fichier.name.replace(/\.[^.]+$/, '')).slice(0, 200),
            type,
            size: fichier.size,
            cover: meta.cover || null,
            addedAt: new Date().toISOString(),
            // Le `Blob` est stocké TEL QUEL : IndexedDB le sait, et le
            // convertir en base64 gonflerait de 33 % pour rien.
            blob: fichier,
        };
        const m = await transaction('readwrite');
        await promesse(m.add(entree));
        return fiche(entree);
    }

    async function supprimer(idFichier) {
        const m = await transaction('readwrite');
        await promesse(m.delete(String(idFichier)));
        return { ok: true };
    }

    /** Le contenu binaire, pour le lecteur. */
    async function contenu(idFichier) {
        const m = await transaction('readonly');
        const e = await promesse(m.get(String(idFichier)));
        if (!e) throw new Error('Fichier introuvable sur cet appareil.');
        return e.blob.arrayBuffer();
    }

    /** Place occupée, pour le panneau des réglages. */
    async function place() {
        try {
            const m = await transaction('readonly');
            const tout = await promesse(m.getAll());
            return tout.reduce((n, e) => n + (e.size || 0), 0);
        } catch (e) { return 0; }
    }

    window.INKO_FICHIERS_LOCAUX = { disponible: true, lister, ajouter, supprimer, contenu, place, typeDe };
})();
