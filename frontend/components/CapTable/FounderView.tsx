"use client";

import { useState } from "react";
import { useWriteContract } from "wagmi";
import {
  ADDRESSES,
  ROUND_FACTORY_ABI,
  ALLOCATIONS_ABI,
  RoundStatus,
  formatUSDT,
} from "@/lib/contracts";
import type { Round } from "@/lib/hooks/useRound";

interface Props {
  round: Round;
  investors: `0x${string}`[];
  refetch: () => void;
}

export function FounderView({ round, investors, refetch }: Props) {
  const { writeContractAsync, isPending } = useWriteContract();
  const [step, setStep] = useState<"idle" | "requesting" | "submitting" | "done">("idle");
  const [statusMsg, setStatusMsg] = useState("");

  async function openRound() {
    await writeContractAsync({
      address:      ADDRESSES.RoundFactory,
      abi:          ROUND_FACTORY_ABI,
      functionName: "openRound",
      args:         [round.id],
    });
    refetch();
  }

  async function requestClose() {
    setStep("requesting");
    setStatusMsg("Requesting close — computing encrypted aggregate on-chain…");
    try {
      await writeContractAsync({
        address:      ADDRESSES.Allocations,
        abi:          ALLOCATIONS_ABI,
        functionName: "requestClose",
        args:         [round.id],
      });
      setStep("submitting");
      setStatusMsg("Waiting for KMS decryption proof… (check the interact script for local demo)");
    } catch (e) {
      setStep("idle");
      setStatusMsg("Transaction failed.");
    }
  }

  const canOpen  = round.status === RoundStatus.DRAFT;
  const canClose = round.status === RoundStatus.OPEN && investors.length > 0;

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-semibold text-foreground">Founder controls</h3>

      {/* Investor list */}
      <div className="border border-border rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <span className="text-xs font-mono text-muted">Investors ({investors.length})</span>
          {round.status === RoundStatus.OPEN && (
            <span className="text-xs text-accent-text">Amounts encrypted</span>
          )}
        </div>

        {investors.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted">
            No investors added yet.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {investors.map((addr) => (
              <li
                key={addr}
                className="px-4 py-3 flex items-center justify-between"
              >
                <span className="font-mono text-xs text-foreground">
                  {addr.slice(0, 10)}…{addr.slice(-6)}
                </span>
                <span className="badge-locked">🔒 encrypted</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Closed totals (after KMS decryption) */}
      {round.status === RoundStatus.CLOSED && round.totalRaised > 0n && (
        <div className="bg-accent-dim rounded-2xl p-5 border border-green-200 space-y-1">
          <p className="text-xs font-mono text-accent-text">Publicly verified total</p>
          <p className="text-2xl font-semibold font-mono text-foreground">
            {formatUSDT(round.totalRaised)}
          </p>
          <p className="text-xs text-muted">KMS-decrypted · on-chain proof</p>
        </div>
      )}

      {/* Actions */}
      <div className="space-y-3">
        {canOpen && (
          <button
            onClick={openRound}
            disabled={isPending}
            className="w-full bg-foreground text-background text-sm font-medium rounded-xl px-5 py-2.5 hover:opacity-80 transition-opacity disabled:opacity-50"
          >
            {isPending ? "Confirming…" : "Open round"}
          </button>
        )}

        {canClose && step === "idle" && (
          <button
            onClick={requestClose}
            disabled={isPending}
            className="w-full border border-border text-sm font-medium rounded-xl px-5 py-2.5 hover:bg-surface transition-colors disabled:opacity-50"
          >
            Request close
          </button>
        )}

        {step !== "idle" && (
          <div className="text-xs text-muted border border-border rounded-xl px-4 py-3 bg-surface leading-relaxed">
            {statusMsg}
          </div>
        )}
      </div>
    </div>
  );
}
