# @codespar/mcp-coinbase-commerce

MCP server for [Coinbase Commerce](https://commerce.coinbase.com) — global crypto merchant payments.

Coinbase Commerce is the **merchant-accept** side of crypto. Your store prices an order in local fiat (USD, BRL, EUR, MXN, ...), the buyer settles in BTC / ETH / USDC / and other supported assets, and Coinbase settles to you in the crypto or fiat of your choice.

## Positioning vs the rest of the catalog

| Server | Use case | Direction |
|--------|----------|-----------|
| `@codespar/mcp-coinbase-commerce` | **Merchants accept crypto at checkout** | Buyer pays merchant |
| `@codespar/mcp-unblockpay` | BRL / MXN <-> USDC corridor | Value transfer |
| `@codespar/mcp-moonpay` | End-user fiat <-> crypto (100+ assets) | Onramp / offramp |
| `@codespar/mcp-transak` | End-user fiat <-> crypto (broad geo) | Onramp / offramp |

Use Coinbase Commerce when an agent needs to **bill a buyer in crypto** — hosted charge page, reusable checkout, or directed invoice.

## Tools

| Tool | Purpose |
|------|---------|
| `create_charge` | Create a one-time crypto charge priced in fiat |
| `retrieve_charge` | Look up a charge by id or short code |
| `list_charges` | List charges (paginated) |
| `cancel_charge` | Cancel an unpaid charge |
| `resolve_charge` | Manually mark a charge as paid |
| `create_checkout` | Create a reusable hosted checkout (product page) |
| `retrieve_checkout` | Look up a checkout by id |
| `list_events` | List lifecycle events (same payload as webhooks) |
| `create_invoice` | Create an invoice directed at a named recipient |

## Install

```bash
npm install @codespar/mcp-coinbase-commerce
```

## Environment

```bash
COINBASE_COMMERCE_API_KEY="..."         # API key (required, secret)
COINBASE_COMMERCE_API_VERSION="..."     # Optional. Defaults to 2018-03-22.
```

Create an API key at <https://beta.commerce.coinbase.com/settings/security>.

## Authentication

Every request carries two headers:

```
X-CC-Api-Key: <COINBASE_COMMERCE_API_KEY>
X-CC-Version: 2018-03-22
```

The version header is required. Pin it so future API changes don't silently break your integration.

## Run

```bash
# stdio (default — for Claude Desktop, Cursor, etc)
npx @codespar/mcp-coinbase-commerce

# HTTP (for server-to-server testing)
MCP_HTTP=true MCP_PORT=3000 npx @codespar/mcp-coinbase-commerce
```

## License

MIT
