"use client";

import { useReadContract, useReadContracts } from "wagmi";
import { ADDRESSES, INVESTOR_CREDENTIAL_ABI } from "@/lib/contracts";

/**
 * Check whether a single investor holds a credential for a given round.
 */
export function useHasCredential(
  roundId: bigint | undefined,
  investor: `0x${string}` | undefined,
) {
  const { data, isLoading } = useReadContract({
    address:      ADDRESSES.InvestorCredential,
    abi:          INVESTOR_CREDENTIAL_ABI,
    functionName: "hasCredential",
    args:         roundId !== undefined && investor ? [roundId, investor] : undefined,
    query:        { enabled: !!roundId && !!investor },
  });

  return { hasCredential: data as boolean | undefined, isLoading };
}

/**
 * Fetch credential token IDs for a list of investors in a given round.
 * Returns a map of address → tokenId (0n = no credential).
 */
export function useRoundCredentials(
  roundId: bigint | undefined,
  investors: `0x${string}`[],
) {
  const contracts = investors.map((inv) => ({
    address:      ADDRESSES.InvestorCredential,
    abi:          INVESTOR_CREDENTIAL_ABI,
    functionName: "credentialOf" as const,
    args:         [roundId!, inv] as const,
  }));

  const { data, isLoading } = useReadContracts({
    contracts,
    query: { enabled: !!roundId && investors.length > 0 },
  });

  const credentialMap: Record<string, bigint> = {};
  if (data) {
    data.forEach((result, i) => {
      credentialMap[investors[i]] =
        result.status === "success" ? (result.result as bigint) : 0n;
    });
  }

  return { credentialMap, isLoading };
}

/**
 * Total credentials issued across all rounds.
 */
export function useTotalCredentials() {
  const { data, isLoading } = useReadContract({
    address:      ADDRESSES.InvestorCredential,
    abi:          INVESTOR_CREDENTIAL_ABI,
    functionName: "totalIssued",
    query:        { enabled: !!ADDRESSES.InvestorCredential },
  });

  return { total: data as bigint | undefined, isLoading };
}
