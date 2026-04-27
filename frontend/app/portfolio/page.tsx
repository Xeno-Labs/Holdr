"use client";

import { useAccount, useReadContracts } from "wagmi";
import Link from "next/link";
import { useRoundCount, useAllRounds } from "@/lib/hooks/useRound";
import { ADDRESSES, ALLOCATIONS_ABI } from "@/lib/contracts";
import { StatusBadge } from "@/components/ui/StatusBadge";

const ZERO_HANDLE = "0x0000000000000000000000000000000000000000000000000000000000000000";

export default function PortfolioPage() {
  const { address, isConnected } = useAccount();
  const { count } = useRoundCount();
  const { rounds, isLoading } = useAllRounds(count);

  // Batch-read all allocation handles for this address across all rounds
  const contracts = rounds.map((r) => ({
    address:      ADDRESSES.Allocations,
    abi:          ALLOCATIONS_ABI,
    functionName: "getAllocation" as const,
    args:         [r.id, address ?? "0x0000000000000000000000000000000000000000"] as const,
  }));

  const { data: handleResults } = useReadContracts({
    contracts,
    query: { enabled: !!address && rounds.length > 0 },
  });

  const myRounds = rounds.filter((_, i) => {
    const result = handleResults?.[i];
    if (!result || result.status !== "success") return false;
    const h = result.result as `0x${string}` | undefined;
    return !!h && h !== ZERO_HANDLE;
  });

  if (!isConnected) {
    return (
      <div className="max-w-lg mx-auto px-6 py-20 text-center">
        <p className="text-muted text-sm">Connect your wallet to view your portfolio.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 animate-fade-up">
      <h1 className="text-xl font-semibold mb-8">Portfolio</h1>

      {isLoading && (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="skeleton h-20 rounded-2xl" />
          ))}
        </div>
      )}

      {!isLoading && myRounds.length === 0 && (
        <div className="border border-dashed border-border rounded-2xl py-16 text-center">
          <p className="text-muted text-sm">You have no allocations in any round.</p>
          <p className="text-xs text-muted mt-1">A founder must add you before you appear here.</p>
        </div>
      )}

      {!isLoading && myRounds.length > 0 && (
        <ul className="space-y-3">
          {myRounds.map((round) => (
            <li key={round.id.toString()}>
              <Link
                href={`/round/${round.id.toString()}`}
                className="block border border-border rounded-2xl p-5 hover:bg-surface transition-colors group"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground group-hover:underline underline-offset-2">
                      {round.name}
                    </p>
                    <p className="text-xs font-mono text-muted">Round #{round.id.toString()}</p>
                  </div>
                  <StatusBadge status={round.status} />
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <span className="badge-locked">🔒 encrypted</span>
                  <span className="text-xs text-muted">
                    Open to decrypt your allocation
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
