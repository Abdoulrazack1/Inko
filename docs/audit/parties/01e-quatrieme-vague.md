### 1.8 Quatrième vague : installation neuve, exposition réseau, synchronisation, migration

Sondes ajoutées : `base-embarquee`, `exposition`, `nouveautes`, `migration`, `coquille`.

#### 1.8.1 Urgences

#### DSK-10 🔴 Sur un PC neuf sans MySQL, la base ne se crée pas : l'application ne démarre jamais · effort S

**Preuve**, avec le code, le Node et la MariaDB de l'application 2.9.0 **installée**, dans un profil vierge : « base vierge : application du schéma complet… » puis `No database selected`. **Cause** : `ensureSchemaOn` (`server/lib/embedded-db.js`) joue `schema.sql` sur une connexion qui ne choisit aucune base, et le fichier n'en choisit plus depuis la 2.5.0. Les installations déjà initialisées, ou reliées à un MySQL rempli, ne le voient pas : c'est pourquoi rien ne s'est signalé ici. **Correctif** : passer `database: DB_NAME` à cette connexion. **Critère d'acceptation** : un essai d'installation neuve dans la CI, avant chaque publication.

#### DSK-11 🔴 Même la structure en place, l'application se voit refuser la connexion à sa base neuve · effort S

**Preuve** : structure posée à la main, second démarrage : `Access denied for user 'root'@'127.0.0.1' (using password: YES)`. **Cause** : le mot de passe n'est posé que sur `root@localhost`, alors que, résolution de noms désactivée, l'application arrive comme `root@127.0.0.1`, resté sans mot de passe. Le même code est présent depuis la 2.3.4. **Correctif** : traiter tous les comptes `root` (ou n'en garder qu'un), puis vérifier par une vraie reconnexion. **DSK-10 et DSK-11 se cumulent** : les corriger ensemble. Chez vous, l'application installée utilise le MySQL de Laragon ; son repli sur la base embarquée, quand Laragon est arrêté, suit ce même code (déduit, non éprouvé sur vos données).

#### SEC-30 🔴 Derrière un relais installé sur la même machine, n'importe qui devient administrateur · effort S

**Preuve** : depuis l'adresse réseau, en direct, la connexion automatique est refusée (403) ; par un relais local qui transmet `X-Forwarded-For`, elle rend un jeton administrateur, sans mot de passe. **Cause** : sans `TRUST_PROXY`, le serveur ne voit que la boucle locale (`lib/reseau.js`). Concerne Caddy, nginx ou un tunnel lancés sur la machine qui héberge Inko ; la configuration Docker fournie pose `TRUST_PROXY`. **Correctif** : traiter comme distante toute requête portant un en-tête de relais non local, et le documenter.

#### SEC-31 🟠 Le serveur répond à n'importe quel nom d'hôte, jeton de réinitialisation compris · effort S

**Preuve** : une requête locale annonçant l'hôte et l'origine d'un autre nom de domaine reçoit les pages, et `/api/auth/forgot` rend le jeton (la connexion automatique, elle, est refusée). Un site dont le domaine est redirigé vers 127.0.0.1 pourrait ainsi prendre le compte ; la protection d'accès au réseau local des navigateurs n'a pas été éprouvée. **Correctif** : liste des noms d'hôte admis, et celui de SEC-14.

#### SEC-32 🟠 Une page d'un autre port du même hôte peut effacer l'historique de lecture · effort S

**Preuve** : après une visite d'Inko, un formulaire vide envoyé depuis un autre serveur local à `/api/me/clear-history` efface positions, chapitres lus et activité. Le cookie accompagne la requête (les ports ne comptent pas pour « SameSite »), l'origine n'est pas vérifiée et un corps absent signifie « tout ». **Correctif** : exiger un corps JSON ou un en-tête propre à l'application pour toute écriture par cookie.

#### SEC-33 🟠 La base embarquée garde des comptes administrateur sans mot de passe · effort S

`root@127.0.0.1`, `root@::1` et le compte au nom de la machine restent ouverts à tout programme local, alors que le journal annonce « mot de passe root posé ». L'écoute est bien limitée à la machine.

#### FON-07 🟠 Au-delà de cinq séries, les nouveaux chapitres ne sont jamais annoncés · effort S

**Preuve** : douze séries avec un chapitre de plus, trois passages de la tâche de fond : cinq annonces, puis plus aucune. Le même passage enregistre le dernier chapitre des douze ; les sept restantes ne sont plus « nouvelles », contrairement à ce que dit le commentaire du code. **Correctif** : n'enregistrer qu'après l'annonce, ou regrouper.

#### DAT-21 🟠 Un appareil à l'heure fausse fige la position sur tous les autres · effort S

**Preuve** : un enregistrement daté d'un an dans le futur, puis un enregistrement normal : réponse « réussi », position inchangée. Une date très lointaine provoque une erreur 500. **Correctif** : borner la date du client à celle du serveur.

#### DAT-22 🟠 Changer de source laisse la série hors de ses listes et sans son historique · effort M

Listes, historique des positions, activité et commentaires restent attachés à l'ancienne série.

#### DAT-23 🟠 « Annuler » une migration ne rend pas l'état d'avant · effort S

**Preuve** : les notes des signets disparaissent, une série en sourdine se remet à notifier, la date d'ajout et les dates de lecture deviennent celles de l'annulation. **Correctif** : photographier et restaurer toutes les colonnes.

#### DAT-24 🟠 Windows : sauvegardes, fichiers importés et clés sont dans le dossier d'installation · effort M

**Constaté sur l'application installée** (sauvegardes dans `resources\server\backups`). Le lanceur ne fixe pas leur emplacement, contrairement à ce qu'annonce le code de la base (« jamais dans le dossier d'installation »). Leur sort à la désinstallation n'a pas été éprouvé. **Correctif** : `%APPDATA%\Inko`, avec déplacement de l'existant.

#### DAT-25 🟠 Docker : fichiers importés et sauvegardes disparaissent à chaque mise à jour · effort S

Le service de l'application n'a aucun volume. Déduit de la configuration.

#### DSK-12 🟠 N'importe quel programme sur le port 8088 s'affiche dans la fenêtre d'Inko · effort M

**Preuve** : l'écran de démarrage accepte une réponse vide « réussie » d'un faux serveur et ouvre sa page ; les droits de fenêtre sont accordés à tout ce qui répond à cette adresse. Un second serveur Inko (développement) suffit à afficher une autre bibliothèque. **Correctif** : un secret propre à chaque lancement, vérifié avant d'ouvrir.

#### 1.8.2 À corriger ensuite

#### SEC-34 🟡 Les notifications peuvent être envoyées vers n'importe quelle adresse, interne comprise · effort S

Un compte enregistre une adresse de la machine ; le serveur s'y connecte au scan suivant.

#### DSK-13 🟡 La protection SmartScreen du moteur d'affichage est désactivée · effort S

#### DAT-26 🟡 Le chapitre 0 est enregistré sans numéro · effort S

#### DAT-27 🟡 La restauration en ligne de commande ne lit pas les sauvegardes de l'application de bureau · effort S

La phrase de chiffrement est dans `%APPDATA%\Inko` ; le script n'accepte que `BACKUP_PASSPHRASE`. La restauration depuis l'application, elle, la connaît.

#### 1.8.3 Ce qui a tenu, et un raté de ma part

La base embarquée n'écoute que sur la machine et refuse les connexions anonymes. La migration entre sources reporte favori, position, chapitres appariés, note et avis, signale les chapitres introuvables, et son annulation rend positions, avis et notes de carnet.

En vérifiant le chargement d'un fichier, j'ai lancé par erreur la campagne complète des sondes. Arrêtée après environ une minute ; elle n'avait créé que des bases et des dossiers d'essai, supprimés ensuite. Base réelle, profil, configuration et code vérifiés inchangés ; résultats précédents restaurés.
