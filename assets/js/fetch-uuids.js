// fetch-uuids.js – À utiliser UNE SEULE FOIS
(function() {
    'use strict';

    // Si tu utilises un proxy local (recommandé), change cette URL
    const API_BASE = 'https://api.mangadex.org'; // ou 'http://localhost:3000/api/mangadex'
    const DELAY_MS = 500;

    if (!window.DB || !DB.mangas) {
        console.error('❌ data.js non chargé. Assure-toi que cette page charge data.js.');
        return;
    }

    const queries = {};
    DB.mangas.forEach(m => { queries[m.id] = m.title; });

    const uuids = {};

    async function fetchUUID(title) {
        const url = `${API_BASE}/manga?title=${encodeURIComponent(title)}&limit=5&order[relevance]=desc`;
        try {
            const res = await fetch(url);
            if (!res.ok) return null;
            const data = await res.json();
            return data.data?.[0]?.id || null;
        } catch { return null; }
    }

    async function run() {
        console.log('Récupération des UUID…');
        const ids = Object.keys(queries).map(Number).sort((a,b)=>a-b);
        for (let i=0; i<ids.length; i++) {
            const id = ids[i];
            console.log(`[${i+1}/${ids.length}] ID ${id} : "${queries[id]}"`);
            const uuid = await fetchUUID(queries[id]);
            if (uuid) {
                uuids[id] = uuid;
                console.log(`  → ${uuid}`);
            } else {
                console.warn(`  → aucun UUID`);
            }
            if (i < ids.length-1) await new Promise(r => setTimeout(r, DELAY_MS));
        }
        console.log('✅ Terminé ! Copie cet objet :');
        console.log(JSON.stringify(uuids, null, 2));
    }

    run().catch(console.error);
})();