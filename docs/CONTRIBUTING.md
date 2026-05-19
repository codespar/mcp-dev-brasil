# Contributing to MCP Brasil

Thanks for your interest in contributing! This guide helps you get started.

## Adding a New MCP Server

### 1. Create the directory structure

```bash
mkdir -p packages/<category>/<service>/src
```

Categories: `payments`, `fiscal`, `communication`, `banking`, `ecommerce`, `identity`

### 2. Create `package.json`

```json
{
  "name": "@codespar/mcp-<service>",
  "version": "0.1.0",
  "description": "MCP server for <Service Name>",
  "type": "module",
  "main": "./dist/index.js",
  "bin": { "mcp-<service>": "./dist/index.js" },
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0"
  },
  "devDependencies": {
    "typescript": "^5.8.0"
  },
  "license": "MIT"
}
```

### 3. Implement `src/index.ts`

Follow the pattern of existing servers (e.g., `packages/payments/asaas/src/index.ts`):

- Use `@modelcontextprotocol/sdk` for the MCP server
- Implement 8-10 tools covering the main API operations
- Use environment variables for API keys (never hardcode)
- Support sandbox mode via env var
- Handle errors gracefully
- Return JSON responses

### 4. Add `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "declaration": true
  },
  "include": ["src"]
}
```

### 5. Test locally

```bash
cd packages/<category>/<service>
npm install
npm run build
ASAAS_API_KEY=test node dist/index.js
```

### 6. Submit a PR

- Branch: `feat/<service>-mcp`
- Include a README.md in the server directory with usage examples
- Update the root README.md table

## Code Guidelines

- TypeScript strict mode
- Use `fetch` (Node.js built-in) — no external HTTP libraries
- Environment variables for all secrets
- Sandbox support for APIs that offer it
- Error messages should be clear and actionable
- JSON responses should be pretty-printed (`JSON.stringify(data, null, 2)`)

## Requesting a Server

If you want an MCP server for a Brazilian service that doesn't exist yet:

1. Open an [issue](https://github.com/codespar/mcp-brasil/issues)
2. Use the "server request" label
3. Include: service name, API docs URL, and main use cases

## License

All contributions are licensed under MIT.

## Contract tests (real provider sandbox)

Unit tests mock the network. Contract tests hit a provider's **sandbox** to
prove the integration really works. They live next to unit tests as
`src/__tests__/contract.test.ts` and are **skipped unless** the required
credential env var is set, so `npm test` stays green without credentials.

Run the Mercado Pago contract test locally:

1. Create a Mercado Pago app and copy its **test** Access Token
   (prefix `TEST-`) from the developer panel.
2. Create `.env` at the repo root (gitignored):
   ```
   MP_TEST_ACCESS_TOKEN=TEST-...
   ```
3. Run:
   ```bash
   npx vitest run packages/payments/mercado-pago/src/__tests__/contract.test.ts
   ```

Never commit `.env` or any token. Use only sandbox `TEST-` tokens.
