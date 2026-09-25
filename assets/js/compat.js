// ============================================================
// compat.js — les fonctions JavaScript que le WebView d'Android 8 n'a pas
// ------------------------------------------------------------
// Chargé UNIQUEMENT dans l'APK, AVANT tout autre script.
//
// `build-mobile-www.js` transpile déjà le bundle mobile pour Chrome 61 (le
// WebView livré avec Android 8.0) : esbuild y réécrit la SYNTAXE récente
// (`?.`, `??`…). Il ne peut pas inventer les FONCTIONS qui manquent au moteur.
// Constaté sur émulateur API 26 : « Promise.allSettled is not a function » à
// l'ouverture de l'accueil — l'écran restait à moitié vide.
//
// Chaque complément n'est posé que si la fonction manque : sur un WebView à
// jour, ce fichier ne fait rien.
(function () {
    'use strict';
    const def = (obj, nom, fn) => {
        if (!obj[nom]) Object.defineProperty(obj, nom, { value: fn, writable: true, configurable: true });
    };

    // Chrome 76
    def(Promise, 'allSettled', function (iterable) {
        return Promise.all(Array.from(iterable, (p) => Promise.resolve(p).then(
            (value) => ({ status: 'fulfilled', value }),
            (reason) => ({ status: 'rejected', reason }))));
    });
    // Chrome 63
    def(Promise.prototype, 'finally', function (fn) {
        return this.then(
            (v) => Promise.resolve(fn && fn()).then(() => v),
            (e) => Promise.resolve(fn && fn()).then(() => { throw e; }));
    });
    // Chrome 73
    def(Object, 'fromEntries', function (entries) {
        const o = {};
        for (const [k, v] of entries) o[k] = v;
        return o;
    });
    // Chrome 69
    def(Array.prototype, 'flat', function (profondeur = 1) {
        return profondeur < 1 ? this.slice()
            : this.reduce((acc, x) => acc.concat(Array.isArray(x) ? x.flat(profondeur - 1) : x), []);
    });
    def(Array.prototype, 'flatMap', function (fn, ceci) { return this.map(fn, ceci).flat(1); });
    // Chrome 92
    def(Array.prototype, 'at', function (i) { i = Math.trunc(i) || 0; if (i < 0) i += this.length; return this[i]; });
    def(String.prototype, 'at', function (i) { i = Math.trunc(i) || 0; if (i < 0) i += this.length; return this[i]; });
    // Chrome 73
    def(String.prototype, 'matchAll', function (re) {
        const rx = new RegExp(re, re.flags.includes('g') ? re.flags : re.flags + 'g');
        const s = String(this);
        const out = [];
        let m;
        while ((m = rx.exec(s)) !== null) { out.push(m); if (m[0] === '') rx.lastIndex++; }
        return out[Symbol.iterator]();
    });
    // Chrome 85
    def(String.prototype, 'replaceAll', function (motif, rempl) {
        if (motif instanceof RegExp) return this.replace(motif, rempl);
        return this.split(String(motif)).join(typeof rempl === 'function' ? rempl(String(motif)) : rempl);
    });
    // Chrome 66 (Chrome 61 n'a pas AbortController) : un substitut qui ne
    // coupe rien, mais qui ne fait plus planter les appels qui en créent un.
    if (typeof window.AbortController === 'undefined') {
        window.AbortController = function () {
            this.signal = { aborted: false, addEventListener() {}, removeEventListener() {} };
            this.abort = () => { this.signal.aborted = true; };
        };
    }
    // Chrome 71
    if (typeof window.globalThis === 'undefined') window.globalThis = window;
})();
