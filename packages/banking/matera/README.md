# @codespar/mcp-matera

> MCP server for **Matera** — Brazilian core-banking infrastructure (BaaS) for fintechs building on top of Pix, DICT, and Pix Automático

[![npm](https://img.shields.io/npm/v/@codespar/mcp-matera)](https://www.npmjs.com/package/@codespar/mcp-matera)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

## Why Matera

Matera is **core-banking infrastructure**, not a PSP. Per vendor case studies it processes roughly 10% of Brazil's Pix transactions. Its customer is a **fintech building on top of Pix** — issuing accounts, moving money through DICT, registering Pix Automático agreements — **not a merchant accepting Pix** (that's what Zoop / Asaas / Mercado Pago are for).

This opens a segment in the CodeSpar catalog distinct from PSP servers: **fintech-building-on-top-of-Pix**. Matera sits under `banking` alongside Stark Bank and Open Finance, not under `payments`.

Use Matera when an agent needs to:
- Spin up Pix charges against accounts the fintech itself issued
- Do DICT lookups to resolve a Pix key before moving money
- Register recurring **Pix Automático** agreements (BCB 2025 product — few providers are live with this)
- Move money bank-to-bank through the fintech's own Matera rails

## Quick Start

### Claude Desktop

Add to `~/.config/claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "matera": {
      "command": "npx",
      "args": ["-y", "@codespar/mcp-matera"],
      "env": {
        "MATERA_CLIENT_ID": "your-client-id",
        "MATERA_CLIENT_SECRET": "your-client-secret"
      }
    }
  }
}
```

### Claude Code

```bash
claude mcp add matera -- npx @codespar/mcp-matera
```

### Cursor / VS Code

Add to `.cursor/mcp.json` or `.vscode/mcp.json`:

```json
{
  "servers": {
    "matera": {
      "command": "npx",
      "args": ["-y", "@codespar/mcp-matera"],
      "env": {
        "MATERA_CLIENT_ID": "your-client-id",
        "MATERA_CLIENT_SECRET": "your-client-secret"
      }
    }
  }
}
```

## Tools

| Tool | Description |
|------|-------------|
| `create_pix_charge_static` | Static Pix QR code (reusable, tied to a merchant Pix key) |
| `create_pix_charge_dynamic` | Dynamic Pix QR code (single-use, expiring) |
| `get_pix_charge` | Retrieve a Pix charge by txid |
| `create_pix_payment` | Initiate an outbound Pix transfer |
| `get_pix_payment` | Retrieve an outbound Pix payment by endToEndId |
| `refund_pix_payment` | Refund (devolução) a Pix payment |
| `list_pix_payments` | List Pix payments with filters (start, end, status) |
| `resolve_pix_key` | DICT lookup — resolve a Pix key to account info |
| `list_dict_keys` | List DICT keys registered to merchant accounts |
| `create_pix_automatico` | Register a recurring Pix Automático agreement (BCB 2025) |

## Authentication

Matera uses **OAuth 2.0 client_credentials**. The server calls `POST /auth/token` with HTTP Basic auth and caches the bearer token in memory until a minute before expiry.

Matera also supports `secret-key` + `data-signature` headers for signed server-to-server calls. That path is not implemented in v0.1; OAuth2 is sufficient for every tool above.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MATERA_CLIENT_ID` | Yes | OAuth2 client_id issued by Matera |
| `MATERA_CLIENT_SECRET` | Yes | OAuth2 client_secret (secret) |
| `MATERA_BASE_URL` | No | API base URL. Defaults to `https://api.matera.com`. Sandbox URL varies per product line — ask your Matera contact. |

## Status

v0.1 — scaffold. Endpoint paths follow Matera's published doc structure but were not validated against a live sandbox. Expect small adjustments to paths and request shapes once the team has credentials. Schemas are deliberately lightweight — only required fields are marked `required`; nested objects accept any shape so agents can pass through fields we haven't modeled yet.

## Roadmap

### v0.2 (planned)
- Signed-request auth path (`secret-key` + `data-signature`) for endpoints that require it
- Account opening (abertura de conta) — Matera IB product
- TED / bank transfers (non-Pix rails)
- Webhook event helpers

### v0.3 (planned)
- Internet Banking Server tools (statements, balances, card management)
- Boleto issuance
- Pix MED (Mecanismo Especial de Devolução) flow

Want to contribute? [Open a PR](https://github.com/codespar/mcp-dev-brasil) or [request a tool](https://github.com/codespar/mcp-dev-brasil/issues).

## Links

- [Matera](https://matera.com)
- [Matera API Documentation](https://doc-api.matera.com)
- [MCP Dev Brasil](https://github.com/codespar/mcp-dev-brasil)
- [Landing Page](https://codespar.dev/mcp)

## Enterprise

Need governance, budget limits, and audit trails for agent-initiated bank transfers? [CodeSpar Enterprise](https://codespar.dev/enterprise) adds policy engine, payment routing, and compliance templates on top of these MCP servers.

## License

MIT
