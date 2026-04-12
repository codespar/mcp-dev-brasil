# MCP Belvo

MCP server for **Belvo** — Open Finance aggregator for LATAM (Mexico, Argentina, Colombia).

## Quick Start

```bash
# Set your credentials
export BELVO_SECRET_ID="your-secret-id"
export BELVO_SECRET_PASSWORD="your-secret-password"
export BELVO_SANDBOX=true  # Use sandbox environment

# Run via stdio
npx tsx packages/mexico/belvo/src/index.ts

# Run via HTTP
npx tsx packages/mexico/belvo/src/index.ts --http
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `BELVO_SECRET_ID` | Yes | Secret ID from Belvo dashboard |
| `BELVO_SECRET_PASSWORD` | Yes | Secret password from Belvo dashboard |
| `BELVO_SANDBOX` | No | Set to `"true"` to use sandbox (default: production) |
| `MCP_HTTP` | No | Set to `"true"` to enable HTTP transport |
| `MCP_PORT` | No | HTTP port (default: 3000) |

## Tools

| Tool | Description |
|------|-------------|
| `list_institutions` | List available financial institutions (banks, fiscal) |
| `create_link` | Create a link to a financial institution |
| `list_links` | List existing links |
| `get_accounts` | Get accounts for a link |
| `get_balances` | Get balances for a link (date range) |
| `get_transactions` | Get transactions for a link (date range) |
| `get_owners` | Get owner information for a link |
| `get_incomes` | Get income data for a link |
| `get_tax_returns` | Get tax returns for a link (fiscal institutions) |
| `get_investments` | Get investment portfolios for a link |

## Auth

Uses **Basic authentication** (secret_id:secret_password). Obtain your credentials from the [Belvo Dashboard](https://dashboard.belvo.com/).

## API Reference

- [Belvo API Docs](https://developers.belvo.com/)

---

**Enterprise?** Contact us at [codespar.com](https://codespar.com) for dedicated support, custom integrations, and SLAs.
