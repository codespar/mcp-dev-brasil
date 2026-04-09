FROM node:22-slim

WORKDIR /app

# Copy workspace root
COPY package.json package-lock.json ./

# Copy the target server + shared
COPY packages/identity/brasil-api/ packages/identity/brasil-api/
COPY packages/shared/ packages/shared/

# Install all workspace deps
RUN npm install --workspace=packages/identity/brasil-api --workspace=packages/shared

# Build
RUN npm run build --workspace=packages/identity/brasil-api

ENV MCP_HTTP=true
ENV MCP_PORT=3000

EXPOSE 3000

CMD ["node", "packages/identity/brasil-api/dist/index.js", "--http"]
