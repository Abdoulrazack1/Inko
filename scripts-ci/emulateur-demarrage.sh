#!/usr/bin/env bash
# ============================================================
# emulateur-demarrage.sh — l'app s'ouvre-t-elle vraiment ?
# ------------------------------------------------------------
# Appelé par `.github/workflows/android-emulateur.yml`, une fois l'émulateur
# démarré et l'APK déjà construit.
#
# Pourquoi un fichier plutôt que des lignes dans le YAML : l'action
# `android-emulator-runner` exécute le `script` LIGNE PAR LIGNE, chacune dans
# son propre shell. Un `cd` ne survit pas à la ligne suivante — c'est ce qui a
# fait échouer la première tentative sur un « chmod: cannot access 'gradlew' »
# alors que le fichier était bien là.
#
# Ce script vérifie trois choses, dans l'ordre où elles cassent :
#   1. le processus tourne-t-il encore après le démarrage ?
#   2. logcat contient-il une exception fatale ?
#   3. qu'a chargé le WebView ? (et une capture, pour le voir)
set -euo pipefail

APK="android/app/build/outputs/apk/debug/app-debug.apk"
PAQUET="app.inko.mobile"

echo "── installation ──"
adb install -r "$APK"

# `logcat -c` échoue sur les émulateurs API 26 (« failed to clear the 'main'
# log ») sans que rien ne soit cassé pour autant. Avec `set -e`, il faisait
# tomber tout le contrôle juste après une installation RÉUSSIE — un échec qui
# ne parlait pas de l'app.
adb logcat -c || echo "(logcat non vidé — sans conséquence sur ce contrôle)"

echo "── démarrage ──"
adb shell am start -n "$PAQUET/.MainActivity"

# 12 s : le temps qu'un WebView charge 123 fichiers depuis les assets. En
# dessous, on constaterait « pas encore prêt » plutôt que « cassé ».
sleep 12

echo "── le processus tourne-t-il encore ? ──"
if ! adb shell pidof "$PAQUET" > /dev/null 2>&1; then
    echo "::error::L'application s'est arrêtée après le démarrage."
    adb logcat -d -t 200 | tail -80
    exit 1
fi
echo "✔ processus vivant"

echo "── exceptions fatales ? ──"
if adb logcat -d | grep -E "FATAL EXCEPTION|AndroidRuntime.*${PAQUET}"; then
    echo "::error::Exception fatale au démarrage."
    exit 1
fi
echo "✔ aucune exception fatale"

# ── Le WebView s'est-il seulement construit ? ───────────────
# Premier passage de ce contrôle : il annonçait « processus vivant, aucune
# exception fatale » pendant que logcat contenait une pile `WebViewFactory`
# sur `CapacitorWebView.<init>` — l'image système `default` d'API 26
# n'embarque PAS de WebView. L'app tournait donc sans rien pouvoir afficher,
# et le contrôle passait.
#
# Un processus vivant ne prouve pas qu'une app affiche quelque chose. C'est
# précisément le genre de vert qui a laissé sortir deux installeurs desktop
# vides.
echo "── le WebView s'est-il construit ? ──"
if adb logcat -d | grep -qE "WebViewFactory.*(Error|Exception)|Cannot load WebView|No WebView installed"; then
    echo "::error::Le WebView n'a pas pu être créé — l'application ne peut rien afficher."
    adb logcat -d | grep -iE "WebViewFactory|WebViewLibraryLoader" | head -20
    exit 1
fi
echo "✔ WebView construit"

# Une CSP qui bloque, un fichier manquant ou un schéma refusé se voient ICI
# avant de se voir à l'écran — et un écran blanc ne dit jamais pourquoi.
echo "── ce que le WebView a chargé ──"
adb logcat -d | grep -iE "Capacitor|chromium|Console" | tail -30 || true

# Le contenu embarqué a-t-il vraiment été servi ? Capacitor journalise l'URL
# chargée ; son absence signale un WebView qui n'a jamais atteint la page.
echo "── la page a-t-elle été chargée ? ──"
if adb logcat -d | grep -qiE "Loading app at|WebView loaded|Capacitor.*started"; then
    echo "✔ page chargée"
else
    echo "::error::Aucune trace de chargement de page : l'écran serait vide."
    adb logcat -d | grep -i capacitor | head -20
    exit 1
fi

# ── Les scripts se sont-ils exécutés ? ──────────────────────
# Premier passage avec un WebView réel : la page chargeait, et CHAQUE fichier
# JavaScript échouait sur « Uncaught SyntaxError: Unexpected token . » —
# l'opérateur `?.`, que le WebView d'Android 8 ne sait pas lire. L'app se
# serait ouverte sur un écran mort.
#
# Un avertissement n'aurait pas suffi : c'est une app inutilisable. Le contrôle
# ÉCHOUE donc, et le message dit quoi regarder.
echo "── erreurs de script dans la page ──"
if adb logcat -d | grep -E "Capacitor/Console.*(SyntaxError|Uncaught|ReferenceError|TypeError)"; then
    echo "::error::Des scripts de l'application ont échoué — l'écran serait mort."
    echo "         Une SyntaxError signale du JavaScript trop récent pour ce WebView :"
    echo "         vérifier la transpilation dans scripts-ci/build-mobile-www.js."
    exit 1
fi
echo "✔ aucun script en échec"

echo "── ressources refusées (CSP, fichier manquant) ? ──"
if adb logcat -d | grep -iE "Capacitor/Console.*(refused|blocked|Failed to load)"; then
    echo "::warning::Des ressources ont été refusées — voir ci-dessus."
fi

# ── Sans hub, l'app propose-t-elle une issue ? ──────────────
#
# Ce contrôle exigeait jusqu'ici l'écran de CONFIGURATION : sans hub, l'app
# devait réclamer une adresse de serveur. C'était le mur qu'on a retiré —
# installer une application et tomber sur « configure un serveur » avant
# d'avoir rien vu, c'est demander à l'utilisateur de mériter son accès.
#
# L'inquiétude derrière le contrôle, elle, reste juste : « l'app démarre » ne
# veut rien dire si l'utilisateur se retrouve devant des pages vides sans
# comprendre ni savoir quoi faire. Ce qui est exigé, c'est donc une ISSUE —
# l'écran de bienvenue qui explique et propose de connecter un ordinateur, ou
# l'écran de configuration si on le demande.
echo "── sans hub, une issue est-elle proposée ? ──"
if adb logcat -d | grep -q "inko-hub. accueil-autonome-affiche"; then
    echo "✔ écran de bienvenue affiché (mode autonome, connexion proposée)"
elif adb logcat -d | grep -q "inko-hub. ecran-configuration-affiche"; then
    echo "✔ écran de configuration affiché"
elif adb logcat -d | grep -q "inko-hub. etat=configure"; then
    echo "✔ hub déjà configuré sur cet appareil — aucun écran requis"
else
    echo "::error::Sans hub, l'app n'a proposé NI bienvenue NI configuration."
    echo "         L'utilisateur tomberait sur des pages vides, sans savoir quoi faire."
    adb logcat -d | grep -i "inko-hub" | head -10
    exit 1
fi

adb exec-out screencap -p > /tmp/demarrage.png
echo "✔ capture prise ($(stat -c%s /tmp/demarrage.png 2>/dev/null || echo '?') octets)"
