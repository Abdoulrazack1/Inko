**Inko sur Android.** Le hub reste sur l'ordinateur ; le téléphone s'y connecte, ou lit hors ligne ce qu'il a téléchargé.

## Installer

1. Télécharge `Inko-1.0.0.apk` ci-dessous.
2. Android demandera d'autoriser l'installation depuis cette source — c'est normal, l'app n'est pas sur le Play Store.
3. Au premier lancement, l'app cherche le hub **toute seule sur le réseau local** (mDNS). Sinon, scanne le QR code affiché par l'app de bureau : Paramètres → Connecter un appareil.

Vérifie le téléchargement avec `SHA256SUMS-android.txt` si tu veux être sûr du fichier.

## Ce qu'elle sait faire

**Lire.** Page par page ou en défilement, sens japonais ou occidental, double page en paysage, découpe des planches doubles, rognage des marges, zoom, luminosité et température de l'écran, défilement automatique.

**Sans réseau.** Les chapitres téléchargés se lisent dans le train, avec la position de lecture qui remonte au retour de la connexion. Ce qui a été fait hors ligne — marquer lu, avancer — est mis en file et rejoué.

**Pensée pour le pouce.** Appui long sur une carte pour le menu, balayage pour marquer lu ou télécharger (annulable 5 secondes), tirer pour actualiser, mode une main, **touches de volume** pour tourner les pages sans regarder l'écran, appui long sur l'icône pour aller droit à la bibliothèque, et partage depuis n'importe quelle app vers la recherche.

**Télécommande.** Menu « Plus » → Télécommande : le téléphone tourne les pages de l'écran du salon.

**Widget.** La lecture en cours sur l'écran d'accueil, à un appui — souvent, ça dispense d'ouvrir l'app.

**Notifications sans compte Google.** L'app demande au hub s'il y a du neuf, toutes les quinze minutes au plus. Aucun service tiers.

## Ce qu'elle ne fait pas, volontairement

Le téléphone **ne va jamais chercher sur les sources lui-même** : c'est le hub qui scrape, et lui seul. Ça garde une seule implémentation à maintenir, une seule adresse IP visible des sites, et un téléphone qui ne chauffe pas.

Pas d'admin, pas de compte à créer, aucune donnée qui sort du réseau.

## Compatibilité

Android 8.0 (API 26) et au-delà. Le WebView d'Android 8 ignore en silence plusieurs propriétés CSS modernes — l'app embarque des replis explicites pour chacune, et la construction le vérifie.

---

*L'application de bureau suit sa propre ligne de versions : voir les releases `v*`.*
