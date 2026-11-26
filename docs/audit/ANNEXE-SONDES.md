# Annexe — résultats bruts des sondes

> Généré le 2026-11-25 par `scripts-ci/sondes/`. 930 trouvailles. Document régénérable : ne pas éditer à la main.

## Tableau de bord

| Sonde | Durée | Trouvailles | 🔴 | 🟠 | 🟡 | 🔵 | ⚪ |
|---|---:|---:|---:|---:|---:|---:|---:|
| structure | 1.9 s | 26 | · | 2 | 21 | 3 | · |
| ecouteurs | 0.2 s | 3 | · | · | 3 | · | · |
| securite | 58.9 s | 63 | · | 11 | 39 | 13 | · |
| routes | 1.3 s | 8 | · | 1 | 4 | 3 | · |
| sql | 0.6 s | 16 | · | · | 11 | 5 | · |
| erreurs | 0.6 s | 7 | · | · | 3 | 4 | · |
| a11y-html | 0.7 s | 39 | · | · | 11 | 28 | · |
| css | 3.8 s | 14 | · | · | 4 | 10 | · |
| i18n | 11.9 s | 2 | · | · | · | 1 | 1 |
| perf-statique | 2.2 s | 38 | · | · | 24 | 14 | · |
| code-mort | 46.2 s | 11 | · | · | · | 11 | · |
| dependances | 101.0 s | 12 | · | · | · | 12 | · |
| tests | 0.8 s | 7 | · | · | 4 | 3 | · |
| plateformes | 0.2 s | 5 | · | · | 2 | 3 | · |
| docs | 1.1 s | 6 | · | · | · | 5 | 1 |
| ci | 0.1 s | 14 | · | · | 1 | 13 | · |
| extensions | 109.8 s | 8 | · | 4 | 3 | 1 | · |
| donnees | 2.4 s | 2 | · | 2 | · | · | · |
| couvertures | 44.6 s | 3 | 3 | · | · | · | · |
| api-acces | 4.6 s | 2 | · | · | · | 2 | · |
| api-contrat | 27.1 s | 0 | · | · | · | · | · |
| flux-ecriture | 44.0 s | 3 | · | 1 | 1 | · | 1 |
| pages | 256.5 s | 41 | · | 17 | 23 | 1 | · |
| boutons | 1504.2 s | 88 | · | 4 | 27 | 57 | · |
| analyse | 30.6 s | 31 | · | · | 23 | 8 | · |
| certificats | 4.7 s | 1 | · | · | 1 | · | · |
| chaos | 327.9 s | 44 | · | 23 | 21 | · | · |
| integrite | 54.3 s | 8 | 2 | · | 3 | 2 | 1 |
| securite-dyn | 125.7 s | 31 | 3 | 5 | 21 | 2 | · |
| lecteur | 229.9 s | 6 | · | 1 | 5 | · | · |
| interaction | 705.7 s | 47 | · | 11 | 19 | 17 | · |
| references | 73.1 s | 27 | · | 4 | 17 | 6 | · |
| mobile | 390.0 s | 78 | · | 20 | 50 | 8 | · |
| parcours | 1402.9 s | 114 | · | 25 | 74 | 15 | · |
| xss | 98.3 s | 2 | 1 | · | 1 | · | · |
| charge | 342.0 s | 37 | · | 2 | 5 | 30 | · |
| imports | 84.9 s | 6 | 1 | 2 | 1 | 2 | · |
| modes | 276.4 s | 4 | 2 | · | 2 | · | · |
| hors-ligne | 134.3 s | 11 | · | 2 | 9 | · | · |
| livraison | 5.0 s | 5 | 2 | 3 | · | · | · |
| mise-a-niveau | 47.8 s | 1 | · | · | 1 | · | · |
| exactitude | 25.6 s | 2 | · | 1 | · | 1 | · |
| appareils | 35.6 s | 3 | · | 1 | 2 | · | · |
| administration | 11.3 s | 7 | · | 2 | 3 | 2 | · |
| licences | 0.1 s | 2 | · | · | 1 | · | 1 |
| resilience | 398.9 s | 5 | · | 1 | 4 | · | · |
| vie-privee | 153.0 s | 2 | · | · | 2 | · | · |
| adaptabilite | 210.6 s | 16 | · | · | 14 | 2 | · |
| filtre-adulte | 2.0 s | 1 | 1 | · | · | · | · |
| autonome | 199.3 s | 3 | · | · | 3 | · | · |
| exposition | 29.8 s | 3 | 1 | 2 | · | · | · |
| nouveautes | 34.6 s | 4 | · | 2 | 2 | · | · |
| migration | 16.8 s | 3 | · | 2 | 1 | · | · |
| base-embarquee | 6.0 s | 3 | 2 | 1 | · | · | · |
| coquille | 6.6 s | 5 | · | 3 | 2 | · | · |
| **Total** | | **930** | 18 | 155 | 468 | 284 | 5 |

## Mesures relevées

### structure

- **inventaire** : {".html":{"fichiers":63,"lignes":263217},".css":{"fichiers":27,"lignes":9260},".js":{"fichiers":367,"lignes":77676}}
- **marqueurs_dette** : 4

### ecouteurs

- **ecouteurs_apres_attente** : ["assets/js/lecture.js:118 → 2 branchement(s) après","assets/js/notifications.js:46 → 1 branchement(s) après","assets/js/profil.js:1231 → 1 branchement(s) après"]

### securite

- **innerHTML_total** : 340
- **innerHTML_interpolations_a_verifier** : 103
- **fichiers_suivis_git** : 683
- **npm_audit_racine** : {"info":0,"low":0,"moderate":0,"high":0,"critical":0,"total":0}
- **npm_audit_serveur** : {"info":0,"low":0,"moderate":0,"high":0,"critical":0,"total":0}

### routes

- **routes_total** : 156
- **routes_stats** : {"auth":{"aucune":35,"session":108,"local":1,"admin":9,"optionnelle":3},"limiteur":41,"methodes":{"GET":77,"POST":47,"PUT":18,"DELETE":14}}
- **routes_ecriture_sans_limiteur** : 56
- **openapi_chemins** : 136
- **params_sans_validation_visible** : 49

### sql

- **tables** : 29
- **requetes_sql_dans_le_code** : 336
- **select_etoile** : 25
- **like_joker_tete** : 3
- **migrations** : 28

### erreurs

- **erreurs_bilan** : {"catchVides":170,"catchAvales":11,"consoleLog":60,"thenSansCatch":1,"intervalles":20,"ecouteursGlobaux":7,"fetchSansOk":1}
- **handlers_async_sans_try** : 0

### a11y-html

- **pages_html** : 26
- **a11y_img_sans_alt** : 0
- **a11y_boutons_muets** : 1
- **a11y_champs_sans_label** : 5
- **a11y_div_cliquables_js** : 2
- **css_outline_none** : 23
- **css_focus_visible** : 41
- **keyframes** : 16
- **reduced_motion_css** : 13
- **reduced_motion_js** : 7

### css

- **variables_css_definies** : 126
- **css_bilan** : {"octets":437421,"regles":2799,"important":50,"couleursLitterales":406,"pxFont":142,"vh100":3,"zindexMax":10000,"zindexDistincts":24}
- **css_par_feuille_ko_imp_couleurs** : [["assets/css/global.css",118,18,177],["assets/css/chapitre.css",46,23,64],["assets/css/profil.css",38,2,14],["assets/css/serie.css",30,1,8],["assets/css/bibliotheque.css",27,0,8],["assets/css/catalogue.css",21,0,1],["assets/css/accueil.css",16,3,7],["assets/css/collections.css",15,0,24],["assets/css/notes.css",15,1,3],["assets/css/fonts.css",14,0,0],["assets/css/lecture.css",12,0,14],["assets/css/collection-detail.css",11,1,6],["assets/css/music.css",10,0,48],["assets/css/parametres.css",8,1,10],["assets/css/recherche.css",8,0,6],["assets/css/sources.css",7,0,9],["assets/css/import.css",5,0,3],["assets/css/stats.css",5,0,0],["assets/css/notifications.css",4,0,2],["assets/css/systeme.css",4, …
- **classes_css_declarees** : 1516
- **classes_css_sans_usage_visible** : 287
- **css_recents** : {"gap":473,"aspectRatio":15,"inset":15,"isWhereHas":3}

### i18n

- **check_i18n_code_sortie** : 0
- **couverture_i18n_pct** : 76
- **i18n_entrees** : 1518
- **i18n_cles_orphelines** : 5

### perf-statique

- **pages_poids** : [{"page":"chapitre.html","scripts":18,"js_ko":617,"css_ko":192,"bloquants":18},{"page":"bibliotheque.html","scripts":17,"js_ko":587,"css_ko":154,"bloquants":17},{"page":"serie.html","scripts":15,"js_ko":582,"css_ko":159,"bloquants":15},{"page":"catalogue.html","scripts":14,"js_ko":516,"css_ko":148,"bloquants":14},{"page":"downloads.html","scripts":12,"js_ko":511,"css_ko":129,"bloquants":12},{"page":"accueil.html","scripts":16,"js_ko":481,"css_ko":143,"bloquants":16},{"page":"profil.html","scripts":11,"js_ko":480,"css_ko":166,"bloquants":11},{"page":"import.html","scripts":10,"js_ko":460,"css_ko":131,"bloquants":10},{"page":"lecture.html","scripts":11,"js_ko":455,"css_ko":154,"bloquants":11}, …
- **js_applicatif_ko** : 1818
- **precache** : {"entrees":0,"ko":0}
- **polices_fichiers** : 27
- **captures_ko** : 8885

### code-mort

- **js_non_references** : []
- **mh_exposes** : 94
- **mh_exposes_jamais_lus** : 6

### dependances

- **versions** : {"racine":"2.9.0","serveur":"2.9.0","tauri_package":"2.9.0","tauri_conf":"2.9.0","cargo":"2.9.0","mobile":"1.4.1"}
- **npm_outdated_racine** : {"total":7,"majeures":0}
- **npm_outdated_serveur** : {"total":5,"majeures":1}
- **android** : {"versionCode":null,"versionName":null}

### tests

- **fichiers_tests** : {"unit":141,"serveur":28,"e2e":14}
- **tests_total_approx** : 1564
- **tests_qui_lisent_le_source** : 114
- **front_sans_test_nomme** : 2
- **serveur_sans_test_nomme** : 5
- **pages_sans_e2e** : []
- **routes_non_citees_par_un_test** : 89

### plateformes

- **android_permissions** : ["android.permission.INTERNET","android.permission.VIBRATE","android.permission.CHANGE_WIFI_MULTICAST_STATE","android.permission.ACCESS_NETWORK_STATE"]
- **android_sdk** : {"min":26,"target":35,"compile":35}
- **tauri_csp** : "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https: http://127.0.0.1:8088; connect-src 'self' https: http://127.0.0.1:8088; font-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
- **csp_serveur_unsafe_inline** : 5
- **sw_cache** : inko-2.9.0-7580aa

### docs

- **documents_md** : 28
- **liens_casses** : 0
- **env_lues** : 77
- **env_non_documentees** : ["FAV_SUPPRESSION_MAX","FAV_SUPPRESSION_FENETRE_MS","COVER_SOURCE_TIMEOUT_MS"]
- **captures** : {"presentes":10,"referencees":5}

### ci

- **workflows** : [".github/workflows/android-emulateur.yml",".github/workflows/android-release.yml",".github/workflows/android.yml",".github/workflows/ci.yml",".github/workflows/release.yml",".github/workflows/sources-health.yml"]

### extensions

- **extensions** : ["chireads","gutenberg","gutenberg-fr","mangadex","novelbin","novelfull","royalroad","sushiscan","weebcentral"]
- **ext_chireads** : {"lignes":273,"appels":12,"roman":true}
- **ext_gutenberg** : {"lignes":234,"appels":1,"roman":true}
- **ext_gutenberg-fr** : {"lignes":232,"appels":1,"roman":true}
- **ext_mangadex** : {"lignes":323,"appels":8,"roman":false}
- **ext_novelbin** : {"lignes":470,"appels":16,"roman":true}
- **ext_novelfull** : {"lignes":368,"appels":16,"roman":true}
- **ext_royalroad** : {"lignes":285,"appels":15,"roman":true}
- **ext_sushiscan** : {"lignes":925,"appels":19,"roman":false}
- **ext_weebcentral** : {"lignes":386,"appels":14,"roman":false}
- **extensions_par_type** : {"manga":["mangadex","sushiscan","weebcentral"],"livre":["chireads","gutenberg","gutenberg-fr","novelbin","novelfull","royalroad"]}
- **bac_a_sable** : {"chireads":{"statut":200,"ms":1542,"etapes":["recherche « reine »:KO(1394ms)"],"ok":false},"gutenberg":{"statut":200,"ms":24525,"etapes":["recherche « dracula »:ok(14393ms)","fiche de l’œuvre:ok(2935ms)","liste des chapitres:ok(0ms)","texte du chapitre:KO(7143ms)"],"ok":false},"gutenberg-fr":{"statut":200,"ms":52227,"etapes":["recherche « victor hugo »:ok(11906ms)","fiche de l’œuvre:KO(20083ms)","liste des chapitres:ok(0ms)","texte du chapitre:KO(20191ms)"],"ok":false},"mangadex":{"statut":200,"ms":1750,"etapes":["recherche « one piece »:ok(362ms)","fiche de l’œuvre:ok(639ms)","liste des chapitres:ok(280ms)","pages du chapitre:KO(322ms)"],"ok":false},"novelbin":{"statut":200,"ms":3515,"etap …
- **sante_serveur** : [{"id":"chireads","name":"Chireads","okAt":null,"failAt":null,"error":null,"oks":0,"fails":0,"streak":0,"videAt":null,"vides":0},{"id":"gutenberg","name":"Project Gutenberg","okAt":null,"failAt":null,"error":null,"oks":0,"fails":0,"streak":0,"videAt":null,"vides":0},{"id":"gutenberg-fr","name":"Livres en français","okAt":null,"failAt":null,"error":null,"oks":0,"fails":0,"streak":0,"videAt":null,"vides":0},{"id":"mangadex","name":"MangaDex","okAt":null,"failAt":null,"error":null,"oks":0,"fails":0,"streak":0,"videAt":null,"vides":0},{"id":"novelbin","name":"NovelBin","okAt":null,"failAt":null,"error":null,"oks":0,"fails":0,"streak":0,"videAt":null,"vides":0},{"id":"novelfull","name":"NovelFull …

### donnees

- **tables_vivantes** : ["events: ~7338 lignes, 1920 Ko","favorites: ~521 lignes, 176 Ko","notifications: ~46 lignes, 96 Ko","sessions: ~104 lignes, 96 Ko","comments: ~1 lignes, 80 Ko","device_push_tokens: ~0 lignes, 64 Ko","reports: ~0 lignes, 64 Ko","users: ~26 lignes, 64 Ko","pair_codes: ~1 lignes, 48 Ko","push_subscriptions: ~0 lignes, 48 Ko","read_chapters: ~134 lignes, 48 Ko","reading_notes: ~0 lignes, 48 Ko","bookmarks: ~1 lignes, 32 Ko","devices: ~2 lignes, 32 Ko","lists: ~1 lignes, 32 Ko","local_imports: ~0 lignes, 32 Ko","progress_history: ~85 lignes, 32 Ko","ratings: ~1 lignes, 32 Ko","reading_time: ~4 lignes, 32 Ko","source_migrations: ~0 lignes, 32 Ko","anilist_links: ~155 lignes, 16 Ko","app_settings: …
- **comptes** : {"users":26,"favoris":521,"chapitres_lus":147,"evenements":6909,"sessions":110}
- **favoris_sans_couverture** : 18
- **favoris_par_source** : [{"source":"weebcentral","n":391},{"source":"sushiscan","n":84},{"source":"mangadex","n":31},{"source":"chireads","n":9},{"source":"novelfull","n":3},{"source":"gutenberg","n":2},{"source":"novelbin","n":1}]
- **hotes_de_couvertures** : {"temp.compsci88.com":374,"uploads.mangadex.org":31,"www.gutenberg.org":2,"sushiscan.fr":83,"chireads.com":9,"novel-bin.com":1,"novelfull.com":3}
- **evenements_par_type** : ["read: 3733","favorite: 2053","unfavorite: 1049","status_change: 46","comment: 15","rating: 13"]
- **sauvegardes** : {"nombre":14,"derniere":"2026-11-24T19:22:38.083Z"}

### couvertures

- **couvertures_par_hote** : {"uploads.mangadex.org":"0 ok / 5 KO, 2642 ms moy.","temp.compsci88.com":"57 ok / 0 KO, 2492 ms moy.","sushiscan.fr":"0 ok / 16 KO, 969 ms moy.","chireads.com":"1 ok / 0 KO, 1956 ms moy.","novel-bin.com":"0 ok / 1 KO, 2813 ms moy."}
- **couvertures_taux_echec_pct** : 28

### api-acces

- **acces_anonyme** : {"routes_protegees_testees":117,"ouvertes":0,"fuites_techniques":0}
- **fichiers_sensibles_testes** : 21
- **entetes_reponse_accueil** : ["cross-origin-opener-policy","cross-origin-resource-policy","origin-agent-cluster","referrer-policy","x-content-type-options","x-dns-prefetch-control","x-download-options","x-frame-options","x-permitted-cross-domain-policies","x-xss-protection","vary","access-control-allow-credentials","cache-control","accept-ranges","last-modified","etag","content-type","content-length","date","connection"]
- **global_js_compression** : {"encodage":"br","octets_recus":66946,"cache":"public, max-age=0, must-revalidate","etag":true}
- **cors_origine_etrangere** : refusée
- **json_invalide_statut** : 400
- **corps_13mo_login** : 413
- **corps_2mo_login** : 400

### api-contrat

- **contrat_get** : {"total":52,"ok":50,"auth":0,"client":2,"serveur":0,"timeouts":0}
- **contrat_plus_lents** : ["/mangas/latest 1564 ms 13 Ko (externe)","/mangas/popular 1330 ms 13 Ko (externe)","/mangas/search 1126 ms 6 Ko (externe)","/me/stats/distribution 582 ms 0 Ko","/me/favorites 305 ms 9 Ko","/me/history/export 266 ms 4 Ko","/admin/users 241 ms 0 Ko","/me/journal/activite 195 ms 0 Ko","/me/lists 177 ms 0 Ko","/me/ratings 174 ms 0 Ko","/me/settings 155 ms 0 Ko","/me/read-chapters 154 ms 2 Ko (externe)"]
- **charge_6x24** : {"/api/health":{"n":144,"p50":40,"p95":182,"max":349,"erreurs":0},"/api/sources":{"n":144,"p50":144,"p95":299,"max":418,"erreurs":0},"/api/me/favorites":{"n":144,"p50":119,"p95":347,"max":432,"erreurs":0},"/accueil.html":{"n":144,"p50":72,"p95":199,"max":221,"erreurs":0},"/assets/js/global.js":{"n":144,"p50":251,"p95":553,"max":639,"erreurs":0}}

### flux-ecriture

- **demarrage_base_vierge_ms** : 11671
- **suppression_masse** : {"demandees":300,"refusees":280,"restantes":280,"ms":5592}
- **evenements_unfavorite_apres_masse** : 21
- **login_40_tentatives** : {"401":12,"429":28}
- **flux_etapes** : ["✓ favori : ajout (127 ms) → ok","✓ favori : doublon idempotent (280 ms) → ok","✓ favori : unicode préservé (19 ms) → ok","✓ favori : id invalide refusé (31 ms) → ok","✓ favori : couverture javascript: refusée (160 ms) → ok","✗ favori : XSS dans le titre stocké tel quel (l'échappement doit se faire à l'affichage) (161 ms) → stocké brut (OK si échappé partout à l'affichage — voir SEC-XSS-CANDIDAT)","✓ progression : écriture + relecture (270 ms) → ok","✓ chapitre lu : marquer (58 ms) → ok","✗ chapitres lus : lot de 2000 (5246 ms) → statut 200 en 5246 ms","✓ notation 1–10 (443 ms) → ok","✓ notation hors bornes refusée (89 ms) → ok","✓ liste : création + ajout + suppression (540 ms) → ok","✓ no …

### pages

- **pages_releve** : [{"page":"accueil.html","profil":"bureau","chargeMs":4485,"lcp":600,"fcp":428,"cls":0.334,"noeuds":653,"longTasks":91,"requetes":42,"ko":1,"erreursConsole":1,"erreursPage":0},{"page":"anilist.html","profil":"bureau","chargeMs":3847,"lcp":256,"fcp":256,"cls":0,"noeuds":27,"longTasks":0,"requetes":3,"ko":0,"erreursConsole":0,"erreursPage":0},{"page":"bibliotheque.html","profil":"bureau","chargeMs":5107,"lcp":1336,"fcp":436,"cls":0.17,"noeuds":793,"longTasks":72,"requetes":96,"ko":23,"erreursConsole":27,"erreursPage":0},{"page":"catalogue.html","profil":"bureau","chargeMs":5251,"lcp":1700,"fcp":560,"cls":0.73,"noeuds":794,"longTasks":189,"requetes":70,"ko":0,"erreursConsole":24,"erreursPage":0} …

### boutons

- **boutons_jeu_de_donnees** : {"favoris":36,"oeuvreReelle":"One Piece","chapitre":true,"roman":"Shadow Slave","chapitreRoman":true}
- **boutons_inventaire_resume** : {"accueil.html|bureau":"37 contrôles, 7 clics","anilist.html|bureau":"2 contrôles, 2 clics","bibliotheque.html|bureau":"75 contrôles, 9 clics","catalogue.html|bureau":"150 contrôles, 44 clics","chapitre.html|bureau":"25 contrôles, 2 clics","collection-detail.html|bureau":"47 contrôles, 28 clics","collections.html|bureau":"44 contrôles, 26 clics","comparer.html|bureau":"32 contrôles, 17 clics","confidentialite.html|bureau":"16 contrôles, 1 clics","downloads.html|bureau":"42 contrôles, 6 clics","import.html|bureau":"40 contrôles, 16 clics","index.html|bureau":"51 contrôles, 26 clics","lecture.html|bureau":"39 contrôles, 32 clics","liste.html|bureau":"40 contrôles, 21 clics","localreader.html|b …
- **boutons_hotes_externes_demandes_par_le_navigateur** : {"github.com":10,"www.youtube.com":203,"s4.anilist.co":84,"graphql.anilist.co":6}
- **maj_analyse** : [{"t":"appuyé (souris enfoncée)","bouton":{"x":1058,"y":242,"l":202,"h":32,"fond":"color(srgb 0.666039 0.286431 0.0931765)","opacite":"1","desactive":false},"couches":[],"barre":null,"statut":{"x":1259,"y":275,"l":0,"h":0,"texte":""}},{"t":"maj-2-0s4","bouton":{"x":1058,"y":243,"l":202,"h":32,"fond":"color(srgb 0.666039 0.286431 0.0931765)","opacite":"0.45","desactive":true},"couches":[],"barre":null,"statut":{"x":1259,"y":275,"l":0,"h":0,"texte":""}},{"t":"maj-3-2s9","bouton":{"x":1058,"y":242,"l":202,"h":32,"fond":"color(srgb 0.666039 0.286431 0.0931765)","opacite":"1","desactive":false},"couches":[],"barre":null,"statut":{"x":1066,"y":275,"l":193,"h":16,"texte":"Vérifié à 23:10 · 24 injoi …
- **maj_chronologie** : {"t0":3919.5,"ev":[["clic",0],["bouton",2,"désactivé"],["statut",2499,"Vérifié à 23:10 · 24 injoignable(s)"],["bouton",2499,"actif"]],"pos":[[79,1058,243,315],[178,1058,243,315],[282,1058,243,315],[378,1058,243,315],[492,1058,243,315],[582,1058,243,315],[681,1058,243,315],[780,1058,243,315],[886,1058,243,315],[982,1058,243,315],[1080,1058,243,315],[1179,1058,243,315],[1280,1058,243,315],[1385,1058,243,315],[1479,1058,243,315],[1586,1058,243,315],[1682,1058,243,315],[1780,1058,243,315],[1886,1058,243,315],[1985,1058,243,315],[2086,1058,243,315],[2182,1058,243,315],[2279,1058,243,315],[2378,1058,243,315],[2537,1058,243,315],[2580,1058,242,315],[2680,1058,242,315],[2779,1058,242,315],[2887,1058 …
- **maj_decalages** : {"bouton_px":0,"grille_px":0}

### analyse

- **analyse_fichiers** : 197
- **analyse_signalements** : 402
- **analyse_par_regle** : {"no-await-in-loop":196,"require-atomic-updates":126,"no-promise-executor-return":38,"complexity":16,"max-lines":6,"no-unused-vars":6,"max-lines-per-function":5,"no-useless-escape":4,"eqeqeq":2,"no-new-func":1,"no-unsafe-finally":1,"max-depth":1}

### certificats

- **certificats_hotes** : 35
- **certificats_liens_verifies** : 7
- **certificats_releve** : {"apis.google.com":"valide · 61 j · HTTP 301","fcm.googleapis.com":"valide · 61 j · HTTP 404","accounts.google.com":"valide · 61 j · HTTP 302","api.mangadex.org":"valide · 29 j · HTTP 302","api.github.com":"valide · 61 j · HTTP 206","anilist.co":"valide · 70 j · HTTP 200","chireads.com":"valide · 43 j · HTTP 200","all.api.radio-browser.info":"valide · 86 j · HTTP 200","fonts.gstatic.com":"valide · 61 j · HTTP 404","gutendex.com":"valide · 44 j · HTTP 200","fonts.googleapis.com":"valide · 61 j · HTTP 404","github.com":"valide · 63 j · HTTP 206","listen.moe":"valide · 37 j · HTTP 200","graphql.anilist.co":"valide · 70 j · HTTP 404","ilm.stream12.radiohost.de":"valide · 79 j · HTTP 404","jazz-w …

### chaos

- **chaos_essais** : 95
- **chaos_resume** : {"erreur500":"19 pages · 0 exceptions · 2 sans message","vide":"19 pages · 1 exceptions · 5 sans message","illisible":"19 pages · 7 exceptions · 7 sans message","coupe":"19 pages · 0 exceptions · 3 sans message","lent":"19 pages · 0 exceptions · 14 sans message"}

### integrite

- **integrite_tables_utilisateur** : {"anilist_links":1,"bookmarks":1,"comments":1,"device_push_tokens":0,"devices":0,"events":11,"favorites":4,"favorites_corbeille":1,"lists":2,"local_imports":0,"notifications":0,"pair_codes":0,"progress":1,"progress_devices":0,"progress_history":2,"push_subscriptions":1,"ratings":1,"read_chapters":2,"reading_notes":1,"reading_time":1,"sessions":1,"source_migrations":0,"user_settings":1,"list_items":2}
- **integrite_sauvegarde** : {"perdues":["anilist_links : 1 → 0","bookmarks : 1 → 0","comments : 1 → 0","events : 11 → 0","favorites_corbeille : 1 → 0","progress_history : 2 → 0","push_subscriptions : 1 → 0","reading_notes : 1 → 0","reading_time : 1 → 0"],"champsAlteres":["favoris : added_at, notify","progression : total_pages, updated_at","elements : cover"]}
- **integrite_export** : {"perdues":["anilist_links : 1 → 0","bookmarks : 1 → 0","comments : 1 → 0","events : 11 → 0","favorites_corbeille : 1 → 0","lists : 2 → 0","progress_history : 2 → 0","push_subscriptions : 1 → 0","reading_notes : 1 → 0","reading_time : 1 → 0","user_settings : 1 → 0","list_items : 2 → 0"],"champsAlteres":["favoris : added_at, notify","progression : total_pages, updated_at"]}
- **integrite_base_reelle_exposee** : {"liens AniList":189,"signets":2,"notes de carnet":0,"jours de temps de lecture":4,"listes":1,"lignes d historique":94,"événements":6909}
- **integrite_effacement** : {"statut":200,"restes":[]}
- **integrite_progression_sans_date** : 1
- **integrite_simultane** : {"favori":{"erreurs":0,"lignes":1},"progression":{"erreurs":0,"lignes":1,"chapitre":"29.00"},"liste":{"erreurs":0,"lignes":1},"signet":{"erreurs":0},"lectures":{"erreurs":0},"reinitialisation":{"reussites":6}}
- **integrite_ecart_schema** : {"colonnesAbsentesOuDifferentes":["events.origine varchar(96) NULL","favorites_corbeille.id bigint NOT NULL","favorites_corbeille.user_id int NOT NULL","favorites_corbeille.manga_id varchar(191) NOT NULL","favorites_corbeille.donnees longtext NOT NULL","favorites_corbeille.lot char(36) NOT NULL","favorites_corbeille.origine varchar(96) NULL","favorites_corbeille.supprime_le timestamp NOT NULL"],"colonnesEnPlus":["spotify_accounts.user_id int NOT NULL","spotify_accounts.spotify_id varchar(128) NULL","spotify_accounts.display_name varchar(255) NULL","spotify_accounts.avatar varchar(512) NULL","spotify_accounts.product varchar(32) NULL","spotify_accounts.access_token text NULL","spotify_account …

### securite-dyn

- **securite_limite_connexion** : 13
- **securite_requetes_de_fuzz** : 1413
- **securite_routes_cassees** : 19
- **securite_essais** : 66
- **securite_essais_tenus** : 62
- **securite_verdicts** : [{"nom":"connexion automatique refusée depuis le réseau","ok":true,"info":"403"},{"nom":"réinitialisation de mot de passe impossible depuis le réseau","ok":false,"info":"POST /api/auth/forgot (depuis le réseau) → 200, jeton dans la réponse : true"},{"nom":"force brute freinée depuis le réseau","ok":true,"info":"429 au 13e essai"},{"nom":"Bruno ne peut pas lire la liste privée","ok":true,"info":"404"},{"nom":"Bruno ne peut pas renommer la liste","ok":true,"info":"200"},{"nom":"Bruno ne peut pas rendre la liste publique","ok":true,"info":"200"},{"nom":"Bruno ne peut pas ajouter à la liste","ok":true,"info":"404"},{"nom":"Bruno ne peut pas retirer de la liste","ok":true,"info":"404"},{"nom":"Br …

### lecteur

- **lecteur_premiere_planche_ms** : 12344
- **lecteur_fonctions_essayees** : 79
- **lecteur_fonctions_ok** : 74
- **lecteur_verdicts** : [{"fonction":"ouverture","ok":true,"info":"1 images"},{"fonction":"mode page","ok":true,"info":"1 visible(s), largeur 464"},{"fonction":"page · ArrowLeft","ok":true,"info":"p.1→2 défil 0→0"},{"fonction":"page · ArrowRight","ok":true,"info":"p.2→1 défil 0→0"},{"fonction":"page · Space","ok":false,"info":"p.1→1 défil 0→0"},{"fonction":"page · ArrowDown","ok":true,"info":"p.1→2 défil 0→0"},{"fonction":"page · PageDown","ok":false,"info":"p.2→2 défil 0→0"},{"fonction":"page · End","ok":true,"info":"p.2→28 défil 0→1047"},{"fonction":"page · Home","ok":true,"info":"p.28→1 défil 1094→0"},{"fonction":"mode double","ok":true,"info":"2 visible(s), largeur 464"},{"fonction":"double · ArrowLeft","ok":tr …

### interaction

- **interaction_totaux** : {"tabulations":1495,"fenetres":5,"champs":18}

### references

- **references_membres_exposes** : 707
- **references_appels_front** : 144
- **references_routes_vues** : 140/156

### mobile

- **mobile_totaux** : {"cibles":881,"appuis":136,"appuisSansEffet":0,"pages":24}

### parcours

- **anglais_restes_par_page** : {"accueil.html":13,"anilist.html":1,"bibliotheque.html":6,"catalogue.html":32,"collection-detail.html":6,"collections.html":3,"comparer.html":2,"downloads.html":4,"import.html":5,"index.html":14,"liste.html":4,"localreader.html":1,"notes.html":5,"notifications.html":7,"parametres.html":36,"profil.html":9,"recherche.html":52,"serie.html":4,"sources.html":29,"stats.html":427,"systeme.html":47,"u.html":7}

### xss

- **xss_envois** : ["favori.titre: 200","favori.source: 200","favori.id: 200","categorie: 200","progression: 200","liste: 200","liste.element: 200","note: 200","signet: 200","commentaire: 200","avatar: 200","reglages: 200"]
- **xss_pages_visitees** : 22
- **xss_injections** : 1

### charge

- **charge_volumes** : {"12":{"api":{"/me/favorites":{"ms":18,"ko":0,"statut":200},"/me/progress":{"ms":9,"ko":0,"statut":200},"/me/read-chapters":{"ms":9,"ko":0,"statut":200},"/me/stats":{"ms":47,"ko":0,"statut":200},"/me/stats/distribution":{"ms":9,"ko":0,"statut":200},"/me/events":{"ms":9,"ko":0,"statut":200},"/me/export":{"ms":27,"ko":1,"statut":200},"/me/library":{"ms":7,"ko":0,"statut":200},"/me/updates?cached=1":{"ms":744,"ko":0,"statut":200},"/me/notifications":{"ms":8,"ko":0,"statut":200}},"pages":{"accueil.html":{"ms":1392,"noeuds":653,"tas":2,"ecouteurs":116,"long":57,"pire":57,"images":43,"saisie":null},"bibliotheque.html":{"ms":2585,"noeuds":505,"tas":2,"ecouteurs":177,"long":0,"pire":0,"images":14,"s …
- **charge_reseau** : {"accueil.html":{"requetes":46,"api":16,"koTransferes":441,"koDecodes":998,"jsKo":661,"jsUtilise":39,"cssKo":151,"cssUtilise":22},"anilist.html":{"requetes":3,"api":0,"koTransferes":8,"koDecodes":19,"jsKo":17,"jsUtilise":30,"cssKo":1,"cssUtilise":61},"bibliotheque.html":{"requetes":61,"api":30,"koTransferes":478,"koDecodes":1117,"jsKo":771,"jsUtilise":41,"cssKo":162,"cssUtilise":24},"catalogue.html":{"requetes":68,"api":40,"koTransferes":1825,"koDecodes":2418,"jsKo":696,"jsUtilise":43,"cssKo":155,"cssUtilise":26},"collection-detail.html":{"requetes":30,"api":10,"koTransferes":383,"koDecodes":841,"jsKo":519,"jsUtilise":42,"cssKo":145,"cssUtilise":22},"collections.html":{"requetes":34,"api":14 …
- **charge_couverture_js** : [{"k":"/assets/js/global.js","ko":214,"pct":57,"pages":21},{"k":"/assets/js/serie.js","ko":111,"pct":10,"pages":1},{"k":"/assets/js/bibliotheque.js","ko":108,"pct":42,"pages":1},{"k":"/assets/vendor/jszip.min.js","ko":95,"pct":18,"pages":3},{"k":"/assets/js/profil.js","ko":84,"pct":51,"pages":1},{"k":"/assets/js/catalogue.js","ko":73,"pct":58,"pages":1},{"k":"/assets/js/api.js","ko":71,"pct":60,"pages":22},{"k":"/assets/vendor/gsap.min.js","ko":71,"pct":38,"pages":21},{"k":"/assets/js/parametres.js","ko":62,"pct":42,"pages":1},{"k":"/assets/js/music.js","ko":53,"pct":30,"pages":21},{"k":"/assets/vendor/ScrollTrigger.min.js","ko":43,"pct":16,"pages":21},{"k":"/assets/js/stats.js","ko":39,"pct …
- **charge_entetes** : {"/assets/js/global.js":"public, max-age=0, must-revalidate · ETag · br · 65 Ko","/assets/css/global.css":"public, max-age=0, must-revalidate · ETag · br · 38 Ko","/accueil.html":"public, max-age=0, must-revalidate · ETag · br · 2 Ko","/service-worker.js":"public, max-age=0, must-revalidate · ETag · br · 4 Ko","/assets/i18n/en.json":"public, max-age=0, must-revalidate · ETag · br · 31 Ko"}
- **charge_fuites** : {"bibliotheque.html":{"gestes":50,"avant":{"ecouteurs":178,"noeuds":1433,"tas":3052},"apres":{"ecouteurs":178,"noeuds":1433,"tas":3147}},"accueil.html":{"gestes":50,"avant":{"ecouteurs":145,"noeuds":926,"tas":2858},"apres":{"ecouteurs":145,"noeuds":926,"tas":2939}},"parametres.html":{"gestes":0,"avant":{"ecouteurs":176,"noeuds":2023,"tas":2226},"apres":{"ecouteurs":176,"noeuds":2023,"tas":2235}},"catalogue.html":{"gestes":50,"avant":{"ecouteurs":155,"noeuds":1807,"tas":3036},"apres":{"ecouteurs":155,"noeuds":1819,"tas":3101}},"notes.html":{"gestes":0,"avant":{"ecouteurs":115,"noeuds":789,"tas":2223},"apres":{"ecouteurs":115,"noeuds":789,"tas":2249}},"stats.html":{"gestes":0,"avant":{"ecouteu …
- **charge_debit** : {"favoris":{"n":300,"p50":187,"p95":257,"echecs":0},"sante":{"n":300,"p50":92,"p95":207,"echecs":0},"statique":{"n":200,"p50":458,"p95":673,"echecs":0}}

### imports

- **imports_essais** : 35
- **imports_essais_tenus** : 29
- **imports_verdicts** : [{"nom":"refus : texte renommé en .cbz","ok":true,"info":"400 Le contenu du fichier ne correspond pas à son extension (.cbz) — contenu détecté : inconnu."},{"nom":"refus : PDF renommé en .epub","ok":true,"info":"400 Le contenu du fichier ne correspond pas à son extension (.epub) — contenu détecté : pdf."},{"nom":"refus : archive renommée en .pdf","ok":true,"info":"400 Le contenu du fichier ne correspond pas à son extension (.pdf) — contenu détecté : zip."},{"nom":"refus : archive RAR","ok":true,"info":"400 CBR (archive RAR) non supporté : convertis-le en CBZ (ZIP)"},{"nom":"refus : page web","ok":true,"info":"400 Format non supporté (EPUB, PDF, CBZ uniquement)"},{"nom":"refus : image vectori …

### modes

- **modes_releves** : {"bureau":{"csp":"default-src 'self';base-uri 'self';font-src 'self' data: https://fonts.gstatic.com;form-action 'self';frame-ancestors 'self';img-src 'self' data: blob: https:;object-src 'none';script-src 'self' 'unsafe-inline' https://accounts.google.com https://apis.google.com https://www.youtube.com https://s.ytimg.com;script-src-attr 'unsafe-inline';style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;upgrade-insecure-requests;connect-src 'self' https:;frame-src https://www.youtube.com https://youtube.com https://accounts.google.com;media-src 'self' data: blob: https:","hsts":"","pages":{"la machine":{"violations":0,"cassees":0},"le réseau":{"violations":0,"cassees":4}},"miseAN …

### hors-ligne

- **hors_ligne_releves** : {"serviceWorker":{"pret":true,"caches":["inko-2.9.0-7580aa-static"],"fichiers":112},"precache":{"attendus":112,"manquants":0},"installabilite":[],"telechargementChapitreMs":5563,"pagesSansReseau":{"accueil.html":{"repli":false,"longueur":769,"ditHorsLigne":true,"images":0,"attente":0,"exceptions":0},"anilist.html":{"repli":false,"longueur":165,"ditHorsLigne":false,"images":0,"attente":0,"exceptions":0},"bibliotheque.html":{"repli":false,"longueur":649,"ditHorsLigne":true,"images":0,"attente":0,"exceptions":0},"catalogue.html":{"repli":false,"longueur":985,"ditHorsLigne":true,"images":0,"attente":0,"exceptions":0},"collection-detail.html":{"repli":true,"longueur":271,"ditHorsLigne":true,"imag …

### livraison

- **livraison_releves** : {"appelsPowerShell":2,"telechargementDeSecours":"commande invalide","verificationSignature":"commande invalide","dockerfileCopieSources":false,"sourcesDansImagePropre":0}

### mise-a-niveau

- **mise_a_niveau_releves** : {"v2.3.4":{"migration":"réussie","ms":2370,"pertes":[],"schema":{"manquantOuDifferent":[],"indexAbsents":["favorites (user_id,status)"],"enTrop":[]}},"v2.5.0":{"migration":"réussie","ms":1259,"pertes":[],"schema":{"manquantOuDifferent":[],"indexAbsents":[],"enTrop":[]}},"v2.5.7":{"migration":"réussie","ms":1262,"pertes":[],"schema":{"manquantOuDifferent":[],"indexAbsents":[],"enTrop":[]}},"v2.6.1":{"migration":"réussie","ms":963,"pertes":[],"schema":{"manquantOuDifferent":[],"indexAbsents":[],"enTrop":[]}},"v2.7.0":{"migration":"réussie","ms":886,"pertes":[],"schema":{"manquantOuDifferent":[],"indexAbsents":[],"enTrop":[]}},"v2.8.0":{"migration":"réussie","ms":783,"pertes":[],"schema":{"manq …
- **mise_a_niveau_versions** : 8/8

### exactitude

- **exactitude_extraits** : {"accueil":"Accueil —\nBonsoir, Lecteur\n13 chapitres lus\n4 jours d’affilée\n8 séries suivies\n愛\nPar où commencer ?\n\nCherche une série que tu connais, parcours le catalogue de tes sources, ou ouvre tes propres fichiers EPUB, CBZ ou PDF.","profil":"DERNIÈRE LECTURE\nAucune lecture pour l'instant.\nExplore le catalogue pour commencer →\nObjectif Hebdo\n✎\n5/15\nEn bonne voie\nPlus que 10 chapitre(s)\n+1000%\n11\nChapitres ce mois\n⏱\n1 h\nTemps de lecture\n8\nEn bibliothèque\n11\nJours actifs\nActivité de lecture\n12 chapitres récents\nMoins\nPlus\nGenres préférés\nAjoute des favoris pour voir tes genres.\nBadges récents\nVoir tout\nFavoris récents\nVoir toute la colle","stats":"Tes statis …
- **exactitude_verifications** : 20
- **exactitude_justes** : 20
- **exactitude_verdicts** : [{"nom":"nombre de favoris","ok":true,"attendu":8,"obtenu":8},{"nom":"chapitres lus au total","ok":true,"attendu":13,"obtenu":13},{"nom":"chapitres des 30 derniers jours","ok":true,"attendu":11,"obtenu":11},{"nom":"séries lues","ok":true,"attendu":3,"obtenu":3},{"nom":"carte de chaleur (jours à l’heure de Paris)","ok":true,"attendu":{"2026-10-16":1,"2026-11-10":1,"2026-11-11":1,"2026-11-12":1,"2026-11-13":1,"2026-11-14":1,"2026-11-15":1,"2026-11-21":2,"2026-11-22":1,"2026-11-23":1,"2026-11-24":1},"obtenu":{"2026-10-16":1,"2026-11-10":1,"2026-11-11":1,"2026-11-12":1,"2026-11-13":1,"2026-11-14":1,"2026-11-15":1,"2026-11-21":2,"2026-11-22":1,"2026-11-23":1,"2026-11-24":1}},{"nom":"série de jour …

### appareils

- **appareils_droits** : [{"nom":"lire la bibliothèque","statut":200,"attendu":200},{"nom":"écrire une progression","statut":200,"attendu":200},{"nom":"statistiques d’administration","statut":403,"attendu":403},{"nom":"changer un rôle","statut":403,"attendu":403},{"nom":"installer des extensions","statut":403,"attendu":403},{"nom":"émettre un code d’appairage","statut":200,"attendu":403},{"nom":"lister les appareils","statut":200,"attendu":200},{"nom":"changer le mot de passe","statut":400,"attendu":400},{"nom":"exporter tout le compte","statut":200,"attendu":200},{"nom":"restaurer une sauvegarde","statut":404,"attendu":403},{"nom":"lister les sauvegardes","statut":200,"attendu":403}]
- **appareils_essais** : 25
- **appareils_essais_tenus** : 21
- **appareils_verdicts** : [{"nom":"code d’appairage émis","ok":true,"info":"200"},{"nom":"code inventé refusé","ok":true,"info":"404"},{"nom":"code inventé refusé","ok":true,"info":"404"},{"nom":"code inventé refusé","ok":true,"info":"404"},{"nom":"appairage (saisie sans tiret, en minuscules)","ok":true,"info":"201"},{"nom":"téléphone : lire la bibliothèque","ok":true,"info":"200"},{"nom":"téléphone : écrire une progression","ok":true,"info":"200"},{"nom":"téléphone : statistiques d’administration","ok":true,"info":"403"},{"nom":"téléphone : changer un rôle","ok":true,"info":"403"},{"nom":"téléphone : installer des extensions","ok":true,"info":"403"},{"nom":"téléphone : émettre un code d’appairage","ok":false,"info": …

### administration

- **admin_commentaires_avant_limite** : 12
- **admin_banni_lecture_optionnelle** : 200
- **admin_essais** : 23
- **admin_essais_tenus** : 17
- **admin_verdicts** : [{"nom":"trois comptes créés","ok":true,"info":"8152000 8152001 8152002"},{"nom":"l’administrateur lit les statistiques","ok":true,"info":"200"},{"nom":"la liste des comptes ne contient aucun secret","ok":true,"info":"[{\"id\":8152001,\"username\":\"Second\",\"email\":\"second@exemple.test\",\"role\":\"user\",\"banned\":false,\"createdAt\":\"2026-11-25T23:04:10.000Z\",\"chapte"},{"nom":"un administrateur ne se retire pas son rôle","ok":true,"info":""},{"nom":"ni ne se bannit","ok":true,"info":""},{"nom":"rôle inconnu refusé","ok":true,"info":""},{"nom":"compte inexistant signalé","ok":false,"info":"PUT rôle d'un compte inexistant → 200 {\"ok\":true,\"role\":\"user\"}"},{"nom":"un visiteur ne …

### licences

- **licences_dependances** : {"MIT":133,"BSD-3-Clause":3,"BSD-2-Clause":9,"MIT-0":1,"MPL-2.0":1,"ISC":8,"Apache-2.0":2,"0BSD":1}
- **licence_du_projet** : Apache License                            Version 2.0, January 2004                         http://www.apache.org/licens
- **licences_fichiers_copies** : 7

### resilience

- **resilience_releves** : {"connexionsCoupees":15,"apresCoupure":"200,200,200,200,200,200,200,200","ecrituresPendantCoupure":{"acceptees":39,"enBase":39},"sansBase":{"sante":503,"favoris":401,"message":"{\"error\":\"Token invalide ou expiré\"}"},"stockage interdit":"4 page(s) touchée(s)","stockage plein":"4 page(s) touchée(s)","stockage corrompu":"4 page(s) touchée(s)","hasard":{"gestes":218,"exceptionsDifferentes":0,"serveurVivant":true},"portOccupe":{"code":"toujours en vie","message":""},"baseInjoignable":{"code":1,"fin":"◇ injected env (0) from .env\n[db] MySQL 127.0.0.1:1 injoignable (ECONNREFUSED) → base embarquée\n[db] impossible de préparer la base de données : MySQL injoignable et MariaDB embarquée absente ( …

### vie-privee

- **vie_privee_navigateur** : {"s4.anilist.co":"image","graphql.anilist.co":"fetch"}
- **vie_privee_serveur** : {"sushiscan.net":"https","weebcentral.com":"https","novelfull.com":"https","api.mangadex.org":"https","temp.compsci88.com":"https","hot.planeptune.us":"https","chireads.com":"https","gutendex.com":"https","novel-bin.com":"https","www.royalroad.com":"https","uploads.mangadex.org":"https","mangadex.org":"https","graphql.anilist.co":"https"}
- **vie_privee_lecture_privee** : {"traces":[]}

### filtre-adulte

- **filtre_adulte** : {"enPanne":["titre-tout-public","titre-pour-adultes"],"apres":["titre-tout-public","titre-pour-adultes"],"cache":{"titres":0,"heures":6}}

### autonome

- **autonome_construction** : {"code":0,"sortie":"  9 extension(s) embarquee(s), 9 abaissee(s), empreintes recalculees\n  modules du mode autonome injectés dans 23 page(s)\n  2 module(s) hors du paquet, 601 Ko — aucune page ne les reclame :\n        594 Ko  assets/vendor/three.min.js\n          7 Ko  assets/js/hero3d.js\n✔ mobile/www : 26 page(s), 134 fichier(s) d'actifs\n  64 script(s) et 26 feuille(s) transpilé(s) vers chrome61\n"}
- **autonome_pages** : {"accueil.html":{"longueur":315,"attente":0,"exceptions":0},"anilist.html":{"longueur":165,"attente":0,"exceptions":0},"bibliotheque.html":{"longueur":292,"attente":0,"exceptions":0},"catalogue.html":{"longueur":231,"attente":0,"exceptions":0},"chapitre.html":{"longueur":75,"attente":0,"exceptions":0},"collection-detail.html":{"longueur":54,"attente":0,"exceptions":0},"collections.html":{"longueur":251,"attente":0,"exceptions":0},"comparer.html":{"longueur":182,"attente":0,"exceptions":0},"confidentialite.html":{"longueur":4119,"attente":0,"exceptions":0},"downloads.html":{"longueur":578,"attente":0,"exceptions":0},"import.html":{"longueur":437,"attente":0,"exceptions":0},"index.html":{"long …
- **autonome_appels_par_page** : {"accueil.html":21,"anilist.html":0,"bibliotheque.html":21,"catalogue.html":21,"chapitre.html":21,"collection-detail.html":21,"collections.html":21,"comparer.html":21,"confidentialite.html":21,"downloads.html":21,"import.html":21,"index.html":21,"lecture.html":21,"liste.html":21,"localreader.html":21,"notes.html":21,"notifications.html":21,"parametres.html":21,"profil.html":21,"recherche.html":21,"serie.html":21,"sources.html":21,"stats.html":21,"systeme.html":21,"u.html":21}
- **autonome_gestes** : {"gestes":{"favori":true,"progression":true,"chapitre lu":true,"note":true,"signet":true,"liste":true,"statistiques":true,"export":true},"apresRechargement":{"favori":true,"progression":true,"note":true,"signet":true,"liste":true}}
- **autonome_catalogue** : 0
- **autonome_hotes_contactes** : {"api.mangadex.org":13,"sushiscan.net":567}

### exposition

- **exposition_releves** : {"relais":{"direct":403,"parRelais":200,"role":"admin"},"hote":{"page":200,"connexionAuto":403,"jetonDeReinitialisation":true},"autrePort":{"cookie":true,"avant":{"positions":1,"lus":1,"activite":3},"apres":{"positions":0,"lus":0,"activite":0}}}

### nouveautes

- **nouveautes_releves** : {"nouveautes":{"passages":[5,5,5],"series":12,"aJour":12},"abonnement":200,"connexionsVersLAdresseInterne":5,"horloge":{"reponse":200,"enBase":3,"date":"2027-11-26T14:51:28.000Z","annee2150":500,"chapitreZero":null}}

### migration

- **migration_resultat** : {"id":1,"migre":true,"chapitresReportes":8,"chapitresAbsents":[12],"signetsPerdus":1,"reversibleJusquA":"2026-12-03T14:52:19.974Z","chapitresSupprimes":1,"signetsSupprimes":1}
- **migration_ecarts_apres_annulation** : ["signets.created_at : \"2026-11-26T14:52:19.000Z\" → \"2026-11-26T14:52:20.000Z\"","signets.note : \"Perdu ?\" → null","signets.created_at : \"2026-11-26T14:52:19.000Z\" → \"2026-11-26T14:52:20.000Z\"","signets.note : \"La phrase à garder\" → null","favori.added_at : \"2024-03-01T09:00:00.000Z\" → \"2026-11-26T14:52:19.000Z\"","favori.notify : 0 → 1","favori.unread_count : 0 → null","chapitres lus.read_at : \"2026-11-26T14:52:17.000Z\" → \"2026-11-26T14:52:19.000Z\"","chapitres lus.read_at : \"2026-11-26T14:52:19.000Z\" → \"2026-11-26T14:52:20.000Z\"","chapitres lus.read_at : \"2026-11-26T14:52:19.000Z\" → \"2026-11-26T14:52:20.000Z\"","chapitres lus.read_at : \"2026-11-26T14:52:19.000Z\" → …

### base-embarquee

- **base_embarquee** : {"installationNeuve":"No database selected","demarrageS":4,"connexionAvecMotDePasse":"Access denied for user 'root'@'127.0.0.1' (using password: YES)","comptes":[{"utilisateur":"mariadb.sys","hote":"localhost","motDePasse":false},{"utilisateur":"root","hote":"localhost","motDePasse":true},{"utilisateur":"root","hote":"(nom de la machine)","motDePasse":false},{"utilisateur":"root","hote":"127.0.0.1","motDePasse":false},{"utilisateur":"root","hote":"::1","motDePasse":false},{"utilisateur":"PUBLIC","hote":"(nom de la machine)","motDePasse":false}],"rootSansMotDePasse":true,"anonyme":false,"ecoute":["127.0.0.1:3499"],"autreBase":true,"secondDemarrage":"Access denied for user 'root'@'127.0.0.1' ( …

### coquille

- **coquille_demarrage** : {"adresse":"http://127.0.0.1:8088/accueil.html","texte":"Ceci n'est pas Inko"}

## Trouvailles

### 🔴 Critique (18)

#### `COUV-HOTE-EN-PANNE` Couvertures de uploads.mangadex.org : 5/5 en échec

sonde **couvertures** · catégorie couvertures · effort M

```
Egao no Taenai Shokuba desu. [mangadex] → 502 
Neon Genesis Evangelion (Official Colored) [mangadex] → 502 
Shadows House (Official Colored) [mangadex] → 502 
```

**Correctif** : Repli par œuvre : MangaDex API (liens al/kt/mal) → AniList (coverImage) → Kitsu → image dessinée ; écrire l'URL trouvée dans favorites.cover pour ne le faire qu'une fois.

#### `COUV-HOTE-EN-PANNE` Couvertures de sushiscan.fr : 16/16 en échec

sonde **couvertures** · catégorie couvertures · effort M

```
JoJo’s Bizarre Adventure : Steel Ball Run [sushiscan] → 502 
Vinland Saga [sushiscan] → 502 
Magi – The Labyrinth of Magic [sushiscan] → 502 
```

**Correctif** : Repli par œuvre : MangaDex API (liens al/kt/mal) → AniList (coverImage) → Kitsu → image dessinée ; écrire l'URL trouvée dans favorites.cover pour ne le faire qu'une fois.

#### `COUV-HOTE-EN-PANNE` Couvertures de novel-bin.com : 1/1 en échec

sonde **couvertures** · catégorie couvertures · effort M

```
Jobless Reincarnation - Mushoku Tensei [novelbin] → 502 
```

**Correctif** : Repli par œuvre : MangaDex API (liens al/kt/mal) → AniList (coverImage) → Kitsu → image dessinée ; écrire l'URL trouvée dans favorites.cover pour ne le faire qu'une fois.

#### `XSS-INJECTION` bibliotheque.html : la donnée « favori.id » est injectée comme HTML et EXÉCUTÉE

sonde **xss** · catégorie sécurité · effort S · `bibliotheque.html`

```
favori.id ‹libGrid›
```

**Correctif** : Échapper cette valeur au rendu (MH.esc ou textContent).

#### `INT-SAUVEGARDE-INCOMPLETE` La sauvegarde automatique ne rend pas toute la bibliothèque après restauration

sonde **integrite** · catégorie données · effort L · `server/lib/backup.js`

```
Tables non rendues (lignes avant → après) :
anilist_links : 1 → 0
bookmarks : 1 → 0
comments : 1 → 0
events : 11 → 0
favorites_corbeille : 1 → 0
progress_history : 2 → 0
push_subscriptions : 1 → 0
reading_notes : 1 → 0
reading_time : 1 → 0

Champs perdus ou altérés :
favoris : added_at, notify
progression : total_pages, updated_at
elements : cover
```

**Correctif** : Une seule liste des tables du compte, partagée par la sauvegarde, la restauration, l'export et l'import, avec un test qui échoue dès qu'une table à user_id n'y figure pas.

#### `INT-EXPORT-INCOMPLET` Exporter puis réimporter son compte perd des données

sonde **integrite** · catégorie données · effort L · `server/controllers/user.controller.js`

```
Tables non rendues (lignes avant → après) :
anilist_links : 1 → 0
bookmarks : 1 → 0
comments : 1 → 0
events : 11 → 0
favorites_corbeille : 1 → 0
lists : 2 → 0
progress_history : 2 → 0
push_subscriptions : 1 → 0
reading_notes : 1 → 0
reading_time : 1 → 0
user_settings : 1 → 0
list_items : 2 → 0

Champs perdus ou altérés :
favoris : added_at, notify
progression : total_pages, updated_at
```

**Correctif** : Une seule liste des tables du compte, partagée par la sauvegarde, la restauration, l'export et l'import, avec un test qui échoue dès qu'une table à user_id n'y figure pas.

#### `SD-PRISE-DE-COMPTE` Tout appareil du réseau local peut prendre le compte propriétaire (administrateur)

sonde **securite-dyn** · catégorie sécurité · effort S · `server/controllers/auth.controller.js`

```
POST /api/auth/forgot (depuis le réseau) → 200, jeton dans la réponse : true
POST /api/auth/reset → 200
POST /api/auth/login → 200, rôle admin
GET /api/admin/users → 200

Adresse utilisée : owner@inko.local, l'adresse par défaut du compte propriétaire, lisible dans le code source.
Cause : auth.controller.js requestReset renvoie le jeton dans la réponse dès que NODE_ENV n'est pas « production » et qu'aucun serveur mail n'est configuré. C'est le cas de l'application de bureau (lanceur Tauri sans NODE_ENV) et d'une installation depuis les sources (.env.example : NODE_ENV=development). Le serveur écoute sur toutes les interfaces.
```

**Correctif** : Ne renvoyer le jeton qu'à la boucle locale (estLocale + origine admise), sinon répondre 503. Ajouter le test.

#### `SD-JETON-SECRET-PUBLIC` Un jeton signé avec le secret écrit dans le code source est accepté

sonde **securite-dyn** · catégorie sécurité · effort S · `server/lib/secret.js`

```
JWT_SECRET faible → repli « inko-dev-secret-change-me » (lib/secret.js) hors production et hors bureau. Jeton forgé sans « jti » : accepté sans session.
```

**Correctif** : Secret tiré au sort et conservé dans tous les cas ; refuser les jetons sans jti.

#### `SD-RESET-JETON` La réinitialisation rend le jeton dans la réponse sur une instance partagée sans NODE_ENV=production

sonde **securite-dyn** · catégorie sécurité · effort S · `server/controllers/auth.controller.js`

```
N'importe qui connaissant une adresse prend le compte. La différence de réponse révèle en plus les adresses inscrites.
```

**Correctif** : Ne jamais rendre le jeton à un client distant.

#### `IMP-EPUB-INJECTION` Un livre EPUB piégé exécute du code dans l'application (4 technique(s) : cdata, commentaire, instruction, svg-animate)

sonde **imports** · catégorie fichiers importés · effort M · `assets/js/localreader.js`

```
Chapitres piégés ouverts dans localreader.html ; chaque technique citée a exécuté du JavaScript avec la session ouverte.
Cause : sanitizeChapter analyse le chapitre en XML puis réinjecte le résultat avec innerHTML (analyseur HTML) : les sections CDATA, commentaires et instructions changent de sens entre les deux, et la liste de balises retirées est incomplète.
```

**Correctif** : Assainir avec une liste blanche de balises et d'attributs, en reconstruisant des nœuds (ou une bibliothèque éprouvée comme DOMPurify), puis afficher dans un cadre isolé sans script.

#### `MODE-RESEAU-PAGE-MORTE` application de bureau, depuis le réseau en http : l'interface ne se charge pas

sonde **modes** · catégorie configurations livrées · effort S · `server/middleware/security.js`

```
accueil.html : 2 feuille(s) de style, scripts NON chargés, 18 demande(s) forcées en https
anilist.html : 1 feuille(s) de style, scripts NON chargés, 2 demande(s) forcées en https
bibliotheque.html : 2 feuille(s) de style, scripts NON chargés, 19 demande(s) forcées en https
catalogue.html : 2 feuille(s) de style, scripts NON chargés, 16 demande(s) forcées en https

La politique de contenu contient « upgrade-insecure-requests » (ajoutée par défaut par helmet) : le navigateur réclame chaque fichier en https, que ce serveur ne sert pas.
```

**Correctif** : upgradeInsecureRequests: null quand le serveur n'est pas derrière HTTPS ; documenter le cas du reverse proxy.

#### `MODE-RESEAU-PAGE-MORTE` hub en production (Docker), depuis le réseau en http : l'interface ne se charge pas

sonde **modes** · catégorie configurations livrées · effort S · `server/middleware/security.js`

```
accueil.html : 2 feuille(s) de style, scripts NON chargés, 18 demande(s) forcées en https
anilist.html : 1 feuille(s) de style, scripts NON chargés, 2 demande(s) forcées en https
bibliotheque.html : 2 feuille(s) de style, scripts NON chargés, 19 demande(s) forcées en https
catalogue.html : 2 feuille(s) de style, scripts NON chargés, 16 demande(s) forcées en https

La politique de contenu contient « upgrade-insecure-requests » (ajoutée par défaut par helmet) : le navigateur réclame chaque fichier en https, que ce serveur ne sert pas.
```

**Correctif** : upgradeInsecureRequests: null quand le serveur n'est pas derrière HTTPS ; documenter le cas du reverse proxy.

#### `LIV-DOCKER-SANS-SOURCE` L'image Docker construite depuis un dépôt propre ne contient aucune source

sonde **livraison** · catégorie livraison · effort S · `Dockerfile`

```
Serveur démarré avec les seuls fichiers qu'aurait un clone (server/extensions/*/ est ignoré par git) : GET /api/sources renvoie 0 source. Le Dockerfile ne copie pas extensions-community/, d'où le serveur les installerait. Docker lui-même n'a pas été lancé : il n'est pas installé sur cette machine.
```

**Correctif** : COPY extensions-community/ dans l'image et la vérifier en CI (GET /api/sources non vide).

#### `LIV-DOCKER-SANS-ENTREE` Avec le fichier Docker fourni, personne ne peut entrer

sonde **livraison** · catégorie livraison · effort L · `docker-compose.yml`

```
docker-compose.yml ne pose pas LOCAL_MODE : la connexion automatique reste active, mais elle est réservée à la boucle locale, et une requête qui traverse le port publié arrive avec l'adresse du pont Docker (refus 403 LOCAL_ONLY, comme rejoué depuis le réseau par securite-dyn). Avec LOCAL_MODE=0, il n'existe aucun écran de connexion. Déduit du code ; Docker non installé sur cette machine.
```

**Correctif** : Écran de connexion (FON-03), puis LOCAL_MODE=0 dans le fichier fourni avec création du premier compte au démarrage.

#### `ADULTE-FILTRE-OUVERT` SushiScan : quand les pages de genres ne répondent pas, le filtre des contenus pour adultes se désactive, et le reste désactivé

sonde **filtre-adulte** · catégorie sécurité · effort S · `extensions-community/sushiscan/index.js`

```
Pages de genres refusées, catalogue disponible : titres servis dans le catalogue normal = titre-tout-public, titre-pour-adultes.
Source rétablie, même serveur : titre-tout-public, titre-pour-adultes.
Liste écrite sur disque : 0 titre(s), gardée 6 h, relue au redémarrage.
```

**Correctif** : Ne jamais garder un index vide ou incomplet ; tant qu'il n'est pas complet, refuser le catalogue (ou n'afficher que ce qui est vérifié).

#### `EXP-RELAIS-ADMIN` Derrière un relais installé sur la même machine, n'importe qui devient administrateur sans mot de passe

sonde **exposition** · catégorie sécurité · effort S · `server/lib/reseau.js`

```
Depuis l'adresse réseau, en direct : HTTP 403. Par un relais installé sur la même machine (Caddy, nginx, tunnel…), même s'il transmet X-Forwarded-For : HTTP 200, jeton admin sans mot de passe. Sans TRUST_PROXY, le serveur voit la boucle locale et ignore l'en-tête. (La configuration Docker fournie pose TRUST_PROXY : elle n'est pas concernée.)
```

**Correctif** : Refuser la connexion automatique dès qu'une requête porte un en-tête de relais non local.

#### `BDE-INSTALLATION-NEUVE` Installation neuve : la base de données ne se crée pas, l’application ne démarre jamais

sonde **base-embarquee** · catégorie bug · effort S · `server/lib/embedded-db.js`

```
Premier démarrage de la base livrée avec l'application, dans un profil vierge : « No database selected ». La connexion qui joue schema.sql ne choisit aucune base, et le fichier n'en choisit plus depuis la version 2.5.0. Les installations déjà initialisées, ou reliées à un MySQL existant et rempli, ne le voient pas.
```

**Correctif** : Passer database: DB_NAME à la connexion qui applique le schéma, et jouer une installation neuve avant chaque publication.

#### `BDE-MOT-DE-PASSE-REFUSE` Base embarquée neuve : l’application se voit refuser la connexion avec le mot de passe qu’elle vient de poser

sonde **base-embarquee** · catégorie bug · effort S · `server/lib/embedded-db.js`

```
Même une fois la structure en place (posée à la main pour l’essai), le démarrage suivant échoue : « Access denied for user 'root'@'127.0.0.1' (using password: YES) ». Le mot de passe n’est posé que sur root@localhost, alors que la connexion arrive comme root@127.0.0.1, resté sans mot de passe.
```

**Correctif** : Poser le mot de passe sur tous les comptes root (ou n’en garder qu’un), puis vérifier par une vraie reconnexion.

### 🟠 Haute (155)

#### `STR-GROS` Fichier obèse : assets/js/global.js (3796 lignes)

sonde **structure** · catégorie maintenabilité · effort XL · `assets/js/global.js`

```
3796 lignes dans un seul module vanilla-JS : relecture, revue et parse bloquant à chaque chargement.
```

**Correctif** : Découper par responsabilité (init / rendu / événements / réseau) sous window.MH.

#### `STR-GROS` Fichier obèse : assets/js/chapitre.js (2912 lignes)

sonde **structure** · catégorie maintenabilité · effort XL · `assets/js/chapitre.js`

```
2912 lignes dans un seul module vanilla-JS : relecture, revue et parse bloquant à chaque chargement.
```

**Correctif** : Découper par responsabilité (init / rendu / événements / réseau) sous window.MH.

#### `FLUX-ETAPE-KO` Parcours « chapitres lus : lot de 2000 » : statut 200 en 5246 ms

sonde **flux-ecriture** · catégorie bug · effort M

#### `SEC-XSS-CANDIDAT` 15 injection(s) HTML à vérifier dans assets/js/chapitre.js

sonde **securite** · catégorie sécurité · effort M · `assets/js/chapitre.js:434`

```
Interpolations dans innerHTML sans MH.esc visible (candidats, à confirmer à la main) :
  L434: ${encodeURIComponent(manga.id)}
  L561: ${m.id === readMode ? 'active' : ''}
  L889: ${+img.dataset.idx + 1}
  L955: ${currentPage}
  L972: ${leftTarget}
  L1170: ${leftStep}
  L1358: ${o.page}
  L1492: ${MH.cover(p.urlSaver, p.url)}
  L1503: ${currentPage <= 1 ? 'disabled' : ''}
  L1542: ${MH.cover(manga.coverThumb, manga.cover)}
  L1651: ${chap.title ? ' · ' + MH.esc(chap.title) : ''}
  L1735: ${reste}
```

**Correctif** : Passer chaque valeur venue du réseau ou de l'utilisateur par MH.esc(), ou construire les nœuds avec textContent.

#### `SEC-XSS-CANDIDAT` 11 injection(s) HTML à vérifier dans assets/js/serie.js

sonde **securite** · catégorie sécurité · effort M · `assets/js/serie.js:402`

```
Interpolations dans innerHTML sans MH.esc visible (candidats, à confirmer à la main) :
  L402: ${dedans ? 'Retirer de « À lire ensuite »' : 'Mettre dans « À lire ensuite »'}
  L489: ${on ? 'Activé' : ''}
  L511: ${on ? 'Épinglée' : ''}
  L529: ${libNotify ? 'Activées' : 'En sourdine'}
  L709: ${activeTab === t.key ? 'active' : ''}
  L759: ${MH.relTime(iso)}
  L787: ${synopsisLong ? `<div class="synopsis-block">
            <div class="synopsis-bl}
  L1456: ${encodeURIComponent(m.title)}
  L1721: ${readFilter === 'unread' ? 'Tout est lu ✓' : (readFilter === 'read' ? 'Aucun chap}
  L1749: ${chapRead}
  L1844: ${avgTxt}
```

**Correctif** : Passer chaque valeur venue du réseau ou de l'utilisateur par MH.esc(), ou construire les nœuds avec textContent.

#### `SEC-SQL-INTERPOLE` — 8 occurrences

**Correctif** : Valeurs en paramètres ? ; liste blanche pour colonnes et ordre. (effort unitaire S)

- SQL avec interpolation de valeur — `server/controllers/admin.controller.js:11`
- SQL avec interpolation de valeur — `server/controllers/user.controller.js:960`
- SQL avec interpolation de valeur — `server/lib/corbeille.js:106`
- SQL avec interpolation de valeur — `server/lib/corbeille.js:118`
- SQL avec interpolation de valeur — `server/lib/embedded-db.js:102`
- SQL avec interpolation de valeur — `server/lib/embedded-db.js:104`
- SQL avec interpolation de valeur — `server/lib/migration-sources.js:286`
- SQL avec interpolation de valeur — `server/scripts/restore-backup.js:100`

#### `SEC-SECRET-EN-DUR` Possible secret en dur en dur

sonde **securite** · catégorie sécurité · effort S · `AUDIT-QA-2026-08-12.md:146`

```
SECRET…(masqué)
```

**Correctif** : Variable d'environnement ou coffre local (secrets-locaux.js).

#### `RTE-MUTATION-OUVERTE` POST /devices/pair modifie l'état sans authentification

sonde **routes** · catégorie sécurité · effort S · `server/routes/index.js:233`

**Correctif** : Ajouter auth.authRequired (ou documenter pourquoi la route est publique).

#### `EXT-CATALOGUE-MANGA` Seulement 3 source(s) de mangas : mangadex, sushiscan, weebcentral

sonde **extensions** · catégorie produit · effort L

```
Une seule panne de site suffit à vider le catalogue.
```

**Correctif** : Ajouter des sources de redondance (voir feuille de route : MangaPlus, Comick/mirroirs, MangaKatana, Mangakakalot, ManhuaPlus, scans FR : Lelscan, Mangas-origines, Japscan non).

#### `EXT-CHAINE-CASSEE` Source chireads : étape(s) en échec — recherche « reine »

sonde **extensions** · catégorie extensions · effort M · `extensions-community/chireads/index.js`

```
recherche « reine »: aucun résultat exploitable (pas d’`id`)
```

**Correctif** : Réparer le sélecteur/endpoint de l'étape (bac à sable : bouton « Essayer »).

#### `EXT-CHAINE-CASSEE` Source novelbin : étape(s) en échec — recherche « lord of the mysteries »

sonde **extensions** · catégorie extensions · effort M · `extensions-community/novelbin/index.js`

```
recherche « lord of the mysteries »: aucun résultat exploitable (pas d’`id`)
```

**Correctif** : Réparer le sélecteur/endpoint de l'étape (bac à sable : bouton « Essayer »).

#### `EXT-CHAINE-CASSEE` Source royalroad : étape(s) en échec — recherche « mother of learning »

sonde **extensions** · catégorie extensions · effort M · `extensions-community/royalroad/index.js`

```
recherche « mother of learning »: Site source indisponible (HTTP 403)
```

**Correctif** : Réparer le sélecteur/endpoint de l'étape (bac à sable : bouton « Essayer »).

#### `DATA-COUVERTURES-VIDES` 18/521 favori(s) sans aucune URL de couverture enregistrée

sonde **donnees** · catégorie couvertures · effort M

**Correctif** : Le repli (MangaDex → AniList → Kitsu) doit aussi servir à REMPLIR cette colonne à l'ajout et en tâche de fond.

#### `DATA-SUPPRESSION-MASSE` Journées avec ≥ 20 retraits de favoris (suppression de masse)

sonde **donnees** · catégorie données · effort M

```
Mon Nov 09 : 993
```

**Correctif** : Corbeille 30 j + confirmation au-delà de N retraits/minute + garde côté API (refuser > 10 suppressions en 5 s sans en-tête de confirmation).

#### `CHAOS-EXCEPTION` — 8 occurrences

**Correctif** : Garder l'appel (try/catch) et poser un état d'erreur. (effort unitaire S)

- accueil.html : exception JavaScript quand réponses illisibles (portail captif) — `accueil.html`
- bibliotheque.html : exception JavaScript quand réponses illisibles (portail captif) — `bibliotheque.html`
- collection-detail.html : exception JavaScript quand réponses illisibles (portail captif) — `collection-detail.html`
- collections.html : exception JavaScript quand réponses illisibles (portail captif) — `collections.html`
- notifications.html : exception JavaScript quand réponses illisibles (portail captif) — `notifications.html`
- parametres.html : exception JavaScript quand réponses illisibles (portail captif) — `parametres.html`
- parametres.html : exception JavaScript quand réponses vides — `parametres.html`
- u.html : exception JavaScript quand réponses illisibles (portail captif) — `u.html`

#### `CHAOS-ATTENTE-SANS-FIN` — 8 occurrences

**Correctif** : Remplacer le squelette par un état d'erreur avec « Réessayer ». (effort unitaire S)

- accueil.html : chargement qui ne s'arrête pas quand réponses illisibles (portail captif) — `accueil.html`
- bibliotheque.html : chargement qui ne s'arrête pas quand réponses illisibles (portail captif) — `bibliotheque.html`
- bibliotheque.html : chargement qui ne s'arrête pas quand réseau coupé — `bibliotheque.html`
- collections.html : chargement qui ne s'arrête pas quand réponses illisibles (portail captif) — `collections.html`
- notifications.html : chargement qui ne s'arrête pas quand réponses illisibles (portail captif) — `notifications.html`
- recherche.html : chargement qui ne s'arrête pas quand réseau coupé — `recherche.html`
- recherche.html : chargement qui ne s'arrête pas quand API en erreur 500 — `recherche.html`
- u.html : chargement qui ne s'arrête pas quand réponses illisibles (portail captif) — `u.html`

#### `CHAOS-PAGE-BLANCHE` — 7 occurrences

(effort unitaire S)

- collection-detail.html : page quasi blanche quand réponses illisibles (portail captif) — `collection-detail.html`
- collection-detail.html : page quasi blanche quand API lente (14 s) — `collection-detail.html`
- liste.html : page quasi blanche quand API lente (14 s) — `liste.html`
- serie.html : page quasi blanche quand API lente (14 s) — `serie.html`
- u.html : page quasi blanche quand réponses illisibles (portail captif) — `u.html`
- u.html : page quasi blanche quand réponses vides — `u.html`
- u.html : page quasi blanche quand API lente (14 s) — `u.html`

#### `VIDE-5XX` recherche.html : erreur serveur sur un compte tout neuf

sonde **parcours** · catégorie bug · effort S · `recherche.html`

```
502 GET /api/sources/royalroad/mangas/search
```

#### `LARGEUR-DEBORDE` accueil.html à 320 px : défilement horizontal de 39 px

sonde **parcours** · catégorie mise en page · effort S · `accueil.html`

```
div.header-actions
a.header-user
div.header-avatar
div.shelf-actions
```

**Correctif** : min-width:0, flex-wrap, max-width:100% sur les éléments listés.

#### `LARGEUR-DEBORDE` index.html à 320 px : défilement horizontal de 39 px

sonde **parcours** · catégorie mise en page · effort S · `index.html`

```
div.header-actions
a.header-user
div.header-avatar
div.shelf-actions
```

**Correctif** : min-width:0, flex-wrap, max-width:100% sur les éléments listés.

#### `LARGEUR-DEBORDE` recherche.html à 320 px : défilement horizontal de 42 px

sonde **parcours** · catégorie mise en page · effort S · `recherche.html`

```
div.header-actions
a.header-user
div.header-avatar
button#seGo.se-go
```

**Correctif** : min-width:0, flex-wrap, max-width:100% sur les éléments listés.

#### `CLAIR-AXE-COLOR-CONTRAST` — 9 occurrences

(effort unitaire S)

- anilist.html (thème clair) : color-contrast × 1 — `anilist.html`
- collection-detail.html (thème clair) : color-contrast × 2 — `collection-detail.html`
- confidentialite.html (thème clair) : color-contrast × 2 — `confidentialite.html`
- profil.html (thème clair) : color-contrast × 1 — `profil.html`
- recherche.html (thème clair) : color-contrast × 113 — `recherche.html`
- sources.html (thème clair) : color-contrast × 3 — `sources.html`
- stats.html (thème clair) : color-contrast × 18 — `stats.html`
- systeme.html (thème clair) : color-contrast × 16 — `systeme.html`
- u.html (thème clair) : color-contrast × 1 — `u.html`

#### `CLAIR-AXE-ARIA-REQUIRED-CHILDREN` bibliotheque.html (thème clair) : aria-required-children × 1

sonde **parcours** · catégorie accessibilité · effort S · `bibliotheque.html`

```
#libCats — Element has children which are not allowed: button[aria-label]
```

#### `CLAIR-AXE-LINK-NAME` collection-detail.html (thème clair) : link-name × 1

sonde **parcours** · catégorie accessibilité · effort S · `collection-detail.html`

```
.cd-serie-card-cover — Element does not have text that is visible to screen readers
```

#### `CLAIR-AXE-LINK-IN-TEXT-BLOCK` confidentialite.html (thème clair) : link-in-text-block × 2

sonde **parcours** · catégorie accessibilité · effort S · `confidentialite.html`

```
a[href$="parametres.html"] — The link has insufficient color contrast of 1.93:1 with the surrounding text. (Minimum contrast is 3:1, link t
a[target="_blank"] — The link has insufficient color contrast of 1.93:1 with the surrounding text. (Minimum contrast is 3:1, link t
```

#### `CLAIR-AXE-SCROLLABLE-REGION-FOCUSABLE` stats.html (thème clair) : scrollable-region-focusable × 1

sonde **parcours** · catégorie accessibilité · effort S · `stats.html`

```
#st-repartition-chiffres — Element should have focusable content
```

#### `ANGLAIS-RESTE-FRANCAIS` — 8 occurrences

**Correctif** : Ajouter les entrées à assets/i18n/en.json ; traduire aussi title, aria-label et placeholder. (effort unitaire S)

- accueil.html en anglais : 13 texte(s) encore en français — `accueil.html`
- catalogue.html en anglais : 32 texte(s) encore en français — `catalogue.html`
- index.html en anglais : 14 texte(s) encore en français — `index.html`
- parametres.html en anglais : 36 texte(s) encore en français — `parametres.html`
- recherche.html en anglais : 52 texte(s) encore en français — `recherche.html`
- sources.html en anglais : 29 texte(s) encore en français — `sources.html`
- stats.html en anglais : 427 texte(s) encore en français — `stats.html`
- systeme.html en anglais : 47 texte(s) encore en français — `systeme.html`

#### `BTN-RECOUVERT` chapitre.html : « Téléchargements » ne répond pas au clic — recouvert par div#readerPagesArea.reader-pages-area

sonde **boutons** · catégorie bug · effort S · `chapitre.html`

```
fond rgba(0, 0, 0, 0), opacité 1, position relative, z-index auto
```

**Correctif** : Le clic atteint la couche et non le contrôle : pointer-events:none sur la couche, ou rehausser le contrôle.

#### `BTN-RECOUVERT` import.html : « Import a file » ne répond pas au clic — recouvert par div.mh-etat-vide

sonde **boutons** · catégorie bug · effort S · `import.html`

```
fond rgba(0, 0, 0, 0), opacité 1, position static, z-index auto
```

**Correctif** : Le clic atteint la couche et non le contrôle : pointer-events:none sur la couche, ou rehausser le contrôle.

#### `BTN-RESEAU-KO` serie.html : clic sur « Sources » → requête en échec (502 GET /api/sources/royalroad/mangas/search)

sonde **boutons** · catégorie bug · effort S · `serie.html`

```
502 GET /api/sources/royalroad/mangas/search
```

#### `BTN-RESEAU-KO` serie.html : clic sur « Resume my last read » → requête en échec (502 GET /api/sources/royalroad/mangas/search)

sonde **boutons** · catégorie bug · effort S · `serie.html`

```
502 GET /api/sources/royalroad/mangas/search
```

#### `PAGE-CLS` — 8 occurrences

**Correctif** : Réserver la place (aspect-ratio / min-height) des cartes et images avant leur arrivée. (effort unitaire M)

- accueil.html (bureau) : décalage de mise en page CLS = 0.33 — `accueil.html`
- catalogue.html (bureau) : décalage de mise en page CLS = 0.73 — `catalogue.html`
- index.html (bureau) : décalage de mise en page CLS = 0.33 — `index.html`
- recherche.html (bureau) : décalage de mise en page CLS = 0.56 — `recherche.html`
- sources.html (bureau) : décalage de mise en page CLS = 0.43 — `sources.html`
- stats.html (bureau) : décalage de mise en page CLS = 0.39 — `stats.html`
- recherche.html (mobile) : décalage de mise en page CLS = 0.31 — `recherche.html`
- stats.html (mobile) : décalage de mise en page CLS = 0.44 — `stats.html`

#### `AXE-COLOR-CONTRAST` — 6 occurrences

(effort unitaire S)

- anilist.html : axe « color-contrast » (serious) × 1 — `anilist.html`
- bibliotheque.html : axe « color-contrast » (serious) × 2 — `bibliotheque.html`
- confidentialite.html : axe « color-contrast » (serious) × 2 — `confidentialite.html`
- lecture.html : axe « color-contrast » (serious) × 1 — `lecture.html`
- stats.html : axe « color-contrast » (serious) × 12 — `stats.html`
- systeme.html : axe « color-contrast » (serious) × 21 — `systeme.html`

#### `AXE-ARIA-REQUIRED-CHILDREN` bibliotheque.html : axe « aria-required-children » (critical) × 1

sonde **pages** · catégorie accessibilité · effort S · `bibliotheque.html`

```
Certain ARIA roles must contain particular children
ex. #libCats
```

#### `AXE-LINK-IN-TEXT-BLOCK` confidentialite.html : axe « link-in-text-block » (serious) × 2

sonde **pages** · catégorie accessibilité · effort S · `confidentialite.html`

```
Links must be distinguishable without relying on color
ex. a[href$="parametres.html"]
```

#### `AXE-SCROLLABLE-REGION-FOCUSABLE` stats.html : axe « scrollable-region-focusable » (serious) × 1

sonde **pages** · catégorie accessibilité · effort S · `stats.html`

```
Scrollable region must have keyboard access
ex. #st-repartition-chiffres
```

#### `VOL-DOM` bibliotheque.html avec 2000 favoris : 26 577 éléments dans la page

sonde **charge** · catégorie performance · effort M · `bibliotheque.html`

```
Rendu en 16059 ms, 2557 ms de tâches longues (pire : 129 ms), 3 Mo de mémoire.
```

**Correctif** : Liste virtualisée ou pagination ; ne construire que ce qui est à l'écran.

#### `VOL-DOM` bibliotheque.html avec 10000 favoris : 46 448 éléments dans la page

sonde **charge** · catégorie performance · effort M · `bibliotheque.html`

```
Rendu en 37260 ms, 21817 ms de tâches longues (pire : 471 ms), 8 Mo de mémoire.
```

**Correctif** : Liste virtualisée ou pagination ; ne construire que ce qui est à l'écran.

#### `SD-ROLE-CONFIG` POST /api/app/update n'exige qu'une session, pas le rôle administrateur

sonde **securite-dyn** · catégorie sécurité · effort S · `server/routes/index.js`

```
Lu dans routes/index.js : authRequired sans adminRequired sur une route qui agit sur toute l'instance.
```

**Correctif** : Ajouter adminRequired.

#### `SD-ROLE-CONFIG` PUT /api/auth/google-config n'exige qu'une session, pas le rôle administrateur

sonde **securite-dyn** · catégorie sécurité · effort S · `server/routes/index.js`

```
Lu dans routes/index.js : authRequired sans adminRequired sur une route qui agit sur toute l'instance.
```

**Correctif** : Ajouter adminRequired.

#### `SD-ROLE-CONFIG` PUT /api/anilist/config n'exige qu'une session, pas le rôle administrateur

sonde **securite-dyn** · catégorie sécurité · effort S · `server/routes/index.js`

```
Lu dans routes/index.js : authRequired sans adminRequired sur une route qui agit sur toute l'instance.
```

**Correctif** : Ajouter adminRequired.

#### `SD-DECONNEXION` Se déconnecter ne ferme pas la session : le jeton reste valable 30 jours

sonde **securite-dyn** · catégorie sécurité · effort S · `server/controllers/auth.controller.js`

```
POST /api/auth/logout efface seulement le cookie ; le même jeton obtient toujours 200 sur /api/auth/me.
```

**Correctif** : logout : supprimer la ligne sessions du jti présenté.

#### `SD-SSRF-REDIRECTION` Le relais d'images suit les redirections sans revérifier la destination

sonde **securite-dyn** · catégorie sécurité · effort S · `server/controllers/image.controller.js:323`

```
curl -L --max-redirs 4 : seul le premier hôte passe par hostAllowed et resolveSafeHost. Un domaine autorisé qui redirige (redirection ouverte, CDN compromis) fait atteindre une adresse interne. Vérifié à la main sur la fonction de téléchargement (redirection vers 127.0.0.1 suivie) ; la sonde le constate dans le code.
```

**Correctif** : Suivre les redirections à la main en revalidant chaque saut, ou --max-redirs 0 puis boucle.

#### `ROMAN-PROGRESSION` La lecture d'un roman n'est pas enregistrée

sonde **lecteur** · catégorie lecteur · effort S · `assets/js/lecture.js`

```
null
```

#### `MOB-CIBLE-24` — 15 occurrences

**Correctif** : min-width et min-height à 44 px (zone d'appui, pas forcément le dessin). (effort unitaire S)

- accueil.html : 6 cible(s) tactile(s) sous 24 px (minimum WCAG 2.2) — `accueil.html`
- catalogue.html : 35 cible(s) tactile(s) sous 24 px (minimum WCAG 2.2) — `catalogue.html`
- chapitre.html : 2 cible(s) tactile(s) sous 24 px (minimum WCAG 2.2) — `chapitre.html`
- collection-detail.html : 2 cible(s) tactile(s) sous 24 px (minimum WCAG 2.2) — `collection-detail.html`
- collections.html : 1 cible(s) tactile(s) sous 24 px (minimum WCAG 2.2) — `collections.html`
- comparer.html : 1 cible(s) tactile(s) sous 24 px (minimum WCAG 2.2) — `comparer.html`
- lecture.html : 1 cible(s) tactile(s) sous 24 px (minimum WCAG 2.2) — `lecture.html`
- liste.html : 1 cible(s) tactile(s) sous 24 px (minimum WCAG 2.2) — `liste.html`
- localreader.html : 1 cible(s) tactile(s) sous 24 px (minimum WCAG 2.2) — `localreader.html`
- notes.html : 1 cible(s) tactile(s) sous 24 px (minimum WCAG 2.2) — `notes.html`
- parametres.html : 3 cible(s) tactile(s) sous 24 px (minimum WCAG 2.2) — `parametres.html`
- profil.html : 7 cible(s) tactile(s) sous 24 px (minimum WCAG 2.2) — `profil.html`
- recherche.html : 1 cible(s) tactile(s) sous 24 px (minimum WCAG 2.2) — `recherche.html`
- serie.html : 11 cible(s) tactile(s) sous 24 px (minimum WCAG 2.2) — `serie.html`
- u.html : 1 cible(s) tactile(s) sous 24 px (minimum WCAG 2.2) — `u.html`

#### `MOB-BARRE-MASQUE` bibliotheque.html : en bas de page, des contrôles restent sous la barre fixe

sonde **mobile** · catégorie mobile · effort S · `bibliotheque.html`

```
Monster 28 × Pas commencé
Akira 29 × Pas commencé
Blame! 30 × Pas commencé
```

**Correctif** : padding-bottom égal à la hauteur de la barre et à env(safe-area-inset-bottom).

#### `MOB-BARRE-MASQUE` collection-detail.html : en bas de page, des contrôles restent sous la barre fixe

sonde **mobile** · catégorie mobile · effort S · `collection-detail.html`

```
← Toutes mes listes
```

**Correctif** : padding-bottom égal à la hauteur de la barre et à env(safe-area-inset-bottom).

#### `MOB-BARRE-MASQUE` collections.html : en bas de page, des contrôles restent sous la barre fixe

sonde **mobile** · catégorie mobile · effort S · `collections.html`

```
Importer un fichier
```

**Correctif** : padding-bottom égal à la hauteur de la barre et à env(safe-area-inset-bottom).

#### `MOB-BARRE-MASQUE` import.html : en bas de page, des contrôles restent sous la barre fixe

sonde **mobile** · catégorie mobile · effort S · `import.html`

```
Choisir un fichier
```

**Correctif** : padding-bottom égal à la hauteur de la barre et à env(safe-area-inset-bottom).

#### `MOB-BARRE-MASQUE` parametres.html : en bas de page, des contrôles restent sous la barre fixe

sonde **mobile** · catégorie mobile · effort S · `parametres.html`

```
Gérer
```

**Correctif** : padding-bottom égal à la hauteur de la barre et à env(safe-area-inset-bottom).

#### `SAISIE-5XX` — 11 occurrences

(effort unitaire S)

- comparer.html : saisie dans « headerSearch » → erreur serveur — `comparer.html`
- downloads.html : saisie dans « headerSearch » → erreur serveur — `downloads.html`
- import.html : saisie dans « headerSearch » → erreur serveur — `import.html`
- lecture.html : saisie dans « headerSearch » → erreur serveur — `lecture.html`
- notifications.html : saisie dans « headerSearch » → erreur serveur — `notifications.html`
- parametres.html : saisie dans « headerSearch » → erreur serveur — `parametres.html`
- recherche.html : saisie dans « headerSearch » → erreur serveur — `recherche.html`
- serie.html : saisie dans « headerSearch » → erreur serveur — `serie.html`
- sources.html : saisie dans « headerSearch » → erreur serveur — `sources.html`
- stats.html : saisie dans « headerSearch » → erreur serveur — `stats.html`
- u.html : saisie dans « headerSearch » → erreur serveur — `u.html`

#### `REF-SANS-CONNEXION` Aucun écran ne permet de se connecter

sonde **references** · catégorie fonction absente · effort S · `assets/js/api.js`

```
API.auth.login n’est appelée nulle part. En mode multi-comptes (LOCAL_MODE=0, le profil Docker documenté), personne ne peut entrer par l’interface.
```

**Correctif** : Écran de connexion, d’inscription et de récupération.

#### `REF-SANS-INSCRIPTION` Aucun écran ne permet de créer un compte

sonde **references** · catégorie fonction absente · effort S · `assets/js/api.js`

```
API.auth.register n’est appelée nulle part.
```

**Correctif** : Écran de connexion, d’inscription et de récupération.

#### `REF-SANS-MDP` Aucun écran ne permet de changer son mot de passe

sonde **references** · catégorie fonction absente · effort S · `assets/js/api.js`

```
API.auth.changePassword n’est appelée nulle part.
```

**Correctif** : Écran de connexion, d’inscription et de récupération.

#### `REF-EFFACEMENT-IMPOSSIBLE` Le propriétaire d’une installation locale ne peut pas supprimer son compte

sonde **references** · catégorie bug · effort S · `server/controllers/auth.controller.js:482`

```
resolveOwner() crée le compte avec un mot de passe aléatoire que personne ne connaît ; deleteAccount exige ce mot de passe ; aucun écran ne permet d’en définir un.
```

**Correctif** : En mode local, confirmer par une phrase tapée (« SUPPRIMER ») sur la boucle locale.

#### `IMP-EPUB-REDIRECTION` Un livre peut emmener le lecteur vers une autre adresse

sonde **imports** · catégorie fichiers importés · effort S · `assets/js/localreader.js`

```
pistage-lien, rafraichir
```

**Correctif** : Retirer meta, neutraliser les liens externes.

#### `IMP-HORS-SAUVEGARDE` Les fichiers importés ne sont dans aucune sauvegarde

sonde **imports** · catégorie fichiers importés · effort M · `server/lib/backup.js`

```
server/lib/backup.js ne mentionne ni la table local_imports ni le dossier uploads, et l'export de compte non plus.
```

**Correctif** : Archive séparée des fichiers, ou le dire clairement dans l'interface.

#### `HL-BOUTON-MENT` Après un téléchargement réussi, le bouton propose encore « Télécharger » — et le toucher efface le chapitre

sonde **hors-ligne** · catégorie hors-ligne · effort S · `assets/js/chapitre.js`

```
Icône « réussi » affichée, infobulle et nom accessible : « Télécharger pour lire hors-ligne ». Un appui supprime alors le téléchargement, sans confirmation ni annulation.
Cause : chapitre.js, le bloc finally remet l'ancien titre après setDlIcon(true).
```

**Correctif** : Ne remettre le titre initial qu'en cas d'échec ; demander confirmation ou proposer « Annuler » à la suppression.

#### `HL-GESTES-PERDUS` Gestes faits sans réseau et perdus au retour : favori, note, signet

sonde **hors-ligne** · catégorie hors-ligne · effort M · `assets/js/api.js`

```
progression : refusé : Connexion impossible — vérifie ta connexion réseau. → arrivé
chapitre lu : refusé : Connexion impossible — vérifie ta connexion réseau. → arrivé
favori : refusé : Connexion impossible — vérifie ta connexion réseau. → perdu
note : refusé : Connexion impossible — vérifie ta connexion réseau. → perdu
signet : refusé : Connexion impossible — vérifie ta connexion réseau. → perdu
File d'attente : PUT /me/progress/01J76XY7KT7J224EBK6J816Y1Q, PUT /me/progress/hl-1, POST /me/read-chapters

Seules la progression et les chapitres lus sont mis en file (api.js, OFFLINE_OK).
```

**Correctif** : Mettre en file toutes les écritures de lecture (favoris, signets, notes), ou dire clairement qu'elles sont impossibles.

#### `LIV-SECOURS-CASSE` Le téléchargement de secours de la mise à jour est inutilisable : la commande PowerShell est invalide

sonde **livraison** · catégorie livraison · effort S · `server/controllers/update.controller.js:125`

```
Rejouée à l'identique (update.controller.js:125) sur un fichier inoffensif :
Invoke-WebRequest : Le paramtre ne peut pas tre trait, car le nom de paramtre ®u¯ est ambigu. Les correspondances possibles sont: -UseBasicParsing -Uri -UseDefaultCredentials -UserAgent. Au caractre Ligne:1 : 69 + ... $o) Invoke-WebRequest -Uri $u -OutFile $o -UseBasicParsing -u http:// ... + ~~ + CategoryInfo : InvalidArgument : (:) [Invoke-WebRequest], ParameterBindingException + FullyQuali

Avec -Command, les arguments qui suivent sont recollés au texte de la commande au lieu d'être passés au bloc param().
```

**Correctif** : Passer par -File avec un script .ps1, ou par des variables d'environnement lues dans la commande ; ajouter un test sous Windows.

#### `LIV-SIGNATURE-CASSEE` La vérification de signature de l'installeur échoue toujours : la commande PowerShell est invalide

sonde **livraison** · catégorie livraison · effort S · `server/controllers/update.controller.js:174`

```
Rejouée à l'identique (update.controller.js:174) sur un fichier inoffensif :
Au caractre Ligne:1 : 62 + ... ram($p) (Get-AuthenticodeSignature -LiteralPath $p).Status -p C:\WIND ... + ~~ Jeton inattendu ®ÿ-pÿ¯ dans l'expression ou l'instruction. Au caractre Ligne:1 : 65 + ... eSignature -LiteralPath $p).Status -p C:\WINDOWS\System32\notepad.exe + ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ Jeton inattendu ®ÿC:\WINDOWS\System32\notepad.exeÿ¯ dans l'expression ou l'instruction. + Cate

Avec -Command, les arguments qui suivent sont recollés au texte de la commande au lieu d'être passés au bloc param().
```

**Correctif** : Passer par -File avec un script .ps1, ou par des variables d'environnement lues dans la commande ; ajouter un test sous Windows.

#### `LIV-SOURCES-FIGEES` L'application installée ne reçoit jamais de correctif de source entre deux versions

sonde **livraison** · catégorie livraison · effort M · `server/controllers/extensions.controller.js`

```
L'installeur embarque extensions-community/ ; getLatestManifest, getExpectedHashes et getLatestSource lisent ce dossier dès qu'il existe et n'interrogent GitHub que sinon. Le bouton « Mettre à jour » compare donc la version installée à la copie livrée avec elle. La réparation de SushiScan, par exemple, exigera une nouvelle version complète. Déduit du code et de la configuration du paquet.
```

**Correctif** : Interroger d'abord la dernière version publiée, ne se rabattre sur la copie livrée qu'hors ligne.

#### `EX-CSV-FORMULE` Les exports CSV laissent des titres s'exécuter comme des formules dans un tableur

sonde **exactitude** · catégorie exactitude · effort S · `assets/js/bibliotheque.js`

```
Cellules commençant par = + - @ : =HYPERLINK("http://piege.exemple.test","clic") · +33 1 23 45 67 89 · -2+3*cmd · @SUM(A1:A9)
Un titre venu d'une source ou d'un fichier importé devient une formule à l'ouverture dans Excel (les guillemets ne protègent pas).
```

**Correctif** : Préfixer ces cellules d'une apostrophe dans les deux exports.

#### `APP-DROIT` Un téléphone appairé peut émettre un code d’appairage

sonde **appareils** · catégorie multi-appareils · effort S · `server/routes/index.js`

```
POST /api/devices/pair-code → 200. L'appairage donne le rôle « lecteur », sans administration.
Un téléphone volé peut ainsi appairer d'autres appareils avant d'être révoqué.
```

**Correctif** : Réserver l'émission de codes aux sessions qui ne viennent pas d'un appareil.

#### `ADM-SANS-ADMIN` Sur une instance neuve à plusieurs comptes, personne n'est administrateur

sonde **administration** · catégorie instance partagée · effort S · `server/controllers/auth.controller.js`

```
Le premier compte inscrit a le rôle « user ». Aucune commande ni variable ne permet de nommer un administrateur : la modération et la gestion des extensions sont hors d'atteinte.
```

**Correctif** : Premier compte administrateur, ou script « promouvoir » documenté.

#### `ADM-REGLE` Règle non tenue : un membre voit l’instance, pas le privé d’autrui

sonde **administration** · catégorie instance partagée · effort S · `server/controllers/user.controller.js`

```
{"items":[{"id":1,"text":"racine publique","chapterId":null,"parentId":null,"visibility":"public","spoiler":false,"user":"Second","avatar":"S","createdAt":"2026-11-25T23:04:10.000Z","reports":0}],"tot
```

**Correctif** : Corriger et ajouter le cas aux tests.

#### `RES-SESSION-PERDUE` Quand la base tombe, le serveur répond « non authentifié » : l'application déconnecte l'utilisateur

sonde **resilience** · catégorie robustesse · effort S · `server/middleware/auth.js`

```
{"error":"Token invalide ou expiré"}
```

**Correctif** : Répondre 503 et garder la session côté client.

#### `EXP-REBINDING` Le serveur répond à n’importe quel nom d’hôte et rend alors le jeton de réinitialisation : un site visité pourrait prendre le compte

sonde **exposition** · catégorie sécurité · effort S · `server/controllers/auth.controller.js`

```
Requête locale annonçant l'hôte et l'origine « piege.exemple.test » : page servie (HTTP 200), connexion automatique refusée (HTTP 403), mais /api/auth/forgot rend le jeton. Un site dont le nom de domaine est redirigé vers 127.0.0.1 devient « la même origine » et lit la réponse. Non éprouvé contre la protection d'accès au réseau local de chaque navigateur.
```

**Correctif** : N'accepter que les noms d'hôte attendus et ne jamais rendre ce jeton à une origine inconnue.

#### `EXP-REQUETE-FORGEE` Une page d'un autre port du même hôte peut effacer tout l'historique de lecture

sonde **exposition** · catégorie sécurité · effort S · `server/controllers/user.controller.js`

```
Après une simple visite d'Inko, la page d'un autre serveur local envoie un formulaire vide à /api/me/clear-history : positions 1 → 0, chapitres lus 1 → 0, activité 3 → 0. Le cookie « SameSite=Lax » accompagne la requête (les ports ne comptent pas), l'origine n'est pas vérifiée, et un corps absent signifie « tout effacer ».
```

**Correctif** : Exiger un corps JSON ou un en-tête propre à l'application sur toute écriture authentifiée par cookie ; exiger une confirmation dans la requête.

#### `NOUV-ANNONCES-PERDUES` Nouveaux chapitres : seules 5 séries sur 12 sont annoncées, les autres ne le seront jamais

sonde **nouveautes** · catégorie fonctionnement · effort S · `server/lib/updates.js`

```
Trois passages de la tâche de fond, 12 séries avec un chapitre de plus : séries annoncées après chaque passage = 5, 5, 5. Le code garde au plus cinq annonces par passage « le reste au cycle suivant », mais le même passage enregistre le dernier chapitre de toutes les séries (12 sur 12) : au suivant, plus aucune n'est considérée comme nouvelle.
```

**Correctif** : N'enregistrer le dernier chapitre annoncé qu'après l'annonce, ou regrouper en une notification « et N autres ».

#### `NOUV-HORLOGE-BLOQUE` Un appareil à l'heure fausse fige la position de lecture sur tous les autres

sonde **nouveautes** · catégorie fonctionnement · effort S · `server/controllers/user.controller.js`

```
Un enregistrement daté d'un an dans le futur (chapitre 3), puis un enregistrement normal (chapitre 8) : le serveur répond 200 « réussi », la base garde le chapitre 3. La position reste figée jusqu'à ce que la date rattrape celle du premier appareil.
```

**Correctif** : Borner la date du client à l'heure du serveur (quelques minutes de tolérance).

#### `MIG-LAISSE-DERRIERE` Changer de source laisse derrière : activité, place dans les listes, historique des positions

sonde **migration** · catégorie données · effort M · `server/lib/migration-sources.js`

```
activité : 13 ligne(s) encore attachée(s) à l'ancienne série
place dans les listes : 1 ligne(s) encore attachée(s) à l'ancienne série
historique des positions : 2 ligne(s) encore attachée(s) à l'ancienne série
La série disparaît donc de ses listes, ou y reste sous une source morte.
```

**Correctif** : Déplacer aussi les listes, l'historique, l'activité et les commentaires.

#### `MIG-ANNULATION-INEXACTE` « Annuler » une migration ne rend pas l'état d'avant (15 écart(s))

sonde **migration** · catégorie données · effort M · `server/lib/migration-sources.js`

```
signets.created_at : "2026-11-26T14:52:19.000Z" → "2026-11-26T14:52:20.000Z"
signets.note : "Perdu ?" → null
signets.created_at : "2026-11-26T14:52:19.000Z" → "2026-11-26T14:52:20.000Z"
signets.note : "La phrase à garder" → null
favori.added_at : "2024-03-01T09:00:00.000Z" → "2026-11-26T14:52:19.000Z"
favori.notify : 0 → 1
favori.unread_count : 0 → null
chapitres lus.read_at : "2026-11-26T14:52:17.000Z" → "2026-11-26T14:52:19.000Z"
chapitres lus.read_at : "2026-11-26T14:52:19.000Z" → "2026-11-26T14:52:20.000Z"
chapitres lus.read_at : "2026-11-26T14:52:19.000Z" → "2026-11-26T14:52:20.000Z"
chapitres lus.read_at : "2026-11-26T14:52:19.000Z" → "2026-11-26T14:52:20.000Z"
chapitres lus.read_at : "2026-11-26T14:52:19.000Z" → "2026-11-26T14:52:20.000Z"
chapitres lus.read_at : "2026-11-26T14:52:19.000Z" → "2026-11-26T14:52:20.000Z"
chapitres lus.read_at : "2026-11-26T14:52:19.000Z" → "2026-11-26
```

**Correctif** : Restaurer toutes les colonnes photographiées.

#### `BDE-ROOT-SANS-MOT-DE-PASSE` Base embarquée : le compte administrateur reste ouvert sans mot de passe

sonde **base-embarquee** · catégorie sécurité · effort S · `server/lib/embedded-db.js`

```
Après le démarrage et la pose annoncée du mot de passe, une connexion « root » sans mot de passe réussit.
mariadb.sys@localhost : SANS mot de passe
root@localhost : avec mot de passe
root@(nom de la machine) : SANS mot de passe
root@127.0.0.1 : SANS mot de passe
root@::1 : SANS mot de passe
PUBLIC@(nom de la machine) : SANS mot de passe
```

**Correctif** : Protéger ou supprimer tous les comptes root, pas seulement root@localhost.

#### `COQ-AUTRE-PROGRAMME` Application Windows : n'importe quel programme qui occupe le port 8088 s'affiche dans la fenêtre d'Inko

sonde **coquille** · catégorie sécurité · effort S · `desktop-tauri/ui/index.html`

```
L'écran de démarrage accepte toute réponse « réussie » sur /api/health (ici un corps vide « {} ») puis ouvre la page servie. Les droits de fenêtre de l'application sont accordés à tout ce qui répond à cette adresse. Un second serveur Inko, un autre projet local ou un programme malveillant prend ainsi la place, avec son propre contenu.
```

**Correctif** : Vérifier une identité propre à ce lancement (jeton partagé avec le serveur démarré) avant d'ouvrir.

#### `COQ-DONNEES-DANS-INSTALLATION` Application Windows : sauvegardes et fichiers importés sont rangés dans le dossier d'installation

sonde **coquille** · catégorie données · effort M · `desktop-tauri/src-tauri/src/main.rs`

```
Le lanceur ne fixe pas BACKUP_DIR : les sauvegardes vont dans resources\server\backups, à côté du programme (constaté sur l'application installée), et les fichiers importés dans resources\server\uploads. Le code de la base annonce pourtant que les données de l'utilisateur ne vivent jamais dans ce dossier. Leur sort à la désinstallation n'a pas été éprouvé.
```

**Correctif** : Les placer sous %APPDATA%\Inko et déplacer l'existant.

#### `COQ-DOCKER-SANS-VOLUME` Avec Docker, les fichiers importés et les sauvegardes disparaissent à chaque mise à jour

sonde **coquille** · catégorie données · effort S · `docker-compose.yml`

```
Le service de l'application n'a aucun volume : uploads, backups et config vivent dans le conteneur, remplacé par « docker compose up --build ». Déduit de la configuration (Docker absent de cette machine).
```

**Correctif** : Monter uploads, backups et config sur des volumes.

### 🟡 Moyenne (468)

#### `STR-GROS` — 11 occurrences

**Correctif** : Découper par responsabilité (init / rendu / événements / réseau) sous window.MH. (effort unitaire L)

- Fichier obèse : server/controllers/user.controller.js (1964 lignes) — `server/controllers/user.controller.js`
- Fichier obèse : assets/js/bibliotheque.js (1948 lignes) — `assets/js/bibliotheque.js`
- Fichier obèse : assets/js/serie.js (1920 lignes) — `assets/js/serie.js`
- Fichier obèse : server/test/integration.db.test.js (1622 lignes) — `server/test/integration.db.test.js`
- Fichier obèse : assets/js/profil.js (1576 lignes) — `assets/js/profil.js`
- Fichier obèse : assets/js/catalogue.js (1397 lignes) — `assets/js/catalogue.js`
- Fichier obèse : assets/js/api.js (1260 lignes) — `assets/js/api.js`
- Fichier obèse : assets/js/parametres.js (1180 lignes) — `assets/js/parametres.js`
- Fichier obèse : assets/js/lecture.js (1091 lignes) — `assets/js/lecture.js`
- Fichier obèse : server/db/migrate.js (1074 lignes) — `server/db/migrate.js`
- Fichier obèse : test/e2e/audit-controles.spec.js (928 lignes) — `test/e2e/audit-controles.spec.js`

#### `STR-FONCTION` — 10 occurrences

**Correctif** : Extraire des sous-fonctions nommées ; isoler la partie pure du rendu DOM. (effort unitaire M)

- Fonction géante : auditerMode() — 284 lignes — `test/e2e/audit-controles.spec.js:375`
- Fonction géante : fin() — 260 lignes — `assets/js/serie.js:980`
- Fonction géante : titreDeSecours() — 233 lignes — `assets/js/global.js:2253`
- Fonction géante : set() — 194 lignes — `assets/js/profil.js:1029`
- Fonction géante : repondre() — 180 lignes — `assets/js/hub.js:171`
- Fonction géante : migrer() — 176 lignes — `server/lib/migration-sources.js:75`
- Fonction géante : k() — 164 lignes — `assets/js/bibliotheque.js:1026`
- Fonction géante : esc() — 163 lignes — `assets/js/bibliotheque.js:488`
- Fonction géante : renderChapitres() — 146 lignes — `assets/js/serie.js:1593`
- Fonction géante : chargerReprise() — 143 lignes — `assets/js/accueil.js:83`

#### `ECOUTEURS-APRES-ATTENTE` lecture.js : 2 branchement(s) de contrôles APRÈS `const dl = window.Downloads ? await window.Downloads.get(chapterId) : null;` — les boutons sont inertes tant que le réseau n'a pas répondu

sonde **ecouteurs** · catégorie bug · effort S · `assets/js/lecture.js:118`

```
Attente ligne 118, premier branchement ligne 150.
Branchés en retard : bindScrollProgress(); · bindKeyboard();
```

**Correctif** : Brancher les écouteurs (ils ne dépendent que du DOM statique) AVANT l'attente, ou déléguer l'événement sur le conteneur ; lancer le chargement sans `await` et re-rendre à l'arrivée des données.

#### `ECOUTEURS-APRES-ATTENTE` notifications.js : 1 branchement(s) de contrôles APRÈS `try { await API.notifications.markAll(); items.forEach(n => { n.read = true; }); render();` — les boutons sont inertes tant que le réseau n'a pas répondu

sonde **ecouteurs** · catégorie bug · effort S · `assets/js/notifications.js:46`

```
Attente ligne 46, premier branchement ligne 50.
Branchés en retard : document.getElementById('ntRefresh')?.addEventListener('clic
```

**Correctif** : Brancher les écouteurs (ils ne dépendent que du DOM statique) AVANT l'attente, ou déléguer l'événement sur le conteneur ; lancer le chargement sans `await` et re-rendre à l'arrivée des données.

#### `ECOUTEURS-APRES-ATTENTE` profil.js : 1 branchement(s) de contrôles APRÈS `try { privacy = (await API.me.settings())?.privacy || {}; } catch (e) { window.MH?.err?.('` — les boutons sont inertes tant que le réseau n'a pas répondu

sonde **ecouteurs** · catégorie bug · effort S · `assets/js/profil.js:1231`

```
Attente ligne 1231, premier branchement ligne 1244.
Branchés en retard : t.addEventListener('click', async () => {
```

**Correctif** : Brancher les écouteurs (ils ne dépendent que du DOM statique) AVANT l'attente, ou déléguer l'événement sur le conteneur ; lancer le chargement sans `await` et re-rendre à l'arrivée des données.

#### `FLUX-JOURNAL-ERREURS` Le serveur a journalisé des erreurs pendant les parcours

sonde **flux-ecriture** · catégorie bug · effort M

```
Error: Service name is already in use on the network
```

#### `SEC-XSS-CANDIDAT` — 28 occurrences

**Correctif** : Passer chaque valeur venue du réseau ou de l'utilisateur par MH.esc(), ou construire les nœuds avec textContent. (effort unitaire S)

- 1 injection(s) HTML à vérifier dans assets/js/accueil.js — `assets/js/accueil.js:137`
- 1 injection(s) HTML à vérifier dans assets/js/appairage.js — `assets/js/appairage.js:180`
- 5 injection(s) HTML à vérifier dans assets/js/bibliotheque.js — `assets/js/bibliotheque.js:259`
- 7 injection(s) HTML à vérifier dans assets/js/catalogue.js — `assets/js/catalogue.js:279`
- 1 injection(s) HTML à vérifier dans assets/js/collection-detail.js — `assets/js/collection-detail.js:53`
- 1 injection(s) HTML à vérifier dans assets/js/downloads-page.js — `assets/js/downloads-page.js:120`
- 1 injection(s) HTML à vérifier dans assets/js/feuille.js — `assets/js/feuille.js:113`
- 6 injection(s) HTML à vérifier dans assets/js/global.js — `assets/js/global.js:291`
- 2 injection(s) HTML à vérifier dans assets/js/import-listes.js — `assets/js/import-listes.js:157`
- 4 injection(s) HTML à vérifier dans assets/js/import.js — `assets/js/import.js:13`
- 3 injection(s) HTML à vérifier dans assets/js/lecture.js — `assets/js/lecture.js:230`
- 1 injection(s) HTML à vérifier dans assets/js/liste.js — `assets/js/liste.js:42`
- 1 injection(s) HTML à vérifier dans assets/js/localreader.js — `assets/js/localreader.js:396`
- 4 injection(s) HTML à vérifier dans assets/js/migration.js — `assets/js/migration.js:146`
- 4 injection(s) HTML à vérifier dans assets/js/music.js — `assets/js/music.js:384`
- 1 injection(s) HTML à vérifier dans assets/js/notes-ui.js — `assets/js/notes-ui.js:123`
- 8 injection(s) HTML à vérifier dans assets/js/notes.js — `assets/js/notes.js:69`
- 1 injection(s) HTML à vérifier dans assets/js/notifications.js — `assets/js/notifications.js:20`
- 2 injection(s) HTML à vérifier dans assets/js/onboarding.js — `assets/js/onboarding.js:186`
- 7 injection(s) HTML à vérifier dans assets/js/parametres.js — `assets/js/parametres.js:188`
- 4 injection(s) HTML à vérifier dans assets/js/profil.js — `assets/js/profil.js:72`
- 3 injection(s) HTML à vérifier dans assets/js/recherche.js — `assets/js/recherche.js:263`
- 1 injection(s) HTML à vérifier dans assets/js/sauvegarde-chiffree.js — `assets/js/sauvegarde-chiffree.js:78`
- 1 injection(s) HTML à vérifier dans assets/js/sources.js — `assets/js/sources.js:43`
- 2 injection(s) HTML à vérifier dans assets/js/stats.js — `assets/js/stats.js:16`
- 3 injection(s) HTML à vérifier dans assets/js/systeme.js — `assets/js/systeme.js:230`
- 1 injection(s) HTML à vérifier dans assets/js/u.js — `assets/js/u.js:71`
- 1 injection(s) HTML à vérifier dans tools/promo-slide.html — `tools/promo-slide.html:40`

#### `SEC-COOKIE` Cookie sans httpOnly/sameSite visibles

sonde **securite** · catégorie sécurité · effort S · `server/controllers/auth.controller.js:131`

```
res.cookie(COOKIE_NAME, token, COOKIE_OPTS)
```

#### `SEC-COOKIE` Cookie sans httpOnly/sameSite visibles

sonde **securite** · catégorie sécurité · effort S · `server/controllers/auth.controller.js:216`

```
res.cookie(COOKIE_NAME, token, COOKIE_OPTS)
```

#### `SEC-COOKIE` Cookie sans httpOnly/sameSite visibles

sonde **securite** · catégorie sécurité · effort S · `server/controllers/auth.controller.js:235`

```
res.cookie(COOKIE_NAME, token, COOKIE_OPTS)
```

#### `SEC-COOKIE` Cookie sans httpOnly/sameSite visibles

sonde **securite** · catégorie sécurité · effort S · `server/controllers/auth.controller.js:307`

```
res.cookie(COOKIE_NAME, token, COOKIE_OPTS)
```

#### `SEC-COOKIE` Cookie sans httpOnly/sameSite visibles

sonde **securite** · catégorie sécurité · effort S · `server/controllers/auth.controller.js:422`

```
res.cookie(COOKIE_NAME, fresh, COOKIE_OPTS)
```

#### `SEC-FUITE-ERREUR` — 6 occurrences

**Correctif** : Journaliser côté serveur, renvoyer un message générique. (effort unitaire S)

- Message ou stack d'exception renvoyé au client — `server/controllers/auth.controller.js:205`
- Message ou stack d'exception renvoyé au client — `server/controllers/extensions.controller.js:221`
- Message ou stack d'exception renvoyé au client — `server/controllers/extensions.controller.js:237`
- Message ou stack d'exception renvoyé au client — `server/controllers/local.controller.js:83`
- Message ou stack d'exception renvoyé au client — `server/controllers/migration.controller.js:174`
- Message ou stack d'exception renvoyé au client — `server/controllers/update.controller.js:251`

#### `RTE-SORTIE-SANS-LIMITEUR` GET /anilist/config (sortie réseau probable) sans limiteur

sonde **routes** · catégorie robustesse · effort S · `server/routes/index.js:145`

**Correctif** : searchLimiter / relayLimiter selon le cas : chaque appel peut se transformer en N requêtes vers un site tiers.

#### `RTE-SORTIE-SANS-LIMITEUR` GET /me/read-chapters (sortie réseau probable) sans limiteur

sonde **routes** · catégorie robustesse · effort S · `server/routes/index.js:195`

**Correctif** : searchLimiter / relayLimiter selon le cas : chaque appel peut se transformer en N requêtes vers un site tiers.

#### `RTE-SORTIE-SANS-LIMITEUR` GET /me/anilist-links (sortie réseau probable) sans limiteur

sonde **routes** · catégorie robustesse · effort S · `server/routes/index.js:328`

**Correctif** : searchLimiter / relayLimiter selon le cas : chaque appel peut se transformer en N requêtes vers un site tiers.

#### `RTE-CORPS-12MO` Corps JSON plafonné à 12 Mo pour TOUTES les routes

sonde **routes** · catégorie robustesse · effort S · `server/app.js:28`

```
Le plafond généreux sert à l'import de sauvegarde ; il s'applique aussi à /auth/login.
```

**Correctif** : json({limit:'100kb'}) par défaut ; un parseur à 12 Mo uniquement sur les routes d'import.

#### `SQL-SANS-LIMITE` — 6 occurrences

**Correctif** : Pagination (LIMIT/OFFSET ou curseur). (effort unitaire S)

- SELECT sur table qui croît sans LIMIT — `server/controllers/notes.controller.js:163`
- SELECT sur table qui croît sans LIMIT — `server/controllers/notes.controller.js:174`
- SELECT sur table qui croît sans LIMIT — `server/controllers/user.controller.js:369`
- SELECT sur table qui croît sans LIMIT — `server/controllers/user.controller.js:1448`
- SELECT sur table qui croît sans LIMIT — `server/lib/backup.js:87`
- SELECT sur table qui croît sans LIMIT — `server/lib/updates.js:257`

#### `SQL-N-PLUS-1` 29 requête(s) SQL dans une boucle (N+1 possible)

sonde **sql** · catégorie performance · effort M

```
server/controllers/notes.controller.js:174
server/controllers/profile.controller.js:109
server/controllers/user.controller.js:95
server/controllers/user.controller.js:876
server/controllers/user.controller.js:1421
server/controllers/user.controller.js:1425
server/controllers/user.controller.js:1504
server/db/migrate.js:743
server/db/migrate.js:754
server/db/migrate.js:845
server/db/migrate.js:851
server/db/migrate.js:884
server/db/migrate.js:896
server/db/migrate.js:901
server/lib/migration-sources.js:149
server/lib/migration-sources.js:155
server/lib/migration-sources.js:223
server/lib/migration-sources.js:231
server/lib/migration-sources.js:341
server/lib/migration-sources.js:346
server/lib/reparation-couvertures.js:144
server/lib/updates.js:417
server/lib/updates.js:439
server/scripts/restore-backup.js:85
server/scripts/restore-backup.js:100
server/scripts/restore-backup.js:102
server
```

**Correctif** : Regrouper en une requête IN (?) ou INSERT multi-lignes ; transaction pour les écritures.

#### `SQL-SANS-TRANSACTION` server/controllers/auth.controller.js : 16 écritures SQL mais aucune transaction

sonde **sql** · catégorie intégrité · effort M · `server/controllers/auth.controller.js`

**Correctif** : Envelopper les opérations multi-tables (suppression de compte, import, fusion) dans une transaction.

#### `SQL-SANS-TRANSACTION` server/db/migrate.js : 8 écritures SQL mais aucune transaction

sonde **sql** · catégorie intégrité · effort M · `server/db/migrate.js`

**Correctif** : Envelopper les opérations multi-tables (suppression de compte, import, fusion) dans une transaction.

#### `SQL-MIGRATION-DESTRUCTRICE` Migration avec DROP COLUMN

sonde **sql** · catégorie intégrité · effort S · `server/db/migrate.js:145`

**Correctif** : Sauvegarde automatique avant migration destructrice (le dossier backups existe).

#### `SQL-MIGRATION-DESTRUCTRICE` Migration avec DROP TABLE

sonde **sql** · catégorie intégrité · effort S · `server/db/migrate.js:807`

**Correctif** : Sauvegarde automatique avant migration destructrice (le dossier backups existe).

#### `ERR--COUTEUR-GLOBAL-SANS-PASSIVE-THROTTLE` 1× « écouteur global sans passive/throttle » dans assets/js/catalogue.js

sonde **erreurs** · catégorie robustesse · effort S · `assets/js/catalogue.js:1382`

```
Lignes : 1382
```

**Correctif** : { passive: true } et rAF/throttle : bloque le défilement sur WebView Android 8.

#### `ERR-SETINTERVAL-SANS-CLEARINTERVAL` 1× « setInterval sans clearInterval » dans assets/js/pwa.js

sonde **erreurs** · catégorie robustesse · effort S · `assets/js/pwa.js:10`

```
Lignes : 10
```

**Correctif** : Arrêter le minuteur sur pagehide/visibilitychange (batterie, onglet en arrière-plan).

#### `ERR-SETINTERVAL-SANS-CLEARINTERVAL` 1× « setInterval sans clearInterval » dans server/lib/sessions.js

sonde **erreurs** · catégorie robustesse · effort S · `server/lib/sessions.js:86`

```
Lignes : 86
```

**Correctif** : Arrêter le minuteur sur pagehide/visibilitychange (batterie, onglet en arrière-plan).

#### `A11Y-BOUTON-MUET` Bouton à icône sans nom accessible

sonde **a11y-html** · catégorie accessibilité · effort S · `bibliotheque.html:52`

```
<button class="btn btn-secondary btn-sm ic-btn" id="btnLibFilters" aria-haspopup="dialog" aria-expanded="false"><svg viewBox="0 0 24 24" wid
```

**Correctif** : aria-label="…"

#### `A11Y-TITRE` <title> absent ou vide

sonde **a11y-html** · catégorie accessibilité · effort S · `chapitre.html`

#### `A11Y-TITRE` <title> absent ou vide

sonde **a11y-html** · catégorie accessibilité · effort S · `collection-detail.html`

#### `A11Y-TITRE` <title> absent ou vide

sonde **a11y-html** · catégorie accessibilité · effort S · `lecture.html`

#### `A11Y-TITRE` <title> absent ou vide

sonde **a11y-html** · catégorie accessibilité · effort S · `serie.html`

#### `A11Y-CHAMP-SANS-LABEL` <input> sans label

sonde **a11y-html** · catégorie accessibilité · effort S · `collections.html:69`

```
<input type="checkbox" value="reading">
```

#### `A11Y-CHAMP-SANS-LABEL` <input> sans label

sonde **a11y-html** · catégorie accessibilité · effort S · `collections.html:70`

```
<input type="checkbox" value="completed">
```

#### `A11Y-CHAMP-SANS-LABEL` <input> sans label

sonde **a11y-html** · catégorie accessibilité · effort S · `collections.html:71`

```
<input type="checkbox" value="planned">
```

#### `A11Y-CHAMP-SANS-LABEL` <input> sans label

sonde **a11y-html** · catégorie accessibilité · effort S · `collections.html:72`

```
<input type="checkbox" value="paused">
```

#### `A11Y-CHAMP-SANS-LABEL` <input> sans label

sonde **a11y-html** · catégorie accessibilité · effort S · `collections.html:73`

```
<input type="checkbox" value="dropped">
```

#### `A11Y-DIV-CLIQUABLE-JS` 2 élément(s) div/span cliquable(s) créés en JS sans rôle ni tabindex

sonde **a11y-html** · catégorie accessibilité · effort M

```
assets/js/cartes-gestes.js:318
assets/js/serie.js:188
```

**Correctif** : Utiliser <button>, ou role="button" + tabindex="0" + gestion Entrée/Espace.

#### `CSS-LOURDE` assets/css/global.css pèse 118 Ko (feuille bloquante au rendu)

sonde **css** · catégorie performance · effort M · `assets/css/global.css`

**Correctif** : Scinder : critique en tête, reste en chargement différé ; retirer les règles mortes.

#### `CSS-100VH` 3 usage(s) de height:100vh : la barre d'adresse mobile rogne la page

sonde **css** · catégorie mobile · effort S

**Correctif** : 100dvh avec repli 100vh (Android 8 ignore dvh : @supports).

#### `CSS-VAR-INDEFINIE` 4 variable(s) CSS utilisée(s) mais jamais définie(s)

sonde **css** · catégorie bug · effort S

```
--puce-graisse-on, --jauge-epaisseur, --mc, --h
```

**Correctif** : var(--x) sans définition retombe sur la valeur initiale : le style disparaît sans erreur.

#### `CSS-SELECTEURS-RECENTS` 3 sélecteur(s) :is()/:where()/:has() : ignorés par le WebView Android 8 (Chrome 61)

sonde **css** · catégorie mobile · effort S

**Correctif** : La règle entière est jetée par un navigateur qui ne connaît pas un sélecteur de la liste ; dupliquer sans :is().

#### `PERF-SCRIPTS-BLOQUANTS` — 23 occurrences

**Correctif** : defer sur tous les scripts non critiques ; conserve l'ordre d'exécution. (effort unitaire S)

- accueil.html : 16 scripts sans defer (parse bloquant) — `accueil.html`
- bibliotheque.html : 17 scripts sans defer (parse bloquant) — `bibliotheque.html`
- catalogue.html : 14 scripts sans defer (parse bloquant) — `catalogue.html`
- chapitre.html : 18 scripts sans defer (parse bloquant) — `chapitre.html`
- collection-detail.html : 6 scripts sans defer (parse bloquant) — `collection-detail.html`
- collections.html : 6 scripts sans defer (parse bloquant) — `collections.html`
- comparer.html : 6 scripts sans defer (parse bloquant) — `comparer.html`
- confidentialite.html : 7 scripts sans defer (parse bloquant) — `confidentialite.html`
- downloads.html : 12 scripts sans defer (parse bloquant) — `downloads.html`
- import.html : 10 scripts sans defer (parse bloquant) — `import.html`
- lecture.html : 11 scripts sans defer (parse bloquant) — `lecture.html`
- liste.html : 9 scripts sans defer (parse bloquant) — `liste.html`
- localreader.html : 6 scripts sans defer (parse bloquant) — `localreader.html`
- notes.html : 10 scripts sans defer (parse bloquant) — `notes.html`
- notifications.html : 9 scripts sans defer (parse bloquant) — `notifications.html`
- parametres.html : 12 scripts sans defer (parse bloquant) — `parametres.html`
- profil.html : 11 scripts sans defer (parse bloquant) — `profil.html`
- recherche.html : 10 scripts sans defer (parse bloquant) — `recherche.html`
- serie.html : 15 scripts sans defer (parse bloquant) — `serie.html`
- sources.html : 8 scripts sans defer (parse bloquant) — `sources.html`
- stats.html : 9 scripts sans defer (parse bloquant) — `stats.html`
- systeme.html : 7 scripts sans defer (parse bloquant) — `systeme.html`
- u.html : 9 scripts sans defer (parse bloquant) — `u.html`

#### `PERF-PAS-MINIFIE` 1818 Ko de JS applicatif servi tel quel (aucune minification)

sonde **perf-statique** · catégorie performance · effort M

**Correctif** : esbuild --minify dans le build web/desktop ; l'APK le fait déjà (transpilation chrome61) : même chaîne pour le web. Gain attendu ~55 % + gzip.

#### `PLT-ALLOWBACKUP` android:allowBackup="true" : les données de l'app (jeton de session, miroir de bibliothèque) partent dans les sauvegardes Google

sonde **plateformes** · catégorie sécurité · effort S · `android/app/src/main/AndroidManifest.xml`

**Correctif** : allowBackup="false" ou règles dataExtractionRules excluant le stockage de session.

#### `PLT-CSP-UNSAFE-INLINE` CSP du serveur : 'unsafe-inline' présent 5×

sonde **plateformes** · catégorie sécurité · effort L · `server/middleware/security.js`

```
Il annule l'essentiel de la protection contre le XSS.
```

**Correctif** : Sortir les <script> inline des pages (ou nonce/hash par page) ; les 26 pages ont des blocs inline.

#### `CI-PERMISSIONS` Workflow sans bloc permissions (jeton en écriture par défaut)

sonde **ci** · catégorie sécurité · effort S · `.github/workflows/ci.yml`

**Correctif** : permissions: contents: read au niveau racine, élever par job.

#### `EXT-CHAINE-CASSEE` Source gutenberg : étape(s) en échec — texte du chapitre

sonde **extensions** · catégorie extensions · effort M · `extensions-community/gutenberg/index.js`

```
texte du chapitre: Texte du livre indisponible
```

**Correctif** : Réparer le sélecteur/endpoint de l'étape (bac à sable : bouton « Essayer »).

#### `EXT-CHAINE-CASSEE` Source gutenberg-fr : étape(s) en échec — fiche de l’œuvre, texte du chapitre

sonde **extensions** · catégorie extensions · effort M · `extensions-community/gutenberg-fr/index.js`

```
fiche de l’œuvre: fiche de l’œuvre : pas de réponse en 20 s
texte du chapitre: texte du chapitre : pas de réponse en 20 s
```

**Correctif** : Réparer le sélecteur/endpoint de l'étape (bac à sable : bouton « Essayer »).

#### `EXT-CHAINE-CASSEE` Source mangadex : étape(s) en échec — pages du chapitre

sonde **extensions** · catégorie extensions · effort M · `extensions-community/mangadex/index.js`

```
pages du chapitre: MangaDex ne sert plus les pages de ce chapitre (il est reference, mais son serveur d’images ne le connait pas).
```

**Correctif** : Réparer le sélecteur/endpoint de l'étape (bac à sable : bouton « Essayer »).

#### `ANA-COMPLEXITY` — 15 occurrences

(effort unitaire L)

- assets/js/api.js : fonction trop ramifiée (1) — `assets/js/api.js:239`
- assets/js/bibliotheque.js : fonction trop ramifiée (1) — `assets/js/bibliotheque.js:1335`
- assets/js/chapitre.js : fonction trop ramifiée (2) — `assets/js/chapitre.js:52`
- assets/js/downloads.js : fonction trop ramifiée (1) — `assets/js/downloads.js:110`
- assets/js/global.js : fonction trop ramifiée (1) — `assets/js/global.js:1903`
- assets/js/moi-local.js : fonction trop ramifiée (1) — `assets/js/moi-local.js:129`
- assets/js/parametres.js : fonction trop ramifiée (1) — `assets/js/parametres.js:980`
- assets/js/serie.js : fonction trop ramifiée (1) — `assets/js/serie.js:245`
- assets/js/stats.js : fonction trop ramifiée (1) — `assets/js/stats.js:42`
- server/extensions/sushiscan/index.js : fonction trop ramifiée (1) — `server/extensions/sushiscan/index.js:697`
- server/lib/migration-sources.js : fonction trop ramifiée (1) — `server/lib/migration-sources.js:75`
- server/lib/reparation-couvertures.js : fonction trop ramifiée (1) — `server/lib/reparation-couvertures.js:89`
- server/lib/updates.js : fonction trop ramifiée (1) — `server/lib/updates.js:283`
- scripts-ci/verifier-apk.js : fonction trop ramifiée (1) — `scripts-ci/verifier-apk.js:51`
- extensions-community/sushiscan/index.js : fonction trop ramifiée (1) — `extensions-community/sushiscan/index.js:697`

#### `ANA-MAX-LINES` — 6 occurrences

(effort unitaire L)

- assets/js/bibliotheque.js : fichier de plus de 1 200 lignes (1) — `assets/js/bibliotheque.js:1631`
- assets/js/chapitre.js : fichier de plus de 1 200 lignes (1) — `assets/js/chapitre.js:1753`
- assets/js/global.js : fichier de plus de 1 200 lignes (1) — `assets/js/global.js:2021`
- assets/js/serie.js : fichier de plus de 1 200 lignes (1) — `assets/js/serie.js:1526`
- server/controllers/user.controller.js : fichier de plus de 1 200 lignes (1) — `server/controllers/user.controller.js:1651`
- server/test/integration.db.test.js : fichier de plus de 1 200 lignes (1) — `server/test/integration.db.test.js:1565`

#### `ANA-NO-NEW-FUNC` new Function : 1 occurrence(s) dans 1 fichier(s)

sonde **analyse** · catégorie analyse du code · effort S · `assets/js/extensions-navigateur.js:188`

```
assets/js/extensions-navigateur.js:188 — The Function constructor is eval.
```

#### `ANA-NO-UNSAFE-FINALLY` no-unsafe-finally : 1 occurrence(s) dans 1 fichier(s)

sonde **analyse** · catégorie analyse du code · effort S · `assets/js/recherche.js:231`

```
assets/js/recherche.js:231 — Unsafe usage of ReturnStatement.
```

#### `CHAOS-VALEUR-BRUTE` — 9 occurrences

(effort unitaire S)

- accueil.html : valeur manquante affichée telle quelle (réponses illisibles (portail captif)) — `accueil.html`
- catalogue.html : valeur manquante affichée telle quelle (réponses illisibles (portail captif)) — `catalogue.html`
- notes.html : valeur manquante affichée telle quelle (réponses illisibles (portail captif)) — `notes.html`
- notes.html : valeur manquante affichée telle quelle (réponses vides) — `notes.html`
- notifications.html : valeur manquante affichée telle quelle (réponses vides) — `notifications.html`
- parametres.html : valeur manquante affichée telle quelle (réponses vides) — `parametres.html`
- recherche.html : valeur manquante affichée telle quelle (réponses illisibles (portail captif)) — `recherche.html`
- sources.html : valeur manquante affichée telle quelle (réponses illisibles (portail captif)) — `sources.html`
- stats.html : valeur manquante affichée telle quelle (réponses illisibles (portail captif)) — `stats.html`

#### `CHAOS-SILENCE` — 12 occurrences

**Correctif** : MH.poserEtatErreur avec « Réessayer ». (effort unitaire S)

- bibliotheque.html : rien ne dit à l'utilisateur que réponses illisibles (portail captif) — `bibliotheque.html`
- bibliotheque.html : rien ne dit à l'utilisateur que réseau coupé — `bibliotheque.html`
- collection-detail.html : rien ne dit à l'utilisateur que réponses illisibles (portail captif) — `collection-detail.html`
- collections.html : rien ne dit à l'utilisateur que réponses illisibles (portail captif) — `collections.html`
- comparer.html : rien ne dit à l'utilisateur que réseau coupé — `comparer.html`
- comparer.html : rien ne dit à l'utilisateur que réponses illisibles (portail captif) — `comparer.html`
- comparer.html : rien ne dit à l'utilisateur que API en erreur 500 — `comparer.html`
- notifications.html : rien ne dit à l'utilisateur que réponses illisibles (portail captif) — `notifications.html`
- recherche.html : rien ne dit à l'utilisateur que réseau coupé — `recherche.html`
- recherche.html : rien ne dit à l'utilisateur que API en erreur 500 — `recherche.html`
- serie.html : rien ne dit à l'utilisateur que réponses illisibles (portail captif) — `serie.html`
- u.html : rien ne dit à l'utilisateur que réponses illisibles (portail captif) — `u.html`

#### `LARGEUR-CHEVAUCHEMENT` bibliotheque.html à 360 px : des contrôles se chevauchent

sonde **parcours** · catégorie mise en page · effort S · `bibliotheque.html`

```
button.lib2-del ✕ button#mnavMore.mnav-item
```

#### `LARGEUR-CHEVAUCHEMENT` sources.html à 768 px : des contrôles se chevauchent

sonde **parcours** · catégorie mise en page · effort S · `sources.html`

```
button.btn.btn-ghost ✕ button#mnavMore.mnav-item
```

#### `LARGEUR-CHEVAUCHEMENT` collection-detail.html à 1024 px : des contrôles se chevauchent

sonde **parcours** · catégorie mise en page · effort S · `collection-detail.html`

```
a.btn.btn-secondary ✕ button#mnavMore.mnav-item
```

#### `LARGEUR-CHEVAUCHEMENT` notifications.html à 1024 px : des contrôles se chevauchent

sonde **parcours** · catégorie mise en page · effort S · `notifications.html`

```
button.footer-lang-btn ✕ button#mnavMore.mnav-item
button.footer-lang-btn ✕ button#mnavMore.mnav-item
```

#### `ACCENT-CONTRASTE` — 56 occurrences

(effort unitaire S)

- bibliotheque.html : 3 texte(s) peu lisible(s) avec l'accent #22c55e (sombre) — `bibliotheque.html`
- serie.html : 1 texte(s) peu lisible(s) avec l'accent #22c55e (sombre) — `serie.html`
- sources.html : 9 texte(s) peu lisible(s) avec l'accent #22c55e (sombre) — `sources.html`
- stats.html : 14 texte(s) peu lisible(s) avec l'accent #22c55e (sombre) — `stats.html`
- bibliotheque.html : 1 texte(s) peu lisible(s) avec l'accent #22c55e (clair) — `bibliotheque.html`
- serie.html : 1 texte(s) peu lisible(s) avec l'accent #22c55e (clair) — `serie.html`
- sources.html : 12 texte(s) peu lisible(s) avec l'accent #22c55e (clair) — `sources.html`
- stats.html : 21 texte(s) peu lisible(s) avec l'accent #22c55e (clair) — `stats.html`
- bibliotheque.html : 3 texte(s) peu lisible(s) avec l'accent #ec4899 (sombre) — `bibliotheque.html`
- serie.html : 1 texte(s) peu lisible(s) avec l'accent #ec4899 (sombre) — `serie.html`
- sources.html : 9 texte(s) peu lisible(s) avec l'accent #ec4899 (sombre) — `sources.html`
- stats.html : 14 texte(s) peu lisible(s) avec l'accent #ec4899 (sombre) — `stats.html`
- bibliotheque.html : 1 texte(s) peu lisible(s) avec l'accent #ec4899 (clair) — `bibliotheque.html`
- serie.html : 1 texte(s) peu lisible(s) avec l'accent #ec4899 (clair) — `serie.html`
- sources.html : 12 texte(s) peu lisible(s) avec l'accent #ec4899 (clair) — `sources.html`
- stats.html : 21 texte(s) peu lisible(s) avec l'accent #ec4899 (clair) — `stats.html`
- bibliotheque.html : 1 texte(s) peu lisible(s) avec l'accent #ef4444 (sombre) — `bibliotheque.html`
- serie.html : 1 texte(s) peu lisible(s) avec l'accent #ef4444 (sombre) — `serie.html`
- sources.html : 9 texte(s) peu lisible(s) avec l'accent #ef4444 (sombre) — `sources.html`
- stats.html : 14 texte(s) peu lisible(s) avec l'accent #ef4444 (sombre) — `stats.html`
- bibliotheque.html : 1 texte(s) peu lisible(s) avec l'accent #ef4444 (clair) — `bibliotheque.html`
- serie.html : 1 texte(s) peu lisible(s) avec l'accent #ef4444 (clair) — `serie.html`
- sources.html : 12 texte(s) peu lisible(s) avec l'accent #ef4444 (clair) — `sources.html`
- stats.html : 21 texte(s) peu lisible(s) avec l'accent #ef4444 (clair) — `stats.html`
- bibliotheque.html : 3 texte(s) peu lisible(s) avec l'accent #06b6d4 (sombre) — `bibliotheque.html`
- serie.html : 1 texte(s) peu lisible(s) avec l'accent #06b6d4 (sombre) — `serie.html`
- sources.html : 9 texte(s) peu lisible(s) avec l'accent #06b6d4 (sombre) — `sources.html`
- stats.html : 14 texte(s) peu lisible(s) avec l'accent #06b6d4 (sombre) — `stats.html`
- bibliotheque.html : 1 texte(s) peu lisible(s) avec l'accent #06b6d4 (clair) — `bibliotheque.html`
- serie.html : 1 texte(s) peu lisible(s) avec l'accent #06b6d4 (clair) — `serie.html`
- sources.html : 12 texte(s) peu lisible(s) avec l'accent #06b6d4 (clair) — `sources.html`
- stats.html : 21 texte(s) peu lisible(s) avec l'accent #06b6d4 (clair) — `stats.html`
- bibliotheque.html : 3 texte(s) peu lisible(s) avec l'accent #f59e0b (sombre) — `bibliotheque.html`
- serie.html : 1 texte(s) peu lisible(s) avec l'accent #f59e0b (sombre) — `serie.html`
- sources.html : 9 texte(s) peu lisible(s) avec l'accent #f59e0b (sombre) — `sources.html`
- stats.html : 14 texte(s) peu lisible(s) avec l'accent #f59e0b (sombre) — `stats.html`
- bibliotheque.html : 1 texte(s) peu lisible(s) avec l'accent #f59e0b (clair) — `bibliotheque.html`
- serie.html : 1 texte(s) peu lisible(s) avec l'accent #f59e0b (clair) — `serie.html`
- sources.html : 12 texte(s) peu lisible(s) avec l'accent #f59e0b (clair) — `sources.html`
- stats.html : 21 texte(s) peu lisible(s) avec l'accent #f59e0b (clair) — `stats.html`
- … et 16 autres

#### `ANGLAIS-RESTE-FRANCAIS` — 14 occurrences

**Correctif** : Ajouter les entrées à assets/i18n/en.json ; traduire aussi title, aria-label et placeholder. (effort unitaire S)

- anilist.html en anglais : 1 texte(s) encore en français — `anilist.html`
- bibliotheque.html en anglais : 6 texte(s) encore en français — `bibliotheque.html`
- collection-detail.html en anglais : 6 texte(s) encore en français — `collection-detail.html`
- collections.html en anglais : 3 texte(s) encore en français — `collections.html`
- comparer.html en anglais : 2 texte(s) encore en français — `comparer.html`
- downloads.html en anglais : 4 texte(s) encore en français — `downloads.html`
- import.html en anglais : 5 texte(s) encore en français — `import.html`
- liste.html en anglais : 4 texte(s) encore en français — `liste.html`
- localreader.html en anglais : 1 texte(s) encore en français — `localreader.html`
- notes.html en anglais : 5 texte(s) encore en français — `notes.html`
- notifications.html en anglais : 7 texte(s) encore en français — `notifications.html`
- profil.html en anglais : 9 texte(s) encore en français — `profil.html`
- serie.html en anglais : 4 texte(s) encore en français — `serie.html`
- u.html en anglais : 7 texte(s) encore en français — `u.html`

#### `XSS-URL-NOTE` La couverture d'une note accepte une adresse javascript:

sonde **xss** · catégorie sécurité · effort S · `server/controllers/notes.controller.js`

**Correctif** : couverture.brute() comme pour les favoris.

#### `BTN-MORT` — 26 occurrences

**Correctif** : Vérifier le gestionnaire : écouteur absent ou jeté par une erreur au chargement ; ou contrôle décoratif à retirer/griser. (effort unitaire S)

- accueil.html : « Inko » ne produit aucun effet visible au clic — `accueil.html`
- accueil.html : « Accueil » ne produit aucun effet visible au clic — `accueil.html`
- accueil.html : « Catalogue » ne produit aucun effet visible au clic — `accueil.html`
- accueil.html : « Bibliothèque » ne produit aucun effet visible au clic — `accueil.html`
- accueil.html : « Aléatoire » ne produit aucun effet visible au clic — `accueil.html`
- accueil.html : « Sources » ne produit aucun effet visible au clic — `accueil.html`
- bibliotheque.html : « Catalogue » ne produit aucun effet visible au clic — `bibliotheque.html`
- catalogue.html : « Inko » ne produit aucun effet visible au clic — `catalogue.html`
- catalogue.html : « Accueil » ne produit aucun effet visible au clic — `catalogue.html`
- catalogue.html : « Catalogue » ne produit aucun effet visible au clic — `catalogue.html`
- catalogue.html : « Bibliothèque » ne produit aucun effet visible au clic — `catalogue.html`
- confidentialite.html : « Settings » ne produit aucun effet visible au clic — `confidentialite.html`
- index.html : « Inko » ne produit aucun effet visible au clic — `index.html`
- index.html : « Lecteur » ne produit aucun effet visible au clic — `index.html`
- index.html : « 0 chapters read » ne produit aucun effet visible au clic — `index.html`
- index.html : « 0 Chapters this month » ne produit aucun effet visible au clic — `index.html`
- notes.html : « Journal » ne produit aucun effet visible au clic — `notes.html`
- notes.html : « Random » ne produit aucun effet visible au clic — `notes.html`
- notifications.html : « Inko » ne produit aucun effet visible au clic — `notifications.html`
- notifications.html : « Home » ne produit aucun effet visible au clic — `notifications.html`
- recherche.html : « Inko » ne produit aucun effet visible au clic — `recherche.html`
- recherche.html : « Home » ne produit aucun effet visible au clic — `recherche.html`
- serie.html : « Home » ne produit aucun effet visible au clic — `serie.html`
- serie.html : « Resume my last read » ne produit aucun effet visible au clic — `serie.html`
- systeme.html : « Stations » ne produit aucun effet visible au clic — `systeme.html`
- u.html : « Sources » ne produit aucun effet visible au clic — `u.html`

#### `BTN-SANS-NOM` collection-detail.html (bureau) : a 155×232 sans nom accessible

sonde **boutons** · catégorie accessibilité · effort S · `collection-detail.html`

**Correctif** : aria-label ou texte visible.

#### `TEST-SOURCE-GREP` 114 fichiers de test vérifient le TEXTE du source plutôt que son comportement

sonde **tests** · catégorie tests · effort XL

```
test/unit/a11y-reperes.test.js
test/unit/accueil-composition.test.js
test/unit/annonce-bibliotheque.test.js
test/unit/annuler.test.js
test/unit/apparence-emportable.test.js
test/unit/bac-a-sable-extension.test.js
test/unit/bascule-mode-position.test.js
test/unit/bibliotheque-composition.test.js
test/unit/bibliotheque-miroir-local.test.js
test/unit/bibliotheque-url.test.js
test/unit/boutons.test.js
test/unit/budget-stockage.test.js
test/unit/carte-serie.test.js
test/unit/catalogue-composition.test.js
test/unit/catalogue-groupe-par-source.test.js
test/unit/champs.test.js
test/unit/chiffre-zero.test.js
test/unit/comparer-traductions.test.js
test/unit/contenu-utile.test.js
test/unit/corrections-recherche.test.js
test/unit/couvertures-absentes.test.js
test/unit/css-webview-android8.test.js
test/unit/defauts-releves-au-navigateur.test.js
test/unit/demarrage-mesure.test.js
test/unit/densite-aff
```

**Correctif** : Un test qui cherche une regex dans le code passe tant que la regex y est, même si la fonction est cassée (et casse au moindre renommage). Convertir en tests de comportement avec jsdom (déjà en devDependency) pour les modules critiques : api, storage, serie, chapitre.

#### `TEST-SERVEUR-NON-TESTE` server/controllers/migration.controller.js (210 lignes) n'est nommé par aucun test

sonde **tests** · catégorie tests · effort M · `server/controllers/migration.controller.js`

#### `TEST-SERVEUR-NON-TESTE` server/lib/push-fcm.js (149 lignes) n'est nommé par aucun test

sonde **tests** · catégorie tests · effort M · `server/lib/push-fcm.js`

#### `TEST-ROUTES-NON-APPELEES` 89/156 routes ne sont citées dans aucun test

sonde **tests** · catégorie tests · effort L

```
/app/update
/openapi.json
/auth/providers
/auth/google-config
/auth/google-config
/auth/logout
/auth/sessions
/auth/sessions/others
/auth/sessions/:id
/auth/profile
/auth/delete
/extensions/updates
/extensions/health
/extensions/:id/log
/extensions/:id/test
/extensions/:id/bac-a-sable
/extensions/update
/extensions/:id/uninstall
/extensions/:id/reinstall
/extensions/uninstalled
/artwork
/anilist/similar
/mangas/latest
/mangas/tags
/mangas/:id/chapters
/chapters/:id/pages
/chapters/:id/text
/sources/:sourceId/mangas/search
/sources/:sourceId/mangas/popular
/sources/:sourceId/mangas/latest
/sources/:sourceId/mangas/tags
/sources/:sourceId/mangas/:id
/sources/:sourceId/mangas/:id/chapters
/sources/:sourceId/chapters/:id/pages
/sources/:sourceId/chapters/:id/text
/me/favorites/bulk-remove
/me/favorites/corbeille
/me/favorites/corbeille/restaurer
/me/favorites/reparer-couvertures
/me/favorite
```

**Correctif** : Test de contrat supertest-like (http natif) généré depuis openapi.json : statut attendu sans auth (401), avec auth (200).

#### `PAGE-ERREUR-CONSOLE` — 12 occurrences

(effort unitaire S)

- accueil.html (bureau) : 1 erreur(s) console — `accueil.html`
- bibliotheque.html (bureau) : 27 erreur(s) console — `bibliotheque.html`
- catalogue.html (bureau) : 24 erreur(s) console — `catalogue.html`
- index.html (bureau) : 18 erreur(s) console — `index.html`
- profil.html (bureau) : 19 erreur(s) console — `profil.html`
- recherche.html (bureau) : 21 erreur(s) console — `recherche.html`
- accueil.html (mobile) : 1 erreur(s) console — `accueil.html`
- bibliotheque.html (mobile) : 27 erreur(s) console — `bibliotheque.html`
- catalogue.html (mobile) : 21 erreur(s) console — `catalogue.html`
- index.html (mobile) : 9 erreur(s) console — `index.html`
- profil.html (mobile) : 17 erreur(s) console — `profil.html`
- recherche.html (mobile) : 21 erreur(s) console — `recherche.html`

#### `PAGE-RESEAU-KO` — 8 occurrences

(effort unitaire S)

- accueil.html (bureau) : 1 requête(s) en échec — `accueil.html`
- bibliotheque.html (bureau) : 23 requête(s) en échec — `bibliotheque.html`
- index.html (bureau) : 2 requête(s) en échec — `index.html`
- profil.html (bureau) : 18 requête(s) en échec — `profil.html`
- accueil.html (mobile) : 1 requête(s) en échec — `accueil.html`
- bibliotheque.html (mobile) : 19 requête(s) en échec — `bibliotheque.html`
- index.html (mobile) : 2 requête(s) en échec — `index.html`
- profil.html (mobile) : 16 requête(s) en échec — `profil.html`

#### `PAGE-CLS` bibliotheque.html (bureau) : décalage de mise en page CLS = 0.17

sonde **pages** · catégorie performance · effort M · `bibliotheque.html`

**Correctif** : Réserver la place (aspect-ratio / min-height) des cartes et images avant leur arrivée.

#### `PAGE-CLS` serie.html (bureau) : décalage de mise en page CLS = 0.10

sonde **pages** · catégorie performance · effort M · `serie.html`

**Correctif** : Réserver la place (aspect-ratio / min-height) des cartes et images avant leur arrivée.

#### `PAGE-CLS` index.html (mobile) : décalage de mise en page CLS = 0.17

sonde **pages** · catégorie performance · effort M · `index.html`

**Correctif** : Réserver la place (aspect-ratio / min-height) des cartes et images avant leur arrivée.

#### `VOL-BLOCAGE` bibliotheque.html avec 10000 favoris : l'écran se fige 471 ms d'un coup

sonde **charge** · catégorie performance · effort M · `bibliotheque.html`

```
Total des tâches longues : 21817 ms.
```

**Correctif** : Découper le rendu (par lots, requestIdleCallback).

#### `VOL-BLOCAGE` profil.html avec 10000 favoris : l'écran se fige 542 ms d'un coup

sonde **charge** · catégorie performance · effort M · `profil.html`

```
Total des tâches longues : 831 ms.
```

**Correctif** : Découper le rendu (par lots, requestIdleCallback).

#### `VOL-SAISIE` bibliotheque.html avec 10000 favoris : filtrer bloque 2853 ms

sonde **charge** · catégorie performance · effort M · `bibliotheque.html`

**Correctif** : Différer le filtrage (150 ms) et ne pas reconstruire la grille.

#### `NET-POIDS` catalogue.html : 2418 Ko à analyser au chargement

sonde **charge** · catégorie performance · effort M · `catalogue.html`

```
{"requetes":68,"api":40,"koTransferes":1825,"koDecodes":2418,"jsKo":696,"jsUtilise":43,"cssKo":155,"cssUtilise":26}
```

**Correctif** : Charger à la demande les modules secondaires.

#### `NET-POIDS` systeme.html : 3045 Ko à analyser au chargement

sonde **charge** · catégorie performance · effort M · `systeme.html`

```
{"requetes":104,"api":2,"koTransferes":1084,"koDecodes":3045,"jsKo":529,"jsUtilise":36,"cssKo":138,"cssUtilise":17}
```

**Correctif** : Charger à la demande les modules secondaires.

#### `INT-RESET-DOUBLE` Un même lien de réinitialisation a servi 6 fois (envois simultanés)

sonde **integrite** · catégorie données · effort M · `server/controllers/auth.controller.js`

```
SELECT puis UPDATE sans verrou dans resetPassword.
```

**Correctif** : UPDATE password_resets SET used = 1 WHERE … AND used = 0, puis vérifier affectedRows avant de changer le mot de passe.

#### `INT-MIGRATION-REJEU` Rejouer les migrations sur une base à jour échoue

sonde **integrite** · catégorie données · effort M · `server/db/migrate.js`

```
◇ injected env (0) from .env
[migrate] ✖ ER_CHECK_CONSTRAINT_DUP_NAME — Duplicate check constraint name 'chk_rating_range'.
          SQL : ALTER TABLE ratings ADD CONSTRAINT chk_rating_range CHECK (rating BETWEEN 1 AND 5)
[migrate] ✖ migration 5 (intégrité des notes + colonne morte library.rating (audit DB-03/DB-04)) a échoué — versions suivantes non appliquées.
migration échouée : ER_CHECK_CONSTRAINT_DUP_NAME — Duplicate check constraint name 'chk_rating_range'.

```

**Correctif** : Chaque migration doit être rejouable.

#### `INT-ECART-SCHEMA` Ta base diffère d'une installation neuve : 8 colonne(s) et 4 index attendus absents ou différents, 9 colonne(s) et 1 index en plus

sonde **integrite** · catégorie données · effort M · `server/db/migrate.js`

```
Attendu, absent de la base réelle :
events.origine varchar(96) NULL
favorites_corbeille.id bigint NOT NULL
favorites_corbeille.user_id int NOT NULL
favorites_corbeille.manga_id varchar(191) NOT NULL
favorites_corbeille.donnees longtext NOT NULL
favorites_corbeille.lot char(36) NOT NULL
favorites_corbeille.origine varchar(96) NULL
favorites_corbeille.supprime_le timestamp NOT NULL
favorites (user_id,status)
favorites_corbeille (user_id,lot)
favorites_corbeille (user_id,supprime_le)
favorites_corbeille (id) unique

Présent seulement dans la base réelle :
spotify_accounts.user_id int NOT NULL
spotify_accounts.spotify_id varchar(128) NULL
spotify_accounts.display_name varchar(255) NULL
spotify_accounts.avatar varchar(512) NULL
spotify_accounts.product varchar(32) NULL
spotify_accounts.access_token text NULL
spotify_accounts.refresh_token text NULL
spotify_accounts.expires_at bigint NULL
spot
```

**Correctif** : Migration de réalignement.

#### `SD-SAISIE-5XX` — 19 occurrences

**Correctif** : Valider le type et la taille, répondre 400. (effort unitaire S)

- PUT /auth/profile : une saisie inattendue provoque une erreur serveur — `server/routes/index.js`
- PUT /me/favorites/:mangaId/category : une saisie inattendue provoque une erreur serveur — `server/routes/index.js`
- PUT /me/progress/:mangaId : une saisie inattendue provoque une erreur serveur — `server/routes/index.js`
- POST /me/read-chapters : une saisie inattendue provoque une erreur serveur — `server/routes/index.js`
- POST /me/lists : une saisie inattendue provoque une erreur serveur — `server/routes/index.js`
- PUT /me/lists/:id : une saisie inattendue provoque une erreur serveur — `server/routes/index.js`
- DELETE /me/lists/:id : une saisie inattendue provoque une erreur serveur — `server/routes/index.js`
- DELETE /library/local/:id : une saisie inattendue provoque une erreur serveur — `server/routes/index.js`
- POST /me/notifications/:id/read : une saisie inattendue provoque une erreur serveur — `server/routes/index.js`
- POST /me/push/subscribe : une saisie inattendue provoque une erreur serveur — `server/routes/index.js`
- PUT /ratings/:mangaId : une saisie inattendue provoque une erreur serveur — `server/routes/index.js`
- POST /me/notes : une saisie inattendue provoque une erreur serveur — `server/routes/index.js`
- PUT /me/notes/:id : une saisie inattendue provoque une erreur serveur — `server/routes/index.js`
- DELETE /me/notes/:id : une saisie inattendue provoque une erreur serveur — `server/routes/index.js`
- PUT /me/settings : une saisie inattendue provoque une erreur serveur — `server/routes/index.js`
- GET /me/events : une saisie inattendue provoque une erreur serveur — `server/routes/index.js`
- GET /me/notifications : une saisie inattendue provoque une erreur serveur — `server/routes/index.js`
- GET /me/notes : une saisie inattendue provoque une erreur serveur — `server/routes/index.js`
- GET /comments-recent : une saisie inattendue provoque une erreur serveur — `server/routes/index.js`

#### `SD-CORPS-ANONYME` Une route publique accepte un corps de plus de 10 Mo

sonde **securite-dyn** · catégorie sécurité · effort S · `server/app.js`

```
POST /api/auth/login, 11 Mo, sans session → 429 : le corps est lu et décodé en entier avant tout limiteur et toute authentification (express.json global à 12 Mo, posé pour l'import).
```

**Correctif** : Limite de 100 ko par défaut, 12 Mo seulement sur /me/import.

#### `SD-JOURNAL-ERREURS` 3 erreur(s) JavaScript non prévues dans le journal du serveur

sonde **securite-dyn** · catégorie robustesse · effort S

```
[err] TypeError: username.trim is not a function
[err] TypeError: name.trim is not a function
[err] TypeError: name.trim is not a function
```

**Correctif** : Traiter chaque cas.

#### `LECTEUR-TOUCHE-INERTE` Mode « page » : la touche Space ne fait rien

sonde **lecteur** · catégorie lecteur · effort S · `assets/js/chapitre.js`

```
page 1/28, défilement 0
```

#### `LECTEUR-TOUCHE-INERTE` Mode « page » : la touche PageDown ne fait rien

sonde **lecteur** · catégorie lecteur · effort S · `assets/js/chapitre.js`

```
page 2/28, défilement 0
```

#### `LECTEUR-TOUCHE-INERTE` Mode « double » : la touche ArrowDown ne fait rien

sonde **lecteur** · catégorie lecteur · effort S · `assets/js/chapitre.js`

```
page 4/28, défilement 0
```

#### `LECTEUR-REGLAGES-ECHAP` Après avoir touché une case ou un curseur, Échap ne ferme plus les réglages du lecteur

sonde **lecteur** · catégorie lecteur · effort S · `assets/js/global.js`

```
MH.toucheIgnoree() (global.js) ignore toute touche quand le focus est sur un champ, Échap compris.
```

**Correctif** : Laisser passer Échap dans toucheIgnoree.

#### `LECTEUR-CIBLES` Téléphone : 14 bouton(s) du lecteur sous 40 px

sonde **lecteur** · catégorie mobile · effort S · `assets/js/chapitre.js`

```
← One-Punch Man 111×25
Chapitre précédent 32×32
Chapitre suivant 32×32
 32×32
 32×32
btnDownload 32×32
 32×32
 32×32
Plus d'actions 32×32
Page/page 91×24
↕ Défilement 103×24
Double 68×24
⤒ 38×44
⤓ 38×44
```

#### `MOB-CIBLE-40` — 20 occurrences

**Correctif** : Viser 44 × 44. (effort unitaire S)

- accueil.html : 31 cible(s) entre 24 et 40 px — `accueil.html`
- bibliotheque.html : 90 cible(s) entre 24 et 40 px — `bibliotheque.html`
- catalogue.html : 15 cible(s) entre 24 et 40 px — `catalogue.html`
- chapitre.html : 18 cible(s) entre 24 et 40 px — `chapitre.html`
- collection-detail.html : 10 cible(s) entre 24 et 40 px — `collection-detail.html`
- collections.html : 8 cible(s) entre 24 et 40 px — `collections.html`
- comparer.html : 5 cible(s) entre 24 et 40 px — `comparer.html`
- downloads.html : 8 cible(s) entre 24 et 40 px — `downloads.html`
- import.html : 6 cible(s) entre 24 et 40 px — `import.html`
- lecture.html : 16 cible(s) entre 24 et 40 px — `lecture.html`
- liste.html : 5 cible(s) entre 24 et 40 px — `liste.html`
- notes.html : 14 cible(s) entre 24 et 40 px — `notes.html`
- notifications.html : 11 cible(s) entre 24 et 40 px — `notifications.html`
- parametres.html : 42 cible(s) entre 24 et 40 px — `parametres.html`
- profil.html : 18 cible(s) entre 24 et 40 px — `profil.html`
- recherche.html : 13 cible(s) entre 24 et 40 px — `recherche.html`
- serie.html : 17 cible(s) entre 24 et 40 px — `serie.html`
- sources.html : 15 cible(s) entre 24 et 40 px — `sources.html`
- stats.html : 10 cible(s) entre 24 et 40 px — `stats.html`
- u.html : 5 cible(s) entre 24 et 40 px — `u.html`

#### `MOB-PAYSAGE-BARRES` — 19 occurrences

**Correctif** : Réduire ou escamoter les barres quand la hauteur manque. (effort unitaire S)

- accueil.html en paysage : les barres fixes prennent 194 px sur 390 — `accueil.html`
- bibliotheque.html en paysage : les barres fixes prennent 194 px sur 390 — `bibliotheque.html`
- catalogue.html en paysage : les barres fixes prennent 194 px sur 390 — `catalogue.html`
- collection-detail.html en paysage : les barres fixes prennent 194 px sur 390 — `collection-detail.html`
- collections.html en paysage : les barres fixes prennent 194 px sur 390 — `collections.html`
- comparer.html en paysage : les barres fixes prennent 194 px sur 390 — `comparer.html`
- downloads.html en paysage : les barres fixes prennent 194 px sur 390 — `downloads.html`
- import.html en paysage : les barres fixes prennent 194 px sur 390 — `import.html`
- lecture.html en paysage : les barres fixes prennent 191 px sur 390 — `lecture.html`
- liste.html en paysage : les barres fixes prennent 194 px sur 390 — `liste.html`
- notes.html en paysage : les barres fixes prennent 194 px sur 390 — `notes.html`
- notifications.html en paysage : les barres fixes prennent 194 px sur 390 — `notifications.html`
- parametres.html en paysage : les barres fixes prennent 194 px sur 390 — `parametres.html`
- profil.html en paysage : les barres fixes prennent 194 px sur 390 — `profil.html`
- recherche.html en paysage : les barres fixes prennent 194 px sur 390 — `recherche.html`
- serie.html en paysage : les barres fixes prennent 241 px sur 390 — `serie.html`
- sources.html en paysage : les barres fixes prennent 194 px sur 390 — `sources.html`
- stats.html en paysage : les barres fixes prennent 194 px sur 390 — `stats.html`
- u.html en paysage : les barres fixes prennent 194 px sur 390 — `u.html`

#### `MOB-ZOOM-SAISIE` — 11 occurrences

**Correctif** : font-size: 16px sur les champs sous 600 px. (effort unitaire S)

- bibliotheque.html : 2 champ(s) sous 16 px, qui font zoomer l'écran sur iOS — `bibliotheque.html`
- catalogue.html : 2 champ(s) sous 16 px, qui font zoomer l'écran sur iOS — `catalogue.html`
- chapitre.html : 1 champ(s) sous 16 px, qui font zoomer l'écran sur iOS — `chapitre.html`
- comparer.html : 1 champ(s) sous 16 px, qui font zoomer l'écran sur iOS — `comparer.html`
- downloads.html : 1 champ(s) sous 16 px, qui font zoomer l'écran sur iOS — `downloads.html`
- lecture.html : 1 champ(s) sous 16 px, qui font zoomer l'écran sur iOS — `lecture.html`
- notes.html : 1 champ(s) sous 16 px, qui font zoomer l'écran sur iOS — `notes.html`
- notifications.html : 1 champ(s) sous 16 px, qui font zoomer l'écran sur iOS — `notifications.html`
- parametres.html : 4 champ(s) sous 16 px, qui font zoomer l'écran sur iOS — `parametres.html`
- recherche.html : 1 champ(s) sous 16 px, qui font zoomer l'écran sur iOS — `recherche.html`
- stats.html : 2 champ(s) sous 16 px, qui font zoomer l'écran sur iOS — `stats.html`

#### `CLAVIER-FOCUS-CACHE` — 12 occurrences

**Correctif** : inert, visibility:hidden ou tabindex=-1 sur les panneaux fermés. (effort unitaire S)

- accueil.html : le focus passe sur 20 élément(s) invisible(s) — `accueil.html`
- collection-detail.html : le focus passe sur 1 élément(s) invisible(s) — `collection-detail.html`
- collections.html : le focus passe sur 1 élément(s) invisible(s) — `collections.html`
- comparer.html : le focus passe sur 1 élément(s) invisible(s) — `comparer.html`
- downloads.html : le focus passe sur 1 élément(s) invisible(s) — `downloads.html`
- import.html : le focus passe sur 1 élément(s) invisible(s) — `import.html`
- liste.html : le focus passe sur 1 élément(s) invisible(s) — `liste.html`
- notes.html : le focus passe sur 1 élément(s) invisible(s) — `notes.html`
- notifications.html : le focus passe sur 1 élément(s) invisible(s) — `notifications.html`
- parametres.html : le focus passe sur 1 élément(s) invisible(s) — `parametres.html`
- stats.html : le focus passe sur 1 élément(s) invisible(s) — `stats.html`
- u.html : le focus passe sur 1 élément(s) invisible(s) — `u.html`

#### `CLAVIER-INATTEIGNABLE` chapitre.html : 8 élément(s) cliquable(s) impossibles à atteindre au clavier

sonde **interaction** · catégorie accessibilité · effort S · `chapitre.html`

```
div.page-zone-prev
div.page-zone-next
div.reader-thumb
```

#### `FENETRE-AXE` chapitre.html : « Plus d'actions » — 1 défaut(s) d'accessibilité

sonde **interaction** · catégorie accessibilité · effort S · `chapitre.html`

```
aria-required-children × 1 (#readerMoreMenu)
```

#### `FENETRE-AXE` parametres.html : « Gérer » — 1 défaut(s) d'accessibilité

sonde **interaction** · catégorie accessibilité · effort S · `parametres.html`

```
image-alt × 1 (img[width="221"])
```

#### `FENETRE-AXE` parametres.html : « Afficher » — 1 défaut(s) d'accessibilité

sonde **interaction** · catégorie accessibilité · effort S · `parametres.html`

```
color-contrast × 1 (.itr-btn)
```

#### `FENETRE-AXE` parametres.html : « Chiffrer et exporter » — 1 défaut(s) d'accessibilité

sonde **interaction** · catégorie accessibilité · effort S · `parametres.html`

```
color-contrast × 1 (.primary)
```

#### `FENETRE-AXE` serie.html : « Plus d'actions » — 1 défaut(s) d'accessibilité

sonde **interaction** · catégorie accessibilité · effort S · `serie.html`

```
aria-allowed-attr × 1 (#btnPrive)
```

#### `FENETRE-ECHAP` parametres.html : Échap ne ferme pas « Afficher »

sonde **interaction** · catégorie accessibilité · effort S · `parametres.html`

#### `REF-ARIA` bibliotheque.html : 1 référence(s) d'accessibilité vers un élément absent

sonde **references** · catégorie accessibilité · effort S · `bibliotheque.html`

```
aria-labelledby="updChronoTitre" sur section
```

**Correctif** : Corriger l'identifiant ou retirer l'attribut (aria-controls peut désigner un panneau créé à l'ouverture).

#### `REF-FONCTION-SANS-ECRAN` 21 fonction(s) de l’API cliente qu’aucun écran n’appelle

sonde **references** · catégorie références · effort S · `assets/js/api.js`

```
API.admin.reports
API.admin.resolveReport
API.admin.setBan
API.admin.setRole
API.admin.users
API.anilist.config
API.auth.changePassword
API.auth.google
API.auth.googleConfig
API.auth.login
API.auth.passwordStrength
API.auth.providers
API.auth.requestReset
API.auth.resetPassword
API.auth.setGoogleConfig
API.comments.recent
API.devices.retirerJetonPush
API.me.corbeille
API.me.library
API.me.progressHistory
API.migrate.annulables
```

**Correctif** : Brancher chaque fonction à un écran, ou la retirer.

#### `REF-SANS-OUBLI` Aucun écran « mot de passe oublié »

sonde **references** · catégorie fonction absente · effort S · `assets/js/api.js`

```
API.auth.requestReset n’est appelée nulle part — la route, elle, est ouverte au réseau.
```

**Correctif** : Écran de connexion, d’inscription et de récupération.

#### `REF-ID-ABSENT` — 12 occurrences

**Correctif** : Code mort ou fonction débranchée : créer l'élément ou retirer le code. (effort unitaire S)

- #shelfReco est cherché mais aucun élément ne porte cet identifiant — `assets/js/accueil.js:451`
- #shelfRecoSub est cherché mais aucun élément ne porte cet identifiant — `assets/js/accueil.js:453`
- #catalogueGrid est cherché mais aucun élément ne porte cet identifiant — `assets/js/catalogue.js:1009`
- #teamPicksGrid est cherché mais aucun élément ne porte cet identifiant — `assets/js/catalogue.js:1057`
- #catalogueFocus est cherché mais aucun élément ne porte cet identifiant — `assets/js/catalogue.js:1077`
- #weekCalendar est cherché mais aucun élément ne porte cet identifiant — `assets/js/catalogue.js:1101`
- #btnClearFilters est cherché mais aucun élément ne porte cet identifiant — `assets/js/catalogue.js:1354`
- #hero est cherché mais aucun élément ne porte cet identifiant — `assets/js/hero3d.js:27`
- #heroContent est cherché mais aucun élément ne porte cet identifiant — `assets/js/hero3d.js:82`
- #commentsList est cherché mais aucun élément ne porte cet identifiant — `assets/js/serie.js:1164`
- #commentForm est cherché mais aucun élément ne porte cet identifiant — `assets/js/serie.js:1165`
- #commentCount est cherché mais aucun élément ne porte cet identifiant — `assets/js/serie.js:1166`

#### `REF-FICHIER-ABSENT` Fichier cité mais absent : connexion.html

sonde **references** · catégorie références · effort S · `assets/js/collections.js`

```
assets/js/collections.js:27
```

**Correctif** : Ajouter le fichier ou corriger le chemin.

#### `REF-FICHIER-ABSENT` Fichier cité mais absent : login.html

sonde **references** · catégorie références · effort S · `assets/js/global.js`

```
assets/js/global.js:1492
```

**Correctif** : Ajouter le fichier ou corriger le chemin.

#### `IMP-EPUB-PISTAGE` Ouvrir un livre contacte des serveurs extérieurs (6 adresse(s))

sonde **imports** · catégorie fichiers importés · effort S · `assets/js/localreader.js`

```
https://pistage.exemple.test/style.png
https://pistage.exemple.test/affiche.png
https://pistage.exemple.test/i.png
https://pistage.exemple.test/v.mp4
https://pistage.exemple.test/a.mp3
https://pistage.exemple.test/ping

L'auteur du fichier apprend quand et d'où il est lu.
```

**Correctif** : Ne garder que les ressources contenues dans le livre ; retirer style, media et attributs ping.

#### `MODE-CSP-INLINE` application de bureau : la politique autorise le script en ligne

sonde **modes** · catégorie configurations livrées · effort L · `server/middleware/security.js`

```
script-src 'self' 'unsafe-inline' https://accounts.google.com https://apis.google.com https://www.youtube.com https://s.ytimg.com ; script-src-attr 'unsafe-inline'
```

**Correctif** : Retirer les gestionnaires en attribut puis unsafe-inline : c'est ce qui rend les injections SEC-15 et EPUB exécutables.

#### `MODE-CSP-INLINE` hub en production (Docker) : la politique autorise le script en ligne

sonde **modes** · catégorie configurations livrées · effort L · `server/middleware/security.js`

```
script-src 'self' 'unsafe-inline' https://accounts.google.com https://apis.google.com https://www.youtube.com https://s.ytimg.com ; script-src-attr 'unsafe-inline'
```

**Correctif** : Retirer les gestionnaires en attribut puis unsafe-inline : c'est ce qui rend les injections SEC-15 et EPUB exécutables.

#### `HL-SILENCE` — 8 occurrences

**Correctif** : Bandeau « hors ligne » commun à toutes les pages. (effort unitaire S)

- anilist.html : rien ne dit qu'on est hors ligne — `anilist.html`
- comparer.html : rien ne dit qu'on est hors ligne — `comparer.html`
- import.html : rien ne dit qu'on est hors ligne — `import.html`
- localreader.html : rien ne dit qu'on est hors ligne — `localreader.html`
- notifications.html : rien ne dit qu'on est hors ligne — `notifications.html`
- parametres.html : rien ne dit qu'on est hors ligne — `parametres.html`
- profil.html : rien ne dit qu'on est hors ligne — `profil.html`
- systeme.html : rien ne dit qu'on est hors ligne — `systeme.html`

#### `HL-MAJ-SILENCIEUSE` Aucune invitation à recharger quand une nouvelle version de l'application est installée

sonde **hors-ligne** · catégorie hors-ligne · effort S · `assets/js/pwa.js`

```
Ni updatefound ni controllerchange dans pwa.js et global.js ; le service worker prend la main immédiatement (skipWaiting).
```

**Correctif** : « Nouvelle version prête — Recharger ».

#### `MAN-SCHEMA` Mise à jour depuis v2.3.4 : 0 colonne(s) et 1 index d'une installation neuve absents ou différents

sonde **mise-a-niveau** · catégorie mise à niveau · effort S · `server/db/migrate.js`

```
favorites (user_id,status)
```

**Correctif** : Migration de réalignement.

#### `APP-DROIT` Un téléphone appairé peut lister les sauvegardes

sonde **appareils** · catégorie multi-appareils · effort S · `server/routes/index.js`

```
GET /api/me/backups → 200. L'appairage donne le rôle « lecteur », sans administration.
```

**Correctif** : Refuser aux jetons d'appareil.

#### `APP-ECRAN-PERIME` Un changement fait sur un autre appareil n'apparaît pas tant qu'on ne recharge pas

sonde **appareils** · catégorie multi-appareils · effort M · `assets/js/bibliotheque.js`

```
Bibliothèque ouverte, série ajoutée depuis le téléphone, retour sur l'écran : 6 carte(s) avant, 6 après 5 s.
```

**Correctif** : Revalider au retour de visibilité (visibilitychange) ou pousser les changements par le flux existant.

#### `ADM-REGLE` Règle non tenue : l’auteur voit son commentaire privé

sonde **administration** · catégorie instance partagée · effort S · `server/controllers/user.controller.js`

**Correctif** : Corriger et ajouter le cas aux tests.

#### `ADM-REGLE` Règle non tenue : le marqueur de spoiler est rendu

sonde **administration** · catégorie instance partagée · effort S · `server/controllers/user.controller.js`

```
{"items":[{"id":1,"text":"racine publique","chapterId":null,"parentId":null,"visibility":"public","spoiler":false,"user":"Second","avatar":"S","createdAt":"2026-11-25T23:04:10.000Z","reports":0}],"total":1,"hasMore":false}
```

**Correctif** : Corriger et ajouter le cas aux tests.

#### `ADM-REGLE` Règle non tenue : le dernier administrateur ne peut pas disparaître

sonde **administration** · catégorie instance partagée · effort S · `server/controllers/auth.controller.js`

```
Le dernier administrateur a supprimé son compte : l'instance n'en a plus aucun.
```

**Correctif** : Corriger et ajouter le cas aux tests.

#### `LIC-NOTICE` 2 bibliothèque(s) ou police(s) copiée(s) sans mention dans NOTICE ou README

sonde **licences** · catégorie droit · effort S · `NOTICE.md`

```
qrcode, three

assets/vendor/gsap.min.js
assets/vendor/jszip.min.js
assets/vendor/pdf.min.js
assets/vendor/pdf.worker.min.js
assets/vendor/qrcode.min.js
assets/vendor/ScrollTrigger.min.js
assets/vendor/three.min.js
```

**Correctif** : Citer chaque composant, sa licence et son auteur ; joindre les textes (OFL pour les polices).

#### `RES-STOCKAGE-INTERDIT` Quand le stockage du navigateur est interdit, 4 page(s) cassent

sonde **resilience** · catégorie robustesse · effort M · `assets/js/storage.js`

```
anilist.html : sans en-tête
confidentialite.html : sans en-tête
localreader.html : sans en-tête
systeme.html : sans en-tête
```

**Correctif** : Un seul accès au stockage, protégé (storage.js), pour toute l'application.

#### `RES-STOCKAGE-PLEIN` Quand le stockage du navigateur est plein, 4 page(s) cassent

sonde **resilience** · catégorie robustesse · effort M · `assets/js/storage.js`

```
anilist.html : sans en-tête
confidentialite.html : sans en-tête
localreader.html : sans en-tête
systeme.html : sans en-tête
```

**Correctif** : Un seul accès au stockage, protégé (storage.js), pour toute l'application.

#### `RES-STOCKAGE-CORROMPU` Quand les données locales sont corrompues, 4 page(s) cassent

sonde **resilience** · catégorie robustesse · effort M · `assets/js/storage.js`

```
anilist.html : sans en-tête
confidentialite.html : sans en-tête
localreader.html : sans en-tête
systeme.html : sans en-tête
```

**Correctif** : Un seul accès au stockage, protégé (storage.js), pour toute l'application.

#### `RES-PORT-OCCUPE` Port déjà pris : le serveur reste lancé sans écouter

sonde **resilience** · catégorie robustesse · effort S · `server/app.js`

```
ngaDex)
[ext] ✓ novelbin v1.3.0 (NovelBin)
[ext] ✓ novelfull v1.2.2 (NovelFull)
[ext] ✓ royalroad v1.2.2 (Royal Road)
[ext] ✓ sushiscan v1.2.0 (SushiScan)
[ext] ✓ weebcentral v1.4.1 (Weeb Central)
9 extension(s) chargée(s)
[sushiscan] index adulte prêt : 0 titres masqués
Inko backend → http://localhost:8154
   API base  → http://localhost:8154/api
   Frontend  → http://localhost:8154/accueil.html

```

**Correctif** : Quitter avec un message clair.

#### `VP-NAVIGATEUR-DIRECT` Le navigateur contacte directement 2 hôte(s) extérieur(s) : ils voient ton adresse

sonde **vie-privee** · catégorie vie privée · effort M · `confidentialite.html`

```
graphql.anilist.co (fetch)
s4.anilist.co (image)
```

**Correctif** : Passer par le relais du hub, au moins sur option (« mode strict »), et le dire.

#### `VP-NON-DECLARE-SERVEUR` 1 hôte(s) contacté(s) par le serveur ne figurent pas dans la page Confidentialité

sonde **vie-privee** · catégorie vie privée · effort S · `confidentialite.html`

```
hot.planeptune.us
```

**Correctif** : Compléter la page à partir des extensions installées.

#### `ADA-ZOOM-COUPE` bibliotheque.html à 200 % : texte coupé

sonde **adaptabilite** · catégorie accessibilité · effort S · `bibliotheque.html`

```
div#mh-live « 12 séries »
```

**Correctif** : Hauteurs libres.

#### `ADA-ZOOM-COUPE` recherche.html à 200 % : texte coupé

sonde **adaptabilite** · catégorie accessibilité · effort S · `recherche.html`

```
div#mh-live « 47 résultat(s) pour Naruto »
```

**Correctif** : Hauteurs libres.

#### `ADA-ZOOM-COUPE` systeme.html à 200 % : texte coupé

sonde **adaptabilite** · catégorie accessibilité · effort S · `systeme.html`

```
div.sy-ap « Le poids d’un titre »
div.sy-ap « background-color 150ms cubic »
```

**Correctif** : Hauteurs libres.

#### `ADA-ESPACEMENT-COUPE` recherche.html : avec l'espacement de texte imposé, 1 texte(s) deviennent illisibles

sonde **adaptabilite** · catégorie accessibilité · effort S · `recherche.html`

```
div#mh-live « 47 résultat(s) pour Naruto »
```

**Correctif** : min-height au lieu de height ; pas de overflow hidden sur le texte (WCAG 1.4.12).

#### `ADA-FORCE-ETAT` accueil.html en contraste forcé : on ne voit plus quel choix est actif

sonde **adaptabilite** · catégorie accessibilité · effort S · `accueil.html`

```
button#ongletPopular
```

**Correctif** : @media (forced-colors: active) avec contour ou soulignement sur l'état actif.

#### `ADA-FORCE-ETAT` bibliotheque.html en contraste forcé : on ne voit plus quel choix est actif

sonde **adaptabilite** · catégorie accessibilité · effort S · `bibliotheque.html`

```
button.lib2-tab
button.lib-cat
```

**Correctif** : @media (forced-colors: active) avec contour ou soulignement sur l'état actif.

#### `ADA-FORCE-ETAT` catalogue.html en contraste forcé : on ne voit plus quel choix est actif

sonde **adaptabilite** · catégorie accessibilité · effort S · `catalogue.html`

```
button.view-btn
```

**Correctif** : @media (forced-colors: active) avec contour ou soulignement sur l'état actif.

#### `ADA-FORCE-ETAT` recherche.html en contraste forcé : on ne voit plus quel choix est actif

sonde **adaptabilite** · catégorie accessibilité · effort S · `recherche.html`

```
button.se-chip
```

**Correctif** : @media (forced-colors: active) avec contour ou soulignement sur l'état actif.

#### `ADA-EXTREME-DEBORDE` — 6 occurrences

**Correctif** : overflow-wrap: anywhere ; min-width: 0. (effort unitaire S)

- accueil.html (bureau) : un titre hors norme élargit la page de 1549 px — `accueil.html`
- notes.html (bureau) : un titre hors norme élargit la page de 258 px — `notes.html`
- u.html (bureau) : un titre hors norme élargit la page de 15074 px — `u.html`
- accueil.html (mobile) : un titre hors norme élargit la page de 2434 px — `accueil.html`
- notes.html (mobile) : un titre hors norme élargit la page de 1010 px — `notes.html`
- u.html (mobile) : un titre hors norme élargit la page de 15777 px — `u.html`

#### `CERT-HTTP` www.gutenberg.org répond 503 à la racine

sonde **certificats** · catégorie dépendances externes · effort S · `extensions-community/gutenberg/index.js`

```
https://www.gutenberg.org/

Cité dans :
extensions-community/gutenberg/index.js:219
extensions-community/gutenberg-fr/index.js:217
extensions-community/gutenberg/index.js:220
extensions-community/gutenberg-fr/index.js:218
```

**Correctif** : Vérifier la source (défi anti-robot, panne, fermeture).

#### `AUT-WWW-PERIME` mobile/www du dépôt n'est plus celui que produirait la construction

sonde **autonome** · catégorie téléphone autonome · effort S · `scripts-ci/build-mobile-www.js`

```
Dernière écriture : 2026-11-09. Un APK construit sans relancer le script embarquerait une interface ancienne.
```

**Correctif** : Construire mobile/www juste avant chaque APK, dans le même script.

#### `AUT-INDEX-PAR-PAGE` Sans PC, chaque ouverture de page relance des dizaines d'appels à SushiScan (24 pages concernées)

sonde **autonome** · catégorie téléphone autonome · effort M · `assets/js/extensions-navigateur.js`

```
accueil.html : 21 appels en 6 s
bibliotheque.html : 21 appels en 6 s
catalogue.html : 21 appels en 6 s
chapitre.html : 21 appels en 6 s
collection-detail.html : 21 appels en 6 s
collections.html : 21 appels en 6 s
comparer.html : 21 appels en 6 s
confidentialite.html : 21 appels en 6 s
downloads.html : 21 appels en 6 s
import.html : 21 appels en 6 s
index.html : 21 appels en 6 s
lecture.html : 21 appels en 6 s

Les sources sont rechargées à chaque page et la source reconstruit son index des titres pour adultes sans pouvoir le garder.
```

**Correctif** : Garder l'index dans le stockage de l'appareil et ne le construire qu'à l'usage de la source.

#### `AUT-ERREUR-BRUTE` Sans PC, une source qui répond par une page d'erreur affiche « Unexpected token < … is not valid JSON »

sonde **autonome** · catégorie téléphone autonome · effort S · `assets/js/sources-embarquees.js`

```
Filtres Catalogue Catalogue de MangaDex · MULTI Toutes les sources MangaDex Lecture aléatoire ⊞ ☰ Popularité Mis à jour Nouveautés Note A → Z ⚠ Chargement impossible Unexpected token '<', "<!doctype "... is not valid JSON Réessayer

sources-embarquees.js analyse le corps en JSON avant de regarder le statut (ici MangaDex répond « Bot challenge not passed », 403, depuis ce réseau). Le catalogue embarqué ne dépend que de cette source : refusé, l'écran est vide.
```

**Correctif** : Contrôler le statut avant JSON.parse, afficher le message prévu, proposer les autres sources embarquées.

#### `NOUV-DESTINATION-LIBRE` Un compte peut faire envoyer des requêtes du serveur vers n'importe quelle adresse, interne comprise

sonde **nouveautes** · catégorie sécurité · effort S · `server/controllers/notif.controller.js`

```
Abonnement de notification accepté (HTTP 200) avec une adresse de la machine elle-même ; au scan suivant le serveur s'y est connecté 5 fois. Le contenu est chiffré et la réponse n'est pas rendue, mais c'est un moyen d'atteindre le réseau interne.
```

**Correctif** : N'accepter que les services de notification connus (HTTPS, adresses publiques).

#### `NOUV-CHAPITRE-ZERO` La position au chapitre 0 (prologue) est enregistrée sans numéro

sonde **nouveautes** · catégorie fonctionnement · effort S · `server/controllers/user.controller.js`

```
Envoyé : chapitre 0. En base : numéro vide (`chapter || null`).
```

**Correctif** : Tester `chapter ?? null`.

#### `MIG-REGLAGES-PERDUS` La série migrée perd ses réglages : date d'ajout, notifications coupées…

sonde **migration** · catégorie données · effort M · `server/lib/migration-sources.js`

```
favori.added_at : "2024-03-01T09:00:00.000Z" → "2026-11-26T14:52:19.000Z"
favori.notify : 0 → 1
favori.unread_count : 0 → null
```

**Correctif** : Copier toutes les colonnes du favori.

#### `COQ-PROTECTION-DESACTIVEE` La protection SmartScreen du moteur d'affichage est désactivée

sonde **coquille** · catégorie sécurité · effort S · `desktop-tauri/src-tauri/tauri.conf.json`

```
"--disable-features=…,msSmartScreenProtection" dans la configuration de la fenêtre, alors que des contenus de sites tiers y sont affichés.
```

**Correctif** : Retirer cette désactivation, ou en écrire la raison.

#### `COQ-RESTAURATION-SANS-CLE` La restauration en ligne de commande ne sait pas lire les sauvegardes de l'application de bureau

sonde **coquille** · catégorie données · effort S · `server/scripts/restore-backup.js`

```
L'application chiffre avec une phrase tirée au sort, gardée dans %APPDATA%\Inko ; le script de restauration ne lit que la variable BACKUP_PASSPHRASE.
```

**Correctif** : Lire la même phrase que l'application, et expliquer comment la mettre à l'abri.

### 🔵 Basse (284)

#### `STR-DOUBLON` Bloc de code répété 5× dans 5 fichiers

sonde **structure** · catégorie maintenabilité · effort S · `test/unit/double-auto-format.test.js:12`

```
Occurrences : test/unit/double-auto-format.test.js:12, test/unit/lecture-continue.test.js:17, test/unit/nuit-progressive.test.js:11, test/unit/pages-doubles.test.js:11, test/unit/rotation-paysage.test.js:12
Extrait :
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
```

**Correctif** : Factoriser dans global.js ou un module partagé.

#### `STR-DOUBLON` Bloc de code répété 3× dans 3 fichiers

sonde **structure** · catégorie maintenabilité · effort S · `test/e2e/echap.spec.js:14`

```
Occurrences : test/e2e/echap.spec.js:14, test/e2e/focus-clavier.spec.js:25, test/e2e/reperes.spec.js:23
Extrait :
const { test, expect } = require('@playwright/test');
const EULA_KEY = 'mh_eula_v2';
const TOUR_KEY = 'inko_tour_done';
```

**Correctif** : Factoriser dans global.js ou un module partagé.

#### `STR-MARQUEURS` 4 marqueur(s) TODO/FIXME/HACK

sonde **structure** · catégorie dette · effort S

```
tools/ffmpeg-master-latest-win64-gpl/doc/faq.html:31 XXX . Can you include a Windows DLL loader to support it?</a></li>
tools/ffmpeg-master-latest-win64-gpl/doc/faq.html:74 XXX ?</a></li>
tools/ffmpeg-master-latest-win64-gpl/doc/faq.html:106 XXX . Can you include a Windows DLL loader to support it?<span class="pull-right"><a class="an
tools/ffmpeg-master-latest-win64-gpl/doc/faq.html:700 XXX ?<span class="pull-right"><a class="anchor hidden-xs" href="#Can-you-support-my-C-compiler
```

**Correctif** : Trier : ouvrir un ticket ou supprimer.

#### `SEC-SQL-DYNAMIQUE` — 11 occurrences

**Correctif** : Valeurs en paramètres ? ; liste blanche pour colonnes et ordre. (effort unitaire S)

- SQL construit dynamiquement (fragment de structure) — `server/controllers/auth.controller.js:452`
- SQL construit dynamiquement (fragment de structure) — `server/controllers/notes.controller.js:50`
- SQL construit dynamiquement (fragment de structure) — `server/controllers/notes.controller.js:54`
- SQL construit dynamiquement (fragment de structure) — `server/controllers/notes.controller.js:126`
- SQL construit dynamiquement (fragment de structure) — `server/controllers/user.controller.js:650`
- SQL construit dynamiquement (fragment de structure) — `server/controllers/user.controller.js:718`
- SQL construit dynamiquement (fragment de structure) — `server/controllers/user.controller.js:793`
- SQL construit dynamiquement (fragment de structure) — `server/controllers/user.controller.js:876`
- SQL construit dynamiquement (fragment de structure) — `server/controllers/user.controller.js:951`
- SQL construit dynamiquement (fragment de structure) — `server/controllers/user.controller.js:975`
- SQL construit dynamiquement (fragment de structure) — `server/controllers/user.controller.js:1862`

#### `SEC-NOOPENER` target=_blank sans rel=noopener

sonde **securite** · catégorie sécurité · effort S · `assets/js/eula.js:131`

#### `SEC-NOOPENER` target=_blank sans rel=noopener

sonde **securite** · catégorie sécurité · effort S · `assets/js/eula.js:131`

#### `RTE-SANS-LIMITEUR` 56 route(s) d'écriture sans limiteur dédié

sonde **routes** · catégorie robustesse · effort S

```
POST /app/update
PUT /auth/google-config
PUT /auth/password
PUT /auth/profile
POST /auth/delete
POST /extensions/update
POST /extensions/:id/uninstall
POST /extensions/:id/reinstall
PUT /anilist/config
POST /me/favorites
DELETE /me/favorites/:mangaId
PUT /me/favorites/:mangaId/category
PUT /me/favorites/:mangaId/meta
PUT /me/library/:mangaId
PUT /me/progress/:mangaId
DELETE /me/progress/:mangaId
POST /me/read-chapters
POST /me/read-chapters/bulk
POST /me/read-chapters/unmark-bulk
POST /me/lists
PUT /me/lists/:id
DELETE /me/lists/:id
POST /me/lists/:id/items
DELETE /me/lists/:id/items/:mangaId
PUT /me/lists/:id/order
POST /me/bookmarks
DELETE /me/bookmarks/:mangaId/:chapterId
DELETE /devices/:id
POST /me/remote
DELETE /devices/push-token
DELETE /comments/:commentId
POST /library/import/local
DELETE /library/local/:id
POST /me/notifications/read-all
POST /me/notifications/:id/read
PUT /me/
```

**Correctif** : Vérifier que writeLimiter est bien appliqué globalement (app.js) ; sinon l'ajouter par route.

#### `RTE-EXPORT-ORPHELIN` auth.controller.js exporte 1 fonction(s) jamais routée(s) ni importée(s)

sonde **routes** · catégorie code mort · effort S · `server/controllers/auth.controller.js`

```
decrireAppareil
```

**Correctif** : Supprimer ou brancher.

#### `RTE-PARAMS-NON-VALIDES` 49 usage(s) de req.params sans validation visible

sonde **routes** · catégorie robustesse · effort M

```
server/controllers/auth.controller.js:550 (params.id)
server/controllers/auth.controller.js:552 (params.id)
server/controllers/manga.controller.js:110 (params.sourceId)
server/controllers/manga.controller.js:244 (params.id)
server/controllers/manga.controller.js:245 (params.id)
server/controllers/manga.controller.js:263 (params.id)
server/controllers/manga.controller.js:265 (params.id)
server/controllers/manga.controller.js:275 (params.id)
server/controllers/manga.controller.js:285 (params.id)
server/controllers/user.controller.js:195 (params.mangaId)
server/controllers/user.controller.js:196 (params.mangaId)
server/controllers/user.controller.js:262 (params.mangaId)
server/controllers/user.controller.js:294 (params.mangaId)
server/controllers/user.controller.js:340 (params.mangaId)
server/controllers/user.controller.js:356 (params.mangaId)
server/controllers/user.controller.js:359 (para
```

**Correctif** : Valider (type, longueur, motif) au bord ; un middleware de schéma centraliserait cela.

#### `SQL-LIKE-PREFIXE-JOKER` LIKE à joker de tête : balayage complet de la table

sonde **sql** · catégorie performance · effort M · `server/db/migrate.js:264`

**Correctif** : FULLTEXT ou colonne normalisée indexée si la table grossit.

#### `SQL-LIKE-PREFIXE-JOKER` LIKE à joker de tête : balayage complet de la table

sonde **sql** · catégorie performance · effort M · `server/db/migrate.js:365`

**Correctif** : FULLTEXT ou colonne normalisée indexée si la table grossit.

#### `SQL-LIKE-PREFIXE-JOKER` LIKE à joker de tête : balayage complet de la table

sonde **sql** · catégorie performance · effort M · `server/db/migrate.js:371`

**Correctif** : FULLTEXT ou colonne normalisée indexée si la table grossit.

#### `SQL-SELECT-ETOILE` 25 SELECT * : colonnes lourdes (JSON, TEXT) lues inutilement

sonde **sql** · catégorie performance · effort M

**Correctif** : Lister les colonnes ; surtout quand la table porte du JSON/TEXT.

#### `SQL-MIGRATIONS-TROUS` Numérotation de migrations non contiguë

sonde **sql** · catégorie intégrité · effort S

```
24→27, 27→26, 26→25, 25→28
```

#### `ERR-FETCH-JSON-SANS-TEST-DE-RES-OK` 1× « fetch + json sans test de res.ok » dans assets/js/i18n.js

sonde **erreurs** · catégorie robustesse · effort S · `assets/js/i18n.js:264`

```
Lignes : 264
```

**Correctif** : Vérifier res.ok avant .json() : une page d'erreur HTML fait lever un SyntaxError opaque.

#### `ERR-CONSOLE-LOG-SERVEUR` 9× « console.log serveur » dans server/db/init.js

sonde **erreurs** · catégorie robustesse · effort S · `server/db/init.js:17`

```
Lignes : 17, 33, 36, 45, 53, 55, 58, 66, 71
```

**Correctif** : Utiliser le journal du serveur (niveaux) plutôt que console.log.

#### `ERR-CONSOLE-LOG-SERVEUR` 9× « console.log serveur » dans server/db/migrate.js

sonde **erreurs** · catégorie robustesse · effort S · `server/db/migrate.js:146`

```
Lignes : 146, 217, 265, 319, 758, 808, 854, 902, 950
```

**Correctif** : Utiliser le journal du serveur (niveaux) plutôt que console.log.

#### `ERR-CONSOLE-LOG-SERVEUR` 14× « console.log serveur » dans server/scripts/restore-backup.js

sonde **erreurs** · catégorie robustesse · effort S · `server/scripts/restore-backup.js:60`

```
Lignes : 60, 66, 67, 73, 75, 195, 202, 205, 208, 209, 223, 225, 231, 234
```

**Correctif** : Utiliser le journal du serveur (niveaux) plutôt que console.log.

#### `A11Y-LIEN-EVITEMENT` — 24 occurrences

**Correctif** : Premier élément focusable : <a class="skip" href="#main">. (effort unitaire S)

- Pas de lien d'évitement (« Aller au contenu ») — `accueil.html`
- Pas de lien d'évitement (« Aller au contenu ») — `anilist.html`
- Pas de lien d'évitement (« Aller au contenu ») — `bibliotheque.html`
- Pas de lien d'évitement (« Aller au contenu ») — `chapitre.html`
- Pas de lien d'évitement (« Aller au contenu ») — `collection-detail.html`
- Pas de lien d'évitement (« Aller au contenu ») — `collections.html`
- Pas de lien d'évitement (« Aller au contenu ») — `comparer.html`
- Pas de lien d'évitement (« Aller au contenu ») — `confidentialite.html`
- Pas de lien d'évitement (« Aller au contenu ») — `downloads.html`
- Pas de lien d'évitement (« Aller au contenu ») — `import.html`
- Pas de lien d'évitement (« Aller au contenu ») — `index.html`
- Pas de lien d'évitement (« Aller au contenu ») — `lecture.html`
- Pas de lien d'évitement (« Aller au contenu ») — `liste.html`
- Pas de lien d'évitement (« Aller au contenu ») — `localreader.html`
- Pas de lien d'évitement (« Aller au contenu ») — `notes.html`
- Pas de lien d'évitement (« Aller au contenu ») — `notifications.html`
- Pas de lien d'évitement (« Aller au contenu ») — `offline.html`
- Pas de lien d'évitement (« Aller au contenu ») — `parametres.html`
- Pas de lien d'évitement (« Aller au contenu ») — `recherche.html`
- Pas de lien d'évitement (« Aller au contenu ») — `serie.html`
- Pas de lien d'évitement (« Aller au contenu ») — `sources.html`
- Pas de lien d'évitement (« Aller au contenu ») — `stats.html`
- Pas de lien d'évitement (« Aller au contenu ») — `systeme.html`
- Pas de lien d'évitement (« Aller au contenu ») — `u.html`

#### `A11Y-H1` Aucun <h1> dans le HTML statique (peut être rendu en JS)

sonde **a11y-html** · catégorie accessibilité · effort S · `collection-detail.html`

**Correctif** : Un h1 (même visuellement masqué) donne le repère de page aux lecteurs d'écran.

#### `A11Y-H1` Aucun <h1> dans le HTML statique (peut être rendu en JS)

sonde **a11y-html** · catégorie accessibilité · effort S · `lecture.html`

**Correctif** : Un h1 (même visuellement masqué) donne le repère de page aux lecteurs d'écran.

#### `A11Y-H1` Aucun <h1> dans le HTML statique (peut être rendu en JS)

sonde **a11y-html** · catégorie accessibilité · effort S · `liste.html`

**Correctif** : Un h1 (même visuellement masqué) donne le repère de page aux lecteurs d'écran.

#### `A11Y-H1` Aucun <h1> dans le HTML statique (peut être rendu en JS)

sonde **a11y-html** · catégorie accessibilité · effort S · `serie.html`

**Correctif** : Un h1 (même visuellement masqué) donne le repère de page aux lecteurs d'écran.

#### `CSS-COULEURS-LITTERALES` 406 couleurs littérales hors variables (dont les feuilles de thème sombre/clair)

sonde **css** · catégorie cohérence · effort L

**Correctif** : Tout passer par des variables ; chaque littéral est un endroit où le thème clair/sombre/contraste peut diverger.

#### `CSS-ZINDEX` Échelle z-index sans règle : 24 valeurs distinctes, max 10000

sonde **css** · catégorie maintenabilité · effort M

**Correctif** : Échelle de variables (--z-nav, --z-modale, --z-toast…) ; le violet « par-dessus le bouton » vient de ce genre d'empilement.

#### `CSS-FONT-PX` 142 font-size en px : ignore le réglage de taille de texte du système

sonde **css** · catégorie accessibilité · effort M

**Correctif** : rem/em ou l'échelle typographique existante.

#### `CSS-CLASSES-MORTES` — 7 occurrences

**Correctif** : Vérifier les classes composées dynamiquement (préfixe + variable) avant de supprimer. (effort unitaire S)

- 18 classe(s) de assets/css/catalogue.css jamais référencée(s) (HTML/JS) — `assets/css/catalogue.css`
- 33 classe(s) de assets/css/chapitre.css jamais référencée(s) (HTML/JS) — `assets/css/chapitre.css`
- 40 classe(s) de assets/css/collection-detail.css jamais référencée(s) (HTML/JS) — `assets/css/collection-detail.css`
- 50 classe(s) de assets/css/collections.css jamais référencée(s) (HTML/JS) — `assets/css/collections.css`
- 31 classe(s) de assets/css/global.css jamais référencée(s) (HTML/JS) — `assets/css/global.css`
- 67 classe(s) de assets/css/profil.css jamais référencée(s) (HTML/JS) — `assets/css/profil.css`
- 30 classe(s) de assets/css/serie.css jamais référencée(s) (HTML/JS) — `assets/css/serie.css`

#### `I18N-IDENTIQUES` 28 entrée(s) dont la traduction est identique au français

sonde **i18n** · catégorie i18n · effort S

```
8. Contact
Badges
Catalogue →
Compact
Cyan
Deep Focus
Double
Format
Genres
Inko — Collection
Inko — Notifications
Jazzy beats
Journal
Mentions
Notifications
Orange
Page
Rectification
Sources
Spam, spoiler…
```

#### `PERF-IMG-SANS-DIM` <img> sans width/height ni loading : décalage de mise en page

sonde **perf-statique** · catégorie performance · effort S · `anilist.html:41`

#### `PERF-IMG-SANS-DIM` <img> sans width/height ni loading : décalage de mise en page

sonde **perf-statique** · catégorie performance · effort S · `offline.html:38`

#### `PERF-IMG-SANS-DIM` <img> sans width/height ni loading : décalage de mise en page

sonde **perf-statique** · catégorie performance · effort S · `profil.html:143`

#### `PERF-POLICES` 27 fichiers de polices (3 familles × graisses × sous-ensembles)

sonde **perf-statique** · catégorie performance · effort S

**Correctif** : unicode-range déjà utile ; supprimer les graisses non utilisées (grep font-weight).

#### `PERF-IMAGE-LOURDE` — 10 occurrences

**Correctif** : WebP/AVIF ou redimensionner. (effort unitaire S)

- tools/frames/01-intro.png : 599 Ko — `tools/frames/01-intro.png`
- tools/frames/02-accueil.png : 1303 Ko — `tools/frames/02-accueil.png`
- tools/frames/03-hover.png : 1246 Ko — `tools/frames/03-hover.png`
- tools/frames/04-serie.png : 595 Ko — `tools/frames/04-serie.png`
- tools/frames/05-reader.png : 733 Ko — `tools/frames/05-reader.png`
- tools/frames/06-biblio.png : 609 Ko — `tools/frames/06-biblio.png`
- tools/frames/07-music.png : 330 Ko — `tools/frames/07-music.png`
- tools/frames/08-outro.png : 627 Ko — `tools/frames/08-outro.png`
- tools/lib-pro.png : 452 Ko — `tools/lib-pro.png`
- tools/music-dock.png : 1390 Ko — `tools/music-dock.png`

#### `MORT-MH-INUTILISE` 6 fonction(s) exposée(s) sur MH jamais appelée(s) ailleurs

sonde **code-mort** · catégorie code mort · effort S

```
MH.statusBadge  (assets/js/global.js:1025)
MH.mesuresContenu  (assets/js/global.js:1661)
MH.finSquelette  (assets/js/global.js:1752)
MH.reserverTouches  (assets/js/global.js:3411)
MH.canInstall  (assets/js/pwa.js:19)
MH.pwaInstall  (assets/js/pwa.js:20)
```

**Correctif** : Retirer de l'API publique interne ; garder si utilisée par les extensions embarquées (vérifier le bac à sable).

#### `MORT-SERVEUR-ORPHELIN` server/db/init.js n'est requis par aucun autre module serveur

sonde **code-mort** · catégorie code mort · effort S · `server/db/init.js`

**Correctif** : Vérifier appel dynamique (require(variable)) ou script manuel ; sinon supprimer.

#### `MORT-RESIDU-RACINE` — 8 occurrences

**Correctif** : Déplacer sous docs/ ou assets/, ou .gitignore. (effort unitaire S)

- Résidu à la racine du dépôt : pivot-ltr.png — `pivot-ltr.png`
- Résidu à la racine du dépôt : pivot-rtl.png — `pivot-rtl.png`
- Résidu à la racine du dépôt : signet-biblio.png — `signet-biblio.png`
- Résidu à la racine du dépôt : RELEASE_TITLE.txt — `RELEASE_TITLE.txt`
- Résidu à la racine du dépôt : RELEASE_NOTES.md — `RELEASE_NOTES.md`
- Résidu à la racine du dépôt : audit.md — `audit.md`
- Résidu à la racine du dépôt : reponse-lilian.md — `reponse-lilian.md`
- Résidu à la racine du dépôt : test-results — `test-results`

#### `MORT-AUDITS-EMPILES` 3 documents d'audit à la racine (AUDIT-INKO-2026-07-28.md, AUDIT-QA-2026-08-12.md, audit.md)

sonde **code-mort** · catégorie hygiène · effort S

**Correctif** : Un seul document vivant (celui-ci) ; archiver les précédents sous docs/audit/archives/.

#### `DEP-ENGINES-DIVERGENT` engines.node : racine >=22.22.2 / serveur >=18

sonde **dependances** · catégorie versions · effort S · `server/package.json`

**Correctif** : Le serveur embarque Node 22 ; imposer >=22.22.2 partout.

#### `DEP-INUTILISEE` — 10 occurrences

**Correctif** : npm uninstall — poids d'installeur et surface d'attaque. (effort unitaire S)

- Dépendance « @capacitor/android » (racine) jamais requise — `package.json`
- Dépendance « @capacitor/app » (racine) jamais requise — `package.json`
- Dépendance « @capacitor/core » (racine) jamais requise — `package.json`
- Dépendance « @capacitor/device » (racine) jamais requise — `package.json`
- Dépendance « @capacitor/filesystem » (racine) jamais requise — `package.json`
- Dépendance « @capacitor/haptics » (racine) jamais requise — `package.json`
- Dépendance « @capacitor/network » (racine) jamais requise — `package.json`
- Dépendance « @capacitor/push-notifications » (racine) jamais requise — `package.json`
- Dépendance « @capacitor/screen-orientation » (racine) jamais requise — `package.json`
- Dépendance « @capacitor/status-bar » (racine) jamais requise — `package.json`

#### `DEP-MAJEURES` 1 dépendance(s) en retard d'une version majeure (server)

sonde **dependances** · catégorie dépendances · effort M

```
web-push: 3.6.7 → 4.0.0
```

**Correctif** : dependabot gère les mineures ; planifier les majeures une à une avec la suite de tests.

#### `PLT-CLEARTEXT` Trafic HTTP en clair autorisé (usesCleartextTraffic)

sonde **plateformes** · catégorie sécurité · effort M · `android/app/src/main/AndroidManifest.xml`

```
Nécessaire pour parler au hub local en HTTP ; à restreindre par network-security-config aux plages privées.
```

**Correctif** : network_security_config.xml : cleartext limité à 192.168.x / 10.x / .local.

#### `PLT-MIXED-CONTENT` Capacitor allowMixedContent: true

sonde **plateformes** · catégorie sécurité · effort M · `capacitor.config.json`

**Correctif** : Utile pour les couvertures http:// ; passer par le proxy d'images du hub (https non requis) et retirer.

#### `PLT-DOCKER-TAG-FLOTTANT` Image de base non épinglée (tag flottant)

sonde **plateformes** · catégorie reproductibilité · effort S · `Dockerfile`

#### `DOC-ENV-NON-DOCUMENTEES` 3 variable(s) d'environnement lue(s) mais documentée(s) nulle part

sonde **docs** · catégorie docs · effort S

```
FAV_SUPPRESSION_MAX, FAV_SUPPRESSION_FENETRE_MS, COVER_SOURCE_TIMEOUT_MS
```

**Correctif** : Tableau dans le README + server/.env.example (nom, défaut, effet).

#### `DOC-CAPTURES-ORPHELINES` 5 capture(s) non référencée(s) par le README

sonde **docs** · catégorie docs · effort S

```
accueil.jpg, bibliotheque.jpg, catalogue.jpg, lecteur.jpg, serie.jpg
```

#### `DOC-COMMUNAUTE` CODE_OF_CONDUCT.md absent (gabarit communautaire)

sonde **docs** · catégorie docs · effort S

**Correctif** : Utile dès que des contributeurs d'extensions arrivent.

#### `DOC-COMMUNAUTE` .github/ISSUE_TEMPLATE absent (gabarit communautaire)

sonde **docs** · catégorie docs · effort S

**Correctif** : Utile dès que des contributeurs d'extensions arrivent.

#### `DOC-COMMUNAUTE` .github/PULL_REQUEST_TEMPLATE.md absent (gabarit communautaire)

sonde **docs** · catégorie docs · effort S

**Correctif** : Utile dès que des contributeurs d'extensions arrivent.

#### `CI-ACTION-NON-EPINGLEE` Action tierce reactivecircus/android-emulator-runner@v2 non épinglée par SHA

sonde **ci** · catégorie sécurité · effort S · `.github/workflows/android-emulateur.yml:86`

**Correctif** : Épingler au SHA complet (dependabot sait les mettre à jour).

#### `CI-ACTION-NON-EPINGLEE` Action tierce android-actions/setup-android@v4 non épinglée par SHA

sonde **ci** · catégorie sécurité · effort S · `.github/workflows/android-release.yml:68`

**Correctif** : Épingler au SHA complet (dependabot sait les mettre à jour).

#### `CI-ACTION-NON-EPINGLEE` Action tierce android-actions/setup-android@v4 non épinglée par SHA

sonde **ci** · catégorie sécurité · effort S · `.github/workflows/android.yml:52`

**Correctif** : Épingler au SHA complet (dependabot sait les mettre à jour).

#### `CI-ACTION-NON-EPINGLEE` Action tierce softprops/action-gh-release@v3 non épinglée par SHA

sonde **ci** · catégorie sécurité · effort S · `.github/workflows/release.yml:94`

**Correctif** : Épingler au SHA complet (dependabot sait les mettre à jour).

#### `CI-TIMEOUT` — 6 occurrences

(effort unitaire S)

- Aucun timeout-minutes (un job bloqué consomme 6 h) — `.github/workflows/android-emulateur.yml`
- Aucun timeout-minutes (un job bloqué consomme 6 h) — `.github/workflows/android-release.yml`
- Aucun timeout-minutes (un job bloqué consomme 6 h) — `.github/workflows/android.yml`
- Aucun timeout-minutes (un job bloqué consomme 6 h) — `.github/workflows/ci.yml`
- Aucun timeout-minutes (un job bloqué consomme 6 h) — `.github/workflows/release.yml`
- Aucun timeout-minutes (un job bloqué consomme 6 h) — `.github/workflows/sources-health.yml`

#### `CI-CACHE` npm sans cache de dépendances

sonde **ci** · catégorie performance · effort S · `.github/workflows/sources-health.yml`

#### `CI-DEPENDABOT-ECOSYSTEME` dependabot ne surveille pas « gradle »

sonde **ci** · catégorie ci · effort S · `.github/dependabot.yml`

#### `CI-DEPENDABOT-ECOSYSTEME` dependabot ne surveille pas « docker »

sonde **ci** · catégorie ci · effort S · `.github/dependabot.yml`

#### `EXT-GROSSE` sushiscan : 925 lignes

sonde **extensions** · catégorie extensions · effort M · `extensions-community/sushiscan/index.js`

#### `ACCES-ENTETES` En-têtes de sécurité absents sur la page d'accueil : CSP, Permissions-Policy

sonde **api-acces** · catégorie sécurité · effort S

#### `ACCES-SANS-COMPRESSION` Page d'accueil servie sans compression malgré compression() (à vérifier avec Accept-Encoding)

sonde **api-acces** · catégorie performance · effort S

#### `ANA-NO-AWAIT-IN-LOOP` Attente en série dans une boucle : 196 occurrence(s) dans 63 fichier(s)

sonde **analyse** · catégorie analyse du code · effort L · `service-worker.js:322`

```
service-worker.js:322 — Unexpected `await` inside a loop.
assets/js/anilist.js:221 — Unexpected `await` inside a loop.
assets/js/api.js:388 — Unexpected `await` inside a loop.
assets/js/api.js:389 — Unexpected `await` inside a loop.
assets/js/api.js:503 — Unexpected `await` inside a loop.
assets/js/api.js:938 — Unexpected `await` inside a loop.
assets/js/api.js:940 — Unexpected `await` inside a loop.
assets/js/bibliotheque.js:581 — Unexpected `await` inside a loop.
assets/js/bibliotheque.js:585 — Unexpected `await` inside a loop.
assets/js/bibliotheque.js:586 — Unexpected `await` inside a loop.
assets/js/bibliotheque.js:839 — Unexpected `await` inside a loop.
assets/js/bibliotheque.js:846 — Unexpected `await` inside a loop.
assets/js/bibliotheque.js:1534 — Unexpected `await` inside a loop.
assets/js/bibliotheque.js:1573 — Unexpected `await` inside a loop.
assets/js/catalogue.js:693 — Une
```

#### `ANA-REQUIRE-ATOMIC-UPDATES` Écriture après un await qui peut écraser une autre : 126 occurrence(s) dans 35 fichier(s)

sonde **analyse** · catégorie analyse du code · effort L · `assets/js/accueil.js:259`

```
assets/js/accueil.js:259 — Possible race condition: `commencees` might be reassigned based on an outdated value of `commencees`.
assets/js/accueil.js:260 — Possible race condition: `commencees` might be reassigned based on an outdated value of `commencees`.
assets/js/anilist.js:39 — Possible race condition: `_config` might be reassigned based on an outdated value of `_config`.
assets/js/anilist.js:40 — Possible race condition: `_config` might be reassigned based on an outdated value of `_config`.
assets/js/anilist.js:143 — Possible race condition: `scoreCache[title]` might be assigned based on an outdated state of `scoreCache`.
assets/js/anilist.js:148 — Possible race condition: `scoreCache[title]` might be assigned based on an outdated state of `scoreCache`.
assets/js/anilist.js:170 — Possible race condition: `_links` might be reassigned based on an outdated value of `_links`.
assets/js
```

#### `ANA-NO-PROMISE-EXECUTOR-RETURN` Valeur rendue par un exécuteur de promesse : 38 occurrence(s) dans 34 fichier(s)

sonde **analyse** · catégorie analyse du code · effort S · `assets/js/api.js:388`

```
assets/js/api.js:388 — Return values from promise executor functions cannot be read.
assets/js/api.js:395 — Return values from promise executor functions cannot be read.
assets/js/api.js:938 — Return values from promise executor functions cannot be read.
assets/js/downloads.js:141 — Return values from promise executor functions cannot be read.
assets/js/fichiers-locaux.js:44 — Return values from promise executor functions cannot be read.
assets/js/global.js:2016 — Return values from promise executor functions cannot be read.
assets/js/global.js:3773 — Return values from promise executor functions cannot be read.
assets/js/parametres.js:911 — Return values from promise executor functions cannot be read.
server/extensions/chireads/index.js:63 — Return values from promise executor functions cannot be read.
server/extensions/gutenberg/index.js:37 — Return values from promise executor functio
```

#### `ANA-MAX-LINES-PER-FUNCTION` Fonction de plus de 150 lignes : 5 occurrence(s) dans 5 fichier(s)

sonde **analyse** · catégorie analyse du code · effort S · `assets/js/chapitre.js:52`

```
assets/js/chapitre.js:52 — Async arrow function has too many lines (175). Maximum allowed is 150.
assets/js/hub.js:228 — Function 'ecran' has too many lines (178). Maximum allowed is 150.
assets/js/moi-local.js:129 — Function 'repondre' has too many lines (371). Maximum allowed is 150.
assets/js/serie.js:245 — Function 'renderHero' has too many lines (337). Maximum allowed is 150.
assets/js/sources.js:100 — Async function 'render' has too many lines (214). Maximum allowed is 150.
```

#### `ANA-EQEQEQ` Comparaison lâche : 2 occurrence(s) dans 2 fichier(s)

sonde **analyse** · catégorie analyse du code · effort S · `assets/js/chapitre.js:2480`

```
assets/js/chapitre.js:2480 — Expected '===' and instead saw '=='.
assets/js/lecture.js:1051 — Expected '===' and instead saw '=='.
```

#### `ANA-NO-UNUSED-VARS` Variable ou fonction jamais utilisée : 6 occurrence(s) dans 6 fichier(s)

sonde **analyse** · catégorie analyse du code · effort S · `assets/js/userdata.js:53`

```
assets/js/userdata.js:53 — '_ignore' is assigned a value but never used.
server/controllers/migration.controller.js:78 — 'reference' is assigned a value but never used.
server/extensions/weebcentral/index.js:22 — 'COVER_FB' is assigned a value but never used.
server/lib/embedded-db.js:157 — 'waitForDb' is defined but never used.
scripts-ci/build-mobile-www.js:340 — 'nbExt' is assigned a value but never used.
extensions-community/weebcentral/index.js:22 — 'COVER_FB' is assigned a value but never used.
```

#### `ANA-NO-USELESS-ESCAPE` Échappement inutile : 4 occurrence(s) dans 3 fichier(s)

sonde **analyse** · catégorie analyse du code · effort S · `server/controllers/extensions.controller.js:47`

```
server/controllers/extensions.controller.js:47 — Unnecessary escape character: \-.
server/controllers/extensions.controller.js:48 — Unnecessary escape character: \-.
server/extensions/sushiscan/index.js:873 — Unnecessary escape character: \-.
extensions-community/sushiscan/index.js:873 — Unnecessary escape character: \-.
```

#### `ANA-MAX-DEPTH` Imbrication au-delà de 5 : 1 occurrence(s) dans 1 fichier(s)

sonde **analyse** · catégorie analyse du code · effort S · `server/lib/updates.js:443`

```
server/lib/updates.js:443 — Blocks are nested too deeply (6). Maximum allowed is 5.
```

#### `LARGEUR-TEXTE-COUPE` — 15 occurrences

(effort unitaire S)

- localreader.html à 320 px : texte coupé sans points de suspension — `localreader.html`
- recherche.html à 320 px : texte coupé sans points de suspension — `recherche.html`
- u.html à 320 px : texte coupé sans points de suspension — `u.html`
- localreader.html à 360 px : texte coupé sans points de suspension — `localreader.html`
- recherche.html à 360 px : texte coupé sans points de suspension — `recherche.html`
- u.html à 360 px : texte coupé sans points de suspension — `u.html`
- localreader.html à 768 px : texte coupé sans points de suspension — `localreader.html`
- recherche.html à 768 px : texte coupé sans points de suspension — `recherche.html`
- u.html à 768 px : texte coupé sans points de suspension — `u.html`
- localreader.html à 1024 px : texte coupé sans points de suspension — `localreader.html`
- recherche.html à 1024 px : texte coupé sans points de suspension — `recherche.html`
- u.html à 1024 px : texte coupé sans points de suspension — `u.html`
- localreader.html à 1920 px : texte coupé sans points de suspension — `localreader.html`
- recherche.html à 1920 px : texte coupé sans points de suspension — `recherche.html`
- u.html à 1920 px : texte coupé sans points de suspension — `u.html`

#### `LIEN-VIDE` — 40 occurrences

(effort unitaire S)

- accueil.html : lien « Aléatoire » sans destination (#) — `accueil.html`
- bibliotheque.html : lien « Aléatoire » sans destination (#) — `bibliotheque.html`
- catalogue.html : lien « Aléatoire » sans destination (#) — `catalogue.html`
- collection-detail.html : lien « Aléatoire » sans destination (#) — `collection-detail.html`
- collections.html : lien « Random » sans destination (#) — `collections.html`
- comparer.html : lien « Random » sans destination (#) — `comparer.html`
- downloads.html : lien « Random » sans destination (#) — `downloads.html`
- import.html : lien « Random » sans destination (#) — `import.html`
- index.html : lien « Random » sans destination (#) — `index.html`
- lecture.html : lien « Random » sans destination (#) — `lecture.html`
- liste.html : lien « Random » sans destination (#) — `liste.html`
- notes.html : lien « Random » sans destination (#) — `notes.html`
- notifications.html : lien « Random » sans destination (#) — `notifications.html`
- parametres.html : lien « Random » sans destination (#) — `parametres.html`
- profil.html : lien « Random » sans destination (#) — `profil.html`
- profil.html : lien « ⊞ Overview » sans destination (#) — `profil.html`
- profil.html : lien « History » sans destination (#) — `profil.html`
- profil.html : lien « ≡ Reading lists » sans destination (#) — `profil.html`
- profil.html : lien « ★ My reviews » sans destination (#) — `profil.html`
- profil.html : lien « Badges » sans destination (#) — `profil.html`
- profil.html : lien « See all » sans destination (#) — `profil.html`
- profil.html : lien « View the whole collection » sans destination (#) — `profil.html`
- profil.html : lien « See all » sans destination (#) — `profil.html`
- profil.html : lien « See all » sans destination (#) — `profil.html`
- profil.html : lien « Public preview » sans destination (#) — `profil.html`
- recherche.html : lien « Random » sans destination (#) — `recherche.html`
- serie.html : lien « Random » sans destination (#) — `serie.html`
- sources.html : lien « Random » sans destination (#) — `sources.html`
- stats.html : lien « Aléatoire » sans destination (#) — `stats.html`
- u.html : lien « Random » sans destination (#) — `u.html`
- profil.html : lien « ⊞ Vue d'ensemble » sans destination (#) — `profil.html`
- profil.html : lien « Historique » sans destination (#) — `profil.html`
- profil.html : lien « ≡ Listes de lecture » sans destination (#) — `profil.html`
- profil.html : lien « ★ Mes avis » sans destination (#) — `profil.html`
- profil.html : lien « Badges » sans destination (#) — `profil.html`
- profil.html : lien « Voir tout » sans destination (#) — `profil.html`
- profil.html : lien « Voir toute la collection » sans destination (#) — `profil.html`
- profil.html : lien « Voir tout » sans destination (#) — `profil.html`
- profil.html : lien « Voir tous » sans destination (#) — `profil.html`
- profil.html : lien « Aperçu public » sans destination (#) — `profil.html`

#### `BTN-CIBLE-PETITE` — 16 occurrences

**Correctif** : Zone tactile ≥ 44×44 (padding ou ::before invisible). (effort unitaire M)

- accueil.html : 32 cibles tactiles trop petites (< 32 px) — `accueil.html`
- bibliotheque.html : 79 cibles tactiles trop petites (< 32 px) — `bibliotheque.html`
- catalogue.html : 39 cibles tactiles trop petites (< 32 px) — `catalogue.html`
- chapitre.html : 8 cibles tactiles trop petites (< 32 px) — `chapitre.html`
- collection-detail.html : 5 cibles tactiles trop petites (< 32 px) — `collection-detail.html`
- collections.html : 7 cibles tactiles trop petites (< 32 px) — `collections.html`
- downloads.html : 6 cibles tactiles trop petites (< 32 px) — `downloads.html`
- index.html : 32 cibles tactiles trop petites (< 32 px) — `index.html`
- lecture.html : 5 cibles tactiles trop petites (< 32 px) — `lecture.html`
- notes.html : 9 cibles tactiles trop petites (< 32 px) — `notes.html`
- notifications.html : 6 cibles tactiles trop petites (< 32 px) — `notifications.html`
- parametres.html : 15 cibles tactiles trop petites (< 32 px) — `parametres.html`
- profil.html : 19 cibles tactiles trop petites (< 32 px) — `profil.html`
- serie.html : 16 cibles tactiles trop petites (< 32 px) — `serie.html`
- stats.html : 5 cibles tactiles trop petites (< 32 px) — `stats.html`
- u.html : 5 cibles tactiles trop petites (< 32 px) — `u.html`

#### `VIE-PRIVEE-HOTES-EXTERNES` Le navigateur contacte directement 4 hôte(s) externe(s) : github.com, www.youtube.com, s4.anilist.co, graphql.anilist.co

sonde **boutons** · catégorie confidentialité · effort S

```
github.com ×10
www.youtube.com ×203
s4.anilist.co ×84
graphql.anilist.co ×6
```

**Correctif** : Chaque appel direct révèle l'adresse IP et la page consultée au tiers ; passer par le proxy local (ou auto-héberger la police/icône) et le déclarer dans la page Confidentialité.

#### `TEST-IGNORE` Test ignoré (skip/todo)

sonde **tests** · catégorie tests · effort S · `server/test/corbeille.test.js`

#### `TEST-IGNORE` Test ignoré (skip/todo)

sonde **tests** · catégorie tests · effort S · `server/test/identite-hub.test.js`

#### `TEST-IGNORE` Test ignoré (skip/todo)

sonde **tests** · catégorie tests · effort S · `server/test/integration.db.test.js`

#### `PAGE-CIBLES-PETITES` catalogue.html : 36 cibles tactiles < 24 px

sonde **pages** · catégorie mobile · effort M · `catalogue.html`

**Correctif** : Zone tactile minimale 44×44 (padding invisible).

#### `NET-DOUBLON` — 19 occurrences

**Correctif** : Mutualiser la requête (SHARED_GET). (effort unitaire S)

- accueil.html : 3 lecture(s) d'API demandée(s) plusieurs fois — `accueil.html`
- bibliotheque.html : 7 lecture(s) d'API demandée(s) plusieurs fois — `bibliotheque.html`
- catalogue.html : 4 lecture(s) d'API demandée(s) plusieurs fois — `catalogue.html`
- collection-detail.html : 1 lecture(s) d'API demandée(s) plusieurs fois — `collection-detail.html`
- collections.html : 4 lecture(s) d'API demandée(s) plusieurs fois — `collections.html`
- comparer.html : 3 lecture(s) d'API demandée(s) plusieurs fois — `comparer.html`
- downloads.html : 3 lecture(s) d'API demandée(s) plusieurs fois — `downloads.html`
- import.html : 1 lecture(s) d'API demandée(s) plusieurs fois — `import.html`
- index.html : 4 lecture(s) d'API demandée(s) plusieurs fois — `index.html`
- liste.html : 1 lecture(s) d'API demandée(s) plusieurs fois — `liste.html`
- notes.html : 4 lecture(s) d'API demandée(s) plusieurs fois — `notes.html`
- notifications.html : 3 lecture(s) d'API demandée(s) plusieurs fois — `notifications.html`
- parametres.html : 5 lecture(s) d'API demandée(s) plusieurs fois — `parametres.html`
- profil.html : 7 lecture(s) d'API demandée(s) plusieurs fois — `profil.html`
- recherche.html : 5 lecture(s) d'API demandée(s) plusieurs fois — `recherche.html`
- serie.html : 4 lecture(s) d'API demandée(s) plusieurs fois — `serie.html`
- sources.html : 4 lecture(s) d'API demandée(s) plusieurs fois — `sources.html`
- stats.html : 3 lecture(s) d'API demandée(s) plusieurs fois — `stats.html`
- u.html : 3 lecture(s) d'API demandée(s) plusieurs fois — `u.html`

#### `NET-JS-INUTILE` — 6 occurrences

**Correctif** : Découper global.js ; import à la demande. (effort unitaire M)

- accueil.html : 61 % des 661 Ko de JavaScript ne servent pas au chargement — `accueil.html`
- confidentialite.html : 67 % des 520 Ko de JavaScript ne servent pas au chargement — `confidentialite.html`
- downloads.html : 63 % des 693 Ko de JavaScript ne servent pas au chargement — `downloads.html`
- import.html : 62 % des 643 Ko de JavaScript ne servent pas au chargement — `import.html`
- serie.html : 66 % des 762 Ko de JavaScript ne servent pas au chargement — `serie.html`
- systeme.html : 64 % des 529 Ko de JavaScript ne servent pas au chargement — `systeme.html`

#### `NET-GROS-FICHIER` /assets/js/global.js : 214 Ko, 57 % exécutés au chargement (21 pages)

sonde **charge** · catégorie performance · effort L · `assets/js/global.js`

**Correctif** : Découper par fonction ; ce fichier pèse sur chaque page qui le charge.

#### `NET-GROS-FICHIER` /assets/js/serie.js : 111 Ko, 10 % exécutés au chargement (1 pages)

sonde **charge** · catégorie performance · effort L · `assets/js/serie.js`

**Correctif** : Découper par fonction ; ce fichier pèse sur chaque page qui le charge.

#### `NET-GROS-FICHIER` /assets/js/bibliotheque.js : 108 Ko, 42 % exécutés au chargement (1 pages)

sonde **charge** · catégorie performance · effort L · `assets/js/bibliotheque.js`

**Correctif** : Découper par fonction ; ce fichier pèse sur chaque page qui le charge.

#### `NET-GROS-FICHIER` /assets/vendor/jszip.min.js : 95 Ko, 18 % exécutés au chargement (3 pages)

sonde **charge** · catégorie performance · effort L · `assets/vendor/jszip.min.js`

**Correctif** : Découper par fonction ; ce fichier pèse sur chaque page qui le charge.

#### `NET-GROS-FICHIER` /assets/js/profil.js : 84 Ko, 51 % exécutés au chargement (1 pages)

sonde **charge** · catégorie performance · effort L · `assets/js/profil.js`

**Correctif** : Découper par fonction ; ce fichier pèse sur chaque page qui le charge.

#### `INT-LISTES-MEME-NOM` 10 listes de même nom peuvent coexister (double clic)

sonde **integrite** · catégorie données · effort M

```
10 créations simultanées.
```

**Correctif** : Bouton désactivé pendant l'envoi et unicité (user_id, name).

#### `INT-MIGRATION-BASE-VIDE` Les migrations seules ne construisent pas la base (schema.sql obligatoire)

sonde **integrite** · catégorie données · effort M · `server/db/migrate.js`

```
v (0) from .env
[migrate] ✖ ER_NO_SUCH_TABLE — Table 'inko_s_vide.comments' doesn't exist
          SQL : ALTER TABLE comments ADD COLUMN parent_id INT DEFAULT NULL
[migrate] ✖ migration 1 (socle-historique (threads, reports, notifications, notes, imports, index, types)) a échoué — versions suivantes non appliquées.
migration échouée : ER_NO_SUCH_TABLE — Table 'inko_s_vide.comments' doesn't exist

```

**Correctif** : Faire de schema.sql la migration 0, ou le documenter et le tester.

#### `SD-INSCRIPTION-OUVERTE` L'inscription est ouverte à tous sur une instance partagée, sans réglage pour la fermer

sonde **securite-dyn** · catégorie sécurité · effort S

```
POST /api/auth/register accepté sans invitation.
```

**Correctif** : Variable REGISTRATION=closed|invite et codes d'invitation.

#### `SD-ENUMERATION` L'inscription révèle si une adresse a un compte

sonde **securite-dyn** · catégorie sécurité · effort S

```
409 « Un compte existe déjà avec cet email ».
```

**Correctif** : Message neutre sur une instance exposée.

#### `MOB-TEXTE-MINUSCULE` — 7 occurrences

**Correctif** : Plancher à 12 px. (effort unitaire S)

- chapitre.html : texte sous 11 px — `chapitre.html`
- collection-detail.html : texte sous 11 px — `collection-detail.html`
- parametres.html : texte sous 11 px — `parametres.html`
- profil.html : texte sous 11 px — `profil.html`
- recherche.html : texte sous 11 px — `recherche.html`
- serie.html : texte sous 11 px — `serie.html`
- stats.html : texte sous 11 px — `stats.html`

#### `MOB-INTERROMPU` chapitre.html : page.setViewportSize: Protocol error (Browser.setWindowBounds): To resize minimized/maximi

sonde **mobile** · catégorie mobile · effort S

#### `INTERACTION-INTERROMPUE` accueil.html : page.goto: Navigation to "http://127.0.0.1:8094/accueil.html" is interrupted by another na

sonde **interaction** · effort S

#### `SAISIE-DEBORDE` — 15 occurrences

(effort unitaire S)

- catalogue.html : un texte long dans « headerSearch » élargit la page de 1518 px — `catalogue.html`
- collections.html : un texte long dans « headerSearch » élargit la page de 1518 px — `collections.html`
- comparer.html : un texte long dans « headerSearch » élargit la page de 1518 px — `comparer.html`
- downloads.html : un texte long dans « headerSearch » élargit la page de 1518 px — `downloads.html`
- import.html : un texte long dans « headerSearch » élargit la page de 1518 px — `import.html`
- lecture.html : un texte long dans « headerSearch » élargit la page de 1518 px — `lecture.html`
- liste.html : un texte long dans « headerSearch » élargit la page de 1518 px — `liste.html`
- notifications.html : un texte long dans « headerSearch » élargit la page de 1518 px — `notifications.html`
- parametres.html : un texte long dans « headerSearch » élargit la page de 1518 px — `parametres.html`
- profil.html : un texte long dans « headerSearch » élargit la page de 1518 px — `profil.html`
- recherche.html : un texte long dans « headerSearch » élargit la page de 1518 px — `recherche.html`
- serie.html : un texte long dans « headerSearch » élargit la page de 1518 px — `serie.html`
- sources.html : un texte long dans « headerSearch » élargit la page de 1518 px — `sources.html`
- stats.html : un texte long dans « headerSearch » élargit la page de 1518 px — `stats.html`
- u.html : un texte long dans « headerSearch » élargit la page de 1518 px — `u.html`

#### `FENETRE-SANS-NOM` parametres.html : la fenêtre « Gérer » n'a pas de nom accessible

sonde **interaction** · catégorie accessibilité · effort S · `parametres.html`

**Correctif** : aria-labelledby sur le titre.

#### `REF-ROUTE-INUTILISEE` 1 route(s) du serveur qu'aucun écran n'appelle

sonde **references** · catégorie références · effort S · `server/routes/index.js`

```
GET /openapi.json (routes/index.js:71)
```

**Correctif** : Les brancher à un écran (fonction invisible aujourd'hui) ou les retirer.

#### `REF-FICHIER-ORPHELIN` 4 fichier(s) que rien ne charge

sonde **references** · catégorie références · effort S

```
assets/js/cheerio-navigateur.js
assets/js/compat.js
assets/js/hero3d.js
assets/js/hub.js
```

**Correctif** : Retirer ou brancher.

#### `REF-EVENEMENT-SANS-ECOUTEUR` L'événement « api:error » est émis mais personne ne l'écoute

sonde **references** · catégorie références · effort S · `assets/js/api.js`

```
assets/js/api.js:347
assets/js/api.js:368
```

**Correctif** : Brancher la réaction attendue ou retirer l'émission.

#### `REF-EVENEMENT-SANS-ECOUTEUR` L'événement « i18n:change » est émis mais personne ne l'écoute

sonde **references** · catégorie références · effort S · `assets/js/i18n.js`

```
assets/js/i18n.js:301
```

**Correctif** : Brancher la réaction attendue ou retirer l'émission.

#### `REF-EVENEMENT-SANS-ECOUTEUR` L'événement « pwa:installable » est émis mais personne ne l'écoute

sonde **references** · catégorie références · effort S · `assets/js/pwa.js`

```
assets/js/pwa.js:29
```

**Correctif** : Brancher la réaction attendue ou retirer l'émission.

#### `REF-EVENEMENT-SANS-ECOUTEUR` L'événement « inko:synchro » est émis mais personne ne l'écoute

sonde **references** · catégorie références · effort S · `assets/js/synchro.js`

```
assets/js/synchro.js:287
```

**Correctif** : Brancher la réaction attendue ou retirer l'émission.

#### `IMP-PROGRESSION-LOCALE` La position dans un fichier importé n'est pas enregistrée sur le compte

sonde **imports** · catégorie fichiers importés · effort S · `assets/js/localreader.js`

```
GET /api/me/progress ne mentionne pas le fichier. Le README annonce que la reprise suit le compte.
```

**Correctif** : Vérifier le mécanisme annoncé ou corriger le texte.

#### `IMP-CBZ-PARASITES` Le lecteur CBZ compte 5 pages pour 3 planches (fichiers __MACOSX ou hors dossier)

sonde **imports** · catégorie fichiers importés · effort S · `assets/js/localreader.js`

**Correctif** : Écarter __MACOSX et les noms commençant par « ._ ».

#### `EX-REGLE-IGNOREE` Une règle inconnue crée en silence une liste ordinaire vide

sonde **exactitude** · catégorie exactitude · effort S · `server/controllers/user.controller.js`

```
POST /me/lists { rules: { inconnu: 1 } } → 200, smart: false.
```

**Correctif** : Répondre 400 en disant quelle règle n'est pas comprise.

#### `ADM-REGLE` Règle non tenue : compte inexistant signalé

sonde **administration** · catégorie instance partagée · effort S · `server/controllers/admin.controller.js`

```
PUT rôle d'un compte inexistant → 200 {"ok":true,"role":"user"}
```

**Correctif** : Corriger et ajouter le cas aux tests.

#### `ADM-REGLE` Règle non tenue : compte banni : reconnexion refusée

sonde **administration** · catégorie instance partagée · effort S · `server/controllers/auth.controller.js`

```
connexion → 200 ; un jeton est délivré à un compte suspendu
```

**Correctif** : Corriger et ajouter le cas aux tests.

#### `ADA-TITRE-VIDE` bibliotheque.html : 1 carte(s) sans titre lisible

sonde **adaptabilite** · catégorie bug · effort S · `bibliotheque.html`

```
Titre fait d'un espace.
```

**Correctif** : Repli sur l'identifiant ou « Sans titre ».

#### `ADA-TITRE-VIDE` bibliotheque.html : 1 carte(s) sans titre lisible

sonde **adaptabilite** · catégorie bug · effort S · `bibliotheque.html`

```
Titre fait d'un espace.
```

**Correctif** : Repli sur l'identifiant ou « Sans titre ».

### ⚪ Info (5)

#### `FLUX-ETAPE-KO` Parcours « favori : XSS dans le titre stocké tel quel (l'échappement doit se faire à l'affichage) » : stocké brut (OK si échappé partout à l'affichage — voir SEC-XSS-CANDIDAT)

sonde **flux-ecriture** · catégorie bug · effort M

#### `I18N-LANGUES` Deux langues seulement (FR source, EN)

sonde **i18n** · catégorie produit · effort XL

```
Le mécanisme « correspondance exacte du texte français » interdit de fait une troisième langue sans refonte (clés stables).
```

**Correctif** : Passer à des clés stables (ex. bibliotheque.titre) avant d'ajouter ES/PT/AR (lecteurs de manga).

#### `DOC-LANGUE` README uniquement en français

sonde **docs** · catégorie docs · effort M

**Correctif** : Une version EN (README.en.md) ouvre le projet aux contributeurs d'extensions internationaux.

#### `INT-EXPOSITION-REELLE` Ce que ta base contient aujourd’hui dans les tables mal couvertes

sonde **integrite** · catégorie données · effort M

```
liens AniList : 189
signets : 2
notes de carnet : 0
jours de temps de lecture : 4
listes : 1
lignes d historique : 94
événements : 6909
```

#### `LIC-GSAP` GSAP a une licence propre à son éditeur : vérifier les conditions pour une application distribuée

sonde **licences** · catégorie droit · effort S · `assets/vendor/gsap.min.js`
