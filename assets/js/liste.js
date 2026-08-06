// liste.js — Page publique d'une liste partagée (audit AMEL-36)
// ------------------------------------------------------------
// `lists.is_public` existait, la route `/api/lists/:id` aussi, mais aucune page
// ne la consommait : « Partager » copiait un lien vers le PROFIL du
// propriétaire, où la liste n'est qu'une entrée parmi d'autres — et le lien
// n'ouvrait rien du tout si le profil était privé.
//
// Cette page est l'adresse de la liste elle-même. Elle n'exige aucun compte :
// c'est tout l'intérêt d'un partage, et le serveur applique déjà les règles
// (liste non publique ou profil privé → 404, sans distinguer les deux, pour ne
// pas révéler qu'une liste privée existe).
(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', async () => {
        MH.initPage('collections');
        const wrap = document.getElementById('plWrap');
        const id = new URLSearchParams(location.search).get('id');
        if (!id) return etat(wrap, 'Lien incomplet — il manque l’identifiant de la liste.');

        let liste;
        try {
            liste = await fetch(`${API.base}/lists/${encodeURIComponent(id)}`).then(r => {
                if (r.status === 404) throw new Error('__introuvable__');
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.json();
            });
        } catch (e) {
            return etat(wrap, e.message === '__introuvable__'
                // Message volontairement identique pour « inexistante » et
                // « privée » : dire « cette liste est privée » confirmerait son
                // existence à quelqu'un qui n'a pas à le savoir.
                ? 'Cette liste n’existe pas ou n’est pas partagée publiquement.'
                : 'Impossible de charger cette liste pour le moment.');
        }

        document.getElementById('pageTitle')
            ? (document.getElementById('pageTitle').textContent = `Inko — ${liste.name}`)
            : (document.title = `Inko — ${liste.name}`);

        const items = liste.items || [];
        wrap.innerHTML = `
            <div class="pl-head">
                <div class="pl-kind">Liste partagée</div>
                <h1 class="pl-name">${MH.esc(liste.name)}</h1>
                ${liste.description ? `<p class="pl-desc">${MH.esc(liste.description)}</p>` : ''}
                <div class="pl-meta">
                    ${items.length} titre${items.length > 1 ? 's' : ''}
                    ${liste.owner ? ` · par <a href="u.html?u=${encodeURIComponent(liste.owner)}">${MH.esc(liste.owner)}</a>` : ''}
                </div>
            </div>
            ${items.length
        ? `<div class="pl-grid">${items.map(carte).join('')}</div>`
        : `<div class="pl-state">Cette liste est encore vide.</div>`}`;
    });

    function carte(m) {
        return `<a class="pl-card" href="serie.html?id=${encodeURIComponent(m.id)}&source=${encodeURIComponent(m.source || '')}">
            <img src="${MH.cover(m.cover, MH.placeholderCover(m.id))}" alt="" loading="lazy"
                 onerror="this.src='${MH.placeholderCover(m.id)}'">
            <span>${MH.esc(m.title || m.id)}</span>
        </a>`;
    }

    function etat(wrap, message) {
        wrap.innerHTML = `<div class="pl-state">${MH.esc(message)}
            <div style="margin-top:16px"><a class="btn btn-secondary btn-sm" href="accueil.html">Aller à l’accueil</a></div>
        </div>`;
    }
})();
