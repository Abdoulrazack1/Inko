## 10. Plateformes : Android, Windows, auto-hébergement

### 10.1 Android (Capacitor, WebView ≥ Chrome 61)

**Mesuré** : SDK minimum 26 (Android 8), cible/compilation **35** (conforme à l'exigence actuelle de Google Play) ; **4 permissions seulement** (`INTERNET`, `VIBRATE`, `CHANGE_WIFI_MULTICAST_STATE`, `ACCESS_NETWORK_STATE`) — aucune permission sensible (stockage, localisation, contacts, caméra, micro) ; aucune activité/service **sans `android:exported`** ; version dérivée de la racine (`versionMobile` 1.4.1, `versionCodeMobile` 10300) avec garde CI.

#### MOB-01 🟠 `android:allowBackup="true"` : le jeton de session et le miroir de bibliothèque partent dans les sauvegardes Google · effort S 🤖

Les données de l'application (cookies, `localStorage` : jeton, miroir des favoris, préférences) sont incluses dans la sauvegarde automatique Android et **restaurées sur un autre appareil**, y compris un jeton de session valide. **Correctif** : `allowBackup="false"` (le correcteur `allowbackup` le fait) **ou**, plus fin, `dataExtractionRules` qui n'excluent que `localStorage` des sessions. À noter : la bibliothèque est déjà synchronisée par le hub ; la perdre au changement de téléphone est moins grave qu'un jeton recopié.

#### MOB-02 🟡 Le trafic en clair est autorisé partout · effort M

`usesCleartextTraffic="true"` et Capacitor `server.cleartext` sont nécessaires pour parler au hub **sur le réseau local** (`http://192.168.x.x:8088`), mais s'appliquent à **tous les domaines**. **Correctif** : `network_security_config.xml` n'autorisant le clair **que** pour `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` et `*.local` ; HTTPS obligatoire ailleurs. (Le texte de `confidentialite.html` affirme déjà que la configuration réseau « interdit nommément le trafic en clair vers ces domaines » : **le rendre vrai pour tous les domaines publics**.)

#### MOB-03 🟡 `allowMixedContent: true` · effort M

Permet de charger des images `http://` depuis une page chargée en `https://`. Avec le proxy d'images du hub (`/api/img`), **toutes** les couvertures passent par le hub : la dérogation devient inutile. À retirer après COV-01.

#### MOB-04 🟡 Aucune distribution « normale » · effort L

L'APK se récupère sur GitHub (`Inko-1.4.1.apk`) : installation manuelle, « sources inconnues », **pas de mise à jour automatique**. **Options** : (1) **F-Droid** (dépôt auto-hébergé ou officiel : le projet est sous Apache-2.0, sans dépendance propriétaire hormis FCM optionnel) ; (2) Google Play (AAB signé, fiche, politique de confidentialité existante, déclaration « sécurité des données ») ; (3) à défaut, **vérification de version dans l'app** (comme le bureau : `api.github.com/releases/latest`) avec lien et empreinte.

#### MOB-05 🟡 Notifications push : `push-fcm.js` (149 lignes) n'a aucun test · effort M

La sonde `tests` signale `TEST-SERVEUR-NON-TESTE`. Le chemin « nouveau chapitre → notification sur le téléphone » est l'une des raisons d'être de l'app mobile. **Correctif** : test avec un faux FCM (serveur HTTP local) : envoi, jeton révoqué (`UNREGISTERED` → suppression), limite de débit, charge utile minimale (pas de titre d'œuvre sensible dans un écran verrouillé : option).

#### MOB-06 🟡 Aucune mesure de fluidité sur la cible la plus contrainte · effort M

Voir PER-12. `android-emulateur.yml` et `mesure-demarrage.js` existent ; ajouter LCP/TBT et un **budget** qui fait échouer la CI.

#### MOB-07 🔵 Édition bord à bord (Android 15) · effort M

À partir du SDK cible 35, le système impose le dessin sous les barres. Le projet a déjà un historique douloureux (« `inset`, `aspect-ratio`, `env()` ignorés par WebView 8 ») : **ajouter** un jeu de captures de référence (émulateurs API 26 et 35, clair/sombre) comparé à chaque PR touchant le CSS global.

#### MOB-08 🔵 Dépendances Capacitor signalées « inutilisées » : faux positif

Les 10 plugins (`@capacitor/android`, `app`, `core`, `device`, `filesystem`, `haptics`, `network`, `push-notifications`, `screen-orientation`, `status-bar`) sont consommés par la synchronisation native (`cap sync`), pas par `require()`. À conserver ; le test à ajouter : **toutes alignées sur la même version majeure** (aujourd'hui `^8.6.0`).

### 10.2 Windows (Tauri 2, NSIS, MariaDB embarquée)

**Mesuré** : une seule cible (`nsis`), identifiant `app.inko.reader`, fenêtre 1 440 × 920, **66 Mo** de ressources embarquées (frontend + serveur + MariaDB), démarrage sur base vierge ≈ 3–4 s.

#### DSK-01 🟠 L'installateur n'est pas signé · effort M

Aucune configuration de signature (`signCommand`, certificat) dans `tauri.conf.json` ni `release.yml`. Windows affiche **« Windows a protégé votre PC »** (SmartScreen) à chaque nouvelle version tant que la réputation n'est pas établie ; certains antivirus mettent en quarantaine. Pour un programme qui se **réinstalle seul** (flux `/app/update`), c'est aussi une faiblesse de confiance.

**Correctif** : signature Authenticode via **Azure Trusted Signing** ou **SignPath.io** (gratuit pour les projets open source) dans `release.yml` ; vérifier la signature **avant** de lancer l'installateur téléchargé (en plus du SHA-256, qui provient de la même release).

#### DSK-02 🟡 Mise à jour : solide mais auto-référente · effort M

Le flux `update.controller.js` est **bien pensé** : reprise de téléchargement (`curl -C -`), morceau marqué par son URL (jamais repris sur une autre version), empreinte vérifiée, deux délais distincts, nettoyage du morceau invalide. **Limite** : la somme de contrôle et l'installateur viennent **du même dépôt** — un dépôt compromis publie les deux. **Correctif** : mises à jour **signées** (plugin Tauri updater + clé minisign dont la clé publique est dans l'app, ou signature Authenticode vérifiée) ; **notes de version affichées dans l'app** avant d'installer ; **sauvegarde de la base avant** la mise à jour (DAT-06) ; possibilité de **revenir** à la version précédente.

#### DSK-03 🟡 La CSP de la fenêtre est large · effort S

`img-src … https:` et `connect-src … https:` : voir SEC-03. Restreindre à `http://127.0.0.1:8088`.

#### DSK-04 🟡 Windows seulement · effort L

Tauri construit aussi pour **macOS** (`.dmg`) et **Linux** (`.AppImage`, `.deb`). Le serveur embarque MariaDB (binaire par plate-forme) : ajouter une matrice de CI qui produit les trois, avec `INKO_DB_FALLBACK` (SQLite ou MariaDB système) pour les plates-formes sans binaire embarqué. Audience : lecteurs sur Mac et Linux (Steam Deck inclus, **lecteur de manga idéal**).

#### DSK-05 🟡 Pas de lancement au démarrage ni de zone de notification · effort M

Le scan de nouveaux chapitres et les notifications ne tournent que **application ouverte**. **Option** : icône de zone de notification, « lancer avec Windows » (réglage), scan en arrière-plan toutes les 3 h, notification native « 3 nouveaux chapitres ». C'est le chaînon manquant entre « lecteur » et « suivi ».

#### DSK-06 🔵 Intégrité de la base embarquée · effort M

`CHECK TABLE` au démarrage, **dump automatique avant chaque mise à jour de l'app**, restauration guidée si la base est corrompue (aujourd'hui `restore-backup.js` est un script en ligne de commande, pas une action de l'interface — **§3.1 en a eu besoin**). Un bouton « Restaurer depuis une sauvegarde » dans Paramètres › Données, avec aperçu (`previewBackup` existe).

### 10.3 Auto-hébergement (Docker, Caddy)

**Mesuré** : conteneur **non root** et `HEALTHCHECK` présents (aucun `PLT-DOCKER-ROOT`) ; `JWT_SECRET` **obligatoire** (le démarrage échoue sans lui) ; Caddy : HSTS 180 jours, `nosniff`, `no-referrer`, `X-Frame-Options: DENY`, en-tête `Server` supprimé, certificat automatique.

#### OPS-01 🟠 Les inscriptions sont ouvertes à tous en mode multi-comptes · effort S

Avec `LOCAL_MODE=0`, `POST /auth/register` accepte **n'importe qui** (mots de passe à politique, mais pas de verrou). Une instance exposée devient une **plateforme d'inscription publique** (commentaires, listes publiques, stockage). **Correctif** : `REGISTRATION=open|invite|closed` (défaut **closed** hors mode local) ; liens d'invitation à usage unique générés par l'administrateur ; vérification d'e-mail si `mailer` est configuré.

#### OPS-02 🟡 Images de base à étiquette flottante · effort S

`FROM node:…` sans empreinte ; `mysql:8`. **Correctif** : épingler par `@sha256:` et ajouter l'écosystème `docker` à `dependabot.yml` (absent, comme `gradle`).

#### OPS-03 🟡 Aucune stratégie de sauvegarde hors machine · effort S

Les sauvegardes JSON vont dans un volume du même hôte. **Correctif** : documenter (et fournir dans `docker-compose.caddy.yml`) un service `backup` (`restic`/`rclone` vers un stockage distant, rétention 30 j), et **tester la restauration** en CI (`essai-migrations.js` sait déjà monter une base de test).

#### OPS-04 🟡 Pas d'observabilité · effort M

Aucune métrique, journaux non structurés (API-08, API-09). Pour un hub exposé : `GET /api/instance/metrics` (format Prometheus) et un exemple de tableau de bord.

#### OPS-05 🔵 Pas de CSP derrière Caddy · effort S

Caddy pose les en-têtes « HTTPS » mais l'app pose la CSP seulement en production (`NODE_ENV=production` est bien dans `docker-compose.yml`) ; **vérifier en production** (sonde `api-acces` lancée sur l'instance déployée) que l'en-tête est bien émis.

### 10.4 Ce qui est bien et à conserver

Garde-fous de build : `verifier-android8` (CSS/JS compatibles Chrome 61), `verifier-apk`, `verifier-installeur`, `verifier-java-android` · hub découvert en **mDNS** avec **identité** (`hubId`) pour ne pas se connecter au hub du voisin · appairage par code · miroir local de la bibliothèque + téléchargements hors ligne · `INKO_DB_FALLBACK` · secret JWT **par installation** en desktop · mot de passe MariaDB par installation.
