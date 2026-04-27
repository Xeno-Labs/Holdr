"use client";

import { formatUSDT, type RoundStatus } from "@/lib/contracts";
import type { Round } from "@/lib/hooks/useRound";
import { StatusBadge } from "../ui/StatusBadge";

interface Props {
  round: Round;
  investorCount: number;
}

export function PublicView({ round, investorCount }: Props) {
  const pct =
    round.targetRaise > 0n
      ? Number((round.totalRaised * 100n) / round.targetRaise)
      : 0;

  const deadline = new Date(Number(round.deadline) * 1000);
  const expired  = deadline < new Date();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">{round.name}</h2>
          <p className="text-sm text-muted mt-0.5 font-mono">
            Round #{round.id.toString()}
          </p>
        </div>
        <StatusBadge status={round.status} />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-4">
        {[
          {
            label: "Target raise",
            value: formatUSDT(round.targetRaise),
          },
          {
            label: "Investors",
            value: investorCount.toString(),
          },
          {
            label: "Deadline",
            value: expired ? "Expired" : deadline.toLocaleDateString(),
            dim: expired,
          },
        ].map(({ label, value, dim }) => (
          <div key={label} className="bg-surface rounded-xl p-4 border border-border">
            <p className="text-xs text-muted font-mono mb-1">{label}</p>
            <p className={`text-sm font-semibold ${dim ? "text-muted" : "text-foreground"}`}>
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      {round.status >= 2 /* CLOSED */ && round.totalRaised > 0n && (
        <div>
          <div className="flex justify-between text-xs text-muted font-mono mb-1.5">
            <span>Total raised</span>
            <span>{pct}% of target</span>
          </div>
          <div className="h-1.5 bg-chip rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-700"
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
          <p className="text-sm font-semibold text-foreground mt-2">
            {formatUSDT(round.totalRaised)}
          </p>
        </div>
      )}

      {/* Allocations locked notice */}
      {round.status < 2 /* not CLOSED */ && (
        <div className="flex items-center gap-2 text-xs text-muted border border-border rounded-xl p-3 bg-surface">
          <span className="badge-locked">🔒 encrypted</span>
          <span>Individual allocations are end-to-end encrypted. Connect your wallet to see your slice.</span>
        </div>
      )}
    </div>
  );
}
