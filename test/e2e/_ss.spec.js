const { test } = require('@playwright/test');
test('etat de sushiscan', async ({ request }) => {
    test.setTimeout(300000);
    const out = {};
    const man = await (await request.get('/api/sources')).json();
    const ss = (man.sources || man).find(s => s.id === 'sushiscan');
    out.declaration = { version: ss.version, capabilities: ss.capabilities, sorts: ss.sorts, filters: ss.filters, unit: ss.unit };

    const requetes = ['solo leveling', 'one piece', 'naruto', 'shingeki', 'attaque des titans', 'jujutsu', 'chainsaw', 'blue lock', 'sololeveling', 'solo levelling'];
    out.recherches = {};
    for (const q of requetes) {
        const t0 = Date.now();
        const r = await request.get(`/api/sources/sushiscan/mangas/search?q=${encodeURIComponent(q)}&limit=5`);
        const j = await r.json().catch(() => ({}));
        out.recherches[q] = {
            ms: Date.now() - t0,
            total: j.total,
            premiers: (j.results || []).slice(0, 3).map(m => (m.title || '').slice(0, 34)),
        };
    }
    const p = await (await request.get('/api/sources/sushiscan/mangas/popular?limit=3')).json();
    const m0 = (p.results || [])[0];
    out.champs_liste = m0 ? Object.entries(m0).map(([k, v]) => k + '=' + (v === null ? 'null' : v === '' ? 'vide' : Array.isArray(v) ? `[${v.length}]` : String(v).slice(0, 22))) : null;
    if (m0) {
        const f = await (await request.get(`/api/sources/sushiscan/mangas/${encodeURIComponent(m0.id)}`)).json();
        out.champs_fiche = Object.entries(f).map(([k, v]) => k + '=' + (v === null ? 'null' : v === '' ? 'vide' : Array.isArray(v) ? `[${v.length}]` : String(v).slice(0, 22)));
    }
    const tg = await request.get('/api/sources/sushiscan/mangas/tags');
    out.tags = { statut: tg.status(), extrait: (await tg.text()).slice(0, 120) };
    console.log('SS:' + JSON.stringify(out, null, 1));
});
