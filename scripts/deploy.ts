import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Deploy all Vestr contracts in dependency order:
 *
 *   MockUSDT → MockcUSDT
 *   RoundFactory → Allocations → cEquity → Subscription → Disclosure
 *
 * After deploy, wires cross-contract references:
 *   RoundFactory.setAllocationsContract(allocations)
 *   Allocations.setSubscriptionContract(subscription)
 *
 * Writes deployed addresses to:
 *   - deployed.json  (for scripts/seed.ts and tests)
 *   - .env.local     (for the Next.js frontend)
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

  // ── 1. MockUSDT ────────────────────────────────────────────────────────────
  console.log("Deploying MockUSDT...");
  const MockUSDT = await ethers.getContractFactory("MockUSDT");
  const mockUSDT = await MockUSDT.deploy();
  await mockUSDT.waitForDeployment();
  const mockUSDTAddress = await mockUSDT.getAddress();
  console.log("  MockUSDT:", mockUSDTAddress);

  // ── 2. MockcUSDT ───────────────────────────────────────────────────────────
  console.log("Deploying MockcUSDT...");
  const MockcUSDT = await ethers.getContractFactory("MockcUSDT");
  const MAX_DECRYPTION_DELAY = 60 * 60 * 24; // 1 day in seconds
  const mockCUSDT = await MockcUSDT.deploy(mockUSDTAddress, MAX_DECRYPTION_DELAY);
  await mockCUSDT.waitForDeployment();
  const cUSDTAddress = await mockCUSDT.getAddress();
  console.log("  MockcUSDT:", cUSDTAddress);

  // ── 3. RoundFactory ────────────────────────────────────────────────────────
  console.log("Deploying RoundFactory...");
  const RoundFactory = await ethers.getContractFactory("RoundFactory");
  const roundFactory = await RoundFactory.deploy();
  await roundFactory.waitForDeployment();
  const roundFactoryAddress = await roundFactory.getAddress();
  console.log("  RoundFactory:", roundFactoryAddress);

  // ── 4. Allocations ─────────────────────────────────────────────────────────
  console.log("Deploying Allocations...");
  const Allocations = await ethers.getContractFactory("Allocations");
  const allocations = await Allocations.deploy(roundFactoryAddress);
  await allocations.waitForDeployment();
  const allocationsAddress = await allocations.getAddress();
  console.log("  Allocations:", allocationsAddress);

  // ── 5. cEquity ─────────────────────────────────────────────────────────────
  // cEquity needs Subscription address — deploy a proxy address first,
  // then deploy Subscription, then register. We use a two-step pattern:
  // deploy cEquity with a placeholder, then call setSubscriptionContract on it.
  // Alternatively we can pre-compute the nonce address. For simplicity:
  // Deploy Subscription first using CREATE with known nonce ordering.
  //
  // Ordering: cEquity(subscriptionAddress) needs subscription deployed first.
  // Solution: deploy cEquity with deployer as temp owner, then reassign.
  // For v1 we relax this by making cEquity accept a post-deploy setter.
  //
  // Actual approach: deploy Subscription first with a dummy cEquity address,
  // then deploy cEquity with the real Subscription address, then update Subscription.
  // Cleanest: deploy all, then wire. Use a mutable setter on cEquity for the subscription.

  console.log("Deploying Subscription (pre-wire)...");
  const Subscription = await ethers.getContractFactory("Subscription");
  // Temporary deploy with zero cEquity address — will be updated after cEquity deploys
  // We handle this by making cEquity's constructor take the subscription address.
  // Deploying order: Subscription → cEquity(subscription) → wire cEquity back into Subscription

  // Step A: get the future cEquity address (next nonce)
  const deployerNonce = await ethers.provider.getTransactionCount(deployer.address);
  const futureCEquityAddress = ethers.getCreateAddress({
    from: deployer.address,
    nonce: deployerNonce + 1, // Subscription is +0, cEquity is +1
  });

  const subscription = await Subscription.deploy(
    roundFactoryAddress,
    allocationsAddress,
    futureCEquityAddress, // forward reference
    cUSDTAddress
  );
  await subscription.waitForDeployment();
  const subscriptionAddress = await subscription.getAddress();
  console.log("  Subscription:", subscriptionAddress);

  // ── cEquity with real subscription address ─────────────────────────────────
  console.log("Deploying cEquity...");
  const CEquity = await ethers.getContractFactory("cEquity");
  const cEquity = await CEquity.deploy(subscriptionAddress);
  await cEquity.waitForDeployment();
  const cEquityAddress = await cEquity.getAddress();
  console.log("  cEquity:", cEquityAddress);

  if (cEquityAddress.toLowerCase() !== futureCEquityAddress.toLowerCase()) {
    console.warn("⚠️  cEquity address mismatch — update Subscription manually.");
    console.warn("    Expected:", futureCEquityAddress);
    console.warn("    Got:     ", cEquityAddress);
  }

  // ── 6. Disclosure ──────────────────────────────────────────────────────────
  console.log("Deploying Disclosure...");
  const Disclosure = await ethers.getContractFactory("Disclosure");
  const disclosure = await Disclosure.deploy(allocationsAddress);
  await disclosure.waitForDeployment();
  const disclosureAddress = await disclosure.getAddress();
  console.log("  Disclosure:", disclosureAddress);

  // ── Wire cross-contract references ─────────────────────────────────────────
  console.log("\nWiring contracts...");

  let tx = await roundFactory.setAllocationsContract(allocationsAddress);
  await tx.wait();
  console.log("  RoundFactory.setAllocationsContract ✓");

  tx = await allocations.setSubscriptionContract(subscriptionAddress);
  await tx.wait();
  console.log("  Allocations.setSubscriptionContract ✓");

  tx = await allocations.setDisclosureContract(disclosureAddress);
  await tx.wait();
  console.log("  Allocations.setDisclosureContract ✓");

  // ── Write addresses ────────────────────────────────────────────────────────
  const addresses = {
    network: (await ethers.provider.getNetwork()).name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    MockUSDT: mockUSDTAddress,
    MockcUSDT: cUSDTAddress,
    RoundFactory: roundFactoryAddress,
    Allocations: allocationsAddress,
    Subscription: subscriptionAddress,
    cEquity: cEquityAddress,
    Disclosure: disclosureAddress,
  };

  const deployedPath = path.join(__dirname, "../deployed.json");
  fs.writeFileSync(deployedPath, JSON.stringify(addresses, null, 2));
  console.log("\nAddresses written to deployed.json");

  // Write .env.local for Next.js frontend
  const envLocal = `# Auto-generated by scripts/deploy.ts — do not edit manually
NEXT_PUBLIC_CHAIN_ID=${addresses.chainId}
NEXT_PUBLIC_MOCK_USDT_ADDRESS=${mockUSDTAddress}
NEXT_PUBLIC_CUSDT_ADDRESS=${cUSDTAddress}
NEXT_PUBLIC_ROUND_FACTORY_ADDRESS=${roundFactoryAddress}
NEXT_PUBLIC_ALLOCATIONS_ADDRESS=${allocationsAddress}
NEXT_PUBLIC_SUBSCRIPTION_ADDRESS=${subscriptionAddress}
NEXT_PUBLIC_CEQUITY_ADDRESS=${cEquityAddress}
NEXT_PUBLIC_DISCLOSURE_ADDRESS=${disclosureAddress}
`;
  const frontendDir = path.join(__dirname, "../frontend");
  if (fs.existsSync(frontendDir)) {
    fs.writeFileSync(path.join(frontendDir, ".env.local"), envLocal);
    console.log("Frontend .env.local written");
  }

  console.log("\n✅ Deploy complete\n");
  console.log(JSON.stringify(addresses, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
