import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { FhevmType } from "@fhevm/hardhat-plugin";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { RoundFactory, Allocations } from "../typechain-types";

describe("Allocations (FHE)", function () {
  let roundFactory: RoundFactory;
  let allocations: Allocations;
  let founder: HardhatEthersSigner;
  let investor1: HardhatEthersSigner;
  let investor2: HardhatEthersSigner;
  let fakeSubscription: HardhatEthersSigner; // stands in for subscription contract
  let other: HardhatEthersSigner;            // truly unauthorized wallet

  let roundId: bigint;
  let allocationsAddress: string;
  let deadline: bigint;

  const ALLOC_1 = 2_000_000n; // $2M in base units (6 decimals = 2_000_000_000_000)
  const ALLOC_2 = 1_500_000n; // $1.5M

  before(async function () {
    if (!fhevm.isMock) {
      console.warn("Allocations FHE tests require mock environment — skipping on Sepolia");
      this.skip();
    }

    [founder, investor1, investor2, fakeSubscription, other] = await ethers.getSigners();

    // Deploy RoundFactory
    const RoundFactory = await ethers.getContractFactory("RoundFactory");
    roundFactory = await RoundFactory.deploy();
    await roundFactory.waitForDeployment();

    // Deploy Allocations
    const Allocations = await ethers.getContractFactory("Allocations");
    allocations = await Allocations.deploy(await roundFactory.getAddress());
    await allocations.waitForDeployment();
    allocationsAddress = await allocations.getAddress();

    // Wire contracts
    await (await roundFactory.setAllocationsContract(allocationsAddress)).wait();

    // Simulate Subscription wiring (use fakeSubscription as stand-in)
    await (await allocations.setSubscriptionContract(fakeSubscription.address)).wait();
  });

  beforeEach(async function () {
    const latestBlock = await ethers.provider.getBlock("latest");
    deadline = BigInt(latestBlock!.timestamp) + BigInt(30 * 24 * 60 * 60);

    // Create a fresh DRAFT round for each test
    const tx = await roundFactory.connect(founder).createRound("Test Round", 5_000_000n, deadline);
    const receipt = await tx.wait();
    roundId = await roundFactory.roundCount();
  });

  describe("addInvestor", function () {
    it("adds an investor with an encrypted allocation", async function () {
      const encInput = await fhevm
        .createEncryptedInput(allocationsAddress, founder.address)
        .add64(ALLOC_1)
        .encrypt();

      await expect(
        allocations.connect(founder).addInvestor(
          roundId,
          investor1.address,
          encInput.handles[0],
          encInput.inputProof
        )
      )
        .to.emit(allocations, "InvestorAdded")
        .withArgs(roundId, investor1.address);

      expect(await allocations.investorCount(roundId)).to.equal(1n);
    });

    it("investor can decrypt their own allocation", async function () {
      const encInput = await fhevm
        .createEncryptedInput(allocationsAddress, founder.address)
        .add64(ALLOC_1)
        .encrypt();

      await (
        await allocations.connect(founder).addInvestor(
          roundId,
          investor1.address,
          encInput.handles[0],
          encInput.inputProof
        )
      ).wait();

      const handle = await allocations.getAllocation(roundId, investor1.address);

      // Investor decrypts their own allocation
      const decrypted = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        handle,
        allocationsAddress,
        investor1
      );

      expect(decrypted).to.equal(ALLOC_1);
    });

    it("founder can decrypt any investor's allocation", async function () {
      const encInput = await fhevm
        .createEncryptedInput(allocationsAddress, founder.address)
        .add64(ALLOC_2)
        .encrypt();

      await (
        await allocations.connect(founder).addInvestor(
          roundId,
          investor2.address,
          encInput.handles[0],
          encInput.inputProof
        )
      ).wait();

      const handle = await allocations.getAllocation(roundId, investor2.address);

      // Founder decrypts investor2's allocation
      const decrypted = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        handle,
        allocationsAddress,
        founder
      );

      expect(decrypted).to.equal(ALLOC_2);
    });

    it("third party cannot decrypt another investor's allocation", async function () {
      const encInput = await fhevm
        .createEncryptedInput(allocationsAddress, founder.address)
        .add64(ALLOC_1)
        .encrypt();

      await (
        await allocations.connect(founder).addInvestor(
          roundId,
          investor1.address,
          encInput.handles[0],
          encInput.inputProof
        )
      ).wait();

      const handle = await allocations.getAllocation(roundId, investor1.address);

      // `other` is not allowed — should throw
      await expect(
        fhevm.userDecryptEuint(FhevmType.euint64, handle, allocationsAddress, other)
      ).to.be.rejected;
    });

    it("reverts if caller is not the founder", async function () {
      const encInput = await fhevm
        .createEncryptedInput(allocationsAddress, other.address)
        .add64(ALLOC_1)
        .encrypt();

      await expect(
        allocations.connect(other).addInvestor(
          roundId,
          investor1.address,
          encInput.handles[0],
          encInput.inputProof
        )
      ).to.be.revertedWithCustomError(allocations, "NotFounder");
    });

    it("reverts on duplicate investor", async function () {
      const encInput = await fhevm
        .createEncryptedInput(allocationsAddress, founder.address)
        .add64(ALLOC_1)
        .encrypt();

      await (
        await allocations.connect(founder).addInvestor(
          roundId,
          investor1.address,
          encInput.handles[0],
          encInput.inputProof
        )
      ).wait();

      const encInput2 = await fhevm
        .createEncryptedInput(allocationsAddress, founder.address)
        .add64(ALLOC_1)
        .encrypt();

      await expect(
        allocations.connect(founder).addInvestor(
          roundId,
          investor1.address,
          encInput2.handles[0],
          encInput2.inputProof
        )
      ).to.be.revertedWithCustomError(allocations, "AlreadyAdded");
    });

    it("reverts if round is not DRAFT", async function () {
      // Open the round first
      await (await roundFactory.connect(founder).openRound(roundId)).wait();

      const encInput = await fhevm
        .createEncryptedInput(allocationsAddress, founder.address)
        .add64(ALLOC_1)
        .encrypt();

      await expect(
        allocations.connect(founder).addInvestor(
          roundId,
          investor1.address,
          encInput.handles[0],
          encInput.inputProof
        )
      ).to.be.revertedWithCustomError(allocations, "RoundNotDraft");
    });
  });

  describe("markSubscribed", function () {
    beforeEach(async function () {
      const encInput = await fhevm
        .createEncryptedInput(allocationsAddress, founder.address)
        .add64(ALLOC_1)
        .encrypt();
      await (
        await allocations.connect(founder).addInvestor(
          roundId,
          investor1.address,
          encInput.handles[0],
          encInput.inputProof
        )
      ).wait();
    });

    it("marks investor as subscribed (only subscription contract)", async function () {
      await (await allocations.connect(fakeSubscription).markSubscribed(roundId, investor1.address)).wait();
      expect(await allocations.isSubscribed(roundId, investor1.address)).to.be.true;
    });

    it("reverts if caller is not subscription contract", async function () {
      await expect(
        allocations.connect(founder).markSubscribed(roundId, investor1.address)
      ).to.be.revertedWithCustomError(allocations, "OnlySubscription");
    });
  });

  describe("requestClose + submitCloseResult", function () {
    beforeEach(async function () {
      // Add two investors
      for (const [investor, amount] of [[investor1, ALLOC_1], [investor2, ALLOC_2]] as const) {
        const encInput = await fhevm
          .createEncryptedInput(allocationsAddress, founder.address)
          .add64(amount)
          .encrypt();
        await (
          await allocations.connect(founder).addInvestor(
            roundId,
            investor.address,
            encInput.handles[0],
            encInput.inputProof
          )
        ).wait();
      }

      // Open round
      await (await roundFactory.connect(founder).openRound(roundId)).wait();

      // Mark all subscribed (simulate subscription contract)
      await (await allocations.connect(fakeSubscription).markSubscribed(roundId, investor1.address)).wait();
      await (await allocations.connect(fakeSubscription).markSubscribed(roundId, investor2.address)).wait();
    });

    it("requestClose emits CloseRequested with handle", async function () {
      await expect(allocations.requestClose(roundId))
        .to.emit(allocations, "CloseRequested")
        .withArgs(roundId, (handle: string) => handle !== ethers.ZeroHash);
    });

    it("full close flow: requestClose → publicDecrypt → submitCloseResult", async function () {
      const tx = await allocations.requestClose(roundId);
      await tx.wait();

      const handle = await allocations.pendingCloseHandle(roundId);
      expect(handle).to.not.equal(ethers.ZeroHash);

      // Off-chain: KMS (mock) decrypts the handle
      // publicDecrypt returns { clearValues: Record<handle, bigint>, abiEncodedClearValues, decryptionProof }
      const decryptResult = await fhevm.publicDecrypt([handle]);
      const decryptedTotal = decryptResult.clearValues[handle as `0x${string}`] as bigint;
      expect(decryptedTotal).to.equal(ALLOC_1 + ALLOC_2);

      // Submit the KMS-signed proof back on-chain
      const submitTx = await allocations.submitCloseResult(
        roundId,
        [handle],                                   // handlesList: bytes32[]
        decryptResult.abiEncodedClearValues,        // abi-encoded uint64
        decryptResult.decryptionProof               // KMS signature bundle
      );
      await submitTx.wait();

      // Round should now be CLOSED with correct totalRaised
      const round = await roundFactory.getRound(roundId);
      expect(round.status).to.equal(2); // CLOSED
      expect(round.totalRaised).to.equal(ALLOC_1 + ALLOC_2);
    });
  });
});
