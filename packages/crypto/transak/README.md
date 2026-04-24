# @codespar/mcp-transak

MCP server for **Transak** — fiat↔crypto on/off-ramp across ~170 countries with multi-chain coverage (Ethereum, Solana, Polygon, BSC, Bitcoin, Arbitrum, Optimism, Base, and more).

Transak is the natural peer to MoonPay: both solve the same problem (turn local fiat into on-chain crypto, and back), but each has its own partner list, country coverage, and pricing curve. Bundling both lets an agent-commerce flow pick the best route per corridor instead of pinning to one provider.

## Why both MoonPay and Transak

- **Coverage**: MoonPay lists ~160 countries, Transak ~170. The overlaps are large but the edges are meaningful — certain LatAm, MENA, and APAC corridors are stronger on one side than the other.
- **Partners**: each has a distinct roster of DEX/wallet/dapp partners, which changes KYC reuse and custody posture for a given buyer.
- **Pricing**: fees, FX spread, and min/max vary per corridor. An agent can call `get_quote` on both, compare, and route.
- **Redundancy**: if one provider rate-limits, de-risks a country, or throws a KYC hold, the other keeps the flow alive.

This MCP server focuses on the **Partner API** (server-to-server), not the widget. Agents create orders directly, poll status, and reconcile via webhooks.

## Status

`0.1.0-alpha.1`. The public currency, payment-method, and quote endpoints were verified live against `api-stg.transak.com`. The partner-order endpoint paths (`/api/v2/orders`, `/api/v2/orders/{id}`, `/cancel`, `/api/v2/partner/me`) follow the documented conventions but a few are only fully visible inside Transak's partner dashboard — expect minor tweaks once you pair this against a real key.

## Tools

| Tool | Description |
|------|-------------|
| `create_order` | Create a BUY (fiat→crypto) or SELL (crypto→fiat) order |
| `get_order` | Get an order by Transak id |
| `list_orders` | List orders (filter by status / wallet / partnerOrderId) |
| `cancel_order` | Cancel a pending order |
| `get_quote` | Public price quote (fee + rate + net cryptoAmount) |
| `list_fiat_currencies` | Supported fiat currencies + methods per currency |
| `list_crypto_currencies` | Supported crypto assets + networks + restrictions |
| `list_payment_methods` | Methods available for a given fiat currency |
| `get_partner_account` | Authenticated partner profile (debug / sanity check) |

## Environment

| Var | Required | Secret | Description |
|-----|----------|--------|-------------|
| `TRANSAK_API_KEY` | yes | no | Partner API key (also passed as `partnerApiKey` on public endpoints) |
| `TRANSAK_API_SECRET` | yes | yes | Partner API secret (sent as `api-secret` header) |
| `TRANSAK_ACCESS_TOKEN` | no | yes | Short-lived access token (sent as `access-token` header if your partner tier requires it) |
| `TRANSAK_ENV` | no | no | `staging` (default) or `production` |

## Install

```bash
npm install @codespar/mcp-transak
```

## Run (stdio)

```bash
TRANSAK_API_KEY=... TRANSAK_API_SECRET=... mcp-transak
```

## Run (HTTP)

```bash
TRANSAK_API_KEY=... TRANSAK_API_SECRET=... mcp-transak --http
# POST http://localhost:3000/mcp
```

## Docs

- Transak: <https://docs.transak.com>
- CodeSpar catalog: <https://github.com/codespar/mcp-dev-brasil>

## License

MIT
