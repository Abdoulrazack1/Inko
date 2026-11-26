// xss — injection HTML RÉELLE : des charges hostiles dans chaque champ saisissable et
// dans l'adresse, puis chaque page est ouverte. Une balise injectée = un défaut prouvé.
'use strict';
const E = require('./_explore');

module.exports = {
    nom: 'xss',
    description: 'Charges hostiles dans tous les champs et paramètres d\'URL, rendues dans un vrai navigateur',
    async run(ctx) {
        const o = await E.ouvrir(ctx, { base: 'inko_s_xss', port: 8091 });
        if (!o) return;
        const { J, nav } = o;
        const courte = (n) => `"><img src=x data-xss="${n}">`.slice(0, 60);
        const charge = (n) => `"'></a></div><img src=x data-xss="${n}" onerror="(window.__xss=window.__xss||[]).push('${n}')">`;
        try {
            const envois = [];
            const env = async (champ, m, p, c) => { const r = await J.api(m, p, c); envois.push(`${champ}: ${r.statut}`); return r; };
            await env('favori.titre', 'POST', '/me/favorites', { mangaId: 'x1', source: 'mangadex', title: charge('favori.titre') });
            await env('favori.source', 'POST', '/me/favorites', { mangaId: 'x2', source: courte('fs'), title: 'Deux' });
            await env('favori.id', 'POST', '/me/favorites', { mangaId: charge('favori.id').slice(0, 180), source: 'mangadex', title: 'Trois' });
            await env('categorie', 'PUT', '/me/favorites/x1/category', { category: charge('categorie').slice(0, 58) });
            await env('progression', 'PUT', '/me/progress/x1', { chapterId: charge('progression.chapitre').slice(0, 180), chapterNum: 1, page: 1, source: 'mangadex', mangaTitle: charge('progression.titre') });
            const l = await env('liste', 'POST', '/me/lists', { name: courte('ln'), description: charge('liste.description'), isPublic: true });
            const listeId = l.json && (l.json.id || (l.json.list && l.json.list.id));
            if (listeId) await env('liste.element', 'POST', `/me/lists/${listeId}/items`, { mangaId: 'x1', source: 'mangadex', title: charge('liste.element') });
            await env('note', 'POST', '/me/notes', { mangaId: 'x1', mangaTitle: charge('note.titre'), body: charge('note.corps'), chapterId: 'c', cover: 'javascript:window.__xss=1' });
            await env('signet', 'POST', '/me/bookmarks', { mangaId: 'x1', chapterId: 'c1', source: 'mangadex', title: charge('signet.titre'), label: charge('signet.libelle'), note: charge('signet.note'), chapterNum: 1, page: 1 });
            await env('commentaire', 'POST', '/comments/x1', { text: charge('commentaire') });
            await env('avatar', 'PUT', '/auth/profile', { avatar: '<i x=1>A' });
            await env('reglages', 'PUT', '/me/settings', { libCategories: [charge('reglages.categorie')] });
            ctx.mesure('xss_envois', envois);
            // ce que la base a accepté alors qu'elle aurait dû refuser
            const [[n]] = [await J.sql("SELECT (SELECT COUNT(*) FROM reading_notes WHERE cover LIKE 'javascript:%') AS notes, (SELECT COUNT(*) FROM list_items WHERE cover LIKE 'javascript:%') AS listes")];
            if (n.notes) ctx.trouver({ gravite: 'moyenne', id: 'XSS-URL-NOTE', categorie: 'sécurité', titre: 'La couverture d\'une note accepte une adresse javascript:', fichier: 'server/controllers/notes.controller.js', correctif: 'couverture.brute() comme pour les favoris.', effort: 'S' });

            const visites = ['accueil.html', 'bibliotheque.html', 'catalogue.html', 'collections.html', `collection-detail.html?id=${listeId}`, `liste.html?id=${listeId}`, 'notes.html', 'notifications.html', 'profil.html', 'stats.html', 'u.html?u=Lecteur', 'serie.html?id=x1&source=mangadex', 'downloads.html', 'parametres.html', 'recherche.html?q=' + encodeURIComponent(charge('url.recherche')), 'catalogue.html?q=' + encodeURIComponent(charge('url.catalogue')), 'serie.html?id=' + encodeURIComponent(charge('url.serie')) + '&source=mangadex', 'u.html?u=' + encodeURIComponent(charge('url.profil')), 'liste.html?id=' + encodeURIComponent(charge('url.liste')), 'chapitre.html?manga=x1&chapter=' + encodeURIComponent(charge('url.chapitre')) + '&source=mangadex', 'lecture.html?manga=x1&chapter=1&source=' + encodeURIComponent(charge('url.source')), 'bibliotheque.html?statut=' + encodeURIComponent(charge('url.statut')) + '&q=' + encodeURIComponent(charge('url.filtre'))];
            const c = await E.contexte(nav, J);
            const trouves = new Map();
            for (const v of visites) {
                const p = await c.newPage(); const s = E.surveiller(p);
                try {
                    await p.goto(J.url + '/' + v, { waitUntil: 'load', timeout: 25000 });
                    await p.waitForTimeout(2200);
                    // ouvre les onglets pour faire rendre leur contenu
                    for (const sel of ['[data-tab="bookmarks"]', '[data-tab="updates"]', '#btnLibFilters', '[data-tab="history"]', '[data-tab="badges"]']) { const h = await p.$(sel); if (h) { await h.click({ timeout: 800 }).catch(() => { }); await p.waitForTimeout(500); } }
                    const r = await p.evaluate(() => ({ exec: window.__xss || [], balises: [...document.querySelectorAll('[data-xss]')].map(e => e.getAttribute('data-xss') + ' ‹' + (e.parentElement && (e.parentElement.id || e.parentElement.className) || '?') + '›'), avatar: [...document.querySelectorAll('[class*=avatar] i[x]')].length, liensJs: [...document.querySelectorAll('a[href^="javascript:"]')].filter(a => /__xss/.test(a.href)).length }));
                    const page = v.split('?')[0];
                    for (const b of r.balises) { const k = b + '@' + page; if (!trouves.has(k)) trouves.set(k, { page, b, exec: r.exec.includes(b.split(' ')[0]) }); }
                    if (r.avatar) ctx.trouver({ gravite: 'haute', id: 'XSS-AVATAR', categorie: 'sécurité', titre: `L'avatar est interprété comme du HTML sur ${page}`, fichier: page, correctif: 'Échapper l\'avatar partout (MH.esc).', effort: 'S' });
                    if (r.liensJs) ctx.trouver({ gravite: 'haute', id: 'XSS-LIEN-JS', categorie: 'sécurité', titre: `Lien javascript: issu d'une donnée sur ${page}`, fichier: page, effort: 'S' });
                    if (s.exceptions.length) ctx.trouver({ gravite: 'moyenne', id: 'XSS-EXCEPTION', categorie: 'robustesse', titre: `${page} : une donnée hostile lève une exception`, fichier: page, detail: v.slice(0, 60) + '\n' + [...new Set(s.exceptions)].slice(0, 3).join('\n'), effort: 'S' });
                } catch (e) { ctx.trouver({ gravite: 'basse', id: 'XSS-PAGE', titre: `${v.slice(0, 50)} : ${e.message.slice(0, 80)}`, effort: 'S' }); }
                await p.close();
            }
            // la liste publique, vue par un visiteur ANONYME
            ctx.mesure('xss_pages_visitees', visites.length);
            for (const { page, b, exec } of trouves.values()) ctx.trouver({ gravite: exec ? 'critique' : 'haute', id: 'XSS-INJECTION', categorie: 'sécurité', titre: `${page} : la donnée « ${b.split(' ')[0]} » est injectée comme HTML${exec ? ' et EXÉCUTÉE' : ''}`, fichier: page, detail: b, correctif: 'Échapper cette valeur au rendu (MH.esc ou textContent).', effort: 'S' });
            ctx.mesure('xss_injections', trouves.size);
        } finally { await o.fermer(); }
    },
};
