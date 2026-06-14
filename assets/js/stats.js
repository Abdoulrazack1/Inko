// stats.js — Page statistiques de lecture
(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', async () => {
        MH.initPage('stats');
        const body = document.getElementById('stBody');
        if (!API.isLoggedIn()) {
            body.innerHTML = `<div class="st-empty">
                <div style="font-size:15px;color:var(--text);font-weight:600;margin-bottom:8px">Connexion requise</div>
                <div style="margin-bottom:16px">Connecte-toi pour voir tes statistiques de lecture.</div>
                <a href="page_login.html" class="btn btn-primary">Se connecter</a></div>`;
            return;
        }
        try {
            await window.UserData?.ready?.();
            const [stats, events] = await Promise.all([API.me.stats(), API.me.events(120)]);
            render(body, stats, events);
        } catch (e) {
            body.innerHTML = `<div class="st-empty" style="color:#ef4444">Erreur : ${MH.esc(e.message)}</div>`;
        }
    });

    function render(body, stats, events) {
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
            <div class="st-cards">
                ${cards.map(([c, v, l]) => `<div class="st-card ${c}"><div class="v">${v}</div><div class="l">${l}</div></div>`).join('')}
            </div>
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
            render(body, stats, events);
        });
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
        while (d <= today) {
            const key = d.toISOString().slice(0, 10);
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
