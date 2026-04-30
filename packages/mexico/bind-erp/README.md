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

## Tools (20)

| Tool | Purpose |
|---|---|
| `list_customers` | List customers |
| `create_customer` | Create a customer |
| `list_products` | List products |
| `create_product` | Create a product |
| `list_invoices` | List invoices |
| `create_invoice` | Create an invoice |
| `list_orders` | List orders |
| `create_order` | Create an order |
| `get_balance` | Get account balance summary |
| `list_accounts` | List accounts (bank accounts, cash, etc.) |
| `update_customer` | Update an existing customer |
| `delete_customer` | Delete a customer by ID |
| `update_product` | Update an existing product |
| `delete_product` | Delete a product by ID |
| `get_invoice` | Get an invoice (CFDI) by ID |
| `cancel_invoice` | Cancel an invoice (CFDI) by ID |
| `list_suppliers` | List suppliers (proveedores) |
| `create_supplier` | Create a supplier (proveedor) |
| `list_payments` | List payments (pagos) |
| `create_payment` | Register a payment (pago) against an invoice |

## Auth

Uses **API key header** authentication (`X-API-KEY`). Obtain your API key from the [Bind ERP Dashboard](https://app.bind.com.mx/).

## API Reference

- [Bind ERP API Docs](https://developers.bind.com.mx/)

---

## Enterprise

Need governance, budget limits, and audit trails for agent payments? [CodeSpar Enterprise](https://codespar.dev/enterprise) adds policy engine, payment routing, and compliance templates on top of these MCP servers.

## Authentication

Set these environment variables before launching the server:

- `BIND_API_KEY` *(required, secret)* — API key for Bind ERP

Issue credentials at the provider's developer portal: <https://www.bind.com.mx/desarrolladores>.

## License

MIT
