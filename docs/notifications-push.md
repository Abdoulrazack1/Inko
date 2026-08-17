# Notifications de nouveaux chapitres (P2.5)

L'application est prête à recevoir des notifications. Il manque **deux fichiers
de clés**, qui vous appartiennent et que je ne peux pas créer à votre place :
ils sont liés à votre compte Google.

Tant qu'ils sont absents, **rien ne casse**. Le hub le dit une fois au
démarrage, les notifications ne partent pas, et le reste d'Inko fonctionne
normalement — la vérification manuelle des nouveaux chapitres depuis la
bibliothèque continue de marcher comme avant.

---

## Ce qu'il faut créer

### 1. Le projet Firebase (gratuit)

1. [console.firebase.google.com](https://console.firebase.google.com) → **Ajouter un projet**.
   Le nom n'a pas d'importance ; Google Analytics est inutile ici.
2. Dans le projet : **Ajouter une application** → **Android**.
3. Nom du package : **`app.inko.mobile`**. Il doit correspondre exactement —
   c'est lui qui lie le paquet Android au projet Firebase.
4. Téléchargez le `google-services.json` proposé.

### 2. Poser le fichier côté application

```
android/app/google-services.json
```

Le `build.gradle` le détecte tout seul : présent, il active le greffon Google ;
absent, il l'ignore et le journal de compilation le note. Rien à modifier.

> Ce fichier n'est pas un secret au sens strict — il est embarqué dans chaque
> APK publié — mais il identifie **votre** projet. Il est ignoré par git dans ce
> dépôt : c'est volontaire, pour que le projet reste celui de qui construit.

### 3. La clé du serveur

C'est celle qui autorise le hub à ENVOYER. Elle, en revanche, est un secret.

1. Firebase → ⚙ **Paramètres du projet** → **Comptes de service**
   → **Générer une nouvelle clé privée**. Un fichier JSON est téléchargé.
2. Rangez-le **hors du dépôt**, par exemple `C:\Users\<vous>\inko-fcm.json`.
3. Dans `server/.env` :

```
FCM_SERVICE_ACCOUNT=C:\Users\<vous>\inko-fcm.json
```

Redémarrez le hub. Le message « notifications désactivées » disparaît.

---

## Vérifier que ça marche

1. Sur le téléphone : **Paramètres → Notifications → Activer**.
   Android demande l'autorisation ; elle n'est demandée **qu'à ce moment**, et
   c'est délibéré — une demande au premier lancement se refuse d'un réflexe, et
   Android ne la repose jamais : la fonction serait perdue pour de bon.
2. Le jeton part vers le hub (`POST /api/devices/push-token`) et se range dans
   `device_push_tokens`, rattaché à **l'appareil** et non au compte.
3. Vérification en base :

```sql
SELECT d.nom, t.plateforme, t.created_at
FROM device_push_tokens t JOIN devices d ON d.id = t.device_id;
```

---

## Ce qui a été construit, et pourquoi ainsi

**Le jeton appartient à l'appareil.** Révoquer un téléphone perdu depuis le PC
efface son jeton par cascade. Sans ce lien, l'appareil retiré continuerait de
recevoir les nouveaux chapitres de la bibliothèque de son ancien propriétaire —
ce n'est pas un défaut de confort.

**Le jeton est unique en base.** Google le réattribue à un autre appareil après
une réinstallation ; deux lignes pour un même jeton enverraient chaque
notification en double, et la ligne périmée pointerait vers le mauvais compte.
L'enregistrement reprend donc la ligne existante au lieu d'en ajouter une.

**Un jeton mort est supprimé.** Quand Google répond `UNREGISTERED`,
l'application a été désinstallée. Sans nettoyage, la table grossit de jetons
morts — un par réinstallation — et chaque envoi part vers des adresses qui
n'existent plus.

**Pas de `firebase-admin`.** Le paquet officiel tire une cinquantaine de
dépendances pour, ici, une signature RS256 et deux appels HTTPS. Sur un hub
qu'on installe chez soi, chaque dépendance est une mise à jour de sécurité de
plus à suivre.

**Priorité `normal`, canal `chapitres`.** Un nouveau chapitre n'est pas une
urgence : la priorité haute réveille l'appareil et se paie en batterie. Le canal
dédié permet à l'utilisateur de régler ces notifications séparément dans les
paramètres d'Android, plutôt que de couper Inko en entier.
