# @codespar/mcp-izipay

MCP server for [Izipay](https://developers.izipay.pe) — Peru's enterprise acquirer.

Izipay is the merchant-facing brand of **Niubiz** (Visa + Peruvian banks joint venture), the largest card acquirer in Peru with 20%+ share. Niubiz/Izipay is the default for enterprise merchants with serious volume and a direct acquirer contract.

## Positioning vs Culqi

| | [@codespar/mcp-culqi](../culqi) | @codespar/mcp-izipay |
|---|---|---|
| Segment | Peru SMB | Peru enterprise |
| Type | PSP (Stripe-analog) | Acquirer (Niubiz) |
| Onboarding | Self-serve | Commercial contract |
| Customers | D2C, SaaS, startups | Retail chains, airlines, utilities, banks |

Peruvian merchants with serious volume typically have an Izipay acquirer contract **before** they adopt a PSP — different customers, different contracts, different commercial terms. The two servers complement each other.

## Status: alpha

This is **0.1.0-alpha.1**. Izipay's developer portal at `developers.izipay.pe` is contract-gated — the public homepage advertises the API but the full REST reference is only available to contracted merchants. The endpoint paths in this server are best-effort inferences from Izipay's public SDK repositories (`github.com/izipay-pe`) and common Niubiz/Izipay REST conventions. **Every endpoint below should be validated against your integration kit before going live**, and corrections are welcome via PR.

### Best-guess endpoints (unverified)

| Tool | Method | Path |
|---|---|---|
| auth (internal) | `POST` | `/auth/login` |
| `create_charge` | `POST` | `/v1/charges` |
| `capture_charge` | `POST` | `/v1/charges/{id}/capture` |
| `cancel_charge` | `POST` | `/v1/charges/{id}/cancel` |
| `refund_charge` | `POST` | `/v1/charges/{id}/refund` |
| `get_charge` | `GET` | `/v1/charges/{id}` |
| `tokenize_card` | `POST` | `/v1/tokens` |
| `delete_token` | `DELETE` | `/v1/tokens/{id}` |
| `create_installment_plan` | `POST` | `/v1/installments` |
| `list_transactions` | `GET` | `/v1/transactions` |
| `get_settlement` | `GET` | `/v1/settlements/{date}` |

## Tools

| Tool | Purpose |
|---|---|
| `create_charge` | Authorize a card payment (3DS supported) |
| `capture_charge` | Capture a previously authorized charge |
| `cancel_charge` | Void an authorized-but-uncaptured charge |
| `refund_charge` | Full or partial refund |
| `get_charge` | Retrieve a charge by id |
| `tokenize_card` | PCI-safe card tokenization |
| `delete_token` | Delete a stored card token |
| `create_installment_plan` | Peruvian cuotas plan (with/without interest) |
| `list_transactions` | Reconciliation: transactions by date + status |
| `get_settlement` | Daily settlement batch (liquidación) for a date |

## Install

```bash
npm install @codespar/mcp-izipay
```

## Environment

```bash
IZIPAY_USERNAME="..."       # merchant username
IZIPAY_PASSWORD="..."       # merchant password (secret)
IZIPAY_MERCHANT_CODE="..."  # codigoComercio
IZIPAY_ENV="production"     # or "sandbox"
IZIPAY_BASE_URL="..."       # Optional override
```

Defaults:
- `IZIPAY_ENV=production` → `https://api.izipay.pe`
- `IZIPAY_ENV=sandbox` → `https://sandbox-api.izipay.pe`

## Authentication

JWT Bearer. On the first API call the server POSTs `{ username, password, merchantCode }` to `/auth/login`, caches the returned JWT in memory, and attaches it as `Authorization: Bearer <jwt>` on every subsequent request. The cached JWT is refreshed 60s before expiry. Transparent to callers.

## Run

```bash
# stdio (default)
npx @codespar/mcp-izipay

# HTTP
MCP_HTTP=true MCP_PORT=3000 npx @codespar/mcp-izipay
```

## License

MIT
