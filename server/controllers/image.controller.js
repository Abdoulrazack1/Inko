// ============================================================
// image.controller.js — Proxy de couvertures (et vignettes)
// ============================================================
// Récupère une image distante côté serveur et la renvoie avec un
// cache agressif. Bénéfices :
//   - vitesse : cache mémoire → les couvertures déjà vues sont instantanées
//   - fiabilité : envoie le bon Referer (contourne l'anti-hotlink)
//   - compatibilité : passe par curl (empreinte TLS navigateur), donc
//     fonctionne même sur les hôtes protégés par Cloudflare (NovelFull…)
// Sécurité : n'accède qu'à des URLs http(s) absolues (pas de SSRF interne).
// ============================================================
const { execFile } = require('child_process');
const net = require('net');
const dns = require('dns').promises;

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const TTL    = 7 * 24 * 3600 * 1000;   // 7 jours
const MAX    = 500;                     // nb max d'entrées en cache
const cache  = new Map();               // url -> { buf, type, expires }
const inflight = new Map();             // url -> Promise

function contentTypeFor(url) {
    const ext = (url.split('?')[0].match(/\.(\w{3,4})$/) || [])[1]?.toLowerCase();
    return { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
             gif: 'image/gif', avif: 'image/avif', bmp: 'image/bmp', svg: 'image/svg+xml' }[ext]
        || 'image/jpeg';
}

// Vrai/Faux : cette IP (v4 ou v6) appartient-elle à une plage interne/réservée ?
function ipIsPrivate(ip) {
    if (net.isIPv4(ip)) {
        const [a, b] = ip.split('.').map(Number);
        return a === 0 || a === 10 || a === 127                  // this-host, privé, loopback
            || (a === 169 && b === 254)                          // link-local
            || (a === 172 && b >= 16 && b <= 31)                 // privé
            || (a === 192 && b === 168)                          // privé
            || (a === 100 && b >= 64 && b <= 127)                // CGNAT (RFC 6598)
            || a >= 224;                                         // multicast / réservé
    }
    if (net.isIPv6(ip)) {
        const v = ip.toLowerCase();
        if (v === '::1' || v === '::') return true;              // loopback / non spécifié
        if (v.startsWith('fe80') || v.startsWith('fc') || v.startsWith('fd')) return true; // link-local / ULA
        const m = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);      // IPv4 mappée
        if (m) return ipIsPrivate(m[1]);
        return false;
    }
    return true; // format inconnu → on refuse par prudence
}

// Anti-SSRF robuste : résout le DNS et vérifie TOUTES les IP renvoyées.
// Bloque le « DNS rebinding » (un domaine public qui pointe vers 127.0.0.1/10.x…).
async function hostResolvesPrivate(host) {
    const bare = host.replace(/^\[|\]$/g, '');                  // retire les crochets IPv6
    if (net.isIP(bare)) return ipIsPrivate(bare);               // IP littérale
    if (/^localhost$/i.test(bare) || bare.endsWith('.localhost')) return true;
    try {
        const addrs = await dns.lookup(bare, { all: true });
        return addrs.length === 0 || addrs.some(a => ipIsPrivate(a.address));
    } catch {
        return true; // résolution impossible → on refuse
    }
}

function fetchImage(url) {
    if (inflight.has(url)) return inflight.get(url);
    const origin = (() => { try { return new URL(url).origin + '/'; } catch { return ''; } })();
    const p = new Promise((resolve, reject) => {
        execFile('curl', [
            '-s', '-L', '--max-redirs', '4', '--compressed', '-m', '20',
            '-A', UA,
            '-e', origin,                          // Referer = origine de l'image
            '-H', 'Accept: image/avif,image/webp,image/*,*/*;q=0.8',
            url,
        ], { encoding: 'buffer', maxBuffer: 25 * 1024 * 1024, windowsHide: true }, (err, stdout) => {
            if (err) return reject(err);
            if (!stdout || stdout.length < 64) return reject(new Error('image vide'));
            resolve({ buf: stdout, type: contentTypeFor(url), expires: Date.now() + TTL });
        });
    }).finally(() => inflight.delete(url));
    inflight.set(url, p);
    return p;
}

async function proxy(req, res) {
    const url = req.query.u || req.query.url;
    if (!url || !/^https?:\/\//i.test(url)) return res.status(400).end();
    let host;
    try { host = new URL(url).hostname; } catch (e) { return res.status(400).end(); }
    if (await hostResolvesPrivate(host)) return res.status(403).end();

    // Cache hit
    const hit = cache.get(url);
    if (hit && hit.expires > Date.now()) {
        res.set('Content-Type', hit.type);
        res.set('Cache-Control', 'public, max-age=604800, immutable');
        res.set('X-Inko-Cache', 'HIT');
        return res.end(hit.buf);
    }

    try {
        const img = await fetchImage(url);
        // Insère dans le cache (éviction FIFO simple)
        if (cache.size >= MAX) cache.delete(cache.keys().next().value);
        cache.set(url, img);
        res.set('Content-Type', img.type);
        res.set('Cache-Control', 'public, max-age=604800, immutable');
        res.set('X-Inko-Cache', 'MISS');
        res.end(img.buf);
    } catch (e) {
        // 1x1 transparent en repli (jamais d'image cassée visible)
        res.status(502)
           .set('Content-Type', 'image/gif')
           .set('Cache-Control', 'no-store')
           .end(Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', 'base64'));
    }
}

module.exports = { proxy };
