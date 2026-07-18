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

// Anti-SSRF robuste : résout le DNS UNE SEULE FOIS et vérifie TOUTES les IP.
// Renvoie l'IP publique retenue pour la réutiliser côté curl — c'est ce qui
// ferme la fenêtre de DNS rebinding (audit S-3) : sans ça, curl refaisait sa
// propre résolution après notre check, laissant un domaine à TTL court basculer
// vers 169.254.169.254 (métadonnées cloud) entre la vérification et le fetch.
// Retour : { ok, ip } — ip=null pour une IP littérale (curl tape déjà la bonne).
async function resolveSafeHost(host) {
    const bare = host.replace(/^\[|\]$/g, '');                  // retire les crochets IPv6
    if (net.isIP(bare)) return { ok: !ipIsPrivate(bare), ip: null };   // IP littérale : rien à réépingler
    if (/^localhost$/i.test(bare) || bare.endsWith('.localhost')) return { ok: false, ip: null };
    try {
        const addrs = await dns.lookup(bare, { all: true });
        if (!addrs.length || addrs.some(a => ipIsPrivate(a.address))) return { ok: false, ip: null };
        return { ok: true, ip: addrs[0].address };              // 1re IP publique retenue
    } catch {
        return { ok: false, ip: null };                          // résolution impossible → on refuse
    }
}

function fetchImage(url, pinnedIp) {
    if (inflight.has(url)) return inflight.get(url);
    let origin = '', host = '', port = '';
    try { const u = new URL(url); origin = u.origin + '/'; host = u.hostname; port = u.port || (u.protocol === 'https:' ? '443' : '80'); } catch { /* laissé vide */ }
    // --resolve host:port:ip force curl à taper l'IP vérifiée par Node, tout en
    // gardant le SNI/Host d'origine (donc le certificat TLS reste validé).
    const args = ['-s', '-L', '--max-redirs', '4', '--compressed', '-m', '20', '-A', UA, '-e', origin,
        '-H', 'Accept: image/avif,image/webp,image/*,*/*;q=0.8'];
    if (pinnedIp && host && port) args.push('--resolve', `${host}:${port}:${pinnedIp}`);
    args.push(url);
    const p = new Promise((resolve, reject) => {
        execFile('curl', args, { encoding: 'buffer', maxBuffer: 25 * 1024 * 1024, windowsHide: true }, (err, stdout) => {
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
    const safe = await resolveSafeHost(host);
    if (!safe.ok) return res.status(403).end();

    // Cache hit
    const hit = cache.get(url);
    if (hit && hit.expires > Date.now()) {
        res.set('Content-Type', hit.type);
        res.set('Cache-Control', 'public, max-age=604800, immutable');
        res.set('X-Inko-Cache', 'HIT');
        return res.end(hit.buf);
    }

    try {
        const img = await fetchImage(url, safe.ip);
        // Insère dans le cache (éviction FIFO simple)
        if (cache.size >= MAX) cache.delete(cache.keys().next().value);
        cache.set(url, img);
        res.set('Content-Type', img.type);
        res.set('Cache-Control', 'public, max-age=604800, immutable');
        res.set('X-Inko-Cache', 'MISS');
        res.end(img.buf);
    } catch (e) {
        // Audit B-8 : on renvoyait un GIF 1×1 « valide » → le onerror des <img>
        // ne se déclenchait jamais, donc pas de placeholder thématique côté
        // front, juste une case vide indistincte d'une vraie image manquante.
        // On renvoie désormais un vrai échec sans corps image : le onerror des
        // cartes (this.src = placeholderCover) prend le relais proprement.
        res.status(502)
           .set('Cache-Control', 'no-store')
           .set('X-Inko-Proxy', 'source-error')
           .end();
    }
}

module.exports = { proxy };
