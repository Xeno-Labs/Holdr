"use client";

import { Lock } from "lucide-react";
import { formatUSDT, RoundStatus } from "@/lib/contracts";
import type { Round } from "@/lib/hooks/useRound";

interface Props {
  round: Round;
  investorCount: number;
}

export function PublicView({ round, investorCount }: Props) {
  const pct = round.targetRaise > 0n
    ? Math.min(Number((round.totalRaised * 100n) / round.targetRaise), 100)
    : 0;

  const isOpen   = round.status === RoundStatus.OPEN;
  const isClosed = round.status === RoundStatus.CLOSED;

  return (
    <div className="space-y-6">

      {/* Closed — verified result */}
      {isClosed && round.totalRaised > 0n && (
        <div className="rounded-2xl border border-green-200 bg-accent-dim p-6">
          <p className="text-xs font-mono text-accent-text mb-2 uppercase tracking-wide">
            Publicly verified · KMS-decrypted
          </p>
          <p className="text-4xl font-semibold font-mono text-foreground">
            {formatUSDT(round.totalRaised)}
          </p>
          <div className="mt-4 space-y-1.5">
            <div className="flex justify-between text-xs text-muted font-mono">
              <span>filled</span>
              <span>{pct}% of {formatUSDT(round.targetRaise)}</span>
            </div>
            <div className="h-1 bg-green-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
          <p className="text-xs text-muted mt-3">
            {investorCount} investor{investorCount !== 1 ? "s" : ""} participated
          </p>
        </div>
      )}

      {/* Privacy callout */}
      <div className="rounded-2xl border border-border bg-background overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <p className="text-xs font-mono text-muted uppercase tracking-wide">Allocation table</p>
          <span className="badge-locked text-[11px]">
            <Lock size={10} /> FHE encrypted
          </span>
        </div>

        {/* Fake encrypted rows */}
        <div className="divide-y divide-border">
          {Array.from({ length: Math.max(investorCount, 3) }).map((_, i) => (
            <div key={i} className="px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-6 h-6 rounded-full bg-chip flex items-center justify-center text-[10px] text-muted font-mono"
                >
                  {i < investorCount ? "●" : "○"}
                </div>
                <div className="skeleton h-3 rounded"
                  style={{ width: `${80 + ((i * 37) % 60)}px`, opacity: i < investorCount ? 1 : 0.35 }}
                />
              </div>
              <div className="skeleton h-3 rounded w-16"
                style={{ opacity: i < investorCount ? 1 : 0.35 }}
              />
            </div>
          ))}
        </div>

        <div className="px-5 py-3 bg-surface border-t border-border flex items-center gap-2">
          <Lock size={12} className="text-muted" />
          <p className="text-xs text-muted leading-relaxed">
            Individual allocations are end-to-end encrypted with FHE.
            {isOpen
              ? " Connect as an investor or founder to decrypt your view."
              : isClosed
              ? " The aggregate total has been publicly verified by the KMS."
              : " Open the round to begin accepting subscriptions."}
          </p>
        </div>
      </div>

      {/* Round description / meta */}
      <div className="grid grid-cols-2 gap-3">
        <div className="border border-border rounded-xl p-4 space-y-1">
          <p className="text-xs text-muted font-mono">Security</p>
          <p className="text-sm font-medium text-foreground">SAFE</p>
          <p className="text-xs text-muted">Simple Agreement for Future Equity</p>
        </div>
        <div className="border border-border rounded-xl p-4 space-y-1">
          <p className="text-xs text-muted font-mono">Privacy</p>
          <p className="text-sm font-medium text-foreground">FHEVM</p>
          <p className="text-xs text-muted">Fully homomorphic encryption</p>
        </div>
      </div>
    </div>
  );
}
