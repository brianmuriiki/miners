# CryWallet

Before any task, read `PROJECT.md` in full. It is the source of truth for purpose, architecture, and design decisions.

## Rules

- Work on one requested phase at a time. Do not add unrequested features.
- Explain the concept before implementation and explain each changed file in 2–3 sentences.
- Never expose private keys or secrets in frontend code, logs, API responses, or version control. Never commit `.env`.
- Validate every request value and never trust `req.body` types.
- MongoDB stores users and wallet metadata. The blockchain stores transactions and blocks; never store balances.
- Backend code uses CommonJS and async/await. Routes map URLs to controllers; keep business logic in blockchain and utility modules.
- Throw `httpError(status, message)` for expected HTTP failures and let Express 5 route rejected async handlers.
- Preserve the security rules and intentional educational scope documented in `PROJECT.md`.
