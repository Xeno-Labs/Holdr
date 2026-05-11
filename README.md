# Holdr

## Encrypted capital markets for private companies

Holdr is a confidential fundraising and cap-table protocol for private companies. It brings SAFE-style rounds, investor allocations, subscription settlement, and ownership records on-chain without exposing the sensitive numbers that make private markets private.

The core product idea is simple:

**One round. One URL. One source of truth. Three different views.**

- **Founders** see the full cap table.
- **Investors** see only their own allocation and position.
- **The public** sees round metadata and aggregate outcomes, never individual check sizes.

Holdr is built on **Zama FHEVM**, using fully homomorphic encryption so smart contracts can compute over encrypted allocations instead of forcing private company data into the open.

---

## The problem

Private equity is one of the largest real-world asset classes, but it is still mostly trapped in off-chain systems. Carta, Pulley, AngelList, PDFs, spreadsheets, side letters, and manual investor updates exist because public blockchains have a brutal default:

**If the data is on-chain, everyone can read it.**

That breaks cap tables immediately. A public cap table leaks:

- Every investor's check size.
- Every ownership percentage.
- Founder dilution.
- Employee compensation signals.
- Round-by-round pricing pressure.
- Competitive information before the company is ready to disclose it.

This is why cap tables have not moved meaningfully on-chain, even though equity should be programmable: automated issuance, instant settlement, composable ownership, auditable state, and clean downstream integrations are exactly what smart contracts are good at.

Holdr is the missing privacy layer for that market.

---

## Why this needs FHE

This is not a problem that a simple hash, Merkle proof, private database, or basic zero-knowledge proof solves cleanly.

A cap table is not one hidden fact. It is a living financial object with different disclosure rules for different people:

- The founder needs the full table.
- Each investor needs only their own row.
- A future lead investor or auditor may need temporary selective access.
- The public may need aggregate outcomes.
- The contract still needs to validate and compute over the hidden values.

That is exactly the shape of an FHE problem.

Holdr stores investor allocations as encrypted values, then uses FHE-aware contracts to validate confidential subscriptions, compute aggregate raise outcomes, and grant wallet-specific decryption rights. The sensitive data remains ciphertext on-chain while the protocol continues to enforce business logic.

---

## What Holdr does

Holdr turns a private fundraise into a confidential on-chain workflow:

| Flow | What happens |
|------|--------------|
| **Create a round** | A founder creates a round with public metadata: name, target raise, deadline, and status. |
| **Add investors** | Investor addresses are added with encrypted allocation amounts. The committed amounts are not publicly readable. |
| **Open the round** | The founder opens the round once allocations are ready. |
| **Subscribe confidentially** | Investors fund their allocation with confidential cUSDT. The contract validates encrypted payment amount against encrypted allocation amount. |
| **Issue confidential equity** | Investors receive cEquity representing their position without broadcasting the position size. |
| **Reveal only aggregates** | The round can expose aggregate raised while individual allocations remain hidden. |
| **Selectively disclose** | Investors can grant specific counterparties access to their position for diligence, audits, or future financing. |

The result is a cap table that behaves like financial infrastructure, not a public spreadsheet.

---

## The signature demo

The most important screen in Holdr is the shared round page:

```text
/round/[id]
```

Three people open the same link:

| Viewer | What they see |
|--------|---------------|
| **Founder wallet** | Full cap table: investor rows, allocations, ownership context, and round controls. |
| **Investor wallet** | Their own allocation and position; other investor amounts stay locked. |
| **Disconnected / public user** | Public metadata and aggregate figures only; all per-investor data remains hidden. |

This is the moment where the project clicks:

**Same URL. Same on-chain state. Different decryption rights.**

The chain is not serving three different datasets. It is serving one encrypted source of truth, and the connected wallet determines what can be decrypted.

---

## Why it is strong

Holdr is built around a real, high-value privacy problem rather than a toy encrypted counter.

| Strength | Why it matters |
|----------|----------------|
| **Confidential finance by default** | Allocations, subscriptions, and ownership data are sensitive financial information, not decorative private fields. |
| **Real-world asset use case** | Private equity is a massive RWA category that cannot move on-chain without confidentiality. |
| **FHE-native architecture** | The contracts compute over encrypted allocation data and enforce encrypted payment checks. |
| **Role-based decryption** | Founder, investor, public, and third-party disclosure experiences come from permissioned decryption, not duplicated databases. |
| **Composability path** | cUSDT and cEquity model how confidential tokens can plug into issuance and settlement flows. |
| **Clear demo** | Two wallets and one URL are enough to show why FHE changes what can be built on-chain. |

---

## System architecture

```text
                         +------------------------------+
                         |        Next.js frontend       |
                         |  wagmi / viem / relayer SDK  |
                         +---------------+--------------+
                                         |
                                         | encrypt inputs
                                         | request decryptions
                                         v
+------------------+     +---------------+--------------+     +------------------+
|   RoundFactory   | --> |          Allocations          | --> |   Disclosure     |
| public metadata  |     | encrypted investor amounts    |     | selective views  |
+------------------+     +---------------+--------------+     +------------------+
                                         |
                                         | validates encrypted payment
                                         v
                         +---------------+--------------+
                         |          Subscription         |
                         | confidential cUSDT escrow     |
                         +---------------+--------------+
                                         |
                                         | mints confidential ownership
                                         v
                         +---------------+--------------+
                         |            cEquity            |
                         | encrypted investor balances   |
                         +------------------------------+

Optional: InvestorCredential issues a soulbound participation credential when wired.
```

The protocol keeps public coordination data public and private economic data encrypted:

| Data | Visibility |
|------|------------|
| Round name, founder, target, deadline, status | Public |
| Investor addresses | Public / observable |
| Investor allocation amounts | Encrypted |
| Subscription amount checks | Computed under FHE |
| cEquity balances | Confidential token balances |
| Aggregate raised | Public after close / reveal flow |
| Selective disclosure | Granted to specific wallets |

---

## Smart contracts

The Solidity system lives in [`contracts/`](contracts/):

| Contract | Role |
|----------|------|
| [`RoundFactory.sol`](contracts/RoundFactory.sol) | Creates rounds, stores public metadata, tracks lifecycle state, and records founder profile CIDs. |
| [`Allocations.sol`](contracts/Allocations.sol) | Stores encrypted per-investor allocations and coordinates subscription, disclosure, and credential issuance. |
| [`Subscription.sol`](contracts/Subscription.sol) | Handles investor subscription flow, validates confidential payment against encrypted allocation, and triggers equity issuance. |
| [`cEquity.sol`](contracts/cEquity.sol) | Confidential equity token representing investor ownership positions. |
| [`Disclosure.sol`](contracts/Disclosure.sol) | Grants controlled view access to encrypted allocation handles. |
| [`InvestorCredential.sol`](contracts/InvestorCredential.sol) | Soulbound-style investor participation NFT minted through allocations when configured. |
| [`mocks/`](contracts/mocks/) | Local development mocks for USDT / cUSDT-style flows. |

Deployment order, one-time wiring calls, and credential rewiring are documented in [`DEPLOYMENT.md`](DEPLOYMENT.md).

---

## Frontend

The app in [`frontend/`](frontend/) is a Next.js interface for the full workflow:

| Route | Purpose |
|-------|---------|
| [`/`](frontend/app/page.tsx) | Landing page and product narrative. |
| [`/onboarding`](frontend/app/onboarding/page.tsx) | Founder onboarding and optional IPFS-backed profile setup. |
| [`/founder/new`](frontend/app/founder/new/page.tsx) | Round creation flow with investor allocation entry. |
| [`/round/[id]`](frontend/app/round/%5Bid%5D/page.tsx) | Unified role-aware round page: founder, investor, or public view. |
| [`/rounds`](frontend/app/rounds/page.tsx) | Round discovery / navigation surface. |
| [`/portfolio`](frontend/app/portfolio/page.tsx) | Investor portfolio surface. |

The frontend uses:

- **wagmi** and **viem** for wallet and contract interactions.
- **`@zama-fhe/relayer-sdk`** for encryption/decryption flows.
- **Next.js 16**, **React 19**, and **Tailwind 4** for the application layer.

---

## Repository layout

```text
.
|-- contracts/          # Solidity contracts and mocks
|-- scripts/            # Deploy, seed, interact, and credential rewiring scripts
|-- test/               # Hardhat contract tests
|-- frontend/           # Next.js application
|-- DEPLOYMENT.md       # Deployment and contract wiring guide
|-- holder prd.md       # Product requirements and FHE design notes
`-- README.md
```

---

## Tech stack

| Layer | Technology |
|-------|------------|
| Smart contracts | Solidity 0.8.24, Hardhat, OpenZeppelin |
| FHE | Zama FHEVM, `fhevm`, `@fhevm/hardhat-plugin` |
| Confidential tokens | cUSDT / cEquity ERC-7984-style flows |
| Frontend | Next.js 16, React 19, Tailwind 4 |
| Wallet / RPC | wagmi, viem |
| Encryption client | `@zama-fhe/relayer-sdk` |
| Networks | Local Hardhat, Sepolia |

---

## Quick start

### Prerequisites

- Node.js
- npm
- A wallet for Sepolia deployments
- Sepolia RPC URL for testnet deployment

### Install dependencies

```bash
npm install
cd frontend && npm install && cd ..
```

### Run locally

Start a local Hardhat node:

```bash
npm run node
```

In a second terminal, deploy and wire the contracts:

```bash
npm run deploy:local
```

The deploy script writes:

- [`deployed.json`](deployed.json) with contract addresses.
- `frontend/.env.local` with `NEXT_PUBLIC_*` addresses for the app.

Optionally seed demo data:

```bash
npm run seed:local
```

Start the frontend:

```bash
cd frontend && npm run dev
```

Open the local URL printed by Next.js, usually:

```text
http://localhost:3000
```

---

## Sepolia deployment

Create a root `.env` with:

```bash
PRIVATE_KEY=0x...
SEPOLIA_RPC_URL=https://...
ETHERSCAN_API_KEY=...
```

Deploy:

```bash
npm run deploy:sepolia
```

The deploy script handles the full contract stack and writes frontend environment variables. For detailed order of operations, rewiring existing deployments, and optional Pinata/IPFS configuration, see [`DEPLOYMENT.md`](DEPLOYMENT.md).

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run compile` | Compile Solidity contracts. |
| `npm run test` | Run Hardhat tests. |
| `npm run node` | Start a local Hardhat chain. |
| `npm run deploy:local` | Deploy the full protocol locally. |
| `npm run deploy:sepolia` | Deploy the full protocol to Sepolia. |
| `npm run deploy:credential:local` | Deploy and wire only `InvestorCredential` locally. |
| `npm run deploy:credential:sepolia` | Deploy and wire only `InvestorCredential` on Sepolia. |
| `npm run seed:local` | Seed local demo data. |
| `npm run seed:sepolia` | Seed Sepolia demo data. |
| `cd frontend && npm run dev` | Run the frontend development server. |
| `cd frontend && npm run build` | Build the frontend. |

---

## Demo narrative

The canonical demo is designed to be understood in under three minutes:

1. Show why public cap tables do not work.
2. Create a private round as the founder.
3. Add an investor with an encrypted allocation.
4. Open the same round URL as the founder and see the full table.
5. Switch to the investor wallet and decrypt only that investor's allocation.
6. Disconnect and show the public view with locked investor rows.
7. Show portfolio / credential / disclosure surfaces where relevant.

Use [`DEMO_SCRIPT.md`](DEMO_SCRIPT.md) for the full recording script.

---

## Project status

Holdr is an MVP submission for the Zama Developer Program Mainnet Season 2 Builder Track. The repo includes:

- FHE-aware Solidity contracts.
- Local and Sepolia deploy scripts.
- Frontend flows for onboarding, round creation, role-aware round viewing, and portfolio surfaces.
- Investor credential support.
- Demo and deployment documentation.

The current version is focused on the primary confidential issuance flow. Multiple share classes, vesting schedules, secondary trading, legal document generation, and KYC/accreditation workflows are intentionally out of scope for this MVP.

---

## Documentation

- [`DEPLOYMENT.md`](DEPLOYMENT.md) - deployment, environment variables, contract wiring, and credential rewiring.
- [`DEMO_SCRIPT.md`](DEMO_SCRIPT.md) - polished three-minute demo flow.
- [`holder prd.md`](holder%20prd.md) - product requirements, target users, and FHE design notes.

---

## License

ISC. See [`package.json`](package.json).

---

## Acknowledgements

Built with [Zama FHEVM](https://github.com/zama-ai/fhevm) and confidential token patterns for private-market infrastructure.
