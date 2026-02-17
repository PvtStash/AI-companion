FROM node:20-bookworm-slim
WORKDIR /app

# Needed for Prisma + TLS
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# Copy dependency manifests
COPY server/package.json server/package-lock.json ./
RUN npm ci

# Copy the server source
COPY server/ ./

# Prisma client
RUN npx prisma generate

ENV NODE_ENV=production
EXPOSE 8080

# Run migrations at startup, then launch
CMD sh -c "npx prisma migrate deploy && node src/index.js"
