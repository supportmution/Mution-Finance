FROM node:22-bookworm-slim

# Install pnpm
RUN npm install -g pnpm@9.15.9

WORKDIR /app

# Copy all files
COPY . .

# Install dependencies (all workspace packages included)
RUN pnpm install --no-frozen-lockfile

# Build mution-finance and api-server
RUN pnpm run build

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["pnpm", "run", "start"]
