// ============================================================
// lib/bounded-cache.js — cache mémoire borné partagé (audit §3)
// ------------------------------------------------------------
// Le pattern « Map bornée + éviction FIFO » d'image.controller.js,
// extrait pour être réutilisé partout où un cache process-lifetime
// grossissait sans limite (artwork.controller, anilist.controller) —
// fuite mémoire lente mais réelle sur un hub 24/7 (NAS, Raspberry Pi).
//
// Usage :
//   const BoundedCache = require('../lib/bounded-cache');
//   const cache = new BoundedCache({ max: 300, ttl: 24 * 3600 * 1000 });
//   cache.set('clef', valeur);        // évince la plus ancienne si plein
//   const v = cache.get('clef');      // undefined si absente OU expirée
// ============================================================
class BoundedCache {
    constructor({ max = 500, ttl = 0 } = {}) {
        this.max = max;
        this.ttl = ttl;          // 0 = pas d'expiration
        this.map = new Map();    // key -> { v, exp }
    }

    get(key) {
        const e = this.map.get(key);
        if (!e) return undefined;
        if (e.exp && e.exp <= Date.now()) { this.map.delete(key); return undefined; }
        return e.v;
    }

    // `ttl` (ms) surcharge la durée de vie du cache pour CETTE entrée
    // (audit AMEL-64) : une fiche Gutenberg ne changera jamais, un scan suivi
    // peut sortir un chapitre dans l'heure. Omis, le TTL du cache s'applique.
    set(key, value, ttl) {
        // Éviction FIFO simple : suffisant pour des caches de type
        // « une entrée par titre consulté » (pas besoin de LRU strict).
        if (!this.map.has(key) && this.map.size >= this.max) {
            this.map.delete(this.map.keys().next().value);
        }
        const duree = Number.isFinite(ttl) && ttl > 0 ? ttl : this.ttl;
        this.map.set(key, { v: value, exp: duree ? Date.now() + duree : 0 });
    }

    get size() { return this.map.size; }
    clear() { this.map.clear(); }
}

module.exports = BoundedCache;
