# @codespar/mcp-bling

> MCP server for **Bling** — ERP with products, orders, contacts, invoices, and stock management

[![npm](https://img.shields.io/npm/v/@codespar/mcp-bling)](https://www.npmjs.com/package/@codespar/mcp-bling)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

## Quick Start

### Claude Desktop

Add to `~/.config/claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "bling": {
      "command": "npx",
      "args": ["-y", "@codespar/mcp-bling"],
      "env": {
        "BLING_ACCESS_TOKEN": "your-token"
      }
    }
  }
}
```

### Claude Code

```bash
claude mcp add bling -- npx @codespar/mcp-bling
```

### Cursor / VS Code

Add to `.cursor/mcp.json` or `.vscode/mcp.json`:

```json
{
  "servers": {
    "bling": {
      "command": "npx",
      "args": ["-y", "@codespar/mcp-bling"],
      "env": {
        "BLING_ACCESS_TOKEN": "your-token"
      }
    }
  }
}
```

## Tools

### Products & catalog
| Tool | Description |
|------|-------------|
| `list_products` | List products |
| `create_product` | Create a product |
| `list_categories` | List product categories |
| `create_category` | Create a product category |

### Sales & purchasing
| Tool | Description |
|------|-------------|
| `list_orders` | List sales orders |
| `create_order` | Create a sales order |
| `list_purchase_orders` | List purchase orders |
| `create_purchase_order` | Create a purchase order |

### Contacts
| Tool | Description |
|------|-------------|
| `list_contacts` | List contacts (customers/suppliers) |
| `create_contact` | Create a contact |
| `get_contact` | Get a contact by ID |
| `update_contact` | Update an existing contact |

### Fiscal invoices
| Tool | Description |
|------|-------------|
| `list_invoices` | List NF-e fiscal invoices |
| `create_invoice` | Create an NF-e from a sales order |
| `send_invoice` | Emit an NF-e to SEFAZ |
| `create_service_invoice` | Create an NFS-e (service invoice) |

### Inventory
| Tool | Description |
|------|-------------|
| `get_stock` | Get stock/inventory for a product |
| `update_stock` | Update stock at a warehouse |
| `create_stock_movement` | Register an in/out stock movement |
| `list_warehouses` | List warehouses (depósitos) |
| `create_warehouse` | Create a warehouse |

### Finance
| Tool | Description |
|------|-------------|
| `list_accounts_receivable` | List accounts receivable |
| `create_account_receivable` | Create an account receivable |
| `list_accounts_payable` | List accounts payable |
| `create_account_payable` | Create an account payable |
| `list_payment_methods` | List payment methods |

### Integration
| Tool | Description |
|------|-------------|
| `subscribe_webhook` | Register a webhook/notification |
| `unsubscribe_webhook` | Remove a webhook |

## Authentication

Bling uses OAuth2 Bearer tokens for authentication.

## Sandbox / Testing

Bling provides a sandbox via the OAuth flow. Use test credentials for development.

### Get your credentials

1. Go to [Bling Developer Portal](https://developer.bling.com.br)
2. Create an account
3. Register an OAuth application and obtain an access token
4. Set the `BLING_ACCESS_TOKEN` environment variable

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `BLING_ACCESS_TOKEN` | Yes | OAuth2 access token |

## Roadmap

### v0.3 (planned)
- `production_management` — Manage production orders
- `multi_store` — Multi-store inventory (Mercado Livre, Shopee, Amazon integrations)
- `list_nfce` / `create_nfce` — Consumer invoice (NFC-e) helpers
- Richer filters on `list_accounts_*` (by payment status, contact)

Want to contribute? [Open a PR](https://github.com/codespar/mcp-dev-brasil) or [request a tool](https://github.com/codespar/mcp-dev-brasil/issues).

## Links

- [Bling Website](https://bling.com.br)
- [Bling API Documentation](https://developer.bling.com.br)
- [MCP Dev Brasil](https://github.com/codespar/mcp-dev-brasil)
- [Landing Page](https://codespar.dev/mcp)

## Enterprise

Need governance, budget limits, and audit trails for agent payments? [CodeSpar Enterprise](https://codespar.dev/enterprise) adds policy engine, payment routing, and compliance templates on top of these MCP servers.

## License

MIT
