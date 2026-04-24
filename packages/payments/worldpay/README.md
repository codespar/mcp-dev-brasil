# @codespar/mcp-worldpay

MCP server for [Access Worldpay](https://docs.worldpay.com/access) — global enterprise payment processor.

Worldpay is one of the largest card acquirers in the world and a default rail for EU/UK/US enterprise merchants. This server targets the modern **Access Worldpay** REST surface, not the legacy FIS/WPG XML gateway.

> **Status: 0.1.0-alpha.1** — Access Worldpay uses HATEOAS action links (`linkData`) for lifecycle operations. Exact endpoint paths and media-type versions have been validated against the public docs (v7 payments, v4 verifications, v3 tokens, v1 fraudsight/disputes) but are moving targets. See [Stability](#stability) below.

## Tools

| Tool | Purpose |
|------|---------|
| `verify_account` | Run AVS/CVC verification on a card without charging |
| `authorize_payment` | Authorize a card payment; returns HATEOAS action links |
| `capture_payment` | Full or partial capture (settlement) of an authorization |
| `cancel_payment` | Void an uncaptured authorization |
| `refund_payment` | Full or partial refund of a settled payment |
| `reverse_payment` | Atomic void-or-refund |
| `get_payment` | Retrieve a payment event by eventId |
| `create_token` | Tokenize a card for reuse (card-on-file) |
| `delete_token` | Delete a stored token |
| `accept_dispute` | Accept a dispute (forfeit the chargeback) |
| `submit_dispute_evidence` | Submit evidence to defend a dispute |
| `fraud_screen` | Standalone FraudSight risk assessment |

## Install

```bash
npm install @codespar/mcp-worldpay
```

## Environment

```bash
WORLDPAY_USERNAME="..."    # API username (Basic Auth)
WORLDPAY_PASSWORD="..."    # API password (Basic Auth)
WORLDPAY_ENTITY="..."      # Merchant entity id; injected as merchant.entity
WORLDPAY_ENV="sandbox"     # sandbox | production; default sandbox
WORLDPAY_API_VERSION="v7"  # Payments API version; default v7
```

## Authentication

HTTP Basic auth with your Worldpay-issued credentials:

```
Authorization: Basic base64(username:password)
```

Each API family uses its own versioned media type. The server sets the correct `Content-Type` / `Accept` headers per call:

| Family | Media type |
|--------|-----------|
| payments | `application/vnd.worldpay.payments-v7+json` |
| verifications | `application/vnd.worldpay.verifications.accounts-v4+json` |
| tokens | `application/vnd.worldpay.tokens-v3.hal+json` |
| fraudsight | `application/vnd.worldpay.fraudsight-v1.hal+json` |
| disputes | `application/vnd.worldpay.disputes-v1.hal+json` |

## HATEOAS and `linkData`

Access Worldpay is HATEOAS-driven. After `authorize_payment`, the response contains `_links` such as `payments:settle`, `payments:partialSettle`, `payments:cancel`, `payments:refund`, `payments:partialRefund`, and `payments:reverse`. Each `href` ends in an opaque segment we call **`linkData`**, e.g.:

```
/payments/settlements/eyJrIjoiazNhYjYzMiJ9
                       ^^^^^^^^^^^^^^^^^^^ linkData
```

Extract that segment and pass it as `linkData` to `capture_payment` / `cancel_payment` / `refund_payment` / `reverse_payment`. When omitted, the server POSTs to the bare resource path; this only works for onboardings configured for `transactionReference`-addressable settlements.

## Run

```bash
# stdio (default — for Claude Desktop, Cursor, etc.)
npx @codespar/mcp-worldpay

# HTTP (for server-to-server testing)
MCP_HTTP=true MCP_PORT=3000 npx @codespar/mcp-worldpay
```

## Stability

- Published as `0.1.0-alpha.1` until we validate end-to-end against a real sandbox account.
- **Global Payments acquired Worldpay in January 2026.** Base URLs (`try.access.worldpay.com` / `access.worldpay.com`) remain valid as of this writing, but Global Payments has publicly signalled platform consolidation. Expect URL and media-type rebranding over the next 12–18 months. Pin the `WORLDPAY_API_VERSION` env var and watch the [release notes](https://developer.worldpay.com/products/releases).
- This server does **not** cover: Worldpay Total (US CNP-API legacy), the WPG/FIS XML gateway, Disputes Direct (separate from Access Disputes), or Worldpay for Platforms. Those are separate surfaces and would be separate packages.

## License

MIT
