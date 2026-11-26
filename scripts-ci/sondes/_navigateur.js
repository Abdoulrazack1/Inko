// _navigateur.js — lance un Chromium utilisable (le build attendu par Playwright manque souvent)
'use strict';
const fs = require('fs');
const path = require('path');
const { RACINE } = require('./_commun');

async function lancerNavigateur() {
    const { chromium } = require(path.join(RACINE, 'node_modules', '@playwright', 'test'));
    try { return await chromium.launch(); } catch (e) { /* on cherche un autre build */ }
    const racine = path.join(process.env.LOCALAPPDATA || path.join(require('os').homedir(), 'AppData', 'Local'), 'ms-playwright');
    const candidats = [];
    if (fs.existsSync(racine)) {
        for (const d of fs.readdirSync(racine).sort().reverse()) {
            for (const c of [['chrome-win64', 'chrome.exe'], ['chrome-headless-shell-win64', 'chrome-headless-shell.exe'], ['chrome-linux', 'chrome'], ['chrome-linux64', 'chrome']]) {
                const p = path.join(racine, d, ...c); if (fs.existsSync(p)) candidats.push(p);
            }
        }
    }
    for (const exe of candidats) { try { return await chromium.launch({ executablePath: exe }); } catch (e) { /* suivant */ } }
    throw new Error('aucun navigateur utilisable : npx playwright install chromium');
}
module.exports = { lancerNavigateur };
