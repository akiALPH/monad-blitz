FROM node:22-alpine AS builder

WORKDIR /app

# Copy everything
COPY . .

# Install and build frontend
WORKDIR /app/frontend
RUN npm ci && npm run build

# Install backend deps
WORKDIR /app/backend
RUN npm ci

# Runtime stage
FROM node:22-alpine

WORKDIR /app

# Copy built artifacts
COPY --from=builder /app/backend /app/backend
COPY --from=builder /app/frontend/dist /app/frontend/dist
COPY --from=builder /app/deployed.json /app/
COPY --from=builder /app/staking-deployed.json /app/

# .env must be mounted or passed at runtime
ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

WORKDIR /app/backend
CMD ["node", "server.cjs"]
