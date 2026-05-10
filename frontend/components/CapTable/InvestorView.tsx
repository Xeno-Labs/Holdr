"use client";

import { useState } from "react";
import { useAccount, useWriteContract, usePublicClient } from "wagmi";
import { isAddress } from "viem";
import {
  ADDRESSES,
  SUBSCRIPTION_ABI,
  DISCLOSURE_ABI,
  MOCKCUSDT_ABI,
  MOCK_USDT_ABI,
  formatUSDT,
  RoundStatus,
} from "@/lib/contracts";
import type { Round } from "@/lib/hooks/useRound";
import { useIsSubscribed } from "@/lib/hooks/useRound";
import { useTxToast } from "@/components/ui/Toast";
import { Lock, Unlock, CheckCircle, Share2, ArrowRight, Coins } from "lucide-react";

interface Props {
  round: Round;
  decryptedAmount: bigint | null;
  isDecrypting: boolean;
  onDecrypt: () => void;
}

type SubscribeStep = "idle" | "operator" | "subscribe" | "done";

export function InvestorView({ round, decryptedAmount, isDecrypting, onDecrypt }: Props) {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const { isSubscribed } = useIsSubscribed(round.id, address);
  const { write } = useTxToast();

  async function writeAndWait(label: string, fn: () => Promise<`0x${string}`>) {
    const hash = await write(label, fn);
    await publicClient!.waitForTransactionReceipt({ hash });
    return hash;
  }

  const [subStep, setSubStep] = useState<SubscribeStep>("idle");
  const [shareAddr, setShareAddr] = useState("");
  const [shareStatus, setShareStatus] = useState<"idle" | "pending" | "done">("idle");
  const [fundStep, setFundStep] = useState<"idle" | "minting" | "approving" | "wrapping" | "done">("idle");
  const [wrapAmountInput, setWrapAmountInput] = useState("");

  async function handleFundCUSDT(amount: bigint) {
    try {
      // ── 1. Mint only if balance is short ────────────────────────────────────
      const balance = await publicClient!.readContract({
        address:      ADDRESSES.MockUSDT,
        abi:          MOCK_USDT_ABI,
        functionName: "balanceOf",
        args:         [address!],
      }) as bigint;

      if (balance < amount) {
        setFundStep("minting");
        await writeAndWait("Minting mock USDT", () =>
          writeContractAsync({
            address:      ADDRESSES.MockUSDT,
            abi:          MOCK_USDT_ABI,
            functionName: "mint",
            args:         [address!, amount - balance],
            gas:          80_000n,
          }),
        );
      }

      // ── 2. Approve only if allowance is short ───────────────────────────────
      const allowance = await publicClient!.readContract({
        address:      ADDRESSES.MockUSDT,
        abi:          MOCK_USDT_ABI,
        functionName: "allowance",
        args:         [address!, ADDRESSES.MockcUSDT],
      }) as bigint;

      if (allowance < amount) {
        setFundStep("approving");
        await writeAndWait("Approving cUSDT to spend", () =>
          writeContractAsync({
            address:      ADDRESSES.MockUSDT,
            abi:          MOCK_USDT_ABI,
            functionName: "approve",
            args:         [ADDRESSES.MockcUSDT, amount],
            gas:          60_000n,
          }),
        );
      }

      // ── 3. Wrap ─────────────────────────────────────────────────────────────
      setFundStep("wrapping");
      await writeAndWait("Wrapping USDT → cUSDT", () =>
        writeContractAsync({
          address:      ADDRESSES.MockcUSDT,
          abi:          MOCKCUSDT_ABI,
          functionName: "wrap",
          args:         [address!, amount],
          gas:          500_000n,
        }),
      );

      setFundStep("done");
    } catch {
      setFundStep("idle");
    }
  }

  async function handleSubscribe() {
    setSubStep("operator");
    try {
      const until = Math.floor(Date.now() / 1000) + 86400;
      await writeAndWait("Step 1 of 2 — Granting operator access", () =>
        writeContractAsync({
          address:      ADDRESSES.MockcUSDT,
          abi:          MOCKCUSDT_ABI,
          functionName: "setOperator",
          args:         [ADDRESSES.Subscription, until],
          gas:          80_000n,
        }),
      );

      setSubStep("subscribe");
      await writeAndWait("Step 2 of 2 — Confirming subscription", () =>
        writeContractAsync({
          address:      ADDRESSES.Subscription,
          abi:          SUBSCRIPTION_ABI,
          functionName: "subscribe",
          args:         [round.id],
          gas:          1_000_000n,
        }),
      );
      setSubStep("done");
    } catch {
      setSubStep("idle");
    }
  }

  async function handleGrantView() {
    if (!isAddress(shareAddr)) return;
    setShareStatus("pending");
    try {
      await write("Granting view access", () =>
        writeContractAsync({
          address:      ADDRESSES.Disclosure,
          abi:          DISCLOSURE_ABI,
          functionName: "grantView",
          args:         [round.id, shareAddr as `0x${string}`],
        }),
      );
      setShareStatus("done");
    } catch {
      setShareStatus("idle");
    }
  }

  const isOpen = round.status === RoundStatus.OPEN;
  const isSubscribedFinal = isSubscribed || subStep === "done";

  return (
    <div className="space-y-4">

      {/* Allocation card */}
      <div className="border border-border rounded-2xl p-6">
        <p className="text-xs font-mono text-muted mb-3">Your allocation</p>

        {decryptedAmount !== null ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="badge-unlocked"><Unlock size={10} /> decrypted</span>
            </div>
            <p className="text-4xl font-semibold font-mono text-foreground tracking-tight">
              {formatUSDT(decryptedAmount)}
            </p>
            <p className="text-xs text-muted">cUSDT · this round</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="badge-locked"><Lock size={10} /> encrypted</span>
            </div>
            <div className="flex items-baseline gap-1">
              <div className="skeleton h-10 w-36" />
            </div>
            <button
              onClick={onDecrypt}
              disabled={isDecrypting}
              className="flex items-center gap-2 text-sm font-medium border border-border rounded-xl px-4 py-2 hover:bg-surface transition-colors disabled:opacity-50"
            >
              {isDecrypting ? (
                <>
                  <span className="w-3 h-3 border border-muted border-t-transparent rounded-full animate-spin" />
                  Waiting for signature…
                </>
              ) : (
                <>
                  <Unlock size={14} /> Decrypt my amount
                </>
              )}
            </button>
            <p className="text-xs text-muted leading-relaxed">
              Your wallet will sign an EIP-712 message to authorise the KMS re-encryption.
              Nothing is submitted on-chain.
            </p>
          </div>
        )}
      </div>

      {/* Fund cUSDT — needed before subscribing */}
      {!isSubscribedFinal && decryptedAmount !== null && fundStep !== "done" && (
        <div className="border border-border rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Coins size={14} className="text-muted" />
            <p className="text-sm font-medium text-foreground">Get cUSDT</p>
          </div>
          <p className="text-xs text-muted leading-relaxed">
            You need cUSDT to pay your allocation. This mints{" "}
            <span className="font-mono text-foreground">{formatUSDT(decryptedAmount)}</span>{" "}
            test USDT and wraps it into confidential cUSDT — 3 transactions.
          </p>
          {fundStep !== "idle" && (
            <div className="flex items-center gap-3 text-xs font-mono flex-wrap">
              {(["minting", "approving", "wrapping"] as const).map((s, i, arr) => (
                <span key={s} className="flex items-center gap-1.5">
                  {["Mint", "Approve", "Wrap"][i]}
                  {i < arr.length - 1 && <ArrowRight size={10} className="text-muted" />}
                  <span className={
                    fundStep === s ? "text-foreground" :
                    arr.indexOf(fundStep) > i ? "text-accent-text" : "text-muted"
                  }>
                    {arr.indexOf(fundStep) > i ? "✓" : fundStep === s ? (
                      <span className="inline-block w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin" />
                    ) : "○"}
                  </span>
                </span>
              ))}
            </div>
          )}
          <button
            onClick={() => handleFundCUSDT(decryptedAmount)}
            disabled={fundStep !== "idle"}
            className="w-full border border-border text-sm font-medium rounded-xl py-2.5 hover:bg-surface transition-colors disabled:opacity-40"
          >
            {fundStep === "idle" ? "Mint & Wrap cUSDT" : "Processing…"}
          </button>
          {fundStep === "idle" && (
            <button
              onClick={() => setFundStep("done")}
              className="w-full text-xs text-muted hover:text-foreground transition-colors"
            >
              I already have cUSDT — skip this
            </button>
          )}
        </div>
      )}

      {/* Subscribe flow */}
      {isOpen && !isSubscribedFinal && (
        <div className="border border-border rounded-2xl p-5 space-y-4">
          <div>
            <p className="text-sm font-medium text-foreground">Subscribe to this round</p>
            <p className="text-xs text-muted mt-1 leading-relaxed">
              Two transactions: first grants the subscription contract operator access,
              then triggers the encrypted transfer and mints your equity tokens.
            </p>
          </div>

          {/* Step indicator */}
          {(subStep === "operator" || subStep === "subscribe") && (
            <div className="flex items-center gap-3 text-xs font-mono">
              <span className={`flex items-center gap-1 ${subStep === "operator" ? "text-foreground" : "text-accent-text"}`}>
                {subStep === "operator"
                  ? <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                  : <CheckCircle size={12} />}
                Grant operator
              </span>
              <ArrowRight size={11} className="text-muted" />
              <span className={`flex items-center gap-1 ${subStep === "subscribe" ? "text-foreground" : "text-muted"}`}>
                {subStep === "subscribe" && (
                  <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                )}
                Subscribe
              </span>
            </div>
          )}

          <button
            onClick={handleSubscribe}
            disabled={subStep !== "idle" || decryptedAmount === null || fundStep === "idle"}
            className="w-full bg-foreground text-background text-sm font-medium rounded-xl py-2.5 hover:opacity-80 transition-opacity disabled:opacity-40"
          >
            {subStep !== "idle" ? "Processing…" : "Subscribe"}
          </button>

          {decryptedAmount === null && subStep === "idle" && (
            <p className="text-xs text-muted">Decrypt your amount above to confirm.</p>
          )}
          {decryptedAmount !== null && fundStep === "idle" && subStep === "idle" && (
            <p className="text-xs text-muted">Mint & wrap cUSDT above before subscribing.</p>
          )}
        </div>
      )}

      {/* Subscribed */}
      {isSubscribedFinal && (
        <div className="border border-green-200 bg-accent-dim rounded-2xl p-5 flex items-start gap-3">
          <CheckCircle size={16} className="text-accent mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-accent-text">Subscribed</p>
            <p className="text-xs text-muted mt-0.5">
              Your encrypted payment was processed and equity tokens are in your wallet.
            </p>
          </div>
        </div>
      )}

      {/* Selective disclosure */}
      {decryptedAmount !== null && (
        <div className="border border-border rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Share2 size={14} className="text-muted" />
            <p className="text-sm font-medium text-foreground">Share allocation</p>
          </div>
          <p className="text-xs text-muted leading-relaxed">
            Grant a counterparty on-chain view access to your encrypted allocation
            handle — no screenshots, no trust required.
          </p>
          {shareStatus === "done" ? (
            <div className="flex items-center gap-2 text-xs text-accent-text">
              <CheckCircle size={13} /> View access granted
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Counterparty address (0x…)"
                value={shareAddr}
                onChange={(e) => setShareAddr(e.target.value)}
                className={`flex-1 border rounded-xl px-3 py-2 text-sm font-mono bg-background focus:outline-none focus:ring-2 focus:ring-foreground/10 transition-colors ${
                  shareAddr && !isAddress(shareAddr) ? "border-destructive" : "border-border"
                }`}
              />
              <button
                onClick={handleGrantView}
                disabled={shareStatus === "pending" || !isAddress(shareAddr)}
                className="text-sm border border-border rounded-xl px-4 py-2 hover:bg-chip transition-colors disabled:opacity-50 shrink-0"
              >
                {shareStatus === "pending" ? "…" : "Grant"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
