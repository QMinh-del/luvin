FROM node:24-bookworm-slim

ENV NODE_ENV=production

WORKDIR /app

COPY package.json ./
COPY package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts=false

COPY app.mjs ./

EXPOSE 8089
CMD ["node", "app.mjs"]
