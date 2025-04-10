FROM node:20

WORKDIR /usr/src/app

RUN npm install -g pnpm

COPY ../app/package.json ../app/pnpm-lock.yaml ./

COPY ../app/src/ ./src/
COPY ../app/.swcrc ./
COPY ../app/tsconfig.json ./

RUN pnpm install
RUN pnpm run build:all

COPY app .

CMD ["pnpm", "start"]
