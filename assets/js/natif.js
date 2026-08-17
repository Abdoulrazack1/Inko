// ============================================================
// natif.js — la couche Android, et rien d'autre
// ------------------------------------------------------------
// Chargé UNIQUEMENT dans l'APK (injecté par `scripts-ci/build-mobile-www.js`),
// avant `hub.js`. Il expose `window.INKO_NATIF`, dont TOUTES les méthodes sont
// sûres à appeler sur le web : elles n'y font simplement rien.
//
// ── Pourquoi un adaptateur, et pas des appels directs ───────
//
// Les greffons Capacitor n'existent que dans l'APK. Les appeler directement
// depuis `chapitre.js` ou `downloads.js` obligerait chacun de ces fichiers à
// savoir s'il tourne dans une application ou dans un navigateur — vingt
// endroits à protéger, et le premier oubli casse le SITE, pas l'app. La
// détection se fait donc une seule fois, ici.
//
// Aucun `import` : le projet n'a pas d'empaqueteur, et n'en a pas besoin. Le
// pont Capacitor expose les greffons enregistrés sur `window.Capacitor.Plugins`
// dès l'injection de son runtime, avant tout script de page.
(function () {
    'use strict';

    const P = () => (window.Capacitor && window.Capacitor.Plugins) || {};
    const dansApp = !!(window.Capacitor && window.Capacitor.isNativePlatform
        && window.Capacitor.isNativePlatform());

    // Toute méthode peut échouer : un greffon absent, une permission refusée,
    // une version d'Android qui ne l'implémente pas. Aucune de ces situations
    // ne doit interrompre ce que l'utilisateur était en train de faire — la
    // couche native est un CONFORT, jamais un passage obligé.
    async function sûr(fn, defaut) {
        try { return await fn(); } catch (e) { window.MH?.err?.('natif.js', e); return defaut; }
    }

    const N = {
        dansApp,

        // ── Retour physique (P2.7 / IX.7) ───────────────────
        // Poser un écouteur DÉSACTIVE le comportement par défaut de Capacitor.
        // Il faut donc le réécrire en entier, et c'est justement l'occasion :
        // le défaut ne connaît ni nos surcouches ni les téléchargements en
        // cours.
        installerRetour() {
            const App = P().App;
            if (!App || !App.addListener) return false;
            App.addListener('backButton', async () => {
                // 1. Une surcouche ouverte ? On la ferme, et on ne quitte rien.
                //    `MH.retour` a poussé une entrée d'historique pour ça.
                if (window.MH?.retour?.taille?.()) { history.back(); return; }

                // 2. Un écran empilé ? On revient. `history.length > 1` suffit :
                //    chaque page d'Inko est un document, donc une entrée.
                if (window.history.length > 1 && !estAccueil()) { history.back(); return; }

                // 3. On est à la racine : quitter. Mais un téléchargement en
                //    cours meurt avec le processus, et l'utilisateur ne le sait
                //    pas — il a lancé dix chapitres pour le train et referme
                //    l'app en croyant qu'ils continuent.
                const enCours = await telechargementsEnCours();
                if (enCours) {
                    const ok = await (window.MH?.confirm
                        ? window.MH.confirm(
                            enCours + ' téléchargement(s) sont en cours. Quitter maintenant '
                            + 'les interrompra — ils reprendront à la prochaine ouverture, '
                            + 'mais rien ne se téléchargera d’ici là.',
                            { okText: 'Quitter quand même', cancelText: 'Rester', danger: true })
                        : Promise.resolve(true));
                    if (!ok) return;
                }
                sûr(() => P().App.exitApp());
            });
            return true;
        },

        // ── Lecteur (IX.8) ──────────────────────────────────
        // « Au repos : rien. » La barre d'état fait partie de ce rien : une
        // planche qui s'arrête 24 px sous le haut de l'écran n'est pas
        // immersive, et l'heure au-dessus d'une case de manga est du bruit.
        immersion(actif) {
            const SB = P().StatusBar;
            if (!SB) return Promise.resolve(false);
            return sûr(async () => {
                if (actif) await SB.hide();
                else await SB.show();
                return true;
            }, false);
        },

        /**
         * Verrouille l'orientation. IX.8 : en lecture, une rotation
         * involontaire — on se retourne dans son lit — recompose la planche et
         * fait perdre sa place. Le verrou est un RÉGLAGE, jamais un défaut :
         * la double page en paysage a aussi ses adeptes.
         * @param {'portrait'|'landscape'|null} mode  null = libère
         */
        orientation(mode) {
            const SO = P().ScreenOrientation;
            if (!SO) return Promise.resolve(false);
            return sûr(async () => {
                if (!mode) { await SO.unlock(); return true; }
                await SO.lock({ orientation: mode });
                return true;
            }, false);
        },

        async orientationActuelle() {
            const SO = P().ScreenOrientation;
            if (!SO) return (screen.orientation?.type || '').startsWith('landscape') ? 'landscape' : 'portrait';
            const r = await sûr(() => SO.orientation(), null);
            return r && /landscape/.test(r.type || '') ? 'landscape' : 'portrait';
        },

        // ── Retour haptique ─────────────────────────────────
        // `navigator.vibrate` marche dans le WebView, mais rend la MÊME
        // secousse pour un appui long et pour une erreur. Les motifs d'Android
        // sont calibrés et reconnaissables sans regarder l'écran.
        vibrer(genre) {
            const H = P().Haptics;
            if (!H) {
                try { navigator.vibrate?.(genre === 'lourd' ? 25 : 15); } catch (e) { /* refusée */ }
                return Promise.resolve(false);
            }
            return sûr(async () => {
                if (genre === 'succes') await H.notification({ type: 'SUCCESS' });
                else if (genre === 'erreur') await H.notification({ type: 'ERROR' });
                else await H.impact({ style: genre === 'lourd' ? 'HEAVY' : 'LIGHT' });
                return true;
            }, false);
        },

        // ── Réseau (VIII.44) ────────────────────────────────
        // « Le téléphone change de Wi-Fi (maison → travail) : détection,
        // bascule hors ligne, reprise au retour — sans intervention. »
        //
        // Sans ça, on quitte la maison et l'app continue d'appeler une adresse
        // locale qui ne désigne plus rien : trente secondes d'attente par page,
        // puis une erreur réseau qui n'explique rien.
        surReseau(rappel) {
            const Net = P().Network;
            if (!Net || !Net.addListener) {
                // Repli navigateur : moins fin — il ne distingue pas un
                // changement de réseau d'une simple reconnexion — mais il
                // couvre le cas qui compte, la perte de lien.
                window.addEventListener('online', () => rappel({ connecte: true, type: 'inconnu' }));
                window.addEventListener('offline', () => rappel({ connecte: false, type: 'aucun' }));
                return false;
            }
            Net.addListener('networkStatusChange', (s) => {
                rappel({ connecte: !!s.connected, type: s.connectionType || 'inconnu' });
            });
            return true;
        },

        async reseau() {
            const Net = P().Network;
            if (!Net) return { connecte: navigator.onLine !== false, type: 'inconnu' };
            const s = await sûr(() => Net.getStatus(), null);
            return s ? { connecte: !!s.connected, type: s.connectionType || 'inconnu' }
                     : { connecte: navigator.onLine !== false, type: 'inconnu' };
        },

        // ── Découverte du hub (P2.8) ────────────────────────
        // Un WebView ne peut faire ni multicast ni socket brute : la découverte
        // passe par `NsdManager`, qui est DANS le framework Android.
        //
        // Elle ne CHOISIT pas. Elle rapporte ce qu'elle a vu, avec l'identité
        // que chaque hub annonce — et c'est `hub.js` qui décide, en comparant à
        // celle mémorisée lors de l'appairage. Se connecter au premier service
        // trouvé reviendrait à faire confiance à n'importe quelle machine du
        // réseau, ce que l'audit signale explicitement comme dangereux.
        decouvrirHubs(dureeMs) {
            const D = P().InkoDecouverte;
            if (!D) return Promise.resolve({ hubs: [], raison: 'découverte indisponible' });
            return sûr(async () => {
                const r = await D.chercher({ dureeMs: dureeMs || 4000 });
                return { hubs: r.hubs || [], raison: r.raison || null };
            }, { hubs: [], raison: 'erreur de découverte' });
        },

        // ── Notifications (P2.5) ────────────────────────────
        // Le jeton FCM appartient à l'APPAREIL, pas au compte : le même
        // utilisateur sur deux téléphones en a deux, et révoquer un téléphone
        // perdu doit faire taire celui-là seulement.
        //
        // Rien n'est demandé au démarrage. Une demande d'autorisation sans
        // contexte se refuse d'un réflexe, et Android ne la repose plus : on
        // aurait perdu la fonction pour toujours, en échange de rien. Elle part
        // donc d'un geste explicite, depuis les réglages.
        async demanderNotifications() {
            const PN = P().PushNotifications;
            if (!PN) return { ok: false, raison: 'greffon absent' };
            return sûr(async () => {
                let p = await PN.checkPermissions();
                if (p.receive === 'prompt' || p.receive === 'prompt-with-rationale') {
                    p = await PN.requestPermissions();
                }
                if (p.receive !== 'granted') {
                    // VIII.47 : « Sans cette autorisation, {conséquence}. »
                    return { ok: false, raison: 'refusée',
                        consequence: 'tu ne seras pas prévenu des nouveaux chapitres ; '
                            + 'la vérification manuelle depuis la bibliothèque continue de marcher.' };
                }
                const jeton = await new Promise((resolve) => {
                    // Un seul des deux arrive. Sans le minuteur, une erreur
                    // silencieuse de FCM laisserait l'écran de réglages figé
                    // sur « activation… » indéfiniment.
                    const fini = setTimeout(() => resolve(null), 15000);
                    PN.addListener('registration', (t) => { clearTimeout(fini); resolve(t.value || null); });
                    PN.addListener('registrationError', () => { clearTimeout(fini); resolve(null); });
                    PN.register();
                });
                if (!jeton) return { ok: false, raison: 'Google n’a pas délivré de jeton' };

                // ── Le canal doit EXISTER, sinon rien ne s'affiche ──
                // Depuis Android 8, une notification dont le `channel_id` est
                // inconnu est REJETÉE par le système — silencieusement. Le hub
                // envoie sur `chapitres` ; si ce canal n'a pas été créé ici,
                // tout part et rien n'arrive, et le diagnostic est
                // désespérant : le serveur dit « envoyé », Firebase dit
                // « délivré », et l'écran ne montre rien.
                //
                // Un canal DÉDIÉ, et pas celui par défaut : l'utilisateur peut
                // ainsi couper les alertes de chapitres depuis les paramètres
                // d'Android sans faire taire Inko en entier.
                await PN.createChannel({
                    id: 'chapitres',
                    name: 'Nouveaux chapitres',
                    description: 'Quand une série que tu suis publie un chapitre.',
                    importance: 3,        // par défaut : visible, sans son intrusif
                    visibility: 1,        // titre visible sur l'écran verrouillé
                }).catch(() => { /* canal déjà présent, ou Android < 8 */ });

                installerOuvertureNotification();
                await window.API.devices.enregistrerJetonPush(jeton);
                return { ok: true };
            }, { ok: false, raison: 'erreur' });
        },

        // ── Fichiers durables (P2.3) ────────────────────────
        // Le Cache API est « best-effort » : sous pression mémoire, Android le
        // vide sans prévenir. `navigator.storage.persist()` demande le mode
        // persistant, mais il peut être REFUSÉ — et il l'a été à l'essai.
        //
        // Le stockage privé de l'application, lui, n'est jamais évincé par le
        // système. C'est la seule promesse tenable pour « je télécharge dix
        // chapitres pour le train » : le seul cas où l'échec ne se rattrape
        // pas, puisqu'il n'y a plus de réseau pour recommencer.
        fichiersDisponibles() { return !!P().Filesystem; },

        /**
         * Écrit une réponse HTTP dans le stockage privé.
         * @returns {Promise<string|null>} l'URI du fichier, ou null
         */
        async ecrireFichier(chemin, blob) {
            const F = P().Filesystem;
            if (!F) return null;
            return sûr(async () => {
                // Base64 : le pont Capacitor ne transporte pas de binaire. Le
                // surcoût est de 33 %, payé une fois à l'écriture — la lecture,
                // elle, passe par `convertFileSrc` et ne traverse pas le pont.
                const b64 = await enBase64(blob);
                await F.writeFile({
                    path: chemin, data: b64, directory: 'DATA', recursive: true,
                });
                const { uri } = await F.getUri({ path: chemin, directory: 'DATA' });
                return uri || null;
            }, null);
        },

        /**
         * Transforme un URI de fichier en URL que le WebView sait charger.
         * Sans cette conversion, `file://` est bloqué par l'origine du WebView.
         */
        srcFichier(uri) {
            if (!uri) return null;
            try { return window.Capacitor?.convertFileSrc?.(uri) || null; }
            catch (e) { return null; }
        },

        async supprimerDossier(chemin) {
            const F = P().Filesystem;
            if (!F) return false;
            return sûr(async () => {
                await F.rmdir({ path: chemin, directory: 'DATA', recursive: true });
                return true;
            }, false);
        },

        // ── Touches de volume (IX.8) ────────────────────────
        // Le seul moyen de tourner une page SANS regarder l'écran ni changer
        // de prise : dans les transports, une main sur la barre, ou couché
        // dans le noir.
        //
        // La page DÉCLARE son intention plutôt que d'être interrogée à chaque
        // appui : `dispatchKeyEvent` doit répondre tout de suite si
        // l'événement est consommé, et attendre une réponse asynchrone
        // reviendrait à laisser passer la touche — donc à afficher le curseur
        // de volume du système par-dessus la planche à chaque page.
        toucherVolume(actif) {
            const V = P().InkoVolume;
            if (!V) return Promise.resolve(false);
            return sûr(async () => { await V.setActif({ actif: !!actif }); return true; }, false);
        },

        // ── Identité de l'appareil ──────────────────────────
        // Le nom sert dans « Appareils connectés », côté PC, pour décider
        // lequel révoquer quand on en perd un. « Inko sur Linux armv8l » — ce
        // que rend `navigator.platform` — ne désigne rien : trois téléphones
        // de la maison porteraient le même nom.
        async nomAppareil() {
            const D = P().Device;
            if (!D) return null;
            const i = await sûr(() => D.getInfo(), null);
            if (!i) return null;
            const nom = [i.manufacturer, i.model].filter(Boolean).join(' ').trim();
            return nom || null;
        },
    };

    // Le pont Capacitor ne transporte que du texte : un binaire doit passer en
    // base64. `FileReader` plutôt que `btoa(String.fromCharCode(...))`, qui
    // dépasse la pile d'appels sur une planche de plusieurs centaines de
    // kilo-octets — un défaut qui n'apparaît QUE sur les grosses images, donc
    // jamais pendant les essais.
    function enBase64(blob) {
        return new Promise((resolve, reject) => {
            const fr = new FileReader();
            fr.onload = () => {
                const s = String(fr.result || '');
                const i = s.indexOf(',');
                resolve(i === -1 ? s : s.slice(i + 1));
            };
            fr.onerror = () => reject(fr.error || new Error('lecture impossible'));
            fr.readAsDataURL(blob);
        });
    }

    // Toucher une notification doit ouvrir CE chapitre, pas la page d'accueil.
    // Sans ça, on est prévenu qu'un chapitre est sorti, on touche, et on
    // atterrit sur l'accueil — d'où il faut retrouver la série à la main. La
    // notification perd alors la moitié de son intérêt.
    let _ouvertureInstallee = false;
    function installerOuvertureNotification() {
        if (_ouvertureInstallee) return;
        const PN = P().PushNotifications;
        if (!PN || !PN.addListener) return;
        _ouvertureInstallee = true;
        PN.addListener('pushNotificationActionPerformed', (action) => {
            const lien = action?.notification?.data?.link;
            if (!lien) return;
            // Le lien vient du hub, mais il transite par Google : on ne le
            // suit que s'il reste DANS l'application. Une URL absolue
            // ouvrirait un navigateur sur un site quelconque, avec la
            // notification d'Inko comme caution.
            // `//exemple.test/piege` passerait le motif ci-dessous — la barre
            // oblique fait partie de la classe. Ce n'est pas théorique : c'est
            // la forme d'URL protocole-relative, et elle est écrite exprès pour
            // ressembler à un chemin. Elle est écartée d'abord.
            if (/^\/\//.test(lien)) return;
            if (!/^\/[A-Za-z0-9_\-./?=&%]*$/.test(lien)) return;
            window.location.href = lien.replace(/^\//, '');
        });
    }

    function estAccueil() {
        const p = location.pathname.replace(/^.*\//, '');
        return !p || p === 'index.html' || p === 'accueil.html';
    }

    // Combien de téléchargements tournent ? `downloads.js` n'est pas présent
    // sur toutes les pages : son absence vaut « aucun ».
    async function telechargementsEnCours() {
        try {
            const d = window.Downloads;
            if (!d || !d._active) return 0;
            let n = 0;
            d._active.forEach(t => { if (t && t.state === 'running') n++; });
            return n;
        } catch (e) { return 0; }
    }

    window.INKO_NATIF = N;

    // Le retour physique s'installe tout de suite : c'est le seul greffon dont
    // l'absence se voit immédiatement, et l'installer plus tard laisserait une
    // fenêtre où le bouton retour quitte l'app depuis n'importe quel écran.
    if (dansApp) N.installerRetour();
})();
