import { expect } from "chai";
import { ethers } from "hardhat";
import { MockUSDT } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("MockUSDT", function () {
  let mockUSDT: MockUSDT;
  let owner: SignerWithAddress;
  let user: SignerWithAddress;

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();
    const MockUSDT = await ethers.getContractFactory("MockUSDT");
    mockUSDT = await MockUSDT.deploy();
    await mockUSDT.waitForDeployment();
  });

  it("has 6 decimals", async function () {
    expect(await mockUSDT.decimals()).to.equal(6);
  });

  it("has correct name and symbol", async function () {
    expect(await mockUSDT.name()).to.equal("Mock USDT");
    expect(await mockUSDT.symbol()).to.equal("mUSDT");
  });

  it("mints tokens to any address", async function () {
    const amount = ethers.parseUnits("1000000", 6);
    await mockUSDT.mint(user.address, amount);
    expect(await mockUSDT.balanceOf(user.address)).to.equal(amount);
  });

  it("mints to multiple addresses independently", async function () {
    const amounts = [
      ethers.parseUnits("2000000", 6),
      ethers.parseUnits("1500000", 6),
    ];
    const [a, b] = await ethers.getSigners();

    await mockUSDT.mint(a.address, amounts[0]);
    await mockUSDT.mint(b.address, amounts[1]);

    expect(await mockUSDT.balanceOf(a.address)).to.equal(amounts[0]);
    expect(await mockUSDT.balanceOf(b.address)).to.equal(amounts[1]);
  });

  it("allows standard ERC-20 transfers", async function () {
    const amount = ethers.parseUnits("500000", 6);
    await mockUSDT.mint(owner.address, amount);
    await mockUSDT.connect(owner).transfer(user.address, amount);
    expect(await mockUSDT.balanceOf(user.address)).to.equal(amount);
  });
});
