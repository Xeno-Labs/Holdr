"use client";

// FHE utility — wraps the Zama Relayer SDK browser entry.
// createInstance requires explicit FHEVM contract addresses.
// We expose SepoliaConfig for testnet and a local config for the Hardhat node.

import type {
  FhevmInstance,
  FhevmInstanceConfig,
} from "@zama-fhe/relayer-sdk/web";
import type { PublicClient } from "viem";

// ── Network configs ──────────────────────────────────────────────────────────
// All FHEVM host-chain + gateway contract addresses.
// The `network` field is overridden at getInstance() time with the wallet's
// own EIP-1193 provider so the SDK talks through MetaMask / injected wallet.

// Sepolia — sourced from @zama-fhe/relayer-sdk SepoliaConfig + Zama docs:
// https://docs.zama.org/protocol/protocol-apps/addresses/testnet/sepolia
const sepoliaFhevmConfig: FhevmInstanceConfig = {
  // FHEVM host-chain contracts (Sepolia)
  aclContractAddress:                       "0x687820221192C5B662b25367F70076A37bc79b6c",
  kmsContractAddress:                       "0x1364cBBf2cDF5032C47d8226a6f6FBD2AFCDacAC",
  inputVerifierContractAddress:             "0xbc91f3daD1A5F19F8390c400196e58073B6a0BC4",
  // Gateway chain verifying contracts
  verifyingContractAddressDecryption:       "0xb6E160B1ff80D67Bfe90A85eE06Ce0A2613607D1",
  verifyingContractAddressInputVerification:"0x7048C39f048125eDa9d678AEbaDfB22F7900a29F",
  chainId:        11155111,
  gatewayChainId: 55815,
  // `network` is replaced by the wallet's EIP-1193 provider in getInstance()
  network:        "https://eth-sepolia.public.blastapi.io",
  relayerUrl:     "https://relayer.testnet.zama.cloud",
};

// Local Hardhat node — FHEVM contracts deployed by @fhevm/hardhat-plugin.
// ACL + InputVerifier from fhevmTemp/precompiled-fhevm-host-contracts-addresses.json.
// KMS / gateway verifying contracts reuse Sepolia values (the mock node mirrors them).
const localFhevmConfig: FhevmInstanceConfig = {
  aclContractAddress:                       "0x50157CFfD6bBFA2DECe204a89ec419c23ef5755D",
  inputVerifierContractAddress:             "0x36772142b74871f255CbD7A3e89B401d3e45825f",
  kmsContractAddress:                       "0x1364cBBf2cDF5032C47d8226a6f6FBD2AFCDacAC",
  verifyingContractAddressDecryption:       "0xb6E160B1ff80D67Bfe90A85eE06Ce0A2613607D1",
  verifyingContractAddressInputVerification:"0x7048C39f048125eDa9d678AEbaDfB22F7900a29F",
  chainId:        31337,
  gatewayChainId: 55815,
  network:        "http://127.0.0.1:8545",
};

function pickConfig(chainId: number): FhevmInstanceConfig {
  if (chainId === 11155111) return sepoliaFhevmConfig;
  return localFhevmConfig;
}

// ── Instance cache (per chain) ───────────────────────────────────────────────

const _instances = new Map<number, FhevmInstance>();

async function getInstance(chainId: number, provider: unknown): Promise<FhevmInstance> {
  if (_instances.has(chainId)) return _instances.get(chainId)!;
  const { createInstance } = await import("@zama-fhe/relayer-sdk/web");
  const instance = await createInstance({
    ...pickConfig(chainId),
    network: provider as FhevmInstanceConfig["network"],
  });
  _instances.set(chainId, instance);
  return instance;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Encrypt a uint64 value intended for `contractAddress`.
 * Returns the encrypted handle (bytes32) and the input proof.
 */
export async function encryptUint64(
  value: bigint,
  contractAddress: `0x${string}`,
  userAddress: `0x${string}`,
  publicClient: PublicClient,
): Promise<{ handle: `0x${string}`; inputProof: `0x${string}` }> {
  const chainId = await publicClient.getChainId();
  const instance = await getInstance(chainId, publicClient.transport);

  const input = instance.createEncryptedInput(contractAddress, userAddress);
  input.add64(value);
  const { handles, inputProof } = await input.encrypt();

  return {
    handle:     Buffer.from(handles[0]).toString("hex").padStart(64, "0") as `0x${string}`,
    inputProof: Buffer.from(inputProof).toString("hex") as `0x${string}`,
  };
}

/**
 * Re-encrypt a ciphertext handle that the current user has ACL access to.
 * The wallet signs an EIP-712 message to authorise the KMS re-encryption.
 *
 * contractAddress: the contract that holds the handle (Allocations in our case).
 */
export async function decryptHandle(
  handle: `0x${string}`,
  contractAddress: `0x${string}`,
  publicClient: PublicClient,
  userAddress: `0x${string}`,
  signTypedData: (params: {
    domain:      Record<string, unknown>;
    types:       Record<string, unknown[]>;
    primaryType: string;
    message:     Record<string, unknown>;
  }) => Promise<`0x${string}`>,
): Promise<bigint> {
  const chainId = await publicClient.getChainId();
  const instance = await getInstance(chainId, publicClient.transport);

  const { publicKey, privateKey } = instance.generateKeypair();

  // startTimestamp: now in seconds; durationDays: 1 day validity
  const startTimestamp = Math.floor(Date.now() / 1000);
  const durationDays   = 1;

  const eip712 = instance.createEIP712(
    publicKey,
    [contractAddress],
    startTimestamp,
    durationDays,
  );

  const signature = await signTypedData({
    domain:      eip712.domain      as Record<string, unknown>,
    types:       eip712.types       as Record<string, unknown[]>,
    primaryType: eip712.primaryType as string,
    message:     eip712.message     as Record<string, unknown>,
  });

  const results = await instance.userDecrypt(
    [{ handle, contractAddress }],
    privateKey,
    publicKey,
    signature,
    [contractAddress],
    userAddress,
    startTimestamp,
    durationDays,
  );

  // results is a Record<handleHex, bigint | boolean | string>
  const value = Object.values(results)[0];
  return BigInt(value as bigint);
}
