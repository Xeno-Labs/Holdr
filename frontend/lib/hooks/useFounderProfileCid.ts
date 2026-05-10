"use client";

import { useReadContract } from "wagmi";
import { ADDRESSES, ROUND_FACTORY_ABI } from "@/lib/contracts";

export function useFounderProfileCid(founder: `0x${string}` | undefined) {
  const { data, isLoading, refetch } = useReadContract({
    address:      ADDRESSES.RoundFactory,
    abi:          ROUND_FACTORY_ABI,
    functionName: "founderProfileCid",
    args:         founder ? [founder] : undefined,
    query:        { enabled: !!founder },
  });

  const cid = typeof data === "string" && data.length > 0 ? data : undefined;
  return { cid, isLoading, refetch };
}
