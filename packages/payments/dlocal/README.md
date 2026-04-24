# @codespar/mcp-dlocal

MCP server for [dLocal](https://dlocal.com) — LatAm cross-border payments.

One API, 15+ LatAm countries, local payment methods (Pix, OXXO, PSE, SPEI, Boleto, cards). The abstraction that per-country PSP servers cannot provide on their own.

## Tools

| Tool | Purpose |
|------|---------|
| `create_payment` | Charge a buyer via local method (card, Pix, OXXO, PSE, SPEI, boleto) |
| `get_payment` | Retrieve payment status |
| `cancel_payment` | Cancel an authorized-but-not-captured payment |
| `create_refund` | Refund a captured payment (full or partial) |
| `get_refund` | Retrieve refund status |
| `create_payout` | Send money out to a beneficiary in local currency |
| `get_payout` | Retrieve payout status |
| `list_payment_methods` | Enumerate available methods per country (dynamic) |
| `get_balance` | Merchant account balance per currency |

## Install

```bash
npm install @codespar/mcp-dlocal
```

## Environment

```bash
DLOCAL_LOGIN="..."        # X-Login header value
DLOCAL_TRANS_KEY="..."    # X-Trans-Key header value
DLOCAL_SECRET_KEY="..."   # HMAC secret used to sign V2 requests
DLOCAL_BASE_URL="..."     # Optional. Defaults to https://api.dlocal.com. Use https://sandbox.dlocal.com for sandbox.
```

## Authentication

Every request signs with V2 HMAC-SHA256:

```
X-Date: <ISO-8601 UTC>
X-Login: <login>
X-Trans-Key: <trans_key>
Authorization: V2-HMAC-SHA256, Signature: <hex(hmac_sha256(login + x_date + body, secret_key))>
```

The server handles signing automatically — you only configure the three env vars.

## Run

```bash
# stdio (default — for Claude Desktop, Cursor, etc)
npx @codespar/mcp-dlocal

# HTTP (for server-to-server testing)
MCP_HTTP=true MCP_PORT=3000 npx @codespar/mcp-dlocal
```

## Countries covered

Argentina, Bolivia, Brazil, Chile, Colombia, Costa Rica, Ecuador, Guatemala, Mexico, Peru, Uruguay, and more. Use `list_payment_methods` to enumerate available methods per country at runtime rather than hard-coding.

## License

MIT
