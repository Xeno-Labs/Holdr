/**
 * Deploy InvestorCredential against an **existing** Allocations contract and call
 * setCredentialContract once. Use when the main stack was deployed before credentials
 * existed, or wiring was skipped.
 *
 * Usage:
 *   ALLOCATIONS_ADDRESS=0x... npx hardhat run scripts/deploy-investor-credential-only.ts --network sepolia
 *
 * If ALLOCATIONS_ADDRESS is omitted, reads `Allocations` from ./deployed.json (repo root).
 */

import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  let allocationsAddress =
    process.env.ALLOCATIONS_ADDRESS?.trim() ||
    process.env.NEXT_PUBLIC_ALLOCATIONS_ADDRESS?.trim();

  if (!allocationsAddress) {
    const deployedPath = path.join(__dirname, "../deployed.json");
    if (fs.existsSync(deployedPath)) {
      const raw = JSON.parse(fs.readFileSync(deployedPath, "utf8")) as {
        Allocations?: string;
      };
      if (raw.Allocations) allocationsAddress = raw.Allocations;
    }
  }

  if (!allocationsAddress) {
    throw new Error(
      "Set ALLOCATIONS_ADDRESS or NEXT_PUBLIC_ALLOCATIONS_ADDRESS, or add Allocations to deployed.json",
    );
  }

  console.log("Network:", (await ethers.provider.getNetwork()).name);
  console.log("Deployer:", deployer.address);
  console.log("Allocations:", allocationsAddress);

  const allocations = await ethers.getContractAt("Allocations", allocationsAddress);
  const existing = await allocations.credentialContract();
  if (existing !== ethers.ZeroAddress) {
    console.log("Allocations.credentialContract already set to:", existing);
    console.log("Nothing to do (CredentialAlreadySet if you try again).");
    return;
  }

  console.log("\nDeploying InvestorCredential...");
  const Factory = await ethers.getContractFactory("InvestorCredential");
  const credential = await Factory.deploy(allocationsAddress);
  await credential.waitForDeployment();
  const credentialAddress = await credential.getAddress();
  console.log("  InvestorCredential:", credentialAddress);

  console.log("\nWiring Allocations.setCredentialContract...");
  const tx = await allocations.setCredentialContract(credentialAddress);
  await tx.wait();
  console.log("  Done.");

  console.log("\nAdd to frontend/.env.local:");
  console.log(`NEXT_PUBLIC_INVESTOR_CREDENTIAL_ADDRESS=${credentialAddress}`);
  console.log("\nOptional: merge InvestorCredential into deployed.json for your records.");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
