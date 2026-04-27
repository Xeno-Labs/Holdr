import { expect } from "chai";
import { ethers } from "hardhat";
import { RoundFactory } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("RoundFactory", function () {
  let roundFactory: RoundFactory;
  let founder: SignerWithAddress;
  let other: SignerWithAddress;
  let allocations: SignerWithAddress;

  const ROUND_NAME = "Cipher Labs Seed";
  const TARGET_RAISE = ethers.parseUnits("5000000", 6); // $5M, 6 decimals
  let deadline: bigint;

  beforeEach(async function () {
    [founder, other, allocations] = await ethers.getSigners();

    const RoundFactory = await ethers.getContractFactory("RoundFactory");
    roundFactory = await RoundFactory.deploy();
    await roundFactory.waitForDeployment();

    // Set a deadline 30 days in the future
    const latestBlock = await ethers.provider.getBlock("latest");
    deadline = BigInt(latestBlock!.timestamp) + BigInt(30 * 24 * 60 * 60);
  });

  describe("setAllocationsContract", function () {
    it("sets the allocations contract once", async function () {
      await roundFactory.setAllocationsContract(allocations.address);
      expect(await roundFactory.allocationsContract()).to.equal(allocations.address);
    });

    it("reverts on second call", async function () {
      await roundFactory.setAllocationsContract(allocations.address);
      await expect(roundFactory.setAllocationsContract(other.address))
        .to.be.revertedWithCustomError(roundFactory, "AllocationsAlreadySet");
    });
  });

  describe("createRound", function () {
    it("creates a round in DRAFT status", async function () {
      const tx = await roundFactory.connect(founder).createRound(ROUND_NAME, TARGET_RAISE, deadline);
      await tx.wait();

      const round = await roundFactory.getRound(1n);
      expect(round.founder).to.equal(founder.address);
      expect(round.name).to.equal(ROUND_NAME);
      expect(round.targetRaise).to.equal(TARGET_RAISE);
      expect(round.status).to.equal(0); // DRAFT
      expect(round.totalRaised).to.equal(0n);
    });

    it("increments roundCount", async function () {
      await roundFactory.connect(founder).createRound(ROUND_NAME, TARGET_RAISE, deadline);
      expect(await roundFactory.roundCount()).to.equal(1n);

      await roundFactory.connect(founder).createRound("Round 2", TARGET_RAISE, deadline);
      expect(await roundFactory.roundCount()).to.equal(2n);
    });

    it("emits RoundCreated event", async function () {
      await expect(roundFactory.connect(founder).createRound(ROUND_NAME, TARGET_RAISE, deadline))
        .to.emit(roundFactory, "RoundCreated")
        .withArgs(1n, founder.address, ROUND_NAME, TARGET_RAISE);
    });

    it("reverts if deadline is in the past", async function () {
      const latestBlock = await ethers.provider.getBlock("latest");
      const pastDeadline = BigInt(latestBlock!.timestamp) - 1n;
      await expect(
        roundFactory.connect(founder).createRound(ROUND_NAME, TARGET_RAISE, pastDeadline)
      ).to.be.revertedWithCustomError(roundFactory, "DeadlineMustBeFuture");
    });
  });

  describe("openRound", function () {
    beforeEach(async function () {
      await roundFactory.connect(founder).createRound(ROUND_NAME, TARGET_RAISE, deadline);
    });

    it("opens a DRAFT round", async function () {
      await roundFactory.connect(founder).openRound(1n);
      const round = await roundFactory.getRound(1n);
      expect(round.status).to.equal(1); // OPEN
    });

    it("emits RoundOpened", async function () {
      await expect(roundFactory.connect(founder).openRound(1n))
        .to.emit(roundFactory, "RoundOpened")
        .withArgs(1n);
    });

    it("reverts if caller is not founder", async function () {
      await expect(roundFactory.connect(other).openRound(1n))
        .to.be.revertedWithCustomError(roundFactory, "NotFounder");
    });

    it("reverts if round is not in DRAFT", async function () {
      await roundFactory.connect(founder).openRound(1n);
      await expect(roundFactory.connect(founder).openRound(1n))
        .to.be.revertedWithCustomError(roundFactory, "InvalidStatus");
    });
  });

  describe("cancelRound", function () {
    beforeEach(async function () {
      await roundFactory.connect(founder).createRound(ROUND_NAME, TARGET_RAISE, deadline);
    });

    it("cancels a DRAFT round", async function () {
      await roundFactory.connect(founder).cancelRound(1n);
      const round = await roundFactory.getRound(1n);
      expect(round.status).to.equal(3); // CANCELLED
    });

    it("cancels an OPEN round", async function () {
      await roundFactory.connect(founder).openRound(1n);
      await roundFactory.connect(founder).cancelRound(1n);
      const round = await roundFactory.getRound(1n);
      expect(round.status).to.equal(3); // CANCELLED
    });

    it("reverts if caller is not founder", async function () {
      await expect(roundFactory.connect(other).cancelRound(1n))
        .to.be.revertedWithCustomError(roundFactory, "NotFounder");
    });

    it("emits RoundCancelled", async function () {
      await expect(roundFactory.connect(founder).cancelRound(1n))
        .to.emit(roundFactory, "RoundCancelled")
        .withArgs(1n);
    });
  });

  describe("finaliseClose", function () {
    beforeEach(async function () {
      await roundFactory.connect(founder).createRound(ROUND_NAME, TARGET_RAISE, deadline);
      await roundFactory.connect(founder).openRound(1n);
      await roundFactory.setAllocationsContract(allocations.address);
    });

    it("sets totalRaised and CLOSED status", async function () {
      await roundFactory.connect(allocations).finaliseClose(1n, TARGET_RAISE);
      const round = await roundFactory.getRound(1n);
      expect(round.status).to.equal(2); // CLOSED
      expect(round.totalRaised).to.equal(TARGET_RAISE);
    });

    it("reverts if caller is not allocations contract", async function () {
      await expect(roundFactory.connect(other).finaliseClose(1n, TARGET_RAISE))
        .to.be.revertedWithCustomError(roundFactory, "OnlyAllocations");
    });

    it("emits RoundClosed", async function () {
      await expect(roundFactory.connect(allocations).finaliseClose(1n, TARGET_RAISE))
        .to.emit(roundFactory, "RoundClosed")
        .withArgs(1n, TARGET_RAISE);
    });
  });
});
