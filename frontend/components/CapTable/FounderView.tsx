"use client";

import { useState } from "react";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { isAddress } from "viem";
import {
  ADDRESSES,
  ROUND_FACTORY_ABI,
  ALLOCATIONS_ABI,
  RoundStatus,
  formatUSDT,
  parseUSDT,
} from "@/lib/contracts";
import { encryptUint64, publicDecrypt } from "@/lib/fhe";
import type { Round } from "@/lib/hooks/useRound";
import { useTxToast } from "@/components/ui/Toast";
import { UserPlus, Lock, ChevronDown, ChevronUp } from "lucide-react";

interface Props {
  round: Round;
  investors: `0x${string}`[];
  refetch: () => void;
}

export function FounderView({ round, investors, refetch }: Props) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const { write } = useTxToast();

  // Add investor form
  const [showAddForm, setShowAddForm] = useState(false);
  const [invAddr, setInvAddr]   = useState("");
  const [invAmount, setInvAmount] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  // Close flow
  const [closeStep, setCloseStep] = useState<"idle" | "requested" | "finalizing" | "done">("idle");
  const [closeError, setCloseError] = useState<string | null>(null);

  async function handleOpenRound() {
    try {
      await write("Opening round", () =>
        writeContractAsync({
          address:      ADDRESSES.RoundFactory,
          abi:          ROUND_FACTORY_ABI,
          functionName: "openRound",
          args:         [round.id],
        }),
      );
      refetch();
    } catch {
      // error surfaced by useTxToast
    }
  }

  async function handleAddInvestor() {
    if (!isAddress(invAddr) || !invAmount || !address || !publicClient) return;
    setIsAdding(true);
    try {
      const rawAmount = parseUSDT(Number(invAmount));

      // Encrypt the allocation with the Relayer SDK
      const { handle, inputProof } = await encryptUint64(
        rawAmount,
        ADDRESSES.Allocations,
        address,
        publicClient,
      );

      await write(`Adding ${invAddr.slice(0, 8)}…`, () =>
        writeContractAsync({
          address:      ADDRESSES.Allocations,
          abi:          ALLOCATIONS_ABI,
          functionName: "addInvestor",
          args:         [round.id, invAddr as `0x${string}`, handle, inputProof],
        }),
      );
      setInvAddr("");
      setInvAmount("");
      setShowAddForm(false);
      refetch();
    } catch {
      // toast already shown by useTxToast
    } finally {
      setIsAdding(false);
    }
  }

  async function handleRequestClose() {
    if (!publicClient) return;
    try {
      const hash = await write("Requesting close", () =>
        writeContractAsync({
          address:      ADDRESSES.Allocations,
          abi:          ALLOCATIONS_ABI,
          functionName: "requestClose",
          args:         [round.id],
        }),
      );
      // Wait for tx confirmation so pendingCloseHandle is set on-chain
      await publicClient.waitForTransactionReceipt({ hash });
      setCloseStep("requested");
    } catch {
      // error surfaced by useTxToast
    }
  }

  async function handleFinalizeClose() {
    if (!publicClient) return;
    setCloseError(null);
    setCloseStep("finalizing");
    try {
      // Read the handle that was stored during requestClose
      const handle = await publicClient.readContract({
        address:      ADDRESSES.Allocations,
        abi:          ALLOCATIONS_ABI,
        functionName: "pendingCloseHandle",
        args:         [round.id],
      }) as `0x${string}`;

      // Fetch the KMS-signed public decryption proof
      const { abiEncodedClearValues, decryptionProof } = await publicDecrypt(handle, publicClient);

      // Submit on-chain
      const hash = await write("Finalising close", () =>
        writeContractAsync({
          address:      ADDRESSES.Allocations,
          abi:          ALLOCATIONS_ABI,
          functionName: "submitCloseResult",
          args:         [round.id, [handle], abiEncodedClearValues, decryptionProof],
          gas:          500_000n,
        }),
      );
      await publicClient.waitForTransactionReceipt({ hash });
      setCloseStep("done");
      refetch();
    } catch (e: unknown) {
      const msg = (e as { shortMessage?: string; message?: string })?.shortMessage
        ?? (e as Error)?.message
        ?? "Failed to finalize close";
      setCloseError(msg);
      setCloseStep("requested");
    }
  }

  const canOpen  = round.status === RoundStatus.DRAFT;
  const canAddInvestor = round.status === RoundStatus.DRAFT || round.status === RoundStatus.OPEN;
  const canClose = round.status === RoundStatus.OPEN && investors.length > 0;
  const addrValid = isAddress(invAddr);

  return (
    <div className="space-y-5">

      {/* Primary action banner */}
      {canOpen && (
        <div className="border border-border rounded-2xl p-5 flex items-center justify-between gap-4 bg-surface">
          <div>
            <p className="text-sm font-medium text-foreground">Round is in draft</p>
            <p className="text-xs text-muted mt-0.5">Add investors, then open to accept subscriptions.</p>
          </div>
          <button
            onClick={handleOpenRound}
            className="shrink-0 bg-foreground text-background text-sm font-medium rounded-xl px-5 py-2 hover:opacity-80 transition-opacity"
          >
            Open round
          </button>
        </div>
      )}

      {/* Closed: verified total */}
      {round.status === RoundStatus.CLOSED && round.totalRaised > 0n && (
        <div className="bg-accent-dim rounded-2xl p-5 border border-green-200">
          <p className="text-xs font-mono text-accent-text mb-1">Publicly verified total raised</p>
          <p className="text-3xl font-semibold font-mono text-foreground">
            {formatUSDT(round.totalRaised)}
          </p>
          <p className="text-xs text-muted mt-1">KMS-decrypted · on-chain proof</p>
        </div>
      )}

      {/* Investor list */}
      <div className="border border-border rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <span className="text-xs font-mono text-muted">
            Investors
            <span className="ml-1.5 bg-chip text-chip-text rounded-full px-2 py-0.5 text-xs">
              {investors.length}
            </span>
          </span>
          {canAddInvestor && (
            <button
              onClick={() => setShowAddForm((v) => !v)}
              className="flex items-center gap-1 text-xs text-foreground font-medium hover:text-muted transition-colors"
            >
              <UserPlus size={13} />
              Add investor
              {showAddForm ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
          )}
        </div>

        {/* Inline add form */}
        {showAddForm && (
          <div className="px-4 py-4 border-b border-border bg-surface space-y-3">
            <div className="space-y-2">
              <input
                placeholder="Investor address (0x…)"
                value={invAddr}
                onChange={(e) => setInvAddr(e.target.value)}
                className={`w-full border rounded-xl px-3 py-2 text-sm font-mono bg-background focus:outline-none focus:ring-2 focus:ring-foreground/10 transition-colors ${
                  invAddr && !addrValid ? "border-destructive" : "border-border"
                }`}
              />
              <input
                type="number"
                placeholder="Allocation amount (USDT)"
                value={invAmount}
                onChange={(e) => setInvAmount(e.target.value)}
                className="w-full border border-border rounded-xl px-3 py-2 text-sm font-mono bg-background focus:outline-none focus:ring-2 focus:ring-foreground/10"
              />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted">
                Amount will be FHE-encrypted before submission.
              </p>
              <button
                onClick={handleAddInvestor}
                disabled={isAdding || !addrValid || !invAmount}
                className="text-sm bg-foreground text-background rounded-xl px-4 py-1.5 font-medium hover:opacity-80 transition-opacity disabled:opacity-40"
              >
                {isAdding ? "Encrypting…" : "Add"}
              </button>
            </div>
          </div>
        )}

        {/* List */}
        {investors.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm text-muted">No investors yet.</p>
            {canAddInvestor && (
              <button
                onClick={() => setShowAddForm(true)}
                className="text-xs text-foreground underline underline-offset-2 mt-1"
              >
                Add the first one
              </button>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {investors.map((addr) => (
              <li key={addr} className="px-4 py-3 flex items-center justify-between">
                <span className="font-mono text-xs text-foreground">
                  {addr.slice(0, 10)}…{addr.slice(-6)}
                </span>
                <span className="badge-locked">
                  <Lock size={10} /> encrypted
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Close flow */}
      {canClose && (
        <div className="border border-border rounded-2xl p-5 space-y-3">
          {closeStep === "idle" && (
            <>
              <p className="text-sm font-medium text-foreground">Close the round</p>
              <p className="text-xs text-muted leading-relaxed">
                This triggers an on-chain FHE sum of all encrypted allocations.
                The KMS then decrypts the aggregate and submits a proof — at which
                point the round is marked closed and the total raised becomes public.
              </p>
              <button
                onClick={handleRequestClose}
                className="border border-border text-sm font-medium rounded-xl px-5 py-2 hover:bg-surface transition-colors"
              >
                Request close
              </button>
            </>
          )}
          {closeStep === "requested" && (
            <div className="space-y-3">
              <div className="flex items-start gap-3 text-sm">
                <div className="mt-0.5 w-2 h-2 rounded-full bg-accent shrink-0 animate-pulse" />
                <div>
                  <p className="font-medium text-foreground">Close requested — KMS proof ready</p>
                  <p className="text-xs text-muted mt-1 leading-relaxed">
                    The aggregate is publicly decryptable. Click below to fetch the
                    KMS-signed proof and finalise the round on-chain.
                  </p>
                </div>
              </div>
              {closeError && (
                <p className="text-xs text-destructive bg-destructive/5 rounded-xl px-3 py-2">{closeError}</p>
              )}
              <button
                onClick={handleFinalizeClose}
                className="border border-border text-sm font-medium rounded-xl px-5 py-2 hover:bg-surface transition-colors"
              >
                Finalise &amp; close round
              </button>
            </div>
          )}
          {closeStep === "finalizing" && (
            <div className="flex items-center gap-2 text-sm text-muted">
              <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin shrink-0" />
              Fetching KMS proof and submitting…
            </div>
          )}
        </div>
      )}
    </div>
  );
}
