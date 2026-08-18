// ============================================================
// cheerio-navigateur.js — cheerio, mais avec le DOM du navigateur
// ------------------------------------------------------------
// Six des neuf extensions d'Inko scrapent du HTML et dépendent de `cheerio`,
// une bibliothèque Node. C'est ce qui les cantonnait au hub : le téléphone ne
// pouvait pas les exécuter, et son catalogue se limitait donc aux sources qui
// exposent une API JSON.
//
// Or le WebView a `DOMParser` NATIVEMENT — un analyseur HTML complet, plus
// robuste que celui de cheerio puisque c'est celui du navigateur. Il ne
// manquait qu'une couche de compatibilité entre les deux interfaces.
//
// ── Pourquoi une couche plutôt qu'une réécriture ────────────
//
// Réécrire les six extensions pour le navigateur donnerait DEUX versions de
// chacune : celle du serveur et celle du téléphone. Elles divergeraient — un
// site change sa mise en page, on corrige d'un côté, on oublie l'autre, et la
// source marche sur un écran et pas sur l'autre. Le même fichier tourne donc
// aux deux endroits.
//
// ── L'étendue est mesurée, pas devinée ──────────────────────
//
// Relevé sur les six extensions : `$()` 106 fois, `.length` 80, `.text` 72,
// `.find` 53, `.attr` 52, `.first` 43, `cheerio.load` 30, `.map` 26, `.each`
// 24, `.filter` 24, `.html` 12, `.remove` 7, `.eq` 2, `.closest` 2,
// `.parent` 1. C'est tout. Implémenter cheerio en entier serait du travail
// perdu ; ce qui compte, c'est que CES appels-là se comportent à l'identique.
//
// ── Les pièges de compatibilité, un par un ──────────────────
//
// · `.map()` de cheerio rend un OBJET cheerio, pas un tableau : il faut
//   `.get()` derrière. Rendre un tableau ferait échouer les chaînes
//   `.map(...).get()` — présentes dans les six extensions.
// · `.each()` appelle `(index, element)` — l'inverse de `Array.forEach`, et
//   `this` y est l'élément DOM. Inverser les arguments casse silencieusement.
// · `.text()` de cheerio concatène le texte de TOUS les éléments retenus, pas
//   seulement du premier.
// · `.attr()` sans argument rend l'objet des attributs ; avec, la valeur du
//   PREMIER élément, ou `undefined` — jamais `null`, que les extensions
//   testent parfois par identité.
(function () {
    'use strict';

    /** Enveloppe une liste de nœuds avec l'interface de cheerio. */
    function Selection(noeuds, racine) {
        this._n = noeuds || [];
        this._racine = racine;
        this.length = this._n.length;
    }

    const env = (noeuds, racine) => new Selection(noeuds, racine);
    const uniques = (liste) => {
        const vus = new Set(); const out = [];
        for (const n of liste) if (n && !vus.has(n)) { vus.add(n); out.push(n); }
        return out;
    };

    Selection.prototype = {
        constructor: Selection,

        // ── Parcours ────────────────────────────────────────
        find(sel) {
            const out = [];
            for (const n of this._n) {
                if (!n.querySelectorAll) continue;
                out.push(...n.querySelectorAll(sel));
            }
            return env(uniques(out), this._racine);
        },
        children(sel) {
            const out = [];
            for (const n of this._n) {
                for (const c of (n.children || [])) if (!sel || c.matches(sel)) out.push(c);
            }
            return env(out, this._racine);
        },
        parent() {
            return env(uniques(this._n.map((n) => n.parentElement).filter(Boolean)), this._racine);
        },
        closest(sel) {
            return env(uniques(this._n.map((n) => (n.closest ? n.closest(sel) : null)).filter(Boolean)), this._racine);
        },
        next(sel) {
            const out = this._n.map((n) => n.nextElementSibling).filter(Boolean)
                .filter((n) => !sel || n.matches(sel));
            return env(out, this._racine);
        },
        prev(sel) {
            const out = this._n.map((n) => n.previousElementSibling).filter(Boolean)
                .filter((n) => !sel || n.matches(sel));
            return env(out, this._racine);
        },
        siblings(sel) {
            const out = [];
            for (const n of this._n) {
                for (const c of (n.parentElement ? n.parentElement.children : [])) {
                    if (c !== n && (!sel || c.matches(sel))) out.push(c);
                }
            }
            return env(uniques(out), this._racine);
        },

        // ── Réduction ───────────────────────────────────────
        first() { return env(this._n.slice(0, 1), this._racine); },
        last()  { return env(this._n.slice(-1), this._racine); },
        eq(i)   { const j = i < 0 ? this._n.length + i : i; return env(this._n.slice(j, j + 1), this._racine); },
        slice(a, b) { return env(this._n.slice(a, b), this._racine); },

        filter(quoi) {
            if (typeof quoi === 'string') {
                return env(this._n.filter((n) => n.matches && n.matches(quoi)), this._racine);
            }
            // Signature cheerio : (index, element), et `this` = l'élément.
            return env(this._n.filter((n, i) => quoi.call(n, i, n)), this._racine);
        },
        not(sel) { return env(this._n.filter((n) => !(n.matches && n.matches(sel))), this._racine); },
        is(sel)  { return this._n.some((n) => n.matches && n.matches(sel)); },
        hasClass(c) { return this._n.some((n) => n.classList && n.classList.contains(c)); },
        add(autre) {
            const suppl = autre instanceof Selection ? autre._n
                : typeof autre === 'string' ? [...(this._racine ? this._racine.querySelectorAll(autre) : [])]
                    : [autre];
            return env(uniques([...this._n, ...suppl]), this._racine);
        },

        // ── Itération ───────────────────────────────────────
        each(fn) {
            // ⚠ `(index, element)`, l'INVERSE d'Array.forEach — et `this` est
            // l'élément. Inverser casse en silence : `fn(el, i)` recevrait un
            // nombre là où le code attend un nœud.
            this._n.forEach((n, i) => fn.call(n, i, n));
            return this;
        },
        map(fn) {
            // ⚠ Rend un OBJET cheerio, pas un tableau : les extensions
            // enchaînent `.map(...).get()`. Rendre un tableau ferait échouer
            // `.get()` sur les six.
            const out = this._n.map((n, i) => fn.call(n, i, n));
            const s = env([], this._racine);
            s._n = out;
            s.length = out.length;
            s._brut = true;             // contient des valeurs, pas des nœuds
            return s;
        },
        get(i) {
            if (i === undefined) return this._n.slice();
            return this._n[i < 0 ? this._n.length + i : i];
        },
        toArray() { return this._n.slice(); },
        index(n) { return this._n.indexOf(n); },

        // ── Contenu ─────────────────────────────────────────
        text() {
            // cheerio concatène le texte de TOUS les éléments retenus.
            if (this._brut) return this._n.join('');
            return this._n.map((n) => (n.textContent || '')).join('');
        },
        html() {
            if (!this._n.length) return null;
            return this._n[0].innerHTML !== undefined ? this._n[0].innerHTML : null;
        },
        attr(nom, valeur) {
            if (nom === undefined) {
                const n = this._n[0];
                if (!n || !n.attributes) return undefined;
                const o = {};
                for (const a of n.attributes) o[a.name] = a.value;
                return o;
            }
            if (valeur !== undefined) {
                this._n.forEach((n) => n.setAttribute && n.setAttribute(nom, valeur));
                return this;
            }
            const n = this._n[0];
            if (!n || !n.getAttribute) return undefined;
            const v = n.getAttribute(nom);
            // ⚠ `undefined` et jamais `null` : les extensions testent parfois
            // `if (x === undefined)`, et `getAttribute` rend `null`.
            return v === null ? undefined : v;
        },
        data(nom) {
            const n = this._n[0];
            if (!n || !n.dataset) return undefined;
            return nom === undefined ? { ...n.dataset } : n.dataset[nom];
        },
        val() {
            const n = this._n[0];
            return n ? (n.value !== undefined ? n.value : n.getAttribute?.('value')) : undefined;
        },
        remove() {
            this._n.forEach((n) => n.remove && n.remove());
            return this;
        },
        contents() {
            const out = [];
            for (const n of this._n) out.push(...(n.childNodes || []));
            return env(out, this._racine);
        },
    };

    /**
     * `cheerio.load(html)` → une fonction `$` qui sélectionne dans ce document.
     *
     * `DOMParser` est celui du NAVIGATEUR : il applique les règles de
     * réparation du HTML réel (balises non fermées, imbrications illégales),
     * là où cheerio s'appuie sur son propre analyseur. Sur des pages scrapées,
     * c'est un avantage : ce sont exactement les pages mal formées.
     */
    function load(html) {
        const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');

        function $(quoi, contexte) {
            if (!quoi) return env([], doc);
            if (quoi instanceof Selection) return quoi;
            if (typeof quoi !== 'string') return env([quoi], doc);
            // Un fragment HTML plutôt qu'un sélecteur : cheerio l'accepte.
            if (/^\s*</.test(quoi)) {
                const d = new DOMParser().parseFromString(quoi, 'text/html');
                return env([...d.body.children], doc);
            }
            const base = contexte
                ? (contexte instanceof Selection ? contexte._n : [contexte])
                : [doc];
            const out = [];
            for (const b of base) {
                if (b.querySelectorAll) out.push(...b.querySelectorAll(quoi));
            }
            return env(uniques(out), doc);
        }

        $.html = (x) => (x ? (x instanceof Selection ? x.html() : String(x)) : doc.documentElement.outerHTML);
        $.root = () => env([doc.documentElement], doc);
        $._doc = doc;
        return $;
    }

    window.INKO_CHEERIO = { load, Selection };
})();
