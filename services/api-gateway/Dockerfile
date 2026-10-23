# ---- api-gateway ----
FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

# 1) Install deps first: this layer is cached until package*.json changes.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# 2) Copy the source code.
COPY src ./src

# 3) Never run as root inside the container.
USER node

EXPOSE 8080
CMD ["node", "src/index.js"]
