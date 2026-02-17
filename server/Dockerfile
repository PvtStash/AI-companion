FROM node:20-alpine
WORKDIR /app

# Copy dependency manifests from the server folder
COPY server/package.json server/package-lock.json ./
RUN npm ci

# Copy the server source
COPY server/ ./

# Prisma client + migrations at startup
RUN npx prisma generate

ENV NODE_ENV=production
EXPOSE 8080

CMD sh -c "npx prisma migrate deploy && node src/index.js"
