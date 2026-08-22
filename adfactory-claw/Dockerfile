# AdFactory claw — needs ffmpeg (frame extract/concat), Chromium (Remotion render +
# static-ad screenshot) and the template's node_modules baked so daily runs are fast.
FROM node:20-slim

# System deps: ffmpeg + a real chromium binary (for the static-ad screenshot) +
# the libs headless Chromium needs on Cloud Run.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg chromium ca-certificates fonts-liberation \
    libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 \
    libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 \
    libpangocairo-1.0-0 libpango-1.0-0 libcairo2 libatspi2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# claw deps
COPY package.json ./
RUN npm install --omit=dev

# template + its deps (install once at build so render doesn't npm-i daily)
COPY template ./template
RUN cd template/video && npm install --no-audit --no-fund \
    && npx remotion browser ensure

COPY skills ./skills
COPY src ./src

ENV PORT=8080 \
    WORKDIR=/tmp/adfactory \
    CHROMIUM_BIN="/usr/bin/chromium"
EXPOSE 8080
CMD ["node", "src/index.js"]
