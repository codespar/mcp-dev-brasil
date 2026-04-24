# @codespar/mcp-braintree

MCP server for [Braintree](https://www.braintreepayments.com) (PayPal) — global card processing via the Braintree **GraphQL** API.

Target customer: LatAm SaaS selling to US/EU buyers who already hold a Braintree merchant account and want agent-driven payments, vaulting, and customer management.

## Tools

| Tool | Operation |
|------|-----------|
| `authorize_transaction` | `authorizePaymentMethod` — reserve funds without capturing |
| `charge_transaction` | `chargePaymentMethod` — authorize + capture atomically |
| `capture_transaction` | `captureTransaction` — capture a previously authorized transaction |
| `refund_transaction` | `refundTransaction` — refund a settled transaction |
| `void_transaction` | `reverseTransaction` — void an unsettled authorization |
| `vault_payment_method` | `vaultPaymentMethod` — permanently store a tokenized method |
| `delete_payment_method` | `deletePaymentMethodFromVault` — remove a vaulted method |
| `create_customer` | `createCustomer` |
| `update_customer` | `updateCustomer` |
| `get_transaction` | `search.transactions` (by id) |
| `get_customer` | `node(id: "...")` on Customer |
| `create_client_token` | `createClientToken` — mint a client-side tokenization token |

## Install

```bash
npm install @codespar/mcp-braintree
```

## Environment

```bash
BRAINTREE_MERCHANT_ID="..."   # merchant id
BRAINTREE_PUBLIC_KEY="..."    # public API key (Basic auth user)
BRAINTREE_PRIVATE_KEY="..."   # private API key (Basic auth password, secret)
BRAINTREE_ENV="sandbox"       # 'sandbox' (default) or 'production'
BRAINTREE_API_VERSION="2019-01-01"  # optional, Braintree-Version header
```

Endpoints:
- `sandbox` → `https://payments.sandbox.braintree-api.com/graphql`
- `production` → `https://payments.braintree-api.com/graphql`

## Authentication

Braintree's GraphQL endpoint accepts HTTP Basic auth with `PUBLIC_KEY:PRIVATE_KEY` base64-encoded. Every request also requires a `Braintree-Version: YYYY-MM-DD` header — the server defaults to `2019-01-01` and can be overridden with `BRAINTREE_API_VERSION`.

## Payment method ids

Most mutations take a **paymentMethodId**. These come from client-side tokenization (Braintree Drop-in / Hosted Fields / SDKs) — the server does not accept raw PANs. Use `create_client_token` to mint a token for the browser or mobile SDK.

## Run

```bash
# stdio (default — for Claude Desktop, Cursor, etc)
npx @codespar/mcp-braintree

# HTTP (for server-to-server testing)
MCP_HTTP=true MCP_PORT=3000 npx @codespar/mcp-braintree
```

## Notes

- **Amount** is a string in Braintree GraphQL (e.g. `"10.50"`), not a number. The server forwards whatever shape the agent passes; strings are the safe default.
- Braintree's GraphQL schema evolves; some input fields not exposed in the MCP `inputSchema` can still be passed in `additional` / nested objects and will be forwarded.

## License

MIT
