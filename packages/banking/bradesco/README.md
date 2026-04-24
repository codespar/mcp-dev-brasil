# @codespar/mcp-bradesco

MCP server for [Bradesco](https://developers.bradesco.com.br) — Brazil's 2nd largest private bank (after Itaú).

Together with [`@codespar/mcp-itau`](../itau), [`@codespar/mcp-banco-inter`](../../payments/banco-inter), and [`@codespar/mcp-stark-bank`](../stark-bank), this covers the major BR private-bank API landscape. Merchants with meaningful Pix, boleto, and cash-management volume integrate directly with Bradesco instead of going through a PSP.

## Status: alpha (`0.1.0-alpha.1`)

Bradesco's Developer Portal is **contract-gated** — the full OpenAPI specs for Pix, Cobrança, Arrecadação, and Extrato are only visible to onboarded merchants. The endpoint paths in this server are best-guesses based on (a) BACEN Pix v2 standard paths, (b) Bradesco's public integration guides, and (c) conventions shared across Itaú / Santander / BB. Every unverified path is flagged `TODO(verify)` in the source.

Pin to exact versions during `0.1.x`; paths will be corrected to match the portal spec once an onboarded merchant can validate.

## Tools

| Tool | Purpose |
|---|---|
| `get_oauth_token` | Mint / inspect a cached OAuth2 bearer |
| `send_pix` | Initiate an outbound Pix payment |
| `create_pix_qr` | Create a dynamic Pix charge with QR (cob) |
| `get_pix` | Retrieve a Pix by `endToEndId` |
| `resolve_dict_key` | Resolve a DICT key (CPF/CNPJ/email/phone/EVP) to an account |
| `refund_pix` | Refund (devolução) a received Pix |
| `create_boleto` | Issue a boleto via Bradesco Cobrança |
| `get_boleto` | Retrieve a boleto |
| `cancel_boleto` | Cancel (baixa) an outstanding boleto |
| `get_statement` | Account statement transactions |
| `arrecadacao_pay` | Pay utility / tax / concessionária bills |

## Install

```bash
npm install @codespar/mcp-bradesco@0.1.0-alpha.1
```

## Environment

```bash
BRADESCO_CLIENT_ID="..."       # OAuth client_id from Bradesco's Developer Portal
BRADESCO_CLIENT_SECRET="..."   # OAuth client_secret
BRADESCO_CERT_PATH="/abs/path/to/client.crt"   # mTLS client certificate
BRADESCO_KEY_PATH="/abs/path/to/client.key"    # mTLS private key
BRADESCO_ENV="sandbox"                          # or "production" (default: sandbox)
```

## Authentication

Two factors are **both** required on every call:

1. **OAuth2 `client_credentials`** — the server calls the token endpoint, caches the bearer until ~60s before expiry, and attaches `Authorization: Bearer <token>` to downstream calls.
2. **mTLS** — BACEN mandates mutual TLS for Pix v2, and Bradesco enforces it across product families. The server loads the client certificate and private key from the paths you set, builds a Node `https.Agent`, and routes every request through it.

You obtain the cert + key bundle from the Bradesco Developer Portal after your merchant contract is signed. They are distinct from the OAuth credentials.

## Base URLs

- **Production**: `https://proxy.api.prebanco.com.br` (Bradesco's standard external proxy)
- **Sandbox**: `https://apihom-bradescorip.bradesco.com.br` (homologação)

Both hosts are marked `TODO(verify)` — Bradesco provisions per-merchant subdomains in some product families and the exact homologação host may differ. Fork and override `BASE_URL` if your portal provisioning differs.

## Run

```bash
# stdio (default)
npx @codespar/mcp-bradesco

# HTTP transport
MCP_HTTP=true MCP_PORT=3000 npx @codespar/mcp-bradesco
```

## Caveats

- **Paths are unverified.** See the `TODO(verify)` markers in `src/index.ts`. Onboarded merchants should validate against their portal-issued OpenAPI spec and open a PR.
- **Base URLs are best-guess.** See above — override if your provisioning differs.
- **Arrecadação barcode validation** is server-side in this alpha — no client-side mod-10 / mod-11 check yet.

## License

MIT
