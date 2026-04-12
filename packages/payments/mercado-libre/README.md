# @codespar/mcp-mercado-libre

> MCP server for **Mercado Libre** — largest LATAM marketplace with 100M+ users across 18 countries

[![npm](https://img.shields.io/npm/v/@codespar/mcp-mercado-libre)](https://www.npmjs.com/package/@codespar/mcp-mercado-libre)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

## Quick Start

### Claude Desktop

```json
{
  "mcpServers": {
    "mercado-libre": {
      "command": "npx",
      "args": ["-y", "@codespar/mcp-mercado-libre"],
      "env": {
        "MELI_ACCESS_TOKEN": "your-access-token"
      }
    }
  }
}
```

### Claude Code

```bash
claude mcp add mercado-libre -- npx @codespar/mcp-mercado-libre
```

## Tools

| Tool | Description |
|------|-------------|
| `search_products` | Search products in Mercado Libre |
| `get_product` | Get product details by item ID |
| `get_product_description` | Get product description text |
| `list_categories` | List marketplace categories |
| `get_category` | Get category details |
| `get_seller` | Get seller information and reputation |
| `list_orders` | List seller orders with filters |
| `get_order` | Get order details |
| `get_shipment` | Get shipment tracking |
| `list_questions` | List product questions |
| `answer_question` | Answer a product question |
| `get_user` | Get authenticated user info |
| `list_listings` | List seller's active listings |
| `get_trends` | Get trending searches |

## Authentication

Mercado Libre uses OAuth2. Get your access token from the [Developers Portal](https://developers.mercadolibre.com.ar/).

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MELI_ACCESS_TOKEN` | Yes | OAuth2 access token |
| `MELI_SITE_ID` | No | Site ID (default: MLB for Brazil). Use MLA for Argentina, MLM for Mexico. |

## Enterprise

Need governance, budget limits, and audit trails for agent payments? [CodeSpar Enterprise](https://codespar.dev/enterprise) adds policy engine, payment routing, and compliance templates on top of these MCP servers.

## License

MIT
