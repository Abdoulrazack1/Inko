// _garde-sql.js — aucun script SQL chargé par une sonde ne doit pouvoir viser une autre base
// que la sienne. Le schema.sql de la v2.3.4 commence par « USE inko; » : chargé tel quel, il
// s'exécute sur la base réelle. Toute sonde qui charge un fichier SQL passe par ici.
'use strict';

/** Retire les ordres qui désignent une base ; refuse le script s'il en reste une trace. */
function sansBaseImposee(sql, base) {
    if (!/^inko_(s|sonde|ux)/.test(base)) throw new Error(`base non jetable : ${base}`);
    const net = String(sql)
        .replace(/--[^\n]*/g, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|;)\s*(CREATE|DROP)\s+(DATABASE|SCHEMA)\b[^;]*;/gi, '$1')
        .replace(/(^|;)\s*USE\s+[^;]+;/gi, '$1');
    const interdit = /(^|;)\s*(USE|CREATE\s+DATABASE|DROP\s+DATABASE|CREATE\s+SCHEMA|DROP\s+SCHEMA|GRANT|REVOKE)\b/i.exec(net) || /`?\binko`?\s*\.\s*`?\w/i.exec(net);
    if (interdit) throw new Error('script SQL refusé : il désigne une base (' + interdit[0].trim().slice(0, 40) + ')');
    return net;
}

module.exports = { sansBaseImposee };
