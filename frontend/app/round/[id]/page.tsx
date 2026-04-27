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

type View = "public" | "investor" | "founder";

function daysUntil(ts: bigint): string {
  const ms = Number(ts) * 1000 - Date.now();
  if (ms <= 0) return "Expired";
  const d = Math.floor(ms / 86400000);
  return d === 0 ? "Today" : `${d}d`;
}

// ── Role toggle component ────────────────────────────────────────────────────
const VIEWS: { id: View; label: string; icon: React.ReactNode }[] = [
  { id: "founder",  label: "Founder",  icon: <LayoutDashboard size={12} /> },
  { id: "investor", label: "Investor", icon: <Lock size={12} /> },
  { id: "public",   label: "Public",   icon: <Eye size={12} /> },
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
    <div className="flex items-center gap-1 bg-surface border border-border rounded-xl p-1">
      {VIEWS.map(({ id, label, icon }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all ${
            active === id
              ? id === "founder"
                ? "bg-foreground text-background"
                : id === "investor"
                ? "bg-accent text-white"
                : "bg-chip text-chip-text"
              : "text-muted hover:text-foreground"
          }`}
        >
          {icon}
          {label}
        </button>
      ))}
    </div>
  );
}

// ── View label strip ──────────────────────────────────────────────────────────
function ViewBanner({ view, isFounder, isInvestor }: { view: View; isFounder: boolean; isInvestor: boolean }) {
  if (view === "public" && (isFounder || isInvestor)) {
    return (
      <div className="mb-5 flex items-center gap-2 text-xs text-muted border border-border rounded-xl px-4 py-2.5 bg-surface">
        <Eye size={12} />
        Viewing public overview — switch role in the top right to see your personalized view.
      </div>
    );
  }
  if (view === "investor") {
    return (
      <div className="mb-5 flex items-center gap-2 text-xs text-accent-text border border-green-200 rounded-xl px-4 py-2.5 bg-accent-dim">
        <Lock size={12} />
        Investor view — your allocation is end-to-end encrypted. Only you can decrypt it.
      </div>
    );
  }
  if (view === "founder") {
    return (
      <div className="mb-5 flex items-center gap-2 text-xs text-foreground border border-border rounded-xl px-4 py-2.5 bg-surface">
        <LayoutDashboard size={12} />
        Founder dashboard — manage investors, open the round, and trigger close.
      </div>
    );
  }
  return null;
}

function RoleGate({ role }: { role: "founder" | "investor" }) {
  const isFounder = role === "founder";
  return (
    <div className="border border-dashed border-border rounded-2xl py-14 text-center space-y-2">
      <div className="flex justify-center mb-3">
        {isFounder
          ? <LayoutDashboard size={22} className="text-muted" />
          : <Lock size={22} className="text-muted" />
        }
      </div>
      <p className="text-sm font-medium text-foreground">
        {isFounder ? "Founder access only" : "Investor access only"}
      </p>
      <p className="text-xs text-muted max-w-xs mx-auto">
        {isFounder
          ? "This view is restricted to the round creator. Switch to Public to see what investors see."
          : "You're not listed as an investor in this round. Ask the founder to add your address."
        }
      </p>
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

  // Auto-select role when it resolves
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

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading || !round) {
    return (
      <div>
        <div className="border-b border-border bg-surface/40">
          <div className="max-w-5xl mx-auto px-6 py-8 space-y-4">
            <div className="skeleton h-3 w-20" />
            <div className="skeleton h-8 w-64" />
            <div className="skeleton h-3 w-40" />
            <div className="grid grid-cols-4 gap-3 pt-2">
              {[0,1,2,3].map(i => <div key={i} className="skeleton h-16 rounded-xl" />)}
            </div>
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-6 py-8 flex gap-8">
          <div className="flex-1 skeleton h-48 rounded-2xl" />
          <div className="w-64 shrink-0 space-y-4 hidden lg:block">
            <div className="skeleton h-48 rounded-2xl" />
            <div className="skeleton h-32 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  const pct = round.targetRaise > 0n
    ? Math.min(Number((round.totalRaised * 100n) / round.targetRaise), 100)
    : 0;

  return (
    <div>
      {/* ── Deal header ──────────────────────────────────────────────────────── */}
      <div className="border-b border-border bg-surface/40">
        <div className="max-w-5xl mx-auto px-6 pt-6 pb-6">

          {/* Back */}
          <Link
            href="/rounds"
            className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-foreground mb-5 transition-colors"
          >
            <ArrowLeft size={13} /> All rounds
          </Link>

          {/* Title row + role toggle */}
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-semibold text-foreground truncate">{round.name}</h1>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="text-xs text-muted font-mono">
                  by {round.founder.slice(0, 10)}…{round.founder.slice(-6)}
                </span>
                <span className="text-border">·</span>
                <span className="text-xs font-mono text-muted">#{round.id.toString()}</span>
              </div>
            </div>

            {/* Right side: status + role toggle */}
            <div className="flex items-center gap-3 shrink-0">
              <StatusBadge status={round.status} />
              {isConnected && (
                <RoleToggle
                  isFounder={isFounder}
                  isInvestor={isInvestor}
                  active={activeView}
                  onChange={setActiveView}
                />
              )}
            </div>
          </div>

          {/* Stats strip */}
          <div className="grid grid-cols-4 gap-0 mt-5 border border-border rounded-xl overflow-hidden divide-x divide-border">
            {[
              {
                icon: <TrendingUp size={13} className="text-muted" />,
                label: "Target",
                value: formatUSDT(round.targetRaise),
              },
              {
                icon: <Users size={13} className="text-muted" />,
                label: "Investors",
                value: investors.length.toString(),
              },
              {
                icon: <Calendar size={13} className="text-muted" />,
                label: "Deadline",
                value: daysUntil(round.deadline),
                dim: daysUntil(round.deadline) === "Expired",
              },
              round.status === RoundStatus.CLOSED && round.totalRaised > 0n
                ? { icon: <TrendingUp size={13} className="text-accent" />, label: "Raised",  value: formatUSDT(round.totalRaised), accent: true }
                : { icon: <TrendingUp size={13} className="text-muted"  />, label: "Filled",  value: round.status === RoundStatus.CLOSED ? `${pct}%` : "—" },
            ].map(({ icon, label, value, dim, accent }) => (
              <div key={label} className="px-4 py-4 bg-background">
                <div className="flex items-center gap-1.5 mb-1.5">
                  {icon}
                  <span className="text-xs text-muted font-mono">{label}</span>
                </div>
                <p className={`text-base font-semibold font-mono ${accent ? "text-accent" : dim ? "text-muted" : "text-foreground"}`}>
                  {value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Two-column layout ─────────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-6 py-8 flex gap-8 items-start">

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
            <div className="border border-dashed border-border rounded-2xl py-12 text-center">
              <p className="text-sm text-foreground font-medium">Connect your wallet</p>
              <p className="text-xs text-muted mt-1">to see your role and interact with this round.</p>
            </div>
          )}
        </div>

        {/* ── Right sidebar ───────────────────────────────────────────────────── */}
        <aside className="hidden lg:block w-60 shrink-0 space-y-4">

          <div className="border border-border rounded-2xl overflow-hidden">
            <div className="px-4 py-3 bg-surface border-b border-border flex items-center gap-2">
              <FileText size={13} className="text-muted" />
              <p className="text-xs font-mono text-muted uppercase tracking-wide">SAFE Terms</p>
            </div>
            <div className="divide-y divide-border">
              {[
                { label: "Instrument",      value: "SAFE"                         },
                { label: "Val. cap",        value: formatUSDT(round.targetRaise * 4n) },
                { label: "Discount",        value: "20%"                          },
                { label: "Pro-rata",        value: "Yes"                          },
                { label: "MFN",             value: "Yes"                          },
                { label: "Board seat",      value: "No"                           },
              ].map(({ label, value }) => (
                <div key={label} className="px-4 py-2.5 flex items-center justify-between gap-2">
                  <span className="text-xs text-muted">{label}</span>
                  <span className="text-xs font-mono text-foreground font-medium">{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="border border-border rounded-2xl overflow-hidden">
            <div className="px-4 py-3 bg-surface border-b border-border flex items-center gap-2">
              <Scale size={13} className="text-muted" />
              <p className="text-xs font-mono text-muted uppercase tracking-wide">Legal</p>
            </div>
            <div className="divide-y divide-border">
              {[
                { label: "Entity",     value: "Delaware C-Corp" },
                { label: "Gov. law",   value: "California"      },
                { label: "Info rights", value: "Major investors"},
                { label: "Counsel",    value: "Cooley LLP"      },
              ].map(({ label, value }) => (
                <div key={label} className="px-4 py-2.5 flex items-center justify-between gap-2">
                  <span className="text-xs text-muted shrink-0">{label}</span>
                  <span className="text-xs font-mono text-foreground font-medium text-right">{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="border border-border rounded-2xl overflow-hidden">
            <div className="px-4 py-3 bg-surface border-b border-border flex items-center gap-2">
              <ShieldCheck size={13} className="text-muted" />
              <p className="text-xs font-mono text-muted uppercase tracking-wide">Privacy</p>
            </div>
            <div className="divide-y divide-border">
              {[
                { label: "Encryption",   value: "FHEVM"    },
                { label: "Network",      value: "Sepolia"  },
                { label: "KMS",          value: "Zama"     },
                { label: "ACL",          value: "On-chain" },
              ].map(({ label, value }) => (
                <div key={label} className="px-4 py-2.5 flex items-center justify-between">
                  <span className="text-xs text-muted">{label}</span>
                  <span className="text-xs font-mono text-foreground font-medium">{value}</span>
                </div>
              ))}
            </div>
          </div>

          <a
            href={`https://sepolia.etherscan.io/address/${ADDRESSES.RoundFactory}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 border border-border rounded-xl px-4 py-3 hover:bg-surface transition-colors"
          >
            <Globe size={12} className="text-muted shrink-0" />
            <span className="text-xs text-muted">Verify on Etherscan</span>
          </a>
        </aside>
      </div>
    </div>
  );
}
