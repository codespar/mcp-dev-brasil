# @codespar/mcp-iniciador

MCP server for **Iniciador** — Open Finance Brasil PISP (Pix payment initiation aggregator). Iniciador holds the ICP-Brasil certificate and orchestrates DCR with each Brazilian bank for instant Pix-out flows.

## Quick Start

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "iniciador": {
      "command": "npx",
      "args": ["@codespar/mcp-iniciador"],
      "env": {
        "INICIADOR_API_KEY": "your-api-key"
      }
    }
  }
}
```

### Cursor / VS Code

Same config in `.cursor/mcp.json`.

## Tools (9)

### Institutions

| Tool | Iniciador endpoint | Notes |
|---|---|---|
| `list_institutions` | `GET /institutions` | Brazilian banks supported for Pix initiation |

### Consents

| Tool | Iniciador endpoint | Notes |
|---|---|---|
| `create_consent` | `POST /consents` | Payment consent for the payer to authorize at their bank |
| `get_consent` | `GET /consents/{id}` | Current authorization status |
| `revoke_consent` | `DELETE /consents/{id}` | Revoke before exercise |

### Payments

| Tool | Iniciador endpoint | Notes |
|---|---|---|
| `create_payment` | `POST /payments` | Initiate Pix once consent is authorized |
| `get_payment` | `GET /payments/{id}` | Status / E2E id / rejection reason |
| `list_payments` | `GET /payments` | Filter by date range / status |
| `cancel_payment` | `POST /payments/{id}/cancel` | Best-effort cancel before settlement |

### Helpers

| Tool | Notes |
|---|---|
| `get_authorization_url` | Client-side builder for the OFB authorization URL (consent id + ISPB + redirect) |

## Authentication

This server uses Iniciador's API key auth (`X-API-KEY` header). The Pix-out call itself is signed end-to-end with the consumer's bank-issued consent token, which Iniciador's backend stitches in after the payer authorizes the consent at their bank. OAuth2 client-credentials is required for some flows and lands when consent + bank-issued token plumbing is wired end-to-end.

Issue credentials during Iniciador onboarding:

- Production: <https://iniciador.com.br>
- Docs: <https://docs.iniciador.com.br>

## Sandbox / Testing

Sandbox endpoint: `https://sandbox.iniciador.com.br`. Override via `INICIADOR_API_BASE`.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `INICIADOR_API_KEY` | yes | API key from Iniciador onboarding |
| `INICIADOR_API_BASE` | no | Override API base URL (default `https://api.iniciador.com.br`) |

## Iniciador vs Pluggy vs Belvo

Three OFB aggregators in this catalog, each with a different specialty:

| Aggregator | Strength | Best for |
|---|---|---|
| **[Iniciador](https://iniciador.com.br)** | Pix payment initiation (PISP) | Outgoing payments under OFB consent |
| **[Pluggy](https://www.pluggy.ai/en)** (`@codespar/mcp-pluggy`) | Account + transaction reads | Reconciliation, balance polling |
| **[Belvo](https://belvo.com/pt-br/)** (`@codespar/mcp-belvo`) | Multi-LATAM Open Finance + payroll + tax | Cross-border (BR + MX + CO + AR) |

For commerce agents that need both reads and writes, compose them — Pluggy/Belvo for account + recon visibility + Iniciador for Pix initiation.

## Enterprise

Need governance, budget limits, and audit trails for agent payments? [CodeSpar Enterprise](https://codespar.dev/enterprise) adds policy engine, payment routing, and compliance templates on top of these MCP servers.

## License

MIT
