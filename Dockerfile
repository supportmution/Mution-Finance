FROM node:22-bookworm-slim

# Install git and essential tools
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

# Install pnpm
RUN npm install -g pnpm@9.15.9

WORKDIR /app

# Copy all files
COPY . .

# Railway build arguments for Vite frontend
ARG VITE_SUPABASE_URL="https://yuxjfdkqajkdtlhsxorc.supabase.co"
ARG VITE_SUPABASE_ANON_KEY="sb_publishable_L8aeCLVv9v5XxkMwoVNGRA_fz4iU1aJ"
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

# Install dependencies (all workspace packages included)
RUN pnpm install --no-frozen-lockfile

# Build mution-finance and api-server
RUN pnpm run build

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["pnpm", "run", "start"]
