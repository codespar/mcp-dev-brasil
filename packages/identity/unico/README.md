# @codespar/mcp-unico

MCP server for [Unico](https://unico.io) — the Brazilian identity verification leader. CPF/CNPJ validation, document OCR, face biometrics, liveness, PEP / watchlist / court-records screening.

First entry in the CodeSpar `identity` category. Commerce agents onboarding sellers (marketplaces), running high-value transactions, or operating KYC-regulated flows need identity verification — Unico is the BR standard. Paired with [`@codespar/mcp-onfido`](../onfido) for BR-first + global coverage.

## Products

Unico sells three separately-contracted products. This server exposes tools for all three; agents should call only what's enabled on your contract (disabled products return 403).

| Product  | What it does                                                            |
|----------|-------------------------------------------------------------------------|
| IDCloud  | CPF/CNPJ validation with Receita Federal, document OCR, authenticity    |
| IDPay    | Face match + liveness for login and payment authentication              |
| IDCheck  | PEP, sanctions watchlists, Brazilian court records                      |

## Tools

| Tool | Product | Purpose |
|---|---|---|
| `validate_cpf` | IDCloud | CPF status (REGULAR / SUSPENSA / TITULAR FALECIDO) + name |
| `validate_cnpj` | IDCloud | CNPJ status, partners (QSA), address, CNAE |
| `extract_document` | IDCloud | OCR + field extraction for RG / CNH / Passport / CPF / RNE / CTPS |
| `verify_document_authenticity` | IDCloud | Tamper detection + authenticity score |
| `face_match` | IDPay | 1:1 biometric comparison (selfie vs document) |
| `liveness_check` | IDPay | Passive / active liveness (anti-spoof) |
| `check_pep` | IDCheck | Politically Exposed Person lookup |
| `check_watchlists` | IDCheck | OFAC, UN, EU, HMT, Interpol, adverse media |
| `court_records_search` | IDCheck | Federal / state / labor / superior Brazilian courts |

## Install

```bash
npm install @codespar/mcp-unico
```

## Environment

```bash
UNICO_CLIENT_ID="..."       # OAuth client_id
UNICO_CLIENT_SECRET="..."   # OAuth client_secret
UNICO_ENV="sandbox"         # Optional. 'sandbox' | 'production'. Default: sandbox
UNICO_BASE_URL="..."        # Optional. Default: https://api.unico.co
UNICO_AUTH_URL="..."        # Optional. Default: https://auth.unico.co
```

## Authentication

OAuth 2.0 Client Credentials. The server posts `client_id:client_secret` as Basic auth to Unico's token endpoint and caches the bearer token in memory until 60 s before expiry. Unico's docs require server-side integration only — never expose these credentials to a browser or mobile client.

## Run

```bash
# stdio (default)
npx @codespar/mcp-unico

# HTTP
MCP_HTTP=true MCP_PORT=3000 npx @codespar/mcp-unico
```

## Status

Shipped as `0.1.0-alpha.1`. Unico's REST contract lives behind the [devcenter.unico.io](https://devcenter.unico.io) portal and is gated by merchant account. Tool names and argument shapes are stable, but exact endpoint paths may shift once we validate against live credentials — override `UNICO_BASE_URL` / `UNICO_AUTH_URL` if your account is served from a different host. PRs welcome once you've seen the real payloads.

## License

MIT
