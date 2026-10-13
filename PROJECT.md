# CryWallet: Project Context for AI Agents

## Purpose and scope

CryWallet is an educational cryptocurrency wallet web application centered on CryChain, its own hand-written blockchain, with Ethereum Sepolia as a separate testnet mode. It is a learning project for React, Node.js, Express, MongoDB, authentication, browser-side cryptographic signatures, hashing, Proof of Work, mempools, and chain validation. CWT is CryChain's native test unit and has no monetary value. CryChain and Sepolia are separate networks.

The core CryChain flow is register, log in, create a browser-held wallet, open the standalone miner to mine test coins, send signed transactions, and inspect history and blocks. The server stores account and public wallet metadata; private keys stay in the browser's encrypted keystore. Web3 mode is a separate browser-based Sepolia testnet experience. Multi-node networking, consensus, worker mining, smart contracts, tokens, NFTs, and mobile apps remain out of scope unless separately requested.

## Stack and architecture

- Frontend: React with Vite, ES modules, plain CSS variables, `fetch`, and Lucide icons. The wallet and standalone miner are separate Vite apps; both use the same API and cookie-based account sessions. The dashboard uses Poppins with system-font fallbacks.
- Web3 frontend: ethers.js v6 connects directly to Ethereum Sepolia through a browser-visible RPC URL configured as `VITE_SEPOLIA_RPC`, falling back to the public, rate-limited `https://rpc.sepolia.ethpandaops.io` endpoint.
- Backend: Node.js, Express 5, CommonJS, async/await.
- App database: MongoDB through Mongoose. It stores users and wallet metadata only.
- CryChain: JavaScript in `backend/blockchain/`, persisted to `backend/data/crychain-v2.json`; earlier chain files remain untouched.
- Authentication: bcryptjs password hashes, JWT access/refresh tokens, and revocable MongoDB sessions.
- Google sign-in: Google Identity Services ID tokens verified by the backend with Google's auth library; Google subjects are stored on existing CryWallet accounts.
- Cryptography: Node `crypto`, SHA-256, ECDSA secp256k1, and browser encrypted keystores through ethers.js.
- Hardening: Helmet, allowlisted wallet/miner origins, a 10kb JSON limit, and express-rate-limit.

`backend/app.js` composes middleware and routes and can be imported without opening a port. `backend/server.js` loads environment configuration, connects to MongoDB, and starts listening. Routes map URLs to controllers. Controllers validate inputs and coordinate models, utilities, and blockchain operations. Blockchain rules belong in `backend/blockchain/`; shared crypto and HTTP error helpers belong in `backend/utils/`.

## Data ownership and wallet identity

MongoDB contains `User` records (username, normalized unique email, password hash, role) and `Wallet` records (one per user, CryChain address, public key). It never stores private keys or balances. The current account state is rebuilt from confirmed transactions at startup, and available funds subtract pending outgoing transactions.

Wallet keys use ECDSA secp256k1 and are generated in the browser. CryChain public keys are uncompressed SEC1 hexadecimal (`04` plus 128 lowercase hexadecimal characters); the browser stores only encrypted keystore JSON in local storage, unlocks it with the keystore password, and supports restoring it from the recovery phrase. Address derivation is `CW` plus the first 40 lowercase hexadecimal characters of SHA-256 over the public key's hexadecimal text, matching `/^CW[0-9a-f]{40}$/`. The server validates addresses and signatures but never receives private keys or recovery phrases.

## Blockchain and transaction rules

A transaction contains `{ id, from, to, amount, fee, timestamp, nonce, publicKey, signature }`. `amount` and `fee` are safe integers in base units; 1 CWT equals 100,000,000 base units. Transaction IDs are SHA-256 of canonical JSON for `{ from, to, amount, fee, timestamp, nonce }`. Account nonces start at zero and each accepted transaction must use the sender's next nonce. `from === null` denotes a mining reward, valid only as the first transaction in a block. For normal transactions, the public key must derive the sender address and its ECDSA signature must verify against the ID.

A block contains `{ index, timestamp, transactions, previousHash, merkleRoot, difficulty, nonce, hash }`. Transaction leaves hash `tx:` plus the transaction ID; parent nodes hash `node:` plus the two child hashes, duplicating the final child at odd-width levels. The block hash is SHA-256 of canonical JSON for the header fields, including the Merkle root and difficulty. Genesis is fixed at timestamp `1700000000000`, previous hash `0`, index 0, and no transactions.

Consensus parameters are identical on every node: initial/genesis difficulty 2, minimum difficulty 2, maximum difficulty 6, one-step difficulty adjustment every 10 blocks toward a 10-second target, minimum transaction fee 1,000 base units, at most 50 user transactions per block, and at most 1,000 pending transactions. Difficulty changes by one when the previous 10-block span is below half or above twice the target span. For each transaction, subtract `amount + fee` from the sender and add `amount` to the recipient. The block reward is 5,000,000,000 base units plus included transaction fees and 10,000,000,000 base units per verified referral claimed by that miner. Referral wallet addresses are included in the reward transaction ID and can appear only once in the chain. Pending transactions reserve outgoing amount and fee; admission checks available funds and the next account nonce. Mining selects higher-fee transactions first while preserving each sender's nonce order. Chain validation checks transaction signatures and IDs, nonce sequence, balances, Merkle roots, block hashes, previous-hash links, expected difficulty, Proof of Work, and reward position, value, and referral uniqueness. The current implementation is a single-node educational chain; distributed consensus is a later phase.

Coins enter circulation through mined block rewards: the standard 50 CWT miner reward, included transaction fees, and a 100 CWT bonus per eligible email-verified referral claimed by the referring account when it mines. Each referred wallet can earn this bonus only once, and referral wallet addresses are committed in the mined reward transaction. Any logged-in user may mine; this is the development faucet behavior.

## REST API

Base URL is `http://localhost:5000/api`; bodies use JSON and errors have shape `{ "error": "message" }`. Protected paths require `Authorization: Bearer <jwt>`.

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/health` | Public | Health status and app name |
| POST | `/auth/register` | Public | Create an email/password account and wallet metadata using browser-generated public values; start email verification |
| POST | `/auth/login` | Public | Authenticate and set HttpOnly cookies |
| POST | `/auth/google/register` | Public | Verify Google identity, create account/wallet metadata from browser-generated public values, and set HttpOnly cookies |
| POST | `/auth/google` | Public | Verify a Google ID token, link its verified email to an existing account, and set HttpOnly cookies |
| POST | `/auth/verify-email` | Public | Consume a one-time email verification token |
| POST | `/auth/resend-verification` | Public | Send a verification link without revealing account existence |
| POST | `/auth/password/forgot` | Public | Send a password reset link without revealing account existence |
| POST | `/auth/password/reset` | Public | Consume a reset token, change password, and revoke all sessions |
| PATCH | `/auth/profile` | Protected | Update username and request a verified email change |
| POST | `/auth/refresh` | Cookie | Rotate the refresh token and issue a new access token |
| POST | `/auth/logout` | Cookie | Revoke the current session and clear cookies |
| GET | `/auth/session` | Optional cookie | Return the current user or `null`; refresh an expired access session when a refresh cookie exists |
| GET | `/auth/me` | Protected | Current user without password hash |
| GET | `/auth/sessions` | Protected | List the current user's active sessions |
| GET | `/auth/referrals` | Protected | Referral code and invited, verified, claimed, and claimable counts |
| DELETE | `/auth/sessions/:sessionId` | Protected | Revoke one of the current user's sessions |
| DELETE | `/auth/sessions/others` | Protected | Revoke all sessions except the current one |
| GET | `/auth/admin-check` | Admin | Example endpoint protected by role authorization |
| GET | `/wallet` | Protected | Address, public key, integer base-unit balances, and next nonce |
| POST | `/transactions/send` | Protected | Validate and enqueue a browser-signed transaction |
| GET | `/transactions` | Protected | User history, pending first |
| GET | `/transactions/:id` | Protected | Transaction and confirmation status |
| GET | `/blockchain` | Public | Chain summary, next difficulty, parameters, pending count, validity |
| GET | `/blockchain/blocks?page=&limit=` | Public | Paged blocks newest first |
| GET | `/blockchain/blocks/:heightOrHash` | Public | Block header, transactions, and Merkle root |
| GET | `/blockchain/transactions/:id` | Public | Transaction status and inclusion proof |
| GET | `/blockchain/address/:address` | Public | Confirmed and available base-unit balance and nonce |
| GET | `/blockchain/address/:address/history` | Public | Confirmed balance by block for portfolio charts |
| GET | `/blockchain/address/:address/transactions?page=&limit=` | Public | Paged address activity |
| GET | `/blockchain/mempool` | Public | Pending transactions in fee-selection order |
| GET | `/blockchain/fees` | Public | Slow, normal, and fast fee suggestions |
| POST | `/blockchain/mine` | Protected | Mine pending transactions and reward caller |
| GET | `/market` | Public | Cached BTC, ETH, SOL, BNB, XRP, ADA, and DOGE reference market data from CoinPaprika |
| GET | `/market/:coinId/history?period=1D\|1W\|1M\|1Y` | Public | Cached public USDT candle history for a supported market coin, with Binance endpoint failover and stale cache when available |
| GET | `/forex?pair=USD-KES&period=3M` | Public | Cached daily reference-rate history for a supported currency pair |
| GET | `/news` | Public | Cached CoinDesk RSS headlines |

Registration validates a 3–30 character username, email, password of at least 8 characters, and a matching CryChain address/public key. An optional 12-character referral code may be supplied; each new account can be attributed to one referrer. Email/password accounts cannot log in until verified; verification tokens expire after 24 hours. A verified referred account makes one 100 CWT bonus claimable by its referrer, paid as part of that referrer's next mined block reward. Referral wallet addresses are committed in the reward transaction and cannot be claimed twice. Profile updates can change username directly; email changes require the current account password and a one-hour verification link, and the old email remains active until confirmation. Google-only users can set an account password through email reset before changing email. Password reset links expire after one hour and reset revokes every session. Google registration verifies the provider token and creates only account and public wallet metadata; CryChain key generation, encrypted keystore storage, and recovery phrase backup stay in the browser. Google sign-in does not unlock the encrypted CryChain wallet. Login uses the same 401 message for unknown email and wrong password. Send validates the recipient address, safe integer base-unit amount and fee, sender signature, and next account nonce. Cookie-authenticated browser mutations must include the configured `Origin`; the React client must use `credentials: 'include'`. Rate limits are 300 requests per 15 minutes on `/api` and 20 per 15 minutes on `/api/auth`.

## Security and environment invariants

Environment-only configuration: `PORT`, `MONGO_URI`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `CLIENT_URL`, `MINER_CLIENT_URL`, `GOOGLE_CLIENT_ID` (same Google Web OAuth client ID as `VITE_GOOGLE_CLIENT_ID`), optional `CRYCHAIN_FILE`, and SMTP settings `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM`. CORS and cookie-mutation origin checks allow the wallet and miner origins; deploy them as same-site origins so SameSite=Strict session cookies work. The API sets 15-minute access JWTs and rotating 7-day refresh JWTs in HttpOnly, SameSite=Strict cookies; Secure is enabled in production. MongoDB stores only a hash of each refresh token, so sessions can be revoked and are invalidated on logout or password reset; session listings expose browser details and a masked IP. Cookie-authenticated mutations require the configured Origin; clients should send cookies with credentials. Bearer access tokens remain supported for API clients. Helmet is enabled; request JSON is limited to 10kb. Passwords use bcrypt cost 12. Email tokens are random, stored hashed, single-use, and time-limited. Google ID tokens are verified server-side for signature, audience, issuer, and expiry; only verified Google emails can link to an existing account, and Google subject IDs are the persistent provider identifier. Email/password registration, verification, and password reset require working SMTP delivery. Validate input types and formats on the server. Never store balances or private keys, trust client balances, or omit auth from protected routes. `.env`, chain data, and `node_modules` must not be committed. Do not print secret values when troubleshooting configuration.

## Frontend plan

The CryChain wallet and miner are independent Vite apps: run the wallet from `frontend/` and the standalone miner from `miner/`. The wallet links to the miner through `VITE_MINER_URL`; the miner uses `VITE_API_URL` and links back through `VITE_WALLET_URL`. Set `MINER_CLIENT_URL` on the backend to the miner's exact origin. Deploy wallet, miner, and API on same-site origins so the existing SameSite=Strict session cookies work. The wallet dashboard and explorer do not mine blocks. The rewards page supports referral links; each referred account that verifies email can add one 100 CWT bonus to the referrer's next mined block reward through the standalone miner. Market reference prices for BTC, ETH, SOL, BNB, XRP, ADA, and DOGE come from cached CoinPaprika ticker endpoints; coin price charts use cached Binance public USDT candles for 1D, 1W, 1M, and 1Y; paper trading provides a 10,000 USDT simulated starting balance with a per-user trade ledger stored only in browser local storage, derives cash and coin holdings from that ledger, and simulates fills at the cached CoinPaprika USD reference price treated as USDT 1:1 without fees or slippage; the Buy Crypto page is a buy-only entry to this simulator; no real payment provider, exchange, or order is connected; daily forex history comes from cached Frankfurter reference-rate endpoints; headlines come from a cached CoinDesk RSS feed. Forex graphs support USD/KES, EUR/USD, GBP/USD, USD/JPY, USD/CAD, and AUD/USD over 1M, 3M, 6M, and 1Y ranges. Rates are daily reference values, not live trading quotes. The CWT portfolio history is derived from confirmed wallet transactions. Do not imply that exchange accounts are linked or that market-listed coins are spendable wallet assets; the app shows CryChain and Sepolia as separate networks. Market, forex, portfolio, rewards, news, help, and settings pages are functional. All HTTP calls in the wallet app belong in `frontend/src/api.js`. Use React Router, function components, hooks, and a protected-route wrapper. Authentication uses HttpOnly cookies; frontend requests must opt into credentials and must not read or store JWTs in JavaScript. Login and registration offer Google when `VITE_GOOGLE_CLIENT_ID` is configured. Registration asks users to confirm recovery phrase backup before continuing; Google authentication does not unlock the encrypted CryChain keystore. Email/password registration requires email verification. Settings show active sessions with device details and support individual or bulk revocation. CryChain signing keys remain in the browser encrypted keystore; the browser may send addresses, public keys, and signed transactions to the backend.

The send flow should review amount, shortened/copyable recipient, network, fee, total, and confirmation before submitting. Amount entry is decimal CWT converted to integer base units before signing. Send can scan a CryWallet payment QR to prefill the CryChain recipient and optional amount; the user still reviews and signs in the browser. Receive shows a copyable address and QR payment request. QR payloads contain only the CryChain network, public address, and optional amount. Transaction details show amount, date, pending/confirmed badge, recipient, fee, and block link. Explain confirmed versus available balance in the UI.

## Web3 mode

CryWallet has two distinct networks: CryChain is the primary educational blockchain, while Web3 mode uses the real Ethereum Sepolia testnet through ethers.js v6 in the browser. Sepolia is the only supported real network for this educational mode. The browser talks directly to the configured RPC provider; Express may support accounts, an address book, and cached history, but Sepolia is the source of truth for balances and transactions.

Wallet creation, importing, unlocking, and transaction signing in Web3 mode happen in the browser. Private keys and mnemonics must never be sent to the backend, logged, or stored in plaintext. The browser keystore persists only encrypted keystore JSON and makes clear that the mnemonic is the user's backup. RPC URLs placed in Vite variables are public in the built app and must not be treated as secrets; restrict provider keys by allowed domain where supported. Use testnet wallets only and never import keys that hold real funds. Show the recovery phrase only once with a clear backup warning.

Web3 mode uses integer wei values and ethers.js `BigInt` helpers for transaction calculations. Transaction status remains pending until the network receipt is confirmed. Link Sepolia transactions to the Sepolia block explorer. The current frontend supports balance reads, browser keystore create/import/unlock, and ETH transfers; full account history is linked through Etherscan.

## Known limitations and future topics

CryChain currently mines synchronously, allows any authenticated user to mine, runs as a single node, rebuilds state from the chain at startup, and persists to a JSON file without multi-process locking. It now uses integer base units, canonical serialization, nonces, fee selection, a block transaction limit, difficulty adjustment, Merkle roots/proofs, and balance history. The v2 block format does not auto-migrate v1 JSON; retain old chain files as backups. Worker-thread mining, database-backed chain state, multi-node consensus, and 2FA remain future work. Auth and blockchain API behavior have automated tests; run `npm test` in `backend/`.

Later roadmap topics include worker-thread mining, database-backed chain state, P2P networking and consensus, WebSockets, MetaMask connection, and Solidity contracts. These are not authorization to implement them; work one requested phase at a time.

## How to work on this project

Explain the concept before writing code, keep diffs small and focused, and explain each changed file in 2–3 sentences. Do not add dependencies without explaining why. After an implementation, provide exact manual verification commands or requests. Do not build unrequested features. If an unclear choice risks changing rules in this document, ask before proceeding. Update this file when an approved design decision changes.
