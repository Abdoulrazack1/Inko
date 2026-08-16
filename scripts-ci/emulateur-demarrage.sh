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

# Une CSP qui bloque, un fichier manquant ou un schéma refusé se voient ICI
# avant de se voir à l'écran — et un écran blanc ne dit jamais pourquoi.
echo "── ce que le WebView a chargé ──"
adb logcat -d | grep -iE "Capacitor|chromium|WebView|Console" | tail -30 || true

echo "── erreurs de console de la page ──"
if adb logcat -d | grep -iE "console.*(error|refused|blocked|CSP)"; then
    echo "::warning::Le WebView a signalé des erreurs de console — voir ci-dessus."
fi

adb exec-out screencap -p > /tmp/demarrage.png
echo "✔ capture prise ($(stat -c%s /tmp/demarrage.png 2>/dev/null || echo '?') octets)"
