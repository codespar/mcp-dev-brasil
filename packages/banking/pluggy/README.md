# @codespar/mcp-pluggy

MCP server for **Pluggy** — Open Finance Brasil aggregator (ITP/TPP). Pluggy holds the ICP-Brasil certificate and runs Dynamic Client Registration with each Brazilian bank, so you integrate against one API instead of N.

## Quick Start

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "pluggy": {
      "command": "npx",
      "args": ["@codespar/mcp-pluggy"],
      "env": {
        "PLUGGY_CLIENT_ID": "your-client-id",
        "PLUGGY_CLIENT_SECRET": "your-client-secret"
      }
    }
  }
}
```

### Cursor / VS Code

Same config in `.cursor/mcp.json` or VS Code's MCP integration.

## Tools (16)

### Connectors + categories

| Tool | Pluggy endpoint | Notes |
|---|---|---|
| `list_connectors` | `GET /connectors` | Filter by name / types / countries / sandbox |
| `get_connector` | `GET /connectors/{id}` | Single connector definition |
| `list_categories` | `GET /categories` | Transaction categorization taxonomy |

### Connect token

| Tool | Pluggy endpoint | Notes |
|---|---|---|
| `create_connect_token` | `POST /connect_token` | Embed Pluggy Connect widget on the client |

### Items (bank connections)

| Tool | Pluggy endpoint | Notes |
|---|---|---|
| `create_item` | `POST /items` | New bank connection from credentials |
| `list_items` | `GET /items` | Lists existing connections |
| `get_item` | `GET /items/{id}` | Single connection |
| `update_item` | `PATCH /items/{id}` | Refresh credentials / trigger sync |
| `delete_item` | `DELETE /items/{id}` | Revoke connection |

### Accounts + transactions + identity

| Tool | Pluggy endpoint | Notes |
|---|---|---|
| `list_accounts` | `GET /accounts?itemId=...` | Checking / savings / credit / investment |
| `get_account` | `GET /accounts/{id}` | Single account |
| `list_transactions` | `GET /transactions?accountId=...` | Date-range filter |
| `get_transaction` | `GET /transactions/{id}` | Single transaction |
| `list_identities` | `GET /identity?itemId=...` | Legal name + document + address |

### Payments (PISP)

| Tool | Pluggy endpoint | Notes |
|---|---|---|
| `create_payment_intent` | `POST /payments/intents` | Initiate a Pluggy Payments intent |
| `get_payment_intent` | `GET /payments/intents/{id}` | Poll status |

## Authentication

Pluggy uses an OAuth2 client-credentials flow:

1. Client obtains an API key by `POST /auth` with `clientId` + `clientSecret`
2. Subsequent requests include the API key as `X-API-KEY`

Issue credentials at the Pluggy dashboard:

- Production: <https://dashboard.pluggy.ai>
- Docs: <https://docs.pluggy.ai>

## Sandbox / Testing

Pluggy provides sandbox connectors with synthetic accounts and transactions. The sandbox uses the same API endpoint (`https://api.pluggy.ai`); the connector list returned by `/connectors` includes sandbox banks (`Pluggy Bank`, `BR · Pluggy Bank`).

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `PLUGGY_CLIENT_ID` | yes | Client ID from the Pluggy dashboard |
| `PLUGGY_CLIENT_SECRET` | yes | Client secret from the Pluggy dashboard |
| `PLUGGY_API_BASE` | no | Override API base (default `https://api.pluggy.ai`) |

## Why use Pluggy via CodeSpar

If you only need the MCP server, install the package directly. If you're building a commerce agent that needs Pluggy + Pix + NF-e + WhatsApp + dashboard governance, look at the managed tier.

## Enterprise

Need governance, budget limits, and audit trails for agent payments? [CodeSpar Enterprise](https://codespar.dev/enterprise) adds policy engine, payment routing, and compliance templates on top of these MCP servers.

## License

MIT
