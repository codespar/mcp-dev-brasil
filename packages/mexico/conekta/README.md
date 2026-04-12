# MCP Conekta

MCP server for **Conekta** — the leading Mexican payment gateway supporting cards, OXXO cash payments, and SPEI bank transfers.

## Quick Start

```bash
# Set your API key
export CONEKTA_API_KEY="key_..."

# Run via stdio
npx tsx packages/mexico/conekta/src/index.ts

# Run via HTTP
npx tsx packages/mexico/conekta/src/index.ts --http
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `CONEKTA_API_KEY` | Yes | API key from Conekta dashboard |
| `MCP_HTTP` | No | Set to `"true"` to enable HTTP transport |
| `MCP_PORT` | No | HTTP port (default: 3000) |

## Tools

| Tool | Description |
|------|-------------|
| `create_order` | Create a new order (items, customer, charges) |
| `get_order` | Get order details by ID |
| `list_orders` | List orders with filters and pagination |
| `create_customer` | Create a customer (name, email, phone) |
| `get_customer` | Get customer by ID |
| `list_customers` | List customers with pagination |
| `create_charge` | Create a charge for an existing order |
| `refund_charge` | Refund a charge (full or partial) |
| `list_payment_sources` | List payment sources for a customer |
| `get_webhook_events` | Get webhook events |

## Auth

Uses **Basic authentication** with API key as username and empty password. API version `v2.2.0` is set via the Accept header. Obtain your API key from the [Conekta Dashboard](https://panel.conekta.com/).

## API Reference

- [Conekta API Docs](https://developers.conekta.com/reference)

---

**Enterprise?** Contact us at [codespar.com](https://codespar.com) for dedicated support, custom integrations, and SLAs.
