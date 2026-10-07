# Gwani WhatsApp linked-device channel

Masanawa WhatsApp production transport is a single admin-owned linked-device session.

## Product model

- One dedicated WhatsApp or WhatsApp Business number represents Gwani/Masanawa.
- An administrator links that number once by scanning a QR code from the phone's Linked devices screen.
- Customers never scan a QR code and never connect their own WhatsApp accounts.
- Incoming WhatsApp messages enter the same canonical CustomerChannelBridge and Agent conversation runtime used by the mobile app.
- Billing, crypto, Teaching, memory, wallet and other Skills therefore remain canonical Masanawa services rather than WhatsApp-specific copies.
- New direct WhatsApp senders may be provisioned as Masanawa customers from the sender phone number and later resolve to the same account when they sign in to the app with that number.

## Production configuration

Required when `MASANAWA_WHATSAPP_ENABLED=true`:

```
MASANAWA_WHATSAPP_MODE=linked-device
MASANAWA_WHATSAPP_AUTH_DIR=/data/whatsapp/gwani
MASANAWA_WHATSAPP_ADMIN_TOKEN=<long random secret>
```

`MASANAWA_WHATSAPP_AUTH_DIR` must be backed by persistent encrypted-at-rest storage or a persistent deployment volume. Do not point it at an ephemeral container directory in production or the QR pairing will be lost across redeployments.

The previous Meta Cloud variables are no longer production configuration for Masanawa WhatsApp.

## Admin pairing flow

With the Gateway running and WhatsApp enabled:

1. Request `GET /admin/channels/whatsapp/status` with `Authorization: Bearer <MASANAWA_WHATSAPP_ADMIN_TOKEN>`.
2. When status is `qr`, request `GET /admin/channels/whatsapp/qr`.
3. Render the returned `qrDataUrl` in the Admin app.
4. On the dedicated Gwani phone, open WhatsApp/WhatsApp Business → Linked devices → Link a device and scan it.
5. Poll status until it reports `connected` and the linked phone number.

To deliberately replace or relink the number, call `POST /admin/channels/whatsapp/reset` with the same admin bearer token. Reset logs the linked session out, deletes its saved auth state, and starts a fresh QR pairing session.

## Message flow

```
customer WhatsApp
  -> linked Gwani WhatsApp account
  -> Baileys linked-device transport
  -> CustomerChannelBridge
  -> canonical Masanawa Agent conversation
  -> Billing / Crypto / Teaching / Memory / Wallet / Skills
  -> canonical Agent reply
  -> linked-device transport
  -> customer WhatsApp
```

Provider message IDs still use the durable CustomerChannelRepository claim/complete/delivered lifecycle. A duplicate inbound message therefore does not repeat the Agent or financial execution, while a reply delivery failure can be retried independently.

Direct text, voice/audio, image and document ingress are admitted. Group chats and WhatsApp Status are ignored by the Gwani customer connector.

## First contact

For a direct WhatsApp sender with no existing Masanawa profile:

- the sender phone number is normalized as the canonical phone identity;
- a minimal Masanawa customer profile is created;
- the default support agent (Gwani by policy) is selected;
- the message continues immediately through the canonical Agent runtime.

If profile creation races with another first message, the connector re-reads the canonical profile rather than creating a second account.

## Deployment note

The Gateway package now declares Baileys, QRCode, Boom and Pino dependencies. The root pnpm lockfile must be regenerated from this branch before a frozen-lockfile production install can be considered qualified:

```
pnpm install
pnpm check
```

Do not deploy a linked-device build from a stale lockfile.
