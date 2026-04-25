# @codespar/mcp-sicoob

MCP server for [Sicoob](https://developers.sicoob.com.br) — Brazil's largest cooperative bank network.

Sicoob is consistently a top-4 PSP by Pix volume in Brazil. The Sistema de Cooperativas de Crédito do Brasil aggregates hundreds of regional cooperatives behind a single Developers Portal exposing Pix, Cobrança (boleto), and SPB APIs.

## Status: alpha (`0.1.0-alpha.1`)

Sicoob's Developers Portal is gated by cooperative onboarding. The endpoint paths in this server are best-guesses based on (a) BACEN Pix v2 standard paths, (b) Sicoob's public documentation snippets, and (c) conventions shared across Itaú / Bradesco / BB. Every unverified path is flagged `TODO(verify)` in the source.

Pin to exact versions during `0.1.x`; paths will be corrected to match the portal spec once an onboarded cooperative member can validate.

## Tools

| Tool | Purpose |
|---|---|
| `get_oauth_token` | Mint / inspect a cached OAuth2 bearer |
| `create_pix_cob` | Create an immediate Pix charge (cob) |
| `get_pix_cob` | Retrieve an immediate Pix charge by txid |
| `list_pix_cob` | List immediate Pix charges by date range |
| `create_pix_cobv` | Create a Pix charge with due date (cobv) |
| `get_pix_cobv` | Retrieve a due-date Pix charge |
| `lookup_dict_key` | Resolve a DICT key to account data |
| `register_dict_key` | Register a DICT key on a Sicoob account |
| `delete_dict_key` | Delete a DICT key |
| `create_boleto` | Issue a boleto via Sicoob Cobrança |
| `get_boleto` | Retrieve a boleto |
| `cancel_boleto` | Cancel (baixa) an outstanding boleto |
| `get_account_balance` | Query merchant account balance (SPB) |

## Install

```bash
npm install @codespar/mcp-sicoob@0.1.0-alpha.1
```

## Environment

```bash
SICOOB_CLIENT_ID="..."       # OAuth client_id from Sicoob's Developers Portal
SICOOB_CLIENT_SECRET="..."   # OAuth client_secret
SICOOB_CERT_PATH="/abs/path/to/client.crt"   # mTLS client certificate
SICOOB_KEY_PATH="/abs/path/to/client.key"    # mTLS private key
SICOOB_ENV="sandbox"                          # or "production" (default: sandbox)
```

## Authentication

Two factors are **both** required on every call:

1. **OAuth2 `client_credentials`** — the server calls the token endpoint, caches the bearer until ~60s before expiry, and attaches `Authorization: Bearer <token>` to downstream calls.
2. **mTLS** — BACEN mandates mutual TLS for Pix v2, and Sicoob enforces it across product families. The server loads the client certificate and private key from the paths you set, builds a Node `https.Agent`, and routes every request through it.

The cert + key bundle is issued by Sicoob's Developers Portal after cooperative onboarding and is distinct from the OAuth credentials.

## Run

```bash
# stdio (default)
npx @codespar/mcp-sicoob

# HTTP transport
MCP_HTTP=true MCP_PORT=3000 npx @codespar/mcp-sicoob
```

## Caveats

- **Paths are unverified.** See the `TODO(verify)` markers in `src/index.ts`. Onboarded cooperatives should validate against their portal-issued OpenAPI spec and open a PR.
- **Sandbox host is a guess.** Sicoob issues a sandbox subdomain per cooperative; override by editing `BASE_URL` if your provisioned sandbox URL differs.

## License

MIT
