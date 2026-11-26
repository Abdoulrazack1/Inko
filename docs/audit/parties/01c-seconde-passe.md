### 1.6 Seconde passe : ce que la première n'avait pas vu

La première passe regardait chaque page dans des conditions favorables. La seconde cherche à casser : attaques jouées, sauvegardes réellement restaurées, pannes simulées, comptes vides, 10 000 favoris, clavier seul, téléphone, anglais, thème clair, lecteur fonction par fonction. Douze sondes de plus, toutes sur des bases jetables.

| Sonde ajoutée | Ce qu'elle éprouve |
|---|---|
| `securite-dyn` | {{mesure:securite-dyn.securite_essais}} attaques jouées et {{mesure:securite-dyn.securite_requetes_de_fuzz}} requêtes de mauvais type |
| `integrite` | sauvegarde puis restauration, export puis import, effacement, écritures simultanées, migrations, écart de schéma |
| `xss` | charges hostiles dans chaque champ et dans l'adresse, rendues dans un vrai navigateur |
| `chaos` | chaque page face à une API en erreur, vide, illisible, coupée ou lente |
| `parcours` | compte neuf, cinq largeurs, thème clair, sept couleurs d'accent, interface anglaise |
| `interaction` | clavier seul, ouverture des menus et fenêtres, saisies inhabituelles |
| `lecteur` | chaque touche, mode et réglage des deux lecteurs, reprise et progression |
| `mobile` | cibles tactiles, barre du bas, saisie, paysage, appui sur chaque contrôle |
| `charge` | 2 000 et 10 000 favoris, poids réel, requêtes en double, fuites |
| `references` | fonctions, routes, identifiants, fichiers et événements qui pointent dans le vide |
| `certificats` | certificat et réponse de {{mesure:certificats.certificats_hotes}} hôtes externes |
| `analyse` | analyse statique stricte de tout le code, extensions et serveur compris |

#### 1.6.1 Sécurité

#### SEC-14 🔴 Tout appareil du réseau local peut prendre le compte propriétaire · effort S

**Preuve, rejouée sur un serveur jetable configuré comme l'application de bureau, depuis l'adresse réseau de la machine :** `/api/auth/local` refuse (403), puis `POST /api/auth/forgot` avec `owner@inko.local` renvoie le jeton de réinitialisation dans sa réponse ; `POST /api/auth/reset` change le mot de passe ; `POST /api/auth/login` rend un jeton **administrateur** ; `/api/admin/users` et `/api/me/export` répondent 200.

**Cause** : `requestReset` (`server/controllers/auth.controller.js`) ne retient le jeton que si `NODE_ENV=production`. Ni le lanceur de l'application de bureau ni `.env.example` ne le posent, et le serveur écoute sur toutes les interfaces. Le filtre ajouté pour `/auth/local` ne couvre pas cette route. **La version 2.9.0 installée est concernée.**

**Correctif** : ne rendre le jeton qu'à la boucle locale (`estLocale` et origine admise), sinon répondre 503 ; test depuis une adresse non locale. **Acceptation** : la sonde `securite-dyn` ne signale plus `SD-PRISE-DE-COMPTE`. En attendant une version corrigée : ne pas ouvrir Inko sur un réseau qu'on ne maîtrise pas.

#### SEC-15 🔴 Injection de code exécutée dans la bibliothèque · effort S

**Preuve** : un favori dont l'identifiant d'œuvre contient une balise fait **exécuter** son code à l'ouverture de `bibliotheque.html`. **Cause** : `assets/js/bibliotheque.js`, `data-manga-id="${f.mangaId}"` sans échappement (le titre, juste à côté, est échappé). Les identifiants viennent des extensions de sources et des fichiers importés : un fichier de sauvegarde piégé ou une source compromise suffit, et le code agit avec la session ouverte. La politique de contenu autorise le script en ligne : elle ne l'arrête pas.

**Correctif** : `MH.esc()` sur cet attribut, refuser côté serveur les identifiants contenant `<`, `>`, guillemets ou espaces de contrôle, et généraliser le gabarit qui échappe par défaut (SEC-11).

#### SEC-16 🔴 Un jeton signé avec le secret public du code est accepté hors bureau et hors Docker · effort S

**Preuve** : sur une instance lancée depuis les sources avec le secret d'exemple, un jeton fabriqué avec la chaîne de repli écrite dans `server/lib/secret.js` obtient 200 sur `/api/auth/me` au nom d'un autre compte, sans session enregistrée. **Correctif** : tirer un secret au sort et le conserver dans tous les cas ; refuser tout jeton sans identifiant de session. Le fichier `server/.env` de cette machine est dans ce cas.

#### SEC-17 🟠 Se déconnecter ne ferme pas la session · effort S

`POST /api/auth/logout` efface le cookie ; le même jeton reste accepté ensuite, jusqu'à 30 jours. **Correctif** : supprimer la ligne de session correspondante.

#### SEC-18 🟠 Le relais d'images suit les redirections sans revérifier la destination · effort M

Seul le premier hôte est contrôlé ; `curl -L` suit ensuite jusqu'à quatre redirections. **Rejoué sur la fonction de téléchargement** : une redirection vers `127.0.0.1` est suivie et l'image interne rendue. La chaîne complète à travers la route n'a pas été jouée (il faut un domaine autorisé qui redirige : redirection ouverte ou source compromise). Les adresses internes demandées directement sont toutes refusées. **Correctif** : suivre les redirections une à une en revalidant chacune.

#### SEC-19 🟠 Des réglages de toute l'instance sont modifiables sans être administrateur · effort S

`POST /app/update`, `PUT /auth/google-config` et `PUT /anilist/config` n'exigent qu'une session. Un téléphone appairé, volontairement privé du rôle administrateur, peut donc changer l'identifiant de connexion Google de l'instance ou lancer la mise à jour. Constaté dans la déclaration des routes (non joué, ces routes modifient la machine). **Correctif** : `adminRequired`.

#### SEC-20 🟡 Un lien de réinitialisation sert plusieurs fois s'il est envoyé en parallèle · effort S

Six envois simultanés du même jeton ont tous réussi : lecture puis écriture sans verrou. **Correctif** : consommer le jeton par un `UPDATE … WHERE used = 0` avant de changer le mot de passe.

#### SEC-21 🟡 Un corps de 11 Mo est lu avant toute authentification · effort S

La limite de 12 Mo, posée pour l'import, vaut pour toutes les routes et s'applique avant le limiteur. **Correctif** : 100 ko par défaut, 12 Mo sur `/me/import` seulement.

#### SEC-22 🟡 La couverture d'une note accepte une adresse javascript: · effort S

Le filtre ajouté aux favoris et aux listes n'a pas été appliqué à `createNote`. **Correctif** : `couverture.brute()`.

#### SEC-23 🔵 Instance partagée : inscription toujours ouverte, adresses devinables · effort M

Aucune option pour fermer l'inscription ; la réponse « un compte existe déjà » et la réinitialisation révèlent les adresses inscrites.

#### 1.6.2 Données

#### DAT-15 🔴 La sauvegarde automatique ne contient pas toute la bibliothèque · effort M

**Preuve** : compte rempli, sauvegarde, tables vidées, restauration par le script prévu. Ne reviennent pas : signets, notes du carnet, liens AniList, temps de lecture, historique d'activité et de position, commentaires, abonnements aux notifications, corbeille. Reviennent amputés : la date d'ajout et le réglage de surveillance des favoris, le nombre de pages et la date de la progression, les couvertures des éléments de liste. **Dans la base réelle de cette machine, {{mesure:integrite.integrite_base_reelle_exposee.liens AniList}} liens AniList et {{mesure:integrite.integrite_base_reelle_exposee.lignes d historique}} lignes d'historique sont dans ce cas.**

**Correctif** : une seule liste des tables d'un compte, partagée par la sauvegarde, la restauration, l'export et l'import, et un test qui échoue dès qu'une table portant `user_id` n'y figure pas.

#### DAT-16 🔴 Exporter puis réimporter son compte perd les listes, les réglages, les signets et les notes · effort M

L'export contient les listes et les réglages, **mais l'import les ignore** : seuls favoris, statuts, progression, chapitres lus et notes sur dix sont rétablis. Signets, notes du carnet, temps de lecture et liens AniList ne sont même pas exportés. La première passe avait déclaré cet aller-retour « sans perte » en ne comparant que les favoris : c'était faux.

#### DAT-17 🟡 Les migrations ne sont pas rejouables · effort S

Rejouées sur une base à jour, la migration 5 échoue (contrainte déjà présente) et bloque toutes les suivantes, contrairement à ce que dit son commentaire. Sur une base vide, elles échouent aussi sans `schema.sql`.

#### DAT-18 🟡 La base réelle diffère d'une installation neuve · effort S

Une table `spotify_accounts` subsiste (vide) avec des colonnes de jetons, et l'index `favorites (user_id, status)` d'une installation neuve y manque. **Correctif** : migration de réalignement.

#### API-14 🟡 Des saisies de mauvais type provoquent {{mesure:securite-dyn.securite_routes_cassees}} erreurs 500 · effort M

Un nombre à la place d'un pseudo ou d'un nom de liste, un tableau, `?limit=abc`, un identifiant non numérique : le serveur répond 500 et, hors production, renvoie le message SQL brut. Le détail route par route est dans l'annexe (`securite-dyn`). **Correctif** : un schéma de validation par route.

#### 1.6.3 Fonctions absentes ou inaccessibles

#### FON-01 🟠 La section Commentaires n'existe sur aucune page · effort M

`serie.js` sait publier, répondre, signaler, supprimer et paginer, mais `serie.html` n'a aucun des éléments attendus et rien ne lance le chargement. Les routes serveur et la modération sont donc inutilisables.

#### FON-02 🟠 Les recommandations « Pour toi » ne s'affichent jamais · effort S

`rendreReco()` (`accueil.js`) cherche `#shelfReco`, absent d'`accueil.html`, et s'arrête. La fonction est pourtant annoncée dans le README.

#### FON-03 🟠 Aucun écran de connexion, d'inscription ou de mot de passe · effort L

`API.auth.login`, `register`, `changePassword` et `requestReset` ne sont appelés nulle part ; deux boutons « Se connecter » pointent vers des pages absentes. Le mode multi-comptes documenté (Docker) est inaccessible par l'interface.

#### FON-04 🟠 Le propriétaire d'une installation locale ne peut pas supprimer son compte · effort S

Le compte est créé avec un mot de passe aléatoire, et la suppression l'exige. Déduit du code.

#### FON-05 🟡 Des fonctions du serveur sans aucun écran · effort L

Corbeille, annulation d'une migration de source, historique de position d'une série, toute l'administration, commentaires récents : voir la trouvaille `REF-FONCTION-SANS-ECRAN`. S'y ajoute du code cherchant des éléments disparus (calendrier de la semaine, sélection du catalogue).

#### 1.6.4 Robustesse face aux pannes

#### ROB-01 🟠 Une réponse illisible fait planter plusieurs pages · effort S

Quand le serveur répond 200 avec autre chose que du JSON (portail Wi-Fi d'hôtel, proxy), `api.js` rend `null` comme s'il s'agissait d'un succès : exceptions et messages du type « Cannot read properties of null » affichés à l'écran sur accueil, bibliothèque, collections, notifications, paramètres, statistiques et profil. **Cause unique** : traiter une réponse non JSON comme une erreur dans `request()`.

#### ROB-02 🟠 Des squelettes de chargement qui ne s'arrêtent jamais · effort S

Recherche (erreur 500 et réseau coupé) et bibliothèque (réseau coupé, sur un appareil sans copie locale) gardent leurs {{id:CHAOS-ATTENTE-SANS-FIN}} signalements d'attente sans message ni bouton « Réessayer ».

#### ROB-03 🟡 API lente : plusieurs pages restent vides sans rien indiquer · effort S

Avec 14 secondes de latence, la fiche série, une liste, une collection et un profil restent quasi blancs.
