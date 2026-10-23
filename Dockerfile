FROM node:20-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY src ./src
COPY scripts/container-start.js ./scripts/container-start.js
COPY scripts/create-admin.js ./scripts/create-admin.js

# Run the application with the unprivileged user provided by the official Node image.
USER node

EXPOSE 3000
CMD ["node", "src/server.js"]
