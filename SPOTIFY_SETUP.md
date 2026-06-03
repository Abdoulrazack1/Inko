# Lier ton compte Spotify à Inko

Inko utilise l'**OAuth officiel de Spotify** pour lier ton compte (comme Mihon, Discord, etc.).
Cela demande une **app développeur Spotify** (gratuite, 2 minutes). Une seule fois.

## 1. Créer l'app Spotify

1. Va sur **https://developer.spotify.com/dashboard** et connecte-toi.
2. Clique **Create app**.
   - **App name** : `Inko` (peu importe)
   - **Redirect URI** : colle exactement
     ```
     http://127.0.0.1:8088/api/spotify/callback
     ```
   - Coche **Web API**.
3. Crée l'app, puis ouvre **Settings**. Note le **Client ID** et clique **View client secret**.

## 2. Autoriser ton compte (mode développement)

Tant que l'app n'est pas étendue par Spotify, elle est en **Development mode** :
seuls les comptes que tu ajoutes peuvent se lier.

- Dans l'app → **User Management** → ajoute **ton nom + l'email de ton compte Spotify**.
- (Sans ça, la connexion renverra une erreur « user not registered ».)

## 3. Renseigner les clés dans Inko

### App desktop (recommandé)
- Menu **Aide → Configurer Spotify (clés API)…**
- Le fichier `inko-config.json` s'ouvre. Remplis :
  ```json
  {
    "spotify": {
      "clientId": "TON_CLIENT_ID",
      "clientSecret": "TON_CLIENT_SECRET"
    }
  }
  ```
- Enregistre, **redémarre Inko**.

### Version locale / navigateur
- Édite `server/.env` :
  ```
  SPOTIFY_CLIENT_ID=TON_CLIENT_ID
  SPOTIFY_CLIENT_SECRET=TON_CLIENT_SECRET
  SPOTIFY_REDIRECT_URI=http://127.0.0.1:8088/api/spotify/callback
  ```
- Relance le serveur.

## 4. Lier le compte

- **Paramètres → Musique → Connecter Spotify**, ou le bouton **🎵** (lecteur) → onglet **Spotify**.
- Une fenêtre Spotify s'ouvre → **Agree**. Elle se ferme, et ton profil + tes playlists apparaissent.
- Clique une playlist pour l'écouter pendant ta lecture (le lecteur reste ouvert en naviguant).

## Notes
- Accède à Inko via **http://127.0.0.1:8088** (pas `localhost`) pour que la redirection corresponde.
- L'écoute via embed marche avec un compte **gratuit**. Le contrôle direct (lecture/pause par l'API)
  nécessite **Spotify Premium** (limite de Spotify, pas d'Inko).
- Les clés restent **chez toi** (jamais commitées : `.env` et `inko-config.json` sont privés).
