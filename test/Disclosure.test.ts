import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { FhevmType } from "@fhevm/hardhat-plugin";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { RoundFactory, Allocations, Disclosure } from "../typechain-types";

describe("Disclosure (FHE)", function () {
  let roundFactory: RoundFactory;
  let allocations: Allocations;
  let disclosure: Disclosure;
  let founder: HardhatEthersSigner;
  let investor: HardhatEthersSigner;
  let counterparty: HardhatEthersSigner;
  let fakeSubscription: HardhatEthersSigner;
  let other: HardhatEthersSigner;

  let roundId: bigint;
  let allocationsAddress: string;
  const ALLOC = 500_000n;

  before(async function () {
    if (!fhevm.isMock) {
      this.skip();
    }

    [founder, investor, counterparty, fakeSubscription, other] = await ethers.getSigners();

    const RoundFactory = await ethers.getContractFactory("RoundFactory");
    roundFactory = await RoundFactory.deploy();

    const Allocations = await ethers.getContractFactory("Allocations");
    allocations = await Allocations.deploy(await roundFactory.getAddress());
    allocationsAddress = await allocations.getAddress();

    const Disclosure = await ethers.getContractFactory("Disclosure");
    disclosure = await Disclosure.deploy(allocationsAddress);

    const disclosureAddress = await disclosure.getAddress();

    await (await roundFactory.setAllocationsContract(allocationsAddress)).wait();
    await (await allocations.setSubscriptionContract(fakeSubscription.address)).wait();
    await (await allocations.setDisclosureContract(disclosureAddress)).wait();
  });

  beforeEach(async function () {
    const latestBlock = await ethers.provider.getBlock("latest");
    const deadline = BigInt(latestBlock!.timestamp) + BigInt(30 * 24 * 60 * 60);

    await (await roundFactory.connect(founder).createRound("Disclosure Test", 1_000_000n, deadline)).wait();
    roundId = await roundFactory.roundCount();

    // Add investor with encrypted allocation
    const encInput = await fhevm
      .createEncryptedInput(allocationsAddress, founder.address)
      .add64(ALLOC)
      .encrypt();

    await (
      await allocations.connect(founder).addInvestor(
        roundId,
        investor.address,
        encInput.handles[0],
        encInput.inputProof
      )
    ).wait();
  });

  it("grants counterparty access to decrypt allocation", async function () {
    await expect(
      disclosure.connect(investor).grantView(roundId, counterparty.address)
    )
      .to.emit(disclosure, "ViewGranted")
      .withArgs(roundId, investor.address, counterparty.address);

    expect(await disclosure.viewGranted(roundId, investor.address, counterparty.address)).to.be.true;
  });

  it("counterparty can decrypt allocation after grant", async function () {
    await (await disclosure.connect(investor).grantView(roundId, counterparty.address)).wait();

    const handle = await allocations.getAllocation(roundId, investor.address);
    const decrypted = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      handle,
      allocationsAddress,
      counterparty
    );

    expect(decrypted).to.equal(ALLOC);
  });

  it("non-granted address cannot decrypt allocation", async function () {
    const handle = await allocations.getAllocation(roundId, investor.address);
    await expect(
      fhevm.userDecryptEuint(FhevmType.euint64, handle, allocationsAddress, other)
    ).to.be.rejected;
  });

  it("reverts if investor has no allocation in round", async function () {
    await expect(
      disclosure.connect(other).grantView(roundId, counterparty.address)
    ).to.be.revertedWithCustomError(allocations, "NotFound");
  });

  it("reverts on zero-address counterparty", async function () {
    await expect(
      disclosure.connect(investor).grantView(roundId, ethers.ZeroAddress)
    ).to.be.revertedWithCustomError(disclosure, "InvalidCounterparty");
  });
});
