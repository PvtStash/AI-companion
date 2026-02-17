FROM node:20-alpine
WORKDIR /app

# Install ALL deps (including devDeps) so prisma exists during build
COPY package.json package-lock.json ./
RUN npm ci

# Copy source
COPY . .

# Generate Prisma client (needs prisma installed)
RUN npx prisma generate

# Optional: prune dev deps for smaller runtime image
RUN npm prune --omit=dev

ENV NODE_ENV=production
EXPOSE 8080

CMD ["node", "src/index.js"]
