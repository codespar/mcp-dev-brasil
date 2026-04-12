# MCP Mercado Pago

MCP server for the **Mercado Pago** payment gateway — the leading payment platform in Latin America.

## Quick Start

```bash
# Set your access token
export MERCADO_PAGO_ACCESS_TOKEN="APP_USR-..."

# Run via stdio
npx tsx packages/payments/mercado-pago/src/index.ts

# Run via HTTP
npx tsx packages/payments/mercado-pago/src/index.ts --http
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MERCADO_PAGO_ACCESS_TOKEN` | Yes | Access token from Mercado Pago dashboard |
| `MCP_HTTP` | No | Set to `"true"` to enable HTTP transport |
| `MCP_PORT` | No | HTTP port (default: 3000) |

## Tools

| Tool | Description |
|------|-------------|
| `create_payment` | Create a payment (amount, description, payment method, payer email) |
| `get_payment` | Get payment details by ID |
| `search_payments` | Search payments with filters (status, date range) |
| `create_refund` | Refund a payment (full or partial amount) |
| `create_preference` | Create Checkout Pro preference (items, back URLs) |
| `get_preference` | Get checkout preference by ID |
| `create_customer` | Create a customer (email, name) |
| `list_customers` | List/search customers |
| `get_payment_methods` | List available payment methods |
| `create_pix_payment` | Create a PIX payment (amount, payer info, CPF) |
| `get_merchant_order` | Get merchant order by ID |
| `get_balance` | Get account balance |

## Auth

Uses **Bearer token** authentication. Obtain your access token from the [Mercado Pago Developers](https://www.mercadopago.com.br/developers) dashboard.

## API Reference

- [Mercado Pago API Docs](https://www.mercadopago.com.br/developers/en/reference)
