const { test } = require('@playwright/test');
const fs = require('fs');
const PAGES = (process.env.QA_PAGES || 'accueil.html').split(',');
const SEL = 'button, a[href], input, select, textarea, [role=button], [role=tab], [role=switch], summary';
const DESTRUCTIF = /supprim|delete|effac|vider|purge|reinitialis|réinitialis|deconnex|déconnex|logout|quitter|desinstall|désinstall|export|import|sauvegard|restaur/i;

test('audit exhaustif des controles', async ({ page }) => {
    test.setTimeout(3_600_000);
    await page.addInitScript(([e, t]) => {
        try { localStorage.setItem(e, '1'); localStorage.setItem(t, '1'); } catch (x) { /* noop */ }
    }, ['mh_eula_v2', 'inko_tour_done']);
    const rapport = {};
    for (const chemin of PAGES) {
        const url = '/' + chemin;
        const res = { total: 0, distincts: 0, actionnes: 0, inertes: [], erreurs: [], http: [], non_touches: [], echecs_clic: [] };
        const j = { err: [], http: [] };
        const onErr = e => j.err.push(String(e).replace(/\s+/g, ' ').slice(0, 120));
        const onCons = m => { if (m.type() === 'error') j.err.push('console: ' + m.text().replace(/\s+/g, ' ').slice(0, 110)); };
        const onResp = r => { if (r.status() >= 400) j.http.push(r.status() + ' ' + r.url().replace(/^https?:\/\/[^/]+/, '').slice(0, 70)); };
        page.on('pageerror', onErr); page.on('console', onCons); page.on('response', onResp);
        const aller = async () => { for (let k = 0; k < 3; k++) { try { await page.goto(url, { waitUntil: 'domcontentloaded' }); return true; } catch (e) { await page.waitForTimeout(1500); } } return false; };
        await aller(); await page.waitForTimeout(3500);
        const inv0 = await page.evaluate((sel) => {
            const vus = new Map();
            [...document.querySelectorAll(sel)].forEach(e => {
                const r = e.getBoundingClientRect();
                if (!(r.width > 0 && r.height > 0) || getComputedStyle(e).visibility === 'hidden') return;
                const lab = (e.getAttribute('aria-label') || e.getAttribute('title') || e.getAttribute('placeholder') || e.textContent || e.value || e.name || e.id || e.className || '').toString().replace(/\s+/g, ' ').trim().slice(0, 46);
                const cle = e.tagName.toLowerCase() + '|' + (e.getAttribute('type') || '') + '|' + lab;
                if (!vus.has(cle)) vus.set(cle, { cle, tag: e.tagName.toLowerCase(), type: e.getAttribute('type') || '', label: lab, n: 1 }); else vus.get(cle).n++;
            });
            return { total: [...vus.values()].reduce((a, v) => a + v.n, 0), liste: [...vus.values()] };
        }, SEL);
        res.total = inv0.total; res.distincts = inv0.liste.length;
        for (const ctrl of inv0.liste) {
          try {
            if (DESTRUCTIF.test(ctrl.label)) { res.non_touches.push(ctrl.label + ' [' + ctrl.tag + '] x' + ctrl.n); continue; }
            if (!(await aller())) { res.echecs_clic.push(ctrl.label + ' (rechargement impossible)'); continue; }
            await page.waitForTimeout(1800);
            j.err.length = 0; j.http.length = 0;
            const idx = await page.evaluate(([sel, cle]) => {
                const els = [...document.querySelectorAll(sel)].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; });
                for (let i = 0; i < els.length; i++) {
                    const e = els[i];
                    const lab = (e.getAttribute('aria-label') || e.getAttribute('title') || e.getAttribute('placeholder') || e.textContent || e.value || e.name || e.id || e.className || '').toString().replace(/\s+/g, ' ').trim().slice(0, 46);
                    if (e.tagName.toLowerCase() + '|' + (e.getAttribute('type') || '') + '|' + lab === cle) return i;
                }
                return -1;
            }, [SEL, ctrl.cle]);
            if (idx < 0) { res.echecs_clic.push(ctrl.label + ' (introuvable)'); continue; }
            const cible = page.locator(SEL).nth(idx);
            const avant = await page.evaluate(() => ({ h: document.body.innerHTML.length, u: location.href, t: document.body.innerText.length, c: document.documentElement.className + document.body.className }));
            try {
                if (ctrl.tag === 'input' && ['text', 'search', 'email', 'password', 'number', 'url', ''].includes(ctrl.type)) { await cible.fill('test', { timeout: 4000 }); await page.keyboard.press('Enter'); }
                else if (ctrl.tag === 'select') { const n = await cible.locator('option').count(); if (n > 1) await cible.selectOption({ index: 1 }, { timeout: 4000 }); else continue; }
                else await cible.click({ timeout: 4000 });
                res.actionnes++;
            } catch (e) { res.echecs_clic.push(ctrl.label + ' : ' + String(e).replace(/\s+/g, ' ').slice(0, 55)); continue; }
            await page.waitForTimeout(1000);
            const apres = await page.evaluate(() => ({ h: document.body.innerHTML.length, u: location.href, t: document.body.innerText.length, c: document.documentElement.className + document.body.className }))
                .catch(() => ({ h: -1, u: '', t: -1, c: '' }));
            if (j.err.length) res.erreurs.push({ ctrl: ctrl.label, msg: j.err[0] });
            if (j.http.length) res.http.push({ ctrl: ctrl.label, msg: j.http[0] });
            const bouge = apres.u !== avant.u || apres.c !== avant.c || Math.abs(apres.h - avant.h) > 8 || Math.abs(apres.t - avant.t) > 1;
            if (!bouge && !j.err.length && !j.http.length) res.inertes.push(ctrl.label + ' [' + ctrl.tag + '] x' + ctrl.n);
          } catch (e) { res.echecs_clic.push(ctrl.label + ' [harnais] ' + String(e).replace(/\s+/g, ' ').slice(0, 55)); }
          rapport[chemin] = res;
          fs.writeFileSync(process.env.QA_OUT || 'qa-audit.json', JSON.stringify(rapport, null, 1));
        }
        page.off('pageerror', onErr); page.off('console', onCons); page.off('response', onResp);
        rapport[chemin] = res;
        fs.writeFileSync(process.env.QA_OUT || 'qa-audit.json', JSON.stringify(rapport, null, 1));
    }
    console.log('AUDIT-OK');
});
