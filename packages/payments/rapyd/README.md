# @codespar/mcp-rapyd

MCP server for [Rapyd](https://rapyd.net) — global collect + disburse across 100+ countries.

Rapyd is the global counterpart to [dLocal](https://github.com/codespar/mcp-dev-brasil/tree/main/packages/payments/dlocal). Where dLocal is LatAm-deep (15+ countries, Pix/OXXO/PSE/SPEI), Rapyd is worldwide-wide: Asia, Africa, Europe, the Middle East, and LatAm via a single API — and crucially covers two categories dLocal doesn't:

- **Cash pickup** — OXXO Pay, 7-Eleven, and country-specific cash networks for unbanked recipients
- **Managed wallets** — the merchant holds a master account and provisions sub-wallets per end user (marketplace balances, creator payouts, cross-border P2P without opening a bank account per user)

Use dLocal when LatAm depth is the requirement. Use Rapyd when global reach, cash pickup, or wallet infrastructure is the requirement.

## Tools

| Tool | Purpose |
|------|---------|
| `create_checkout_page` | Hosted checkout page covering all local methods for a country + currency |
| `create_payment` | Direct server-to-server payment with a specified payment_method |
| `get_payment` | Retrieve payment status |
| `cancel_payment` | Cancel an uncaptured/pending payment |
| `create_refund` | Refund a completed payment (full or partial) |
| `create_payout` | Disburse via bank transfer, wallet top-up, or cash pickup |
| `get_payout` | Retrieve payout status |
| `confirm_payout` | Second step of Rapyd's two-step payout approval |
| `list_payment_methods_by_country` | Discover local inbound methods for a country |
| `list_payout_methods_by_country` | Discover payout method types for a beneficiary country |
| `create_wallet` | Create a Rapyd managed wallet (ewallet) for an end user |
| `transfer_between_wallets` | Move funds between two Rapyd ewallets |

## Install

```bash
npm install @codespar/mcp-rapyd
```

## Environment

```bash
RAPYD_ACCESS_KEY="..."   # Public access key (sent in the access_key header)
RAPYD_SECRET_KEY="..."   # Secret key (used to sign requests; never transmitted)
RAPYD_ENV="sandbox"      # Optional. 'sandbox' (default) or 'production'
```

Base URLs:
- sandbox → `https://sandboxapi.rapyd.net`
- production → `https://api.rapyd.net`

## Authentication

Every request is signed with HMAC-SHA256 per Rapyd's signature recipe:

```
toSign    = http_method_lowercase + url_path + salt + timestamp + access_key + secret_key + body_string
hmac_hex  = HMAC-SHA256(secret_key, toSign).digest('hex')
signature = Buffer.from(hmac_hex).toString('base64')   // hex → base64, not raw digest
```

Required headers on every request:

```
Content-Type: application/json
access_key:   <access_key>
salt:         <random 8-16 char string, unique per request>
timestamp:    <Unix seconds, within 60s of server time>
signature:    <computed per recipe above>
idempotency:  <unique per request>
```

The server handles salt, timestamp, signature, and idempotency generation automatically — you only configure `RAPYD_ACCESS_KEY`, `RAPYD_SECRET_KEY`, and (optionally) `RAPYD_ENV`.

Gotchas the server handles for you:
- `body_string` is the compact JSON body with no whitespace, or `""` when empty — never `"{}"`.
- `url_path` includes the query string when present.
- `http_method` is lowercased in the signature string but UPPERCASE on the wire.

## Run

```bash
# stdio (default — for Claude Desktop, Cursor, etc)
npx @codespar/mcp-rapyd

# HTTP (for server-to-server testing)
MCP_HTTP=true MCP_PORT=3000 npx @codespar/mcp-rapyd
```

## When to use Rapyd vs dLocal

| Requirement | Choose |
|-------------|--------|
| LatAm depth (Pix, OXXO, PSE, SPEI, Boleto) | dLocal |
| Global reach (Asia, Africa, Europe + LatAm) | Rapyd |
| Cash pickup for unbanked recipients | Rapyd |
| Managed wallet infrastructure | Rapyd |
| Single-country PSP (BR-only, MX-only) | Per-country server (Mercado Pago, Conekta, etc) |

## License

MIT
