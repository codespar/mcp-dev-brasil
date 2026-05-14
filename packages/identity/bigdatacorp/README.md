# @codespar/mcp-bigdatacorp

MCP server for **BigDataCorp** — the Brazilian data-enrichment + KYC platform. CPF / CNPJ / vehicle / property / antifraud datasets used as the standard rail in BR e-commerce + lending agents for KYC, AML, and fraud scoring.

## Quick Start

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "bigdatacorp": {
      "command": "npx",
      "args": ["@codespar/mcp-bigdatacorp"],
      "env": {
        "BIGDATACORP_ACCESS_TOKEN": "your-access-token",
        "BIGDATACORP_TOKEN_ID": "your-token-id"
      }
    }
  }
}
```

### Cursor / VS Code

Same config in `.cursor/mcp.json`.

## Tools (10)

### Core lookups

| Tool | BigDataCorp endpoint | Notes |
|---|---|---|
| `persons_lookup` | `POST /v1/datasets/persons` | CPF → name, DOB, mother's name, addresses, contacts, deceased flag |
| `companies_lookup` | `POST /v1/datasets/companies` | CNPJ → razão social, capital, partners, address, CNAE |
| `vehicles_lookup` | `POST /v1/datasets/vehicles` | Plate / chassis / RENAVAM → make, model, FIPE, ownership, restrictions |
| `properties_lookup` | `POST /v1/datasets/properties` | Address or registration → owner history + value estimate |

### Enrichment slices

| Tool | BigDataCorp endpoint | Notes |
|---|---|---|
| `financial_data` | `POST /v1/datasets/persons` | Income, score, declared assets, banking, default history |
| `employment_data` | `POST /v1/datasets/persons` | Current employer, history, monthly income, category |
| `sanctions_check` | `POST /v1/datasets/persons` | OFAC / UN / EU / BR PEP / CNJ / INSS / IBAMA screening |
| `social_signals` | `POST /v1/datasets/persons` | Instagram / LinkedIn / Twitter / Facebook presence |

### Antifraud + address

| Tool | BigDataCorp endpoint | Notes |
|---|---|---|
| `antifraud_score` | `POST /v1/datasets/antifraud` | Composite fraud score (0-1000) + decision recommendation |
| `address_validation` | `POST /v1/datasets/addresses` | CORREIOS + IBGE normalization + geocode |

## Authentication

BigDataCorp uses **paired headers** (not Bearer):

```
AccessToken: <BIGDATACORP_ACCESS_TOKEN>
TokenId:     <BIGDATACORP_TOKEN_ID>
```

Both are required on every request. Issue both credentials from the BigDataCorp platform dashboard:

- Platform: <https://plataforma.bigdatacorp.com.br>

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `BIGDATACORP_ACCESS_TOKEN` | yes | `AccessToken` header value |
| `BIGDATACORP_TOKEN_ID` | yes | `TokenId` header value (paired) |
| `BIGDATACORP_API_BASE` | no | Override base URL (default `https://plataforma.bigdatacorp.com.br`) |

## BigDataCorp vs Certta vs Caf

Three BR identity rails in this catalog, each with a different specialty:

| Provider | Strength | Best for |
|---|---|---|
| **[BigDataCorp](https://bigdatacorp.com.br)** | Broad data enrichment + antifraud | KYC + AML + credit decisioning |
| **[Certta](https://certta.com.br)** (`@codespar/mcp-certta`) | KYC + biometrics + ICP-Brasil signature | Onboarding pipelines with signed contracts |
| **[Caf](https://caf.io)** (`@codespar/mcp-caf`) | KYC + Trust Platform orchestration | Hosted onboarding flows with policy rules |

## Enterprise

Need governance, budget limits, and audit trails for agent identity calls? [CodeSpar Enterprise](https://codespar.dev/enterprise) adds policy engine, payment routing, and compliance templates on top of these MCP servers.

## License

MIT
