// Contract addresses — populated from .env.local by scripts/deploy.ts
// For Sepolia, set these in .env.local after deployment

export const ADDRESSES = {
  MockUSDT:     process.env.NEXT_PUBLIC_MOCK_USDT_ADDRESS    as `0x${string}`,
  MockcUSDT:    process.env.NEXT_PUBLIC_CUSDT_ADDRESS        as `0x${string}`,
  RoundFactory: process.env.NEXT_PUBLIC_ROUND_FACTORY_ADDRESS as `0x${string}`,
  Allocations:  process.env.NEXT_PUBLIC_ALLOCATIONS_ADDRESS  as `0x${string}`,
  Subscription: process.env.NEXT_PUBLIC_SUBSCRIPTION_ADDRESS as `0x${string}`,
  cEquity:      process.env.NEXT_PUBLIC_CEQUITY_ADDRESS      as `0x${string}`,
  Disclosure:   process.env.NEXT_PUBLIC_DISCLOSURE_ADDRESS   as `0x${string}`,
} as const;

// ─── ABIs (trimmed to only the functions the frontend calls) ─────────────────

export const ROUND_FACTORY_ABI = [
  {
    name: "createRound",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "name",        type: "string"  },
      { name: "targetRaise", type: "uint256" },
      { name: "deadline",    type: "uint64"  },
    ],
    outputs: [{ name: "roundId", type: "uint256" }],
  },
  {
    name: "openRound",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "roundId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "cancelRound",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "roundId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "getRound",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "roundId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "founder",     type: "address" },
          { name: "name",        type: "string"  },
          { name: "targetRaise", type: "uint256" },
          { name: "deadline",    type: "uint64"  },
          { name: "status",      type: "uint8"   },
          { name: "totalRaised", type: "uint256" },
        ],
      },
    ],
  },
  {
    name: "roundCount",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "RoundCreated",
    type: "event",
    inputs: [
      { name: "roundId", type: "uint256", indexed: true },
      { name: "founder", type: "address", indexed: true },
      { name: "name",    type: "string",  indexed: false },
      { name: "targetRaise", type: "uint256", indexed: false },
    ],
  },
] as const;

export const ALLOCATIONS_ABI = [
  {
    name: "addInvestor",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "roundId",    type: "uint256" },
      { name: "investor",   type: "address" },
      { name: "encAmount",  type: "bytes32" },
      { name: "inputProof", type: "bytes"   },
    ],
    outputs: [],
  },
  {
    name: "getAllocation",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "roundId",  type: "uint256" },
      { name: "investor", type: "address" },
    ],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    name: "isSubscribed",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "roundId",  type: "uint256" },
      { name: "investor", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "getInvestors",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "roundId", type: "uint256" }],
    outputs: [{ name: "", type: "address[]" }],
  },
  {
    name: "investorCount",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "roundId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "pendingCloseHandle",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "roundId", type: "uint256" }],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    name: "requestClose",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "roundId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "pendingCloseHandle",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "roundId", type: "uint256" }],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    name: "submitCloseResult",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "roundId",              type: "uint256"   },
      { name: "handlesList",          type: "bytes32[]" },
      { name: "abiEncodedCleartexts", type: "bytes"     },
      { name: "decryptionProof",      type: "bytes"     },
    ],
    outputs: [],
  },
  {
    name: "submitCloseResult",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "roundId",              type: "uint256"   },
      { name: "handlesList",          type: "bytes32[]" },
      { name: "abiEncodedCleartexts", type: "bytes"     },
      { name: "decryptionProof",      type: "bytes"     },
    ],
    outputs: [],
  },
  {
    name: "InvestorAdded",
    type: "event",
    inputs: [
      { name: "roundId",  type: "uint256", indexed: true },
      { name: "investor", type: "address", indexed: true },
    ],
  },
] as const;

export const SUBSCRIPTION_ABI = [
  {
    name: "subscribe",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "roundId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "closeRound",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "roundId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "Subscribed",
    type: "event",
    inputs: [
      { name: "roundId",  type: "uint256", indexed: true },
      { name: "investor", type: "address", indexed: true },
    ],
  },
] as const;

// Mock USDT underlying — public mint on Sepolia, ERC-20 on local
export const MOCK_USDT_ABI = [
  {
    name: "mint",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to",     type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount",  type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner",   type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export const MOCKCUSDT_ABI = [
  // ── Wrap / unwrap plaintext USDT ─────────────────────────────────────────
  // Zama's cUSDTMock (Sepolia) and our MockcUSDT (local) both use uint256
  {
    name: "wrap",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to",     type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "unwrap",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "from",   type: "address" },
      { name: "to",     type: "address" },
      { name: "amount", type: "bytes32" },
    ],
    outputs: [],
  },
  // ── ERC-7984 / IConfidentialERC20 ──────────────────────────────────────
  // Works on both our MockcUSDT (local) and Zama's cUSDTMock (Sepolia)
  {
    // Replaces `approve` — grants operator permission until a Unix timestamp
    name: "setOperator",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "operator", type: "address" },
      { name: "until",    type: "uint48"  },
    ],
    outputs: [],
  },
  {
    name: "isOperator",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "holder",  type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "confidentialBalanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    name: "confidentialTransfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to",     type: "address" },
      { name: "amount", type: "bytes32" },
    ],
    outputs: [{ name: "transferred", type: "bytes32" }],
  },
  {
    name: "confidentialTransferFrom",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "from",   type: "address" },
      { name: "to",     type: "address" },
      { name: "amount", type: "bytes32" },
    ],
    outputs: [{ name: "transferred", type: "bytes32" }],
  },
  {
    name: "OperatorSet",
    type: "event",
    inputs: [
      { name: "holder",   type: "address", indexed: true },
      { name: "operator", type: "address", indexed: true },
      { name: "until",    type: "uint48",  indexed: false },
    ],
  },
] as const;

export const DISCLOSURE_ABI = [
  {
    name: "grantView",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "roundId",     type: "uint256" },
      { name: "counterparty", type: "address" },
    ],
    outputs: [],
  },
  {
    name: "viewGranted",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "roundId",     type: "uint256" },
      { name: "investor",    type: "address" },
      { name: "counterparty", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "ViewGranted",
    type: "event",
    inputs: [
      { name: "roundId",     type: "uint256", indexed: true },
      { name: "investor",    type: "address", indexed: true },
      { name: "counterparty", type: "address", indexed: true },
    ],
  },
] as const;

// Round status enum (mirrors RoundFactory.Status)
export enum RoundStatus {
  DRAFT = 0,
  OPEN = 1,
  CLOSED = 2,
  CANCELLED = 3,
}

export const STATUS_LABEL: Record<RoundStatus, string> = {
  [RoundStatus.DRAFT]:     "Draft",
  [RoundStatus.OPEN]:      "Open",
  [RoundStatus.CLOSED]:    "Closed",
  [RoundStatus.CANCELLED]: "Cancelled",
};

// cUSDT has 6 decimals (matches MockUSDT)
export const CUSDT_DECIMALS = 6n;
export const CUSDT_UNIT = 10n ** CUSDT_DECIMALS;

export function formatUSDT(raw: bigint): string {
  return `$${(Number(raw) / Number(CUSDT_UNIT)).toLocaleString()}`;
}

export function parseUSDT(dollars: number): bigint {
  return BigInt(Math.round(dollars)) * CUSDT_UNIT;
}
