FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
RUN npm install

# Copy source code
COPY . .

# Build Next.js application
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# Copy build files from builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# If standalone output is not enabled in next.config.ts, we need to copy node_modules and .next entirely:
# But typically we just copy the whole app if standalone isn't configured, so let's do a simpler approach just in case standalone is not enabled:
# Actually, the safest approach without modifying next.config.ts is to run standard start:

# COPY --from=builder /app ./
# RUN npm install --production

# Wait, the simplest robust way for Next.js 14/15/16 without standalone mode:
# Let's just use a simpler single-stage or standard copy for now to guarantee it works.

# Overwrite runner completely for guaranteed working Next.js
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npm run build

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["npm", "start"]
