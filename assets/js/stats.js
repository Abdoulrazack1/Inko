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
            const [stats, events, favs] = await Promise.all([API.me.stats(), API.me.events(120), API.me.favorites().catch(() => [])]);
            render(body, stats, events, favs);
        } catch (e) {
            body.innerHTML = `<div class="st-empty" style="color:#ef4444">Erreur : ${MH.esc(e.message)}</div>`;
        }
    });

    function render(body, stats, events, favs) {
        const t = stats.totals || {};
        const streak = stats.streak || { current: 0, longest: 0 };
        const cards = [
            ['accent', t.chapters_read || 0, 'Chapitres lus'],
            ['', t.series_read || 0, 'Séries lues'],
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
            render(body, stats, events, favs);
        });
        document.getElementById('yearSave')?.addEventListener('click', () => {
            const v = Math.max(0, parseInt(document.getElementById('yearInput').value, 10) || 0);
            window.UserData?.setGoal?.({ yearly: v });
            MH.toast?.(v ? `Défi ${new Date().getFullYear()} : ${v} chapitre(s)` : 'Défi retiré');
            render(body, stats, events, favs);
        });
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
        const card = (d) => `<div class="st-badge ${d.ok ? 'on' : ''}" title="${MH.esc(d.desc)}${d.ok ? ' ✓' : ` · ${Math.min(d.val, d.goal)}/${d.goal}`}"
            style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:12px 6px;border-radius:12px;background:var(--bg3);border:1px solid var(--border2);text-align:center;${d.ok ? '' : 'opacity:.45;filter:grayscale(1)'}">
            <span style="font-size:26px;line-height:1">${d.ico}</span>
            <span style="font-size:11.5px;font-weight:600;color:var(--text)">${MH.esc(d.name)}</span>
            <span style="font-size:10px;color:var(--text3)">${MH.esc(d.desc)}</span>
            ${d.ok ? '<span style="font-size:9.5px;color:var(--green,#22c55e);font-weight:700">DÉBLOQUÉ</span>' : `<span style="font-size:9.5px;color:var(--text3)">${Math.min(d.val,d.goal)}/${d.goal}</span>`}
        </div>`;
        return `<div class="st-panel">
            <h2>Accomplissements <span style="font-size:12px;color:var(--text3);font-weight:400">${earned}/${defs.length}</span></h2>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:10px;margin-top:12px">${defs.map(card).join('')}</div>
        </div>`;
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
