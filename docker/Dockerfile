FROM node:18-alpine

WORKDIR /usr/src/app

COPY ../app .

RUN npm install -g pnpm
RUN pnpm install
RUN pnpm build
COPY .. .

CMD ["pnpm", "start"]