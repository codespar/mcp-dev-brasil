# MCP Siigo

MCP server for **Siigo** — Colombian accounting platform with integrated DIAN electronic invoicing.

## Quick Start

```bash
# Set your credentials
export SIIGO_API_KEY="your-api-key"
export SIIGO_ACCESS_TOKEN="your-access-token"

# Run via stdio
npx tsx packages/colombia/siigo/src/index.ts

# Run via HTTP
npx tsx packages/colombia/siigo/src/index.ts --http
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SIIGO_API_KEY` | Yes | API key from Siigo |
| `SIIGO_ACCESS_TOKEN` | Yes | Bearer access token |
| `MCP_HTTP` | No | Set to `"true"` to enable HTTP transport |
| `MCP_PORT` | No | HTTP port (default: 3000) |

## Tools (22)

| Tool | Purpose |
|---|---|
| `create_invoice` | Create an invoice (DIAN electronic invoice) |
| `get_invoice` | Get invoice details by ID |
| `list_invoices` | List invoices |
| `create_credit_note` | Create a credit note against an invoice |
| `list_customers` | List customers |
| `create_customer` | Create a customer |
| `list_products` | List products |
| `create_product` | Create a product |
| `get_invoice_pdf` | Get the PDF document for an invoice |
| `get_credit_note` | Get a credit note by ID |
| `list_credit_notes` | List credit notes |
| `update_customer` | Update an existing customer |
| `delete_customer` | Delete a customer |
| `update_product` | Update an existing product |
| `delete_product` | Delete a product |
| `create_purchase` | Create a purchase document |
| `list_purchases` | List purchase documents |
| `list_document_types` | List document types (e.g., FV for invoice, NC for credit note, FC for purchase) |
| `list_users` | List Siigo users (sellers) |
| `list_warehouses` | List warehouses (bodegas) |
| `list_taxes` | List available tax types |
| `list_payment_methods` | List available payment methods |

## Auth

Uses **Bearer token** authentication. Obtain your access token from the Siigo developer portal.

## API Reference

- [Siigo API Docs](https://siigodeveloper.siigo.com/)

---

## Enterprise

Need governance, budget limits, and audit trails for agent payments? [CodeSpar Enterprise](https://codespar.dev/enterprise) adds policy engine, payment routing, and compliance templates on top of these MCP servers.

## Authentication

Set these environment variables before launching the server:

- `SIIGO_API_KEY` *(required, secret)* — API key for Siigo
- `SIIGO_ACCESS_TOKEN` *(required, secret)* — Bearer access token

Issue credentials at the provider's developer portal: <https://siigoapi.docs.apiary.io>.

## License

MIT
