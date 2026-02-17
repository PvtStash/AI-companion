FROM node:20-alpine
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN npx prisma generate

ENV NODE_ENV=production
EXPOSE 8080

# Run migrations at container start, then launch
CMD sh -c "npx prisma migrate deploy && node src/index.js"
