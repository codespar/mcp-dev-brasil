# @codespar/mcp-onfido

MCP server for [Onfido](https://onfido.com) — global identity verification and KYC.

Onfido is the identity verification layer behind Revolut, N26, Uber, and hundreds of regulated fintechs. One API covers 195+ countries and the full KYC flow: applicant → document → live photo → check (runs verification) → reports.

Second entry in CodeSpar's `identity` category alongside [Unico](../unico) (BR-first KYC). Pair them: **Unico for Brazilian users (CPF + Receita Federal biometric pool), Onfido when the flow touches non-LatAm users**.

## Tools

| Tool | Purpose |
|------|---------|
| `create_applicant` | Create the person record (required before anything else) |
| `retrieve_applicant` | Fetch an applicant by id |
| `update_applicant` | Update applicant fields |
| `upload_document` | Upload an ID document image (multipart) |
| `retrieve_document` | Fetch a document by id |
| `upload_live_photo` | Upload a selfie / live photo (multipart) |
| `retrieve_live_photo` | Fetch a live photo by id |
| `create_check` | Run verification (document, facial_similarity_photo, watchlist, etc) |
| `retrieve_check` | Poll a check — returns overall status + per-report ids |
| `list_checks` | List all checks for an applicant |
| `retrieve_report` | Fetch an individual report with its full breakdown |

## Flow

```
create_applicant
    -> upload_document  (front, and back if driving_licence / national_identity_card)
    -> upload_live_photo
    -> create_check      report_names=["document","facial_similarity_photo","watchlist_standard"]
    -> retrieve_check    (poll until status = complete)
    -> retrieve_report   (for each report id to get the detailed breakdown)
```

## Install

```bash
npm install @codespar/mcp-onfido
```

## Environment

```bash
ONFIDO_API_TOKEN="..."    # API token (required, secret)
ONFIDO_REGION="eu"        # Optional. 'eu' | 'us' | 'ca'. Defaults to api.onfido.com.
```

## Authentication

Onfido uses a non-Bearer header format:

```
Authorization: Token token=<ONFIDO_API_TOKEN>
```

The server handles this automatically.

## Regional hosts

| Region | Host |
|--------|------|
| Default | `https://api.onfido.com` |
| EU | `https://api.eu.onfido.com` |
| US | `https://api.us.onfido.com` |
| CA | `https://api.ca.onfido.com` |

All requests target API version `v3.6` (current stable).

## Multipart uploads

`upload_document` and `upload_live_photo` accept files as **base64-encoded strings**. Pass the bytes in `file`, with `file_name` and `content_type`:

```json
{
  "applicant_id": "a1b2c3...",
  "type": "passport",
  "file": "<base64-encoded bytes>",
  "file_name": "passport.jpg",
  "content_type": "image/jpeg"
}
```

The server wraps it as `multipart/form-data` before sending.

Note: Onfido increasingly recommends capturing live photos via their SDK rather than API upload. Direct `/live_photos` upload may be restricted on some accounts — use the SDK flow when in doubt.

## Run

```bash
# stdio (default — for Claude Desktop, Cursor, etc)
npx @codespar/mcp-onfido

# HTTP (for server-to-server testing)
MCP_HTTP=true MCP_PORT=3000 npx @codespar/mcp-onfido
```

## When to pick Onfido vs Unico

| Signal | Pick |
|--------|------|
| User is Brazilian, need CPF validation + biometric match against Receita Federal | Unico |
| User is outside LatAm, or flow is global | Onfido |
| Regulated fintech needing AML watchlist + PEP screening globally | Onfido |
| Travel / gig marketplace onboarding across 20+ countries | Onfido |

## License

MIT
