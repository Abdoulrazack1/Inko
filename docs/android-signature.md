# Signer l'APK Android

> **La clé de signature est irremplaçable.** Android identifie une application
> par sa signature : une nouvelle clé fait une **nouvelle application**. Si tu
> perds ce keystore, aucune installation existante ne pourra plus être mise à
> jour — les utilisateurs devront désinstaller et réinstaller, en perdant leurs
> réglages locaux. Sauvegarde-le hors du dépôt **et** hors de GitHub.

## 1. Créer le keystore

Une seule fois, sur ta machine. `keytool` est fourni avec le JDK.

```bash
keytool -genkeypair -v -keystore inko.keystore -alias inko -keyalg RSA -keysize 4096 -validity 10000
```

- **`-validity 10000`** — environ 27 ans. Une clé qui expire pendant la vie de
  l'application bloque les mises à jour ; Google recommande une validité qui
  dépasse largement la durée prévue du projet.
- **`-keysize 4096`** — 2048 suffirait, mais cette clé vivra des années.
- Le mot de passe demandé deux fois (`storePassword` puis `keyPassword`) peut
  être le même ; retiens lequel est lequel, les deux sont demandés plus bas.

Vérifie ce que tu viens de créer :

```bash
keytool -list -v -keystore inko.keystore -alias inko
```

## 2. Le mettre dans les secrets GitHub

Le keystore est un fichier binaire : GitHub ne stocke que du texte, donc on
l'encode en base64.

```bash
base64 -w 0 inko.keystore > inko.keystore.b64
```

Dans **Settings → Secrets and variables → Actions**, crée quatre secrets :

| Secret | Contenu |
|---|---|
| `INKO_KEYSTORE_B64` | le contenu de `inko.keystore.b64` |
| `INKO_KEYSTORE_PASSWORD` | le mot de passe du keystore |
| `INKO_KEY_ALIAS` | `inko` |
| `INKO_KEY_PASSWORD` | le mot de passe de la clé |

Puis **supprime `inko.keystore.b64`** de ta machine — le fichier `.keystore`
d'origine, lui, doit être sauvegardé ailleurs (gestionnaire de mots de passe,
disque chiffré hors ligne).

## 3. Publier

```bash
npm version patch          # ou minor / major
git push --follow-tags
```

Le tag `v*` déclenche `.github/workflows/android-release.yml`, qui :

1. vérifie que `package.json` et le tag portent la même version ;
2. construit le contenu embarqué et l'APK de publication ;
3. **ouvre l'APK produit** et vérifie son contenu — c'est la leçon des deux
   installeurs Windows partis sans aucune source : le contrôle regardait la
   préparation, pas le résultat ;
4. vérifie que l'APK est **signé** — un APK non signé ne s'installe pas ;
5. calcule `SHA256SUMS-android.txt` ;
6. rattache les deux fichiers à la release.

## Sans keystore

Le workflow fonctionne quand même : il avertit, construit un APK **non signé**,
et le publie en pièce jointe du run. C'est utile pour éprouver la chaîne sur un
dépôt fraîchement cloné, mais cet APK **ne s'installe pas** sur un téléphone.

Pour simplement essayer l'application, prends plutôt l'APK de **debug** produit
par `android.yml` à chaque changement : il est signé avec la clé de debug
d'Android et s'installe très bien.

## Le numéro de version

`versionCode` est **dérivé de `package.json`** par `android/app/build.gradle` :

```
2.5.7  →  20507       (majeure × 10000 + mineure × 100 + correctif)
```

Android refuse d'installer une mise à jour dont le `versionCode` est inférieur
ou égal au précédent. Le dériver évite d'avoir deux numéros tenus à la main qui
finissent par diverger — c'est une question de temps, pas de discipline.
