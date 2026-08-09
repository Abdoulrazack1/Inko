// stats.js — Page statistiques de lecture
(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', async () => {
        MH.initPage('stats');
        const body = document.getElementById('stBody');
        await (window.API?.ready || Promise.resolve());
        if (!API.isLoggedIn()) {
            // Audit N1 : message honnête (non connecté ≠ serveur en panne)
            body.innerHTML = `<div class="st-empty">${MH.guestNotice()}</div>`;
            return;
        }
        try {
            await window.UserData?.ready?.();
            // `events` est plafonne a 120 : suffisant pour l'activite recente,
            // pas pour un classement annuel. `readChapters` porte la date de
            // chaque chapitre lu, sans plafond — c'est la seule source juste.
            const [stats, events, favs, lus, prog] = await Promise.all([
                API.me.stats(), API.me.events(120),
                API.me.favorites().catch(() => []),
                API.me.readChapters().catch(() => ({})),
                API.me.progress().catch(() => ({})),
            ]);
            render(body, stats, events, favs, lus, prog);
        } catch (e) {
            body.innerHTML = `<div class="st-empty" style="color:#ef4444">Erreur : ${MH.esc(e.message)}</div>`;
        }
    });

    function render(body, stats, events, favs, lus, prog) {
        const t = stats.totals || {};
        const streak = stats.streak || { current: 0, longest: 0 };
        const cards = [
            ['accent', t.chapters_read || 0, 'Chapitres lus'],
            // Audit BUG-16 : « Séries lues » (au moins un chapitre lu) et les
            // « SÉRIES SUIVIES » du profil (statut de suivi) sont deux mesures
            // différentes qui portaient le même mot — 13 ici, 5 là-bas.
            ['', t.series_read || 0, 'Séries commencées'],
            ['', t.chapters_this_month || 0, 'Ce mois-ci'],
            ['accent', streak.current || 0, 'Jours d\'affilée'],
            ['', streak.longest || 0, 'Record de série'],
            ['', t.favorites || 0, 'Favoris'],
        ];
        // Objectif de lecture hebdomadaire (UserData)
        const goal = (window.UserData?.getGoal?.() || {}).weekly || 0;
        const weekAgo = Date.now() - 7 * 86400 * 1000;
        const readThisWeek = (events || []).filter(e => e.type === 'read' && new Date(e.at).getTime() >= weekAgo).length;
        const pct = goal > 0 ? Math.min(100, Math.round((readThisWeek / goal) * 100)) : 0;

        // Audit AMEL-60 : l'objectif était un nombre saisi à la main, sans
        // rapport avec le rythme réel — d'où des objectifs jamais atteints
        // (démotivants) ou atteints le mardi (sans intérêt). Le rythme est
        // pourtant mesuré. On propose la médiane des 8 dernières semaines,
        // arrondie vers le haut : viser sa médiane, c'est réussir une semaine
        // sur deux, ce qui est le point où un objectif tient encore.
        //
        // Médiane et non moyenne : un week-end de rattrapage à 40 chapitres
        // tirerait la moyenne au point de rendre l'objectif hors d'atteinte.
        const suggestion = suggererObjectif(stats.heatmap || {});

        // Défi de lecture annuel (UserData) — chapitres lus cette année via la heatmap
        const yGoal = (window.UserData?.getGoal?.() || {}).yearly || 0;
        const curYear = String(new Date().getFullYear());
        const readThisYear = Object.entries(stats.heatmap || {}).reduce((n, [k, v]) => k.startsWith(curYear) ? n + v : n, 0);
        const yPct = yGoal > 0 ? Math.min(100, Math.round((readThisYear / yGoal) * 100)) : 0;

        body.innerHTML = `
            <div class="st-panel" id="goalPanel" style="display:flex;align-items:center;gap:18px;flex-wrap:wrap">
                <div style="flex:1;min-width:220px">
                    <h2 style="margin-bottom:6px">Objectif de la semaine</h2>
                    <div style="font-size:12.5px;color:var(--text3)" id="goalLabel">${goal > 0
                        ? `${readThisWeek} / ${goal} chapitre(s) · ${pct}%${pct >= 100 ? ' — objectif atteint 🎉' : ''}`
                        : 'Aucun objectif défini. Fixe-toi un défi de lecture hebdomadaire.'}</div>
                    ${suggestion ? `<div style="font-size:11.5px;color:var(--text3);margin-top:5px">
                        Ton rythme : ${suggestion.mediane} chapitre(s)/semaine sur les ${suggestion.semaines} dernières semaines.
                        ${goal === suggestion.propose ? 'Ton objectif y correspond.'
        : `<button type="button" id="goalSuggest" data-v="${suggestion.propose}"
                                style="background:none;border:none;padding:0;color:var(--orange);font:inherit;cursor:pointer;text-decoration:underline">Viser ${suggestion.propose}/semaine</button>`}
                    </div>` : ''}
                    <div style="height:9px;border-radius:6px;background:var(--bg4);overflow:hidden;margin-top:10px">
                        <div id="goalFill" style="height:100%;width:${pct}%;background:linear-gradient(90deg,#ff8c42,var(--orange));transition:width .3s"></div>
                    </div>
                </div>
                <div style="display:flex;align-items:center;gap:8px">
                    <label style="font-size:12.5px;color:var(--text2)">Objectif / semaine</label>
                    <input type="number" id="goalInput" min="0" max="500" value="${goal || ''}" placeholder="ex: 10"
                        style="width:78px;background:var(--bg3);border:1px solid var(--border2);color:var(--text);border-radius:8px;padding:7px 9px;font-size:13px">
                    <button class="btn btn-primary btn-sm" id="goalSave">Définir</button>
                </div>
            </div>
            <div class="st-panel" id="yearPanel" style="display:flex;align-items:center;gap:18px;flex-wrap:wrap">
                <div style="flex:1;min-width:220px">
                    <h2 style="margin-bottom:6px">Défi de lecture ${curYear}</h2>
                    <div style="font-size:12.5px;color:var(--text3)" id="yearLabel">${yGoal > 0
                        ? `${readThisYear} / ${yGoal} chapitre(s) cette année · ${yPct}%${yPct >= 100 ? ' — défi relevé 🏆' : ''}`
                        : 'Lance-toi un défi annuel (façon Goodreads) : combien de chapitres veux-tu lire cette année ?'}</div>
                    <div style="height:9px;border-radius:6px;background:var(--bg4);overflow:hidden;margin-top:10px">
                        <div id="yearFill" style="height:100%;width:${yPct}%;background:linear-gradient(90deg,#a855f7,#6366f1);transition:width .3s"></div>
                    </div>
                </div>
                <div style="display:flex;align-items:center;gap:8px">
                    <label style="font-size:12.5px;color:var(--text2)">Objectif ${curYear}</label>
                    <input type="number" id="yearInput" min="0" max="100000" value="${yGoal || ''}" placeholder="ex: 365"
                        style="width:90px;background:var(--bg3);border:1px solid var(--border2);color:var(--text);border-radius:8px;padding:7px 9px;font-size:13px">
                    <button class="btn btn-primary btn-sm" id="yearSave">Définir</button>
                </div>
            </div>
            <div class="st-cards">
                ${cards.map(([c, v, l]) => `<div class="st-card ${c}"><div class="v">${v}</div><div class="l">${l}</div></div>`).join('')}
            </div>
            ${badgesPanel(t, streak, favs)}
            ${statusPanel(favs)}
            <!-- Audit AMEL-57 : rempli après coup, en arrière-plan. La page ne
                 doit pas attendre une requête de plus pour s'afficher. -->
            <div id="stDistrib"></div>
            ${retrospectivePanel(stats, favs, lus, prog)}
            <div class="st-panel">
                <h2>Activité sur l'année</h2>
                ${heatmap(stats.heatmap || {})}
                <div class="hm-legend">Moins <i style="background:var(--bg4)"></i><i style="background:#4a2410"></i><i style="background:#8a3d12"></i><i style="background:#d2691e"></i><i style="background:#ff8c42"></i> Plus</div>
            </div>
            <div class="st-panel">
                <h2>Activité récente</h2>
                <div id="stAct"></div>
            </div>`;
        renderActivity(document.getElementById('stAct'), events);

        // Objectif de lecture : sauvegarde + re-rendu
        document.getElementById('goalSave')?.addEventListener('click', () => {
            const v = Math.max(0, parseInt(document.getElementById('goalInput').value, 10) || 0);
            window.UserData?.setGoal?.({ weekly: v });
            MH.toast?.(v ? `Objectif fixé : ${v} chapitre(s)/semaine` : 'Objectif retiré');
            render(body, stats, events, favs, lus, prog);
        });
        document.getElementById('yearSave')?.addEventListener('click', () => {
            const v = Math.max(0, parseInt(document.getElementById('yearInput').value, 10) || 0);
            window.UserData?.setGoal?.({ yearly: v });
            MH.toast?.(v ? `Défi ${new Date().getFullYear()} : ${v} chapitre(s)` : 'Défi retiré');
            render(body, stats, events, favs, lus, prog);
        });

        // Audit AMEL-60 : un clic pose l'objectif suggéré. Il reste modifiable
        // à la main juste à côté — proposer n'est pas imposer.
        document.getElementById('goalSuggest')?.addEventListener('click', (e) => {
            const v = parseInt(e.currentTarget.dataset.v, 10);
            window.UserData?.setGoal?.({ weekly: v });
            MH.toast?.(`Objectif fixé sur ton rythme : ${v} chapitre(s)/semaine`);
            render(body, stats, events, favs, lus, prog);
        });

        // Audit AMEL-58 : copie dans le presse-papiers, pas de publication.
        // `navigator.clipboard` échoue hors contexte sécurisé — on le dit au
        // lieu de laisser croire que ça a marché.
        document.getElementById('retroShare')?.addEventListener('click', async (e) => {
            const texte = e.currentTarget.dataset.texte;
            try {
                await navigator.clipboard.writeText(texte);
                MH.toast?.('Rétrospective copiée — colle-la où tu veux');
            } catch (err) {
                MH.alert?.(texte, { title: 'Ta rétrospective (copie manuelle)' });
            }
        });

        chargerRepartition();
        resoudreTitresRetro(prog);
    }

    // Médiane hebdomadaire des 8 dernières semaines COMPLÈTES, calculée sur la
    // heatmap (déjà chargée, dans le bon fuseau). La semaine en cours est
    // exclue : à moitié écoulée, elle tirerait la médiane vers le bas.
    function suggererObjectif(heatmap) {
        const jour = 86400000;
        const auj = new Date(); auj.setHours(0, 0, 0, 0);
        const semaines = [];
        for (let s = 1; s <= 8; s++) {
            const fin = new Date(auj.getTime() - (s - 1) * 7 * jour);
            let n = 0, vue = false;
            for (let j = 1; j <= 7; j++) {
                const d = new Date(fin.getTime() - j * jour);
                const k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
                if (heatmap[k] !== undefined) vue = true;
                n += heatmap[k] || 0;
            }
            // Une semaine antérieure à la première lecture n'est pas une
            // semaine à 0 : c'est une absence de donnée. La compter ferait
            // proposer 0 à quiconque vient de commencer.
            if (vue || n) semaines.push(n);
        }
        if (semaines.length < 3) return null;   // trop peu d'historique pour un rythme
        const tri = [...semaines].sort((a, b) => a - b);
        const m = tri.length % 2
            ? tri[(tri.length - 1) / 2]
            : Math.round((tri[tri.length / 2 - 1] + tri[tri.length / 2]) / 2);
        if (m < 1) return null;
        return { mediane: m, propose: Math.max(1, m), semaines: semaines.length };
    }

    // ── Répartition des lectures dans le temps (audit AMEL-57) ──
    // Les stats étaient des compteurs : « 1 042 chapitres », « 27 séries ».
    // Aucun ne dit COMMENT la lecture évolue — ni qu'on a basculé des scans
    // vers les romans, ni qu'une source a pris toute la place.
    //
    // Chargée après le rendu : la page ne doit pas attendre une requête de
    // plus pour s'afficher. Un échec laisse simplement le bloc absent.
    const PALETTE = ['#ff8c42', '#3b82f6', '#22c55e', '#a855f7', '#f59e0b', '#ef4444', '#14b8a6', '#ec4899'];
    async function chargerRepartition() {
        const hote = document.getElementById('stDistrib');
        if (!hote) return;
        let d;
        try { d = await API.me.distribution(12); } catch (e) { return; }
        if (!d || !d.total) return;   // rien lu sur la fenêtre : un graphique vide n'apprend rien

        const sources = Object.keys(d.bySource)
            .sort((a, b) => somme(d.bySource[b]) - somme(d.bySource[a]));
        const couleur = {};
        sources.forEach((s, i) => { couleur[s] = PALETTE[i % PALETTE.length]; });
        const maxMois = Math.max(...d.months.map((_, i) => sources.reduce((n, s) => n + d.bySource[s][i], 0)), 1);

        // Format = manga ou roman. Déduit de la source, que le client sait
        // déjà classer — le dupliquer côté serveur créerait deux vérités.
        const parFormat = { Scans: 0, Romans: 0 };
        sources.forEach(s => {
            const cle = window.MH?.isNovelSource?.(s) ? 'Romans' : 'Scans';
            parFormat[cle] += somme(d.bySource[s]);
        });
        const totalFormat = parFormat.Scans + parFormat.Romans;

        const colonnes = d.months.map((m, i) => {
            const totalMois = sources.reduce((n, s) => n + d.bySource[s][i], 0);
            const segments = sources.filter(s => d.bySource[s][i]).map(s =>
                `<div style="height:${(d.bySource[s][i] / totalMois) * 100}%;background:${couleur[s]}"></div>`).join('');
            const detail = sources.filter(s => d.bySource[s][i])
                .map(s => `${s} : ${d.bySource[s][i]}`).join('\n');
            return `<div style="display:flex;flex-direction:column;align-items:center;gap:5px;flex:1;min-width:0">
                <div title="${MH.esc(m + '\n' + (detail || 'aucune lecture'))}"
                     style="width:100%;max-width:34px;height:${Math.max(3, (totalMois / maxMois) * 110)}px;display:flex;flex-direction:column-reverse;border-radius:4px;overflow:hidden;background:var(--bg4)">${segments}</div>
                <span style="font-size:9px;color:var(--text3);white-space:nowrap">${MH.esc(m.slice(5))}</span>
            </div>`;
        }).join('');

        const legende = sources.map(s =>
            `<span style="display:inline-flex;align-items:center;gap:6px;font-size:11.5px;color:var(--text2);margin-right:14px">
                <i style="width:10px;height:10px;border-radius:3px;background:${couleur[s]};display:inline-block"></i>${MH.esc(s)} · ${somme(d.bySource[s])}</span>`).join('');

        hote.innerHTML = `<div class="st-panel">
            <h2>Répartition sur 12 mois <span style="font-size:12px;color:var(--text3);font-weight:400">${MH.fmt(d.total)} chapitres</span></h2>
            <div style="display:flex;align-items:flex-end;gap:4px;height:132px;margin:14px 0 4px">${colonnes}</div>
            <div style="display:flex;flex-wrap:wrap;gap:4px 0;margin-top:8px">${legende}</div>
            ${totalFormat ? `<div style="margin-top:14px;font-size:12px;color:var(--text2)">
                Format : ${Math.round((parFormat.Scans / totalFormat) * 100)} % de scans, ${Math.round((parFormat.Romans / totalFormat) * 100)} % de romans</div>` : ''}
            <!-- Le genre n'est pas affiché parce qu'il n'est calculable :
                 aucune table ne stocke les tags des œuvres. -->
            <div style="margin-top:6px;font-size:11px;color:var(--text3)">
                Pas de répartition par genre : les tags des œuvres ne sont pas conservés en base.</div>
        </div>`;
    }
    const somme = (a) => a.reduce((n, v) => n + v, 0);

    // ── Rétrospective annuelle (audit AMEL-58) ──────────────
    // Tout le matériau existait — heatmap, séries, sources, records — mais
    // éparpillé en panneaux séparés qu'il fallait recomposer soi-même. Une
    // rétrospective, c'est ce même matériau raconté d'une traite.
    //
    // Rien n'est envoyé nulle part : le partage copie un texte dans le
    // presse-papiers. Publier une page depuis Inko exigerait un hébergement,
    // une URL publique et une décision sur ce qui devient visible — trois
    // choses que l'utilisateur n'a pas demandées en cliquant « partager ».
    function retrospectivePanel(stats, favs, lus, prog) {
        const annee = new Date().getFullYear();
        const hm = stats.heatmap || {};
        const jours = Object.keys(hm).filter(k => k.startsWith(String(annee)));
        if (jours.length < 5) return '';   // une rétrospective de trois jours n'a rien à raconter

        const chapitres = jours.reduce((n, k) => n + hm[k], 0);
        const meilleur = jours.reduce((a, k) => (hm[k] > hm[a] ? k : a), jours[0]);
        const parMois = {};
        jours.forEach(k => { parMois[k.slice(0, 7)] = (parMois[k.slice(0, 7)] || 0) + hm[k]; });
        const moisFort = Object.keys(parMois).reduce((a, k) => (parMois[k] > parMois[a] ? k : a));
        const nomMois = NOMS_MOIS[parseInt(moisFort.slice(5), 10) - 1];

        // Séries les plus lues cette année. Comptées sur read_chapters et non
        // sur les événements : ces derniers sont plafonnés à 120, ce qui ne
        // remontait qu'UNE série là où il y en avait plusieurs.
        const parSerie = {};
        Object.entries(lus || {}).forEach(([id, chaps]) => {
            const n = chaps.filter(c => String(new Date(c.readAt).getFullYear()) === String(annee)).length;
            if (n) parSerie[id] = n;
        });
        // Une série lue sans être suivie n'a pas de titre en base : on n'a que
        // son identifiant. Un slug se rend lisible tout de suite ; un
        // identifiant opaque (ULID, UUID) demande d'interroger la source, ce
        // qu'on ne fait qu'APRÈS le rendu et seulement pour les 3 du podium.
        const titreDe = (id) => (favs || []).find(f => f.mangaId === id)?.title || embellirId(id);
        const top = Object.entries(parSerie).sort((a, b) => b[1] - a[1]).slice(0, 3);

        const lignes = [
            ['Chapitres lus', MH.fmt(chapitres)],
            ['Jours de lecture', MH.fmt(jours.length) + ` sur ${jourDeLAnnee()}`],
            ['Meilleure journée', `${dateLisible(meilleur)} · ${hm[meilleur]} chapitre${hm[meilleur] > 1 ? 's' : ''}`],
            ['Mois le plus dense', `${nomMois} · ${MH.fmt(parMois[moisFort])} chapitres`],
            ['Plus longue série', `${stats.streak?.longest || 0} jours d’affilée`],
        ];
        const texte = [
            `Ma rétrospective Inko ${annee}`,
            `${MH.fmt(chapitres)} chapitres lus en ${jours.length} jours de lecture`,
            `Meilleure journée : ${hm[meilleur]} chapitre${hm[meilleur] > 1 ? 's' : ''} · mois le plus dense : ${nomMois}`,
            `Plus longue série : ${stats.streak?.longest || 0} jours d’affilée`,
            top.length ? 'Top séries : ' + top.map(([id, n]) => `${titreDe(id)} (${n})`).join(', ') : '',
        ].filter(Boolean).join('\n');

        return `<div class="st-panel" id="retroPanel">
            <h2>Rétrospective ${annee}</h2>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;margin-top:12px">
                ${lignes.map(([l, v]) => `<div style="background:var(--bg3);border:1px solid var(--border2);border-radius:10px;padding:10px 12px">
                    <div style="font-size:11px;color:var(--text3)">${MH.esc(l)}</div>
                    <div style="font-size:14px;font-weight:600;color:var(--text);margin-top:2px">${MH.esc(String(v))}</div>
                </div>`).join('')}
            </div>
            ${top.length ? `<div style="margin-top:14px">
                <div style="font-size:12px;color:var(--text3);margin-bottom:6px">Tes séries de l’année</div>
                <ol style="margin:0;padding-left:20px;font-size:13px;color:var(--text2);line-height:1.7">
                    ${top.map(([id, n]) => `<li data-retroid="${MH.esc(id)}"><span class="retro-titre">${MH.esc(titreDe(id))}</span> <span style="color:var(--text3)">· ${n} chapitre${n > 1 ? 's' : ''}</span></li>`).join('')}
                </ol></div>` : ''}
            <button class="btn btn-sm" id="retroShare" style="margin-top:14px"
                data-texte="${MH.esc(texte)}">Copier ma rétrospective</button>
        </div>`;
    }
    // Un slug d'URL se lit presque : « fullmetal-alchemist-perfect-edition »
    // devient « Fullmetal Alchemist Perfect Edition ». Un identifiant opaque
    // (que des chiffres et des majuscules, aucun tiret) est laissé tel quel :
    // le maquiller le rendrait faux sans le rendre lisible.
    function embellirId(id) {
        const s = String(id || '');
        if (!/[a-z]/.test(s) || !s.includes('-') || /^[0-9a-f-]{32,}$/i.test(s)) return s;
        return s.split('-').map(m => m.charAt(0).toUpperCase() + m.slice(1)).join(' ');
    }

    // Résout les vrais titres du podium APRÈS le rendu : trois requêtes au
    // plus, jamais bloquantes, et la page reste juste si elles échouent.
    async function resoudreTitresRetro(prog) {
        for (const li of document.querySelectorAll('[data-retroid]')) {
            const id = li.dataset.retroid;
            const el = li.querySelector('.retro-titre');
            if (!el || el.textContent !== id) continue;   // déjà lisible
            const src = (prog || {})[id]?.source;
            if (!src) continue;
            try {
                const m = await API.mangas.get(id, src);
                if (m?.title) el.textContent = m.title;
            } catch (e) { /* titre indisponible : l'identifiant reste affiché */ }
        }
        majTextePartage();
    }

    // Le texte de partage est construit AVANT la résolution des titres : sans
    // cette reprise, on copierait un identifiant brut là où l'écran affiche le
    // vrai titre. Une œuvre lue sans favori ni progression n'a aucune source
    // connue localement — son identifiant reste, faute de quoi l'interroger.
    function majTextePartage() {
        const btn = document.getElementById('retroShare');
        if (!btn) return;
        const noms = [...document.querySelectorAll('[data-retroid]')].map(li => {
            const t = li.querySelector('.retro-titre')?.textContent || li.dataset.retroid;
            const n = (li.textContent.match(/·\s*(\d+)\s*chapitre/) || [])[1];
            return n ? `${t} (${n})` : t;
        });
        if (!noms.length) return;
        btn.dataset.texte = btn.dataset.texte.replace(/Top séries : .*$/, 'Top séries : ' + noms.join(', '));
    }

    // « 2026-08-06 » ne se lit pas dans une retrospective : on ecrit la date.
    function dateLisible(k) {
        const [a, m, j] = k.split('-').map(Number);
        return `${j} ${NOMS_MOIS[m - 1]} ${a}`;
    }
    const NOMS_MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet',
        'août', 'septembre', 'octobre', 'novembre', 'décembre'];
    function jourDeLAnnee() {
        const n = new Date();
        return Math.ceil((n - new Date(n.getFullYear(), 0, 0)) / 86400000);
    }

    // Badges / accomplissements de lecture (calculés depuis les stats existantes)
    function badgesPanel(t, streak, favs) {
        const chapters = t.chapters_read || 0;
        const series   = t.series_read || 0;
        const fav      = (favs || []).length || t.favorites || 0;
        const longest  = streak.longest || 0;
        const sources  = new Set((favs || []).map(f => f.source || 'mangadex')).size;
        const novels   = (favs || []).filter(f => window.MH?.isNovelSource?.(f.source)).length;
        const defs = [
            { ico: '🌱', name: 'Premiers pas',      desc: '1er chapitre lu',            ok: chapters >= 1,   goal: 1,   val: chapters },
            { ico: '📖', name: 'Lecteur assidu',    desc: '100 chapitres lus',          ok: chapters >= 100, goal: 100, val: chapters },
            { ico: '🏆', name: 'Dévoreur',          desc: '1000 chapitres lus',         ok: chapters >= 1000,goal: 1000,val: chapters },
            { ico: '📚', name: 'Collectionneur',    desc: '25 séries en bibliothèque',  ok: fav >= 25,       goal: 25,  val: fav },
            { ico: '🔥', name: 'Marathon',          desc: '7 jours d’affilée',          ok: longest >= 7,    goal: 7,   val: longest },
            { ico: '⚡', name: 'Inarrêtable',       desc: '30 jours d’affilée',         ok: longest >= 30,   goal: 30,  val: longest },
            { ico: '🧭', name: 'Explorateur',       desc: 'Lire depuis 3 sources',      ok: sources >= 3,    goal: 3,   val: sources },
            { ico: '📜', name: 'Rat de bibliothèque', desc: 'Suivre 5 romans',          ok: novels >= 5,     goal: 5,   val: novels },
            { ico: '🎯', name: 'Touche-à-tout',     desc: '10 séries différentes lues', ok: series >= 10,    goal: 10,  val: series },
        ];
        const earned = defs.filter(d => d.ok).length;

        // Audit AMEL-59 : le compteur « 4/25 » existait déjà, mais rien ne
        // disait CE QU'IL RESTE À FAIRE ni lequel était à portée. Une barre
        // rend l'avancement lisible d'un coup d'œil, et le prochain palier est
        // nommé en clair au-dessus de la grille — c'est la seule information
        // sur laquelle on peut agir.
        const restants = defs.filter(d => !d.ok)
            .map(d => ({ ...d, manque: d.goal - Math.min(d.val, d.goal), part: Math.min(d.val, d.goal) / d.goal }))
            .sort((a, b) => b.part - a.part);
        const prochain = restants[0];

        const card = (d) => {
            const part = Math.min(1, d.val / d.goal);
            const manque = Math.max(0, d.goal - d.val);
            return `<div class="st-badge ${d.ok ? 'on' : ''}" title="${MH.esc(d.desc)}${d.ok ? ' ✓' : ` · plus que ${manque}`}"
            style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:12px 6px;border-radius:12px;background:var(--bg3);border:1px solid ${!d.ok && d === prochain ? 'var(--orange)' : 'var(--border2)'};text-align:center;${d.ok ? '' : 'opacity:.62'}">
            <span style="font-size:26px;line-height:1;${d.ok ? '' : 'filter:grayscale(1)'}">${d.ico}</span>
            <span style="font-size:11.5px;font-weight:600;color:var(--text)">${MH.esc(d.name)}</span>
            <span style="font-size:10px;color:var(--text3)">${MH.esc(d.desc)}</span>
            ${d.ok
        ? '<span style="font-size:9.5px;color:var(--green-text,#22c55e);font-weight:700">DÉBLOQUÉ</span>'
        : `<div style="width:100%;height:4px;border-radius:2px;background:var(--bg4);overflow:hidden;margin-top:2px">
                       <div style="height:100%;width:${part * 100}%;background:var(--orange)"></div>
                   </div>
                   <span style="font-size:9.5px;color:var(--text3)">${Math.min(d.val, d.goal)}/${d.goal} · plus que ${manque}</span>`}
        </div>`;
        };
        return `<div class="st-panel">
            <h2>Accomplissements <span style="font-size:12px;color:var(--text3);font-weight:400">${earned}/${defs.length}</span></h2>
            ${prochain ? `<div style="font-size:12.5px;color:var(--text2);margin-top:8px">
                Prochain palier : <strong style="color:var(--text)">${MH.esc(prochain.name)}</strong> — plus que ${MH.fmt(prochain.manque)} ${uniteDe(prochain)}.</div>` : ''}
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:10px;margin-top:12px">${defs.map(card).join('')}</div>
        </div>`;
    }
    // Le libellé de ce qui manque doit nommer la BONNE unité : « plus que 3 »
    // ne veut rien dire si on ne sait pas 3 quoi.
    function uniteDe(d) {
        if (/chapitres/.test(d.desc)) return 'chapitre(s)';
        if (/jours/.test(d.desc))     return 'jour(s) d’affilée';
        if (/sources/.test(d.desc))   return 'source(s)';
        if (/romans/.test(d.desc))    return 'roman(s)';
        return 'série(s)';
    }

    // Répartition de la bibliothèque par statut (barre empilée)
    const ST_LABELS = {
        reading: ['En cours', '#22c55e'], completed: ['Terminé', '#3b82f6'],
        planned: ['À lire', '#a855f7'], paused: ['En pause', '#f59e0b'], dropped: ['Abandonné', '#ef4444'],
    };
    function statusPanel(favs) {
        favs = favs || [];
        const counts = {};
        favs.forEach(f => { if (f.status) counts[f.status] = (counts[f.status] || 0) + 1; });
        const keys = Object.keys(ST_LABELS).filter(k => counts[k]);
        if (!keys.length) return '';
        const total = keys.reduce((n, k) => n + counts[k], 0);
        const bar = keys.map(k => `<div title="${ST_LABELS[k][0]} : ${counts[k]}" style="width:${(counts[k] / total) * 100}%;background:${ST_LABELS[k][1]}"></div>`).join('');
        const legend = keys.map(k => `<span style="display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--text2);margin-right:14px"><i style="width:10px;height:10px;border-radius:3px;background:${ST_LABELS[k][1]};display:inline-block"></i>${ST_LABELS[k][0]} · ${counts[k]}</span>`).join('');
        return `<div class="st-panel">
            <h2>Ma bibliothèque par statut</h2>
            <div style="display:flex;height:14px;border-radius:7px;overflow:hidden;margin:12px 0">${bar}</div>
            <div style="display:flex;flex-wrap:wrap;gap:4px 0">${legend}</div>
        </div>`;
    }

    function heatmap(map) {
        // 53 semaines, en finissant aujourd'hui
        const today = new Date();
        const start = new Date(today);
        start.setDate(start.getDate() - 364);
        // recule au dimanche
        start.setDate(start.getDate() - start.getDay());
        const cells = [];
        const d = new Date(start);
        const max = Math.max(1, ...Object.values(map));
        // Clé en date LOCALE (audit N55) : toISOString basculait la case en UTC —
        // avant 1h/2h du matin heure de Paris, la grille pointait sur la veille.
        const localKey = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
        while (d <= today) {
            const key = localKey(d);
            const c = map[key] || 0;
            const lvl = c === 0 ? 0 : c >= max * 0.75 ? 4 : c >= max * 0.5 ? 3 : c >= max * 0.25 ? 2 : 1;
            cells.push(`<i class="${lvl ? 'l' + lvl : ''}" title="${key} : ${c} chapitre(s)"></i>`);
            d.setDate(d.getDate() + 1);
        }
        return `<div class="hm">${cells.join('')}</div>`;
    }

    function renderActivity(el, events) {
        if (!events || !events.length) { el.innerHTML = `<div class="st-empty" style="padding:24px">Aucune activité récente. Lis un chapitre pour commencer.</div>`; return; }
        const label = e => {
            switch (e.type) {
                case 'read': return 'Chapitre lu';
                case 'favorite': return 'Ajouté aux favoris';
                case 'unfavorite': return 'Retiré des favoris';
                case 'rating': return 'Note attribuée';
                case 'comment': return 'Commentaire publié';
                case 'status_change': return 'Statut modifié' + (e.metadata?.status ? ' (' + e.metadata.status + ')' : '');
                default: return e.type;
            }
        };
        el.innerHTML = events.slice(0, 40).map(e => `
            <div class="act">
                <span class="dot"></span>
                <span>${label(e)}</span>
                <span class="when">${rel(e.at)}</span>
            </div>`).join('');
    }

    function rel(dateStr) {
        const d = new Date(dateStr), now = new Date();
        const s = Math.floor((now - d) / 1000);
        if (s < 60) return 'à l\'instant';
        if (s < 3600) return Math.floor(s / 60) + ' min';
        if (s < 86400) return Math.floor(s / 3600) + ' h';
        if (s < 2592000) return Math.floor(s / 86400) + ' j';
        return d.toLocaleDateString('fr-FR');
    }
})();
