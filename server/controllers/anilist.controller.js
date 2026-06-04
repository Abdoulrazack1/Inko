// ============================================================
// anilist.controller.js — Config OAuth AniList (implicit grant)
// ============================================================
// L'OAuth AniList se fait côté client (implicit grant : le token
// arrive dans le fragment d'URL). Le serveur ne fait qu'exposer
// le client_id public et l'URI de redirection à enregistrer.
// ============================================================

function config(_req, res) {
    const clientId = process.env.ANILIST_CLIENT_ID || '';
    const redirectUri = process.env.ANILIST_REDIRECT_URI ||
        `http://127.0.0.1:${process.env.PORT || 8088}/anilist.html`;
    res.json({
        configured: !!clientId,
        clientId,
        redirectUri,
        authorizeBase: 'https://anilist.co/api/v2/oauth/authorize',
    });
}

module.exports = { config };
