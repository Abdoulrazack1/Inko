# Politique de sécurité

Inko est une application auto-hébergée qui **exécute des extensions tierces avec
les droits du serveur**. Ce modèle est assumé (il vient de Mihon/Tachiyomi), mais
il déplace une partie de la surface d'attaque chez l'utilisateur — d'où ce
document.

## Signaler une faille

**N'ouvre pas d'issue publique** pour une vulnérabilité.

- Utilise l'onglet **Security → Report a vulnerability** du dépôt
  ([lien direct](https://github.com/Abdoulrazack1/Inko/security/advisories/new)) ;
- ou écris à l'adresse de contact du profil GitHub
  [@Abdoulrazack1](https://github.com/Abdoulrazack1).

Ce qui aide à traiter vite :

- la version (`package.json`, ou l'écran Paramètres → Application) ;
- le mode d'exécution : navigateur, app desktop Windows, Docker, hub exposé ;
- les étapes de reproduction, et l'impact que tu as pu constater ;
- toute preuve de concept, même partielle.

Réponse sous **7 jours**. Si la faille est confirmée, un correctif est publié
avec une entrée au CHANGELOG, et tu es crédité·e si tu le souhaites.

## Versions suivies

Seule la **dernière version publiée** reçoit des correctifs de sécurité. Le
projet est mono-mainteneur : il n'y a pas de branche de maintenance.

## Périmètre

**Dans le périmètre** — le code de ce dépôt :
serveur Express (`server/`), frontend (`assets/`, pages HTML), service worker,
application desktop Tauri (`desktop-tauri/`), extensions officielles
(`extensions-community/`), workflows CI.

**Hors périmètre** :

- les **sites sources** que les extensions consultent (MangaDex, SushiScan…) —
  signale-leur directement ;
- les **extensions tierces** que tu installes toi-même : elles exécutent du
  JavaScript avec les pleins droits Node dans le processus serveur. C'est le
  modèle, pas un défaut. Le canal officiel est vérifié par empreinte SHA-256 ;
  tout le reste est à ta charge ;
- une instance **exposée sans `JWT_SECRET` fort** ou avec `CORS_ALLOW_ANY=1` :
  le serveur refuse déjà de démarrer ou avertit bruyamment.

## Ce que le projet garantit déjà

Ces protections sont en place et testées — si tu trouves un moyen de les
contourner, c'est exactement ce qui nous intéresse :

| Protection | Où |
|---|---|
| Secret JWT refusé s'il est faible ou laissé au placeholder (arrêt en production) | `server/lib/secret.js` |
| Révocation des sessions au changement/réinitialisation de mot de passe | `server/middleware/auth.js` |
| Échappement HTML systématique, y compris dans les attributs | `assets/js/global.js` |
| Anti-SSRF du proxy d'images : plages privées IPv4/IPv6, CGNAT, IPv4 mappée, liste blanche de domaines | `server/controllers/image.controller.js` |
| Vérification d'empreinte SHA-256 **fail-closed** des extensions | `server/controllers/extensions.controller.js` |
| Vérification de l'installeur (SHA256SUMS + signature Authenticode) avant exécution | `server/controllers/update.controller.js` |
| Rate-limiting différencié : auth, écritures, recherche, images, relais | `server/middleware/security.js` |
| CSP et HSTS actives en production **et** en mode desktop | `server/middleware/security.js` |
| Isolation des données par compte, vérifiée à chaque accès | `server/controllers/` |
| Contrôle du contenu réel des fichiers importés (octets d'en-tête) | `server/controllers/local.controller.js` |

## Bonnes pratiques pour ton instance

Si tu exposes Inko en ligne :

```bash
JWT_SECRET=$(openssl rand -hex 32)     # obligatoire, sinon refus de démarrer
CORS_ORIGINS=https://inko.exemple.com  # liste blanche stricte
NODE_ENV=production                    # active CSP, HSTS et cookie Secure
TRUST_PROXY=1                          # derrière un reverse-proxy
```

Et surtout : **n'installe que des extensions dont tu comprends la provenance.**
