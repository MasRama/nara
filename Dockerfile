# ==============================================================================
# Stage 1: Install ALL dependencies (dev + prod) for building
# ==============================================================================
FROM node:20-slim AS deps

WORKDIR /app

# Build tools required by native modules (better-sqlite3, sharp)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy package manifests first for better layer caching
COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies needed for build)
RUN npm ci

# Copy application source
COPY . .

# ==============================================================================
# Stage 2: Build the application (TypeScript compile + Vite bundle)
# ==============================================================================
FROM deps AS build

RUN npm run build

# ==============================================================================
# Stage 3: Production image — minimal, secure, production-only
# ==============================================================================
FROM node:20-slim AS production

WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Create non-root user and group
RUN groupadd --gid 1001 nara \
    && useradd --uid 1001 --gid 1001 --no-create-home --shell /bin/false nara

# Copy package manifests and install production-only dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy built artifacts from build stage
COPY --from=build /app/build ./build
COPY --from=build /app/dist ./dist
COPY --from=build /app/public ./public

# Copy resources needed at runtime (views, migrations, etc.)
COPY --from=build /app/resources ./resources
COPY --from=build /app/migrations ./migrations
COPY --from=build /app/seeds ./seeds
COPY --from=build /app/knexfile.ts ./knexfile.ts
COPY --from=build /app/commands ./commands

# Create directories the app may write to, with correct ownership
RUN mkdir -p logs storage database \
    && chown -R nara:nara /app

# Expose the production port only
EXPOSE 5555

# Run as non-root user
USER nara

# Health check: lightweight probe for container orchestrators
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "fetch('http://localhost:5555/health').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))" || exit 1

# Start the production server
CMD ["node", "build/server.js"]
