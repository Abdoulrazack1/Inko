# ============================================================
# Inko — image de production (multi-stage, node:20-alpine)
# ============================================================
# Le contexte de build est la RACINE du dépôt : on a besoin du
# backend (server/) ET du frontend statique (*.html, assets/…).

# ── Stage 1 : dépendances backend (cache des node_modules) ──
FROM node:20-alpine AS deps
WORKDIR /app/server
COPY server/package.json server/package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev

# ── Stage 2 : image finale ──
FROM node:20-alpine
# curl est REQUIS : extensions (NovelFull, NovelBin…) et proxy d'images
# l'utilisent pour contourner les empreintes TLS anti-bot (Cloudflare).
RUN apk add --no-cache curl
ENV NODE_ENV=production \
    PORT=8080 \
    FRONTEND_DIR=/app/frontend
WORKDIR /app/server

# Dépendances déjà installées
COPY --from=deps /app/server/node_modules ./node_modules
# Code backend
COPY server/ ./
# Frontend statique (servi par Express en prod via FRONTEND_DIR)
COPY accueil.html bibliotheque.html catalogue.html chapitre.html lecture.html \
     recherche.html serie.html stats.html profil.html parametres.html \
     sources.html player.html collections.html collection-detail.html \
     page_login.html page_signup.html page_mdpoublie.html page_nouveaumdp.html \
     anilist.html secret.html manifest.webmanifest service-worker.js \
     /app/frontend/
COPY assets/ /app/frontend/assets/

EXPOSE 8080
# Crée le schéma de base au 1er démarrage (idempotent), puis lance le serveur.
CMD ["sh", "-c", "node db/init.js || true; node server.js"]
