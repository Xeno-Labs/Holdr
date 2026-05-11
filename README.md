# Holdr

**Encrypted capital markets for private companies** — a SAFE-style fundraise and cap table where per-investor allocations, ownership math, and subscription checks stay **encrypted on-chain** by default, using **Zama FHEVM** (fully homomorphic encryption on Ethereum).

Same round URL. Same on-chain data. **Three different experiences:** founders see the full cap table, each investor sees only their row, and the public sees metadata plus the aggregate raise after close.

---

## Table of contents

- [Why Holdr exists](#why-holdr-exists)
- [What you can do with this MVP](#what-you-can-do-with-this-mvp)
- [How it works (high level)](#how-it-works-high-level)
- [Architecture](#architecture)
- [Repository layout](#repository-layout)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Scripts](#scripts)
- [Documentation](#documentation)
- [License](#license)

---

## Why Holdr exists

Putting a traditional cap table on a public chain exposes every stakeholder: check sizes, ownership percentages, dilution, and compensation signals leak to competitors and the market. Most serious cap-table products therefore stay off-chain, even though programmable equity, automated dilution, and composable ownership records are natural fits for smart contracts.

Holdr explores the opposite: **keep sensitive quantities as ciphertext on-chain**, while still allowing the protocol to:

- Validate that an investor’s confidential payment matches their confidential allocation.
- Compute **aggregate** raised under FHE and reveal only that aggregate publicly when the round closes.
- Gate **per-wallet decryption** so founders, investors, and third parties see only what policy allows (including selective disclosure).

---

## What you can do with this MVP

| Actor | Experience |
|--------|------------|
| **Founder** | Create a round (public name, target, deadline), add investors with **encrypted** allocations, open the round, and view the **full** cap table when connected with the founder wallet. |
| **Investor** | Open the shared round page, decrypt **only their** allocation, subscribe with **confidential** USDT (cUSDT / ERC-7984-style flow), receive **confidential equity** (cEquity), and use portfolio / disclosure flows where implemented. |
| **Public** | Same round URL: see round metadata and, after close, **aggregate** raised — not per-investor amounts. |

Additional pieces in this repo:

- **InvestorCredential** — soulbound-style participation NFT minted when investors are added (when the credential contract is wired); documents wiring in [`DEPLOYMENT.md`](DEPLOYMENT.md).
- **Founder onboarding / IPFS** — optional Pinata-backed profile pinning (see deployment doc and `frontend/.env.local`).

---

## How it works (high level)

1. **RoundFactory** stores public round metadata (founder, name, target, deadline, status).
2. **Allocations** stores **encrypted** per-investor commitment amounts (`euint64`) and subscription flags; coordinates with subscription, disclosure, and credential contracts.
3. **Subscription** moves **encrypted** cUSDT into escrow and enforces FHE equality between payment and allocation; on success, **cEquity** (confidential ERC-20 style token) represents the position.
4. **Disclosure** lets an investor **grant** decryption of their allocation handle to a counterparty (e.g. diligence) without making the whole table public.
5. The **Next.js** app uses **wagmi / viem** for chain calls and **`@zama-fhe/relayer-sdk`** in the browser to encrypt inputs and decrypt handles the user is allowed to see.

Privacy is enforced at **ciphertext + access control** — the chain does not need to know *who* is viewing the page; decryption permissions follow the connected wallet and on-chain `TFHE.allow`-style policies.

---

## Architecture

```
┌─────────────────────────────────────────┐
│  Next.js frontend                        │
│  wagmi · viem · @zama-fhe/relayer-sdk  │
└──────────────────┬──────────────────────┘
                   │ RPC + FHE relayer
                   ▼
┌─────────────────────────────────────────┐
│  RoundFactory                           │
│  Allocations (encrypted allocations)    │
│  Subscription · cEquity · Disclosure    │
│  InvestorCredential (optional NFT)      │
└──────────────────┬──────────────────────┘
                   │
         Confidential stablecoin (cUSDT)
         + Zama FHEVM / decryption oracle
```

Solidity contracts live under [`contracts/`](contracts/). The canonical deploy and wiring order is described in [`DEPLOYMENT.md`](DEPLOYMENT.md).

---

## Repository layout

| Path | Purpose |
|------|---------|
| [`contracts/`](contracts/) | FHE-aware Solidity: factory, allocations, subscription, cEquity, disclosure, investor credential, mocks. |
| [`scripts/`](scripts/) | `deploy.ts`, seed/interact helpers, credential-only deploy. |
| [`test/`](test/) | Hardhat tests for contracts. |
| [`frontend/`](frontend/) | Next.js app (App Router), UI, wallet, relayer SDK integration. |
| [`DEPLOYMENT.md`](DEPLOYMENT.md) | Deploy prerequisites, wiring table, `deployed.json` / `.env.local` outputs, credential rewiring. |
| [`DEMO_SCRIPT.md`](DEMO_SCRIPT.md) | Step-by-step demo narrative. |
| [`holder prd.md`](holder%20prd.md) | Product requirements and Season 2 submission framing (internal PRD). |

---

## Tech stack

| Layer | Choices |
|--------|---------|
| **Smart contracts** | Solidity 0.8.24, Hardhat, **@fhevm/hardhat-plugin**, **fhevm** |
| **Frontend** | Next.js 16, React 19, Tailwind 4, **wagmi** + **viem**, **@zama-fhe/relayer-sdk** |
| **Networks** | Local Hardhat chain; **Sepolia** for testnet deployment |

---

## Getting started

### Prerequisites

- **Node.js** (LTS recommended)
- **npm** at the repository root

### 1. Install dependencies

```bash
npm install
cd frontend && npm install && cd ..
```

### 2. Local chain and deploy

Terminal A — start a local node:

```bash
npm run node
```

Terminal B — deploy and wire contracts:

```bash
npm run deploy:local
```

This updates **`deployed.json`** and writes **`frontend/.env.local`** with `NEXT_PUBLIC_*` addresses. Restart the frontend dev server if it was already running.

Optional — seed demo data:

```bash
npm run seed:local
```

### 3. Run the frontend

```bash
cd frontend && npm run dev
```

Open the URL printed by Next.js (typically `http://localhost:3000`).

### Sepolia and production-like setup

Set `PRIVATE_KEY` and `SEPOLIA_RPC_URL` in a root `.env`, then:

```bash
npm run deploy:sepolia
```

Full wiring, optional Pinata JWT for IPFS pinning, and credential-only deploys are documented in **[`DEPLOYMENT.md`](DEPLOYMENT.md)**.

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run compile` | Compile contracts with Hardhat. |
| `npm run test` | Run contract tests. |
| `npm run node` | Start local Hardhat node. |
| `npm run deploy:local` | Deploy full stack to localhost and refresh `frontend/.env.local`. |
| `npm run deploy:sepolia` | Deploy full stack to Sepolia. |
| `npm run deploy:credential:local` / `deploy:credential:sepolia` | Deploy **InvestorCredential** only and rewire (see DEPLOYMENT). |
| `npm run seed:local` / `seed:sepolia` | Seed script for demo data. |
| `cd frontend && npm run dev` | Next.js development server. |
| `cd frontend && npm run build` | Production build. |

---

## Documentation

- **[`DEPLOYMENT.md`](DEPLOYMENT.md)** — environment variables, deploy order, on-chain wiring, IPFS / Pinata, troubleshooting existing deployments.
- **[`DEMO_SCRIPT.md`](DEMO_SCRIPT.md)** — guided demo for pitches or judges.
- **[`holder prd.md`](holder%20prd.md)** — detailed PRD: user stories, contract sketches, FHE design table.

---

## License

[ISC](package.json) (see root `package.json`).

---

## Acknowledgements

Built with **[Zama FHEVM](https://github.com/zama-ai/fhevm)** and confidential token patterns (e.g. ERC-7984-style cUSDT / cEquity) suitable for **Zama Developer Program** and similar hackathon or research tracks.
