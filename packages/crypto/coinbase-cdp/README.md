# @codespar/mcp-coinbase-cdp

MCP server for the [Coinbase Developer Platform (CDP)](https://www.coinbase.com/developer-platform) — single npm package covering **three CDP product surfaces** under one key:

- **Trading** — onchain swap / trade API
- **Wallets** — Smart / Embedded / MPC wallet primitives
- **Payments** — onchain outbound payment infrastructure

All three live on the same CDP account, share one ES256 JWT-signed key, and share one base URL (`https://api.cdp.coinbase.com`) — so they ship as one package, not three.

## Positioning vs the rest of the catalog

| Server | Coinbase surface | Auth |
|--------|------------------|------|
| `@codespar/mcp-coinbase` | **Advanced Trade** exchange (legacy retail) | HMAC API keys (`CB-ACCESS-*`) |
| `@codespar/mcp-coinbase-commerce` | **Commerce** merchant gateway (accept BTC/ETH/USDC at checkout) | API key (`X-CC-Api-Key`) |
| `@codespar/mcp-coinbase-cdp` | **Developer Platform** (Trading + Wallets + Payments) | ES256 JWT (this package) |

Each surface has a separate API host, a separate key type, and a separate dashboard — they do not share credentials. Mint the right key for the surface you want.

## Tools (15)

### Trading (4)

| Tool | Purpose |
|---|---|
| `list_quotes` | List recent swap quotes minted under the authenticated CDP account. |
| `create_swap` | Create an onchain swap between two assets. |
| `get_swap` | Get a single swap by id — full status, executed amounts, gas, tx hash. |
| `cancel_swap` | Cancel a pending swap before it lands onchain. |

### Wallets (7)

| Tool | Purpose |
|---|---|
| `create_wallet` | Create a new wallet (smart / embedded / MPC). |
| `list_wallets` | List wallets under the authenticated CDP account. |
| `get_wallet` | Get a single wallet by id. |
| `list_balances` | List asset balances across all addresses + networks. |
| `transfer` | Send a transfer from a wallet to a destination address. |
| `get_transaction` | Get a single transaction by id. |
| `list_transactions` | List historical transactions for a wallet. |

### Payments (4)

| Tool | Purpose |
|---|---|
| `create_payment` | Create an onchain payment (outbound transfer to a payee). |
| `list_payments` | List historical payments. |
| `get_payment` | Get a single payment by id. |
| `cancel_payment` | Cancel a pending payment before it lands onchain. |

## Install

```bash
npm install -g @codespar/mcp-coinbase-cdp
```

## Environment

```bash
COINBASE_CDP_KEY_NAME="organizations/<org>/apiKeys/<id>"
COINBASE_CDP_PRIVATE_KEY="-----BEGIN EC PRIVATE KEY-----
...
-----END EC PRIVATE KEY-----"
```

Mint the key (and download the PEM **once** — it is not recoverable later) at <https://portal.cdp.coinbase.com>. The same key authenticates Trading, Wallets, and Payments.

> **Important** — the PEM must be the full multi-line block including `BEGIN`/`END` lines. When supplying via shell env, wrap in double quotes and preserve newlines (or use `$'...'` / a `.env` file).

## Authentication

CDP signs every request with a **fresh ES256 JWT** in the `Authorization: Bearer …` header.

JWT claims (per request):

| Claim | Value |
|------|------|
| `sub` | `COINBASE_CDP_KEY_NAME` |
| `iss` | `"cdp"` |
| `aud` | `["cdp_service"]` |
| `nbf` | `now` (unix seconds) |
| `exp` | `now + 120` |
| `uri` | `"<METHOD> api.cdp.coinbase.com<path>"` (path includes any query string) |

JWT header:

| Field | Value |
|------|------|
| `alg` | `"ES256"` |
| `typ` | `"JWT"` |
| `kid` | `COINBASE_CDP_KEY_NAME` |
| `nonce` | random 16-byte hex (per request) |

Signed with the ECDSA P-256 private key from `COINBASE_CDP_PRIVATE_KEY`. The PEM is imported once at startup and cached — only the JWT is minted per request.

## Run

```bash
# stdio (default — for Claude Desktop, Cursor, etc.)
npx @codespar/mcp-coinbase-cdp

# HTTP (for server-to-server testing)
MCP_HTTP=true MCP_PORT=3000 npx @codespar/mcp-coinbase-cdp
```

## Enterprise

Need governance, budget limits, and audit trails for agent-driven onchain transactions? [CodeSpar Enterprise](https://codespar.dev/enterprise) adds policy engine, payment routing, and compliance templates on top of these MCP servers.

## License

MIT
