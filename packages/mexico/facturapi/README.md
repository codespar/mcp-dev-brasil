# MCP FacturAPI

MCP server for **FacturAPI** — Mexican CFDI e-invoicing platform (equivalent to Brazil's NFe).

## Quick Start

```bash
# Set your API key
export FACTURAPI_API_KEY="sk_..."

# Run via stdio
npx tsx packages/mexico/facturapi/src/index.ts

# Run via HTTP
npx tsx packages/mexico/facturapi/src/index.ts --http
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `FACTURAPI_API_KEY` | Yes | API key from FacturAPI dashboard |
| `MCP_HTTP` | No | Set to `"true"` to enable HTTP transport |
| `MCP_PORT` | No | HTTP port (default: 3000) |

## Tools

| Tool | Description |
|------|-------------|
| `create_invoice` | Create a CFDI invoice (customer, items, payment form) |
| `get_invoice` | Get invoice by ID |
| `list_invoices` | List invoices with filters (status, date range) |
| `cancel_invoice` | Cancel an invoice with SAT motive |
| `download_invoice_pdf` | Download invoice as PDF |
| `download_invoice_xml` | Download invoice as XML (CFDI) |
| `create_customer` | Create a customer (RFC, legal name, tax system) |
| `get_customer` | Get customer by ID |
| `list_products` | List products with pagination |
| `create_product` | Create a product (SAT product key, price, unit) |

## Auth

Uses **Bearer token** authentication. Obtain your API key from the [FacturAPI Dashboard](https://www.facturapi.io/).

## API Reference

- [FacturAPI Docs](https://docs.facturapi.io/)

---

**Enterprise?** Contact us at [codespar.com](https://codespar.com) for dedicated support, custom integrations, and SLAs.
