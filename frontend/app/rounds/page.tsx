"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRoundCount, useAllRounds } from "@/lib/hooks/useRound";
import { formatUSDT, RoundStatus } from "@/lib/contracts";
import type { Round } from "@/lib/hooks/useRound";
import {
  Plus,
  ChevronRight,
  Lock,
  TrendingUp,
  Clock,
  FileStack,
  CircleDot,
} from "lucide-react";

const STATUS_STYLES: Record<
  RoundStatus,
  { dot: string; pill: string; label: string }
> = {
  [RoundStatus.DRAFT]: {
    dot: "bg-zinc-400",
    pill: "bg-zinc-100 text-zinc-600 border border-zinc-200/80",
    label: "Draft",
  },
  [RoundStatus.OPEN]: {
    dot: "bg-[#8624FF]",
    pill: "bg-[#8624FF]/10 text-[#6b21c8] border border-[#8624FF]/25",
    label: "Open",
  },
  [RoundStatus.CLOSED]: {
    dot: "bg-zinc-600",
    pill: "bg-zinc-100 text-zinc-700 border border-zinc-200/80",
    label: "Closed",
  },
  [RoundStatus.CANCELLED]: {
    dot: "bg-red-400",
    pill: "bg-red-50 text-red-700 border border-red-100",
    label: "Cancelled",
  },
};

type Filter = "all" | RoundStatus;
type SortKey = "newest" | "deadline" | "target";

function daysLabel(ts: bigint): string {
  const ms = Number(ts) * 1000 - Date.now();
  if (ms <= 0) return "Expired";
  const d = Math.floor(ms / 86400000);
  return d === 0 ? "Ends today" : `${d}d left`;
}

function fillPercent(round: Round): number | null {
  if (round.targetRaise <= 0n) return null;
  return Math.min(Number((round.totalRaised * 100n) / round.targetRaise), 100);
}

function truncateAddr(a: `0x${string}`) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function RoundCardMobile({ round }: { round: Round }) {
  const pct = fillPercent(round);
  const styles = STATUS_STYLES[round.status];
  const showBar =
    pct !== null &&
    (round.totalRaised > 0n || round.status === RoundStatus.CLOSED);

  return (
    <Link
      href={`/round/${round.id.toString()}`}
      className="group block rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition-all hover:border-[#8624FF]/35 hover:shadow-[0_8px_30px_rgba(134,36,255,0.08)] md:hidden"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 shrink-0 rounded-full ${styles.dot}`} />
            <p className="truncate text-sm font-semibold text-zinc-900 group-hover:text-[#8624FF]">
              {round.name || (
                <span className="font-normal italic text-zinc-400">
                  Unnamed round
                </span>
              )}
            </p>
          </div>
          <p className="mt-1 pl-4 font-mono text-xs text-zinc-400">
            #{round.id.toString()} · Founder {truncateAddr(round.founder)}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${styles.pill}`}
        >
          {styles.label}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <div>
          <p className="text-zinc-400">Target</p>
          <p className="mt-0.5 font-mono font-medium text-zinc-900">
            {round.targetRaise > 0n
              ? formatUSDT(round.targetRaise)
              : "—"}
          </p>
        </div>
        <div>
          <p className="text-zinc-400">Deadline</p>
          <p className="mt-0.5 font-mono text-zinc-700">
            {round.deadline > 0n ? (
              <span
                className={
                  daysLabel(round.deadline) === "Expired"
                    ? "text-zinc-400 line-through"
                    : ""
                }
              >
                {daysLabel(round.deadline)}
              </span>
            ) : (
              "—"
            )}
          </p>
        </div>
      </div>

      {showBar && pct !== null && (
        <div className="mt-3">
          <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100">
            <div
              className="h-full rounded-full bg-[#8624FF]"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-1 font-mono text-[11px] text-zinc-500">
            {pct}% filled · {formatUSDT(round.totalRaised)}
          </p>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between border-t border-zinc-100 pt-3">
        <span className="inline-flex items-center gap-1 font-mono text-[10px] text-zinc-500">
          <Lock className="size-3 text-[#8624FF]" strokeWidth={2} />
          FHE allocations
        </span>
        <ChevronRight
          className="size-4 text-zinc-300 transition-transform group-hover:translate-x-0.5 group-hover:text-[#8624FF]"
          strokeWidth={2}
        />
      </div>
    </Link>
  );
}

function RoundRowDesktop({ round }: { round: Round }) {
  const pct = fillPercent(round);
  const styles = STATUS_STYLES[round.status];
  const showBar =
    pct !== null &&
    (round.totalRaised > 0n || round.status === RoundStatus.CLOSED);

  return (
    <Link
      href={`/round/${round.id.toString()}`}
      className="group hidden grid-cols-[minmax(0,2fr)_1fr_minmax(0,140px)_100px_40px] items-center gap-6 border-b border-zinc-100 bg-white px-6 py-4 transition-colors last:border-0 hover:bg-zinc-50/80 md:grid"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 shrink-0 rounded-full ${styles.dot}`} />
          <p className="truncate text-sm font-semibold text-zinc-900 group-hover:text-[#8624FF]">
            {round.name || (
              <span className="font-normal italic text-zinc-400">
                Unnamed round
              </span>
            )}
          </p>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 pl-4 text-xs text-zinc-400">
          <span className="font-mono">#{round.id.toString()}</span>
          <span className="font-mono">{truncateAddr(round.founder)}</span>
          <span className="inline-flex items-center gap-1 font-mono text-zinc-400">
            <Lock className="size-3 text-[#8624FF]" strokeWidth={2} />
            FHE
          </span>
        </div>
      </div>

      <div className="font-mono text-sm text-zinc-800 tabular-nums">
        {round.targetRaise > 0n ? formatUSDT(round.targetRaise) : "—"}
      </div>

      <div className="min-w-0">
        {showBar && pct !== null ? (
          <div className="space-y-1">
            <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100">
              <div
                className="h-full rounded-full bg-[#8624FF]"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="font-mono text-[11px] text-zinc-500">
              {pct}% · {formatUSDT(round.totalRaised)}
            </p>
          </div>
        ) : (
          <span
            className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${styles.pill}`}
          >
            {styles.label}
          </span>
        )}
      </div>

      <div className="font-mono text-xs text-zinc-500">
        {round.deadline > 0n ? (
          <span
            className={
              daysLabel(round.deadline) === "Expired"
                ? "text-zinc-400 line-through"
                : ""
            }
          >
            {daysLabel(round.deadline)}
          </span>
        ) : (
          "—"
        )}
      </div>

      <div className="flex justify-end">
        <ChevronRight
          className="size-4 text-zinc-300 transition-transform group-hover:translate-x-0.5 group-hover:text-[#8624FF]"
          strokeWidth={2}
        />
      </div>
    </Link>
  );
}

export default function RoundsPage() {
  const { count } = useRoundCount();
  const { rounds, isLoading } = useAllRounds(count);
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<SortKey>("newest");

  const openCount = rounds.filter((r) => r.status === RoundStatus.OPEN).length;
  const draftCount = rounds.filter((r) => r.status === RoundStatus.DRAFT).length;
  const closedCount = rounds.filter((r) => r.status === RoundStatus.CLOSED)
    .length;
  const cancelledCount = rounds.filter(
    (r) => r.status === RoundStatus.CANCELLED,
  ).length;

  const filteredSorted = useMemo(() => {
    let list =
      filter === "all" ? [...rounds] : rounds.filter((r) => r.status === filter);
    list.sort((a, b) => {
      if (sort === "newest") return a.id < b.id ? 1 : -1;
      if (sort === "deadline") {
        if (a.deadline === b.deadline) return 0;
        return a.deadline < b.deadline ? -1 : 1;
      }
      if (a.targetRaise === b.targetRaise) return 0;
      return a.targetRaise < b.targetRaise ? 1 : -1;
    });
    return list;
  }, [rounds, filter, sort]);

  return (
    <div className="min-h-[calc(100vh-60px)] bg-zinc-50/50">
      <div className="mx-auto max-w-6xl px-6 py-10 lg:px-10 animate-fade-up">
        {/* Header */}
        <div className="flex flex-col gap-6 border-b border-zinc-200 pb-10 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 font-mono text-[11px] font-medium uppercase tracking-widest text-[#8624FF]">
              Fundraising
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
              Rounds
            </h1>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-zinc-500">
              Confidential raises on Sepolia. Allocation amounts stay encrypted
              on-chain—founders, investors, and the public each see only what
              they should.
            </p>
          </div>
          <Link
            href="/founder/new"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-[#8624FF] px-5 py-2.5 text-sm font-medium text-white shadow-[0_0_24px_rgba(134,36,255,0.28)] transition-all hover:opacity-90 active:scale-[0.99]"
          >
            <Plus size={16} strokeWidth={2} />
            New round
          </Link>
        </div>

        {/* KPIs */}
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5 ">
          {[
            {
              label: "Total rounds",
              value: count !== undefined ? count.toString() : "—",
              icon: FileStack,
              accent: "text-zinc-600",
            },
            {
              label: "Open",
              value: openCount.toString(),
              icon: CircleDot,
              accent: "text-[#8624FF]",
            },
            {
              label: "Draft",
              value: draftCount.toString(),
              icon: CircleDot,
              accent: "text-zinc-400",
            },
            {
              label: "Closed",
              value: closedCount.toString(),
              icon: TrendingUp,
              accent: "text-zinc-600",
            },
            {
              label: "Cancelled",
              value: cancelledCount.toString(),
              icon: Clock,
              accent: "text-red-500/80",
            },
          ].map(({ label, value, icon: Icon, accent }) => (
            <div
              key={label}
              className="flex items-center gap-3 rounded-2xl border border-zinc-200/80 bg-white px-4 py-4 shadow-sm"
            >
              <div
                className={`flex size-9 items-center justify-center rounded-xl bg-zinc-50 ${accent} `}
              >
                <Icon size={16} strokeWidth={2} />
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                  {label}
                </p>
                <p className="mt-0.5 font-mono text-xl font-semibold tabular-nums text-zinc-900">
                  {value}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                ["all", "All"] as const,
                [RoundStatus.OPEN, "Open"] as const,
                [RoundStatus.DRAFT, "Draft"] as const,
                [RoundStatus.CLOSED, "Closed"] as const,
                [RoundStatus.CANCELLED, "Cancelled"] as const,
              ] as const
            ).map(([f, label]) => (
              <button
                key={String(f)}
                type="button"
                onClick={() => setFilter(f)}
                className={`rounded-full px-4 py-1.5 text-xs font-medium transition-all ${
                  filter === f
                    ? "bg-[#8624FF] text-white shadow-[0_0_16px_rgba(134,36,255,0.35)]"
                    : "border border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400">Sort</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-800 shadow-sm focus:border-[#8624FF]/40 focus:outline-none focus:ring-2 focus:ring-[#8624FF]/15"
            >
              <option value="newest">Newest first</option>
              <option value="deadline">Deadline (soonest)</option>
              <option value="target">Target (largest)</option>
            </select>
          </div>
        </div>

        {/* Table shell */}
        <div className="mt-6 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          {/* Desktop header */}
          <div className="hidden grid-cols-[minmax(0,2fr)_1fr_minmax(0,140px)_100px_40px] items-center gap-6 border-b border-zinc-100 bg-zinc-50/90 px-6 py-3 md:grid">
            {[
              "Round",
              "Target",
              "Progress",
              "Deadline",
              "",
            ].map((h) => (
              <p
                key={`col-${h}`}
                className="font-mono text-[11px] font-medium uppercase tracking-wider text-zinc-400"
              >
                {h}
              </p>
            ))}
          </div>

          {isLoading && (
            <div className="divide-y divide-zinc-100">
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 px-6 py-5"
                >
                  <div className="skeleton h-4 w-40 rounded-md" />
                  <div className="skeleton ml-auto h-4 w-24 rounded-md" />
                </div>
              ))}
            </div>
          )}

          {!isLoading && filteredSorted.length === 0 && (
            <div className="px-6 py-20 text-center">
              <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-50">
                <FileStack className="size-5 text-zinc-400" strokeWidth={1.5} />
              </div>
              <p className="text-base font-medium text-zinc-800">
                {filter === "all"
                  ? "No rounds on-chain yet"
                  : `No ${STATUS_STYLES[filter as RoundStatus].label.toLowerCase()} rounds`}
              </p>
              <p className="mx-auto mt-2 max-w-sm text-sm text-zinc-500">
                Deploy a round to start collecting encrypted allocations on
                Sepolia.
              </p>
              {filter === "all" && (
                <Link
                  href="/founder/new"
                  className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#8624FF] px-5 py-2.5 text-sm font-medium text-white shadow-[0_0_20px_rgba(134,36,255,0.3)] transition-opacity hover:opacity-90"
                >
                  Create a round
                  <ChevronRight size={16} strokeWidth={2} />
                </Link>
              )}
            </div>
          )}

          {!isLoading &&
            filteredSorted.map((round) => (
              <div key={round.id.toString()}>
                <RoundRowDesktop round={round} />
                <RoundCardMobile round={round} />
              </div>
            ))}
        </div>

        <p className="mt-6 text-right font-mono text-[11px] text-zinc-400">
          Powered by Zama FHEVM · Allocation amounts encrypted at rest
        </p>
      </div>
    </div>
  );
}
