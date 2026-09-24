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
// Audit S6 : borne aussi le POIDS total du cache (le pire cas 500 × 25 Mo
// = ~12 Go de RAM pouvait coucher un Raspberry Pi/NAS en mode hub).
const MAX_BYTES = parseInt(process.env.IMG_CACHE_MB || '150', 10) * 1024 * 1024;
let cacheBytes = 0;
const cache  = new Map();               // url -> { buf, type, expires }
const inflight = new Map();             // url -> Promise

// ══════════════════════ Cache disque (2e niveau) ══════════════════════
//
// Le cache ci-dessus est un `Map` : il MEURT avec le processus.
//
// L'app de bureau relance son serveur à chaque ouverture. Chaque session
// repartait donc à froid, et chaque planche déjà lue hier se retéléchargeait
// aujourd'hui. Le TTL de sept jours ne servait à rien : le cache n'a jamais
// vécu jusque-là.
//
// Ce que la mesure justifie, et elle seule :
//
//     page en cache   :      5 – 25 ms
//     page à froid    :  3 700 – 9 000 ms
//
// Un facteur cent à mille. C'est le seul écart de cette page qui dépasse
// franchement la variance de la source — mesurée à 3× d'un moment à l'autre.
// J'ai renoncé à toucher la concurrence du lecteur pour cette raison : les
// relevés se contredisaient, et changer une constante sur du bruit aurait été
// pire que ne rien faire.
//
// Pas d'index : le nom du fichier porte l'empreinte de l'URL, son extension
// porte le type, et sa date de modification porte l'âge. Un index séparé
// serait un second état à tenir cohérent, et une corruption possible.
const fs   = require('fs');
const fsp  = fs.promises;
const path = require('path');
const os   = require('os');
const crypto = require('crypto');

const DISQUE_MAX_MO = parseInt(process.env.IMG_DISK_CACHE_MB || '512', 10);
const DISQUE_ACTIF  = DISQUE_MAX_MO > 0 && process.env.IMG_DISK_CACHE !== '0';

function dossierCache() {
    const base = process.env.APPDATA || path.join(os.homedir(), '.config');
    return path.join(base, 'Inko', 'cache-img');
}

const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
    'image/gif': 'gif', 'image/avif': 'avif' };
const TYPE = Object.fromEntries(Object.entries(EXT).map(([t, e]) => [e, t]));

const empreinte = (url) => crypto.createHash('sha256').update(url).digest('hex');

/** Le chemin d'une URL en cache, s'il existe — sinon `null`. */
async function surDisque(url) {
    if (!DISQUE_ACTIF) return null;
    const h = empreinte(url);
    for (const ext of Object.keys(TYPE)) {
        const p = path.join(dossierCache(), h + '.' + ext);
        try {
            const st = await fsp.stat(p);
            // Périmé : on le laisse à l'éviction plutôt que de le servir.
            if (Date.now() - st.mtimeMs > TTL) return null;
            return { chemin: p, type: TYPE[ext] };
        } catch (e) { /* absent : on essaie l'extension suivante */ }
    }
    return null;
}

/**
 * Écrit l'image sur disque. Le fichier temporaire puis le renommage sont
 * délibérés : sans eux, une écriture interrompue laisserait une image
 * TRONQUÉE que la lecture suivante servirait comme valide — un défaut
 * silencieux, et le pire genre.
 */
async function poserSurDisque(url, buf, type) {
    if (!DISQUE_ACTIF) return;
    const ext = EXT[type];
    if (!ext) return;                       // type inconnu : on ne devine pas
    const dir = dossierCache();
    const dst = path.join(dir, empreinte(url) + '.' + ext);
    const tmp = dst + '.' + process.pid + '.tmp';
    try {
        await fsp.mkdir(dir, { recursive: true });
        await fsp.writeFile(tmp, buf);
        await fsp.rename(tmp, dst);
    } catch (e) {
        // Disque plein, dossier en lecture seule, hub sur un NAS : le cache
        // disque est un CONFORT. Son échec ne doit jamais empêcher de lire.
        try { await fsp.unlink(tmp); } catch (_) { /* déjà parti */ }
    }
}

/**
 * Ramène le dossier sous son quota, en supprimant les plus anciens d'abord.
 *
 * Lancé au plus une fois par minute, et JAMAIS sur le chemin d'une requête :
 * un balayage de plusieurs milliers de fichiers ne doit pas s'ajouter à
 * l'attente d'une page.
 */
let derniereEviction = 0;
async function evincer() {
    if (!DISQUE_ACTIF) return;
    if (Date.now() - derniereEviction < 60_000) return;
    derniereEviction = Date.now();
    const dir = dossierCache();
    try {
        const noms = await fsp.readdir(dir);
        const fichiers = [];
        let total = 0;
        for (const n of noms) {
            if (n.endsWith('.tmp')) continue;
            try {
                const st = await fsp.stat(path.join(dir, n));
                fichiers.push({ n, taille: st.size, age: st.mtimeMs });
                total += st.size;
            } catch (e) { /* disparu entre-temps */ }
        }
        const quota = DISQUE_MAX_MO * 1024 * 1024;
        if (total <= quota) return;
        fichiers.sort((a, b) => a.age - b.age);          // les plus vieux d'abord
        for (const f of fichiers) {
            if (total <= quota) break;
            try { await fsp.unlink(path.join(dir, f.n)); total -= f.taille; }
            catch (e) { /* déjà supprimé */ }
        }
    } catch (e) { /* dossier absent : rien à évincer */ }
}

// ── Audit S6 : liste blanche de domaines ─────────────────────
// Le proxy n'était restreint par rien : n'importe qui pouvait relayer
// n'importe quelle image publique via l'IP du hub (vol de bande passante,
// relais anonymisant). Domaines autorisés = ceux des extensions installées
// (baseUrl) + les CDN d'images connus des sources + IMG_PROXY_ALLOW (env,
// séparés par des virgules). IMG_PROXY_OPEN=1 désactive la restriction.
const EXTRA_ALLOWED = [
    'mangadex.org', 'mangadex.network',      // couvertures + serveurs MD@Home
    'anilist.co',                            // artwork hero (artwork.controller)
    'royalroadcdn.com',                      // couvertures RoyalRoad
    'gutenberg.org',                         // couvertures Gutenberg
    'compsci88.com', 'lowee.us',             // CDN WeebCentral
    'wp.com', 'gravatar.com',                // médias WordPress (Chireads & co)
];
function registrableDomain(host) {
    const parts = String(host || '').toLowerCase().split('.').filter(Boolean);
    return parts.length <= 2 ? parts.join('.') : parts.slice(-2).join('.');
}
function allowedDomains() {
    const set = new Set(EXTRA_ALLOWED);
    try {
        for (const s of require('../extensions/loader').getAll()) {
            try { set.add(registrableDomain(new URL(s.baseUrl).hostname)); } catch (e) { /* baseUrl absent */ }
            // Audit PERF-08 : le domaine du SITE ne suffit pas. Les pages de
            // scans sont servies par des CDN distincts (sushiscan.fr sert ses
            // planches depuis anime-sama.me), si bien que le lecteur se voyait
            // refuser le proxy — et chargeait donc en direct, exposant l'IP de
            // l'utilisateur au site source à chaque page tournée.
            //
            // Élargir la liste statique à chaque CDN découvert la ferait courir
            // derrière les sources indéfiniment. Une extension DÉCLARE donc les
            // hôtes d'images qu'elle utilise, comme elle déclare déjà ses tris
            // (`sorts`). La restriction reste fermée par défaut : ajouter une
            // source n'ouvre que ce que cette source annonce.
            for (const h of (s.imageHosts || [])) {
                const t = String(h || '').trim().toLowerCase();
                if (t) set.add(t);
            }
        }
    } catch (e) { /* loader pas encore prêt : liste statique seule */ }
    for (const d of (process.env.IMG_PROXY_ALLOW || '').split(',')) {
        const t = d.trim().toLowerCase();
        if (t) set.add(t);
    }
    return set;
}
function hostAllowed(host) {
    if (process.env.IMG_PROXY_OPEN === '1') return true;
    const h = String(host || '').toLowerCase();
    for (const d of allowedDomains()) {
        if (h === d || h.endsWith('.' + d)) return true;
    }
    return false;
}

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
    // Deux délais, pas un seul — et c'est la correction.
    //
    // `-m 20` plafonnait le transfert ENTIER à vingt secondes. Mesuré sur la
    // source d'un lecteur réel (scans-hot), une planche de 225 Ko met :
    //
    //     3 700 – 9 000 ms   une par une, selon le moment
    //    17 000 – 25 000 ms  quand plusieurs partent ensemble
    //
    // Le plafond tombait donc EN PLEIN TÉLÉCHARGEMENT d'une image parfaitement
    // valide. Le proxy rendait un échec, le lecteur affichait une page vide, et
    // rien ne disait que c'était un abandon plutôt qu'une image manquante.
    //
    // Un seul délai ne peut pas distinguer « hôte mort » de « hôte lent ». On
    // les sépare : dix secondes pour ÉTABLIR la connexion — au-delà, l'hôte ne
    // répond pas et insister ne sert à rien — puis soixante pour transférer,
    // parce qu'une source lente finit par livrer.
    //
    // La variance mesurée du CDN atteint 3× d'un moment à l'autre : un plafond
    // calé au plus juste redeviendrait trop court à la première mauvaise heure.
    const MAX_TRANSFERT = process.env.IMG_TIMEOUT_S || '60';
    const args = ['-s', '-L', '--max-redirs', '4', '--compressed',
        '--connect-timeout', '10', '-m', MAX_TRANSFERT, '-A', UA, '-e', origin,
        '-H', 'Accept: image/avif,image/webp,image/*,*/*;q=0.8'];
    if (pinnedIp && host && port) args.push('--resolve', `${host}:${port}:${pinnedIp}`);
    args.push(url);
    const p = new Promise((resolve, reject) => {
        // 10 Mo suffisent largement pour une couverture/page (audit S6 : 25 Mo
        // × 500 entrées = pire cas mémoire intenable sur NAS/Raspberry Pi).
        execFile('curl', args, { encoding: 'buffer', maxBuffer: 10 * 1024 * 1024, windowsHide: true }, (err, stdout) => {
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
    // Audit S6 : domaine hors des sources connues → refus (log une fois par
    // hôte pour permettre d'étendre IMG_PROXY_ALLOW si un CDN légitime manque).
    if (!hostAllowed(host)) {
        if (!proxy._warned) proxy._warned = new Set();
        if (!proxy._warned.has(host)) {
            proxy._warned.add(host);
            console.warn(`[img] domaine refusé : ${host} — ajouter à IMG_PROXY_ALLOW si légitime`);
        }
        return res.status(403).set('X-Inko-Proxy', 'domain-blocked').end();
    }
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

    // Deuxième niveau : le disque. Il survit au redémarrage, là où le `Map`
    // ci-dessus repart vide à chaque ouverture de l'app.
    const surD = await surDisque(url);
    if (surD) {
        try {
            const buf = await fsp.readFile(surD.chemin);
            res.set('Content-Type', surD.type);
            res.set('Cache-Control', 'public, max-age=604800, immutable');
            res.set('X-Inko-Cache', 'DISK');
            // Remonte en mémoire : relire le fichier à chaque page de la même
            // planche serait payer un accès disque pour rien.
            if (buf.length < MAX_BYTES) {
                cache.set(url, { buf, type: surD.type, expires: Date.now() + TTL });
                cacheBytes += buf.length;
            }
            return res.end(buf);
        } catch (e) { /* fichier disparu ou illisible : on retéléchargera */ }
    }

    try {
        const img = await fetchImage(url, safe.ip);
        // Le disque d'abord : si l'insertion mémoire évince cette image
        // aussitôt (grosse planche, cache plein), elle reste au moins ici.
        poserSurDisque(url, img.buf, img.type).then(evincer).catch(() => {});
        // Insère dans le cache (éviction FIFO, bornée en nombre ET en octets — audit S6)
        while (cache.size && (cache.size >= MAX || cacheBytes + img.buf.length > MAX_BYTES)) {
            const oldest = cache.keys().next().value;
            cacheBytes -= cache.get(oldest).buf.length;
            cache.delete(oldest);
        }
        cache.set(url, img);
        cacheBytes += img.buf.length;
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
