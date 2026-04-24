# @codespar/mcp-safrapay

MCP server for [Safrapay](https://developers.safrapay.com.br) — Banco Safra's acquirer. B2B-banking crossover focused on mid-to-large BR merchants and private-banking clientele.

Safrapay's API surface is operated on Aditum's payment platform (documented at [safrapay-docs.aditum.com.br](https://safrapay-docs.aditum.com.br)). The gateway, portal, reconciliation, and webhook products are split across separate base hosts.

> **Status: 0.1.0-alpha.1.** The endpoint paths here were derived from the Aditum-hosted Safrapay developer docs (publicly reachable). Auth flow (BCRYPT + CNPJ on gateway, JWT Bearer thereafter) is best-effort: the BCRYPT hash input format is not fully specified in public docs and very likely requires a sandbox account to finalize. Treat all tools as scaffolding until validated against a live sandbox merchant.

## Tools (12)

| Tool | Purpose |
|---|---|
| `authorize_payment` | Authorize a credit-card payment (optional pre-auth only) |
| `capture_payment` | Capture a previously authorized payment |
| `cancel_payment` | Cancel / void an authorized-but-uncaptured payment |
| `refund_payment` | Full or partial refund |
| `create_pix` | Create Pix charge, returns QR + copy-paste payload |
| `create_boleto` | Create boleto charge |
| `get_payment` | Retrieve a charge by id |
| `tokenize_card` | PCI-safe card tokenization (persistent + temporary) |
| `create_split_rule` | Configure split distribution for a charge |
| `get_statement` | Digital statement (Safrapay differentiator) |
| `list_transactions` | List charges with filters |
| `register_webhook` | Bulk-register webhook subscriptions |

## Install

```bash
npm install @codespar/mcp-safrapay
```

## Environment

```bash
SAFRAPAY_CLIENT_ID="..."      # Merchant CNPJ (sent as merchantCredential)
SAFRAPAY_CLIENT_SECRET="..."  # MerchantToken (used to compute BCRYPT)
SAFRAPAY_MERCHANT_ID="..."    # Safrapay merchant id (body field where required)
SAFRAPAY_ENV="sandbox"        # 'sandbox' (default) or 'production'
```

## Base URLs

Safrapay splits its API into four products hosted on distinct domains:

| Product | Sandbox | Production |
|---|---|---|
| Gateway (payments) | `https://payment-dev.aditum.com.br` | `https://payment.aditum.com.br` |
| Portal (management) | `https://portal-dev.aditum.com.br` | `https://portal-api.aditum.com.br` |
| Reconciliation | `https://reconciliation-dev.aditum.com.br` | `https://reconciliation-api.aditum.com.br` |
| Webhook | `https://webhook-dev.aditum.com.br` | `https://webhook.aditum.com.br` |

## Authentication

Gateway uses a two-step bootstrap:

1. `POST {gateway}/v2/merchant/auth` with headers `Authorization: <BCRYPT(CNPJ+MerchantToken)>` and `merchantCredential: <CNPJ>` to exchange for a JWT access token.
2. Subsequent calls send `Authorization: Bearer <jwt>`.

The server caches the JWT in memory until 60 s before expiry. The BCRYPT input concatenation is an informed guess; refine once you have a sandbox account.

## Run

```bash
# stdio (default)
npx @codespar/mcp-safrapay

# HTTP
MCP_HTTP=true MCP_PORT=3000 npx @codespar/mcp-safrapay
```

## Endpoint map (used by tools)

| Tool | Method | Path (under gateway, unless noted) |
|---|---|---|
| `authorize_payment` | POST | `/v2/charge/authorization` or `/v2/charge/preauthorization` |
| `capture_payment` | PUT | `/v2/charge/capture/{chargeId}` |
| `cancel_payment` | PUT | `/v2/charge/cancelation/{chargeId}` |
| `refund_payment` | PUT | `/v2/charge/cancelation/{chargeId}` (partial amount) |
| `create_pix` | POST | `/v2/charge/pix` |
| `create_boleto` | POST | `/v2/charge/boleto` |
| `get_payment` | GET | `/v2/charge/{chargeId}` |
| `tokenize_card` | POST | `/v2/card` (or `/v2/temporary/card`) |
| `create_split_rule` | PUT | `/v2/charge/split/{chargeId}` |
| `get_statement` | GET | `/v2/Account/Movement/Extract` |
| `list_transactions` | GET | `/v2/charges` |
| `register_webhook` | POST | `{webhook}/v1/webhook/bulk` |

## License

MIT
