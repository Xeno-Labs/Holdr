"use client";

import Link from "next/link";
import { useRoundCount, useAllRounds } from "@/lib/hooks/useRound";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatUSDT, RoundStatus } from "@/lib/contracts";

export default function RoundsPage() {
  const { count } = useRoundCount();
  const { rounds, isLoading } = useAllRounds(count);

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 animate-fade-up">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-xl font-semibold">All rounds</h1>
        <span className="text-sm text-muted font-mono">
          {count !== undefined ? `${count.toString()} total` : "…"}
        </span>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-20 w-full rounded-2xl" />
          ))}
        </div>
      )}

      {!isLoading && rounds.length === 0 && (
        <div className="border border-dashed border-border rounded-2xl py-16 text-center">
          <p className="text-muted text-sm">No rounds yet.</p>
          <Link
            href="/founder/new"
            className="text-sm text-foreground underline underline-offset-4 mt-2 inline-block"
          >
            Create one
          </Link>
        </div>
      )}

      <ul className="space-y-3">
        {rounds.map((round) => (
          <li key={round.id.toString()}>
            <Link
              href={`/round/${round.id.toString()}`}
              className="block border border-border rounded-2xl p-5 hover:bg-surface transition-colors group"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-foreground group-hover:underline underline-offset-2">
                    {round.name}
                  </p>
                  <p className="text-xs font-mono text-muted">
                    Round #{round.id.toString()}
                  </p>
                </div>
                <StatusBadge status={round.status} />
              </div>

              <div className="flex gap-6 mt-4">
                <div>
                  <p className="text-xs text-muted font-mono">Target</p>
                  <p className="text-sm font-medium text-foreground">
                    {formatUSDT(round.targetRaise)}
                  </p>
                </div>
                {round.status === RoundStatus.CLOSED && round.totalRaised > 0n && (
                  <div>
                    <p className="text-xs text-muted font-mono">Raised</p>
                    <p className="text-sm font-medium text-accent-text">
                      {formatUSDT(round.totalRaised)}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted font-mono">Deadline</p>
                  <p className="text-sm font-medium text-foreground">
                    {new Date(Number(round.deadline) * 1000).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
