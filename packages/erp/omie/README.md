# @codespar/mcp-omie

> MCP server for **Omie** — ERP with customers, products, orders, invoices, and financials

[![npm](https://img.shields.io/npm/v/@codespar/mcp-omie)](https://www.npmjs.com/package/@codespar/mcp-omie)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

## Quick Start

### Claude Desktop

Add to `~/.config/claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "omie": {
      "command": "npx",
      "args": ["-y", "@codespar/mcp-omie"],
      "env": {
        "OMIE_APP_KEY": "your-app-key",
        "OMIE_APP_SECRET": "your-app-secret"
      }
    }
  }
}
```

### Claude Code

```bash
claude mcp add omie -- npx @codespar/mcp-omie
```

### Cursor / VS Code

Add to `.cursor/mcp.json` or `.vscode/mcp.json`:

```json
{
  "servers": {
    "omie": {
      "command": "npx",
      "args": ["-y", "@codespar/mcp-omie"],
      "env": {
        "OMIE_APP_KEY": "your-app-key",
        "OMIE_APP_SECRET": "your-app-secret"
      }
    }
  }
}
```

## Tools

### Customers, Products, Companies

| Tool | Description |
|------|-------------|
| `list_customers` | List customers from Omie ERP |
| `create_customer` | Create a customer in Omie ERP |
| `list_products` | List products from Omie ERP |
| `create_product` | Create a product in Omie ERP |
| `get_company_info` | List companies registered in Omie ERP |

### Sales Orders & Invoices

| Tool | Description |
|------|-------------|
| `create_order` | Create a sales order |
| `list_orders` | List sales orders |
| `get_sales_order` | Consult a specific sales order by ID or integration code |
| `update_sales_order` | Alter an existing sales order |
| `invoice_sales_order` | Generate an invoice (NF) from a sales order |
| `list_invoices` | List invoices (NF) |
| `create_invoice` | Consult a specific NF by ID |

### Services & Purchasing

| Tool | Description |
|------|-------------|
| `create_service_order` | Create a service order (OS) |
| `list_service_orders` | List service orders |
| `create_purchase_order` | Create a purchase order |
| `list_purchase_orders` | List purchase orders |

### Financial (AR / AP / Banking)

| Tool | Description |
|------|-------------|
| `get_financial` | List accounts receivable |
| `create_account_payable` | Create an accounts payable entry |
| `list_accounts_payable` | List accounts payable titles |
| `pay_account_payable` | Settle / record payment on an AP title |
| `list_financial_movements` | List unified financial movements (AP + AR + CC) |
| `get_bank_accounts` | List registered bank accounts |
| `get_bank_statement` | Bank statement (extrato) for a period |
| `create_cash_entry` | Create a bank account ledger entry (lançamento) |
| `list_dre` | List DRE (income statement) accounts |

### Auxiliary Registers

| Tool | Description |
|------|-------------|
| `list_categories` | List chart of accounts categories |
| `list_departments` | List departments (cost centers) |
| `list_projects` | List projects |

### Inventory

| Tool | Description |
|------|-------------|
| `create_stock_adjustment` | Create an inventory adjustment (entry/exit/balance) |
| `get_stock_position` | Get current stock position / balance |

## Authentication

Omie uses JSON-RPC style requests with app_key and app_secret in the request body.

## Sandbox / Testing

Omie provides a sandbox via app registration. Create an app to get test credentials.

### Get your credentials

1. Go to [Omie Developer Portal](https://developer.omie.com.br)
2. Create an account
3. Register an application to get app key and secret
4. Set the environment variables

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OMIE_APP_KEY` | Yes | Omie app key |
| `OMIE_APP_SECRET` | Yes | Omie app secret |

## Roadmap

### v0.3 (planned)
- `create_production_order` — Create a production order
- `emit_nfe` — Emit NF-e (native emission, not import)
- `reconcile_bank_transaction` — Bank reconciliation matching
- `create_service_contract` — Service contracts CRUD
- `create_custom_field` — Merchant custom fields

Want to contribute? [Open a PR](https://github.com/codespar/mcp-dev-brasil) or [request a tool](https://github.com/codespar/mcp-dev-brasil/issues).

## Links

- [Omie Website](https://omie.com.br)
- [Omie API Documentation](https://developer.omie.com.br)
- [MCP Dev Brasil](https://github.com/codespar/mcp-dev-brasil)
- [Landing Page](https://codespar.dev/mcp)

## Enterprise

Need governance, budget limits, and audit trails for agent payments? [CodeSpar Enterprise](https://codespar.dev/enterprise) adds policy engine, payment routing, and compliance templates on top of these MCP servers.

## License

MIT
