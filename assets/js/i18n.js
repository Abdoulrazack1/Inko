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
    let patterns = [];    // [RegExp, remplacement]
    let active = false;   // traduction runtime active (lang !== 'fr')
    let observer = null;

    MH.lang = (() => { try { return localStorage.getItem(KEY) || 'fr'; } catch (e) { return 'fr'; } })();
    MH.t = (k, fb) => dict[k] || fb || k;

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
        return s;
    }
    MH.trText = trText;

    const ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
    function trAttrs(el) {
        for (const a of ATTRS) {
            const v = el.getAttribute(a);
            if (v) { const t = trText(v); if (t !== v) el.setAttribute(a, t); }
        }
    }
    function translateTree(root) {
        if (!root) return;
        if (root.nodeType === 3) {                      // nœud texte isolé
            const t = trText(root.nodeValue);
            if (t !== root.nodeValue) root.nodeValue = t;
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
        for (const node of todo) {
            const t = trText(node.nodeValue);
            if (t !== node.nodeValue) node.nodeValue = t;
        }
    }

    function startObserver() {
        if (observer) return;
        observer = new MutationObserver((muts) => {
            if (!active) return;
            for (const m of muts) {
                if (m.type === 'childList') {
                    m.addedNodes.forEach(node => translateTree(node));
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
        observer.observe(document.documentElement, {
            childList: true, subtree: true, characterData: true,
            attributes: true, attributeFilter: ATTRS,
        });
    }

    MH.applyI18n = (root) => {
        const r = root || document;
        // Rétro-compat : traduction par clé (nav du header)
        if (r.querySelectorAll) {
            r.querySelectorAll('[data-i18n]').forEach(el => { const v = dict[el.getAttribute('data-i18n')]; if (v) el.textContent = v; });
            r.querySelectorAll('[data-i18n-ph]').forEach(el => { const v = dict[el.getAttribute('data-i18n-ph')]; if (v) el.placeholder = v; });
        }
        if (active) {
            translateTree(r === document ? document.body : r);
            document.title = trText(document.title);
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
                patterns = (data.patterns || []).map(p => { try { return [new RegExp(p[0]), p[1]]; } catch (e) { return null; } }).filter(Boolean);
            } catch (e) { dict = {}; strMap = {}; patterns = []; active = false; }
        } else {
            dict = {}; strMap = {}; patterns = [];
        }
        MH.lang = lang;
        try { document.documentElement.lang = lang; } catch (e) { window.MH?.err?.('i18n.js', e); }
        MH.applyI18n(document);
        if (active) startObserver();
    };

    MH.setLang = async (lang) => {
        try { localStorage.setItem(KEY, lang); } catch (e) { window.MH?.err?.('i18n.js', e); }
        // Retour au français : les textes déjà traduits ne peuvent pas être
        // « détraduits » de façon fiable → rechargement (le HTML source est FR).
        if (lang === 'fr' && MH.lang !== 'fr') { window.location.reload(); return; }
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
