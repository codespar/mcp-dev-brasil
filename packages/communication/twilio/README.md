# @codespar/mcp-twilio

MCP server for [Twilio](https://www.twilio.com) — the global standard for programmable messaging and voice.

SMS, WhatsApp, and Voice across 180+ countries. Verify (2FA) and Lookup (phone validation) included. Fills the global messaging gap in a catalog otherwise tilted to Brazil-specific providers (Z-API, Take Blip, Zenvia, Evolution API).

## Tools

| Tool | Purpose |
|------|---------|
| `send_message` | Send an SMS or WhatsApp message (prefix `To` with `whatsapp:+E164` for WhatsApp) |
| `get_message` | Retrieve a message by SID |
| `list_messages` | List messages with optional filters (To, From, DateSent) |
| `delete_message` | Delete a message from history |
| `make_call` | Place an outbound voice call driven by a TwiML `Url` |
| `get_call` | Retrieve a call by SID |
| `update_call` | Hang up or redirect an in-progress call |
| `start_verification` | Send a Verify (2FA) code via sms / whatsapp / call |
| `check_verification` | Check a Verify (2FA) code |
| `lookup_phone` | Validate + format + classify a phone number (Lookups v2) |
| `list_incoming_numbers` | List your Twilio-provisioned phone numbers |
| `buy_phone_number` | Provision a new phone number |

## Install

```bash
npm install @codespar/mcp-twilio
```

## Environment

```bash
TWILIO_ACCOUNT_SID="AC..."             # required
TWILIO_AUTH_TOKEN="..."                # required (secret)
TWILIO_MESSAGING_SERVICE_SID="MG..."   # optional; default sender for send_message
```

## Authentication

HTTP Basic auth with `AccountSid:AuthToken`. The server handles this automatically — you only configure the env vars.

```
Authorization: Basic <base64(AccountSid:AuthToken)>
```

## API surface

- Main Accounts API: `https://api.twilio.com/2010-04-01/Accounts/{AccountSid}` — Messages, Calls, IncomingPhoneNumbers
- Verify API: `https://verify.twilio.com/v2` — 2FA flows (requires a Verify Service SID passed per call)
- Lookups API: `https://lookups.twilio.com/v2` — phone number validation / carrier / line type

Request bodies are `application/x-www-form-urlencoded`; responses are JSON (endpoints use the `.json` suffix on the Accounts API).

## WhatsApp

Use the same `send_message` tool, but prefix numbers with `whatsapp:`:

```json
{ "To": "whatsapp:+5511999999999", "From": "whatsapp:+14155238886", "Body": "Olá" }
```

Sandbox numbers or approved WhatsApp-enabled senders work the same way.

## Run

```bash
# stdio (default — for Claude Desktop, Cursor, etc)
npx @codespar/mcp-twilio

# HTTP (for server-to-server testing)
MCP_HTTP=true MCP_PORT=3000 npx @codespar/mcp-twilio
```

## License

MIT
