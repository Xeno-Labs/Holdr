"use client";

import { useParams } from "next/navigation";
import { useAccount, usePublicClient, useSignTypedData } from "wagmi";
import { useState, useEffect } from "react";
import { useRound, useInvestors } from "@/lib/hooks/useRound";
import { ADDRESSES, ALLOCATIONS_ABI, RoundStatus, formatUSDT } from "@/lib/contracts";
import { decryptHandle } from "@/lib/fhe";
import { PublicView } from "@/components/CapTable/PublicView";
import { InvestorView } from "@/components/CapTable/InvestorView";
import { FounderView } from "@/components/CapTable/FounderView";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useReadContract } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Lock, Users, Calendar, TrendingUp,
  FileText, ShieldCheck, Globe, Scale, LayoutDashboard, Eye,
} from "lucide-react";
import Link from "next/link";
import { FounderCompanyCard } from "@/components/founder/FounderCompanyCard";

type View = "public" | "investor" | "founder";

function daysUntil(ts: bigint): string {
  const ms = Number(ts) * 1000 - Date.now();
  if (ms <= 0) return "Expired";
  const d = Math.floor(ms / 86400000);
  return d === 0 ? "Today" : `${d}d`;
}

// ── Role toggle ──────────────────────────────────────────────────────────────
const VIEWS: { id: View; label: string; icon: React.ReactNode }[] = [
  { id: "founder",  label: "Founder",  icon: <LayoutDashboard size={11} /> },
  { id: "investor", label: "Investor", icon: <Lock size={11} /> },
  { id: "public",   label: "Public",   icon: <Eye size={11} /> },
];

function RoleToggle({
  active,
  onChange,
}: {
  isFounder: boolean;
  isInvestor: boolean;
  active: View;
  onChange: (v: View) => void;
}) {
  return (
    <div className="flex items-center gap-0.5 bg-zinc-100 border border-zinc-200 rounded-lg p-0.5">
      {VIEWS.map(({ id, label, icon }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={`flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-md transition-all ${
            active === id
              ? id === "founder"
                ? "bg-zinc-900 text-white shadow-sm"
                : id === "investor"
                ? "bg-[#8624FF] text-white shadow-sm"
                : "bg-white text-zinc-700 shadow-sm"
              : "text-zinc-400 hover:text-zinc-700"
          }`}
        >
          {icon}
          {label}
        </button>
      ))}
    </div>
  );
}

// ── View banner ───────────────────────────────────────────────────────────────
function ViewBanner({ view, isFounder, isInvestor }: { view: View; isFounder: boolean; isInvestor: boolean }) {
  if (view === "public" && (isFounder || isInvestor)) {
    return (
      <div className="mb-4 flex items-center gap-2 text-xs text-zinc-500 border border-zinc-200 rounded-lg px-3 py-2 bg-zinc-50">
        <Eye size={11} className="shrink-0" />
        Public overview — switch role above to see your personalized view.
      </div>
    );
  }
  if (view === "investor") {
    return (
      <div className="mb-4 flex items-center gap-2 text-xs text-[#6b21c8] border border-[#8624FF]/20 rounded-lg px-3 py-2 bg-[#8624FF]/5">
        <Lock size={11} className="shrink-0 text-[#8624FF]" />
        Investor view — your allocation is end-to-end encrypted. Only you can decrypt it.
      </div>
    );
  }
  if (view === "founder") {
    return (
      <div className="mb-4 flex items-center gap-2 text-xs text-zinc-700 border border-zinc-200 rounded-lg px-3 py-2 bg-zinc-50">
        <LayoutDashboard size={11} className="shrink-0" />
        Founder dashboard — manage investors, open the round, and trigger close.
      </div>
    );
  }
  return null;
}

function RoleGate({ role }: { role: "founder" | "investor" }) {
  const isFounder = role === "founder";
  return (
    <div className="border border-dashed border-zinc-200 rounded-xl py-12 text-center space-y-2">
      <div className="flex justify-center mb-3">
        {isFounder
          ? <LayoutDashboard size={20} className="text-zinc-300" />
          : <Lock size={20} className="text-zinc-300" />
        }
      </div>
      <p className="text-sm font-medium text-zinc-800">
        {isFounder ? "Founder access only" : "Investor access only"}
      </p>
      <p className="text-xs text-zinc-400 max-w-xs mx-auto leading-relaxed">
        {isFounder
          ? "This view is restricted to the round creator. Switch to Public to see what investors see."
          : "You're not listed as an investor in this round. Ask the founder to add your address."
        }
      </p>
    </div>
  );
}

// ── Sidebar section card ──────────────────────────────────────────────────────
function SideCard({
  icon,
  title,
  rows,
}: {
  icon: React.ReactNode;
  title: string;
  rows: { label: string; value: string }[];
}) {
  return (
    <div className="border border-zinc-200 rounded-xl overflow-hidden">
      <div className="px-3.5 py-2.5 bg-zinc-50 border-b border-zinc-200 flex items-center gap-2">
        <span className="text-zinc-400">{icon}</span>
        <p className="text-[11px] font-mono text-zinc-400 uppercase tracking-wide">{title}</p>
      </div>
      <div className="divide-y divide-zinc-100">
        {rows.map(({ label, value }) => (
          <div key={label} className="px-3.5 py-2 flex items-center justify-between gap-2">
            <span className="text-[11px] text-zinc-400 shrink-0">{label}</span>
            <span className="text-[11px] font-mono text-zinc-800 font-medium text-right">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function RoundPage() {
  const { id } = useParams<{ id: string }>();
  const roundId = id ? BigInt(id) : undefined;

  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { signTypedDataAsync } = useSignTypedData();
  const qc = useQueryClient();

  const { round, isLoading } = useRound(roundId);
  const { investors } = useInvestors(roundId);

  const isFounder  = !!round && !!address && round.founder.toLowerCase() === address.toLowerCase();
  const isInvestor = !!address && investors.some((a) => a.toLowerCase() === address.toLowerCase());

  const defaultView: View = isFounder ? "founder" : isInvestor ? "investor" : "public";
  const [activeView, setActiveView] = useState<View>(defaultView);

  useEffect(() => {
    if (isFounder) setActiveView("founder");
    else if (isInvestor) setActiveView("investor");
  }, [isFounder, isInvestor]);

  const [decryptedAmount, setDecryptedAmount] = useState<bigint | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);

  const { data: allocHandle } = useReadContract({
    address:      ADDRESSES.Allocations,
    abi:          ALLOCATIONS_ABI,
    functionName: "getAllocation",
    args:         roundId !== undefined && address ? [roundId, address] : undefined,
    query:        { enabled: !!isInvestor },
  });

  async function handleDecrypt() {
    if (!allocHandle || !address || !publicClient) return;
    setIsDecrypting(true);
    try {
      const amount = await decryptHandle(
        allocHandle as `0x${string}`,
        ADDRESSES.Allocations,
        publicClient,
        address,
        signTypedDataAsync,
      );
      setDecryptedAmount(amount);
    } catch (e) {
      console.error("Decryption failed:", e);
    } finally {
      setIsDecrypting(false);
    }
  }

  function refetch() { qc.invalidateQueries(); }

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (isLoading || !round) {
    return (
      <div className="max-w-5xl mx-auto px-6">
        <div className="py-6 space-y-4">
          <div className="skeleton h-3 w-16 rounded" />
          <div className="skeleton h-7 w-56 rounded" />
          <div className="skeleton h-3 w-32 rounded" />
          <div className="grid grid-cols-4 gap-3 pt-1">
            {[0,1,2,3].map(i => <div key={i} className="skeleton h-14 rounded-lg" />)}
          </div>
        </div>
        <div className="flex gap-6 pb-10">
          <div className="flex-1 skeleton h-48 rounded-xl" />
          <div className="w-56 shrink-0 space-y-3 hidden lg:block">
            <div className="skeleton h-44 rounded-xl" />
            <div className="skeleton h-28 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  const pct = round.targetRaise > 0n
    ? Math.min(Number((round.totalRaised * 100n) / round.targetRaise), 100)
    : 0;

  const deadline = daysUntil(round.deadline);

  return (
    <div className="min-h-[calc(100vh-60px)] bg-zinc-50/40">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">

        {/* ── Deal header ─────────────────────────────────────────────────────── */}
        <div className="pt-5 pb-4">
          <Link
            href="/rounds"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-700 mb-4 transition-colors"
          >
            <ArrowLeft size={12} /> All rounds
          </Link>

          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-semibold text-zinc-900 truncate">{round.name}</h1>
                <StatusBadge status={round.status} />
              </div>
              <p className="text-xs text-zinc-400 font-mono mt-1">
                by {round.founder.slice(0, 10)}…{round.founder.slice(-6)}
                <span className="mx-1.5 text-zinc-300">·</span>
                #{round.id.toString()}
              </p>
            </div>

            {isConnected && (
              <div className="shrink-0">
                <RoleToggle
                  isFounder={isFounder}
                  isInvestor={isInvestor}
                  active={activeView}
                  onChange={setActiveView}
                />
              </div>
            )}
          </div>

          {/* Stats strip */}
          <div className="grid grid-cols-4 mt-4 border border-zinc-200 rounded-xl overflow-hidden divide-x divide-zinc-200 bg-white shadow-sm">
            {[
              {
                icon: <TrendingUp size={12} />,
                label: "Target",
                value: formatUSDT(round.targetRaise),
              },
              {
                icon: <Users size={12} />,
                label: "Investors",
                value: investors.length.toString(),
              },
              {
                icon: <Calendar size={12} />,
                label: "Deadline",
                value: deadline,
                dim: deadline === "Expired",
              },
              {
                icon: <TrendingUp size={12} />,
                label: "Filled",
                value: round.status === RoundStatus.CLOSED ? `${pct}%` : "—",
                accent: round.status === RoundStatus.CLOSED && pct > 0,
              },
            ].map(({ icon, label, value, dim, accent }) => (
              <div key={label} className="px-4 py-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={accent ? "text-[#8624FF]" : "text-zinc-400"}>{icon}</span>
                  <span className="text-[10px] text-zinc-400 font-mono uppercase tracking-wide">{label}</span>
                </div>
                <p className={`text-sm font-semibold font-mono ${accent ? "text-[#8624FF]" : dim ? "text-zinc-400" : "text-zinc-900"}`}>
                  {value}
                </p>
              </div>
            ))}
          </div>

          {/* Progress bar (only when round is open or closed with data) */}
          {round.status !== RoundStatus.DRAFT && (
            <div className="mt-3">
              <div className="h-1 rounded-full bg-zinc-200 overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#8624FF] transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-zinc-400 font-mono">{pct}% filled</span>
                <span className="text-[10px] text-zinc-400 font-mono">{formatUSDT(round.targetRaise)} target</span>
              </div>
            </div>
          )}
        </div>

        {/* ── Two-column layout ────────────────────────────────────────────────── */}
        <div className="flex gap-5 pb-10 items-start">

          {/* Main content */}
          <div className="flex-1 min-w-0">
            {isConnected && (
              <ViewBanner
                view={activeView}
                isFounder={isFounder}
                isInvestor={isInvestor}
              />
            )}

            <div key={activeView} className="animate-fade-up">
              {activeView === "public" && (
                <PublicView round={round} investorCount={investors.length} />
              )}
              {activeView === "investor" && (
                isInvestor ? (
                  <InvestorView
                    round={round}
                    decryptedAmount={decryptedAmount}
                    isDecrypting={isDecrypting}
                    onDecrypt={handleDecrypt}
                  />
                ) : (
                  <RoleGate role="investor" />
                )
              )}
              {activeView === "founder" && (
                isFounder ? (
                  <FounderView round={round} investors={investors} refetch={refetch} />
                ) : (
                  <RoleGate role="founder" />
                )
              )}
            </div>

            {!isConnected && (
              <div className="border border-dashed border-zinc-200 rounded-xl py-10 text-center bg-white">
                <p className="text-sm font-medium text-zinc-800">Connect your wallet</p>
                <p className="text-xs text-zinc-400 mt-1">to see your role and interact with this round.</p>
              </div>
            )}
          </div>

          {/* ── Right sidebar ──────────────────────────────────────────────────── */}
          <aside className="hidden lg:flex lg:w-52 xl:w-56 shrink-0 flex-col gap-3">

            <FounderCompanyCard founder={round.founder} isFounder={isFounder} />

            <SideCard
              icon={<FileText size={12} />}
              title="SAFE Terms"
              rows={[
                { label: "Instrument",  value: "SAFE"                              },
                { label: "Val. cap",    value: formatUSDT(round.targetRaise * 4n)  },
                { label: "Discount",    value: "20%"                               },
                { label: "Pro-rata",    value: "Yes"                               },
                { label: "MFN",         value: "Yes"                               },
                { label: "Board seat",  value: "No"                                },
              ]}
            />

            <SideCard
              icon={<Scale size={12} />}
              title="Legal"
              rows={[
                { label: "Entity",      value: "Delaware C-Corp" },
                { label: "Gov. law",    value: "California"      },
                { label: "Info rights", value: "Major investors" },
                { label: "Counsel",     value: "Cooley LLP"      },
              ]}
            />

            <SideCard
              icon={<ShieldCheck size={12} />}
              title="Privacy"
              rows={[
                { label: "Encryption", value: "FHEVM"    },
                { label: "Network",    value: "Sepolia"  },
                { label: "KMS",        value: "Zama"     },
                { label: "ACL",        value: "On-chain" },
              ]}
            />

            <a
              href={`https://sepolia.etherscan.io/address/${ADDRESSES.RoundFactory}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 border border-zinc-200 rounded-xl px-3.5 py-2.5 hover:bg-white transition-colors bg-zinc-50"
            >
              <Globe size={11} className="text-zinc-400 shrink-0" />
              <span className="text-[11px] text-zinc-500">Verify on Etherscan</span>
            </a>
          </aside>
        </div>
      </div>
    </div>
  );
}
