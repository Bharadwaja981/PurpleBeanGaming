# Production Container for Purple Bean Gaming Authoritative API
# Service: purplebeangaming-api
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .
RUN npm run build

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

COPY package*.json ./
RUN npm install --omit=dev --legacy-peer-deps

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src ./src
COPY --from=builder /app/server.ts ./
COPY --from=builder /app/index.html ./
COPY --from=builder /app/tsconfig.json ./

EXPOSE 8080

CMD ["npx", "tsx", "server.ts"]
