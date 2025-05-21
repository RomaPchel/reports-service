FROM node:20-slim

# Install dependencies for Chromium (same as before)
RUN apt-get update && apt-get install -y \
  wget \
  ca-certificates \
  fonts-liberation \
  libappindicator3-1 \
  libasound2 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libcups2 \
  libdbus-1-3 \
  libgdk-pixbuf2.0-0 \
  libnspr4 \
  libnss3 \
  libx11-xcb1 \
  libxcomposite1 \
  libxdamage1 \
  libxrandr2 \
  libxss1 \
  libxtst6 \
  xdg-utils \
  --no-install-recommends && \
  rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

RUN npm install -g pnpm

COPY ../app/package.json ../app/pnpm-lock.yaml ./

RUN pnpm install

RUN npx puppeteer browsers install chrome

COPY ../app/src ./src
COPY ../app/.swcrc ./
COPY ../app/tsconfig.json ./

RUN pnpm run build:all

COPY ../app .

CMD ["pnpm", "start"]
