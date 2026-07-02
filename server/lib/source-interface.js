// ============================================================
// source-interface.js — Contrat des extensions (modèle Mihon)
// ============================================================
// Inspirée de tachiyomiorg/extensions-source.
//
// Chaque extension JS doit exporter un objet `Source` qui implémente
// les méthodes ci-dessous. Le core Inko ne contient AUCUNE source par
// défaut — toutes les sources sont des modules indépendants chargés
// dynamiquement depuis `server/extensions/`.
//
// ─── Types ───────────────────────────────────────────────────
//
// MangasPage   { total: number, results: Manga[] }
// Manga        { id: string, title: string, titleAlt?: string,
//                author?: string, description?: string,
//                status?: 'ongoing'|'completed'|'hiatus'|'cancelled'|null,
//                year?: number, demographic?: string, tags: string[],
//                cover?: string, coverLarge?: string, coverThumb?: string,
//                contentRating?: string, lastChapter?: string,
//                langs?: string[] }
// Chapter      { id: string, chapter: number, volume?: string,
//                title?: string, lang?: string, pages?: number,
//                publishedAt?: string }
// ChaptersPage { total: number, results: Chapter[] }
// PagesPayload { baseUrl?: string, hash?: string,
//                pages: [{ page: number, url: string, urlSaver?: string }] }
//
// ─── Manifest ────────────────────────────────────────────────
// L'objet retourné DOIT contenir au minimum :
//   {
//     id          'mangadex',                  // slug unique
//     name        'MangaDex',                  // nom affiché
//     lang        'multi',                     // 'en', 'fr', 'multi', …
//     baseUrl     'https://api.mangadex.org',  // info
//     nsfw        false,                       // contenu sensible
//     version     '1.0.0',                     // semver
//     description 'Source officielle MangaDex API',
//     capabilities: ['popular','latest','search','manga','chapters','pages'],
//
//     type        'manga' | 'novel',           // 'novel' = source de romans (texte)
//
//     // Méthodes (toutes async)
//     async popular({ limit, offset })                     → MangasPage
//     async latest ({ limit, offset })                     → MangasPage
//     async search ({ q, limit, offset, filters })         → MangasPage
//     async getManga(id)                                   → Manga
//     async getChapters(mangaId, { lang, limit, offset })  → ChaptersPage
//     async getPages(chapterId)                            → PagesPayload   // sources 'manga'
//     async getText?(chapterId)                            → TextPayload    // sources 'novel'
//     async getTags?()                                     → [{id,name,group}]  // optionnel
//   }
//
// TextPayload { title?: string, content: string /* HTML assaini */ }
// ============================================================

/**
 * Liste des méthodes obligatoires que chaque extension doit exposer.
 * Une source 'novel' implémente getText() à la place de getPages().
 */
const REQUIRED_METHODS = ['popular', 'latest', 'search', 'getManga', 'getChapters'];

/**
 * Valide qu'un objet source respecte le contrat.
 * @returns { ok: boolean, errors: string[] }
 */
function validateSource(src) {
    const errors = [];
    if (!src || typeof src !== 'object') {
        return { ok: false, errors: ['Extension ne retourne pas un objet'] };
    }
    if (!src.id || typeof src.id !== 'string')   errors.push('id manquant ou invalide');
    if (!src.name || typeof src.name !== 'string') errors.push('name manquant');
    if (!src.version) errors.push('version manquante');

    REQUIRED_METHODS.forEach(m => {
        if (typeof src[m] !== 'function') errors.push(`méthode ${m}() manquante`);
    });
    // Selon le type : manga = images (getPages) ; novel/book = texte (getText).
    // 'book' (livres/romans classiques, ex. Gutenberg) se comporte comme 'novel'.
    const type = src.type || 'manga';
    if (type === 'novel' || type === 'book') {
        if (typeof src.getText !== 'function') errors.push(`méthode getText() manquante (source ${type})`);
    } else {
        if (typeof src.getPages !== 'function') errors.push('méthode getPages() manquante');
    }
    return { ok: errors.length === 0, errors };
}

module.exports = { REQUIRED_METHODS, validateSource };
