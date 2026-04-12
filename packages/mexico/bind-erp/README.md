# MCP Bind ERP

MCP server for **Bind ERP** — Mexican cloud ERP for invoicing, inventory, customers, and accounting.

## Quick Start

```bash
# Set your API key
export BIND_API_KEY="your-api-key"

# Run via stdio
npx tsx packages/mexico/bind-erp/src/index.ts

# Run via HTTP
npx tsx packages/mexico/bind-erp/src/index.ts --http
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `BIND_API_KEY` | Yes | API key from Bind ERP dashboard |
| `MCP_HTTP` | No | Set to `"true"` to enable HTTP transport |
| `MCP_PORT` | No | HTTP port (default: 3000) |

## Tools

| Tool | Description |
|------|-------------|
| `list_customers` | List customers with search and pagination |
| `create_customer` | Create a customer (name, RFC, address) |
| `list_products` | List products with search and pagination |
| `create_product` | Create a product (name, SKU, price, SAT key) |
| `list_invoices` | List invoices with status and date filters |
| `create_invoice` | Create an invoice (customer, items, CFDI settings) |
| `list_orders` | List orders with status filter |
| `create_order` | Create an order (customer, items) |
| `get_balance` | Get account balance summary |
| `list_accounts` | List accounts (bank, cash, etc.) |

## Auth

Uses **API key header** authentication (`X-API-KEY`). Obtain your API key from the [Bind ERP Dashboard](https://app.bind.com.mx/).

## API Reference

- [Bind ERP API Docs](https://developers.bind.com.mx/)

---

**Enterprise?** Contact us at [codespar.com](https://codespar.com) for dedicated support, custom integrations, and SLAs.
