// ============================================================
// synchro.js — le téléphone et le PC, comme Spotify
// ------------------------------------------------------------
// Chargé UNIQUEMENT dans l'APK, après `moi-local.js`.
//
// ── Le modèle ───────────────────────────────────────────────
//
// Le téléphone est TOUJOURS autonome : il lit et écrit dans son propre
// stockage (`moi-local.js`) et interroge lui-même les sources qu'il sait
// exécuter. Le PC n'est plus un serveur dont il dépend, c'est un pair avec
// lequel il se synchronise quand il est joignable :
//
//   1. BOÎTE D'ENVOI — chaque modification faite sur le téléphone (favori,
//      progression, chapitre lu, note, statut, liste) est notée ici, puis
//      rejouée vers le PC dès qu'il répond. Les routes du serveur sont déjà
//      idempotentes (ajouter un favori deux fois, marquer lu deux fois) et la
//      progression est arbitrée par date (`clientAt`) : rejouer est sûr.
//
//   2. RAPATRIEMENT — une fois la boîte vide, on reprend l'état fusionné du
//      PC. Ce qui a été lu sur le PC apparaît sur le téléphone, et l'inverse.
//
// La première synchronisation d'un téléphone qui avait déjà des données
// locales (utilisé seul avant d'être appairé) envoie TOUT son état : rien de
// ce qui a été lu hors connexion n'est perdu au moment d'appairer.
//
// Déclencheurs : ouverture de l'app, retour du réseau, retour au premier
// plan, toutes les 3 minutes tant que l'app est visible, et le bouton
// « Synchroniser maintenant » des réglages.
// ============================================================
(function () {
    'use strict';
    const ML = window.INKO_MOI_LOCAL;
    if (!ML || window.INKO_SYNCHRO) return;

    const CLE_BOITE = 'inko_sync_boite';
    const CLE_ETAT = 'inko_sync_etat';
    const MAX_BOITE = 3000;

    const lireJson = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
    const ecrireJson = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { window.MH?.err?.('synchro.js', e); } };

    const etat = () => lireJson(CLE_ETAT, { premiere: false, derniere: null, erreur: null });
    const poserEtat = (patch) => ecrireJson(CLE_ETAT, { ...etat(), ...patch });

    // Ce qui voyage. Les réglages de l'appareil (thème, lecteur), les
    // notifications locales et AniList restent propres au téléphone.
    const SYNCHRONISABLE = /^\/me\/(favorites|progress|read-chapters|notes|lists|library)(\/|$|\?)/;

    // ── 1. La boîte d'envoi ────────────────────────────────
    const repondreOrigine = ML.repondre;
    ML.repondre = function (method, chemin, corps) {
        const r = repondreOrigine.call(this, method, chemin, corps);
        if (method !== 'GET' && r !== ML.ABSENT && SYNCHRONISABLE.test(String(chemin))) {
            const boite = lireJson(CLE_BOITE, []);
            // La progression d'une série n'a besoin que de sa DERNIÈRE valeur.
            const garde = method === 'PUT' && /^\/me\/progress\//.test(chemin)
                ? boite.filter(o => !(o.m === 'PUT' && o.c === chemin)) : boite;
            // Une progression part avec l'heure où l'on a VRAIMENT lu : rejouée
            // plus tard, elle ne doit pas écraser une lecture plus récente sur le PC.
            const b = (method === 'PUT' && /^\/me\/progress\//.test(chemin) && corps && !corps.clientAt)
                ? { ...corps, clientAt: new Date().toISOString() } : (corps ?? null);
            garde.push({ m: method, c: String(chemin), b, at: Date.now(),
                // Les notes et listes créées ici ont un identifiant LOCAL : on
                // le garde pour réécrire les opérations suivantes qui le citent.
                idLocal: (r && typeof r === 'object' && r.id && String(r.id).startsWith('l')) ? r.id : null });
            if (garde.length > MAX_BOITE) garde.splice(0, garde.length - MAX_BOITE);
            ecrireJson(CLE_BOITE, garde);
            planifier(4000);   // on pousse vite, sans attendre le prochain cycle
        }
        return r;
    };

    // ── Parler au PC ───────────────────────────────────────
    const base = () => (window.INKO_HUB || '').replace(/\/+$/, '') + '/api';
    async function appel(method, chemin, corps, delai = 15000) {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), delai);
        try {
            const headers = { Accept: 'application/json' };
            if (window.INKO_TOKEN) headers.Authorization = 'Bearer ' + window.INKO_TOKEN;
            if (corps != null) headers['Content-Type'] = 'application/json';
            const res = await fetch(base() + chemin, { method, headers, body: corps != null ? JSON.stringify(corps) : undefined, signal: ctrl.signal });
            let data = null; try { data = await res.json(); } catch (e) { data = null; }
            if (!res.ok) { const e = new Error(data?.error || 'HTTP ' + res.status); e.status = res.status; throw e; }
            return data;
        } catch (e) {
            if (!e.status) e.reseau = true;
            throw e;
        } finally { clearTimeout(t); }
    }

    async function joignable() {
        if (!window.INKO_HUB || !navigator.onLine) return false;
        try { const h = await appel('GET', '/health', null, 4000); return !!h?.ok; } catch (e) { return false; }
    }

    // État complet du téléphone, en opérations — pour la première fois.
    function operationsInitiales() {
        const s = ML._etat();
        const ops = [];
        for (const f of s.favorites || []) ops.push({ m: 'POST', c: '/me/favorites', b: { mangaId: f.mangaId, source: f.source, title: f.title, cover: f.cover } });
        for (const [m, v] of Object.entries(s.library || {})) if (v?.status) ops.push({ m: 'PUT', c: '/me/library/' + encodeURIComponent(m), b: { status: v.status } });
        for (const [m, p] of Object.entries(s.progress || {})) ops.push({ m: 'PUT', c: '/me/progress/' + encodeURIComponent(m), b: { ...p, clientAt: p.updatedAt } });
        for (const [m, l] of Object.entries(s.readChapters || {})) if (l.length) ops.push({ m: 'POST', c: '/me/read-chapters/bulk', b: { mangaId: m, chapters: l.map(x => ({ chapterId: x.chapterId, chapter: x.chapter })) } });
        for (const n of (s.notes || []).slice().reverse()) if (String(n.id).startsWith('l')) ops.push({ m: 'POST', c: '/me/notes', b: n, idLocal: n.id });
        return ops;
    }

    // ── 2. Pousser ─────────────────────────────────────────
    async function pousser() {
        let boite = lireJson(CLE_BOITE, []);
        if (!etat().premiere) {
            boite = [...operationsInitiales(), ...boite];
            ecrireJson(CLE_BOITE, boite);
            poserEtat({ premiere: true });
        }
        const correspondances = lireJson('inko_sync_ids', {});
        let envoyees = 0;
        while (boite.length) {
            const op = boite[0];
            let chemin = op.c;
            for (const [loc, srv] of Object.entries(correspondances)) chemin = chemin.split(loc).join(String(srv));
            try {
                const r = await appel(op.m, chemin, op.b);
                const idServeur = r?.note?.id ?? r?.id ?? null;
                if (op.idLocal && idServeur != null) { correspondances[op.idLocal] = idServeur; ecrireJson('inko_sync_ids', correspondances); }
                envoyees++;
            } catch (e) {
                if (e.reseau) break;                 // le PC ne répond plus : on garde la suite
                // Refus applicatif (4xx) : l'opération ne passera jamais, on
                // la retire plutôt que de bloquer toute la file derrière elle.
                window.MH?.err?.('synchro.js', e);
            }
            boite.shift();
            ecrireJson(CLE_BOITE, boite);
        }
        return { envoyees, restantes: boite.length };
    }

    // ── 3. Rapatrier ───────────────────────────────────────
    async function rapatrier() {
        const [favoris, progres, lus, notes, listes, biblio] = await Promise.all([
            appel('GET', '/me/favorites'), appel('GET', '/me/progress'), appel('GET', '/me/read-chapters'),
            appel('GET', '/me/notes?limit=1000'), appel('GET', '/me/lists').catch(() => null), appel('GET', '/me/library').catch(() => null),
        ]);
        // Une modification faite PENDANT le rapatriement est dans la boîte :
        // on n'écrase alors rien, le prochain cycle la poussera d'abord.
        if (lireJson(CLE_BOITE, []).length) return false;
        const s = ML._etat();
        const liste = (x) => Array.isArray(x) ? x : (x?.items || []);
        s.favorites = liste(favoris).map(f => ({ mangaId: f.mangaId, title: f.title, cover: f.cover, source: f.source,
            category: f.category ?? null, addedAt: f.addedAt, status: f.status ?? null, unreadCount: f.unreadCount ?? null, latestAt: f.latestAt ?? null }));
        s.progress = progres || {};
        s.readChapters = lus || {};
        s.notes = notes?.notes || [];
        if (listes) s.lists = liste(listes);
        if (biblio) {
            s.library = {};
            for (const b of liste(biblio)) s.library[b.mangaId] = { status: b.status, rating: null };
        }
        ML._ecrire();
        return true;
    }

    // ── Le cycle ───────────────────────────────────────────
    let enCours = null;
    async function synchroniser({ manuel = false } = {}) {
        if (enCours) return enCours;
        enCours = (async () => {
            if (!(await joignable())) {
                poserEtat({ erreur: window.INKO_HUB ? 'PC injoignable' : 'Aucun PC appairé' });
                annoncer();
                if (manuel) window.MH?.toast?.(window.INKO_HUB ? 'PC injoignable — tes modifications partiront à la prochaine connexion' : 'Aucun PC appairé');
                return { ok: false };
            }
            try {
                const p = await pousser();
                const fait = p.restantes ? false : await rapatrier();
                poserEtat({ derniere: Date.now(), erreur: p.restantes ? 'Envoi interrompu' : null });
                annoncer();
                if (manuel) window.MH?.toast?.(fait ? 'Synchronisé avec ton PC ✓' : 'Synchronisation partielle — nouvel essai bientôt');
                // Les pages déjà affichées gardent l'ancien état : on le leur dit.
                if (fait && (p.envoyees || manuel)) window.dispatchEvent(new CustomEvent('inko:synchro', { detail: p }));
                return { ok: true, ...p };
            } catch (e) {
                poserEtat({ erreur: e.message });
                annoncer();
                if (manuel) window.MH?.toast?.('Synchronisation impossible : ' + e.message);
                return { ok: false };
            }
        })().finally(() => { enCours = null; });
        return enCours;
    }

    let minuterie = null;
    function planifier(ms) { clearTimeout(minuterie); minuterie = setTimeout(() => synchroniser(), ms); }

    // ── Ce que l'interface peut en dire ─────────────────────
    function resume() {
        const e = etat();
        return {
            appaire: !!window.INKO_HUB,
            enAttente: lireJson(CLE_BOITE, []).length,
            derniere: e.derniere,
            erreur: e.erreur,
        };
    }
    function annoncer() { window.dispatchEvent(new CustomEvent('inko:synchro-etat', { detail: resume() })); }

    window.INKO_SYNCHRO = { synchroniser: () => synchroniser({ manuel: true }), resume };

    // Démarrage et rattrapages.
    if (window.INKO_HUB) {
        setTimeout(() => synchroniser(), 2500);
        setInterval(() => { if (document.visibilityState === 'visible') synchroniser(); }, 3 * 60 * 1000);
        window.addEventListener('online', () => planifier(1500));
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') planifier(1000); });
        window.INKO_NATIF?.surReseau?.((e) => { if (e.connecte) planifier(2000); });
    }
})();
