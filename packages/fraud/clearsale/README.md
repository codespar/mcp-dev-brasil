# @codespar/mcp-clearsale

MCP server for [ClearSale](https://clearsale.com.br) — Brazilian fraud prevention.

ClearSale pioneered fraud analytics in Brazil (founded 2001, São Paulo) and remains the default antifraud layer for most major BR ecommerce. This is the first entry in the CodeSpar `fraud` category — no other server in the catalog does fraud scoring. Future entries (Konduto, Legiti, Sift, Cybersource) will follow the same analyze → decide → feedback shape.

## Tools

| Tool | Purpose |
|------|---------|
| `send_order_for_analysis` | Submit an order for fraud analysis; returns score + decision |
| `get_order_analysis` | Retrieve the current decision state for an order |
| `update_order_status` | Feed merchant's final decision back (APROVADO / CANCELADO / DEVOLVIDO) |
| `list_orders` | List orders with filters (date range, status, pagination) |
| `create_chargeback_notification` | Report a confirmed chargeback to tune the ML model |
| `get_order_score` | Fraud score only (numeric 0-100) |
| `create_device_fingerprint_session` | Start a device fingerprint session for client JS capture |
| `get_device_fingerprint` | Retrieve captured device characteristics |

## Install

```bash
npm install @codespar/mcp-clearsale
```

## Environment

```bash
CLEARSALE_API_KEY="..."    # Bearer token issued by ClearSale
CLEARSALE_BASE_URL="..."   # Optional. Defaults to https://api.clearsale.com.br. Override per contract-issued staging URL.
```

## Authentication

Server-side Bearer token:

```
Authorization: Bearer <CLEARSALE_API_KEY>
```

ClearSale issues the token via the developer portal or through your commercial contract. There is no public sandbox — staging URLs are provisioned per contract; override `CLEARSALE_BASE_URL` to point at it.

## Typical flow

1. On page load, the merchant calls `create_device_fingerprint_session` and embeds ClearSale's browser JS using the returned `session_token`.
2. At checkout, the merchant calls `send_order_for_analysis` with the same `session_id` plus full order, payment, items, and billing/shipping data.
3. The response carries a decision: `APROVADO` (ship it), `REPROVADO` (block), or `EM_ANALISE` (poll `get_order_analysis` or wait for a webhook).
4. Once the order lifecycle completes, call `update_order_status` with the final merchant decision — this is required for ongoing model quality.
5. If a chargeback arrives later, call `create_chargeback_notification` so ClearSale can tune its model.

## Run

```bash
# stdio (default — for Claude Desktop, Cursor, etc)
npx @codespar/mcp-clearsale

# HTTP (for server-to-server testing)
MCP_HTTP=true MCP_PORT=3000 npx @codespar/mcp-clearsale
```

## Category

`fraud` — first server in this CodeSpar category. Fraud servers share a common shape (analyze → decide → feedback) distinct from payments, which makes cross-provider swaps (ClearSale ↔ Konduto ↔ Legiti) more straightforward than cross-acquirer swaps.

## License

MIT
