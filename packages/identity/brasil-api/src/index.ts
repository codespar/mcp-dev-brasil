#!/usr/bin/env node

/**
 * MCP Server for BrasilAPI — public Brazilian data APIs.
 *
 * Tools:
 * - get_cep: Look up address by CEP (postal code)
 * - get_cnpj: Look up company by CNPJ
 * - get_banks: List all Brazilian banks
 * - get_holidays: List national holidays for a year
 * - get_fipe_brands: List vehicle brands by type
 * - get_fipe_price: Get FIPE vehicle price by code
 * - get_ddd: Get cities for a DDD (area code)
 * - get_isbn: Look up book by ISBN
 * - get_ncm: Look up NCM code (tax classification)
 * - get_cptec_weather: Get weather forecast for a city
 * - get_pix_participants: List Pix participant institutions (PSPs)
 * - get_domain_info: Look up domain registration info (.br)
 * - get_ibge_municipalities: List municipalities for a state (IBGE)
 * - get_tax_rates: Get current Brazilian tax rates (Selic, CDI, IPCA)
 * - get_cptec_cities: Search CPTEC cities by name
 *
 * Environment: none (public API, no authentication)
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const BASE_URL = "https://brasilapi.com.br/api";

async function brasilApiRequest(path: string): Promise<unknown> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`BrasilAPI ${res.status}: ${err}`);
  }
  return res.json();
}

const server = new Server(
  { name: "mcp-brasil-api", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "get_cep",
      description: "Look up address by CEP (Brazilian postal code)",
      inputSchema: {
        type: "object",
        properties: {
          cep: { type: "string", description: "CEP (8 digits, e.g. 01001000)" },
        },
        required: ["cep"],
      },
    },
    {
      name: "get_cnpj",
      description: "Look up company information by CNPJ",
      inputSchema: {
        type: "object",
        properties: {
          cnpj: { type: "string", description: "CNPJ (14 digits)" },
        },
        required: ["cnpj"],
      },
    },
    {
      name: "get_banks",
      description: "List all Brazilian banks with codes and names",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "get_holidays",
      description: "List national holidays for a given year",
      inputSchema: {
        type: "object",
        properties: {
          year: { type: "number", description: "Year (e.g. 2025)" },
        },
        required: ["year"],
      },
    },
    {
      name: "get_fipe_brands",
      description: "List vehicle brands by type from FIPE table",
      inputSchema: {
        type: "object",
        properties: {
          vehicle_type: { type: "string", enum: ["carros", "motos", "caminhoes"], description: "Vehicle type" },
        },
        required: ["vehicle_type"],
      },
    },
    {
      name: "get_fipe_price",
      description: "Get vehicle price from FIPE table by code",
      inputSchema: {
        type: "object",
        properties: {
          fipe_code: { type: "string", description: "FIPE code (e.g. 001004-9)" },
        },
        required: ["fipe_code"],
      },
    },
    {
      name: "get_ddd",
      description: "Get state and cities for a DDD (area code)",
      inputSchema: {
        type: "object",
        properties: {
          ddd: { type: "string", description: "DDD code (e.g. 11 for São Paulo)" },
        },
        required: ["ddd"],
      },
    },
    {
      name: "get_isbn",
      description: "Look up book information by ISBN",
      inputSchema: {
        type: "object",
        properties: {
          isbn: { type: "string", description: "ISBN (10 or 13 digits)" },
        },
        required: ["isbn"],
      },
    },
    {
      name: "get_ncm",
      description: "Look up NCM tax classification code",
      inputSchema: {
        type: "object",
        properties: {
          code: { type: "string", description: "NCM code (8 digits)" },
        },
        required: ["code"],
      },
    },
    {
      name: "get_cptec_weather",
      description: "Get weather forecast for a city (CPTEC/INPE)",
      inputSchema: {
        type: "object",
        properties: {
          city_code: { type: "number", description: "CPTEC city code" },
          days: { type: "number", description: "Number of forecast days (1-6, default 6)" },
        },
        required: ["city_code"],
      },
    },
    {
      name: "get_pix_participants",
      description: "List Pix participant institutions (PSPs/banks enrolled in Pix)",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "get_domain_info",
      description: "Look up .br domain registration info",
      inputSchema: {
        type: "object",
        properties: {
          domain: { type: "string", description: "Domain name (e.g. example.com.br)" },
        },
        required: ["domain"],
      },
    },
    {
      name: "get_ibge_municipalities",
      description: "List all municipalities for a Brazilian state (IBGE data)",
      inputSchema: {
        type: "object",
        properties: {
          uf: { type: "string", description: "State abbreviation (e.g. SP, RJ, MG)" },
        },
        required: ["uf"],
      },
    },
    {
      name: "get_tax_rates",
      description: "Get current Brazilian tax/economic rates (Selic, CDI, IPCA)",
      inputSchema: {
        type: "object",
        properties: {
          acronym: { type: "string", enum: ["SELIC", "CDI", "IPCA"], description: "Tax rate acronym" },
        },
        required: ["acronym"],
      },
    },
    {
      name: "get_cptec_cities",
      description: "Search CPTEC/INPE cities by name for weather forecasts",
      inputSchema: {
        type: "object",
        properties: {
          cityName: { type: "string", description: "City name to search" },
        },
        required: ["cityName"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "get_cep":
        return { content: [{ type: "text", text: JSON.stringify(await brasilApiRequest(`/cep/v2/${args?.cep}`), null, 2) }] };
      case "get_cnpj":
        return { content: [{ type: "text", text: JSON.stringify(await brasilApiRequest(`/cnpj/v1/${args?.cnpj}`), null, 2) }] };
      case "get_banks":
        return { content: [{ type: "text", text: JSON.stringify(await brasilApiRequest("/banks/v1"), null, 2) }] };
      case "get_holidays":
        return { content: [{ type: "text", text: JSON.stringify(await brasilApiRequest(`/feriados/v1/${args?.year}`), null, 2) }] };
      case "get_fipe_brands":
        return { content: [{ type: "text", text: JSON.stringify(await brasilApiRequest(`/fipe/marcas/v1/${args?.vehicle_type}`), null, 2) }] };
      case "get_fipe_price":
        return { content: [{ type: "text", text: JSON.stringify(await brasilApiRequest(`/fipe/preco/v1/${args?.fipe_code}`), null, 2) }] };
      case "get_ddd":
        return { content: [{ type: "text", text: JSON.stringify(await brasilApiRequest(`/ddd/v1/${args?.ddd}`), null, 2) }] };
      case "get_isbn":
        return { content: [{ type: "text", text: JSON.stringify(await brasilApiRequest(`/isbn/v1/${args?.isbn}`), null, 2) }] };
      case "get_ncm":
        return { content: [{ type: "text", text: JSON.stringify(await brasilApiRequest(`/ncm/v1/${args?.code}`), null, 2) }] };
      case "get_cptec_weather": {
        const days = args?.days || 6;
        return { content: [{ type: "text", text: JSON.stringify(await brasilApiRequest(`/cptec/v1/clima/previsao/${args?.city_code}/${days}`), null, 2) }] };
      }
      case "get_pix_participants":
        return { content: [{ type: "text", text: JSON.stringify(await brasilApiRequest("/pix/v1/participants"), null, 2) }] };
      case "get_domain_info":
        return { content: [{ type: "text", text: JSON.stringify(await brasilApiRequest(`/registrobr/v1/${args?.domain}`), null, 2) }] };
      case "get_ibge_municipalities":
        return { content: [{ type: "text", text: JSON.stringify(await brasilApiRequest(`/ibge/municipios/v1/${args?.uf}?providers=dados-abertos-br,gov,wikipedia`), null, 2) }] };
      case "get_tax_rates":
        return { content: [{ type: "text", text: JSON.stringify(await brasilApiRequest(`/taxas/v1/${args?.acronym}`), null, 2) }] };
      case "get_cptec_cities":
        return { content: [{ type: "text", text: JSON.stringify(await brasilApiRequest(`/cptec/v1/cidade/${encodeURIComponent(String(args?.cityName))}`), null, 2) }] };
      default:
        return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
    }
  } catch (err) {
    return { content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
