# @codespar/mcp-shopify

MCP server for [Shopify](https://shopify.dev) — global ecommerce platform Admin REST API.

Shopify is the global DTC standard and dominant across LatAm for brands operating internationally (complementary to Nuvemshop/Tiendanube for regional-only merchants, also in this catalog). Agents building merchant tools — restocking, refund automation, marketing campaigns, fulfillment orchestration — integrate directly with the Admin API rather than through a reseller.

## Tools

| Tool | Purpose |
|------|---------|
| `list_orders` | List orders with status, financial, fulfillment, and date filters |
| `get_order` | Retrieve a single order by ID |
| `create_order` | Create an order (draft, phone, marketplace ingestion) |
| `update_order` | Update tags, note, shipping_address, metafields |
| `cancel_order` | Cancel with reason, optional email/restock/refund |
| `list_products` | List products with status, vendor, collection filters |
| `get_product` | Retrieve a product with variants and images |
| `create_product` | Create product with variants, options, images |
| `update_product` | Update product fields, variants, images |
| `list_customers` | List customers with full-text query |
| `create_customer` | Create a customer record |
| `adjust_inventory` | Adjust available inventory by delta at a location |
| `create_fulfillment` | Mark line items shipped, attach tracking |
| `register_webhook` | Subscribe to event topics (orders/create, products/update, etc) |

## Install

```bash
npm install @codespar/mcp-shopify
```

## Environment

```bash
SHOPIFY_SHOP="acme"               # subdomain (acme.myshopify.com)
SHOPIFY_ACCESS_TOKEN="shpat_..."  # Admin API access token (secret)
SHOPIFY_API_VERSION="2024-01"     # Optional. Defaults to 2024-01.
```

## Authentication

Private/custom app access token sent as header on every request:

```
X-Shopify-Access-Token: <SHOPIFY_ACCESS_TOKEN>
```

Create a custom app in Shopify admin → Settings → Apps and sales channels → Develop apps, grant the Admin API scopes you need (read/write orders, products, customers, inventory, fulfillments), and install to generate the token.

## Run

```bash
# stdio (default — for Claude Desktop, Cursor, etc)
npx @codespar/mcp-shopify

# HTTP (for server-to-server testing)
MCP_HTTP=true MCP_PORT=3000 npx @codespar/mcp-shopify
```

## API surface

Uses the Shopify Admin REST API at `https://{shop}.myshopify.com/admin/api/{version}`. Default version is `2024-01` (stable). Override with `SHOPIFY_API_VERSION` when newer stable versions ship.

## License

MIT
