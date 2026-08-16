// ============================================================
// hero3d.js — Couche 3D du hero de l'accueil (three.js, local)
// ------------------------------------------------------------
// Scène « encre & papier » : particules de trame (screentone) qui
// dérivent en profondeur + feuilles translucides flottantes, avec
// parallaxe à la souris. Équivalent vanilla de React Three Fiber
// (R3F = un rendu React au-dessus de three.js ; l'app n'ayant ni
// React ni bundler, on utilise three.js directement, en local —
// même moteur, même résultat, compatible CSP/offline).
//
// Sobriété technique : pause quand l'onglet est caché, respect de
// prefers-reduced-motion (une seule frame statique), dispose complet.
// ============================================================
(function () {
    'use strict';

    // ── Audit PERF-06 : chargement conditionnel de three.js ──────
    // three.min.js (594 Ko) était chargé par un <script> en dur dans
    // accueil.html : tout le monde le téléchargeait et le parsait sur le
    // chemin critique de la page d'entrée — y compris ceux qui n'en verront
    // jamais le rendu (pas de WebGL, mouvement réduit, ou simplement pas de
    // hero sur la page). C'est la plus grosse dépendance du projet, pour un
    // effet décoratif.
    // On ne la charge donc QUE si elle va réellement servir, et seulement une
    // fois la page interactive.
    function shouldLoad() {
        if (!document.getElementById('hero')) return false;
        // Mouvement réduit : la scène se limitait à une frame statique — 594 Ko
        // pour une image fixe n'a pas de sens, le dégradé CSS suffit.
        if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;

        // ── IX.14 : le hero 3D ne part pas sur un téléphone ──
        // 594 Ko de moteur, une scène WebGL et une boucle d'animation, pour un
        // ORNEMENT. Sur un téléphone, ça se paie trois fois : au téléchargement,
        // en mémoire — le budget d'un WebView d'entrée de gamme est déjà tendu
        // par les planches — et en batterie, sur l'écran où l'on passe le plus
        // de temps.
        //
        // Le critère est le POINTEUR, pas la largeur : une fenêtre de bureau
        // réduite reste un bureau, avec sa mémoire et son secteur. Un doigt
        // signale un appareil sur batterie.
        if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return false;

        // Peu de mémoire : même raisonnement, sans attendre le geste.
        if (navigator.deviceMemory && navigator.deviceMemory <= 4) return false;

        // Économiseur de données / connexion lente
        const c = navigator.connection;
        if (c && (c.saveData || /(^|-)2g$/.test(c.effectiveType || ''))) return false;
        try {
            const cv = document.createElement('canvas');
            return !!(cv.getContext('webgl2') || cv.getContext('webgl'));
        } catch (e) { return false; }
    }

    function loadThree() {
        if (window.THREE) return Promise.resolve(true);
        return new Promise((resolve) => {
            const s = document.createElement('script');
            s.src = 'assets/vendor/three.min.js';
            s.async = true;
            s.onload  = () => resolve(true);
            s.onerror = () => resolve(false);   // pas de 3D : le hero reste en CSS
            document.head.appendChild(s);
        });
    }

    function init() {
        const hero = document.getElementById('hero');
        if (!hero || !window.THREE) return;
        // WebGL disponible ?
        try {
            const c = document.createElement('canvas');
            if (!(c.getContext('webgl2') || c.getContext('webgl'))) return;
        } catch (e) { return; }

        const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        const canvas = document.createElement('canvas');
        canvas.id = 'hero3d';
        canvas.style.cssText = 'position:absolute;inset:0;z-index:3;pointer-events:none;width:100%;height:100%';
        const content = document.getElementById('heroContent');
        hero.insertBefore(canvas, content);

        const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

        const scene = new THREE.Scene();
        scene.fog = new THREE.FogExp2(0x000000, 0.055);
        const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 60);
        camera.position.z = 10;

        // ── Sprite disque NET (trame de points, pas de halo flou) ──
        function dotTexture() {
            const s = 64, cv = document.createElement('canvas');
            cv.width = cv.height = s;
            const ctx = cv.getContext('2d');
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.arc(s / 2, s / 2, s * 0.42, 0, Math.PI * 2); ctx.fill();
            const t = new THREE.CanvasTexture(cv);
            t.minFilter = THREE.LinearFilter;
            return t;
        }

        // ── Particules d'encre : 3 nuages (Kakishibu / Ai / papier) ──
        const CLOUDS = [
            { color: 0xc1531b, count: 130, size: 0.16, opacity: 0.55 },   // Kakishibu (manga)
            { color: 0x3d5170, count: 110, size: 0.15, opacity: 0.50 },   // Ai (roman)
            { color: 0xe9e7e0, count: 150, size: 0.10, opacity: 0.35 },   // papier
        ];
        const sprite = dotTexture();
        const clouds = CLOUDS.map(cfg => {
            const geo = new THREE.BufferGeometry();
            const pos = new Float32Array(cfg.count * 3);
            const speed = new Float32Array(cfg.count);
            for (let i = 0; i < cfg.count; i++) {
                pos[i * 3]     = (Math.random() - 0.5) * 26;   // x
                pos[i * 3 + 1] = (Math.random() - 0.5) * 12;   // y
                pos[i * 3 + 2] = -Math.random() * 18;          // z (profondeur)
                speed[i] = 0.10 + Math.random() * 0.35;
            }
            geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
            const mat = new THREE.PointsMaterial({
                color: cfg.color, size: cfg.size, map: sprite,
                transparent: true, opacity: cfg.opacity,
                depthWrite: false, sizeAttenuation: true,
            });
            const pts = new THREE.Points(geo, mat);
            pts.userData.speed = speed;
            scene.add(pts);
            return pts;
        });

        // ── Feuilles de papier translucides, en dérive lente ──
        const pages = [];
        const pageGeo = new THREE.PlaneGeometry(2.6, 3.6);
        for (let i = 0; i < 4; i++) {
            const mat = new THREE.MeshBasicMaterial({
                color: i % 2 ? 0xe9e7e0 : 0xc1531b,
                transparent: true, opacity: i % 2 ? 0.05 : 0.04,
                side: THREE.DoubleSide, depthWrite: false,
            });
            const mesh = new THREE.Mesh(pageGeo, mat);
            mesh.position.set((Math.random() - 0.5) * 16, (Math.random() - 0.5) * 7, -3 - Math.random() * 10);
            mesh.rotation.set(Math.random() * 0.6 - 0.3, Math.random() * 0.9 - 0.45, Math.random() * 0.5 - 0.25);
            mesh.userData.spin = (Math.random() - 0.5) * 0.0016;
            mesh.userData.bob = Math.random() * Math.PI * 2;
            scene.add(mesh);
            pages.push(mesh);
        }

        // ── Parallaxe souris (léger, jamais brusque) ──
        let targetX = 0, targetY = 0;
        function onMove(e) {
            const r = hero.getBoundingClientRect();
            targetX = ((e.clientX - r.left) / r.width - 0.5) * 1.2;
            targetY = ((e.clientY - r.top) / r.height - 0.5) * 0.7;
        }
        if (!reduced) hero.addEventListener('mousemove', onMove, { passive: true });

        function resize() {
            const w = hero.clientWidth || 1, h = hero.clientHeight || 1;
            renderer.setSize(w, h, false);
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
        }
        resize();
        window.addEventListener('resize', resize);

        let raf = 0, running = true, t = 0;
        function frame() {
            t += 0.016;
            // dérive verticale des points (remontent comme des bulles d'encre)
            clouds.forEach((pts, ci) => {
                const pos = pts.geometry.attributes.position;
                const speed = pts.userData.speed;
                for (let i = 0; i < speed.length; i++) {
                    let y = pos.getY(i) + speed[i] * 0.008;
                    if (y > 6.5) y = -6.5;
                    pos.setY(i, y);
                }
                pos.needsUpdate = true;
                pts.rotation.y = t * 0.008 * (ci + 1);
            });
            pages.forEach(p => {
                p.rotation.y += p.userData.spin;
                p.position.y += Math.sin(t * 0.4 + p.userData.bob) * 0.0012;
            });
            camera.position.x += (targetX - camera.position.x) * 0.04;
            camera.position.y += (-targetY - camera.position.y) * 0.04;
            camera.lookAt(0, 0, -4);
            renderer.render(scene, camera);
            if (running && !reduced) raf = requestAnimationFrame(frame);
        }
        frame();   // reduced-motion : une seule frame statique, pas d'animation

        document.addEventListener('visibilitychange', () => {
            if (reduced) return;
            if (document.hidden) { running = false; cancelAnimationFrame(raf); }
            else if (!running) { running = true; frame(); }
        });
        window.addEventListener('beforeunload', () => {
            running = false; cancelAnimationFrame(raf);
            renderer.dispose();
            scene.traverse(o => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
        });
    }

    // Audit PERF-06 : three.js n'est téléchargé qu'après le premier rendu, et
    // seulement si la scène va réellement s'afficher. `requestIdleCallback`
    // laisse passer le contenu utile de l'accueil (reprise, sections) avant de
    // dépenser 594 Ko sur un décor.
    function boot() {
        if (!shouldLoad()) return;
        const start = () => loadThree().then(ok => { if (ok) init(); });
        if (window.requestIdleCallback) window.requestIdleCallback(start, { timeout: 2500 });
        else setTimeout(start, 800);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
