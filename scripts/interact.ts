/**
 * interact.ts — Full happy-path interaction script for Vestr on localhost.
 *
 * Run against a local node:
 *   npx hardhat node                            (terminal 1)
 *   npx hardhat run scripts/deploy.ts --network localhost
 *   npx hardhat run scripts/interact.ts --network localhost
 *
 * What this covers:
 *   1. Mint + wrap MockUSDT → cUSDT for 5 demo investors
 *   2. Founder creates Cipher Labs Seed round
 *   3. Founder adds 5 investors with encrypted allocations
 *   4. Founder opens round
 *   5. One investor decrypts their allocation (verifying ACL)
 *   6. One investor subscribes (encrypted transferFrom)
 *   7. Remaining investors subscribe
 *   8. Anyone calls closeRound → requestClose (FHE aggregate sum)
 *   9. Off-chain: decrypt aggregate via fhevm (mock)
 *  10. submitCloseResult → round CLOSED, totalRaised written on-chain
 *  11. Print three-view cap table (founder/investor/public)
 */

import { ethers, fhevm } from "hardhat";
import { FhevmType } from "@fhevm/hardhat-plugin";
import * as fs from "fs";
import * as path from "path";

const USDT_DECIMALS = 6n;

const ALLOCATIONS: bigint[] = [
  2_000_000n * 10n ** USDT_DECIMALS,
  1_500_000n * 10n ** USDT_DECIMALS,
  750_000n  * 10n ** USDT_DECIMALS,
  500_000n  * 10n ** USDT_DECIMALS,
  250_000n  * 10n ** USDT_DECIMALS,
];

function fmt(amount: bigint): string {
  return `$${(Number(amount) / Number(10n ** USDT_DECIMALS)).toLocaleString()}`;
}

async function main() {
  if (!fhevm.isMock) {
    console.log("⚠️  interact.ts runs on mock network only. Use Sepolia for real FHE.");
    process.exit(0);
  }

  const deployed = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../deployed.json"), "utf8")
  );

  const signers = await ethers.getSigners();
  const founder   = signers[0];
  const investors = signers.slice(1, 6);

  const mockUSDT    = await ethers.getContractAt("MockUSDT",    deployed.MockUSDT);
  const mockCUSDT   = await ethers.getContractAt("MockcUSDT",   deployed.MockcUSDT);
  const roundFactory = await ethers.getContractAt("RoundFactory", deployed.RoundFactory);
  const allocations  = await ethers.getContractAt("Allocations",  deployed.Allocations);
  const subscription = await ethers.getContractAt("Subscription", deployed.Subscription);

  const allocAddr = deployed.Allocations;
  const subAddr   = deployed.Subscription;

  console.log("\n══════════════════════════════════════════");
  console.log("  VESTR — Local Interaction Script");
  console.log("══════════════════════════════════════════\n");

  // ── 1. Mint + wrap MockUSDT for each investor ─────────────────────────────
  console.log("【1】 Minting + wrapping MockUSDT → cUSDT for 5 investors...");
  for (let i = 0; i < investors.length; i++) {
    const amt = ALLOCATIONS[i];
    await (await mockUSDT.mint(investors[i].address, amt)).wait();
    await (await mockUSDT.connect(investors[i]).approve(deployed.MockcUSDT, amt)).wait();
    await (await mockCUSDT.connect(investors[i]).wrap(BigInt(amt))).wait();
    console.log(`   investor[${i}] wrapped ${fmt(amt)} → encrypted cUSDT`);
  }

  // ── 2. Founder creates round ───────────────────────────────────────────────
  console.log("\n【2】 Founder creates Cipher Labs Seed round...");
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60);
  const targetRaise = 5_000_000n * 10n ** USDT_DECIMALS;

  const createTx = await roundFactory.connect(founder).createRound(
    "Cipher Labs Seed", targetRaise, deadline
  );
  await createTx.wait();
  const roundId = await roundFactory.roundCount();
  console.log(`   Round created. ID = ${roundId}`);

  // ── 3. Founder adds 5 investors with encrypted allocations ─────────────────
  console.log("\n【3】 Founder adding investors with encrypted allocations...");
  for (let i = 0; i < investors.length; i++) {
    const encInput = await fhevm
      .createEncryptedInput(allocAddr, founder.address)
      .add64(ALLOCATIONS[i])
      .encrypt();

    await (
      await allocations.connect(founder).addInvestor(
        roundId,
        investors[i].address,
        encInput.handles[0],
        encInput.inputProof
      )
    ).wait();
    console.log(`   investor[${i}] added (allocation encrypted)`);
  }

  // ── 4. Founder opens round ─────────────────────────────────────────────────
  console.log("\n【4】 Founder opens round...");
  await (await roundFactory.connect(founder).openRound(roundId)).wait();
  console.log("   Round status → OPEN");

  // ── 5. investor[0] decrypts their own allocation ───────────────────────────
  console.log("\n【5】 investor[0] decrypts their own allocation...");
  const handle0 = await allocations.getAllocation(roundId, investors[0].address);
  const myAlloc = await fhevm.userDecryptEuint(
    FhevmType.euint64, handle0, allocAddr, investors[0]
  );
  console.log(`   investor[0] sees: ${fmt(myAlloc)} ✓`);

  // ── 6. Each investor approves subscription + subscribes ────────────────────
  console.log("\n【6】 Investors approving + subscribing...");
  for (let i = 0; i < investors.length; i++) {
    // Approve subscription contract for allocation amount
    const encApproval = await fhevm
      .createEncryptedInput(deployed.MockcUSDT, investors[i].address)
      .add64(ALLOCATIONS[i])
      .encrypt();

    await (
      await mockCUSDT.connect(investors[i]).approve(
        subAddr,
        encApproval.handles[0],
        encApproval.inputProof
      )
    ).wait();

    await (await subscription.connect(investors[i]).subscribe(roundId)).wait();
    console.log(`   investor[${i}] subscribed (${fmt(ALLOCATIONS[i])})`);
  }

  // ── 7. Close: compute aggregate ────────────────────────────────────────────
  console.log("\n【7】 Closing round (FHE aggregate sum)...");
  const closeTx = await subscription.connect(founder).closeRound(roundId);
  await closeTx.wait();
  const encAggregate = await allocations.pendingCloseHandle(roundId);
  console.log(`   Aggregate handle: ${encAggregate}`);

  // ── 8. Off-chain: KMS decrypts aggregate ───────────────────────────────────
  console.log("\n【8】 KMS (mock) decrypting aggregate...");
  const decryptResult = await fhevm.publicDecrypt([encAggregate]);
  const totalRaised = decryptResult.decryptedResults[0] as bigint;
  console.log(`   Decrypted aggregate: ${fmt(totalRaised)}`);

  // ── 9. Submit KMS proof on-chain ───────────────────────────────────────────
  console.log("\n【9】 Submitting KMS-signed proof on-chain...");
  await (
    await allocations.submitCloseResult(
      roundId,
      decryptResult.handles,
      decryptResult.abiEncodedDecryptedResults,
      decryptResult.decryptionProof
    )
  ).wait();

  const round = await roundFactory.getRound(roundId);
  console.log(`   Round status → CLOSED`);
  console.log(`   totalRaised  = ${fmt(round.totalRaised)}`);

  // ── 10. Three-view cap table ───────────────────────────────────────────────
  console.log("\n══════════════════════════════════════════");
  console.log("  THREE-VIEW CAP TABLE DEMO");
  console.log("══════════════════════════════════════════\n");

  console.log("📋 PUBLIC VIEW (no wallet):");
  console.log(`   Round:  ${round.name}`);
  console.log(`   Status: CLOSED`);
  console.log(`   Raised: ${fmt(round.totalRaised)}`);
  for (let i = 0; i < investors.length; i++) {
    console.log(`   ${investors[i].address} | 🔒`);
  }

  console.log("\n👤 INVESTOR VIEW (investor[0]):");
  for (let i = 0; i < investors.length; i++) {
    const h = await allocations.getAllocation(roundId, investors[i].address);
    if (i === 0) {
      const val = await fhevm.userDecryptEuint(FhevmType.euint64, h, allocAddr, investors[0]);
      console.log(`   ${investors[i].address} | ${fmt(val)} 🔓  ← You`);
    } else {
      console.log(`   ${investors[i].address} | 🔒`);
    }
  }

  console.log("\n👑 FOUNDER VIEW (full cap table):");
  let runningTotal = 0n;
  for (let i = 0; i < investors.length; i++) {
    const h = await allocations.getAllocation(roundId, investors[i].address);
    const val = await fhevm.userDecryptEuint(FhevmType.euint64, h, allocAddr, founder);
    const pct = (Number(val) / Number(targetRaise) * 100).toFixed(1);
    console.log(`   ${investors[i].address} | ${fmt(val).padEnd(14)} ${pct}% 🔓`);
    runningTotal += val;
  }
  console.log(`   ─────────────────────────────────────`);
  console.log(`   TOTAL                 ${fmt(runningTotal)}`);

  console.log("\n✅ Interaction complete\n");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
