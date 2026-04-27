"use client";

import { useReadContract, useReadContracts } from "wagmi";
import { ADDRESSES, ROUND_FACTORY_ABI, ALLOCATIONS_ABI, RoundStatus, STATUS_LABEL } from "@/lib/contracts";

export interface Round {
  id: bigint;
  founder: `0x${string}`;
  name: string;
  targetRaise: bigint;
  deadline: bigint;
  status: RoundStatus;
  totalRaised: bigint;
  statusLabel: string;
}

/** Fetch a single round by ID */
export function useRound(roundId: bigint | undefined) {
  const { data, isLoading, error } = useReadContract({
    address:      ADDRESSES.RoundFactory,
    abi:          ROUND_FACTORY_ABI,
    functionName: "getRound",
    args:         roundId !== undefined ? [roundId] : undefined,
    query:        { enabled: roundId !== undefined },
  });

  const round: Round | undefined = data
    ? {
        id:          roundId!,
        founder:     data.founder,
        name:        data.name,
        targetRaise: data.targetRaise,
        deadline:    data.deadline,
        status:      data.status as RoundStatus,
        totalRaised: data.totalRaised,
        statusLabel: STATUS_LABEL[data.status as RoundStatus],
      }
    : undefined;

  return { round, isLoading, error };
}

/** Fetch total number of rounds */
export function useRoundCount() {
  const { data, isLoading } = useReadContract({
    address:      ADDRESSES.RoundFactory,
    abi:          ROUND_FACTORY_ABI,
    functionName: "roundCount",
  });
  return { count: data as bigint | undefined, isLoading };
}

/** Fetch all rounds (up to `count`) */
export function useAllRounds(count: bigint | undefined) {
  const ids = count !== undefined
    ? Array.from({ length: Number(count) }, (_, i) => BigInt(i + 1))
    : [];

  const contracts = ids.map((id) => ({
    address:      ADDRESSES.RoundFactory,
    abi:          ROUND_FACTORY_ABI,
    functionName: "getRound" as const,
    args:         [id] as const,
  }));

  const { data, isLoading } = useReadContracts({ contracts, query: { enabled: ids.length > 0 } });

  const rounds: Round[] = (data ?? [])
    .map((result, i) => {
      if (result.status !== "success" || !result.result) return null;
      const d = result.result as Round;
      return {
        id:          ids[i],
        founder:     d.founder,
        name:        d.name,
        targetRaise: d.targetRaise,
        deadline:    d.deadline,
        status:      d.status as RoundStatus,
        totalRaised: d.totalRaised,
        statusLabel: STATUS_LABEL[d.status as RoundStatus],
      };
    })
    .filter(Boolean) as Round[];

  return { rounds, isLoading };
}

/** Fetch investors for a round */
export function useInvestors(roundId: bigint | undefined) {
  const { data, isLoading } = useReadContract({
    address:      ADDRESSES.Allocations,
    abi:          ALLOCATIONS_ABI,
    functionName: "getInvestors",
    args:         roundId !== undefined ? [roundId] : undefined,
    query:        { enabled: roundId !== undefined },
  });

  return { investors: (data ?? []) as `0x${string}`[], isLoading };
}

/** Check if an investor is subscribed to a round */
export function useIsSubscribed(roundId: bigint | undefined, investor: `0x${string}` | undefined) {
  const { data } = useReadContract({
    address:      ADDRESSES.Allocations,
    abi:          ALLOCATIONS_ABI,
    functionName: "isSubscribed",
    args:         roundId !== undefined && investor ? [roundId, investor] : undefined,
    query:        { enabled: roundId !== undefined && !!investor },
  });
  return { isSubscribed: !!data };
}
