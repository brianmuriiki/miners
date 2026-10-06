# CryWallet: Project Context for AI Agents

## Purpose and scope

CryWallet is an educational cryptocurrency wallet web application with its own small, hand-written blockchain. It is a learning project for React, Node.js, Express, MongoDB, authentication, cryptographic signatures, hashing, Proof of Work, mempools, and chain validation. CWT is an internal test unit with no monetary value. The application does not connect to Bitcoin, Ethereum, or any real network.

The core user flow is register, log in, receive a custodial wallet, mine test coins, send signed transactions, and inspect history and blocks. Real-network integrations, smart contracts, tokens, NFTs, P2P networking, consensus, and mobile apps are out of scope for the current phase.

## Stack and architecture

- Frontend: React with Vite, ES modules, plain CSS variables, and `fetch`.
- Backend: Node.js, Express 5, CommonJS, async/await.
- App database: MongoDB through Mongoose. It stores users and wallet metadata only.
- Educational blockchain: JavaScript in `backend/blockchain/`, persisted to `backend/data/chain.json`.
- Authentication: bcryptjs password hashes, JWT access/refresh tokens, and revocable MongoDB sessions.
- Cryptography: Node `crypto`, SHA-256, ECDSA secp256k1, AES-256-GCM.
- Hardening: Helmet, single-origin CORS, a 10kb JSON limit, and express-rate-limit.

`backend/app.js` composes middleware and routes and can be imported without opening a port. `backend/server.js` loads environment configuration, connects to MongoDB, and starts listening. Routes map URLs to controllers. Controllers validate inputs and coordinate models, utilities, and blockchain operations. Blockchain rules belong in `backend/blockchain/`; shared crypto and HTTP error helpers belong in `backend/utils/`.

## Data ownership and wallet identity

MongoDB contains `User` records (username, normalized unique email, password hash, role) and `Wallet` records (one per user, address, public key, encrypted private key). **There is no balance column.** Every balance is computed by walking confirmed transactions, and available funds subtract pending outgoing transactions.

Wallet keys use ECDSA secp256k1. Public keys are PEM SPKI; private keys are PEM PKCS8. Address derivation is `CW` plus the first 40 lowercase hexadecimal characters of SHA-256(public key), matching `/^CW[0-9a-f]{40}$/`. The server generates the key pair at registration and encrypts the private key with AES-256-GCM using the 32-byte `WALLET_ENC_KEY`. It decrypts the key only in memory while signing a send request. Never return or log private key material.

## Blockchain and transaction rules

A transaction contains `{ from, to, amount, fee, timestamp, nonce, publicKey, signature }` and a computed ID. `from === null` denotes a mining reward, valid only as the first transaction in a block. The ID is SHA-256 of `from|to|amount|fee|timestamp|nonce`; a random transaction nonce prevents identical sends from reusing an ID. For normal transactions, the public key must derive the sender address and its ECDSA signature must verify against the ID.

A block contains `{ index, timestamp, transactions, previousHash, nonce, hash }`. Its SHA-256 hash covers index, previous hash, timestamp, serialized transactions, and nonce. Mining increments the nonce until the hash has the configured number of leading zeroes. Current educational parameters: difficulty 3, mining reward 50 CWT, default send fee 1 CWT. Genesis is fixed at timestamp `1700000000000`, previous hash `0`, index 0, and no transactions.

For each transaction, subtract `amount + fee` from the sender and add `amount` to the recipient. The block reward is `miningReward + sum(transaction fees)`, so collected fees go to that block's miner. Pending transactions reserve outgoing amount and fee; admission checks available funds to prevent mempool overspending. `isChainValid()` checks hashes, previous-hash links, Proof of Work, reward position and value, and all signed non-reward transactions. Persistence reconstructs class instances but preserves stored hashes so tampering stays detectable.

Coins enter circulation only through mining rewards. Any logged-in user may mine; this is the development faucet behavior.

## REST API

Base URL is `http://localhost:5000/api`; bodies use JSON and errors have shape `{ "error": "message" }`. Protected paths require `Authorization: Bearer <jwt>`.

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/health` | Public | Health status and app name |
| POST | `/auth/register` | Public | Create user, wallet, and session; set HttpOnly cookies |
| POST | `/auth/login` | Public | Authenticate and set HttpOnly cookies |
| POST | `/auth/refresh` | Cookie | Rotate the refresh token and issue a new access token |
| POST | `/auth/logout` | Cookie | Revoke the current session and clear cookies |
| GET | `/auth/me` | Protected | Current user without password hash |
| GET | `/auth/sessions` | Protected | List the current user's active sessions |
| DELETE | `/auth/sessions/:sessionId` | Protected | Revoke one of the current user's sessions |
| GET | `/auth/admin-check` | Admin | Example endpoint protected by role authorization |
| GET | `/wallet` | Protected | Address, public key, confirmed and available balances |
| POST | `/transactions/send` | Protected | Sign and enqueue a transaction |
| GET | `/transactions` | Protected | User history, pending first |
| GET | `/transactions/:id` | Protected | Transaction and confirmation status |
| GET | `/blockchain` | Public | Chain summary, difficulty, pending count, validity |
| GET | `/blockchain/blocks` | Public | Blocks newest first |
| POST | `/blockchain/mine` | Protected | Mine pending transactions and reward caller |

Registration validates a 3–30 character username, email, and password of at least 8 characters. Login uses the same 401 message for unknown email and wrong password. Send validates the recipient address and finite numeric amount greater than zero and fee greater than or equal to zero. Cookie-authenticated browser mutations must include the configured `Origin`; the React client must use `credentials: 'include'`. Rate limits are 300 requests per 15 minutes on `/api` and 20 per 15 minutes on `/api/auth`.

## Security and environment invariants

Environment-only configuration: `PORT`, `MONGO_URI`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `CLIENT_URL`, and `WALLET_ENC_KEY` (64 hex characters). CORS is limited to `CLIENT_URL` and allows credentials. The API sets 15-minute access JWTs and rotating 7-day refresh JWTs in HttpOnly, SameSite=Strict cookies; Secure is enabled in production. MongoDB stores only a hash of each refresh token, so sessions can be revoked and are invalidated on logout. Cookie-authenticated mutations require the configured Origin; clients should send cookies with credentials. Bearer access tokens remain supported for API clients. Helmet is enabled; request JSON is limited to 10kb. Passwords use bcrypt cost 12. Validate input types and formats on the server. Never store balances, trust client balances, return private keys, or omit auth from protected routes. `.env`, chain data, and `node_modules` must not be committed. Do not print secret values when troubleshooting configuration.

## Frontend plan

Planned routes: landing, register, login, dashboard, wallet, send, receive, transactions, settings, and a block explorer. The visual direction is dark near-black with CSS variable tokens in `frontend/src/index.css`; reuse tokens instead of hardcoding colors. All HTTP calls belong in `frontend/src/api.js`. Use React Router, function components, hooks, and a protected-route wrapper. Authentication uses HttpOnly cookies; frontend requests must opt into credentials and must not read or store JWTs in JavaScript. The browser may see addresses and public keys, never private keys.

The send flow should review amount, shortened/copyable recipient, network, fee, total, and confirmation before submitting. Transaction details show amount, date, pending/confirmed badge, recipient, fee, and block link. Receive shows a copyable address. Explain confirmed versus available balance in the UI.

## Known limitations and future topics

This is intentionally custodial, uses floating-point amounts, mines synchronously, allows any authenticated user to mine, is a single node, persists to a JSON file without multi-process locking, and uses concatenated/serialized hash inputs rather than canonical encoding. It has no email verification, password reset, or 2FA. These are learning topics; do not silently redesign them during unrelated changes.

Later roadmap topics include automated Jest/Supertest coverage, integer smallest units, worker-thread mining, client-side signing, P2P networking and consensus, Merkle trees, WebSockets, and optional real-network integration. These are not authorization to implement them; work one requested phase at a time.

## How to work on this project

Explain the concept before writing code, keep diffs small and focused, and explain each changed file in 2–3 sentences. Do not add dependencies without explaining why. After an implementation, provide exact manual verification commands or requests. Do not build unrequested features. If an unclear choice risks changing rules in this document, ask before proceeding. Update this file when an approved design decision changes.
