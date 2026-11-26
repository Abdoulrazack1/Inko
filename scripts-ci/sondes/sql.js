// sql — schéma, index, requêtes coûteuses, N+1, migrations
'use strict';
module.exports = {
    nom: 'sql',
    description: 'Clés étrangères sans index, SELECT *, requêtes dans des boucles, LIKE %x%, migrations',
    async run(ctx) {
        const schema = ctx.lire(ctx.abs('server', 'db', 'schema.sql'));
        const migr = ctx.lire(ctx.abs('server', 'db', 'migrate.js'));
        const tout = schema + '\n' + migr;
        // tables + index (approx. : CREATE TABLE ... ( ... ) et CREATE INDEX / KEY)
        const tables = {};
        for (const m of tout.matchAll(/CREATE TABLE(?: IF NOT EXISTS)?\s+`?(\w+)`?\s*\(([\s\S]*?)\)\s*(?:ENGINE|;)/gi)) {
            const [, nom, corps] = m;
            tables[nom] = tables[nom] || { colonnes: [], index: new Set(), fks: [] };
            for (const l of corps.split('\n')) {
                const c = /^\s*`?(\w+)`?\s+(INT|BIGINT|VARCHAR|TEXT|LONGTEXT|TINYINT|DATETIME|TIMESTAMP|JSON|DECIMAL|FLOAT|DOUBLE|MEDIUMTEXT|ENUM|BOOLEAN|DATE|BLOB|SMALLINT)/i.exec(l);
                if (c) tables[nom].colonnes.push(c[1]);
                const k = /(?:PRIMARY KEY|UNIQUE(?: KEY| INDEX)?|KEY|INDEX)\s*(?:`?\w+`?\s*)?\(([^)]+)\)/i.exec(l);
                if (k) tables[nom].index.add(k[1].split(',')[0].replace(/[`\s]/g, '').replace(/\(\d+\)/, ''));
                const f = /FOREIGN KEY\s*\(`?(\w+)`?\)/i.exec(l);
                if (f) tables[nom].fks.push(f[1]);
                if (/\bPRIMARY KEY\b/i.test(l) && c) tables[nom].index.add(c[1]);
            }
        }
        for (const m of tout.matchAll(/(?:CREATE (?:UNIQUE )?INDEX\s+`?\w+`?\s+ON\s+`?(\w+)`?\s*\(([^)]+)\)|ALTER TABLE\s+`?(\w+)`?\s+ADD (?:UNIQUE )?(?:INDEX|KEY)\s+`?\w*`?\s*\(([^)]+)\))/gi)) {
            const t = m[1] || m[3]; const cols = (m[2] || m[4] || '').split(',')[0].replace(/[`\s]/g, '');
            if (tables[t]) tables[t].index.add(cols);
        }
        ctx.mesure('tables', Object.keys(tables).length);
        for (const [nom, t] of Object.entries(tables)) {
            for (const fk of t.fks) if (!t.index.has(fk)) ctx.trouver({ gravite: 'basse', id: 'SQL-FK-SANS-INDEX', categorie: 'performance', titre: `${nom}.${fk} : clé étrangère sans index de tête`, fichier: 'server/db/schema.sql', correctif: 'MariaDB crée un index pour une FK déclarée ; vérifier le schéma réel (SHOW INDEX).', effort: 'S' });
        }

        // requêtes dans le code
        const fichiers = [...ctx.parcourir(ctx.abs('server'), ctx.ext('.js'))].filter(p => !/node_modules|server\/test|backups|uploads|server\/extensions/.test(ctx.rel(p)));
        let nbRequetes = 0, selStar = 0, likeLarge = 0;
        const dansBoucle = [];
        for (const p of fichiers) {
            const t = ctx.lire(p), r = ctx.rel(p);
            nbRequetes += (t.match(/\.(query|execute)\(/g) || []).length;
            ctx.chercher(t, /SELECT\s+\*\s+FROM/i, (m, l) => { selStar++; });
            ctx.chercher(t, /LIKE\s+['"`]%|LIKE\s+\?[^;]{0,60}%\$\{|LIKE\s+CONCAT\('%'/i, (m, l) => { likeLarge++; ctx.trouver({ gravite: 'basse', id: 'SQL-LIKE-PREFIXE-JOKER', categorie: 'performance', titre: 'LIKE à joker de tête : balayage complet de la table', fichier: r, ligne: l, correctif: 'FULLTEXT ou colonne normalisée indexée si la table grossit.', effort: 'M' }); });
            // await db.query dans une boucle for / forEach / map
            const lignes = t.split('\n');
            let profondeur = [];
            lignes.forEach((L, i) => {
                if (/^\s*for\s*\(|^\s*for await|\.forEach\(|^\s*while\s*\(/.test(L)) profondeur.push(i);
                if (profondeur.length && /await\s+[\w.]*(db|pool|conn)[\w.]*\.(query|execute)\(/.test(L) && i - profondeur[profondeur.length - 1] < 25)
                    dansBoucle.push(`${r}:${i + 1}`);
                if (/^\s{0,4}\}\s*$/.test(L)) profondeur = [];
            });
            // SELECT sans LIMIT sur table potentiellement grosse
            ctx.chercher(t, /\.(?:query|execute)\(\s*(['"`])(SELECT[\s\S]*?)\1/i, (m, l) => {
                const q = m[2];
                if (/FROM\s+(chapter_progress|read_log|reading_history|events|audit|progress|history|journal|notes|downloads)/i.test(q) && !/LIMIT|COUNT\(|WHERE\s+[\w.]+\s*=\s*\?\s*AND\s+[\w.]+\s*=\s*\?/i.test(q))
                    ctx.trouver({ gravite: 'moyenne', id: 'SQL-SANS-LIMITE', categorie: 'performance', titre: 'SELECT sur table qui croît sans LIMIT', fichier: r, ligne: l, detail: q.replace(/\s+/g, ' ').slice(0, 180), correctif: 'Pagination (LIMIT/OFFSET ou curseur).', effort: 'S' });
            });
        }
        ctx.mesure('requetes_sql_dans_le_code', nbRequetes);
        ctx.mesure('select_etoile', selStar);
        ctx.mesure('like_joker_tete', likeLarge);
        if (dansBoucle.length) ctx.trouver({ gravite: 'moyenne', id: 'SQL-N-PLUS-1', categorie: 'performance', titre: `${dansBoucle.length} requête(s) SQL dans une boucle (N+1 possible)`, detail: dansBoucle.slice(0, 30).join('\n'), correctif: 'Regrouper en une requête IN (?) ou INSERT multi-lignes ; transaction pour les écritures.', effort: 'M' });
        if (selStar > 15) ctx.trouver({ gravite: 'basse', id: 'SQL-SELECT-ETOILE', categorie: 'performance', titre: `${selStar} SELECT * : colonnes lourdes (JSON, TEXT) lues inutilement`, correctif: 'Lister les colonnes ; surtout quand la table porte du JSON/TEXT.', effort: 'M' });

        // transactions : écritures multiples sans transaction
        for (const p of fichiers) {
            const t = ctx.lire(p), r = ctx.rel(p);
            const writes = (t.match(/\.(?:query|execute)\(\s*['"`](?:INSERT|UPDATE|DELETE)/gi) || []).length;
            const tx = /beginTransaction|START TRANSACTION|withTransaction|transaction\(/i.test(t);
            if (writes >= 6 && !tx) ctx.trouver({ gravite: 'moyenne', id: 'SQL-SANS-TRANSACTION', categorie: 'intégrité', titre: `${r} : ${writes} écritures SQL mais aucune transaction`, fichier: r, correctif: 'Envelopper les opérations multi-tables (suppression de compte, import, fusion) dans une transaction.', effort: 'M' });
        }
        // migrations : numérotation
        const versions = [...migr.matchAll(/version\s*:\s*(\d+)/g)].map(m => +m[1]);
        ctx.mesure('migrations', versions.length);
        const trous = []; for (let i = 1; i < versions.length; i++) if (versions[i] !== versions[i - 1] + 1) trous.push(`${versions[i - 1]}→${versions[i]}`);
        if (trous.length) ctx.trouver({ gravite: 'basse', id: 'SQL-MIGRATIONS-TROUS', categorie: 'intégrité', titre: 'Numérotation de migrations non contiguë', detail: trous.join(', '), effort: 'S' });
        // migrations destructrices
        ctx.chercher(migr, /DROP\s+(TABLE|COLUMN)/i, (m, l) => ctx.trouver({ gravite: 'moyenne', id: 'SQL-MIGRATION-DESTRUCTRICE', categorie: 'intégrité', titre: 'Migration avec DROP ' + m[1], fichier: 'server/db/migrate.js', ligne: l, correctif: 'Sauvegarde automatique avant migration destructrice (le dossier backups existe).', effort: 'S' }));
    },
};
