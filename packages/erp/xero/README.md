# @codespar/mcp-xero

MCP server for [Xero](https://www.xero.com) — global cloud accounting for SMBs.

Xero is the #2 global SMB ERP and the leader in the UK, Australia, and New Zealand, with rapid expansion in the US. Paired with QuickBooks, the two platforms cover roughly 80% of global SMB accounting. For LatAm SaaS serving US/UK/AU/NZ customers or with international subsidiaries, Xero is the essential complement to our Brazil-native ERPs (Omie, Conta Azul, Bling, Tiny).

## Tools

| Tool | Purpose |
|------|---------|
| `create_contact` | Create a customer or supplier |
| `get_contact` | Retrieve a contact by ContactID |
| `list_contacts` | List contacts with optional where clause |
| `create_invoice` | Issue an AR (ACCREC) or AP (ACCPAY) invoice |
| `get_invoice` | Retrieve an invoice by ID or number |
| `list_invoices` | List invoices with where clause / status filter |
| `email_invoice` | Email an AUTHORISED invoice to the contact |
| `create_payment` | Record a payment against an invoice |
| `create_item` | Create an inventory/product item |
| `list_items` | List items |
| `list_accounts` | List the chart of accounts |
| `get_balance_sheet` | Pull the Balance Sheet report |

## Install

```bash
npm install @codespar/mcp-xero
```

## Environment

```bash
XERO_ACCESS_TOKEN="..."   # OAuth2 bearer access token (required, secret)
XERO_TENANT_ID="..."      # Xero tenant/organization id (required)
```

## Authentication

Xero uses OAuth2. Every request includes:

```
Authorization: Bearer <XERO_ACCESS_TOKEN>
Xero-tenant-id: <XERO_TENANT_ID>
Accept: application/json
Content-Type: application/json
```

This server assumes a **pre-issued access token**. OAuth consent, refresh-token rotation, and tenant selection happen upstream (in your OAuth proxy or secrets layer). When the token expires, Xero returns 401 and the tool surfaces the error verbatim — refresh and retry.

## Run

```bash
# stdio (default — Claude Desktop, Cursor, etc)
npx @codespar/mcp-xero

# HTTP (server-to-server testing)
MCP_HTTP=true MCP_PORT=3000 npx @codespar/mcp-xero
```

## Where clause

Xero's list endpoints accept a `where` query param for server-side filtering. Examples:

```
Name.Contains("ACME")
IsCustomer==true
Status=="AUTHORISED" AND Type=="ACCREC"
Date>=DateTime(2026,1,1)
Contact.ContactID==guid("00000000-0000-0000-0000-000000000000")
```

## Positioning in the CodeSpar ERP catalog

- **Brazil-native:** Omie, Conta Azul, Bling, Tiny — NF-e, Simples Nacional, local tax.
- **Global SMB:** **Xero** + QuickBooks — US/UK/AU/NZ/global accounting.

Use Xero for companies headquartered or operating outside Brazil (or with international entities). Use the BR-native servers for the local market.

## Docs

- Xero Accounting API: https://developer.xero.com/documentation/api/accounting
- Xero OAuth2 guide: https://developer.xero.com/documentation/guides/oauth2/overview

## License

MIT
