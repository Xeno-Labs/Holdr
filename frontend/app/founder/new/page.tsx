"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useWriteContract, usePublicClient } from "wagmi";
import { parseEventLogs, isAddress } from "viem";
import { ADDRESSES, ROUND_FACTORY_ABI, ALLOCATIONS_ABI, parseUSDT } from "@/lib/contracts";
import { encryptUint64 } from "@/lib/fhe";
import { useTxToast } from "@/components/ui/Toast";
import { Check, Lock, ArrowRight, ArrowLeft, Plus, Trash2 } from "lucide-react";
import Link from "next/link";

type Step = "details" | "investors" | "review" | "done";
const STEPS: Step[] = ["details", "investors", "review"];
const STEP_META: Record<Step, { n: number; title: string; sub: string }> = {
  details:   { n: 1, title: "Round details",    sub: "Name, target, and timeline" },
  investors: { n: 2, title: "Allocations",      sub: "Who gets in and how much"   },
  review:    { n: 3, title: "Review & deploy",  sub: "Confirm and go on-chain"    },
  done:      { n: 3, title: "Review & deploy",  sub: "Confirm and go on-chain"    },
};

interface InvestorEntry {
  address: string;
  amount:  string;
}

function Field({
  label, hint, children,
}: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <label className="text-sm font-medium text-foreground">{label}</label>
        {hint && <span className="text-xs text-muted">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

export default function NewRoundPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { writeContractAsync, isPending } = useWriteContract();
  const publicClient = usePublicClient();
  const { write } = useTxToast();

  const [step, setStep] = useState<Step>("details");
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [deadlineDays, setDeadlineDays] = useState("30");
  const [investors, setInvestors] = useState<InvestorEntry[]>([{ address: "", amount: "" }]);
  const [createdId, setCreatedId] = useState<bigint | null>(null);

  const validInvestors = investors.filter((i) => isAddress(i.address) && Number(i.amount) > 0);
  const currentIndex = STEPS.indexOf(step === "done" ? "review" : step);

  function addRow() {
    setInvestors((p) => [...p, { address: "", amount: "" }]);
  }
  function removeRow(i: number) {
    setInvestors((p) => p.filter((_, idx) => idx !== i));
  }
  function updateRow(i: number, field: keyof InvestorEntry, val: string) {
    setInvestors((p) => p.map((r, idx) => idx === i ? { ...r, [field]: val } : r));
  }

  async function createRound() {
    if (!isConnected || !publicClient || !address) return;
    const deadlineTs = BigInt(Math.floor(Date.now() / 1000) + Number(deadlineDays) * 86400);

    // Step 1 — create the round
    const hash = await write("Creating round", () =>
      writeContractAsync({
        address:      ADDRESSES.RoundFactory,
        abi:          ROUND_FACTORY_ABI,
        functionName: "createRound",
        args:         [name, parseUSDT(Number(target)), deadlineTs],
      }),
    );
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    const logs = parseEventLogs({ abi: ROUND_FACTORY_ABI, logs: receipt.logs });
    const evt = logs.find((l) => l.eventName === "RoundCreated");
    const roundId = evt ? (evt.args as { roundId: bigint }).roundId : null;
    if (roundId === null) return;

    // Step 2 — add each investor with FHE-encrypted allocation
    for (const inv of validInvestors) {
      const rawAmount = parseUSDT(Number(inv.amount));
      const { handle, inputProof } = await encryptUint64(
        rawAmount,
        ADDRESSES.Allocations,
        address,
        publicClient,
      );
      await write(`Adding ${inv.address.slice(0, 8)}…`, () =>
        writeContractAsync({
          address:      ADDRESSES.Allocations,
          abi:          ALLOCATIONS_ABI,
          functionName: "addInvestor",
          args:         [roundId, inv.address as `0x${string}`, handle, inputProof],
        }),
      );
    }

    setCreatedId(roundId);
    setStep("done");
  }

  if (!isConnected) {
    return (
      <div className="max-w-lg mx-auto px-6 py-24 text-center">
        <p className="text-sm font-medium text-foreground">Wallet not connected</p>
        <p className="text-xs text-muted mt-1">Connect to create a fundraise round.</p>
      </div>
    );
  }

  // ── Done screen ─────────────────────────────────────────────────────────────
  if (step === "done" && createdId !== null) {
    return (
      <div className="max-w-lg mx-auto px-6 py-24 text-center space-y-5 animate-fade-up">
        <div className="w-12 h-12 rounded-full bg-accent-dim border border-green-200 flex items-center justify-center mx-auto">
          <Check size={22} className="text-accent" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-foreground">Round created</h2>
          <p className="text-sm text-muted mt-1">
            Round #{createdId.toString()} is in draft. Add investors and open it when ready.
          </p>
        </div>
        <div className="flex gap-3 justify-center pt-2">
          <button
            onClick={() => router.push(`/round/${createdId.toString()}`)}
            className="flex items-center gap-2 bg-foreground text-background text-sm font-medium rounded-xl px-5 py-2.5 hover:opacity-80 transition-opacity"
          >
            Open round <ArrowRight size={14} />
          </button>
          <button
            onClick={() => { setStep("details"); setName(""); setTarget(""); setInvestors([{ address: "", amount: "" }]); setCreatedId(null); }}
            className="border border-border text-sm rounded-xl px-5 py-2.5 hover:bg-surface transition-colors"
          >
            New round
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-60px)] flex">

      {/* ── Left sidebar ─────────────────────────────────────────────────────── */}
      <aside className="hidden md:flex flex-col w-64 border-r border-border bg-surface/40 px-6 py-10 shrink-0">
        <Link
          href="/rounds"
          className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-foreground mb-10 transition-colors"
        >
          <ArrowLeft size={12} /> Back to rounds
        </Link>

        <p className="text-xs font-mono text-muted uppercase tracking-widest mb-6">New round</p>

        <nav className="space-y-1">
          {STEPS.map((s, i) => {
            const done    = i < currentIndex;
            const current = i === currentIndex;
            const meta    = STEP_META[s];
            return (
              <button
                key={s}
                onClick={() => done ? setStep(s) : undefined}
                disabled={!done}
                className={`w-full text-left flex items-start gap-3 px-3 py-3 rounded-xl transition-colors ${
                  current ? "bg-background border border-border" : done ? "hover:bg-background/60 cursor-pointer" : "cursor-default"
                }`}
              >
                <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-mono shrink-0 ${
                  done    ? "bg-accent text-white"
                  : current ? "bg-foreground text-background"
                  :           "bg-chip text-muted"
                }`}>
                  {done ? <Check size={10} /> : meta.n}
                </div>
                <div>
                  <p className={`text-sm font-medium ${current ? "text-foreground" : done ? "text-foreground" : "text-muted"}`}>
                    {meta.title}
                  </p>
                  <p className="text-xs text-muted mt-0.5">{meta.sub}</p>
                </div>
              </button>
            );
          })}
        </nav>

        {/* FHE badge */}
        <div className="mt-auto pt-8 border-t border-border">
          <div className="flex items-center gap-2 text-xs text-muted">
            <Lock size={12} className="text-accent" />
            <span>Allocations are FHE-encrypted before submission</span>
          </div>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-xl mx-auto px-8 py-10 animate-fade-up">

          {/* Mobile step indicator */}
          <div className="flex items-center gap-1.5 mb-8 md:hidden">
            {STEPS.map((s, i) => (
              <div
                key={s}
                className={`h-1 rounded-full flex-1 transition-all ${i <= currentIndex ? "bg-foreground" : "bg-chip"}`}
              />
            ))}
          </div>

          {/* ── Step 1 ── */}
          {step === "details" && (
            <div className="space-y-7">
              <div>
                <h1 className="text-2xl font-semibold text-foreground">Round details</h1>
                <p className="text-sm text-muted mt-1">Basic information about your fundraise.</p>
              </div>

              <div className="space-y-5">
                <Field label="Round name" hint="e.g. Seed, Series A">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Cipher Labs Seed Round"
                    className="w-full border border-border rounded-xl px-4 py-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-foreground/10"
                  />
                </Field>

                <Field label="Target raise" hint="USDT">
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted text-sm font-mono">$</span>
                    <input
                      type="number"
                      value={target}
                      onChange={(e) => setTarget(e.target.value)}
                      placeholder="500,000"
                      className="w-full border border-border rounded-xl pl-8 pr-16 py-3 text-sm font-mono bg-background focus:outline-none focus:ring-2 focus:ring-foreground/10"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-muted font-mono">USDT</span>
                  </div>
                </Field>

                <Field label="Deadline" hint={target && deadlineDays ? `closes ${new Date(Date.now() + Number(deadlineDays) * 86400000).toLocaleDateString()}` : ""}>
                  <div className="grid grid-cols-3 gap-2">
                    {["14", "30", "60", "90"].map((d) => (
                      <button
                        key={d}
                        onClick={() => setDeadlineDays(d)}
                        className={`border rounded-xl py-2.5 text-sm font-mono transition-colors ${
                          deadlineDays === d
                            ? "border-foreground bg-foreground text-background"
                            : "border-border hover:bg-surface text-foreground"
                        }`}
                      >
                        {d}d
                      </button>
                    ))}
                    <div className="relative">
                      <input
                        type="number"
                        value={!["14","30","60","90"].includes(deadlineDays) ? deadlineDays : ""}
                        onChange={(e) => setDeadlineDays(e.target.value)}
                        placeholder="custom"
                        className="w-full border border-border rounded-xl py-2.5 text-sm font-mono bg-background focus:outline-none focus:ring-2 focus:ring-foreground/10 text-center"
                      />
                    </div>
                  </div>
                </Field>
              </div>

              <button
                onClick={() => setStep("investors")}
                disabled={!name || !target}
                className="flex items-center gap-2 bg-foreground text-background text-sm font-medium rounded-xl px-6 py-3 hover:opacity-80 transition-opacity disabled:opacity-40"
              >
                Continue <ArrowRight size={14} />
              </button>
            </div>
          )}

          {/* ── Step 2 ── */}
          {step === "investors" && (
            <div className="space-y-7">
              <div>
                <h2 className="text-2xl font-semibold text-foreground">Allocations</h2>
                <p className="text-sm text-muted mt-1">
                  Each amount will be FHE-encrypted before touching the chain.
                  Investors can only see their own slice.
                </p>
              </div>

              <div className="space-y-3">
                {/* Header */}
                <div className="grid grid-cols-[1fr_140px_32px] gap-2 px-1">
                  <span className="text-xs text-muted font-mono">Wallet address</span>
                  <span className="text-xs text-muted font-mono">Amount (USDT)</span>
                  <span />
                </div>

                {investors.map((inv, i) => {
                  const addrOk = !inv.address || isAddress(inv.address);
                  return (
                    <div key={i} className="grid grid-cols-[1fr_140px_32px] gap-2 items-center">
                      <input
                        placeholder="0x…"
                        value={inv.address}
                        onChange={(e) => updateRow(i, "address", e.target.value)}
                        className={`border rounded-xl px-3 py-2.5 text-sm font-mono bg-background focus:outline-none focus:ring-2 focus:ring-foreground/10 transition-colors ${
                          !addrOk ? "border-destructive" : "border-border"
                        }`}
                      />
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted font-mono">$</span>
                        <input
                          type="number"
                          placeholder="0"
                          value={inv.amount}
                          onChange={(e) => updateRow(i, "amount", e.target.value)}
                          className="w-full border border-border rounded-xl pl-6 pr-3 py-2.5 text-sm font-mono bg-background focus:outline-none focus:ring-2 focus:ring-foreground/10"
                        />
                      </div>
                      <button
                        onClick={() => removeRow(i)}
                        disabled={investors.length === 1}
                        className="w-8 h-8 flex items-center justify-center text-muted hover:text-destructive transition-colors disabled:opacity-30"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}

                <button
                  onClick={addRow}
                  className="flex items-center gap-1.5 text-sm text-muted border border-dashed border-border rounded-xl w-full py-2.5 justify-center hover:border-foreground/30 hover:text-foreground transition-colors"
                >
                  <Plus size={14} /> Add investor
                </button>

                {validInvestors.length > 0 && (
                  <div className="flex items-center justify-between text-xs text-muted border border-border rounded-xl px-4 py-2.5 bg-surface font-mono">
                    <span>{validInvestors.length} investor{validInvestors.length !== 1 ? "s" : ""}</span>
                    <span>
                      Total: ${validInvestors.reduce((s, i) => s + Number(i.amount), 0).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep("details")}
                  className="flex items-center gap-1.5 border border-border rounded-xl px-5 py-2.5 text-sm hover:bg-surface transition-colors"
                >
                  <ArrowLeft size={14} /> Back
                </button>
                <button
                  onClick={() => setStep("review")}
                  disabled={validInvestors.length === 0}
                  className="flex items-center gap-2 bg-foreground text-background text-sm font-medium rounded-xl px-6 py-2.5 hover:opacity-80 transition-opacity disabled:opacity-40"
                >
                  Review <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3 ── */}
          {step === "review" && (
            <div className="space-y-7">
              <div>
                <h2 className="text-2xl font-semibold text-foreground">Review & deploy</h2>
                <p className="text-sm text-muted mt-1">
                  This creates the round on-chain. Investor allocations are encrypted separately after.
                </p>
              </div>

              {/* Summary card */}
              <div className="border border-border rounded-2xl overflow-hidden">
                <div className="px-5 py-3 bg-surface border-b border-border">
                  <p className="text-xs font-mono text-muted uppercase tracking-wide">Round summary</p>
                </div>
                <div className="divide-y divide-border">
                  {[
                    { label: "Name",     value: name                                      },
                    { label: "Target",   value: `$${Number(target).toLocaleString()} USDT`},
                    { label: "Deadline", value: `${deadlineDays} days`                   },
                    { label: "Investors", value: `${validInvestors.length} allocated`    },
                    { label: "Total alloc", value: `$${validInvestors.reduce((s, i) => s + Number(i.amount), 0).toLocaleString()} USDT` },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between px-5 py-3.5">
                      <span className="text-xs font-mono text-muted">{label}</span>
                      <span className="text-sm text-foreground font-medium">{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Investor list preview */}
              <div className="border border-border rounded-2xl overflow-hidden">
                <div className="px-5 py-3 bg-surface border-b border-border flex items-center justify-between">
                  <p className="text-xs font-mono text-muted uppercase tracking-wide">Allocations</p>
                  <span className="badge-locked text-[11px]"><Lock size={10} /> will be encrypted</span>
                </div>
                <ul className="divide-y divide-border">
                  {validInvestors.map((inv, i) => (
                    <li key={i} className="px-5 py-3 flex items-center justify-between">
                      <span className="text-xs font-mono text-foreground">
                        {inv.address.slice(0, 10)}…{inv.address.slice(-6)}
                      </span>
                      <span className="text-xs font-mono text-muted">${Number(inv.amount).toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep("investors")}
                  className="flex items-center gap-1.5 border border-border rounded-xl px-5 py-2.5 text-sm hover:bg-surface transition-colors"
                >
                  <ArrowLeft size={14} /> Edit
                </button>
                <button
                  onClick={createRound}
                  disabled={isPending}
                  className="flex-1 flex items-center justify-center gap-2 bg-foreground text-background text-sm font-medium rounded-xl px-6 py-2.5 hover:opacity-80 transition-opacity disabled:opacity-50"
                >
                  {isPending
                    ? <><span className="w-3.5 h-3.5 border border-white/30 border-t-white rounded-full animate-spin" /> Deploying…</>
                    : <><Lock size={14} /> Deploy round</>}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
