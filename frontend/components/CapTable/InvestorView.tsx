"use client";

import { useState } from "react";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import {
  ADDRESSES,
  SUBSCRIPTION_ABI,
  DISCLOSURE_ABI,
  MOCKCUSDT_ABI,
  formatUSDT,
} from "@/lib/contracts";
import type { Round } from "@/lib/hooks/useRound";
import { useIsSubscribed } from "@/lib/hooks/useRound";

interface Props {
  round: Round;
  decryptedAmount: bigint | null;
  isDecrypting: boolean;
  onDecrypt: () => void;
}

export function InvestorView({ round, decryptedAmount, isDecrypting, onDecrypt }: Props) {
  const { address } = useAccount();
  const { writeContractAsync, isPending: isTxPending } = useWriteContract();
  const { isSubscribed } = useIsSubscribed(round.id, address);

  const [shareAddr, setShareAddr] = useState("");
  const [shareStatus, setShareStatus] = useState<"idle" | "pending" | "done">("idle");

  async function handleSubscribe() {
    // Step 1: grant operator access (ERC-7984 replaces encrypted approve)
    // uint48 expiry — 24 hours from now
    const until = Math.floor(Date.now() / 1000) + 86400;
    await writeContractAsync({
      address:      ADDRESSES.MockcUSDT,
      abi:          MOCKCUSDT_ABI,
      functionName: "setOperator",
      args:         [ADDRESSES.Subscription, until],
    });

    // Step 2: subscribe — cUSDT.confidentialTransferFrom happens inside
    await writeContractAsync({
      address:      ADDRESSES.Subscription,
      abi:          SUBSCRIPTION_ABI,
      functionName: "subscribe",
      args:         [round.id],
    });
  }

  async function handleGrantView() {
    if (!shareAddr.startsWith("0x")) return;
    setShareStatus("pending");
    try {
      await writeContractAsync({
        address:      ADDRESSES.Disclosure,
        abi:          DISCLOSURE_ABI,
        functionName: "grantView",
        args:         [round.id, shareAddr as `0x${string}`],
      });
      setShareStatus("done");
    } catch {
      setShareStatus("idle");
    }
  }

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-semibold text-foreground">Your allocation</h3>

      {/* Allocation tile */}
      <div className="border border-border rounded-2xl p-5 bg-surface">
        {decryptedAmount !== null ? (
          <div className="space-y-1">
            <span className="badge-unlocked">🔓 decrypted</span>
            <p className="text-3xl font-semibold font-mono text-foreground mt-2">
              {formatUSDT(decryptedAmount)}
            </p>
            <p className="text-xs text-muted">cUSDT allocation in this round</p>
          </div>
        ) : (
          <div className="space-y-3">
            <span className="badge-locked">🔒 encrypted</span>
            <div className="skeleton h-9 w-32" />
            <button
              onClick={onDecrypt}
              disabled={isDecrypting}
              className="text-sm border border-border rounded-lg px-4 py-2 hover:bg-chip transition-colors disabled:opacity-50"
            >
              {isDecrypting ? "Decrypting…" : "Decrypt my amount"}
            </button>
          </div>
        )}
      </div>

      {/* Subscribe CTA */}
      {!isSubscribed && round.status === 1 /* OPEN */ && (
        <div className="border border-border rounded-2xl p-5 space-y-3">
          <p className="text-sm text-foreground font-medium">Ready to subscribe?</p>
          <p className="text-xs text-muted leading-relaxed">
            Subscribing will transfer your allocated cUSDT and mint your confidential
            equity tokens atomically.
          </p>
          <button
            onClick={handleSubscribe}
            disabled={isTxPending || decryptedAmount === null}
            className="bg-foreground text-background text-sm font-medium rounded-xl px-5 py-2.5 hover:opacity-80 transition-opacity disabled:opacity-50"
          >
            {isTxPending ? "Confirming…" : "Confirm subscription"}
          </button>
          {decryptedAmount === null && (
            <p className="text-xs text-muted">Decrypt your amount first to confirm.</p>
          )}
        </div>
      )}

      {isSubscribed && (
        <div className="flex items-center gap-2 text-xs text-accent-text bg-accent-dim rounded-xl px-4 py-3">
          <span>✓</span>
          <span>Subscribed — your equity tokens are in your wallet.</span>
        </div>
      )}

      {/* Selective disclosure */}
      {decryptedAmount !== null && (
        <div className="border border-border rounded-2xl p-5 space-y-3">
          <p className="text-sm font-medium text-foreground">Share with counterparty</p>
          <p className="text-xs text-muted">
            Grant a single address ACL view access to your encrypted allocation
            on-chain — no off-chain sharing required.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="0x…"
              value={shareAddr}
              onChange={(e) => setShareAddr(e.target.value)}
              className="flex-1 border border-border rounded-lg px-3 py-2 text-sm font-mono bg-background focus:outline-none focus:ring-2 focus:ring-foreground/10"
            />
            <button
              onClick={handleGrantView}
              disabled={shareStatus === "pending" || !shareAddr.startsWith("0x")}
              className="text-sm border border-border rounded-lg px-4 py-2 hover:bg-chip transition-colors disabled:opacity-50 shrink-0"
            >
              {shareStatus === "done" ? "Granted ✓" : shareStatus === "pending" ? "…" : "Grant"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
