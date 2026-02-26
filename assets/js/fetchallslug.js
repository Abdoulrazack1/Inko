#!/usr/bin/env node
// ============================================================
// fetch-all-slugs.js — Résolution des slugs/hid Comick
// ============================================================
// UTILISATION (depuis le dossier du projet, serveur démarré) :
//   node fetch-all-slugs.js
//
// Prérequis : server.js doit tourner sur localhost:8080
// ============================================================

const https = require('https');
const http  = require('http');

const PROXY_HOST = 'localhost';
const PROXY_PORT = 8080;
const DELAY_MS   = 400;

const SEARCH_QUERIES = {
    1:  ['Berserk'],
    2:  ['Vagabond'],
    3:  ['Vinland Saga'],
    4:  ['Monster'],
    5:  ['Pluto'],
    6:  ['Dorohedoro'],
    7:  ['Dungeon Meshi', 'Delicious in Dungeon'],
    8:  ['Mushishi'],
    9:  ['Blame!', 'Blame'],
    10: ['Biomega'],
    11: ['Oyasumi Punpun', 'Goodnight Punpun'],
    12: ['Solanin'],
    13: ['Blue Period'],
    14: ['Houseki no Kuni', 'Land of the Lustrous'],
    15: ['Slam Dunk'],
    16: ['Hajime no Ippo'],
    17: ['Haikyuu!!', 'Haikyuu'],
    18: ['20th Century Boys'],
    19: ['Devilman'],
    20: ['Gantz'],
    21: ['Yotsuba&!', 'Yotsuba'],
    22: ['Parasyte', 'Kiseijuu'],
    23: ['Ashita no Joe'],
    24: ['Hellsing'],
    25: ['Beck'],
    26: ['Fullmetal Alchemist'],
    27: ['Hunter x Hunter'],
    28: ['Dragon Ball'],
    29: ['Naruto'],
    30: ['Attack on Titan', 'Shingeki no Kyojin'],
    31: ['One Piece'],
    32: ['Demon Slayer', 'Kimetsu no Yaiba'],
    33: ['Fairy Tail'],
    34: ['Death Note'],
    35: ['Bleach'],
    36: ['Great Teacher Onizuka', 'GTO'],
    37: ['Magi', 'Magi The Labyrinth of Magic'],
    38: ['My Hero Academia', 'Boku no Hero Academia'],
    39: ['Nana'],
    40: ['Fruits Basket'],
    41: ['Cardcaptor Sakura'],
    42: ['Sailor Moon'],
    43: ['Baki', 'Baki the Grappler'],
    44: ['Yokohama Kaidashi Kikou'],
    45: ['Golden Kamuy'],
    46: ['Fire Punch'],
    47: ['Chainsaw Man'],
    48: ['Jujutsu Kaisen'],
    49: ['Spy x Family'],
    50: ['Tokyo Ghoul'],
    51: ['Made in Abyss'],
    52: ['Dr. Stone'],
    53: ['The Promised Neverland', 'Yakusoku no Neverland'],
    54: ['One-Punch Man', 'One Punch Man'],
    55: ['Mob Psycho 100'],
    56: ['Akira'],
    57: ['Nausicaa', 'Nausicaa of the Valley of the Wind'],
    58: ['Initial D'],
    59: ['Claymore'],
    60: ['Rurouni Kenshin'],
};

const NAMES = {
    1:'Berserk',2:'Vagabond',3:'Vinland Saga',4:'Monster',5:'Pluto',
    6:'Dorohedoro',7:'Dungeon Meshi',8:'Mushishi',9:'Blame!',10:'Biomega',
    11:'Oyasumi Punpun',12:'Solanin',13:'Blue Period',14:'Houseki no Kuni',
    15:'Slam Dunk',16:'Hajime no Ippo',17:'Haikyuu!!',18:'20th Century Boys',
    19:'Devilman',20:'Gantz',21:'Yotsuba',22:'Parasyte',23:'Ashita no Joe',
    24:'Hellsing',25:'Beck',26:'Fullmetal Alchemist',27:'Hunter x Hunter',
    28:'Dragon Ball',29:'Naruto',30:'Attack on Titan',31:'One Piece',
    32:'Demon Slayer',33:'Fairy Tail',34:'Death Note',35:'Bleach',
    36:'GTO',37:'Magi',38:'My Hero Academia',39:'Nana',40:'Fruits Basket',
    41:'Cardcaptor Sakura',42:'Sailor Moon',43:'Baki',44:'Yokohama Kaidashi Kikou',
    45:'Golden Kamuy',46:'Fire Punch',47:'Chainsaw Man',48:'Jujutsu Kaisen',
    49:'Spy x Family',50:'Tokyo Ghoul',51:'Made in Abyss',52:'Dr. Stone',
    53:'The Promised Neverland',54:'One-Punch Man',55:'Mob Psycho 100',
    56:'Akira',57:'Nausicaä',58:'Initial D',59:'Claymore',60:'Rurouni Kenshin',
};

function httpGet(path) {
    return new Promise((resolve, reject) => {
        const opts = {
            hostname: PROXY_HOST,
            port:     PROXY_PORT,
            path,
            method: 'GET',
            headers: { 'Accept': 'application/json' },
        };
        const req = http.request(opts, res => {
            let body = '';
            res.on('data', c => body += c);
            res.on('end', () => {
                try { resolve(JSON.parse(body)); }
                catch(e) { resolve(null); }
            });
        });
        req.on('error', () => resolve(null));
        req.setTimeout(10000, () => { req.destroy(); resolve(null); });
        req.end();
    });
}

async function searchSlug(titles) {
    for (const title of titles) {
        const path = `/comick/v1.0/search/?q=${encodeURIComponent(title)}&limit=5`;
        const data = await httpGet(path);
        const items = Array.isArray(data) ? data : (data?.data || []);
        if (items.length) {
            return {
                slug: items[0].slug,
                hid:  items[0].hid,
                name: items[0].title || title,
            };
        }
        await sleep(DELAY_MS);
    }
    return null;
}

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

async function main() {
    console.log('\n🔍 Résolution des slugs Comick pour vos 60 mangas...\n');
    console.log('━'.repeat(72));
    console.log('⚠️  Assurez-vous que server.js tourne sur localhost:8080 !\n');

    const results = {};
    const failed  = [];
    const ids = Object.keys(SEARCH_QUERIES).map(Number).sort((a, b) => a - b);

    for (const id of ids) {
        const titles = SEARCH_QUERIES[id];
        const label  = `[${String(id).padStart(2,'0')}] ${NAMES[id].padEnd(30)}`;
        process.stdout.write(`${label} → `);

        const hit = await searchSlug(titles);

        if (hit) {
            results[id] = hit;
            console.log(`slug=${hit.slug}  hid=${hit.hid}`);
        } else {
            failed.push(id);
            console.log('❌ INTROUVABLE');
        }

        await sleep(DELAY_MS);
    }

    console.log('\n' + '━'.repeat(72));
    console.log(`\n✅ ${Object.keys(results).length} résolus  ❌ ${failed.length} échecs\n`);

    // ── Génération du bloc COMICK_SLUGS ──────────────────────
    console.log('📋 COPIEZ CE BLOC dans chaptersdb.js (remplacer COMICK_SLUGS) :\n');
    console.log('    const COMICK_SLUGS = {');
    for (const id of ids) {
        const r    = results[id];
        const name = NAMES[id];
        if (r) {
            console.log(`        ${String(id).padEnd(3)}: { slug: '${r.slug}', hid: '${r.hid}' }, // ${name}`);
        } else {
            console.log(`        // ${String(id).padEnd(2)}: INTROUVABLE — ${name}`);
        }
    }
    console.log('    };\n');
    console.log('━'.repeat(72));
    console.log('\nTerminé ! Redémarrez node server.js après la mise à jour.\n');
}

main().catch(err => {
    console.error('Erreur fatale :', err);
    process.exit(1);
});