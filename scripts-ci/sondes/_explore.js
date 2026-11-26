// _explore.js — socle des sondes d'exploration : serveur jetable, navigateur,
// jeu de données, collecte des erreurs. Rien ne touche la base réelle.
'use strict';
const fs = require('fs');
const { demarrer } = require('./_jetable');
const { lancerNavigateur } = require('./_navigateur');

const SENSIBLE = /\/api\/(app\/update|auth\/google-config|anilist\/config|extensions\/update|extensions\/[^/]+\/(uninstall|reinstall)|me\/avatar|spotify\/)/;
const BRUIT = /net::ERR_FAILED|Failed to load resource|ERR_BLOCKED|ERR_ABORTED|ERR_INTERNET_DISCONNECTED/;

async function ouvrir(ctx, { base, port, local = true } = {}) {
    const J = await demarrer(ctx, { base, port, local });
    if (!J) return null;
    const nav = await lancerNavigateur();
    return { J, nav, fermer: async () => { await nav.close().catch(() => { }); await J.arreter(); } };
}

/** Toutes les pages de la racine (offline.html exclue). */
const pages = (ctx) => fs.readdirSync(ctx.racine).filter(f => f.endsWith('.html') && f !== 'offline.html').sort();

/** Contexte navigateur : consentements fermés, aucun appel externe, écritures sensibles interceptées. */
async function contexte(nav, J, { mobile = false, largeur, hauteur, theme, accent, langue, sombre, externes, calme = false } = {}) {
    const c = await nav.newContext({
        viewport: { width: largeur || (mobile ? 390 : 1366), height: hauteur || (mobile ? 844 : 800) },
        ...(calme ? { reducedMotion: 'reduce' } : {}),
        ...(mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}),
        serviceWorkers: 'block', locale: 'fr-FR', colorScheme: sombre === false ? 'light' : 'dark',
    });
    await c.addInitScript(({ theme, accent, langue }) => {
        try {
            for (const k of ['mh_eula_v2', 'inko_consent', 'inko_tour_done', 'mh_install_dismissed']) localStorage.setItem(k, '1');
            localStorage.setItem('inko_lib_lastcheck', String(Date.now()));
            if (theme || accent) { const p = JSON.parse(localStorage.getItem('mh_prefs') || '{}'); if (theme) p.theme = theme; if (accent) p.accent = accent; localStorage.setItem('mh_prefs', JSON.stringify(p)); }
            if (langue) localStorage.setItem('inko_lang', langue);
        } catch (e) { /* stockage indisponible */ }
    }, { theme, accent, langue });
    await c.route('**/*', (route) => {
        const u = route.request().url();
        if (u.startsWith(J.url) || u.startsWith('data:') || u.startsWith('blob:')) {
            if (route.request().method() !== 'GET' && SENSIBLE.test(u)) return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"bloque":"sonde"}' });
            return route.continue();
        }
        if (externes) try { const h = new URL(u).host; externes.set(h, (externes.get(h) || 0) + 1); } catch (e) { /* url */ }
        return route.abort();
    });
    return c;
}

/** Collecte exceptions, erreurs console et réponses d'API en échec d'une page. */
function surveiller(page) {
    const e = { exceptions: [], console: [], ko: [], dialogues: 0, popups: 0 };
    page.on('pageerror', x => e.exceptions.push(String(x.message).slice(0, 200)));
    page.on('console', m => { if (m.type() === 'error' && !BRUIT.test(m.text())) e.console.push(m.text().slice(0, 200)); });
    page.on('response', r => { if (r.status() >= 500 && /\/api\//.test(r.url()) && !/\/api\/img/.test(r.url()) && !/fixture-/.test(r.url())) e.ko.push(`${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`); });
    page.on('dialog', d => { e.dialogues++; d.dismiss().catch(() => { }); });
    page.on('popup', p => { e.popups++; p.close().catch(() => { }); });
    return e;
}

/** Un texte visible qui trahit une valeur manquante affichée telle quelle. */
const lireValeursBrutes = (page) => page.evaluate(() => {
    const sortie = [];
    const marche = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = marche.nextNode())) {
        const t = n.nodeValue.trim(); const p = n.parentElement;
        if (!t || !p || p.closest('script,style,code,pre,.sy-v')) continue;
        const s = getComputedStyle(p); if (s.display === 'none' || s.visibility === 'hidden' || !p.getClientRects().length) continue;
        if (/\bundefined\b|\bNaN\b|\[object Object\]|(^|[\s(:·])null([\s).,·]|$)|Invalid Date|\{\{[^}]*\}\}|\$\{[^}]*\}/.test(t)) sortie.push(t.slice(0, 120) + '  ‹' + p.tagName.toLowerCase() + (p.className && typeof p.className === 'string' ? '.' + p.className.split(/\s+/)[0] : '') + '›');
    }
    return [...new Set(sortie)].slice(0, 8);
});

/** Jeu de données ordinaire : favoris, progression, statuts, liste publique, note, signet, commentaire. */
async function semer(J, { favoris = 36 } = {}) {
    const titres = ['Naruto', 'Berserk', 'Vagabond', 'Monster', 'Akira', 'Blame!', 'Gantz', 'Pluto', 'Planetes', 'Vinland Saga', 'Dorohedoro', 'Gon'];
    for (let i = 0; i < favoris; i++) await J.api('POST', '/me/favorites', { mangaId: 'fixture-' + i, source: i % 3 === 0 ? 'weebcentral' : (i % 3 === 1 ? 'mangadex' : 'sushiscan'), title: titres[i % 12] + ' ' + (i + 1) });
    await J.api('PUT', '/me/progress/fixture-1', { chapterId: 'c1', chapterNum: 12, page: 4, source: 'mangadex', mangaTitle: 'Berserk 2' });
    await J.api('PUT', '/me/library/fixture-2', { status: 'reading' });
    await J.api('PUT', '/me/library/fixture-3', { status: 'completed' });
    await J.api('PUT', '/me/favorites/fixture-4/category', { category: 'À relire' });
    await J.api('PUT', '/ratings/fixture-1', { rating: 9 });
    await J.api('POST', '/me/read-chapters/bulk', { mangaId: 'fixture-1', chapters: Array.from({ length: 30 }, (_, i) => ({ chapterId: 'r' + i, chapter: i + 1 })) });
    const l = await J.api('POST', '/me/lists', { name: 'Ma liste', description: 'Une description', isPublic: true });
    const listeId = l.json && (l.json.id || (l.json.list && l.json.list.id));
    if (listeId) await J.api('POST', `/me/lists/${listeId}/items`, { mangaId: 'fixture-1', source: 'mangadex', title: 'Berserk 2' });
    await J.api('POST', '/me/notes', { mangaId: 'fixture-1', mangaTitle: 'Berserk 2', body: 'Une note de lecture.', kind: 'note' });
    await J.api('POST', '/me/bookmarks', { mangaId: 'fixture-1', chapterId: 'c1', source: 'mangadex', title: 'Berserk 2', chapterNum: 1, page: 3, label: 'Scène', note: 'à revoir' });
    await J.api('POST', '/comments/fixture-1', { text: 'Un commentaire.' });
    return { listeId };
}

/** Une œuvre et un roman réels (lecture seule côté source) pour les pages de lecture. */
async function oeuvresReelles(J) {
    const prem = async (src, q) => {
        const r = await J.api('GET', `/sources/${src}/mangas/search?q=${encodeURIComponent(q)}&limit=3`);
        const l = r.json && (r.json.results || r.json); const o = Array.isArray(l) && l[0];
        if (!o) return null;
        const c = await J.api('GET', `/sources/${src}/mangas/${encodeURIComponent(o.id)}/chapters`);
        const cs = c.json && (c.json.results || c.json.chapters || c.json);
        return Array.isArray(cs) && cs.length ? { source: src, id: o.id, titre: o.title, chapitres: cs } : null;
    };
    return { manga: await prem('weebcentral', 'one punch man'), roman: await prem('novelfull', 'shadow slave') };
}

/** Adresse de chaque page, avec les paramètres dont elle a besoin. */
function adresses(ctx, d = {}) {
    const m = d.manga, r = d.roman;
    const chap = (o) => o.chapitres[o.chapitres.length - 1].id;
    const carte = {
        'serie.html': m ? `serie.html?id=${encodeURIComponent(m.id)}&source=${m.source}` : 'serie.html?id=fixture-1&source=mangadex',
        'chapitre.html': m ? `chapitre.html?manga=${encodeURIComponent(m.id)}&chapter=${encodeURIComponent(chap(m))}&source=${m.source}` : null,
        'lecture.html': r ? `lecture.html?manga=${encodeURIComponent(r.id)}&chapter=${encodeURIComponent(r.chapitres[0].id)}&source=${r.source}` : null,
        'liste.html': d.listeId ? `liste.html?id=${d.listeId}` : 'liste.html?id=1',
        'collection-detail.html': d.listeId ? `collection-detail.html?id=${d.listeId}` : 'collection-detail.html?id=1',
        'u.html': 'u.html?u=Lecteur',
        'recherche.html': 'recherche.html?q=Naruto',
    };
    return pages(ctx).map(f => [f, carte[f] === undefined ? f : carte[f]]).filter(([, u]) => u);
}

module.exports = { ouvrir, contexte, surveiller, semer, oeuvresReelles, adresses, pages, lireValeursBrutes, BRUIT };
