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

    // ── Le journal ─────────────────────────────────────────
    // Ce qui est parti, ce qui est arrivé, ce qui a échoué. Sans lui, une
    // opération que le PC refusait (4xx) était RETIRÉE de la boîte sans
    // laisser d'autre trace qu'une ligne de console : une modification faite
    // sur le téléphone pouvait disparaître sans que personne ne le sache.
    const CLE_JOURNAL = 'inko_sync_journal';
    const MAX_JOURNAL = 200;
    function noter(type, libelle, detail) {
        const j = lireJson(CLE_JOURNAL, []);
        const dernier = j[0];
        // Un PC éteint toute la nuit ne doit pas remplir le journal de la même ligne.
        if (dernier && dernier.type === type && dernier.libelle === libelle && type === 'injoignable') {
            dernier.t = Date.now(); dernier.n = (dernier.n || 1) + 1;
        } else {
            j.unshift({ t: Date.now(), type, libelle, ...(detail ? { detail: String(detail).slice(0, 200) } : {}) });
        }
        ecrireJson(CLE_JOURNAL, j.slice(0, MAX_JOURNAL));
    }
    const LIBELLES = [
        [/^POST \/me\/favorites$/, 'Favori ajouté'],
        [/^DELETE \/me\/favorites\//, 'Favori retiré'],
        [/^PUT \/me\/progress\//, 'Progression'],
        [/^\w+ \/me\/read-chapters\/bulk/, 'Chapitres marqués lus'],
        [/^\w+ \/me\/read-chapters/, 'Chapitre lu'],
        [/^\w+ \/me\/notes/, 'Note'],
        [/^\w+ \/me\/library\//, 'Statut de lecture'],
        [/^\w+ \/me\/lists/, 'Liste'],
    ];
    function libelleDe(op) {
        const cle = op.m + ' ' + op.c;
        const titre = op.b?.title ? ` — ${op.b.title}` : '';
        const n = Array.isArray(op.b?.chapters) ? ` (${op.b.chapters.length})` : '';
        for (const [re, l] of LIBELLES) if (re.test(cle)) return l + n + titre;
        return cle;
    }
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

    // ── Conflits ───────────────────────────────────────────
    // Hors ligne, le téléphone passe une série en « Terminé » ; pendant ce
    // temps, sur le PC, on la passe en « Abandonné ». Au retour du réseau, la
    // boîte d'envoi rejouait « Terminé » et écrasait en silence le choix fait
    // sur le PC — le statut n'a pas d'arbitre de date. Même chose, en moins
    // grave, pour la position (arbitrée par date, mais sans rien dire).
    //
    // On compare à TROIS : ce que le PC disait au dernier rapatriement (la
    // base), ce que le téléphone veut écrire, ce que le PC dit maintenant. Le
    // PC a changé depuis la base ET ne dit pas la même chose que le
    // téléphone : c'est un conflit. Il n'est pas envoyé ; il attend qu'on
    // choisisse, avec les deux valeurs sous les yeux.
    const CLE_BASE = 'inko_sync_base';
    const CLE_CONFLITS = 'inko_sync_conflits';
    const STATUTS = { reading: 'En cours', completed: 'Terminé', planned: 'À lire', paused: 'En pause', dropped: 'Abandonné' };
    function conflitDe(op, base, pc) {
        const mStat = /^\/me\/library\/(.+)$/.exec(op.c);
        const mProg = /^\/me\/progress\/(.+)$/.exec(op.c);
        if (op.m !== 'PUT' || op.force || (!mStat && !mProg)) return null;
        const mangaId = decodeURIComponent((mStat || mProg)[1]);
        if (mStat) {
            if (!(mangaId in (base.statut || {}))) return null;
            const b = base.statut[mangaId] ?? null, s = pc.statut[mangaId] ?? null, l = op.b?.status ?? null;
            return s !== b && s !== l ? { type: 'statut', mangaId, telephone: l, pc: s } : null;
        }
        if (!(mangaId in (base.progres || {}))) return null;
        const n = (v) => (v == null ? null : Number(v));
        const b = n(base.progres[mangaId]), s = n(pc.progres[mangaId]?.chapter), l = n(op.b?.chapter);
        return s !== b && s !== l ? { type: 'progression', mangaId, telephone: l, pc: s, pcAt: pc.progres[mangaId]?.updatedAt || null } : null;
    }
    function libelleValeur(c, cote) {
        const v = c[cote];
        if (c.type === 'statut') return v ? (STATUTS[v] || v) : 'sans statut';
        return v == null ? 'pas commencé' : `chapitre ${v}`;
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
        // L'état du PC, une fois, et seulement s'il y a de quoi comparer.
        const base = lireJson(CLE_BASE, null);
        let pc = null;
        if (base && boite.some(o => o.m === 'PUT' && /^\/me\/(library|progress)\//.test(o.c))) {
            const [biblio, progres] = await Promise.all([appel('GET', '/me/library').catch(() => null), appel('GET', '/me/progress').catch(() => null)]);
            if (biblio && progres) {
                pc = { statut: {}, progres };
                for (const b of (Array.isArray(biblio) ? biblio : biblio.items || [])) pc.statut[b.mangaId] = b.status ?? null;
            }
        }
        const conflits = lireJson(CLE_CONFLITS, []);
        while (boite.length) {
            const op = boite[0];
            const c = pc && conflitDe(op, base, pc);
            if (c) {
                const titre = (ML._etat().favorites || []).find(f => f.mangaId === c.mangaId)?.title || c.mangaId;
                const autres = conflits.filter(x => !(x.type === c.type && x.mangaId === c.mangaId));
                conflits.length = 0;
                conflits.push(...autres, { ...c, id: `${c.type}:${c.mangaId}`, titre, telephoneAt: op.b?.clientAt || Date.now(), op });
                ecrireJson(CLE_CONFLITS, conflits);
                boite.shift();
                ecrireJson(CLE_BOITE, boite);
                continue;
            }
            let chemin = op.c;
            for (const [loc, srv] of Object.entries(correspondances)) chemin = chemin.split(loc).join(String(srv));
            try {
                const r = await appel(op.m, chemin, op.b);
                const idServeur = r?.note?.id ?? r?.id ?? null;
                if (op.idLocal && idServeur != null) { correspondances[op.idLocal] = idServeur; ecrireJson('inko_sync_ids', correspondances); }
                envoyees++;
                noter('envoi', libelleDe(op));
            } catch (e) {
                if (e.reseau) { noter('interrompu', `Envoi interrompu, ${boite.length} en attente`, e.message); break; }   // le PC ne répond plus : on garde la suite
                // Refus applicatif (4xx) : l'opération ne passera jamais, on
                // la retire plutôt que de bloquer toute la file derrière elle.
                // Mais on le DIT : c'est une modification perdue pour le PC.
                noter('refus', libelleDe(op), e.message);
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
        // La base des prochaines comparaisons : ce que dit le PC, maintenant.
        const base = { statut: {}, progres: {} };
        if (biblio) for (const b of liste(biblio)) base.statut[b.mangaId] = b.status ?? null;
        for (const [m, p] of Object.entries(progres || {})) base.progres[m] = p?.chapter ?? null;
        ecrireJson(CLE_BASE, base);
        noter('rapatriement', `Reçu du PC : ${s.favorites.length} favori(s), ${Object.keys(s.progress).length} progression(s), ${s.notes.length} note(s)`);
        return true;
    }

    // ── Le cycle ───────────────────────────────────────────
    let enCours = null;
    async function synchroniser({ manuel = false } = {}) {
        if (enCours) return enCours;
        enCours = (async () => {
            if (!(await joignable())) {
                poserEtat({ erreur: window.INKO_HUB ? 'PC injoignable' : 'Aucun PC appairé' });
                if (window.INKO_HUB) noter('injoignable', 'PC injoignable');
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
                noter('echec', 'Synchronisation impossible', e.message);
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
            conflits: lireJson(CLE_CONFLITS, []).length,
            derniere: e.derniere,
            erreur: e.erreur,
        };
    }
    function annoncer() { window.dispatchEvent(new CustomEvent('inko:synchro-etat', { detail: resume() })); }

    /** Les conflits en attente, avec des libellés lisibles. */
    function conflits() {
        return lireJson(CLE_CONFLITS, []).map(c => ({
            id: c.id, type: c.type, titre: c.titre,
            telephone: libelleValeur(c, 'telephone'), telephoneAt: c.telephoneAt,
            pc: libelleValeur(c, 'pc'), pcAt: c.pcAt || null,
        }));
    }
    /** `garder` : 'telephone' (on renvoie, sans comparer) ou 'pc' (on oublie). */
    async function resoudre(id, garder) {
        const liste = lireJson(CLE_CONFLITS, []);
        const c = liste.find(x => x.id === id);
        if (!c) return false;
        ecrireJson(CLE_CONFLITS, liste.filter(x => x.id !== id));
        if (garder === 'telephone') {
            const op = { ...c.op, force: true, b: { ...c.op.b, ...(c.type === 'progression' ? { clientAt: new Date().toISOString() } : {}) } };
            ecrireJson(CLE_BOITE, [...lireJson(CLE_BOITE, []), op]);
        }
        annoncer();
        await synchroniser();
        return true;
    }

    window.INKO_SYNCHRO = { synchroniser: () => synchroniser({ manuel: true }), resume, conflits, resoudre, journal: () => lireJson(CLE_JOURNAL, []) };

    // Démarrage et rattrapages.
    if (window.INKO_HUB) {
        setTimeout(() => synchroniser(), 2500);
        setInterval(() => { if (document.visibilityState === 'visible') synchroniser(); }, 3 * 60 * 1000);
        window.addEventListener('online', () => planifier(1500));
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') planifier(1000); });
        window.INKO_NATIF?.surReseau?.((e) => { if (e.connecte) planifier(2000); });
    }
})();
