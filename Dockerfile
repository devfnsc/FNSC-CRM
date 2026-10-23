FROM node:20-alpine

ENV NODE_ENV=development
WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY src ./src
COPY scripts/container-start.js ./scripts/container-start.js

EXPOSE 3000
CMD ["node", "scripts/container-start.js"]
