#!/usr/bin/env node

/**
 * MCP Server for VTEX — Brazilian e-commerce platform.
 *
 * Tools:
 * - list_products: List products from catalog
 * - get_product: Get product details by ID
 * - list_orders: List orders with filters
 * - get_order: Get order details by ID
 * - list_skus: List SKUs for a product
 * - get_inventory: Get inventory/stock for a SKU
 * - update_inventory: Update inventory for a SKU at a warehouse
 * - get_shipping_rates: Get shipping rates simulation
 * - create_promotion: Create a promotion/discount
 * - get_catalog: Get catalog category tree
 * - create_product: Create a new product in the catalog
 * - update_product: Update an existing product
 * - create_sku: Create a new SKU for a product
 * - create_category: Create a new category
 * - list_categories: List categories with pagination
 *
 * Environment:
 *   VTEX_ACCOUNT_NAME — VTEX account name
 *   VTEX_APP_KEY — API app key
 *   VTEX_APP_TOKEN — API app token
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const ACCOUNT_NAME = process.env.VTEX_ACCOUNT_NAME || "";
const APP_KEY = process.env.VTEX_APP_KEY || "";
const APP_TOKEN = process.env.VTEX_APP_TOKEN || "";
const BASE_URL = `https://${ACCOUNT_NAME}.vtexcommercestable.com.br/api`;

async function vtexRequest(method: string, path: string, body?: unknown): Promise<unknown> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "X-VTEX-API-AppKey": APP_KEY,
      "X-VTEX-API-AppToken": APP_TOKEN,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`VTEX API ${res.status}: ${err}`);
  }
  return res.json();
}

const server = new Server(
  { name: "mcp-vtex", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "list_products",
      description: "List products from VTEX catalog",
      inputSchema: {
        type: "object",
        properties: {
          from: { type: "number", description: "Start index (default 1)" },
          to: { type: "number", description: "End index (default 10)" },
          categoryId: { type: "number", description: "Filter by category ID" },
        },
      },
    },
    {
      name: "get_product",
      description: "Get product details by ID",
      inputSchema: {
        type: "object",
        properties: {
          productId: { type: "number", description: "Product ID" },
        },
        required: ["productId"],
      },
    },
    {
      name: "list_orders",
      description: "List orders with optional filters",
      inputSchema: {
        type: "object",
        properties: {
          status: { type: "string", description: "Filter by status (e.g., ready-for-handling, payment-approved)" },
          page: { type: "number", description: "Page number (default 1)" },
          per_page: { type: "number", description: "Items per page (default 15)" },
          q: { type: "string", description: "Search query (order ID, customer name, email)" },
          f_creationDate: { type: "string", description: "Date range filter (e.g., creationDate:[2024-01-01T00:00:00.000Z TO 2024-12-31T23:59:59.999Z])" },
        },
      },
    },
    {
      name: "get_order",
      description: "Get order details by ID",
      inputSchema: {
        type: "object",
        properties: {
          orderId: { type: "string", description: "Order ID" },
        },
        required: ["orderId"],
      },
    },
    {
      name: "list_skus",
      description: "List SKUs for a product",
      inputSchema: {
        type: "object",
        properties: {
          productId: { type: "number", description: "Product ID" },
        },
        required: ["productId"],
      },
    },
    {
      name: "get_inventory",
      description: "Get inventory/stock for a SKU across warehouses",
      inputSchema: {
        type: "object",
        properties: {
          skuId: { type: "number", description: "SKU ID" },
        },
        required: ["skuId"],
      },
    },
    {
      name: "update_inventory",
      description: "Update inventory quantity for a SKU at a specific warehouse",
      inputSchema: {
        type: "object",
        properties: {
          skuId: { type: "number", description: "SKU ID" },
          warehouseId: { type: "string", description: "Warehouse ID" },
          quantity: { type: "number", description: "New quantity" },
          unlimitedQuantity: { type: "boolean", description: "Set unlimited quantity (default false)" },
        },
        required: ["skuId", "warehouseId", "quantity"],
      },
    },
    {
      name: "get_shipping_rates",
      description: "Simulate shipping rates for items to a postal code",
      inputSchema: {
        type: "object",
        properties: {
          postalCode: { type: "string", description: "Destination postal code (CEP)" },
          country: { type: "string", description: "Country code (default BRA)" },
          items: {
            type: "array",
            description: "Items to simulate",
            items: {
              type: "object",
              properties: {
                id: { type: "string", description: "SKU ID" },
                quantity: { type: "number" },
                seller: { type: "string", description: "Seller ID (default 1)" },
              },
            },
          },
        },
        required: ["postalCode", "items"],
      },
    },
    {
      name: "create_promotion",
      description: "Create a promotion/discount in VTEX",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Promotion name" },
          type: { type: "string", enum: ["regular", "combo", "forThePriceOf", "progressive", "buyAndWin", "campaign"], description: "Promotion type" },
          beginDateUtc: { type: "string", description: "Start date (ISO 8601)" },
          endDateUtc: { type: "string", description: "End date (ISO 8601)" },
          isActive: { type: "boolean", description: "Active status" },
          percentualDiscountValue: { type: "number", description: "Percentage discount (0-100)" },
          nominalDiscountValue: { type: "number", description: "Fixed discount amount" },
        },
        required: ["name", "type", "beginDateUtc", "endDateUtc"],
      },
    },
    {
      name: "get_catalog",
      description: "Get the catalog category tree",
      inputSchema: {
        type: "object",
        properties: {
          levels: { type: "number", description: "Number of category tree levels (default 3)" },
        },
      },
    },
    {
      name: "create_product",
      description: "Create a new product in the VTEX catalog",
      inputSchema: {
        type: "object",
        properties: {
          Name: { type: "string", description: "Product name" },
          CategoryId: { type: "number", description: "Category ID" },
          BrandId: { type: "number", description: "Brand ID" },
          IsVisible: { type: "boolean", description: "Product visibility (default true)" },
          Description: { type: "string", description: "Product description (HTML supported)" },
          DescriptionShort: { type: "string", description: "Short description" },
          RefId: { type: "string", description: "Reference ID (internal code)" },
          Title: { type: "string", description: "Page title (SEO)" },
          LinkId: { type: "string", description: "URL slug" },
          IsActive: { type: "boolean", description: "Active status (default true)" },
        },
        required: ["Name", "CategoryId", "BrandId"],
      },
    },
    {
      name: "update_product",
      description: "Update an existing product in the VTEX catalog",
      inputSchema: {
        type: "object",
        properties: {
          productId: { type: "number", description: "Product ID to update" },
          Name: { type: "string", description: "Product name" },
          CategoryId: { type: "number", description: "Category ID" },
          BrandId: { type: "number", description: "Brand ID" },
          IsVisible: { type: "boolean", description: "Product visibility" },
          Description: { type: "string", description: "Product description" },
          IsActive: { type: "boolean", description: "Active status" },
        },
        required: ["productId"],
      },
    },
    {
      name: "create_sku",
      description: "Create a new SKU for a product",
      inputSchema: {
        type: "object",
        properties: {
          ProductId: { type: "number", description: "Parent product ID" },
          Name: { type: "string", description: "SKU name" },
          RefId: { type: "string", description: "Reference ID (internal code)" },
          PackagedHeight: { type: "number", description: "Packaged height in cm" },
          PackagedLength: { type: "number", description: "Packaged length in cm" },
          PackagedWidth: { type: "number", description: "Packaged width in cm" },
          PackagedWeightKg: { type: "number", description: "Packaged weight in kg" },
          IsActive: { type: "boolean", description: "Active status" },
        },
        required: ["ProductId", "Name"],
      },
    },
    {
      name: "create_category",
      description: "Create a new category in the catalog",
      inputSchema: {
        type: "object",
        properties: {
          Name: { type: "string", description: "Category name" },
          FatherCategoryId: { type: "number", description: "Parent category ID (null for root)" },
          Title: { type: "string", description: "Page title (SEO)" },
          Description: { type: "string", description: "Category description" },
          Keywords: { type: "string", description: "SEO keywords (comma-separated)" },
          IsActive: { type: "boolean", description: "Active status (default true)" },
          ShowInStoreFront: { type: "boolean", description: "Show in store navigation" },
        },
        required: ["Name"],
      },
    },
    {
      name: "list_categories",
      description: "List all categories with pagination",
      inputSchema: {
        type: "object",
        properties: {
          from: { type: "number", description: "Start index (default 1)" },
          to: { type: "number", description: "End index (default 10)" },
        },
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "list_products": {
        const from = args?.from || 1;
        const to = args?.to || 10;
        const params = args?.categoryId ? `&categoryId=${args.categoryId}` : "";
        return { content: [{ type: "text", text: JSON.stringify(await vtexRequest("GET", `/catalog_system/pub/products/search?_from=${from}&_to=${to}${params}`), null, 2) }] };
      }
      case "get_product":
        return { content: [{ type: "text", text: JSON.stringify(await vtexRequest("GET", `/catalog/pvt/product/${args?.productId}`), null, 2) }] };
      case "list_orders": {
        const params = new URLSearchParams();
        if (args?.status) params.set("f_status", String(args.status));
        if (args?.page) params.set("page", String(args.page));
        if (args?.per_page) params.set("per_page", String(args.per_page));
        if (args?.q) params.set("q", String(args.q));
        if (args?.f_creationDate) params.set("f_creationDate", String(args.f_creationDate));
        return { content: [{ type: "text", text: JSON.stringify(await vtexRequest("GET", `/oms/pvt/orders?${params}`), null, 2) }] };
      }
      case "get_order":
        return { content: [{ type: "text", text: JSON.stringify(await vtexRequest("GET", `/oms/pvt/orders/${args?.orderId}`), null, 2) }] };
      case "list_skus":
        return { content: [{ type: "text", text: JSON.stringify(await vtexRequest("GET", `/catalog_system/pvt/sku/stockkeepingunitByProductId/${args?.productId}`), null, 2) }] };
      case "get_inventory":
        return { content: [{ type: "text", text: JSON.stringify(await vtexRequest("GET", `/logistics/pvt/inventory/skus/${args?.skuId}`), null, 2) }] };
      case "update_inventory": {
        const payload = {
          quantity: args?.quantity,
          unlimitedQuantity: args?.unlimitedQuantity ?? false,
        };
        return { content: [{ type: "text", text: JSON.stringify(await vtexRequest("PUT", `/logistics/pvt/inventory/skus/${args?.skuId}/warehouses/${args?.warehouseId}`, payload), null, 2) }] };
      }
      case "get_shipping_rates": {
        const payload = {
          postalCode: args?.postalCode,
          country: args?.country || "BRA",
          items: args?.items,
        };
        return { content: [{ type: "text", text: JSON.stringify(await vtexRequest("POST", "/checkout/pub/orderForms/simulation", payload), null, 2) }] };
      }
      case "create_promotion":
        return { content: [{ type: "text", text: JSON.stringify(await vtexRequest("POST", "/rnb/pvt/calculatorconfiguration", args), null, 2) }] };
      case "get_catalog": {
        const levels = args?.levels || 3;
        return { content: [{ type: "text", text: JSON.stringify(await vtexRequest("GET", `/catalog_system/pub/category/tree/${levels}`), null, 2) }] };
      }
      case "create_product": {
        const { ...productData } = args as Record<string, unknown>;
        return { content: [{ type: "text", text: JSON.stringify(await vtexRequest("POST", "/catalog/pvt/product", productData), null, 2) }] };
      }
      case "update_product": {
        const { productId, ...productData } = args as Record<string, unknown>;
        return { content: [{ type: "text", text: JSON.stringify(await vtexRequest("PUT", `/catalog/pvt/product/${productId}`, productData), null, 2) }] };
      }
      case "create_sku": {
        const { ...skuData } = args as Record<string, unknown>;
        return { content: [{ type: "text", text: JSON.stringify(await vtexRequest("POST", "/catalog/pvt/stockkeepingunit", skuData), null, 2) }] };
      }
      case "create_category": {
        const { ...categoryData } = args as Record<string, unknown>;
        return { content: [{ type: "text", text: JSON.stringify(await vtexRequest("POST", "/catalog/pvt/category", categoryData), null, 2) }] };
      }
      case "list_categories": {
        const from = args?.from || 1;
        const to = args?.to || 10;
        return { content: [{ type: "text", text: JSON.stringify(await vtexRequest("GET", `/catalog_system/pvt/category/GetCategoryList?_from=${from}&_to=${to}`), null, 2) }] };
      }
      default:
        return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
    }
  } catch (err) {
    return { content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
  }
});

async function main() {
  if (!ACCOUNT_NAME || !APP_KEY || !APP_TOKEN) {
    console.error("VTEX_ACCOUNT_NAME, VTEX_APP_KEY, and VTEX_APP_TOKEN environment variables are required");
    process.exit(1);
  }
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
