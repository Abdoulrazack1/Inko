# Inko Desktop (Electron)

App native Windows / macOS / Linux qui embarque le backend Node.js et le
frontend dans une fenêtre Chromium.

## Pré-requis

- **Node.js ≥ 18** sur la machine de build.
- **MySQL accessible sur 127.0.0.1:3306** (Laragon, MAMP, Docker, service système…).
- Backend Inko initialisé : exécute `npm install && npm run init-db` dans `../server/`.

## Dev (lancer l'app sans builder)

```bash
cd desktop
npm install
npm start
```

L'app se connecte au backend embarqué (qui lance `server/server.js` en sous-process).

## Build d'installeurs

```bash
npm run dist          # Windows NSIS .exe   → dist/Inko-Setup-1.0.0.exe
npm run dist:mac      # macOS .dmg
npm run dist:linux    # Linux .AppImage + .deb
```

Les artefacts sortent dans `desktop/dist/`.

### ⚠ Windows : erreur « Cannot create symbolic link »

Sur Windows, `npm run dist` peut échouer pendant l'extraction du cache
`winCodeSign` parce que l'archive contient 2 symlinks Mac
(`darwin/10.12/lib/libcrypto.dylib` et `libssl.dylib`) que 7za refuse
d'extraire sans le privilège `SeCreateSymbolicLinkPrivilege`.

**Solutions (du plus simple au plus pro) :**

1. **Workaround sans admin** (testé OK) — remplacer les symlinks par
   des copies des fichiers cibles déjà présents :

   ```bash
   CACHE="$LOCALAPPDATA/electron-builder/Cache/winCodeSign"
   for d in $CACHE/*/; do
     LIB="$d/darwin/10.12/lib"
     [ -d "$LIB" ] && cp -f "$LIB/libcrypto.1.0.0.dylib" "$LIB/libcrypto.dylib"
     [ -d "$LIB" ] && cp -f "$LIB/libssl.1.0.0.dylib" "$LIB/libssl.dylib"
   done
   npm run dist
   ```

2. **Developer Mode + reboot** (Win 10/11) : `Settings → System →
   For developers → Developer Mode ON`, **redémarrer**, relancer.

3. **Terminal admin** : clic droit cmd/PowerShell → Exécuter en tant
   qu'administrateur → `cd …/desktop && npm run dist`.

4. **Builder depuis Mac/Linux** (CI/CD recommandé pour les releases).

5. **Pack minimal** : `npm run pack` produit `dist/win-unpacked/Inko.exe`
   directement exécutable (pas d'installeur).

## Icônes

Place dans `desktop/build/` :
- `icon.ico`  (Windows, 256×256+)
- `icon.icns` (macOS)
- `icon.png`  (Linux, ≥512×512)

Si absentes, Electron utilise son icône par défaut.

## Architecture

```
desktop/
├── main.js        # process principal Electron
├── preload.js     # bridge sandboxé (vide pour l'instant)
├── package.json   # config electron-builder
└── build/         # icônes + assets installeur (à fournir)
```

Au runtime, Electron empaquette :
- `resources/server/` ← clone de `../server` (sans .env)
- `resources/frontend/` ← HTML/CSS/JS du frontend Inko

Le `main.js` spawn `node resources/server/server.js` puis ouvre une
`BrowserWindow` sur `http://127.0.0.1:8088`.

## Légalité

Le binaire compilé ne contient **aucune source de mangas** par défaut
(modèle Mihon). L'utilisateur ajoute lui-même des extensions dans
`server/extensions/`. Voir `LICENSE` et `NOTICE.md`.
