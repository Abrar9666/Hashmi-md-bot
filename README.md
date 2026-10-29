# HASHMI-MD

A multi-device WhatsApp bot maintained by Abrar Hashmi (Abrar Hashmi Studios).

HASHMI-MD is a Node.js bot built on Baileys. It is a maintained fork in the Silva MD family, customised for a simple, button-first user experience: users interact mainly through buttons and numbered list menus, starting with `hi` / `menu`.

## What it does

- Multi-device WhatsApp connection with pairing support
- Session v2 restore, so the bot can reconnect without re-pairing every time
- Button and list menus only for user-facing interaction, with a number-reply fallback
- Single-socket guard to avoid duplicate-connection conflicts
- Welcome throttling and spam controls
- Interactive menu gating for a cleaner chat experience

## Tech

- Node.js 20
- Baileys (WhatsApp Web API library)
- Render-ready deployment via `render.yaml` and `setup.sh`

## Run it

1. Clone this repository.
2. Install dependencies:

```bash
npm install
```

3. Set the required environment variables, including `SESSION_ID` (never commit a real session value).
4. Start the bot:

```bash
node silva.js
```

### Deploy on Render

This repository includes a Render Blueprint (`render.yaml`). Connect the repository on Render, set `SESSION_ID` as a secret environment variable, and deploy. The `setup.sh` script unpacks the code payload, applies the patches in `patches/`, and installs dependencies.

## Project structure

- `patches/` — maintained bot code and patches, including `silva.js`
- `payload/` — packaged code chunks unpacked at deploy time by `setup.sh`
- `package.json` — dependencies and start script
- `render.yaml` — Render deployment configuration
- `setup.sh` — deploy-time setup script

## Maintenance

This is a solo-maintained project. Issues and pull requests are welcome: please describe the problem, the steps to reproduce it, and the expected behaviour. Security-sensitive details (session values, phone numbers, tokens) must never be posted in issues.

## Credits

Built on the open-source Baileys library and the Silva MD bot family. Upstream credit is retained in `package.json`.

## Status

Repository maintenance resumed in October 2026 with documentation and housekeeping updates. Deployment is manual via the Render Blueprint above.
