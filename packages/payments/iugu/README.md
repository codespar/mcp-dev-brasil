# @codespar/mcp-iugu

> MCP server for **iugu** — invoices, subscriptions, and payment management

[![npm](https://img.shields.io/npm/v/@codespar/mcp-iugu)](https://www.npmjs.com/package/@codespar/mcp-iugu)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

## Quick Start

### Claude Desktop

Add to `~/.config/claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "iugu": {
      "command": "npx",
      "args": ["-y", "@codespar/mcp-iugu"],
      "env": {
        "IUGU_API_TOKEN": "your-token"
      }
    }
  }
}
```

### Claude Code

```bash
claude mcp add iugu -- npx @codespar/mcp-iugu
```

### Cursor / VS Code

Add to `.cursor/mcp.json` or `.vscode/mcp.json`:

```json
{
  "servers": {
    "iugu": {
      "command": "npx",
      "args": ["-y", "@codespar/mcp-iugu"],
      "env": {
        "IUGU_API_TOKEN": "your-token"
      }
    }
  }
}
```

## Tools (20)

### Invoices
| Tool | Description |
|------|-------------|
| `create_invoice` | Create an invoice (Pix, boleto, or credit card) |
| `get_invoice` | Get invoice details by ID |
| `list_invoices` | List invoices with optional filters |
| `cancel_invoice` | Cancel (delete) an invoice |
| `refund_invoice` | Full or partial refund on a paid invoice |
| `duplicate_invoice` | Duplicate an invoice with a new due date |

### Customers
| Tool | Description |
|------|-------------|
| `create_customer` | Create a customer |
| `update_customer` | Update customer data (PUT) |
| `list_customers` | List customers with optional filters |

### Plans (recurring templates)
| Tool | Description |
|------|-------------|
| `create_plan` | Create a subscription plan |
| `update_plan` | Update an existing plan |
| `list_plans` | List subscription plans |

### Subscriptions
| Tool | Description |
|------|-------------|
| `create_subscription` | Create a recurring subscription |
| `suspend_subscription` | Suspend a subscription |
| `activate_subscription` | Reactivate a suspended subscription |
| `cancel_subscription` | Cancel (delete) a subscription |

### Payment Tokens & Methods
| Tool | Description |
|------|-------------|
| `create_payment_token` | Tokenize a card server-side (PCI audit applies) |
| `create_payment_method` | Attach a saved payment method to a customer |

### Marketplace & Payouts
| Tool | Description |
|------|-------------|
| `create_subaccount` | Create a marketplace sub-account |
| `create_transfer` | Transfer funds between iugu accounts |
| `request_withdraw` | Request a bank withdrawal (saque) for a sub-account |

### Webhooks & Account
| Tool | Description |
|------|-------------|
| `create_webhook` | Register a webhook (gatilho) for an iugu event |
| `get_account_info` | Get account information, configuration, and balance |

## Authentication

iugu uses Basic Auth with the API token as username and an empty password.

## Sandbox / Testing

iugu provides test mode via the dashboard. Use a test-mode API token to avoid real charges.

### Get your credentials

1. Go to [iugu Developer Portal](https://dev.iugu.com)
2. Create an account and access the dashboard
3. Toggle to test mode and generate an API token
4. Set the `IUGU_API_TOKEN` environment variable

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `IUGU_API_TOKEN` | Yes | API token from iugu dashboard |
| `IUGU_SANDBOX` | No | Set to `"true"` for test mode |

## Roadmap

### v0.3 (planned)
- `create_split` — Create split payment rules
- `list_transfers` — List marketplace transfers
- `get_financial_report` — Financial summary report
- `batch_invoices` — Create multiple invoices in a single request
- `list_payment_methods` — List saved payment methods for a customer

Want to contribute? [Open a PR](https://github.com/codespar/mcp-dev-brasil) or [request a tool](https://github.com/codespar/mcp-dev-brasil/issues).

## Links

- [iugu Website](https://iugu.com)
- [iugu API Documentation](https://dev.iugu.com)
- [MCP Dev Brasil](https://github.com/codespar/mcp-dev-brasil)
- [Landing Page](https://codespar.dev/mcp)

## Enterprise

Need governance, budget limits, and audit trails for agent payments? [CodeSpar Enterprise](https://codespar.dev/enterprise) adds policy engine, payment routing, and compliance templates on top of these MCP servers.

## License

MIT
