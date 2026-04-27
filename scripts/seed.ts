import { ethers } from "hardhat";
import { parseUnits } from "ethers";
import * as fs from "fs";
import * as path from "path";

/**
 * Seed the Cipher Labs demo round for the Vestr submission video.
 *
 * What this script does:
 *   1. Loads deployed contract addresses from deployed.json
 *   2. Mints MockUSDT to 5 demo investor wallets
 *   3. Each investor approves + wraps MockUSDT → encrypted cUSDT balance
 *   4. Founder creates the "Cipher Labs Seed" round ($5M target)
 *   5. Founder adds all 5 investors with encrypted allocations
 *   6. Founder opens the round
 *   7. ONE demo investor (investor[0]) subscribes — live subscribe happens in the video
 *
 * Demo allocations:
 *   investor[0]: $2,000,000   (the live demo wallet)
 *   investor[1]: $1,500,000
 *   investor[2]: $750,000
 *   investor[3]: $500,000
 *   investor[4]: $250,000
 *   Total:       $5,000,000
 *
 * NOTE: This script requires fhevm encryption helpers. On local hardhat the
 * encryption is mocked; on Sepolia use the relayer SDK in the frontend instead.
 * For Sepolia seeding, run the frontend flow or adapt this script with the SDK.
 */

const ALLOCATIONS_USDT = [
  2_000_000n,
  1_500_000n,
  750_000n,
  500_000n,
  250_000n,
];

const USDT_DECIMALS = 6n;

async function main() {
  const deployed = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../deployed.json"), "utf8")
  );

  const signers = await ethers.getSigners();
  const founder = signers[0];
  const investors = signers.slice(1, 6); // signers[1..5]

  if (investors.length < 5) {
    throw new Error("Need at least 6 signers (founder + 5 investors). Check hardhat accounts config.");
  }

  console.log("Founder:  ", founder.address);
  investors.forEach((inv, i) => console.log(`Investor[${i}]:`, inv.address));

  const mockUSDT = await ethers.getContractAt("MockUSDT", deployed.MockUSDT);
  const mockCUSDT = await ethers.getContractAt("MockcUSDT", deployed.MockcUSDT);
  const roundFactory = await ethers.getContractAt("RoundFactory", deployed.RoundFactory);
  const allocations = await ethers.getContractAt("Allocations", deployed.Allocations);

  // ── Step 1: Mint MockUSDT to each investor ─────────────────────────────────
  console.log("\n[1] Minting MockUSDT to investors...");
  for (let i = 0; i < investors.length; i++) {
    const amount = ALLOCATIONS_USDT[i] * 10n ** USDT_DECIMALS;
    const tx = await mockUSDT.mint(investors[i].address, amount);
    await tx.wait();
    console.log(`  Minted ${ALLOCATIONS_USDT[i].toLocaleString()} mUSDT → investor[${i}]`);
  }

  // ── Step 2: Each investor approves + wraps MockUSDT → cUSDT ───────────────
  console.log("\n[2] Investors approving and wrapping mUSDT → cUSDT...");
  for (let i = 0; i < investors.length; i++) {
    const amount = ALLOCATIONS_USDT[i] * 10n ** USDT_DECIMALS;

    const approveTx = await mockUSDT.connect(investors[i]).approve(deployed.MockcUSDT, amount);
    await approveTx.wait();

    const wrapTx = await mockCUSDT.connect(investors[i]).wrap(amount);
    await wrapTx.wait();

    console.log(`  investor[${i}] wrapped ${ALLOCATIONS_USDT[i].toLocaleString()} → encrypted cUSDT`);
  }

  // ── Step 3: Founder creates the round ─────────────────────────────────────
  console.log("\n[3] Founder creating Cipher Labs Seed round...");
  const targetRaise = 5_000_000n * 10n ** USDT_DECIMALS;
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60); // 30 days

  const createTx = await roundFactory.connect(founder).createRound(
    "Cipher Labs Seed",
    targetRaise,
    deadline
  );
  const createReceipt = await createTx.wait();

  // Parse RoundCreated event to get roundId
  const roundCreatedEvent = createReceipt?.logs
    .map((log: { topics: string[]; data: string }) => {
      try { return roundFactory.interface.parseLog(log as Parameters<typeof roundFactory.interface.parseLog>[0]); } catch { return null; }
    })
    .find((e: { name: string } | null) => e?.name === "RoundCreated");

  const roundId: bigint = roundCreatedEvent?.args?.roundId ?? 1n;
  console.log(`  Round created. roundId = ${roundId}`);

  // ── Step 4: Founder adds investors with encrypted allocations ──────────────
  // NOTE: On a local hardhat node with fhevm mock, we can use TFHE.encrypt directly.
  // On Sepolia, encryptions must be done client-side via the relayer SDK.
  // This seed script uses a placeholder — replace with relayer SDK calls for Sepolia.
  console.log("\n[4] Adding investors with encrypted allocations...");
  console.log("  ⚠️  Allocation encryption requires fhevm mock (local) or relayer SDK (Sepolia).");
  console.log("     On Sepolia, use the frontend flow to add investors.");
  console.log("     Skipping encrypted addInvestor calls in seed script (add manually or via frontend).");

  // For local fhevm mock:
  // const { createInstances } = require("../test/utils/fhevmjs");
  // const instance = await createInstances(allocationsAddress, ethers, signer);
  // const encAmount = instance.encrypt64(ALLOCATIONS_USDT[i] * 10n ** USDT_DECIMALS);
  // await allocations.connect(founder).addInvestor(roundId, investors[i].address, encAmount.handle, encAmount.proof);

  // ── Step 5: Open round (after investors added manually or via frontend) ─────
  console.log("\n[5] Opening round...");
  console.log("  Run after adding investors via frontend or fhevm mock encryption.");
  console.log("  Command: await roundFactory.connect(founder).openRound(roundId)");

  console.log("\n✅ Seed complete (partial — encrypted steps require frontend or fhevm mock)");
  console.log(`   Round ID: ${roundId}`);
  console.log(`   Founder:  ${founder.address}`);
  investors.forEach((inv, i) =>
    console.log(`   investor[${i}]: ${inv.address} — $${ALLOCATIONS_USDT[i].toLocaleString()}`)
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
