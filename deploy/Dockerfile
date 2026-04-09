FROM node:22-slim

WORKDIR /app

# Copy workspace root
COPY package.json package-lock.json ./

# Copy the target server (exclude tests)
COPY packages/identity/brasil-api/package.json packages/identity/brasil-api/
COPY packages/identity/brasil-api/tsconfig.json packages/identity/brasil-api/
COPY packages/identity/brasil-api/src/index.ts packages/identity/brasil-api/src/

# Install deps + express types
RUN npm install --workspace=packages/identity/brasil-api && \
    npm install -D @types/express --workspace=packages/identity/brasil-api

# Build (no test files = no vitest dependency needed)
RUN npm run build --workspace=packages/identity/brasil-api

ENV MCP_HTTP=true
ENV MCP_PORT=3000

EXPOSE 3000

CMD ["node", "packages/identity/brasil-api/dist/index.js", "--http"]
