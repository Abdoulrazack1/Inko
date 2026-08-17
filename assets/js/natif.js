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
