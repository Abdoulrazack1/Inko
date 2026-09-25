**Inko sur Android.** Une vraie application, **autonome** : elle cherche sur les sources, garde ta bibliothèque et ta progression **sur le téléphone**, et fonctionne sans ordinateur. Appairée à ton PC, elle se **synchronise avec lui dès qu'il est joignable** — comme Spotify entre tes appareils.

## 1.4.1 — correctif Android 8

Sur les téléphones dont le WebView n'a pas été mis à jour (Android 8 d'origine), l'accueil plantait à l'ouverture : une fonction JavaScript récente (`Promise.allSettled`) y manque. L'app embarque désormais les fonctions absentes de ces anciens moteurs. **Mets à jour depuis la 1.4.0.**

## 1.4.0 — autonome, et synchronisée avec ton PC

**Le téléphone ne dépend plus du PC.** Avant, appairer un ordinateur faisait de l'app un simple client : PC éteint, il ne restait que les chapitres téléchargés. Désormais l'app lit et écrit toujours chez elle, et interroge elle-même les 9 sources (chaque extension est vérifiée par empreinte avant d'être exécutée).

**Synchronisation comme Spotify.** Chaque modification faite sur le téléphone — favori, progression, chapitre lu, note, statut, liste — part vers le PC dès qu'il répond, puis le téléphone reprend ce qui a été lu sur le PC. Hors de la maison, tout est gardé et envoyé au retour. Si tu as lu plus loin sur le PC, la progression la plus récente l'emporte.

**Ce qui a été lu avant l'appairage n'est pas perdu** : la première synchronisation envoie tout l'historique du téléphone.

**Une interface d'application.** Barre d'écran avec titre et retour, navigation par onglets en bas, plus de pied de page de site, en-tête allégé, écran « Ton PC » dans les réglages (état de la synchro, modifications en attente, « Synchroniser maintenant »).

**Corrigé :** les coches « lu » ne s'affichaient pas en mode autonome.

⚠ **Si une version antérieure est installée et que l'installation échoue, désinstalle-la d'abord.** Android refuse une mise à jour dont le numéro interne est inférieur.

## Installer

1. Télécharge l'APK `Inko-1.4.1.apk` ci-dessous.
2. Android demandera d'autoriser l'installation depuis cette source — c'est normal, l'app n'est pas sur le Play Store.
3. Pour la synchroniser avec ton PC : sur le PC, Paramètres → Appareils → Afficher le code ; sur le téléphone, Paramètres → Ton PC → Scanner le code. L'app retrouve aussi le PC toute seule sur le réseau local (mDNS).

Vérifie le téléchargement avec `SHA256SUMS-android.txt` si tu veux être sûr du fichier.

## Ce qu'elle sait faire

**Lire.** Page par page ou en défilement, sens japonais ou occidental, double page en paysage, découpe des planches doubles, rognage des marges, zoom, luminosité et température de l'écran, défilement automatique.

**Sans réseau.** Les chapitres téléchargés se lisent dans le train ; tout ce que tu fais hors ligne est gardé et synchronisé au retour.

**Pensée pour le pouce.** Appui long sur une carte pour le menu, balayage pour marquer lu ou télécharger (annulable 5 secondes), tirer pour actualiser, mode une main, **touches de volume** pour tourner les pages, appui long sur l'icône pour aller droit à la bibliothèque, et partage depuis n'importe quelle app vers la recherche.

**Télécommande.** Menu « Plus » → Télécommande : le téléphone tourne les pages de l'écran du salon.

**Widget.** La lecture en cours sur l'écran d'accueil, à un appui.

## Compatibilité

Android 8.0 (API 26) et au-delà. Le WebView d'Android 8 ignore en silence plusieurs propriétés CSS modernes — l'app embarque des replis explicites pour chacune, et la construction le vérifie.

---

*L'application de bureau suit sa propre ligne de versions : voir les releases `v*`.*
