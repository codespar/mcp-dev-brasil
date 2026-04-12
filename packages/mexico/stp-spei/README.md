# MCP STP/SPEI

MCP server for **STP/SPEI** — Mexican instant bank transfer system (equivalent to Brazil's PIX).

## Quick Start

```bash
# Set your credentials
export STP_API_KEY="your-api-key"
export STP_COMPANY="your-company-id"

# Run via stdio
npx tsx packages/mexico/stp-spei/src/index.ts

# Run via HTTP
npx tsx packages/mexico/stp-spei/src/index.ts --http
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `STP_API_KEY` | Yes | API key from STP |
| `STP_COMPANY` | Yes | Company identifier |
| `MCP_HTTP` | No | Set to `"true"` to enable HTTP transport |
| `MCP_PORT` | No | HTTP port (default: 3000) |

## Tools

| Tool | Description |
|------|-------------|
| `create_transfer` | Create a SPEI transfer (amount, beneficiary CLABE, concept) |
| `get_transfer` | Get transfer details by tracking key |
| `list_transfers` | List transfers with date/status filters |
| `get_balance` | Get account balance |
| `validate_account` | Validate a CLABE account number |
| `list_banks` | List participating SPEI banks |
| `get_cep` | Get CEP (electronic payment receipt) for validation |
| `register_beneficiary` | Register a beneficiary account |

## Auth

Uses **API key + digital signature** authentication. The API key is sent as a Bearer token, and the company identifier is included in requests. Obtain credentials from [STP](https://www.stp.mx/).

## API Reference

- [STP API Docs](https://stpmex.com/documentacion)

---

**Enterprise?** Contact us at [codespar.com](https://codespar.com) for dedicated support, custom integrations, and SLAs.
