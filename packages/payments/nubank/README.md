# MCP Nubank

MCP server for **Nubank** — Brazil's largest digital bank, using the Open Finance Brasil standard.

## Quick Start

```bash
# Set your credentials
export NUBANK_CLIENT_ID="your-client-id"
export NUBANK_CLIENT_SECRET="your-client-secret"
export NUBANK_CERT_PATH="/path/to/certificate.pem"

# Run via stdio
npx tsx packages/payments/nubank/src/index.ts

# Run via HTTP
npx tsx packages/payments/nubank/src/index.ts --http
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NUBANK_CLIENT_ID` | Yes | OAuth2 client ID |
| `NUBANK_CLIENT_SECRET` | Yes | OAuth2 client secret |
| `NUBANK_CERT_PATH` | Yes | Path to mTLS certificate file |
| `MCP_HTTP` | No | Set to `"true"` to enable HTTP transport |
| `MCP_PORT` | No | HTTP port (default: 3000) |

## Tools

| Tool | Description |
|------|-------------|
| `get_accounts` | List all accounts (checking, savings) |
| `get_balance` | Get account balance by account ID |
| `get_transactions` | List transactions with filters (date range, type) |
| `get_credit_card_bill` | Get credit card bill (by month, status) |
| `get_investments` | List investments and yields |
| `initiate_pix` | Initiate a PIX transfer (amount, key, key type) |
| `get_pix_keys` | List registered PIX keys |
| `get_statement` | Get account statement for a period |
| `get_profile` | Get authenticated user profile |
| `list_cards` | List debit and credit cards |

## Auth

Uses **OAuth2 client credentials** flow with mTLS certificate. Register your application through Nubank's Open Finance portal to obtain credentials.

## API Reference

- [Open Finance Brasil](https://openfinancebrasil.org.br/)
- [Nubank Developer Docs](https://dev.nubank.com.br/)
