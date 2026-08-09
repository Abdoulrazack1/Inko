# Inko — application de bureau (Tauri v2)

Enveloppe native autour du frontend et du backend Node. La fenêtre est une
WebView2 (Windows) ; le serveur Express tourne en **sidecar**, et une MariaDB
réduite (~29 Mo) est embarquée pour que l'app fonctionne sur un poste où aucune
base n'est installée.

```
npm run prep     # copie server/ + frontend + node.exe + MariaDB dans src-tauri/
npm run build    # tauri build → installeur NSIS
```

> `tauri.conf.json` n'accepte **aucune clé inconnue** : Tauri refuse de bâtir sur
> un champ qu'il ne connaît pas (y compris une pseudo-clé de commentaire type
> `"//targets"`). Les explications qui accompagnent la configuration vivent donc
> ici, pas dans le JSON.

## État multiplateforme (audit DESK-03)

Le projet ne produit qu'un installeur **Windows** (`targets: ["nsis"]`). Ce qui a
changé et ce qui bloque encore :

**Traité — le code Rust compile désormais ailleurs.** `src/main.rs` importait
`std::os::windows::process::CommandExt` sans condition : la compilation échouait
dès la ligne 15 sur macOS et Linux, avant même d'atteindre la moindre logique
métier. Cet import, l'appel `creation_flags(CREATE_NO_WINDOW)` et l'arrêt de la
MariaDB embarquée par PowerShell sont maintenant sous `#[cfg(windows)]`.

**Non traité — l'empaquetage reste spécifique Windows.** Deux verrous, dans cet
ordre :

1. **`prep.js` est écrit pour Windows.** Il copie avec `robocopy` (commande
   Windows), embarque `process.execPath` sous le nom
   `node-x86_64-pc-windows-msvc.exe`, et télécharge l'archive MariaDB
   `…-winx64.zip` dont il extrait `mariadbd.exe` et des `.dll`. Rien de tout
   cela n'a d'équivalent direct ailleurs : il faudrait une branche par plateforme
   (`fs.cp` récursif au lieu de robocopy, triplet de cible du sidecar déduit de
   `process.platform`/`arch`, archive MariaDB correspondante).

2. **La base embarquée n'existe qu'en binaire Windows dans ce dépôt.** Sur macOS
   et Linux il faudrait soit embarquer les binaires correspondants (et gérer
   `mariadb-install-db` sur chacun), soit assumer que l'app exige une base
   externe et le dire clairement au premier lancement. C'est une décision
   produit, pas un simple portage.

**Ne pas ajouter `"dmg"`, `"deb"` ou `"appimage"` à `bundle.targets` avant que
ces deux points soient traités** : le build passerait, mais produirait des
installeurs sans sidecar valide ni base de données — cassés au lancement.

## Installeur NSIS (audit DESK-05)

`bundle.windows.nsis.languages` vaut `["French", "English"]`. L'installeur ne
parlait que français alors que l'app expose une interface anglaise complète : un
utilisateur anglophone tombait sur un assistant qu'il ne comprenait pas, avant
même d'avoir vu le produit. NSIS choisit la langue d'après celle du système ;
`displayLanguageSelector` reste à `false` pour ne pas ajouter un écran de plus.

## Arrêt de la MariaDB embarquée (audit DESK-04)

À la fermeture de la fenêtre, le sidecar est tué — mais `TerminateProcess`
n'exécute pas les handlers `exit` de Node, donc `mariadbd` survivait et le port
restait occupé au lancement suivant. `main.rs` arrête donc explicitement le
processus, **filtré par chemin** (`*\Inko\resources\mariadb\*`).

Ce filtrage n'est pas cosmétique : sans lui, un `taskkill /IM mariadbd.exe`
tuerait la MariaDB personnelle de l'utilisateur. Toute réécriture de ce bloc doit
le conserver.
