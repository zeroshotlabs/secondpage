# Multi-stage build for SecondPage.ai

# Stage 1: Build the application
FROM node:22-alpine AS builder

# Install pnpm
RUN npm install -g pnpm@10.4.1

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build-time env vars for Vite HTML substitution
ARG VITE_APP_ID=secondpage-ai
ARG VITE_APP_TITLE=secondpage.ai - enhanced search
ARG VITE_APP_LOGO=

# Copy source code
COPY . .

# Build the application (vite client + esbuild server -> dist/)
ENV VITE_APP_ID=$VITE_APP_ID
ENV VITE_APP_TITLE=$VITE_APP_TITLE
ENV VITE_APP_LOGO=$VITE_APP_LOGO
RUN pnpm run build

# Stage 2: Production image
FROM node:22-alpine

# Install pnpm
RUN npm install -g pnpm@10.4.1

# Set working directory
WORKDIR /app

# Copy package files and patches
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches/

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

# Copy built output and required source files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/shared ./shared

# Expose port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Health check (using wget which is available in alpine)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3000/api/health || exit 1

# Start the application
CMD ["pnpm", "start"]
