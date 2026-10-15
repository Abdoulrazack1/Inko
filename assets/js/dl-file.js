// dl-file.js — La file de téléchargement, qui survit au changement de page
//
// Jusqu'ici, télécharger une plage de chapitres était une boucle `for` vivant
// DANS la page de la série (`telechargerPlage`). Trois conséquences, par ordre
// de gravité :
//
//   · quitter la page tuait la boucle EN SILENCE. On lançait vingt chapitres,
//     on allait en lire un — ce que l'application invite à faire — et au
//     retour il s'était arrêté à trois. Rien ne le disait. C'est le genre de
//     défaut qu'on met des semaines à attribuer à la bonne cause : on croit
//     que la source est lente, ou que l'appareil manque de place.
//   · rien ne montrait ce qui restait à faire. Un compteur sur un bouton,
//     « ↓ 3/10… », et c'est tout.
//   · rien ne permettait de réordonner. Sur une file de quarante chapitres,
//     celui qu'on veut lire ce soir peut être en trente-huitième position.
//
// La file est donc un ÉTAT PERSISTÉ, pas une boucle. N'importe quelle page qui
// charge ce module reprend le travail là où il en était.
//
// ── Pourquoi localStorage et pas IndexedDB ──
// La file est quelques centaines d'octets de métadonnées (les images, elles,
// sont déjà dans le Cache API). Il faut pouvoir la lire SYNCHRONIQUEMENT au
// chargement pour décider s'il y a lieu de reprendre, et `localStorage` donne
// en prime l'événement `storage`, qui prévient les autres onglets gratuitement.
//
// ── Pourquoi un seul chapitre à la fois ──
// Même raison que la boucle d'origine : paralléliser irait plus vite et
// assommerait le site scrapé, ce qui fait bannir une adresse IP.
(function () {
    'use strict';

    const CLE       = 'inko_dl_file_v1';
    const CLE_VERROU = 'inko_dl_verrou_v1';
    // Au-delà, le détenteur du verrou est considéré comme parti (onglet fermé,
    // ordinateur en veille). Large exprès : une page qui travaille rafraîchit
    // sa marque toutes les 5 s, donc 20 s de silence veut dire qu'elle n'est
    // plus là. Trop court et deux pages se marcheraient dessus ; trop long et
    // la file resterait gelée après une fermeture brutale.
    const PEREMPTION = 20000;
    const RAFRAICHIR = 5000;
    const ECHECS_MAX = 3;

    // Identifiant de CETTE page. Un onglet rechargé en reçoit un nouveau, et
    // c'est voulu : l'ancien verrou tombera en péremption tout seul.
    const moi = Math.random().toString(36).slice(2) + Date.now().toString(36);

    const abonnes = new Set();
    let enMarche = false;
    let battement = null;
    let enCoursInfo = null;    // { chapterId, fait, total }

    // ── Lecture et écriture de l'état ───────────────────────
    // Tout passe par try/catch : en navigation privée, ou avec le stockage
    // bloqué, `localStorage` lève à la lecture comme à l'écriture. Une file
    // qui ne se souvient pas reste une file utilisable pour la session en
    // cours ; une exception non rattrapée casserait la page entière.
    function lire() {
        try {
            const brut = localStorage.getItem(CLE);
            const o = brut ? JSON.parse(brut) : null;
            if (!o || !Array.isArray(o.items)) return { items: [], pause: false };
            return { items: o.items, pause: !!o.pause };
        } catch (e) { return { items: [], pause: false }; }
    }

    function ecrire(etat) {
        try { localStorage.setItem(CLE, JSON.stringify(etat)); } catch (e) { /* stockage plein ou refusé */ }
        prevenir();
    }

    function prevenir() {
        abonnes.forEach(cb => { try { cb(); } catch (e) { window.MH?.err?.('dl-file.js', e); } });
    }

    // ── Le verrou ───────────────────────────────────────────
    // Deux pages Inko ouvertes (l'app de bureau ET un onglet, le cas le plus
    // courant) feraient tourner deux fois la même file : le même chapitre
    // demandé deux fois à la source, c'est-à-dire exactement le comportement
    // qu'on évite en téléchargeant en série.
    //
    // Ce verrou est CONSULTATIF, et je ne prétends pas le contraire : deux
    // pages qui écrivent dans la même milliseconde peuvent toutes deux se
    // croire détentrices. La vraie protection est ailleurs — `Downloads.
    // download` saute les pages déjà présentes dans le cache, donc un doublon
    // coûte un aller-retour réseau, pas une corruption. Le verrou sert à ce
    // que ce cas reste rare, pas à le rendre impossible.
    function prendreVerrou() {
        try {
            const brut = localStorage.getItem(CLE_VERROU);
            const v = brut ? JSON.parse(brut) : null;
            if (v && v.id !== moi && Date.now() - (v.at || 0) < PEREMPTION) return false;
            localStorage.setItem(CLE_VERROU, JSON.stringify({ id: moi, at: Date.now() }));
            return true;
        } catch (e) { return true; }   // pas de stockage : pas de concurrence non plus
    }

    function relacherVerrou() {
        clearInterval(battement); battement = null;
        try {
            const brut = localStorage.getItem(CLE_VERROU);
            const v = brut ? JSON.parse(brut) : null;
            if (v && v.id === moi) localStorage.removeItem(CLE_VERROU);
        } catch (e) { /* rien à relâcher */ }
    }

    function tenirVerrou() {
        clearInterval(battement);
        battement = setInterval(() => {
            try { localStorage.setItem(CLE_VERROU, JSON.stringify({ id: moi, at: Date.now() })); }
            catch (e) { /* on perdra le verrou par péremption, sans dégât */ }
        }, RAFRAICHIR);
    }

    // ── Choix du prochain ───────────────────────────────────
    // On saute les entrées bloquées (trois échecs) au lieu de les retirer :
    // les retirer effacerait la trace de ce qui n'a pas marché, et c'est
    // précisément ce qu'on veut voir. Elles restent à leur place dans la
    // liste, avec leur message.
    function prochain(items) {
        return items.find(it => !it.bloque) || null;
    }

    async function traiter(item) {
        enCoursInfo = { chapterId: item.chapterId, fait: 0, total: 0 };
        prevenir();
        try {
            const d = await window.API.mangas.pages(item.chapterId);
            const pages = d.pages || [];
            if (!pages.length) throw new Error('aucune page renvoyée par la source');
            enCoursInfo.total = pages.length;
            await window.Downloads.download({
                mangaId: item.mangaId, chapterId: item.chapterId,
                chapterNum: item.chapterNum, mangaTitle: item.mangaTitle,
                cover: item.cover, source: item.source,
            }, pages, (fait, total) => {
                enCoursInfo = { chapterId: item.chapterId, fait, total };
                prevenir();
            });
            retirer(item.chapterId);
            return true;
        } catch (e) {
            // L'annulation n'est pas un échec : c'est une demande. On retire
            // l'entrée sans la compter contre la source.
            if (e && e.message === '__cancelled__') { retirer(item.chapterId); return true; }
            const etat = lire();
            const it = etat.items.find(x => x.chapterId === item.chapterId);
            if (it) {
                it.echecs = (it.echecs || 0) + 1;
                it.erreur = e?.message || String(e);
                // Après trois tentatives on arrête d'insister : une source
                // tombée ne guérira pas en vingt secondes, et une file qui
                // tourne à vide sur la même entrée empêche les suivantes.
                if (it.echecs >= ECHECS_MAX) it.bloque = true;
            }
            ecrire(etat);
            window.MH?.err?.('dl-file.js', e);
            return false;
        } finally {
            enCoursInfo = null;
            prevenir();
        }
    }

    async function tourner() {
        if (enMarche) return;
        if (!window.Downloads || !window.API?.mangas?.pages) return;
        enMarche = true;
        try {
            for (;;) {
                const etat = lire();
                if (etat.pause) break;
                const item = prochain(etat.items);
                if (!item) break;
                if (!prendreVerrou()) break;       // une autre page s'en charge
                tenirVerrou();
                await traiter(item);
            }
        } finally {
            enMarche = false;
            relacherVerrou();
        }
    }

    // ── API publique ────────────────────────────────────────

    function retirer(chapterId) {
        const etat = lire();
        const avant = etat.items.length;
        etat.items = etat.items.filter(it => it.chapterId !== chapterId);
        if (etat.items.length !== avant) ecrire(etat);
    }

    const DlFile = {
        liste() { return lire().items; },
        enPause() { return lire().pause; },
        enCours() { return enCoursInfo; },

        /**
         * Ajoute des chapitres, en ignorant ceux déjà en file.
         * Rend le nombre réellement ajouté — l'appelant a besoin de le dire :
         * « 10 ajoutés » et « 0 ajoutés, ils y étaient déjà » sont deux
         * réponses différentes à la même action.
         */
        ajouter(items) {
            const etat = lire();
            const connus = new Set(etat.items.map(it => it.chapterId));
            let n = 0;
            (items || []).forEach(it => {
                if (!it || !it.chapterId || connus.has(it.chapterId)) return;
                connus.add(it.chapterId);
                etat.items.push({
                    chapterId: it.chapterId, mangaId: it.mangaId,
                    chapterNum: it.chapterNum ?? null, mangaTitle: it.mangaTitle || '',
                    cover: it.cover || '', source: it.source || '',
                    ajoute: Date.now(), echecs: 0,
                });
                n++;
            });
            if (n) { ecrire(etat); tourner(); }
            return n;
        },

        retirer,

        /** Monte (-1) ou descend (+1) une entrée d'un cran. */
        deplacer(chapterId, delta) {
            const etat = lire();
            const i = etat.items.findIndex(it => it.chapterId === chapterId);
            const j = i + delta;
            if (i < 0 || j < 0 || j >= etat.items.length) return false;
            const [it] = etat.items.splice(i, 1);
            etat.items.splice(j, 0, it);
            ecrire(etat);
            return true;
        },

        /** Remet une entrée bloquée en jeu, avec son compteur à zéro. */
        relancer(chapterId) {
            const etat = lire();
            const it = etat.items.find(x => x.chapterId === chapterId);
            if (!it) return false;
            it.echecs = 0; it.bloque = false; delete it.erreur;
            ecrire(etat);
            tourner();
            return true;
        },

        vider() { ecrire({ items: [], pause: lire().pause }); },

        basculerPause() {
            const etat = lire();
            etat.pause = !etat.pause;
            ecrire(etat);
            // La pause ne coupe pas le chapitre EN COURS : l'abandonner
            // jetterait les pages déjà prises. Elle s'applique au suivant.
            if (!etat.pause) tourner();
            return etat.pause;
        },

        /** @returns {Function} de quoi se désabonner. */
        surChangement(cb) {
            abonnes.add(cb);
            return () => abonnes.delete(cb);
        },
    };

    window.DlFile = DlFile;

    // Un autre onglet a touché la file : on se redessine, et on tente de
    // reprendre — c'est ainsi que la file repart toute seule quand l'onglet
    // qui la tenait se ferme.
    window.addEventListener('storage', (e) => {
        if (e.key !== CLE && e.key !== CLE_VERROU) return;
        prevenir();
        tourner();
    });

    // Relâcher le verrou en partant évite d'attendre la péremption : la page
    // suivante reprend tout de suite au lieu de rester vingt secondes muette.
    window.addEventListener('pagehide', relacherVerrou);

    // Reprise au chargement. C'est tout l'intérêt du module : la file ne
    // dépend plus de la page qui l'a remplie.
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => tourner());
    } else {
        tourner();
    }
})();
