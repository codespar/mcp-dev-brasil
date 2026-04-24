# @codespar/mcp-quickbooks

MCP server for [QuickBooks Online](https://developer.intuit.com/app/developer/qbo/docs/api) (Intuit) — the most-used accounting platform in the US and UK, and the global default for small-business ERP.

This is our **global accounting anchor**. While the catalog covers BR/LatAm ERPs (Omie, Conta Azul, Alegra, Bling, Tiny), LatAm SaaS companies that invoice international customers — or subsidiaries of US parent companies — almost universally keep their books in QuickBooks.

## Tools

| Tool | Purpose |
|---|---|
| `create_customer` | Create a customer |
| `get_customer` | Retrieve customer by id |
| `list_customers` | Query customers (SQL-like QBO query) |
| `create_invoice` | Create an invoice |
| `get_invoice` | Retrieve invoice by id |
| `send_invoice` | Email invoice to customer |
| `create_payment` | Record a customer payment |
| `get_payment` | Retrieve payment by id |
| `create_item` | Create a product/service item |
| `list_items` | Query items |
| `list_accounts` | Query the chart of accounts |
| `get_profit_and_loss_report` | Run a P&L report |

## Install

```bash
npm install @codespar/mcp-quickbooks
```

## Environment

```bash
QB_ACCESS_TOKEN="..."   # OAuth2 bearer (expires in 1hr — caller refreshes)
QB_REALM_ID="..."       # company id, issued on authorization
QB_ENV="sandbox"        # or "production". Default: sandbox
QB_MINOR_VERSION="70"   # optional, default 70
```

## Authentication

QuickBooks uses OAuth2 authorization_code flow. Access tokens live 1hr; refresh tokens 100 days. This server assumes a valid `QB_ACCESS_TOKEN` is already issued — token acquisition and refresh live outside the MCP scaffold (typically in your agent's credential manager).

## Run

```bash
# stdio (default)
npx @codespar/mcp-quickbooks

# HTTP
MCP_HTTP=true MCP_PORT=3000 npx @codespar/mcp-quickbooks
```

## Query language

QuickBooks list endpoints use a SQL-like syntax passed via `?query=`. Examples:

```sql
SELECT * FROM Customer WHERE Active = true MAXRESULTS 50
SELECT * FROM Item WHERE Type = 'Service'
SELECT * FROM Account WHERE AccountType = 'Income'
```

Pass the full query string to `list_customers`, `list_items`, `list_accounts`.

## License

MIT
