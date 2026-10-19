#!/usr/bin/env bash
# Pipeline complet : image (Playwright, motion blur x4) + son (numpy) -> Inko-LinkedIn.mp4
set -e; cd "$(dirname "$0")"
node render.mjs video 4
python audio.py
ffmpeg -y -loglevel error -i _video.mp4 -i _audio.wav -c:v copy -af loudnorm=I=-14:TP=-1.5:LRA=7 -c:a aac -b:a 256k -ar 48000 -shortest -movflags +faststart Inko-LinkedIn.mp4
node render.mjs stills 19.5 . && mv t19.50.jpg Inko-LinkedIn-miniature.jpg
