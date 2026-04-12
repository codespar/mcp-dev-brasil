# MCP Banco Inter

MCP server for **Banco Inter** — Brazilian digital bank with a full developer API for boletos, PIX, transfers, and banking.

## Quick Start

```bash
# Set your credentials
export INTER_CLIENT_ID="your-client-id"
export INTER_CLIENT_SECRET="your-client-secret"

# Run via stdio
npx tsx packages/payments/inter-bank/src/index.ts

# Run via HTTP
npx tsx packages/payments/inter-bank/src/index.ts --http
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `INTER_CLIENT_ID` | Yes | OAuth2 client ID |
| `INTER_CLIENT_SECRET` | Yes | OAuth2 client secret |
| `MCP_HTTP` | No | Set to `"true"` to enable HTTP transport |
| `MCP_PORT` | No | HTTP port (default: 3000) |

## Tools

| Tool | Description |
|------|-------------|
| `create_boleto` | Create a boleto bancario (amount, due date, payer info) |
| `get_boleto` | Get boleto details by ID |
| `list_boletos` | List boletos with filters (date range, status) |
| `cancel_boleto` | Cancel/write-off a boleto with reason |
| `create_pix` | Create a PIX payment (amount, key, description) |
| `get_pix` | Get PIX transaction by e2eId |
| `list_pix` | List PIX transactions (date range) |
| `get_balance` | Get account balance |
| `get_statement` | Get account statement (date range) |
| `create_transfer` | Create TED or internal transfer |
| `get_webhook` | Get configured webhooks (boleto/pix) |
| `create_webhook` | Register a webhook for notifications |

## Auth

Uses **OAuth2 client credentials** flow. The token endpoint is `/oauth/v2/token` with scoped permissions per API:

- Boletos: `boleto-cobranca.read`, `boleto-cobranca.write`
- PIX: `pix.read`, `pix.write`
- Banking: `extrato.read`, `pagamento-ted.write`
- Webhooks: `webhook-boleto.read`, `webhook-boleto.write`, `webhook-pix.read`, `webhook-pix.write`

Register your application at the [Banco Inter Developer Portal](https://developers.inter.co/).

## API Reference

- [Banco Inter API Docs](https://developers.inter.co/references)
