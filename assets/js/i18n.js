// ============================================================
// i18n.js — Traduction runtime complète de l'interface (audit N40 v2)
// ------------------------------------------------------------
// Principe « texte source » : le FRANÇAIS est la langue du code (HTML + JS).
// En anglais, ce module traduit l'interface au vol :
//   1. dictionnaire EXACT  : texte français (trimé) → texte anglais ;
//   2. motifs (regex)      : chaînes paramétrées (« il y a 3 min », « 12 / 48… ») ;
//   3. MutationObserver    : tout contenu inséré dynamiquement (toasts, grilles,
//      modales, dropdowns) est traduit dès son insertion.
// Sécurité intrinsèque : seule une correspondance exacte (ou un motif déclaré)
// est traduite — les titres d'œuvres, noms d'utilisateurs et contenus de
// chapitres ne matchent jamais et passent intacts.
// Compatible avec l'ancien mécanisme par clés (data-i18n / data-i18n-ph).
// Fichier autonome : fonctionne aussi sur les pages sans global.js
// (localreader.html) — il fusionne dans window.MH sans l'écraser.
// ============================================================
(function () {
    'use strict';
    window.MH = window.MH || {};
    const MH = window.MH;

    const KEY = 'inko_lang';
    let dict = {};        // clés data-i18n (rétro-compat)
    let strMap = {};      // texte FR exact → EN
    // Audit AMEL-85 : index normalisé (casse, accents, apostrophes, ponctuation
    // finale). Sert de repli quand le texte a été légèrement reformulé.
    let normMap = {};
    let patterns = [];    // [RegExp, remplacement]
    let active = false;   // traduction runtime active (lang !== 'fr')
    let observer = null;

    MH.lang = (() => { try { return localStorage.getItem(KEY) || 'fr'; } catch (e) { return 'fr'; } })();
    MH.t = (k, fb) => dict[k] || fb || k;

    // Audit I18N-05 : revenir au français imposait un rechargement complet —
    // « les textes déjà traduits ne peuvent pas être détraduits de façon
    // fiable ». C'était vrai tant qu'on ne gardait aucune trace de l'original.
    // On mémorise donc, pour chaque nœud traduit, sa valeur source. Le retour
    // au français devient une simple restauration, sans perdre l'état de la
    // page (position de lecture, filtres, panneaux ouverts).
    // WeakMap : aucune fuite, les nœuds retirés du DOM sont collectés.
    const original = new WeakMap();   // nœud texte → chaîne française
    const originalAttr = new WeakMap(); // élément → { attribut: valeur française }
    let docTitleFr = null;            // titre de page d'origine

    // Traduit une chaîne en préservant ses espaces de bord (fragments de nœuds)
    function trText(s) {
        if (!active || !s) return s;
        const t = String(s).replace(/\s+/g, ' ').trim();
        if (!t) return s;
        const lead = /^\s*/.exec(s)[0], tail = /\s*$/.exec(s)[0];
        const hit = strMap[t];
        if (hit !== undefined) return lead + hit + tail;
        for (let i = 0; i < patterns.length; i++) {
            if (patterns[i][0].test(t)) return lead + t.replace(patterns[i][0], patterns[i][1]) + tail;
        }
        // Audit AMEL-85 : repli sur une correspondance NORMALISEE. La cle est
        // le texte francais EXACT — remplacer une apostrophe droite par une
        // typographique, changer une majuscule ou ajouter un point suffisait a
        // perdre la traduction, en silence et sans qu'aucun test ne le voie.
        //
        // Ce repli ne remplace pas le catalogue de cles stables (le vrai
        // correctif, gros chantier) : il empeche les reformulations MINEURES
        // de casser. Une vraie reecriture reste non traduite, et c'est le
        // controle CI qui la signale.
        const n = normaliser(t);
        const approx = normMap[n];
        if (approx !== undefined) return lead + approx + tail;
        return s;
    }

    // Insensible a la casse, aux accents, aux apostrophes/guillemets typo et a
    // la ponctuation finale. Volontairement grossier : deux libelles que cette
    // normalisation confond auraient de toute facon la meme traduction.
    function normaliser(v) {
        return String(v || '')
            .toLowerCase()
            .normalize('NFD').replace(/[̀-ͯ]/g, '')
            .replace(/[‘’ʼ]/g, "'")
            .replace(/[“”]/g, '"')
            .replace(/…/g, '...')
            .replace(/[–—]/g, '-')
            .replace(/[.:!?\s]+$/, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    // Restaure tout ce qui a été traduit dans cette page (audit I18N-05)
    function restoreOriginals(root) {
        const doc = (root && root.ownerDocument) || document;
        const walker = doc.createTreeWalker(root || document.body, NodeFilter.SHOW_TEXT, null);
        let n;
        while ((n = walker.nextNode())) {
            const src = original.get(n);
            if (src !== undefined && n.nodeValue !== src) n.nodeValue = src;
        }
        (root || document).querySelectorAll('[placeholder],[title],[aria-label],[alt]').forEach(el => {
            const saved = originalAttr.get(el);
            if (!saved) return;
            for (const [a, v] of Object.entries(saved)) {
                if (el.getAttribute(a) !== v) el.setAttribute(a, v);
            }
        });
    }
    MH.trText = trText;

    const ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
    function trAttrs(el) {
        for (const a of ATTRS) {
            const v = el.getAttribute(a);
            if (v) {
                const t = trText(v);
                if (t !== v) {
                    // Mémorise la valeur française avant de l'écraser (I18N-05)
                    const saved = originalAttr.get(el) || {};
                    if (saved[a] === undefined) { saved[a] = v; originalAttr.set(el, saved); }
                    el.setAttribute(a, t);
                }
            }
        }
    }
    // Applique une traduction à un nœud texte en gardant l'original (I18N-05)
    function applyText(node) {
        const t = trText(node.nodeValue);
        if (t === node.nodeValue) return;
        if (!original.has(node)) original.set(node, node.nodeValue);
        node.nodeValue = t;
    }
    function translateTree(root) {
        if (!root) return;
        if (root.nodeType === 3) {                      // nœud texte isolé
            applyText(root);
            return;
        }
        if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
        if (root.nodeType === 1) {
            if (root.closest && root.closest('[data-no-i18n]')) return;   // zone exclue (contenu de chapitre)
            trAttrs(root);
        }
        if (root.querySelectorAll) {
            root.querySelectorAll('[placeholder],[title],[aria-label],[alt]').forEach(trAttrs);
        }
        const doc = root.ownerDocument || document;
        const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode(n) {
                const p = n.parentElement;
                if (!p) return NodeFilter.FILTER_REJECT;
                const tag = p.tagName;
                if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA' || tag === 'CODE') return NodeFilter.FILTER_REJECT;
                if (p.closest('[data-no-i18n], .lr-text, .novel-content, .comment-text')) return NodeFilter.FILTER_REJECT;
                return n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
            },
        });
        const todo = [];
        let n; while ((n = walker.nextNode())) todo.push(n);
        for (const node of todo) applyText(node);
    }

    // Audit I18N-04 : l'observateur traitait CHAQUE mutation individuellement,
    // en synchrone, sur tout `document.documentElement`. Sur la bibliothèque
    // (4 800 nœuds, rendue en un seul innerHTML) cela déclenchait un parcours
    // d'arbre par nœud inséré, pendant toute la session en mode anglais.
    // On regroupe désormais les mutations d'un même lot : les nœuds ajoutés
    // sont mis en file et traités une fois, à la frame suivante — un innerHTML
    // massif ne coûte plus qu'un seul passage. Les mutations d'attribut et de
    // texte, elles, restent immédiates : elles sont rares et ponctuelles.
    let pending = null;
    let flushScheduled = false;
    function scheduleFlush() {
        if (flushScheduled) return;
        flushScheduled = true;
        const run = () => {
            flushScheduled = false;
            const nodes = pending; pending = null;
            if (!active || !nodes) return;
            // Un ancêtre déjà traité couvre ses descendants : on évite les
            // doublons quand un lot insère un conteneur ET son contenu.
            for (const n of nodes) {
                if (!n.isConnected) continue;
                let covered = false;
                for (const other of nodes) {
                    if (other !== n && other.nodeType === 1 && other.contains && other.contains(n)) { covered = true; break; }
                }
                if (!covered) translateTree(n);
            }
        };
        if (window.requestAnimationFrame) requestAnimationFrame(run);
        else setTimeout(run, 0);
    }

    function startObserver() {
        if (observer) return;
        observer = new MutationObserver((muts) => {
            if (!active) return;
            for (const m of muts) {
                if (m.type === 'childList') {
                    if (m.addedNodes.length) {
                        (pending || (pending = new Set()));
                        m.addedNodes.forEach(node => pending.add(node));
                        scheduleFlush();
                    }
                } else if (m.type === 'characterData') {
                    // trText est idempotent (une chaîne déjà anglaise ne matche plus) :
                    // pas de boucle possible.
                    const t = trText(m.target.nodeValue);
                    if (t !== m.target.nodeValue) m.target.nodeValue = t;
                } else if (m.type === 'attributes' && m.target.nodeType === 1) {
                    trAttrs(m.target);
                }
            }
        });
        // On observe `body` et non `documentElement` : rien de traduisible ne
        // vit dans <head>, et cela évite de réagir aux <style>/<script>
        // injectés à l'exécution (thème, polices, service worker).
        observer.observe(document.body || document.documentElement, {
            childList: true, subtree: true, characterData: true,
            attributes: true, attributeFilter: ATTRS,
        });
    }

    MH.applyI18n = (root) => {
        const r = root || document;
        // Rétro-compat : traduction par clé (nav du header).
        // Audit I18N-05 : ce chemin écrivait `textContent` directement, sans
        // garder l'original — c'est lui qui laissait la navigation en anglais
        // au retour au français, alors que le reste de la page revenait bien.
        if (r.querySelectorAll) {
            r.querySelectorAll('[data-i18n]').forEach(el => {
                const v = dict[el.getAttribute('data-i18n')];
                if (active && v) {
                    if (!original.has(el)) original.set(el, el.textContent);
                    el.textContent = v;
                } else if (!active && original.has(el)) {
                    el.textContent = original.get(el);
                }
            });
            r.querySelectorAll('[data-i18n-ph]').forEach(el => {
                const v = dict[el.getAttribute('data-i18n-ph')];
                const saved = originalAttr.get(el) || {};
                if (active && v) {
                    if (saved.placeholder === undefined) { saved.placeholder = el.placeholder; originalAttr.set(el, saved); }
                    el.placeholder = v;
                } else if (!active && saved.placeholder !== undefined) {
                    el.placeholder = saved.placeholder;
                }
            });
        }
        if (active) {
            translateTree(r === document ? document.body : r);
            // Mémorise le titre français avant de le traduire (audit I18N-05)
            const tt = trText(document.title);
            if (tt !== document.title) {
                if (docTitleFr === null) docTitleFr = document.title;
                document.title = tt;
            }
        }
    };

    MH.loadI18n = async (lang) => {
        lang = lang || MH.lang || 'fr';
        active = lang !== 'fr';
        if (active) {
            try {
                const res = await fetch('/assets/i18n/' + lang + '.json');
                const data = await res.json();
                dict = data.keys || data;
                strMap = data.strings || {};
                // Construit une seule fois : recalculer la normalisation a
                // chaque nœud texte coûterait sur des pages à 800 chaînes.
                // La première occurrence gagne — deux libellés que la
                // normalisation confond auraient la même traduction.
                normMap = {};
                for (const [fr, en] of Object.entries(strMap)) {
                    const n = normaliser(fr);
                    if (normMap[n] === undefined) normMap[n] = en;
                }
                patterns = (data.patterns || []).map(p => { try { return [new RegExp(p[0]), p[1]]; } catch (e) { return null; } }).filter(Boolean);
            } catch (e) { dict = {}; strMap = {}; patterns = []; normMap = {}; active = false; }
        } else {
            dict = {}; strMap = {}; patterns = []; normMap = {};
        }
        MH.lang = lang;
        try { document.documentElement.lang = lang; } catch (e) { window.MH?.err?.('i18n.js', e); }
        // Audit I18N-05 : en repassant au français, on restaure les textes
        // d'origine mémorisés au lieu de recharger la page. Le titre revient
        // aussi à sa valeur source.
        if (!active) {
            restoreOriginals(document.body);
            if (docTitleFr !== null) { document.title = docTitleFr; docTitleFr = null; }
        }
        MH.applyI18n(document);
        if (active) startObserver();
    };

    MH.setLang = async (lang) => {
        try { localStorage.setItem(KEY, lang); } catch (e) { window.MH?.err?.('i18n.js', e); }
        // Audit I18N-05 : plus de rechargement. Il faisait perdre l'état de la
        // page (position de lecture, filtres, panneaux ouverts) et donnait un
        // aller-retour visible pour un simple changement de langue.
        await MH.loadI18n(lang);
        window.dispatchEvent(new CustomEvent('i18n:change', { detail: { lang } }));
    };

    // Sélecteur de langue (footer ou ailleurs) — délégué, une seule fois
    document.addEventListener('click', (e) => {
        const b = e.target.closest('[data-setlang]');
        if (!b) return;
        e.preventDefault();
        const lang = b.getAttribute('data-setlang');
        MH.setLang(lang);
        MH.toast?.(lang === 'en' ? 'Language: English' : 'Langue : Français');
    });

    // Amorçage autonome : traduit dès que le DOM initial est prêt, même sur les
    // pages qui n'appellent pas MH.initPage (localreader.html).
    const boot = () => { if (MH.lang && MH.lang !== 'fr') MH.loadI18n(); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
