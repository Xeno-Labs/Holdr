"use client";

import { useState } from "react";
import Link from "next/link";
import { useRoundCount, useAllRounds } from "@/lib/hooks/useRound";
import { formatUSDT, RoundStatus } from "@/lib/contracts";
import type { Round } from "@/lib/hooks/useRound";
import { Plus, ArrowUpRight, Lock, Users, TrendingUp, Clock } from "lucide-react";

const STATUS_DOT: Record<RoundStatus, string> = {
  [RoundStatus.DRAFT]:     "bg-chip-text/40",
  [RoundStatus.OPEN]:      "bg-accent",
  [RoundStatus.CLOSED]:    "bg-foreground/30",
  [RoundStatus.CANCELLED]: "bg-destructive/40",
};
const STATUS_LABEL: Record<RoundStatus, string> = {
  [RoundStatus.DRAFT]:     "Draft",
  [RoundStatus.OPEN]:      "Open",
  [RoundStatus.CLOSED]:    "Closed",
  [RoundStatus.CANCELLED]: "Cancelled",
};

type Filter = "all" | RoundStatus;

function daysLabel(ts: bigint): string {
  const ms = Number(ts) * 1000 - Date.now();
  if (ms <= 0) return "Expired";
  const d = Math.floor(ms / 86400000);
  return d === 0 ? "Today" : `${d}d left`;
}

function RoundRow({ round }: { round: Round }) {
  const pct = round.targetRaise > 0n && round.status === RoundStatus.CLOSED
    ? Math.min(Number((round.totalRaised * 100n) / round.targetRaise), 100)
    : null;

  return (
    <Link
      href={`/round/${round.id.toString()}`}
      className="group grid grid-cols-[2fr_1fr_120px_100px_80px_32px] items-center gap-4 px-5 py-4 hover:bg-surface transition-colors border-b border-border last:border-0"
    >
      {/* Name + ID */}
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[round.status]}`} />
          <p className="text-sm font-medium text-foreground truncate group-hover:underline underline-offset-2">
            {round.name || <span className="text-muted italic">Unnamed round</span>}
          </p>
        </div>
        <p className="text-xs font-mono text-muted mt-0.5 pl-3.5">#{round.id.toString()}</p>
      </div>

      {/* Target */}
      <div className="text-sm font-mono text-foreground">
        {round.targetRaise > 0n ? formatUSDT(round.targetRaise) : <span className="text-muted">—</span>}
      </div>

      {/* Fill / Status */}
      <div>
        {pct !== null ? (
          <div className="space-y-1">
            <div className="h-1 bg-chip rounded-full overflow-hidden w-full">
              <div className="h-full bg-accent rounded-full" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-xs font-mono text-muted">{pct}% · {formatUSDT(round.totalRaised)}</p>
          </div>
        ) : (
          <span className={`inline-flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded-full ${
            round.status === RoundStatus.OPEN
              ? "bg-accent-dim text-accent-text"
              : "bg-chip text-chip-text"
          }`}>
            {STATUS_LABEL[round.status]}
          </span>
        )}
      </div>

      {/* Deadline */}
      <div className="text-xs font-mono text-muted">
        {round.deadline > 0n
          ? <span className={daysLabel(round.deadline) === "Expired" ? "text-muted line-through" : ""}>{daysLabel(round.deadline)}</span>
          : "—"}
      </div>

      {/* Encryption badge */}
      <div>
        <span className="inline-flex items-center gap-1 text-[10px] font-mono text-muted bg-chip px-1.5 py-0.5 rounded-md">
          <Lock size={9} /> FHE
        </span>
      </div>

      {/* Arrow */}
      <ArrowUpRight size={15} className="text-muted group-hover:text-foreground transition-colors" />
    </Link>
  );
}

export default function RoundsPage() {
  const { count } = useRoundCount();
  const { rounds, isLoading } = useAllRounds(count);
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = filter === "all"
    ? rounds
    : rounds.filter((r) => r.status === filter);

  const openCount   = rounds.filter((r) => r.status === RoundStatus.OPEN).length;
  const draftCount  = rounds.filter((r) => r.status === RoundStatus.DRAFT).length;
  const closedCount = rounds.filter((r) => r.status === RoundStatus.CLOSED).length;

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 animate-fade-up">

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Rounds</h1>
          <p className="text-sm text-muted mt-1">All confidential fundraise rounds on Vestr</p>
        </div>
        <Link
          href="/founder/new"
          className="flex items-center gap-1.5 bg-foreground text-background text-sm font-medium rounded-xl px-4 py-2 hover:opacity-80 transition-opacity"
        >
          <Plus size={14} /> New round
        </Link>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3 mb-8">
        {[
          { icon: <TrendingUp size={14} className="text-muted" />, label: "Total",  value: count?.toString() ?? "—" },
          { icon: <span className="w-2 h-2 rounded-full bg-accent" />, label: "Open",   value: openCount.toString()  },
          { icon: <span className="w-2 h-2 rounded-full bg-chip-text/40" />, label: "Draft",  value: draftCount.toString() },
          { icon: <span className="w-2 h-2 rounded-full bg-foreground/30" />, label: "Closed", value: closedCount.toString()},
        ].map(({ icon, label, value }) => (
          <div key={label} className="border border-border rounded-xl px-4 py-3 bg-background flex items-center gap-3">
            {icon}
            <div>
              <p className="text-xs text-muted font-mono">{label}</p>
              <p className="text-lg font-semibold font-mono text-foreground">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4">
        {([
          ["all", "All"],
          [RoundStatus.OPEN,      "Open"    ],
          [RoundStatus.DRAFT,     "Draft"   ],
          [RoundStatus.CLOSED,    "Closed"  ],
        ] as [Filter, string][]).map(([f, label]) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs font-mono px-3 py-1.5 rounded-lg transition-colors ${
              filter === f
                ? "bg-foreground text-background"
                : "text-muted hover:text-foreground hover:bg-surface"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="border border-border rounded-2xl overflow-hidden">

        {/* Column headers */}
        <div className="grid grid-cols-[2fr_1fr_120px_100px_80px_32px] gap-4 px-5 py-3 bg-surface border-b border-border">
          {["Round", "Target", "Status", "Deadline", "Privacy", ""].map((h) => (
            <p key={h} className="text-xs font-mono text-muted uppercase tracking-wide">{h}</p>
          ))}
        </div>

        {/* Rows */}
        {isLoading && (
          <div className="divide-y divide-border">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4">
                <div className="skeleton h-3 w-32 rounded" />
                <div className="skeleton h-3 w-20 rounded ml-auto" />
              </div>
            ))}
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="py-16 text-center">
            <p className="text-sm text-muted">
              {filter === "all" ? "No rounds yet." : `No ${STATUS_LABEL[filter as RoundStatus].toLowerCase()} rounds.`}
            </p>
            {filter === "all" && (
              <Link href="/founder/new" className="text-sm text-foreground underline underline-offset-4 mt-2 inline-block">
                Create the first one
              </Link>
            )}
          </div>
        )}

        {!isLoading && filtered.map((round) => (
          <RoundRow key={round.id.toString()} round={round} />
        ))}
      </div>

      <p className="text-xs text-muted font-mono mt-4 text-right">
        Allocation amounts encrypted with Zama FHEVM
      </p>
    </div>
  );
}
