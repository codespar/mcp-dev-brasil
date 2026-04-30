# MCP Alegra

MCP server for **Alegra** — cloud accounting platform for LATAM (Colombian-founded), supporting invoicing, contacts, inventory, and payments across CO, MX, AR, CL, and more.

## Quick Start

```bash
# Set your credentials
export ALEGRA_EMAIL="your-email@example.com"
export ALEGRA_API_TOKEN="your-api-token"

# Run via stdio
npx tsx packages/colombia/alegra/src/index.ts

# Run via HTTP
npx tsx packages/colombia/alegra/src/index.ts --http
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ALEGRA_EMAIL` | Yes | Account email address |
| `ALEGRA_API_TOKEN` | Yes | API token from Alegra settings |
| `MCP_HTTP` | No | Set to `"true"` to enable HTTP transport |
| `MCP_PORT` | No | HTTP port (default: 3000) |

## Tools (20)

| Tool | Purpose |
|---|---|
| `create_invoice` | Create an invoice |
| `get_invoice` | Get invoice details by ID |
| `list_invoices` | List invoices |
| `void_invoice` | Void/cancel an invoice |
| `get_invoice_pdf` | Get invoice PDF download URL |
| `send_invoice` | Email an invoice to one or more recipients |
| `create_contact` | Create a contact (customer or supplier) |
| `update_contact` | Update an existing contact |
| `delete_contact` | Delete a contact |
| `list_contacts` | List contacts |
| `create_item` | Create a product or service item |
| `update_item` | Update an existing item |
| `list_items` | List products and services |
| `list_payments` | List payments |
| `get_payment` | Get payment by ID |
| `create_payment` | Record a payment |
| `void_payment` | Void/annul a payment |
| `list_categories` | List item categories (chart of accounts) |
| `list_bank_accounts` | List bank accounts |
| `get_company` | Get company profile and settings |

## Auth

Uses **Basic authentication** with email and API token. Obtain your API token from the Alegra settings page under "API" section.

## API Reference

- [Alegra API Docs](https://developer.alegra.com/)

---

## Enterprise

Need governance, budget limits, and audit trails for agent payments? [CodeSpar Enterprise](https://codespar.dev/enterprise) adds policy engine, payment routing, and compliance templates on top of these MCP servers.

## Authentication

Set these environment variables before launching the server:

- `ALEGRA_EMAIL` *(required)* — Account email for Alegra
- `ALEGRA_API_TOKEN` *(required, secret)* — API token for Alegra

Issue credentials at the provider's developer portal: <https://developer.alegra.com>.

## License

MIT
