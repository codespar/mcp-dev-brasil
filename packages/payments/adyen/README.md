# @codespar/mcp-adyen

MCP server for [Adyen Checkout API v71](https://docs.adyen.com/api-explorer/Checkout/71/overview) — the global enterprise payments rail used by iFood, Uber, Spotify, and AirBnB in LatAm.

Distinct from every other server in our catalog: it's the one gateway enterprise merchants choose when a single contract has to cover BR + EU + US + APAC.

## Tools (15)

**Payments**
- `create_payment` — direct payment
- `payment_details` — submit 3DS challenge / redirect result
- `capture_payment` — capture a delayed authorization
- `cancel_payment` — cancel uncaptured
- `refund_payment` — full or partial refund
- `reverse_payment` — void-or-refund atomic
- `update_amount` — change authorized amount (tips, hotel incidentals)

**Discovery**
- `get_payment_methods` — dynamic per country/currency/amount

**Payment Links**
- `create_payment_link`
- `get_payment_link`
- `update_payment_link` — typically to expire early

**Donations**
- `create_donation` — Adyen Giving round-up

**Stored methods**
- `list_stored_payment_methods` — one-click recall
- `disable_stored_payment_method` — shopper opt-out

**Sessions**
- `create_session` — Drop-in / Web Components initialization

## Install

```bash
npm install @codespar/mcp-adyen
```

## Environment

```bash
ADYEN_API_KEY="..."              # X-API-Key value, secret
ADYEN_MERCHANT_ACCOUNT="..."     # Merchant account code injected into every call
ADYEN_ENV="test"                 # test | live. Default: test.
ADYEN_LIVE_URL_PREFIX="..."      # Required when ADYEN_ENV=live. Your merchant-specific prefix from Customer Area.
```

## URL routing

- `ADYEN_ENV=test` → `https://checkout-test.adyen.com/v71`
- `ADYEN_ENV=live` → `https://<ADYEN_LIVE_URL_PREFIX>-checkout-live.adyenpayments.com/checkout/v71`

Live calls fail fast if `ADYEN_LIVE_URL_PREFIX` is missing.

## Run

```bash
# stdio (default)
npx @codespar/mcp-adyen

# HTTP
MCP_HTTP=true MCP_PORT=3000 npx @codespar/mcp-adyen
```

## Scope

This v0.1 covers **Checkout API v71** only. Separate packages for Adyen **Payouts**, **Management**, and **Balance Platform** APIs follow when demand emerges — each has distinct auth, URL prefix rules, and use cases.

## License

MIT
