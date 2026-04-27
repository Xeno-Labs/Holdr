"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useWriteContract, usePublicClient } from "wagmi";
import { parseEventLogs } from "viem";
import { ADDRESSES, ROUND_FACTORY_ABI, parseUSDT } from "@/lib/contracts";

type Step = "details" | "investors" | "review" | "done";

interface InvestorEntry {
  address: string;
  amount:  number;
}

export default function NewRoundPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { writeContractAsync, isPending } = useWriteContract();
  const publicClient = usePublicClient();

  const [step, setStep]   = useState<Step>("details");
  const [name, setName]   = useState("");
  const [target, setTarget] = useState("");
  const [deadlineDays, setDeadlineDays] = useState("30");
  const [investors, setInvestors] = useState<InvestorEntry[]>([
    { address: "", amount: 0 },
  ]);
  const [createdId, setCreatedId] = useState<bigint | null>(null);
  const [error, setError] = useState("");

  function addInvestorRow() {
    setInvestors((prev) => [...prev, { address: "", amount: 0 }]);
  }

  function updateInvestor(i: number, field: keyof InvestorEntry, value: string | number) {
    setInvestors((prev) =>
      prev.map((inv, idx) => (idx === i ? { ...inv, [field]: value } : inv)),
    );
  }

  function removeInvestor(i: number) {
    setInvestors((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function createRound() {
    if (!isConnected || !publicClient) return;
    setError("");

    const deadlineTs = BigInt(
      Math.floor(Date.now() / 1000) + Number(deadlineDays) * 86400,
    );

    try {
      const hash = await writeContractAsync({
        address:      ADDRESSES.RoundFactory,
        abi:          ROUND_FACTORY_ABI,
        functionName: "createRound",
        args:         [name, parseUSDT(Number(target)), deadlineTs],
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const logs = parseEventLogs({
        abi:  ROUND_FACTORY_ABI,
        logs: receipt.logs,
      });
      const evt = logs.find((l) => l.eventName === "RoundCreated");
      const roundId = evt ? (evt.args as { roundId: bigint }).roundId : null;

      if (roundId !== null) {
        setCreatedId(roundId);
        setStep("done");
      }
    } catch (e: unknown) {
      setError((e as Error).message ?? "Transaction failed");
    }
  }

  if (!isConnected) {
    return (
      <div className="max-w-lg mx-auto px-6 py-20 text-center">
        <p className="text-muted text-sm">Connect your wallet to create a round.</p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-6 py-10 animate-fade-up">
      {/* Breadcrumb steps */}
      <div className="flex items-center gap-2 text-xs font-mono text-muted mb-8">
        {(["details", "investors", "review"] as Step[]).map((s, i, arr) => (
          <span key={s} className="flex items-center gap-2">
            <span className={step === s || step === "done" ? "text-foreground font-medium" : ""}>
              {s}
            </span>
            {i < arr.length - 1 && <span>›</span>}
          </span>
        ))}
      </div>

      {/* ── Step 1: details ── */}
      {step === "details" && (
        <div className="space-y-5">
          <h1 className="text-xl font-semibold">New round</h1>

          <label className="block space-y-1.5">
            <span className="text-xs text-muted font-mono">Round name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Cipher Labs Seed"
              className="w-full border border-border rounded-xl px-4 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-foreground/10"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs text-muted font-mono">Target raise (USDT)</span>
            <input
              type="number"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="500000"
              className="w-full border border-border rounded-xl px-4 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-foreground/10 font-mono"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs text-muted font-mono">Deadline (days from now)</span>
            <input
              type="number"
              value={deadlineDays}
              onChange={(e) => setDeadlineDays(e.target.value)}
              className="w-full border border-border rounded-xl px-4 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-foreground/10 font-mono"
            />
          </label>

          <button
            onClick={() => setStep("investors")}
            disabled={!name || !target}
            className="w-full bg-foreground text-background text-sm font-medium rounded-xl px-5 py-2.5 hover:opacity-80 transition-opacity disabled:opacity-40"
          >
            Next — add investors
          </button>
        </div>
      )}

      {/* ── Step 2: investors ── */}
      {step === "investors" && (
        <div className="space-y-5">
          <h2 className="text-xl font-semibold">Add investors</h2>
          <p className="text-sm text-muted leading-relaxed">
            Allocation amounts will be FHE-encrypted when submitted. Each
            investor will only be able to see their own slice.
          </p>

          <div className="space-y-3">
            {investors.map((inv, i) => (
              <div key={i} className="flex gap-2">
                <input
                  placeholder="0x… investor address"
                  value={inv.address}
                  onChange={(e) => updateInvestor(i, "address", e.target.value)}
                  className="flex-1 border border-border rounded-xl px-3 py-2 text-sm font-mono bg-background focus:outline-none focus:ring-2 focus:ring-foreground/10"
                />
                <input
                  type="number"
                  placeholder="USDT"
                  value={inv.amount || ""}
                  onChange={(e) => updateInvestor(i, "amount", Number(e.target.value))}
                  className="w-28 border border-border rounded-xl px-3 py-2 text-sm font-mono bg-background focus:outline-none focus:ring-2 focus:ring-foreground/10"
                />
                <button
                  onClick={() => removeInvestor(i)}
                  className="text-muted hover:text-destructive text-lg leading-none"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={addInvestorRow}
            className="text-sm text-muted border border-dashed border-border rounded-xl w-full py-2 hover:border-foreground/30 hover:text-foreground transition-colors"
          >
            + add row
          </button>

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setStep("details")}
              className="flex-1 border border-border rounded-xl py-2.5 text-sm hover:bg-surface transition-colors"
            >
              Back
            </button>
            <button
              onClick={() => setStep("review")}
              disabled={investors.every((inv) => !inv.address)}
              className="flex-1 bg-foreground text-background text-sm font-medium rounded-xl py-2.5 hover:opacity-80 transition-opacity disabled:opacity-40"
            >
              Review
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: review ── */}
      {step === "review" && (
        <div className="space-y-5">
          <h2 className="text-xl font-semibold">Review & deploy</h2>

          <div className="border border-border rounded-2xl divide-y divide-border overflow-hidden">
            {[
              { label: "Name",    value: name               },
              { label: "Target",  value: `$${Number(target).toLocaleString()} USDT` },
              { label: "Deadline", value: `${deadlineDays} days` },
              { label: "Investors", value: investors.filter((i) => i.address).length.toString() },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between px-4 py-3">
                <span className="text-xs font-mono text-muted">{label}</span>
                <span className="text-sm text-foreground font-medium">{value}</span>
              </div>
            ))}
          </div>

          <p className="text-xs text-muted leading-relaxed border border-border rounded-xl px-4 py-3 bg-surface">
            Investor allocation amounts will be encrypted via the Relayer SDK
            before being sent on-chain. You will be asked to confirm{" "}
            {investors.filter((i) => i.address).length + 1} transactions.
          </p>

          {error && (
            <p className="text-xs text-destructive border border-red-100 rounded-xl px-4 py-3 bg-red-50">
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setStep("investors")}
              className="flex-1 border border-border rounded-xl py-2.5 text-sm hover:bg-surface transition-colors"
            >
              Back
            </button>
            <button
              onClick={createRound}
              disabled={isPending}
              className="flex-1 bg-foreground text-background text-sm font-medium rounded-xl py-2.5 hover:opacity-80 transition-opacity disabled:opacity-50"
            >
              {isPending ? "Deploying…" : "Deploy round"}
            </button>
          </div>
        </div>
      )}

      {/* ── Done ── */}
      {step === "done" && createdId !== null && (
        <div className="text-center space-y-6 py-8">
          <div className="text-4xl">🔒</div>
          <h2 className="text-xl font-semibold">Round #{createdId.toString()} created</h2>
          <p className="text-sm text-muted">
            Now add investor allocations and open the round when ready.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => router.push(`/round/${createdId.toString()}`)}
              className="bg-foreground text-background text-sm font-medium rounded-xl px-6 py-2.5 hover:opacity-80 transition-opacity"
            >
              Go to round
            </button>
            <button
              onClick={() => { setStep("details"); setName(""); setTarget(""); setCreatedId(null); }}
              className="border border-border text-sm rounded-xl px-6 py-2.5 hover:bg-surface transition-colors"
            >
              Create another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
