"use client";

// FHE utility — wraps the Zama Relayer SDK browser entry.
// Uses the SDK's built-in SepoliaConfig which is always up-to-date.
// For `network` we pass window.ethereum (MetaMask EIP-1193) so the SDK
// can read on-chain state through the user's already-connected wallet.

import type { FhevmInstance } from "@zama-fhe/relayer-sdk/web";
import type { PublicClient } from "viem";

// ── Instance cache (per chain) ───────────────────────────────────────────────
const _instances = new Map<number, FhevmInstance>();

let _wasmReady = false;

async function getInstance(chainId: number): Promise<FhevmInstance> {
  if (_instances.has(chainId)) return _instances.get(chainId)!;

  const { createInstance, SepoliaConfig, initSDK } = await import("@zama-fhe/relayer-sdk/web");

  // Boot the WASM binary exactly once — must complete before any FHE op
  if (!_wasmReady) {
    await initSDK();
    _wasmReady = true;
  }

  // Prefer window.ethereum (MetaMask EIP-1193 provider) so the SDK
  // shares the same wallet connection the user already approved.
  // Fall back to the public Sepolia RPC if not in a browser context.
  const network =
    typeof window !== "undefined" && (window as { ethereum?: unknown }).ethereum
      ? (window as { ethereum: unknown }).ethereum as { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> }
      : "https://ethereum-sepolia-rpc.publicnode.com";

  const config = chainId === 11155111
    ? { ...SepoliaConfig, network }
    : {
        ...SepoliaConfig,
        chainId: 31337,
        network: "http://127.0.0.1:8545",
      };

  const instance = await createInstance(config);
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
  const instance = await getInstance(chainId);

  const input = instance.createEncryptedInput(contractAddress, userAddress);
  input.add64(value);
  const { handles, inputProof } = await input.encrypt();

  return {
    handle:     `0x${Buffer.from(handles[0]).toString("hex").padStart(64, "0")}`,
    inputProof: `0x${Buffer.from(inputProof).toString("hex")}`,
  };
}

/**
 * Re-encrypt a ciphertext handle that the current user has ACL access to.
 * The wallet signs an EIP-712 message to authorise the KMS re-encryption.
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
  const instance = await getInstance(chainId);

  const { publicKey, privateKey } = instance.generateKeypair();
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
    types:       eip712.types       as unknown as Record<string, unknown[]>,
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

  const value = Object.values(results)[0];
  return BigInt(value as bigint);
}

/**
 * Fetch KMS-signed public decryption proof for a handle that has been marked
 * publicly decryptable via FHE.makePubliclyDecryptable().
 *
 * Returns the raw bytes needed to call submitCloseResult().
 */
export async function publicDecrypt(
  handle: `0x${string}`,
  publicClient: PublicClient,
): Promise<{ abiEncodedClearValues: `0x${string}`; decryptionProof: `0x${string}` }> {
  const chainId = await publicClient.getChainId();
  const instance = await getInstance(chainId);

  const result = await instance.publicDecrypt([handle]);
  return {
    abiEncodedClearValues: result.abiEncodedClearValues,
    decryptionProof:       result.decryptionProof,
  };
}
