// server.js — point d'entrée Inko
// Garantit une base de données joignable AVANT de charger l'app :
// MySQL externe s'il répond (dev/self-host), sinon la MariaDB embarquée
// dans l'app desktop (voir lib/embedded-db.js). Indispensable pour que
// l'app marche sur un PC sans environnement de dev.
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const { ensureDatabase } = require('./lib/embedded-db');

ensureDatabase()
    .then(() => require('./app'))
    .catch((e) => {
        console.error('[db] impossible de préparer la base de données :', e.message);
        process.exit(1);
    });
