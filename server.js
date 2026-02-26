// ============================================================
// server.js — MangaHub v4.2 · Multi-sources
// ============================================================
// Sources :
//   1. MangaDex   (API officielle)    → /mangadex/*
//   2. Images MangaDex               → /mdimg/*
//   3. AniList    (covers)            → /anilist
//   4. WeebCentral (scraping HTML)    → /weebcentral/*   ← AJOUT v4.2
//      GET /weebcentral/search?q=berserk
//      GET /weebcentral/chapters?seriesId=01H9S3...
//      GET /weebcentral/pages?chapterId=01H9S3...
//      GET /weebcentral/img?url=https://...   (proxy images CDN)
// ============================================================

const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');

const PORT = 8080;
const ROOT = __dirname;

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.css':  'text/css',
    '.js':   'application/javascript',
    '.json': 'application/json',
    '.png':  'image/png',
    '.jpg':  'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif':  'image/gif',
    '.webp': 'image/webp',
    '.svg':  'image/svg+xml',
    '.ico':  'image/x-icon',
    '.woff': 'font/woff',
    '.woff2':'font/woff2',
    '.ttf':  'font/ttf',
};

const CORS_HEADERS = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// ── Fetch HTTPS → { status, body: string } ───────────────────
function fetchText(hostname, reqPath, extraHeaders = {}, redirectCount = 0) {
    return new Promise((resolve, reject) => {
        if (redirectCount > 5) return reject(new Error('Too many redirects'));

        const opts = {
            hostname,
            path: reqPath,
            method: 'GET',
            headers: {
                'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
                'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'identity',
                'Cache-Control':   'no-cache',
                ...extraHeaders,
            },
        };

        const pr = https.request(opts, pres => {
            if ([301, 302, 307, 308].includes(pres.statusCode) && pres.headers.location) {
                pres.resume();
                try {
                    const loc = new URL(pres.headers.location);
                    return fetchText(loc.hostname, loc.pathname + loc.search, extraHeaders, redirectCount + 1)
                        .then(resolve).catch(reject);
                } catch(e) { return reject(e); }
            }
            let body = '';
            pres.setEncoding('utf8');
            pres.on('data', c => body += c);
            pres.on('end',  () => resolve({ status: pres.statusCode, body }));
            pres.on('error', reject);
        });

        pr.on('error', reject);
        pr.setTimeout(25000, () => { pr.destroy(); reject(new Error('timeout')); });
        pr.end();
    });
}

// ── Proxy GET binaire (images, JSON streams) ─────────────────
function proxyGET(hostname, reqPath, res, extraHeaders = {}, redirectCount = 0) {
    if (redirectCount > 5) {
        res.writeHead(502, CORS_HEADERS);
        res.end(JSON.stringify({ error: 'Too many redirects' }));
        return;
    }

    let done = false;

    const opts = {
        hostname,
        path:    reqPath,
        method:  'GET',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept':     'application/json, image/webp, image/*, */*',
            ...extraHeaders,
        },
    };

    const pr = https.request(opts, pres => {
        if (done) return;

        if ([301, 302, 307, 308].includes(pres.statusCode) && pres.headers.location) {
            pres.resume();
            done = true;
            try {
                const loc = new URL(pres.headers.location);
                proxyGET(loc.hostname, loc.pathname + loc.search, res, extraHeaders, redirectCount + 1);
            } catch(e) {
                res.writeHead(502, CORS_HEADERS);
                res.end(JSON.stringify({ error: 'Bad redirect' }));
            }
            return;
        }

        done = true;
        const ct = pres.headers['content-type'] || 'application/octet-stream';
        res.writeHead(pres.statusCode, { 'Content-Type': ct, ...CORS_HEADERS });
        pres.pipe(res);
    });

    pr.on('error', e => {
        if (done) return;
        done = true;
        res.writeHead(502, CORS_HEADERS);
        res.end(JSON.stringify({ error: e.message }));
    });
    pr.setTimeout(20000, () => {
        if (done) return;
        done = true;
        pr.destroy();
        res.writeHead(504, CORS_HEADERS);
        res.end(JSON.stringify({ error: 'timeout' }));
    });
    pr.end();
}

function proxyPOST(hostname, reqPath, body, res) {
    let done = false;
    const opts = {
        hostname,
        path:    reqPath,
        method:  'POST',
        headers: {
            'Content-Type':   'application/json',
            'Content-Length': Buffer.byteLength(body),
            'User-Agent':     'MangaHub/4.2',
            'Accept':         'application/json',
        },
    };
    const pr = https.request(opts, pres => {
        if (done) return;
        done = true;
        res.writeHead(pres.statusCode, { 'Content-Type': 'application/json', ...CORS_HEADERS });
        pres.pipe(res);
    });
    pr.on('error', e => { if (done) return; done = true; res.writeHead(502, CORS_HEADERS); res.end(JSON.stringify({ error: e.message })); });
    pr.setTimeout(20000, () => { if (done) return; done = true; pr.destroy(); res.writeHead(504, CORS_HEADERS); res.end(JSON.stringify({ error: 'timeout' })); });
    pr.write(body);
    pr.end();
}

function readBody(req, maxBytes = 1024 * 1024) {
    return new Promise((resolve, reject) => {
        let b = '', size = 0;
        req.on('data', c => { size += c.length; if (size > maxBytes) { req.destroy(); return reject(new Error('Body too large')); } b += c; });
        req.on('end', () => resolve(b));
        req.on('error', reject);
    });
}

function jsonError(res, status, msg) {
    res.writeHead(status, { 'Content-Type': 'application/json', ...CORS_HEADERS });
    res.end(JSON.stringify({ error: msg }));
}

// ══════════════════════════════════════════════════════════════
// ── WeebCentral HTML Scraper ──────────────────────────────────
// WeebCentral n'expose pas d'API JSON publique.
// On fetch le HTML et on l'analyse avec des regex côté serveur.
// ══════════════════════════════════════════════════════════════

const WC_HOST = 'weebcentral.com';
const WC_HEADERS = {
    'Referer':        'https://weebcentral.com/',
    'Origin':         'https://weebcentral.com',
    'Accept':         'text/html,application/xhtml+xml,*/*;q=0.9',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'same-origin',
};

function allMatches(html, re) {
    const out = [];
    let m;
    const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
    while ((m = g.exec(html)) !== null) out.push(m);
    return out;
}

// ── Recherche WeebCentral ─────────────────────────────────────
// GET /search/?text=berserk&...
// Retourne : [{ seriesId, slug, title, url }]
async function wcSearch(query) {
    const q = encodeURIComponent(query);
    const { status, body } = await fetchText(
        WC_HOST,
        `/search/?text=${q}&sort=Best+Match&order=Ascending&official=Any&anime=Any&adult=Any&display_mode=Full+Display`,
        WC_HEADERS,
    );

    if (status !== 200) throw new Error(`WeebCentral search HTTP ${status}`);

    // Liens de la forme : href="/series/{ULID}/{slug}"
    const linkMatches = allMatches(body, /href="\/series\/([\w\d]+)\/([\w\d-]+)"/);

    // Titres juste après un lien série (dans un span line-clamp ou strong)
    // On cherche le titre dans les 500 chars suivant chaque lien
    const results = [];
    const seen    = new Set();

    for (const m of linkMatches) {
        const seriesId = m[1];
        const slug     = m[2];
        if (seen.has(seriesId)) continue;
        seen.add(seriesId);

        // Chercher le titre autour de ce lien dans le HTML
        const pos   = m.index;
        const chunk = body.slice(Math.max(0, pos - 100), pos + 500);
        const tm    = chunk.match(/<span[^>]*class="[^"]*line-clamp[^"]*"[^>]*>([\s\S]*?)<\/span>/i)
                   || chunk.match(/<strong[^>]*>([\s\S]*?)<\/strong>/i)
                   || chunk.match(/alt="([^"]+)"/i);
        const title = tm ? tm[1].replace(/<[^>]+>/g, '').trim() : slug.replace(/-/g, ' ');

        results.push({
            seriesId,
            slug,
            title,
            url: `https://weebcentral.com/series/${seriesId}/${slug}`,
        });
        if (results.length >= 5) break;
    }

    return results;
}

// ── Liste des chapitres d'une série ──────────────────────────
// WeebCentral expose un endpoint HTML dédié pour la liste complète :
// GET /series/{id}/full-chapter-list
// Retourne : [{ chapterId, number, title, date }]
async function wcChapters(seriesId) {
    const { status, body } = await fetchText(
        WC_HOST,
        `/series/${seriesId}/full-chapter-list`,
        {
            ...WC_HEADERS,
            'Accept': 'text/html, */*',
            'X-Requested-With': 'XMLHttpRequest',
        },
    );

    if (status !== 200) throw new Error(`WeebCentral chapters HTTP ${status}`);

    // Liens chapitres : href="/chapters/{chapterId}/..."
    const linkRe = /href="\/chapters\/([\w\d]+)\/([^"]+)"/g;
    const links  = allMatches(body, linkRe);

    // Numéros de chapitres : "Chapter X" ou "Ch.X" ou "Chapter X.X"
    // On va chercher les occurrences de chiffres dans le texte entre les liens
    const chapters = [];
    const usedIds  = new Set();

    for (let i = 0; i < links.length; i++) {
        const chapterId = links[i][1];
        if (usedIds.has(chapterId)) continue;
        usedIds.add(chapterId);

        // Chunk de texte autour de ce lien
        const pos   = links[i].index;
        const chunk = body.slice(pos, pos + 400);

        // Chercher le numéro de chapitre
        const numMatch = chunk.match(/Chapter\s+([\d.]+)/i)
                      || chunk.match(/Ch\.?\s*([\d.]+)/i)
                      || chunk.match(/>\s*([\d.]+)\s*</);
        const num = numMatch ? parseFloat(numMatch[1]) : NaN;
        if (isNaN(num)) continue;

        // Chercher le titre optionnel
        const titleMatch = chunk.match(/title="([^"]+)"/);
        const title      = titleMatch ? titleMatch[1].trim() : `Chapter ${num}`;

        // Chercher la date
        const dateMatch = chunk.match(/(\d{4}-\d{2}-\d{2})/);
        const date      = dateMatch ? dateMatch[1] : '';

        chapters.push({ chapterId, number: num, title, date });
    }

    // Dédupliquer par numéro, trier décroissant
    const seen = new Set();
    return chapters
        .filter(c => { const k = c.number.toFixed(1); if (seen.has(k)) return false; seen.add(k); return true; })
        .sort((a, b) => b.number - a.number);
}

// ── Pages d'un chapitre ───────────────────────────────────────
// GET /chapters/{chapterId}/images?is_prev=False&reading_style=long_strip
// Retourne : [{ pageNumber, src, srcFallback }]
async function wcPages(chapterId) {
    const { status, body } = await fetchText(
        WC_HOST,
        `/chapters/${chapterId}/images?is_prev=False&reading_style=long_strip`,
        {
            ...WC_HEADERS,
            'Accept': 'text/html, */*',
            'X-Requested-With': 'XMLHttpRequest',
        },
    );

    if (status !== 200) throw new Error(`WeebCentral pages HTTP ${status}`);

    // Extraire toutes les URLs d'images
    const imgRe = /<img[^>]+src="(https?:\/\/[^"]+)"/gi;
    const imgs  = allMatches(body, imgRe).map(m => m[1]);

    // Filtrer les éléments UI et garder les vraies pages manga
    // Les pages manga sont généralement sur des CDNs avec des chemins /manga/ ou /images/
    const pages = imgs
        .filter(src =>
            !src.includes('/static/') &&
            !src.includes('favicon') &&
            !src.includes('logo') &&
            !src.includes('/icons/') &&
            !src.includes('/ui/') &&
            (
                src.includes('weebcentral') ||
                src.includes('amazonaws') ||
                src.includes('cloudfront') ||
                src.includes('/manga/') ||
                src.includes('/images/') ||
                src.includes('/chapters/')
            )
        )
        .map((src, i) => ({ pageNumber: i + 1, src, srcFallback: src }));

    // Si aucune page filtrée mais des images existent → prendre toutes les images
    // (fallback pour CDNs non reconnus)
    if (!pages.length && imgs.length > 2) {
        return imgs.slice(1, -1).map((src, i) => ({ pageNumber: i + 1, src, srcFallback: src }));
    }

    return pages;
}

// ══════════════════════════════════════════════════════════════

const server = http.createServer(async (req, res) => {
    const parsed  = new URL(req.url, 'http://localhost');
    let   reqPath = parsed.pathname;

    if (req.method === 'OPTIONS') {
        res.writeHead(204, CORS_HEADERS);
        res.end();
        return;
    }

    Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

    // ── MangaDex API ──────────────────────────────────────────
    if (reqPath.startsWith('/mangadex/')) {
        const mdPath = reqPath.slice(9) + (parsed.search || '');
        console.log('[MangaDex]', mdPath.slice(0, 100));
        proxyGET('api.mangadex.org', mdPath, res, {
            'Accept':  'application/json',
            'Origin':  'https://mangadex.org',
            'Referer': 'https://mangadex.org/',
        });
        return;
    }

    // ── Images MangaDex ───────────────────────────────────────
    if (reqPath.startsWith('/mdimg/')) {
        const imgPath = reqPath.slice(6) + (parsed.search || '');
        console.log('[MDImg]', imgPath.slice(0, 80));
        proxyGET('uploads.mangadex.org', imgPath, res, {
            'Accept':  'image/webp,image/avif,image/*,*/*',
            'Origin':  'https://mangadex.org',
            'Referer': 'https://mangadex.org/',
        });
        return;
    }

    // ── AniList ───────────────────────────────────────────────
    if (reqPath === '/anilist') {
        let body;
        try { body = await readBody(req); }
        catch(e) { return jsonError(res, 413, 'Body too large'); }
        proxyPOST('graphql.anilist.co', '/', body, res);
        return;
    }

    // ── WeebCentral — Recherche série ─────────────────────────
    if (reqPath === '/weebcentral/search') {
        const q = parsed.searchParams.get('q') || '';
        if (!q) return jsonError(res, 400, 'q required');
        console.log('[WeebCentral] search:', q);
        try {
            const results = await wcSearch(q);
            res.writeHead(200, { 'Content-Type': 'application/json', ...CORS_HEADERS });
            res.end(JSON.stringify(results));
        } catch(e) {
            console.error('[WeebCentral] search error:', e.message);
            jsonError(res, 502, e.message);
        }
        return;
    }

    // ── WeebCentral — Liste des chapitres ─────────────────────
    if (reqPath === '/weebcentral/chapters') {
        const seriesId = parsed.searchParams.get('seriesId') || '';
        if (!seriesId) return jsonError(res, 400, 'seriesId required');
        console.log('[WeebCentral] chapters:', seriesId);
        try {
            const chapters = await wcChapters(seriesId);
            res.writeHead(200, { 'Content-Type': 'application/json', ...CORS_HEADERS });
            res.end(JSON.stringify(chapters));
        } catch(e) {
            console.error('[WeebCentral] chapters error:', e.message);
            jsonError(res, 502, e.message);
        }
        return;
    }

    // ── WeebCentral — Pages d'un chapitre ────────────────────
    if (reqPath === '/weebcentral/pages') {
        const chapterId = parsed.searchParams.get('chapterId') || '';
        if (!chapterId) return jsonError(res, 400, 'chapterId required');
        console.log('[WeebCentral] pages:', chapterId);
        try {
            const pages = await wcPages(chapterId);
            res.writeHead(200, { 'Content-Type': 'application/json', ...CORS_HEADERS });
            res.end(JSON.stringify(pages));
        } catch(e) {
            console.error('[WeebCentral] pages error:', e.message);
            jsonError(res, 502, e.message);
        }
        return;
    }

    // ── WeebCentral — Proxy images CDN ───────────────────────
    // Les images WC nécessitent le bon Referer pour ne pas être bloquées.
    if (reqPath === '/weebcentral/img') {
        const imgUrl = parsed.searchParams.get('url') || '';
        if (!imgUrl) return jsonError(res, 400, 'url required');
        try {
            const u = new URL(imgUrl);
            proxyGET(u.hostname, u.pathname + u.search, res, {
                'Referer':  'https://weebcentral.com/',
                'Origin':   'https://weebcentral.com',
                'Accept':   'image/webp,image/avif,image/*,*/*',
            });
        } catch(e) { jsonError(res, 400, 'URL invalide'); }
        return;
    }

    // ── Fichiers statiques ────────────────────────────────────
    if (reqPath === '/') reqPath = '/accueil.html';
    const filePath = path.join(ROOT, reqPath);

    if (!filePath.startsWith(ROOT + path.sep) && filePath !== ROOT) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(err.code === 'ENOENT' ? 404 : 500);
            res.end(err.code === 'ENOENT' ? '404: ' + reqPath : 'Erreur serveur');
            return;
        }
        const mime = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': mime });
        res.end(data);
    });
});

server.listen(PORT, () => {
    console.log('\n  MangaHub v4.2 - Multi-sources');
    console.log('  Site          -> http://localhost:' + PORT);
    console.log('  MangaDex      -> /mangadex/manga?title=:q');
    console.log('  Images MD     -> /mdimg/data/:hash/:file');
    console.log('  AniList       -> /anilist');
    console.log('  WC Search     -> /weebcentral/search?q=:q');
    console.log('  WC Chapters   -> /weebcentral/chapters?seriesId=:id');
    console.log('  WC Pages      -> /weebcentral/pages?chapterId=:id');
    console.log('  WC Images     -> /weebcentral/img?url=:url');
    console.log('  Ctrl+C pour arreter\n');
});