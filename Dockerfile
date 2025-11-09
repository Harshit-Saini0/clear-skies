FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install ALL dependencies (including dev deps for build)
RUN npm ci

# Copy source files
COPY tsconfig.json ./
COPY src ./src

# Build the TypeScript project
RUN npm run build

# Remove dev dependencies after build
RUN npm prune --production

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "dist/http-server.js"]