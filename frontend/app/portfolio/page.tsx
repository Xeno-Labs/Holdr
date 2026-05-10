"use client";

import { useAccount, useReadContracts } from "wagmi";
import Link from "next/link";
import { useRoundCount, useAllRounds } from "@/lib/hooks/useRound";
import { ADDRESSES, ALLOCATIONS_ABI, RoundStatus, formatUSDT } from "@/lib/contracts";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  Lock, TrendingUp, Wallet, ArrowRight,
  ShieldCheck, BarChart3, Clock, CheckCircle2,
} from "lucide-react";
import type { Round } from "@/lib/hooks/useRound";

const ZERO_HANDLE = "0x0000000000000000000000000000000000000000000000000000000000000000";

function daysUntil(ts: bigint): { label: string; urgent: boolean } {
  const ms = Number(ts) * 1000 - Date.now();
  if (ms <= 0) return { label: "Expired", urgent: false };
  const d = Math.floor(ms / 86400000);
  return { label: d === 0 ? "Today" : `${d}d`, urgent: d <= 7 };
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function KpiCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div className="bg-white border border-zinc-200 rounded-xl px-4 py-3.5 flex items-center gap-3">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${accent ? "bg-[#8624FF]/10" : "bg-zinc-100"}`}>
        <span className={accent ? "text-[#8624FF]" : "text-zinc-500"}>{icon}</span>
      </div>
      <div>
        <p className="text-[10px] text-zinc-400 font-mono uppercase tracking-wide">{label}</p>
        <p className={`text-lg font-semibold font-mono leading-tight ${accent ? "text-[#8624FF]" : "text-zinc-900"}`}>{value}</p>
      </div>
    </div>
  );
}

// ── Position row (desktop) ────────────────────────────────────────────────────
function PositionRow({ round }: { round: Round }) {
  const { label: deadlineLabel, urgent } = daysUntil(round.deadline);
  const isOpen   = round.status === RoundStatus.OPEN;
  const isClosed = round.status === RoundStatus.CLOSED;
  const pct = round.targetRaise > 0n && isClosed
    ? Math.min(Number((round.totalRaised * 100n) / round.targetRaise), 100)
    : null;

  return (
    <tr className="group border-b border-zinc-100 last:border-0 hover:bg-zinc-50/60 transition-colors">
      <td className="py-3 pl-5 pr-3">
        <div>
          <p className="text-sm font-medium text-zinc-900 group-hover:text-[#8624FF] transition-colors">
            {round.name}
          </p>
          <p className="text-[11px] font-mono text-zinc-400 mt-0.5">#{round.id.toString()}</p>
        </div>
      </td>
      <td className="py-3 px-3">
        <StatusBadge status={round.status} />
      </td>
      <td className="py-3 px-3">
        <span className={`text-xs font-mono ${urgent && isOpen ? "text-amber-600 font-medium" : "text-zinc-500"}`}>
          {deadlineLabel}
        </span>
      </td>
      <td className="py-3 px-3">
        <span className="text-xs font-mono text-zinc-500">{formatUSDT(round.targetRaise)}</span>
      </td>
      <td className="py-3 px-3">
        {isClosed && pct !== null ? (
          <div className="flex items-center gap-2">
            <div className="h-1 w-16 rounded-full bg-zinc-200 overflow-hidden">
              <div className="h-full rounded-full bg-[#8624FF]" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[11px] font-mono text-zinc-500">{pct}%</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 font-mono">
            <Lock size={10} className="text-[#8624FF]" />
            encrypted
          </div>
        )}
      </td>
      <td className="py-3 pl-3 pr-5 text-right">
        <Link
          href={`/round/${round.id.toString()}`}
          className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-[#8624FF] transition-colors font-medium"
        >
          View <ArrowRight size={11} />
        </Link>
      </td>
    </tr>
  );
}

// ── Position card (mobile) ────────────────────────────────────────────────────
function PositionCard({ round }: { round: Round }) {
  const { label: deadlineLabel, urgent } = daysUntil(round.deadline);
  const isClosed = round.status === RoundStatus.CLOSED;
  const isOpen   = round.status === RoundStatus.OPEN;
  const pct = round.targetRaise > 0n && isClosed
    ? Math.min(Number((round.totalRaised * 100n) / round.targetRaise), 100)
    : null;

  return (
    <Link
      href={`/round/${round.id.toString()}`}
      className="block bg-white border border-zinc-200 rounded-xl p-4 hover:border-[#8624FF]/30 hover:shadow-sm transition-all group"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-zinc-900 group-hover:text-[#8624FF] transition-colors truncate">
            {round.name}
          </p>
          <p className="text-[11px] font-mono text-zinc-400 mt-0.5">Round #{round.id.toString()}</p>
        </div>
        <StatusBadge status={round.status} />
      </div>

      <div className="flex items-center gap-4 text-[11px] font-mono text-zinc-500">
        <span className="flex items-center gap-1">
          <TrendingUp size={10} className="text-zinc-400" />
          {formatUSDT(round.targetRaise)}
        </span>
        <span className={`flex items-center gap-1 ${urgent && isOpen ? "text-amber-600" : ""}`}>
          <Clock size={10} className="text-zinc-400" />
          {deadlineLabel}
        </span>
        {isClosed && pct !== null ? (
          <span className="flex items-center gap-1 text-[#8624FF]">
            <CheckCircle2 size={10} />
            {pct}% filled
          </span>
        ) : (
          <span className="flex items-center gap-1">
            <Lock size={10} className="text-[#8624FF]" />
            encrypted
          </span>
        )}
      </div>
    </Link>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function PortfolioPage() {
  const { address, isConnected } = useAccount();
  const { count } = useRoundCount();
  const { rounds, isLoading } = useAllRounds(count);

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

  const openCount      = myRounds.filter((r) => r.status === RoundStatus.OPEN).length;
  const closedCount    = myRounds.filter((r) => r.status === RoundStatus.CLOSED).length;

  // ── Not connected ──────────────────────────────────────────────────────────
  if (!isConnected) {
    return (
      <div className="min-h-[calc(100vh-60px)] bg-zinc-50/40 flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="w-12 h-12 rounded-2xl bg-[#8624FF]/10 flex items-center justify-center mx-auto mb-4">
            <Wallet size={22} className="text-[#8624FF]" />
          </div>
          <h2 className="text-lg font-semibold text-zinc-900 mb-1">Connect your wallet</h2>
          <p className="text-sm text-zinc-500">
            Your portfolio is tied to your wallet address. Connect to see your allocations across all rounds.
          </p>
        </div>
      </div>
    );
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-60px)] bg-zinc-50/40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-8 pb-10 space-y-6 animate-pulse">
          <div className="h-6 w-32 skeleton rounded" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[0,1,2,3].map(i => <div key={i} className="skeleton h-16 rounded-xl" />)}
          </div>
          <div className="skeleton h-48 rounded-xl" />
        </div>
      </div>
    );
  }

  // ── Empty state ────────────────────────────────────────────────────────────
  if (!isLoading && myRounds.length === 0) {
    return (
      <div className="min-h-[calc(100vh-60px)] bg-zinc-50/40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          <Header address={address} />
          <div className="mt-8 border border-dashed border-zinc-300 rounded-xl py-16 text-center bg-white">
            <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center mx-auto mb-4">
              <BarChart3 size={18} className="text-zinc-400" />
            </div>
            <p className="text-sm font-medium text-zinc-800">No positions yet</p>
            <p className="text-xs text-zinc-400 mt-1 max-w-xs mx-auto">
              A founder needs to add your wallet address to a round before you appear here.
            </p>
            <Link
              href="/rounds"
              className="inline-flex items-center gap-1.5 mt-5 text-xs font-medium text-[#8624FF] hover:underline"
            >
              Browse open rounds <ArrowRight size={11} />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-60px)] bg-zinc-50/40">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 animate-fade-up">

        <Header address={address} />

        {/* KPI strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          <KpiCard icon={<BarChart3 size={15} />} label="Positions"    value={myRounds.length}  accent />
          <KpiCard icon={<TrendingUp size={15} />} label="Open"        value={openCount} />
          <KpiCard icon={<CheckCircle2 size={15} />} label="Closed"    value={closedCount} />
          <KpiCard
            icon={<ShieldCheck size={15} />}
            label="Encrypted"
            value={`${myRounds.length}`}
          />
        </div>

        {/* FHE note */}
        <div className="mt-4 flex items-start gap-2.5 border border-[#8624FF]/20 bg-[#8624FF]/5 rounded-xl px-4 py-3">
          <Lock size={12} className="text-[#8624FF] mt-0.5 shrink-0" />
          <p className="text-xs text-[#6b21c8] leading-relaxed">
            All allocation amounts are{" "}
            <span className="font-medium">FHE-encrypted on-chain</span>. Open any round and connect as an investor to decrypt your personal allocation using a KMS signature.
          </p>
        </div>

        {/* Desktop table */}
        <div className="mt-5 hidden sm:block bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-sm">
          <div className="px-5 py-3 border-b border-zinc-100 flex items-center justify-between">
            <p className="text-xs font-mono text-zinc-400 uppercase tracking-wide">Your positions</p>
            <span className="text-[11px] font-mono text-zinc-400">{myRounds.length} round{myRounds.length !== 1 ? "s" : ""}</span>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-100">
                {["Round", "Status", "Deadline", "Target", "Fill / Alloc", ""].map((h) => (
                  <th
                    key={h}
                    className={`py-2 text-[10px] font-mono text-zinc-400 uppercase tracking-wide font-normal ${h === "" ? "pr-5 text-right" : h === "Round" ? "pl-5 pr-3 text-left" : "px-3 text-left"}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {myRounds.map((round) => (
                <PositionRow key={round.id.toString()} round={round} />
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="mt-5 sm:hidden space-y-3">
          {myRounds.map((round) => (
            <PositionCard key={round.id.toString()} round={round} />
          ))}
        </div>

      </div>
    </div>
  );
}

function Header({ address }: { address?: `0x${string}` }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Portfolio</h1>
        {address && (
          <p className="text-xs font-mono text-zinc-400 mt-0.5">
            {address.slice(0, 10)}…{address.slice(-6)}
          </p>
        )}
      </div>
      <Link
        href="/rounds"
        className="text-xs text-zinc-400 hover:text-zinc-700 transition-colors flex items-center gap-1"
      >
        Browse rounds <ArrowRight size={11} />
      </Link>
    </div>
  );
}
