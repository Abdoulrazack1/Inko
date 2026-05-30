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

### ⚠ Windows : activer Developer Mode

Sur Windows, `npm run dist` échoue avec « Cannot create symbolic link »
si Developer Mode n'est pas activé. Le cache `winCodeSign` d'electron-builder
contient des symlinks Mac que 7za ne peut pas extraire sans privilège.

**Activer Developer Mode** (Win 10/11) :

1. `Settings → System → For developers` (ou `Paramètres → Système → Pour les développeurs`)
2. Activer **Developer Mode**
3. Relancer `npm run dist`

Alternatives :
- Lancer un terminal **en tant qu'administrateur** puis `npm run dist`
- Builder depuis un Mac ou Linux (sans souci de symlinks)
- Pour un package minimal sans installeur : `npm run pack` (produit
  juste le dossier `dist/win-unpacked/` avec `Inko.exe`)

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
