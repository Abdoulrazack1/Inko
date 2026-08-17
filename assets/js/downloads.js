// ============================================================
// downloads.js — Téléchargement hors-ligne des chapitres
// ============================================================
// Métadonnées dans IndexedDB ('inko-dl' > 'chapters'),
// images dans le Cache API ('inko-offline'). Le service-worker
// sert ces images depuis le cache (online comme offline).
// Expose window.Downloads.
// ============================================================
(function () {
    'use strict';

    const DB_NAME = 'inko-dl';
    const STORE = 'chapters';
    const CACHE = 'inko-offline';

    function openDB() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, 1);
            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains(STORE)) {
                    const os = db.createObjectStore(STORE, { keyPath: 'chapterId' });
                    os.createIndex('mangaId', 'mangaId', { unique: false });
                }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    function tx(db, mode) { return db.transaction(STORE, mode).objectStore(STORE); }
    function reqP(r) { return new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }

    async function getMeta(chapterId) {
        const db = await openDB();
        return reqP(tx(db, 'readonly').get(chapterId));
    }
    async function putMeta(meta) {
        const db = await openDB();
        return reqP(tx(db, 'readwrite').put(meta));
    }
    async function delMeta(chapterId) {
        const db = await openDB();
        return reqP(tx(db, 'readwrite').delete(chapterId));
    }
    async function allMeta() {
        const db = await openDB();
        return reqP(tx(db, 'readonly').getAll());
    }

    // Un dossier par chapitre : supprimer un téléchargement redevient une
    // seule opération, au lieu d'énumérer des centaines de fichiers dont les
    // noms devraient être devinés à partir d'URL qu'on n'a plus.
    // L'identifiant est assaini : il vient d'une source distante, et il finit
    // dans un CHEMIN DE FICHIER — un `../` y serait une écriture hors du bac
    // à sable de l'application.
    function dossierChapitre(chapterId) {
        return 'chapitres/' + String(chapterId).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 120);
    }

    // L'extension ne sert qu'au diagnostic (ouvrir le dossier et reconnaître
    // les fichiers) : le WebView décide du type au contenu, pas au nom.
    function extensionDe(url) {
        const m = /\.(jpe?g|png|webp|gif|avif)(?:$|[?#])/i.exec(String(url || ''));
        return m ? '.' + m[1].toLowerCase() : '.img';
    }

    const Downloads = {
        async has(chapterId) {
            try { return !!(await getMeta(chapterId)); } catch (e) { return false; }
        },

        // État des téléchargements en cours (audit B-4 + pause/reprise).
        // Machine à états par chapitre : 'running' | 'paused' | 'cancelled'.
        _active: new Map(),      // chapterId -> { state }
        isDownloading(chapterId) { return this._active.has(chapterId); },
        state(chapterId) { return this._active.get(chapterId)?.state || null; },
        cancel(chapterId) { const t = this._active.get(chapterId); if (t) { t.state = 'cancelled'; return true; } return false; },
        pause(chapterId)  { const t = this._active.get(chapterId); if (t && t.state === 'running') { t.state = 'paused'; return true; } return false; },
        resume(chapterId) { const t = this._active.get(chapterId); if (t && t.state === 'paused') { t.state = 'running'; return true; } return false; },

        // info : { mangaId, chapterId, chapterNum, mangaTitle, cover, source }
        // pages : [{ url, urlSaver }]  (déjà résolues)
        // Reprend là où un précédent essai s'était arrêté : les pages déjà en
        // cache sont sautées (permet la reprise après pause ET la relance d'un
        // téléchargement incomplet sans re-télécharger ce qui existe).
        async download(info, pages, onProgress) {
            if (!('caches' in window)) throw new Error('Cache API indisponible');
            // Audit M5 : garde-fou de stockage — sur téléphone surtout, aucun
            // avertissement n'existait avant de saturer l'appareil.
            try {
                const st = await this.storage();
                if (st.quota && st.usage / st.quota > 0.9) {
                    window.MH?.toast?.(`Stockage presque plein (${Math.round(st.usage / 1048576)} Mo utilisés) — supprime d'anciens téléchargements.`);
                    throw new Error('Stockage de l\'appareil presque plein');
                }
                if (st.quota && st.usage / st.quota > 0.75) {
                    window.MH?.toast?.('Attention : le stockage de l\'appareil se remplit.');
                }
            } catch (e) {
                if (/presque plein/.test(e.message)) throw e;
                window.MH?.err?.('downloads.js', e);   // estimate() indisponible : on continue
            }
            // Demandée ICI, au premier téléchargement, et pas au chargement de
            // la page : une demande de persistance sans contexte est plus
            // volontiers refusée, et l'utilisateur n'a aucune raison de la voir
            // avant d'avoir voulu garder quelque chose.
            const persistant = await this.demanderPersistance();
            if (!persistant) {
                // On ne bloque PAS : un téléchargement non persistant reste
                // utile aujourd'hui. Mais on le dit — promettre du hors-ligne
                // que le système peut effacer sans prévenir serait mentir.
                window.MH?.toast?.('Téléchargement lancé — le système pourra l’effacer s’il manque de place.');
            }

            const cache = await caches.open(CACHE);
            const urls = pages.map(p => p.url).filter(Boolean);
            const sleep = ms => new Promise(r => setTimeout(r, ms));
            const token = { state: 'running' };
            this._active.set(info.chapterId, token);
            // Nettoie les pages mises en cache si on ANNULE (pas si on met en pause).
            const cleanupPartial = async (cachedUrls) => {
                await Promise.all(cachedUrls.map(u => cache.delete(u).catch(() => {})));
            };
            // Bloque tant que l'état est 'paused' ; retourne false si annulé pendant la pause.
            async function waitIfPaused() {
                while (token.state === 'paused') await sleep(250);
                return token.state !== 'cancelled';
            }

            // Récupère une page avec un STATUT LISIBLE (audit — un 403/404 ne doit plus
            // être compté comme « téléchargé »). L'ancien fetch no-cors renvoyait une
            // réponse opaque (status 0, ok=false illisible) : impossible de savoir si la
            // page avait vraiment été récupérée. On tente d'abord un fetch CORS direct
            // (statut lisible + réponse non-opaque, meilleure pour l'offline) ; si le CDN
            // bloque CORS, on retombe sur le proxy serveur same-origin (statut lisible lui
            // aussi). null = échec réel détecté.
            const base = (window.API && API.base) || '';
            async function fetchPage(url) {
                try {
                    const r = await fetch(url, { mode: 'cors' });
                    if (r.ok) return r;                     // statut HTTP OK et lisible
                    if (r.status >= 400) return null;       // 403/404… échec confirmé
                } catch (e) { /* CORS bloqué → repli proxy */ }
                if (base) {
                    try {
                        const pr = await fetch(base + '/img?u=' + encodeURIComponent(url));
                        if (pr.ok) return pr;
                    } catch (e) { /* échec réseau */ }
                }
                return null;
            }

            let done = 0, failed = 0;
            const cached = [];
            // La copie de sûreté n'existe QUE quand elle sert.
            //
            // Doubler le stockage d'un lecteur de manga n'est pas anodin : on
            // parle de gigaoctets. Or si la persistance a été ACCORDÉE, le
            // Cache API n'est plus évinçable — il n'y a rien contre quoi se
            // prémunir, et la copie ne ferait que remplir l'appareil deux fois
            // plus vite, ce qui provoquerait exactement le manque de place
            // qu'elle prétend couvrir.
            //
            // Elle se déclenche donc sur le cas RÉEL : dans l'APK, et seulement
            // quand la persistance a été refusée.
            const fichiersActifs = !persistant
                && !!(window.INKO_NATIF && window.INKO_NATIF.fichiersDisponibles());
            const fichiers = [];
            try {
                for (const url of urls) {
                    // Pause : on attend ici sans consommer de réseau ; annulation possible pendant la pause.
                    if (!(await waitIfPaused())) { await cleanupPartial(cached); throw new Error('__cancelled__'); }
                    if (token.state === 'cancelled') { await cleanupPartial(cached); throw new Error('__cancelled__'); }
                    // Page déjà présente (reprise / relance) : on la compte sans re-télécharger.
                    if (await cache.match(url)) { cached.push(url); done++; if (onProgress) onProgress(done, urls.length); continue; }
                    let resp = null;
                    for (let attempt = 0; attempt < 2 && !resp; attempt++) {
                        resp = await fetchPage(url);
                        if (!resp && attempt === 0) await sleep(300);
                    }
                    if (resp) {
                        try {
                            // P2.3 : DEUX destinations, et ce n'est pas de la
                            // redondance gratuite.
                            //
                            // Le Cache API sert la lecture : le service worker
                            // l'interroge de façon transparente, la planche
                            // garde son URL d'origine, et rien d'autre dans
                            // l'application n'a besoin de savoir qu'elle est
                            // hors ligne.
                            //
                            // Mais il est « best-effort » : Android le vide sous
                            // pression mémoire, sans prévenir. La persistance
                            // demandée en P2.3 peut être REFUSÉE — elle l'a été
                            // à l'essai. Le stockage privé de l'application,
                            // lui, n'est jamais évincé par le système.
                            //
                            // Le fichier est donc la copie de SÛRETÉ, celle qui
                            // permet de réparer un cache évincé sans réseau —
                            // c'est-à-dire dans la seule situation où
                            // l'utilisateur ne peut rien faire d'autre.
                            const clone = fichiersActifs ? resp.clone() : null;
                            await cache.put(url, resp);
                            cached.push(url);
                            if (clone) {
                                const uri = await window.INKO_NATIF.ecrireFichier(
                                    dossierChapitre(info.chapterId) + '/' + fichiers.length + extensionDe(url),
                                    await clone.blob());
                                fichiers.push(uri || null);
                            }
                        } catch (e) { failed++; }
                    }
                    else failed++;
                    done++;
                    if (onProgress) onProgress(done, urls.length);
                    await sleep(60);   // ménage le CDN (évite le rate-limit)
                }

                const okCount = urls.length - failed;
                // Rien n'a pu être récupéré → vrai échec, on ne prétend pas avoir téléchargé.
                if (urls.length && okCount === 0) throw new Error('Aucune page n\'a pu être téléchargée');

                await putMeta({
                    chapterId: info.chapterId, mangaId: info.mangaId,
                    chapterNum: info.chapterNum ?? null, mangaTitle: info.mangaTitle || '',
                    cover: info.cover || '', source: info.source || '',
                    pages: urls, count: urls.length, savedAt: Date.now(),
                    incomplete: failed > 0, failed,
                    // Parallèle à `pages`, index par index. Absent hors de
                    // l'APK, et c'est ce qui rend la lecture sûre : un `null`
                    // ou un tableau vide fait simplement retomber sur l'URL.
                    fichiers: fichiersActifs ? fichiers : undefined,
                });
                return { count: urls.length, failed };
            } finally {
                this._active.delete(info.chapterId);
            }
        },

        // Téléchargement d'un chapitre de ROMAN (texte) — stocké dans IndexedDB.
        // info : { mangaId, chapterId, chapterNum, chapterTitle, mangaTitle, cover, source }
        async downloadText(info, content) {
            await putMeta({
                chapterId: info.chapterId, mangaId: info.mangaId,
                chapterNum: info.chapterNum ?? null, chapterTitle: info.chapterTitle || '',
                mangaTitle: info.mangaTitle || '', cover: info.cover || '',
                source: info.source || '', kind: 'novel',
                text: content || '', pages: [], count: 1, savedAt: Date.now(),
            });
            return { ok: true };
        },

        /**
         * L'adresse à donner à une balise <img> pour une planche hors ligne.
         *
         * Le fichier PASSE AVANT le cache, et pas l'inverse : il est le seul
         * dont on soit certain qu'il existe encore. Le Cache API, s'il est
         * intact, aurait servi la même image — mais s'il a été évincé, la
         * requête part sur le réseau, qui est justement absent.
         *
         * @param {object} meta  métadonnées du chapitre (Downloads.get)
         * @param {number} i     index de la planche
         */
        srcPage(meta, i) {
            const url = meta && meta.pages && meta.pages[i];
            const uri = meta && meta.fichiers && meta.fichiers[i];
            if (uri && window.INKO_NATIF) {
                const src = window.INKO_NATIF.srcFichier(uri);
                if (src) return src;
            }
            return url || null;
        },

        async remove(chapterId) {
            const meta = await getMeta(chapterId);
            if (meta && 'caches' in window) {
                const cache = await caches.open(CACHE);
                await Promise.all((meta.pages || []).map(u => cache.delete(u).catch(() => {})));
            }
            // Et la copie de sûreté. L'oublier serait le pire des deux mondes :
            // « supprimé » à l'écran, l'espace toujours occupé sur l'appareil,
            // et rien pour le retrouver — les métadonnées qui portaient les
            // chemins viennent de disparaître.
            if (meta && meta.fichiers && window.INKO_NATIF) {
                await window.INKO_NATIF.supprimerDossier(dossierChapitre(chapterId));
            }
            await delMeta(chapterId);
        },

        async get(chapterId) { return getMeta(chapterId); },
        async list() { return (await allMeta()).sort((a, b) => b.savedAt - a.savedAt); },

        // Liste groupée par manga
        async byManga() {
            const all = await this.list();
            const groups = {};
            all.forEach(c => {
                groups[c.mangaId] = groups[c.mangaId] || { mangaId: c.mangaId, title: c.mangaTitle, cover: c.cover, source: c.source, chapters: [] };
                groups[c.mangaId].chapters.push(c);
            });
            return Object.values(groups);
        },

        async removeManga(mangaId) {
            const all = await this.list();
            await Promise.all(all.filter(c => c.mangaId === mangaId).map(c => this.remove(c.chapterId)));
        },

        async storage() {
            try {
                if (navigator.storage?.estimate) {
                    const e = await navigator.storage.estimate();
                    return {
                        usage: e.usage || 0,
                        quota: e.quota || 0,
                        persistant: await this.estPersistant(),
                    };
                }
            } catch (e) { window.MH?.err?.('downloads.js', e); }
            return { usage: 0, quota: 0, persistant: false };
        },

        // ── P2.3 : sans ça, Android peut TOUT effacer ───────────
        // Le stockage d'un WebView est « best-effort » par défaut : sous
        // pression mémoire, le système est libre de le vider — sans prévenir,
        // et sans que l'application puisse s'y opposer.
        //
        // Concrètement : on télécharge dix chapitres pour le train, le
        // téléphone se remplit d'autre chose entre-temps, et le matin du
        // départ il ne reste rien. C'est exactement le scénario pour lequel on
        // télécharge, et le seul où l'échec ne se rattrape pas — il n'y a plus
        // de réseau pour recommencer.
        //
        // `persist()` demande le mode PERSISTANT : les données ne sont alors
        // effacées que par l'utilisateur lui-même. La demande peut être
        // refusée (le navigateur décide, souvent selon l'engagement de
        // l'utilisateur : app installée, visites répétées) — d'où
        // `estPersistant()`, qui dit l'état RÉEL plutôt que ce qu'on espérait.
        async demanderPersistance() {
            try {
                if (!navigator.storage?.persist) return false;
                if (await navigator.storage.persisted()) return true;
                return await navigator.storage.persist();
            } catch (e) { window.MH?.err?.('downloads.js', e); return false; }
        },

        async estPersistant() {
            try { return !!(navigator.storage?.persisted && await navigator.storage.persisted()); }
            catch (e) { return false; }
        },

        async count() { try { return (await allMeta()).length; } catch (e) { return 0; } },

        // ── Poids reel par serie (audit AMEL-78) ─────────────
        // `navigator.storage.estimate()` ne donne qu'un TOTAL : on savait que
        // 6 Mo etaient pris, jamais PAR QUOI. Sans cette repartition, « liberer
        // de la place » revient a supprimer au hasard.
        //
        // La taille se mesure sur les reponses reellement en cache : le nombre
        // de pages ne dit rien du poids (une planche couleur pese dix fois une
        // page de texte). On lit `content-length` quand il est la, sinon on
        // mesure le blob. Borne a 24 chapitres par serie : au-dela l'estimation
        // est deja bonne et lire 500 blobs figerait l'onglet.
        async sizeByManga() {
            if (!('caches' in window)) return [];
            const cache = await caches.open(CACHE);
            const groups = await this.byManga();
            const out = [];
            for (const g of groups) {
                let octets = 0, mesures = 0;
                const echantillon = g.chapters.slice(0, 24);
                for (const c of echantillon) {
                    for (const url of (c.pages || [])) {
                        try {
                            const r = await cache.match(url);
                            if (!r) continue;
                            const cl = parseInt(r.headers.get('content-length') || '', 10);
                            octets += Number.isFinite(cl) && cl > 0 ? cl : (await r.clone().blob()).size;
                            mesures++;
                        } catch (e) { /* entree illisible : ignoree */ }
                    }
                }
                // Extrapolation quand on n'a mesure qu'une partie des chapitres :
                // annoncer le poids de l'echantillon serait faux, et sous-estimer
                // fait supprimer la mauvaise serie.
                const facteur = echantillon.length ? g.chapters.length / echantillon.length : 1;
                out.push({
                    mangaId: g.mangaId, title: g.title, cover: g.cover, source: g.source,
                    chapters: g.chapters.length,
                    bytes: Math.round(octets * facteur),
                    estimated: facteur > 1,
                    measured: mesures,
                });
            }
            return out.sort((a, b) => b.bytes - a.bytes);
        },
    };

    window.Downloads = Downloads;
})();
