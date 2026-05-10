"use client";

import { useState } from "react";
import { Lock, Eye, Globe } from "lucide-react";

type View = "founder" | "investor" | "public";

const rows = [
  { address: "0x4f3c...2a1b", amount: "$2,000,000", pct: "40.0%", label: "Lead" },
  { address: "0x8e7d...9f4c", amount: "$1,500,000", pct: "30.0%", label: null },
  { address: "0x1a2b...3c4d", amount: "$750,000",   pct: "15.0%", label: null },
  { address: "0x5e6f...7g8h", amount: "$500,000",   pct: "10.0%", label: null },
  { address: "0x9i0j...1k2l", amount: "$250,000",   pct: "5.0%",  label: null },
];

const INVESTOR_IDX = 3;

const TABS: { id: View; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: "founder", label: "Founder",  icon: <Eye size={12} />,   desc: "Full cap table — all rows decrypted" },
  { id: "investor", label: "Investor", icon: <Lock size={12} />,  desc: "Own row only — others remain locked" },
  { id: "public",   label: "Public",   icon: <Globe size={12} />, desc: "Aggregate only — no wallet connected" },
];

export function CapTableDemo() {
  const [view, setView] = useState<View>("founder");

  return (
    <div className="border border-border rounded-2xl overflow-hidden bg-background shadow-sm">
      {/* Browser chrome */}
      <div className="border-b border-border bg-surface px-4 py-2.5 flex items-center gap-3">
        <div className="flex gap-1.5 shrink-0">
          <span className="w-2.5 h-2.5 rounded-full bg-border" />
          <span className="w-2.5 h-2.5 rounded-full bg-border" />
          <span className="w-2.5 h-2.5 rounded-full bg-border" />
        </div>
        <div className="flex-1 bg-background border border-border rounded-md px-3 py-1 text-xs font-mono text-muted text-center select-none">
          holdr.xyz/round/cipher-labs-seed
        </div>
      </div>

      {/* Viewer switcher */}
      <div className="border-b border-border px-4 py-3 flex items-center gap-2">
        <span className="text-xs text-muted mr-1 hidden sm:block">Viewing as:</span>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setView(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              view === tab.id
                ? "bg-foreground text-background"
                : "text-muted hover:text-foreground hover:bg-surface"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
        <p className="ml-auto text-xs text-muted hidden md:block">
          {TABS.find((t) => t.id === view)?.desc}
        </p>
      </div>

      {/* Round header */}
      <div className="px-6 py-4 border-b border-border">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-semibold text-foreground text-sm">Cipher Labs — Seed Round</h3>
            <p className="text-xs text-muted mt-0.5">Target: $5,000,000 · 30 days · Sepolia</p>
          </div>
          <span className="badge-unlocked shrink-0">CLOSED</span>
        </div>

        {view === "public" && (
          <div className="mt-4 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted">Total raised</span>
              <span className="font-mono font-semibold text-foreground">$5,000,000</span>
            </div>
            <div className="w-full h-1.5 bg-surface rounded-full overflow-hidden border border-border">
              <div className="h-full bg-accent rounded-full transition-all" style={{ width: "100%" }} />
            </div>
            <p className="text-xs text-muted">Fully subscribed · 5 investors</p>
          </div>
        )}
      </div>

      {/* Table or public lockout */}
      {view !== "public" ? (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-xs text-muted">
                <th className="text-left px-6 py-3 font-medium">Investor</th>
                <th className="text-right px-6 py-3 font-medium">Allocation</th>
                <th className="text-right px-6 py-3 font-medium">Ownership</th>
                <th className="text-right px-6 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const isVisible =
                  view === "founder" || (view === "investor" && i === INVESTOR_IDX);
                const isMe = view === "investor" && i === INVESTOR_IDX;

                return (
                  <tr
                    key={row.address}
                    className={`border-b border-border last:border-0 transition-colors ${
                      isMe ? "bg-accent-dim/30" : "hover:bg-surface"
                    }`}
                  >
                    <td className="px-6 py-3">
                      <span className="font-mono text-xs text-foreground">{row.address}</span>
                      {row.label && (
                        <span className="ml-2 text-[10px] bg-surface border border-border text-muted px-1.5 py-0.5 rounded font-medium">
                          {row.label}
                        </span>
                      )}
                      {isMe && (
                        <span className="ml-2 text-[10px] text-accent font-semibold">you</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-right">
                      {isVisible ? (
                        <span className="font-mono text-xs text-foreground">{row.amount}</span>
                      ) : (
                        <span className="badge-locked">🔒 encrypted</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-right">
                      {isVisible ? (
                        <span className="font-mono text-xs text-foreground">{row.pct}</span>
                      ) : (
                        <span className="badge-locked">🔒</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <span className="badge-unlocked">subscribed</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="px-6 py-10 text-center">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl border border-border bg-surface mb-4">
            <Lock size={18} className="text-muted" />
          </div>
          <p className="text-sm font-medium text-foreground">Per-investor data is encrypted on-chain</p>
          <p className="text-xs text-muted mt-1 mb-6">Connect a wallet to decrypt your allocation</p>
          <div className="flex items-center justify-center gap-2">
            {rows.map((row, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5">
                <div className="w-8 h-8 rounded-full border border-border bg-surface" />
                <div className="h-1 w-12 bg-surface border border-border rounded" />
              </div>
            ))}
          </div>
          <p className="text-xs font-mono text-muted mt-4">5 investors · all encrypted</p>
        </div>
      )}
    </div>
  );
}
