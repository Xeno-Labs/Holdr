import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Deploy all Vestr contracts in dependency order.
 *
 * Network behaviour:
 *   hardhat / localhost — deploy MockUSDT + MockcUSDT from scratch.
 *   sepolia             — use Zama's already-deployed mock USDT as the underlying
 *                         (free public mint, no deploy needed), then wrap it in our
 *                         own MockcUSDT so the Subscription interface stays consistent.
 *
 * Zama Sepolia addresses (https://docs.zama.org/protocol/protocol-apps/addresses/testnet/sepolia):
 *   Underlying mock USDT : 0xa7dA08FafDC9097Cc0E7D4f113A61e31d7e8e9b0  (1M/call public mint)
 *   cUSDTMock (their own): 0x4E7B06D78965594eB5EF5414c357ca21E1554491  (not used — interface mismatch)
 */

// Zama's official Sepolia confidential token addresses
// Source: https://docs.zama.org/protocol/protocol-apps/addresses/testnet/sepolia
const ZAMA_SEPOLIA_MOCK_USDT  = "0xa7dA08FafDC9097Cc0E7D4f113A61e31d7e8e9b0"; // underlying ERC-20 (public mint 1M/call)
const ZAMA_SEPOLIA_CUSDT_MOCK = "0x4E7B06D78965594eB5EF5414c357ca21E1554491"; // ERC-7984 wrapper (IConfidentialERC20-compatible)

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);
  const isSepolia = chainId === 11155111;

  console.log("Network:", network.name, `(chainId ${chainId})`);
  console.log("Deploying with:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

  // ── 1 & 2. Token setup ────────────────────────────────────────────────────
  // Sepolia: use Zama's already-deployed ERC-7984 cUSDTMock — no deploys needed.
  // Local:   deploy MockUSDT + our MockcUSDT wrapper (same IConfidentialERC20 interface).
  let mockUSDTAddress: string;
  let cUSDTAddress: string;

  if (isSepolia) {
    mockUSDTAddress = ZAMA_SEPOLIA_MOCK_USDT;
    cUSDTAddress    = ZAMA_SEPOLIA_CUSDT_MOCK;
    console.log("cUSDT: using Zama Sepolia cUSDTMock at", cUSDTAddress, "(skipping deploy)");
    console.log("MockUSDT underlying:", mockUSDTAddress);
  } else {
    console.log("Deploying MockUSDT...");
    const MockUSDT = await ethers.getContractFactory("MockUSDT");
    const mockUSDT = await MockUSDT.deploy();
    await mockUSDT.waitForDeployment();
    mockUSDTAddress = await mockUSDT.getAddress();
    console.log("  MockUSDT:", mockUSDTAddress);

    console.log("Deploying MockcUSDT...");
    const MockcUSDT = await ethers.getContractFactory("MockcUSDT");
    const mockCUSDT = await MockcUSDT.deploy(mockUSDTAddress);
    await mockCUSDT.waitForDeployment();
    cUSDTAddress = await mockCUSDT.getAddress();
    console.log("  MockcUSDT:", cUSDTAddress);
  }
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

  // ── 7. InvestorCredential ──────────────────────────────────────────────────
  console.log("Deploying InvestorCredential...");
  const InvestorCredential = await ethers.getContractFactory("InvestorCredential");
  const investorCredential = await InvestorCredential.deploy(allocationsAddress);
  await investorCredential.waitForDeployment();
  const investorCredentialAddress = await investorCredential.getAddress();
  console.log("  InvestorCredential:", investorCredentialAddress);

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

  tx = await allocations.setCredentialContract(investorCredentialAddress);
  await tx.wait();
  console.log("  Allocations.setCredentialContract ✓");

  // ── Write addresses ────────────────────────────────────────────────────────
  const addresses = {
    network: network.name,
    chainId,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    MockUSDT:  mockUSDTAddress,
    MockcUSDT: cUSDTAddress,
    cUSDT_note: isSepolia
      ? "Zama official cUSDTMock (ERC-7984) — not deployed by us"
      : "our MockcUSDT (ERC-7984 compatible) — deployed by us",
    RoundFactory: roundFactoryAddress,
    Allocations: allocationsAddress,
    Subscription: subscriptionAddress,
    cEquity: cEquityAddress,
    Disclosure: disclosureAddress,
    InvestorCredential: investorCredentialAddress,
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
NEXT_PUBLIC_INVESTOR_CREDENTIAL_ADDRESS=${investorCredentialAddress}
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
