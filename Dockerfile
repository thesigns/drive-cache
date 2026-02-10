FROM node:20-alpine

WORKDIR /opt/drive-cache

# Install dependencies first (layer caching)
COPY package.json package-lock.json* ./
RUN npm install --production

# Copy source
COPY src/ ./src/
COPY .env* ./

# Cache data directory
RUN mkdir -p /opt/drive-cache/data /opt/drive-cache/credentials

EXPOSE 3100

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://localhost:3100/health || exit 1

CMD ["node", "src/index.js"]
