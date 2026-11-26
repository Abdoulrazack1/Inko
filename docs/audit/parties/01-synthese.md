## 1. Synthèse exécutive

### 1.1 Le verdict en cinq phrases

> **Mise à jour des 25 et 26 novembre.** La plus grave d’abord : **sur un PC neuf sans MySQL, l’application 2.9.0 ne démarre jamais** (§1.8, DSK-10 et DSK-11). Trois passes bien plus profondes (§1.6 à §1.8) contredisent une partie de la première : prise de compte depuis le réseau local, code exécuté par un livre piégé ou une donnée de favori, filtre des contenus pour adultes qui se désactive, interface morte depuis un autre appareil, sauvegardes incomplètes, déploiement Docker inutilisable. **À lire avant le reste.**

Inko est une application **mûre sur beaucoup de points** : aucune route protégée ne s'ouvre à un visiteur anonyme ({{mesure:api-acces.acces_anonyme.routes_protegees_testees}} testées, {{mesure:api-acces.acces_anonyme.ouvertes}} ouverte), l'isolement entre comptes tient, la suppression de compte ne laisse rien, la connexion est freinée contre les essais répétés, et `npm audit` ne trouve aucune vulnérabilité en production. La première passe en tirait un jugement trop favorable : elle avait validé l'aller-retour export/import en ne comparant que les favoris.

Cinq problèmes structurels ressortent, par ordre de gravité :

1. **La bibliothèque peut être vidée en moins d'une minute, sans garde-fou ni retour arrière.** Le 9 novembre, 993 retraits de favoris ont été enregistrés en deux minutes pour le compte propriétaire ; le serveur les a tous acceptés. La sonde d'écriture a reproduit le mécanisme : 300 suppressions en 0,7 s, aucune limite, aucune corbeille. Seule la sauvegarde nocturne a sauvé les 495 séries (§3.1).
2. **Plus d'une couverture sur cinq ne s'affiche pas** (117 favoris sur 521 ≈ 22 % dépendent d'hôtes qui échouent ; {{mesure:couvertures.couvertures_taux_echec_pct}} % d'échec sur un échantillon de 80 couvertures réelles), et c'est systématique, pas aléatoire : *toutes* celles de MangaDex, de SushiScan et de NovelFull échouent. Le correctif prévu — chercher la couverture ailleurs (AniList, Kitsu, MangaDex API) — n'est pas encore écrit (§3.2).
3. **Le catalogue de sources est fragile.** Sur 9 sources, **2 passent la chaîne complète** (WeebCentral, NovelFull). WeebCentral porte à lui seul **391 des 521 favoris (75 %)** : s'il tombe, trois quarts de la bibliothèque devient illisible. Il n'y a que **3 sources de manga** (§9).
4. **Un serveur de développement se laisse lire par n'importe quel site web.** Sans `NODE_ENV=production`, le CORS réfléchit l'origine demandée *avec* les identifiants, et `/api/auth/local` rend le jeton de session à l'appelant. Démonstration faite : une page quelconque ouverte dans votre navigateur pendant que le serveur tourne peut lire votre jeton. Le serveur sert aussi la racine du dépôt (code, tests, documents) (§2).
5. **L'application est plus lourde et moins fluide qu'elle ne le devrait.** 2 Mo de JavaScript servis sans minification, 11 à 18 scripts bloquants par page, des décalages de mise en page très élevés en affichage bureau (CLS jusqu'à 0,81 sur le catalogue, 0,69 sur la bibliothèque), 6 800 nœuds DOM sur la bibliothèque sans virtualisation (§7).

À cela s'ajoutent des chantiers de fond qui ne sont pas urgents mais pèsent sur la vitesse d'évolution : deux fichiers de 3 800 et 2 900 lignes, **113 fichiers de test qui vérifient le texte du code plutôt que son comportement**, 338 chaînes françaises sans traduction anglaise, des défauts d'accessibilité mesurés (contraste, lien sans nom, aucun lien d'évitement sur 24 pages).

### 1.2 Tableau de bord

| Domaine | État | Ce qui le justifie |
|---|---|---|
| Installation neuve (Windows) | 🔴 à corriger | la base embarquée ne se crée pas, puis refuse la connexion (DSK-10, DSK-11) |
| Sécurité du compte | 🔴 à corriger | prise du compte propriétaire depuis le réseau (SEC-14) · injections exécutées (SEC-15, SEC-24) · secret de signature public hors bureau et Docker (SEC-16) |
| Protection des mineurs | 🔴 à corriger | le filtre des contenus pour adultes de SushiScan se désactive quand la source répond mal (SEC-28) |
| Déploiement réseau et Docker | 🔴 à corriger | interface morte depuis un autre appareil (OPS-06) · image sans sources, connexion impossible (OPS-07, OPS-08) |
| Contrôle d'accès | 🟠 à corriger | routes protégées fermées à l'anonyme et comptes isolés, mais un relais local ouvre le compte administrateur (SEC-30) |
| Sécurité du mode développement | 🟡 corrigé sur la branche | CORS réfléchi et dépôt servi : fermés sur `audit/s0-s1`, non publiés |
| Intégrité des données | 🔴 à corriger | sauvegarde et export incomplets (DAT-15, DAT-16) · corbeille et plafond écrits sur la branche |
| Couvertures | 🔴 à corriger | ≈ 22 % des favoris touchés, 18 favoris sans URL, aucun repli par œuvre |
| Sources / extensions | 🟠 fragile | 2/9 sources saines · 3 sources de manga · dépendance à WeebCentral (75 %) |
| Performance côté serveur | 🟢 excellent | p95 < 70 ms sous 6 clients simultanés sur toutes les routes locales · démarrage base vierge ≈ 3 s |
| Performance côté navigateur | 🟠 à améliorer | pas de minification · scripts bloquants · CLS élevé · DOM de 6 800 nœuds |
| Accessibilité | 🟡 correcte, perfectible | contraste (9 pages) · 24 pages sans lien d'évitement · cibles tactiles < 24 px |
| Internationalisation | 🟡 partielle | 75 % de couverture EN · deux langues seulement, mécanisme qui n'en admet pas une troisième |
| Qualité des tests | 🟡 large mais superficielle | **1 289 tests, 0 échec**, mais 113 fichiers testent le texte du source ; 84/151 routes jamais appelées par un test |
| CI / livraison | 🟢 bon | gardes de dérive (openapi, précache, hashes, Android 8) ; manque permissions, timeouts, audit de dépendances |
| Documentation | 🟢 bon | 0 lien cassé · README refait ; manque variables d'environnement documentées, gabarits de contribution |
| Mobile (Android) | 🟡 correct | `allowBackup` actif, SDK cible 35 OK, trafic en clair nécessaire mais trop large |
| Maintenabilité | 🟠 dette | `global.js` 3 790 lignes, `chapitre.js` 2 912 · fonctions de 140 à 284 lignes |

### 1.3 Ce qui est solide — et qu'il ne faut pas casser

Un audit qui ne dit que le négatif fait perdre du temps à refaire ce qui marche. Les sondes ont **confirmé** :

- **Contrôle d'accès** : aucune route protégée ouverte à l'anonyme ; JSON invalide → 400 ; corps de 13 Mo → 413 ; `file://`, boucle locale, formes détournées d'adresses internes et métadonnées cloud refusés par le relais d'images (hors redirections, SEC-18). Hors production, certaines erreurs 500 renvoient le message SQL brut (API-14).
- **Isolement** : un second compte ne voit pas les favoris du premier et ne peut pas les supprimer.
- **Suppression de compte** : cascade complète, 0 reste dans `favorites`, `progress`, `read_chapters`, `events`.
- **Limiteur de connexion** : depuis le réseau, refus au {{mesure:securite-dyn.securite_limite_connexion}}ᵉ essai.
- **Favoris** : export puis import les restitue, emoji et caractères CJK compris (le reste du compte, non : DAT-16).
- **Charge** : `/api/health` p95 27 ms · `/api/sources` 19 ms · `/api/me/favorites` (192 Ko) p95 69 ms · pages statiques 15–22 ms, 0 erreur sur 720 requêtes.
- **API de lecture** : 51 routes GET testées, **aucun 5xx**.
- **Démarrage sur une base vierge** préparée sur un MySQL existant : ≈ 3 s, migrations comprises. La base livrée avec l'application, elle, échoue (DSK-10).
- **Dépendances** : 0 vulnérabilité (`npm audit --omit=dev`, racine et serveur).
- **Sauvegardes** : 13 fichiers en rotation, la dernière date de moins de 24 h.
- **Suite de tests** : **1 289 tests exécutés, 0 échec** (1 008 front + 281 serveur), 165 fichiers + 14 scénarios e2e, gardes de dérive en CI.

### 1.4 Les quinze actions qui changent le plus de choses

Classées par *valeur ÷ effort*. Le détail et les dépendances sont au §16.

| # | Action | ID | Gravité | Effort |
|---|---|---|---|---|
| 0a | **Rendre l'application installable** : créer la base embarquée dans la bonne base, avec des comptes cohérents, et jouer une installation neuve en CI | DSK-10, 11 · SEC-33 | 🔴 | S |
| 0 | **Avant tout** : fermer la prise de compte, les injections et le secret public, rendre le filtre adulte sûr, réparer l'accès réseau, puis compléter sauvegarde et export | SEC-14, 15, 16, 24, 28, 30 · OPS-06 · DAT-15, 16 | 🔴 | M |
| 1 | Plafond de suppressions + corbeille 30 jours + sauvegarde avant suppression en masse (écrit sur la branche) | DAT-01 | 🔴 | M |
| 2 | Repli de couverture par œuvre (MangaDex API → AniList → Kitsu), écrit en base | COV-01 | 🔴 | M |
| 3 | CORS fermé par défaut (liste blanche locale) + ne servir que les fichiers publics | SEC-01, SEC-02 | 🔴 | S |
| 4 | Journal d'événements avec origine (appareil, agent, adresse) | DAT-02 | 🟠 | S |
| 5 | Réparer SushiScan, NovelBin, Chireads (recherche) ; contourner Gutendex lent | EXT-01…04 | 🟠 | M |
| 6 | Ajouter 3 sources de manga de redondance (MangaKatana, Mangapill, Bato) | EXT-10 | 🟠 | L |
| 7 | Minifier le JS/CSS au build web et desktop (esbuild déjà présent) | PER-01 | 🟠 | M |
| 8 | `defer` sur les scripts non critiques, ordre préservé | PER-02 | 🟠 | S |
| 9 | Réserver la place des grilles et images (CLS 0,4–0,8 → < 0,1) | PER-03 | 🟠 | M |
| 10 | Virtualiser la grille de bibliothèque (6 800 → ≈ 800 nœuds) | PER-04 | 🟠 | L |
| 11 | Remplacer `bulkDelete` séquentiel par un appel serveur unique et annulable | DAT-03 | 🟠 | M |
| 12 | Import : valider la forme (500 → 400) ; refuser `javascript:` en couverture | API-01, SEC-05 | 🟠 | S |
| 13 | Contrastes (9 pages) + lien d'évitement + libellés manquants | A11Y-01…04 | 🟡 | M |
| 14 | Aligner la version du serveur (2.5.7 → 2.9.0) et l'imposer en release | DEP-01 | 🟡 | S 🤖 |
| 15 | Convertir les tests « lisent le source » des modules critiques en tests de comportement | TST-01 | 🟡 | XL |
